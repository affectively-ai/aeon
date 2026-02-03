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
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger';

export interface SyncNode {
  id: string;
  address: string;
  port: number;
  status: 'online' | 'offline' | 'syncing';
  lastHeartbeat: string;
  version: string;
  capabilities: string[];
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
}

export interface SyncEvent {
  type: 'node-joined' | 'node-left' | 'sync-started' | 'sync-completed' | 'conflict-detected';
  sessionId?: string;
  nodeId: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Sync Coordinator
 * Coordinates synchronization across distributed nodes
 */
export class SyncCoordinator extends EventEmitter {
  private nodes: Map<string, SyncNode> = new Map();
  private sessions: Map<string, SyncSession> = new Map();
  private syncEvents: SyncEvent[] = [];
  private nodeHeartbeats: Map<string, number> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
  }

  /**
   * Register a node in the cluster
   */
  registerNode(node: SyncNode): void {
    this.nodes.set(node.id, node);
    this.nodeHeartbeats.set(node.id, Date.now());

    const event: SyncEvent = {
      type: 'node-joined',
      nodeId: node.id,
      timestamp: new Date().toISOString(),
    };

    this.syncEvents.push(event);
    this.emit('node-joined', node);

    logger.debug('[SyncCoordinator] Node registered', {
      nodeId: node.id,
      address: node.address,
      version: node.version,
    });
  }

  /**
   * Deregister a node from the cluster
   */
  deregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    this.nodes.delete(nodeId);
    this.nodeHeartbeats.delete(nodeId);

    const event: SyncEvent = {
      type: 'node-left',
      nodeId,
      timestamp: new Date().toISOString(),
    };

    this.syncEvents.push(event);
    this.emit('node-left', node);

    logger.debug('[SyncCoordinator] Node deregistered', { nodeId });
  }

  /**
   * Create a new sync session
   */
  createSyncSession(initiatorId: string, participantIds: string[]): SyncSession {
    const node = this.nodes.get(initiatorId);
    if (!node) {
      throw new Error(`Initiator node ${initiatorId} not found`);
    }

    const session: SyncSession = {
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

    const event: SyncEvent = {
      type: 'sync-started',
      sessionId: session.id,
      nodeId: initiatorId,
      timestamp: new Date().toISOString(),
    };

    this.syncEvents.push(event);
    this.emit('sync-started', session);

    logger.debug('[SyncCoordinator] Sync session created', {
      sessionId: session.id,
      initiator: initiatorId,
      participants: participantIds.length,
    });

    return session;
  }

  /**
   * Update sync session
   */
  updateSyncSession(
    sessionId: string,
    updates: Partial<SyncSession>,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    Object.assign(session, updates);

    if (updates.status === 'completed' || updates.status === 'failed') {
      session.endTime = new Date().toISOString();

      const event: SyncEvent = {
        type: 'sync-completed',
        sessionId,
        nodeId: session.initiatorId,
        timestamp: new Date().toISOString(),
        data: { status: updates.status, itemsSynced: session.itemsSynced },
      };

      this.syncEvents.push(event);
      this.emit('sync-completed', session);
    }

    logger.debug('[SyncCoordinator] Sync session updated', {
      sessionId,
      status: session.status,
      itemsSynced: session.itemsSynced,
    });
  }

  /**
   * Record a conflict during sync
   */
  recordConflict(sessionId: string, nodeId: string, conflictData?: unknown): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.conflictsDetected++;

      const event: SyncEvent = {
        type: 'conflict-detected',
        sessionId,
        nodeId,
        timestamp: new Date().toISOString(),
        data: conflictData,
      };

      this.syncEvents.push(event);
      this.emit('conflict-detected', { session, nodeId, conflictData });

      logger.debug('[SyncCoordinator] Conflict recorded', {
        sessionId,
        nodeId,
        totalConflicts: session.conflictsDetected,
      });
    }
  }

  /**
   * Update node status
   */
  updateNodeStatus(nodeId: string, status: SyncNode['status']): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.status = status;
    this.nodeHeartbeats.set(nodeId, Date.now());

    logger.debug('[SyncCoordinator] Node status updated', {
      nodeId,
      status,
    });
  }

  /**
   * Record heartbeat from node
   */
  recordHeartbeat(nodeId: string): void {
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
  getNodes(): SyncNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): SyncNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get online nodes
   */
  getOnlineNodes(): SyncNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === 'online');
  }

  /**
   * Get nodes by capability
   */
  getNodesByCapability(capability: string): SyncNode[] {
    return Array.from(this.nodes.values()).filter(n =>
      n.capabilities.includes(capability),
    );
  }

  /**
   * Get sync session
   */
  getSyncSession(sessionId: string): SyncSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sync sessions
   */
  getAllSyncSessions(): SyncSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active sync sessions
   */
  getActiveSyncSessions(): SyncSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Get sessions for a node
   */
  getSessionsForNode(nodeId: string): SyncSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.initiatorId === nodeId || s.participantIds.includes(nodeId),
    );
  }

  /**
   * Get sync statistics
   */
  getStatistics() {
    const sessions = Array.from(this.sessions.values());
    const completed = sessions.filter(s => s.status === 'completed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const active = sessions.filter(s => s.status === 'active').length;

    const totalItemsSynced = sessions.reduce((sum, s) => sum + s.itemsSynced, 0);
    const totalConflicts = sessions.reduce((sum, s) => sum + s.conflictsDetected, 0);

    return {
      totalNodes: this.nodes.size,
      onlineNodes: this.getOnlineNodes().length,
      offlineNodes: this.nodes.size - this.getOnlineNodes().length,
      totalSessions: sessions.length,
      activeSessions: active,
      completedSessions: completed,
      failedSessions: failed,
      successRate: sessions.length > 0 ? (completed / sessions.length) * 100 : 0,
      totalItemsSynced,
      totalConflicts,
      averageConflictsPerSession: sessions.length > 0 ? totalConflicts / sessions.length : 0,
    };
  }

  /**
   * Get sync events
   */
  getSyncEvents(limit?: number): SyncEvent[] {
    const events = [...this.syncEvents];
    if (limit) {
      return events.slice(-limit);
    }
    return events;
  }

  /**
   * Get sync events for session
   */
  getSessionEvents(sessionId: string): SyncEvent[] {
    return this.syncEvents.filter(e => e.sessionId === sessionId);
  }

  /**
   * Check node health
   */
  getNodeHealth(): Record<string, { isHealthy: boolean; downtime: number }> {
    const health: Record<string, { isHealthy: boolean; downtime: number }> = {};

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
  startHeartbeatMonitoring(interval: number = 5000): void {
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

    logger.debug('[SyncCoordinator] Heartbeat monitoring started', { interval });
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;

      logger.debug('[SyncCoordinator] Heartbeat monitoring stopped');
    }
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.nodes.clear();
    this.sessions.clear();
    this.syncEvents = [];
    this.nodeHeartbeats.clear();
    this.stopHeartbeatMonitoring();
  }
}
