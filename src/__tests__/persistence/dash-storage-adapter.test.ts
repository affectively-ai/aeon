import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DashStorageAdapter,
  type DashStorageBackend,
  type DashStorageChange,
  type DashSyncClient,
} from '../../persistence';

class MapBackend implements DashStorageBackend {
  private readonly store = new Map<string, string>();

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

describe('DashStorageAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve values from backend', async () => {
    const adapter = new DashStorageAdapter(new MapBackend());

    await adapter.setItem('k1', 'v1');
    expect(await adapter.getItem('k1')).toBe('v1');

    await adapter.removeItem('k1');
    expect(await adapter.getItem('k1')).toBeNull();
  });

  it('should batch and sync latest key changes', async () => {
    const changes: DashStorageChange[][] = [];
    const syncClient: DashSyncClient = {
      syncChanges: vi.fn(async (batch: DashStorageChange[]) => {
        changes.push(batch);
      }),
    };

    const adapter = new DashStorageAdapter(new MapBackend(), {
      syncClient,
      syncDebounceMs: 20,
    });

    await adapter.setItem('k1', 'v1');
    await adapter.setItem('k1', 'v2');
    await adapter.setItem('k2', 'v3');

    await vi.advanceTimersByTimeAsync(25);

    expect(syncClient.syncChanges).toHaveBeenCalledTimes(1);
    expect(changes[0].length).toBe(2);

    const k1Change = changes[0].find((change) => change.key === 'k1');
    expect(k1Change?.value).toBe('v2');
  });

  it('should requeue changes when sync fails', async () => {
    let attempts = 0;
    const syncClient: DashSyncClient = {
      syncChanges: vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('sync failed');
        }
      }),
    };

    const adapter = new DashStorageAdapter(new MapBackend(), {
      syncClient,
      syncDebounceMs: 20,
    });

    await adapter.setItem('k1', 'v1');
    await vi.advanceTimersByTimeAsync(25);
    expect(adapter.getPendingSyncCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(25);
    expect(syncClient.syncChanges).toHaveBeenCalledTimes(2);
    expect(adapter.getPendingSyncCount()).toBe(0);
  });
});
