import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncCoordinator } from '../../distributed/SyncCoordinator';
import { ReplicationManager } from '../../distributed/ReplicationManager';
import { SyncProtocol } from '../../distributed/SyncProtocol';
import { StateReconciler } from '../../distributed/StateReconciler';

describe('Distributed Module', () => {
  describe('SyncCoordinator', () => {
    let coordinator: SyncCoordinator;

    beforeEach(() => {
      coordinator = new SyncCoordinator();
    });

    afterEach(() => {
      coordinator.stopHeartbeatMonitoring();
      coordinator.clear();
    });

    it('should register a node', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const nodes = coordinator.getNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe('node-1');
    });

    it('should deregister a node', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      coordinator.deregisterNode('node-1');

      const nodes = coordinator.getNodes();
      expect(nodes.length).toBe(0);
    });

    it('should create a sync session', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const session = coordinator.createSyncSession('node-1', ['node-2']);

      expect(session).toBeDefined();
      expect(session.initiatorId).toBe('node-1');
      expect(session.participantIds).toContain('node-2');
      expect(session.status).toBe('pending');
    });

    it('should update sync session', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const session = coordinator.createSyncSession('node-1', ['node-2']);

      coordinator.updateSyncSession(session.id, {
        status: 'active',
        itemsSynced: 10,
      });

      const updated = coordinator.getSyncSession(session.id);
      expect(updated?.status).toBe('active');
      expect(updated?.itemsSynced).toBe(10);
    });

    it('should record conflicts', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const session = coordinator.createSyncSession('node-1', ['node-2']);

      coordinator.recordConflict(session.id, 'node-2', { field: 'name' });

      const updated = coordinator.getSyncSession(session.id);
      expect(updated?.conflictsDetected).toBe(1);
    });

    it('should get online nodes', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      coordinator.registerNode({
        id: 'node-2',
        address: 'localhost',
        port: 3001,
        status: 'offline',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const online = coordinator.getOnlineNodes();
      expect(online.length).toBe(1);
      expect(online[0].id).toBe('node-1');
    });

    it('should emit events', () => {
      let emittedNode: unknown = null;

      coordinator.on('node-joined', (node) => {
        emittedNode = node;
      });

      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      expect(emittedNode).toBeDefined();
    });

    it('should get statistics', () => {
      coordinator.registerNode({
        id: 'node-1',
        address: 'localhost',
        port: 3000,
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        version: '1.0.0',
        capabilities: ['sync'],
      });

      const session = coordinator.createSyncSession('node-1', ['node-2']);
      coordinator.updateSyncSession(session.id, { status: 'completed', itemsSynced: 100 });

      const stats = coordinator.getStatistics();
      expect(stats.totalNodes).toBe(1);
      expect(stats.completedSessions).toBe(1);
      expect(stats.totalItemsSynced).toBe(100);
    });
  });

  describe('ReplicationManager', () => {
    let replicationManager: ReplicationManager;

    beforeEach(() => {
      replicationManager = new ReplicationManager();
    });

    it('should register a replica', () => {
      replicationManager.registerReplica({
        id: 'replica-1',
        nodeId: 'node-1',
        status: 'primary',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 0,
      });

      const replicas = replicationManager.getAllReplicas();
      expect(replicas.length).toBe(1);
    });

    it('should create a replication policy', () => {
      const policy = replicationManager.createPolicy(
        'test-policy',
        3,
        'read-after-write',
        1000,
        10000,
      );

      expect(policy.name).toBe('test-policy');
      expect(policy.replicationFactor).toBe(3);
      expect(policy.consistencyLevel).toBe('read-after-write');
    });

    it('should update replica status', () => {
      replicationManager.registerReplica({
        id: 'replica-1',
        nodeId: 'node-1',
        status: 'primary',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 0,
      });

      replicationManager.updateReplicaStatus('replica-1', 'syncing', 100, 50);

      const replica = replicationManager.getReplica('replica-1');
      expect(replica?.status).toBe('syncing');
      expect(replica?.lagBytes).toBe(100);
      expect(replica?.lagMillis).toBe(50);
    });

    it('should get healthy replicas', () => {
      replicationManager.registerReplica({
        id: 'replica-1',
        nodeId: 'node-1',
        status: 'primary',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 0,
      });

      replicationManager.registerReplica({
        id: 'replica-2',
        nodeId: 'node-2',
        status: 'failed',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 0,
      });

      const healthy = replicationManager.getHealthyReplicas();
      expect(healthy.length).toBe(1);
      expect(healthy[0].id).toBe('replica-1');
    });

    it('should check replication health', () => {
      const policy = replicationManager.createPolicy('test-policy', 1, 'eventual');

      replicationManager.registerReplica({
        id: 'replica-1',
        nodeId: 'node-1',
        status: 'primary',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 0,
      });

      const health = replicationManager.checkReplicationHealth(policy.id);
      expect(health.healthy).toBe(true);
      expect(health.healthyReplicas).toBe(1);
    });

    it('should get statistics', () => {
      replicationManager.registerReplica({
        id: 'replica-1',
        nodeId: 'node-1',
        status: 'primary',
        lastSyncTime: new Date().toISOString(),
        lagBytes: 0,
        lagMillis: 100,
      });

      const stats = replicationManager.getStatistics();
      expect(stats.totalReplicas).toBe(1);
      expect(stats.healthyReplicas).toBe(1);
      expect(stats.maxReplicationLagMs).toBe(100);
    });
  });

  describe('SyncProtocol', () => {
    let protocol: SyncProtocol;

    beforeEach(() => {
      protocol = new SyncProtocol();
    });

    it('should create handshake message', () => {
      const message = protocol.createHandshakeMessage('node-1', ['sync', 'replicate']);

      expect(message.type).toBe('handshake');
      expect(message.sender).toBe('node-1');
      expect(message.payload).toBeDefined();
    });

    it('should create sync request message', () => {
      const message = protocol.createSyncRequestMessage(
        'node-1',
        'node-2',
        'session-1',
        '1.0.0',
        '1.1.0',
      );

      expect(message.type).toBe('sync-request');
      expect(message.sender).toBe('node-1');
      expect(message.receiver).toBe('node-2');
    });

    it('should create sync response message', () => {
      const message = protocol.createSyncResponseMessage(
        'node-2',
        'node-1',
        'session-1',
        '1.0.0',
        '1.1.0',
        [{ id: 1 }, { id: 2 }],
        false,
        0,
      );

      expect(message.type).toBe('sync-response');
      expect((message.payload as { data: unknown[] }).data.length).toBe(2);
    });

    it('should serialize and deserialize messages', () => {
      const message = protocol.createHandshakeMessage('node-1', ['sync']);

      const serialized = protocol.serializeMessage(message);
      const deserialized = protocol.deserializeMessage(serialized);

      expect(deserialized.type).toBe(message.type);
      expect(deserialized.sender).toBe(message.sender);
      expect(deserialized.messageId).toBe(message.messageId);
    });

    it('should validate messages', () => {
      const validMessage = protocol.createHandshakeMessage('node-1', ['sync']);
      const validation = protocol.validateMessage(validMessage);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should process handshake', () => {
      const message = protocol.createHandshakeMessage('node-1', ['sync', 'replicate']);
      const handshake = protocol.processHandshake(message);

      expect(handshake.nodeId).toBe('node-1');
      expect(handshake.capabilities).toContain('sync');
    });

    it('should get statistics', () => {
      protocol.createHandshakeMessage('node-1', ['sync']);
      protocol.createSyncRequestMessage('node-1', 'node-2', 'session-1', '1.0', '1.1');

      const stats = protocol.getStatistics();
      expect(stats.totalMessages).toBe(2);
      expect(stats.messagesByType['handshake']).toBe(1);
      expect(stats.messagesByType['sync-request']).toBe(1);
    });
  });

  describe('StateReconciler', () => {
    let reconciler: StateReconciler;

    beforeEach(() => {
      reconciler = new StateReconciler();
    });

    it('should record state versions', () => {
      reconciler.recordStateVersion(
        'user:123',
        '1.0',
        new Date().toISOString(),
        'node-1',
        'hash-a',
        { name: 'Alice' },
      );

      const versions = reconciler.getStateVersions('user:123');
      expect(versions.length).toBe(1);
    });

    it('should detect conflicts', () => {
      reconciler.recordStateVersion('user:123', '1.0', new Date().toISOString(), 'node-1', 'hash-a', { name: 'Alice' });
      reconciler.recordStateVersion('user:123', '1.0', new Date().toISOString(), 'node-2', 'hash-b', { name: 'Bob' });

      expect(reconciler.detectConflicts('user:123')).toBe(true);
    });

    it('should compare states and generate diff', () => {
      const state1 = { name: 'Alice', age: 30 };
      const state2 = { name: 'Alice', age: 31, email: 'alice@example.com' };

      const diff = reconciler.compareStates(state1, state2);

      expect(diff.added['email']).toBe('alice@example.com');
      expect(diff.modified['age'].old).toBe(30);
      expect(diff.modified['age'].new).toBe(31);
    });

    it('should reconcile with last-write-wins strategy', () => {
      const versions = [
        { version: '1.0', timestamp: '2024-01-01T00:00:00Z', nodeId: 'node-1', hash: 'a', data: { name: 'Alice' } },
        { version: '1.0', timestamp: '2024-01-01T00:00:01Z', nodeId: 'node-2', hash: 'b', data: { name: 'Bob' } },
      ];

      const result = reconciler.reconcileLastWriteWins(versions);

      expect(result.success).toBe(true);
      expect((result.mergedState as { name: string }).name).toBe('Bob');
      expect(result.conflictsResolved).toBe(1);
    });

    it('should reconcile with majority vote strategy', () => {
      const versions = [
        { version: '1.0', timestamp: '2024-01-01T00:00:00Z', nodeId: 'node-1', hash: 'a', data: { name: 'Alice' } },
        { version: '1.0', timestamp: '2024-01-01T00:00:01Z', nodeId: 'node-2', hash: 'a', data: { name: 'Alice' } },
        { version: '1.0', timestamp: '2024-01-01T00:00:02Z', nodeId: 'node-3', hash: 'b', data: { name: 'Bob' } },
      ];

      const result = reconciler.reconcileMajorityVote(versions);

      expect(result.success).toBe(true);
      expect((result.mergedState as { name: string }).name).toBe('Alice');
    });

    it('should merge states', () => {
      const states = [
        { name: 'Alice' },
        { age: 30 },
        { email: 'alice@example.com' },
      ];

      const merged = reconciler.mergeStates(states) as Record<string, unknown>;

      expect(merged.name).toBe('Alice');
      expect(merged.age).toBe(30);
      expect(merged.email).toBe('alice@example.com');
    });

    it('should validate state', () => {
      const validState = { name: 'Alice' };
      const validation = reconciler.validateState(validState);

      expect(validation.valid).toBe(true);

      const invalidState = null;
      const invalidValidation = reconciler.validateState(invalidState);

      expect(invalidValidation.valid).toBe(false);
    });

    it('should get statistics', () => {
      reconciler.recordStateVersion('user:123', '1.0', new Date().toISOString(), 'node-1', 'hash-a', { name: 'Alice' });
      reconciler.recordStateVersion('user:123', '1.0', new Date().toISOString(), 'node-2', 'hash-b', { name: 'Bob' });

      const versions = reconciler.getStateVersions('user:123');
      reconciler.reconcileLastWriteWins(versions);

      const stats = reconciler.getStatistics();
      expect(stats.totalReconciliations).toBe(1);
      expect(stats.trackedKeys).toBe(1);
    });
  });
});
