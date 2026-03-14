# Companion Scripts

- Parent README: [../README.md](../README.md)

Utility scripts used by the companion suite.

## Files

- `run-formal-verification.sh`: runs TLC against every `formal/*.cfg` + matching `formal/*.tla` pair, downloading `tla2tools.jar` if needed.
- `run-lean-theorems.ts`: runs `@affectively/aeon-logic`'s `runLeanSandbox` against `formal/lean`, requiring a real `lake build` success and surfacing the sandbox report; accepts optional comma-separated `AEON_LEAN_BUILD_TARGETS` to focus the Lean build on specific modules without changing the default full entrypoint target.
- `run-lean-theorems.sh`: shell wrapper that forwards to `run-lean-theorems.ts` for environments that expect the historical entrypoint.
- `validate-formal-artifacts.ts`: preflights all formal artifacts via `@affectively/aeon-logic` (`.tla/.cfg` parse + round-trip checks plus Lean project inspection through `runLeanSandbox` with `build: false`).
- `formal-parser-shootoff.ts`: benchmark helper that compares `aeon-logic` parser throughput against a Java SANY parse baseline using multi-sample medians and jitter bands.
- `formal-parser-equivalence.ts`: differential semantic-equivalence harness (accept/reject agreement + round-trip stability + invalid-corpus rejection) against Java SANY parse outcomes; accepts `FORMAL_EQUIVALENCE_FILTER=<substring>` to target a subset of modules when investigating a specific artifact or working around tight local disk constraints.
- `gate1-wallclock-matrix.ts`: wall-clock matrix runner for §14.1 (loopback or external endpoint pool modes with RTT/jitter/loss impairment injection), writes JSON/Markdown artifacts and computes bootstrap-CI gate verdicts (`--request-timeout-ms` bounds external fetch attempts).
- `gate1-hard-workloads.ts`: supplementary Gate 1 runner for CPU-heavy kernels (MD5 grind + semiprime factor search) in loopback mode, writes JSON/Markdown artifacts for fixture-scoped hard-workload tractability evidence.
- `gate1-md5-grind.ts`: MD5-only Gate 1 runner in loopback mode, writes JSON/Markdown artifacts for the isolated hash-grind wall-clock surface.
- `gate1-semiprime-factor.ts`: semiprime-only Gate 1 runner in loopback mode, writes JSON/Markdown artifacts for the isolated factor-search wall-clock surface.
- `gate2-protocol-corpus.ts`: heterogeneous protocol-corpus gate runner for §14.1, evaluating Aeon Flow vs HTTP/3 across predeclared environment cells with bootstrap-CI and win-rate criteria, and writing explicit PASS/DENY JSON/Markdown artifacts.
- `gate3-compression-corpus.ts`: heterogeneous compression-corpus gate runner for §14.1, evaluating topological per-chunk racing against fixed-codec and heuristic baselines with bootstrap-CI and win-rate criteria, and writing explicit PASS/DENY JSON/Markdown artifacts.
- `gate1-stage-worker.ts`: standalone `/stage` worker used when running the wall-clock matrix against external endpoint pools.
- `gate4-rqr-holdout.ts`: out-of-sample `R_qr` gate runner for §14.1, writes JSON/Markdown artifacts with fixed scoring criteria and bootstrap-CI pass/fail verdicts.
- `gate5-bio-effect-size.ts`: biological effect-size evidence runner for §14.1, evaluates predeclared comparative biological pairs with uncertainty propagation + pooled bootstrap-CI criteria and writes explicit PASS/DENY JSON/Markdown artifacts.
- `quantum-recombination-ablation.ts`: deterministic §6.12 ablation runner, holds the path family fixed, swaps only the fold rule, and writes JSON/Markdown artifacts for the resulting invariant-loss matrix.
- `toy-attention-fold-ablation.ts`: deterministic toy-attention ablation runner, holds keys/values/score function/query grid fixed, swaps only the fold rule, and writes JSON/Markdown behavioral-degradation artifacts plus bootstrap intervals.
- `gnosis-fold-training-benchmark.ts`: seeded Gnosis cancellation-benchmark runner, reads three parameter-matched `.gg` modules and writes JSON/Markdown artifacts for the learned fold boundary.
- `gnosis-negative-controls-benchmark.ts`: one-path control runner that reuses the affine and routed Gnosis benchmark topologies on tasks where one branch or one expert is sufficient, and writes JSON/Markdown parity artifacts.
- `gnosis-near-control-sweep-benchmark.ts`: fine-grained low-demand runner that zooms the control end of the affine and routed benchmark families and writes JSON/Markdown parity-to-separation artifacts.
- `gnosis-regime-sweep-benchmark.ts`: continuous learned-boundary runner that reuses the same affine and routed topology families while varying how much the target depends on additive recombination, then writes JSON/Markdown sweep artifacts.
- `gnosis-adversarial-controls-benchmark.ts`: symmetric learned-control runner that reuses the same topology families on tasks that reward winner-selection or early-stop folds, then writes JSON/Markdown control artifacts.
- `gnosis-moe-routing-benchmark.ts`: seeded Gnosis mini-MoE routing runner, reads three routed-expert `.gg` modules and writes JSON/Markdown artifacts for the harder learned fold boundary.
- `gnosis-aeon-framed-transformer-benchmark.ts`: staged toy-transformer runner that emits JSON/Markdown artifacts for the dual-contribution fold boundary with real Aeon frame transport, out-of-order reassembly, and Rotation-plus-Whip companion structure.
- `gnosis-moa-transformer-evidence-benchmark.ts`: paper-oriented MoA evidence runner that emits JSON/Markdown artifacts for the GG-backed `StructuredMoA` sparse transformer sweep, ablation matrix, and timing-recovery claims.
- `formal-witness-catalog.ts`: Lean-originated witness exporter that builds the witness module, emits JSON/Markdown artifacts, and feeds the runtime correspondence-boundary tests.
- `formal-adaptive-witness-catalog.ts`: Lean-originated adaptive witness exporter that builds the adaptive witness module, emits JSON/Markdown artifacts, and feeds the runtime adaptive-supremum tests.
- `adaptive-supremum-witness.ts`: executable mirror of the concrete two-node adaptive ceiling/drift witness, enumerating bounded states and schedule patterns and writing JSON/Markdown artifacts for the closed-form adaptive bound.
- `adaptive-supremum-family-sweep.ts`: raw-parameter family sweep for the bounded two-node adaptive rerouting theorem, writing JSON/Markdown artifacts that confirm the same nilpotent ceiling and positive drift gap across multiple admissible parameter tuples.
- `ch17-replication-pack.ts`: replication-bundle writer that hashes the current Chapter 17 evidence files and records the root rerun command in JSON/Markdown form.
- `ch17-correspondence-boundary-figure.ts`: artifact assembler that reads the quantum, toy-attention, cancellation-benchmark, and mini-MoE reports and writes manuscript-ready JSON/Markdown/SVG figure outputs.
- `ch17-boundary-expansion-figure.ts`: artifact assembler that reads the near-control zoom, regime sweep, adversarial controls, and formal witness catalog and writes manuscript-ready JSON/Markdown/SVG outputs for the expanded boundary story.
- `ch17-moa-transformer-figure.ts`: artifact assembler that reads the GG-backed `StructuredMoA` evidence report and writes manuscript-ready JSON/Markdown/SVG outputs for the sparse-vs-dense rotated transformer result.
- `ch17-external-replication.ts`: outside-rerun executor that runs the Gnosis build/benchmarks plus the Chapter 17 artifact/witness/manuscript reproduction surface, then verifies the refreshed replication-pack hashes against the working tree.
