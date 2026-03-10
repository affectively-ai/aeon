/**
 * Compression Engine (Phase 12)
 *
 * Provides compression for delta operations using native CompressionStream API.
 * Falls back gracefully when native compression is unavailable.
 */
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
export declare class CompressionEngine {
    private stats;
    private preferredAlgorithm;
    constructor(preferredAlgorithm?: 'gzip' | 'deflate');
    /**
     * Check if native compression is available
     */
    supportsNativeCompression(): boolean;
    /**
     * Compress data
     */
    compress(data: Uint8Array | string): Promise<CompressedBatch>;
    /**
     * Decompress data
     */
    decompress(batch: CompressedBatch): Promise<Uint8Array>;
    /**
     * Compress using native CompressionStream
     */
    private compressNative;
    /**
     * Decompress using native DecompressionStream
     */
    private decompressNative;
    /**
     * Split compressed batch into chunks for transmission
     */
    splitIntoChunks(batch: CompressedBatch, chunkSize?: number): CompressedChunk[];
    /**
     * Reassemble chunks into compressed batch
     */
    reassembleChunks(chunks: CompressedChunk[]): Uint8Array;
    /**
     * Simple checksum for chunk verification
     */
    private simpleChecksum;
    /**
     * Update average compression ratio
     */
    private updateAverageRatio;
    /**
     * Get statistics
     */
    getStats(): CompressionStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
export declare function getCompressionEngine(): CompressionEngine;
export declare function resetCompressionEngine(): void;
