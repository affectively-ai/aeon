# Chapter 6: The Remaining Pivots  --  A Survey of Rotational Opportunities

The prefill pipeline proved that P×N bottlenecks can hide in plain sight. This chapter catalogs every other sequential pattern in the Aether inference engine, classifying each as a **rotational opportunity** (can be pipelined/parallelized) or a **hard wall** (inherently serial).

## Rotational Opportunities

### 1. Parallel Weight Loading (Depformer + Mimi)

**Location:** `gcp-coordinator.ts`, lines 787-944

**The Problem:** Depformer initialization loads ~50 weight files sequentially. Mimi codec adds ~30 more. Each `await loadWeight(...)` is an independent network fetch from GCS or R2.

```typescript
// Current: sequential
for (let cb = 0; cb < numCodebooks; cb++) {
  depformerIn.push(await loadWeight(`lm_depformer_in_${cb}_weight.bin`, dim * inputDim));
}

// Opportunity: parallel
const depformerIn = await Promise.all(
  Array.from({ length: numCodebooks }, (_, cb) =>
    loadWeight(`lm_depformer_in_${cb}_weight.bin`, dim * inputDim)
  )
);
```

**Wallington Technique:** Multi-Stage Cribbing. Each file fetch is a "shim"  --  independent, no ordering constraint. Loading them sequentially is like placing one board at a time when you could place all boards on one side simultaneously.

**Estimated Speedup:** 5-10x on cold start. From ~3-5 seconds of serialized I/O to ~500ms of parallel fetches (bounded by network bandwidth, not latency).

**Risk:** Memory pressure. Loading 80 weight files simultaneously could spike RAM usage. Mitigation: batch in groups of 8-16.

### 2. Multi-Head Attention Parallelism

**Location:** `kernels/moshi-depformer.ts`, lines 245-267

**The Problem:** Attention computation loops over heads sequentially, but each head writes to a disjoint slice of the output buffer:

```typescript
for (let h = 0; h < numHeads; h++) {
  const headOffset = h * headDim;
  // compute scores, softmax, weighted sum
  // writes ONLY to attnOutput[headOffset..headOffset+headDim]
}
```

**The Insight:** Zero data dependency between iterations. Head 3 doesn't read from head 2's output slice. This is the purest form of parallelism  --  embarrassingly parallel.

**Wallington Technique:** The Round Road (#3). Normalize irregular work into identical parallel tracks. Each head is an identical computation on a different slice of Q/K/V.

**Implementation Path:** This is a SIMD/WASM opportunity rather than an async one. The loop body is pure math  --  no I/O, no promises. Parallelism here means:
- WASM SIMD: process 4 heads simultaneously using 128-bit lanes
- Web Workers: split heads across threads (high overhead, low payoff for 8 heads)
- Fused kernel: combine Q·K scoring and V accumulation into a single SIMD pass

**Estimated Speedup:** 2-4x with SIMD vectorization across heads. Hardware-limited.

### 3. Speculative Prefill Reuse

**Location:** `gcp-coordinator.ts`, lines 3313-3337

**The Problem:** The speculative inference path has its own sequential prefill loop that's identical to the one we just replaced:

```typescript
for (let ni = 0; ni < nodeEntries.length; ni++) {
  const [, client] = nodeEntries[ni];
  const result = await this.executeLayerStage([client], currentStates, pos, requestId);
  currentStates = result.hiddenStates;
}
```

**The Fix:** Call `pipelinedPrefill()` instead. This is a free optimization  --  the method already exists, handles all edge cases, and produces identical results.

**Estimated Speedup:** Same as main prefill  --  near-Nx where N = number of nodes.

### 4. Zero-Copy Pipeline Forwarding

**Location:** `gcp-coordinator.ts`, `pipelinedPrefill()` dispatch function

**The Problem:** The pipeline currently copies hidden states between stages:

```typescript
result: new Float32Array(r.hiddenStates)  // copy
```

If `executeLayerStage` guarantees that the returned `hiddenStates` buffer is owned by the caller (not reused internally), this copy is unnecessary. The pipeline could forward the buffer directly to the next node's `executeLayerStage` call.

**Investigation Required:** Check whether `LayerNodeClient.forward()` returns a fresh buffer or reuses an internal one. If fresh:

```typescript
// Zero-copy: pass buffer directly
result: r.hiddenStates as Float32Array  // no copy
```

For a 4096-dim model, each copy is 16KB. At 100 tokens × 4 nodes × 3 copies per token, that's ~19MB of unnecessary allocation. Eliminating it reduces GC pressure and improves cache locality.

**The Initial Embedding Subarray:** The first dispatch already uses `allEmbeddings.subarray()`  --  a zero-copy view. If we can extend zero-copy to inter-stage forwarding, the pipeline touches memory only at the boundaries (embedding in, final hidden state out).

**Wallington Technique:** Friction Reduction. The pivot point should be as small as possible. Copying data is friction  --  it doesn't move the stone, it just resists the movement.

### 5. Embedding Precomputation Overlap

**Location:** `gcp-coordinator.ts`, `serialInference()` line 2724

**The Problem:** `embedTokens()` processes all tokens before the pipeline starts:

```typescript
const allEmbeddings = await this.embedTokens(inputTokens);
// ... then pipeline starts
```

For long prompts, embedding computation is significant. Could overlap embedding with pipeline execution  --  compute embeddings for tokens 0-15, start pipeline, compute 16-31 while pipeline processes 0-15, etc.

**Estimated Complexity:** High. Requires chunked embedding and coordination with the pipeline's `nextToDispatch` pointer. Payoff depends on embedding latency relative to node forward latency.

## Hard Walls (No Pivot Exists)

### Depformer Codebook Loop

**Location:** `kernels/moshi-depformer.ts`, lines 350-411

Each codebook depends on the previous codebook's sampled audio token: `prevToken = audioToken`. This is an architectural dependency of the Moshi model  --  the depth decoder is autoregressive over the codebook dimension. No pipeline or parallelism is possible without changing the model architecture.

### Autoregressive Generation

**Location:** `gcp-coordinator.ts`, generation loop (lines 2852+)

Token N+1's embedding depends on token N's sampled output. This is the fundamental constraint of autoregressive language models. Speculative decoding addresses this by drafting tokens speculatively, but the verification is still sequential.

### Draft Token Generation

**Location:** `gcp-coordinator.ts`, lines 3254-3268

Same autoregressive constraint as generation. Each draft token's embedding feeds the next forward pass. Minor pipelining possible (overlap embedding computation with next forward), but the dependency chain is real.

## Priority Matrix

| Opportunity | Effort | Speedup | Risk | Priority |
|------------|--------|---------|------|----------|
| Weight loading parallelization | Low | 5-10x (cold start) | Memory spikes | **P0** |
| Speculative prefill reuse | Trivial | Near-Nx | None | **P0** |
| Zero-copy pipeline forwarding | Low | ~10 percent throughput | Buffer ownership | **P1** |
| Multi-head attention SIMD | Medium | 2-4x (compute) | WASM complexity | **P2** |
| Embedding precomputation overlap | High | ~10-20 percent | Coordination | **P3** |
