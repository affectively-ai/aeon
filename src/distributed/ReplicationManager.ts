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

import { logger } from '../utils/logger';
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type { AeonEncryptionMode } from '../crypto/types';

export interface Replica {
  id: string;
  nodeId: string;
  status: 'primary' | 'secondary' | 'syncing' | 'failed';
  lastSyncTime: string;
  lagBytes: number;
  lagMillis: number;
  // DID-based identity for authenticated replicas
  did?: string;
  // Whether this replica uses encrypted data
  encrypted?: boolean;
}

export interface ReplicationPolicy {
  id: string;
  name: string;
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'read-after-write' | 'strong';
  syncInterval: number;
  maxReplicationLag: number;
  // Encryption settings for this policy
  encryptionMode?: AeonEncryptionMode;
  // Required capabilities for replicas
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

/**
 * Replication Manager
 * Manages data replication across distributed nodes
 */
export class ReplicationManager {
  private replicas: Map<string, Replica> = new Map();
  private policies: Map<string, ReplicationPolicy> = new Map();
  private replicationEvents: ReplicationEvent[] = [];
  private syncStatus: Map<string, { synced: number; failed: number }> = new Map();

  // Crypto support
  private cryptoProvider: ICryptoProvider | null = null;
  private replicasByDID: Map<string, string> = new Map(); // DID -> replicaId

  /**
   * Configure cryptographic provider for encrypted replication
   */
  configureCrypto(provider: ICryptoProvider): void {
    this.cryptoProvider = provider;

    logger.debug('[ReplicationManager] Crypto configured', {
      initialized: provider.isInitialized(),
    });
  }

  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean {
    return this.cryptoProvider !== null && this.cryptoProvider.isInitialized();
  }

  /**
   * Register an authenticated replica with DID
   */
  async registerAuthenticatedReplica(
    replica: Omit<Replica, 'did' | 'encrypted'> & {
      did: string;
      publicSigningKey?: JsonWebKey;
      publicEncryptionKey?: JsonWebKey;
    },
    encrypted: boolean = false,
  ): Promise<Replica> {
    const authenticatedReplica: Replica = {
      ...replica,
      encrypted,
    };

    this.replicas.set(replica.id, authenticatedReplica);
    this.replicasByDID.set(replica.did, replica.id);

    if (!this.syncStatus.has(replica.nodeId)) {
      this.syncStatus.set(replica.nodeId, { synced: 0, failed: 0 });
    }

    // Register with crypto provider if keys provided
    if (this.cryptoProvider && replica.publicSigningKey) {
      await this.cryptoProvider.registerRemoteNode({
        id: replica.nodeId,
        did: replica.did,
        publicSigningKey: replica.publicSigningKey,
        publicEncryptionKey: replica.publicEncryptionKey,
      });
    }

    const event: ReplicationEvent = {
      type: 'replica-added',
      replicaId: replica.id,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
      details: { did: replica.did, encrypted, authenticated: true },
    };

    this.replicationEvents.push(event);

    logger.debug('[ReplicationManager] Authenticated replica registered', {
      replicaId: replica.id,
      did: replica.did,
      encrypted,
    });

    return authenticatedReplica;
  }

  /**
   * Get replica by DID
   */
  getReplicaByDID(did: string): Replica | undefined {
    const replicaId = this.replicasByDID.get(did);
    if (!replicaId) return undefined;
    return this.replicas.get(replicaId);
  }

  /**
   * Get all encrypted replicas
   */
  getEncryptedReplicas(): Replica[] {
    return Array.from(this.replicas.values()).filter(r => r.encrypted);
  }

  /**
   * Encrypt data for replication to a specific replica
   */
  async encryptForReplica(
    data: unknown,
    targetReplicaDID: string,
  ): Promise<EncryptedReplicationData> {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }

    const dataBytes = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await this.cryptoProvider.encrypt(dataBytes, targetReplicaDID);

    const localDID = this.cryptoProvider.getLocalDID();

    return {
      ct: encrypted.ct,
      iv: encrypted.iv,
      tag: encrypted.tag,
      epk: encrypted.epk,
      senderDID: localDID || undefined,
      targetDID: targetReplicaDID,
      encryptedAt: encrypted.encryptedAt,
    };
  }

  /**
   * Decrypt data received from replication
   */
  async decryptReplicationData<T>(
    encrypted: EncryptedReplicationData,
  ): Promise<T> {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }

    const decrypted = await this.cryptoProvider.decrypt(
      {
        alg: 'ECIES-P256',
        ct: encrypted.ct,
        iv: encrypted.iv,
        tag: encrypted.tag,
        epk: encrypted.epk,
      },
      encrypted.senderDID,
    );

    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  }

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
    },
  ): ReplicationPolicy {
    const policy: ReplicationPolicy = {
      id: `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      replicationFactor,
      consistencyLevel,
      syncInterval: options?.syncInterval || 1000,
      maxReplicationLag: options?.maxReplicationLag || 10000,
      encryptionMode,
      requiredCapabilities: options?.requiredCapabilities,
    };

    this.policies.set(policy.id, policy);

    logger.debug('[ReplicationManager] Encrypted policy created', {
      policyId: policy.id,
      name,
      replicationFactor,
      encryptionMode,
    });

    return policy;
  }

  /**
   * Verify a replica's capabilities via UCAN
   */
  async verifyReplicaCapabilities(
    replicaDID: string,
    token: string,
    policyId?: string,
  ): Promise<{ authorized: boolean; error?: string }> {
    if (!this.cryptoProvider) {
      return { authorized: true }; // No crypto, always authorized
    }

    const policy = policyId ? this.policies.get(policyId) : undefined;

    const result = await this.cryptoProvider.verifyUCAN(token, {
      requiredCapabilities: policy?.requiredCapabilities?.map(cap => ({
        can: cap,
        with: '*',
      })),
    });

    if (!result.authorized) {
      logger.warn('[ReplicationManager] Replica capability verification failed', {
        replicaDID,
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Register a replica
   */
  registerReplica(replica: Replica): void {
    this.replicas.set(replica.id, replica);

    if (!this.syncStatus.has(replica.nodeId)) {
      this.syncStatus.set(replica.nodeId, { synced: 0, failed: 0 });
    }

    const event: ReplicationEvent = {
      type: 'replica-added',
      replicaId: replica.id,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
    };

    this.replicationEvents.push(event);

    logger.debug('[ReplicationManager] Replica registered', {
      replicaId: replica.id,
      nodeId: replica.nodeId,
      status: replica.status,
    });
  }

  /**
   * Remove a replica
   */
  removeReplica(replicaId: string): void {
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      throw new Error(`Replica ${replicaId} not found`);
    }

    this.replicas.delete(replicaId);

    const event: ReplicationEvent = {
      type: 'replica-removed',
      replicaId,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
    };

    this.replicationEvents.push(event);

    logger.debug('[ReplicationManager] Replica removed', { replicaId });
  }

  /**
   * Create a replication policy
   */
  createPolicy(
    name: string,
    replicationFactor: number,
    consistencyLevel: 'eventual' | 'read-after-write' | 'strong',
    syncInterval: number = 1000,
    maxReplicationLag: number = 10000,
  ): ReplicationPolicy {
    const policy: ReplicationPolicy = {
      id: `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      replicationFactor,
      consistencyLevel,
      syncInterval,
      maxReplicationLag,
    };

    this.policies.set(policy.id, policy);

    logger.debug('[ReplicationManager] Policy created', {
      policyId: policy.id,
      name,
      replicationFactor,
      consistencyLevel,
    });

    return policy;
  }

  /**
   * Update replica status
   */
  updateReplicaStatus(
    replicaId: string,
    status: Replica['status'],
    lagBytes: number = 0,
    lagMillis: number = 0,
  ): void {
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      throw new Error(`Replica ${replicaId} not found`);
    }

    replica.status = status;
    replica.lagBytes = lagBytes;
    replica.lagMillis = lagMillis;
    replica.lastSyncTime = new Date().toISOString();

    const event: ReplicationEvent = {
      type: status === 'syncing' ? 'replica-synced' : 'sync-failed',
      replicaId,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
      details: { status, lagBytes, lagMillis },
    };

    this.replicationEvents.push(event);

    const syncStatus = this.syncStatus.get(replica.nodeId);
    if (syncStatus) {
      if (status === 'syncing' || status === 'secondary') {
        syncStatus.synced++;
      } else if (status === 'failed') {
        syncStatus.failed++;
      }
    }

    logger.debug('[ReplicationManager] Replica status updated', {
      replicaId,
      status,
      lagBytes,
      lagMillis,
    });
  }

  /**
   * Get replicas for node
   */
  getReplicasForNode(nodeId: string): Replica[] {
    return Array.from(this.replicas.values()).filter(r => r.nodeId === nodeId);
  }

  /**
   * Get healthy replicas
   */
  getHealthyReplicas(): Replica[] {
    return Array.from(this.replicas.values()).filter(
      r => r.status === 'secondary' || r.status === 'primary',
    );
  }

  /**
   * Get syncing replicas
   */
  getSyncingReplicas(): Replica[] {
    return Array.from(this.replicas.values()).filter(r => r.status === 'syncing');
  }

  /**
   * Get failed replicas
   */
  getFailedReplicas(): Replica[] {
    return Array.from(this.replicas.values()).filter(r => r.status === 'failed');
  }

  /**
   * Check replication health for policy
   */
  checkReplicationHealth(policyId: string): {
    healthy: boolean;
    replicasInPolicy: number;
    healthyReplicas: number;
    replicationLag: number;
  } {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    const healthy = this.getHealthyReplicas();
    const maxLag = Math.max(0, ...healthy.map(r => r.lagMillis));

    return {
      healthy: healthy.length >= policy.replicationFactor && maxLag <= policy.maxReplicationLag,
      replicasInPolicy: policy.replicationFactor,
      healthyReplicas: healthy.length,
      replicationLag: maxLag,
    };
  }

  /**
   * Get consistency level
   */
  getConsistencyLevel(policyId: string): 'eventual' | 'read-after-write' | 'strong' {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return 'eventual';
    }

    return policy.consistencyLevel;
  }

  /**
   * Get replica
   */
  getReplica(replicaId: string): Replica | undefined {
    return this.replicas.get(replicaId);
  }

  /**
   * Get all replicas
   */
  getAllReplicas(): Replica[] {
    return Array.from(this.replicas.values());
  }

  /**
   * Get policy
   */
  getPolicy(policyId: string): ReplicationPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): ReplicationPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get replication statistics
   */
  getStatistics() {
    const healthy = this.getHealthyReplicas().length;
    const syncing = this.getSyncingReplicas().length;
    const failed = this.getFailedReplicas().length;
    const total = this.replicas.size;

    const replicationLags = Array.from(this.replicas.values()).map(r => r.lagMillis);
    const avgLag = replicationLags.length > 0 ? replicationLags.reduce((a, b) => a + b) / replicationLags.length : 0;
    const maxLag = replicationLags.length > 0 ? Math.max(...replicationLags) : 0;

    return {
      totalReplicas: total,
      healthyReplicas: healthy,
      syncingReplicas: syncing,
      failedReplicas: failed,
      healthiness: total > 0 ? (healthy / total) * 100 : 0,
      averageReplicationLagMs: avgLag,
      maxReplicationLagMs: maxLag,
      totalPolicies: this.policies.size,
    };
  }

  /**
   * Get replication events
   */
  getReplicationEvents(limit?: number): ReplicationEvent[] {
    const events = [...this.replicationEvents];
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }

  /**
   * Get sync status for node
   */
  getSyncStatus(nodeId: string): { synced: number; failed: number } {
    return this.syncStatus.get(nodeId) || { synced: 0, failed: 0 };
  }

  /**
   * Get replication lag distribution
   */
  getReplicationLagDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      '0-100ms': 0,
      '100-500ms': 0,
      '500-1000ms': 0,
      '1000+ms': 0,
    };

    for (const replica of this.replicas.values()) {
      if (replica.lagMillis <= 100) {
        distribution['0-100ms']++;
      } else if (replica.lagMillis <= 500) {
        distribution['100-500ms']++;
      } else if (replica.lagMillis <= 1000) {
        distribution['500-1000ms']++;
      } else {
        distribution['1000+ms']++;
      }
    }

    return distribution;
  }

  /**
   * Check if can satisfy consistency level
   */
  canSatisfyConsistency(policyId: string, _requiredAcks: number): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    const healthyCount = this.getHealthyReplicas().length;

    switch (policy.consistencyLevel) {
      case 'eventual':
        return true; // Always achievable
      case 'read-after-write':
        return healthyCount >= 1;
      case 'strong':
        return healthyCount >= policy.replicationFactor;
      default:
        return false;
    }
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.replicas.clear();
    this.policies.clear();
    this.replicationEvents = [];
    this.syncStatus.clear();
    this.replicasByDID.clear();
    this.cryptoProvider = null;
  }

  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null {
    return this.cryptoProvider;
  }
}
