# Gnosis Fold Boundary Regime Sweep

- Label: `gnosis-fold-boundary-regime-sweep-v1`
- Predicted boundary recovered: `yes`
- Affine seeds/epochs: `6` / `420`
- Routed seeds/epochs: `8` / `720`
- Regime values: `0.00`, `0.25`, `0.50`, `0.75`, `1.00`

## Affine cancellation regime sweep

- Description: Reuses the two-branch affine topology while increasing the right-branch cancellation weight from one-path parity to full left-minus-right cancellation.
- Topology family: `fold-training`
- Target family: `weighted-cancellation`
- Sweep dimension: cancellation weight on the right branch
- Shared topology: β₁=1, units=2, parameters=4
- First separated regime value: `0.50`
- Phase boundary recovered: `yes`
- Monotonic advantage recovered: `yes`

| Regime | Linear eval MSE | Best nonlinear | Best nonlinear eval MSE | Linear advantage | Linear exact | Best nonlinear exact | Ranking |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 0.00 | 0.000 | `winner-take-all` | 0.000 | -0.000 | 1.000 | 1.000 | `winner-take-all` < `linear` < `early-stop` |
| 0.25 | 0.000 | `winner-take-all` | 0.042 | 0.042 | 1.000 | 0.060 | `linear` < `winner-take-all` < `early-stop` |
| 0.50 | 0.000 | `winner-take-all` | 0.139 | 0.139 | 1.000 | 0.009 | `linear` < `winner-take-all` < `early-stop` |
| 0.75 | 0.000 | `winner-take-all` | 0.267 | 0.267 | 1.000 | 0.000 | `linear` < `winner-take-all` < `early-stop` |
| 1.00 | 0.000 | `winner-take-all` | 0.393 | 0.393 | 1.000 | 0.032 | `linear` < `winner-take-all` < `early-stop` |


## Routed dual-activation regime sweep

- Description: Reuses the four-expert routed topology while increasing the y-axis contribution weight from single-expert parity to full dual-axis dependence.
- Topology family: `moe-routing`
- Target family: `weighted-dual-activation`
- Sweep dimension: dual-activation weight on the y-axis contribution
- Shared topology: β₁=3, units=4, parameters=16
- First separated regime value: `0.75`
- Phase boundary recovered: `yes`
- Monotonic advantage recovered: `yes`

| Regime | Linear eval MSE | Best nonlinear | Best nonlinear eval MSE | Linear advantage | Linear exact | Best nonlinear exact | Ranking |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 0.00 | 0.000 | `early-stop` | 0.000 | 0.000 | 1.000 | 1.000 | `linear` < `early-stop` < `winner-take-all` |
| 0.25 | 0.000 | `early-stop` | 0.007 | 0.007 | 1.000 | 0.566 | `linear` < `early-stop` < `winner-take-all` |
| 0.50 | 0.000 | `early-stop` | 0.030 | 0.030 | 1.000 | 0.306 | `linear` < `early-stop` < `winner-take-all` |
| 0.75 | 0.000 | `early-stop` | 0.067 | 0.067 | 1.000 | 0.170 | `linear` < `early-stop` < `winner-take-all` |
| 1.00 | 0.000 | `winner-take-all` | 0.111 | 0.111 | 1.000 | 0.146 | `linear` < `winner-take-all` < `early-stop` |


Interpretation: both sweeps start in the one-path parity regime, then move into task families that increasingly require additive recombination. The reported linear advantage quantifies where the nonlinear selection rules stop matching the linear baseline and how sharply that separation grows.

