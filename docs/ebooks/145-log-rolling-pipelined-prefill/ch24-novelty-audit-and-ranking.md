# Chapter 24: Proved Novel Ideas Ranking (With Proof Citations)

> Parent index: [README.md](./README.md)  
> Primary source reviewed: [ch17-arxiv-manuscript.md](./ch17-arxiv-manuscript.md)

## Scope

This ranking includes only claims with direct proof artifacts.

`Proved` means at least one of:

1. Mechanized theorem/model check (`TLA+`, `Lean`, parser closure), or
2. Executable companion tests with deterministic assertions and reproducible commands.

Excluded from this ranking (not because they are weak, but because they are not proved as theorems/tests in current artifacts):

- map/reduce as quantum-readiness heuristic,
- broad interpretive physics metaphors not tied to explicit theorem IDs,
- rhetorical framing that is not test-backed.

## Ranking Method

Each proved idea is scored on a 0-5 scale:

- `P` (Proof strength): mechanized > executable-only
- `I` (Systems impact): practical effect on runtime/protocol/optimization decisions
- `N` (Novelty signal): distinctiveness versus standard practice

Weighted score:

$$
\text{Score} = 0.45P + 0.35I + 0.20N
$$

## Ranked Proved Ideas

Run all commands from:

```bash
open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests
```

| Rank | Proved Idea | P | I | N | Score | Proof Citations | Repro |
|---|---|---:|---:|---:|---:|---|---|
| 1 | **Topological deficit diagnostic (`Δβ`) / Bule metric operationalizes waste-opportunity gap** (protocol + settlement + systems evidence) | 5.0 | 5.0 | 4.8 | **4.96** | [C1][C6][C7][C16][C8] | `bun test src/deficit-evidence.test.ts && bun run test:formal` |
| 2 | **Fork/race/fold safety and liveness under C1-C4** (plus explicit DAG-expressibility schema) | 5.0 | 4.7 | 4.6 | **4.80** | [C1][C2][C9] | `bun run test:formal` |
| 3 | **Quantum speedup identity in topology-matched regime** (`speedup = classical deficit + 1`, `Δβ_quantum = 0`) | 5.0 | 4.6 | 4.8 | **4.78** | [C1][C4][C17][C8] | `bun test src/quantum-topology.test.ts && bun run test:formal` |
| 4 | **Queueing containment theorem** (Little's Law at `β₁=0`, strict extension when `β₁>0`) | 4.7 | 4.6 | 4.4 | **4.59** | [C1][C12][C9] | `bun run test:queueing && bun run test:formal` |
| 5 | **Worthington Whip law** (per-shard savings shape + positivity bounds) | 5.0 | 4.0 | 4.5 | **4.55** | [C1][C3][C11][C8] | `bun test src/pipeline-formulas.test.ts && bun run test:formal` |
| 6 | **Speculative Tree acceptance law** (`(1-\u03b1^K)/(1-\u03b1)` behavior + positivity constraints) | 5.0 | 3.9 | 4.4 | **4.48** | [C1][C3][C11][C8] | `bun test src/pipeline-formulas.test.ts && bun run test:formal` |
| 7 | **Wallington Rotation / chunked pipelined prefill equations** (exact step counts + asymptotic scaling) | 4.0 | 4.9 | 4.6 | **4.46** | [C10][C20] | `bun run test:pipeline` |
| 8 | **Topological compression subsumes fixed-codec compression** (per-chunk adaptive race, venting, independent decode) | 4.0 | 4.7 | 4.5 | **4.41** | [C14][C18][C20] | `bun run test:compression && bun run test:shootoff` |
| 9 | **Aeon Flow wire realization** (10-byte self-describing frame; fork/race/fold/vent semantics on-wire) | 4.0 | 4.8 | 4.4 | **4.40** | [C13][C18][C20] | `bun run test:flow && bun run test:shootoff` |
| 10 | **First-law conservation for modeled codec races** (`V_fork = W_fold + Q_vent`) with entropy-bound behavior checks | 4.8 | 4.0 | 4.0 | **4.34** | [C1][C15][C8] | `bun run test:thermodynamics && bun run test:formal` |
| 11 | **Band-gap as topological void (`\u03b2\u2082 > 0`)** in finite periodic-energy model | 5.0 | 3.6 | 4.3 | **4.33** | [C1][C5][C8][C17] | `bun test src/quantum-topology.test.ts && bun run test:formal` |
| 12 | **Turbulent multiplexing bounds + Reynolds regime behavior** (idle bounds, phase regime transitions) | 4.5 | 4.2 | 4.1 | **4.31** | [C1][C3][C10][C11] | `bun run test:pipeline && bun test src/pipeline-formulas.test.ts` |
| 13 | **Transformer decomposition to recursive fork/race/fold** (attention-equivalent outputs in tests) | 3.8 | 4.4 | 4.2 | **4.11** | [C15] | `bun run test:thermodynamics` |
| 14 | **Formal parser-closure theorem** for self-hosted artifact consistency (`.tla/.cfg` round-trip + pairing) | 4.6 | 3.2 | 3.5 | **3.92** | [C1][C19][C9] | `bun run test:formal:parser` |

## Notes on "Bule as Computational Aesthetics"

What is proved in current artifacts is the **measurement layer**:

- `Bule` as a concrete deficit quantity (`Δβ`) tied to implementation mismatch and measurable waste/opportunity gaps.

The phrase "computational aesthetics" is a valid interpretation, but that interpretation itself is not an additional theorem. This chapter therefore ranks the proved metric behavior, not the rhetorical layer.

## Proof Citations

- [C1] [formal/THEOREM_LEDGER.md](./companion-tests/formal/THEOREM_LEDGER.md)
- [C2] [formal/ForkRaceFoldC1C4.tla](./companion-tests/formal/ForkRaceFoldC1C4.tla)
- [C3] [formal/Section7Formulas.tla](./companion-tests/formal/Section7Formulas.tla)
- [C4] [formal/QuantumDeficit.tla](./companion-tests/formal/QuantumDeficit.tla)
- [C5] [formal/BandGapVoid.tla](./companion-tests/formal/BandGapVoid.tla)
- [C6] [formal/ProtocolDeficit.tla](./companion-tests/formal/ProtocolDeficit.tla)
- [C7] [formal/SettlementDeficit.tla](./companion-tests/formal/SettlementDeficit.tla)
- [C8] [formal/lean/Lean/ForkRaceFoldTheorems/Claims.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Claims.lean)
- [C9] [formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean](./companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Axioms.lean)
- [C10] [src/pipeline-topology.test.ts](./companion-tests/src/pipeline-topology.test.ts)
- [C11] [src/pipeline-formulas.test.ts](./companion-tests/src/pipeline-formulas.test.ts)
- [C12] [src/queueing-subsumption.test.ts](./companion-tests/src/queueing-subsumption.test.ts)
- [C13] [src/flow-protocol.test.ts](./companion-tests/src/flow-protocol.test.ts)
- [C14] [src/topological-compression.test.ts](./companion-tests/src/topological-compression.test.ts)
- [C15] [src/thermodynamics.test.ts](./companion-tests/src/thermodynamics.test.ts)
- [C16] [src/deficit-evidence.test.ts](./companion-tests/src/deficit-evidence.test.ts)
- [C17] [src/quantum-topology.test.ts](./companion-tests/src/quantum-topology.test.ts)
- [C18] [src/shootoff.test.ts](./companion-tests/src/shootoff.test.ts)
- [C19] [src/formal-parser-compat.test.ts](./companion-tests/src/formal-parser-compat.test.ts)
- [C20] [companion-tests/README.md](./companion-tests/README.md)

## Bottom Line

If the paper is constrained to proved contributions only, the center of gravity is strong:

1. `Δβ`/Bule as an operational optimization diagnostic,
2. formal C1-C4 + queueing/quantum theorem family,
3. executable protocol/runtime instantiations (Wallington, Flow, compression),
4. verified formulas for sharding, speculation, and turbulence regimes.
