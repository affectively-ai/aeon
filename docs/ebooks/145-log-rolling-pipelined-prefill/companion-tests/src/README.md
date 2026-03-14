# Companion Test Sources

- Parent README: [../README.md](../README.md)

Vitest suites that provide executable claim coverage for the manuscript.

## Files

- `pipeline-topology.test.ts`: triangle/order/betti lifecycle checks.
- `pipeline-formulas.test.ts`: §7 formula checks, including frontier-fill / occupancy-deficit complements, Whip crossover characterization, and A1/A2 assumption-boundary falsification checks for step-count speedups.
- `cross-shard-stochastic.test.ts`: finite stochastic-service and adaptive-sharding crossover characterization for Worthington Whip.
- `dag-completeness.test.ts`: executable finite-DAG fork/join/chain decomposition coverage.
- `flow-protocol.test.ts`: flow framing and wire semantics.
- `topological-compression.test.ts`: codec race/fold behavior.
- `queueing-subsumption.test.ts`: queueing boundary cases plus exhaustive finite-trace work-conserving discipline coverage, sample-path Little's Law identities, bounded multiclass network conservation checks, finite-support stochastic-mixture expectation checks, exact probabilistic queue/network-kernel propagation checks, a larger exact three-slot multiclass-network witness, and an explicit worst-case small-data ramp-up witness.
- `thermodynamics.test.ts`: First Law, entropy bounds, overhead checks.
- `quantum-topology.test.ts`: quantum deficit identity, band-gap, convergence simulation.
- `quantum-correspondence-boundary.test.ts`: finite path-sum linear-fold equivalence checks, partition/permutation invariants, and nonlinear winner/early-stop counterexamples that bound the quantum correspondence claim.
- `quantum-recombination-ablation.test.ts`: same-path-family ablation harness showing which invariants survive when linear recombination is replaced by winner-take-all or early-stop selection.
- `statistics.ts`: local bootstrap-interval helpers used by the artifact-backed ablation reports.
- `toy-attention-fold-ablation.test.ts`: fixed-parameter toy attention ablation showing the behavioral cost of swapping only the fold rule while holding keys, values, scores, and query grid constant, now with bootstrap intervals over the query grid.
- `gnosis-fold-training-benchmark.ts` / `.test.ts`: wrapper plus tests for the seeded parameter-matched Gnosis cancellation benchmark built from three `.gg` modules that differ only in `FOLD` strategy.
- `gnosis-negative-controls-benchmark.ts` / `.test.ts`: wrapper plus tests for the one-path negative-control benchmark that reuses the existing affine and routed Gnosis topologies on tasks where nonlinear selection should not be penalized.
- `gnosis-near-control-sweep-benchmark.ts` / `.test.ts`: wrapper plus tests for the fine-grained low-demand sweep that identifies the last parity point and first separated point before the broader regime map opens.
- `gnosis-regime-sweep-benchmark.ts` / `.test.ts`: wrapper plus tests for the continuous learned boundary sweep that identifies where affine cancellation and routed dual-activation begin to require additive recombination.
- `gnosis-adversarial-controls-benchmark.ts` / `.test.ts`: wrapper plus tests for the symmetric learned control suite where winner-selection or early-stop folds are the correct inductive bias.
- `gnosis-moe-routing-benchmark.ts` / `.test.ts`: wrapper plus tests for the harder seeded Gnosis mini-MoE routing benchmark built from three routed-expert `.gg` modules that differ only in `FOLD` strategy.
- `gnosis-aeon-framed-transformer-benchmark.ts` / `.test.ts`: wrapper plus tests for the staged toy-transformer benchmark that keeps the dual-contribution fold boundary fixed while adding real Aeon framing, out-of-order reassembly, and a Rotation-plus-Whip composition surface.
- `gnosis-moa-transformer-evidence-benchmark.ts` / `.test.ts`: wrapper plus tests for the paper-oriented MoA evidence layer that sweeps workload size and sparsity ablations over the GG-backed `StructuredMoA` sparse topology.
- `formal-witness-catalog.ts` / `.test.ts`: Lean-originated witness loader plus tests that check the runtime boundary suite against the exported constructive counterexamples.
- `formal-adaptive-witness-catalog.ts` / `.test.ts`: Lean-originated adaptive witness loader plus tests that pin the concrete two-node adaptive `α` witness against the executable adaptive-supremum artifact.
- `adaptive-supremum-witness.ts` / `.test.ts`: executable mirror of the concrete two-node adaptive ceiling/drift witness, enumerating the bounded state space and schedule-level throughput bounds against the closed-form candidate.
- `adaptive-supremum-family-sweep.ts` / `.test.ts`: raw-parameter family sweep over bounded two-node adaptive rerouting cases, confirming that the same ceiling/drift closure holds beyond the single exported witness tuple.
- `ch17-replication-pack.ts` / `.test.ts`: replication-bundle manifest builder and tests that hash the current Chapter 17 evidence surface for outside reruns.
- `ch17-correspondence-boundary-figure.ts` / `.test.ts`: figure manifest/SVG renderer and tests for the four-panel artifact-generated Chapter 17 correspondence-boundary chart.
- `ch17-boundary-expansion-figure.ts` / `.test.ts`: figure manifest/SVG renderer and tests for the near-control/regime/adversarial expansion chart.
- `ch17-moa-transformer-figure.ts` / `.test.ts`: figure manifest/SVG renderer and tests for the GG-backed `StructuredMoA` sweep/ablation chart.
- `ch17-external-replication.ts` / `.test.ts`: outside-rerun executor and tests that verify the command plan plus manifest/hash stability checks.
- `deficit-evidence.test.ts`: protocol/settlement/healthcare deficit evidence checks.
- `map-reduce-readiness.test.ts`: §6.14 readiness diagnostic equations and screening-boundary counterexamples.
- `map-reduce-readiness.ts`: shared §6.14 readiness/simulator math used by tests and Gate 4 artifacts.
- `gate1-wallclock.ts`: wall-clock matrix harness + bootstrap CI/gate logic for §14.1 (loopback and external endpoint modes, with bounded request-timeout retries), including optional CPU-heavy per-request kernels (`md5-grind`, `semiprime-factor`) plus isolated config helpers for dedicated MD5-only and semiprime-only reruns.
- `gate1-wallclock.test.ts`: deterministic coverage for Gate 1 statistics/gate verdict behavior.
- `gate2-protocol-corpus.ts`: seeded heterogeneous protocol-corpus harness for Gate 2 (Aeon Flow vs HTTP/3), including environment-cell scoring, bootstrap CIs, and gate verdict logic.
- `gate2-protocol-corpus.test.ts`: deterministic coverage for Gate 2 default-pass behavior, strict-threshold denial, and markdown rendering.
- `gate3-compression-corpus.ts`: seeded heterogeneous compression-corpus harness for Gate 3, comparing topological per-chunk racing against fixed-codec and heuristic baselines with bootstrap CIs and gate verdict logic.
- `gate3-compression-corpus.test.ts`: deterministic coverage for Gate 3 reduced-corpus pass behavior, strict-threshold denial, and markdown rendering.
- `gate4-rqr-holdout.ts`: out-of-sample `R_qr` gate harness with fixed scoring criteria, bootstrap CIs, and markdown/json reporting.
- `gate4-rqr-holdout.test.ts`: deterministic and threshold-sensitivity coverage for Gate 4 harness behavior.
- `gate5-bio-effect-size.ts`: comparative biological effect-size harness with predeclared pair rules, Monte Carlo uncertainty propagation, pooled bootstrap CIs, and explicit pass/fail criteria.
- `gate5-bio-effect-size.test.ts`: deterministic and threshold-sensitivity coverage for the biological effect-size harness behavior.
- `physics-hierarchy.test.ts`: executable physics-hierarchy model checks.
- `emergent-connections.test.ts`: executable chapter-23 correspondence checks.
- `evidence-traceability.test.ts`: provenance/citation/evidence-type/calibration checks for evidence constants.
- `evidence-sources.ts`: structured constants used by evidence-table tests.
- `formal-parser-compat.test.ts`: parser round-trip compatibility checks.
