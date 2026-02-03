import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineOperationQueue,
  getOfflineOperationQueue,
  resetOfflineOperationQueue,
} from '../../offline/OfflineOperationQueue';

describe('Offline Module', () => {
  describe('OfflineOperationQueue', () => {
    let queue: OfflineOperationQueue;

    beforeEach(() => {
      queue = new OfflineOperationQueue();
    });

    it('should enqueue an operation', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1');

      expect(op).toBeDefined();
      expect(op.type).toBe('create');
      expect(op.status).toBe('pending');
      expect(op.priority).toBe('normal');
    });

    it('should enqueue with priority', () => {
      const highOp = queue.enqueue('create', { name: 'high' }, 'session-1', 'high');
      const lowOp = queue.enqueue('create', { name: 'low' }, 'session-1', 'low');

      expect(highOp.priority).toBe('high');
      expect(lowOp.priority).toBe('low');
    });

    it('should get next batch by priority', () => {
      queue.enqueue('create', { name: 'low' }, 'session-1', 'low');
      queue.enqueue('create', { name: 'high' }, 'session-1', 'high');
      queue.enqueue('create', { name: 'normal' }, 'session-1', 'normal');

      const batch = queue.getNextBatch(3);

      expect(batch.length).toBe(3);
      expect(batch[0].priority).toBe('high');
      expect(batch[1].priority).toBe('normal');
      expect(batch[2].priority).toBe('low');
    });

    it('should mark operation as syncing', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1');
      queue.markSyncing([op.id]);

      const updated = queue.getOperation(op.id);
      expect(updated?.status).toBe('syncing');
    });

    it('should mark operation as synced', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1');
      queue.markSynced(op.id);

      const updated = queue.getOperation(op.id);
      expect(updated?.status).toBe('synced');
    });

    it('should mark operation as failed with retry', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1', 'normal', 3);
      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Network error'));

      const updated = queue.getOperation(op.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toBe('Network error');
    });

    it('should mark operation as permanently failed after max retries', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1', 'normal', 2);

      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Error 1'));
      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Error 2'));

      const updated = queue.getOperation(op.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.retryCount).toBe(2);
    });

    it('should get pending operations', () => {
      queue.enqueue('create', { name: 'test1' }, 'session-1');
      queue.enqueue('create', { name: 'test2' }, 'session-1');

      const pending = queue.getPendingOperations();
      expect(pending.length).toBe(2);
    });

    it('should get queue statistics', () => {
      queue.enqueue('create', { name: 'test1' }, 'session-1');
      queue.enqueue('create', { name: 'test2' }, 'session-1');

      const stats = queue.getStats();
      expect(stats.pending).toBe(2);
      expect(stats.totalOperations).toBe(2);
    });

    it('should clear the queue', () => {
      queue.enqueue('create', { name: 'test1' }, 'session-1');
      queue.enqueue('create', { name: 'test2' }, 'session-1');

      queue.clear();

      const stats = queue.getStats();
      expect(stats.totalOperations).toBe(0);
    });

    it('should export and import queue', () => {
      queue.enqueue('create', { name: 'test1' }, 'session-1');
      queue.enqueue('create', { name: 'test2' }, 'session-1');

      const exported = queue.export();
      expect(exported.length).toBe(2);

      const newQueue = new OfflineOperationQueue();
      newQueue.import(exported);

      const stats = newQueue.getStats();
      expect(stats.totalOperations).toBe(2);
    });

    it('should emit events', () => {
      let addedOp: unknown = null;

      queue.on('operation-added', (op) => {
        addedOp = op;
      });

      queue.enqueue('create', { name: 'test' }, 'session-1');

      expect(addedOp).toBeDefined();
    });

    it('should retry failed operations', () => {
      const op = queue.enqueue('create', { name: 'test' }, 'session-1', 'normal', 1);
      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Error'));

      const failed = queue.getOperation(op.id);
      expect(failed?.status).toBe('failed');

      queue.retryFailed();

      const retried = queue.getOperation(op.id);
      expect(retried?.status).toBe('pending');
      expect(retried?.retryCount).toBe(0);
    });
  });

  describe('Singleton', () => {
    beforeEach(() => {
      resetOfflineOperationQueue();
    });

    it('should return same instance', () => {
      const queue1 = getOfflineOperationQueue();
      const queue2 = getOfflineOperationQueue();

      expect(queue1).toBe(queue2);
    });

    it('should reset instance', () => {
      const queue1 = getOfflineOperationQueue();
      resetOfflineOperationQueue();
      const queue2 = getOfflineOperationQueue();

      expect(queue1).not.toBe(queue2);
    });
  });
});
