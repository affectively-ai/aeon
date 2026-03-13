# Fork/Race/Fold Is All You Need — Companion Tests

- Parent volume README: [open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/README.md](../README.md)
- Live docs home: [docs.aeonflux.dev](https://docs.aeonflux.dev)
- External reviewer quickstart: [../ch17-external-reviewer-quickstart.md](../ch17-external-reviewer-quickstart.md)
- Test sources: [src/README.md](./src/README.md)
- Formal artifacts: [formal/README.md](./formal/README.md)
- Script helpers: [scripts/README.md](./scripts/README.md)
- Generated artifacts: [artifacts/README.md](./artifacts/README.md)

Reproducible test suite for the claims in the arXiv manuscript.

Outside-rerun reviewers should start with [../ch17-external-reviewer-quickstart.md](../ch17-external-reviewer-quickstart.md) and only then drop into the per-harness commands below.

## Quick Start

```bash
bun install
bun run test
bun run test:gate1
bun run test:gate1:hard
bun run test:gate2
bun run test:gate3
bun run test:gate4
bun run test:gate5
bun run test:quantum-ablation
bun run test:toy-attention-ablation
bun run test:gnosis-fold-training
bun run test:gnosis-negative-controls
bun run test:gnosis-regime-sweep
bun run test:gnosis-adversarial-controls
bun run test:gnosis-moe-routing
bun run test:formal:witnesses
bun run test:formal:adaptive-witnesses
bun run test:adaptive-supremum-witness
bun run test:adaptive-supremum-family-sweep
bun run test:ch17-figure
bun run test:ch17-boundary-expansion-figure
bun run test:ch17-replication-pack
bun run test:ch17-reproduction-surface
bun run test:ch17-external-replication
bun run test:ch17-evidence
bun run test:formal:parser
bun run test:formal
```

## Test Sections (mapped to paper sections)

| Test File | Paper Section | What It Proves |
|-----------|--------------|----------------|
| `pipeline-topology.test.ts` | §1.1 The Triangle, §3 Pipeline Equation | Order preservation, β₁ lifecycle, Re phase transitions |
| `flow-protocol.test.ts` | §8 The Wire, §8.2.1 Self-Describing Frames | 10-byte framing, fork/race/fold/vent semantics on wire |
| `topological-compression.test.ts` | §8.6 Topological Compression | Per-chunk adaptive codec selection, subsumption |
| `pipeline-formulas.test.ts` | §7 formulas | Worthington Whip, Speculative Tree, turbulent idle-fraction bounds, frontier-fill / occupancy-deficit complements, cross-shard correction crossover characterization, and A1/A2 assumption-boundary falsification checks for modeled step-count speedups |
| `cross-shard-stochastic.test.ts` | §7.3 limitation closure | Finite crossover characterization under stochastic service laws and adaptive shard heuristics |
| `dag-completeness.test.ts` | §2.4 completeness | Executable finite-DAG decomposition coverage (partition totality, edge-cover exactness, and source-to-sink path-set preservation) |
| `quantum-topology.test.ts` | §6.11–§6.12, §13 | Quantum deficit identity, band-gap as β₂, convergence simulation under three constraints |
| `quantum-correspondence-boundary.test.ts` | §6.12 | Finite-kernel linear path-sum equivalence checks, partition/permutation invariants, and explicit nonlinear winner/early-stop counterexamples that bound the correspondence claim |
| `quantum-recombination-ablation.test.ts` | §6.12 | Same-path-family ablation harness: swap only the fold rule and predict the resulting loss of kernel agreement, partition additivity, order invariance, and cancellation |
| `toy-attention-fold-ablation.test.ts` + `scripts/toy-attention-fold-ablation.ts` | §1.7, §6.12 | Fixed-parameter toy attention ablation: hold keys, values, score function, and query grid constant; swap only the fold rule; measure the resulting output degradation and bootstrap uncertainty in a reproducible artifact |
| `gnosis-fold-training-benchmark.test.ts` + `scripts/gnosis-fold-training-benchmark.ts` | §1.7, §6.12 | Seeded parameter-matched Gnosis cancellation benchmark: keep topology, parameter count, and data fixed across three `.gg` modules; swap only the `FOLD` strategy; measure learned cancellation/recombination failure floors with seed-bootstrap intervals |
| `gnosis-negative-controls-benchmark.test.ts` + `scripts/gnosis-negative-controls-benchmark.ts` | §1.7, §6.12 | One-path negative-control benchmark: reuse the affine and routed Chapter 17 topologies on tasks where one branch or one expert is sufficient, and verify that the fold-rule separation collapses as predicted |
| `gnosis-regime-sweep-benchmark.test.ts` + `scripts/gnosis-regime-sweep-benchmark.ts` | §1.7, §6.12 | Continuous learned boundary sweep: reuse the same affine and routed topology families while varying how much the target depends on additive recombination, then report the first-separated regime and the growth of the linear advantage |
| `gnosis-adversarial-controls-benchmark.test.ts` + `scripts/gnosis-adversarial-controls-benchmark.ts` | §1.7, §6.12 | Symmetric learned control suite: reuse the same topology families on tasks that intentionally reward winner-selection or early-stop folds, checking that the theory predicts wins for nonlinear selection where it should |
| `gnosis-moe-routing-benchmark.test.ts` + `scripts/gnosis-moe-routing-benchmark.ts` | §1.7, §6.12 | Harder seeded Gnosis mini-MoE routing benchmark: four routed experts, fixed 16-parameter budget, same data, only the `FOLD` strategy changes; measures the learned dual-path recombination floor |
| `formal-witness-catalog.test.ts` + `scripts/formal-witness-catalog.ts` | §6.12 theorem-to-runtime bridge | Emits the Lean-originated witness catalog and checks that the runtime boundary suite consumes the same constructive counterexamples exported by the formal package |
| `formal-adaptive-witness-catalog.test.ts` + `scripts/formal-adaptive-witness-catalog.ts` | §5 adaptive theorem-to-runtime bridge | Emits the Lean-originated adaptive witness catalog and checks that the runtime adaptive-supremum artifact matches the concrete raw-parameter `α` closure exported by the formal package |
| `adaptive-supremum-witness.test.ts` + `scripts/adaptive-supremum-witness.ts` | §5 adaptive runtime witness | Enumerates the bounded two-node adaptive state cube and schedule patterns against the closed-form ceiling candidate exported from Lean |
| `adaptive-supremum-family-sweep.test.ts` + `scripts/adaptive-supremum-family-sweep.ts` | §5 adaptive family sweep | Exercises a curated raw-parameter family of bounded two-node rerouting cases, showing that the adaptive ceiling/drift closure survives beyond the single manuscript witness tuple |
| `ch17-replication-pack.test.ts` + `scripts/ch17-replication-pack.ts` | Chapter 17 delivery | Fingerprints the current Chapter 17 evidence bundle with hashes, file sizes, and the root reproduction command so outside reruns can verify they are using the same inputs |
| `ch17-correspondence-boundary-figure.test.ts` + `scripts/ch17-correspondence-boundary-figure.ts` | §1.7, §6.12 | Auto-generated Chapter 17 figure surface built from the quantum ablation, toy-attention bootstrap intervals, the seeded Gnosis cancellation benchmark, and the seeded Gnosis mini-MoE routing benchmark |
| `ch17-boundary-expansion-figure.test.ts` + `scripts/ch17-boundary-expansion-figure.ts` | §1.7, §6.12 | Auto-generated companion figure surface built from the regime sweep, adversarial controls, and Lean-exported witness catalog so the expanded evidence boundary is visible as a single artifact |
| `ch17-external-replication.test.ts` + `scripts/ch17-external-replication.ts` | Chapter 17 outside rerun | Executes the full outside-rerun command chain, verifies the refreshed replication manifest, and confirms that the checked-in evidence bundle hashes still match the files on disk |
| `deficit-evidence.test.ts` | §6.12 evidence table, §8.3 | Protocol/settlement/healthcare deficits and entropy-vent trend checks |
| `map-reduce-readiness.test.ts` | §6.14 heuristic | Executable checks for `Q_mr`, `O_beta`, `R_qr` bounds/monotonicity, necessity of nonzero topological opportunity in the migration simulator, independent rank correlation, and non-automatic-quantum-advantage counterexamples |
| `gate1-wallclock.test.ts` + `scripts/gate1-wallclock-matrix.ts` | §14.1 evidence-bounded wall-clock claim | Live distributed wall-clock matrix (loopback + external-endpoint modes), including single-host and six-distinct-host non-loopback artifacts, with p50/p95 summaries, bootstrap CIs, and explicit pass/fail criteria |
| `scripts/gate1-hard-workloads.ts` + `gate1-wallclock.ts` hard profile | §14.1 supplementary wall-clock evidence | CPU-heavy benchmark slice (MD5 grind + semiprime-factor kernels) demonstrating fixture-scoped tractability shifts via chunked scheduling on CPU-only infrastructure; does not claim impossibility on a single CPU |
| `gate2-protocol-corpus.test.ts` + `scripts/gate2-protocol-corpus.ts` | §14.1 evidence-bounded protocol claim | Seeded heterogeneous protocol corpus matrix (Aeon Flow vs HTTP/3) across predeclared environment cells with bootstrap CI + per-site win-rate criteria for framing, median completion, and p95 completion; emits explicit PASS/DENY artifacts |
| `gate3-compression-corpus.test.ts` + `scripts/gate3-compression-corpus.ts` | §14.1 evidence-bounded compression claim | Seeded heterogeneous compression corpus matrix comparing topological per-chunk racing against fixed-codec and heuristic baselines, with bootstrap CI + win-rate criteria and explicit PASS/DENY artifacts |
| `gate4-rqr-holdout.test.ts` + `scripts/gate4-rqr-holdout.ts` | §14.1 evidence-bounded predictive-screening claim | Out-of-sample `R_qr` screening evidence with fixed train/holdout split rules, 95% bootstrap CIs, decile calibration summaries, and explicit PASS/DENY artifact output |
| `gate5-bio-effect-size.test.ts` + `scripts/gate5-bio-effect-size.ts` | §14.1 evidence-bounded biological mapping | Predeclared comparative biological effect-size harness (saltatory conduction, photosynthesis step-vs-system efficiency, Okazaki chunking) with Monte Carlo uncertainty, pooled bootstrap CIs, and explicit PASS/DENY artifacts |
| `scripts/quantum-recombination-ablation.ts` + `artifacts/quantum-recombination-ablation.{json,md}` | §6.12 | Reproducible invariant-loss matrix for same-path-family fold ablations; predicts exactly which path-sum invariants survive under linear recombination and fail under nonlinear selection |
| `scripts/toy-attention-fold-ablation.ts` + `artifacts/toy-attention-fold-ablation.{json,md}` | §1.7, §6.12 | Reproducible behavioral ablation for a toy attention model; predicts the teacher-reconstruction error introduced by replacing linear fold with nonlinear selection at fixed parameters and attaches bootstrap intervals |
| `scripts/gnosis-fold-training-benchmark.ts` + `artifacts/gnosis-fold-training-benchmark.{json,md}` | §1.7, §6.12 | Reproducible seeded Gnosis cancellation benchmark using three parameter-matched `.gg` modules that differ only in fold strategy |
| `scripts/gnosis-negative-controls-benchmark.ts` + `artifacts/gnosis-negative-controls.{json,md}` | §1.7, §6.12 | Reproducible one-path negative controls showing that when a task needs only one branch or one expert, the linear-vs-selection separation disappears as predicted |
| `scripts/gnosis-regime-sweep-benchmark.ts` + `artifacts/gnosis-fold-boundary-regime-sweep.{json,md}` | §1.7, §6.12 | Reproducible learned boundary sweep showing the first-separated affine and routed regimes and the growth of the linear advantage as additive recombination becomes necessary |
| `scripts/gnosis-adversarial-controls-benchmark.ts` + `artifacts/gnosis-adversarial-controls-benchmark.{json,md}` | §1.7, §6.12 | Reproducible symmetric control suite showing the tasks where winner-selection or early-stop folds are the correct inductive bias |
| `scripts/gnosis-moe-routing-benchmark.ts` + `artifacts/gnosis-moe-routing-benchmark.{json,md}` | §1.7, §6.12 | Reproducible seeded Gnosis mini-MoE routing benchmark using three parameter-matched routed-expert `.gg` modules that differ only in fold strategy |
| `scripts/formal-witness-catalog.ts` + `artifacts/formal-witness-catalog.{json,md}` | §6.12 theorem-to-runtime bridge | Reproducible Lean-originated witness export surface that supplies the executable correspondence-boundary counterexamples consumed by the runtime tests |
| `scripts/formal-adaptive-witness-catalog.ts` + `artifacts/formal-adaptive-witness-catalog.{json,md}` | §5 adaptive theorem-to-runtime bridge | Reproducible Lean-originated adaptive witness export surface that pins the bounded two-node raw adaptive `α` closure consumed by the runtime adaptive-supremum checks |
| `scripts/adaptive-supremum-witness.ts` + `artifacts/adaptive-supremum-witness.{json,md}` | §5 adaptive runtime witness | Reproducible bounded-state runtime mirror of the concrete adaptive ceiling/drift witness exported from Lean |
| `scripts/adaptive-supremum-family-sweep.ts` + `artifacts/adaptive-supremum-family-sweep.{json,md}` | §5 adaptive family sweep | Reproducible raw-parameter sweep showing that the bounded two-node adaptive closure persists across multiple admissible rerouting tuples |
| `scripts/ch17-replication-pack.ts` + `artifacts/ch17-replication-pack.{json,md}` | Chapter 17 delivery | Hashes the current evidence bundle, records the root rerun command, and fingerprints the files needed to reproduce the Chapter 17 claim surface |
| `scripts/ch17-correspondence-boundary-figure.ts` + `artifacts/ch17-correspondence-boundary-figure.{json,md,svg}` | §1.7, §6.12 | Auto-generated manuscript figure combining the invariant-loss matrix, toy-attention interval chart, the seeded Gnosis cancellation benchmark, and the seeded Gnosis mini-MoE routing benchmark |
| `scripts/ch17-boundary-expansion-figure.ts` + `artifacts/ch17-boundary-expansion-figure.{json,md,svg}` | §1.7, §6.12 | Auto-generated expansion figure combining the regime sweep, adversarial controls, and Lean-originated witness bridge into one manuscript-ready surface |
| `scripts/ch17-external-replication.ts` + `artifacts/ch17-external-replication.{json,md}` | Chapter 17 outside rerun | Runs the full outside-rerun command surface and verifies that the refreshed replication-pack hashes still match the evidence bundle on disk |
| `physics-hierarchy.test.ts` | §6.11 | Executable hierarchy checks for path-integral/race/fold mappings and energy partitions (model scope) |
| `emergent-connections.test.ts` | Chapter 23 | Executable analog checks for nine emergent correspondences (model scope) |
| `thermodynamics.test.ts` | §6 Thermodynamics | First Law accounting, Carnot/Shannon bounds, ground-state overhead |
| `queueing-subsumption.test.ts` | §5 End of Queueing Theory | Canonical queueing boundary cases, exhaustive finite-trace work-conserving identities, bounded multiclass network conservation, finite-support stochastic-mixture expectation checks, exact probabilistic queue/network kernel propagation checks, a larger exact three-slot multiclass network witness, and an explicit worst-case small-data ramp-up branch |
| `shootoff.test.ts` | §8.5 Shootoff Benchmarks | Protocol comparison with real compression |
| `evidence-traceability.test.ts` + `evidence-sources.ts` | §6.12 evidence table | Citation/provenance/evidence-type/calibration checks for empirical constants, plus manuscript-reference resolution checks |
| `formal/*.tla` + TLC | §2.5, §4, §6.11–§6.12, §7, §8.3 | Mechanized checks for C1–C4, queueing sample-path/network/stochastic-mixture conservation, exact finite-state probabilistic queue and multiclass-network kernels, a larger exact finite-support multiclass-network cube, §7 formulas, frontier-fill / occupancy-deficit complement laws, the Wallace/crank metric on bounded three-layer frontiers, turbulent-multiplexing monotonicity, staged-expansion dominance over naive widening, the exact warm-up efficiency threshold between Wallace reduction and Buley rise, the dynamic entropy-creep/active-cooling laminar-return model, the score-minimizing expand/constrain/shed-load controller redline, structured-failure/live-frontier entropy reduction, the stronger branch-isolating-versus-contagious failure-family split, the no-free deterministic-collapse trilemma, the composed no-free-collapse boundary across multiple stages, the arbitrary-depth universality lift over stage-indexed recovery, the minimum collapse-cost floor `totalVented + totalRepairDebt >= initialLive - 1`, the canonical zero-debt witness that attains that floor exactly, the canonical failure-action controller law, the canonical failure-action Pareto frontier, quantum/topology deficits, Bu beauty-optimality scaffolds, protocol/settlement deficits, and band-gap voids |
| `formal/lean/*.lean` + `runLeanSandbox`/Lake | §2.4–§2.5, §4, §5, §6.12, §7, §11, §13 | Theorem-level mechanization with constructive quantitative identities (including the Wallace/crank frontier metric, turbulent-multiplexing monotonicity, staged-expansion dominance over naive widening, the exact warm-up efficiency threshold, the controller redline that selects `expand`, `constrain`, or `shed-load`, structured-failure/live-frontier entropy reduction, the branch-isolating-versus-contagious failure-family split, the no-free deterministic-collapse trilemma, the composed no-free-collapse boundary across aligned stage sequences, the arbitrary-depth universality lift over sparse normalized choice systems and arbitrary recovery prefixes, the minimum collapse-cost floor `totalVented + totalRepairDebt >= initialLive - 1`, the exact branch-isolating witness that realizes that floor, the canonical failure-action controller law, the canonical failure-action Pareto frontier, weighted queueing expectation balance, finite-prefix truncation balance, infinite weighted-sum queue balance, countably supported stochastic queue laws via `PMF`, stable `M/M/1` stationarity with finite mean occupancy, a finite-node product-form open-network occupancy law under a supplied stable throughput witness satisfying the traffic equations, adaptive-routing constructive comparison against a dominating or substochastic supremum kernel, a raw-parameter two-node adaptive rerouting witness that derives its own ceiling kernel, spectral side conditions, throughput bound, linear drift witness, stationary/terminal balance bridge, and exported adaptive `α` catalog, measure-theoretic `lintegral` conservation, monotone truncation-to-limit queue balance, trajectory-level Cesaro balance for unbounded open-network sample paths, and the linear-vs-nonlinear correspondence boundary) plus the executable adaptive-supremum witness and raw-parameter family-sweep artifacts that mirror the concrete two-node closure on the runtime side, and top-level theorem schemas for the stronger uninstantiated convergence, limit, state-dependent stability, and generic adaptive drift-transfer claims, built through `@affectively/aeon-logic`'s Lean sandbox |
| `formal-parser-compat.test.ts` + `scripts/validate-formal-artifacts.ts` | §11 Validation | Self-hosted `aeon-logic` parsing + round-trip validation for all `.tla/.cfg` artifacts, plus Lean project inspection through `runLeanSandbox` |
| `scripts/formal-parser-equivalence.ts` | §11 Validation | Differential semantic-equivalence harness against Java SANY parse outcomes (agreement on valid corpus, round-trip corpus and invalid mutations) |

## Running Individual Sections

```bash
bun test:pipeline      # §1.1, §3
bun test:flow          # §8
bun test:compression   # §8.6
bun test:thermodynamics # §6
bun test:shootoff      # §8.5
bun test:gate1         # §14.1 wall-clock matrix evidence + artifact generation
bun test:gate1:hard    # §14.1 supplementary CPU-hard workload wall-clock evidence
bun test:gate2         # §14.1 protocol-corpus evidence + artifact generation
bun test:gate3         # §14.1 compression-corpus evidence + artifact generation
bun test:gate4         # §14.1 out-of-sample R_qr evidence + artifact generation
bun test:gate5         # §14.1 biological effect-size evidence + artifact generation
bun test:quantum-ablation # §6.12 same-path-family fold-ablation artifact generation
bun test:toy-attention-ablation # §1.7, §6.12 fixed-parameter toy-attention ablation artifact generation
bun test:gnosis-fold-training # §1.7, §6.12 seeded Gnosis training benchmark artifact generation
bun test:gnosis-negative-controls # §1.7, §6.12 one-path negative-control artifact generation
bun test:gnosis-regime-sweep # §1.7, §6.12 continuous learned boundary sweep artifact generation
bun test:gnosis-adversarial-controls # §1.7, §6.12 symmetric learned control artifact generation
bun test:gnosis-moe-routing # §1.7, §6.12 seeded Gnosis mini-MoE routing benchmark artifact generation
bun test:formal:witnesses # §6.12 Lean-originated witness export artifact generation
bun test:formal:adaptive-witnesses # §5 Lean-originated adaptive witness export artifact generation
bun test:adaptive-supremum-witness # §5 bounded-state runtime mirror of the concrete adaptive witness
bun test:adaptive-supremum-family-sweep # §5 raw-parameter family sweep for the bounded two-node adaptive witness
bun test:ch17-figure   # §1.7, §6.12 artifact-generated manuscript figure
bun test:ch17-boundary-expansion-figure # §1.7, §6.12 artifact-generated expanded boundary figure
bun test:ch17-replication-pack # Chapter 17 bundle hash manifest + rerun command
bun test:ch17-reproduction-surface # artifact/witness/manuscript reproduction surface without the separate full Lean gate
bun test:ch17-external-replication # one-command outside rerun + manifest/hash verification
bun test:ch17-evidence # one-command regeneration + consistency + Lean gate for Chapter 17
bun test:queueing      # §5
bun test:formal:parser # aeon-logic parser preflight for formal artifacts
bun test:formal:lean   # Lean theorem build
bun test:formal        # formal parser preflight + SANY equivalence + Lean + TLC
bun test:formal:shootoff # parser throughput vs Java baseline
bun test:formal:equivalence # differential semantic-equivalence harness vs Java SANY
bun test:all           # vitest suite + TLA+ model check
```

## Dependencies

This test suite depends on `@anthropic-ai/aeon` (runtime protocol/compression primitives) and `@affectively/aeon-logic` (self-hosted TLC/TLA parser, Lean sandbox, and formal compatibility adapters).
