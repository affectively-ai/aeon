# Chapter 17 MoA Transformer Figure

- Label: `ch17-moa-transformer-figure-v1`
- Source: `gnosis-moa-transformer-evidence-v1`
- Sparse GG primitive: `StructuredMoA`
- Sparse GG topology: `/Users/buley/Documents/Code/emotions/open-source/gnosis/examples/benchmarks/moa-transformer-moa.gg`
- Regular GG topology: `/Users/buley/Documents/Code/emotions/open-source/gnosis/examples/benchmarks/moa-transformer-regular.gg`
- Speedup range: `2.56x` to `7.02x`
- Head reduction factor: `4.0x`
- Frame reduction factor: `4.0x`

## Scale Sweep

| Scale | Speedup | Accuracy gap | MoA eval MSE | Regular eval MSE | MoA heads | Regular heads | MoA frames | Regular frames |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compact workload | 7.02x | 0.0806 | 0.0829 | 0.0023 | 4.0 | 16.0 | 16.0 | 64.0 |
| Baseline workload | 4.45x | 0.0662 | 0.0666 | 0.0005 | 4.0 | 16.0 | 16.0 | 64.0 |
| Wide workload | 2.56x | 0.0025 | 0.0033 | 0.0008 | 4.0 | 16.0 | 16.0 | 64.0 |

## Ablation Frontier

| Ablation | Speedup | Exact fraction | Compute-adjusted exact | Eval MSE |
| --- | ---: | ---: | ---: | ---: |
| Full MoA | 3.66x | 0.9225 | 0.2306 | 0.0014 |
| No outer sparsity | 2.19x | 1.0000 | 0.1250 | 0.0003 |
| No inner sparsity | 1.96x | 0.9900 | 0.1237 | 0.0009 |
| Under-routed | 6.38x | 0.1900 | 0.0950 | 0.2233 |

Interpretation: this figure isolates the GG-backed sparse transformer result. `StructuredMoA` keeps a timing advantage across the sweep, the eval-MSE gap closes sharply by the wide workload, and the ablation frontier shows that both outer routing sparsity and inner head sparsity are carrying real efficiency signal rather than decorative pruning.

