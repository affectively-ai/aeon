/**
 * Compression Engine (Phase 12)
 *
 * Provides compression for delta operations using native CompressionStream API.
 * Falls back gracefully when native compression is unavailable.
 */

import { getLogger } from '../utils/logger';

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

export interface CompressedBatch {
  id: string;
  compressed: Uint8Array;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: 'gzip' | 'deflate' | 'none';
  timestamp: number;
}

export interface CompressedChunk {
  chunkId: string;
  batchId: string;
  data: Uint8Array;
  index: number;
  total: number;
  checksum: string;
}

export interface CompressionStats {
  totalCompressed: number;
  totalDecompressed: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  averageCompressionRatio: number;
  compressionTimeMs: number;
  decompressionTimeMs: number;
}

// ============================================================================
// Compression Engine
// ============================================================================

export class CompressionEngine {
  private stats: CompressionStats = {
    totalCompressed: 0,
    totalDecompressed: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    averageCompressionRatio: 0,
    compressionTimeMs: 0,
    decompressionTimeMs: 0,
  };
  private preferredAlgorithm: 'gzip' | 'deflate' = 'gzip';

  constructor(preferredAlgorithm: 'gzip' | 'deflate' = 'gzip') {
    this.preferredAlgorithm = preferredAlgorithm;
    logger.debug('[CompressionEngine] Initialized', {
      algorithm: preferredAlgorithm,
      supportsNative: this.supportsNativeCompression(),
    });
  }

  /**
   * Check if native compression is available
   */
  supportsNativeCompression(): boolean {
    return (
      typeof CompressionStream !== 'undefined' &&
      typeof DecompressionStream !== 'undefined'
    );
  }

  /**
   * Compress data
   */
  async compress(data: Uint8Array | string): Promise<CompressedBatch> {
    const startTime = performance.now();

    const inputData =
      typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const originalSize = inputData.byteLength;

    let compressed: Uint8Array;
    let algorithm: 'gzip' | 'deflate' | 'none' = this.preferredAlgorithm;

    if (this.supportsNativeCompression()) {
      try {
        compressed = await this.compressNative(inputData, this.preferredAlgorithm);
      } catch (error) {
        logger.warn('[CompressionEngine] Native compression failed, using fallback', error);
        compressed = inputData;
        algorithm = 'none';
      }
    } else {
      // No native compression - return uncompressed
      compressed = inputData;
      algorithm = 'none';
    }

    const compressionRatio =
      originalSize > 0 ? 1 - compressed.byteLength / originalSize : 0;

    const batch: CompressedBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      compressed,
      originalSize,
      compressedSize: compressed.byteLength,
      compressionRatio,
      algorithm,
      timestamp: Date.now(),
    };

    // Update stats
    const elapsed = performance.now() - startTime;
    this.stats.totalCompressed++;
    this.stats.totalOriginalBytes += originalSize;
    this.stats.totalCompressedBytes += compressed.byteLength;
    this.stats.compressionTimeMs += elapsed;
    this.updateAverageRatio();

    logger.debug('[CompressionEngine] Compressed', {
      original: originalSize,
      compressed: compressed.byteLength,
      ratio: (compressionRatio * 100).toFixed(1) + '%',
      algorithm,
      timeMs: elapsed.toFixed(2),
    });

    return batch;
  }

  /**
   * Decompress data
   */
  async decompress(batch: CompressedBatch): Promise<Uint8Array> {
    const startTime = performance.now();

    let decompressed: Uint8Array;

    if (batch.algorithm === 'none') {
      decompressed = batch.compressed;
    } else if (this.supportsNativeCompression()) {
      try {
        decompressed = await this.decompressNative(
          batch.compressed,
          batch.algorithm
        );
      } catch (error) {
        logger.warn('[CompressionEngine] Native decompression failed', error);
        throw error;
      }
    } else {
      throw new Error('Native decompression not available');
    }

    // Update stats
    const elapsed = performance.now() - startTime;
    this.stats.totalDecompressed++;
    this.stats.decompressionTimeMs += elapsed;

    logger.debug('[CompressionEngine] Decompressed', {
      compressed: batch.compressedSize,
      decompressed: decompressed.byteLength,
      algorithm: batch.algorithm,
      timeMs: elapsed.toFixed(2),
    });

    return decompressed;
  }

  /**
   * Compress using native CompressionStream
   */
  private async compressNative(
    data: Uint8Array,
    algorithm: 'gzip' | 'deflate'
  ): Promise<Uint8Array> {
    const stream = new CompressionStream(algorithm);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(data);
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  /**
   * Decompress using native DecompressionStream
   */
  private async decompressNative(
    data: Uint8Array,
    algorithm: 'gzip' | 'deflate'
  ): Promise<Uint8Array> {
    const stream = new DecompressionStream(algorithm);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    writer.write(data);
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  /**
   * Split compressed batch into chunks for transmission
   */
  splitIntoChunks(batch: CompressedBatch, chunkSize = 64 * 1024): CompressedChunk[] {
    const chunks: CompressedChunk[] = [];
    const data = batch.compressed;
    const total = Math.ceil(data.byteLength / chunkSize);

    for (let i = 0; i < total; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.byteLength);
      const chunkData = data.slice(start, end);

      chunks.push({
        chunkId: `${batch.id}-chunk-${i}`,
        batchId: batch.id,
        data: chunkData,
        index: i,
        total,
        checksum: this.simpleChecksum(chunkData),
      });
    }

    return chunks;
  }

  /**
   * Reassemble chunks into compressed batch
   */
  reassembleChunks(chunks: CompressedChunk[]): Uint8Array {
    // Sort by index
    const sorted = [...chunks].sort((a, b) => a.index - b.index);

    // Verify all chunks present
    const total = sorted[0]?.total ?? 0;
    if (sorted.length !== total) {
      throw new Error(`Missing chunks: got ${sorted.length}, expected ${total}`);
    }

    // Combine
    const totalLength = sorted.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of sorted) {
      combined.set(chunk.data, offset);
      offset += chunk.data.length;
    }

    return combined;
  }

  /**
   * Simple checksum for chunk verification
   */
  private simpleChecksum(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return hash.toString(16);
  }

  /**
   * Update average compression ratio
   */
  private updateAverageRatio(): void {
    if (this.stats.totalOriginalBytes > 0) {
      this.stats.averageCompressionRatio =
        1 - this.stats.totalCompressedBytes / this.stats.totalOriginalBytes;
    }
  }

  /**
   * Get statistics
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      averageCompressionRatio: 0,
      compressionTimeMs: 0,
      decompressionTimeMs: 0,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let compressionEngineInstance: CompressionEngine | null = null;

export function getCompressionEngine(): CompressionEngine {
  if (!compressionEngineInstance) {
    compressionEngineInstance = new CompressionEngine();
  }
  return compressionEngineInstance;
}

export function resetCompressionEngine(): void {
  compressionEngineInstance = null;
}
