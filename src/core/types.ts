/**
 * Aeon Core Types
 *
 * Shared type definitions for the Aeon synchronization and versioning system.
 */

/**
 * Operation type - what action is being performed
 */
export type OperationType = 'create' | 'update' | 'delete' | 'sync' | 'batch';

/**
 * Operation priority for sync ordering
 */
export type OperationPriority = 'high' | 'normal' | 'low';

/**
 * Operation sync status
 */
export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed';

/**
 * Queued operation for offline-first synchronization
 */
export interface Operation {
  id: string;
  type: OperationType;
  sessionId: string;
  status: OperationStatus;
  data: Record<string, unknown>;
  priority?: OperationPriority;
  createdAt?: number;
  syncedAt?: number;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  type?: 'update_update' | 'delete_update' | 'update_delete' | 'concurrent';
  severity?: 'low' | 'medium' | 'high';
  similarity?: number;
}

/**
 * Conflict resolution strategy
 */
export type ResolutionStrategy =
  | 'local_wins'
  | 'remote_wins'
  | 'last_modified'
  | 'merge'
  | 'manual';

/**
 * Sync batch for uploading multiple operations
 */
export interface SyncBatch {
  batchId: string;
  operations: Operation[];
  totalSize: number;
  createdAt: number;
  priority: OperationPriority;
}

/**
 * Sync result from server
 */
export interface SyncResult {
  success: boolean;
  synced: string[]; // operation IDs
  failed: Array<{
    operationId: string;
    error: string;
  }>;
  conflicts: Array<{
    operationId: string;
    remoteVersion: Record<string, unknown>;
    strategy: ResolutionStrategy;
  }>;
}

/**
 * Network state for adaptive sync
 */
export type NetworkState = 'online' | 'offline' | 'poor' | 'unknown';

/**
 * Bandwidth profile for sync adaptation
 */
export interface BandwidthProfile {
  bandwidth: number; // bps
  latency: number; // ms
  timestamp: number;
  reliability: number; // 0-1
}

/**
 * Sync coordinator configuration
 */
export interface SyncCoordinatorConfig {
  maxBatchSize: number; // operations
  maxBatchBytes: number; // bytes
  maxRetries: number;
  retryDelayMs: number;
  enableCompression: boolean;
  enableDeltaSync: boolean;
  adaptateBatchSize: boolean;
}

/**
 * Vector clock for causality tracking
 */
export interface VectorClock {
  [nodeId: string]: number;
}

/**
 * CRDT operation for conflict-free updates
 */
export interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete' | 'update';
  path: string[];
  value?: unknown;
  timestamp: number;
  nodeId: string;
  vectorClock: VectorClock;
}

/**
 * Presence selection range
 */
export interface PresenceSelection {
  start: number;
  end: number;
  direction?: 'forward' | 'backward' | 'none';
  path?: string;
}

/**
 * Presence typing signal
 */
export interface PresenceTyping {
  isTyping: boolean;
  field?: string;
  isComposing?: boolean;
  startedAt?: number;
  stoppedAt?: number;
}

/**
 * Presence scroll signal
 */
export interface PresenceScroll {
  depth: number;
  y?: number;
  viewportHeight?: number;
  documentHeight?: number;
  path?: string;
}

/**
 * Presence viewport signal
 */
export interface PresenceViewport {
  width: number;
  height: number;
}

/**
 * Presence input signal
 */
export interface PresenceInputState {
  field: string;
  hasFocus: boolean;
  valueLength?: number;
  selectionStart?: number;
  selectionEnd?: number;
  isComposing?: boolean;
  inputMode?: string;
}

/**
 * Presence emotional state signal
 */
export interface PresenceEmotion {
  primary?: string;
  secondary?: string;
  confidence?: number;
  intensity?: number;
  valence?: number;
  arousal?: number;
  dominance?: number;
  source?: 'self-report' | 'inferred' | 'sensor' | 'hybrid';
  updatedAt?: number;
}

/**
 * Presence information for real-time collaboration
 */
export interface PresenceInfo {
  userId: string;
  nodeId: string;
  cursor?: { x: number; y: number };
  focusNode?: string;
  selection?: PresenceSelection;
  typing?: PresenceTyping;
  scroll?: PresenceScroll;
  viewport?: PresenceViewport;
  inputState?: PresenceInputState;
  emotion?: PresenceEmotion;
  metadata?: Record<string, unknown>;
  lastActivity: number;
}

/**
 * Event emitter types
 */
export type EventCallback<T = unknown> = (data: T) => void;
export type EventUnsubscribe = () => void;

/**
 * Generic event emitter interface
 */
export interface IEventEmitter {
  on<T = unknown>(event: string, callback: EventCallback<T>): EventUnsubscribe;
  off(event: string, callback: EventCallback): void;
  emit<T = unknown>(event: string, data?: T): void;
}
