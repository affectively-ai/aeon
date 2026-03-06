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
export type DashSyncUrgency = 'realtime' | 'deferred' | 'lazy';
export interface DashSyncRule {
  /** How quickly to sync changes for keys matching this rule/prefix */
  urgency: DashSyncUrgency;
  /** Debounce/Interval for deferred/lazy sync (e.g. '1s', '1m', '1h') */
  debounce?: string | number;
  /** Maximum number of pending changes before forcing a sync */
  maxBufferSize?: number;
  /** Whether to return pending values from memory (default: true) */
  readThrough?: boolean;
}
export interface DashSyncRules {
  default?: DashSyncRule;
  /** Key prefix mapping to sync rules */
  prefixes?: Record<string, DashSyncRule>;
}
export interface DashStorageAdapterHooks {
  onSync?: (changes: DashStorageChange[]) => void;
  onSyncError?: (error: Error, changes: DashStorageChange[]) => void;
  onBufferOverflow?: (prefix: string, size: number, max: number) => void;
  onFlush?: (count: number) => void;
}
export interface DashStorageAdapterOptions {
  syncClient?: DashSyncClient;
  rules?: DashSyncRules;
  hooks?: DashStorageAdapterHooks;
  /** @deprecated Use rules.default.debounce */
  syncDebounceMs?: number;
  /** @deprecated Use rules.default.maxBufferSize */
  maxPendingChanges?: number;
  /** @deprecated Use hooks.onSyncError */
  onSyncError?: (error: Error, changes: DashStorageChange[]) => void;
}
/**
 * Storage adapter boundary for dash-backed persistence.
 *
 * Provides a "Write Pool" layer that buffers local-first writes and flushes
 * them to D1/R2 via a sync client based on declarative rules.
 */
export declare class DashStorageAdapter implements StorageAdapter {
  private readonly backend;
  private readonly syncClient;
  private readonly rules;
  private readonly hooks;
  private readonly pendingChanges;
  private syncTimer;
  private syncInFlight;
  private syncPending;
  constructor(backend: DashStorageBackend, options?: DashStorageAdapterOptions);
  /**
   * Get an item, checking the write pool (pending changes) first for consistency.
   */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getPendingSyncCount(): number;
  flushSync(): Promise<void>;
  private trackChange;
  private getRuleForKey;
  private getPrefixMatch;
  private scheduleSync;
  private performSync;
  private parseInterval;
}
//# sourceMappingURL=DashStorageAdapter.d.ts.map
