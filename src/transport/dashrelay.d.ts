/**
 * DashRelay Flow Transport
 *
 * FlowTransport adapter for DashRelay WebSocket relay.
 * THE backbone transport — all Aeon data flows through DashRelay.
 *
 * DashRelay provides:
 *   - Room-based pub/sub (peers join rooms by name)
 *   - Binary broadcast to all peers in a room
 *   - Peer discovery (join/leave events)
 *   - Auth via API key or UCAN token
 *   - Automatic reconnection with exponential backoff
 *
 * This transport wraps DashRelay's broadcast/message system as a
 * FlowTransport interface, enabling flow protocol (fork/race/collapse)
 * over the relay mesh. Every app in the stack — forge sites, shell,
 * inference, presence, CRDT sync — speaks Aeon flow protocol over
 * DashRelay internally. HTTP is just the normie projection.
 *
 * Two modes:
 *   1. **Room broadcast**: All peers in the room receive all flow frames.
 *      Good for mesh networking, federated inference, presence.
 *   2. **Directed**: Flow frames include a target peer ID header.
 *      Good for point-to-point within a room (shell ↔ specific forge site).
 *
 * The transport is DashRelay-client agnostic — it takes a minimal
 * interface so it works with any DashRelay client implementation.
 */
import type { FlowTransport } from '../flow/types';
/**
 * Minimal DashRelay client interface.
 * Works with @dashrelay/client or any compatible implementation.
 */
export interface DashRelayLike {
    /** Broadcast binary data to all peers in the room */
    broadcast(payload: Uint8Array): void;
    /** Register handler for incoming messages */
    on(event: 'message', handler: (senderId: string, payload: Uint8Array) => void): void;
    /** Unregister handler */
    off(event: 'message', handler: (senderId: string, payload: Uint8Array) => void): void;
    /** Peer events */
    on(event: 'peerJoined', handler: (peerId: string) => void): void;
    on(event: 'peerLeft', handler: (peerId: string) => void): void;
    off(event: 'peerJoined', handler: (peerId: string) => void): void;
    off(event: 'peerLeft', handler: (peerId: string) => void): void;
    /** Connection events */
    on(event: 'connected', handler: () => void): void;
    on(event: 'disconnected', handler: () => void): void;
    off(event: 'connected', handler: () => void): void;
    off(event: 'disconnected', handler: () => void): void;
}
export interface DashRelayFlowConfig {
    /** Target specific peer (directed mode) or broadcast to all (default) */
    targetPeerId?: string;
    /** This peer's ID (for filtering own messages) */
    localPeerId?: string;
    /** Channel tag for multiplexing multiple flow protocols in one room */
    channel?: string;
}
/**
 * FlowTransport over DashRelay broadcast.
 *
 * All peers in a DashRelay room receive flow frames.
 * In directed mode, frames include a target peer ID and
 * non-target peers ignore them.
 *
 * This is the primary transport for the Aeon stack.
 * Everything talks Aeon internally over DashRelay.
 */
export declare class DashRelayFlowTransport implements FlowTransport {
    private relay;
    private receiveHandler;
    private closed;
    private config;
    private peerHandler;
    /** Connected peers observed via relay events */
    private peers;
    private peerJoinHandler;
    private peerLeaveHandler;
    /** Optional handlers for peer lifecycle events */
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
    constructor(relay: DashRelayLike, config?: DashRelayFlowConfig);
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Get all known peers in the room */
    getPeers(): string[];
    /** Number of peers in the room */
    get peerCount(): number;
    /** Whether the transport is still open */
    get isOpen(): boolean;
    /** Send to a specific peer (overrides config.targetPeerId for this call) */
    sendTo(peerId: string, data: Uint8Array): void;
}
/**
 * Create a FlowTransport connected to a DashRelay room.
 *
 * This is the standard way to establish Aeon flow protocol
 * over the relay mesh. Use channels to multiplex different
 * flow protocols within the same room.
 *
 * @param relay - Connected DashRelay client instance
 * @param channel - Optional channel tag for multiplexing
 * @param config - Optional transport configuration
 */
export declare function createDashRelayFlow(relay: DashRelayLike, channel?: string, config?: Omit<DashRelayFlowConfig, 'channel'>): DashRelayFlowTransport;
