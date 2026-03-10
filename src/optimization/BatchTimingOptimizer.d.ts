/**
 * Batch Timing Optimizer (Phase 13)
 *
 * Intelligently schedules batch transmission based on network conditions,
 * device resources, and user activity patterns.
 */
/**
 * Network window quality assessment
 */
export interface NetworkWindow {
    startTime: number;
    endTime: number;
    expectedDurationMs: number;
    latencyMs: number;
    bandwidthMbps: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    isStable: boolean;
    congestionLevel: number;
    recommendedBatchSize: number;
}
/**
 * Activity pattern
 */
export interface ActivityPattern {
    type: 'user-active' | 'idle' | 'background' | 'sleep';
    startTime: number;
    duration: number;
    probability: number;
}
/**
 * Batch scheduling decision
 */
export interface SchedulingDecision {
    shouldSendNow: boolean;
    nextOptimalWindowMs: number;
    recommendedDelay: number;
    reason: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    estimatedDeliveryMs: number;
}
/**
 * Batch timing statistics
 */
export interface BatchTimingStats {
    totalBatches: number;
    immediateDeliveries: number;
    deferredBatches: number;
    averageWaitTimeMs: number;
    averageDeliveryTimeMs: number;
    networkWindowsUsed: number;
    congestionAvoided: number;
    userFocusedOptimizations: number;
}
export declare class BatchTimingOptimizer {
    private networkHistory;
    private activityHistory;
    private stats;
    private lastActivityTime;
    private isUserActive;
    private congestionDetectionWindow;
    private optimalBatchSize;
    constructor();
    /**
     * Record network measurement
     */
    recordNetworkMeasurement(latencyMs: number, bandwidthMbps: number): void;
    /**
     * Assess network quality
     */
    private assessNetworkQuality;
    /**
     * Detect congestion in network
     */
    private detectCongestion;
    /**
     * Find next optimal network window
     */
    private findOptimalWindow;
    /**
     * Get scheduling decision for a batch
     */
    getSchedulingDecision(batchSize: number, batchPriority?: 'critical' | 'high' | 'normal' | 'low', isUserTriggered?: boolean): SchedulingDecision;
    /**
     * Apply scheduling and update stats
     */
    applyScheduling(batchSize: number, sendNow: boolean, actualDelay: number): void;
    /**
     * Get optimal batch size recommendation
     */
    getOptimalBatchSize(): number;
    /**
     * Get current network window
     */
    getCurrentNetworkWindow(): NetworkWindow;
    /**
     * Set user activity state
     */
    setUserActive(active: boolean): void;
    /**
     * Get statistics
     */
    getStats(): BatchTimingStats;
    /**
     * Clear history
     */
    clear(): void;
}
export declare function getBatchTimingOptimizer(): BatchTimingOptimizer;
export declare function resetBatchTimingOptimizer(): void;
