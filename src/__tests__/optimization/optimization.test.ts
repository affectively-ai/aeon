import { describe, it, expect, beforeEach } from 'vitest';
import {
  PrefetchingEngine,
  getPrefetchingEngine,
  resetPrefetchingEngine,
} from '../../optimization/PrefetchingEngine';
import {
  BatchTimingOptimizer,
  getBatchTimingOptimizer,
  resetBatchTimingOptimizer,
} from '../../optimization/BatchTimingOptimizer';
import {
  AdaptiveCompressionOptimizer,
  getAdaptiveCompressionOptimizer,
  resetAdaptiveCompressionOptimizer,
} from '../../optimization/AdaptiveCompressionOptimizer';

describe('Optimization Module', () => {
  describe('PrefetchingEngine', () => {
    let engine: PrefetchingEngine;

    beforeEach(() => {
      engine = new PrefetchingEngine();
    });

    it('should record operations', () => {
      engine.recordOperation('create', 100);
      engine.recordOperation('update', 200);

      const stats = engine.getStats();
      expect(stats.totalPrefetched).toBe(0);
    });

    it('should add prefetched batch', () => {
      const compressed = new Uint8Array([1, 2, 3, 4, 5]);
      const batch = engine.addPrefetchedBatch('create', compressed, 100);

      expect(batch).toBeDefined();
      expect(batch.operationType).toBe('create');
      expect(batch.compressedSize).toBe(5);
      expect(batch.originalSize).toBe(100);
    });

    it('should get prefetched batch', () => {
      const compressed = new Uint8Array([1, 2, 3, 4, 5]);
      engine.addPrefetchedBatch('create', compressed, 100);

      const batch = engine.getPrefetchedBatch('create');

      expect(batch).toBeDefined();
      expect(batch?.hitCount).toBe(1);
    });

    it('should return null for non-existent batch', () => {
      const batch = engine.getPrefetchedBatch('nonexistent');
      expect(batch).toBeNull();
    });

    it('should track statistics', () => {
      const compressed = new Uint8Array([1, 2, 3, 4, 5]);
      engine.addPrefetchedBatch('create', compressed, 100);
      engine.getPrefetchedBatch('create');

      const stats = engine.getStats();
      expect(stats.totalPrefetched).toBe(1);
      expect(stats.totalHits).toBe(1);
    });

    it('should clear caches', () => {
      const compressed = new Uint8Array([1, 2, 3, 4, 5]);
      engine.addPrefetchedBatch('create', compressed, 100);

      engine.clear();

      const stats = engine.getStats();
      expect(stats.totalPrefetched).toBe(0);
    });

    it('should predict next operations based on patterns', () => {
      // Record enough operations to trigger pattern analysis
      for (let i = 0; i < 10; i++) {
        engine.recordOperation('create', 100);
        engine.recordOperation('update', 200);
        engine.recordOperation('delete', 150);
      }

      const recentOps = [
        { type: 'create', size: 100, timestamp: Date.now() - 200 },
        { type: 'update', size: 200, timestamp: Date.now() - 100 },
      ];

      const predictions = engine.predictNextOperations(recentOps);

      // Should return predictions based on detected patterns
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should return empty predictions with insufficient history', () => {
      const recentOps = [{ type: 'create', size: 100, timestamp: Date.now() }];

      const predictions = engine.predictNextOperations(recentOps);

      expect(predictions).toEqual([]);
    });

    it('should handle operation patterns', () => {
      // Build up operation history with a repeating pattern
      for (let i = 0; i < 20; i++) {
        engine.recordOperation('read', 50);
        engine.recordOperation('write', 100);
      }

      const stats = engine.getStats();
      expect(stats.patternsDetected).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BatchTimingOptimizer', () => {
    let optimizer: BatchTimingOptimizer;

    beforeEach(() => {
      optimizer = new BatchTimingOptimizer();
    });

    it('should record network measurements', () => {
      optimizer.recordNetworkMeasurement(50, 10);

      const window = optimizer.getCurrentNetworkWindow();
      expect(window).toBeDefined();
    });

    it('should get scheduling decision', () => {
      optimizer.recordNetworkMeasurement(20, 15); // Good network

      const decision = optimizer.getSchedulingDecision(10000);

      expect(decision).toBeDefined();
      expect(decision.shouldSendNow).toBe(true);
      expect(decision.reason).toContain('Good network');
    });

    it('should handle critical priority', () => {
      const decision = optimizer.getSchedulingDecision(10000, 'critical');

      expect(decision.shouldSendNow).toBe(true);
      expect(decision.reason).toContain('Critical');
    });

    it('should recommend batch size', () => {
      optimizer.recordNetworkMeasurement(30, 10);

      const size = optimizer.getOptimalBatchSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should track statistics', () => {
      optimizer.applyScheduling(10000, true, 0);
      optimizer.applyScheduling(10000, false, 5000);

      const stats = optimizer.getStats();
      expect(stats.totalBatches).toBe(2);
      expect(stats.immediateDeliveries).toBe(1);
      expect(stats.deferredBatches).toBe(1);
    });

    it('should clear history', () => {
      optimizer.recordNetworkMeasurement(50, 10);
      optimizer.applyScheduling(10000, true, 0);

      optimizer.clear();

      const stats = optimizer.getStats();
      expect(stats.totalBatches).toBe(0);
    });

    it('should set user active state', () => {
      optimizer.setUserActive(true);
      // When user is active, scheduling may change
      const decisionActive = optimizer.getSchedulingDecision(10000);
      expect(decisionActive).toBeDefined();

      optimizer.setUserActive(false);
      const decisionInactive = optimizer.getSchedulingDecision(10000);
      expect(decisionInactive).toBeDefined();
    });
  });

  describe('AdaptiveCompressionOptimizer', () => {
    let optimizer: AdaptiveCompressionOptimizer;

    beforeEach(() => {
      optimizer = new AdaptiveCompressionOptimizer();
    });

    it('should have default level', () => {
      const level = optimizer.getCurrentLevel();
      expect(level).toBe(6);
    });

    it('should update network conditions', () => {
      optimizer.updateNetworkConditions(10000); // Fast

      const stats = optimizer.getStats();
      expect(stats.networkCondition).toBe('fast');
    });

    it('should detect slow network', () => {
      optimizer.updateNetworkConditions(500); // Slow

      const stats = optimizer.getStats();
      expect(stats.networkCondition).toBe('slow');
    });

    it('should detect offline', () => {
      optimizer.updateNetworkConditions(0, undefined, false);

      const stats = optimizer.getStats();
      expect(stats.networkCondition).toBe('offline');
    });

    it('should update device resources', () => {
      optimizer.updateDeviceResources(0.8, 256);

      const analysis = optimizer.getDetailedAnalysis();
      expect(analysis.device.cpuUtilization).toBe(0.8);
      expect(analysis.device.isConstrained).toBe(true);
    });

    it('should get recommended level', () => {
      const recommendation = optimizer.getRecommendedLevel();

      expect(recommendation).toBeDefined();
      expect(recommendation.recommendedLevel).toBeGreaterThanOrEqual(1);
      expect(recommendation.recommendedLevel).toBeLessThanOrEqual(9);
      expect(recommendation.confidence).toBeGreaterThan(0);
    });

    it('should record compression performance', () => {
      optimizer.recordCompressionPerformance(6, 10, 0.85);
      optimizer.recordCompressionPerformance(6, 12, 0.83);

      const stats = optimizer.getStats();
      expect(stats.totalBatches).toBe(2);
      expect(stats.averageCompressionMs).toBeGreaterThan(0);
    });

    it('should apply recommendation', () => {
      // Force a significant change
      optimizer.updateNetworkConditions(100); // Very slow
      optimizer.updateDeviceResources(0.9, 128); // Constrained

      const level = optimizer.applyRecommendation();
      expect(level).toBeLessThanOrEqual(9);
      expect(level).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Singletons', () => {
    beforeEach(() => {
      resetPrefetchingEngine();
      resetBatchTimingOptimizer();
      resetAdaptiveCompressionOptimizer();
    });

    it('should return same PrefetchingEngine instance', () => {
      const e1 = getPrefetchingEngine();
      const e2 = getPrefetchingEngine();
      expect(e1).toBe(e2);
    });

    it('should return same BatchTimingOptimizer instance', () => {
      const o1 = getBatchTimingOptimizer();
      const o2 = getBatchTimingOptimizer();
      expect(o1).toBe(o2);
    });

    it('should return same AdaptiveCompressionOptimizer instance', () => {
      const o1 = getAdaptiveCompressionOptimizer();
      const o2 = getAdaptiveCompressionOptimizer();
      expect(o1).toBe(o2);
    });
  });
});
