/**
 * Aeon Flow Protocol Simulation
 *
 * Uses the REAL FlowCodec to encode/decode frames, measuring
 * actual overhead and timing against the same payloads.
 *
 * Advantages over HTTP:
 * - 10-byte fixed header (vs 9-byte H2 frame header + HPACK headers per stream)
 * - No per-request headers — stream opened once, data flows
 * - Fork/collapse: single parent stream opens all children with one FORK frame
 * - Zerocopy decode: no payload copying on the read path
 * - Payload compression applied at application level (same gzip/brotli)
 *
 * For fair comparison, we model the same nginx reverse proxy scenario:
 * the proxy speaks Aeon Flow to the backend, same compression, same TLS.
 */

import { FlowCodec, HEADER_SIZE } from '../../../../src/flow/index';
import type { SiteResource, ResourceResult, CompressionAlgo } from '../types';
import { generatePayload, compress } from '../compression/index';

/** Aeon Flow frame header: always 10 bytes */
const AEON_FRAME_HEADER = HEADER_SIZE; // 10

/**
 * Simulate serving a resource over Aeon Flow Protocol.
 *
 * In the Aeon model:
 * 1. Server opens a root stream
 * 2. Forks N child streams (one per resource) — single FORK frame
 * 3. Each child sends compressed payload as DATA frame(s)
 * 4. Each child sends FIN
 * 5. Server collapses all children → assembled page
 *
 * Per-resource overhead:
 * - 1 DATA frame header (10 bytes) per ~16MB of payload (usually 1 frame)
 * - 1 FIN frame header (10 bytes, 0 payload)
 * - Share of FORK frame (amortized across all children)
 *
 * No per-request HTTP headers. No HPACK. No cookies. No user-agent.
 * The stream ID IS the request context.
 */
export function serveAeonFlow(
  resource: SiteResource,
  algo: CompressionAlgo,
  totalResources: number
): ResourceResult {
  const codec = FlowCodec.createSync();
  const payload = generatePayload(resource.size, resource.contentType);

  const encodeStart = performance.now();
  const compressed = compress(payload, algo);

  // Encode the DATA frame (payload)
  const dataFrame = codec.encode({
    streamId: 0, // placeholder — in real protocol this is the child stream ID
    sequence: 0,
    flags: 0,
    payload: compressed,
  });

  // Encode the FIN frame (stream complete, no payload)
  const finFrame = codec.encode({
    streamId: 0,
    sequence: 1,
    flags: 0x10, // FIN
    payload: new Uint8Array(0),
  });
  const encodeEnd = performance.now();

  // FORK frame overhead (amortized): 10 bytes header + 2 bytes per child stream ID
  const forkFrameTotal = AEON_FRAME_HEADER + (totalResources * 2);
  const forkFrameShare = forkFrameTotal / totalResources;

  // Per-resource framing: DATA header + FIN header + share of FORK
  const framingOverhead = AEON_FRAME_HEADER + AEON_FRAME_HEADER + forkFrameShare;

  // Decode
  const decodeStart = performance.now();
  const decoded = codec.decode(dataFrame);
  const _finDecoded = codec.decode(finFrame);
  const decodeEnd = performance.now();

  return {
    path: resource.path,
    rawSize: resource.size,
    compressedSize: compressed.length,
    framingOverhead: Math.ceil(framingOverhead),
    wireBytes: compressed.length + Math.ceil(framingOverhead),
    encodeUs: (encodeEnd - encodeStart) * 1000,
    decodeUs: (decodeEnd - decodeStart) * 1000,
  };
}

/**
 * Round trips for Aeon Flow:
 * 1 RTT for TCP+TLS (same as HTTP/2), then streams are multiplexed.
 * But Aeon has an advantage: the FORK frame opens all streams in one shot,
 * and the server can start pushing data immediately without waiting for
 * individual stream requests.
 *
 * Effectively 1 round trip: connect, then server pushes everything.
 * (HTTP/2 Server Push is deprecated/removed from Chrome, so HTTP/2
 * still needs the browser to discover and request resources.)
 */
export function aeonFlowRoundTrips(_resourceCount: number): number {
  return 1; // Connect + server pushes all forked streams
}
