# Chapter 11: Turbulent Multiplexing  --  Filling the Idle Slots

## The Problem the Wallington Rotation Creates

The Wallington Rotation compresses prefill so aggressively that it creates a new problem: idle nodes.

In a traditional per-token pipeline with 100 tokens and 4 nodes, there are 103 steps. The pipeline spends 3 steps ramping up and 3 steps draining  --  6 steps of "turbulence" out of 103 total. The remaining 97 steps are **laminar flow**: all 4 nodes busy simultaneously, fully utilized. Turbulence is 5.8 percent of runtime. Negligible.

The Wallington Rotation changes the math. Same 100 tokens, 4 nodes, chunks of 25: only 7 steps total. Ramp-up is 3 steps. Drain is 3 steps. Laminar window: **1 step**. Turbulence is 86 percent of runtime.

```
Time:  0  1  2  3  4  5  6
N0:    C0 C1 C2 C3 ·  ·  ·
N1:    ·  C0 C1 C2 C3 ·  ·
N2:    ·  ·  C0 C1 C2 C3 ·
N3:    ·  ·  ·  C0 C1 C2 C3

Total node-slots:  28  (7 ticks × 4 nodes)
Occupied slots:    16  (4 chunks × 4 nodes)
Idle slots:        12  (43 percent waste)
Laminar ticks:      1  (14 percent of runtime)
```

For small models like TinyLlama (22 layers across 4 nodes), short prompts make this worse. 10 tokens, 4 nodes, chunks of 2:

```
Time:  0  1  2  3  4  5  6  7
N0:    C0 C1 C2 C3 C4 ·  ·  ·
N1:    ·  C0 C1 C2 C3 C4 ·  ·
N2:    ·  ·  C0 C1 C2 C3 C4 ·
N3:    ·  ·  ·  C0 C1 C2 C3 C4

Laminar ticks: 2 out of 8 = 25 percent
```

The pipeline never reaches steady state. It's all turbulence  --  startup and shutdown with barely any sustained flow in between.

## The Fluid Dynamics Analogy

In fluid dynamics, laminar flow is smooth, parallel, predictable. Every layer of fluid moves in the same direction at the same speed. Turbulent flow is chaotic  --  eddies, vortices, wasted energy.

A pipeline has the same two regimes:

- **Laminar**: All nodes busy, chunks flowing through at steady rate. Maximum throughput. Zero waste.
- **Turbulent**: Ramp-up (nodes waiting for their first chunk) and ramp-down (nodes finishing their last chunk while others idle). Partial utilization. Wasted capacity.

The ratio is determined by:

```
laminar_fraction = max(0, (num_chunks - num_nodes + 1)) / (num_chunks + num_nodes - 1)
turbulent_fraction = 1 - laminar_fraction
```

When `num_chunks ≈ num_nodes` (which the Wallington Rotation achieves by design), the turbulent fraction dominates. We optimized latency at the cost of utilization.

## The Insight: Turbulence Is Opportunity

Those idle node-slots during turbulence aren't inherently wasted. They're wasted only because we're processing a single request. If multiple requests are in flight, the idle slots in one request's pipeline can serve another request's chunks.

The nodes are stateless per-chunk. Each chunk carries its own hidden state. There's no KV cache conflict between requests during prefill. A node doesn't care whether the chunk it's processing belongs to User A's request or User B's  --  it runs the same forward pass either way.

This means we can **interleave chunks from different requests** into the same pipeline schedule:

```
Request A: 20 tokens, 4 nodes, 5 chunks
Request B: 20 tokens, 4 nodes, 5 chunks

Without multiplexing (sequential):
Time:  0  1  2  3  4  5  6  7  |  8  9 10 11 12 13 14 15
N0:    A0 A1 A2 A3 A4 ·  ·  ·  | B0 B1 B2 B3 B4 ·  ·  ·
N1:    ·  A0 A1 A2 A3 A4 ·  ·  |  · B0 B1 B2 B3 B4 ·  ·
N2:    ·  ·  A0 A1 A2 A3 A4 ·  |  ·  · B0 B1 B2 B3 B4 ·
N3:    ·  ·  ·  A0 A1 A2 A3 A4 |  ·  ·  · B0 B1 B2 B3 B4
Total: 16 ticks, 64 slots, 24 idle (37.5 percent waste)

With multiplexing (interleaved):
Time:  0  1  2  3  4  5  6  7  8  9 10 11
N0:    A0 A1 A2 A3 A4 B0 B1 B2 B3 B4 ·  ·
N1:    ·  A0 A1 A2 A3 A4 B0 B1 B2 B3 B4 ·
N2:    ·  ·  A0 A1 A2 A3 A4 B0 B1 B2 B3 B4
N3:    ·  ·  ·  A0 A1 A2 A3 A4 B0 B1 B2 B3  B4
Total: 12 ticks, 48 slots, 8 idle (16.7 percent waste)
```

Request A finishes at the same time (tick 8). But Request B finishes at tick 12 instead of tick 16  --  a **25 percent latency reduction for free**. And total node utilization jumps from 62.5 percent to 83.3 percent.

## The Multiplexed Scheduler

The coordinator already tracks `nodeFree[]`  --  the tick at which each node becomes available. Multiplexing extends this to multiple concurrent requests:

```typescript
interface PrefillRequest {
  id: string;
  chunks: { startPos: number; count: number; hiddenState: Float32Array }[];
  nextChunk: number;
  completedChunks: number;
  resolve: (result: Float32Array) => void;
}

// Shared node availability across all requests
const nodeFree: number[] = new Array(numNodes).fill(0);
const requestQueue: PrefillRequest[] = [];

function scheduleNext(): { request: PrefillRequest; chunkIdx: number; nodeIdx: number } | null {
  // Find the earliest free node
  let earliestNode = 0;
  for (let n = 1; n < numNodes; n++) {
    if (nodeFree[n] < nodeFree[earliestNode]) earliestNode = n;
  }

  // Find a request with chunks ready for this node
  // Priority: requests whose previous chunk has cleared this node position
  for (const req of requestQueue) {
    if (req.nextChunk >= req.chunks.length) continue;

    // Can this request's next chunk start at this node?
    // It must go through nodes 0, 1, 2, ... in order
    const neededNode = 0; // Chunks always start at node 0
    if (earliestNode === neededNode) {
      return { request: req, chunkIdx: req.nextChunk, nodeIdx: 0 };
    }
  }

  return null;
}
```

The key constraint: chunks within a single request must traverse nodes in order (0 → 1 → 2 → 3). But chunks from *different* requests are independent  --  Request B's chunk can use Node 0 while Request A's chunk is at Node 2.

## Three Multiplexing Strategies

### 1. Request Interleaving (Throughput)

Fill idle slots with chunks from queued requests. Best for throughput-bound workloads (batch inference, many concurrent users).

- **Benefit**: Higher node utilization, better throughput
- **Cost**: No latency improvement for the first request; subsequent requests start earlier
- **When**: Multiple requests queued, nodes going idle during drain phase

### 2. Speculative Decode Pipelining (Latency)

While prefill chunks drain through later nodes, freed early nodes begin speculative autoregressive decode for the *same* request. The first generated token doesn't have to wait for prefill to fully complete.

- **Benefit**: Time-to-first-token reduced by up to N-1 steps
- **Cost**: Speculated tokens may need recomputation if prefill reveals different KV cache state
- **When**: Single request, latency-critical, model supports speculative decode

### 3. Predictive Prefetch (Cold Start)

Use idle nodes to prefetch and warm weight caches for anticipated next requests. On Cloud Run, this combats cold starts  --  the node is already warm when the real request arrives.

- **Benefit**: Eliminates cold start for subsequent requests
- **Cost**: Wasted compute if prediction is wrong
- **When**: Predictable request patterns, Cloud Run with cold start risk

## The Pipeline Reynolds Number

In fluid dynamics, the Reynolds number (Re = ρvL/μ) predicts whether flow through a pipe is laminar or turbulent. Below Re ≈ 2300, flow is smooth and parallel. Above it, eddies and vortices dominate.

Our pipeline has an analogous dimensionless ratio:

```
Re_pipeline = N / C

where:
  N = number of nodes
  C = number of chunks = ceil(P / B)
```

This ratio predicts the flow regime:

| Re_pipeline | Regime | Character | Example |
|-------------|--------|-----------|---------|
| Re → 0 | Deep laminar | Ramp-up/down negligible. Nearly 100 percent utilization. | 1000 tokens, 4 nodes, per-token: C=1000, Re=0.004 |
| Re < 0.5 | Laminar-dominant | Steady state dominates. Minor edge turbulence. | 100 tokens, 4 nodes, chunks of 5: C=20, Re=0.2 |
| Re ≈ 1.0 | Critical transition | Ramp-up meets ramp-down. Minimal laminar window. | 100 tokens, 4 nodes, chunks of 25: C=4, Re=1.0 |
| Re > 1.0 | Fully turbulent | Some nodes never receive a chunk. Pure waste. | 10 tokens, 8 nodes: C=2, Re=4.0 |

The Wallington Rotation, by design, pushes Re_pipeline toward 1.0  --  it sets chunk size B = floor(P/N), so C ≈ N, so Re ≈ 1.0. This is optimal for *latency* (minimum total steps) but maximally turbulent for *utilization*.

This is the fundamental tradeoff the Wallington Rotation makes: it trades utilization for latency. Multiplexing recovers the utilization without sacrificing the latency gain.

### The Critical Reynolds Number

The laminar fraction of the pipeline is:

```
laminar_fraction = max(0, C - N + 1) / (C + N - 1)
```

Setting laminar_fraction = 0 (fully turbulent threshold):

```
C - N + 1 = 0  →  C = N - 1  →  Re = N / (N-1) ≈ 1.0
```

The critical pipeline Reynolds number is approximately 1.0  --  exactly where the Wallington Rotation operates. This isn't coincidence; it's a direct consequence of setting B = P/N.

### Connection to Fluidic Routing

This connects directly to our fluidic routing architecture. In fluidic routing, requests flow through the inference network like fluid through pipes  --  taking the path of least resistance, pooling at available nodes, splitting at branch points.

The pipeline Reynolds number tells us whether our routing will be smooth (predictable, efficient, boring) or turbulent (chaotic, wasteful, but full of opportunity). The fluidic router can use Re_pipeline as a **scheduling signal**:

- **Low Re**: Route requests to dedicated pipelines. No multiplexing needed.
- **Re ≈ 1**: Activate multiplexing. Interleave requests to fill turbulent slots.
- **High Re**: Consider reducing node count. The pipeline is over-provisioned  --  some nodes aren't even getting work.

The Reynolds number becomes a real-time dial for the fluidic scheduler: as request patterns change, Re changes, and the routing strategy adapts.

## The TinyLlama Problem

TinyLlama (22 layers, 4 nodes) is the worst case for idle waste and the best case for multiplexing gains. With short prompts (10-20 tokens), the pipeline is pure turbulence. But TinyLlama is also *fast*  --  each layer processes in milliseconds. The turbulent slots are short but numerous.

Multiplexing turns TinyLlama from "fast but wasteful" into "fast AND efficient." The same 4 Cloud Run instances that serve one request with 43 percent idle time can serve 2-3 concurrent requests with <20 percent idle time, at nearly the same per-request latency.

This is especially relevant for Cloud Run's billing model: you pay for instance-seconds. Idle nodes during turbulence are billed but not producing work. Multiplexing converts billed idle time into billed productive time.

## The Wallington Connection

Wallington doesn't use one pivot point and then walk around idle to find the next one. He pre-positions pivot points so that as the stone clears one rotation, the next pivot is already in place. Zero idle time between rotations.

Turbulent multiplexing is the same principle applied to the pipeline: as one request's chunks clear a node, the next request's chunks are already positioned. The node never idles. Every rotation is productive.

## Implementation

Fully implemented in `open-source/aether/src/multiplexed-prefill-scheduler.ts` (799 lines):

- **`MultiplexedPrefillScheduler`**  --  Manages concurrent `PrefillRequest` objects against shared `nodeFree[]` state
- **`runPipelineLoop()`**  --  Core dispatch loop: `tryDispatchToFreeNodes()` → `handleChunkCompletion()` → resolve completed requests
- **`selectNextRequest()`**  --  Priority-based request selection across the shared pipeline
- **`buildWallingtonChunks()`**  --  Chunk builder with `B = floor(P/N)` sizing
- **`calculatePipelineFlowMetrics()`**  --  Reynolds number, utilization, laminar/turbulent fraction

Used by both the Superposition Prefill Engine (Ch. 12) and the Speculative Tree Engine (Ch. 13) as their execution backend  --  each shard or branch becomes a sub-request in the multiplexed pipeline.

**Tests**: `apps/edge-workers/src/lib/multi-arch/__tests__/superposition-prefill.test.ts` and `speculative-tree.test.ts` exercise the scheduler through the higher-level engines
