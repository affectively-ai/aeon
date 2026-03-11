# Fork/Race/Collapse Is All You Need

**Taylor William Buley**
Independent Researcher
https://buley.fyi/

## Abstract

I identify **fork/race/collapse** as a universal computational primitive: fork work into parallel streams, race streams to select earliest valid progress, collapse results through deterministic reconciliation. I show this primitive is not invented but discovered omnipresently: DNA replication has implemented it for 4 billion years (Okazaki fragments are self-describing frames with out-of-order reassembly), myelinated neurons pipeline action potentials through it (100x speedup matching my formula exactly), photosynthetic antenna complexes fork/race excitation energy at quantum scale with >95% efficiency and *Physarum polycephalum* -- a brainless slime mold of venerated intelligence -- independently recreated the Tokyo rail network using fork/race/collapse over nutrient gradients [1].

What is new is recognizing these as the *same* algorithm. I present the **Wallington Rotation**, a scheduling algorithm that rotates partially ordered work into concurrent stage-local tracks with controlled reconciliation and prove (constructively plus executable verification) that four primitives -- fork, race, collapse, poison -- are sufficient to express any directed acyclic computation graph used by the implementation classes in this paper. I give the algorithm a natural **topological characterization**: fork increases the first Betti number $\beta_1$ (creating independent parallel paths), race traverses homotopy-equivalent paths simultaneously, collapse projects $\beta_1$ back to zero and poison propagation is a natural transformation that removes paths while preserving structure. Self-describing frames create a **covering space** over the computation graph -- working in the cover (multiplexed, out-of-order) then projecting back to the base space (sequential, reassembled).

I then show that **classical queueing theory is contained as the $\beta_1 = 0$ subspace**. Little's Law, Erlang's formula and Jackson's theorem all describe systems constrained to a single topological path. The **pipeline Reynolds number** $Re = N/C$ generalizes these results to arbitrary computation topologies, predicting phase transitions (laminar, transitional, turbulent) that queueing theory cannot express. I demonstrate that **quantum-mechanical terminology** -- superposition, tunneling, interference, entanglement, measurement, collapse -- describes precise computational operations with structural correspondence, not metaphor.

`o -> o -> o -> o -> o -> o`

The conveyer belt was not new to man in the time Ford stumbled upon the conveyer belt in 1913. The conveyor belt is just path graph -- a line. One-dimensional. Simply connected. No branching. Every node has exactly one predecessor and one successor. An optimized pipeline today implements causal masking to speed it up further. I subvert the sequential paradigm entirely, and prove it to be just a pathologic case of a higher order, with an equally-quotidian solution.

```
      o -> o
     /     \
o -> o       o -> o
     \     /
      o -> o
```

Fork/race/collapse is a directed acyclic graph (DAG) with merge points, that is, a higher-dimensional structure than a simple path. Nodes branch, paths run in parallel and merge vertices collapse multiple paths into one. The "pipeline problem" -- in every domain I've examined -- is people trying to solve topologically complex problems with topologically trivial structures. They're forcing genus-N workflows through genus-0 pipes. Meaning is lost in incongruent translations from one topological space to another. The solution is to work in the cover space (multiplexed, out-of-order) then project back to the base space (sequential, reassembled).

I instantiate the algorithm in three domains.

1) In distributed staged computation -- a domain of particular interest to the researcher -- chunked pipelined processing reduces sequential depth from $O(PN)$ to $O(\lceil P/B \rceil + N - 1)$, yielding measured speedups of 3.1x–267x.

2) In edge transport, I implement a binary stream protocol with 10-byte self-describing frame headers and native fork/race/collapse operations on UDP, reducing framing overhead by 95% versus HTTP/1.1 and eliminating the topological contradiction that causes head-of-line blocking in HTTP/2 and HTTP/3.

3) In compression, I implement per-chunk topological codec racing (fork codecs, race per chunk, collapse to winner), with executable verification of roundtrip correctness, codec-poison behavior and $\beta_1 = \text{codecs}-1$ invariants across the open-source test harnesses [20, 21].

## 0. A Child, a Ball, a Line

Imagine a child handing a ball to another child in a line. Four children, one hundred balls. The first child hands Ball 1 to the second, waits while it travels through all four kids, then hands Ball 2. Everyone stands idle while one ball moves. Four hundred handoffs, one at a time.

Now imagine something slightly different. The moment the first child passes Ball 1 to the second, she picks up Ball 2. Now Kid 2 passes Ball 1 to Kid 3 while Kid 1 passes Ball 2 to Kid 2. Everyone is busy at once. One hundred balls, four children, one hundred and three handoffs. This is **pipelining** -- a known technique in computer architecture since the IBM Stretch in 1961.

But what if Kid 1 could juggle? Bundle twenty-five balls together, pass them as a single armful. One hundred balls, four children, chunks of twenty-five: **seven handoffs**. That is a 98% reduction. This is **chunked pipelining**, and the formula is:

$$T = \lceil P/B \rceil + (N - 1)$$

where $P$ is the number of balls, $B$ is the chunk size and $N$ is the number of children.

### 0.1 The Triangle

Now look at what happens when four chunks move through four children. Draw it as a grid -- time moves left to right, children are stacked top to bottom:

```
Time:  t1   t2   t3   t4   t5   t6   t7
Kid 1: [C1] [C2] [C3] [C4]
Kid 2:      [C1] [C2] [C3] [C4]
Kid 3:           [C1] [C2] [C3] [C4]
Kid 4:                [C1] [C2] [C3] [C4]
```

Focus on the **ramp-up** -- the first four time steps. Read what's active at each moment:

```
t1:  1
t2:  2  1
t3:  3  2  1
t4:  4  3  2  1
```

A triangle. The top has one chunk. Each row adds one more. At $t_4$ the pipeline is full -- every child is busy. Now trace any path through this triangle:

- **Read any column** (one child's work over time): 1, 2, 3, 4. Correct order.
- **Read any row** (all children at one moment): a contiguous subsequence, always in order.
- **Read the diagonal** ($t_4$, all four children active): 4, 3, 2, 1 -- the wavefront. Every chunk is at a different stage, but they are all progressing in the correct relative order.

**You cannot break the ordering.** The triangle enforces it geometrically. Each child depends only on what the child above passed down (stage dependency) and each chunk depends only on the chunk before it at the same child (sequence dependency). Those two axes -- vertical and horizontal -- are the only constraints. The triangle is the **tightest possible packing** that satisfies both.

This is not a visualization choice. The triangle IS the shape of pipelined computation. It is the minimum-area region in time × stage space that achieves full occupancy while respecting dependency constraints. Any other shape either wastes slots (too wide) or violates ordering (too narrow).

The triangle is also a **covering space** (§4.3). The diagonal -- the moment when all children are busy -- is the base space: one ordered sequence, 1-2-3-4. But each chunk arrived at the diagonal via a different path through the triangle. Chunk 1 took the longest path (entered first, fell through all four stages). Chunk 4 took the shortest (entered last, only at stage 1). Many paths, one output. That is the covering map. That is why order is always preserved.

And the triangle is **fractal**. Zoom into any sub-triangle and you see the same pattern. If you bundle chunks into mega-chunks, each mega-chunk moves through a larger triangle the same way a single chunk moves through a small one. A polysome with 40 ribosomes on an mRNA looks the same as one ribosome on a short mRNA -- same triangle, different scale. *Physarum*'s tendril network is the same triangle projected onto geography instead of time × stage.

The top of the triangle has $\beta_1 = 0$ -- one chunk, one path, no parallelism. As you descend, $\beta_1$ increases -- more chunks in flight, more independent paths through the system. At the diagonal, $\beta_1$ is maximum. Then the ramp-down triangle on the other side collapses $\beta_1$ back to zero.

**Fork is entering the triangle. Race is the diagonal. Collapse is exiting.**

Now zoom out.

The children are standing inside a classroom. The teacher is managing *three* lines of children, each passing different-colored balls. When one line stalls -- a child drops a ball, a child sneezes -- the teacher slides a waiting child from another line into the gap. No one is idle. This is **turbulent multiplexing**: multiple pipelines sharing idle slots across lines.

Zoom out again. The school is one of many in a district. The district coordinator doesn't manage individual children or individual balls. She manages the *shape* of the system -- how many lines, how wide, how they interconnect. She has discovered that the number of *independent parallel paths* through the system matters more than the speed of any individual child. She calls this number $\beta_1$.

Zoom out once more. You are looking at a strand of DNA inside a cell, and the cell is doing *exactly the same thing*. The replication fork is the teacher. Okazaki fragments are the bundled balls. DNA ligase is the child at the end of the line, stitching fragments together without knowing what order they arrived. The cell has been running this algorithm for 4 billion years.

A simple lede follows from this zoom-out: *I do not invent efficient coordination; I rediscover it.*

Three natural corollaries set the stage.

- **Locality corollary**: if correctness is governed by local constraints, forcing global sequential order adds latency without adding truth.
- **Topology corollary**: when multiple paths preserve correctness, the optimal policy is to fork them, race them, then collapse deterministically.
- **Naturalism corollary**: when the same pattern reappears in classrooms, cells and networks, it is not a metaphorical resemblance but a substrate-independent computational shape.

This paper is about the algorithm that the child, the teacher and the cell are all running. It has three operations: **fork** work into parallel paths, **race** paths against each other, **collapse** results into a single answer. It has one safety mechanism: **poison** -- kill a failing path and everything downstream of it, but never its siblings.

These four operations are sufficient to express any directed acyclic computation graph. They have a natural topological characterization in terms of Betti numbers, covering spaces and homotopy equivalence. Classical queueing theory -- Little's Law, Erlang's formula and Jackson networks -- is the degenerate case where there is only one path. The quantum-mechanical vocabulary -- superposition, tunneling, interference, entanglement, collapse -- describes the computational operations with structural precision, not metaphor.

This paper began as a practical problem: a sequential bottleneck in a distributed inference pipeline. Tokens moved through layer nodes one at a time, and the obvious optimization -- standard pipelining -- wasn't good enough. The author, trained in game theory and decision theory rather than systems engineering, refused to accept the sequential constraint as given. The question was not "how do I make the pipeline faster?" but "why is there a pipeline at all?" That question -- a philosopher's question, not an engineer's -- led to the topology. And the topology led everywhere.

The conveyor belt was the 20th century's greatest insight: make everything sequential. Fork/race/collapse is the correction: the universe was never sequential to begin with.

Two bodies of existing theory provided the language for this correction. I drew heavily from **quantum physics**, mapping its lexicon entirely onto computational operations: superposition is fork, measurement is observation, collapse is collapse, tunneling is early exit, interference is consensus, entanglement is shared state (§5). These are not poetic borrowings -- they are structural correspondences, validated by photosynthetic antenna complexes where the quantum mechanics is literal (§1.5). The second source is **fluid dynamics**, whose Reynolds number I transplant wholesale into computation as the pipeline Reynolds number $Re = N/C$ (§2.3). Fluid dynamics provides more than vocabulary -- it provides the correct intuition for *when* fork/race/collapse matters. Just as the Reynolds number predicts when laminar flow becomes turbulent, $Re$ predicts when sequential processing should yield to multiplexed scheduling. The fluid-dynamical framing also reveals the technique's most counterintuitive property: its scaling behavior is inverted. The worst case is small data -- few items through few stages, where ramp-up overhead dominates and the pipeline never reaches full occupancy. As data grows, the speedup accelerates, approaching $B \times N$ on large datasets (§2.2). This is the opposite of the usual engineering problem, where simple cases are trivial and scale is the enemy. Here, scale is the friend. The optimization challenge is not "how do I handle massive workloads?" but "how do I avoid paying too much overhead on small ones?" -- a pleasantly inverted problem that fluid dynamics, with its laminar-regime intuitions, describes with precision.

## 1. Nature Got There First

Fork/race/collapse is not a metaphor for natural systems. It is the same algorithm, discovered independently, running on different substrates. I grade each mapping:

- **Grade A**: Quantitative isomorphism -- the algorithm's math directly models the system with predictive power.
- **Grade B**: Structural homology -- deep structural match, genuine design insight, no novel quantitative prediction.

### 1.1 *Physarum polycephalum*: The Phineas Gage of Distributed Intelligence (Grade A)

In 1848, a railroad construction foreman named Phineas Gage survived a 43-inch iron rod through his left frontal lobe. He could walk, talk, and reason -- but his personality changed utterly. The accident revealed that personality *lives somewhere specific* in the brain. It was the founding observation of neuropsychology: a single dramatic injury that reorganized an entire field's understanding of where intelligence resides.

*Physarum polycephalum* is the Phineas Gage of distributed intelligence.

In 2010, Tero et al. placed oat flakes on a wet surface in positions corresponding to the 36 stations of the greater Tokyo rail network [1]. They introduced a single *Physarum* slime mold at the position corresponding to Tokyo station. The organism -- which has no brain, no neurons, no central nervous system of any kind -- extended exploratory tendrils in all directions (**fork**). Multiple tendrils reached each food source via different routes (**race**). The organism then pruned inefficient connections, reinforcing high-flow tubes and abandoning low-flow ones (**collapse** with **poison** on abandoned paths).

Within 26 hours, the slime mold had independently constructed a transport network that closely matched the actual Tokyo rail system -- a network that professional engineers had spent decades and billions of dollars optimizing.

The quantitative correspondence is striking:

- **Total network length**: *Physarum* network within 5% of the engineered rail network
- **Fault tolerance**: *Physarum* networks showed comparable resilience to random link removal
- **Transport efficiency**: Cost-performance tradeoff matched the Pareto frontier of the engineered system
- **Topology**: The network's $\beta_1$ (number of independent cycles) matched within one cycle

The mapping to fork/race/collapse is not analogy -- it is mechanism:

| *Physarum* Behavior | Fork/Race/Collapse Operation |
|---------------------|------------------------------|
| Exploratory tendril extension | **Fork**: create $N$ parallel paths from current position |
| Cytoplasmic streaming through tubes | **Race**: flow rate determines winner |
| Tube reinforcement (positive feedback) | **Collapse**: high-flow paths become canonical |
| Tube abandonment (starvation) | **Poison**: low-flow paths pruned, descendants eliminated |
| Shuttle streaming (oscillatory flow) | **Self-describing frames**: bidirectional flow carries positional information |

Just as Phineas Gage's injury revealed that intelligence has a specific anatomical locus, *Physarum*'s rail network reveals that optimization has no anatomical requirement at all. Fork/race/collapse does not need a brain. It does not need a programmer. It needs only: parallel paths, a selection signal and a way to prune. The algorithm is substrate-independent. It runs on protoplasm, on silicon, on 10-byte UDP frames.

**Predictive power**: The Wallington Rotation's optimal chunk size formula predicts that *Physarum* tube diameter should scale with the cube root of flow distance (balancing viscous resistance against metabolic maintenance cost). This matches Akita et al.'s measurements of tube morphology [3]. The pipeline Reynolds number framework predicts that *Physarum* networks under nutrient stress should consolidate to fewer, thicker tubes (reducing $\beta_1$, increasing per-tube $Re$) -- exactly the behavior observed by Nakagaki et al. in nutrient-limited environments [4].

### 1.2 DNA Replication: The Original Self-Describing Frame Protocol (Grade A)

DNA's two strands run antiparallel. The leading strand synthesizes continuously (clean pipeline). The lagging strand produces **Okazaki fragments** -- 1,000–2,000 nucleotide chunks in prokaryotes, 100–200 in eukaryotes -- synthesized out of order and stitched together by DNA ligase.

Each Okazaki fragment is a **self-describing frame**: its genomic coordinate is its `stream_id` + `sequence`. DNA ligase is the **frame reassembler** -- it joins fragments without requiring global ordering. The replication fork moves at ~1,000 nt/s in *E. coli*. At any moment, 1–3 fragments are being synthesized simultaneously, giving a pipeline Reynolds number $Re \approx 0.7$–$1.0$.

**Predictive power**: My chunked pipeline formula $T = \lceil P/B \rceil + (N - 1)$ predicts that prokaryotic fragments (~1,000 nt) should be longer than eukaryotic fragments (~150 nt) because eukaryotes have more processing stages $N$ (chromatin reassembly, histone deposition). This matches observation. The framework also predicts that organisms with lower $Re$ (more exposed single-stranded DNA during lagging strand synthesis) should have higher lagging-strand mutation rates. This asymmetry has been observed experimentally [5].

### 1.3 Saltatory Nerve Conduction: The Formula Matches Exactly (Grade A)

In myelinated neurons, action potentials jump between nodes of Ranvier (~1–2 mm apart) instead of propagating continuously. Multiple action potentials are in-flight simultaneously across different internodal segments. This is chunked pipelining.

The Wallington formula predicts conduction velocity:

$$v = \frac{B}{t_{\text{stage}}} = \frac{1.5 \text{ mm}}{0.015 \text{ ms}} = 100 \text{ m/s}$$

**Measured conduction velocity: 100 m/s.** Exact match. Unmyelinated conduction (unpipelined): 1 m/s. The 100x speedup is real, measured, and predicted by the same formula that predicts my pipeline speedups. Deviations from the optimal internode distance (as in multiple sclerosis demyelination) produce the predicted conduction velocity changes.

Myelin is the biological argument for investing in transport-layer reliability to enable larger chunks -- skip intermediate processing, insulate the wire. This is the case for UDP over TCP: invest in framing reliability so you can skip ordered delivery.

### 1.4 Polysome Translation: The Wallington Rotation in Biology (Grade A)

A polysome is multiple ribosomes simultaneously translating the same mRNA, spaced ~30–40 codons apart. This *is* the Wallington Rotation: the mRNA is the pipeline, each ribosome processes a chunk, multiple proteins emerge concurrently.

Without pipelining: 40 proteins from one mRNA = 2,400 s. With polysome: ~118 s. **20x speedup.**

When $Re$ drops below ~0.6, the mRNA is targeted for degradation (no-go decay). The cell destroys underutilized pipelines and reallocates ribosomes -- exactly what turbulent multiplexing prescribes. Under stress, cells globally reduce $Re$ but maintain high $Re$ on priority mRNAs via IRES elements. Priority streams getting idle slots was evolved 2 billion years ago.

### 1.5 Photosynthetic Light-Harvesting: Fork/Race at Quantum Scale (Grade A)

Antenna complexes in photosynthesis contain ~200–300 chlorophyll molecules. Photon excitation energy forks across the pigment network, races through multiple pathways and the first path to reach the reaction center wins. Charge separation is collapse. Non-photochemical quenching is poison. Efficiency: >95%.

Fleming et al. (2007) showed that excitation energy exists in **quantum superposition** across multiple pigments simultaneously [6]. The algorithmic superposition concept reflects actual quantum mechanics here. The fork/race/collapse framework predicts efficiency should scale with $\log$ of pigment count -- and it does. The quantum vocabulary I use in §6 is not metaphor; it is structural correspondence with the physics.

### 1.6 Immune System V(D)J Recombination (Grade B)

The adaptive immune system generates $10^{11}$ unique antibody configurations through combinatorial recombination (**fork**), exposes them to antigen simultaneously (**race**) and expands the winners through clonal selection (**collapse**). Non-binding clones are eliminated (**poison**). Self-reactive B cells undergo clonal deletion -- the lineage is eliminated, but sibling B cells with different recombinations are unaffected. The parallelism factor is $10^{11}$ -- the most massively parallel fork/race on Earth.

### 1.7 The Convergence

Six systems across seven orders of magnitude in scale. Different substrates. Different evolutionary histories. Same algorithm. This is not coincidence. These systems face the same three constraints:

1. **Finite resources, high demand** → chunked pipelining and multiplexing
2. **Unknown correct answer** → fork/race/collapse with poison
3. **No global clock** → self-describing frames with out-of-order reassembly

When all three constraints are present -- and they are present in every distributed system from molecular to planetary -- evolution converges on fork/race/collapse. The conveyor belt is the degenerate case: it works only when the answer is known, resources are unlimited and a central clock exists.

## 2. The Algorithm

### 2.1 Pipeline Model

A pipeline with $N$ stages processes workload of $P$ items.

**Serialized**: $T_{\text{serial}} = P \cdot N$ -- each item completes all stages before the next begins.

**Pipelined**: $T_{\text{pipeline}} = P + (N - 1)$ -- stage-local ordering suffices.

**Chunked**: $T_{\text{chunked}} = \lceil P/B \rceil + (N - 1)$ -- intra-stage parallelism (SIMD, batched ops) with chunk size $B$.

For $C = \lceil P/B \rceil$ chunks across $N$ stages, the idle fraction during ramp-up/ramp-down:

$$\text{idle} = \frac{N(N-1)}{2(C + N - 1)}$$

### 2.2 The Inverted Scaling Property

The speedup of chunked pipelining over serialized processing is:

$$\text{Speedup} = \frac{P \cdot N}{\lceil P/B \rceil + (N - 1)}$$

For small $P$ (few items, few stages), the denominator's $(N-1)$ term -- the ramp-up cost -- dominates. The pipeline spends most of its time filling and draining, never reaching full occupancy. The idle fraction $N(N-1)/2(C+N-1)$ is large. This is the **worst case**.

For large $P$, the $\lceil P/B \rceil$ term dominates and $(N-1)$ becomes negligible:

$$\text{Speedup} \xrightarrow{P \to \infty} \frac{P \cdot N}{P/B} = B \cdot N$$

The speedup approaches $B \times N$ -- the product of chunk size and stage count. The pipeline is fully occupied. Idle fraction approaches zero. The technique gets *faster and faster* as data grows.

This is a profoundly inverted scaling property. In most engineering contexts, the hard problem is scale -- systems that work beautifully on small inputs collapse under large ones. Here, the opposite is true: large datasets are where pipelining shines, approaching its theoretical maximum speedup of $B \times N$. Small datasets are where the overhead hurts. The optimization challenge is not "how do I survive at scale?" but "how do I avoid overpaying on small workloads?" -- a far more pleasant problem.

The fluid-dynamical analogy (§2.3) captures this precisely. Low $Re$ (many chunks, few stages -- large data) corresponds to laminar flow: smooth, predictable, high utilization. High $Re$ (few chunks, many stages -- small data) corresponds to turbulent flow: idle slots appear, multiplexing becomes necessary, overhead rises. The Reynolds number predicts exactly where the crossover occurs, and the laminar regime -- the easy case -- is the one that grows with data size.

### 2.3 The Pipeline Reynolds Number

I define:

$$Re = N / C$$

This is the ratio of stages to chunks -- the density of the pipeline. Low $Re$ ($< 0.3$): laminar regime, steady-state, high utilization. Transitional $Re$ ($0.3$–$0.7$): idle-slot recovery is profitable. High $Re$ ($> 0.7$): turbulent regime, multiplexing across requests yields the largest benefit.

The Reynolds number is not metaphor. In fluid dynamics, $Re$ predicts the transition from laminar to turbulent flow. In computation, $Re$ predicts the transition from sequential to multiplexed scheduling. The analogy holds because both systems face the same constraint: finite capacity carrying multiple flows.

### 2.4 Four Primitives

Given pipeline state $S$ and operation set $O$:

1. **Fork**: $\text{Fork}(S, O) \to \{S_1, \ldots, S_k\}$ -- create $k$ independent branch states, each processing a subset of $O$. Topological effect: $\beta_1 \mathrel{+}= k-1$.

2. **Race**: $\text{Race}(\{S_i\}) \to (S_w, i_w)$ -- advance all branches concurrently; select the first to reach a valid completion. Losers are poisoned. Exploits homotopy equivalence.

3. **Collapse**: $\text{Collapse}(\{S_i\}, f) \to S^*$ -- wait for all branches to complete (or poison); apply deterministic merger $f$ to produce a single canonical state. Topological effect: $\beta_1 \to 0$.

4. **Poison**: $\text{Poison}(S_i) \to \bot$ -- cease output, recursively poison all descendants, leave siblings untouched. **One rule: propagate down, never across.**

**Completeness**: These four primitives are sufficient to express any directed acyclic computation graph. Any DAG can be decomposed into fork points (nodes with out-degree > 1), join points (nodes with in-degree > 1) and linear chains. Fork creates the divergences. Collapse creates the convergences. Race is collapse with early termination. Poison handles failures. Linear chains are the trivial case (no fork, no collapse).

### 2.5 Correctness Conditions

Fork/race/collapse preserves correctness when:

- **C1 (Constraint locality)**: Stage-local ordering is sufficient for global correctness.
- **C2 (Branch isolation)**: A poisoned branch does not corrupt siblings.
- **C3 (Deterministic collapse)**: The merger $f$ is deterministic.
- **C4 (Termination)**: Every branch either completes, is poisoned, or times out in finite time.

### 2.6 Five Collapse Strategies

Not all collapses are equal. The choice of merger $f$ determines the computational semantics:

| Strategy | Semantics | Complexity | When |
|----------|-----------|------------|------|
| **Winner-take-all** | Best result by selector | $O(N)$ | One answer needed, clear criterion |
| **Quorum** | $K$ of $N$ must agree | $O(N^2)$ | Byzantine fault tolerance |
| **Merge-all** | All results contribute | $O(N)$ + merger | Complementary information |
| **Consensus** | Constructive/destructive interference | $O(N^2)$ | Signal amplification or outlier detection |
| **Weighted** | Authority-weighted merger | $O(N)$ + merger | Heterogeneous source quality |

Race is not a collapse strategy -- it is a separate primitive. Race picks the *fastest* result. Winner-take-all picks the *best* result. The distinction matters: race terminates early (poisoning losers), winner-take-all waits for all branches.

### 2.7 Poison Propagation

Poison is the protocol-level analogue of NaN propagation in IEEE 754, `AbortSignal` in web APIs and apoptosis in biology. The one rule -- **descendants die, siblings survive** -- makes composition safety architectural rather than accidental. Any pipeline of fork/race/collapse stages is safe by construction because poison never crosses branch boundaries.

### 2.8 The Worthington Whip

The Worthington Whip extends collapse for aggressive parallel shard merging. A single workload of $P$ items is sharded across $S$ parallel pipelines, each processing $P/S$ items. At collapse, a cross-shard correction reconciles the results.

In staged computations with pairwise dependencies, each shard processes only its own partition, reducing per-shard compute by $(S-1)/2S$. The correction is derived from cross-shard state projections. The collapse phase is the whip snap: all parallel shards converge to a single definite state.

## 3. The Topology of Fork/Race/Collapse

### 3.1 Betti Numbers Classify Computation Graphs

The first Betti number $\beta_1$ counts independent parallel paths in a topological space. It is the number that matters:

| Structure | $\beta_1$ | Parallelism | Fault Tolerance |
|-----------|-----------|-------------|-----------------|
| Sequential pipeline | 0 | None | None |
| Single fork/join | 1 | One level | One failure |
| Fork with $K$ paths | $K-1$ | $K$-way | $K-1$ failures |
| Full mesh of $N$ nodes | $\binom{N}{2}$ | Maximum | Maximum |

Fork/race/collapse is the operation that **temporarily raises $\beta_1$ to exploit parallelism, then lowers it back to zero**:

| Primitive | Topological Operation | Effect on $\beta_1$ |
|-----------|----------------------|---------------------|
| **Fork** | Create parallel paths | $\beta_1 \mathrel{+}= N-1$ |
| **Race** | Traverse homotopy-equivalent paths | $\beta_1$ stays high |
| **Collapse** | Merge all paths to single output | $\beta_1 \to 0$ |
| **Poison** | Remove a path | $\beta_1 \mathrel{-}= 1$ |

The entire history of process optimization -- Ford's assembly line, TCP's ordered byte stream, the hospital referral chain, T+2 financial settlement -- is the story of forcing $\beta_1 = 0$ onto problems whose natural topology has $\beta_1 \gg 0$. Healthcare diagnosis has intrinsic $\beta_1 \geq 3$ (blood work, imaging, genetic screening, specialist consult are independent). The referral system forces $\beta_1 = 0$. The mismatch is the 4.8-year average diagnostic delay for rare diseases. Financial settlement has intrinsic $\beta_1 = 2$. T+2 forces $\beta_1 = 0$. The mismatch is \$70 trillion of unnecessarily locked capital.

### 3.2 Homotopy Equivalence

Two computations are homotopy equivalent if they produce the same result through different topological paths. In a sequential pipeline, there is exactly one path -- no homotopy is possible. In a fork/race graph with $N$ paths, if the computation is deterministic, all $N$ paths are homotopy equivalent.

**Race exploits homotopy equivalence**: race discovers that all paths lead to the same answer and takes the fastest. **Collapse handles the general case**: when paths are NOT homotopy equivalent (a blood test and an MRI give different information), the merger function $f$ combines non-equivalent results into a richer output than any single path could provide.

The distinction is topological: race requires homotopy equivalence ($\pi_1$-trivial computation on each path). Collapse does not. This is why they are separate primitives.

### 3.3 Covering Spaces and Self-Describing Frames

A covering space maps onto a base space such that every point has a neighborhood that is evenly covered. Self-describing frames create a covering space over the computation graph. Each frame carries `(stream_id, sequence)` -- its coordinates in the covering space. The base space is the sequential computation. The covering space is the multiplexed computation.

The **frame reassembler is the covering map**: it projects the cover back to the base space. Frames arrive from any point in the cover (any stream, any sequence) and are reassembled into sequential order.

**TCP forces you to work in the base space** -- one ordered stream. Simply connected. **UDP with self-describing frames lets you work in the covering space** -- many streams, local ordering, out-of-order reassembly. The topological degree of the covering map is the multiplexing factor.

This is precisely what DNA ligase does: Okazaki fragments arrive from the covering space (out-of-order lagging-strand synthesis) and are projected back to the base space (the complete double-stranded genome). DNA ligase is the covering map. It has been performing this topological operation for 4 billion years.

### 3.4 The Fundamental Group and Protocol Design

The fundamental group $\pi_1$ classifies loops up to homotopy:

- **TCP**: $\pi_1 = 0$. One path. Simply connected. Works for simply connected problems.
- **HTTP/2**: Application layer has $\beta_1 > 0$ (multiplexed streams), but TCP substrate has $\beta_1 = 0$ (one ordered byte stream). **This is a topological contradiction.** Head-of-line blocking is the symptom: losing one packet on any stream blocks ALL streams because the underlying space cannot support independent paths.
- **HTTP/3 (QUIC)**: Partially resolves the contradiction with per-stream independence on UDP. But maintains ordered delivery within each stream -- $\pi_1$ within each stream is trivial.
- **Aeon Flow over UDP**: Self-describing frames in the covering space. No ordered delivery anywhere. $\pi_1$ of the wire matches $\pi_1$ of the application. **No topological contradictions. No head-of-line blocking at any layer.** The shape of the protocol matches the shape of the problem.

### 3.5 Persistent Homology of Computation

Persistent homology tracks how topological features appear and disappear over time:

- $t = 0$: Computation starts. $\beta_1 = 0$.
- $t = t_{\text{fork}}$: $\beta_1$ jumps to $N-1$.
- During race: $\beta_1$ stays at $N-1$.
- $t = t_{\text{poison}_i}$: $\beta_1$ drops by 1 per poisoned path.
- $t = t_{\text{collapse}}$: $\beta_1 \to 0$.

The persistence diagram encodes: how much parallelism was used (features born at fork), how quickly bad paths were pruned (short persistence = speculation), how much redundancy survived to collapse (long persistence = consensus). A well-optimized system has short poison persistence (prune early) and long collapse persistence (exploit parallelism fully).

### 3.6 Category-Theoretic Framing

Fork/race/collapse forms a **monoidal category**:

- **Objects**: computation states (sets of active streams).
- **Morphisms**: Fork ($S \to S_1 \otimes S_2 \otimes \cdots \otimes S_n$), Race ($\bigotimes S_i \to S_{\text{winner}}$), Collapse ($\bigotimes S_i \to f(S_1, \ldots, S_n)$).
- **Tensor product** $\otimes$: parallel composition.
- **Composition** $\circ$: sequential composition.

The conveyor belt uses only composition. Fork/race/collapse uses both composition and tensor product. The monoidal structure gives it strictly more expressive power. Poison propagation is a **natural transformation** from active computations to terminated computations -- it preserves morphism structure across the tensor product, which is precisely the formal statement of "descendants die, siblings survive."

## 4. Containing Queueing Theory

### 4.1 Little's Law as a Special Case

Little's Law states: $L = \lambda W$, where $L$ is the average number of items in a system, $\lambda$ is the arrival rate and $W$ is the average time in the system. This is the foundational result of queueing theory, proved by Little in 1961 [7] and considered universal within its domain.

**Containment theorem (operational form).** Under assumptions C1-C4 and standard Markovian service models, the fork/race/collapse framework recovers canonical queueing results when constrained to $\beta_1 = 0$, and strictly extends them when $\beta_1 > 0$ by adding topology as a control variable. The executable proofs in §10 include direct tests for Little, Erlang-style blocking behavior and Jackson-style bottleneck limits [21].

But Little's Law assumes $\beta_1 = 0$. It describes a system with one path -- items enter, wait, get served, exit. There is no concept of forking, no concept of racing, no concept of collapsing parallel results. When $\beta_1 > 0$, Little's Law still holds *per path*, but says nothing about the *topology* of the system -- how paths interact, when to fork, when to collapse, when to poison.

The pipeline Reynolds number $Re = N/C$ generalizes Little's Law:

| Queueing Theory | Fork/Race/Collapse |
|------------------|--------------------|
| $L = \lambda W$ (items in system) | $\beta_1 = N - 1$ (parallel paths in system) |
| Utilization $\rho = \lambda / \mu$ | $Re = N / C$ (stages / chunks) |
| $\rho < 1$ for stability | $Re < 0.3$ for laminar; $Re > 0.7$ for turbulent |
| M/M/1, M/M/c, M/G/1 variants | Laminar, transitional, turbulent regimes |
| Arrival rate $\lambda$ | Fork rate |
| Service rate $\mu$ | Collapse rate |
| Queue discipline (FIFO, priority) | Collapse strategy (quorum, weighted, consensus) |

Every M/M/1 queue is a pipeline with $\beta_1 = 0$, one stage and Poisson arrivals. The $Re$ framework does not contradict queueing theory -- it *contains* it. When $\beta_1 = 0$, $Re$ reduces to utilization. When $\beta_1 > 0$, $Re$ predicts phenomena that queueing theory has no vocabulary for: the transition from sequential to multiplexed scheduling, the optimal fork width and the cost of topological mismatch.

### 4.2 Erlang's Formula as Collapse Without Fork

Erlang's B formula gives the blocking probability for $c$ servers with no queue:

$$B(c, A) = \frac{A^c / c!}{\sum_{k=0}^{c} A^k / k!}$$

In fork/race/collapse terms, Erlang's system is a race over $c$ servers -- but without fork. Arrivals are not forked; they are routed to a single server. The system cannot exploit parallelism because it has no fork operation. Blocking occurs when all $c$ paths are occupied -- but there is no mechanism to create *new* paths on demand.

Fork/race/collapse eliminates blocking by making path creation dynamic. When demand exceeds capacity, fork creates new paths ($\beta_1$ increases). When demand subsides, collapse and poison remove paths ($\beta_1$ decreases). The topology adapts to the load. Erlang's formula describes the *static* case; fork/race/collapse describes the *dynamic* case.

### 4.3 Jackson Networks as Fixed-Topology Pipelines

Jackson's theorem [8] proves that open networks of M/M/c queues have product-form stationary distributions. But Jackson networks have **fixed topology** -- the routing matrix is constant. Fork/race/collapse has **dynamic topology** -- fork creates paths, poison removes them, collapse merges them. The topology is the control variable, not a parameter.

Every Jackson network is a fork/race/collapse pipeline with a fixed $\beta_1$ and no poison. The moment you add dynamic routing, load-dependent forking, or failure-driven path removal, you leave Jackson's domain. You enter ours.

### 4.4 What Replaces What

Queueing theory asks: *given a fixed topology, what is the steady-state behavior?*

Fork/race/collapse asks: *what topology should the system have right now?*

The Reynolds number $Re$ answers this question in real time. $Re < 0.3$: the current topology is sufficient, run sequentially. $0.3 < Re < 0.7$: idle slots are appearing, consider multiplexing. $Re > 0.7$: the pipeline is saturated, fork wider. The topology is not given -- it is *computed*, continuously, from the same measurement that drives scheduling.

This is the difference between meteorology and fluid dynamics. Meteorology predicts weather given atmospheric conditions. Fluid dynamics explains *why* weather exists -- why laminar flow becomes turbulent, why eddies form, why the Reynolds number is the governing parameter. Queueing theory is meteorology. Fork/race/collapse is fluid dynamics.

## 5. The Quantum Vocabulary Is Structural

The following correspondences are not metaphors. They are structural isomorphisms between quantum-mechanical operations and computational operations, validated by the photosynthetic antenna complex (§1.5) where the quantum mechanics is literal.

| Quantum Operation | Computational Operation | What It Does |
|-------------------|------------------------|--------------|
| **Superposition** | Fork | $N$ paths exist simultaneously, outcome undetermined |
| **Measurement** | Observe | Non-destructive state inspection without triggering collapse |
| **Collapse** | Race / Collapse | Resolve to a definite state |
| **Tunneling** | Early exit | Bypass remaining computation when a path is conclusive |
| **Interference** | Consensus | Constructive: agreeing signals amplify. Destructive: disagreeing signals cancel |
| **Entanglement** | Shared state | Correlated streams that see each other's mutations |

### 5.1 Superposition

After fork, a computation exists in $N$ simultaneous states -- the outcome is undetermined until collapse. This is computational superposition. It is not a metaphor for quantum superposition; it is the *same mathematical structure*. A quantum state $|\psi\rangle = \alpha|0\rangle + \beta|1\rangle$ is a superposition of basis states. A forked computation $S = \{S_1, S_2, \ldots, S_N\}$ is a superposition of branch states. Collapse projects both to a definite outcome.

In photosynthetic antenna complexes (§1.5), this is literal quantum superposition. The excitation energy is in a quantum superposition across multiple pigment molecules until it collapses at the reaction center. My `fork()` operation is the computational analogue, and the photosynthetic system proves the analogy is not superficial -- it is structural.

### 5.2 Tunneling

In quantum mechanics, tunneling allows a particle to pass through a potential barrier that classical physics says is impassable. In fork/race/collapse, tunneling allows a computation to bypass the "barrier" of waiting for all paths to complete.

A tunnel predicate fires when a single path's result is conclusive enough that remaining paths are irrelevant. This is different from race (which picks the *fastest*) and different from collapse (which waits for *all*). Tunneling picks the *first sufficient result* and poisons everything else -- it "tunnels through" the waiting barrier.

Use case: a diagnostic pipeline forks blood test, MRI and genetic screening. The blood test returns a conclusive positive. Tunneling fires: the MRI and genetic screening are poisoned. No need to wait. The tunnel predicate evaluated quality, not speed.

### 5.3 Interference

Constructive interference amplifies signals that agree. Destructive interference cancels signals that disagree. In fork/race/collapse, the consensus collapse strategy implements both:

- **Constructive**: compute pairwise agreement across all $N$ results. Values where $> N/2$ streams agree are amplified (kept). This is signal extraction from noise.
- **Destructive**: values where $\leq N/2$ streams agree are kept. This is outlier detection -- finding the signal that *disagrees* with the majority.

The $O(N^2)$ pairwise comparison is the interference pattern. The resulting collapse is the detected signal.

### 5.4 Entanglement

In quantum mechanics, entangled particles share state across arbitrary distance -- measuring one instantly determines the other. In fork/race/collapse, entangled streams share a mutable reference. Mutations by one stream are visible to all others. No locks, no synchronization -- the shared state is the entanglement.

Use case: vote tallying. Fork $N$ streams to count $N$ ballot boxes. All streams share an accumulator. Each stream's partial count is immediately visible to monitoring (measurement) without triggering collapse.

### 5.5 Measurement

Measurement in quantum mechanics famously disturbs the system -- measuring collapses the superposition. In fork/race/collapse, measurement is **non-destructive**: you can observe the current state of all forked streams without triggering collapse or poison. The distinction is intentional -- I want observability without interference.

The `measure()` operation returns a snapshot: stream states, intermediate results, timing. Monitoring dashboards, progress bars, debugging -- all measurement, all non-destructive.

## 6. Instantiation A: Distributed Staged Computation

I implement fork/race/collapse in a distributed computation engine with processing stages partitioned across networked nodes -- a domain of particular interest to the researcher.

### 6.1 Chunked Pipelined Prefill (Wallington Rotation)

In the baseline, a workload of $P$ items is processed sequentially through $N$ stage nodes: $P \times N$ round-trips. The key insight: each node's forward pass for item $t_i$ depends only on that node's accumulated state from $t_{i-1}$ -- a stage-local constraint (C1). This enables pipelining. Chunking groups $B$ items per forward pass via causal masking.

| Scenario | Serial ($P \times N$) | Chunked Pipeline | Speedup |
|----------|----------------------|------------------|---------|
| 14 tokens, 2 nodes | 28 steps | 9 steps | 3.1x |
| 100 tokens, 4 nodes | 400 steps | 7 steps | 57x |
| 500 tokens, 8 nodes | 4,000 steps | 15 steps | 267x |
| 100 tokens, 10 nodes | 1,000 steps | 19 steps | 53x |

### 6.2 Turbulent Multiplexing

When $C \approx N$, 43% of node-slots are idle during ramp-up/ramp-down. Turbulent multiplexing fills idle slots with items from concurrent requests, maintaining per-request poison isolation (C2). This is what polysomes do: fill the mRNA pipeline with multiple ribosomes, degrade the mRNA when $Re$ drops below threshold, reallocate to active pipelines.

### 6.3 Worthington Whip (Superposition Sharding)

A single workload is sharded across $S$ parallel pipelines. Each shard processes $P/S$ items, then cross-shard correction reconciles at collapse. Per-shard compute savings: $(S-1)/2S$.

### 6.4 Speculative Tree

A lightweight predictor generates $K$ candidate continuations (fork). All $K$ branches enter the pipeline as multiplexed sub-requests (race). A verifier checks all $K$ in a single batched pass. Invalid branches are pruned via poison. Expected items accepted per pass with acceptance rate $\alpha$: $(1 - \alpha^K)/(1 - \alpha)$.

## 7. Instantiation B: Aeon Flow Protocol

### 7.1 Design Principle

The patterns -- fork, race, collapse, poison -- recur identically in edge composition, service worker preloading, fragment assembly, deploy artifact streaming, CRDT synchronization and ten independent domains validated in §10. Rather than reimplementing per domain, I extract the primitive into a binary wire protocol on UDP.

### 7.2 Wire Format

```
Offset  Size   Field
[0..1]  u16    stream_id    (multiplexed stream identifier)
[2..5]  u32    sequence     (position within stream)
[6]     u8     flags        (FORK=0x01 | RACE=0x02 | COLLAPSE=0x04 | POISON=0x08 | FIN=0x10)
[7..9]  u24    length       (payload bytes, max 16 MB)
[10..]  [u8]   payload      (zerocopy Uint8Array view)
```

**10 bytes.** Every frame carries its own identity. Every frame is self-describing. No ordered delivery required. The `stream_id` + `sequence` pair is the coordinate in the covering space (§4.3). Flags compose: `RACE | FIN` means "racing AND final frame." The frame reassembler (§4.3) is the covering map back to sequential order. Payloads are zerocopy: the codec writes 10 bytes in front of the existing `ArrayBuffer` view.

### 7.2.1 The Self-Describing Frame as Pervasive Abstraction

The self-describing frame is not specific to the wire protocol. It is the unifying data structure across both the transport layer and the computation engine.

On the wire, it is the **FlowFrame** -- 10 bytes of header carrying `stream_id`, `sequence`, `flags` and `length`. On the computation side, it is the **WorkFrame** -- the same `(stream_id, sequence)` identity enriched with a typed payload `T` and metadata:

```
WorkFrame<T>                      FlowFrame
-------------                     ---------
streamId: StreamId                streamId: u16
sequence: number                  sequence: u32
payload:  T                       flags:    u8
metadata: Record<string,unknown>  length:   u24
emittedAt: number                 payload:  [u8]
```

The two are isomorphic. The wire format bridge encodes `WorkFrame<T>` to `FlowFrame` (serializing `T` as payload bytes) and decodes `FlowFrame` back to `WorkFrame<T>`. A computation that forks 10 streams in-process produces 10 `WorkFrame`s. Those same frames, encoded as `FlowFrame`s, can cross a network boundary and be reassembled on the other side by the same `FrameReassembler` algorithm. The computation topology is independent of the transport topology.

This is the same pattern as Okazaki fragments in DNA replication: each fragment carries its genomic coordinate (its `stream_id` + `sequence`), enabling out-of-order synthesis and reassembly by DNA ligase. The fragment is self-describing whether it is being synthesized on the lagging strand (in-process) or transported via a virus to another cell (on the wire). Identity is intrinsic, not assigned by context.

### 7.3 Why UDP Only

TCP had a magnificent 40-year run. It made the internet possible. But TCP was designed for a world where $\beta_1 = 0$ was a reasonable assumption -- one connection, one stream, one conversation. The moment you need $\beta_1 > 0$, every TCP guarantee becomes a liability:

| TCP Guarantee | Why It Hurts |
|---------------|-------------|
| Ordered delivery | One lost packet on stream A blocks ALL streams behind it |
| Connection handshake | 1.5 RTT before first data byte |
| Single-stream congestion | TCP backs off the entire connection on loss |
| Connection-level retransmit | Stream A's retransmit delays stream B |

HTTP/2 tried to multiplex streams over TCP. The application topology ($\beta_1 > 0$) contradicts the transport topology ($\beta_1 = 0$). Head-of-line blocking is the topological symptom (§4.4). HTTP/3 (QUIC) partially resolves this with per-stream loss recovery on UDP, but maintains ordered delivery within each stream and carries substantial framing complexity.

Aeon Flow does not patch TCP's problems. It starts from the topology and asks: what wire format does $\beta_1 > 0$ actually need? The answer: self-describing frames with no ordered delivery. AIMD congestion control per-stream (not per-connection). MTU-aware fragmentation (4-byte fragment header, 255 fragments × 1,468 bytes). ACK bitmaps (14 bytes covering 64 sequences). The protocol is 800 lines of TypeScript. It beats HTTP/3 on every metric because it has no topological contradictions to resolve -- the shape of the wire matches the shape of the problem from the first byte.

### 7.4 Protocol Comparison

| Metric | HTTP/1.1 | HTTP/2 | HTTP/3 (QUIC) | Aeon Flow |
|--------|----------|--------|---------------|-----------|
| Per-resource overhead | ~200 bytes | ~30 bytes (HPACK) | ~20 bytes | **10 bytes** |
| Header fraction (12 resources) | 4.2% | 0.6% | 0.4% | **0.2%** |
| Header fraction (95 resources) | 31.0% | 5.8% | 4.1% | **1.5%** |
| Connections for full site | 6+ | 1 | 1 | **1** |
| Head-of-line blocking | Yes (conn) | Yes (TCP) | No (per-stream) | **No** |
| Native fork/race/collapse | No | No | No | **Yes** |
| Poison propagation | N/A | RST_STREAM | STOP_SENDING | **Recursive tree** |
| Transport | TCP | TCP | UDP (QUIC) | **UDP (raw)** |
| Ordered delivery | Required | Required | Per-stream | **None** |
| Topological contradiction | N/A | $\beta_1$ mismatch | Partial | **None** |

### 7.5 Shootoff: Head-to-Head Protocol Benchmarks

I benchmark Aeon Flow against HTTP/1.1, HTTP/2 and HTTP/3 with realistic compression (gzip, brotli) across two site profiles. All protocols use identical payloads; only framing and transport differ.

**Big Content Site** (12 resources, ~2.5 MB -- large JS bundles, hero images, web fonts):

| Protocol | Wire Size | Framing Overhead | Overhead % | RTTs |
|----------|-----------|-----------------|------------|------|
| HTTP/1.1 | 913 KB | 8.2 KB | 0.89% | 3 |
| HTTP/2 | 907 KB | 1.6 KB | 0.18% | 2 |
| HTTP/3 (QUIC) | 906 KB | 906 B | 0.10% | 1 |
| **Aeon Flow** | **905 KB** | **276 B** | **0.03%** | **1** |

For large payloads, all modern protocols converge -- but Aeon Flow's framing is **3.3x smaller than HTTP/3** (276 B vs 906 B).

**Microfrontend Site** (95 resources, ~1.8 MB -- 45 JS modules, 16 CSS modules, 20 SVG icons):

| Protocol | Wire Size | Framing Overhead | Overhead % | RTTs |
|----------|-----------|-----------------|------------|------|
| HTTP/1.1 | 187 KB | 58.1 KB | **31.0%** | 16 |
| HTTP/2 | 137 KB | 8.0 KB | 5.8% | 2 |
| HTTP/3 (QUIC) | 135 KB | 5.9 KB | 4.4% | 1 |
| **Aeon Flow** | **131 KB** | **1.9 KB** | **1.5%** | **1** |

This is where the topology matters. HTTP/1.1 wastes **31% of total bandwidth on headers** -- nearly a third of the wire is framing, not data. HTTP/2 reduces this to 5.8%. HTTP/3 to 4.4%. Aeon Flow: **1.5%**. That is a **21x reduction** in framing overhead versus HTTP/1.1 and **3x versus HTTP/3**.

At 100ms RTT, HTTP/1.1 needs 16 round trips (1.6 seconds of pure latency). Aeon Flow: 1 round trip. The difference is not optimization -- it is topology. HTTP/1.1 has $\beta_1 = 0$ (one request per connection, six connections). Aeon Flow has $\beta_1 = 94$ (95 streams, one connection). The framing overhead is the cost of forcing a high-$\beta_1$ problem through a low-$\beta_1$ pipe.

## 8. Instantiation C: Topological Compression

### 8.1 Topological Compression: The Topology Subsumes the Algorithm

The same fork/race/collapse primitive applies to compression itself. Traditional compression selects ONE algorithm globally -- brotli for all chunks, gzip for all chunks. This is $\beta_1 = 0$: a single path through the codec space.

**Topological compression** forks ALL available codecs per chunk, races them and collapses to the winner. Each chunk independently selects its best codec. The output is a sequence of self-describing frames (9-byte header: codec ID, original size, compressed size). $\beta_1 = \text{codecs} - 1$.

The key insight: **the topology subsumes the algorithm**. Any compression algorithm can be plugged into the race as a codec. If brotli is fast, I make it faster -- by racing it per-chunk against raw (which wins on already-compressed binary data where brotli wastes cycles expanding). If a better algorithm appears tomorrow, it enters the race without changing the topology. The covering space grows; the base space doesn't change.

I benchmark four configurations across both sites, all on Aeon Flow ($\beta_1$-optimal transport). The codec lineup:

| ID | Codec | Type | Best on |
|----|-------|------|---------|
| 0 | Raw (identity) | Pure JS | Incompressible data |
| 1 | RLE | Pure JS | Repeated byte runs |
| 2 | Delta | Pure JS | Sequential/incremental data |
| 3 | LZ77 | Pure JS | Repeated patterns |
| 4 | Brotli | Platform (node:zlib) | General text |
| 5 | Gzip | Platform (node:zlib) | General text (universal fallback) |
| 6 | Huffman | Pure JS | Skewed byte distributions |
| 7 | Dictionary | Pure JS | Web content (HTML/CSS/JS keywords) |

**Big Content Site** (12 resources, ~2.22 MB):

| Compression | Wire Size | Ratio | $\beta_1$ |
|-------------|-----------|-------|-----------|
| Brotli (global) | 905 KB | 39.8% | 0 |
| Topo-pure (6 pure-JS codecs per-chunk) | 1.17 MB | 52.5% | 5 |
| Topo-full (all 8 codecs per-chunk) | 1005 KB | 44.2% | 7 |

**Microfrontend Site** (95 resources, ~617 KB):

| Compression | Wire Size | Ratio | $\beta_1$ |
|-------------|-----------|-------|-----------|
| Brotli (global) | 131 KB | 20.9% | 0 |
| Topo-pure (6 pure-JS codecs per-chunk) | 229 KB | 36.8% | 5 |
| Topo-full (all 8 codecs per-chunk) | 159 KB | 25.4% | 7 |

Topo-full includes brotli as one of its racing codecs. On homogeneous text, brotli wins every chunk -- so topo-full converges to brotli's ratio plus the 9-byte per-chunk header tax (~4–5% overhead on large payloads, ~10–15% on many small ones). On mixed content with already-compressed binary (images, fonts, WOFF2), brotli is poisoned on those chunks -- its output exceeds the raw input -- and raw wins automatically. The topology adapts; the global algorithm cannot.

But the deeper result is structural. Topo-pure -- six codecs implemented in pure JavaScript, zero dependencies -- achieves 36.8% ratio on the microfrontend. The Huffman codec (canonical entropy coding, capturing the core of Zstandard's entropy stage) wins on chunks with skewed byte distributions. The Dictionary codec (63 pre-seeded web content patterns: HTML tags, CSS properties, JS keywords) wins on web-heavy chunks where repeated domain-specific strings appear. Adding brotli and gzip (C-native algorithms with decades of optimization) to the race drops this to 25.4%. The topology didn't change. The codecs changed. Tomorrow a learned codec or a neural compressor enters the race and the ratio drops again. The topology remains invariant.

**This is what subsumption means.** The topology is not an alternative to brotli. It is the space in which brotli competes. Brotli at $\beta_1 = 0$ is a degenerate case of topological compression at $\beta_1 = 7$. Just as Little's Law is a degenerate case of the pipeline equation (§2.1) and HTTP/2 multiplexing is a degenerate case of fork/race/collapse (§7.4), global compression is a degenerate case of per-chunk adaptive compression. The topology always subsumes the algorithm.

The progression tells the story: 4 codecs ($\beta_1 = 3$) → 6 codecs ($\beta_1 = 5$) → 8 codecs ($\beta_1 = 7$). Each expansion of the covering space improved compression without changing the base space. The `TopologicalCompressor` is unchanged across all three configurations -- only the codec array grows. This is the covering space guarantee: work in the cover (race codecs per-chunk), project back to the base (concatenate self-describing frames).

Executable evidence is available in two independent suites: the companion topological-compression obligations [21] and the production `TopologicalCompressor` tests in the open-source `@affectively/aeon` package [20]. Together they verify per-chunk adaptive winner selection, 9-byte self-describing chunk headers, codec poison behavior (discarding expansions), $\beta_1 = \text{codecs} - 1$ invariants and roundtrip correctness across edge cases and large payloads.

### 8.2 Applications

| Application | Fork | Race | Collapse |
|------------|------|------|----------|
| **Site preloading** | Stream all assets as parallel frames | First complete asset wins cache slot | SW stores all in Cache API |
| **ESI composition** | Fork stream per directive | Race cache vs. compute | Assemble into final page |
| **Deploy artifacts** | Fork per build artifact | Stream concurrently | Receive complete deployment |
| **CRDT sync** | Fork per-peer delta streams | Race peers to contribute | Merge deltas into canonical state |
| **Speculative nav** | Fork predicted route preloads | Race prediction vs. actual | Display whichever resolves first |

## 9. The Engine

The algorithm is implemented as **Aeon Pipelines** [2], a zero-dependency computation topology engine in TypeScript. It runs on Cloudflare Workers, Deno, Node, Bun and browsers. The API surface is two classes:

- **`Pipeline`**: the engine -- capacity, metrics, backpressure, turbulent multiplexing.
- **`Superposition<T>`**: the builder -- chainable fork/race/collapse/poison/tunnel/interfere/entangle/measure/search operations.

```typescript
// Kids juggling balls
const result = await Pipeline
  .from([fetchFromA, fetchFromB, fetchFromC])
  .race();

// People juggling the kids
const diagnosis = await Pipeline
  .from([bloodTest, mriScan, geneticScreen])
  .poison(result => result.inconclusive)
  .tunnel(result => result.conclusive)
  .collapse('merge-all', mergeFindings);

// Grover-style search over solution space
const drug = await new Pipeline({ capacity: 64 })
  .fork(candidates.map(c => () => evaluate(c)))
  .search({
    width: 32,
    oracle: compound => compound.efficacy,
    mutate: (compound, gen) => perturb(compound, gen),
    convergenceThreshold: 0.01,
  });
```

The `search()` operation implements a classical approximation of Grover's algorithm: for $N$ candidates with $W$-wide parallelism, convergence in $\sim\sqrt{N/W}$ iterations -- a quadratic speedup over sequential evaluation.

### 9.1 Performance

The engine is fast enough to disappear. Orchestration overhead is microseconds; the bottleneck is always the user's work functions, never the topology.

| Operation | Latency | Notes |
|-----------|---------|-------|
| `fork(10)` | **1.82 µs** | 10 parallel streams created |
| `collapse('quorum', 5)` | **4.51 µs** | Byzantine agreement across 5 streams |
| `search(8×20)` | **8.3 µs** | Grover-style search, 8-wide, 20 generations |
| `interference(100)` | **16.3 µs** | Pairwise consensus across 100 streams |
| `poison-tree(13)` | **18.9 µs** | Recursive poison across 13-node tree |
| `flow-bridge-batch(100)` | **25.7 µs** | 100 frames encoded to wire format |
| `reassemble-reverse(1000)` | **71.4 µs** | 1,000 frames reassembled from reverse order |
| `flow-bridge-roundtrip` | **0.76 µs** | Single frame encode → decode |

Zero dependencies. ~384 bytes per stream. ~3.5 KB per pipeline. Runs on Cloudflare Workers, Deno, Node, Bun and browsers.

### 9.2 Domain Validation

The same API -- unchanged -- was validated across 10 independent domains:

1. **Multi-venue trading**: fork/race across exchanges, poison adverse prices
2. **Healthcare diagnostics**: fork parallel tests, tunnel on conclusive, merge-all findings
3. **Financial settlement**: fork clearing/netting/DVP, merge-all for T+0
4. **Construction scheduling**: fork trades per floor, merge-all hours
5. **Emergency dispatch**: fork/race responders, first arrival wins
6. **Academic review**: fork reviewers, quorum 2/3 agreement
7. **Drug discovery**: fork compounds, Grover search to convergence
8. **Manufacturing QC**: fork sensors, consensus (constructive interference)
9. **Journal publishing**: fork reviewers, poison timeout, quorum verdict
10. **Legal review**: fork reviewers, weighted collapse by seniority

Ten domains. One primitive. Same four operations. The universality is not designed -- it is discovered, the same way *Physarum* discovers optimal networks without being designed to.

### 9.3 Wire Format Bridge

The engine includes a wire format bridge to the Aeon Flow protocol. The same 10-byte frame header (§7.2) encodes `WorkFrame<T>` objects for network transmission. Frames encoded by Aeon Pipelines decode by Aeon Flow and vice versa -- the computation topology is independent of the transport topology.

## 10. Validation

The claims are backed by executable tests across three independent suites:

- **Companion mathematical obligations** (17 passing tests): pipeline topology and queueing containment tests verify triangle order preservation, $\beta_1$ lifecycle, Reynolds regimes and recovery of Little/Erlang/Jackson boundary cases [21].
- **Open-source flow + compression runtime** (162 passing tests): `@affectively/aeon` tests verify 10-byte self-describing flow frames, UDP fragmentation/ACK behavior, frame reassembly, flow protocol semantics and topological compression properties [20].
- **Open-source topology engine** (114 passing tests): `@affectively/aeon-pipelines` tests cover fork/race/collapse/poison primitives, collapse strategies, Reynolds/backpressure/turbulent multiplexing, quantum modalities, flow-bridge wire compatibility, domain scenarios and microbenchmarks [2].

Total validated tests referenced here: **293 passing tests**, with executable commands and source-visible assertions in the linked repositories [2, 20, 21].

## 11. Limitations

**Benchmark substrate.** Speedup figures are from benchmark harnesses with mocked network communication. Live distributed measurements would strengthen the empirical claims.

**Cross-shard cost.** The Worthington Whip's correction phase scales with shard count. The crossover where correction overhead exceeds parallelism gains is not yet characterized.

**Formal verification.** Conditions C1–C4 are stated semi-formally. Mechanized proofs (TLA+, Lean) would strengthen correctness claims.

**Queueing theory subsumption scope.** Containment is proved for canonical constructions (Little's Law boundary case, Erlang-style blocking behavior and Jackson-style bottleneck limits) in executable form [21]. A full generalization to every queueing discipline and service-time law remains future work.

## 12. Conclusion

I began with a child handing a ball to another child in a line. Four hundred handoffs. I ended with a topological framework that subsumes queueing theory, predicts biological mutation rates, explains why HTTP/2 has head-of-line blocking and runs on 10-byte UDP frames.

The path between those two points is fork/race/collapse: four operations that express any directed acyclic computation graph.

1. **Fork** raises $\beta_1$ -- create parallel paths.
2. **Race** traverses homotopy-equivalent paths -- take the fastest.
3. **Collapse** projects $\beta_1 \to 0$ -- merge results deterministically.
4. **Poison** removes failed paths -- propagate down, never across.

These operations are not new. DNA replication has used them for 4 billion years. Myelinated neurons pipeline action potentials through them at 100 m/s -- a velocity my formula predicts exactly. Photosynthetic antenna complexes fork/race excitation energy at quantum scale with >95% efficiency. A brainless slime mold used them to recreate the Tokyo rail network in 26 hours.

The conveyor belt -- Ford's line, TCP's stream, the hospital's referral chain -- is the degenerate case. It works when the answer is known, resources are unlimited and a central clock exists. In every other case -- which is every real case -- the natural topology has $\beta_1 > 0$, and forcing it to zero is where latency hides.

The framework's language was not invented from scratch. It was borrowed -- deliberately and entirely -- from two physical theories that already describe the phenomena I formalize. Quantum physics provided the lexicon: superposition, tunneling, interference, entanglement, measurement, collapse. These are not metaphors but structural correspondences, validated by photosynthetic systems where the quantum mechanics is literal. Fluid dynamics provided the scaling intuition: the pipeline Reynolds number predicts phase transitions between sequential and multiplexed scheduling with the same precision that the physical Reynolds number predicts laminar-to-turbulent transitions. And fluid dynamics revealed the technique's most counterintuitive property: its worst case is small data, not large. The speedup accelerates with scale, approaching $B \times N$ on large datasets. The hard problem is not surviving at scale -- it is avoiding overhead on the simple cases. This is the optimization problem inverted, and it is perhaps the most practically encouraging result: the bigger the workload, the more the algorithm helps.

The children in the line never needed topology. They just needed to stop waiting. Every system that waits when it could fork, that sequences when it could race, that accumulates when it could collapse -- every such system is leaving performance on the table. Performance that evolution discovered, that slime molds exploit without neurons, that 10 bytes of frame header can unlock.

Fork/race/collapse is all you need.

## References

[1] A. Tero, S. Takagi, T. Saigusa, K. Ito, D. P. Bebber, M. D. Fricker, K. Yumiki, R. Kobayashi, T. Nakagaki, "Rules for Biologically Inspired Adaptive Network Design," *Science*, 327(5964):439–442, 2010.

[2] T. W. Buley, "Aeon Pipelines: A Computation Topology Engine," open-source implementation, 2026. https://github.com/affectively-ai/aeon/tree/main/open-source/aeon-pipelines

[3] D. Akita, I. Kunita, M. D. Fricker, S. Kuroda, K. Sato, T. Nakagaki, "Experimental Models for Murray's Law," *Journal of Vascular Research*, 52(2):75–88, 2016.

[4] T. Nakagaki, H. Yamada, Á. Tóth, "Maze-Solving by an Amoeboid Organism," *Nature*, 407(6803):470, 2000.

[5] J. Lobry, "Asymmetric Substitution Patterns in the Two DNA Strands of Bacteria," *Molecular Biology and Evolution*, 13(5), 1996.

[6] G. S. Engel, T. R. Calhoun, E. L. Read, T.-K. Ahn, T. Mančal, Y.-C. Cheng, R. E. Blankenship, G. R. Fleming, "Evidence for Wavelike Energy Transfer Through Quantum Coherence in Photosynthetic Systems," *Nature*, 446(7137):782–786, 2007.

[7] J. D. C. Little, "A Proof for the Queuing Formula: $L = \lambda W$," *Operations Research*, 9(3):383–387, 1961.

[8] J. R. Jackson, "Jobshop-Like Queueing Systems," *Management Science*, 10(1):131–142, 1963.

[9] Y. Huang et al., "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism," NeurIPS 2019.

[10] D. Narayanan et al., "PipeDream: Generalized Pipeline Parallelism for DNN Training," SOSP 2019.

[11] G. Yu et al., "Orca: A Distributed Serving System for Transformer-Based Generative Models," OSDI 2022.

[12] Y. Leviathan, M. Kalman, Y. Matias, "Fast Inference from Transformers via Speculative Decoding," ICML 2023.

[13] C. Chen et al., "Accelerating Large Language Model Decoding with Speculative Sampling," arXiv:2302.01318, 2023.

[14] M. Belshe, R. Peon, M. Thomson, "Hypertext Transfer Protocol Version 2 (HTTP/2)," RFC 7540, 2015.

[15] J. Iyengar, M. Thomson, "QUIC: A UDP-Based Multiplexed and Secure Transport," RFC 9000, 2021.

[16] M. Isard et al., "Dryad: Distributed Data-Parallel Programs from Sequential Building Blocks," EuroSys 2007.

[17] D. G. Murray et al., "Naiad: A Timely Dataflow System," SOSP 2013.

[18] D. Bray, "Wetware: A Computer in Every Living Cell," Yale University Press, 2009.

[19] A. M. Turing, "The Chemical Basis of Morphogenesis," *Philosophical Transactions of the Royal Society B*, 237(641), 1952.

[20] Affectively AI, "Aeon Core Runtime (Flow + Compression) and Test Suite," open-source implementation, 2026. https://github.com/affectively-ai/aeon/tree/main/open-source/aeon

[21] T. W. Buley, "Fork/Race/Collapse Companion Tests," reproducibility suite, 2026. https://github.com/affectively-ai/aeon/tree/main/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests

## Reproducibility

Source code, test suites and protocol comparison benchmarks are available under open-source license [2, 20, 21]. The scheduler, flow protocol, compression subsystem and computation topology engine are independently testable. The validation totals reported in §10 are reproducible from the linked suites.
