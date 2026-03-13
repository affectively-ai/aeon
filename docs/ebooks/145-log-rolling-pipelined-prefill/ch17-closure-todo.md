# Chapter 17 Closure Todo

- Parent README: [README.md](./README.md)
- Gap checklist: [ch17-gap-closure-checklist.md](./ch17-gap-closure-checklist.md)
- Manuscript source: [ch17-arxiv-manuscript.md](./ch17-arxiv-manuscript.md)
- Formal ledger: [companion-tests/formal/THEOREM_LEDGER.md](./companion-tests/formal/THEOREM_LEDGER.md)

This is the short, execution-ordered list of what still remains before the Chapter 17 formal boundary can honestly be called closed.

## Immediate Proof Targets

- [ ] Derive a sharper Jackson envelope family directly from raw `(λ, P, μ)` than the current finite-step ladder.
  Tool surfaces: [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean)
  Current floor: the package already has the generic finite-step family `throughputEnvelopeApprox n`, with `n = 0` the global envelope, `n = 1` the nodewise `localThroughputEnvelope`, `n = 2` the deeper `secondOrderThroughputEnvelope`, plus the `minServiceRate` corollary.
  Next useful move: derive a sharper closed-form or convergence-aware local certificate that uses more routing structure than the current finite-step summaries.

- [ ] Synthesize richer adaptive Lyapunov decompositions from raw adaptive kernels.
  Tool surfaces: [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean), [StateDependentQueueFamilies.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean)
  Current floor: the shell already supports minimum-slack, normalized nonnegative scores, positive-part normalized real scores, explicit selectors, and normalized weighted decompositions.
  Next useful move: derive one of those decompositions from kernel-generated score fields automatically, instead of asking the caller to supply the score field itself.

## Remaining Outer Boundary

- [ ] Extend beyond bounded exact multiclass/open-network witnesses.
  Tool surfaces: [QueueingProbabilisticNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticNetworkKernel.tla), [QueueingProbabilisticLargeNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticLargeNetworkKernel.tla), [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean)

- [ ] Add richer timing or service-law families beyond the current finite-support or discretized witnesses.
  Tool surfaces: [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [MeasureQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/MeasureQueueing.lean)

- [ ] Replace the current bounded-family recurrence route with a genuinely generic unbounded state-dependent positive-recurrence engine.
  Tool surfaces: [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean)

- [ ] Add strict latency or deadline-style guarantees instead of queue-length and mean-balance statements alone.
  Tool surfaces: [companion-tests/README.md](./companion-tests/README.md), [companion-tests/formal/README.md](./companion-tests/formal/README.md)

## Already Closed In This Pass

- [x] Jackson raw-data spectral/constructive witness transfer from the global max-external/max-incoming envelope.
- [x] Jackson finite-step ladder `throughputEnvelopeApprox n`.
- [x] Jackson nodewise local-throughput envelope `λ_i + incomingMass_i * maxExternalArrival / (1 - maxIncomingRoutingMass)`.
- [x] Jackson second-order envelope `λ_i + ∑_j localThroughputEnvelope_j P_{j i}`.
- [x] Adaptive ceiling comparison and derived drift shell.
- [x] Adaptive minimum-slack bottleneck synthesis.
- [x] Adaptive normalized-score synthesis.
- [x] Adaptive positive-part normalization for arbitrary real score fields.
- [x] Concrete bounded two-node adaptive raw-ceiling family, formal export, and runtime witness bridge.

## Focused Commands

```bash
# Jackson envelope work
cd /Users/buley/Documents/Code/emotions/open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean
lake build ForkRaceFoldTheorems.JacksonQueueing

# Adaptive synthesis work
lake build ForkRaceFoldTheorems.Axioms ForkRaceFoldTheorems.StateDependentQueueFamilies

# Manuscript drift guard
cd /Users/buley/Documents/Code/emotions/open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests
bunx vitest run src/manuscript-artifact-consistency.test.ts
```
