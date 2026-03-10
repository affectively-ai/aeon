/**
 * Adaptive Compression Optimizer (Phase 13)
 *
 * Automatically adjusts compression level based on network conditions,
 * device capabilities, and real-time performance metrics.
 */
import { getLogger } from '../utils/logger';
const logger = getLogger();
// ============================================================================
// Adaptive Compression Optimizer
// ============================================================================
export class AdaptiveCompressionOptimizer {
    currentLevel = 6;
    networkProfile = {
        estimatedSpeedKbps: 5000,
        latencyMs: 50,
        isOnline: true,
        isWifi: false,
        isFast: true,
        isSlow: false,
        isEmpty: false,
    };
    deviceProfile = {
        cpuCores: 4,
        cpuUtilization: 0.3,
        memoryAvailableMB: 512,
        memoryTotalMB: 1024,
        isConstrained: false,
        isPremium: false,
        supportsWebWorkers: true,
        supportsWebAssembly: true,
    };
    compressionHistory = [];
    stats = {
        currentLevel: 6,
        averageCompressionMs: 10,
        averageRatio: 0.85,
        levelsUsed: new Set([6]),
        adjustmentCount: 0,
        totalBatches: 0,
        networkCondition: 'normal',
    };
    constructor() {
        logger.debug('[AdaptiveCompressionOptimizer] Initialized', {
            level: this.currentLevel,
        });
    }
    /**
     * Update network conditions
     */
    updateNetworkConditions(speedKbps, latencyMs, isOnline) {
        this.networkProfile.estimatedSpeedKbps = speedKbps;
        if (latencyMs !== undefined) {
            this.networkProfile.latencyMs = latencyMs;
        }
        if (isOnline !== undefined) {
            this.networkProfile.isOnline = isOnline;
        }
        this.networkProfile.isFast = speedKbps > 5000;
        this.networkProfile.isSlow = speedKbps < 1000;
        this.networkProfile.isEmpty = speedKbps < 100;
        if (isOnline === false) {
            this.stats.networkCondition = 'offline';
        }
        else if (this.networkProfile.isSlow) {
            this.stats.networkCondition = 'slow';
        }
        else if (this.networkProfile.isFast) {
            this.stats.networkCondition = 'fast';
        }
        else {
            this.stats.networkCondition = 'normal';
        }
        logger.debug('[AdaptiveCompressionOptimizer] Network updated', {
            speedKbps,
            condition: this.stats.networkCondition,
        });
    }
    /**
     * Update device resource usage
     */
    updateDeviceResources(cpuUtilization, memoryAvailableMB) {
        this.deviceProfile.cpuUtilization = Math.max(0, Math.min(1, cpuUtilization));
        this.deviceProfile.memoryAvailableMB = memoryAvailableMB;
        this.deviceProfile.isConstrained = memoryAvailableMB < 512;
        this.deviceProfile.isPremium = memoryAvailableMB > 2048;
        logger.debug('[AdaptiveCompressionOptimizer] Device resources updated', {
            cpuUtilization: (cpuUtilization * 100).toFixed(1) + '%',
            memoryAvailableMB,
        });
    }
    /**
     * Record compression performance
     */
    recordCompressionPerformance(level, compressionMs, ratio) {
        this.compressionHistory.push({
            level,
            ratio,
            timeMs: compressionMs,
            timestamp: Date.now(),
        });
        if (this.compressionHistory.length > 100) {
            this.compressionHistory.shift();
        }
        this.stats.totalBatches++;
        const historyLength = this.compressionHistory.length;
        if (historyLength > 0) {
            this.stats.averageCompressionMs =
                this.compressionHistory.reduce((sum, h) => sum + h.timeMs, 0) /
                    historyLength;
            this.stats.averageRatio =
                this.compressionHistory.reduce((sum, h) => sum + h.ratio, 0) /
                    historyLength;
        }
    }
    /**
     * Get compression recommendation based on conditions
     */
    getRecommendedLevel() {
        const networkFactor = this.calculateNetworkFactor();
        const deviceFactor = this.calculateDeviceFactor();
        const combinedFactor = (networkFactor + deviceFactor) / 2;
        const recommendedLevel = Math.max(1, Math.min(9, Math.round(combinedFactor * 9)));
        const estimatedCompressionMs = this.estimateCompressionTime(recommendedLevel);
        const estimatedRatio = this.estimateCompressionRatio(recommendedLevel);
        let reason = '';
        if (networkFactor < 0.3 && deviceFactor < 0.3) {
            reason = 'Slow network + constrained device: using level 1-2 (fast)';
        }
        else if (networkFactor > 0.7 && deviceFactor > 0.7) {
            reason =
                'Fast network + premium device: using level 8-9 (best compression)';
        }
        else if (networkFactor > 0.7) {
            reason = 'Fast network: prioritizing compression ratio';
        }
        else if (deviceFactor < 0.3) {
            reason = 'Constrained device: prioritizing speed';
        }
        else {
            reason = 'Normal conditions: balanced compression level';
        }
        const recommendation = {
            recommendedLevel,
            reason,
            confidence: this.compressionHistory.length > 10 ? 0.9 : 0.5,
            estimatedCompressionMs,
            estimatedRatio,
            networkFactor,
            deviceFactor,
        };
        logger.debug('[AdaptiveCompressionOptimizer] Recommendation', recommendation);
        return recommendation;
    }
    /**
     * Calculate network factor (0-1)
     */
    calculateNetworkFactor() {
        if (!this.networkProfile.isOnline)
            return 0;
        const speedMbps = this.networkProfile.estimatedSpeedKbps / 1000;
        if (speedMbps < 0.1)
            return 0;
        if (speedMbps < 1)
            return 0.1 + (speedMbps / 1) * 0.2;
        if (speedMbps < 5)
            return 0.3 + ((speedMbps - 1) / 4) * 0.3;
        if (speedMbps < 20)
            return 0.6 + ((speedMbps - 5) / 15) * 0.3;
        return Math.min(1, 0.9 + (speedMbps - 20) / 200);
    }
    /**
     * Calculate device factor (0-1)
     */
    calculateDeviceFactor() {
        let factor = 0.5;
        if (this.deviceProfile.isPremium) {
            factor = 0.8;
        }
        else if (this.deviceProfile.isConstrained) {
            factor = 0.2;
        }
        if (this.deviceProfile.cpuUtilization > 0.8) {
            factor *= 0.7;
        }
        else if (this.deviceProfile.cpuUtilization < 0.2) {
            factor *= 1.1;
        }
        if (this.deviceProfile.supportsWebAssembly) {
            factor = Math.min(1, factor + 0.1);
        }
        return Math.max(0, Math.min(1, factor));
    }
    /**
     * Estimate compression time for a level (in ms)
     */
    estimateCompressionTime(level) {
        return Math.max(1, level * 2.5);
    }
    /**
     * Estimate compression ratio for a level
     */
    estimateCompressionRatio(level) {
        return 0.6 + (level / 9) * 0.3;
    }
    /**
     * Apply recommendation and get new level
     */
    applyRecommendation() {
        const recommendation = this.getRecommendedLevel();
        const oldLevel = this.currentLevel;
        const shouldChange = recommendation.confidence > 0.7 ||
            Math.abs(recommendation.recommendedLevel - oldLevel) > 2;
        if (shouldChange) {
            this.currentLevel = recommendation.recommendedLevel;
            this.stats.levelsUsed.add(this.currentLevel);
            if (oldLevel !== this.currentLevel) {
                this.stats.adjustmentCount++;
                logger.debug('[AdaptiveCompressionOptimizer] Level adjusted', {
                    from: oldLevel,
                    to: this.currentLevel,
                    reason: recommendation.reason,
                });
            }
        }
        this.stats.currentLevel = this.currentLevel;
        return this.currentLevel;
    }
    /**
     * Get current level
     */
    getCurrentLevel() {
        return this.currentLevel;
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get detailed analysis
     */
    getDetailedAnalysis() {
        return {
            stats: this.stats,
            network: this.networkProfile,
            device: this.deviceProfile,
            recommendation: this.getRecommendedLevel(),
            history: this.compressionHistory.slice(-20),
        };
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
let adaptiveOptimizerInstance = null;
export function getAdaptiveCompressionOptimizer() {
    if (!adaptiveOptimizerInstance) {
        adaptiveOptimizerInstance = new AdaptiveCompressionOptimizer();
    }
    return adaptiveOptimizerInstance;
}
export function resetAdaptiveCompressionOptimizer() {
    adaptiveOptimizerInstance = null;
}
