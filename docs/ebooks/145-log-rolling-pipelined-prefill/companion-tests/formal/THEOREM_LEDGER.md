# Formal Theorem Ledger

- Parent README: [README.md](./README.md)
- Lean package: [lean/README.md](./lean/README.md)

This ledger turns top-level manuscript claims into named theorems with explicit assumptions and mechanization targets.

| ID | Claim (paper-level) | Explicit assumptions | Mechanization | Status |
|---|---|---|---|---|
| `THM-C1C4` | Fork/race/fold safety+liveness (C1–C4) | finite items/stages/branches; deterministic fold; bounded timeout; weak fairness on `Tick`/`Fold`; implication hypotheses from C1-C4 to safety/liveness | TLA+ `ForkRaceFoldC1C4.tla` + Lean schema `Axioms.c1_c4_imply_safety_and_liveness` | Mechanized |
| `THM-S7-WHIP` | Worthington Whip savings shape | shard count `s > 0` | TLA+ transition model + Lean theorem `Claims.worthington_num_lt_den` | Mechanized |
| `THM-S7-SPEC` | Speculative Tree positivity constraints | `q > p`; finite `k > 0` | TLA+ transition model + Lean theorems `Claims.speculative_tree_numerator_positive` and `Claims.speculative_tree_denominator_positive` | Mechanized |
| `THM-S7-TURB` | Turbulent idle fraction stays bounded | `n > 0`, `c > 0`, finite domains | TLA+ transition model + Lean theorems `Claims.turbulent_idle_bounds` and `Claims.turbulent_idle_den_positive` | Mechanized |
| `THM-S7-WHIP-CROSSOVER` | Cross-shard correction crossover is finite and over-sharding becomes non-improving | finite `P,N,C,S`; `P>0`, `N>0`, `C>0`, bounded shard window | TLA+ `WhipCrossover.tla` invariants + Lean theorems `Claims.whip_total_time_strictly_increases_after_full_sharding` and `Claims.whip_strict_crossover_exists` | Mechanized |
| `THM-Q-DEFICIT` | Quantum speedup identity in topology-matched regime | `sqrtN > 0`; `N = sqrtN^2`; classical `β₁=0`; matched quantum implementation `β₁=β₁*` | TLA+ transition model + Lean theorems `Claims.quantum_deficit_is_zero` and `Claims.quantum_speedup_equals_classical_deficit_plus_one` | Mechanized |
| `THM-PROTO-DEFICIT` | TCP/QUIC/Aeon deficit ordering | stream count `> 1`; topology equations for intrinsic/implementation Betti numbers | TLA+ transition model + Lean theorem `Claims.protocol_deficits` | Mechanized |
| `THM-SETTLEMENT` | Settlement deficit (`seq=2`, `parallel=0`) | intrinsic `β₁* = 2`; mode in `{seq,parallel}` | TLA+ transition model + Lean theorem `Claims.settlement_deficit_values` | Mechanized |
| `THM-BANDGAP-BETA2` | Band gap implies `β₂ > 0` | finite energy lattice; allowed set family with non-empty forbidden interior | TLA+ transition model + Lean theorem `Claims.band_gap_implies_beta2_positive` | Mechanized |
| `THM-SCHED-BOUND` | Conditional scheduler-overhead bound: additive + bounded + handler-independent under explicit assumptions | finite topology step bound; bounded metadata; constant scheduler primitive costs; finite handler-cost domain | TLA+ `SchedulerBound.tla` invariants (`InvAdditiveRuntimeDecomposition`, `InvSchedulerOverheadBounded`, `InvSchedulerOverheadIndependentOfHandler`) | Mechanized |
| `THM-PARSER-CLOSURE` | Formal artifacts are self-consistent under project parser | parser totality on grammar; pairwise `.tla/.cfg` completeness; round-trip stability | `aeon-logic` parser preflight + Lean schema `Axioms.parser_closure_theorem` | Mechanized |
| `THM-COMPLETENESS-DAG` | Fork/race/fold expresses any DAG | finite DAG; decomposition exists; decomposition is sound and complete; encoding function exists | Lean local decomposition theorem `Claims.local_node_decomposition` + schema `Axioms.dag_completeness_schema` + executable finite-DAG decomposition tests | Mechanized (assumption-parameterized + executable) |
| `THM-QUEUE-CONTAINMENT` | Queueing subspace containment | queue law at `β₁=0`; topology-control witness for `β₁>0` | Lean schemas `Axioms.queueing_containment_at_beta1_zero` and `Axioms.queueing_strict_extension_at_positive_beta` + executable tests | Mechanized (assumption-parameterized + executable) |
| `THM-CONVERGENCE-SCHEMA` | Constraint-driven convergence to fork/race/fold in modeled finite class | conservation, irreversibility, nonzero overhead, finite-state model, throughput-selection pressure, attractor and model-class uniqueness assumptions | Lean schema `Axioms.convergence_schema` + executable convergence simulation tests | Mechanized (assumption-parameterized + executable) |
| `THM-FIRST-LAW-GENERAL` | `V_fork = W_fold + Q_vent` for modeled systems | `W_fold <= V_fork` | Lean theorem `Claims.first_law_conservation` + executable thermodynamics tests | Mechanized |
| `THM-BEAUTY-DEF` | Bu beauty definition from deficit (`deficitBu = β₁* - β₁`, `beautyBu = β₁* - deficitBu`) | non-negative Bu domains; bounded implementation deficit | TLA+ `BeautyOptimality.tla` invariants + Lean schema `Axioms.beauty_definition_schema` | Mechanized (assumption-parameterized scaffold) |
| `THM-BEAUTY-LATENCY-MONO` | Lower Bu deficit implies non-worse latency | fixed workload + stage-cost model; deficit order witness | TLA+ `BeautyOptimality.tla` invariant `InvBeautyLatencyMonotone` + Lean schema `Axioms.beauty_latency_monotone_schema` | Mechanized (assumption-parameterized scaffold) |
| `THM-BEAUTY-WASTE-MONO` | Lower Bu deficit implies non-worse waste | fixed vent accounting model; deficit order witness | TLA+ `BeautyOptimality.tla` invariant `InvBeautyWasteMonotone` + Lean schema `Axioms.beauty_waste_monotone_schema` | Mechanized (assumption-parameterized scaffold) |
| `THM-BEAUTY-PARETO` | Zero-deficit implementation is Pareto-optimal in latency/waste envelope | candidate A has `deficitBu=0`; deficit ordering over compared implementations | TLA+ `BeautyOptimality.tla` invariant `InvBeautyPareto` + Lean schema `Axioms.beauty_pareto_optimality_schema` | Mechanized (assumption-parameterized scaffold) |
| `THM-BEAUTY-COMPOSITION` | Global Bu deficit composes additively from subsystem deficits | additive composition model over pipeline/protocol/compression deficits | TLA+ `BeautyOptimality.tla` invariant `InvBeautyComposition` + Lean schema `Axioms.beauty_composition_schema` | Mechanized (assumption-parameterized scaffold) |
| `THM-BEAUTY-OPTIMALITY` | Beauty-optimality theorem: definition + monotonicity + Pareto + composition cohere | assumptions of THM-BEAUTY-DEF/LATENCY-MONO/WASTE-MONO/PARETO/COMPOSITION | TLA+ `BeautyOptimality.tla` invariant `InvBeautyOptimality` + Lean schema `Axioms.beauty_optimality_schema` | Mechanized (assumption-parameterized scaffold) |

## Interpretation

- `Mechanized` means machine-checked by TLC and/or Lean build.
- `Mechanized (assumption-parameterized)` means the theorem is proved as an implication from explicitly declared assumptions; changing assumptions changes theorem applicability.
- Entries tied to `Axioms.lean` encode theorem schemas; entries tied to `Claims.lean` encode constructive proofs over explicit model definitions.
