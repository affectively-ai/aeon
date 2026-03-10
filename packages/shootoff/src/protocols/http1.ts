/**
 * HTTP/1.1 Protocol Simulation
 *
 * Accurate overhead modeling for HTTP/1.1 with keep-alive:
 * - Request headers: ~200-400 bytes per request (method, path, host, accept, user-agent, etc.)
 * - Response headers: ~200-350 bytes per response (status, content-type, content-length, etc.)
 * - No multiplexing: 6 parallel connections max (browser limit)
 * - Each connection has TLS overhead for first request
 * - Keep-alive reuses connections but still sends full headers per request
 */

import type { SiteResource, ResourceResult, CompressionAlgo } from '../types';
import { generatePayload, compress } from '../compression/index';

/** Typical HTTP/1.1 request headers */
function requestHeaderSize(resource: SiteResource): number {
  // GET /path HTTP/1.1\r\n
  // Host: example.com\r\n
  // Accept: */*\r\n
  // Accept-Encoding: gzip, br\r\n
  // Accept-Language: en-US,en;q=0.9\r\n
  // User-Agent: Mozilla/5.0 ...\r\n
  // Connection: keep-alive\r\n
  // If-None-Match: "etag"\r\n
  // \r\n
  const methodLine = `GET ${resource.path} HTTP/1.1\r\n`.length;
  const headers = [
    'Host: example.com',
    `Accept: ${acceptForType(resource.contentType)}`,
    'Accept-Encoding: gzip, br',
    'Accept-Language: en-US,en;q=0.9',
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Connection: keep-alive',
    'Sec-Fetch-Dest: script',
    'Sec-Fetch-Mode: no-cors',
    'Sec-Fetch-Site: same-origin',
  ];
  const headerBytes = headers.reduce((sum, h) => sum + h.length + 2, 0); // +2 for \r\n
  return methodLine + headerBytes + 2; // trailing \r\n
}

/** Typical HTTP/1.1 response headers */
function responseHeaderSize(resource: SiteResource, compressedSize: number, algo: CompressionAlgo): number {
  // HTTP/1.1 200 OK\r\n
  // Content-Type: text/html; charset=utf-8\r\n
  // Content-Length: 12345\r\n
  // Content-Encoding: br\r\n
  // Cache-Control: public, max-age=31536000\r\n
  // ETag: "abc123"\r\n
  // X-Content-Type-Options: nosniff\r\n
  // Vary: Accept-Encoding\r\n
  // Date: Mon, 09 Mar 2026 00:00:00 GMT\r\n
  // Server: nginx/1.27.0\r\n
  // \r\n
  const statusLine = 'HTTP/1.1 200 OK\r\n'.length;
  const headers = [
    `Content-Type: ${resource.contentType}; charset=utf-8`,
    `Content-Length: ${compressedSize}`,
    ...(algo !== 'none' ? [`Content-Encoding: ${algo === 'brotli' ? 'br' : 'gzip'}`] : []),
    'Cache-Control: public, max-age=31536000, immutable',
    'ETag: "W/a1b2c3d4e5f6"',
    'X-Content-Type-Options: nosniff',
    'Strict-Transport-Security: max-age=63072000',
    'Vary: Accept-Encoding',
    'Date: Mon, 09 Mar 2026 00:00:00 GMT',
    'Server: nginx/1.27.0',
    'Connection: keep-alive',
  ];
  const headerBytes = headers.reduce((sum, h) => sum + h.length + 2, 0);
  return statusLine + headerBytes + 2; // trailing \r\n
}

function acceptForType(contentType: string): string {
  if (contentType.startsWith('text/html')) return 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
  if (contentType.startsWith('text/css')) return 'text/css,*/*;q=0.1';
  if (contentType === 'application/javascript') return '*/*';
  if (contentType.startsWith('image/')) return 'image/avif,image/webp,image/apng,*/*;q=0.8';
  if (contentType.startsWith('font/')) return '*/*';
  return '*/*';
}

/**
 * Simulate serving a resource over HTTP/1.1.
 */
export function serveHttp1(resource: SiteResource, algo: CompressionAlgo): ResourceResult {
  const payload = generatePayload(resource.size, resource.contentType);

  const encodeStart = performance.now();
  const compressed = compress(payload, algo);
  const encodeEnd = performance.now();

  const reqHeaders = requestHeaderSize(resource);
  const resHeaders = responseHeaderSize(resource, compressed.length, algo);
  const framingOverhead = reqHeaders + resHeaders;

  // "Decode" = decompress (we just measure time, not actually decompress for fairness)
  const decodeStart = performance.now();
  // In HTTP/1.1, the browser decompresses — we measure the overhead of parsing headers
  // which is negligible, so we just parse the header length
  const _parsed = reqHeaders + resHeaders; // simulate header parsing
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
 * Calculate round trips for HTTP/1.1.
 * 6 parallel connections, each needs 1 RTT for TLS handshake,
 * then 1 RTT per request (request + response).
 */
export function http1RoundTrips(resourceCount: number): number {
  const connections = 6;
  const tlsHandshakes = 1; // 1 RTT for TLS (each connection)
  const requestBatches = Math.ceil(resourceCount / connections);
  return tlsHandshakes + requestBatches;
}
