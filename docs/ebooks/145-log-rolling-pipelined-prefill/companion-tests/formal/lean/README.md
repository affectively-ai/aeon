# Lean Theorems

- Parent README: [../README.md](../README.md)
- Ledger: [../THEOREM_LEDGER.md](../THEOREM_LEDGER.md)
- Source root: [Lean/README.md](./Lean/README.md)

This directory contains a Lean 4 theorem package that encodes explicit-assumption theorems for core paper claims.

## Modules

- `Lean/ForkRaceFoldTheorems.lean`: library entrypoint.
- `Lean/ForkRaceFoldTheorems/Claims.lean`: constructive proofs for quantitative claims.
- `Lean/ForkRaceFoldTheorems/Axioms.lean`: assumption-parameterized theorem schemas for global claims.

## Run

```bash
bun run test:formal:lean
bash ../../scripts/run-lean-theorems.sh
```
