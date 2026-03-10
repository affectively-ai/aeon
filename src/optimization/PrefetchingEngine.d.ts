/**
 * Prefetching Engine (Phase 13)
 *
 * Predictively pre-compresses batches based on detected operation patterns.
 * Analyzes historical data to predict which operations are most likely to occur.
 */
import type { Operation } from '../core/types';
/**
 * Pattern in operation sequence
 */
export interface OperationPattern {
    sequence: string[];
    frequency: number;
    probability: number;
    lastOccurred: number;
    avgIntervalMs: number;
}
/**
 * Prediction for next operations
 */
export interface OperationPrediction {
    operationType: string;
    probability: number;
    reason: string;
    shouldPrefetch: boolean;
    estimatedTimeMs: number;
}
/**
 * Prefetched batch
 */
export interface PrefetchedBatch {
    id: string;
    operationType: string;
    compressed: Uint8Array;
    compressedSize: number;
    originalSize: number;
    compressionRatio: number;
    compressed_at: number;
    created_at: number;
    ttl: number;
    expiresAt: number;
    hitCount: number;
    missCount: number;
}
/**
 * Prefetching statistics
 */
export interface PrefetchingStats {
    totalPrefetched: number;
    totalHits: number;
    totalMisses: number;
    totalOverwrites: number;
    hitRatio: number;
    bandwidthSaved: number;
    patternsDetected: number;
    predictionAccuracy: number;
}
export declare class PrefetchingEngine {
    private operationHistory;
    private patterns;
    private prefetchCache;
    private maxHistoryEntries;
    private maxCachePerType;
    private prefetchTTL;
    private predictionThreshold;
    private stats;
    private lastPredictionTime;
    private predictionInterval;
    constructor();
    /**
     * Record operation for pattern analysis
     */
    recordOperation(operationType: string, size: number): void;
    /**
     * Analyze patterns in operation history
     */
    private analyzePatterns;
    /**
     * Predict next operations
     */
    predictNextOperations(recentOperations: Operation[]): OperationPrediction[];
    /**
     * Add prefetched batch
     */
    addPrefetchedBatch(operationType: string, compressed: Uint8Array, originalSize: number): PrefetchedBatch;
    /**
     * Try to use prefetched batch
     */
    getPrefetchedBatch(operationType: string): PrefetchedBatch | null;
    /**
     * Update prediction accuracy metric
     */
    private updatePredictionAccuracy;
    /**
     * Clean expired prefetches
     */
    private cleanExpiredPrefetches;
    /**
     * Get statistics
     */
    getStats(): PrefetchingStats;
    /**
     * Clear all caches
     */
    clear(): void;
}
export declare function getPrefetchingEngine(): PrefetchingEngine;
export declare function resetPrefetchingEngine(): void;
