/**
 * WebRTC Flow Transport
 *
 * FlowTransport adapter for WebRTC DataChannel.
 * Enables flow protocol between browsers via DashRelay signaling —
 * the foundation for federated browser inference.
 *
 * Two devices open a DataChannel via DashRelay as the signaling layer,
 * then speak flow protocol directly peer-to-peer. The fork/race/collapse
 * primitives work across the mesh — inference forked to N peers,
 * fastest result wins.
 *
 * Binary-mode DataChannel: no base64, no JSON wrapping.
 */
import type { FlowTransport } from '../flow/types';
export interface WebRTCFlowConfig {
    /** DashRelay signaling URL (default: wss://relay.dashrelay.com) */
    signalingUrl?: string;
    /** Room ID for peer discovery */
    roomId: string;
    /** This peer's ID */
    peerId?: string;
    /** ICE servers (default: Google STUN) */
    iceServers?: RTCIceServer[];
    /** DataChannel label */
    channelLabel?: string;
    /** Max buffered amount before backpressure (default: 16MB) */
    maxBufferedAmount?: number;
}
export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate';
    from: string;
    to: string;
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}
/**
 * FlowTransport over WebRTC DataChannel.
 *
 * Uses DashRelay WebSocket for signaling (offer/answer/ICE exchange),
 * then establishes a direct peer-to-peer DataChannel for binary
 * flow frame exchange.
 */
export declare class WebRTCFlowTransport implements FlowTransport {
    private pc;
    private dc;
    private signalingWs;
    private receiveHandler;
    private closed;
    private peerId;
    private config;
    private maxBufferedAmount;
    constructor(config: WebRTCFlowConfig);
    /**
     * Initialize as the offering peer (initiator).
     * Connects to signaling, creates offer, waits for answer.
     */
    offer(): Promise<void>;
    /**
     * Initialize as the answering peer (responder).
     * Waits for an offer, creates answer.
     */
    answer(): Promise<void>;
    /**
     * Wait until the DataChannel is open and ready.
     */
    waitForOpen(): Promise<void>;
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether the DataChannel is open */
    get isOpen(): boolean;
    /** Get this peer's ID */
    get id(): string;
    private wireDataChannel;
    private connectSignaling;
    private sendSignaling;
}
/**
 * Create a flow protocol connection between two peers via WebRTC.
 *
 * Uses DashRelay for signaling, then establishes a direct P2P
 * DataChannel for binary flow frame exchange.
 *
 * @param roomId - Shared room ID for peer discovery
 * @param role - 'initiator' creates the offer, 'responder' waits
 */
export declare function createP2PFlow(roomId: string, role: 'initiator' | 'responder', config?: Partial<WebRTCFlowConfig>): Promise<WebRTCFlowTransport>;
