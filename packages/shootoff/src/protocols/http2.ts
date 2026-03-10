/**
 * HTTP/2 Protocol Simulation
 *
 * Accurate overhead modeling for HTTP/2:
 * - Single TCP connection, multiplexed streams
 * - HPACK header compression (first request is full, subsequent reuse dynamic table)
 * - 9-byte frame header per DATA frame
 * - HEADERS frames use HPACK (typically 20-80 bytes after compression)
 * - Max concurrent streams: 100 (typical server default)
 * - No head-of-line blocking at application level (but still at TCP level)
 */

import type { SiteResource, ResourceResult, CompressionAlgo } from '../types';
import { generatePayload, compress } from '../compression/index';

/** HTTP/2 frame header: always 9 bytes */
const H2_FRAME_HEADER = 9;

/** Max DATA frame payload (16KB default) */
const H2_MAX_FRAME_PAYLOAD = 16_384;

/**
 * Simulate HPACK compressed header size.
 *
 * HPACK uses:
 * - Static table (61 common headers): 1-2 bytes per match
 * - Dynamic table: first occurrence full, subsequent 1-2 bytes
 * - Huffman encoding: ~80% of original string length
 *
 * We model: first request is ~100 bytes, subsequent ~30-50 bytes (table reuse).
 */
function hpackRequestSize(resource: SiteResource, isFirst: boolean): number {
  if (isFirst) {
    // First request: :method, :path, :scheme, :authority + accept, user-agent, etc.
    // HPACK compresses common headers aggressively
    // :method GET = 2 bytes (static table index)
    // :scheme https = 2 bytes
    // :authority example.com = ~14 bytes (Huffman)
    // :path /path = ~path.length * 0.8 bytes (Huffman)
    // accept, user-agent, accept-encoding etc. = ~60 bytes first time
    const pathBytes = Math.ceil(resource.path.length * 0.8);
    return 2 + 2 + 14 + pathBytes + 60;
  } else {
    // Subsequent: most headers cached in dynamic table
    // :path is usually unique, rest is 1-2 bytes each
    const pathBytes = Math.ceil(resource.path.length * 0.8);
    return 2 + 2 + 2 + pathBytes + 8; // mostly indexed
  }
}

function hpackResponseSize(resource: SiteResource, compressedSize: number, algo: CompressionAlgo, isFirst: boolean): number {
  if (isFirst) {
    // :status 200 = 1 byte (static table)
    // content-type = ~contentType.length * 0.8
    // content-length = ~8 bytes
    // cache-control, etag, server, date, etc. = ~80 bytes first time
    const ctBytes = Math.ceil(resource.contentType.length * 0.8);
    return 1 + ctBytes + 8 + 80 + (algo !== 'none' ? 4 : 0);
  } else {
    // Most response headers cached
    const ctBytes = Math.ceil(resource.contentType.length * 0.8);
    return 1 + ctBytes + 8 + 12 + (algo !== 'none' ? 2 : 0);
  }
}

/**
 * Calculate how many DATA frames are needed for a given payload size.
 * Each DATA frame has a 9-byte header.
 */
function dataFrameOverhead(payloadSize: number): number {
  if (payloadSize === 0) return 0;
  const numFrames = Math.ceil(payloadSize / H2_MAX_FRAME_PAYLOAD);
  return numFrames * H2_FRAME_HEADER;
}

/**
 * Simulate serving a resource over HTTP/2.
 */
export function serveHttp2(
  resource: SiteResource,
  algo: CompressionAlgo,
  isFirstRequest: boolean
): ResourceResult {
  const payload = generatePayload(resource.size, resource.contentType);

  const encodeStart = performance.now();
  const compressed = compress(payload, algo);
  const encodeEnd = performance.now();

  // HEADERS frame: HPACK-compressed request + response headers
  const reqHpack = hpackRequestSize(resource, isFirstRequest);
  const resHpack = hpackResponseSize(resource, compressed.length, algo, isFirstRequest);
  // HEADERS frame itself has a 9-byte frame header
  const headersOverhead = H2_FRAME_HEADER + reqHpack + H2_FRAME_HEADER + resHpack;

  // DATA frames for the payload
  const dataOverhead = dataFrameOverhead(compressed.length);

  const framingOverhead = headersOverhead + dataOverhead;

  const decodeStart = performance.now();
  // Simulate HPACK decode + frame parsing
  const _parsed = headersOverhead;
  const decodeEnd = performance.now();

  return {
    path: resource.path,
    rawSize: resource.size,
    compressedSize: compressed.length,
    framingOverhead,
    wireBytes: compressed.length + framingOverhead,
    encodeUs: (encodeEnd - encodeStart) * 1000,
    decodeUs: (decodeEnd - decodeStart) * 1000,
  };
}

/**
 * Round trips for HTTP/2:
 * 1 RTT for TCP+TLS, then all requests multiplexed on 1 connection.
 * Effectively 2 round trips (connect + one flight of all requests).
 */
export function http2RoundTrips(_resourceCount: number): number {
  return 2; // TCP+TLS handshake + one multiplexed flight
}
