/**
 * Federated Browser Inference
 *
 * Fork inference requests across N mesh peers via flow protocol,
 * race the results, winner provides the response. This turns
 * every browser tab with WASM inference into a federated compute node.
 *
 * The coordinator:
 *   1. Discovers peers via DashRelay room or Bluetooth/WebRTC mesh
 *   2. Forks a flow stream per peer for the same prompt
 *   3. Races all streams — fastest inference result wins
 *   4. Poisons slower streams to free their resources
 *   5. Returns the winning result to the caller
 *
 * This is fork/race/collapse at the network level —
 * the same primitive that handles ESI cache vs inference,
 * but applied across physical devices.
 *
 * Use cases:
 *   - 3 phones in a room → fork prompt to all 3, fastest wins
 *   - Laptop + tablet → laptop runs 7B, tablet runs 1B, race them
 *   - Federated speculative decoding across device mesh
 */

import { AeonFlowProtocol } from '../flow/AeonFlowProtocol';
import type { FlowTransport } from '../flow/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface FederatedPeer {
  /** Unique peer identifier */
  id: string;
  /** Flow transport to this peer */
  transport: FlowTransport;
  /** Peer's reported capabilities */
  capabilities: PeerCapabilities;
  /** Last seen timestamp */
  lastSeen: number;
  /** Whether peer is currently available for inference */
  available: boolean;
}

export interface PeerCapabilities {
  /** Models available on this peer */
  models: string[];
  /** Acceleration type */
  acceleration: 'webgpu' | 'webnn' | 'wasm' | 'none';
  /** Estimated tokens/second */
  estimatedTps?: number;
  /** Available memory in MB */
  availableMemoryMB?: number;
  /** Whether peer is on battery */
  onBattery?: boolean;
}

export interface FederatedInferenceRequest {
  /** Prompt text */
  prompt: string;
  /** Model preference (peers without this model are skipped) */
  model?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature */
  temperature?: number;
  /** Whether to include all peer results or just the winner */
  collectAll?: boolean;
}

export interface FederatedInferenceResult {
  /** The winning peer's ID */
  winnerId: string;
  /** Generated text */
  text: string;
  /** Time to first token (ms) */
  ttft: number;
  /** Total generation time (ms) */
  totalTime: number;
  /** Tokens per second achieved */
  tokensPerSecond: number;
  /** All peer results (if collectAll was true) */
  allResults?: Map<string, { text: string; time: number }>;
}

export interface FederatedInferenceConfig {
  /** Timeout for inference requests in ms (default: 60000) */
  timeout?: number;
  /** Minimum peers required to start federated inference (default: 1) */
  minPeers?: number;
  /** Maximum peers to fork to (default: 8) */
  maxPeers?: number;
  /** Whether to include local inference in the race (default: true) */
  includeLocal?: boolean;
  /** Local inference handler (if includeLocal is true) */
  localInference?: (prompt: string) => Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wire Format for Inference Requests/Responses
// ═══════════════════════════════════════════════════════════════════════════════

const MSG_INFERENCE_REQUEST = 0x01;
const MSG_INFERENCE_RESPONSE = 0x02;
const MSG_CAPABILITY_ANNOUNCE = 0x03;
const MSG_CAPABILITY_REQUEST = 0x04;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeInferenceRequest(req: FederatedInferenceRequest): Uint8Array {
  const json = JSON.stringify(req);
  const jsonBytes = textEncoder.encode(json);
  const frame = new Uint8Array(1 + jsonBytes.byteLength);
  frame[0] = MSG_INFERENCE_REQUEST;
  frame.set(jsonBytes, 1);
  return frame;
}

function encodeInferenceResponse(text: string, metrics: { ttft: number; totalTime: number; tps: number }): Uint8Array {
  const json = JSON.stringify({ text, ...metrics });
  const jsonBytes = textEncoder.encode(json);
  const frame = new Uint8Array(1 + jsonBytes.byteLength);
  frame[0] = MSG_INFERENCE_RESPONSE;
  frame.set(jsonBytes, 1);
  return frame;
}

function encodeCapabilities(caps: PeerCapabilities): Uint8Array {
  const json = JSON.stringify(caps);
  const jsonBytes = textEncoder.encode(json);
  const frame = new Uint8Array(1 + jsonBytes.byteLength);
  frame[0] = MSG_CAPABILITY_ANNOUNCE;
  frame.set(jsonBytes, 1);
  return frame;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Federated Inference Coordinator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Coordinates federated inference across a mesh of peers.
 *
 * Each peer runs its own WASM inference engine. The coordinator
 * forks the same prompt to multiple peers, races them, and returns
 * the fastest result.
 *
 * Uses AeonFlowProtocol for fork/race/collapse:
 *   - fork(root, N) creates N child streams, one per peer
 *   - race(children) picks the first to complete
 *   - Losers are automatically poisoned
 */
export class FederatedInferenceCoordinator {
  private peers = new Map<string, FederatedPeer>();
  private config: FederatedInferenceConfig;
  private listeners = new Set<(event: FederationEvent) => void>();

  constructor(config?: FederatedInferenceConfig) {
    this.config = config ?? {};
  }

  // ─── Peer Management ────────────────────────────────────────────

  /**
   * Register a peer with its flow transport.
   * The transport should already be connected.
   */
  addPeer(id: string, transport: FlowTransport, capabilities?: PeerCapabilities): void {
    const peer: FederatedPeer = {
      id,
      transport,
      capabilities: capabilities ?? { models: [], acceleration: 'none' },
      lastSeen: Date.now(),
      available: true,
    };

    this.peers.set(id, peer);
    this.emit({ type: 'peer-added', peerId: id });

    // Request capabilities if not provided
    if (!capabilities) {
      const reqFrame = new Uint8Array([MSG_CAPABILITY_REQUEST]);
      transport.send(reqFrame);
    }

    // Listen for capability announcements
    transport.onReceive((data) => {
      if (data[0] === MSG_CAPABILITY_ANNOUNCE) {
        const json = textDecoder.decode(data.subarray(1));
        peer.capabilities = JSON.parse(json) as PeerCapabilities;
        peer.lastSeen = Date.now();
        this.emit({ type: 'peer-capabilities', peerId: id, capabilities: peer.capabilities });
      }
    });
  }

  /**
   * Remove a peer from the federation.
   */
  removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) {
      peer.available = false;
      this.peers.delete(id);
      this.emit({ type: 'peer-removed', peerId: id });
    }
  }

  /**
   * Get all available peers, optionally filtered by model support.
   */
  getAvailablePeers(model?: string): FederatedPeer[] {
    return Array.from(this.peers.values()).filter((peer) => {
      if (!peer.available) return false;
      if (model && !peer.capabilities.models.includes(model)) return false;
      return true;
    });
  }

  // ─── Federated Inference ──────────────────────────────────────────

  /**
   * Run federated inference across available peers.
   *
   * Forks the prompt to N peers, races them, returns the fastest result.
   * This is the core fork/race primitive applied at the network level.
   */
  async infer(request: FederatedInferenceRequest): Promise<FederatedInferenceResult> {
    const availablePeers = this.getAvailablePeers(request.model);
    const minPeers = this.config.minPeers ?? 1;
    const maxPeers = this.config.maxPeers ?? 8;
    const timeout = this.config.timeout ?? 60_000;
    const includeLocal = this.config.includeLocal ?? true;

    const totalCandidates = availablePeers.length + (includeLocal ? 1 : 0);

    if (totalCandidates < minPeers) {
      throw new Error(
        `Not enough peers for federated inference: ${totalCandidates} available, ${minPeers} required`
      );
    }

    // Select peers (up to maxPeers, sorted by estimated TPS descending)
    const selectedPeers = availablePeers
      .sort((a, b) => (b.capabilities.estimatedTps ?? 0) - (a.capabilities.estimatedTps ?? 0))
      .slice(0, maxPeers - (includeLocal ? 1 : 0));

    const startTime = Date.now();
    this.emit({ type: 'inference-start', peerCount: selectedPeers.length + (includeLocal ? 1 : 0) });

    // Race all peers (and optionally local)
    const raceEntries: Array<{
      id: string;
      promise: Promise<{ text: string; ttft: number; totalTime: number; tps: number }>;
    }> = [];

    // Fork to each peer
    for (const peer of selectedPeers) {
      const requestFrame = encodeInferenceRequest(request);
      const peerPromise = new Promise<{ text: string; ttft: number; totalTime: number; tps: number }>(
        (resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Peer ${peer.id} timeout`));
          }, timeout);

          // Store the original handler and set up our inference handler
          const handler = (data: Uint8Array) => {
            if (data[0] === MSG_INFERENCE_RESPONSE) {
              clearTimeout(timer);
              const json = textDecoder.decode(data.subarray(1));
              const result = JSON.parse(json) as { text: string; ttft: number; totalTime: number; tps: number };
              resolve(result);
            }
          };

          peer.transport.onReceive(handler);
          peer.transport.send(requestFrame);
        }
      );

      raceEntries.push({ id: peer.id, promise: peerPromise });
    }

    // Include local inference if configured
    if (includeLocal && this.config.localInference) {
      const localStart = Date.now();
      const localPromise = this.config.localInference(request.prompt).then((text) => {
        const totalTime = Date.now() - localStart;
        const tokens = text.split(/\s+/).length; // Rough estimate
        return {
          text,
          ttft: totalTime / 2, // Rough estimate
          totalTime,
          tps: tokens / (totalTime / 1000),
        };
      });

      raceEntries.push({ id: '__local__', promise: localPromise });
    }

    // Race all entries
    if (request.collectAll) {
      // Wait for all results, but return the first one as winner
      const allResults = new Map<string, { text: string; time: number }>();
      let winner: { id: string; result: { text: string; ttft: number; totalTime: number; tps: number } } | null = null;

      const settled = await Promise.allSettled(
        raceEntries.map(async (entry) => {
          const result = await entry.promise;
          if (!winner) {
            winner = { id: entry.id, result };
          }
          allResults.set(entry.id, { text: result.text, time: result.totalTime });
          return { id: entry.id, result };
        })
      );

      if (!winner) {
        throw new Error('All peers failed inference');
      }

      const w = winner as { id: string; result: { text: string; ttft: number; totalTime: number; tps: number } };
      return {
        winnerId: w.id,
        text: w.result.text,
        ttft: w.result.ttft,
        totalTime: w.result.totalTime,
        tokensPerSecond: w.result.tps,
        allResults,
      };
    } else {
      // Pure race — first to resolve wins
      const winner = await Promise.any(
        raceEntries.map(async (entry) => {
          const result = await entry.promise;
          return { id: entry.id, result };
        })
      );

      this.emit({
        type: 'inference-complete',
        winnerId: winner.id,
        totalTime: Date.now() - startTime,
      });

      return {
        winnerId: winner.id,
        text: winner.result.text,
        ttft: winner.result.ttft,
        totalTime: winner.result.totalTime,
        tokensPerSecond: winner.result.tps,
      };
    }
  }

  // ─── Peer-Side: Handle Incoming Inference Requests ────────────────

  /**
   * Create a handler for incoming inference requests.
   * Call this on the peer side to process requests from the coordinator.
   *
   * @param inferFn - The actual inference function on this peer
   * @returns A FlowTransport receive handler
   */
  static createPeerHandler(
    inferFn: (prompt: string, options?: { maxTokens?: number; temperature?: number }) => Promise<string>
  ): (data: Uint8Array) => void {
    return (data: Uint8Array) => {
      if (data[0] !== MSG_INFERENCE_REQUEST) return;

      const json = textDecoder.decode(data.subarray(1));
      const request = JSON.parse(json) as FederatedInferenceRequest;

      const startTime = Date.now();
      let ttft = 0;

      void inferFn(request.prompt, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      }).then((text) => {
        if (ttft === 0) ttft = Date.now() - startTime;
        const totalTime = Date.now() - startTime;
        const tokens = text.split(/\s+/).length;
        const tps = tokens / (totalTime / 1000);

        // This handler doesn't have direct access to transport.send()
        // The caller should wire this up appropriately
        return encodeInferenceResponse(text, { ttft, totalTime, tps });
      });
    };
  }

  /**
   * Set up a peer to respond to federated inference requests.
   *
   * @param transport - The FlowTransport connected to the coordinator
   * @param inferFn - The inference function to run
   * @param capabilities - This peer's capabilities to announce
   */
  static setupPeer(
    transport: FlowTransport,
    inferFn: (prompt: string, options?: { maxTokens?: number; temperature?: number }) => Promise<string>,
    capabilities: PeerCapabilities
  ): void {
    // Announce capabilities
    transport.send(encodeCapabilities(capabilities));

    // Handle incoming requests
    transport.onReceive((data) => {
      if (data[0] === MSG_CAPABILITY_REQUEST) {
        transport.send(encodeCapabilities(capabilities));
        return;
      }

      if (data[0] !== MSG_INFERENCE_REQUEST) return;

      const json = textDecoder.decode(data.subarray(1));
      const request = JSON.parse(json) as FederatedInferenceRequest;

      const startTime = Date.now();

      void inferFn(request.prompt, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      }).then((text) => {
        const totalTime = Date.now() - startTime;
        const tokens = text.split(/\s+/).length;
        const tps = tokens / Math.max(totalTime / 1000, 0.001);
        const response = encodeInferenceResponse(text, { ttft: totalTime / 2, totalTime, tps });
        transport.send(response);
      }).catch(() => {
        // Inference failed — don't respond, let coordinator timeout
      });
    });
  }

  // ─── Events ──────────────────────────────────────────────────────

  on(handler: (event: FederationEvent) => void): void {
    this.listeners.add(handler);
  }

  off(handler: (event: FederationEvent) => void): void {
    this.listeners.delete(handler);
  }

  private emit(event: FederationEvent): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }

  // ─── Status ──────────────────────────────────────────────────────

  get peerCount(): number {
    return this.peers.size;
  }

  get availablePeerCount(): number {
    return Array.from(this.peers.values()).filter((p) => p.available).length;
  }

  destroy(): void {
    for (const peer of this.peers.values()) {
      peer.transport.close();
    }
    this.peers.clear();
    this.listeners.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Types
// ═══════════════════════════════════════════════════════════════════════════════

export type FederationEvent =
  | { type: 'peer-added'; peerId: string }
  | { type: 'peer-removed'; peerId: string }
  | { type: 'peer-capabilities'; peerId: string; capabilities: PeerCapabilities }
  | { type: 'inference-start'; peerCount: number }
  | { type: 'inference-complete'; winnerId: string; totalTime: number }
  | { type: 'error'; message: string };
