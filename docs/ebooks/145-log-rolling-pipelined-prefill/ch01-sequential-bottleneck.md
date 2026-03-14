# Chapter 1: The Sequential Bottleneck  --  Why P×N Was Hiding in Plain Sight

## The Original Loop

The prefill phase of distributed inference builds the KV cache by processing every prompt token through every layer node. Before pipelining, the code looked like this:

```typescript
for (let pos = prefixMatchLen; pos < numTokens; pos++) {
  const tokenEmbedding = allEmbeddings.subarray(
    pos * hiddenDim, (pos + 1) * hiddenDim
  );
  let currentStates = tokenEmbedding;

  for (let ni = 0; ni < nodeEntries.length; ni++) {
    const [nodeId, client] = nodeEntries[ni];
    const result = await this.executeLayerStage(
      [client], currentStates, pos, requestId, undefined, nodeId
    );
    currentStates = result.hiddenStates;
  }
  hiddenStates = new Float32Array(currentStates);
}
```

Two nested loops, both fully sequential. For P prompt tokens across N nodes, this creates **P × N** sequential network round-trips. Each `await` blocks until the previous one completes.

## The Hidden Assumption

This loop embodies a specific belief: *Token 1 cannot start on Node-01 until Token 0 has finished on ALL nodes.* This is false.

The actual data dependency is narrower:

- **Token 1 on Node-01** needs Token 0's KV cache entries **at Node-01's layers** (so Node-01 can attend to position 0 when processing position 1).
- Token 1 on Node-01 does **not** need Token 0's results from Node-02, Node-03, or any downstream node.

The pipeline naturally guarantees this. Token 1 can't start on Node-01 until Token 0 finishes there  --  because Node-01 is busy with Token 0. By the time Node-01 is free, Token 0's KV entries are written. The constraint we thought we were enforcing was already enforced by the hardware.

## Why It Looked Correct

The sequential loop is a natural translation of the mathematical description: "for each token, forward through all layers." It produces correct results. It's easy to reason about. And for single-node inference (N=1), there's no cost  --  the inner loop runs once.

The bottleneck only becomes visible when N > 1. With 4 nodes and a 100-token prompt, the sequential loop creates 400 blocking network calls. But if you pipeline, you need only 103 steps (100 tokens + 3 pipeline fill/drain steps).

## The Wallington Analogy

Wallington's Dynamic Offset Pivot works by placing the fulcrum slightly off the center of gravity. The stone becomes "heavy" on one side but "weightless" on the pivot. Push the light end, and the stone rotates 180°, advancing its center of gravity forward.

The sequential loop was perfectly balanced  --  every token waited for every node. By shifting the "pivot" to per-node ordering instead of global ordering, we made the system rotationally unstable in a controlled way. Each token "falls forward" through the pipeline under its own momentum.

## The Cost Model

| Configuration | Sequential Steps | Pipeline Steps | Idle Node-Time |
|--------------|-----------------|----------------|----------------|
| P=10, N=2 | 20 | 11 | 9 wasted steps |
| P=100, N=4 | 400 | 103 | 297 wasted steps |
| P=500, N=8 | 4000 | 507 | 3493 wasted steps |

"Idle node-time" is the difference  --  steps where a node could have been processing a token but was forced to wait because the sequential loop hadn't reached it yet. The pipeline eliminates this waste.

## The Realization

The pivot point was a single line of code: `await` inside the inner loop. By restructuring the two nested loops into a `Promise.race()` pipeline, we changed the computational geometry from serial chains to overlapping waves. The data dependencies didn't change. The algorithm didn't change. We just stopped waiting for things we didn't need to wait for.
