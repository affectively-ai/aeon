/**
 * Adaptive Compression Optimizer (Phase 13)
 *
 * Automatically adjusts compression level based on network conditions,
 * device capabilities, and real-time performance metrics.
 */

import { getLogger } from '../utils/logger';
import type { CompressionStats } from '../compression/CompressionEngine';

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Adaptive Compression Optimizer
// ============================================================================

export class AdaptiveCompressionOptimizer {
  private currentLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6;
  private networkProfile: NetworkProfile = {
    estimatedSpeedKbps: 5000,
    latencyMs: 50,
    isOnline: true,
    isWifi: false,
    isFast: true,
    isSlow: false,
    isEmpty: false,
  };
  private deviceProfile: DeviceProfile = {
    cpuCores: 4,
    cpuUtilization: 0.3,
    memoryAvailableMB: 512,
    memoryTotalMB: 1024,
    isConstrained: false,
    isPremium: false,
    supportsWebWorkers: true,
    supportsWebAssembly: true,
  };
  private compressionHistory: Array<{
    level: number;
    ratio: number;
    timeMs: number;
    timestamp: number;
  }> = [];
  private stats: AdaptiveStats = {
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
  updateNetworkConditions(
    speedKbps: number,
    latencyMs?: number,
    isOnline?: boolean
  ): void {
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
    } else if (this.networkProfile.isSlow) {
      this.stats.networkCondition = 'slow';
    } else if (this.networkProfile.isFast) {
      this.stats.networkCondition = 'fast';
    } else {
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
  updateDeviceResources(cpuUtilization: number, memoryAvailableMB: number): void {
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
  recordCompressionPerformance(
    level: number,
    compressionMs: number,
    ratio: number
  ): void {
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
    this.stats.averageCompressionMs =
      this.compressionHistory.reduce((sum, h) => sum + h.timeMs, 0) /
      this.compressionHistory.length;
    this.stats.averageRatio =
      this.compressionHistory.reduce((sum, h) => sum + h.ratio, 0) /
      this.compressionHistory.length;
  }

  /**
   * Get compression recommendation based on conditions
   */
  getRecommendedLevel(): CompressionRecommendation {
    const networkFactor = this.calculateNetworkFactor();
    const deviceFactor = this.calculateDeviceFactor();
    const combinedFactor = (networkFactor + deviceFactor) / 2;

    const recommendedLevel = Math.max(
      1,
      Math.min(9, Math.round(combinedFactor * 9))
    ) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

    const estimatedCompressionMs = this.estimateCompressionTime(recommendedLevel);
    const estimatedRatio = this.estimateCompressionRatio(recommendedLevel);

    let reason = '';
    if (networkFactor < 0.3 && deviceFactor < 0.3) {
      reason = 'Slow network + constrained device: using level 1-2 (fast)';
    } else if (networkFactor > 0.7 && deviceFactor > 0.7) {
      reason = 'Fast network + premium device: using level 8-9 (best compression)';
    } else if (networkFactor > 0.7) {
      reason = 'Fast network: prioritizing compression ratio';
    } else if (deviceFactor < 0.3) {
      reason = 'Constrained device: prioritizing speed';
    } else {
      reason = 'Normal conditions: balanced compression level';
    }

    const recommendation: CompressionRecommendation = {
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
  private calculateNetworkFactor(): number {
    if (!this.networkProfile.isOnline) return 0;

    const speedMbps = this.networkProfile.estimatedSpeedKbps / 1000;

    if (speedMbps < 0.1) return 0;
    if (speedMbps < 1) return 0.1 + (speedMbps / 1) * 0.2;
    if (speedMbps < 5) return 0.3 + ((speedMbps - 1) / 4) * 0.3;
    if (speedMbps < 20) return 0.6 + ((speedMbps - 5) / 15) * 0.3;
    return Math.min(1, 0.9 + (speedMbps - 20) / 200);
  }

  /**
   * Calculate device factor (0-1)
   */
  private calculateDeviceFactor(): number {
    let factor = 0.5;

    if (this.deviceProfile.isPremium) {
      factor = 0.8;
    } else if (this.deviceProfile.isConstrained) {
      factor = 0.2;
    }

    if (this.deviceProfile.cpuUtilization > 0.8) {
      factor *= 0.7;
    } else if (this.deviceProfile.cpuUtilization < 0.2) {
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
  private estimateCompressionTime(level: number): number {
    return Math.max(1, level * 2.5);
  }

  /**
   * Estimate compression ratio for a level
   */
  private estimateCompressionRatio(level: number): number {
    return 0.6 + (level / 9) * 0.3;
  }

  /**
   * Apply recommendation and get new level
   */
  applyRecommendation(): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
    const recommendation = this.getRecommendedLevel();
    const oldLevel = this.currentLevel;

    const shouldChange =
      recommendation.confidence > 0.7 ||
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
  getCurrentLevel(): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 {
    return this.currentLevel;
  }

  /**
   * Get statistics
   */
  getStats(): AdaptiveStats {
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

let adaptiveOptimizerInstance: AdaptiveCompressionOptimizer | null = null;

export function getAdaptiveCompressionOptimizer(): AdaptiveCompressionOptimizer {
  if (!adaptiveOptimizerInstance) {
    adaptiveOptimizerInstance = new AdaptiveCompressionOptimizer();
  }
  return adaptiveOptimizerInstance;
}

export function resetAdaptiveCompressionOptimizer(): void {
  adaptiveOptimizerInstance = null;
}
