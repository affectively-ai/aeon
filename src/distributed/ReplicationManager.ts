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
 */

import { logger } from '../utils/logger';

export interface Replica {
  id: string;
  nodeId: string;
  status: 'primary' | 'secondary' | 'syncing' | 'failed';
  lastSyncTime: string;
  lagBytes: number;
  lagMillis: number;
}

export interface ReplicationPolicy {
  id: string;
  name: string;
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'read-after-write' | 'strong';
  syncInterval: number;
  maxReplicationLag: number;
}

export interface ReplicationEvent {
  type: 'replica-added' | 'replica-removed' | 'replica-synced' | 'sync-failed';
  replicaId: string;
  nodeId: string;
  timestamp: string;
  details?: unknown;
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
  canSatisfyConsistency(policyId: string, requiredAcks: number): boolean {
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
  }
}
