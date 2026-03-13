# Lean Theorems

- Parent README: [../README.md](../README.md)
- Ledger: [../THEOREM_LEDGER.md](../THEOREM_LEDGER.md)
- Source root: [Lean/README.md](./Lean/README.md)

This directory contains a Lean 4 theorem package that encodes constructive and explicit-assumption theorems for core paper claims, including the algebraic boundary between linear aggregation and nonlinear selection in §6.12, the cancellation-target-family impossibility witness for nonlinear folds, the exported correspondence-boundary witness catalog consumed by the runtime tests, the failure-topology entropy theorems, the branch-isolating/contagious family split, the no-free deterministic-collapse trilemma, the composed failure-topology impossibility boundary across aligned stage sequences, the arbitrary-depth universality lift over persistent branch identity, the minimum collapse-cost floor for deterministic recovery, the exact branch-isolating witness that attains that floor, the warm-up controller redline that chooses `expand`, `constrain`, or `shed-load`, and the queueing lift from finite traces to infinite sums, stable `M/M/1` stationarity, and measure-theoretic limits.

The companion suite now exercises this package through `@affectively/aeon-logic`'s Lean sandbox for both inspection preflight and the actual mechanized build path.

## Modules

- `Lean/ForkRaceFoldTheorems.lean`: library entrypoint.
- `Lean/ForkRaceFoldTheorems/Claims.lean`: constructive proofs for quantitative claims and the §6.12 correspondence-boundary witnesses, including the cancellation-target-family theorems.
- `Lean/ForkRaceFoldTheorems/FailureEntropy.lean`: constructive proofs that local venting reduces a live-frontier entropy proxy while coupled repair debt preserves or increases it.
- `Lean/ForkRaceFoldTheorems/FailureFamilies.lean`: constructive proofs that branch-isolating failure preserves deterministic fold and zero repair debt, while contagious failure forces repair debt.
- `Lean/ForkRaceFoldTheorems/FailureTrilemma.lean`: constructive proofs that a nontrivial fork cannot deterministically collapse to a single survivor with both zero vent and zero repair debt.
- `Lean/ForkRaceFoldTheorems/FailureComposition.lean`: constructive proofs that the no-free deterministic-collapse boundary composes across aligned stage sequences and therefore forces a paid stage in any global deterministic single-survivor collapse.
- `Lean/ForkRaceFoldTheorems/FailureUniversality.lean`: constructive proofs that sparse normalized choice systems and arbitrary-depth recovery trajectories still satisfy the no-free-collapse boundary, force global waste or a paid stage, obey the lower bound `totalVented + totalRepairDebt >= initialLive - 1`, and admit an exact-cost branch-isolating collapse witness.
- `Lean/ForkRaceFoldTheorems/Multiplexing.lean`: constructive turbulent-multiplexing monotonicity proofs under fixed busy work and legal overlap recovery.
- `Lean/ForkRaceFoldTheorems/StagedExpansion.lean`: constructive staged-expansion proofs comparing shoulder-filling against naive peak widening under the same supported budget.
- `Lean/ForkRaceFoldTheorems/WarmupEfficiency.lean`: constructive warm-up efficiency proofs showing exactly when a weighted Wallace reduction is worth an added Buley cost.
- `Lean/ForkRaceFoldTheorems/WarmupController.lean`: constructive controller proofs showing when the optimal response is `expand`, `constrain`, or `shed-load` relative to the Burden Scalar redline.
- `Lean/ForkRaceFoldTheorems/Wallace.lean`: constructive Wallace/crank theorems for bounded three-layer frontiers and the symmetric diamond witness.
- `Lean/ForkRaceFoldTheorems/MeasureQueueing.lean`: constructive queueing theorems for `tsum`, countably supported stochastic laws via `PMF`, `lintegral`, and monotone truncation-to-limit balance.
- `Lean/ForkRaceFoldTheorems/QueueStability.lean`: constructive queue-family theorems for the stable `M/M/1` stationary law and trajectory-level Cesaro balance for unbounded open-network sample paths.
- `Lean/ForkRaceFoldTheorems/JacksonQueueing.lean`: constructive Jackson-network product-form occupancy theorems together with two witness-entry paths from the network data: a least-fixed-point `constructiveThroughput` route and a resolvent-style `spectralThroughput` route. The remaining work is to discharge nonnegativity/stability automatically from the raw routing and service assumptions.
- `Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean`: constructive wrappers for vacation, retrial, reneging, and adaptive-routing queue families built on the shared state-dependent stability schemas, together with a raw-parameter two-node adaptive rerouting witness that derives its own ceiling kernel, spectral side conditions, throughput bound, and linear drift witness.
- `Lean/ForkRaceFoldTheorems/Axioms.lean`: assumption-parameterized theorem schemas for global claims that still need extra semantic or stability hypotheses, including a state-dependent queue shell whose recurrence/stationary-law layer is derived from explicit kernel witnesses and the adaptive supremum-kernel drift shell.
- `Lean/ForkRaceFoldTheorems/Witnesses.lean`: constructive witness catalog for the §6.12 correspondence boundary, covering exact linear cancellation plus nonlinear cancellation/partition/order counterexamples.
- `Lean/ForkRaceFoldTheorems/WitnessExport.lean`: Lean-side JSON exporter for the witness catalog used by `scripts/formal-witness-catalog.ts`.
- `Lean/ForkRaceFoldTheorems/AdaptiveWitnesses.lean`: constructive adaptive witness catalog for the bounded two-node raw adaptive `α` closure, including the exported ceiling/drift invariants and theorem refs.
- `Lean/ForkRaceFoldTheorems/AdaptiveWitnessExport.lean`: Lean-side JSON exporter for the adaptive witness catalog used by `scripts/formal-adaptive-witness-catalog.ts`.

## Stable Throughput Witness `α`

The current route is:

1. Form `α_spec := JacksonTrafficData.spectralThroughput`, the resolvent candidate `λ (I - P)^{-1}` under `spectralRadius P < 1`.
2. Prove the traffic equations with `spectralThroughput_fixed_point`, so `α_spec` is a genuine fixed point.
3. Discharge the still-external side conditions `0 <= α_spec i` and `α_spec i < μ_i`.
4. Use `JacksonTrafficData.spectralNetworkData` as the direct product-form witness.
5. Promote the same candidate to the monotone least-fixed-point path with the Knaster-Tarski-style dominance bridge `constructiveThroughput_le_of_real_fixed_point`, specialized by `constructiveThroughput_le_spectralThroughput`, and conclude finiteness/stability via `constructiveThroughput_finite_of_spectral`, `constructiveThroughput_stable_of_spectral`, and `constructiveNetworkDataOfSpectral`.

What remains open is deriving those side conditions from `(λ, P, μ)` alone without providing them as separate hypotheses.

## Adaptive Stability Transfer

The adaptive extension is now split into two layers.

1. `JacksonQueueing.AdaptiveJacksonTrafficData` mechanizes the comparison principle: state-indexed routing steps are bounded by any dominating Jackson kernel, and the `supremumKernel` specialization recovers the user-facing ceiling construction when that pointwise ceiling is still substochastic.
2. `Axioms.AdaptiveSupremumStabilityAssumptions` packages the remaining Lyapunov step: if the adaptive kernel is dominated by that ceiling and the ceiling's spectral candidate induces drift, then the existing state-dependent stability and terminal-balance schemas apply. At that point positive recurrence and stationary-law existence are derived by the base schema from explicit bridge/drift/small-set witnesses instead of being supplied as free props.
3. `StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters` now closes one concrete raw adaptive family end to end: from nonnegative arrivals, a reroute probability `0 <= p < 1`, and nodewise service slack, it constructs the dominating ceiling kernel, proves the ceiling's strict row-substochastic spectral side conditions, bounds the adaptive constructive throughput by a closed-form candidate, derives a linear drift witness on the bounded adaptive state space, and bridges that witness into the generic stationary/terminal balance schema with only the honest residual recurrence assumptions left explicit.
4. `AdaptiveWitnesses.lean` now exports that same concrete raw adaptive family as a machine-readable witness catalog, so the bounded two-node adaptive `α` closure is consumed by runtime artifact checks instead of remaining only an internal theorem package detail.

The open part is now the generic one you called out: deriving comparable drift witnesses and spectral side conditions for arbitrary raw adaptive kernels without supplying them as separate assumptions.

## Run

```bash
bun run test:formal:lean
bun run test:formal:adaptive-witnesses
bash ../../scripts/run-lean-theorems.sh
```

Both commands route through `runLeanSandbox`; the first invokes the TypeScript entrypoint directly, and the shell wrapper preserves the historical command surface.
