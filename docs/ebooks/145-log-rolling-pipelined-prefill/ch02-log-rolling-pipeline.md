# Chapter 2: The Log-Rolling Pipeline  --  Promise.race() as a Rotational Engine

## The Core Data Structure

The pipeline maintains one "slot" per node  --  a promise representing the token currently being processed on that node:

```typescript
const inFlight: (Promise<{
  nodeIdx: number;
  pos: number;
  result: Float32Array;
  tunneled?: boolean;
}> | null)[] = new Array(numNodes).fill(null);
```

When a slot is `null`, the node is free. When it holds a promise, the node is busy. This is the entire state machine.

## The Dispatch Function

```typescript
const dispatch = (nodeIdx: number, pos: number, input: Float32Array) => {
  const [nodeId, client] = nodeEntries[nodeIdx];
  inFlight[nodeIdx] = this.executeLayerStage(
    [client], input, pos, requestId, undefined, nodeId
  ).then((r) => ({
    nodeIdx, pos,
    result: new Float32Array(r.hiddenStates),
    tunneled: r.tunneled,
  }));
};
```

`dispatch` reuses the existing `executeLayerStage()` with its retry logic and circuit breaker. No changes to error handling infrastructure. The pipeline is a scheduling layer on top of existing reliable primitives.

## The Pipeline Loop

```typescript
// Seed: dispatch first token to node 0
dispatch(0, prefixMatchLen, firstTokenEmbedding);
nextToDispatch = prefixMatchLen + 1;

while (completedTokens < tokensToProcess) {
  // Collect all in-flight promises
  const activePromises = inFlight.filter(p => p !== null);
  if (activePromises.length === 0) break;

  // Wait for ANY node to finish
  const completed = await Promise.race(activePromises);
  inFlight[completed.nodeIdx] = null;  // free the slot

  if (completed.nodeIdx < lastNode && !isPoisoned) {
    // Feed result to next node (same token, next stage)
    dispatch(completed.nodeIdx + 1, completed.pos, completed.result);
  } else {
    // Token exited last node  --  fully complete
    lastHiddenStates = completed.result;
    completedTokens++;
  }

  // Node 0 is free  --  dispatch next token
  if (completed.nodeIdx === 0 && nextToDispatch < numTokens) {
    dispatch(0, nextToDispatch, nextTokenEmbedding);
    nextToDispatch++;
  }
}
```

## Why Promise.race() Is the Right Primitive

`Promise.race()` returns whichever promise settles first. In a balanced pipeline (all nodes take similar time), this naturally alternates between nodes. In an unbalanced pipeline (one node is slower), it automatically adapts  --  the fast nodes don't block waiting for the slow one.

This is Wallington's Rolling Pivot (#5). When he moved his barn, he pivoted on one corner at a time, swinging the opposite side forward. `Promise.race()` does the same  --  whichever node finishes first becomes the pivot point. The rest of the system rotates around it.

## Pipeline Flow Visualization

For 5 tokens across 3 nodes:

```
Time →
Node 0: [T0] [T1] [T2] [T3] [T4]
Node 1:      [T0] [T1] [T2] [T3] [T4]
Node 2:           [T0] [T1] [T2] [T3] [T4]
         ↑                              ↑
      Step 1                         Step 7
```

Sequential would take 5 × 3 = 15 steps. Pipeline takes 5 + 2 = 7 steps. The pipeline "fills" over the first N-1 steps and "drains" over the last N-1 steps. At steady state, all nodes are busy simultaneously.

## Ordering Guarantees

A concern with pipelining: does Token 1 see Token 0's KV cache entries when it arrives at Node-01?

**Yes, by construction.** Token 1 is dispatched to Node-01 only after Token 0 completes on Node-01 (because Node-01 was busy with Token 0). By that time, Token 0's KV entries at Node-01's layers are written. The pipeline's per-node serialization is the ordering guarantee. No locks, no barriers, no coordination  --  just the natural constraint that a node can only process one token at a time.

## The Zero-Copy Question

The original sequential loop used `allEmbeddings.subarray()` for zero-copy views into the embedding buffer. The pipeline preserves this for the initial token dispatch:

```typescript
const tokenEmb = allEmbeddings.subarray(
  nextToDispatch * hiddenDim,
  (nextToDispatch + 1) * hiddenDim
);
dispatch(0, nextToDispatch, tokenEmb);
```

However, intermediate results between nodes use `new Float32Array(r.hiddenStates)`  --  a copy. This copy is necessary because `executeLayerStage` may return a buffer that gets reused. But it's worth investigating whether the layer node protocol guarantees buffer ownership, which would allow zero-copy forwarding between pipeline stages. See Chapter 6 for this as a future optimization.

## Diagnostics

The pipeline logs:
- Start: `[Aether:Coordinator] Log-rolling prefill: ${tokensToProcess} tokens across ${numNodes} nodes`
- First/last token stats: same format as the sequential loop for easy comparison
- End: `[Aether:Coordinator] Pipelined prefill done: ${completedTokens} tokens in ${ms}ms (${tokPerSec} tok/s)`

The tokens-per-second metric is the primary performance indicator. Compare against the sequential path's implicit rate to measure actual pipeline benefit.
