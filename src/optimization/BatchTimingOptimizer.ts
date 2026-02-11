/**
 * Batch Timing Optimizer (Phase 13)
 *
 * Intelligently schedules batch transmission based on network conditions,
 * device resources, and user activity patterns.
 */

import { getLogger } from '../utils/logger';

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Batch Timing Optimizer
// ============================================================================

export class BatchTimingOptimizer {
  private networkHistory: Array<{
    latencyMs: number;
    bandwidthMbps: number;
    timestamp: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  }> = [];
  private activityHistory: ActivityPattern[] = [];
  private stats: BatchTimingStats = {
    totalBatches: 0,
    immediateDeliveries: 0,
    deferredBatches: 0,
    averageWaitTimeMs: 0,
    averageDeliveryTimeMs: 0,
    networkWindowsUsed: 0,
    congestionAvoided: 0,
    userFocusedOptimizations: 0,
  };
  private lastActivityTime = Date.now();
  private isUserActive = true;
  private congestionDetectionWindow = 60 * 1000;
  private optimalBatchSize = 50 * 1024;

  constructor() {
    logger.debug('[BatchTimingOptimizer] Initialized', {
      congestionWindow: this.congestionDetectionWindow,
      optimalBatchSize: this.optimalBatchSize,
    });
  }

  /**
   * Record network measurement
   */
  recordNetworkMeasurement(latencyMs: number, bandwidthMbps: number): void {
    const quality = this.assessNetworkQuality(latencyMs, bandwidthMbps);

    this.networkHistory.push({
      latencyMs,
      bandwidthMbps,
      timestamp: Date.now(),
      quality,
    });

    if (this.networkHistory.length > 100) {
      this.networkHistory.shift();
    }

    this.stats.networkWindowsUsed++;

    logger.debug('[BatchTimingOptimizer] Network measured', {
      latency: latencyMs + 'ms',
      bandwidth: bandwidthMbps.toFixed(1) + ' Mbps',
      quality,
    });
  }

  /**
   * Assess network quality
   */
  private assessNetworkQuality(
    latencyMs: number,
    bandwidthMbps: number,
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    if (latencyMs < 20 && bandwidthMbps > 10) return 'excellent';
    if (latencyMs < 50 && bandwidthMbps > 5) return 'good';
    if (latencyMs < 100 && bandwidthMbps > 2) return 'fair';
    return 'poor';
  }

  /**
   * Detect congestion in network
   */
  private detectCongestion(): number {
    const recentMeasurements = this.networkHistory.filter(
      (m) => Date.now() - m.timestamp < this.congestionDetectionWindow,
    );

    if (recentMeasurements.length < 3) {
      return 0;
    }

    const poorCount = recentMeasurements.filter(
      (m) => m.quality === 'poor',
    ).length;

    return poorCount / recentMeasurements.length;
  }

  /**
   * Find next optimal network window
   */
  private findOptimalWindow(): NetworkWindow {
    const now = Date.now();

    const recentMeasurements = this.networkHistory.slice(-20);
    if (recentMeasurements.length === 0) {
      return {
        startTime: now,
        endTime: now + 1000,
        expectedDurationMs: 1000,
        latencyMs: 50,
        bandwidthMbps: 5,
        quality: 'good',
        isStable: true,
        congestionLevel: 0,
        recommendedBatchSize: this.optimalBatchSize,
      };
    }

    const avgLatency =
      recentMeasurements.reduce((sum, m) => sum + m.latencyMs, 0) /
      recentMeasurements.length;
    const avgBandwidth =
      recentMeasurements.reduce((sum, m) => sum + m.bandwidthMbps, 0) /
      recentMeasurements.length;

    const latencyVariance =
      Math.sqrt(
        recentMeasurements.reduce(
          (sum, m) => sum + Math.pow(m.latencyMs - avgLatency, 2),
          0,
        ) / recentMeasurements.length,
      ) / avgLatency;

    const isStable = latencyVariance < 0.2;
    const congestionLevel = this.detectCongestion();
    const quality = this.assessNetworkQuality(avgLatency, avgBandwidth);

    const recommendedBatchSize = Math.max(
      10 * 1024,
      Math.min(500 * 1024, (avgBandwidth * 1024 * 100) / 8),
    );

    return {
      startTime: now,
      endTime: now + (isStable ? 30 * 1000 : 10 * 1000),
      expectedDurationMs: isStable ? 30 * 1000 : 10 * 1000,
      latencyMs: avgLatency,
      bandwidthMbps: avgBandwidth,
      quality,
      isStable,
      congestionLevel,
      recommendedBatchSize,
    };
  }

  /**
   * Get scheduling decision for a batch
   */
  getSchedulingDecision(
    batchSize: number,
    batchPriority: 'critical' | 'high' | 'normal' | 'low' = 'normal',
    isUserTriggered = false,
  ): SchedulingDecision {
    const now = Date.now();
    const currentWindow = this.findOptimalWindow();
    const congestionLevel = this.detectCongestion();

    let shouldSendNow = false;
    let recommendedDelay = 0;
    let reason = '';
    let priority = batchPriority;

    if (priority === 'critical') {
      shouldSendNow = true;
      reason = 'Critical operation (bypass optimization)';
    } else if (isUserTriggered && this.isUserActive) {
      shouldSendNow = true;
      reason = 'User-triggered operation';
      priority = 'high';
    } else if (
      currentWindow.quality === 'excellent' ||
      currentWindow.quality === 'good'
    ) {
      if (congestionLevel < 0.3) {
        shouldSendNow = true;
        reason = 'Good network conditions';
      } else {
        shouldSendNow = true;
        reason = 'Good network despite some congestion';
        recommendedDelay = 1000 + Math.random() * 2000;
      }
    } else if (currentWindow.quality === 'fair') {
      if (priority === 'high') {
        shouldSendNow = true;
        reason = 'High priority despite fair network';
      } else {
        shouldSendNow = false;
        reason = 'Fair network: waiting for better window';
        recommendedDelay = 30 * 1000 + Math.random() * 30 * 1000;
      }
    } else {
      shouldSendNow = false;
      reason = 'Poor network conditions: deferring';
      if (priority === 'high') {
        recommendedDelay = 60 * 1000 + Math.random() * 30 * 1000;
      } else {
        recommendedDelay = 120 * 1000 + Math.random() * 60 * 1000;
      }
    }

    const estimatedDeliveryMs =
      (batchSize / ((currentWindow.bandwidthMbps * 1024 * 1024) / 8)) * 1000 +
      currentWindow.latencyMs +
      recommendedDelay;

    const decision: SchedulingDecision = {
      shouldSendNow,
      nextOptimalWindowMs: now + recommendedDelay,
      recommendedDelay,
      reason,
      priority,
      estimatedDeliveryMs,
    };

    logger.debug('[BatchTimingOptimizer] Scheduling decision', {
      size: (batchSize / 1024).toFixed(1) + ' KB',
      shouldSendNow,
      delay: recommendedDelay + 'ms',
      reason,
    });

    return decision;
  }

  /**
   * Apply scheduling and update stats
   */
  applyScheduling(
    batchSize: number,
    sendNow: boolean,
    actualDelay: number,
  ): void {
    this.stats.totalBatches++;

    if (sendNow) {
      this.stats.immediateDeliveries++;
    } else {
      this.stats.deferredBatches++;
    }

    const totalWait =
      this.stats.averageWaitTimeMs * (this.stats.totalBatches - 1) +
      actualDelay;
    this.stats.averageWaitTimeMs = totalWait / this.stats.totalBatches;

    if (this.detectCongestion() > 0.3 && !sendNow) {
      this.stats.congestionAvoided++;
    }

    if (this.isUserActive) {
      this.stats.userFocusedOptimizations++;
    }

    this.stats.networkWindowsUsed++;
  }

  /**
   * Get optimal batch size recommendation
   */
  getOptimalBatchSize(): number {
    const window = this.findOptimalWindow();
    return window.recommendedBatchSize;
  }

  /**
   * Get current network window
   */
  getCurrentNetworkWindow(): NetworkWindow {
    return this.findOptimalWindow();
  }

  /**
   * Set user activity state
   */
  setUserActive(active: boolean): void {
    this.isUserActive = active;
    if (active) {
      this.lastActivityTime = Date.now();
    }
  }

  /**
   * Get statistics
   */
  getStats(): BatchTimingStats {
    return { ...this.stats };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.networkHistory = [];
    this.activityHistory = [];
    this.stats = {
      totalBatches: 0,
      immediateDeliveries: 0,
      deferredBatches: 0,
      averageWaitTimeMs: 0,
      averageDeliveryTimeMs: 0,
      networkWindowsUsed: 0,
      congestionAvoided: 0,
      userFocusedOptimizations: 0,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let batchTimingOptimizerInstance: BatchTimingOptimizer | null = null;

export function getBatchTimingOptimizer(): BatchTimingOptimizer {
  if (!batchTimingOptimizerInstance) {
    batchTimingOptimizerInstance = new BatchTimingOptimizer();
  }
  return batchTimingOptimizerInstance;
}

export function resetBatchTimingOptimizer(): void {
  batchTimingOptimizerInstance = null;
}
