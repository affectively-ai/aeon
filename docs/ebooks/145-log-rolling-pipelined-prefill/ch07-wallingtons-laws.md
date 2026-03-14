# Chapter 7: Wallington's Laws and Software Engineering

## The Three Laws

Wally Wallington, a retired construction worker from Michigan, demonstrated that one person could move, lift, and position 20-ton stones using techniques consistent with ancient megalithic construction. His methods reduce to three engineering principles that apply directly to distributed systems design.

### Law 1: Force Multiplication

*The longer the lever, the less effort required.*

In the prefill pipeline, the "lever" is the number of nodes. Each additional node extends the pipeline depth, and the speedup scales linearly: P+(N-1) approaches P as N grows. We didn't work harder  --  we made the lever longer.

In software, force multiplication means finding the dimension that scales your impact. Adding a cache is a lever. Adding a pipeline stage is a lever. Adding a thread is a lever. The key is identifying which dimension actually reduces the constraint.

The prefill bottleneck wasn't compute-bound (each node had idle time). It was coordination-bound  --  the sequential loop imposed artificial serialization. The lever was pipeline depth, not faster nodes.

### Law 2: Friction Reduction

*The smaller the contact point (the pivot), the less resistance.*

Wallington's master pivots were deliberately small  --  a single stone under a multi-ton block. The smaller the contact area, the less friction, and the easier the rotation.

In the pipeline, friction appears as:
- **Memory copies** between stages (`new Float32Array(r.hiddenStates)`)
- **Promise overhead** (`Promise.race()` on each iteration)
- **Logging and diagnostics** (string interpolation per token)

The pipeline minimizes friction by:
- Using `subarray()` for zero-copy embedding access
- Keeping the per-iteration bookkeeping minimal (one slot array, one counter)
- Logging only at first/last tokens, not every position

Every byte copied, every object allocated, every branch evaluated is friction. The ideal pipeline would be a zero-copy, zero-allocation relay where buffers flow from node to node without touching the coordinator's heap.

### Law 3: Gravity Harvest

*Use the weight of the object as the "battery" to power the next movement.*

Wallington didn't fight gravity  --  he used it. When rocking a stone on a pivot, gravity pulls the heavy side down, which lifts the light side. The stone's own weight does the work.

In the pipeline, "gravity" is the natural pressure of queued work. When Node 0 finishes Token 0, Token 1 is already waiting (it was enqueued when Token 0 was dispatched). The pipeline fills and then runs at steady state  --  each completion triggers the next dispatch without external scheduling. The momentum is self-sustaining.

This is distinct from a work-stealing scheduler or a thread pool, which require active coordination. The pipeline's gravity is structural: the `Promise.race()` loop and dispatch-on-free pattern create a natural flow where work moves forward without being pushed.

## The Master Pivot

Wallington's most important technique isn't any single mechanism  --  it's the ability to **identify the pivot point** in any configuration of mass and geometry. Given an arbitrary stone, he finds the point where a small force creates maximum rotation.

In software, the master pivot is the **minimal change that restructures the computational geometry**. For prefill, it was replacing two nested sequential loops with `Promise.race()` and a slot array. The data dependencies didn't change. The network calls didn't change. The error handling didn't change. We moved the pivot point, and the system started walking.

The art is in the identification, not the implementation. The pipeline implementation is ~150 lines. The insight  --  that per-node ordering is sufficient, not global ordering  --  is one sentence. But that sentence took reading the code, understanding the KV cache semantics, and asking: *"What am I waiting for that I don't actually need?"*

## Finding Pivots in Your Own Systems

Questions to ask:

1. **"What am I waiting for?"**  --  Every `await` in a loop is a claim that the next iteration depends on this one. Is that claim true?

2. **"What does each worker actually need from the previous step?"**  --  Often less than you think. The node needs its own KV entries, not the global state.

3. **"Where is the mass, and where is the contact point?"**  --  The "mass" is the total work (P×N steps). The "contact point" is the constraint that serializes it. Shrink the contact point.

4. **"Can gravity do the work?"**  --  If completions naturally trigger the next dispatch, you have a gravity-powered pipeline. If you need a scheduler, you're fighting gravity.

5. **"What happens if this fails mid-rotation?"**  --  Wallington's offset fulcrum ensured stones settled back onto the crib if a board slipped. The NaN poison drain ensures the pipeline settles onto the last valid state if data goes bad.

## The Broader Pattern

Every optimization in this volume follows the same pattern:

1. **Identify the serialization point** (the `await` in the inner loop)
2. **Question the dependency claim** (does Token 1 really need Token 0's result from all nodes?)
3. **Find the minimal ordering guarantee** (per-node, not global)
4. **Restructure the loop to exploit the weaker guarantee** (`Promise.race()` pipeline)
5. **Handle the new failure modes** (NaN drain, tunneling)
6. **Verify correctness** (9 tests covering ordering, edge cases, speedup)

This is Wallington's method. Find the pivot. Test the balance. Walk the stone.
