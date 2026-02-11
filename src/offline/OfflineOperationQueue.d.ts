/**
 * Offline Operation Queue (Phase 11)
 *
 * Manages pending operations for offline-first clients.
 * Provides priority-based queuing, persistence, and retry logic.
 */
import { EventEmitter } from 'eventemitter3';
import type { Operation, OperationPriority } from '../core/types';
import type { PersistenceDeserializer, PersistenceSerializer, StorageAdapter } from '../persistence';
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
    'sync-completed': (stats: {
        synced: number;
        failed: number;
    }) => void;
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
export declare class OfflineOperationQueue extends EventEmitter<OfflineQueueEvents> {
    private static readonly DEFAULT_PERSIST_KEY;
    private queue;
    private syncingIds;
    private maxQueueSize;
    private defaultMaxRetries;
    private persistence;
    private persistTimer;
    private persistInFlight;
    private persistPending;
    constructor(maxQueueSizeOrOptions?: number | OfflineOperationQueueOptions, defaultMaxRetries?: number);
    /**
     * Add operation to the queue
     */
    enqueue(type: Operation['type'], data: Record<string, unknown>, sessionId: string, priority?: OperationPriority, maxRetries?: number): OfflineOperation;
    /**
     * Get next operations to sync (by priority)
     */
    getNextBatch(batchSize?: number): OfflineOperation[];
    /**
     * Mark operations as syncing
     */
    markSyncing(operationIds: string[]): void;
    /**
     * Mark operation as synced
     */
    markSynced(operationId: string): void;
    /**
     * Mark operation as failed
     */
    markFailed(operationId: string, error: Error): void;
    /**
     * Get operation by ID
     */
    getOperation(operationId: string): OfflineOperation | undefined;
    /**
     * Get all pending operations
     */
    getPendingOperations(): OfflineOperation[];
    /**
     * Get pending count
     */
    getPendingCount(): number;
    /**
     * Get queue statistics
     */
    getStats(): OfflineQueueStats;
    /**
     * Clear all operations
     */
    clear(): void;
    /**
     * Clear failed operations
     */
    clearFailed(): void;
    /**
     * Retry failed operations
     */
    retryFailed(): void;
    /**
     * Find oldest low-priority operation
     */
    private findOldestLowPriority;
    /**
     * Export queue for persistence
     */
    export(): OfflineOperation[];
    /**
     * Import queue from persistence
     */
    import(operations: OfflineOperation[]): void;
    /**
     * Persist current queue snapshot.
     */
    saveToPersistence(): Promise<void>;
    /**
     * Load queue snapshot from persistence.
     */
    loadFromPersistence(): Promise<number>;
    /**
     * Remove persisted queue snapshot.
     */
    clearPersistence(): Promise<void>;
    private schedulePersist;
    private persistSafely;
    private isValidOfflineOperation;
}
export declare function getOfflineOperationQueue(): OfflineOperationQueue;
export declare function resetOfflineOperationQueue(): void;
