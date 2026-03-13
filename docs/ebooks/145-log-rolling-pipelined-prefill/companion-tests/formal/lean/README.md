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
- `Lean/ForkRaceFoldTheorems/Axioms.lean`: assumption-parameterized theorem schemas for global claims that still need extra semantic or stability hypotheses.
- `Lean/ForkRaceFoldTheorems/Witnesses.lean`: constructive witness catalog for the §6.12 correspondence boundary, covering exact linear cancellation plus nonlinear cancellation/partition/order counterexamples.
- `Lean/ForkRaceFoldTheorems/WitnessExport.lean`: Lean-side JSON exporter for the witness catalog used by `scripts/formal-witness-catalog.ts`.

## Stable Throughput Witness `α`

The current route is:

1. Form `α_spec := JacksonTrafficData.spectralThroughput`, the resolvent candidate `λ (I - P)^{-1}` under `spectralRadius P < 1`.
2. Prove the traffic equations with `spectralThroughput_fixed_point`, so `α_spec` is a genuine fixed point.
3. Discharge the still-external side conditions `0 <= α_spec i` and `α_spec i < μ_i`.
4. Use `JacksonTrafficData.spectralNetworkData` as the direct product-form witness.
5. Promote the same candidate to the monotone least-fixed-point path with the Knaster-Tarski-style dominance bridge `constructiveThroughput_le_of_real_fixed_point`, specialized by `constructiveThroughput_le_spectralThroughput`, and conclude finiteness/stability via `constructiveThroughput_finite_of_spectral`, `constructiveThroughput_stable_of_spectral`, and `constructiveNetworkDataOfSpectral`.

What remains open is deriving those side conditions from `(λ, P, μ)` alone without providing them as separate hypotheses.

## Run

```bash
bun run test:formal:lean
bash ../../scripts/run-lean-theorems.sh
```

Both commands route through `runLeanSandbox`; the first invokes the TypeScript entrypoint directly, and the shell wrapper preserves the historical command surface.
