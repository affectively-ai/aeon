/**
 * x-gnosis Topological Compression Protocol Simulation
 *
 * This is x-gnosis with its per-resource topological codec racing enabled.
 * Instead of applying one compression algorithm globally (like nginx does
 * with `gzip on;`), x-gnosis races ALL codecs per response body and
 * picks the smallest result.
 *
 * The topology per response:
 *
 *   (raw_body)-[:FORK]->(identity | gzip | brotli | deflate)
 *   (identity | gzip | brotli | deflate)-[:RACE { strategy: 'smallest' }]->(best)
 *
 * beta1 = codecs - 1 = 3 per response body
 *
 * Why this matters:
 * - For text content (JS/CSS/HTML): brotli usually wins
 * - For already-compressed content (WebP/PNG/WOFF2): identity wins
 *   (compression makes these LARGER due to entropy)
 * - For small payloads (< 256 bytes): identity often wins
 *   (compression overhead exceeds savings)
 * - For JSON configs: gzip sometimes beats brotli at level 4
 *
 * nginx can only do `gzip on;` or `gzip off;` per content type.
 * x-gnosis lets the data decide, per resource, every time.
 *
 * The wire-byte advantage is concentrated in sites with mixed content:
 * a site with JS bundles AND WebP images AND tiny SVG icons benefits
 * most because the optimal codec varies per resource.
 */

import type { SiteResource, ResourceResult, CompressionAlgo } from '../types';
import { generatePayload, compress } from '../compression/index';
import { gzipSync, brotliCompressSync, deflateSync, constants } from 'node:zlib';

/** x-gnosis response headers with topo-race Content-Encoding */
function xGnosisTopoResponseHeaderSize(
  resource: SiteResource,
  compressedSize: number,
  encoding: string
): number {
  const statusLine = 'HTTP/1.1 200 OK\r\n'.length;
  const headers = [
    `Content-Type: ${resource.contentType}; charset=utf-8`,
    `Content-Length: ${compressedSize}`,
    ...(encoding !== 'identity' ? [`Content-Encoding: ${encoding}`] : []),
    'Cache-Control: public, max-age=3600',
    'ETag: "W/a1b2c3d4e5f6"',
    'Server: x-gnosis',
    'X-Compression: topo-race',
    'Date: Fri, 14 Mar 2026 00:00:00 GMT',
    'Connection: keep-alive',
  ];
  const headerBytes = headers.reduce((sum, h) => sum + h.length + 2, 0);
  return statusLine + headerBytes + 2;
}

function xGnosisTopoRequestHeaderSize(resource: SiteResource): number {
  const methodLine = `GET ${resource.path} HTTP/1.1\r\n`.length;
  const headers = [
    'Host: example.com',
    'Accept: */*',
    'Accept-Encoding: gzip, deflate, br',
    'Connection: keep-alive',
  ];
  const headerBytes = headers.reduce((sum, h) => sum + h.length + 2, 0);
  return methodLine + headerBytes + 2;
}

/**
 * Internal overhead for topo-race is higher than plain x-gnosis:
 * - FORK frame for file race: 16 bytes
 * - DATA+FIN on winning race arm: 20 bytes
 * - VENT on 2 losing race arms: 20 bytes
 * - FORK frame for codec race (4 codecs): 10 + 8 = 18 bytes
 * - DATA+FIN on winning codec: 20 bytes
 * - VENT on 3 losing codecs: 30 bytes
 * - FORK frame for response fold: 14 bytes
 * - DATA+FIN on both fold arms: 40 bytes
 * - FOLD completion: 10 bytes
 *
 * Total: ~188 bytes internal per request (vs 120 for plain x-gnosis)
 */
const AEON_INTERNAL_TOPO_OVERHEAD = 188;

interface CodecResult {
  data: Uint8Array;
  encoding: string;
  size: number;
}

/**
 * Race all codecs on a payload, return the smallest.
 */
function raceCodecs(payload: Uint8Array): CodecResult {
  const candidates: CodecResult[] = [
    // Identity (baseline -- always a candidate)
    { data: payload, encoding: 'identity', size: payload.length },
  ];

  // Gzip level 6 (nginx default)
  try {
    const gz = gzipSync(Buffer.from(payload), { level: 6 });
    candidates.push({ data: new Uint8Array(gz), encoding: 'gzip', size: gz.length });
  } catch { /* skip on error */ }

  // Brotli quality 4 (nginx on-the-fly default)
  try {
    const br = brotliCompressSync(Buffer.from(payload), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
    });
    candidates.push({ data: new Uint8Array(br), encoding: 'br', size: br.length });
  } catch { /* skip on error */ }

  // Deflate level 6
  try {
    const df = deflateSync(Buffer.from(payload), { level: 6 });
    candidates.push({ data: new Uint8Array(df), encoding: 'deflate', size: df.length });
  } catch { /* skip on error */ }

  // Race: smallest wins
  let winner = candidates[0];
  for (const c of candidates) {
    if (c.size < winner.size) winner = c;
  }
  return winner;
}

/**
 * Simulate serving a resource through x-gnosis with topological codec racing.
 *
 * The `algo` parameter is IGNORED -- x-gnosis-topo always races all codecs
 * and picks the best per resource. This is the whole point: you don't choose
 * a compression algorithm, the topology does it for you.
 */
export function serveXGnosisTopo(
  resource: SiteResource,
  _algo: CompressionAlgo, // ignored -- topo-race decides
  totalResources: number
): ResourceResult {
  const payload = generatePayload(resource.size, resource.contentType);

  const encodeStart = performance.now();

  // The topology: fork all codecs, race to smallest
  const winner = raceCodecs(payload);

  const encodeEnd = performance.now();

  const reqHeaders = xGnosisTopoRequestHeaderSize(resource);
  const resHeaders = xGnosisTopoResponseHeaderSize(resource, winner.size, winner.encoding);

  const httpFraming = reqHeaders + resHeaders;
  const internalFraming = Math.ceil(AEON_INTERNAL_TOPO_OVERHEAD / totalResources);
  const framingOverhead = httpFraming + internalFraming;

  const decodeStart = performance.now();
  const _parsed = framingOverhead;
  const decodeEnd = performance.now();

  return {
    path: resource.path,
    rawSize: resource.size,
    compressedSize: winner.size,
    framingOverhead,
    wireBytes: winner.size + framingOverhead,
    encodeUs: (encodeEnd - encodeStart) * 1000,
    decodeUs: (decodeEnd - decodeStart) * 1000,
  };
}

/**
 * Same round trip model as plain x-gnosis.
 */
export function xGnosisTopoRoundTrips(resourceCount: number): number {
  const connections = 6;
  const tlsHandshake = 1;
  const cacheHitFactor = 1.5;
  const effectiveBatchSize = Math.ceil(connections * cacheHitFactor);
  const requestBatches = Math.ceil(resourceCount / effectiveBatchSize);
  return tlsHandshake + requestBatches;
}
