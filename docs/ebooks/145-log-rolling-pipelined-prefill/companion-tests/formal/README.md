# Formal Verification Artifacts (TLA+ + Lean)

- Parent README: [../README.md](../README.md)
- Theorem ledger: [THEOREM_LEDGER.md](./THEOREM_LEDGER.md)
- Lean package: [lean/README.md](./lean/README.md)

This directory contains machine-checked formal artifacts used to mechanize the paper's strongest quantitative and topological claims.

## Files

- `ForkRaceFoldC1C4.tla` / `.cfg`: pipeline locality, branch isolation, deterministic fold, bounded termination (C1–C4).
- `QueueingSamplePath.tla` / `.cfg`: finite-trace sample-path Little's Law identity over all work-conserving single-server disciplines in the bounded discrete model.
- `QueueingMultiClassNetwork.tla` / `.cfg`: bounded multi-class open-network conservation law with class-specific routes and finite service-law scenarios under node-local work-conserving dispatch.
- `QueueingStochasticMixture.tla` / `.cfg`: finite-support stochastic multiclass open-network conservation with positive scenario masses and scenario-dependent arrivals, routes, and service realizations.
- `QueueingProbabilisticKernel.tla` / `.cfg`: exact finite-state probabilistic transition kernel for a bounded FIFO queue, with direct distribution-level conservation checks.
- `QueueingProbabilisticNetworkKernel.tla` / `.cfg`: exact finite-state probabilistic multiclass open-network kernel over class-dependent routes, with direct distribution-level conservation checks and the minimal worst-case small-data ramp-up witness.
- `QueueingProbabilisticLargeNetworkKernel.tla` / `.cfg`: larger exact finite-support three-arrival multiclass open-network cube with direct weighted conservation checks over the full 64-branch arrival family.
- `Section7Formulas.tla` / `.cfg`: §7 formulas (Worthington Whip, Speculative Tree, turbulent idle fraction sample, and the frontier-fill / occupancy-deficit complement that reduces to the same idle fraction in the canonical pipeline case).
- `WallaceMetric.tla` / `.cfg`: Wallace metric (`crank`) boundedness/complement on a bounded three-layer frontier, plus the symmetric diamond closed form `2(k-1)/(3k)` and the zero-at-unit-width witness.
- `MultiplexingMonotonicity.tla` / `.cfg`: bounded turbulent-multiplexing monotonicity witness showing fixed useful work plus legal overlap recovery cannot increase the Wallace metric and strictly lowers it when overlap is recovered.
- `FailureEntropy.tla` / `.cfg`: bounded witness for structured failure as live-frontier entropy reduction, including the single-survivor/failure necessity law and the coupled-repair reversal case.
- `FailureFamilies.tla` / `.cfg`: bounded witness for the stronger failure-topology split between branch-isolating failure and contagious failure, including deterministic-fold preservation, zero-repair-debt isolation, and contagious repair-debt forcing.
- `FailureTrilemma.tla` / `.cfg`: bounded impossibility witness for no-free deterministic collapse, showing that a nontrivial fork cannot reach a deterministic single survivor with both zero vent and zero repair debt.
- `FailureComposition.tla` / `.cfg`: bounded composed-pipeline witness showing that the no-free deterministic-collapse boundary persists across multiple stages, so any global deterministic single-survivor collapse must pay vent or repair debt in at least one stage.
- `FailureUniversality.tla` / `.cfg`: bounded arbitrary-depth witness over stage-indexed recovery arrays, showing that the no-free-collapse boundary survives normalization to persistent branch identity, forces a paid stage, imposes the minimum collapse-cost floor `totalVented + totalRepairDebt >= initialLive - 1`, and includes a canonical zero-debt witness that attains that floor exactly.
- `FailureController.tla` / `.cfg`: bounded controller witness over the canonical failure actions `keep-multiplicity`, `pay-vent`, and `pay-repair`, showing that the score-minimizing choice is whichever weighted coefficient is smallest against the exact collapse floor `liveBranches - 1`.
- `FailurePareto.tla` / `.cfg`: bounded Pareto witness over the same canonical failure-action family, showing that keep, vent, and repair are pairwise non-dominating when `liveBranches > 1`.
- `StagedExpansion.tla` / `.cfg`: bounded staged-expansion witness showing that, under a positive topology-deficit budget, spending equal added frontier on underfilled shoulders beats naive peak widening in frontier fill and Wallace.
- `WarmupEfficiency.tla` / `.cfg`: bounded warm-up efficiency witness showing exactly when a weighted Wallace reduction is worth an added Buley cost under fixed useful work and legal recovered overlap.
- `DynamicWarmupEfficiency.tla` / `.cfg`: dynamic entropy-creep/active-cooling witness showing bounded overlap and eventual return to laminar flow once the warm-up burden threshold becomes reachable and cooling can clear the boundary layer.
- `WarmupController.tla` / `.cfg`: bounded controller witness showing the optimal one-step action split between `expand`, `constrain`, and `shed-load`, with the redline at `BurdenScalar < deficitWeight + shedPenalty`.
- `WhipCrossover.tla` / `.cfg`: §7.3 cross-shard correction crossover characterization (`T(S)=ceil(P/S)+(N-1)+C*S`) with finite optimum and strict-over-sharding boundary checks.
- `QuantumDeficit.tla` / `.cfg`: §6.12 speedup = topological deficit identity (Grover-scale sample).
- `BeautyOptimality.tla` / `.cfg`: §6.12 Bu beauty-optimality scaffold (definition, latency/waste monotonicity, Pareto/composition invariants).
- `BandGapVoid.tla` / `.cfg`: §6.11 band gaps as voids (`β₂ > 0`) on a finite periodic-energy sample.
- `ProtocolDeficit.tla` / `.cfg`: §8.3 protocol topology deficits (TCP vs QUIC/Aeon Flow).
- `SettlementDeficit.tla` / `.cfg`: §6.12 evidence-table settlement deficit (`Δβ = 2` for T+2 sequential baseline).
- `SchedulerBound.tla` / `.cfg`: conditional scheduler-overhead bound used in §11 performance wording (additive decomposition, bounded overhead, handler-independence under explicit assumptions).
- `lean/Lean/ForkRaceFoldTheorems/Claims.lean`: constructive Lean theorems for quantitative identities, including finite weighted queueing expectation balance, finite-prefix truncation balance, and the linear-additive vs nonlinear-selection correspondence boundary used in §6.12, including the cancellation-target-family impossibility witness for nonlinear folds.
- `lean/Lean/ForkRaceFoldTheorems/Witnesses.lean`: constructive witness catalog for the correspondence boundary, exporting concrete cancellation, partition, and order counterexamples from the Lean package itself.
- `lean/Lean/ForkRaceFoldTheorems/WitnessExport.lean`: Lean-side serializer that turns the witness catalog into the JSON surface consumed by the companion runtime tests and formal-witness artifact writer.
- `lean/Lean/ForkRaceFoldTheorems/AdaptiveWitnesses.lean`: constructive adaptive witness catalog for the bounded two-node raw adaptive `α` closure, exporting the concrete ceiling/drift witness values and theorem refs from the Lean package itself.
- `lean/Lean/ForkRaceFoldTheorems/AdaptiveWitnessExport.lean`: Lean-side serializer that turns the adaptive witness catalog into the JSON surface consumed by the companion runtime adaptive-witness tests and artifact writer.
- `lean/Lean/ForkRaceFoldTheorems/FailureEntropy.lean`: constructive Lean theorems for structured failure as live-frontier entropy reduction, including one-survivor/failure necessity and coupled-repair debt monotonicity.
- `lean/Lean/ForkRaceFoldTheorems/FailureFamilies.lean`: constructive Lean theorems for the stronger failure-topology family split, separating branch-isolating failure from contagious failure via deterministic-fold preservation and repair-debt forcing.
- `lean/Lean/ForkRaceFoldTheorems/FailureTrilemma.lean`: constructive Lean theorems for the no-free deterministic-collapse boundary, including the proof that deterministic single-survivor collapse must pay either vented loss or repair debt.
- `lean/Lean/ForkRaceFoldTheorems/FailureComposition.lean`: constructive Lean theorems lifting the no-free deterministic-collapse boundary to aligned stage sequences, proving that any deterministic single-survivor pipeline collapse contains a paid stage.
- `lean/Lean/ForkRaceFoldTheorems/FailureUniversality.lean`: constructive Lean theorems for sparse normalized choice systems and arbitrary-depth recovery trajectories, proving that deterministic fold, zero vent, and zero debt cannot coexist globally at any depth, that deterministic collapse must pay at least the fork-width-minus-one cost floor, and that a branch-isolating witness attains that floor exactly.
- `lean/Lean/ForkRaceFoldTheorems/FailureController.lean`: constructive controller theorems over the canonical failure-action family, proving that the weighted score-minimizing policy picks keep, vent, or repair according to the minimum coefficient on the exact collapse floor.
- `lean/Lean/ForkRaceFoldTheorems/FailurePareto.lean`: constructive Pareto theorems over the canonical failure-action family, proving that keep, vent, and repair all lie on the non-dominated frontier when the collapse gap is positive.
- `lean/Lean/ForkRaceFoldTheorems/Wallace.lean`: constructive Lean theorems for the Wallace/crank metric on a three-layer frontier, including boundedness, complement, zero-fullness equivalence, and the symmetric diamond closed form.
- `lean/Lean/ForkRaceFoldTheorems/Multiplexing.lean`: constructive Lean theorems for turbulent-multiplexing monotonicity under fixed useful work and legal overlap recovery.
- `lean/Lean/ForkRaceFoldTheorems/StagedExpansion.lean`: constructive Lean theorems for staged-expansion dominance over naive peak widening under the same positive deficit-supported budget.
- `lean/Lean/ForkRaceFoldTheorems/WarmupEfficiency.lean`: constructive Lean theorems for the exact warm-up tradeoff threshold between weighted Wallace reduction and added Buley cost.
- `lean/Lean/ForkRaceFoldTheorems/WarmupController.lean`: constructive Lean theorems for the score-minimizing controller that selects `expand`, `constrain`, or `shed-load` from the burden/redline regime.
- `lean/Lean/ForkRaceFoldTheorems/MeasureQueueing.lean`: constructive Lean theorems for infinite weighted queue sums, countably supported stochastic queue laws via `PMF`, measure-theoretic `lintegral` conservation, and monotone truncation-to-limit lifting of queue customer-time balance.
- `lean/Lean/ForkRaceFoldTheorems/QueueStability.lean`: constructive Lean theorems for the stable `M/M/1` stationary occupancy law, its finite first moment, and trajectory-level Cesaro balance for unbounded open-network sample paths.
- `lean/Lean/ForkRaceFoldTheorems/JacksonQueueing.lean`: constructive Lean theorems for a finite-node product-form open-network occupancy law under a stable throughput witness satisfying the Jackson traffic equations, together with in-package witness constructors from the least fixed-point approximation (`constructiveThroughput`) and the resolvent-style spectral formula (`spectralThroughput`) once their side conditions are discharged.
- `lean/Lean/ForkRaceFoldTheorems/StateDependentQueueFamilies.lean`: constructive state-dependent queue-family wrappers for vacation, retrial, reneging, and adaptive-routing kernels, all funneled through the shared stationary/terminal balance schemas, plus a raw-parameter two-node adaptive rerouting witness that derives its own ceiling kernel, spectral side conditions, throughput bound, and linear drift witness.
- `lean/Lean/ForkRaceFoldTheorems/Axioms.lean`: explicit-assumption theorem schemas for global claims, including convergence in the modeled finite class, stronger queue-limit shells, a Foster-Lyapunov/irreducibility stability schema for state-dependent open-network stationary and terminal queue balance, and an adaptive supremum-kernel comparison shell that turns a dominating spectral candidate into a drift hypothesis.

## Current Boundary

- `JacksonQueueing.lean` now exposes two in-package witness paths: `constructiveThroughput` for the least fixed-point approximation and `spectralThroughput` for the closed-form resolvent candidate.
- The package now proves that any nonnegative real fixed point bounds `constructiveThroughput`, so the spectral candidate can certify finiteness and stability for the iterative witness once its own side conditions are shown.
- The current in-package route to a stable throughput witness `α` is explicit: set `α_spec := spectralThroughput = λ (I - P)^{-1}` under `spectralRadius P < 1`, prove `α_spec >= 0`, prove `α_spec < μ`, instantiate `spectralNetworkData`, then transfer those same bounds through `constructiveThroughput_le_spectralThroughput`, `constructiveThroughput_finite_of_spectral`, and `constructiveThroughput_stable_of_spectral` to obtain `constructiveNetworkDataOfSpectral`.
- The full "Jackson Gap" closure path is now readable as one formal pipeline from raw data `(λ, P, μ)`: build the resolvent candidate, prove the traffic equations with `spectralThroughput_fixed_point`, discharge nodewise stability `α_i < μ_i`, then apply the Knaster-Tarski-style dominance bridge `constructiveThroughput_le_of_real_fixed_point` to force finiteness and stability of the constructive witness.
- Adaptive routing now has a mechanized comparison layer: `AdaptiveJacksonTrafficData` supports state-indexed routing kernels, any dominating Jackson kernel bounds the adaptive constructive witness, and the `supremumKernel` specialization closes the comparison when the pointwise ceiling remains substochastic and contractive.
- The adaptive drift story is no longer purely schematic: `StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters` derives an explicit ceiling kernel, proves the ceiling is strict-row-substochastic and spectrally contractive, bounds the adaptive constructive throughput by a closed-form candidate, and produces a linear drift witness on the bounded adaptive state space.
- The generic adaptive lift still remains honest about its boundary: constructive domination by the supremum or another dominating kernel is proved in `JacksonQueueing.lean`, while the fully generic Lyapunov-to-positive-recurrence lift for arbitrary raw adaptive kernels stays assumption-parameterized in `Axioms.AdaptiveSupremumStabilityAssumptions`.
- The remaining Jackson-network gap is automatic discharge of witness side conditions from raw network data: proving the chosen candidate is nonnegative, finite, and strictly below service rates without supplying those proofs separately.
- `Axioms.lean` remains the location for the stronger state-dependent stability, limit, and convergence shells that still need concrete model instantiations.

## Run

From `companion-tests/`:

```bash
bun run test:formal:parser
bun run test:formal:lean
bun run test:formal:witnesses
bun run test:formal:adaptive-witnesses
bun run test:formal
```

`test:formal:parser` validates all `.tla/.cfg` artifacts and inspects the Lean project through the self-hosted `aeon-logic` parser/sandbox surface.
`test:formal:lean` builds all Lean theorem modules through `aeon-logic`'s `runLeanSandbox`, which in turn requires a successful `lake build`.
`test:formal:witnesses` builds the Lean witness module, exports the constructive correspondence-boundary counterexamples, and refreshes the runtime-facing witness artifact.
`test:formal:adaptive-witnesses` builds the adaptive witness module, exports the concrete bounded two-node adaptive `α` witness, and refreshes the runtime-facing adaptive witness artifact.
`test:formal` runs parser preflight, Lean build and TLC model checking.
