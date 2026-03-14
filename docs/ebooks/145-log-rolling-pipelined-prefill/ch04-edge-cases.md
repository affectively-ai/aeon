# Chapter 4: Edge Cases  --  Tunneling, Single-Node Fallback, and Shard Collapse

## Tunneled Tokens

Some layer nodes can process all remaining layers in a single forward pass  --  this is called "tunneling." When `executeLayerStage` returns `tunneled: true`, the token has already passed through all remaining layers on that node. Forwarding it to the next node would double-process those layers.

The pipeline handles this cleanly:

```typescript
if (completed.tunneled) {
  lastHiddenStates = new Float32Array(completed.result);
  completedTokens++;
  callbacks?.onPrefillProgress?.(prefixMatchLen + completedTokens, numTokens);
}
```

A tunneled token is immediately marked complete, regardless of which node it was on. The node that processed it becomes free and can accept the next token. No special bookkeeping  --  the same dispatch-on-free logic applies.

### When Does Tunneling Happen?

Tunneling occurs when a single Cloud Run instance hosts multiple consecutive layer ranges (e.g., layers 0-15 and 16-31 on the same machine). The node processes all its layers in one `forward()` call and returns `tunneled: true` to signal that no further nodes are needed.

In pipeline terms, tunneling is a shortcut: the token exits the pipeline early. The pipeline's steady-state throughput may actually *increase* because the tunneled node finishes faster and accepts the next token sooner.

## Single-Node Fallback (N=1)

When there's only one layer node, the pipeline degrades gracefully:

```
Pipeline depth = 1
Token finishes node 0 → complete
Next token dispatches to node 0
```

This is mathematically identical to the sequential loop: P tokens × 1 node = P steps. The pipeline overhead is negligible (one `Promise.race()` call per token with a single promise).

The test suite verifies this:

```typescript
test('Single node fallback  --  degrades to sequential, same results', async () => {
  const result = await runPipeline(4, 0, [makeNode(5, 2.0)]);
  expect(result.completedPositions).toEqual([0, 1, 2, 3]);
  expect(result.lastHiddenStates[0]).toBeCloseTo(8.0, 4);
});
```

## Shard Collapse (Local Processing)

Shard collapse is a cost-optimization strategy: when traffic is low (below `collapseThreshold`), the coordinator processes all layers locally instead of dispatching to Cloud Run nodes. This avoids cold-start latency and network overhead for infrequent requests.

The shard collapse path **stays sequential by design**:

```typescript
if (isCollapseActive && this.localNode && this.layerNodes.size > 0) {
  for (let pos = prefixMatchLen; pos < numTokens; pos++) {
    const result = await this.localNode.forward(tokenEmbedding, pos, requestId);
    hiddenStates = new Float32Array(result.hiddenStates);
  }
}
```

There's no pipeline opportunity here  --  there's only one node (the local one). The sequential loop is optimal.

### Why Not Pipeline Shard Collapse?

Even if the local node internally distributes across CPU cores, the `forward()` call is a single async operation. Pipelining requires multiple independent executors. With one executor, pipelining degenerates to sequential. The code reflects this reality.

## SSM Models (Mamba, RWKV)

SSM (State Space Model) architectures don't use KV caches  --  they maintain recurrent state on each layer node. The pipeline works identically for SSMs because:

1. `prefixMatchLen = 0` always (no cache reuse for SSMs)
2. The per-node ordering guarantee still holds  --  Token 1 arrives at Node-01 after Token 0, so Node-01's recurrent state is updated in order
3. No KV cache append ordering concerns

The pipeline is architecture-agnostic. It only cares about per-node serialization, not about what kind of state each node maintains.

## Prefix Matching (KV Cache Hits)

When consecutive requests share a prefix (e.g., "Hello, how are" → "Hello, how are you?"), the coordinator skips tokens that already have KV cache entries:

```typescript
let prefixMatchLen = 0;
while (
  prefixMatchLen < inputTokens.length &&
  prefixMatchLen < this.lastContext.length &&
  inputTokens[prefixMatchLen] === this.lastContext[prefixMatchLen]
) {
  prefixMatchLen++;
}
```

The pipeline starts at `prefixMatchLen` instead of 0, processing only the new suffix. This is orthogonal to the pipeline optimization  --  both reduce latency, and they compose multiplicatively.

For a 100-token prompt where 80 tokens match the previous context, only 20 tokens enter the pipeline. With 4 nodes: sequential = 80 steps, pipeline = 23 steps. Combined with prefix matching: 20 × 4 = 80 → 23, plus 80 tokens skipped entirely = 103 → 23 total steps.

## Zero Tokens to Process

If `prefixMatchLen === numTokens` (entire prompt cached), the pipeline returns immediately:

```typescript
if (tokensToProcess <= 0) {
  return new Float32Array(this.modelConfig.hiddenDim);
}
```

This is the degenerate case  --  a repeated prompt. The generation loop starts immediately from the cached KV state.
