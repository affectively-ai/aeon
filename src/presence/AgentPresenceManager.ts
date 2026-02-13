/**
 * Agent Presence Manager (Phase 14)
 *
 * Tracks real-time presence of all agents in a session.
 * Provides status updates, cursor tracking, and activity monitoring.
 */

import { EventEmitter } from 'eventemitter3';
import { getLogger } from '../utils/logger';

const logger = getLogger();

// ============================================================================
// Types
// ============================================================================

export interface AgentPresence {
  agentId: string;
  name: string;
  role: 'user' | 'assistant' | 'monitor' | 'admin';
  status: 'online' | 'away' | 'offline' | 'reconnecting';
  joinedAt: string;
  lastSeen: string;
  cursorPosition?: { x: number; y: number; path: string };
  activeSection?: string;
  focusNode?: string;
  selectionRange?: AgentSelectionRange;
  typingState?: AgentTypingState;
  scrollState?: AgentScrollState;
  viewport?: AgentViewportState;
  inputState?: AgentInputState;
  emotionState?: AgentEmotionState;
  metadata?: Record<string, unknown>;
}

export interface AgentSelectionRange {
  start: number;
  end: number;
  direction?: 'forward' | 'backward' | 'none';
  path?: string;
}

export interface AgentTypingState {
  isTyping: boolean;
  field?: string;
  isComposing?: boolean;
  startedAt?: string;
  stoppedAt?: string;
}

export interface AgentScrollState {
  depth: number;
  y?: number;
  viewportHeight?: number;
  documentHeight?: number;
  path?: string;
}

export interface AgentViewportState {
  width: number;
  height: number;
}

export interface AgentInputState {
  field: string;
  hasFocus: boolean;
  valueLength?: number;
  selectionStart?: number;
  selectionEnd?: number;
  isComposing?: boolean;
  inputMode?: string;
}

export interface AgentEmotionState {
  primary?: string;
  secondary?: string;
  confidence?: number;
  intensity?: number;
  valence?: number;
  arousal?: number;
  dominance?: number;
  source?: 'self-report' | 'inferred' | 'sensor' | 'hybrid';
  updatedAt?: string;
}

export interface PresenceUpdate {
  agentId: string;
  changes: Partial<AgentPresence>;
  timestamp: string;
}

export interface PresenceEvents {
  presence_updated: (data: {
    agentId: string;
    presence: AgentPresence;
  }) => void;
  agent_joined: (data: { agentId: string; presence: AgentPresence }) => void;
  agent_left: (data: { agentId: string; presence: AgentPresence }) => void;
  cursor_updated: (data: {
    agentId: string;
    cursorPosition: { x: number; y: number; path: string };
  }) => void;
  section_updated: (data: { agentId: string; activeSection: string }) => void;
  focus_updated: (data: { agentId: string; focusNode: string }) => void;
  selection_updated: (data: {
    agentId: string;
    selectionRange: AgentSelectionRange;
  }) => void;
  typing_updated: (data: {
    agentId: string;
    typingState: AgentTypingState;
  }) => void;
  scroll_updated: (data: {
    agentId: string;
    scrollState: AgentScrollState;
  }) => void;
  viewport_updated: (data: {
    agentId: string;
    viewport: AgentViewportState;
  }) => void;
  input_state_updated: (data: {
    agentId: string;
    inputState?: AgentInputState;
  }) => void;
  emotion_updated: (data: {
    agentId: string;
    emotionState?: AgentEmotionState;
  }) => void;
  status_updated: (data: {
    agentId: string;
    status: AgentPresence['status'];
  }) => void;
}

// ============================================================================
// Agent Presence Manager
// ============================================================================

export class AgentPresenceManager extends EventEmitter<PresenceEvents> {
  private presences: Map<string, AgentPresence> = new Map();
  private sessionId: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout = 30000;
  private inactivityThreshold = 60000;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.startHeartbeatCheck();
    logger.debug('[AgentPresenceManager] Initialized', { sessionId });
  }

  /**
   * Add or update agent presence
   */
  updatePresence(
    agentId: string,
    presence: Omit<AgentPresence, 'joinedAt' | 'lastSeen'>,
  ): void {
    const existing = this.presences.get(agentId);
    const now = new Date().toISOString();

    const updated: AgentPresence = {
      ...existing,
      ...presence,
      agentId,
      joinedAt: existing?.joinedAt ?? now,
      lastSeen: now,
    };

    this.presences.set(agentId, updated);

    this.emit('presence_updated', {
      agentId,
      presence: updated,
    });
  }

  /**
   * Agent joined
   */
  agentJoined(
    agentId: string,
    name: string,
    role: AgentPresence['role'] = 'user',
    metadata?: Record<string, unknown>,
  ): void {
    const now = new Date().toISOString();

    const presence: AgentPresence = {
      agentId,
      name,
      role,
      status: 'online',
      joinedAt: now,
      lastSeen: now,
      metadata,
    };

    this.presences.set(agentId, presence);
    this.emit('agent_joined', { agentId, presence });

    logger.debug('[AgentPresenceManager] Agent joined', {
      agentId,
      name,
      role,
    });
  }

  /**
   * Agent left
   */
  agentLeft(agentId: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.status = 'offline';
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('agent_left', { agentId, presence });

      logger.debug('[AgentPresenceManager] Agent left', { agentId });
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(agentId: string, x: number, y: number, path: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.cursorPosition = { x, y, path };
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('cursor_updated', {
        agentId,
        cursorPosition: presence.cursorPosition,
      });
    }
  }

  /**
   * Update active section
   */
  updateActiveSection(agentId: string, section: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.activeSection = section;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('section_updated', {
        agentId,
        activeSection: section,
      });
    }
  }

  /**
   * Update focused node path
   */
  updateFocusNode(agentId: string, nodePath: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.focusNode = nodePath;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('focus_updated', {
        agentId,
        focusNode: nodePath,
      });
    }
  }

  /**
   * Update text selection range
   */
  updateSelection(agentId: string, selectionRange: AgentSelectionRange): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.selectionRange = selectionRange;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('selection_updated', {
        agentId,
        selectionRange,
      });
    }
  }

  /**
   * Update typing state
   */
  updateTyping(
    agentId: string,
    isTyping: boolean,
    field?: string,
    isComposing = false,
  ): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      const now = new Date().toISOString();
      const previous = presence.typingState;
      const typingState: AgentTypingState = {
        isTyping,
        field,
        isComposing,
        startedAt:
          isTyping && !previous?.isTyping
            ? now
            : isTyping
              ? previous?.startedAt
              : undefined,
        stoppedAt: isTyping ? undefined : now,
      };

      presence.typingState = typingState;
      presence.lastSeen = now;

      this.presences.set(agentId, presence);
      this.emit('typing_updated', {
        agentId,
        typingState,
      });
    }
  }

  /**
   * Update scroll state
   */
  updateScroll(agentId: string, scrollState: AgentScrollState): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.scrollState = {
        ...scrollState,
        depth: Math.max(0, Math.min(1, scrollState.depth)),
      };
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('scroll_updated', {
        agentId,
        scrollState: presence.scrollState,
      });
    }
  }

  /**
   * Update viewport size
   */
  updateViewport(agentId: string, width: number, height: number): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.viewport = { width, height };
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('viewport_updated', {
        agentId,
        viewport: presence.viewport,
      });
    }
  }

  /**
   * Update input state
   */
  updateInputState(agentId: string, inputState: AgentInputState): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.inputState = inputState;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('input_state_updated', {
        agentId,
        inputState,
      });
    }
  }

  /**
   * Clear input state
   */
  clearInputState(agentId: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.inputState = undefined;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('input_state_updated', {
        agentId,
        inputState: undefined,
      });
    }
  }

  /**
   * Update emotional state
   */
  updateEmotionState(
    agentId: string,
    emotionState: Omit<AgentEmotionState, 'updatedAt'>,
  ): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      const enrichedState: AgentEmotionState = {
        ...emotionState,
        updatedAt: new Date().toISOString(),
      };
      presence.emotionState = enrichedState;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('emotion_updated', {
        agentId,
        emotionState: enrichedState,
      });
    }
  }

  /**
   * Clear emotional state
   */
  clearEmotionState(agentId: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.emotionState = undefined;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('emotion_updated', {
        agentId,
        emotionState: undefined,
      });
    }
  }

  /**
   * Update status
   */
  updateStatus(agentId: string, status: AgentPresence['status']): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      presence.status = status;
      presence.lastSeen = new Date().toISOString();

      this.presences.set(agentId, presence);
      this.emit('status_updated', { agentId, status });
    }
  }

  /**
   * Heartbeat from agent (keeps them online)
   */
  heartbeat(agentId: string): void {
    const presence = this.presences.get(agentId);

    if (presence) {
      if (presence.status === 'reconnecting') {
        presence.status = 'online';
        this.emit('status_updated', { agentId, status: 'online' });
      }

      presence.lastSeen = new Date().toISOString();
      this.presences.set(agentId, presence);
    }
  }

  /**
   * Get presence for agent
   */
  getPresence(agentId: string): AgentPresence | undefined {
    return this.presences.get(agentId);
  }

  /**
   * Get all online agents
   */
  getOnlineAgents(): AgentPresence[] {
    return Array.from(this.presences.values()).filter(
      (p) => p.status === 'online',
    );
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentPresence[] {
    return Array.from(this.presences.values());
  }

  /**
   * Get all presences
   */
  getAllPresences(): AgentPresence[] {
    return Array.from(this.presences.values());
  }

  /**
   * Get agent count
   */
  getAgentCount(): Record<AgentPresence['status'], number> {
    const counts = {
      online: 0,
      away: 0,
      offline: 0,
      reconnecting: 0,
    };

    this.presences.forEach((p) => {
      counts[p.status]++;
    });

    return counts;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalAgents: this.presences.size,
      onlineAgents: Array.from(this.presences.values()).filter(
        (p) => p.status === 'online',
      ).length,
      offlineAgents: Array.from(this.presences.values()).filter(
        (p) => p.status === 'offline',
      ).length,
      awayAgents: Array.from(this.presences.values()).filter(
        (p) => p.status === 'away',
      ).length,
      reconnectingAgents: Array.from(this.presences.values()).filter(
        (p) => p.status === 'reconnecting',
      ).length,
    };
  }

  /**
   * Clear expired presences
   */
  clearExpiredPresences(maxAgeMs: number): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.presences.forEach((presence, agentId) => {
      const lastSeenTime = new Date(presence.lastSeen).getTime();
      const ageMs = now - lastSeenTime;

      if (ageMs > maxAgeMs && presence.status === 'offline') {
        toRemove.push(agentId);
      }
    });

    toRemove.forEach((agentId) => {
      this.presences.delete(agentId);
    });

    if (toRemove.length > 0) {
      logger.debug('[AgentPresenceManager] Cleared expired presences', {
        count: toRemove.length,
      });
    }
  }

  /**
   * Get agents by role
   */
  getByRole(role: AgentPresence['role']): AgentPresence[] {
    return Array.from(this.presences.values()).filter((p) => p.role === role);
  }

  /**
   * Get agents in active section
   */
  getInSection(section: string): AgentPresence[] {
    return Array.from(this.presences.values()).filter(
      (p) => p.activeSection === section && p.status === 'online',
    );
  }

  /**
   * Get presence timeline
   */
  getPresenceStats() {
    const stats = {
      total: this.presences.size,
      online: 0,
      away: 0,
      offline: 0,
      reconnecting: 0,
      byRole: {} as Record<string, number>,
    };

    this.presences.forEach((p) => {
      stats[p.status]++;
      stats.byRole[p.role] = (stats.byRole[p.role] ?? 0) + 1;
    });

    return stats;
  }

  /**
   * Start heartbeat check (mark inactive agents as away)
   */
  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.presences.forEach((presence) => {
        const lastSeenTime = new Date(presence.lastSeen).getTime();
        const timeSinceLastSeen = now - lastSeenTime;

        if (
          timeSinceLastSeen > this.inactivityThreshold &&
          presence.status === 'online'
        ) {
          presence.status = 'away';
          this.emit('status_updated', {
            agentId: presence.agentId,
            status: 'away',
          });
        }

        if (
          timeSinceLastSeen > this.heartbeatTimeout &&
          presence.status !== 'offline'
        ) {
          presence.status = 'reconnecting';
          this.emit('status_updated', {
            agentId: presence.agentId,
            status: 'reconnecting',
          });
        }
      });
    }, 10000);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clear all presences
   */
  clear(): void {
    this.presences.clear();
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.stopHeartbeatMonitoring();
    this.presences.clear();
    this.removeAllListeners();
    logger.debug('[AgentPresenceManager] Destroyed', {
      sessionId: this.sessionId,
    });
  }
}

// ============================================================================
// Singleton Instance Map
// ============================================================================

const instances = new Map<string, AgentPresenceManager>();

export function getAgentPresenceManager(
  sessionId: string,
): AgentPresenceManager {
  if (!instances.has(sessionId)) {
    instances.set(sessionId, new AgentPresenceManager(sessionId));
  }
  return instances.get(sessionId)!;
}

export function clearAgentPresenceManager(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (instance) {
    instance.destroy();
    instances.delete(sessionId);
  }
}
