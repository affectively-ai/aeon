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
export class DashStorageAdapter implements StorageAdapter {
  private readonly backend: DashStorageBackend;
  private readonly syncClient: DashSyncClient | null;
  private readonly syncDebounceMs: number;
  private readonly maxPendingChanges: number;
  private readonly onSyncError:
    | ((error: Error, changes: DashStorageChange[]) => void)
    | null;
  private readonly pendingChanges = new Map<string, DashStorageChange>();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight = false;
  private syncPending = false;

  constructor(
    backend: DashStorageBackend,
    options: DashStorageAdapterOptions = {}
  ) {
    this.backend = backend;
    this.syncClient = options.syncClient ?? null;
    this.syncDebounceMs = options.syncDebounceMs ?? 50;
    this.maxPendingChanges = options.maxPendingChanges ?? 5000;
    this.onSyncError = options.onSyncError ?? null;
  }

  async getItem(key: string): Promise<string | null> {
    return await this.backend.get(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.backend.set(key, value);
    this.trackChange({
      key,
      operation: 'set',
      value,
      timestamp: Date.now(),
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.backend.delete(key);
    this.trackChange({
      key,
      operation: 'delete',
      timestamp: Date.now(),
    });
  }

  getPendingSyncCount(): number {
    return this.pendingChanges.size;
  }

  async flushSync(): Promise<void> {
    if (!this.syncClient || this.pendingChanges.size === 0) {
      return;
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    await this.performSync();
  }

  private trackChange(change: DashStorageChange): void {
    this.pendingChanges.set(change.key, change);
    this.enforcePendingLimit();
    this.scheduleSync();
  }

  private enforcePendingLimit(): void {
    if (this.pendingChanges.size <= this.maxPendingChanges) {
      return;
    }

    const sorted = Array.from(this.pendingChanges.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const overflow = this.pendingChanges.size - this.maxPendingChanges;
    for (let i = 0; i < overflow; i++) {
      const toDrop = sorted[i];
      if (toDrop) {
        this.pendingChanges.delete(toDrop.key);
      }
    }
  }

  private scheduleSync(): void {
    if (!this.syncClient) {
      return;
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      void this.performSync();
    }, this.syncDebounceMs);
  }

  private async performSync(): Promise<void> {
    if (!this.syncClient) {
      return;
    }

    if (this.syncInFlight) {
      this.syncPending = true;
      return;
    }

    const changes = Array.from(this.pendingChanges.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
    if (changes.length === 0) {
      return;
    }

    this.pendingChanges.clear();
    this.syncInFlight = true;
    try {
      await this.syncClient.syncChanges(changes);
    } catch (error) {
      for (const change of changes) {
        const current = this.pendingChanges.get(change.key);
        if (!current || change.timestamp > current.timestamp) {
          this.pendingChanges.set(change.key, change);
        }
      }

      if (this.onSyncError) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        this.onSyncError(normalizedError, changes);
      }
    } finally {
      this.syncInFlight = false;
      const rerun = this.syncPending || this.pendingChanges.size > 0;
      this.syncPending = false;
      if (rerun) {
        this.scheduleSync();
      }
    }
  }
}
