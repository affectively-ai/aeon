# Volume 145: Log-Rolling Pipelined Prefill — Rotational Mechanics for Distributed Inference

> *"You don't need to move the entire mass at once. By pivoting on one corner, you are only overcoming the friction of a fraction of the weight at any given moment."* — Wally Wallington

- Parent index: [Ebook Library](../README.md)
- Live docs home: [docs.aeonflux.dev](https://docs.aeonflux.dev)
- ArXiv manuscript source: [Manuscript Draft (Chapter 17)](./ch17-arxiv-manuscript.md)
- Companion tests: [Companion Test Suite](./companion-tests/README.md)

## About This Book

This volume documents the design and implementation of **log-rolling pipelined prefill** in the Aether distributed inference engine. The optimization replaces a sequential token-by-token prefill loop with a pipelined approach that overlaps token processing across layer nodes, reducing prefill latency from P×N to P+(N-1) sequential steps — a near-Nx speedup that approaches the number of distributed nodes.

The work is framed through the lens of Wally Wallington's "Forgotten Technology" — the suite of mechanical protocols that allowed one man to move 20-ton stones by finding rotational pivot points where complex systems yield to minimal effort. Each optimization in this volume corresponds to a Wallington technique: the Dynamic Offset Pivot, the Sand-Box Descent, and the Rolling Pivot.

## Chapters

1. **[The Sequential Bottleneck: Why P×N Was Hiding in Plain Sight](ch01-sequential-bottleneck.md)** — How the original prefill loop serialized every token through every node, creating P×N network round-trips for P prompt tokens across N nodes. Why this looked "correct" but was artificially constrained. The key insight: each node only needs its own previous KV cache entry, not the global state.

2. **[The Log-Rolling Pipeline: Promise.race() as a Rotational Engine](ch02-log-rolling-pipeline.md)** — The `pipelinedPrefill()` implementation: per-node slots, `Promise.race()` for maximum node utilization, the dispatch-on-free pattern, and how the pipeline naturally guarantees per-node token ordering without locks.

3. **[Poison Control: The Sand-Box Descent for NaN Handling](ch03-poison-control.md)** — Graceful degradation when NaN is detected mid-pipeline. The poison position tracking, drain-without-dispatch strategy, and why clean in-flight tokens ahead of the poison complete normally.

4. **[Edge Cases: Tunneling, Single-Node Fallback, and Shard Collapse](ch04-edge-cases.md)** — How tunneled tokens skip remaining nodes, single-node pipelines degrade to sequential with zero overhead, SSM models work identically (prefixMatchLen=0), and the shard collapse path stays sequential by design.

5. **[The Test Suite: Verifying Pipeline Correctness](ch05-test-suite.md)** — Nine tests covering basic ordering, single-node fallback, NaN poisoning at various positions, tunneling, progress callback monotonicity, measured pipeline speedup, prefix matching, and zero-token edge cases.

6. **[The Remaining Pivots: A Survey of Rotational Opportunities](ch06-remaining-pivots.md)** — Other sequential bottlenecks discovered during this work: parallel weight loading (depformer + Mimi), multi-head attention parallelism, speculative prefill reuse. Plus the hard walls where no pivot exists (depformer codebooks, autoregressive generation).

7. **[Wallington's Laws and Software Engineering](ch07-wallingtons-laws.md)** — The three engineering principles — Force Multiplication, Friction Reduction, and Gravity Harvest — applied to distributed systems design. Finding the "master pivot" in any architecture.

8. **[Wiring the Heuristics: Loop Detection and Skip-Ahead Wormholes](ch08-wiring-the-heuristics.md)** — Activating LoopDetector and SkipAheadAggregator in the generation loop. Loop detection as the safety fulcrum, observation recording as gravity harvest, wormhole prediction as active node-skipping, and the self-correcting verification feedback loop.

9. **[Benchmarking the Rotations](ch09-benchmarking.md)** — Measurement strategy for each optimization: local integration benchmarks, live Cloud Run timing, A/B framework, and expected impact metrics across prefill pipeline, zero-copy, loop detection, and skip-ahead wormholes.

10. **[The Wallington Rotation: Chunked Pipelined Prefill](ch10-stacked-rotations.md)** — The recognition that causal masking and log-rolling are the same lower-triangular invariant at different scales. Tiling them: causal masking handles intra-chunk token ordering, log-rolling handles inter-chunk pipeline scheduling. Reduces prefill from P+(N-1) to ceil(P/B)+(N-1) steps — a compound rotation that multiplies the speedups. Born from applying the Transformer's own structural insight to its inference pipeline.

11. **[Turbulent Multiplexing: Filling the Idle Slots](ch11-turbulent-multiplexing.md)** — The Wallington Rotation compresses pipelines so aggressively that they never reach laminar flow — it's all turbulence (ramp-up/ramp-down). With 4 chunks across 4 nodes, 43 percent of node-slots are idle. Multiplexing fills those slots with chunks from other requests, turning wasted capacity into throughput. Three strategies: request interleaving, speculative decode pipelining, and predictive prefetch. Introduces the pipeline Reynolds number as a predictor of laminar vs turbulent regime.

12. **[The Worthington Whip: Superposition Prefill](ch12-superposition-prefill.md)** — The recognition that a single request can exist in multiple pipeline states simultaneously. Sharding one request's token sequence across S parallel pipelines (via the Multiplexed Scheduler), then collapsing with cross-shard attention correction. Reduces attention compute by (S-1)/(2S) and drives Re_pipeline toward 0 — improving the utilization problem the Wallington Rotation created. The collapse phase is the whip snap: all parallel shards converge to a single definite state.

13. **[The Speculative Tree: Branching Futures Across the Pipeline](ch13-speculative-tree.md)** — Speculative decoding as the same fork/collapse operation the Worthington Whip uses, applied to unknown tokens instead of known ones. A draft model generates K candidate continuations; all K branches enter the pipeline simultaneously as Turbulent Multiplexing sub-requests; the full model verifies all branches in one batched pass; invalid branches are pruned via `AbortSignal` (poison isolation reused as branch pruning). Expected speedup of (1-α^K)/(1-α) tokens per pipeline pass. The pipeline Reynolds number drops with each branch added — speculation fills the same idle slots Turbulent Multiplexing targets. The realization that the stack is a flow protocol: request-fork-race-collapse, not request-response.

14. **[The Aeon Flow Protocol: Fork, Race, Collapse All The Way Down](ch14-aeon-flow-protocol.md)** — The unified primitive extracted from every layer of the stack. A 10-byte binary wire format with fork/race/collapse as protocol-level operations. Stream multiplexing with backpressure and poison propagation. Zerocopy TypedArray payloads. `aeon://` becomes a real protocol URI scheme — not just a namespace, but a wire protocol with binary semantics. Integration with the Multiplexed Prefill Scheduler via `FlowProtocolBridge`. The stack is one protocol with five application layers.

15. **[The Shootoff: Aeon Flow vs HTTP/1.1 vs HTTP/2](ch15-the-shootoff.md)** — Head-to-head protocol comparison with real gzip/brotli compression, accurate header modeling, and two demo sites: Whip Worthington's Flaxseed Empire (big content, 12 resources) and The Wally Wallington Wonder Archive (microfrontend, 95 resources). HTTP/1.1 wastes 31 percent of bandwidth on headers for small resources. HTTP/2 cuts that to 5.8 percent. Aeon Flow: 1.47 percent. The Dynamic Offset Pivot applied to protocol framing.

16. **[The nginx Module: Aeon Flow Behind the Reverse Proxy](ch16-nginx-aeon-flow-module.md)** — `ngx_aeon_flow_module`: a C module that lets nginx speak Aeon Flow to backends while serving HTTP to browsers. Connection pooling, fork/race/collapse/poison semantics, ESI fragment assembly, and the Rolling Pivot architecture — browser stays put (HTTP), backend swings forward (Aeon Flow). Zerocopy codec, poison-on-disconnect cleanup, and HPACK-free framing.

17. **[ArXiv Manuscript Draft](ch17-arxiv-manuscript.md)** — Full paper draft framing the Wallington Rotation as the core domain-agnostic algorithm, with the Worthington Whip as its high-gain extension, plus concrete implementations in Aether distributed inference and Aeon Flow transport.

18. **[The UDP Transport: TCP Had Its 40-Year Run](ch18-udp-transport.md)** — Every flow frame carries its own identity (`stream_id` + `sequence`), making TCP's ordered delivery redundant. `UDPFlowTransport` with MTU-aware fragmentation (4-byte header, 255 fragments × 1468 bytes), ACK bitmaps (14 bytes covers 64 sequences), AIMD congestion control, and `FrameReassembler` for per-stream out-of-order reconstruction. `WebTransportFlowTransport` bridges browsers via HTTP/3 unreliable datagrams. Fallback chain: UDP → WebTransport → WebSocket → TCP.

19. **[Inverting the Conveyor Belt](ch19-inverting-the-conveyor-belt.md)** — The 1900s gave us the assembly line: make everything sequential. Fork/race/fold inverts it: make everything parallel, fold to the answer. Applied to financial markets (T+2 → T+0 settlement, multi-venue fork/race execution, market data as self-describing frames), healthcare (parallel diagnostic pathways, 4.8 years → weeks), drug discovery ($2.6B pipeline → parallel candidates), construction (critical path → parallel floor streams), trading (FIFO order book → batch fold), manufacturing (andon cord → per-stream vent), education (grade-level conveyor → parallel subject streams), and emergency response (sequential dispatch → simultaneous fork, 12 min → 90 sec).

20. **[Algorithmic Naturalism](ch20-algorithmic-naturalism.md)** — Fork/race/fold was discovered 4 billion years ago. Grade A quantitative isomorphisms: DNA replication (Okazaki fragments = self-describing frames with out-of-order reassembly), polysome translation (Wallington Rotation, pipeline Re predicts ribosome stalling at Re < 0.6), saltatory conduction (chunked pipeline, 100x speedup matches Wallington formula exactly), photosynthetic light-harvesting (fork/race at quantum scale, >95 percent efficiency). Grade B structural homologies: immune system V(D)J (10^11 parallel fork/race), neural spike trains (self-describing frames), natural selection, epidemiology (herd immunity = ACK bitmap coverage), ant colonies (weighted ACKs with decay). Nature converges on these algorithms because they solve throughput under constraint, search under uncertainty, and coordination without centralization — the same three problems distributed computing faces.

21. **[Topology of Computation](ch21-topology-of-computation.md)** — Fork/race/fold as a topological transformation. Betti numbers classify computation graphs (β₀ = connected components = independent computations, β₁ = cycles = feedback loops, β₂ = voids = unreachable states). Covering spaces formalize pipeline stages. Homotopy equivalence proves fork/race/fold preserves computational topology while reducing geometric complexity. Persistent homology tracks how topological features (parallelism, synchronization barriers, dead branches) appear and disappear across pipeline depth. The Wallington Rotation is a deformation retract — same topology, less geometry.

22. **[Energy Mechanics of Fork/Race/Fold](ch22-energy-mechanics.md)** — The complete thermodynamic reframing. Fork = potential energy injection. Race = kinetic energy conversion. Fold = useful work extraction. Vent = waste heat dissipation. Backpressure = conservation constraint. The First Law (V_fork = W_fold + Q_vent), the Second Law (fold is irreversible), the Third Law (minimum frame overhead is ground-state energy). The two-level stream race as a two-stage heat engine. Shannon entropy as the Carnot limit. Why brotli can't be beaten (it's already near Carnot efficiency for text) and why the topology's value is reliability, not superiority. The pipeline Triangle as an energy envelope. Complete energy dictionary mapping every primitive to its thermodynamic analogue.

23. **[Emergent Connections — Nine Resonances of Fork/Race/Fold](ch23-emergent-connections.md)** — Nine structural isomorphisms that emerge from the energy rename. Hylomorphism (fork/fold = unfold/fold, the canonical recursion scheme). The Carnot cycle (four strokes = four primitives, same optimality proofs). Race is timeless (pure exploration between two irreversible commitments). Protein folding (the native state IS the fold, chaperones ARE vents). The manifold hypothesis (fold is projection, β₁ → 0 is dimensionality reduction). Attention IS race (QK^T is race, softmax is vent, V projection is fold). Loss = Q (training minimizes waste heat, gradient descent = ∂Q/∂θ). Breathing is venting (mitochondria are fork/race/fold engines, lungs are vents). The void (no unfold primitive — fold is irreversible — this IS the Second Law).

## Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| `pipelinedPrefill()` | `open-source/aether/src/gcp-coordinator.ts` | Log-rolling pipeline engine |
| `serialInference()` | `open-source/aether/src/gcp-coordinator.ts` | Wires pipeline into inference path |
| `executeLayerStage()` | `open-source/aether/src/gcp-coordinator.ts` | Per-node forward with retry/circuit breaker (unchanged) |
| Pipeline tests | `apps/edge-workers/src/lib/multi-arch/__tests__/pipelined-prefill.test.ts` | 9-test verification suite |
| `AeonFlowProtocol` | `open-source/aeon/src/flow/AeonFlowProtocol.ts` | Fork/race/fold stream multiplexing |
| `FlowCodec` | `open-source/aeon/src/flow/FlowCodec.ts` | 10-byte binary frame codec |
| Flow tests | `open-source/aeon/src/__tests__/flow/flow.test.ts` | 39 protocol + 31 reassembler + UDP transport tests |
| Shootoff benchmarks | `open-source/aeon/packages/shootoff/` | Protocol comparison: Aeon Flow vs HTTP/1.1 vs HTTP/2 |
| `ngx_aeon_flow_module` | `open-source/aeon/packages/nginx-aeon-flow/` | nginx module: HTTP↔Aeon Flow translation |
| `ngx_aeon_flow_codec.c` | `open-source/aeon/packages/nginx-aeon-flow/src/` | C implementation of 10-byte frame codec |
| `UDPFlowTransport` | `open-source/aeon/src/flow/UDPFlowTransport.ts` | UDP transport with AIMD congestion control |
| `FrameReassembler` | `open-source/aeon/src/flow/frame-reassembler.ts` | Per-stream out-of-order frame reconstruction |
| UDP transport tests | `open-source/aeon/src/__tests__/flow/udp-flow-transport.test.ts` | UDP fragmentation, ACK bitmaps, congestion |
| Reassembler tests | `open-source/aeon/src/__tests__/flow/frame-reassembler.test.ts` | 31-test out-of-order reassembly suite |
| Rhizome router | `apps/edge-workers/src/workers/aeon-rhizome.ts` | `aeon://` publication and edge resolution APIs |
| `TopologyAnalyzer` | `open-source/aeon/src/topology/TopologyAnalyzer.ts` | Betti numbers, fork/join detection, topological deficit (Bules) |
| `TopologySampler` | `open-source/aeon/src/topology/TopologySampler.ts` | Runtime sampling of deficit over time |
| Topology tests | `open-source/aeon/src/__tests__/topology/topology.test.ts` | 24-test Betti number + deficit + sampler suite |
| TLA+ formal suite | `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/` | Mechanized checks for C1–C4, §7 formulas, §6.11–§6.12 deficits; parser-validated with `aeon-logic` before TLC |

## Performance Impact

| Scenario | Sequential (P×N) | Per-Token Pipeline (P+N-1) | Chunked Pipeline (ceil(P/B)+N-1) | Speedup vs Sequential |
|----------|------------------|----------------------------|-----------------------------------|-----------------------|
| 14 tokens × 2 nodes | 28 steps | 15 steps | 9 steps | 3.1x |
| 100 tokens × 4 nodes | 400 steps | 103 steps | 7 steps | 57x |
| 500 tokens × 8 nodes | 4000 steps | 507 steps | 15 steps | 267x |
| 100 tokens × 10 nodes (70B) | 1000 steps | 109 steps | 19 steps | 53x |

Per-token pipeline speedup approaches N. Chunked pipeline compounds causal masking (B tokens per step) with log-rolling (N-node parallelism).

## The Wallington Mapping

| Wallington Technique | Inference Analogue | Section |
|---------------------|--------------------|---------|
| Dynamic Offset Pivot | Per-node ordering instead of global ordering | Ch. 1-2 |
| Sand-Box Descent | NaN poison drain (grain by grain) | Ch. 3 |
| Rolling Pivot (#5) | `Promise.race()` — only one node bears weight at a time | Ch. 2 |
| Round Road (#3) | Multi-head attention parallelism | Ch. 6 |
| Multi-Stage Cribbing | Weight loading `Promise.all()` | Ch. 6 |
| The Wallington Rotation | Chunked pipeline — causal masking × log-rolling | Ch. 10 |
| The Worthington Whip | Fork/fold — shard known tokens across parallel pipelines | Ch. 12 |
| The Speculative Tree | Branch/prune — race unknown tokens through the same pipeline | Ch. 13 |
| The Aeon Flow Protocol | Fork/race/fold — the unified primitive across all layers | Ch. 14 |
| The Shootoff | Protocol benchmarking — quantifying the pivot advantage | Ch. 15 |
| The nginx Module | Rolling Pivot — browser stays HTTP, backend swings Aeon Flow | Ch. 16 |
| The UDP Transport | Gravity Harvest — let the stone fall into the hole (drop TCP overhead) | Ch. 18 |
| Inverting the Conveyor Belt | Every sequential bottleneck is a candidate for fork/race/fold | Ch. 19 |
| Algorithmic Naturalism | Nature converged on these algorithms 4 billion years ago | Ch. 20 |
| Topology of Computation | Betti numbers, covering spaces, homotopy — fork/race/fold preserves topology | Ch. 21 |
| Energy Mechanics | Fork = potential, race = kinetic, fold = work, vent = heat | Ch. 22 |
| Emergent Connections | Nine resonances: hylomorphism, Carnot, timeless race, protein folding, manifold, attention, loss=Q, breathing, the void | Ch. 23 |

## Prerequisites

- Understanding of KV cache mechanics in transformer inference
- Familiarity with distributed inference (coordinator + layer nodes)
- Basic knowledge of JavaScript `Promise.race()` and async patterns

## Manuscript Build

Regenerate the arXiv manuscript TeX and export PDF:

```bash
./build-arxiv-manuscript.sh
```

Useful variants:

```bash
./build-arxiv-manuscript.sh --tex-only
./build-arxiv-manuscript.sh --pdf-only
```

PDF export requires one TeX engine: `tectonic`, `latexmk`, or `pdflatex`.
