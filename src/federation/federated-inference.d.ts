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
import type { FlowTransport } from '../flow/types';
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
    allResults?: Map<string, {
        text: string;
        time: number;
    }>;
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
export declare class FederatedInferenceCoordinator {
    private peers;
    private config;
    private listeners;
    constructor(config?: FederatedInferenceConfig);
    /**
     * Register a peer with its flow transport.
     * The transport should already be connected.
     */
    addPeer(id: string, transport: FlowTransport, capabilities?: PeerCapabilities): void;
    /**
     * Remove a peer from the federation.
     */
    removePeer(id: string): void;
    /**
     * Get all available peers, optionally filtered by model support.
     */
    getAvailablePeers(model?: string): FederatedPeer[];
    /**
     * Run federated inference across available peers.
     *
     * Forks the prompt to N peers, races them, returns the fastest result.
     * This is the core fork/race primitive applied at the network level.
     */
    infer(request: FederatedInferenceRequest): Promise<FederatedInferenceResult>;
    /**
     * Create a handler for incoming inference requests.
     * Call this on the peer side to process requests from the coordinator.
     *
     * @param inferFn - The actual inference function on this peer
     * @returns A FlowTransport receive handler
     */
    static createPeerHandler(inferFn: (prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }) => Promise<string>): (data: Uint8Array) => void;
    /**
     * Set up a peer to respond to federated inference requests.
     *
     * @param transport - The FlowTransport connected to the coordinator
     * @param inferFn - The inference function to run
     * @param capabilities - This peer's capabilities to announce
     */
    static setupPeer(transport: FlowTransport, inferFn: (prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }) => Promise<string>, capabilities: PeerCapabilities): void;
    on(handler: (event: FederationEvent) => void): void;
    off(handler: (event: FederationEvent) => void): void;
    private emit;
    get peerCount(): number;
    get availablePeerCount(): number;
    destroy(): void;
}
export type FederationEvent = {
    type: 'peer-added';
    peerId: string;
} | {
    type: 'peer-removed';
    peerId: string;
} | {
    type: 'peer-capabilities';
    peerId: string;
    capabilities: PeerCapabilities;
} | {
    type: 'inference-start';
    peerCount: number;
} | {
    type: 'inference-complete';
    winnerId: string;
    totalTime: number;
} | {
    type: 'error';
    message: string;
};
