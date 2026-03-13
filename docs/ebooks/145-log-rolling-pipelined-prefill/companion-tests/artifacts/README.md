# Companion Artifacts

- Parent README: [../README.md](../README.md)
- External reviewer quickstart: [../../ch17-external-reviewer-quickstart.md](../../ch17-external-reviewer-quickstart.md)

Generated benchmark/formal outputs used by manuscript evidence notes.

## Files

- `gate1-wallclock-matrix.json`: machine-readable Gate 1 wall-clock matrix report (config, per-cell p50/p95, bootstrap intervals, pass/fail verdicts).
- `gate1-wallclock-matrix.md`: human-readable Gate 1 wall-clock matrix summary table and gate verdict.
- `gate1-wallclock-external-single-host.json`: machine-readable Gate 1 report for external non-loopback endpoint execution (single remote host, stage-indexed endpoints).
- `gate1-wallclock-external-single-host.md`: human-readable summary for the external non-loopback single-host Gate 1 run.
- `gate1-wallclock-external-multihost.json`: machine-readable Gate 1 report for external non-loopback six-distinct-host execution (one stage endpoint per host).
- `gate1-wallclock-external-multihost.md`: human-readable summary for the external non-loopback six-host Gate 1 run.
- `gate2-protocol-corpus.json`: machine-readable Gate 2 report for seeded heterogeneous protocol-corpus evaluation (Aeon Flow vs HTTP/3) across predeclared environment cells.
- `gate2-protocol-corpus.md`: human-readable Gate 2 summary with per-cell bootstrap CIs, win rates, and explicit gate verdict.
- `gate3-compression-corpus.json`: machine-readable Gate 3 report for seeded heterogeneous compression-corpus evaluation (topological racing vs fixed-codec and heuristic baselines).
- `gate3-compression-corpus.md`: human-readable Gate 3 summary with per-cell bootstrap CIs, win rates, codec-diversity diagnostics, and explicit gate verdict.
- `gate4-rqr-holdout.json`: machine-readable Gate 4 out-of-sample `R_qr` report (predeclared criteria, train/holdout summaries, bootstrap intervals, pass/fail verdict).
- `gate4-rqr-holdout.md`: human-readable Gate 4 out-of-sample `R_qr` summary with criteria table and decile calibration table.
- `gate5-bio-effect-size.json`: machine-readable biological effect-size report across predeclared comparative pairs with uncertainty propagation and pooled bootstrap-CI criteria.
- `gate5-bio-effect-size.md`: human-readable biological effect-size summary with pair-level ratios, uncertainty intervals, and explicit pass/fail criteria.
- `quantum-recombination-ablation.json`: machine-readable §6.12 ablation report for the invariant-loss matrix when linear recombination is replaced by winner-take-all or early-stop selection on the same path family.
- `quantum-recombination-ablation.md`: human-readable §6.12 ablation summary with the invariant matrix and witness distances.
- `toy-attention-fold-ablation.json`: machine-readable toy-attention ablation report for the behavioral effect of swapping only the fold rule while keeping parameters and queries fixed, including bootstrap intervals.
- `toy-attention-fold-ablation.md`: human-readable toy-attention ablation summary with interval-backed MSE/exact-reconstruction metrics and representative predictions.
- `gnosis-fold-training-benchmark.json`: machine-readable seeded Gnosis cancellation benchmark report for three parameter-matched `.gg` modules that differ only in fold strategy.
- `gnosis-fold-training-benchmark.md`: human-readable seeded Gnosis cancellation benchmark summary with eval-MSE, exact-rate, bootstrap intervals, and cancellation-line error metrics.
- `gnosis-negative-controls.json`: machine-readable one-path negative-control report for the existing affine and routed Gnosis benchmark topologies on tasks where one branch or one expert is sufficient.
- `gnosis-negative-controls.md`: human-readable negative-control summary with parity thresholds, interval-backed metrics, and representative predictions.
- `gnosis-fold-boundary-regime-sweep.json`: machine-readable learned boundary sweep report over the affine cancellation and routed dual-activation families.
- `gnosis-fold-boundary-regime-sweep.md`: human-readable regime-sweep summary with first-separated regime values, seed-aggregated metrics, and linear-advantage growth tables.
- `gnosis-adversarial-controls-benchmark.json`: machine-readable symmetric control report for tasks that intentionally favor winner-selection or early-stop folds.
- `gnosis-adversarial-controls-benchmark.md`: human-readable adversarial-control summary with ranking recovery, learning-curve areas, and favored-fold diagnostics.
- `gnosis-moe-routing-benchmark.json`: machine-readable seeded Gnosis mini-MoE routing benchmark report for three parameter-matched routed-expert `.gg` modules that differ only in fold strategy.
- `gnosis-moe-routing-benchmark.md`: human-readable seeded Gnosis mini-MoE routing benchmark summary with eval-MSE, exact-rate, bootstrap intervals, and dual-active-region error metrics.
- `formal-witness-catalog.json`: machine-readable Lean-originated witness export for the correspondence boundary.
- `formal-witness-catalog.md`: human-readable witness summary showing the exact cancellation, partition, and order counterexamples exported from the theorem package.
- `formal-adaptive-witness-catalog.json`: machine-readable Lean-originated adaptive witness export for the concrete bounded two-node raw adaptive `α` closure.
- `formal-adaptive-witness-catalog.md`: human-readable adaptive witness summary showing the exported `α`, drift gap, spectral radius, and theorem refs for the bounded two-node rerouting family.
- `adaptive-supremum-witness.json`: machine-readable runtime mirror of the concrete two-node adaptive ceiling/drift witness, including schedule-level constructive supremum checks on the bounded state cube.
- `adaptive-supremum-witness.md`: human-readable summary of the concrete two-node adaptive ceiling/drift witness.
- `adaptive-supremum-family-sweep.json`: machine-readable raw-parameter sweep over bounded two-node adaptive rerouting cases that all satisfy the same ceiling/drift closure.
- `adaptive-supremum-family-sweep.md`: human-readable summary table for the adaptive raw-parameter family sweep.
- `ch17-replication-pack.json`: machine-readable replication manifest for the current Chapter 17 evidence bundle, including file sizes, SHA-256 digests, and the root rerun command.
- `ch17-replication-pack.md`: human-readable replication manifest with the same bundle inventory and hashes.
- `ch17-correspondence-boundary-figure.json`: machine-readable manifest for the Chapter 17 correspondence-boundary figure.
- `ch17-correspondence-boundary-figure.md`: human-readable summary of the figure sources and aggregated metrics.
- `ch17-correspondence-boundary-figure.svg`: manuscript-ready figure assembled from the quantum ablation, toy-attention interval chart, seeded Gnosis cancellation benchmark, and seeded Gnosis mini-MoE routing benchmark artifacts.
- `ch17-boundary-expansion-figure.json`: machine-readable manifest for the expanded Chapter 17 boundary figure.
- `ch17-boundary-expansion-figure.md`: human-readable summary of the regime-sweep, adversarial-control, and formal-witness figure sources.
- `ch17-boundary-expansion-figure.svg`: manuscript-ready figure assembled from the regime sweep, adversarial controls, and Lean-originated witness catalog.
- `ch17-external-replication.json`: machine-readable outside-rerun report covering the end-to-end command plan and manifest/hash verification.
- `ch17-external-replication.md`: human-readable outside-rerun summary for the same report.

## Gate 1 Snapshot

- External six-host label: `workers-dev-external-multihost6-distinct`
- Distinct endpoint hosts: `6`
- Gate verdict: `PASS` (`8/8` primary cells)
- Median speedup range across cells: `11.785x` to `21.620x`
- Minimum 95% CI lower bounds across cells: `11.365x` speedup and `3,560.98 ms` latency improvement

## Gate 2 Snapshot

- Corpus label: `gate2-protocol-corpus-v1`
- Corpus size: `144` sites, `12,371` resources
- Gate verdict: `PASS` (`6/6` primary cells)
- Framing median gain across cells: `72.252%` (CI low approximately `72.19%`)
- Primary-cell completion median CI lows: `20.24 ms` to `83.38 ms`
- Primary-cell completion p95 CI lows: `19.99 ms` to `98.22 ms`

## Gate 3 Snapshot

- Corpus label: `gate3-compression-corpus-v1`
- Corpus size: `90` samples (`20,133,761` bytes total)
- Gate verdict: `PASS` (`4/4` primary cells)
- Primary-cell median gain vs best fixed codec: `0.001%` to `0.008%` (CI lows all positive: approximately `0.0009%` to `0.0075%`)
- Primary-cell median gain vs heuristic baseline: `0.777%` to `46.366%` (CI lows approximately `0.386%` to `39.449%`)

## Gate 5 Snapshot

- Protocol label: `gate5-bio-effect-size-v1`
- Comparative pair count: `3` (`3` primary)
- Gate verdict: `PASS` (`4/4` criteria)
- Median pair ratio: `21.524x`
- Minimum primary-pair CI low ratio: `5.829x`
- Pooled log-ratio: `3.280` (95% CI `2.289` to `4.360`)

## Quantum Ablation Snapshot

- Protocol label: `quantum-recombination-ablation-v1`
- Predicted loss matrix recovered: `yes`
- `linear`: preserves kernel agreement, partition additivity, order invariance, and cancellation
- `winner-take-all`: breaks all four invariants on the selected witnesses
- `early-stop`: breaks all four invariants on the selected witnesses

## Toy Attention Snapshot

- Protocol label: `toy-attention-fold-ablation-v2`
- Predicted ranking recovered: `yes`
- `linear`: mean squared error `0.000`, exact-within-tolerance fraction `1.000`
- `winner-take-all`: mean squared error `0.163`, exact-within-tolerance fraction `0.185`
- `early-stop`: mean squared error `1.071`, exact-within-tolerance fraction `0.074`

## Gnosis Training Snapshot

- Protocol label: `gnosis-fold-training-benchmark-v2`
- Predicted ranking recovered: `yes`
- Shared parameter count: `4`
- `linear`: eval mean squared error `0.000`, exact-within-tolerance fraction `1.000`, cancellation-line abs error `0.000`
- `winner-take-all`: eval mean squared error `0.408`, exact-within-tolerance fraction `0.038`, cancellation-line abs error `0.834`
- `early-stop`: eval mean squared error `0.735`, exact-within-tolerance fraction `0.000`, cancellation-line abs error `0.764`

## Gnosis Negative Controls Snapshot

- Protocol label: `gnosis-negative-controls-v1`
- All controls pass: `yes`
- Control tasks: `affine-left-only`, `routing-positive-x-only`
- Interpretation: when the task needs only one branch or one expert, the linear-vs-selection separation is expected to disappear, and the artifact reports parity instead of divergence

## Gnosis Regime Sweep Snapshot

- Protocol label: `gnosis-fold-boundary-regime-sweep-v1`
- Affine first separated regime value: `0.50`
- Routed first separated regime value: `0.75`
- Final affine linear advantage (eval MSE): `0.393`
- Final routed linear advantage (eval MSE): `0.111`
- Interpretation: the same topology families start in parity regimes and then separate exactly where additive recombination becomes necessary

## Gnosis Adversarial Controls Snapshot

- Protocol label: `gnosis-adversarial-controls-benchmark-v1`
- All adversarial predictions recovered: `yes`
- Winner-favored task final rank: `winner-take-all < linear < early-stop`
- Early-stop-favored routed task final rank: `early-stop < linear < winner-take-all`
- Early-stop-favored affine task final rank: `early-stop < linear < winner-take-all`
- Interpretation: the learned boundary is symmetric rather than partisan; nonlinear selection wins when the target family rewards sparse selection or budgeted early commitment

## Gnosis Mini-MoE Snapshot

- Protocol label: `gnosis-moe-routing-benchmark-v1`
- Predicted ranking recovered: `yes`
- Shared parameter count: `16`
- `linear`: eval mean squared error `0.001`, exact-within-tolerance fraction `0.978`, dual-active-region abs error `0.027`
- `winner-take-all`: eval mean squared error `0.328`, exact-within-tolerance fraction `0.126`, dual-active-region abs error `0.402`
- `early-stop`: eval mean squared error `0.449`, exact-within-tolerance fraction `0.080`, dual-active-region abs error `0.474`

## Adaptive Witness Snapshot

- Protocol label: `formal-adaptive-supremum-witness-catalog-v1`
- Witness id: `two-node-adaptive-raw-ceiling`
- Exported `α`: `(1/4, 11/40)`
- Exported drift gap: `1/8`
- Exported spectral radius: `0`
- Interpretation: the Lean theorem package now emits the same concrete adaptive ceiling/drift witness that the runtime adaptive-supremum artifact checks operationally

## Runtime Adaptive Witness Snapshot

- Protocol label: `adaptive-supremum-witness-v1`
- Schedules checked: `4`
- Spectral radius: `0`
- Drift gap: `0.125`
- Interpretation: the runtime mirror operationally checks the bounded-state and schedule consequences of the same concrete adaptive ceiling/drift witness exported from Lean

## Adaptive Family Sweep Snapshot

- Protocol label: `adaptive-supremum-family-sweep-v1`
- Cases checked: `9`
- Family closure recovered: `yes`
- Minimum drift gap: `0.026`
- Tightest case: `tight-right-slack-2x2`
- Interpretation: the bounded two-node adaptive closure is exercised as a raw-parameter family, not just as one manuscript witness tuple

## Formal Witness Snapshot

- Protocol label: `formal-fold-boundary-witness-catalog-v1`
- Exported witness count: `7`
- Witness classes: linear exactness, cancellation counterexamples, partition counterexamples, and order counterexamples
- Interpretation: the correspondence-boundary counterexamples are emitted from Lean and consumed directly by the runtime tests

## Chapter 17 Figure Snapshot

- Protocol label: `ch17-correspondence-boundary-figure-v2`
- Sources: `quantum-recombination-ablation-v1`, `toy-attention-fold-ablation-v2`, `gnosis-fold-training-benchmark-v2`, `gnosis-moe-routing-benchmark-v1`
- Output surface: JSON + Markdown + SVG
- Learned ranking in figure: `linear < winner-take-all < early-stop`

## Boundary Expansion Figure Snapshot

- Protocol label: `ch17-boundary-expansion-figure-v1`
- Sources: `gnosis-fold-boundary-regime-sweep-v1`, `gnosis-adversarial-controls-benchmark-v1`, `formal-fold-boundary-witness-catalog-v1`
- Output surface: JSON + Markdown + SVG
- Interpretation: the expansion figure shows where the boundary opens, where nonlinear folds legitimately win, and which formal witnesses certify the break

## Replication Pack Snapshot

- Protocol label: `ch17-replication-pack-v1`
- Root command: `cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests && bun run test:ch17-external-replication`
- Bundle scope: manuscript, workflow, generated artifacts, theorem files, and benchmark topology suites

## External Replication Snapshot

- Protocol label: `ch17-external-replication-v1`
- Step count: `11`
- Manifest stable: `yes`
- All hashes match: `yes`
- Interpretation: the outside-rerun command surface rebuilds the learned/formal Chapter 17 evidence chain and then independently verifies the replication-pack hashes
