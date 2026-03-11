# Fork/Race/Collapse Is All You Need — Companion Tests

- Parent volume README: [open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/README.md](../README.md)
- Live docs home: [docs.aeonflux.dev](https://docs.aeonflux.dev)
- Test sources: [src/README.md](./src/README.md)
- Formal artifacts: [formal/README.md](./formal/README.md)
- Script helpers: [scripts/README.md](./scripts/README.md)

Reproducible test suite for the claims in the arXiv manuscript.

## Quick Start

```bash
bun install
bun run test
bun run test:formal:parser
bun run test:formal
```

## Test Sections (mapped to paper sections)

| Test File | Paper Section | What It Proves |
|-----------|--------------|----------------|
| `pipeline-topology.test.ts` | §1.1 The Triangle, §3 Pipeline Equation | Order preservation, β₁ lifecycle, Re phase transitions |
| `flow-protocol.test.ts` | §8 The Wire, §8.2.1 Self-Describing Frames | 10-byte framing, fork/race/collapse/poison on wire |
| `topological-compression.test.ts` | §8.6 Topological Compression | Per-chunk adaptive codec selection, subsumption |
| `pipeline-formulas.test.ts` | §7 formulas | Worthington Whip, Speculative Tree, turbulent idle-fraction bounds, cross-shard correction crossover characterization |
| `dag-completeness.test.ts` | §2.4 completeness | Executable finite-DAG decomposition coverage (fork/join/chain partition totality) |
| `quantum-topology.test.ts` | §6.11–§6.12, §13 | Quantum deficit identity, band-gap as β₂, convergence simulation under three constraints |
| `deficit-evidence.test.ts` | §6.12 evidence table, §8.3 | Protocol/settlement/healthcare deficits and entropy-vent trend checks |
| `map-reduce-readiness.test.ts` | §6.13 heuristic | Executable checks for `Q_mr`, `O_beta`, `R_qr` bounds/monotonicity and synthetic promotion correlation |
| `physics-hierarchy.test.ts` | §6.11 | Executable hierarchy checks for path-integral/race/fold mappings and energy partitions (model scope) |
| `emergent-connections.test.ts` | Chapter 23 | Executable analog checks for nine emergent correspondences (model scope) |
| `thermodynamics.test.ts` | §6 Thermodynamics | First Law accounting, Carnot/Shannon bounds, ground-state overhead |
| `queueing-subsumption.test.ts` | §5 End of Queueing Theory | Little's Law as β₁=0 degenerate case |
| `shootoff.test.ts` | §8.5 Shootoff Benchmarks | Protocol comparison with real compression |
| `evidence-traceability.test.ts` + `evidence-sources.ts` | §6.12 evidence table | Citation/provenance checks for empirical constants used in tests |
| `formal/*.tla` + TLC | §2.5, §6.11–§6.12, §7, §8.3 | Mechanized checks for C1–C4, §7 formulas, quantum/topology deficits, Bu beauty-optimality scaffolds, protocol/settlement deficits, and band-gap voids |
| `formal/lean/*.lean` + Lake | §2.4–§2.5, §4, §6.12, §7, §11, §13 | Theorem-level mechanization with explicit assumptions for quantitative identities and top-level theorem schemas (including convergence schema) |
| `formal-parser-compat.test.ts` + `scripts/validate-formal-artifacts.ts` | §11 Validation | Self-hosted `aeon-logic` parsing + round-trip validation for all `.tla/.cfg` artifacts |
| `scripts/formal-parser-equivalence.ts` | §11 Validation | Differential semantic-equivalence harness against Java SANY parse outcomes (agreement on valid corpus, round-trip corpus and invalid mutations) |

## Running Individual Sections

```bash
bun test:pipeline      # §1.1, §3
bun test:flow          # §8
bun test:compression   # §8.6
bun test:thermodynamics # §6
bun test:shootoff      # §8.5
bun test:queueing      # §5
bun test:formal:parser # aeon-logic parser preflight for formal artifacts
bun test:formal:lean   # Lean theorem build
bun test:formal        # all formal models via TLC
bun test:formal:shootoff # parser throughput vs Java baseline
bun test:formal:equivalence # differential semantic-equivalence harness vs Java SANY
bun test:all           # vitest suite + TLA+ model check
```

## Dependencies

This test suite depends on `@anthropic-ai/aeon` (runtime protocol/compression primitives) and `@affectively/aeon-logic` (self-hosted TLC/TLA parser + formal compatibility adapters).
