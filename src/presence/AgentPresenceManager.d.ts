/**
 * Agent Presence Manager (Phase 14)
 *
 * Tracks real-time presence of all agents in a session.
 * Provides status updates, cursor tracking, and activity monitoring.
 */
import { EventEmitter } from 'eventemitter3';
export interface AgentPresence {
    agentId: string;
    name: string;
    role: 'user' | 'assistant' | 'monitor' | 'admin';
    status: 'online' | 'away' | 'offline' | 'reconnecting';
    joinedAt: string;
    lastSeen: string;
    cursorPosition?: {
        x: number;
        y: number;
        path?: string;
    };
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
    agent_joined: (data: {
        agentId: string;
        presence: AgentPresence;
    }) => void;
    agent_left: (data: {
        agentId: string;
        presence: AgentPresence;
    }) => void;
    cursor_updated: (data: {
        agentId: string;
        cursorPosition: {
            x: number;
            y: number;
            path?: string;
        };
    }) => void;
    section_updated: (data: {
        agentId: string;
        activeSection: string;
    }) => void;
    focus_updated: (data: {
        agentId: string;
        focusNode: string;
    }) => void;
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
export declare class AgentPresenceManager extends EventEmitter<PresenceEvents> {
    private presences;
    private sessionId;
    private heartbeatInterval;
    private heartbeatTimeout;
    private inactivityThreshold;
    constructor(sessionId: string);
    /**
     * Add or update agent presence
     */
    updatePresence(agentId: string, presence: Omit<AgentPresence, 'joinedAt' | 'lastSeen'>): void;
    /**
     * Agent joined
     */
    agentJoined(agentId: string, name: string, role?: AgentPresence['role'], metadata?: Record<string, unknown>): void;
    /**
     * Agent left
     */
    agentLeft(agentId: string): void;
    /**
     * Update cursor position
     */
    updateCursor(agentId: string, x: number, y: number, path?: string): void;
    /**
     * Update active section
     */
    updateActiveSection(agentId: string, section: string): void;
    /**
     * Update focused node path
     */
    updateFocusNode(agentId: string, nodePath: string): void;
    /**
     * Update text selection range
     */
    updateSelection(agentId: string, selectionRange: AgentSelectionRange): void;
    /**
     * Update typing state
     */
    updateTyping(agentId: string, isTyping: boolean, field?: string, isComposing?: boolean): void;
    /**
     * Update scroll state
     */
    updateScroll(agentId: string, scrollState: AgentScrollState): void;
    /**
     * Update viewport size
     */
    updateViewport(agentId: string, width: number, height: number): void;
    /**
     * Update input state
     */
    updateInputState(agentId: string, inputState: AgentInputState): void;
    /**
     * Clear input state
     */
    clearInputState(agentId: string): void;
    /**
     * Update emotional state
     */
    updateEmotionState(agentId: string, emotionState: Omit<AgentEmotionState, 'updatedAt'>): void;
    /**
     * Clear emotional state
     */
    clearEmotionState(agentId: string): void;
    /**
     * Update status
     */
    updateStatus(agentId: string, status: AgentPresence['status']): void;
    /**
     * Heartbeat from agent (keeps them online)
     */
    heartbeat(agentId: string): void;
    /**
     * Get presence for agent
     */
    getPresence(agentId: string): AgentPresence | undefined;
    /**
     * Get all online agents
     */
    getOnlineAgents(): AgentPresence[];
    /**
     * Get all agents
     */
    getAllAgents(): AgentPresence[];
    /**
     * Get all presences
     */
    getAllPresences(): AgentPresence[];
    /**
     * Get agent count
     */
    getAgentCount(): Record<AgentPresence['status'], number>;
    /**
     * Get statistics
     */
    getStats(): {
        totalAgents: number;
        onlineAgents: number;
        offlineAgents: number;
        awayAgents: number;
        reconnectingAgents: number;
    };
    /**
     * Clear expired presences
     */
    clearExpiredPresences(maxAgeMs: number): void;
    /**
     * Get agents by role
     */
    getByRole(role: AgentPresence['role']): AgentPresence[];
    /**
     * Get agents in active section
     */
    getInSection(section: string): AgentPresence[];
    /**
     * Get presence timeline
     */
    getPresenceStats(): {
        total: number;
        online: number;
        away: number;
        offline: number;
        reconnecting: number;
        byRole: Record<string, number>;
    };
    /**
     * Start heartbeat check (mark inactive agents as away)
     */
    private startHeartbeatCheck;
    /**
     * Stop heartbeat monitoring
     */
    stopHeartbeatMonitoring(): void;
    /**
     * Clear all presences
     */
    clear(): void;
    /**
     * Destroy the manager
     */
    destroy(): void;
}
export declare function getAgentPresenceManager(sessionId: string): AgentPresenceManager;
export declare function clearAgentPresenceManager(sessionId: string): void;
