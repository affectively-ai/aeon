# Gnosis MoA Transformer Evidence

- Label: `gnosis-moa-transformer-evidence-v1`
- Regular GG topology: `/Users/buley/Documents/Code/emotions/open-source/gnosis/examples/benchmarks/moa-transformer-regular.gg`
- Sparse GG topology: `/Users/buley/Documents/Code/emotions/open-source/gnosis/examples/benchmarks/moa-transformer-moa.gg`
- Sparse GG primitive: `StructuredMoA`
- Base seed count: `4`
- Learning rate: `0.018`
- Timing advantage recovered across sweep: `yes`
- Accuracy gap closes with scale: `yes`
- Outer sparsity improves efficiency: `yes`
- Inner sparsity improves efficiency: `yes`
- Under-routing hurts accuracy: `yes`

## Scale Sweep

| Scale | Train samples | Eval samples | MoA eval MSE | Regular eval MSE | MoA eval speedup | MoA active heads | Regular active heads | MoA frames | Regular frames |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Compact workload | 25 | 16 | 0.0829 | 0.0023 | 7.02x | 4.0 | 16.0 | 16.0 | 64.0 |
| Baseline workload | 49 | 25 | 0.0666 | 0.0005 | 4.45x | 4.0 | 16.0 | 16.0 | 64.0 |
| Wide workload | 81 | 49 | 0.0033 | 0.0008 | 2.56x | 4.0 | 16.0 | 16.0 | 64.0 |

## Ablations

| Ablation | Active blocks | Active heads | MoA eval MSE | MoA exact fraction | MoA eval wall ms | Compute-adjusted exact |
|---|---:|---:|---:|---:|---:|---:|
| Full MoA | 2 | 2 | 0.0014 | 0.9225 | 2.26 | 0.2306 |
| No outer sparsity | 4 | 2 | 0.0003 | 1.0000 | 3.46 | 0.1250 |
| No inner sparsity | 2 | 4 | 0.0009 | 0.9900 | 3.15 | 0.1237 |
| Under-routed | 1 | 2 | 0.2233 | 0.1900 | 0.85 | 0.0950 |

Interpretation: the same lower-triangular fork/race/fold geometry now reappears across head chains, transformer blocks, and runtime structured concurrency. The sparse family is declared in GG through `StructuredMoA`, then lowered into the same nested Rotation-plus-Whip graph that the benchmark executes. The evidence pass checks whether that recursive Wallington/MoA design keeps its accuracy while genuinely reducing live compute, and whether the outer route and inner head sparsity are both doing real work rather than decorative pruning.

