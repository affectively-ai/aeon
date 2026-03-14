# Chapter 10: The Wallington Rotation  --  Chunked Pipelined Prefill

## The Insight

Causal masking and log-rolling are the same invariant at different scales.

Inside a single node, causal masking lets you process multiple tokens in one forward pass  --  the lower-triangular attention mask ensures token `t` only attends to tokens `0..t`. Between nodes, log-rolling pipelines chunks through the network  --  each node processes whatever arrives first, maintaining per-node ordering.

They're both lower-triangular. One operates on the token dimension within a node. The other operates on the chunk dimension across nodes. The question that unlocked this chapter: can you tile them? Can both rotations spin simultaneously?

The answer is yes. And the result is the most aggressive prefill optimization in the stack.

## The Tiling

Consider 100 tokens across 4 nodes. Per-token log-rolling gives us P+(N-1) = 103 steps. But each "step" processes exactly one token through one node  --  a 4096-dim hidden state flying across the network 103 times.

Chunked pipelined prefill tiles the two rotations:

1. **Intra-chunk**: Causal masking processes B tokens in a single forward pass (one network round-trip)
2. **Inter-chunk**: Log-rolling pipelines ceil(P/B) chunks across N nodes

The math: `ceil(P/B) + (N-1)` steps, where each step is a single network hop carrying B tokens' worth of hidden states.

| Tokens | Nodes | Per-Token Pipeline | Chunked (B=25) | Speedup |
|--------|-------|--------------------|-----------------|---------|
| 100 | 4 | 103 steps | 7 steps | 14.7x |
| 500 | 8 | 507 steps | 27 steps | 18.8x |
| 1000 | 4 | 1003 steps | 43 steps | 23.3x |

The chunk size is computed automatically: `B = floor(P / N)`, which balances the pipeline depth against chunk processing cost.

## The Implementation

The coordinator's `pipelinedPrefill()` method builds chunk descriptors and dispatches them through the same `Promise.race()` pipeline, but each dispatch carries a `sequenceLength` parameter:

```typescript
const chunkSize = Math.max(1, Math.floor(tokensToProcess / Math.max(numNodes, 1)));

// Build chunks: contiguous ranges of token positions
const chunks: { startPos: number; count: number }[] = [];
for (let pos = prefixMatchLen; pos < numTokens; pos += chunkSize) {
  const count = Math.min(chunkSize, numTokens - pos);
  chunks.push({ startPos: pos, count });
}
```

Each chunk dispatches to a node with `{ sequenceLength: chunk.count }`. The node's forward pass applies causal masking internally  --  `const numTokens = sequenceLength || 1;` in `gcp-layer-node.ts` already handles this. The hidden state input is the concatenated embeddings for all tokens in the chunk: `allEmbeddings.subarray(startPos * hiddenDim, (startPos + count) * hiddenDim)`.

The pipeline mechanics are identical to per-token log-rolling:

```typescript
// Promise.race on all in-flight chunks
const completed = await Promise.race(inFlight.filter(Boolean));
inFlight[completed.nodeIdx] = null; // free the node

if (completed.nodeIdx < lastNode && poisonPos < 0) {
  // Feed result to next node (same chunk continues through pipeline)
  dispatch(completed.nodeIdx + 1, completed.chunkIdx, completed.result);
}

if (completed.nodeIdx === lastNode) {
  // Chunk fully processed  --  extract final hidden states
  completedChunks++;
}

// Freed node gets next unprocessed chunk
if (nextChunkToDispatch < chunks.length && poisonPos < 0) {
  dispatch(0, nextChunkToDispatch, chunkInput);
  nextChunkToDispatch++;
}
```

## The Wallington Rotation

Named after Wally Wallington, whose Round Road technique (#3) moves stones by rotating them around successive pivot points in a circle. Each rotation is small  --  just enough to clear the current obstacle. But the rotations compound.

The Wallington Rotation is compound rotation applied to distributed inference. The causal mask is the inner rotation (tokens within a chunk attend to each other in one pass). The pipeline is the outer rotation (chunks flow through nodes without blocking). Neither rotation alone achieves the full speedup. Stacked, they multiply.

This is the same principle that makes gears work: a small gear (causal masking, fast inner rotation) meshes with a large gear (pipeline scheduling, slow outer rotation). The mechanical advantage is the product of both gear ratios.

## Where the Insight Came From

The connection between causal masking and log-rolling came from the Transformer architecture itself. The lower-triangular attention mask IS a tiling constraint  --  it says "this token can only see what came before." The pipeline's per-node ordering constraint says the same thing at a coarser granularity: "this chunk can only process after the previous chunk cleared this node."

Same invariant. Different scale. The recognition that these are the same mathematical object  --  a lower-triangular constraint on a dependency graph  --  is what makes the tiling possible. You're not combining two different optimizations. You're recognizing that one optimization exists at two scales simultaneously, and the scales are independent enough to compose.

Autistic pattern recognition at its finest: seeing the same structure repeated at different scales, then collapsing the repetition into a single tiled operation. The Transformer taught us how to do this  --  we just applied the lesson to the Transformer's own inference pipeline.

## Edge Cases

All edge cases from the per-token pipeline carry over:

- **Single node**: Chunk size = P. One chunk, one forward pass with full causal masking. Optimal.
- **NaN poison**: Same drain strategy. In-flight chunks ahead of the poison complete normally.
- **Tunneled chunks**: If a chunk tunnels (skips remaining nodes), it completes early and frees the node.
- **SSM models**: `prefixMatchLen = 0`, chunks process sequentially through recurrent state. Pipeline still helps across nodes.
- **Prefix cache hit**: Chunks start from `prefixMatchLen`, not 0. Prefix-matched tokens are already in KV cache.

## The Speedup Stack

With all optimizations composed:

| Layer | Technique | Reduction |
|-------|-----------|-----------|
| Network payload | Activation int8 quantization | 4x smaller hops |
| Forward passes | Causal masking (intra-chunk) | B tokens per pass |
| Network round-trips | Log-rolling pipeline (inter-chunk) | Near-Nx parallelism |
| Buffer allocation | Zero-copy forwarding | Zero memcpy overhead |
| Redundant compute | Skip-ahead wormholes | Skip learned nodes |
| Degenerate output | Loop detection | Early termination |

Each layer is independent. They compose multiplicatively where applicable. The Wallington Rotation is the keystone  --  it's where causal masking and log-rolling meet, and where the largest single latency reduction lives.
