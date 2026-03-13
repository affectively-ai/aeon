# Adaptive Supremum Family Sweep

This artifact lifts the concrete adaptive-supremum witness from one tuple to a curated raw-parameter family of bounded two-node rerouting cases.

## Summary

- Cases: 9
- Family closure recovered: yes
- Raw assumptions satisfied in every case: yes
- Schedules recovered in every case: yes
- All spectral radii are zero: yes
- Minimum drift gap: 0.026
- Minimum left-node service slack: 0.140
- Minimum right-node service slack: 0.026
- Maximum left-row sum: 0.750
- Maximum bounded state count: 32
- Tightest case: tight-right-slack-2x2

## Cases

| Case | Cube | Alpha left | Alpha right | Drift gap | Right slack | States | Checks pass |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| base-2x2 | 2x2 | 0.250 | 0.275 | 0.125 | 0.125 | 18 | yes |
| low-reroute-2x2 | 2x2 | 0.200 | 0.150 | 0.170 | 0.170 | 18 | yes |
| high-reroute-2x2 | 2x2 | 0.200 | 0.200 | 0.250 | 0.250 | 18 | yes |
| tight-right-slack-2x2 | 2x2 | 0.240 | 0.234 | 0.026 | 0.026 | 18 | yes |
| wide-slack-3x1 | 3x1 | 0.150 | 0.125 | 0.225 | 0.225 | 16 | yes |
| wide-right-1x3 | 1x3 | 0.180 | 0.170 | 0.150 | 0.150 | 16 | yes |
| small-cube-1x1 | 1x1 | 0.100 | 0.100 | 0.110 | 0.110 | 8 | yes |
| large-cube-3x3 | 3x3 | 0.220 | 0.198 | 0.132 | 0.132 | 32 | yes |
| balanced-mid-2x3 | 2x3 | 0.160 | 0.170 | 0.080 | 0.080 | 24 | yes |
