# Chapter 14: The Aeon Flow Protocol — Fork, Race, Collapse All The Way Down

> *"The same pattern, appearing at every layer, is not coincidence. It is the protocol trying to be born."*

## The Unified Primitive

Look at the stack from the bottom up:

| Layer | Fork | Race | Collapse |
|-------|------|------|----------|
| **Inference** | Wallington Rotation chunks tokens across nodes | Turbulent multiplexing fills idle slots with other requests | Worthington Whip shards one request across parallel sub-sequences, then corrects with cross-shard attention |
| **Speculative Decode** | Draft model generates K candidate branches | All K branches enter the pipeline simultaneously | Full model verifies branches; invalid branches pruned via AbortSignal |
| **ESI** | Two-phase rendering discovers parallel fragments | Fragment requests race to resolve against cache/origin/inference | Fragments collapse into final HTML page |
| **Sync (aeon)** | Multiple peers fork state via delta operations | LWW / vector-clock / majority-vote race to establish canonical state | Reconciler merges divergent states |
| **Shell (aeon-shell)** | Ghost operations fork/migrate/bequeath process snapshots; reality forks branch up to 5 timelines | Federated processes race across devices with scoring | Ghost merge + wisdom extraction collapse branches |
| **Frontend (aeon-flux)** | ESI `processBatch()` with semaphore; SpeculationManager races Markov-predicted navigations | Cache races against network; speculation races against navigation | SyncCoordinator batches adaptive writes into collapsed operations |

These are all **the same operation**: fork work into parallel streams, race the streams to completion, collapse the results into a single output. The Aeon Flow Protocol extracts this into a protocol-level primitive.

## The Wire Format

```
FlowFrame {
  stream_id: u16      // multiplexed stream identifier
  sequence:  u32      // position within stream
  flags:     u8       // FORK=0x01 RACE=0x02 COLLAPSE=0x04 POISON=0x08 FIN=0x10
  length:    u24      // payload length (up to 16MB)
  payload:   [u8]     // raw bytes, interpretation determined by stream negotiation
}
```

Total header: **10 bytes**. Compare HTTP/2's 9-byte frame header plus HPACK-encoded headers averaging 50–200 bytes per request. For inference hidden states (4096 × f32 = 16KB), the Aeon Flow header is **0.06 percent overhead** vs HTTP's 1–3 percent.

The key zerocopy insight: `Float32Array` hidden states from inference can be written directly as the frame payload — no intermediate `Buffer` copy. The codec writes the 10-byte header in front of the existing `ArrayBuffer` view.

## The Protocol Stack

```
┌─────────────────────────────────────────────┐
│  Application Layer                          │
│  inference | esi | sync | ghost | speculate │
├─────────────────────────────────────────────┤
│  Flow Layer (fork/race/collapse)            │
│  stream multiplexing, backpressure, poison  │
├─────────────────────────────────────────────┤
│  Frame Layer (binary codec)                 │
│  JS encoder/decoder, optional WASM accel    │
├─────────────────────────────────────────────┤
│  Transport Layer                                      │
│  UDP | WebSocket | WebTransport | TCP | WebRTC | IPC  │
└─────────────────────────────────────────────┘
```

### Transport Layer: UDP by Default

TCP had its 40-year run. The Aeon Flow Protocol defaults to UDP everywhere, TCP only when necessary.

The 10-byte flow header is **self-describing** — `stream_id` + `sequence` in every frame means frames can arrive out of order and be reassembled correctly. This is the same insight as QUIC/HTTP3 — but with 10-byte frames instead of QUIC's complex framing. TCP's ordered delivery is redundant when every frame already carries its own identity.

**Why UDP wins for multiplexed protocols:**

| TCP Guarantee | Why It Hurts Multiplexing |
|---------------|--------------------------|
| Ordered delivery | One lost packet for stream A blocks ALL streams (B, C, D) waiting behind it |
| Connection handshake | SYN → SYN-ACK → ACK = 1.5 RTT before first data byte. UDP: first datagram IS data |
| Single-stream congestion | TCP backs off the entire connection on loss. Flow protocol backs off per-stream |
| Retransmission | TCP retransmits at the connection level. Flow protocol retransmits per-stream — stream A's retransmit doesn't delay stream B |

**The `UDPFlowTransport`:**

```typescript
import { AeonFlowProtocol, UDPFlowTransport } from '@affectively/aeon';

const transport = new UDPFlowTransport({
  host: '0.0.0.0', port: 4242,
  remoteHost: 'target.local', remotePort: 4242,
  reliable: true, // ACK bitmaps + AIMD congestion control
});
await transport.bind();

const flow = new AeonFlowProtocol(transport, {
  role: 'client',
  maxConcurrentStreams: 256,
});
```

**MTU-aware fragmentation:** Large flow frames (>1472 bytes) are automatically fragmented with a 4-byte fragment header `[frame_id:u16][frag_index:u8][frag_total:u8]`. Max 255 fragments × 1468 bytes = 366KB per flow frame. Small frames (the common case) need zero fragmentation.

**ACK bitmaps:** 14 bytes covers 64 contiguous sequences per stream — `[stream_id:u16][base_seq:u32][bitmap_hi:u32][bitmap_lo:u32]`. Compact vs TCP SACK.

**AIMD congestion control:** Congestion window starts at 16, max 256. Additive increase (1/cwnd per ACK), multiplicative decrease (halve on loss). Per-transport, not per-stream — the transport layer manages the wire, the flow layer manages the streams.

**`FrameReassembler`:** Per-stream out-of-order reconstruction. Each stream has its own reorder buffer with gap detection and dedup. Stream A's lost packet is invisible to stream B — zero head-of-line blocking.

**Browser bridge:** Browsers can't bind raw UDP sockets, so `WebTransportFlowTransport` uses HTTP/3 unreliable datagrams for the same semantics. The flow protocol is identical — only the physical transport changes.

**Fallback chain:** UDP → WebSocket → TCP. The `FlowTransport` interface (`send/onReceive/close`) is transport-agnostic. `AeonFlowProtocol`, `FlowDeployTransport`, `FlowESIProcessor` all work unchanged regardless of physical transport.

### Frame Layer: `FlowCodec`

Pure binary encoder/decoder. 10 bytes header, zerocopy payload. The JS implementation is always available and correct. An optional WASM accelerator (~2KB) can be compiled from `aeon-flow-codec.c` for hot paths.

```typescript
const codec = FlowCodec.createSync();
const encoded = codec.encode(frame);              // Uint8Array
const { frame, bytesRead } = codec.decode(buf);   // zerocopy payload view
```

Batch operations encode/decode multiple frames into a single contiguous buffer — ideal for sending multiple chunks in one transport write.

### Flow Layer: `AeonFlowProtocol`

Stream multiplexing with fork/race/collapse semantics over any transport.

**Stream IDs**: Even = client-initiated, odd = server-initiated (like HTTP/2).

**Backpressure**: Per-stream high-water mark (default 64 frames). When a stream hits the limit, sends throw until the remote drains.

**Poison propagation**: Poisoning a stream sends a POISON frame and recursively poisons all descendants. This generalizes NaN detection in inference (one bad chunk poisons the request), AbortSignal in speculation (invalid branch gets pruned), and error cascading in sync (failed operation aborts the batch).

## The Three Primitives

### Fork

```typescript
const parent = protocol.openStream();
const [s1, s2, s3] = protocol.fork(parent, 3);
```

Creates N child streams from a parent. Each child is independent. The parent tracks all children. Poisoning the parent poisons all children.

**In inference**: fork chunks across pipeline nodes. In ESI: fork fragment requests. In sync: fork delta operations to multiple peers. In shell: fork reality branches.

### Race

```typescript
const { winner, result } = await protocol.race([s1, s2, s3]);
// winner: stream ID of the first to FIN
// losers: automatically poisoned
```

First stream to send a FIN frame wins. All losers are automatically poisoned. Uses `Promise.race()` internally for the settlement, with POISON frames for cleanup.

**In inference**: speculative branches race through the pipeline. In ESI: cache and origin race to serve a fragment. In sync: LWW / vector-clock strategies are races on timestamp or logical order.

### Collapse

```typescript
const merged = await protocol.collapse([s1, s2, s3, s4], (results) => {
  // results: Map<streamId, Uint8Array>
  // Poisoned streams are absent from the map
  return assembleShards(results);
});
```

Waits for all streams to complete (or poison), then calls a merger function. Poisoned streams contribute nothing to the merge — they're absent from the results map.

**In inference**: Worthington Whip cross-shard attention correction. In ESI: assemble HTML from fragments. In sync: StateReconciler merges divergent replicas. In shell: ghost merge with wisdom extraction.

## The `aeon://` URI Scheme

```
aeon://host:port/stream-type/stream-id
aeon://inference.local/prefill/req-001        // inference pipeline
aeon://esi.edge/fragments/page-42             // ESI fragment batch
aeon://sync.relay/room/dashboard              // CRDT sync room
aeon://ghost.local/fork/reality-3             // reality fork
```

Every multiplexed stream gets a first-class address. This is what makes `aeon://` real — not just a namespace, but a wire protocol with binary semantics.

## Performance Characteristics

| Metric | HTTP/2 | Aeon Flow |
|--------|--------|-----------|
| Frame header | 9 bytes + HPACK | 10 bytes (fixed) |
| Per-request overhead | 50–200 bytes headers | 0 bytes (stream reuse) |
| Serialization | JSON encode/decode | Zerocopy (TypedArray view) |
| Codec location | JS runtime | JS + optional WASM |
| Fork/race/collapse | Application-level | Protocol-level |
| Backpressure | TCP window + flow control | Per-stream high-water mark |

For inference workloads (16KB hidden state payloads): **0.06 percent protocol overhead** vs 1–3 percent for HTTP/2.

With UDP transport, additional wins:

| Metric | TCP (WebSocket) | UDP (UDPFlowTransport) |
|--------|----------------|----------------------|
| First data byte | 1.5 RTT (TCP handshake) | 0 RTT (first datagram IS data) |
| Head-of-line blocking | Per-connection (all streams blocked) | Per-stream (independent) |
| Congestion control | Per-connection | Per-transport with stream awareness |
| Lost packet impact | Blocks all streams | Blocks only affected stream |
| Frame overhead | 10 bytes + WebSocket framing | 10 bytes (raw) |

## Integration with the Multiplexed Prefill Scheduler

The scheduler's `dispatchChunk` method sends chunks to pipeline nodes. With the `FlowProtocolBridge` interface, dispatches become FlowFrame sends:

```typescript
interface FlowProtocolBridge {
  sendChunk(streamId, nodeIdx, requestId, chunkIdx, input, startPos, count): void;
  onChunkComplete(handler: (event: ChunkCompletionEvent) => void): () => void;
  openRequestStream(requestId: string): number;
  closeRequestStream(streamId: number, poisoned: boolean): void;
}
```

This is a non-breaking addition. The scheduler works identically with or without a flow protocol attached. When attached, chunk data flows over binary frames instead of direct function calls — enabling the same pipeline to run across network boundaries.

## What This Means

The stack is no longer five independent systems that happen to share a pattern. It's one protocol with five application layers. The fork/race/collapse primitive is the same operation whether you're:

- Splitting a 500-token prompt across 8 inference nodes
- Fetching 12 ESI fragments for a page
- Syncing CRDT deltas across 20 peers
- Forking a reality branch in the shell
- Pre-rendering 4 speculated navigations

The wire format is the same. The backpressure is the same. The poison propagation is the same. The only thing that changes is what's in the payload.

Pipeline chunks ARE the wire format. No HTTP framing overhead. No JSON serialization. Zerocopy buffer passing. The Aeon Flow Protocol makes `aeon://` real.
