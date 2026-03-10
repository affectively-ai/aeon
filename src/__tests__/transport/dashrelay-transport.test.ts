import { describe, it, expect, vi } from 'vitest';
import { DashRelayFlowTransport, createDashRelayFlow } from '../../transport/dashrelay';
import type { DashRelayLike } from '../../transport/dashrelay';

// ═══════════════════════════════════════════════════════════════════════════════
// Mock DashRelay
// ═══════════════════════════════════════════════════════════════════════════════

function createMockRelay(): {
  relay: DashRelayLike;
  simulateMessage: (senderId: string, payload: Uint8Array) => void;
  simulatePeerJoin: (peerId: string) => void;
  simulatePeerLeave: (peerId: string) => void;
  broadcasts: Uint8Array[];
} {
  const handlers: Record<string, Set<(...args: unknown[]) => void>> = {};
  const broadcasts: Uint8Array[] = [];

  const relay: DashRelayLike = {
    broadcast: (payload: Uint8Array) => {
      broadcasts.push(new Uint8Array(payload));
    },
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers[event]) handlers[event] = new Set();
      handlers[event].add(handler);
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      handlers[event]?.delete(handler);
    },
  };

  return {
    relay,
    simulateMessage: (senderId: string, payload: Uint8Array) => {
      for (const handler of handlers['message'] ?? []) {
        handler(senderId, payload);
      }
    },
    simulatePeerJoin: (peerId: string) => {
      for (const handler of handlers['peerJoined'] ?? []) {
        handler(peerId);
      }
    },
    simulatePeerLeave: (peerId: string) => {
      for (const handler of handlers['peerLeft'] ?? []) {
        handler(peerId);
      }
    },
    broadcasts,
  };
}

/**
 * Create a minimal DashRelay envelope matching the transport's wire format.
 */
function createEnvelope(
  payload: Uint8Array,
  target?: string,
  channel?: string
): Uint8Array {
  const encoder = new TextEncoder();
  const targetBytes = target ? encoder.encode(target) : new Uint8Array(0);
  const channelBytes = channel ? encoder.encode(channel) : new Uint8Array(0);

  let flags = 0;
  if (target) flags |= 0x01;
  if (channel) flags |= 0x02;

  const headerSize = 10;
  const totalSize = headerSize + targetBytes.byteLength + channelBytes.byteLength + payload.byteLength;
  const envelope = new Uint8Array(totalSize);
  const view = new DataView(envelope.buffer);

  envelope[0] = 0x01; // version
  envelope[1] = flags;
  view.setUint32(2, targetBytes.byteLength, false);
  view.setUint32(6, channelBytes.byteLength, false);

  let offset = headerSize;
  envelope.set(targetBytes, offset); offset += targetBytes.byteLength;
  envelope.set(channelBytes, offset); offset += channelBytes.byteLength;
  envelope.set(payload, offset);

  return envelope;
}

describe('DashRelay FlowTransport', () => {
  describe('broadcast mode', () => {
    it('should send enveloped data via broadcast', () => {
      const { relay, broadcasts } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      transport.send(new TextEncoder().encode('hello'));

      expect(broadcasts.length).toBe(1);
      // Verify it's wrapped in an envelope (starts with version byte 0x01)
      expect(broadcasts[0][0]).toBe(0x01);

      transport.close();
    });

    it('should receive and unwrap broadcast messages', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { localPeerId: 'me' });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      // Simulate another peer sending an enveloped message
      const envelope = createEnvelope(new TextEncoder().encode('from peer'));
      simulateMessage('peer-1', envelope);

      expect(received).toEqual(['from peer']);
      transport.close();
    });

    it('should ignore own messages', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { localPeerId: 'me' });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      // Simulate own message echoed back
      const envelope = createEnvelope(new TextEncoder().encode('my own'));
      simulateMessage('me', envelope);

      expect(received.length).toBe(0);
      transport.close();
    });
  });

  describe('directed mode', () => {
    it('should accept messages directed to us', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { localPeerId: 'me' });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      const envelope = createEnvelope(new TextEncoder().encode('for me'), 'me');
      simulateMessage('peer-1', envelope);

      expect(received).toEqual(['for me']);
      transport.close();
    });

    it('should ignore messages directed to other peers', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { localPeerId: 'me' });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      const envelope = createEnvelope(new TextEncoder().encode('not for me'), 'someone-else');
      simulateMessage('peer-1', envelope);

      expect(received.length).toBe(0);
      transport.close();
    });

    it('should send directed messages with target peer ID', () => {
      const { relay, broadcasts } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { targetPeerId: 'peer-2' });

      transport.send(new TextEncoder().encode('directed'));

      expect(broadcasts.length).toBe(1);
      // Verify directed flag is set
      expect(broadcasts[0][1] & 0x01).toBe(0x01);

      transport.close();
    });
  });

  describe('channel multiplexing', () => {
    it('should filter by channel', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, {
        localPeerId: 'me',
        channel: 'inference',
      });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      // Message on our channel
      const right = createEnvelope(new TextEncoder().encode('right channel'), undefined, 'inference');
      simulateMessage('peer-1', right);

      // Message on wrong channel
      const wrong = createEnvelope(new TextEncoder().encode('wrong channel'), undefined, 'deploy');
      simulateMessage('peer-1', wrong);

      expect(received).toEqual(['right channel']);
      transport.close();
    });

    it('should include channel in outgoing messages', () => {
      const { relay, broadcasts } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { channel: 'sync' });

      transport.send(new TextEncoder().encode('channeled'));

      expect(broadcasts.length).toBe(1);
      // Verify channel flag is set
      expect(broadcasts[0][1] & 0x02).toBe(0x02);

      transport.close();
    });
  });

  describe('peer tracking', () => {
    it('should track peer joins', () => {
      const { relay, simulatePeerJoin } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      expect(transport.peerCount).toBe(0);

      simulatePeerJoin('peer-1');
      simulatePeerJoin('peer-2');

      expect(transport.peerCount).toBe(2);
      expect(transport.getPeers()).toContain('peer-1');
      expect(transport.getPeers()).toContain('peer-2');

      transport.close();
    });

    it('should track peer leaves', () => {
      const { relay, simulatePeerJoin, simulatePeerLeave } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      simulatePeerJoin('peer-1');
      simulatePeerJoin('peer-2');
      expect(transport.peerCount).toBe(2);

      simulatePeerLeave('peer-1');
      expect(transport.peerCount).toBe(1);
      expect(transport.getPeers()).toEqual(['peer-2']);

      transport.close();
    });

    it('should fire peer lifecycle callbacks', () => {
      const { relay, simulatePeerJoin, simulatePeerLeave } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);
      const events: string[] = [];

      transport.onPeerJoin = (id) => events.push(`join:${id}`);
      transport.onPeerLeave = (id) => events.push(`leave:${id}`);

      simulatePeerJoin('peer-1');
      simulatePeerLeave('peer-1');

      expect(events).toEqual(['join:peer-1', 'leave:peer-1']);

      transport.close();
    });
  });

  describe('sendTo (directed send)', () => {
    it('should send to a specific peer', () => {
      const { relay, broadcasts } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      transport.sendTo('target-peer', new TextEncoder().encode('directed'));

      expect(broadcasts.length).toBe(1);
      // Should have directed flag
      expect(broadcasts[0][1] & 0x01).toBe(0x01);

      transport.close();
    });
  });

  describe('createDashRelayFlow factory', () => {
    it('should create a transport with channel', () => {
      const { relay } = createMockRelay();
      const transport = createDashRelayFlow(relay, 'inference');

      expect(transport).toBeInstanceOf(DashRelayFlowTransport);
      expect(transport.isOpen).toBe(true);

      transport.close();
    });
  });

  describe('lifecycle', () => {
    it('should not receive after close', () => {
      const { relay, simulateMessage } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay, { localPeerId: 'me' });
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      transport.close();

      const envelope = createEnvelope(new TextEncoder().encode('late'));
      simulateMessage('peer-1', envelope);

      expect(received.length).toBe(0);
    });

    it('should not send after close', () => {
      const { relay, broadcasts } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      transport.close();
      transport.send(new TextEncoder().encode('should not send'));

      expect(broadcasts.length).toBe(0);
    });

    it('should report isOpen correctly', () => {
      const { relay } = createMockRelay();
      const transport = new DashRelayFlowTransport(relay);

      expect(transport.isOpen).toBe(true);
      transport.close();
      expect(transport.isOpen).toBe(false);
    });
  });
});
