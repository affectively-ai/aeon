# Gnosis Near-Control Sweep

- Label: `gnosis-near-control-sweep-v1`
- Predicted near-control recovery: `yes`
- Affine regime values: `0.00`, `0.05`, `0.10`, `0.15`, `0.20`, `0.25`, `0.30`, `0.35`, `0.40`, `0.50`
- Routed regime values: `0.00`, `0.10`, `0.20`, `0.30`, `0.40`, `0.50`, `0.55`, `0.60`, `0.65`, `0.75`

## Affine cancellation regime sweep

- Description: Reuses the two-branch affine topology while increasing the right-branch cancellation weight from one-path parity to full left-minus-right cancellation.
- Sweep dimension: cancellation weight on the right branch
- Last parity regime value: `0.35`
- First separated regime value: `0.40`
- Near-control divergence recovered: `yes`

| Regime | Linear advantage (eval MSE) | Linear exact advantage | Best nonlinear |
| ---: | ---: | ---: | --- |
| 0.00 | -0.000 | 0.000 | `winner-take-all` |
| 0.05 | 0.002 | 0.333 | `winner-take-all` |
| 0.10 | 0.007 | 0.667 | `winner-take-all` |
| 0.15 | 0.017 | 0.699 | `winner-take-all` |
| 0.20 | 0.029 | 0.833 | `winner-take-all` |
| 0.25 | 0.042 | 0.940 | `winner-take-all` |
| 0.30 | 0.058 | 0.968 | `winner-take-all` |
| 0.35 | 0.075 | 0.977 | `winner-take-all` |
| 0.40 | 0.094 | 0.977 | `winner-take-all` |
| 0.50 | 0.139 | 0.991 | `winner-take-all` |


## Routed dual-activation regime sweep

- Description: Reuses the four-expert routed topology while increasing the y-axis contribution weight from single-expert parity to full dual-axis dependence.
- Sweep dimension: dual-activation weight on the y-axis contribution
- Last parity regime value: `0.60`
- First separated regime value: `0.65`
- Near-control divergence recovered: `yes`

| Regime | Linear advantage (eval MSE) | Linear exact advantage | Best nonlinear |
| ---: | ---: | ---: | --- |
| 0.00 | 0.000 | 0.000 | `early-stop` |
| 0.10 | 0.001 | 0.000 | `early-stop` |
| 0.20 | 0.005 | 0.333 | `early-stop` |
| 0.30 | 0.011 | 0.587 | `early-stop` |
| 0.40 | 0.019 | 0.667 | `early-stop` |
| 0.50 | 0.030 | 0.694 | `early-stop` |
| 0.55 | 0.036 | 0.729 | `early-stop` |
| 0.60 | 0.043 | 0.753 | `early-stop` |
| 0.65 | 0.050 | 0.792 | `early-stop` |
| 0.75 | 0.067 | 0.830 | `early-stop` |


Interpretation: this near-control sweep zooms the control end of the boundary, showing how long parity persists before linear recombination opens a measurable advantage as additive demand rises.

