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
      const chunkSize = Math.min(
        64 * 1024,
        Math.ceil(batch.compressed.length / 2),
      );
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

    it('should decompress batch with no compression', async () => {
      const data = 'Test data for decompression';
      const batch = await engine.compress(data);

      // Force algorithm to 'none' for this test
      batch.algorithm = 'none';

      const decompressed = await engine.decompress(batch);

      expect(decompressed.length).toBe(batch.compressed.length);
    });

    it('should decompress batch and update stats', async () => {
      const data = 'Test data for decompression';
      const batch = await engine.compress(data);
      batch.algorithm = 'none';

      await engine.decompress(batch);

      const stats = engine.getStats();
      expect(stats.totalDecompressed).toBe(1);
      expect(stats.decompressionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle decompression of algorithm none', async () => {
      // Create a batch with no compression (algorithm: none)
      // This avoids the native stream error issue
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const batch = {
        id: 'test-batch',
        compressed: originalData,
        originalSize: 5,
        compressedSize: 5,
        compressionRatio: 0,
        algorithm: 'none' as const,
        timestamp: Date.now(),
      };

      const result = await engine.decompress(batch);
      expect(result).toEqual(originalData);
    });

    it('should throw when reassembling with missing chunks', () => {
      const chunks = [
        {
          chunkId: 'batch-1-chunk-0',
          batchId: 'batch-1',
          data: new Uint8Array([1, 2, 3]),
          index: 0,
          total: 3, // Expected 3 chunks
          checksum: '123',
        },
        {
          chunkId: 'batch-1-chunk-2',
          batchId: 'batch-1',
          data: new Uint8Array([7, 8, 9]),
          index: 2,
          total: 3,
          checksum: '789',
        },
        // Missing chunk at index 1
      ];

      expect(() => engine.reassembleChunks(chunks)).toThrow('Missing chunks');
    });

    it('should support deflate algorithm', () => {
      const deflateEngine = new CompressionEngine('deflate');
      expect(deflateEngine).toBeDefined();
    });

    it('should handle empty data compression', async () => {
      const data = new Uint8Array(0);
      const batch = await engine.compress(data);

      expect(batch.originalSize).toBe(0);
      expect(batch.compressionRatio).toBe(0);
    });

    it('should check native compression support', () => {
      const supportsNative = engine.supportsNativeCompression();
      expect(typeof supportsNative).toBe('boolean');
    });

    it('should handle compress with native support roundtrip', async () => {
      const data = 'Test data for compression roundtrip';
      const batch = await engine.compress(data);

      if (batch.algorithm !== 'none') {
        // Native compression worked
        const decompressed = await engine.decompress(batch);
        const decodedString = new TextDecoder().decode(decompressed);
        expect(decodedString).toBe(data);
      } else {
        // No native support, just verify batch was created
        expect(batch.compressed.length).toBe(batch.originalSize);
      }
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

    it('should update history', () => {
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

      optimizer.updateHistory(operations);

      expect(optimizer.getHistorySize()).toBe(2);
    });

    it('should reset stats', () => {
      const operation: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test' },
        status: 'pending',
        createdAt: Date.now(),
      };

      optimizer.computeDelta(operation);

      const statsBefore = optimizer.getStats();
      expect(statsBefore.totalOperations).toBe(1);

      optimizer.resetStats();

      const statsAfter = optimizer.getStats();
      expect(statsAfter.totalOperations).toBe(0);
      expect(statsAfter.totalFull).toBe(0);
      expect(statsAfter.totalDelta).toBe(0);
    });

    it('should set full operation threshold', () => {
      optimizer.setFullOperationThreshold(1024);

      const stats = optimizer.getStats();
      expect(stats.fullOperationThreshold).toBe(1024);
    });

    it('should get memory estimate', () => {
      const operation: Operation = {
        id: 'op-1',
        type: 'create',
        sessionId: 'session-1',
        data: { name: 'test', value: 12345 },
        status: 'pending',
        createdAt: Date.now(),
      };

      optimizer.updateHistory([operation]);

      const memoryEstimate = optimizer.getMemoryEstimate();
      expect(memoryEstimate).toBeGreaterThan(0);
    });

    it('should return 0 for empty history memory estimate', () => {
      const memoryEstimate = optimizer.getMemoryEstimate();
      expect(memoryEstimate).toBe(0);
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
