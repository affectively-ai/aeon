/**
 * Delta Sync Optimizer (Phase 12)
 *
 * Implements field-level change detection to reduce payload size.
 * Computes delta between current and previous operation state.
 *
 * Performance Impact:
 * - Delta sync alone: 70-80% payload reduction
 * - Combined with compression: 80-90% total reduction
 */
import type { Operation } from '../core/types';
/**
 * Delta operation - represents only changed fields
 */
export interface DeltaOperation {
    id: string;
    type: 'full' | 'delta';
    operationId: string;
    operationType: Operation['type'];
    sessionId: string;
    timestamp: number;
    changes?: Record<string, unknown>;
    changeMask?: string[];
    fullData?: Record<string, unknown>;
    priority?: 'high' | 'normal' | 'low';
}
/**
 * Batch of delta operations
 */
export interface DeltaBatch {
    batchId: string;
    operations: DeltaOperation[];
    timestamp: number;
    totalOriginalSize: number;
    totalDeltaSize: number;
    reductionPercent: number;
}
/**
 * Statistics about delta sync performance
 */
export interface DeltaStats {
    totalOperations: number;
    totalFull: number;
    totalDelta: number;
    totalOriginalSize: number;
    totalDeltaSize: number;
    averageReductionPercent: number;
    lastSyncTime: number;
    fullOperationThreshold: number;
}
export declare class DeltaSyncOptimizer {
    private static readonly MAX_HISTORY_SIZE;
    private operationHistory;
    private stats;
    constructor(fullOperationThreshold?: number);
    /**
     * Compute delta for single operation
     */
    computeDelta(operation: Operation): DeltaOperation;
    /**
     * Compute deltas for batch of operations
     */
    computeBatchDeltas(operations: Operation[]): DeltaBatch;
    /**
     * Decompress delta operation back to full operation
     */
    decompressDelta(delta: DeltaOperation): Operation;
    /**
     * Update history after successful sync
     */
    updateHistory(operations: Operation[]): void;
    /**
     * Clear history for specific operations
     */
    clearHistory(operationIds: string[]): void;
    /**
     * Get current performance statistics
     */
    getStats(): DeltaStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Set the full operation threshold
     */
    setFullOperationThreshold(bytes: number): void;
    /**
     * Get history size for memory monitoring
     */
    getHistorySize(): number;
    /**
     * Get memory footprint estimate
     */
    getMemoryEstimate(): number;
    /**
     * Deep equality check for nested objects
     */
    private deepEqual;
}
export declare function getDeltaSyncOptimizer(threshold?: number): DeltaSyncOptimizer;
export declare function resetDeltaSyncOptimizer(): void;
