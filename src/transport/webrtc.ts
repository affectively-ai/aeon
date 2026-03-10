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

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// WebRTC FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FlowTransport over WebRTC DataChannel.
 *
 * Uses DashRelay WebSocket for signaling (offer/answer/ICE exchange),
 * then establishes a direct peer-to-peer DataChannel for binary
 * flow frame exchange.
 */
export class WebRTCFlowTransport implements FlowTransport {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private signalingWs: WebSocket | null = null;
  private receiveHandler: ((data: Uint8Array) => void) | null = null;
  private closed = false;
  private peerId: string;
  private config: WebRTCFlowConfig;
  private maxBufferedAmount: number;

  constructor(config: WebRTCFlowConfig) {
    this.config = config;
    this.peerId = config.peerId ?? crypto.randomUUID();
    this.maxBufferedAmount = config.maxBufferedAmount ?? 16 * 1024 * 1024;
  }

  /**
   * Initialize as the offering peer (initiator).
   * Connects to signaling, creates offer, waits for answer.
   */
  async offer(): Promise<void> {
    await this.connectSignaling();

    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // Create DataChannel
    const label = this.config.channelLabel ?? 'aeon-flow';
    this.dc = this.pc.createDataChannel(label, {
      ordered: true,
      protocol: 'aeon-flow',
    });
    this.dc.binaryType = 'arraybuffer';
    this.wireDataChannel(this.dc);

    // ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          from: this.peerId,
          to: '*',
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Create and send offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.sendSignaling({
      type: 'offer',
      from: this.peerId,
      to: '*',
      payload: offer,
    });
  }

  /**
   * Initialize as the answering peer (responder).
   * Waits for an offer, creates answer.
   */
  async answer(): Promise<void> {
    await this.connectSignaling();

    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers ?? [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          from: this.peerId,
          to: '*',
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Wait for incoming DataChannel
    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.dc.binaryType = 'arraybuffer';
      this.wireDataChannel(this.dc);
    };

    // Wait for offer via signaling
    // (handled in signaling message handler)
  }

  /**
   * Wait until the DataChannel is open and ready.
   */
  async waitForOpen(): Promise<void> {
    if (this.dc?.readyState === 'open') return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebRTC DataChannel open timeout'));
      }, 30_000);

      const check = () => {
        if (this.dc?.readyState === 'open') {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Poll — DataChannel events may have already fired
      const interval = setInterval(check, 100);
      check();

      // Also listen for the open event
      if (this.dc) {
        const onOpen = () => {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        };
        this.dc.addEventListener('open', onOpen, { once: true });
      }
    });
  }

  // ─── FlowTransport interface ───────────────────────────────────────

  send(data: Uint8Array): void {
    if (this.closed || !this.dc) return;

    if (this.dc.readyState !== 'open') return;

    // Backpressure: check buffered amount
    if (this.dc.bufferedAmount > this.maxBufferedAmount) {
      console.warn('[aeon-webrtc] DataChannel buffer full, dropping frame');
      return;
    }

    this.dc.send(data);
  }

  onReceive(handler: (data: Uint8Array) => void): void {
    this.receiveHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    this.dc?.close();
    this.pc?.close();
    this.signalingWs?.close();

    this.receiveHandler = null;
    this.dc = null;
    this.pc = null;
    this.signalingWs = null;
  }

  /** Whether the DataChannel is open */
  get isOpen(): boolean {
    return !this.closed && this.dc?.readyState === 'open';
  }

  /** Get this peer's ID */
  get id(): string {
    return this.peerId;
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private wireDataChannel(dc: RTCDataChannel): void {
    dc.onmessage = (event) => {
      if (!this.receiveHandler) return;

      if (event.data instanceof ArrayBuffer) {
        this.receiveHandler(new Uint8Array(event.data));
      }
    };

    dc.onclose = () => {
      this.closed = true;
      this.receiveHandler = null;
    };

    dc.onerror = () => {
      // Errors are followed by close
    };
  }

  private async connectSignaling(): Promise<void> {
    const url =
      this.config.signalingUrl ?? 'wss://relay.dashrelay.com/relay/sync';
    const roomUrl = `${url}?room=${encodeURIComponent(this.config.roomId)}&peer=${encodeURIComponent(this.peerId)}`;

    this.signalingWs = new WebSocket(roomUrl);

    await new Promise<void>((resolve, reject) => {
      const ws = this.signalingWs!;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Signaling connection failed'));
    });

    this.signalingWs.onmessage = async (event) => {
      try {
        const msg: SignalingMessage = JSON.parse(event.data);

        // Ignore own messages
        if (msg.from === this.peerId) return;

        switch (msg.type) {
          case 'offer': {
            if (!this.pc) return;
            const desc = msg.payload as RTCSessionDescriptionInit;
            await this.pc.setRemoteDescription(desc);
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.sendSignaling({
              type: 'answer',
              from: this.peerId,
              to: msg.from,
              payload: answer,
            });
            break;
          }

          case 'answer': {
            if (!this.pc) return;
            const desc = msg.payload as RTCSessionDescriptionInit;
            await this.pc.setRemoteDescription(desc);
            break;
          }

          case 'ice-candidate': {
            if (!this.pc) return;
            const candidate = msg.payload as RTCIceCandidateInit;
            await this.pc.addIceCandidate(candidate);
            break;
          }
        }
      } catch {
        // Ignore malformed signaling messages
      }
    };
  }

  private sendSignaling(msg: SignalingMessage): void {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(msg));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory: Create a peer-to-peer flow connection via DashRelay
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a flow protocol connection between two peers via WebRTC.
 *
 * Uses DashRelay for signaling, then establishes a direct P2P
 * DataChannel for binary flow frame exchange.
 *
 * @param roomId - Shared room ID for peer discovery
 * @param role - 'initiator' creates the offer, 'responder' waits
 */
export async function createP2PFlow(
  roomId: string,
  role: 'initiator' | 'responder',
  config?: Partial<WebRTCFlowConfig>
): Promise<WebRTCFlowTransport> {
  const transport = new WebRTCFlowTransport({ roomId, ...config });

  if (role === 'initiator') {
    await transport.offer();
  } else {
    await transport.answer();
  }

  await transport.waitForOpen();
  return transport;
}
