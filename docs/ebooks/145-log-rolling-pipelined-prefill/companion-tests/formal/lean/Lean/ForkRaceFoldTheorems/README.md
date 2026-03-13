# ForkRaceFoldTheorems

- Parent README: [../README.md](../README.md)

Modules:

- `Claims.lean`: explicit-assumption theorems with constructive proofs for core algebraic/topological identities (including Whip cross-shard crossover properties, weighted queueing expectation balance, finite-prefix truncation balance, the linear-vs-nonlinear fold boundary in §6.12, and the cancellation-target-family impossibility witness for nonlinear folds).
- `FailureEntropy.lean`: constructive failure-topology theorems for bounded live-frontier models, including local vent reduction, one-survivor/failure necessity, and coupled-repair debt monotonicity.
- `FailureFamilies.lean`: constructive failure-topology family theorems separating branch-isolating failure from contagious failure via survivor-projected deterministic fold and repair-debt forcing.
- `FailureTrilemma.lean`: constructive impossibility theorems showing that nontrivial forks cannot collapse to a deterministic single survivor with both zero vent and zero repair debt.
- `FailureComposition.lean`: constructive pipeline theorems lifting the no-free deterministic-collapse boundary across aligned stage sequences and forcing at least one paid stage in any deterministic single-survivor collapse.
- `FailureUniversality.lean`: constructive universality theorems lifting the no-free deterministic-collapse boundary to sparse normalized choice systems and arbitrary-depth recovery trajectories, including the minimum collapse-cost floor `totalVented + totalRepairDebt >= initialLive - 1` and the branch-isolating witness that attains that floor exactly.
- `FailureController.lean`: constructive controller theorems over the canonical failure-action family, choosing `keep-multiplicity`, `pay-vent`, or `pay-repair` by the minimum weighted coefficient on the exact collapse floor.
- `FailurePareto.lean`: constructive Pareto theorems over the canonical failure-action family, proving that keep, vent, and repair are all non-dominated when the collapse gap is positive.
- `Multiplexing.lean`: constructive turbulent-multiplexing monotonicity theorems for bounded recovered-overlap models.
- `StagedExpansion.lean`: constructive staged-expansion theorems for the bounded diamond witness, comparing shoulder-filling against naive peak widening at equal budget.
- `WarmupEfficiency.lean`: constructive warm-up efficiency theorems for bounded recovered-overlap models, deriving the exact threshold where weighted Wallace reduction beats added Buley cost.
- `WarmupController.lean`: constructive controller theorems for the burden/redline policy that chooses `expand`, `constrain`, or `shed-load` under one-hot topology mismatch.
- `Wallace.lean`: constructive Wallace/crank theorems for bounded three-layer frontiers, including complement, boundedness, and the symmetric diamond closed form.
- `MeasureQueueing.lean`: constructive infinite-support queueing theorems over `tsum`, countably supported stochastic laws via `PMF`, and `lintegral`, including monotone truncation-to-limit conservation.
- `QueueStability.lean`: constructive queue-family theorems for the stable `M/M/1` stationary occupancy law plus trajectory-level Cesaro/ergodic balance for unbounded open-network sample paths.
- `JacksonQueueing.lean`: constructive finite-node Jackson-network product-form occupancy theorems plus two witness constructors from the raw Jackson data, one via the least-fixed-point approximation and one via the spectral resolvent formula. The current `α` recipe is `α_spec = λ (I - P)^{-1}` under `spectralRadius P < 1`, prove the traffic equations and nodewise bounds `α_spec >= 0`, `α_spec < μ`, instantiate `spectralNetworkData`, and then use the Knaster-Tarski-style dominance bridge to transfer those bounds to `constructiveNetworkDataOfSpectral`. The file now also mechanizes adaptive comparison: `AdaptiveJacksonTrafficData`, domination by an explicit ceiling kernel, and the `supremumKernel` specialization when the pointwise ceiling remains substochastic.
- `StateDependentQueueFamilies.lean`: concrete state-dependent queue-family wrappers for vacation, retrial, reneging, and adaptive-routing kernels, together with balance theorems routed through the shared stability schema and a raw-parameter two-node adaptive rerouting witness that derives its own ceiling kernel, spectral side conditions, throughput bound, and linear drift witness.
- `Axioms.lean`: formally stated high-level theorem shells that still require deeper semantic encodings or stronger stability hypotheses beyond the constructive queueing lift, including the adaptive supremum-kernel drift shell that turns a dominating spectral candidate into a Foster-Lyapunov premise.
- `Witnesses.lean`: constructive witness catalog for the §6.12 correspondence boundary, including the linear exact witness plus nonlinear cancellation, partition, and order counterexamples.
- `WitnessExport.lean`: Lean-side exporter that serializes the witness catalog into the JSON surface consumed by the runtime tests and artifact writer.
- `AdaptiveWitnesses.lean`: constructive adaptive witness catalog for the bounded two-node raw adaptive `α` closure, including the concrete parameter point, exported `α`, drift gap, spectral radius, and theorem refs.
- `AdaptiveWitnessExport.lean`: Lean-side exporter that serializes the adaptive witness catalog into the JSON surface consumed by the runtime adaptive-supremum tests and artifact writer.
