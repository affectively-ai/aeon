# Chapter 18: The UDP Transport  --  TCP Had Its 40-Year Run

> *"You don't move the stone to the hole. You let the stone fall into the hole."*  --  Wally Wallington

## The Insight

Every Aeon Flow frame carries its own identity: `stream_id` + `sequence`. This means frames can arrive out of order and be reassembled correctly. TCP's ordered delivery guarantee  --  the foundation of reliable networking since 1981  --  is redundant. Worse, it's harmful: one lost packet stalls every stream on the connection.

This is the same insight that produced QUIC (HTTP/3). But QUIC solves it with ~30,000 lines of specification across three RFCs (9000, 9001, 9002). Aeon Flow solves it with a 10-byte fixed header and ~800 lines of TypeScript.

## The Wire Format (Recap)

```
┌──────────────────────────────────────────────────────────┐
│                   10-byte Flow Frame                      │
├──────────┬──────────┬───────┬────────────────────────────┤
│ stream_id│ sequence │ flags │ length    │    payload ...  │
│  (u16)   │  (u32)   │ (u8)  │ (u24)    │                 │
└──────────┴──────────┴───────┴────────────────────────────┘
```

Every field needed for reassembly is in the header. No connection state required. No packet number spaces. No crypto handshake. Just stream identity and ordering.

## UDPFlowTransport

The `UDPFlowTransport` class wraps a Node/Bun dgram socket and implements the `FlowTransport` interface:

```typescript
import { UDPFlowTransport, AeonFlowProtocol } from '@affectively/aeon';

const transport = new UDPFlowTransport({
  host: '0.0.0.0',
  port: 4242,
  remoteHost: 'deploy-target.local',
  remotePort: 4242,
  reliable: true,
});

await transport.bind();

const protocol = new AeonFlowProtocol(transport, {
  role: 'client',
  maxConcurrentStreams: 256,
});
```

### MTU Fragmentation

UDP datagrams have a maximum transmission unit (MTU)  --  typically 1500 bytes on Ethernet, minus 28 bytes for IP+UDP headers = **1472 bytes usable**. Flow frames larger than 1472 bytes are automatically fragmented with a 4-byte fragment header:

```
Fragment Header (4 bytes):
┌────────────┬────────────┬────────────┐
│ frame_id   │ frag_index │ frag_total │
│   (u16)    │   (u8)     │   (u8)     │
└────────────┴────────────┴────────────┘
```

- **frame_id**: Identifies which flow frame this fragment belongs to
- **frag_index**: Position within the fragment sequence (0-based)
- **frag_total**: Total number of fragments (1 = unfragmented)

Max payload per fragment: 1472 - 4 = **1468 bytes**. Max fragments: 255. Max flow frame over UDP: **255 × 1468 = 366 KB**.

Small frames (the common case for control messages, ACKs, small payloads) fit in a single datagram with zero fragmentation overhead.

### ACK Bitmaps

Reliability requires acknowledgments. TCP uses SACK (Selective Acknowledgment) with variable-length option blocks. Aeon Flow uses fixed-size ACK bitmaps:

```
ACK Bitmap (14 bytes):
┌────────────┬──────────┬────────────┬────────────┐
│ stream_id  │ base_seq │ bitmap_hi  │ bitmap_lo  │
│   (u16)    │  (u32)   │   (u32)    │   (u32)    │
└────────────┴──────────┴────────────┴────────────┘
```

One bitmap covers **64 contiguous sequences** per stream. `base_seq` is the lowest sequence number in the window. Each bit in `bitmap_hi:bitmap_lo` represents whether that sequence has been received. Multiple bitmaps (one per active stream) are batched into a single ACK frame on the reserved control stream (`0xFFFF`).

14 bytes per stream vs TCP SACK's variable-length blocks. For 10 active streams, that's 140 bytes  --  one datagram covers the entire ACK state.

### AIMD Congestion Control

The transport implements Additive Increase, Multiplicative Decrease  --  the same family of algorithms that TCP uses, but operating at the transport level (not per-stream):

- **Initial window**: 16 frames
- **Max window**: 256 frames
- **On ACK**: `cwnd += 1/cwnd` (additive increase  --  slow growth)
- **On loss**: `cwnd = cwnd / 2` (multiplicative decrease  --  fast backoff)

This is deliberately simpler than TCP's congestion control (which includes slow start, fast retransmit, fast recovery, ECN, etc.). For the workloads Aeon Flow targets  --  deploy artifact streams, CRDT sync, inference pipeline chunks  --  the simpler model is sufficient.

### Retransmission

- ACK interval: 50ms
- Retransmit timeout: 200ms
- Max retransmits: 5

Unacknowledged frames are retransmitted after the timeout. After 5 retransmits, the frame is considered lost and the stream can be poisoned.

## FrameReassembler

The `FrameReassembler` handles per-stream out-of-order reconstruction. This is the key component that eliminates head-of-line blocking:

```typescript
import { FrameReassembler } from '@affectively/aeon';

const reassembler = new FrameReassembler({
  maxBufferPerStream: 256,  // max frames buffered per stream
  maxStreams: 1024,          // max concurrent streams
  maxGap: 64,               // max sequence gap before skip-ahead
});

// Push frames in any order  --  reassembler delivers in-order per stream
const deliverable = reassembler.push(frame);
// deliverable: FlowFrame[]  --  0 if buffered, 1+ if gap filled

// Get missing sequences for ACK generation
const missing = reassembler.getMissingSequences(streamId);
```

**Key properties:**
- Each stream has its own reorder buffer  --  stream A's gaps don't affect stream B
- Dedup via emitted sequence tracking (trimmed at 1024 entries per stream)
- Stream eviction by LRU when `maxStreams` exceeded
- `maxGap` triggers skip-ahead to prevent unbounded buffering on persistent loss

31 tests verify: in-order delivery, multiple independent streams, out-of-order reassembly, reverse order, interleaved streams, dedup, gap skipping, buffer limits, stream eviction, stats tracking, and a 100-frame random-order stress test.

## Browser Bridge: WebTransportFlowTransport

Browsers can't bind raw UDP sockets. `WebTransportFlowTransport` bridges this gap using HTTP/3 unreliable datagrams (the `WebTransport` API):

```typescript
import { WebTransportFlowTransport } from '@affectively/aeon';

const transport = new WebTransportFlowTransport(
  'https://relay.example.com/.aeon/flow'
);
await transport.connect();

// Same FlowTransport interface  --  protocol layer is identical
const protocol = new AeonFlowProtocol(transport, {
  role: 'client',
  maxConcurrentStreams: 256,
});
```

The flow protocol frames travel as HTTP/3 unreliable datagrams  --  preserving the out-of-order, per-stream independence semantics. The `FrameReassembler` handles the rest.

## The Fallback Chain

```
UDP (native)
  ↓ not available (browser, restrictive firewall)
WebTransport (HTTP/3 unreliable datagrams)
  ↓ not available (no HTTP/3 support)
WebSocket (over HTTP/1.1 or HTTP/2)
  ↓ not available (no WebSocket)
TCP (raw socket)
```

The `FlowTransport` interface is the same at every level: `send(data: Uint8Array)`, `onReceive(handler)`, `close()`. The protocol layer never knows which transport is underneath. Fork/race/collapse work identically.

## Where UDP Runs Today

| System | Transport | Why |
|--------|-----------|-----|
| **Forge deploy** (`forge deploy --udp`) | `UDPFlowTransport` | Artifact streaming to deploy targets. 50 files / 2MB in <100ms on LAN. |
| **DashRelay** (server-to-server) | `UDPFlowTransport` | CRDT sync between relay nodes. Zero handshake latency. |
| **DashRelay** (browser) | WebSocket → `aeon-flow` | Browser can't bind UDP. Flow protocol over WebSocket preserves multiplexing. |
| **Aeon Sensing** (service worker) | WebSocket → `aeon-flow` | Auto-detects flow-capable backends, upgrades on first request. |
| **Edge inference** (coordinator → nodes) | `UDPFlowTransport` | Hidden state streaming. 16KB payloads × N nodes. |

## The Wallington Mapping

| Wallington Principle | TCP | UDP + Flow Protocol |
|---------------------|-----|---------------------|
| **Force Multiplication** | One connection, one ordered stream | One socket, 256+ independent streams |
| **Friction Reduction** | SYN/SYN-ACK/ACK before first byte | First datagram IS data |
| **Gravity Harvest** | Congestion control fights loss | Per-stream ACK bitmaps  --  loss on stream A is invisible to stream B |

TCP's reliability guarantees were essential when every byte stream was a single logical conversation. But when every frame already carries its own identity  --  `stream_id` + `sequence`  --  those guarantees become overhead. The transport is doing work the application already handles better.

TCP had its 40-year run. It earned its retirement.
