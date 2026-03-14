# Chapter 17 Gap-Closure Checklist

- Parent README: [README.md](./README.md)
- Closure todo: [ch17-closure-todo.md](./ch17-closure-todo.md)
- Manuscript source: [ch17-arxiv-manuscript.md](./ch17-arxiv-manuscript.md)
- Formal ledger: [companion-tests/formal/THEOREM_LEDGER.md](./companion-tests/formal/THEOREM_LEDGER.md)
- Formal package: [companion-tests/formal/lean/README.md](./companion-tests/formal/lean/README.md)

This checklist turns the remaining manuscript boundaries into concrete tool surfaces. Each item names the current open boundary, the files or harnesses that own it, the closure criterion, and the first command or proof surface to push next.

## Remaining Gaps

| Gap | Tool Surfaces | Closure Criterion | First Tool Step |
| --- | --- | --- | --- |
| Richer timing/service distributions | [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [MeasureQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/MeasureQueueing.lean), bounded queue/network TLA modules in [companion-tests/formal/README.md](./companion-tests/formal/README.md) | Replace the current finite-support or discretized service-law witnesses with a mechanized family covering richer service-time distributions, while preserving the same balance or recurrence conclusions | Extend `QueueStability.lean` or `MeasureQueueing.lean` with a distribution-family theorem, then mirror it in a new bounded executable or TLA witness |
| Arbitrary exact multiclass/open-network semantics beyond bounded witnesses | [QueueingProbabilisticNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticNetworkKernel.tla), [QueueingProbabilisticLargeNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticLargeNetworkKernel.tla), [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean) | Move from the current bounded exact kernels and bounded open-network cubes to a broader exact semantics surface for multiclass open networks | Generalize the probabilistic network kernel family or add a new Lean theorem layer that preserves exact conservation beyond the current bounded witness geometries |
| Automatic discharge of traffic-equation and drift side conditions from raw network data beyond the current global sufficient criterion | [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean#L582), [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean#L174), [StateDependentQueueFamilies.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean#L1554) | Derive sharper, local, or non-uniform arrival/routing side-condition certificates directly from `(λ, P, μ)` or from raw adaptive kernels, beyond the current descending `throughputEnvelopeApprox` ladder plus its scalar and routing-shaped residual/error certificates; on the adaptive side the remaining open part is automatic discovery of richer chosen-Lyapunov decompositions beyond the built-in minimum-slack selector, raw-score normalization, positive-part normalization, explicit selector-based one-hot form, normalized weighted form, raw service-slack weighting, and raw routing-pressure weighting | Strengthen `JacksonQueueing.lean` beyond the current descending Jackson ladder and residual scaffold, or synthesize richer adaptive decompositions directly in `Axioms.lean` |
| Fully generic positive-recurrence derivations for arbitrary unbounded state-dependent open stochastic networks | [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean), [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [StateDependentQueueFamilies.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean) | Replace the current bounded-family and explicit-witness route with a general unbounded recurrence engine for state-dependent open stochastic networks | Build a generic Foster-Lyapunov or regenerative theorem layer in `QueueStability.lean`, then route the state-dependent shell through it |
| Real-time systems with strict latency bounds | Operational harnesses in [companion-tests/README.md](./companion-tests/README.md), queueing formal layer in [companion-tests/formal/README.md](./companion-tests/formal/README.md), manuscript scope at [ch17-arxiv-manuscript.md](./ch17-arxiv-manuscript.md) | Mechanize or benchmark strict latency guarantees rather than queue-length, occupancy, or mean-balance statements alone | Add a latency-bound theorem or executable gate that tracks deadline or worst-case waiting-time obligations |

## Already Closed In This Pass

| Closure | Tool Surface | Result |
| --- | --- | --- |
| Jackson raw-data sufficient witness discharge | [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean#L582) | The package now exposes a descending finite-step Jackson envelope ladder `throughputEnvelopeApprox n`, with the global, local, and second-order bounds as its first instances, supports direct nodewise service bounds against any finite step, packages `minServiceRate` as an automatic corollary for the coarsest route, gives both scalar and routing-shaped residual/error certificates from that ladder to `α_spec`, and now also brackets `α_spec` between lower real traffic iterates and upper envelope iterates |
| Adaptive comparison and drift shell | [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean#L174), [StateDependentQueueFamilies.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean#L1554) | The adaptive shell now derives the comparison and drift inequalities from explicit synthesis packages instead of taking them as naked assumptions, the concrete two-node family instantiates that route through the generic minimum-slack drift synthesizer, and the selector-based, normalized-score, service-slack, and routing-pressure routes are all available as built-in score constructors for broader families |

## Focused Commands

```bash
# Target the Jackson/raw-network closure surface
cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean
lake build ForkRaceFoldTheorems.JacksonQueueing

# Target the adaptive shell surface
lake build ForkRaceFoldTheorems.Axioms ForkRaceFoldTheorems.StateDependentQueueFamilies

# Keep manuscript wording honest against the checked artifacts
cd /Users/buley/Documents/Code/emotions/open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests
bunx vitest run src/manuscript-artifact-consistency.test.ts
```
