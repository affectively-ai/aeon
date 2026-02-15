/**
 * Aeon Distributed Module
 *
 * Distributed synchronization primitives and coordination.
 *
 * Features:
 * - Sync coordination across distributed nodes
 * - Data replication with configurable consistency levels
 * - Synchronization protocol handling
 * - State reconciliation and conflict resolution
 */
export { SyncCoordinator } from './SyncCoordinator';
export type { SyncNode, SyncSession, SyncEvent } from './SyncCoordinator';
export { ReplicationManager } from './ReplicationManager';
export type {
  Replica,
  ReplicationPolicy,
  ReplicationEvent,
  ReplicationPersistenceData,
  ReplicationPersistenceConfig,
  ReplicationManagerOptions,
} from './ReplicationManager';
export { SyncProtocol } from './SyncProtocol';
export type {
  SyncMessage,
  Handshake,
  SyncRequest,
  SyncResponse,
  ProtocolError,
  SyncProtocolPersistenceData,
  SyncProtocolPersistenceConfig,
  SyncProtocolOptions,
} from './SyncProtocol';
export { StateReconciler } from './StateReconciler';
export type {
  StateVersion,
  StateDiff,
  ReconciliationResult,
  MergeStrategy,
} from './StateReconciler';
