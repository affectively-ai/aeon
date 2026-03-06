'use strict';
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.ReplicationManager = void 0;
const logger_1 = require('../utils/logger');
/**
 * Replication Manager
 * Manages data replication across distributed nodes
 */
class ReplicationManager {
  constructor(options) {
    this.replicas = new Map();
    this.policies = new Map();
    this.replicationEvents = [];
    this.syncStatus = new Map();
    // Crypto support
    this.cryptoProvider = null;
    this.replicasByDID = new Map(); // DID -> replicaId
    this.persistence = null;
    this.persistTimer = null;
    this.persistInFlight = false;
    this.persistPending = false;
    if (options?.persistence) {
      this.persistence = {
        ...options.persistence,
        key: options.persistence.key ?? ReplicationManager.DEFAULT_PERSIST_KEY,
        autoPersist: options.persistence.autoPersist ?? true,
        autoLoad: options.persistence.autoLoad ?? false,
        persistDebounceMs: options.persistence.persistDebounceMs ?? 25,
      };
    }
    if (this.persistence?.autoLoad) {
      void this.loadFromPersistence().catch((error) => {
        logger_1.logger.error(
          '[ReplicationManager] Failed to load persistence',
          {
            key: this.persistence?.key,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      });
    }
  }
  /**
   * Configure cryptographic provider for encrypted replication
   */
  configureCrypto(provider) {
    this.cryptoProvider = provider;
    logger_1.logger.debug('[ReplicationManager] Crypto configured', {
      initialized: provider.isInitialized(),
    });
  }
  /**
   * Check if crypto is configured
   */
  isCryptoEnabled() {
    return this.cryptoProvider !== null && this.cryptoProvider.isInitialized();
  }
  /**
   * Register an authenticated replica with DID
   */
  async registerAuthenticatedReplica(replica, encrypted = false) {
    const authenticatedReplica = {
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
    const event = {
      type: 'replica-added',
      replicaId: replica.id,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
      details: { did: replica.did, encrypted, authenticated: true },
    };
    this.replicationEvents.push(event);
    this.schedulePersist();
    logger_1.logger.debug(
      '[ReplicationManager] Authenticated replica registered',
      {
        replicaId: replica.id,
        did: replica.did,
        encrypted,
      }
    );
    return authenticatedReplica;
  }
  /**
   * Get replica by DID
   */
  getReplicaByDID(did) {
    const replicaId = this.replicasByDID.get(did);
    if (!replicaId) return undefined;
    return this.replicas.get(replicaId);
  }
  /**
   * Get all encrypted replicas
   */
  getEncryptedReplicas() {
    return Array.from(this.replicas.values()).filter((r) => r.encrypted);
  }
  /**
   * Encrypt data for replication to a specific replica
   */
  async encryptForReplica(data, targetReplicaDID) {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }
    const dataBytes = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await this.cryptoProvider.encrypt(
      dataBytes,
      targetReplicaDID
    );
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
  async decryptReplicationData(encrypted) {
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
      encrypted.senderDID
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
  /**
   * Create an encrypted replication policy
   */
  createEncryptedPolicy(
    name,
    replicationFactor,
    consistencyLevel,
    encryptionMode,
    options
  ) {
    const policy = {
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
    logger_1.logger.debug('[ReplicationManager] Encrypted policy created', {
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
  async verifyReplicaCapabilities(replicaDID, token, policyId) {
    if (!this.cryptoProvider) {
      return { authorized: true }; // No crypto, always authorized
    }
    const policy = policyId ? this.policies.get(policyId) : undefined;
    const result = await this.cryptoProvider.verifyUCAN(token, {
      requiredCapabilities: policy?.requiredCapabilities?.map((cap) => ({
        can: cap,
        with: '*',
      })),
    });
    if (!result.authorized) {
      logger_1.logger.warn(
        '[ReplicationManager] Replica capability verification failed',
        {
          replicaDID,
          error: result.error,
        }
      );
    }
    return result;
  }
  /**
   * Register a replica
   */
  registerReplica(replica) {
    this.replicas.set(replica.id, replica);
    if (!this.syncStatus.has(replica.nodeId)) {
      this.syncStatus.set(replica.nodeId, { synced: 0, failed: 0 });
    }
    const event = {
      type: 'replica-added',
      replicaId: replica.id,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
    };
    this.replicationEvents.push(event);
    this.schedulePersist();
    logger_1.logger.debug('[ReplicationManager] Replica registered', {
      replicaId: replica.id,
      nodeId: replica.nodeId,
      status: replica.status,
    });
  }
  /**
   * Remove a replica
   */
  removeReplica(replicaId) {
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      throw new Error(`Replica ${replicaId} not found`);
    }
    this.replicas.delete(replicaId);
    const event = {
      type: 'replica-removed',
      replicaId,
      nodeId: replica.nodeId,
      timestamp: new Date().toISOString(),
    };
    this.replicationEvents.push(event);
    this.schedulePersist();
    logger_1.logger.debug('[ReplicationManager] Replica removed', {
      replicaId,
    });
  }
  /**
   * Create a replication policy
   */
  createPolicy(
    name,
    replicationFactor,
    consistencyLevel,
    syncInterval = 1000,
    maxReplicationLag = 10000
  ) {
    const policy = {
      id: `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      replicationFactor,
      consistencyLevel,
      syncInterval,
      maxReplicationLag,
    };
    this.policies.set(policy.id, policy);
    this.schedulePersist();
    logger_1.logger.debug('[ReplicationManager] Policy created', {
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
  updateReplicaStatus(replicaId, status, lagBytes = 0, lagMillis = 0) {
    const replica = this.replicas.get(replicaId);
    if (!replica) {
      throw new Error(`Replica ${replicaId} not found`);
    }
    replica.status = status;
    replica.lagBytes = lagBytes;
    replica.lagMillis = lagMillis;
    replica.lastSyncTime = new Date().toISOString();
    const event = {
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
    logger_1.logger.debug('[ReplicationManager] Replica status updated', {
      replicaId,
      status,
      lagBytes,
      lagMillis,
    });
    this.schedulePersist();
  }
  /**
   * Get replicas for node
   */
  getReplicasForNode(nodeId) {
    return Array.from(this.replicas.values()).filter(
      (r) => r.nodeId === nodeId
    );
  }
  /**
   * Get healthy replicas
   */
  getHealthyReplicas() {
    return Array.from(this.replicas.values()).filter(
      (r) => r.status === 'secondary' || r.status === 'primary'
    );
  }
  /**
   * Get syncing replicas
   */
  getSyncingReplicas() {
    return Array.from(this.replicas.values()).filter(
      (r) => r.status === 'syncing'
    );
  }
  /**
   * Get failed replicas
   */
  getFailedReplicas() {
    return Array.from(this.replicas.values()).filter(
      (r) => r.status === 'failed'
    );
  }
  /**
   * Check replication health for policy
   */
  checkReplicationHealth(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }
    const healthy = this.getHealthyReplicas();
    const maxLag = Math.max(0, ...healthy.map((r) => r.lagMillis));
    return {
      healthy:
        healthy.length >= policy.replicationFactor &&
        maxLag <= policy.maxReplicationLag,
      replicasInPolicy: policy.replicationFactor,
      healthyReplicas: healthy.length,
      replicationLag: maxLag,
    };
  }
  /**
   * Get consistency level
   */
  getConsistencyLevel(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return 'eventual';
    }
    return policy.consistencyLevel;
  }
  /**
   * Get replica
   */
  getReplica(replicaId) {
    return this.replicas.get(replicaId);
  }
  /**
   * Get all replicas
   */
  getAllReplicas() {
    return Array.from(this.replicas.values());
  }
  /**
   * Get policy
   */
  getPolicy(policyId) {
    return this.policies.get(policyId);
  }
  /**
   * Get all policies
   */
  getAllPolicies() {
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
    const replicationLags = Array.from(this.replicas.values()).map(
      (r) => r.lagMillis
    );
    const avgLag =
      replicationLags.length > 0
        ? replicationLags.reduce((a, b) => a + b) / replicationLags.length
        : 0;
    const maxLag =
      replicationLags.length > 0 ? Math.max(...replicationLags) : 0;
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
  getReplicationEvents(limit) {
    const events = [...this.replicationEvents];
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }
  /**
   * Get sync status for node
   */
  getSyncStatus(nodeId) {
    return this.syncStatus.get(nodeId) || { synced: 0, failed: 0 };
  }
  /**
   * Get replication lag distribution
   */
  getReplicationLagDistribution() {
    const distribution = {
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
  canSatisfyConsistency(policyId, _requiredAcks) {
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
   * Persist current replication state snapshot.
   */
  async saveToPersistence() {
    if (!this.persistence) {
      return;
    }
    const data = {
      replicas: this.getAllReplicas(),
      policies: this.getAllPolicies(),
      syncStatus: Array.from(this.syncStatus.entries()).map(
        ([nodeId, state]) => ({
          nodeId,
          synced: state.synced,
          failed: state.failed,
        })
      ),
    };
    const envelope = {
      version: 1,
      updatedAt: Date.now(),
      data,
    };
    const serialize =
      this.persistence.serializer ?? ((value) => JSON.stringify(value));
    await this.persistence.adapter.setItem(
      this.persistence.key,
      serialize(envelope)
    );
  }
  /**
   * Load replication snapshot from persistence.
   */
  async loadFromPersistence() {
    if (!this.persistence) {
      return { replicas: 0, policies: 0, syncStatus: 0 };
    }
    const raw = await this.persistence.adapter.getItem(this.persistence.key);
    if (!raw) {
      return { replicas: 0, policies: 0, syncStatus: 0 };
    }
    const deserialize =
      this.persistence.deserializer ?? ((value) => JSON.parse(value));
    const envelope = deserialize(raw);
    if (envelope.version !== 1 || !envelope.data) {
      throw new Error('Invalid replication persistence payload');
    }
    if (
      !Array.isArray(envelope.data.replicas) ||
      !Array.isArray(envelope.data.policies) ||
      !Array.isArray(envelope.data.syncStatus)
    ) {
      throw new Error('Invalid replication persistence structure');
    }
    this.replicas.clear();
    this.policies.clear();
    this.syncStatus.clear();
    this.replicasByDID.clear();
    let importedReplicas = 0;
    for (const replica of envelope.data.replicas) {
      if (this.isValidReplica(replica)) {
        this.replicas.set(replica.id, replica);
        if (replica.did) {
          this.replicasByDID.set(replica.did, replica.id);
        }
        importedReplicas++;
      }
    }
    let importedPolicies = 0;
    for (const policy of envelope.data.policies) {
      if (this.isValidPolicy(policy)) {
        this.policies.set(policy.id, policy);
        importedPolicies++;
      }
    }
    let importedSyncStatus = 0;
    for (const status of envelope.data.syncStatus) {
      if (
        typeof status.nodeId === 'string' &&
        typeof status.synced === 'number' &&
        typeof status.failed === 'number'
      ) {
        this.syncStatus.set(status.nodeId, {
          synced: status.synced,
          failed: status.failed,
        });
        importedSyncStatus++;
      }
    }
    logger_1.logger.debug('[ReplicationManager] Loaded from persistence', {
      key: this.persistence.key,
      replicas: importedReplicas,
      policies: importedPolicies,
      syncStatus: importedSyncStatus,
    });
    return {
      replicas: importedReplicas,
      policies: importedPolicies,
      syncStatus: importedSyncStatus,
    };
  }
  /**
   * Remove persisted replication snapshot.
   */
  async clearPersistence() {
    if (!this.persistence) {
      return;
    }
    await this.persistence.adapter.removeItem(this.persistence.key);
  }
  schedulePersist() {
    if (!this.persistence || this.persistence.autoPersist === false) {
      return;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      void this.persistSafely();
    }, this.persistence.persistDebounceMs ?? 25);
  }
  async persistSafely() {
    if (!this.persistence) {
      return;
    }
    if (this.persistInFlight) {
      this.persistPending = true;
      return;
    }
    this.persistInFlight = true;
    try {
      await this.saveToPersistence();
    } catch (error) {
      logger_1.logger.error('[ReplicationManager] Persistence write failed', {
        key: this.persistence.key,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.persistInFlight = false;
      const shouldRunAgain = this.persistPending;
      this.persistPending = false;
      if (shouldRunAgain) {
        void this.persistSafely();
      }
    }
  }
  isValidReplica(value) {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value;
    const validStatus =
      candidate.status === 'primary' ||
      candidate.status === 'secondary' ||
      candidate.status === 'syncing' ||
      candidate.status === 'failed';
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.nodeId === 'string' &&
      validStatus &&
      typeof candidate.lastSyncTime === 'string' &&
      typeof candidate.lagBytes === 'number' &&
      typeof candidate.lagMillis === 'number'
    );
  }
  isValidPolicy(value) {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value;
    const validConsistency =
      candidate.consistencyLevel === 'eventual' ||
      candidate.consistencyLevel === 'read-after-write' ||
      candidate.consistencyLevel === 'strong';
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.replicationFactor === 'number' &&
      validConsistency &&
      typeof candidate.syncInterval === 'number' &&
      typeof candidate.maxReplicationLag === 'number'
    );
  }
  /**
   * Clear all state (for testing)
   */
  clear() {
    this.replicas.clear();
    this.policies.clear();
    this.replicationEvents = [];
    this.syncStatus.clear();
    this.replicasByDID.clear();
    this.cryptoProvider = null;
    this.schedulePersist();
  }
  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider() {
    return this.cryptoProvider;
  }
}
exports.ReplicationManager = ReplicationManager;
ReplicationManager.DEFAULT_PERSIST_KEY = 'aeon:replication-state:v1';
//# sourceMappingURL=ReplicationManager.js.map
