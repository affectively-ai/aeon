/**
 * Offline Operation Queue (Phase 11)
 *
 * Manages pending operations for offline-first clients.
 * Provides priority-based queuing, persistence, and retry logic.
 */

import { EventEmitter } from 'eventemitter3';
import { getLogger } from '../utils/logger';
import type { Operation, OperationPriority } from '../core/types';
import type {
  PersistedEnvelope,
  PersistenceDeserializer,
  PersistenceSerializer,
  StorageAdapter,
} from '../persistence';

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

export interface OfflineQueuePersistenceConfig {
  adapter: StorageAdapter;
  key?: string;
  autoPersist?: boolean;
  autoLoad?: boolean;
  persistDebounceMs?: number;
  serializer?: PersistenceSerializer<OfflineOperation[]>;
  deserializer?: PersistenceDeserializer<OfflineOperation[]>;
}

export interface OfflineOperationQueueOptions {
  maxQueueSize?: number;
  defaultMaxRetries?: number;
  persistence?: OfflineQueuePersistenceConfig;
}

// ============================================================================
// Offline Operation Queue
// ============================================================================

export class OfflineOperationQueue extends EventEmitter<OfflineQueueEvents> {
  private static readonly DEFAULT_PERSIST_KEY = 'aeon:offline-queue:v1';
  private queue: Map<string, OfflineOperation> = new Map();
  private syncingIds: Set<string> = new Set();
  private maxQueueSize = 1000;
  private defaultMaxRetries = 3;
  private persistence: (OfflineQueuePersistenceConfig & { key: string }) | null =
    null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private persistPending = false;

  constructor(
    maxQueueSizeOrOptions: number | OfflineOperationQueueOptions = 1000,
    defaultMaxRetries = 3,
  ) {
    super();

    if (typeof maxQueueSizeOrOptions === 'number') {
      this.maxQueueSize = maxQueueSizeOrOptions;
      this.defaultMaxRetries = defaultMaxRetries;
    } else {
      this.maxQueueSize = maxQueueSizeOrOptions.maxQueueSize ?? 1000;
      this.defaultMaxRetries = maxQueueSizeOrOptions.defaultMaxRetries ?? 3;

      if (maxQueueSizeOrOptions.persistence) {
        this.persistence = {
          ...maxQueueSizeOrOptions.persistence,
          key:
            maxQueueSizeOrOptions.persistence.key ??
            OfflineOperationQueue.DEFAULT_PERSIST_KEY,
          autoPersist: maxQueueSizeOrOptions.persistence.autoPersist ?? true,
          autoLoad: maxQueueSizeOrOptions.persistence.autoLoad ?? false,
          persistDebounceMs:
            maxQueueSizeOrOptions.persistence.persistDebounceMs ?? 25,
        };

        if (this.persistence.autoLoad) {
          void this.loadFromPersistence().catch((error) => {
            logger.error('[OfflineOperationQueue] Failed to load persistence', {
              key: this.persistence?.key,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      }
    }

    logger.debug('[OfflineOperationQueue] Initialized', {
      maxQueueSize: this.maxQueueSize,
      defaultMaxRetries: this.defaultMaxRetries,
      persistenceEnabled: this.persistence !== null,
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
    this.schedulePersist();

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
    let changed = false;
    for (const id of operationIds) {
      const op = this.queue.get(id);
      if (op) {
        op.status = 'syncing';
        this.syncingIds.add(id);
        changed = true;
      }
    }

    if (changed) {
      this.schedulePersist();
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
      this.schedulePersist();

      // Remove synced operations after short delay
      setTimeout(() => {
        this.queue.delete(operationId);
        this.schedulePersist();
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

      this.schedulePersist();
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
    this.schedulePersist();
    logger.debug('[OfflineOperationQueue] Queue cleared');
  }

  /**
   * Clear failed operations
   */
  clearFailed(): void {
    let changed = false;
    for (const [id, op] of this.queue.entries()) {
      if (op.status === 'failed') {
        this.queue.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.schedulePersist();
    }
  }

  /**
   * Retry failed operations
   */
  retryFailed(): void {
    let changed = false;
    for (const op of this.queue.values()) {
      if (op.status === 'failed') {
        op.status = 'pending';
        op.retryCount = 0;
        changed = true;
      }
    }

    if (changed) {
      this.schedulePersist();
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
    this.queue.clear();
    this.syncingIds.clear();

    for (const op of operations) {
      if (this.isValidOfflineOperation(op)) {
        this.queue.set(op.id, {
          ...op,
          status: op.status === 'syncing' ? 'pending' : op.status,
        });
      }
    }

    this.schedulePersist();

    logger.debug('[OfflineOperationQueue] Imported operations', {
      count: this.queue.size,
    });
  }

  /**
   * Persist current queue snapshot.
   */
  async saveToPersistence(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    const envelope: PersistedEnvelope<OfflineOperation[]> = {
      version: 1,
      updatedAt: Date.now(),
      data: this.export(),
    };

    const serialize =
      this.persistence.serializer ??
      ((value: PersistedEnvelope<OfflineOperation[]>) => JSON.stringify(value));
    const raw = serialize(envelope);

    await this.persistence.adapter.setItem(this.persistence.key, raw);
  }

  /**
   * Load queue snapshot from persistence.
   */
  async loadFromPersistence(): Promise<number> {
    if (!this.persistence) {
      return 0;
    }

    const raw = await this.persistence.adapter.getItem(this.persistence.key);
    if (!raw) {
      return 0;
    }

    const deserialize =
      this.persistence.deserializer ??
      ((value: string) =>
        JSON.parse(value) as PersistedEnvelope<OfflineOperation[]>);

    const envelope = deserialize(raw);
    if (envelope.version !== 1 || !Array.isArray(envelope.data)) {
      throw new Error('Invalid offline queue persistence payload');
    }

    this.queue.clear();
    this.syncingIds.clear();

    let imported = 0;
    for (const operation of envelope.data) {
      if (this.isValidOfflineOperation(operation)) {
        this.queue.set(operation.id, {
          ...operation,
          status: operation.status === 'syncing' ? 'pending' : operation.status,
        });
        imported++;
      }
    }

    logger.debug('[OfflineOperationQueue] Loaded from persistence', {
      key: this.persistence.key,
      imported,
    });

    return imported;
  }

  /**
   * Remove persisted queue snapshot.
   */
  async clearPersistence(): Promise<void> {
    if (!this.persistence) {
      return;
    }
    await this.persistence.adapter.removeItem(this.persistence.key);
  }

  private schedulePersist(): void {
    if (!this.persistence || this.persistence.autoPersist === false) {
      return;
    }

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      void this.persistSafely();
    }, this.persistence.persistDebounceMs ?? 25);
  }

  private async persistSafely(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    if (this.persistInFlight) {
      this.persistPending = true;
      return;
    }

    this.persistInFlight = true;

    try {
      await this.saveToPersistence();
    } catch (error) {
      logger.error('[OfflineOperationQueue] Persistence write failed', {
        key: this.persistence.key,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.persistInFlight = false;
      const shouldRunAgain = this.persistPending;
      this.persistPending = false;
      if (shouldRunAgain) {
        void this.persistSafely();
      }
    }
  }

  private isValidOfflineOperation(value: unknown): value is OfflineOperation {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<OfflineOperation>;
    const validType =
      candidate.type === 'create' ||
      candidate.type === 'update' ||
      candidate.type === 'delete' ||
      candidate.type === 'sync' ||
      candidate.type === 'batch';
    const validPriority =
      candidate.priority === 'high' ||
      candidate.priority === 'normal' ||
      candidate.priority === 'low';
    const validStatus =
      candidate.status === 'pending' ||
      candidate.status === 'syncing' ||
      candidate.status === 'failed' ||
      candidate.status === 'synced';

    return (
      typeof candidate.id === 'string' &&
      validType &&
      typeof candidate.data === 'object' &&
      candidate.data !== null &&
      !Array.isArray(candidate.data) &&
      typeof candidate.sessionId === 'string' &&
      validPriority &&
      typeof candidate.createdAt === 'number' &&
      typeof candidate.retryCount === 'number' &&
      typeof candidate.maxRetries === 'number' &&
      validStatus
    );
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
