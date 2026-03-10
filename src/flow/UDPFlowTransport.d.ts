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
/** Safe MTU for UDP datagrams (1500 Ethernet - 20 IP - 8 UDP) */
export declare const UDP_MTU = 1472;
/** Fragment header size: [frame_id:u16][frag_index:u8][frag_total:u8] */
export declare const FRAGMENT_HEADER_SIZE = 4;
/** Max payload per UDP datagram after fragment header */
export declare const MAX_FRAGMENT_PAYLOAD: number;
/** ACK frame flag — not a real flow flag, internal to UDP transport */
export declare const ACK_FLAG = 128;
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
export declare class UDPFlowTransport implements FlowTransport {
    private config;
    private receiveHandler;
    private closed;
    private socket;
    private reassembler;
    private fragmentGroups;
    private nextFrameId;
    private inflight;
    private receivedPerStream;
    private ackTimer;
    private retransmitTimer;
    private cwnd;
    private inflightCount;
    private codec;
    constructor(config: UDPFlowTransportConfig);
    /**
     * Bind and start the UDP transport.
     *
     * In server mode (no remoteHost), listens for incoming datagrams.
     * In client mode, binds and sets the remote endpoint.
     */
    bind(): Promise<void>;
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Get reassembly statistics */
    getReassemblerStats(): Readonly<import("./frame-reassembler").ReassemblerStats>;
    /** Current congestion window size */
    get congestionWindow(): number;
    /** Number of frames in flight (unacked) */
    get framesInFlight(): number;
    /**
     * Handle an incoming UDP datagram.
     *
     * Datagram format:
     *   [frame_id:u16][frag_index:u8][frag_total:u8][payload...]
     */
    private handleDatagram;
    /**
     * Handle a fragment of a multi-datagram flow frame.
     */
    private handleFragment;
    /**
     * Handle a complete (reassembled) flow frame.
     * This is where we do out-of-order reassembly using the stream_id + sequence.
     */
    private handleReassembledFrame;
    /**
     * Wrap a flow frame chunk in a fragment header.
     */
    private wrapFragment;
    /**
     * Send a UDP datagram to the remote endpoint.
     */
    private sendDatagram;
    /**
     * Track a sent frame for potential retransmission.
     */
    private trackInflight;
    /**
     * Handle an incoming ACK frame.
     *
     * ACK payload format:
     *   [stream_id:u16][base_seq:u32][bitmap_hi:u32][bitmap_lo:u32]
     *   (can repeat for multiple streams)
     */
    private handleAck;
    /**
     * Send ACK bitmaps for all received sequences.
     */
    private sendAcks;
    /**
     * Retransmit frames that haven't been ACKed.
     */
    private retransmitLost;
}
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
export declare class WebTransportFlowTransport implements FlowTransport {
    private wt;
    private writer;
    private receiveHandler;
    private closed;
    private reassembler;
    private fragmentGroups;
    private nextFrameId;
    private codec;
    private constructor();
    /**
     * Connect to a WebTransport endpoint and return a FlowTransport.
     */
    static connect(url: string): Promise<WebTransportFlowTransport>;
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    private readLoop;
}
