import type { StorageAdapter } from './types';
export interface DashStorageBackend {
    get(key: string): Promise<string | null> | string | null;
    set(key: string, value: string): Promise<void> | void;
    delete(key: string): Promise<void> | void;
}
export interface DashStorageChange {
    key: string;
    operation: 'set' | 'delete';
    value?: string;
    timestamp: number;
}
export interface DashSyncClient {
    syncChanges(changes: DashStorageChange[]): Promise<void>;
}
export interface DashStorageAdapterOptions {
    syncClient?: DashSyncClient;
    syncDebounceMs?: number;
    maxPendingChanges?: number;
    onSyncError?: (error: Error, changes: DashStorageChange[]) => void;
}
/**
 * Storage adapter boundary for dash-backed persistence.
 *
 * Writes are local-first through the provided backend and optionally synced
 * to D1/R2 via a sync client using debounced change batches.
 */
export declare class DashStorageAdapter implements StorageAdapter {
    private readonly backend;
    private readonly syncClient;
    private readonly syncDebounceMs;
    private readonly maxPendingChanges;
    private readonly onSyncError;
    private readonly pendingChanges;
    private syncTimer;
    private syncInFlight;
    private syncPending;
    constructor(backend: DashStorageBackend, options?: DashStorageAdapterOptions);
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    getPendingSyncCount(): number;
    flushSync(): Promise<void>;
    private trackChange;
    private enforcePendingLimit;
    private scheduleSync;
    private performSync;
}
