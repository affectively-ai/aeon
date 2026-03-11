/**
 * Topological Compressor — Fork/Race/Collapse Applied to Compression
 *
 * Two-level fork/race/collapse:
 *
 *   LEVEL 1 (stream): Fork the entire input into global strategies.
 *     - Path A: Global brotli on the whole stream (cross-chunk dictionary)
 *     - Path B: Global gzip on the whole stream
 *     - Path C: Per-chunk topological compression (Level 2)
 *     Race all paths. Collapse to smallest.
 *
 *   LEVEL 2 (chunk): For each chunk, fork all codecs.
 *     - Race codecs per chunk. Smallest wins.
 *     - Poison codecs whose output >= raw.
 *     - Collapse: self-describing frame per chunk.
 *
 * Stream-level format (when streamRace is enabled):
 *   [0]       u8    strategy        (0 = per-chunk, N>0 = global codec ID)
 *   [1..4]    u32   original_size
 *   [5..]     [u8]  compressed data
 *
 * Per-chunk frame format:
 *   [0]       u8    codec_id
 *   [1..4]    u32   original_size
 *   [5..8]    u32   compressed_size
 *   [9..]     [u8]  compressed_data
 *
 * Zero dependencies. Works on CF Workers, Deno, Node, Bun, browsers.
 */

import type { CompressionCodec } from './codecs';
import { BUILTIN_CODECS, getCodecById } from './codecs';

// ============================================================================
// Types
// ============================================================================

/** Per-chunk compression result — which codec won and why */
export interface ChunkResult {
  /** Index of this chunk in the original data */
  chunkIndex: number;
  /** The codec that won the race for this chunk */
  codecId: number;
  /** Codec name (for diagnostics) */
  codecName: string;
  /** Original size of this chunk in bytes */
  originalSize: number;
  /** Compressed size of this chunk in bytes (including 9-byte header) */
  compressedSize: number;
  /** Compression ratio for this chunk (0 = no compression, 1 = perfect) */
  ratio: number;
  /** How many codecs were poisoned (output >= input) */
  poisoned: number;
}

/** Overall compression result */
export interface TopologicalCompressionResult {
  /** The compressed output — concatenated self-describing frames */
  data: Uint8Array;
  /** Per-chunk results */
  chunks: ChunkResult[];
  /** Total original size */
  originalSize: number;
  /** Total compressed size */
  compressedSize: number;
  /** Overall compression ratio */
  ratio: number;
  /** Number of distinct codecs used across all chunks */
  codecsUsed: number;
  /** β₁ during compression (number of parallel codec paths - 1) */
  bettiNumber: number;
  /** Compression time in milliseconds */
  timeMs: number;
  /** Strategy that won the stream-level race (only set when streamRace=true) */
  strategy?: string;
}

/** Compressor configuration */
export interface TopologicalCompressorConfig {
  /** Chunk size in bytes. Smaller = more adaptive, larger = better ratio. */
  chunkSize: number;
  /** Codecs to race. Default: all built-in codecs. */
  codecs: CompressionCodec[];
  /** Enable two-level race: global codecs vs per-chunk topological. Default: false. */
  streamRace?: boolean;
}

// ============================================================================
// Self-Describing Chunk Header (9 bytes)
// ============================================================================

const CHUNK_HEADER_SIZE = 9;

function encodeChunkHeader(
  codecId: number,
  originalSize: number,
  compressedSize: number,
): Uint8Array {
  const header = new Uint8Array(CHUNK_HEADER_SIZE);
  const view = new DataView(header.buffer);
  header[0] = codecId;
  view.setUint32(1, originalSize);
  view.setUint32(5, compressedSize);
  return header;
}

function decodeChunkHeader(
  data: Uint8Array,
  offset: number,
): { codecId: number; originalSize: number; compressedSize: number } {
  const codecId = data[offset];
  const view = new DataView(data.buffer, data.byteOffset + offset + 1, 8);
  const originalSize = view.getUint32(0);
  const compressedSize = view.getUint32(4);
  return { codecId, originalSize, compressedSize };
}

// ============================================================================
// Stream-Level Header (5 bytes) — only present when streamRace=true
// ============================================================================

const STREAM_HEADER_SIZE = 5;

function encodeStreamHeader(
  strategy: number,
  originalSize: number,
): Uint8Array {
  const header = new Uint8Array(STREAM_HEADER_SIZE);
  header[0] = strategy;
  new DataView(header.buffer).setUint32(1, originalSize);
  return header;
}

function decodeStreamHeader(
  data: Uint8Array,
): { strategy: number; originalSize: number } {
  const strategy = data[0];
  const originalSize = new DataView(
    data.buffer, data.byteOffset + 1, 4,
  ).getUint32(0);
  return { strategy, originalSize };
}

// ============================================================================
// Topological Compressor
// ============================================================================

export class TopologicalCompressor {
  private readonly config: TopologicalCompressorConfig & { streamRace: boolean };

  constructor(config?: Partial<TopologicalCompressorConfig>) {
    this.config = {
      chunkSize: config?.chunkSize ?? 4096,
      codecs: config?.codecs ?? BUILTIN_CODECS,
      streamRace: config?.streamRace ?? false,
    };
  }

  /**
   * Compress data using fork/race/collapse.
   *
   * When streamRace=false (default): per-chunk race only.
   * When streamRace=true: two-level race — global codecs vs per-chunk topo.
   */
  compress(data: Uint8Array): TopologicalCompressionResult {
    if (data.length === 0) {
      return {
        data: new Uint8Array(0),
        chunks: [],
        originalSize: 0,
        compressedSize: 0,
        ratio: 0,
        codecsUsed: 0,
        bettiNumber: 0,
        timeMs: 0,
      };
    }

    if (!this.config.streamRace) {
      return this.compressChunked(data);
    }

    return this.compressTwoLevel(data);
  }

  /**
   * Decompress data produced by compress().
   */
  decompress(compressed: Uint8Array): Uint8Array {
    if (compressed.length === 0) return new Uint8Array(0);

    if (!this.config.streamRace) {
      return this.decompressChunked(compressed);
    }

    return this.decompressTwoLevel(compressed);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Level 2: Per-Chunk Topological Compression
  // ════════════════════════════════════════════════════════════════════════

  private compressChunked(data: Uint8Array): TopologicalCompressionResult {
    const startTime = performance.now();
    const { chunkSize, codecs } = this.config;
    const numChunks = Math.ceil(data.length / chunkSize);
    const compressedChunks: Uint8Array[] = [];
    const chunkResults: ChunkResult[] = [];
    const codecWins = new Set<number>();

    const bettiNumber = Math.max(0, codecs.length - 1);

    for (let i = 0; i < numChunks; i++) {
      const chunkStart = i * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize, data.length);
      const chunk = data.subarray(chunkStart, chunkEnd);

      let bestCodecId = 0;
      let bestCompressed = chunk;
      let poisonCount = 0;

      for (const codec of codecs) {
        const compressed = codec.encode(chunk);

        if (compressed.length >= chunk.length && codec.id !== 0) {
          poisonCount++;
          continue;
        }

        if (compressed.length < bestCompressed.length) {
          bestCodecId = codec.id;
          bestCompressed = compressed;
        }
      }

      const header = encodeChunkHeader(
        bestCodecId,
        chunk.length,
        bestCompressed.length,
      );
      const frame = new Uint8Array(CHUNK_HEADER_SIZE + bestCompressed.length);
      frame.set(header, 0);
      frame.set(bestCompressed, CHUNK_HEADER_SIZE);

      compressedChunks.push(frame);
      codecWins.add(bestCodecId);

      const codecName =
        codecs.find((c) => c.id === bestCodecId)?.name ?? 'unknown';

      chunkResults.push({
        chunkIndex: i,
        codecId: bestCodecId,
        codecName,
        originalSize: chunk.length,
        compressedSize: frame.length,
        ratio: chunk.length > 0 ? 1 - frame.length / chunk.length : 0,
        poisoned: poisonCount,
      });
    }

    const totalCompressedSize = compressedChunks.reduce(
      (sum, c) => sum + c.length,
      0,
    );
    const output = new Uint8Array(totalCompressedSize);
    let offset = 0;
    for (const c of compressedChunks) {
      output.set(c, offset);
      offset += c.length;
    }

    return {
      data: output,
      chunks: chunkResults,
      originalSize: data.length,
      compressedSize: totalCompressedSize,
      ratio: data.length > 0 ? 1 - totalCompressedSize / data.length : 0,
      codecsUsed: codecWins.size,
      bettiNumber,
      timeMs: performance.now() - startTime,
    };
  }

  private decompressChunked(compressed: Uint8Array): Uint8Array {
    const chunks: Array<{
      codecId: number;
      originalSize: number;
      compressedData: Uint8Array;
    }> = [];
    let totalOriginalSize = 0;
    let readPos = 0;

    while (readPos < compressed.length) {
      if (readPos + CHUNK_HEADER_SIZE > compressed.length) {
        throw new Error(`Truncated chunk header at offset ${readPos}`);
      }

      const { codecId, originalSize, compressedSize } = decodeChunkHeader(
        compressed,
        readPos,
      );
      readPos += CHUNK_HEADER_SIZE;

      if (readPos + compressedSize > compressed.length) {
        throw new Error(
          `Truncated chunk data at offset ${readPos}: need ${compressedSize}, have ${compressed.length - readPos}`,
        );
      }

      chunks.push({
        codecId,
        originalSize,
        compressedData: compressed.subarray(readPos, readPos + compressedSize),
      });
      readPos += compressedSize;
      totalOriginalSize += originalSize;
    }

    const output = new Uint8Array(totalOriginalSize);
    let writePos = 0;

    for (const chunk of chunks) {
      const codec = getCodecById(chunk.codecId);
      const decompressed = codec.decode(
        chunk.compressedData,
        chunk.originalSize,
      );
      output.set(decompressed, writePos);
      writePos += chunk.originalSize;
    }

    return output;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Level 1: Stream-Level Two-Level Race
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Two-level fork/race/collapse:
   *
   *   FORK (stream level):
   *     ├─ Path 0: Per-chunk topological (Level 2)
   *     ├─ Path 1: Global codec A on entire stream
   *     ├─ Path 2: Global codec B on entire stream
   *     └─ ...
   *   RACE: Smallest total output wins
   *   COLLAPSE: 5-byte strategy header + compressed data
   *
   * On homogeneous text, global brotli wins (cross-chunk dictionary).
   * On mixed content, per-chunk topo wins (adapts per region).
   * The topology decides — not the programmer.
   */
  private compressTwoLevel(data: Uint8Array): TopologicalCompressionResult {
    const startTime = performance.now();
    const { codecs } = this.config;

    // ── FORK: Run all strategies in parallel ──

    // Strategy 0: Per-chunk topological (Level 2)
    const chunkedResult = this.compressChunked(data);
    const chunkedTotal = STREAM_HEADER_SIZE + chunkedResult.compressedSize;

    // Strategies 1+: Each codec globally on the full stream
    interface GlobalCandidate {
      codecId: number;
      codecName: string;
      compressed: Uint8Array;
      totalSize: number; // including 5-byte stream header
    }

    const globalCandidates: GlobalCandidate[] = [];

    for (const codec of codecs) {
      if (codec.id === 0) continue; // skip raw — can't beat per-chunk raw

      try {
        const compressed = codec.encode(data);
        const totalSize = STREAM_HEADER_SIZE + compressed.length;

        if (compressed.length < data.length) {
          globalCandidates.push({
            codecId: codec.id,
            codecName: codec.name,
            compressed,
            totalSize,
          });
        }
      } catch {
        // Codec unavailable or failed — poisoned
      }
    }

    // ── RACE: Find the smallest output ──
    let bestStrategy = 0; // 0 = per-chunk
    let bestSize = chunkedTotal;
    let bestGlobal: GlobalCandidate | null = null;

    for (const candidate of globalCandidates) {
      if (candidate.totalSize < bestSize) {
        bestStrategy = candidate.codecId;
        bestSize = candidate.totalSize;
        bestGlobal = candidate;
      }
    }

    // ── COLLAPSE: Build stream-level output ──
    const streamHeader = encodeStreamHeader(bestStrategy, data.length);

    // β₁: outer race has (globalCandidates.length + 1) paths,
    // inner race has codecs.length paths per chunk
    // Total independent cycles = outer_paths - 1 + inner_β₁
    const outerPaths = globalCandidates.length + 1; // +1 for per-chunk
    const innerBeta = Math.max(0, codecs.length - 1);
    const totalBeta = (outerPaths - 1) + innerBeta;

    if (bestStrategy === 0) {
      // Per-chunk topological won — prefix with stream header
      const output = new Uint8Array(STREAM_HEADER_SIZE + chunkedResult.data.length);
      output.set(streamHeader, 0);
      output.set(chunkedResult.data, STREAM_HEADER_SIZE);

      return {
        ...chunkedResult,
        data: output,
        compressedSize: output.length,
        ratio: data.length > 0 ? 1 - output.length / data.length : 0,
        bettiNumber: totalBeta,
        strategy: 'chunked',
        timeMs: performance.now() - startTime,
      };
    } else {
      // Global codec won
      const output = new Uint8Array(STREAM_HEADER_SIZE + bestGlobal!.compressed.length);
      output.set(streamHeader, 0);
      output.set(bestGlobal!.compressed, STREAM_HEADER_SIZE);

      return {
        data: output,
        chunks: [],
        originalSize: data.length,
        compressedSize: output.length,
        ratio: data.length > 0 ? 1 - output.length / data.length : 0,
        codecsUsed: 1,
        bettiNumber: totalBeta,
        strategy: `global:${bestGlobal!.codecName}`,
        timeMs: performance.now() - startTime,
      };
    }
  }

  private decompressTwoLevel(compressed: Uint8Array): Uint8Array {
    if (compressed.length < STREAM_HEADER_SIZE) {
      throw new Error('Truncated stream header');
    }

    const { strategy, originalSize } = decodeStreamHeader(compressed);
    const payload = compressed.subarray(STREAM_HEADER_SIZE);

    if (strategy === 0) {
      // Per-chunk topological
      return this.decompressChunked(payload);
    } else {
      // Global codec
      const codec = getCodecById(strategy);
      return codec.decode(payload, originalSize);
    }
  }

  /** Get the codecs available for racing. */
  getCodecs(): ReadonlyArray<CompressionCodec> {
    return this.config.codecs;
  }

  /** Get the chunk size. */
  getChunkSize(): number {
    return this.config.chunkSize;
  }
}
