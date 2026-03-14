# Chapter 3: Poison Control  --  The Sand-Box Descent for NaN Handling

## The Problem

NaN (Not a Number) propagation is the silent killer of distributed inference. A single NaN in a hidden state vector will propagate through every subsequent matmul, turning all downstream computation into garbage. In a pipeline, the problem compounds: multiple tokens are in-flight simultaneously, and a NaN at one node could be feeding corrupted data into the next node while clean tokens are still processing ahead of it.

## The Sequential Approach (Before)

The original loop handled NaN simply:

```typescript
if (hasNaN(currentStates)) {
  console.error(`NaN detected at pos=${pos}, node=${nodeId}, aborting`);
  break;  // stop everything immediately
}
```

This works because only one token is in-flight. `break` exits both loops and returns whatever valid hidden states exist.

## The Pipeline Approach: Controlled Drain

In a pipeline, you can't just `break`. Other tokens are already in-flight on other nodes  --  some of them *ahead* of the poisoned token with clean data. Aborting immediately would discard valid work.

The solution is Wallington's Sand-Box Descent: don't slam the brakes. Release the sand grain by grain.

```typescript
let poisonPos = -1;  // first NaN position, -1 = none

// On each completed promise:
if (hasNaN(completed.result)) {
  if (poisonPos < 0) poisonPos = completed.pos;
}

const isPoisoned = poisonPos >= 0 && completed.pos >= poisonPos;
```

Three rules govern the drain:

### Rule 1: No New Dispatches

Once `poisonPos` is set, no new tokens enter the pipeline:

```typescript
if (completed.nodeIdx === 0 && nextToDispatch < numTokens && poisonPos < 0) {
  dispatch(0, nextToDispatch, ...);
}
```

The `poisonPos < 0` guard stops the flow at the source.

### Rule 2: Clean Tokens Complete Normally

Tokens that entered the pipeline *before* the poison are already in-flight with clean data. They passed through the problematic layers before the NaN appeared (or they're on different nodes entirely). These tokens complete normally:

```typescript
if (completed.nodeIdx < lastNode && !isPoisoned) {
  dispatch(completed.nodeIdx + 1, completed.pos, completed.result);
}
```

Only tokens at or after `poisonPos` are blocked from advancing.

### Rule 3: Drain Until Empty

The loop continues until all in-flight promises resolve:

```typescript
if (poisonPos >= 0) {
  const stillActive = inFlight.some(p => p !== null);
  if (!stillActive) {
    console.error(`NaN poison at pos=${poisonPos}, terminating prefill early`);
    break;
  }
}
```

This ensures no dangling promises. Every node finishes its current work before the pipeline shuts down.

## The Sand-Box Analogy

Wallington lowered 10-ton lintels onto uprights using a box filled with sand. By slowly releasing sand from the bottom, the stone descends with millimeter precision. The sand is the buffer between "full support" and "no support."

In the pipeline, in-flight promises are the sand. The poison detection is the hole in the bottom. We don't yank the box away (abort)  --  we let the sand drain out (promises resolve), and the system settles gently onto the last valid hidden state.

## Edge Cases

### NaN at Node 0, Token 0

The worst case: the very first computation produces NaN. The pipeline sets `poisonPos = 0`, never dispatches another token, and returns the zero-initialized `lastHiddenStates`. The generation loop will produce garbage, but it won't crash.

### NaN at Last Node

If NaN appears at the final node, the token is already "complete"  --  it just completed with bad data. The poison flag prevents its result from being stored in `lastHiddenStates`, preserving the last clean output.

### Multiple NaN Sources

Only the first NaN position matters. If Node 1 produces NaN at pos=5 and Node 2 produces NaN at pos=3, `poisonPos` stays at 5 (whichever `Promise.race()` resolves first). All subsequent tokens are blocked regardless.

## Why Not Abort Immediately?

Consider a 100-token prompt on 4 nodes where NaN appears at token 50 on node 2:

- Tokens 47-49 are cleanly in-flight on nodes 3, 2, and 1 respectively
- Token 50 just produced NaN on node 2
- Tokens 47-49 have *already passed* node 2 with clean data

Aborting would discard tokens 47-49, losing 3 valid tokens of KV cache context. The drain strategy preserves them, giving the generation loop the maximum valid context to work with.
