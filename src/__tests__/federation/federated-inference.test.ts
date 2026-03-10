import { describe, it, expect, vi } from 'vitest';
import { FederatedInferenceCoordinator } from '../../federation/federated-inference';
import type { PeerCapabilities, FederationEvent } from '../../federation/federated-inference';
import type { FlowTransport } from '../../flow/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Transport
// ═══════════════════════════════════════════════════════════════════════════════

function createMockPeerTransport(): {
  transport: FlowTransport;
  simulateReceive: (data: Uint8Array) => void;
  sent: Uint8Array[];
} {
  let handler: ((data: Uint8Array) => void) | null = null;
  const sent: Uint8Array[] = [];

  const transport: FlowTransport = {
    send: (data) => { sent.push(new Uint8Array(data)); },
    onReceive: (h) => { handler = h; },
    close: () => { handler = null; },
  };

  return {
    transport,
    simulateReceive: (data) => handler?.(data),
    sent,
  };
}

/**
 * Create a mock inference response matching the wire format.
 */
function createInferenceResponse(text: string): Uint8Array {
  const json = JSON.stringify({
    text,
    ttft: 100,
    totalTime: 500,
    tps: 10,
  });
  const jsonBytes = new TextEncoder().encode(json);
  const frame = new Uint8Array(1 + jsonBytes.byteLength);
  frame[0] = 0x02; // MSG_INFERENCE_RESPONSE
  frame.set(jsonBytes, 1);
  return frame;
}

describe('FederatedInferenceCoordinator', () => {
  describe('peer management', () => {
    it('should add and remove peers', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport } = createMockPeerTransport();

      coordinator.addPeer('peer-1', transport, { models: ['llama-7b'], acceleration: 'wasm' });
      expect(coordinator.peerCount).toBe(1);

      coordinator.removePeer('peer-1');
      expect(coordinator.peerCount).toBe(0);

      coordinator.destroy();
    });

    it('should emit events on peer add/remove', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport } = createMockPeerTransport();
      const events: FederationEvent[] = [];

      coordinator.on((e) => events.push(e));
      coordinator.addPeer('peer-1', transport, { models: [], acceleration: 'none' });
      coordinator.removePeer('peer-1');

      expect(events.map((e) => e.type)).toEqual(['peer-added', 'peer-removed']);
      coordinator.destroy();
    });

    it('should filter peers by model', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport: t1 } = createMockPeerTransport();
      const { transport: t2 } = createMockPeerTransport();

      coordinator.addPeer('peer-1', t1, { models: ['llama-7b'], acceleration: 'wasm' });
      coordinator.addPeer('peer-2', t2, { models: ['gemma-1b'], acceleration: 'wasm' });

      const llama = coordinator.getAvailablePeers('llama-7b');
      expect(llama.length).toBe(1);
      expect(llama[0].id).toBe('peer-1');

      const all = coordinator.getAvailablePeers();
      expect(all.length).toBe(2);

      coordinator.destroy();
    });

    it('should request capabilities from peers without them', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport, sent } = createMockPeerTransport();

      coordinator.addPeer('peer-1', transport); // No capabilities

      // Should have sent a capability request (0x04)
      expect(sent.length).toBe(1);
      expect(sent[0][0]).toBe(0x04);

      coordinator.destroy();
    });
  });

  describe('federated inference', () => {
    it('should race peers and return the fastest result', async () => {
      const coordinator = new FederatedInferenceCoordinator({ timeout: 5000 });
      const { transport: t1, simulateReceive: sim1 } = createMockPeerTransport();
      const { transport: t2, simulateReceive: sim2 } = createMockPeerTransport();

      coordinator.addPeer('fast', t1, { models: ['llama-7b'], acceleration: 'wasm', estimatedTps: 20 });
      coordinator.addPeer('slow', t2, { models: ['llama-7b'], acceleration: 'wasm', estimatedTps: 5 });

      // Start inference
      const resultPromise = coordinator.infer({ prompt: 'Hello world' });

      // Simulate fast peer responding first
      await new Promise((r) => setTimeout(r, 10));
      sim1(createInferenceResponse('fast response'));

      const result = await resultPromise;

      expect(result.winnerId).toBe('fast');
      expect(result.text).toBe('fast response');
      expect(result.tokensPerSecond).toBeGreaterThan(0);

      coordinator.destroy();
    });

    it('should handle peer timeout gracefully', async () => {
      const coordinator = new FederatedInferenceCoordinator({ timeout: 100 });
      const { transport: t1, simulateReceive: sim1 } = createMockPeerTransport();
      const { transport: t2 } = createMockPeerTransport(); // Never responds

      coordinator.addPeer('responsive', t1, { models: [], acceleration: 'none' });
      coordinator.addPeer('silent', t2, { models: [], acceleration: 'none' });

      const resultPromise = coordinator.infer({ prompt: 'test' });

      // Only responsive peer answers
      await new Promise((r) => setTimeout(r, 10));
      sim1(createInferenceResponse('I answered'));

      const result = await resultPromise;
      expect(result.winnerId).toBe('responsive');
      expect(result.text).toBe('I answered');

      coordinator.destroy();
    });

    it('should include local inference in the race', async () => {
      const coordinator = new FederatedInferenceCoordinator({
        includeLocal: true,
        localInference: async (prompt) => `local: ${prompt}`,
      });

      const { transport: t1 } = createMockPeerTransport(); // Never responds

      coordinator.addPeer('slow-peer', t1, { models: [], acceleration: 'none' });

      const result = await coordinator.infer({ prompt: 'hello' });

      expect(result.winnerId).toBe('__local__');
      expect(result.text).toBe('local: hello');

      coordinator.destroy();
    });

    it('should fail if not enough peers', async () => {
      const coordinator = new FederatedInferenceCoordinator({ minPeers: 3, includeLocal: false });

      await expect(
        coordinator.infer({ prompt: 'test' })
      ).rejects.toThrow('Not enough peers');

      coordinator.destroy();
    });

    it('should respect maxPeers limit', async () => {
      const coordinator = new FederatedInferenceCoordinator({
        maxPeers: 2,
        includeLocal: false,
        timeout: 200,
      });

      const peers: ReturnType<typeof createMockPeerTransport>[] = [];
      for (let i = 0; i < 5; i++) {
        const peer = createMockPeerTransport();
        peers.push(peer);
        coordinator.addPeer(`peer-${i}`, peer.transport, {
          models: [],
          acceleration: 'none',
          estimatedTps: 10 - i, // Higher TPS = higher priority
        });
      }

      const resultPromise = coordinator.infer({ prompt: 'test' });

      // First 2 peers (highest TPS) should receive requests
      await new Promise((r) => setTimeout(r, 10));

      // Only peer-0 and peer-1 should have received requests
      // (maxPeers=2, sorted by TPS descending)
      expect(peers[0].sent.length).toBeGreaterThan(0);
      expect(peers[1].sent.length).toBeGreaterThan(0);
      expect(peers[2].sent.length).toBe(0);

      // Respond from peer-0
      peers[0].simulateReceive(createInferenceResponse('from top peer'));

      const result = await resultPromise;
      expect(result.text).toBe('from top peer');

      coordinator.destroy();
    });
  });

  describe('setupPeer', () => {
    it('should respond to inference requests', async () => {
      const { transport, simulateReceive, sent } = createMockPeerTransport();

      FederatedInferenceCoordinator.setupPeer(
        transport,
        async (prompt) => `response to: ${prompt}`,
        { models: ['test-model'], acceleration: 'wasm' }
      );

      // Should have sent capabilities
      expect(sent.length).toBe(1);
      expect(sent[0][0]).toBe(0x03); // MSG_CAPABILITY_ANNOUNCE

      // Simulate incoming inference request
      const request = { prompt: 'hello', maxTokens: 100 };
      const json = new TextEncoder().encode(JSON.stringify(request));
      const frame = new Uint8Array(1 + json.byteLength);
      frame[0] = 0x01; // MSG_INFERENCE_REQUEST
      frame.set(json, 1);
      simulateReceive(frame);

      // Wait for async inference
      await new Promise((r) => setTimeout(r, 50));

      // Should have sent response
      expect(sent.length).toBe(2);
      expect(sent[1][0]).toBe(0x02); // MSG_INFERENCE_RESPONSE

      const responseJson = JSON.parse(new TextDecoder().decode(sent[1].subarray(1)));
      expect(responseJson.text).toBe('response to: hello');
    });

    it('should respond to capability requests', () => {
      const { transport, simulateReceive, sent } = createMockPeerTransport();

      FederatedInferenceCoordinator.setupPeer(
        transport,
        async () => 'test',
        { models: ['llama-7b'], acceleration: 'webgpu', estimatedTps: 30 }
      );

      // Initial capability announce
      expect(sent.length).toBe(1);

      // Simulate capability request
      simulateReceive(new Uint8Array([0x04])); // MSG_CAPABILITY_REQUEST

      // Should have sent capabilities again
      expect(sent.length).toBe(2);
      expect(sent[1][0]).toBe(0x03);

      const caps = JSON.parse(new TextDecoder().decode(sent[1].subarray(1)));
      expect(caps.models).toEqual(['llama-7b']);
      expect(caps.acceleration).toBe('webgpu');
      expect(caps.estimatedTps).toBe(30);
    });
  });

  describe('coordinator lifecycle', () => {
    it('should clean up on destroy', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport: t1 } = createMockPeerTransport();
      const { transport: t2 } = createMockPeerTransport();

      coordinator.addPeer('p1', t1, { models: [], acceleration: 'none' });
      coordinator.addPeer('p2', t2, { models: [], acceleration: 'none' });

      expect(coordinator.peerCount).toBe(2);

      coordinator.destroy();

      expect(coordinator.peerCount).toBe(0);
    });

    it('should track available vs total peers', () => {
      const coordinator = new FederatedInferenceCoordinator();
      const { transport: t1 } = createMockPeerTransport();
      const { transport: t2 } = createMockPeerTransport();

      coordinator.addPeer('p1', t1, { models: [], acceleration: 'none' });
      coordinator.addPeer('p2', t2, { models: [], acceleration: 'none' });

      expect(coordinator.peerCount).toBe(2);
      expect(coordinator.availablePeerCount).toBe(2);

      coordinator.removePeer('p1');
      expect(coordinator.peerCount).toBe(1);
      expect(coordinator.availablePeerCount).toBe(1);

      coordinator.destroy();
    });
  });
});
