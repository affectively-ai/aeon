/**
 * UDP Flow Transport — Zero Head-of-Line Blocking
 *
 * Aeon Flow works over UDP. The 10-byte header is self-describing —
 * stream_id + sequence in every frame means frames can arrive out of
 * order and be reassembled. No TCP head-of-line blocking.
 *
 * This is the same insight as QUIC (HTTP/3) — but with 10-byte frames
 * instead of QUIC's more complex framing. No TLS ceremony (WASM
 * inference doesn't need it). No connection setup (first datagram IS
 * data). No head-of-line blocking (each stream reassembles independently).
 *
 * Reliability layer:
 *   - ACK bitmaps: receiver sends periodic ACK frames with a bitmap
 *     of received sequences. Compact: 8 bytes covers 64 contiguous seqs.
 *   - Selective retransmit: sender retransmits only missing frames,
 *     not the entire window (like TCP SACK but simpler).
 *   - Congestion window: simple AIMD (additive-increase multiplicative-
 *     decrease) like TCP Reno but per-stream.
 *
 * MTU handling:
 *   - Flow frames > MTU are fragmented into MTU-sized UDP datagrams.
 *   - Each fragment carries: [frag_header:4][flow_frame_chunk]
 *   - Fragment header: [frame_id:u16][frag_index:u8][frag_total:u8]
 *   - Max 255 fragments × 1400 bytes = ~350 KB per flow frame over UDP.
 *   - Most flow frames are <1400 bytes (10-byte header + small payload).
 *     Large payloads (16MB) are rare and better served over WebSocket.
 *
 * Environment support:
 *   - Node.js/Bun: native dgram module
 *   - Cloudflare Workers: connect() API (Cloudflare's UDP socket support)
 *   - Browser: WebTransport (HTTP/3) provides UDP-like unreliable datagrams
 *
 * Usage:
 *   const transport = new UDPFlowTransport({ host: '0.0.0.0', port: 4242 });
 *   const protocol = new AeonFlowProtocol(transport, { role: 'server' });
 */

import type { FlowTransport } from './types';
import { FlowCodec, HEADER_SIZE } from './FlowCodec';
import { FrameReassembler } from './frame-reassembler';
import type { FlowFrame } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Safe MTU for UDP datagrams (1500 Ethernet - 20 IP - 8 UDP) */
export const UDP_MTU = 1472;

/** Fragment header size: [frame_id:u16][frag_index:u8][frag_total:u8] */
export const FRAGMENT_HEADER_SIZE = 4;

/** Max payload per UDP datagram after fragment header */
export const MAX_FRAGMENT_PAYLOAD = UDP_MTU - FRAGMENT_HEADER_SIZE;

/** ACK frame flag — not a real flow flag, internal to UDP transport */
export const ACK_FLAG = 0x80;

/** How often to send ACK bitmaps (ms) */
const ACK_INTERVAL_MS = 50;

/** How long before retransmitting an unacked frame (ms) */
const RETRANSMIT_TIMEOUT_MS = 200;

/** Initial congestion window (frames) */
const INITIAL_CWND = 16;

/** Max congestion window (frames) */
const MAX_CWND = 256;

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface UDPFlowTransportConfig {
  /** Local bind address */
  host: string;
  /** Local bind port */
  port: number;
  /** Remote host (for client mode) */
  remoteHost?: string;
  /** Remote port (for client mode) */
  remotePort?: number;
  /** MTU override (default: 1472) */
  mtu?: number;
  /** Enable reliability (ACKs + retransmit). Default: true */
  reliable?: boolean;
  /** Reassembler config overrides */
  reassembler?: {
    maxBufferPerStream?: number;
    maxStreams?: number;
    maxGap?: number;
  };
}

/** Sent frame awaiting acknowledgment */
interface InflightFrame {
  data: Uint8Array;
  streamId: number;
  sequence: number;
  sentAt: number;
  retransmits: number;
}

/** ACK bitmap: acknowledges sequences [baseSeq .. baseSeq+63] */
interface AckBitmap {
  streamId: number;
  baseSeq: number;
  /** 64-bit bitmap as two u32s */
  bitmapHi: number;
  bitmapLo: number;
}

/** Fragment reassembly state */
interface FragmentGroup {
  frameId: number;
  total: number;
  received: Map<number, Uint8Array>;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UDP Flow Transport
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UDP-based FlowTransport implementation.
 *
 * Implements the FlowTransport interface over UDP datagrams with:
 *   - MTU-safe fragmentation/reassembly
 *   - Out-of-order frame reassembly (via FrameReassembler)
 *   - Optional reliability (ACK bitmaps + selective retransmit)
 *   - Simple AIMD congestion control
 *
 * The same AeonFlowProtocol instance works unchanged — it just sees
 * frames arriving (possibly out of order, which the reassembler fixes).
 */
export class UDPFlowTransport implements FlowTransport {
  private config: Required<UDPFlowTransportConfig>;
  private receiveHandler: ((data: Uint8Array) => void) | null = null;
  private closed = false;

  // UDP socket (set by bind/connect)
  private socket: UDPSocket | null = null;

  // Frame reassembly (out-of-order)
  private reassembler: FrameReassembler;

  // Fragment reassembly (MTU splitting)
  private fragmentGroups = new Map<number, FragmentGroup>();
  private nextFrameId = 0;

  // Reliability: inflight tracking
  private inflight = new Map<string, InflightFrame>();

  // Reliability: ACK state
  private receivedPerStream = new Map<number, Set<number>>();
  private ackTimer: ReturnType<typeof setInterval> | null = null;
  private retransmitTimer: ReturnType<typeof setInterval> | null = null;

  // Congestion control
  private cwnd = INITIAL_CWND;
  private inflightCount = 0;

  // Flow codec for ACK frame encoding
  private codec = FlowCodec.createSync();

  constructor(config: UDPFlowTransportConfig) {
    this.config = {
      host: config.host,
      port: config.port,
      remoteHost: config.remoteHost ?? '',
      remotePort: config.remotePort ?? 0,
      mtu: config.mtu ?? UDP_MTU,
      reliable: config.reliable ?? true,
      reassembler: config.reassembler ?? {},
    };

    this.reassembler = new FrameReassembler(this.config.reassembler);
  }

  /**
   * Bind and start the UDP transport.
   *
   * In server mode (no remoteHost), listens for incoming datagrams.
   * In client mode, binds and sets the remote endpoint.
   */
  async bind(): Promise<void> {
    this.socket = await createUDPSocket(this.config.host, this.config.port);

    this.socket.onMessage((data: Uint8Array, rinfo: RemoteInfo) => {
      if (this.closed) return;

      // Remember remote for server mode
      if (!this.config.remoteHost && rinfo.address) {
        this.config.remoteHost = rinfo.address;
        this.config.remotePort = rinfo.port;
      }

      this.handleDatagram(data);
    });

    // Start ACK and retransmit timers if reliable
    if (this.config.reliable) {
      this.ackTimer = setInterval(() => this.sendAcks(), ACK_INTERVAL_MS);
      this.retransmitTimer = setInterval(() => this.retransmitLost(), RETRANSMIT_TIMEOUT_MS);
    }
  }

  // ─── FlowTransport interface ───────────────────────────────────────────

  send(data: Uint8Array): void {
    if (this.closed || !this.socket) return;

    // Congestion control: don't exceed window
    if (this.config.reliable && this.inflightCount >= this.cwnd) {
      // Drop — backpressure. Protocol layer will handle via highWaterMark.
      return;
    }

    const maxPayload = this.config.mtu - FRAGMENT_HEADER_SIZE;

    if (data.length <= maxPayload) {
      // Fits in one datagram — no fragmentation needed
      const frameId = this.nextFrameId++ & 0xFFFF;
      const datagram = this.wrapFragment(frameId, 0, 1, data);
      this.sendDatagram(datagram);
      this.trackInflight(data, frameId);
    } else {
      // Fragment into MTU-sized chunks
      const frameId = this.nextFrameId++ & 0xFFFF;
      const totalFragments = Math.ceil(data.length / maxPayload);

      if (totalFragments > 255) {
        // Too large for UDP fragmentation — caller should use WebSocket
        // for payloads > ~350KB
        return;
      }

      for (let i = 0; i < totalFragments; i++) {
        const start = i * maxPayload;
        const end = Math.min(start + maxPayload, data.length);
        const chunk = data.slice(start, end);
        const datagram = this.wrapFragment(frameId, i, totalFragments, chunk);
        this.sendDatagram(datagram);
      }
      this.trackInflight(data, frameId);
    }
  }

  onReceive(handler: (data: Uint8Array) => void): void {
    this.receiveHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.ackTimer) clearInterval(this.ackTimer);
    if (this.retransmitTimer) clearInterval(this.retransmitTimer);

    this.socket?.close();
    this.socket = null;
    this.receiveHandler = null;
    this.inflight.clear();
    this.fragmentGroups.clear();
    this.reassembler.reset();
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  /** Get reassembly statistics */
  getReassemblerStats() {
    return this.reassembler.getStats();
  }

  /** Current congestion window size */
  get congestionWindow(): number {
    return this.cwnd;
  }

  /** Number of frames in flight (unacked) */
  get framesInFlight(): number {
    return this.inflightCount;
  }

  // ─── Internal: datagram handling ───────────────────────────────────────

  /**
   * Handle an incoming UDP datagram.
   *
   * Datagram format:
   *   [frame_id:u16][frag_index:u8][frag_total:u8][payload...]
   */
  private handleDatagram(data: Uint8Array): void {
    if (data.length < FRAGMENT_HEADER_SIZE) return;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const frameId = view.getUint16(0);
    const fragIndex = data[2];
    const fragTotal = data[3];
    const payload = data.subarray(FRAGMENT_HEADER_SIZE);

    if (fragTotal === 1) {
      // Single fragment — no reassembly needed
      this.handleReassembledFrame(payload);
    } else {
      // Multi-fragment — reassemble
      this.handleFragment(frameId, fragIndex, fragTotal, payload);
    }
  }

  /**
   * Handle a fragment of a multi-datagram flow frame.
   */
  private handleFragment(
    frameId: number,
    fragIndex: number,
    fragTotal: number,
    payload: Uint8Array
  ): void {
    let group = this.fragmentGroups.get(frameId);
    if (!group) {
      group = {
        frameId,
        total: fragTotal,
        received: new Map(),
        createdAt: Date.now(),
      };
      this.fragmentGroups.set(frameId, group);
    }

    group.received.set(fragIndex, payload.slice()); // slice to own the data

    // Check if complete
    if (group.received.size === group.total) {
      // Reassemble in order
      let totalLen = 0;
      for (let i = 0; i < group.total; i++) {
        totalLen += group.received.get(i)!.length;
      }

      const reassembled = new Uint8Array(totalLen);
      let offset = 0;
      for (let i = 0; i < group.total; i++) {
        const frag = group.received.get(i)!;
        reassembled.set(frag, offset);
        offset += frag.length;
      }

      this.fragmentGroups.delete(frameId);
      this.handleReassembledFrame(reassembled);
    }

    // Clean up stale fragment groups (>5 seconds old)
    if (this.fragmentGroups.size > 100) {
      const cutoff = Date.now() - 5000;
      for (const [id, g] of this.fragmentGroups) {
        if (g.createdAt < cutoff) {
          this.fragmentGroups.delete(id);
        }
      }
    }
  }

  /**
   * Handle a complete (reassembled) flow frame.
   * This is where we do out-of-order reassembly using the stream_id + sequence.
   */
  private handleReassembledFrame(data: Uint8Array): void {
    // Check if this is an ACK frame (internal to UDP transport)
    if (data.length >= HEADER_SIZE) {
      const flags = data[6];
      if (flags & ACK_FLAG) {
        this.handleAck(data);
        return;
      }
    }

    // Decode the flow frame to get stream_id + sequence for reassembly
    let frame: FlowFrame;
    try {
      const result = this.codec.decode(data);
      frame = result.frame;
    } catch {
      return; // Malformed
    }

    // Track received sequence for ACK generation
    if (this.config.reliable) {
      let seqSet = this.receivedPerStream.get(frame.streamId);
      if (!seqSet) {
        seqSet = new Set();
        this.receivedPerStream.set(frame.streamId, seqSet);
      }
      seqSet.add(frame.sequence);
    }

    // Push through the reassembler for ordering
    const deliverable = this.reassembler.push(frame);

    // Deliver ordered frames to the protocol layer
    for (const orderedFrame of deliverable) {
      // Re-encode to binary for the FlowTransport interface
      // (the protocol layer expects raw bytes it can decode itself)
      const encoded = this.codec.encode(orderedFrame);
      if (this.receiveHandler) {
        this.receiveHandler(encoded);
      }
    }
  }

  // ─── Internal: fragmentation ───────────────────────────────────────────

  /**
   * Wrap a flow frame chunk in a fragment header.
   */
  private wrapFragment(
    frameId: number,
    fragIndex: number,
    fragTotal: number,
    payload: Uint8Array
  ): Uint8Array {
    const datagram = new Uint8Array(FRAGMENT_HEADER_SIZE + payload.length);
    const view = new DataView(datagram.buffer);
    view.setUint16(0, frameId);
    datagram[2] = fragIndex;
    datagram[3] = fragTotal;
    datagram.set(payload, FRAGMENT_HEADER_SIZE);
    return datagram;
  }

  /**
   * Send a UDP datagram to the remote endpoint.
   */
  private sendDatagram(data: Uint8Array): void {
    if (!this.socket || !this.config.remoteHost) return;
    this.socket.send(data, this.config.remoteHost, this.config.remotePort);
  }

  // ─── Internal: reliability ─────────────────────────────────────────────

  /**
   * Track a sent frame for potential retransmission.
   */
  private trackInflight(data: Uint8Array, frameId: number): void {
    if (!this.config.reliable) return;

    // Extract stream_id and sequence from the flow frame
    if (data.length < HEADER_SIZE) return;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const streamId = view.getUint16(0);
    const sequence = view.getUint32(2);

    const key = `${streamId}:${sequence}`;
    this.inflight.set(key, {
      data: data.slice(),
      streamId,
      sequence,
      sentAt: Date.now(),
      retransmits: 0,
    });

    this.inflightCount++;
  }

  /**
   * Handle an incoming ACK frame.
   *
   * ACK payload format:
   *   [stream_id:u16][base_seq:u32][bitmap_hi:u32][bitmap_lo:u32]
   *   (can repeat for multiple streams)
   */
  private handleAck(data: Uint8Array): void {
    // Skip the 10-byte flow header
    const payload = data.subarray(HEADER_SIZE);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    for (let offset = 0; offset + 14 <= payload.length; offset += 14) {
      const streamId = view.getUint16(offset);
      const baseSeq = view.getUint32(offset + 2);
      const bitmapHi = view.getUint32(offset + 6);
      const bitmapLo = view.getUint32(offset + 10);

      // Check each bit in the bitmap
      for (let bit = 0; bit < 64; bit++) {
        const seq = baseSeq + bit;
        const isAcked = bit < 32
          ? (bitmapLo & (1 << bit)) !== 0
          : (bitmapHi & (1 << (bit - 32))) !== 0;

        if (isAcked) {
          const key = `${streamId}:${seq}`;
          if (this.inflight.has(key)) {
            this.inflight.delete(key);
            this.inflightCount--;

            // Congestion control: ACK received, increase window
            if (this.cwnd < MAX_CWND) {
              this.cwnd += 1 / this.cwnd; // AIMD additive increase
            }
          }
        }
      }
    }
  }

  /**
   * Send ACK bitmaps for all received sequences.
   */
  private sendAcks(): void {
    if (this.receivedPerStream.size === 0) return;

    const ackEntries: Uint8Array[] = [];

    for (const [streamId, seqSet] of this.receivedPerStream) {
      if (seqSet.size === 0) continue;

      // Find the base sequence (lowest)
      let baseSeq = Infinity;
      for (const seq of seqSet) {
        if (seq < baseSeq) baseSeq = seq;
      }

      // Build bitmap for [baseSeq .. baseSeq+63]
      let bitmapHi = 0;
      let bitmapLo = 0;

      for (const seq of seqSet) {
        const bit = seq - baseSeq;
        if (bit >= 0 && bit < 64) {
          if (bit < 32) {
            bitmapLo |= (1 << bit);
          } else {
            bitmapHi |= (1 << (bit - 32));
          }
        }
      }

      // Encode: [stream_id:u16][base_seq:u32][bitmap_hi:u32][bitmap_lo:u32]
      const entry = new Uint8Array(14);
      const view = new DataView(entry.buffer);
      view.setUint16(0, streamId);
      view.setUint32(2, baseSeq);
      view.setUint32(6, bitmapHi);
      view.setUint32(10, bitmapLo);
      ackEntries.push(entry);

      // Trim old sequences
      if (seqSet.size > 128) {
        const cutoff = baseSeq + 64;
        for (const seq of seqSet) {
          if (seq < cutoff) seqSet.delete(seq);
        }
      }
    }

    if (ackEntries.length === 0) return;

    // Combine all ACK entries into one payload
    let totalLen = 0;
    for (const e of ackEntries) totalLen += e.length;
    const payload = new Uint8Array(totalLen);
    let offset = 0;
    for (const e of ackEntries) {
      payload.set(e, offset);
      offset += e.length;
    }

    // Encode as a flow frame with ACK_FLAG
    const ackFrame = this.codec.encode({
      streamId: 0xFFFF, // Reserved stream for transport-level control
      sequence: 0,
      flags: ACK_FLAG,
      payload,
    });

    // Send as a single datagram (ACKs are always small)
    const datagram = this.wrapFragment(
      this.nextFrameId++ & 0xFFFF,
      0,
      1,
      ackFrame
    );
    this.sendDatagram(datagram);
  }

  /**
   * Retransmit frames that haven't been ACKed.
   */
  private retransmitLost(): void {
    const now = Date.now();

    for (const [key, frame] of this.inflight) {
      if (now - frame.sentAt > RETRANSMIT_TIMEOUT_MS) {
        if (frame.retransmits >= 5) {
          // Give up after 5 retransmits
          this.inflight.delete(key);
          this.inflightCount--;

          // Congestion control: loss detected, halve window
          this.cwnd = Math.max(INITIAL_CWND, Math.floor(this.cwnd / 2));
          continue;
        }

        // Retransmit
        frame.retransmits++;
        frame.sentAt = now;

        const frameId = this.nextFrameId++ & 0xFFFF;
        const maxPayload = this.config.mtu - FRAGMENT_HEADER_SIZE;

        if (frame.data.length <= maxPayload) {
          const datagram = this.wrapFragment(frameId, 0, 1, frame.data);
          this.sendDatagram(datagram);
        } else {
          const totalFragments = Math.ceil(frame.data.length / maxPayload);
          for (let i = 0; i < totalFragments; i++) {
            const start = i * maxPayload;
            const end = Math.min(start + maxPayload, frame.data.length);
            const chunk = frame.data.slice(start, end);
            const datagram = this.wrapFragment(frameId, i, totalFragments, chunk);
            this.sendDatagram(datagram);
          }
        }

        // Congestion control: retransmit = loss indicator
        this.cwnd = Math.max(INITIAL_CWND, Math.floor(this.cwnd / 2));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UDP Socket Abstraction (Node/Bun dgram)
// ═══════════════════════════════════════════════════════════════════════════════

interface RemoteInfo {
  address: string;
  port: number;
}

interface UDPSocket {
  send(data: Uint8Array, host: string, port: number): void;
  onMessage(handler: (data: Uint8Array, rinfo: RemoteInfo) => void): void;
  close(): void;
}

/**
 * Create a UDP socket. Uses Node/Bun dgram module.
 */
async function createUDPSocket(host: string, port: number): Promise<UDPSocket> {
  // Dynamic import for Node/Bun dgram (not available in browser/CF Workers)
  const dgram = await import('dgram');
  const socket = dgram.createSocket('udp4');

  return new Promise((resolve, reject) => {
    socket.on('error', (err: Error) => reject(err));

    socket.bind(port, host, () => {
      const udpSocket: UDPSocket = {
        send(data: Uint8Array, remoteHost: string, remotePort: number) {
          socket.send(data, 0, data.length, remotePort, remoteHost);
        },
        onMessage(handler: (data: Uint8Array, rinfo: RemoteInfo) => void) {
          socket.on('message', (msg: Buffer, rinfo: { address: string; port: number }) => {
            handler(new Uint8Array(msg), { address: rinfo.address, port: rinfo.port });
          });
        },
        close() {
          socket.close();
        },
      };
      resolve(udpSocket);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebTransport Adapter (Browser — HTTP/3 unreliable datagrams)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WebTransport-based FlowTransport for browsers.
 *
 * WebTransport (HTTP/3) provides unreliable datagrams — essentially UDP
 * from the browser. This adapter wraps WebTransport's datagram API with
 * the same fragmentation and reassembly used by UDPFlowTransport.
 *
 * Usage:
 *   const transport = await WebTransportFlowTransport.connect(
 *     'https://site.example.com/.aeon/udp'
 *   );
 *   const protocol = new AeonFlowProtocol(transport, { role: 'client' });
 */
export class WebTransportFlowTransport implements FlowTransport {
  private wt: any; // WebTransport instance (typed as any for portability)
  private writer: any;
  private receiveHandler: ((data: Uint8Array) => void) | null = null;
  private closed = false;
  private reassembler: FrameReassembler;
  private fragmentGroups = new Map<number, FragmentGroup>();
  private nextFrameId = 0;
  private codec = FlowCodec.createSync();

  private constructor(wt: any) {
    this.wt = wt;
    this.reassembler = new FrameReassembler();
  }

  /**
   * Connect to a WebTransport endpoint and return a FlowTransport.
   */
  static async connect(url: string): Promise<WebTransportFlowTransport> {
    // WebTransport is a browser API — check availability
    if (typeof (globalThis as any).WebTransport === 'undefined') {
      throw new Error('WebTransport not available in this environment');
    }

    const wt = new (globalThis as any).WebTransport(url);
    await wt.ready;

    const transport = new WebTransportFlowTransport(wt);
    transport.writer = wt.datagrams.writable.getWriter();

    // Start reading datagrams
    transport.readLoop(wt.datagrams.readable.getReader());

    return transport;
  }

  send(data: Uint8Array): void {
    if (this.closed) return;

    const maxPayload = UDP_MTU - FRAGMENT_HEADER_SIZE;

    if (data.length <= maxPayload) {
      const frameId = this.nextFrameId++ & 0xFFFF;
      const datagram = new Uint8Array(FRAGMENT_HEADER_SIZE + data.length);
      const view = new DataView(datagram.buffer);
      view.setUint16(0, frameId);
      datagram[2] = 0;
      datagram[3] = 1;
      datagram.set(data, FRAGMENT_HEADER_SIZE);
      this.writer.write(datagram).catch(() => {});
    } else {
      const frameId = this.nextFrameId++ & 0xFFFF;
      const totalFragments = Math.ceil(data.length / maxPayload);
      if (totalFragments > 255) return;

      for (let i = 0; i < totalFragments; i++) {
        const start = i * maxPayload;
        const end = Math.min(start + maxPayload, data.length);
        const chunk = data.slice(start, end);
        const datagram = new Uint8Array(FRAGMENT_HEADER_SIZE + chunk.length);
        const view = new DataView(datagram.buffer);
        view.setUint16(0, frameId);
        datagram[2] = i;
        datagram[3] = totalFragments;
        datagram.set(chunk, FRAGMENT_HEADER_SIZE);
        this.writer.write(datagram).catch(() => {});
      }
    }
  }

  onReceive(handler: (data: Uint8Array) => void): void {
    this.receiveHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.wt.close();
    this.receiveHandler = null;
  }

  private async readLoop(reader: any): Promise<void> {
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;

        const data = new Uint8Array(value);
        if (data.length < FRAGMENT_HEADER_SIZE) continue;

        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const frameId = view.getUint16(0);
        const fragIndex = data[2];
        const fragTotal = data[3];
        const payload = data.subarray(FRAGMENT_HEADER_SIZE);

        let reassembled: Uint8Array;

        if (fragTotal === 1) {
          reassembled = payload;
        } else {
          let group = this.fragmentGroups.get(frameId);
          if (!group) {
            group = { frameId, total: fragTotal, received: new Map(), createdAt: Date.now() };
            this.fragmentGroups.set(frameId, group);
          }
          group.received.set(fragIndex, payload.slice());

          if (group.received.size < group.total) continue;

          let totalLen = 0;
          for (let i = 0; i < group.total; i++) totalLen += group.received.get(i)!.length;
          reassembled = new Uint8Array(totalLen);
          let offset = 0;
          for (let i = 0; i < group.total; i++) {
            const frag = group.received.get(i)!;
            reassembled.set(frag, offset);
            offset += frag.length;
          }
          this.fragmentGroups.delete(frameId);
        }

        // Decode flow frame and push through reassembler
        try {
          const result = this.codec.decode(reassembled);
          const deliverable = this.reassembler.push(result.frame);
          for (const frame of deliverable) {
            const encoded = this.codec.encode(frame);
            if (this.receiveHandler) {
              this.receiveHandler(encoded);
            }
          }
        } catch {
          // Malformed frame
        }
      }
    } catch {
      // Stream closed
    }
  }
}
