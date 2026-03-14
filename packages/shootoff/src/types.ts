/**
 * Shootoff Types
 *
 * Shared types for protocol comparison benchmarks.
 */

/** A single resource in a site manifest */
export interface SiteResource {
  /** Path relative to site root (e.g. "/js/app.bundle.js") */
  path: string;
  /** MIME type */
  contentType: string;
  /** Raw uncompressed size in bytes */
  size: number;
  /** Whether this resource blocks rendering */
  renderBlocking: boolean;
  /** Resource priority (higher = load first) */
  priority: number;
}

/** A complete site definition */
export interface SiteManifest {
  name: string;
  description: string;
  resources: SiteResource[];
}

/** Compression algorithm */
export type CompressionAlgo = 'none' | 'gzip' | 'brotli' | 'topo-pure' | 'topo-full';

/** Protocol under test */
export type Protocol = 'http1' | 'http2' | 'http3' | 'aeon-flow' | 'aeon-flux-http' | 'aeon-flux-flow' | 'x-gnosis' | 'x-gnosis-topo';

/** Result of serving a single resource through a protocol */
export interface ResourceResult {
  path: string;
  /** Raw uncompressed payload size */
  rawSize: number;
  /** Compressed payload size (or raw if no compression) */
  compressedSize: number;
  /** Protocol framing overhead in bytes (headers, frame headers, etc.) */
  framingOverhead: number;
  /** Total wire bytes = compressedSize + framingOverhead */
  wireBytes: number;
  /** Time to encode in microseconds */
  encodeUs: number;
  /** Time to decode in microseconds */
  decodeUs: number;
}

/** Result of serving an entire site through a protocol */
export interface SiteResult {
  protocol: Protocol;
  compression: CompressionAlgo;
  site: string;
  resources: ResourceResult[];
  /** Total raw bytes across all resources */
  totalRawBytes: number;
  /** Total compressed bytes */
  totalCompressedBytes: number;
  /** Total framing overhead */
  totalFramingOverhead: number;
  /** Total wire bytes (compressed + framing) */
  totalWireBytes: number;
  /** Total encode time in microseconds */
  totalEncodeUs: number;
  /** Total decode time in microseconds */
  totalDecodeUs: number;
  /** Number of round trips needed (connection setup + requests) */
  roundTrips: number;
  /** Number of concurrent streams possible */
  maxConcurrentStreams: number;
  /** Framing overhead as percentage of total wire bytes */
  framingOverheadPercent: number;
  /** Compression ratio (totalCompressedBytes / totalRawBytes) */
  compressionRatio: number;
  /** Bandwidth savings vs uncompressed HTTP/1.1 (percentage) */
  savingsVsBaseline?: number;
}

/** Comparison table row */
export interface ComparisonRow {
  protocol: Protocol;
  compression: CompressionAlgo;
  totalRaw: string;
  totalWire: string;
  overhead: string;
  overheadPct: string;
  compressionRatio: string;
  roundTrips: number;
  encodeMs: string;
  decodeMs: string;
  savings: string;
}
