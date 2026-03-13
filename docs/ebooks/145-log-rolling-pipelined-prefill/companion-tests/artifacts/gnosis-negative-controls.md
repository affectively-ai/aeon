# Gnosis Negative Controls Benchmark

- Label: `gnosis-negative-controls-v1`
- All controls pass: `yes`

## Affine left-only control

- Task id: `affine-left-only`
- Description: Reuses the two-branch affine topology but trains only on left-path signal with right input pinned to zero, so additive recombination is unnecessary.
- Topology family: `fold-training`
- Target family: `left-only-affine`
- Shared parameter count: `4`
- Shared structural β₁: `1`
- Control recovered: `yes` (max eval-MSE gap 0.000, min exact 1.000)

| Strategy | Mean eval MSE | Eval MSE 95% CI | Exact-within-tolerance | Exact 95% CI |
|---|---:|---:|---:|---:|
| `winner-take-all` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |
| `early-stop` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |
| `linear` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |

| Strategy | Input pair | Target | Mean prediction | Prediction σ |
|---|---|---:|---:|---:|
| `winner-take-all` | (-1.00, 0.00) | -1.000 | -1.000 | 0.000 |
| `winner-take-all` | (-0.50, 0.00) | -0.500 | -0.500 | 0.000 |
| `winner-take-all` | (0.50, 0.00) | 0.500 | 0.500 | 0.000 |
| `winner-take-all` | (1.00, 0.00) | 1.000 | 1.000 | 0.000 |
| `early-stop` | (-1.00, 0.00) | -1.000 | -1.000 | 0.000 |
| `early-stop` | (-0.50, 0.00) | -0.500 | -0.500 | 0.000 |
| `early-stop` | (0.50, 0.00) | 0.500 | 0.500 | 0.000 |
| `early-stop` | (1.00, 0.00) | 1.000 | 1.000 | 0.000 |
| `linear` | (-1.00, 0.00) | -1.000 | -1.000 | 0.000 |
| `linear` | (-0.50, 0.00) | -0.500 | -0.500 | 0.000 |
| `linear` | (0.50, 0.00) | 0.500 | 0.500 | 0.000 |
| `linear` | (1.00, 0.00) | 1.000 | 1.000 | 0.000 |

## Positive-x single-expert routing control

- Task id: `routing-positive-x-only`
- Description: Reuses the four-expert routed topology but restricts the task to positive x-axis samples where one expert is sufficient, so nonlinear selection should not be penalized.
- Topology family: `moe-routing`
- Target family: `positive-x-single-expert`
- Shared parameter count: `16`
- Shared structural β₁: `3`
- Control recovered: `yes` (max eval-MSE gap 0.000, min exact 1.000)

| Strategy | Mean eval MSE | Eval MSE 95% CI | Exact-within-tolerance | Exact 95% CI |
|---|---:|---:|---:|---:|
| `linear` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |
| `winner-take-all` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |
| `early-stop` | 0.000 | [0.000, 0.000] | 1.000 | [1.000, 1.000] |

| Strategy | Input pair | Target | Mean prediction | Prediction σ |
|---|---|---:|---:|---:|
| `linear` | (0.20, 0.00) | 0.200 | 0.212 | 0.001 |
| `linear` | (0.60, 0.00) | 0.600 | 0.580 | 0.001 |
| `linear` | (1.00, 0.00) | 1.000 | 0.984 | 0.001 |
| `linear` | (1.40, 0.00) | 1.400 | 1.421 | 0.001 |
| `winner-take-all` | (0.20, 0.00) | 0.200 | 0.215 | 0.001 |
| `winner-take-all` | (0.60, 0.00) | 0.600 | 0.576 | 0.001 |
| `winner-take-all` | (1.00, 0.00) | 1.000 | 0.982 | 0.001 |
| `winner-take-all` | (1.40, 0.00) | 1.400 | 1.425 | 0.001 |
| `early-stop` | (0.20, 0.00) | 0.200 | 0.215 | 0.001 |
| `early-stop` | (0.60, 0.00) | 0.600 | 0.576 | 0.001 |
| `early-stop` | (1.00, 0.00) | 1.000 | 0.982 | 0.001 |
| `early-stop` | (1.40, 0.00) | 1.400 | 1.425 | 0.001 |

Interpretation: these controls reuse the Chapter 17 Gnosis topologies but switch to one-path tasks where additive recombination is unnecessary. The expected result is parity across fold rules, which is what the artifact reports.

