/**
 * Adaptive Compression Optimizer (Phase 13)
 *
 * Automatically adjusts compression level based on network conditions,
 * device capabilities, and real-time performance metrics.
 */
/**
 * Network conditions affecting compression
 */
export interface NetworkProfile {
    estimatedSpeedKbps: number;
    latencyMs: number;
    isOnline: boolean;
    isWifi: boolean;
    isFast: boolean;
    isSlow: boolean;
    isEmpty: boolean;
}
/**
 * Device capabilities for compression
 */
export interface DeviceProfile {
    cpuCores: number;
    cpuUtilization: number;
    memoryAvailableMB: number;
    memoryTotalMB: number;
    isConstrained: boolean;
    isPremium: boolean;
    supportsWebWorkers: boolean;
    supportsWebAssembly: boolean;
}
/**
 * Compression recommendation based on conditions
 */
export interface CompressionRecommendation {
    recommendedLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    reason: string;
    confidence: number;
    estimatedCompressionMs: number;
    estimatedRatio: number;
    networkFactor: number;
    deviceFactor: number;
}
/**
 * Adaptive compression statistics
 */
export interface AdaptiveStats {
    currentLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    averageCompressionMs: number;
    averageRatio: number;
    levelsUsed: Set<number>;
    adjustmentCount: number;
    totalBatches: number;
    networkCondition: 'fast' | 'normal' | 'slow' | 'offline';
}
export declare class AdaptiveCompressionOptimizer {
    private currentLevel;
    private networkProfile;
    private deviceProfile;
    private compressionHistory;
    private stats;
    constructor();
    /**
     * Update network conditions
     */
    updateNetworkConditions(speedKbps: number, latencyMs?: number, isOnline?: boolean): void;
    /**
     * Update device resource usage
     */
    updateDeviceResources(cpuUtilization: number, memoryAvailableMB: number): void;
    /**
     * Record compression performance
     */
    recordCompressionPerformance(level: number, compressionMs: number, ratio: number): void;
    /**
     * Get compression recommendation based on conditions
     */
    getRecommendedLevel(): CompressionRecommendation;
    /**
     * Calculate network factor (0-1)
     */
    private calculateNetworkFactor;
    /**
     * Calculate device factor (0-1)
     */
    private calculateDeviceFactor;
    /**
     * Estimate compression time for a level (in ms)
     */
    private estimateCompressionTime;
    /**
     * Estimate compression ratio for a level
     */
    private estimateCompressionRatio;
    /**
     * Apply recommendation and get new level
     */
    applyRecommendation(): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    /**
     * Get current level
     */
    getCurrentLevel(): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    /**
     * Get statistics
     */
    getStats(): AdaptiveStats;
    /**
     * Get detailed analysis
     */
    getDetailedAnalysis(): {
        stats: AdaptiveStats;
        network: NetworkProfile;
        device: DeviceProfile;
        recommendation: CompressionRecommendation;
        history: {
            level: number;
            ratio: number;
            timeMs: number;
            timestamp: number;
        }[];
    };
}
export declare function getAdaptiveCompressionOptimizer(): AdaptiveCompressionOptimizer;
export declare function resetAdaptiveCompressionOptimizer(): void;
