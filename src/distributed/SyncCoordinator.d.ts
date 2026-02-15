/**
 * Sync Coordinator
 *
 * Coordinates synchronization between multiple nodes in a distributed system.
 * Manages sync sessions, node registration, and synchronization workflows.
 *
 * Features:
 * - Node registration and discovery
 * - Sync session management
 * - Synchronization workflow orchestration
 * - Node health monitoring
 * - Conflict detection and resolution coordination
 * - DID-based node identification
 * - Authenticated sync sessions
 */
import { EventEmitter } from 'eventemitter3';
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type { AeonEncryptionMode } from '../crypto/types';
export interface SyncNode {
  id: string;
  address: string;
  port: number;
  status: 'online' | 'offline' | 'syncing';
  lastHeartbeat: string;
  version: string;
  capabilities: string[];
  did?: string;
  publicSigningKey?: JsonWebKey;
  publicEncryptionKey?: JsonWebKey;
  grantedCapabilities?: string[];
}
export interface SyncSession {
  id: string;
  initiatorId: string;
  participantIds: string[];
  status: 'pending' | 'active' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  itemsSynced: number;
  itemsFailed: number;
  conflictsDetected: number;
  initiatorDID?: string;
  participantDIDs?: string[];
  encryptionMode?: AeonEncryptionMode;
  requiredCapabilities?: string[];
  sessionToken?: string;
}
export interface SyncEvent {
  type:
    | 'node-joined'
    | 'node-left'
    | 'sync-started'
    | 'sync-completed'
    | 'conflict-detected';
  sessionId?: string;
  nodeId: string;
  timestamp: string;
  data?: unknown;
}
/**
 * Sync Coordinator
 * Coordinates synchronization across distributed nodes
 */
export declare class SyncCoordinator extends EventEmitter {
  private nodes;
  private sessions;
  private syncEvents;
  private nodeHeartbeats;
  private heartbeatInterval;
  private cryptoProvider;
  private nodesByDID;
  constructor();
  /**
   * Configure cryptographic provider for authenticated sync
   */
  configureCrypto(provider: ICryptoProvider): void;
  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean;
  /**
   * Register a node with DID-based identity
   */
  registerAuthenticatedNode(
    nodeInfo: Omit<
      SyncNode,
      'did' | 'publicSigningKey' | 'publicEncryptionKey'
    > & {
      did: string;
      publicSigningKey: JsonWebKey;
      publicEncryptionKey?: JsonWebKey;
    }
  ): Promise<SyncNode>;
  /**
   * Get node by DID
   */
  getNodeByDID(did: string): SyncNode | undefined;
  /**
   * Get all authenticated nodes (nodes with DIDs)
   */
  getAuthenticatedNodes(): SyncNode[];
  /**
   * Create an authenticated sync session with UCAN-based authorization
   */
  createAuthenticatedSyncSession(
    initiatorDID: string,
    participantDIDs: string[],
    options?: {
      encryptionMode?: AeonEncryptionMode;
      requiredCapabilities?: string[];
    }
  ): Promise<SyncSession>;
  /**
   * Verify a node's UCAN capabilities for a session
   */
  verifyNodeCapabilities(
    sessionId: string,
    nodeDID: string,
    token: string
  ): Promise<{
    authorized: boolean;
    error?: string;
  }>;
  /**
   * Register a node in the cluster
   */
  registerNode(node: SyncNode): void;
  /**
   * Deregister a node from the cluster
   */
  deregisterNode(nodeId: string): void;
  /**
   * Create a new sync session
   */
  createSyncSession(initiatorId: string, participantIds: string[]): SyncSession;
  /**
   * Update sync session
   */
  updateSyncSession(sessionId: string, updates: Partial<SyncSession>): void;
  /**
   * Record a conflict during sync
   */
  recordConflict(
    sessionId: string,
    nodeId: string,
    conflictData?: unknown
  ): void;
  /**
   * Update node status
   */
  updateNodeStatus(nodeId: string, status: SyncNode['status']): void;
  /**
   * Record heartbeat from node
   */
  recordHeartbeat(nodeId: string): void;
  /**
   * Get all nodes
   */
  getNodes(): SyncNode[];
  /**
   * Get node by ID
   */
  getNode(nodeId: string): SyncNode | undefined;
  /**
   * Get online nodes
   */
  getOnlineNodes(): SyncNode[];
  /**
   * Get nodes by capability
   */
  getNodesByCapability(capability: string): SyncNode[];
  /**
   * Get sync session
   */
  getSyncSession(sessionId: string): SyncSession | undefined;
  /**
   * Get all sync sessions
   */
  getAllSyncSessions(): SyncSession[];
  /**
   * Get active sync sessions
   */
  getActiveSyncSessions(): SyncSession[];
  /**
   * Get sessions for a node
   */
  getSessionsForNode(nodeId: string): SyncSession[];
  /**
   * Get sync statistics
   */
  getStatistics(): {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    successRate: number;
    totalItemsSynced: number;
    totalConflicts: number;
    averageConflictsPerSession: number;
  };
  /**
   * Get sync events
   */
  getSyncEvents(limit?: number): SyncEvent[];
  /**
   * Get sync events for session
   */
  getSessionEvents(sessionId: string): SyncEvent[];
  /**
   * Check node health
   */
  getNodeHealth(): Record<
    string,
    {
      isHealthy: boolean;
      downtime: number;
    }
  >;
  /**
   * Start heartbeat monitoring
   */
  startHeartbeatMonitoring(interval?: number): void;
  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring(): void;
  /**
   * Clear all state (for testing)
   */
  clear(): void;
  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null;
}
