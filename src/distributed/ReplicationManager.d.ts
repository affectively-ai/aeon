/**
 * Replication Manager
 *
 * Manages data replication across multiple nodes.
 * Handles replication policies, consistency levels, and replica coordination.
 *
 * Features:
 * - Replica set management
 * - Replication policy enforcement
 * - Consistency level tracking
 * - Replication health monitoring
 * - Replica synchronization coordination
 * - End-to-end encryption for replicated data
 * - DID-based replica authentication
 */
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type { AeonEncryptionMode } from '../crypto/types';
import type {
  PersistenceDeserializer,
  PersistenceSerializer,
  StorageAdapter,
} from '../persistence';
export interface Replica {
  id: string;
  nodeId: string;
  status: 'primary' | 'secondary' | 'syncing' | 'failed';
  lastSyncTime: string;
  lagBytes: number;
  lagMillis: number;
  did?: string;
  encrypted?: boolean;
}
export interface ReplicationPolicy {
  id: string;
  name: string;
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'read-after-write' | 'strong';
  syncInterval: number;
  maxReplicationLag: number;
  encryptionMode?: AeonEncryptionMode;
  requiredCapabilities?: string[];
}
export interface ReplicationEvent {
  type: 'replica-added' | 'replica-removed' | 'replica-synced' | 'sync-failed';
  replicaId: string;
  nodeId: string;
  timestamp: string;
  details?: unknown;
}
/**
 * Encrypted replication data envelope
 */
export interface EncryptedReplicationData {
  /** Encrypted ciphertext (base64) */
  ct: string;
  /** Initialization vector (base64) */
  iv: string;
  /** Authentication tag (base64) */
  tag: string;
  /** Ephemeral public key for ECIES */
  epk?: JsonWebKey;
  /** Sender DID */
  senderDID?: string;
  /** Target replica DID */
  targetDID?: string;
  /** Encryption timestamp */
  encryptedAt: number;
}
export interface ReplicationPersistenceData {
  replicas: Replica[];
  policies: ReplicationPolicy[];
  syncStatus: Array<{
    nodeId: string;
    synced: number;
    failed: number;
  }>;
}
export interface ReplicationPersistenceConfig {
  adapter: StorageAdapter;
  key?: string;
  autoPersist?: boolean;
  autoLoad?: boolean;
  persistDebounceMs?: number;
  serializer?: PersistenceSerializer<ReplicationPersistenceData>;
  deserializer?: PersistenceDeserializer<ReplicationPersistenceData>;
}
export interface ReplicationManagerOptions {
  persistence?: ReplicationPersistenceConfig;
}
/**
 * Replication Manager
 * Manages data replication across distributed nodes
 */
export declare class ReplicationManager {
  private static readonly DEFAULT_PERSIST_KEY;
  private replicas;
  private policies;
  private replicationEvents;
  private syncStatus;
  private cryptoProvider;
  private replicasByDID;
  private persistence;
  private persistTimer;
  private persistInFlight;
  private persistPending;
  constructor(options?: ReplicationManagerOptions);
  /**
   * Configure cryptographic provider for encrypted replication
   */
  configureCrypto(provider: ICryptoProvider): void;
  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean;
  /**
   * Register an authenticated replica with DID
   */
  registerAuthenticatedReplica(
    replica: Omit<Replica, 'did' | 'encrypted'> & {
      did: string;
      publicSigningKey?: JsonWebKey;
      publicEncryptionKey?: JsonWebKey;
    },
    encrypted?: boolean
  ): Promise<Replica>;
  /**
   * Get replica by DID
   */
  getReplicaByDID(did: string): Replica | undefined;
  /**
   * Get all encrypted replicas
   */
  getEncryptedReplicas(): Replica[];
  /**
   * Encrypt data for replication to a specific replica
   */
  encryptForReplica(
    data: unknown,
    targetReplicaDID: string
  ): Promise<EncryptedReplicationData>;
  /**
   * Decrypt data received from replication
   */
  decryptReplicationData<T>(encrypted: EncryptedReplicationData): Promise<T>;
  /**
   * Create an encrypted replication policy
   */
  createEncryptedPolicy(
    name: string,
    replicationFactor: number,
    consistencyLevel: 'eventual' | 'read-after-write' | 'strong',
    encryptionMode: AeonEncryptionMode,
    options?: {
      syncInterval?: number;
      maxReplicationLag?: number;
      requiredCapabilities?: string[];
    }
  ): ReplicationPolicy;
  /**
   * Verify a replica's capabilities via UCAN
   */
  verifyReplicaCapabilities(
    replicaDID: string,
    token: string,
    policyId?: string
  ): Promise<{
    authorized: boolean;
    error?: string;
  }>;
  /**
   * Register a replica
   */
  registerReplica(replica: Replica): void;
  /**
   * Remove a replica
   */
  removeReplica(replicaId: string): void;
  /**
   * Create a replication policy
   */
  createPolicy(
    name: string,
    replicationFactor: number,
    consistencyLevel: 'eventual' | 'read-after-write' | 'strong',
    syncInterval?: number,
    maxReplicationLag?: number
  ): ReplicationPolicy;
  /**
   * Update replica status
   */
  updateReplicaStatus(
    replicaId: string,
    status: Replica['status'],
    lagBytes?: number,
    lagMillis?: number
  ): void;
  /**
   * Get replicas for node
   */
  getReplicasForNode(nodeId: string): Replica[];
  /**
   * Get healthy replicas
   */
  getHealthyReplicas(): Replica[];
  /**
   * Get syncing replicas
   */
  getSyncingReplicas(): Replica[];
  /**
   * Get failed replicas
   */
  getFailedReplicas(): Replica[];
  /**
   * Check replication health for policy
   */
  checkReplicationHealth(policyId: string): {
    healthy: boolean;
    replicasInPolicy: number;
    healthyReplicas: number;
    replicationLag: number;
  };
  /**
   * Get consistency level
   */
  getConsistencyLevel(
    policyId: string
  ): 'eventual' | 'read-after-write' | 'strong';
  /**
   * Get replica
   */
  getReplica(replicaId: string): Replica | undefined;
  /**
   * Get all replicas
   */
  getAllReplicas(): Replica[];
  /**
   * Get policy
   */
  getPolicy(policyId: string): ReplicationPolicy | undefined;
  /**
   * Get all policies
   */
  getAllPolicies(): ReplicationPolicy[];
  /**
   * Get replication statistics
   */
  getStatistics(): {
    totalReplicas: number;
    healthyReplicas: number;
    syncingReplicas: number;
    failedReplicas: number;
    healthiness: number;
    averageReplicationLagMs: number;
    maxReplicationLagMs: number;
    totalPolicies: number;
  };
  /**
   * Get replication events
   */
  getReplicationEvents(limit?: number): ReplicationEvent[];
  /**
   * Get sync status for node
   */
  getSyncStatus(nodeId: string): {
    synced: number;
    failed: number;
  };
  /**
   * Get replication lag distribution
   */
  getReplicationLagDistribution(): Record<string, number>;
  /**
   * Check if can satisfy consistency level
   */
  canSatisfyConsistency(policyId: string, _requiredAcks: number): boolean;
  /**
   * Persist current replication state snapshot.
   */
  saveToPersistence(): Promise<void>;
  /**
   * Load replication snapshot from persistence.
   */
  loadFromPersistence(): Promise<{
    replicas: number;
    policies: number;
    syncStatus: number;
  }>;
  /**
   * Remove persisted replication snapshot.
   */
  clearPersistence(): Promise<void>;
  private schedulePersist;
  private persistSafely;
  private isValidReplica;
  private isValidPolicy;
  /**
   * Clear all state (for testing)
   */
  clear(): void;
  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null;
}
