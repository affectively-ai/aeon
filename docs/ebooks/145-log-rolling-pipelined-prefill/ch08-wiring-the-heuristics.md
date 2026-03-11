# Chapter 8: Wiring the Heuristics — Loop Detection and Skip-Ahead Wormholes

## The Integration

The coordinator's generation loop integrates **LoopDetector** and **SkipAheadAggregator** into the inference hot path.

### Loop Detection (Safety Fulcrum)

The `LoopDetector` is Wallington's offset fulcrum — if something goes wrong, the system settles safely instead of spinning forever.

**Wiring point:** After each token is sampled and emitted, before the next forward pass:

```typescript
// Reset per generation
this.loopDetector.reset();

// In the generation loop, after token emission:
const loopAlert = this.loopDetector.check(hiddenStates);
if (loopAlert.detected) {
  console.warn(
    `[Aether:Coordinator] Loop detected at step=${step}, period=${loopAlert.period}`
  );
  break;
}
```

**How it works:** The detector maintains a sliding window of hidden state snapshots (16 positions by default). At each token, it computes cosine similarity against all positions in the window, checking for periodicity. Three consecutive matches above 0.95 similarity at any period triggers an alert.

**Cost:** One cosine similarity computation per token per window entry. For a 4096-dim hidden state and window size 16: 16 × 4096 multiply-adds = 65K FLOPs per token. Negligible compared to the transformer forward pass.

### Skip-Ahead Wormholes (Gravity Harvest + Active Prediction)

The `SkipAheadAggregator` has two modes:

#### Passive Mode: Observation Recording

During every generation forward pass through layer nodes, the coordinator records the input and output hidden states at each node boundary:

```typescript
this.skipAhead.recordObservation(
  promptClassHash, nodeIdx, nodeIdx + 1,
  inputBeforeNode, currentStates
);
```

This is pure gravity harvest — the weight of normal inference powers the learning. Zero compute overhead beyond creating 32-element sketches (mean-pooling the hidden state).

#### Active Mode: Wormhole Prediction

Before dispatching to each node, the coordinator checks if a trusted mapping exists:

```typescript
const skipPrediction = this.skipAhead.predict(promptClassHash, nodeIdx, currentStates);
if (skipPrediction.shouldSkip && skipPrediction.predictedState) {
  currentStates = skipPrediction.predictedState;
  continue; // skip the node entirely
}
```

A mapping becomes trusted after 20+ observations with 85 percent+ accuracy. The confidence score combines input similarity, observation count, historical accuracy, and free-energy corridor strength.

#### Verification Loop

After every real forward pass, the actual output is compared against the aggregator's stored mapping:

```typescript
this.skipAhead.verify(promptClassHash, nodeIdx, nodeIdx + 1, currentStates);
```

This updates the running accuracy of each mapping, creating a self-correcting feedback loop. Bad mappings degrade below the accuracy threshold and stop being used.

### Prompt Class Hashing

Both modules key their state by "prompt class" — a hash derived from the model name and the first 8 input tokens:

```typescript
const promptClassHash = `${this.modelName}:${inputTokens.slice(0, 8).join(',')}`;
```

This groups similar prompts without requiring exact token matching. Two conversations that start the same way will share skip-ahead mappings, even if they diverge later. The cosine similarity matching handles the divergence — dissimilar hidden states won't match existing mappings.

## The Wallington Connection

**Loop Detection = Offset Fulcrum:** The stone settles back onto the crib instead of toppling. The system stops generating instead of producing infinite garbage.

**Observation Recording = Gravity Harvest:** Each inference request builds the dataset that powers future optimizations. The weight of normal work charges the battery.

**Skip-Ahead Prediction = The Wormhole:** Once the terrain is mapped (enough observations), you can teleport through it. The stone doesn't need to be carried — it walks on its own.

**Verification Loop = Cribbing Jack:** Each verification is a shim. The mapping rises in confidence one observation at a time, and settles back if accuracy drops. The recursive build-up mirrors Wallington's recursive lifting process.

## Test Coverage

14 tests in `inference-heuristics.test.ts`:

| Suite | Tests | What's Verified |
|-------|-------|----------------|
| Loop Detection | 5 | Period-1 detection, alternating patterns, false-positive resistance, reset, sketch creation |
| SkipAhead Aggregator | 7 | Observation recording, trusted prediction, insufficient observations, unknown prompts, verification accuracy, multi-hop chains, reset |
| Integration | 2 | Degenerate generation abort, learn-and-predict cycle |
