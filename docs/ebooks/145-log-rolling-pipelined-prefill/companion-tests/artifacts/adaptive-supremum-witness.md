# Adaptive Supremum Witness

This artifact mirrors the concrete two-node adaptive rerouting closure proved in Lean.

## Parameters

- Left arrival: 0.250
- Right arrival: 0.150
- Reroute probability: 0.500
- Left service: 0.500
- Right service: 0.400

## Ceiling

- Left row sum: 0.500
- Right row sum: 0.000
- Spectral radius: 0.000
- Nilpotent order: 2
- Square is zero: yes

## Candidate

- Left coordinate: 0.250
- Right coordinate: 0.275
- Left fixed-point residual: 0.000e+0
- Right fixed-point residual: 0.000e+0
- Left service slack: 0.250
- Right service slack: 0.125

## Drift

- Drift gap: 0.125
- State count: 18
- Small set count: 1
- Domination violations: 0
- Row-sum violations: 0
- Drift violations: 0

## Schedules

| Schedule | Pattern | Sup left | Sup right | Expected sup right | Recovered |
| --- | --- | ---: | ---: | ---: | --- |
| always-uncongested | `0` | 0.250 | 0.150 | 0.150 | yes |
| always-congested | `1` | 0.250 | 0.275 | 0.275 | yes |
| alternating | `01` | 0.250 | 0.275 | 0.275 | yes |
| delayed-reroute | `0011` | 0.250 | 0.275 | 0.275 | yes |
