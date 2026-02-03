import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentPresenceManager,
  getAgentPresenceManager,
  clearAgentPresenceManager,
} from '../../presence/AgentPresenceManager';

describe('Presence Module', () => {
  describe('AgentPresenceManager', () => {
    let manager: AgentPresenceManager;

    beforeEach(() => {
      manager = new AgentPresenceManager('test-session');
    });

    afterEach(() => {
      manager.destroy();
    });

    it('should add agent', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');

      const presence = manager.getPresence('agent-1');
      expect(presence).toBeDefined();
      expect(presence?.name).toBe('Alice');
      expect(presence?.role).toBe('user');
      expect(presence?.status).toBe('online');
    });

    it('should update presence', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');

      manager.updatePresence('agent-1', {
        agentId: 'agent-1',
        name: 'Alice Updated',
        role: 'admin',
        status: 'away',
      });

      const presence = manager.getPresence('agent-1');
      expect(presence?.name).toBe('Alice Updated');
      expect(presence?.role).toBe('admin');
      expect(presence?.status).toBe('away');
    });

    it('should mark agent as left', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentLeft('agent-1');

      const presence = manager.getPresence('agent-1');
      expect(presence?.status).toBe('offline');
    });

    it('should update cursor position', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.updateCursor('agent-1', 100, 200, '/document/section-1');

      const presence = manager.getPresence('agent-1');
      expect(presence?.cursorPosition).toEqual({
        x: 100,
        y: 200,
        path: '/document/section-1',
      });
    });

    it('should update active section', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.updateActiveSection('agent-1', 'section-2');

      const presence = manager.getPresence('agent-1');
      expect(presence?.activeSection).toBe('section-2');
    });

    it('should update status', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.updateStatus('agent-1', 'away');

      const presence = manager.getPresence('agent-1');
      expect(presence?.status).toBe('away');
    });

    it('should handle heartbeat', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.updateStatus('agent-1', 'reconnecting');

      manager.heartbeat('agent-1');

      const presence = manager.getPresence('agent-1');
      expect(presence?.status).toBe('online');
    });

    it('should get online agents', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');
      manager.agentLeft('agent-2');

      const online = manager.getOnlineAgents();
      expect(online.length).toBe(1);
      expect(online[0].agentId).toBe('agent-1');
    });

    it('should get all agents', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');

      const all = manager.getAllAgents();
      expect(all.length).toBe(2);
    });

    it('should get agent count by status', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');
      manager.updateStatus('agent-2', 'away');

      const counts = manager.getAgentCount();
      expect(counts.online).toBe(1);
      expect(counts.away).toBe(1);
    });

    it('should get agents by role', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bot', 'assistant');
      manager.agentJoined('agent-3', 'Admin', 'admin');

      const users = manager.getByRole('user');
      expect(users.length).toBe(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should get agents in section', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');
      manager.updateActiveSection('agent-1', 'section-1');
      manager.updateActiveSection('agent-2', 'section-2');

      const inSection = manager.getInSection('section-1');
      expect(inSection.length).toBe(1);
      expect(inSection[0].agentId).toBe('agent-1');
    });

    it('should get statistics', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');

      const stats = manager.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(2);
    });

    it('should get presence stats', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bot', 'assistant');

      const stats = manager.getPresenceStats();
      expect(stats.total).toBe(2);
      expect(stats.byRole['user']).toBe(1);
      expect(stats.byRole['assistant']).toBe(1);
    });

    it('should emit events', () => {
      let joinedAgent: unknown = null;

      manager.on('agent_joined', (data) => {
        joinedAgent = data;
      });

      manager.agentJoined('agent-1', 'Alice', 'user');

      expect(joinedAgent).toBeDefined();
    });

    it('should clear presences', () => {
      manager.agentJoined('agent-1', 'Alice', 'user');
      manager.agentJoined('agent-2', 'Bob', 'user');

      manager.clear();

      const all = manager.getAllAgents();
      expect(all.length).toBe(0);
    });
  });

  describe('Singleton factory', () => {
    afterEach(() => {
      clearAgentPresenceManager('session-1');
      clearAgentPresenceManager('session-2');
    });

    it('should return same instance for same session', () => {
      const m1 = getAgentPresenceManager('session-1');
      const m2 = getAgentPresenceManager('session-1');

      expect(m1).toBe(m2);
    });

    it('should return different instances for different sessions', () => {
      const m1 = getAgentPresenceManager('session-1');
      const m2 = getAgentPresenceManager('session-2');

      expect(m1).not.toBe(m2);
    });

    it('should clear instance', () => {
      const m1 = getAgentPresenceManager('session-1');
      clearAgentPresenceManager('session-1');
      const m2 = getAgentPresenceManager('session-1');

      expect(m1).not.toBe(m2);
    });
  });
});
