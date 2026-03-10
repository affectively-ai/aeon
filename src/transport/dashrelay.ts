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

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Wire Envelope
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Envelope for flow frames over DashRelay broadcast.
 *
 * Format (binary):
 *   [0]    u8   version (0x01)
 *   [1]    u8   flags (0x01 = directed, 0x02 = has-channel)
 *   [2-5]  u32  target peer ID length (0 if broadcast)
 *   [6-9]  u32  channel length (0 if no channel)
 *   [...] target peer ID bytes (if directed)
 *   [...] channel bytes (if has-channel)
 *   [...] flow frame payload
 */
const ENVELOPE_VERSION = 0x01;
const FLAG_DIRECTED = 0x01;
const FLAG_HAS_CHANNEL = 0x02;

function encodeEnvelope(
  payload: Uint8Array,
  targetPeerId?: string,
  channel?: string
): Uint8Array {
  const encoder = new TextEncoder();
  const targetBytes = targetPeerId ? encoder.encode(targetPeerId) : new Uint8Array(0);
  const channelBytes = channel ? encoder.encode(channel) : new Uint8Array(0);

  let flags = 0;
  if (targetPeerId) flags |= FLAG_DIRECTED;
  if (channel) flags |= FLAG_HAS_CHANNEL;

  const headerSize = 10; // version(1) + flags(1) + targetLen(4) + channelLen(4)
  const totalSize = headerSize + targetBytes.byteLength + channelBytes.byteLength + payload.byteLength;
  const envelope = new Uint8Array(totalSize);
  const view = new DataView(envelope.buffer);

  envelope[0] = ENVELOPE_VERSION;
  envelope[1] = flags;
  view.setUint32(2, targetBytes.byteLength, false);
  view.setUint32(6, channelBytes.byteLength, false);

  let offset = headerSize;
  envelope.set(targetBytes, offset);
  offset += targetBytes.byteLength;
  envelope.set(channelBytes, offset);
  offset += channelBytes.byteLength;
  envelope.set(payload, offset);

  return envelope;
}

function decodeEnvelope(data: Uint8Array): {
  target: string | null;
  channel: string | null;
  payload: Uint8Array;
} | null {
  if (data.byteLength < 10) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (data[0] !== ENVELOPE_VERSION) return null;

  const flags = data[1];
  const targetLen = view.getUint32(2, false);
  const channelLen = view.getUint32(6, false);

  const headerSize = 10;
  if (data.byteLength < headerSize + targetLen + channelLen) return null;

  const decoder = new TextDecoder();
  let offset = headerSize;

  const target = (flags & FLAG_DIRECTED)
    ? decoder.decode(data.subarray(offset, offset + targetLen))
    : null;
  offset += targetLen;

  const channel = (flags & FLAG_HAS_CHANNEL)
    ? decoder.decode(data.subarray(offset, offset + channelLen))
    : null;
  offset += channelLen;

  const payload = data.subarray(offset);

  return { target, channel, payload };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DashRelay FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════

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
export class DashRelayFlowTransport implements FlowTransport {
  private relay: DashRelayLike;
  private receiveHandler: ((data: Uint8Array) => void) | null = null;
  private closed = false;
  private config: DashRelayFlowConfig;
  private peerHandler: ((senderId: string, payload: Uint8Array) => void) | null = null;

  /** Connected peers observed via relay events */
  private peers = new Set<string>();
  private peerJoinHandler: ((peerId: string) => void) | null = null;
  private peerLeaveHandler: ((peerId: string) => void) | null = null;

  /** Optional handlers for peer lifecycle events */
  onPeerJoin: ((peerId: string) => void) | null = null;
  onPeerLeave: ((peerId: string) => void) | null = null;

  constructor(relay: DashRelayLike, config?: DashRelayFlowConfig) {
    this.relay = relay;
    this.config = config ?? {};

    // Wire up message handler
    this.peerHandler = (senderId: string, payload: Uint8Array) => {
      if (!this.receiveHandler) return;

      // Ignore own messages
      if (this.config.localPeerId && senderId === this.config.localPeerId) return;

      // Decode envelope
      const envelope = decodeEnvelope(payload);
      if (!envelope) return;

      // Check if directed to us
      if (envelope.target && this.config.localPeerId && envelope.target !== this.config.localPeerId) {
        return; // Not for us
      }

      // Check channel match
      if (this.config.channel && envelope.channel !== this.config.channel) {
        return; // Wrong channel
      }

      this.receiveHandler(envelope.payload);
    };

    relay.on('message', this.peerHandler);

    // Track peers
    this.peerJoinHandler = (peerId: string) => {
      this.peers.add(peerId);
      this.onPeerJoin?.(peerId);
    };

    this.peerLeaveHandler = (peerId: string) => {
      this.peers.delete(peerId);
      this.onPeerLeave?.(peerId);
    };

    relay.on('peerJoined', this.peerJoinHandler);
    relay.on('peerLeft', this.peerLeaveHandler);
  }

  // ─── FlowTransport interface ───────────────────────────────────────

  send(data: Uint8Array): void {
    if (this.closed) return;

    const envelope = encodeEnvelope(
      data,
      this.config.targetPeerId,
      this.config.channel
    );

    this.relay.broadcast(envelope);
  }

  onReceive(handler: (data: Uint8Array) => void): void {
    this.receiveHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.peerHandler) {
      this.relay.off('message', this.peerHandler);
    }
    if (this.peerJoinHandler) {
      this.relay.off('peerJoined', this.peerJoinHandler);
    }
    if (this.peerLeaveHandler) {
      this.relay.off('peerLeft', this.peerLeaveHandler);
    }

    this.receiveHandler = null;
    this.onPeerJoin = null;
    this.onPeerLeave = null;
  }

  // ─── Peer awareness ───────────────────────────────────────────────

  /** Get all known peers in the room */
  getPeers(): string[] {
    return Array.from(this.peers);
  }

  /** Number of peers in the room */
  get peerCount(): number {
    return this.peers.size;
  }

  /** Whether the transport is still open */
  get isOpen(): boolean {
    return !this.closed;
  }

  /** Send to a specific peer (overrides config.targetPeerId for this call) */
  sendTo(peerId: string, data: Uint8Array): void {
    if (this.closed) return;

    const envelope = encodeEnvelope(data, peerId, this.config.channel);
    this.relay.broadcast(envelope);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory: Create Flow over DashRelay room
// ═══════════════════════════════════════════════════════════════════════════════

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
export function createDashRelayFlow(
  relay: DashRelayLike,
  channel?: string,
  config?: Omit<DashRelayFlowConfig, 'channel'>
): DashRelayFlowTransport {
  return new DashRelayFlowTransport(relay, { ...config, channel });
}
