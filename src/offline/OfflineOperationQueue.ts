/**
 * Offline Operation Queue (Phase 11)
 *
 * Manages pending operations for offline-first clients.
 * Provides priority-based queuing, persistence, and retry logic.
 */

import { EventEmitter } from 'eventemitter3';
import { getLogger } from '../utils/logger';
import type { Operation, OperationPriority } from '../core/types';

const logger = getLogger();

// Re-export OperationPriority from core
export type { OperationPriority } from '../core/types';

export interface OfflineOperation {
  id: string;
  type: Operation['type'];
  data: Record<string, unknown>;
  sessionId: string;
  priority: OperationPriority;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
}

export interface OfflineQueueStats {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
  totalOperations: number;
  oldestPendingMs: number;
  averageRetries: number;
}

export interface OfflineQueueEvents {
  'operation-added': (operation: OfflineOperation) => void;
  'operation-synced': (operation: OfflineOperation) => void;
  'operation-failed': (operation: OfflineOperation, error: Error) => void;
  'queue-empty': () => void;
  'sync-started': () => void;
  'sync-completed': (stats: { synced: number; failed: number }) => void;
}

// ============================================================================
// Offline Operation Queue
// ============================================================================

export class OfflineOperationQueue extends EventEmitter<OfflineQueueEvents> {
  private queue: Map<string, OfflineOperation> = new Map();
  private syncingIds: Set<string> = new Set();
  private maxQueueSize = 1000;
  private defaultMaxRetries = 3;

  constructor(maxQueueSize = 1000, defaultMaxRetries = 3) {
    super();
    this.maxQueueSize = maxQueueSize;
    this.defaultMaxRetries = defaultMaxRetries;
    logger.debug('[OfflineOperationQueue] Initialized', {
      maxQueueSize,
      defaultMaxRetries,
    });
  }

  /**
   * Add operation to the queue
   */
  enqueue(
    type: Operation['type'],
    data: Record<string, unknown>,
    sessionId: string,
    priority: OperationPriority = 'normal',
    maxRetries?: number,
  ): OfflineOperation {
    if (this.queue.size >= this.maxQueueSize) {
      // Remove oldest low-priority operation
      const oldest = this.findOldestLowPriority();
      if (oldest) {
        this.queue.delete(oldest.id);
        logger.warn('[OfflineOperationQueue] Queue full, removed oldest', {
          removedId: oldest.id,
        });
      }
    }

    const operation: OfflineOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      sessionId,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: maxRetries ?? this.defaultMaxRetries,
      status: 'pending',
    };

    this.queue.set(operation.id, operation);
    this.emit('operation-added', operation);

    logger.debug('[OfflineOperationQueue] Operation enqueued', {
      id: operation.id,
      type,
      priority,
      queueSize: this.queue.size,
    });

    return operation;
  }

  /**
   * Get next operations to sync (by priority)
   */
  getNextBatch(batchSize = 10): OfflineOperation[] {
    const pending = Array.from(this.queue.values())
      .filter((op) => op.status === 'pending' && !this.syncingIds.has(op.id))
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

    return pending.slice(0, batchSize);
  }

  /**
   * Mark operations as syncing
   */
  markSyncing(operationIds: string[]): void {
    for (const id of operationIds) {
      const op = this.queue.get(id);
      if (op) {
        op.status = 'syncing';
        this.syncingIds.add(id);
      }
    }
  }

  /**
   * Mark operation as synced
   */
  markSynced(operationId: string): void {
    const op = this.queue.get(operationId);
    if (op) {
      op.status = 'synced';
      this.syncingIds.delete(operationId);
      this.emit('operation-synced', op);

      // Remove synced operations after short delay
      setTimeout(() => {
        this.queue.delete(operationId);
        if (this.getPendingCount() === 0) {
          this.emit('queue-empty');
        }
      }, 1000);
    }
  }

  /**
   * Mark operation as failed
   */
  markFailed(operationId: string, error: Error): void {
    const op = this.queue.get(operationId);
    if (op) {
      op.retryCount++;
      op.lastError = error.message;
      this.syncingIds.delete(operationId);

      if (op.retryCount >= op.maxRetries) {
        op.status = 'failed';
        this.emit('operation-failed', op, error);
        logger.error('[OfflineOperationQueue] Operation permanently failed', {
          id: operationId,
          retries: op.retryCount,
          error: error.message,
        });
      } else {
        op.status = 'pending';
        logger.warn('[OfflineOperationQueue] Operation failed, will retry', {
          id: operationId,
          retryCount: op.retryCount,
          maxRetries: op.maxRetries,
        });
      }
    }
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): OfflineOperation | undefined {
    return this.queue.get(operationId);
  }

  /**
   * Get all pending operations
   */
  getPendingOperations(): OfflineOperation[] {
    return Array.from(this.queue.values()).filter(
      (op) => op.status === 'pending',
    );
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return Array.from(this.queue.values()).filter(
      (op) => op.status === 'pending',
    ).length;
  }

  /**
   * Get queue statistics
   */
  getStats(): OfflineQueueStats {
    const operations = Array.from(this.queue.values());

    const pending = operations.filter((op) => op.status === 'pending').length;
    const syncing = operations.filter((op) => op.status === 'syncing').length;
    const failed = operations.filter((op) => op.status === 'failed').length;
    const synced = operations.filter((op) => op.status === 'synced').length;

    const pendingOps = operations.filter((op) => op.status === 'pending');
    const oldestPendingMs =
      pendingOps.length > 0
        ? Date.now() - Math.min(...pendingOps.map((op) => op.createdAt))
        : 0;

    const averageRetries =
      operations.length > 0
        ? operations.reduce((sum, op) => sum + op.retryCount, 0) /
          operations.length
        : 0;

    return {
      pending,
      syncing,
      failed,
      synced,
      totalOperations: operations.length,
      oldestPendingMs,
      averageRetries,
    };
  }

  /**
   * Clear all operations
   */
  clear(): void {
    this.queue.clear();
    this.syncingIds.clear();
    logger.debug('[OfflineOperationQueue] Queue cleared');
  }

  /**
   * Clear failed operations
   */
  clearFailed(): void {
    for (const [id, op] of this.queue.entries()) {
      if (op.status === 'failed') {
        this.queue.delete(id);
      }
    }
  }

  /**
   * Retry failed operations
   */
  retryFailed(): void {
    for (const op of this.queue.values()) {
      if (op.status === 'failed') {
        op.status = 'pending';
        op.retryCount = 0;
      }
    }
  }

  /**
   * Find oldest low-priority operation
   */
  private findOldestLowPriority(): OfflineOperation | null {
    const lowPriority = Array.from(this.queue.values())
      .filter((op) => op.priority === 'low' && op.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);

    return lowPriority[0] ?? null;
  }

  /**
   * Export queue for persistence
   */
  export(): OfflineOperation[] {
    return Array.from(this.queue.values());
  }

  /**
   * Import queue from persistence
   */
  import(operations: OfflineOperation[]): void {
    for (const op of operations) {
      this.queue.set(op.id, op);
    }
    logger.debug('[OfflineOperationQueue] Imported operations', {
      count: operations.length,
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let offlineQueueInstance: OfflineOperationQueue | null = null;

export function getOfflineOperationQueue(): OfflineOperationQueue {
  if (!offlineQueueInstance) {
    offlineQueueInstance = new OfflineOperationQueue();
  }
  return offlineQueueInstance;
}

export function resetOfflineOperationQueue(): void {
  offlineQueueInstance = null;
}
