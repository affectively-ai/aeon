# Chapter 5: The Test Suite  --  Verifying Pipeline Correctness

## Test Architecture

The test suite at `apps/edge-workers/src/lib/multi-arch/__tests__/pipelined-prefill.test.ts` uses a **simulation harness** rather than mocking the coordinator directly. This harness (`runPipeline()`) mirrors the exact `Promise.race()` logic of `pipelinedPrefill()` with configurable per-node behavior (delays, NaN injection, tunneling).

Why simulate rather than unit test the method directly? The coordinator class has heavy dependencies (weight loading, tokenizer, Cloud Run clients). The pipeline logic is purely about scheduling  --  timing, ordering, and flow control. The simulation isolates these concerns.

## The Harness

```typescript
async function runPipeline(
  numTokens: number,
  prefixMatchLen: number,
  nodes: Array<(pos: number, input: Float32Array) => {
    result: Float32Array;
    delayMs: number;
    tunneled?: boolean;
    nan?: boolean;
  }>,
  hiddenDim = 4
): Promise<PipelineResult>
```

Each "node" is a function that receives a token position and input hidden states, returning a result after a configurable delay. The harness tracks:

- `completedPositions`: which token positions finished (sorted)
- `lastHiddenStates`: the final output
- `poisonPos`: first NaN position (-1 if none)
- `progressCalls`: all `(current, total)` callback invocations

## The Nine Tests

### 1. Basic 5 tokens × 3 nodes

```typescript
test('Basic 5 tokens × 3 nodes  --  all tokens produce output in correct order')
```

Three nodes with scale factors 1.1, 1.2, 1.3. Verifies all 5 positions complete, correct ordering, and the final hidden state matches the expected compound scaling: `5 × 1.1 × 1.2 × 1.3 = 8.58`.

### 2. Single node fallback

```typescript
test('Single node fallback  --  degrades to sequential, same results')
```

One node with scale 2.0. Verifies 4 tokens complete in order and the last token's value is `(3+1) × 2.0 = 8.0`. Confirms zero overhead for single-node configurations.

### 3. NaN at node 1, token 2

```typescript
test('NaN at node 1, token 2  --  tokens 0-1 complete, tokens 3-4 never dispatched')
```

Node 1 returns NaN for position 2. Verifies `poisonPos === 2`, and that tokens 0 and 1 complete cleanly before the poison takes effect.

### 4. NaN at node 0, token 0

```typescript
test('NaN at node 0, token 0  --  immediate termination')
```

The worst case: first computation produces NaN. Verifies `poisonPos === 0` and `lastHiddenStates` remains zero-initialized (no valid data was ever produced).

### 5. Tunneled token

```typescript
test('Tunneled token  --  skips remaining nodes, completes early')
```

Node 0 tunnels token at position 1. Three-node pipeline (0, 1, 2). Verifies all 3 tokens complete despite one bypassing 2 nodes, and no poison is set.

### 6. Progress callback monotonicity

```typescript
test('Progress callback fires monotonically')
```

4 tokens × 2 nodes. Verifies progress callback fires exactly 4 times, values are strictly increasing, and all have `total === 4`. This ensures downstream progress bars behave correctly.

### 7. Pipeline speedup

```typescript
test('Pipeline speedup  --  with mock delays, P+(N-1) < P×N')
```

6 tokens × 3 nodes × 20ms delay. Measures wall-clock time and asserts it's less than 85% of the sequential estimate (6 × 3 × 20 = 360ms). The pipeline should complete in roughly (6 + 2) × 20 = 160ms.

This test has inherent timing sensitivity. The 85% threshold is conservative enough to pass reliably while still proving meaningful speedup.

### 8. Prefix match

```typescript
test('Prefix match  --  skips already-cached tokens')
```

5 total tokens, 3 cached. Verifies only positions 3 and 4 are processed, with exactly 2 progress callbacks.

### 9. Zero tokens to process

```typescript
test('Zero tokens to process  --  returns empty state')
```

3 total tokens, all 3 cached. Verifies no positions are processed and the returned state is all zeros.

## What the Tests Don't Cover

- **Actual network latency**: The simulation uses `setTimeout()`, not real HTTP/gRPC calls.
- **Buffer reuse**: The simulation creates new `Float32Array` per result; the real coordinator may reuse buffers.
- **Circuit breaker interaction**: `executeLayerStage` retry logic is not simulated.
- **Concurrent `serialInference()` calls**: The pipeline assumes exclusive access to node slots.

These are integration-level concerns tested by the existing coordinator test suite and live deployment verification.

## Running the Tests

```bash
bun test apps/edge-workers/src/lib/multi-arch/__tests__/pipelined-prefill.test.ts
```

Expected output: 9 pass, 0 fail, 28 expect() calls.
