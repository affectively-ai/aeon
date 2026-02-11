/**
 * Prefetching Engine (Phase 13)
 *
 * Predictively pre-compresses batches based on detected operation patterns.
 * Analyzes historical data to predict which operations are most likely to occur.
 */

import { getLogger } from '../utils/logger';
import type { Operation } from '../core/types';

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Prefetching Engine
// ============================================================================

export class PrefetchingEngine {
  private operationHistory: Array<{
    type: string;
    timestamp: number;
    size: number;
  }> = [];
  private patterns: Map<string, OperationPattern> = new Map();
  private prefetchCache: Map<string, PrefetchedBatch[]> = new Map();
  private maxHistoryEntries = 1000;
  private maxCachePerType = 5;
  private prefetchTTL = 5 * 60 * 1000; // 5 minutes
  private predictionThreshold = 0.3;
  private stats: PrefetchingStats = {
    totalPrefetched: 0,
    totalHits: 0,
    totalMisses: 0,
    totalOverwrites: 0,
    hitRatio: 0,
    bandwidthSaved: 0,
    patternsDetected: 0,
    predictionAccuracy: 0,
  };
  private lastPredictionTime = 0;
  private predictionInterval = 30 * 1000;

  constructor() {
    logger.debug('[PrefetchingEngine] Initialized', {
      ttl: this.prefetchTTL,
      threshold: this.predictionThreshold,
    });
  }

  /**
   * Record operation for pattern analysis
   */
  recordOperation(operationType: string, size: number): void {
    const now = Date.now();

    this.operationHistory.push({
      type: operationType,
      timestamp: now,
      size,
    });

    if (this.operationHistory.length > this.maxHistoryEntries) {
      this.operationHistory.shift();
    }

    // Clean expired prefetches periodically
    if (Math.random() < 0.1) {
      this.cleanExpiredPrefetches();
    }

    logger.debug('[PrefetchingEngine] Operation recorded', {
      type: operationType,
      size,
      historySize: this.operationHistory.length,
    });
  }

  /**
   * Analyze patterns in operation history
   */
  private analyzePatterns(): void {
    if (this.operationHistory.length < 5) {
      return;
    }

    const patterns = new Map<string, OperationPattern>();

    // Find 2-3 operation sequences
    for (let length = 2; length <= 3; length++) {
      for (let i = 0; i < this.operationHistory.length - length; i++) {
        const sequence = this.operationHistory
          .slice(i, i + length)
          .map((op) => op.type);
        const key = sequence.join(' → ');

        if (!patterns.has(key)) {
          patterns.set(key, {
            sequence,
            frequency: 0,
            probability: 0,
            lastOccurred: 0,
            avgIntervalMs: 0,
          });
        }

        const pattern = patterns.get(key)!;
        pattern.frequency++;
        pattern.lastOccurred = Date.now();
      }
    }

    // Calculate probabilities
    const totalSequences = this.operationHistory.length;

    for (const [key, pattern] of patterns.entries()) {
      pattern.probability = Math.min(1, pattern.frequency / totalSequences);
    }

    this.patterns = patterns;
    this.stats.patternsDetected = patterns.size;

    logger.debug('[PrefetchingEngine] Patterns analyzed', {
      patternsFound: patterns.size,
    });
  }

  /**
   * Predict next operations
   */
  predictNextOperations(recentOperations: Operation[]): OperationPrediction[] {
    const now = Date.now();

    if (now - this.lastPredictionTime > this.predictionInterval) {
      this.analyzePatterns();
      this.lastPredictionTime = now;
    }

    if (this.patterns.size === 0) {
      return [];
    }

    const predictions: OperationPrediction[] = [];
    const recentTypeSequence = recentOperations
      .slice(-3)
      .map((op) => op.type)
      .join(' → ');

    for (const [key, pattern] of this.patterns.entries()) {
      if (key.includes(recentTypeSequence)) {
        const nextType = pattern.sequence[pattern.sequence.length - 1];

        const prediction: OperationPrediction = {
          operationType: nextType,
          probability: pattern.probability,
          reason: `Detected pattern: ${key}`,
          shouldPrefetch: pattern.probability > this.predictionThreshold,
          estimatedTimeMs: pattern.avgIntervalMs,
        };

        predictions.push(prediction);
      }
    }

    // Deduplicate and sort
    const deduped = Array.from(
      new Map(predictions.map((p) => [p.operationType, p])).values(),
    ).sort((a, b) => b.probability - a.probability);

    logger.debug('[PrefetchingEngine] Predictions', {
      predictions: deduped.slice(0, 3).map((p) => ({
        type: p.operationType,
        probability: (p.probability * 100).toFixed(1) + '%',
      })),
    });

    return deduped;
  }

  /**
   * Add prefetched batch
   */
  addPrefetchedBatch(
    operationType: string,
    compressed: Uint8Array,
    originalSize: number,
  ): PrefetchedBatch {
    if (!this.prefetchCache.has(operationType)) {
      this.prefetchCache.set(operationType, []);
    }

    const cache = this.prefetchCache.get(operationType)!;

    if (cache.length >= this.maxCachePerType) {
      const oldest = cache.shift()!;
      if (oldest.hitCount === 0) {
        this.stats.totalMisses++;
      } else {
        this.stats.totalOverwrites++;
      }
    }

    const batch: PrefetchedBatch = {
      id: `prefetch-${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operationType,
      compressed,
      compressedSize: compressed.length,
      originalSize,
      compressionRatio: 1 - compressed.length / originalSize,
      compressed_at: Date.now(),
      created_at: Date.now(),
      ttl: this.prefetchTTL,
      expiresAt: Date.now() + this.prefetchTTL,
      hitCount: 0,
      missCount: 0,
    };

    cache.push(batch);
    this.stats.totalPrefetched++;
    this.stats.bandwidthSaved += originalSize - compressed.length;

    logger.debug('[PrefetchingEngine] Prefetched batch added', {
      type: operationType,
      id: batch.id,
      ratio: (batch.compressionRatio * 100).toFixed(1) + '%',
    });

    return batch;
  }

  /**
   * Try to use prefetched batch
   */
  getPrefetchedBatch(operationType: string): PrefetchedBatch | null {
    const cache = this.prefetchCache.get(operationType);
    if (!cache || cache.length === 0) {
      return null;
    }

    const now = Date.now();
    for (let i = 0; i < cache.length; i++) {
      const batch = cache[i];

      if (batch.expiresAt > now) {
        batch.hitCount++;
        this.stats.totalHits++;
        this.updatePredictionAccuracy(true);

        logger.debug('[PrefetchingEngine] Prefetch hit', {
          type: operationType,
          id: batch.id,
        });

        return batch;
      } else {
        cache.splice(i, 1);
        i--;
        batch.missCount++;
        this.stats.totalMisses++;
        this.updatePredictionAccuracy(false);
      }
    }

    return null;
  }

  /**
   * Update prediction accuracy metric
   */
  private updatePredictionAccuracy(hit: boolean): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    if (total === 0) return;

    this.stats.predictionAccuracy = this.stats.totalHits / total;
  }

  /**
   * Clean expired prefetches
   */
  private cleanExpiredPrefetches(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [type, cache] of this.prefetchCache.entries()) {
      for (let i = cache.length - 1; i >= 0; i--) {
        if (cache[i].expiresAt < now) {
          const batch = cache.splice(i, 1)[0];
          if (batch.hitCount === 0) {
            this.stats.totalMisses++;
          }
          cleanedCount++;
        }
      }

      if (cache.length === 0) {
        this.prefetchCache.delete(type);
      }
    }

    if (cleanedCount > 0) {
      logger.debug('[PrefetchingEngine] Cleaned expired prefetches', {
        count: cleanedCount,
      });
    }
  }

  /**
   * Get statistics
   */
  getStats(): PrefetchingStats {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRatio = total > 0 ? this.stats.totalHits / total : 0;

    return { ...this.stats };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.operationHistory = [];
    this.patterns.clear();
    this.prefetchCache.clear();
    this.stats = {
      totalPrefetched: 0,
      totalHits: 0,
      totalMisses: 0,
      totalOverwrites: 0,
      hitRatio: 0,
      bandwidthSaved: 0,
      patternsDetected: 0,
      predictionAccuracy: 0,
    };
    logger.debug('[PrefetchingEngine] Cleared all caches');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let prefetchingEngineInstance: PrefetchingEngine | null = null;

export function getPrefetchingEngine(): PrefetchingEngine {
  if (!prefetchingEngineInstance) {
    prefetchingEngineInstance = new PrefetchingEngine();
  }
  return prefetchingEngineInstance;
}

export function resetPrefetchingEngine(): void {
  prefetchingEngineInstance = null;
}
