/**
 * Offline Operation Queue (Phase 11)
 *
 * Manages pending operations for offline-first clients.
 * Provides priority-based queuing, persistence, and retry logic.
 */
import { EventEmitter } from 'eventemitter3';
import { getLogger } from '../utils/logger';
const logger = getLogger();
// ============================================================================
// Offline Operation Queue
// ============================================================================
export class OfflineOperationQueue extends EventEmitter {
    static DEFAULT_PERSIST_KEY = 'aeon:offline-queue:v1';
    queue = new Map();
    syncingIds = new Set();
    maxQueueSize = 1000;
    defaultMaxRetries = 3;
    persistence = null;
    persistTimer = null;
    persistInFlight = false;
    persistPending = false;
    constructor(maxQueueSizeOrOptions = 1000, defaultMaxRetries = 3) {
        super();
        if (typeof maxQueueSizeOrOptions === 'number') {
            this.maxQueueSize = maxQueueSizeOrOptions;
            this.defaultMaxRetries = defaultMaxRetries;
        }
        else {
            this.maxQueueSize = maxQueueSizeOrOptions.maxQueueSize ?? 1000;
            this.defaultMaxRetries = maxQueueSizeOrOptions.defaultMaxRetries ?? 3;
            if (maxQueueSizeOrOptions.persistence) {
                this.persistence = {
                    ...maxQueueSizeOrOptions.persistence,
                    key: maxQueueSizeOrOptions.persistence.key ??
                        OfflineOperationQueue.DEFAULT_PERSIST_KEY,
                    autoPersist: maxQueueSizeOrOptions.persistence.autoPersist ?? true,
                    autoLoad: maxQueueSizeOrOptions.persistence.autoLoad ?? false,
                    persistDebounceMs: maxQueueSizeOrOptions.persistence.persistDebounceMs ?? 25,
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
    enqueue(type, data, sessionId, priority = 'normal', maxRetries) {
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
        const operation = {
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
    getNextBatch(batchSize = 10) {
        const pending = Array.from(this.queue.values())
            .filter((op) => op.status === 'pending' && !this.syncingIds.has(op.id))
            .sort((a, b) => {
            // Sort by priority first, then by creation time
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            return a.createdAt - b.createdAt;
        });
        return pending.slice(0, batchSize);
    }
    /**
     * Mark operations as syncing
     */
    markSyncing(operationIds) {
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
    markSynced(operationId) {
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
    markFailed(operationId, error) {
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
            }
            else {
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
    getOperation(operationId) {
        return this.queue.get(operationId);
    }
    /**
     * Get all pending operations
     */
    getPendingOperations() {
        return Array.from(this.queue.values()).filter((op) => op.status === 'pending');
    }
    /**
     * Get pending count
     */
    getPendingCount() {
        return Array.from(this.queue.values()).filter((op) => op.status === 'pending').length;
    }
    /**
     * Get queue statistics
     */
    getStats() {
        const operations = Array.from(this.queue.values());
        const pending = operations.filter((op) => op.status === 'pending').length;
        const syncing = operations.filter((op) => op.status === 'syncing').length;
        const failed = operations.filter((op) => op.status === 'failed').length;
        const synced = operations.filter((op) => op.status === 'synced').length;
        const pendingOps = operations.filter((op) => op.status === 'pending');
        const oldestPendingMs = pendingOps.length > 0
            ? Date.now() - Math.min(...pendingOps.map((op) => op.createdAt))
            : 0;
        const averageRetries = operations.length > 0
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
    clear() {
        this.queue.clear();
        this.syncingIds.clear();
        this.schedulePersist();
        logger.debug('[OfflineOperationQueue] Queue cleared');
    }
    /**
     * Clear failed operations
     */
    clearFailed() {
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
    retryFailed() {
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
    findOldestLowPriority() {
        const lowPriority = Array.from(this.queue.values())
            .filter((op) => op.priority === 'low' && op.status === 'pending')
            .sort((a, b) => a.createdAt - b.createdAt);
        return lowPriority[0] ?? null;
    }
    /**
     * Export queue for persistence
     */
    export() {
        return Array.from(this.queue.values());
    }
    /**
     * Import queue from persistence
     */
    import(operations) {
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
    async saveToPersistence() {
        if (!this.persistence) {
            return;
        }
        const envelope = {
            version: 1,
            updatedAt: Date.now(),
            data: this.export(),
        };
        const serialize = this.persistence.serializer ??
            ((value) => JSON.stringify(value));
        const raw = serialize(envelope);
        await this.persistence.adapter.setItem(this.persistence.key, raw);
    }
    /**
     * Load queue snapshot from persistence.
     */
    async loadFromPersistence() {
        if (!this.persistence) {
            return 0;
        }
        const raw = await this.persistence.adapter.getItem(this.persistence.key);
        if (!raw) {
            return 0;
        }
        const deserialize = this.persistence.deserializer ??
            ((value) => JSON.parse(value));
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
    async clearPersistence() {
        if (!this.persistence) {
            return;
        }
        await this.persistence.adapter.removeItem(this.persistence.key);
    }
    schedulePersist() {
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
    async persistSafely() {
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
        }
        catch (error) {
            logger.error('[OfflineOperationQueue] Persistence write failed', {
                key: this.persistence.key,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.persistInFlight = false;
            const shouldRunAgain = this.persistPending;
            this.persistPending = false;
            if (shouldRunAgain) {
                void this.persistSafely();
            }
        }
    }
    isValidOfflineOperation(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value;
        const validType = candidate.type === 'create' ||
            candidate.type === 'update' ||
            candidate.type === 'delete' ||
            candidate.type === 'sync' ||
            candidate.type === 'batch';
        const validPriority = candidate.priority === 'high' ||
            candidate.priority === 'normal' ||
            candidate.priority === 'low';
        const validStatus = candidate.status === 'pending' ||
            candidate.status === 'syncing' ||
            candidate.status === 'failed' ||
            candidate.status === 'synced';
        return (typeof candidate.id === 'string' &&
            validType &&
            typeof candidate.data === 'object' &&
            candidate.data !== null &&
            !Array.isArray(candidate.data) &&
            typeof candidate.sessionId === 'string' &&
            validPriority &&
            typeof candidate.createdAt === 'number' &&
            typeof candidate.retryCount === 'number' &&
            typeof candidate.maxRetries === 'number' &&
            validStatus);
    }
}
// ============================================================================
// Singleton Instance
// ============================================================================
let offlineQueueInstance = null;
export function getOfflineOperationQueue() {
    if (!offlineQueueInstance) {
        offlineQueueInstance = new OfflineOperationQueue();
    }
    return offlineQueueInstance;
}
export function resetOfflineOperationQueue() {
    offlineQueueInstance = null;
}
