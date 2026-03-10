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
// Agent Presence Manager
// ============================================================================
export class AgentPresenceManager extends EventEmitter {
    presences = new Map();
    sessionId;
    heartbeatInterval = null;
    heartbeatTimeout = 30000;
    inactivityThreshold = 60000;
    constructor(sessionId) {
        super();
        this.sessionId = sessionId;
        this.startHeartbeatCheck();
        logger.debug('[AgentPresenceManager] Initialized', { sessionId });
    }
    /**
     * Add or update agent presence
     */
    updatePresence(agentId, presence) {
        const existing = this.presences.get(agentId);
        const now = new Date().toISOString();
        const updated = {
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
    agentJoined(agentId, name, role = 'user', metadata) {
        const now = new Date().toISOString();
        const presence = {
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
    agentLeft(agentId) {
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
    updateCursor(agentId, x, y, path) {
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
    updateActiveSection(agentId, section) {
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
    updateFocusNode(agentId, nodePath) {
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
    updateSelection(agentId, selectionRange) {
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
    updateTyping(agentId, isTyping, field, isComposing = false) {
        const presence = this.presences.get(agentId);
        if (presence) {
            const now = new Date().toISOString();
            const previous = presence.typingState;
            const typingState = {
                isTyping,
                field,
                isComposing,
                startedAt: isTyping && !previous?.isTyping
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
    updateScroll(agentId, scrollState) {
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
    updateViewport(agentId, width, height) {
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
    updateInputState(agentId, inputState) {
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
    clearInputState(agentId) {
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
    updateEmotionState(agentId, emotionState) {
        const presence = this.presences.get(agentId);
        if (presence) {
            const enrichedState = {
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
    clearEmotionState(agentId) {
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
    updateStatus(agentId, status) {
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
    heartbeat(agentId) {
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
    getPresence(agentId) {
        return this.presences.get(agentId);
    }
    /**
     * Get all online agents
     */
    getOnlineAgents() {
        return Array.from(this.presences.values()).filter((p) => p.status === 'online');
    }
    /**
     * Get all agents
     */
    getAllAgents() {
        return Array.from(this.presences.values());
    }
    /**
     * Get all presences
     */
    getAllPresences() {
        return Array.from(this.presences.values());
    }
    /**
     * Get agent count
     */
    getAgentCount() {
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
            onlineAgents: Array.from(this.presences.values()).filter((p) => p.status === 'online').length,
            offlineAgents: Array.from(this.presences.values()).filter((p) => p.status === 'offline').length,
            awayAgents: Array.from(this.presences.values()).filter((p) => p.status === 'away').length,
            reconnectingAgents: Array.from(this.presences.values()).filter((p) => p.status === 'reconnecting').length,
        };
    }
    /**
     * Clear expired presences
     */
    clearExpiredPresences(maxAgeMs) {
        const now = Date.now();
        const toRemove = [];
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
    getByRole(role) {
        return Array.from(this.presences.values()).filter((p) => p.role === role);
    }
    /**
     * Get agents in active section
     */
    getInSection(section) {
        return Array.from(this.presences.values()).filter((p) => p.activeSection === section && p.status === 'online');
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
            byRole: {},
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
    startHeartbeatCheck() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            this.presences.forEach((presence) => {
                const lastSeenTime = new Date(presence.lastSeen).getTime();
                const timeSinceLastSeen = now - lastSeenTime;
                if (timeSinceLastSeen > this.inactivityThreshold &&
                    presence.status === 'online') {
                    presence.status = 'away';
                    this.emit('status_updated', {
                        agentId: presence.agentId,
                        status: 'away',
                    });
                }
                if (timeSinceLastSeen > this.heartbeatTimeout &&
                    presence.status !== 'offline') {
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
    stopHeartbeatMonitoring() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Clear all presences
     */
    clear() {
        this.presences.clear();
    }
    /**
     * Destroy the manager
     */
    destroy() {
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
const instances = new Map();
export function getAgentPresenceManager(sessionId) {
    if (!instances.has(sessionId)) {
        instances.set(sessionId, new AgentPresenceManager(sessionId));
    }
    return instances.get(sessionId);
}
export function clearAgentPresenceManager(sessionId) {
    const instance = instances.get(sessionId);
    if (instance) {
        instance.destroy();
        instances.delete(sessionId);
    }
}
