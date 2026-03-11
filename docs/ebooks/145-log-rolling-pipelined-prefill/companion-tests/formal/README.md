# Formal Verification Artifacts (TLA+ + Lean)

- Parent README: [../README.md](../README.md)
- Theorem ledger: [THEOREM_LEDGER.md](./THEOREM_LEDGER.md)
- Lean package: [lean/README.md](./lean/README.md)

This directory contains machine-checked formal artifacts used to mechanize the paper's strongest quantitative and topological claims.

## Files

- `ForkRaceFoldC1C4.tla` / `.cfg`: pipeline locality, branch isolation, deterministic fold, bounded termination (C1–C4).
- `Section7Formulas.tla` / `.cfg`: §7 formulas (Worthington Whip, Speculative Tree, turbulent idle fraction sample).
- `WhipCrossover.tla` / `.cfg`: §7.3 cross-shard correction crossover characterization (`T(S)=ceil(P/S)+(N-1)+C*S`) with finite optimum and strict-over-sharding boundary checks.
- `QuantumDeficit.tla` / `.cfg`: §6.12 speedup = topological deficit identity (Grover-scale sample).
- `BeautyOptimality.tla` / `.cfg`: §6.12 Bu beauty-optimality scaffold (definition, latency/waste monotonicity, Pareto/composition invariants).
- `BandGapVoid.tla` / `.cfg`: §6.11 band gaps as voids (`β₂ > 0`) on a finite periodic-energy sample.
- `ProtocolDeficit.tla` / `.cfg`: §8.3 protocol topology deficits (TCP vs QUIC/Aeon Flow).
- `SettlementDeficit.tla` / `.cfg`: §6.12 evidence-table settlement deficit (`Δβ = 2` for T+2 sequential baseline).
- `lean/Lean/ForkRaceFoldTheorems/Claims.lean`: constructive Lean theorems for quantitative identities.
- `lean/Lean/ForkRaceFoldTheorems/Axioms.lean`: explicit-assumption theorem schemas for global claims (including convergence in the modeled finite class).

## Run

From `companion-tests/`:

```bash
bun run test:formal:parser
bun run test:formal:lean
bun run test:formal
```

`test:formal:parser` validates all `.tla/.cfg` artifacts with the self-hosted `aeon-logic` parser.
`test:formal:lean` builds all Lean theorem modules via `lake build`.
`test:formal` runs parser preflight, Lean build and TLC model checking.
