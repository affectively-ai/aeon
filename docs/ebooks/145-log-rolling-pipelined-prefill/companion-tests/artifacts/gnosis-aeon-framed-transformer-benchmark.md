# Gnosis Aeon-Framed Transformer Benchmark

- Label: `gnosis-aeon-framed-transformer-benchmark-v1`
- Target family: `quadrant-l1-framed-transformer`
- Seeds: `12`
- Epochs: `1800`
- Learning rate: `0.02`
- Frame stages per stream: `4`
- Train samples: `169`
- Eval samples: `100`
- Shared parameter count: `16`
- Shared structural β₁: `11`
- Rotation stage count: `4`
- Predicted ranking recovered: `yes`

## Aggregated Metrics

| Strategy | Mean eval MSE | Eval MSE 95% CI | Exact-within-tolerance | Exact 95% CI | Dual-active abs error | Codec round-trip | Reassembly | Fold invariance | Mean frames/sample | Mean payload bytes/sample |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `linear` | 0.001 | [0.001, 0.001] | 0.981 | [0.973, 0.988] | 0.027 | 1.000 | 1.000 | 1.000 | 16.0 | 224.0 |
| `winner-take-all` | 0.318 | [0.273, 0.365] | 0.070 | [0.043, 0.101] | 0.443 | 1.000 | 1.000 | 1.000 | 16.0 | 224.0 |
| `early-stop` | 0.462 | [0.461, 0.464] | 0.073 | [0.067, 0.080] | 0.579 | 1.000 | 1.000 | 1.000 | 16.0 | 224.0 |

## Sample Predictions

| Strategy | Input pair | Target | Mean prediction | Prediction σ | Mean frames | Mean payload bytes |
|---|---|---:|---:|---:|---:|---:|
| `linear` | (-1.20, -1.20) | 2.400 | 2.427 | 0.005 | 16.0 | 224.0 |
| `linear` | (-1.20, 1.20) | 2.400 | 2.424 | 0.007 | 16.0 | 224.0 |
| `linear` | (1.20, -1.20) | 2.400 | 2.422 | 0.010 | 16.0 | 224.0 |
| `linear` | (1.20, 1.20) | 2.400 | 2.419 | 0.012 | 16.0 | 224.0 |
| `linear` | (1.20, 0.00) | 1.200 | 1.305 | 0.014 | 16.0 | 224.0 |
| `winner-take-all` | (-1.20, -1.20) | 2.400 | 1.627 | 0.332 | 16.0 | 224.0 |
| `winner-take-all` | (-1.20, 1.20) | 2.400 | 1.751 | 0.258 | 16.0 | 224.0 |
| `winner-take-all` | (1.20, -1.20) | 2.400 | 1.714 | 0.244 | 16.0 | 224.0 |
| `winner-take-all` | (1.20, 1.20) | 2.400 | 1.790 | 0.204 | 16.0 | 224.0 |
| `winner-take-all` | (1.20, 0.00) | 1.200 | 1.453 | 0.481 | 16.0 | 224.0 |
| `early-stop` | (-1.20, -1.20) | 2.400 | 1.259 | 0.009 | 16.0 | 224.0 |
| `early-stop` | (-1.20, 1.20) | 2.400 | 1.259 | 0.009 | 16.0 | 224.0 |
| `early-stop` | (1.20, -1.20) | 2.400 | 1.532 | 0.037 | 16.0 | 224.0 |
| `early-stop` | (1.20, 1.20) | 2.400 | 1.532 | 0.037 | 16.0 | 224.0 |
| `early-stop` | (1.20, 0.00) | 1.200 | 1.532 | 0.037 | 16.0 | 224.0 |

Interpretation: a Wallington-style staged input boundary feeds four toy transformerlets that each emit real Aeon flow frames, while the Worthington-style collapse boundary varies only the fold law. Linear collapse alone can aggregate the two simultaneously active transformerlets required for the `|x| + |y|` target, and the same framed outputs survive codec round-trips plus out-of-order reassembly without changing the result.

