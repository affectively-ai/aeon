# Chapter 17 Boundary Expansion Figure

- Label: `ch17-boundary-expansion-figure-v2`
- Near-control source: `gnosis-near-control-sweep-v1`
- Regime sweep source: `gnosis-fold-boundary-regime-sweep-v1`
- Adversarial source: `gnosis-adversarial-controls-benchmark-v1`

## Near-Control Zoom

- Affine last parity / first separated: `0.35` / `0.40`
- Routed last parity / first separated: `0.60` / `0.65`

| Family | Regime | Linear advantage (eval MSE) |
| --- | ---: | ---: |
| `affine` | 0.00 | -0.000 |
| `affine` | 0.05 | 0.002 |
| `affine` | 0.10 | 0.007 |
| `affine` | 0.15 | 0.017 |
| `affine` | 0.20 | 0.029 |
| `affine` | 0.25 | 0.042 |
| `affine` | 0.30 | 0.058 |
| `affine` | 0.35 | 0.075 |
| `affine` | 0.40 | 0.094 |
| `affine` | 0.50 | 0.139 |
| `routed` | 0.00 | 0.000 |
| `routed` | 0.10 | 0.001 |
| `routed` | 0.20 | 0.005 |
| `routed` | 0.30 | 0.011 |
| `routed` | 0.40 | 0.019 |
| `routed` | 0.50 | 0.030 |
| `routed` | 0.55 | 0.036 |
| `routed` | 0.60 | 0.043 |
| `routed` | 0.65 | 0.050 |
| `routed` | 0.75 | 0.067 |

## Regime Sweep

- Affine first separated regime value: `0.50`
- Routed first separated regime value: `0.75`

| Family | Regime | Linear advantage (eval MSE) | Linear exact advantage |
| --- | ---: | ---: | ---: |
| `affine` | 0.00 | -0.000 | 0.000 |
| `affine` | 0.25 | 0.042 | 0.940 |
| `affine` | 0.50 | 0.139 | 0.991 |
| `affine` | 0.75 | 0.267 | 1.000 |
| `affine` | 1.00 | 0.393 | 0.968 |
| `routed` | 0.00 | 0.000 | 0.000 |
| `routed` | 0.25 | 0.007 | 0.434 |
| `routed` | 0.50 | 0.030 | 0.694 |
| `routed` | 0.75 | 0.067 | 0.830 |
| `routed` | 1.00 | 0.111 | 0.854 |

## Adversarial Controls

| Task | Favored | Final winner | AUC winner |
| --- | --- | --- | --- |
| `winner-affine-maxabs` | `winner-take-all` | `winner-take-all` | `winner-take-all` |
| `early-stop-routing-first-expert-short-budget` | `early-stop` | `early-stop` | `early-stop` |
| `early-stop-left-priority-short-budget` | `early-stop` | `early-stop` | `early-stop` |

Interpretation: the near-control zoom makes the parity-to-separation onset explicit at low recombination demand, the coarse regime sweeps show how that advantage continues to grow, and the adversarial controls show the other side of the boundary by exhibiting tasks where sparse nonlinear selection or early stopping is the better inductive bias.

