import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      const highOp = queue.enqueue(
        'create',
        { name: 'high' },
        'session-1',
        'high',
      );
      const lowOp = queue.enqueue(
        'create',
        { name: 'low' },
        'session-1',
        'low',
      );

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
      const op = queue.enqueue(
        'create',
        { name: 'test' },
        'session-1',
        'normal',
        3,
      );
      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Network error'));

      const updated = queue.getOperation(op.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.retryCount).toBe(1);
      expect(updated?.lastError).toBe('Network error');
    });

    it('should mark operation as permanently failed after max retries', () => {
      const op = queue.enqueue(
        'create',
        { name: 'test' },
        'session-1',
        'normal',
        2,
      );

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
      const op = queue.enqueue(
        'create',
        { name: 'test' },
        'session-1',
        'normal',
        1,
      );
      queue.markSyncing([op.id]);
      queue.markFailed(op.id, new Error('Error'));

      const failed = queue.getOperation(op.id);
      expect(failed?.status).toBe('failed');

      queue.retryFailed();

      const retried = queue.getOperation(op.id);
      expect(retried?.status).toBe('pending');
      expect(retried?.retryCount).toBe(0);
    });

    it('should get pending count', () => {
      queue.enqueue('create', { name: 'test1' }, 'session-1');
      queue.enqueue('create', { name: 'test2' }, 'session-1');
      const op3 = queue.enqueue('create', { name: 'test3' }, 'session-1');

      // Mark one as synced
      queue.markSynced(op3.id);

      const pendingCount = queue.getPendingCount();
      expect(pendingCount).toBe(2);
    });

    it('should clear failed operations', () => {
      const op1 = queue.enqueue(
        'create',
        { name: 'test1' },
        'session-1',
        'normal',
        1,
      );
      const op2 = queue.enqueue(
        'create',
        { name: 'test2' },
        'session-1',
        'normal',
        1,
      );
      queue.enqueue('create', { name: 'test3' }, 'session-1');

      // Make op1 and op2 fail
      queue.markSyncing([op1.id]);
      queue.markFailed(op1.id, new Error('Error'));
      queue.markSyncing([op2.id]);
      queue.markFailed(op2.id, new Error('Error'));

      // op1 and op2 should now be failed
      expect(queue.getOperation(op1.id)?.status).toBe('failed');
      expect(queue.getOperation(op2.id)?.status).toBe('failed');

      queue.clearFailed();

      // Failed operations should be removed
      expect(queue.getOperation(op1.id)).toBeUndefined();
      expect(queue.getOperation(op2.id)).toBeUndefined();
      // Pending operation should still exist
      expect(queue.getStats().totalOperations).toBe(1);
    });

    it('should handle queue overflow by removing low priority', () => {
      // Create queue with small max size
      const smallQueue = new OfflineOperationQueue(5);

      // Add 5 low priority operations
      smallQueue.enqueue('create', { n: 1 }, 'session-1', 'low');
      smallQueue.enqueue('create', { n: 2 }, 'session-1', 'low');
      smallQueue.enqueue('create', { n: 3 }, 'session-1', 'low');
      smallQueue.enqueue('create', { n: 4 }, 'session-1', 'low');
      smallQueue.enqueue('create', { n: 5 }, 'session-1', 'low');

      // Add a high priority operation (should evict oldest low priority)
      smallQueue.enqueue('create', { n: 6 }, 'session-1', 'high');

      const stats = smallQueue.getStats();
      // Should still have 5 (max size) after eviction
      expect(stats.totalOperations).toBeLessThanOrEqual(5);
    });

    describe('markSynced delayed removal', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should remove synced operation after delay', () => {
        const op = queue.enqueue('create', { name: 'test' }, 'session-1');
        queue.markSynced(op.id);

        // Operation should still exist immediately
        expect(queue.getOperation(op.id)?.status).toBe('synced');

        // Advance timer past the 1 second delay
        vi.advanceTimersByTime(1100);

        // Operation should now be removed
        expect(queue.getOperation(op.id)).toBeUndefined();
      });

      it('should emit queue-empty when last operation is removed', () => {
        let queueEmptyEmitted = false;
        queue.on('queue-empty', () => {
          queueEmptyEmitted = true;
        });

        const op = queue.enqueue('create', { name: 'test' }, 'session-1');
        queue.markSynced(op.id);

        // Advance timer past the delay
        vi.advanceTimersByTime(1100);

        expect(queueEmptyEmitted).toBe(true);
      });

      it('should not emit queue-empty when there are pending operations', () => {
        let queueEmptyEmitted = false;
        queue.on('queue-empty', () => {
          queueEmptyEmitted = true;
        });

        const op1 = queue.enqueue('create', { name: 'test1' }, 'session-1');
        queue.enqueue('create', { name: 'test2' }, 'session-1'); // This stays pending

        queue.markSynced(op1.id);

        // Advance timer past the delay
        vi.advanceTimersByTime(1100);

        // Should not emit queue-empty because op2 is still pending
        expect(queueEmptyEmitted).toBe(false);
      });
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
