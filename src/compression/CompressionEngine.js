/**
 * Compression Engine (Phase 12)
 *
 * Provides compression for delta operations using native CompressionStream API.
 * Falls back gracefully when native compression is unavailable.
 */
import { getLogger } from '../utils/logger';
const logger = getLogger();
// ============================================================================
// Compression Engine
// ============================================================================
export class CompressionEngine {
    stats = {
        totalCompressed: 0,
        totalDecompressed: 0,
        totalOriginalBytes: 0,
        totalCompressedBytes: 0,
        averageCompressionRatio: 0,
        compressionTimeMs: 0,
        decompressionTimeMs: 0,
    };
    preferredAlgorithm = 'gzip';
    constructor(preferredAlgorithm = 'gzip') {
        this.preferredAlgorithm = preferredAlgorithm;
        logger.debug('[CompressionEngine] Initialized', {
            algorithm: preferredAlgorithm,
            supportsNative: this.supportsNativeCompression(),
        });
    }
    /**
     * Check if native compression is available
     */
    supportsNativeCompression() {
        return (typeof CompressionStream !== 'undefined' &&
            typeof DecompressionStream !== 'undefined');
    }
    /**
     * Compress data
     */
    async compress(data) {
        const startTime = performance.now();
        const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        const originalSize = inputData.byteLength;
        let compressed;
        let algorithm = this.preferredAlgorithm;
        if (this.supportsNativeCompression()) {
            try {
                compressed = await this.compressNative(inputData, this.preferredAlgorithm);
            }
            catch (error) {
                logger.warn('[CompressionEngine] Native compression failed, using fallback', error);
                compressed = inputData;
                algorithm = 'none';
            }
        }
        else {
            // No native compression - return uncompressed
            compressed = inputData;
            algorithm = 'none';
        }
        const compressionRatio = originalSize > 0 ? 1 - compressed.byteLength / originalSize : 0;
        const batch = {
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
    async decompress(batch) {
        const startTime = performance.now();
        let decompressed;
        if (batch.algorithm === 'none') {
            decompressed = batch.compressed;
        }
        else if (this.supportsNativeCompression()) {
            try {
                decompressed = await this.decompressNative(batch.compressed, batch.algorithm);
            }
            catch (error) {
                logger.warn('[CompressionEngine] Native decompression failed', error);
                throw error;
            }
        }
        else {
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
    async compressNative(data, algorithm) {
        const stream = new CompressionStream(algorithm);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        writer.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        writer.close();
        const chunks = [];
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
    async decompressNative(data, algorithm) {
        const stream = new DecompressionStream(algorithm);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        writer.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        writer.close();
        const chunks = [];
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
    splitIntoChunks(batch, chunkSize = 64 * 1024) {
        const chunks = [];
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
    reassembleChunks(chunks) {
        // Sort by index
        const sorted = [...chunks].sort((a, b) => a.index - b.index);
        // Verify all chunks present
        if (sorted.length === 0) {
            throw new Error('Cannot reassemble: no chunks provided');
        }
        const total = sorted[0].total;
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
    simpleChecksum(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data[i]) | 0;
        }
        return (hash >>> 0).toString(16);
    }
    /**
     * Update average compression ratio
     */
    updateAverageRatio() {
        if (this.stats.totalOriginalBytes > 0) {
            this.stats.averageCompressionRatio =
                1 - this.stats.totalCompressedBytes / this.stats.totalOriginalBytes;
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
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
let compressionEngineInstance = null;
export function getCompressionEngine() {
    if (!compressionEngineInstance) {
        compressionEngineInstance = new CompressionEngine();
    }
    return compressionEngineInstance;
}
export function resetCompressionEngine() {
    compressionEngineInstance = null;
}
