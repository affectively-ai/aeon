# Chapter 17 Boundary Expansion Figure

- Label: `ch17-boundary-expansion-figure-v1`
- Regime sweep source: `gnosis-fold-boundary-regime-sweep-v1`
- Adversarial source: `gnosis-adversarial-controls-benchmark-v1`

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

Interpretation: the regime sweeps show where linear recombination begins to matter, while the adversarial controls show the other side of the boundary by exhibiting tasks where sparse nonlinear selection or early stopping is the better inductive bias.

