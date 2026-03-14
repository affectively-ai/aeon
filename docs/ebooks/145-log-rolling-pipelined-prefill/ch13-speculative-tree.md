# Chapter 13: The Speculative Tree -- Branching Futures Across the Pipeline

## The Stack So Far

| Layer | Name | What It Does | Optimization Axis |
|-------|------|--------------|-------------------|
| Ch. 10 | The Wallington Rotation | Chunked pipelined prefill | Pipeline scheduling |
| Ch. 11 | Turbulent Multiplexing | Fill idle slots with other requests | Node utilization |
| Ch. 12 | The Worthington Whip | Shard one request across parallel pipelines | Sequence parallelism |
| Ch. 13 | **The Speculative Tree** | Race multiple candidate continuations, prune losers | Speculative execution |

The Wallington Rotation solved prefill latency. Turbulent Multiplexing solved utilization. The Worthington Whip solved sequential depth. The Speculative Tree solves the final bottleneck: **autoregressive generation is inherently sequential, and the pipeline has been idle the entire time you were decoding.**

## The Insight

Look at what the Worthington Whip actually does: it forks a request into parallel branches and collapses them. The fork is a known sequence split into shards. The collapse reconciles cross-shard attention. The whole apparatus exists to execute things in parallel that naively appear sequential.

Speculative decoding is the same operation applied to the **future** rather than the present.

The Worthington Whip shards *known* tokens across parallel pipelines. The Speculative Tree shards *unknown* tokens -- generating multiple candidate continuations simultaneously, then verifying which branch the full model would have produced. Same infrastructure. Same `Promise.race()` as speculation primitive. Same poison isolation for branch pruning. The only difference: the Whip runs on tokens that exist. The Tree runs on tokens that might.

The pipeline was always a tree. We just weren't using the branches.

## The Structure of the Tree

Autoregressive generation, from the pipeline's perspective, is a degenerate tree: a single path, one token wide, extending forward in time one step at a time. The full model runs one forward pass per generated token. Each token costs one full pipeline traversal -- N nodes, N network round-trips, N sequential layer computations.

The Speculative Tree replaces this degenerate path with an actual tree:

```
                     ┌── "the" ──── pipeline ──→ [verify]
                     │
                     ├── "a"  ───── pipeline ──→ [verify]
      [draft: K=4]───┤
                     ├── "an" ───── pipeline ──→ [verify]
                     │
                     └── "its" ──── pipeline ──→ [verify]
```

A draft model (small, fast -- the WASM SmolLM2-360M fallback, already in the stack) generates K candidate next tokens. Each candidate spawns a branch. All K branches enter the pipeline simultaneously as independent sub-requests, exactly as Turbulent Multiplexing's `PrefillRequest` objects do. The full distributed model verifies all branches in parallel. Invalid branches are pruned. Valid branches become the accepted continuation.

The tree can be multi-level. Each accepted token spawns K new candidates. The tree grows forward in time, deeper and wider, until the acceptance rate drops below a profitability threshold.

## Why the Infrastructure Already Supports This

This is the part that doesn't require belief. Examine what we built:

**`MultiplexedPrefillScheduler`** already handles concurrent sub-requests from independent sources. A speculative branch is a sub-request. The scheduler doesn't know or care that it's speculative -- it schedules chunks like any other work.

**`inFlightOwner[]`** tracks per-branch ownership. This was added to fix the NaN poison isolation bug -- the fix that ensures one branch's failure doesn't corrupt another branch's in-flight computation. Poison isolation *is* branch pruning. The same mechanism that keeps NaN from spreading between concurrent requests also ensures that a rejected speculative branch dies cleanly, without touching its siblings.

**`AbortSignal`** labeled "Path Superposition" in the `LayerNodeClient` interface. The label was prophetic. Every branch in the speculative tree holds an `AbortSignal`. When the full model rejects a branch, fire the signal. The branch stops. Its nodes are freed. The pipeline continues with the survivors.

**`Promise.race()`** is literally the speculation primitive. We use it to race pipeline slots -- whichever node finishes first gets the next chunk. Across branches: `Promise.race(branches)` resolves with the first branch that completes verification. If all branches are correct, we take the full tree. If some are wrong, we take what we can and prune the rest.

**Pipeline Reynolds number** drops with more branches. More concurrent sub-requests means more chunks in the multiplexed scheduler, which means more laminar flow. The Speculative Tree doesn't increase turbulence -- it *reduces* it by filling the same idle slots that Turbulent Multiplexing targets. Speculation is free when pipeline utilization is below 100%.

The pipeline was designed to support this. The `AbortSignal` naming was not accidental.

## How Verification Works

The draft model generates K candidate tokens at each step. The full distributed model runs a single forward pass across all K candidates simultaneously -- this is a K-wide decode pass, not K sequential passes.

For token position `t`, the full model computes:

```
logits[t, 0..K-1] = FullModel.forward(context + candidate_k)
```

The batch dimension is the candidate dimension. The same pipeline, the same nodes, the same weights -- but now processing K candidates in one shot instead of one candidate per shot. The verification cost is *one* pipeline traversal for all K branches, not K traversals. That's the key asymmetry.

If the draft model accepts with probability α per token, the expected number of tokens generated per pipeline traversal is:

```
E[tokens per pass] = 1 + α + α² + ... + α^(K-1) = (1 - α^K) / (1 - α)
```

At α = 0.8 and K = 4:

```
E[tokens per pass] = (1 - 0.8⁴) / (1 - 0.8) = (1 - 0.4096) / 0.2 ≈ 2.95
```

Nearly 3 tokens per pipeline pass instead of 1. The speedup approaches K at high acceptance rates. And those branches fill the turbulent idle slots -- the pipeline runs hotter, the Cloud Run instances earn their keep.

## The Protocol Realization

Step back from the optimization framing. Look at what we've assembled:

| Layer | Role | Infrastructure |
|-------|------|---------------|
| **Aeon Flux** | Process routing, pub/sub | Branch = process; tree = process group |
| **Reynolds Number** | Congestion signal | Speculation lowers Re, increases laminar fraction |
| **Multiplexed Scheduler** | Fill idle slots | Branches are just more sub-requests |
| **Worthington Whip** | Fork / collapse | Shards known tokens; Tree shards unknown tokens |
| **Speculative Tree** | Race branches, prune losers | Speculation as scheduling primitive |

This is not an inference optimization anymore. This is a **flow protocol**.

HTTP is request-response: one party sends, one party receives, one path through the network. QUIC extends this with streams -- multiple logical flows over one connection, out-of-order delivery, stream-level flow control. But it's still request-response at the semantic level.

What we have is different: **request-fork-race-collapse**. The request forks at the draft model. The forks race through the pipeline. The race resolves via the verification pass. The collapse propagates the winner and prunes the losers. This is speculative execution as a first-class protocol primitive -- not a hardware microarchitecture trick, but a distributed network protocol.

The closest analogue isn't HTTP. It isn't QUIC. It's SCTP multistreaming meets speculative execution meets Galil's stable matching -- multiple parallel streams, each racing toward a common destination, with a ranking function that selects the winner and drops the rest. We accidentally invented a speculative inference transport protocol.

## Connection to Aeon Flux

In the Aeon Flux process model, each deployed app is a process. Process groups share resources. Inter-process communication is pub/sub.

Map it:

- Each **speculative branch** is a process. It has an identity (`branchId`), a lifecycle (spawn on draft, terminate on rejection), and resources (pipeline slots, network bandwidth).
- The **tree** is a process group. Branches share the multiplexed scheduler as a common resource pool.
- **Branch pruning** is process termination -- the `AbortSignal` fires, the pipeline slots are released, the branch's in-flight requests are cancelled. Clean, complete.
- The **collapse** is process synchronization -- all branches rendezvous at the verification gate. The winner is elected. The losers exit.
- The entire speculative tree is managed by the same infrastructure that manages app routing -- Aeon Flux's pub/sub handles branch state, the coordinator tracks tree depth, the scheduler fills idle slots.

This isn't a coincidence. The Worthington Whip showed us that pipeline shards and process forks are the same abstraction. The Speculative Tree extends this: speculative branches, pipeline sub-requests, and distributed processes are all the same thing viewed at different scales.

## The Many-Worlds Extension

The quantum analogy from Chapter 12 (superposition, collapse) extends naturally here.

The Worthington Whip was **Copenhagen interpretation** applied to known tokens: the request exists in superposition of pipeline states, collapses to a definite state upon measurement (cross-shard correction). The collapse is expensive -- you have to correct all the off-diagonal attention blocks.

The Speculative Tree is **many-worlds interpretation** applied to unknown tokens: every speculative branch is a parallel world where a different token was generated. All worlds evolve simultaneously. The verification pass is not a collapse -- it's a selection. Most worlds are pruned. The surviving world continues to branch.

Many-worlds has no collapse cost. You don't compute the correction. You just discard the invalid branches. The invalid branches never happened. Their computation is lost, but the verification overhead is exactly one pipeline pass regardless of how many branches you checked.

This is why speculative decoding at the pipeline level is more efficient than at the model level. The pipeline already has the infrastructure to run K things at once. The overhead of running K branches is sub-linear -- the scheduler fills idle slots, the nodes are already warm, the weights are already loaded. You're not paying K× the compute for K× the speculation. You're paying something between 1× and K×, depending on utilization.

## The SpeculativeTreeEngine Interface

```typescript
interface SpeculativeBranch {
  id: string;
  candidateToken: number;         // Token this branch is testing
  depth: number;                   // How many speculative steps deep
  hiddenState: Float32Array;       // State entering this branch
  abortSignal: AbortController;    // Fire to prune this branch
  parentBranchId: string | null;   // null for root branches
}

interface SpeculativeTreeConfig {
  draftModel: DraftModelInterface; // Small/fast model (e.g. SmolLM2-360M)
  verifyModel: DistributedPipeline; // Full distributed model
  branchFactor: number;            // K -- candidates per step
  maxDepth: number;                // Maximum tree depth before collapsing
  minAcceptanceRate: number;       // Prune the tree if α drops below this
  scheduler: MultiplexedPrefillScheduler;
}

interface SpeculativeTreeEngine {
  // Generate the next token(s) using speculative branching
  generateSpeculative(
    context: Float32Array,
    config: SpeculativeTreeConfig
  ): Promise<{
    tokens: number[];              // Accepted token sequence (1 or more)
    acceptanceRate: number;        // Empirical α for this generation step
    branchesAttempted: number;     // How many branches ran
    branchesPruned: number;        // How many were rejected
  }>;

  // Expand the tree one level deeper for all live branches
  expandTree(
    liveBranches: SpeculativeBranch[],
    config: SpeculativeTreeConfig
  ): Promise<SpeculativeBranch[]>;

  // Verify all branches in one pipeline pass and prune losers
  verifyAndPrune(
    branches: SpeculativeBranch[],
    config: SpeculativeTreeConfig
  ): Promise<SpeculativeBranch[]>;
}
```

The key method is `verifyAndPrune`. It submits all branches as a single batched request to the full distributed pipeline, collects logits for each branch's candidate token, computes per-branch acceptance probabilities, fires `abortSignal` for rejected branches, and returns the survivors. One pipeline pass. All branches verified simultaneously.

```typescript
async function verifyAndPrune(
  branches: SpeculativeBranch[],
  config: SpeculativeTreeConfig
): Promise<SpeculativeBranch[]> {
  // Submit all branches as one batched verification request
  const batchedInput = stackHiddenStates(branches.map(b => b.hiddenState));

  // One pipeline traversal for all K branches
  const logits = await config.verifyModel.forwardBatch(batchedInput, {
    batchSize: branches.length,
    abortSignals: branches.map(b => b.abortSignal.signal),
  });

  // Verify each branch's candidate token
  const survivors: SpeculativeBranch[] = [];
  for (let i = 0; i < branches.length; i++) {
    const accepted = verifyDraftToken(
      logits[i],
      branches[i].candidateToken,
      config.draftModel.probability(branches[i].candidateToken)
    );

    if (accepted) {
      survivors.push(branches[i]);
    } else {
      branches[i].abortSignal.abort(); // Prune the branch. It never happened.
    }
  }

  return survivors;
}
```

## Performance

At K=4 candidate branches and acceptance rate α=0.8, expected tokens per pipeline pass is ~2.95. The effective generation speedup is:

| Acceptance Rate (α) | Branches (K) | Tokens per Pass | Speedup vs Sequential |
|---------------------|-------------|-----------------|----------------------|
| 0.9 | 4 | 3.44 | 3.4x |
| 0.8 | 4 | 2.95 | 3.0x |
| 0.7 | 4 | 2.40 | 2.4x |
| 0.8 | 8 | 4.60 | 4.6x |
| 0.9 | 8 | 5.69 | 5.7x |

The acceptance rate is model-pair dependent -- how well the draft model predicts the full model's choices. SmolLM2-360M against a 7B target gets roughly α=0.6-0.75 in practice. A purpose-trained draft model (fine-tuned to match the target's distribution) reaches α=0.8-0.9.

The pipeline utilization gain is additive with the speedup. Branches fill idle slots during their traversal -- the turbulent ramp-up and ramp-down slots that the Wallington Rotation left empty. A full speculative tree at K=4 occupies 16 concurrent chunks in the multiplexed scheduler (4 branches × 4 nodes' worth of pipeline depth). Pipeline Reynolds number drops to Re ≈ 0.25. Nearly laminar.

Speculation isn't an overhead. Speculation is the utilization fix the Wallington Rotation needed all along.

## The Naming

The Wallington Rotation is the trunk. One person. One stone. One pivot point at a time -- but the rotation is compound, tiling causal masking with pipeline scheduling.

The Worthington Whip is the first fork -- the moment the trunk splits into parallel shards, whips through multiple pipelines simultaneously, snaps together at the collapse. One request. Multiple pipeline states. One definite outcome.

The Speculative Tree is every fork after that. It doesn't need a person's name. It's the tree.

The tree grows through the pipeline -- forward in time, branching at every token position, racing each branch through the distributed verification pass, pruning the losers, growing the survivors. The invalid branches collapse not because of measurement but because of selection. The valid branches continue to branch. The tree grows until the tokens are done.

The Wallington Rotation told us how to move the stone. The Worthington Whip told us we could move multiple stones at once. The Speculative Tree tells us we can already be moving the next stones before we've finished placing these ones.

The pipeline wasn't a pipe. It was always a tree.
