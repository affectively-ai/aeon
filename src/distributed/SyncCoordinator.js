'use strict';
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.SyncCoordinator = void 0;
const eventemitter3_1 = require('eventemitter3');
const logger_1 = require('../utils/logger');
/**
 * Sync Coordinator
 * Coordinates synchronization across distributed nodes
 */
class SyncCoordinator extends eventemitter3_1.EventEmitter {
  constructor() {
    super();
    this.nodes = new Map();
    this.sessions = new Map();
    this.syncEvents = [];
    this.nodeHeartbeats = new Map();
    this.heartbeatInterval = null;
    // Crypto support
    this.cryptoProvider = null;
    this.nodesByDID = new Map(); // DID -> nodeId
  }
  /**
   * Configure cryptographic provider for authenticated sync
   */
  configureCrypto(provider) {
    this.cryptoProvider = provider;
    logger_1.logger.debug('[SyncCoordinator] Crypto configured', {
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
   * Register a node with DID-based identity
   */
  async registerAuthenticatedNode(nodeInfo) {
    const node = {
      ...nodeInfo,
    };
    this.nodes.set(node.id, node);
    this.nodeHeartbeats.set(node.id, Date.now());
    this.nodesByDID.set(nodeInfo.did, node.id);
    // Register with crypto provider if available
    if (this.cryptoProvider) {
      await this.cryptoProvider.registerRemoteNode({
        id: node.id,
        did: nodeInfo.did,
        publicSigningKey: nodeInfo.publicSigningKey,
        publicEncryptionKey: nodeInfo.publicEncryptionKey,
      });
    }
    const event = {
      type: 'node-joined',
      nodeId: node.id,
      timestamp: new Date().toISOString(),
      data: { did: nodeInfo.did, authenticated: true },
    };
    this.syncEvents.push(event);
    this.emit('node-joined', node);
    logger_1.logger.debug('[SyncCoordinator] Authenticated node registered', {
      nodeId: node.id,
      did: nodeInfo.did,
      version: node.version,
    });
    return node;
  }
  /**
   * Get node by DID
   */
  getNodeByDID(did) {
    const nodeId = this.nodesByDID.get(did);
    if (!nodeId) return undefined;
    return this.nodes.get(nodeId);
  }
  /**
   * Get all authenticated nodes (nodes with DIDs)
   */
  getAuthenticatedNodes() {
    return Array.from(this.nodes.values()).filter((n) => n.did);
  }
  /**
   * Create an authenticated sync session with UCAN-based authorization
   */
  async createAuthenticatedSyncSession(initiatorDID, participantDIDs, options) {
    // Find the initiator node by DID
    const initiatorNodeId = this.nodesByDID.get(initiatorDID);
    if (!initiatorNodeId) {
      throw new Error(`Initiator node with DID ${initiatorDID} not found`);
    }
    // Find participant node IDs
    const participantIds = [];
    for (const did of participantDIDs) {
      const nodeId = this.nodesByDID.get(did);
      if (nodeId) {
        participantIds.push(nodeId);
      }
    }
    // Create session token if crypto is available
    let sessionToken;
    if (this.cryptoProvider && this.cryptoProvider.isInitialized()) {
      // Create a UCAN that grants sync capabilities to all participants
      const capabilities = (
        options?.requiredCapabilities || ['aeon:sync:read', 'aeon:sync:write']
      ).map((cap) => ({ can: cap, with: '*' }));
      // Create token for the first participant (in production, you'd create one per participant)
      if (participantDIDs.length > 0) {
        sessionToken = await this.cryptoProvider.createUCAN(
          participantDIDs[0],
          capabilities,
          { expirationSeconds: 3600 } // 1 hour
        );
      }
    }
    const session = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      initiatorId: initiatorNodeId,
      participantIds,
      status: 'pending',
      startTime: new Date().toISOString(),
      itemsSynced: 0,
      itemsFailed: 0,
      conflictsDetected: 0,
      initiatorDID,
      participantDIDs,
      encryptionMode: options?.encryptionMode || 'none',
      requiredCapabilities: options?.requiredCapabilities,
      sessionToken,
    };
    this.sessions.set(session.id, session);
    const event = {
      type: 'sync-started',
      sessionId: session.id,
      nodeId: initiatorNodeId,
      timestamp: new Date().toISOString(),
      data: {
        authenticated: true,
        initiatorDID,
        participantCount: participantDIDs.length,
        encryptionMode: session.encryptionMode,
      },
    };
    this.syncEvents.push(event);
    this.emit('sync-started', session);
    logger_1.logger.debug(
      '[SyncCoordinator] Authenticated sync session created',
      {
        sessionId: session.id,
        initiatorDID,
        participants: participantDIDs.length,
        encryptionMode: session.encryptionMode,
      }
    );
    return session;
  }
  /**
   * Verify a node's UCAN capabilities for a session
   */
  async verifyNodeCapabilities(sessionId, nodeDID, token) {
    if (!this.cryptoProvider) {
      return { authorized: true }; // No crypto, always authorized
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { authorized: false, error: `Session ${sessionId} not found` };
    }
    const result = await this.cryptoProvider.verifyUCAN(token, {
      requiredCapabilities: session.requiredCapabilities?.map((cap) => ({
        can: cap,
        with: '*',
      })),
    });
    if (!result.authorized) {
      logger_1.logger.warn(
        '[SyncCoordinator] Node capability verification failed',
        {
          sessionId,
          nodeDID,
          error: result.error,
        }
      );
    }
    return result;
  }
  /**
   * Register a node in the cluster
   */
  registerNode(node) {
    this.nodes.set(node.id, node);
    this.nodeHeartbeats.set(node.id, Date.now());
    const event = {
      type: 'node-joined',
      nodeId: node.id,
      timestamp: new Date().toISOString(),
    };
    this.syncEvents.push(event);
    this.emit('node-joined', node);
    logger_1.logger.debug('[SyncCoordinator] Node registered', {
      nodeId: node.id,
      address: node.address,
      version: node.version,
    });
  }
  /**
   * Deregister a node from the cluster
   */
  deregisterNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    this.nodes.delete(nodeId);
    this.nodeHeartbeats.delete(nodeId);
    const event = {
      type: 'node-left',
      nodeId,
      timestamp: new Date().toISOString(),
    };
    this.syncEvents.push(event);
    this.emit('node-left', node);
    logger_1.logger.debug('[SyncCoordinator] Node deregistered', { nodeId });
  }
  /**
   * Create a new sync session
   */
  createSyncSession(initiatorId, participantIds) {
    const node = this.nodes.get(initiatorId);
    if (!node) {
      throw new Error(`Initiator node ${initiatorId} not found`);
    }
    const session = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      initiatorId,
      participantIds,
      status: 'pending',
      startTime: new Date().toISOString(),
      itemsSynced: 0,
      itemsFailed: 0,
      conflictsDetected: 0,
    };
    this.sessions.set(session.id, session);
    const event = {
      type: 'sync-started',
      sessionId: session.id,
      nodeId: initiatorId,
      timestamp: new Date().toISOString(),
    };
    this.syncEvents.push(event);
    this.emit('sync-started', session);
    logger_1.logger.debug('[SyncCoordinator] Sync session created', {
      sessionId: session.id,
      initiator: initiatorId,
      participants: participantIds.length,
    });
    return session;
  }
  /**
   * Update sync session
   */
  updateSyncSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    Object.assign(session, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      session.endTime = new Date().toISOString();
      const event = {
        type: 'sync-completed',
        sessionId,
        nodeId: session.initiatorId,
        timestamp: new Date().toISOString(),
        data: { status: updates.status, itemsSynced: session.itemsSynced },
      };
      this.syncEvents.push(event);
      this.emit('sync-completed', session);
    }
    logger_1.logger.debug('[SyncCoordinator] Sync session updated', {
      sessionId,
      status: session.status,
      itemsSynced: session.itemsSynced,
    });
  }
  /**
   * Record a conflict during sync
   */
  recordConflict(sessionId, nodeId, conflictData) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conflictsDetected++;
      const event = {
        type: 'conflict-detected',
        sessionId,
        nodeId,
        timestamp: new Date().toISOString(),
        data: conflictData,
      };
      this.syncEvents.push(event);
      this.emit('conflict-detected', { session, nodeId, conflictData });
      logger_1.logger.debug('[SyncCoordinator] Conflict recorded', {
        sessionId,
        nodeId,
        totalConflicts: session.conflictsDetected,
      });
    }
  }
  /**
   * Update node status
   */
  updateNodeStatus(nodeId, status) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    node.status = status;
    this.nodeHeartbeats.set(nodeId, Date.now());
    logger_1.logger.debug('[SyncCoordinator] Node status updated', {
      nodeId,
      status,
    });
  }
  /**
   * Record heartbeat from node
   */
  recordHeartbeat(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    node.lastHeartbeat = new Date().toISOString();
    this.nodeHeartbeats.set(nodeId, Date.now());
  }
  /**
   * Get all nodes
   */
  getNodes() {
    return Array.from(this.nodes.values());
  }
  /**
   * Get node by ID
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }
  /**
   * Get online nodes
   */
  getOnlineNodes() {
    return Array.from(this.nodes.values()).filter((n) => n.status === 'online');
  }
  /**
   * Get nodes by capability
   */
  getNodesByCapability(capability) {
    return Array.from(this.nodes.values()).filter((n) =>
      n.capabilities.includes(capability)
    );
  }
  /**
   * Get sync session
   */
  getSyncSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  /**
   * Get all sync sessions
   */
  getAllSyncSessions() {
    return Array.from(this.sessions.values());
  }
  /**
   * Get active sync sessions
   */
  getActiveSyncSessions() {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active'
    );
  }
  /**
   * Get sessions for a node
   */
  getSessionsForNode(nodeId) {
    return Array.from(this.sessions.values()).filter(
      (s) => s.initiatorId === nodeId || s.participantIds.includes(nodeId)
    );
  }
  /**
   * Get sync statistics
   */
  getStatistics() {
    const sessions = Array.from(this.sessions.values());
    const completed = sessions.filter((s) => s.status === 'completed').length;
    const failed = sessions.filter((s) => s.status === 'failed').length;
    const active = sessions.filter((s) => s.status === 'active').length;
    const totalItemsSynced = sessions.reduce(
      (sum, s) => sum + s.itemsSynced,
      0
    );
    const totalConflicts = sessions.reduce(
      (sum, s) => sum + s.conflictsDetected,
      0
    );
    return {
      totalNodes: this.nodes.size,
      onlineNodes: this.getOnlineNodes().length,
      offlineNodes: this.nodes.size - this.getOnlineNodes().length,
      totalSessions: sessions.length,
      activeSessions: active,
      completedSessions: completed,
      failedSessions: failed,
      successRate:
        sessions.length > 0 ? (completed / sessions.length) * 100 : 0,
      totalItemsSynced,
      totalConflicts,
      averageConflictsPerSession:
        sessions.length > 0 ? totalConflicts / sessions.length : 0,
    };
  }
  /**
   * Get sync events
   */
  getSyncEvents(limit) {
    const events = [...this.syncEvents];
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }
  /**
   * Get sync events for session
   */
  getSessionEvents(sessionId) {
    return this.syncEvents.filter((e) => e.sessionId === sessionId);
  }
  /**
   * Check node health
   */
  getNodeHealth() {
    const health = {};
    for (const [nodeId, lastHeartbeat] of this.nodeHeartbeats) {
      const now = Date.now();
      const downtime = now - lastHeartbeat;
      const isHealthy = downtime < 30000; // 30 seconds threshold
      health[nodeId] = {
        isHealthy,
        downtime,
      };
    }
    return health;
  }
  /**
   * Start heartbeat monitoring
   */
  startHeartbeatMonitoring(interval = 5000) {
    if (this.heartbeatInterval) {
      return;
    }
    this.heartbeatInterval = setInterval(() => {
      const health = this.getNodeHealth();
      for (const [nodeId, { isHealthy }] of Object.entries(health)) {
        const node = this.nodes.get(nodeId);
        if (!node) {
          continue;
        }
        const newStatus = isHealthy ? 'online' : 'offline';
        if (node.status !== newStatus) {
          this.updateNodeStatus(nodeId, newStatus);
        }
      }
    }, interval);
    logger_1.logger.debug('[SyncCoordinator] Heartbeat monitoring started', {
      interval,
    });
  }
  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger_1.logger.debug('[SyncCoordinator] Heartbeat monitoring stopped');
    }
  }
  /**
   * Clear all state (for testing)
   */
  clear() {
    this.nodes.clear();
    this.sessions.clear();
    this.syncEvents = [];
    this.nodeHeartbeats.clear();
    this.nodesByDID.clear();
    this.cryptoProvider = null;
    this.stopHeartbeatMonitoring();
  }
  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider() {
    return this.cryptoProvider;
  }
}
exports.SyncCoordinator = SyncCoordinator;
//# sourceMappingURL=SyncCoordinator.js.map
