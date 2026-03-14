# Chapter 17 Closure Todo

- Parent README: [README.md](./README.md)
- Gap checklist: [ch17-gap-closure-checklist.md](./ch17-gap-closure-checklist.md)
- Manuscript source: [ch17-arxiv-manuscript.md](./ch17-arxiv-manuscript.md)
- Formal ledger: [companion-tests/formal/THEOREM_LEDGER.md](./companion-tests/formal/THEOREM_LEDGER.md)

This is the short, tool-based list of what still remains before the Chapter 17 formal boundary can honestly be called closed.

## Right Now

- [ ] Tighten the Jackson envelope ladder from the current residual-certified convergence scaffold to a sharper closed-form local certificate.
  Tool surfaces: [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean)
  Current floor: the package already has the generic finite-step family `throughputEnvelopeApprox n`, with `n = 0` the global envelope, `n = 1` the nodewise `localThroughputEnvelope`, `n = 2` the deeper `secondOrderThroughputEnvelope`, the descending-ladder theorem `throughputEnvelopeApprox_succ_le`, the scalar residual/error certificates, the lower-side residual certificate, the formal lower/upper bracket `(trafficApprox lowerStep).toReal ≤ α_spec ≤ throughputEnvelopeApprox upperStep`, and now the routing-shaped node-local residual ladder `throughputResidualApprox n`.
  Next useful move: derive a closed-form certificate or a still-sharper local certificate beyond the current ladder-plus-node-local-residual scaffold.

- [ ] Synthesize richer adaptive Lyapunov decompositions from raw adaptive kernels instead of from caller-supplied score fields.
  Tool surfaces: [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean), [StateDependentQueueFamilies.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean)
  Current floor: the shell already supports minimum-slack, normalized nonnegative scores, positive-part normalized real scores, explicit selectors, normalized weighted decompositions, raw service-slack scores, and raw routing-pressure scores.
  Next useful move: derive still-richer decomposition identities directly from arbitrary chosen Lyapunov expressions, beyond the current built-in minimum-slack/score/service-slack/routing-pressure families.

## Next After That

- [ ] Extend beyond bounded exact multiclass/open-network witnesses.
  Tool surfaces: [QueueingProbabilisticNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticNetworkKernel.tla), [QueueingProbabilisticLargeNetworkKernel.tla](./companion-tests/formal/QueueingProbabilisticLargeNetworkKernel.tla), [JacksonQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean)
  Closure condition: exact multiclass/open-network semantics are no longer limited to the current bounded witness geometries.

- [ ] Add richer timing or service-law families beyond the current finite-support or discretized witnesses.
  Tool surfaces: [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [MeasureQueueing.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/MeasureQueueing.lean)
  Closure condition: richer service-time distributions preserve the same balance or recurrence conclusions without collapsing back to discretized witnesses.

- [ ] Replace the current bounded-family recurrence route with a genuinely generic unbounded state-dependent positive-recurrence engine.
  Tool surfaces: [QueueStability.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/QueueStability.lean), [Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean)
  Closure condition: the recurrence layer no longer depends on bounded-family or explicit finite-state witness packaging.

- [ ] Add strict latency or deadline-style guarantees instead of queue-length and mean-balance statements alone.
  Tool surfaces: [companion-tests/README.md](./companion-tests/README.md), [companion-tests/formal/README.md](./companion-tests/formal/README.md)
  Closure condition: the package proves or checks deadline and worst-case waiting-time obligations, not only occupancy or mean-balance facts.

## Closed So Far

- [x] Jackson raw-data spectral/constructive witness transfer from the global max-external/max-incoming envelope.
- [x] Jackson finite-step ladder `throughputEnvelopeApprox n`.
- [x] Jackson descending-ladder monotonicity `throughputEnvelopeApprox (n + 1) ≤ throughputEnvelopeApprox n`.
- [x] Jackson explicit residual/error certificate `|throughputEnvelopeApprox n - α_spec| ≤ throughputEnvelopeResidual n`.
- [x] Jackson lower-side residual certificate `α_spec - (trafficApprox n).toReal ≤ throughputEnvelopeResidual (n + 1)`.
- [x] Jackson lower/upper interval bracket `(trafficApprox lowerStep).toReal ≤ α_spec ≤ throughputEnvelopeApprox upperStep`.
- [x] Jackson routing-shaped node-local residual ladder `throughputResidualApprox n`.
- [x] Jackson nodewise local-throughput envelope `λ_i + incomingMass_i * maxExternalArrival / (1 - maxIncomingRoutingMass)`.
- [x] Jackson second-order envelope `λ_i + ∑_j localThroughputEnvelope_j P_{j i}`.
- [x] Adaptive ceiling comparison and derived drift shell.
- [x] Adaptive minimum-slack bottleneck synthesis.
- [x] Adaptive normalized-score synthesis.
- [x] Adaptive positive-part normalization for arbitrary real score fields.
- [x] Adaptive raw service-slack and routing-pressure score synthesis.
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
