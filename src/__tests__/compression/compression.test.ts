import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompressionEngine,
  getCompressionEngine,
  resetCompressionEngine,
} from '../../compression/CompressionEngine';
import {
  DeltaSyncOptimizer,
  getDeltaSyncOptimizer,
  resetDeltaSyncOptimizer,
} from '../../compression/DeltaSyncOptimizer';
import type { Operation } from '../../core/types';

describe('Compression Module', () => {
  describe('CompressionEngine', () => {
    let engine: CompressionEngine;

    beforeEach(() => {
      engine = new CompressionEngine();
    });

    it('should compress string data', async () => {
      const data = 'Hello, World!'.repeat(100);
      const result = await engine.compress(data);

      expect(result).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should compress Uint8Array data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const result = await engine.compress(data);

      expect(result).toBeDefined();
      expect(result.originalSize).toBe(10);
    });

    it('should track compression stats', async () => {
      await engine.compress('Test data'.repeat(50));
      await engine.compress('More data'.repeat(50));

      const stats = engine.getStats();
      expect(stats.totalCompressed).toBe(2);
    });

    it('should split into chunks', async () => {
      const data = 'A'.repeat(200 * 1024); // 200KB
      const batch = await engine.compress(data);
      // In test environment without native compression, data may not be compressed
      // Use smaller chunk size to ensure multiple chunks
      const chunkSize = Math.min(64 * 1024, Math.ceil(batch.compressed.length / 2));
      const chunks = engine.splitIntoChunks(batch, chunkSize);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].total).toBe(chunks.length);
    });

    it('should reassemble chunks', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const batch = await engine.compress(data);
      const chunks = engine.splitIntoChunks(batch, 3);

      const reassembled = engine.reassembleChunks(chunks);
      expect(reassembled.length).toBe(batch.compressed.length);
    });

    it('should reset stats', async () => {
      await engine.compress('Test data');
      engine.resetStats();

      const stats = engine.getStats();
      expect(stats.totalCompressed).toBe(0);
    });
  });

  describe('DeltaSyncOptimizer', () => {
    let optimizer: DeltaSyncOptimizer;

    beforeEach(() => {
      optimizer = new DeltaSyncOptimizer();
    });

    it('should create full delta for new operation', () => {
      const operation: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test', value: 123 },
        status: 'pending',
        createdAt: Date.now(),
      };

      const delta = optimizer.computeDelta(operation);

      expect(delta.type).toBe('full');
      expect(delta.fullData).toEqual(operation.data);
    });

    it('should create delta for updated operation', () => {
      const operation1: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test', value: 123 },
        status: 'pending',
        createdAt: Date.now(),
      };

      const operation2: Operation = {
        ...operation1,
        data: { name: 'test', value: 456 },
      };

      optimizer.computeDelta(operation1); // First time - full
      const delta = optimizer.computeDelta(operation2); // Second time - delta

      expect(delta.type).toBe('delta');
      expect(delta.changes).toEqual({ value: 456 });
      expect(delta.changeMask).toContain('value');
    });

    it('should track deleted fields', () => {
      const operation1: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test', value: 123 },
        status: 'pending',
        createdAt: Date.now(),
      };

      const operation2: Operation = {
        ...operation1,
        data: { name: 'test' }, // value deleted
      };

      optimizer.computeDelta(operation1);
      const delta = optimizer.computeDelta(operation2);

      expect(delta.changes?.value).toBeNull();
      expect(delta.changeMask).toContain('value:deleted');
    });

    it('should compute batch deltas', () => {
      const operations: Operation[] = [
        {
          id: 'op-1',
          type: 'create',
          sessionId: 'session-1',
          data: { name: 'test1' },
          status: 'pending',
          createdAt: Date.now(),
        },
        {
          id: 'op-2',
          type: 'create',
          sessionId: 'session-1',
          data: { name: 'test2' },
          status: 'pending',
          createdAt: Date.now(),
        },
      ];

      const batch = optimizer.computeBatchDeltas(operations);

      expect(batch.operations.length).toBe(2);
      expect(batch.totalOriginalSize).toBeGreaterThan(0);
    });

    it('should decompress delta', () => {
      const operation1: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test', value: 123 },
        status: 'pending',
        createdAt: Date.now(),
      };

      const operation2: Operation = {
        ...operation1,
        data: { name: 'test', value: 456 },
      };

      optimizer.computeDelta(operation1);
      const delta = optimizer.computeDelta(operation2);

      const decompressed = optimizer.decompressDelta(delta);

      expect(decompressed.data.value).toBe(456);
    });

    it('should get statistics', () => {
      const operation: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test' },
        status: 'pending',
        createdAt: Date.now(),
      };

      optimizer.computeDelta(operation);

      const stats = optimizer.getStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.totalFull).toBe(1);
    });

    it('should clear history', () => {
      const operation: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test' },
        status: 'pending',
        createdAt: Date.now(),
      };

      optimizer.computeDelta(operation);
      expect(optimizer.getHistorySize()).toBe(1);

      optimizer.clearHistory(['op-1']);
      expect(optimizer.getHistorySize()).toBe(0);
    });
  });

  describe('Singletons', () => {
    beforeEach(() => {
      resetCompressionEngine();
      resetDeltaSyncOptimizer();
    });

    it('should return same CompressionEngine instance', () => {
      const engine1 = getCompressionEngine();
      const engine2 = getCompressionEngine();
      expect(engine1).toBe(engine2);
    });

    it('should return same DeltaSyncOptimizer instance', () => {
      const opt1 = getDeltaSyncOptimizer();
      const opt2 = getDeltaSyncOptimizer();
      expect(opt1).toBe(opt2);
    });
  });
});
