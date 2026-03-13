# Gnosis Adversarial Controls Benchmark

- Label: `gnosis-adversarial-controls-benchmark-v1`
- All adversarial predictions recovered: `yes`

## Winner-aligned affine max-abs task

- Task id: `winner-affine-maxabs`
- Description: Keeps the affine two-branch topology fixed but switches the target to signed max-by-magnitude, where winner-selection is the correct recombination rule.
- Topology family: `fold-training`
- Target family: `winner-max-abs-affine`
- Favored strategy: `winner-take-all`
- Success criterion: `final-and-sample-efficiency`
- Prediction recovered: `yes`

| Strategy | Final eval MSE | Final eval 95% CI | Exact | Learning-curve area | Area 95% CI | Mean epochs-to-tolerance | Final rank | AUC rank |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `linear` | 0.271 | [0.254, 0.295] | 0.139 | 0.265 | [0.263, 0.267] | 481.0 | 2 | 2 |
| `winner-take-all` | 0.095 | [0.003, 0.253] | 0.833 | 0.097 | [0.014, 0.251] | 100.2 | 1 | 1 |
| `early-stop` | 0.484 | [0.480, 0.489] | 0.222 | 0.482 | [0.482, 0.483] | 481.0 | 3 | 3 |


## Early-stop aligned routed first-expert task

- Task id: `early-stop-routing-first-expert-short-budget`
- Description: Keeps the four-expert routed topology fixed, correlates the y-axis with x during training, and evaluates on independent y so always taking the first x-positive expert should pay off under a short budget.
- Topology family: `moe-routing`
- Target family: `x-priority-routing-short-budget`
- Favored strategy: `early-stop`
- Success criterion: `sample-efficiency`
- Prediction recovered: `yes`

| Strategy | Final eval MSE | Final eval 95% CI | Exact | Learning-curve area | Area 95% CI | Mean epochs-to-tolerance | Final rank | AUC rank |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `linear` | 0.179 | [0.090, 0.284] | 0.192 | 0.200 | [0.093, 0.307] | 18.6 | 2 | 2 |
| `winner-take-all` | 0.329 | [0.177, 0.487] | 0.246 | 0.342 | [0.184, 0.508] | 20.8 | 3 | 3 |
| `early-stop` | 0.022 | [0.017, 0.027] | 0.375 | 0.036 | [0.027, 0.046] | 10.0 | 1 | 1 |


## Early-stop aligned left-priority task

- Task id: `early-stop-left-priority-short-budget`
- Description: Keeps the affine topology fixed, injects large distractor right-branch magnitudes, and measures a short training budget where always taking the first branch should pay off in sample efficiency.
- Topology family: `fold-training`
- Target family: `left-priority-short-budget`
- Favored strategy: `early-stop`
- Success criterion: `sample-efficiency`
- Prediction recovered: `yes`

| Strategy | Final eval MSE | Final eval 95% CI | Exact | Learning-curve area | Area 95% CI | Mean epochs-to-tolerance | Final rank | AUC rank |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `linear` | 0.245 | [0.205, 0.289] | 0.128 | 0.531 | [0.440, 0.623] | 25.0 | 2 | 2 |
| `winner-take-all` | 1.342 | [1.171, 1.448] | 0.022 | 1.375 | [1.233, 1.459] | 25.0 | 3 | 3 |
| `early-stop` | 0.000 | [0.000, 0.000] | 1.000 | 0.006 | [0.006, 0.006] | 4.0 | 1 | 1 |


Interpretation: these controls flip the story around. They keep the parameter-matched Chapter 17 topologies fixed, but choose targets where sparse nonlinear selection is the right inductive bias or where early stopping should help under a tight budget. The point is to show a boundary, not a one-sided preference for linearity.

