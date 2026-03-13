# Workflow: Writing Toy Gnosis (.gg) Models from Conceptual Documents

**Goal:** Translate a theoretical concept or classification document (e.g., a Markdown taxonomy, whitepaper, or logic diagram) into executable, pure-data-flow Gnosis (`.gg`) topological models.

## Phase 1: Conceptual Analysis
1.  **Read the Source Material:** Deeply analyze the target document. Look for systems, phenomena, classifications, or mechanisms being described.
2.  **Identify the Core Flow:** Determine what "work" or "information" is flowing through the system. What are the inputs, the intermediate states, and the final outcomes?
3.  **Extract Mixed Memberships/Opposites:** If the document describes edge cases, mixed models (e.g., something that is both a "cache" and an "adaptive optimizer"), or logical opposites (inversions, adversarial drifts), plan to create individual models for each distinct case to prove out the taxonomy.

## Phase 2: Topological Mapping
Map the conceptual flow into Gnosis nodes and edges. Gnosis is a pure topological language, meaning the graph structure *is* the execution model. Imperative control flow is strictly forbidden.

1.  **Nodes (Entities & States):**
    *   Define actors, states, work items, and results.
    *   *Syntax:* `(name: Type { property: 'value' })`
    *   *Example:* `(profiler: Telemetry { metric: 'hot_paths' })`
2.  **Edges (Data Flow Primitives):**
    *   **Sequential / Transformation:** Use `-[:PROCESS]->` for a direct functional step.
    *   **Parallelization / Branching:** Use `-[:FORK]->` to split a single source into multiple concurrent paths `(A)-[:FORK]->(B | C)`.
    *   **Racing (First-to-finish):** Use `-[:RACE { expect: '...' }]->` when multiple paths compete to produce a single result `(A | B)-[:RACE]->(C)`.
    *   **Consensus / Recombination:** Use `-[:FOLD { strategy: '...' }]->` when multiple paths must merge, combine, or reach consensus `(A | B)-[:FOLD]->(C)`.
    *   **Side-Effects / State Change:** Use `-[:INTERFERE { mode: 'constructive' | 'destructive' }]->` for phenomena that alter state without blocking the main topological flow.

## Phase 3: Authoring the `.gg` File
1.  **File Naming:** Follow existing conventions in the target directory (e.g., `concept_name.gg`, `warmup_mixed_name.gg`).
2.  **Header Comments:** Always include a short, clear comment explaining the model's purpose, its primary/secondary mechanisms, and how it aligns with the source document.
3.  **Draft the Graph:** Write the nodes and edges as planned in Phase 2. Keep the topology visually clean and conceptually sound.

## Phase 4: Integration and Testing
Every toy model must be bound into a test harness to be verified by the formal model checker.

1.  **Find the Harness:** Locate the relevant test suite (e.g., `warmup_taxonomy.test.gg` or `warmup_inversion.test.gg`).
2.  **Add a Verify Node:** Insert a new `Verify` node pointing to your new file:
    *   `(new_model: Verify { module: './new_model.gg', beta1_max: '4' })`
3.  **Update the Suite Topology:**
    *   Add your node to the test suite's initial `FORK` command.
    *   Add a `RACE` command to evaluate your node: `(new_model)-[:RACE { expect: 'safe' }]->(new_result: Result)`.
    *   Add your result variable into the final suite `FOLD` command so the suite waits for it before collapsing.
4.  **Run the Verifier:** Execute the batch builder.
    *   *Command:* `cd <gnosis-dir> && bun run build:toy-tla`
5.  **Check Output:** Ensure the script discovers your new files, successfully emits TLA/CFG formal artifacts to `tla/generated/`, and verifies the logic.