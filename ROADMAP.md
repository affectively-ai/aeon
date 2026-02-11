# Aeon Roadmap Vision (2026-2027)

Last updated: February 11, 2026

## Vision

Aeon should become the default TypeScript synchronization foundation for collaborative software that needs:

- deterministic sync behavior across clients and services
- schema evolution without migration fear
- offline-first resilience on unreliable networks
- security primitives that can be enforced, not bolted on

The long-term outcome is a library that teams can adopt in days, trust in production, and extend safely.

## Current Baseline (v1.0.0)

As of `1.0.0` (released February 2, 2026), Aeon provides:

- distributed primitives (`SyncCoordinator`, `ReplicationManager`, `StateReconciler`, `SyncProtocol`)
- schema versioning and migration tooling (`SchemaVersionManager`, `MigrationEngine`, `MigrationTracker`, `DataTransformer`)
- offline queueing, delta sync, compression, and adaptive optimization
- presence tracking and optional crypto integrations (UCAN + ZK encryption)
- active downstream usage in `storage`, `dash`, and `relay` (peer-to-peer storage path)

This is a strong primitive layer. The next roadmap focuses on hardening, production-grade integration, and ecosystem adoption.

## Optional Persistence Strategy (Cross-Library)

Aeon should remain runtime-agnostic and work with zero persistence by default, while using WASM + `dash` storage as the primary durability path for first-party products.

### Where persistence adds clear value

- offline operation durability across app restarts
- replication checkpoints and acknowledgement ledgers for relay/node restarts
- migration and reconciliation audit history for observability and recovery
- resumable protocol sessions for unstable mobile or edge links

### Where persistence should stay optional or minimal

- high-churn ephemeral presence and heartbeat state
- short-lived optimization heuristics that are cheap to recompute

### Product-aligned integration intent

- `storage` and `dash` (WASM + D1/R2 sync): canonical persistence path for durable queue/checkpoint state
- `relay`: durable peer replication metadata and anti-entropy resume points
- `dash`: diagnostics and replay tooling on top of persisted Aeon telemetry/state snapshots

## Strategic Pillars

1. Reliability First
   - deterministic sync semantics, replayable state transitions, and compatibility guarantees.
2. Secure-by-Default Collaboration
   - make signature verification, capability checks, and encryption composable and easy to enforce.
3. Production Operability
   - built-in observability, diagnostics, and SLO-aligned performance guidance.
4. Developer Velocity
   - adapters, examples, and workflows that remove glue-code burden.
5. Ecosystem Reach
   - integrations, interoperability, and open governance for external contributors.

## Roadmap Horizons

## Horizon 1: Core Hardening (February-April 2026)

Target release: `v1.1.x`

### Outcomes

- lock protocol and API contracts for real production use
- reduce edge-case ambiguity in conflict and migration behavior
- establish measurable performance and reliability baselines

### Milestones

- Protocol Contract Stabilization
  - formal message schema definitions and runtime validation hooks
  - protocol compatibility matrix across minor versions
  - deterministic message and conflict test fixtures
- Persistence Abstraction
  - storage adapter interface for queue/state snapshots (opt-in, non-breaking default)
  - first-party default: `dash` WASM-backed adapter with D1/R2 sync for cross-runtime durability
  - compatibility adapters (only when required): in-memory reference or environment-specific fallback backends
  - persistence domains: offline queue, replication checkpoints, migration/reconciliation history
  - resilience profile: local-first writes with D1/R2-backed sync and replay after restart/partition
- Reliability and Regression Safety
  - long-run soak tests for queue, replication, and reconciliation paths
  - deterministic test harness for time-based behavior and retries
- Baseline Observability
  - structured event model and metrics surface (latency, conflict rate, queue depth, replication lag)

## Horizon 2: Adoption and Integration (May-August 2026)

Target release: `v1.2.x`

### Outcomes

- make Aeon easy to wire into real apps without bespoke infrastructure
- reduce onboarding time and implementation risk

### Milestones

- Transport Adapter Layer
  - adapter contract for WebSocket, WebRTC, and HTTP sync transports
  - reconnect and backoff policies with shared defaults
- Reference Architecture and Examples
  - end-to-end example app with offline + replication + migration + presence
  - reference integration docs for `storage`, `relay`, and `dash`
  - documented production topology patterns (single region, multi-region, edge-heavy)
- Migration and Versioning Tooling
  - migration scaffolding helpers and dry-run validation workflow
  - schema compatibility checks integrated into CI workflows
- DX Improvements
  - API docs generated per module with executable examples
  - troubleshooting guide and playbooks for common failure modes

## Horizon 3: Scale, Security, and Operations (September-December 2026)

Target release: `v1.3.x`

### Outcomes

- support larger deployments with stronger trust boundaries
- provide operational confidence for regulated and enterprise contexts

### Milestones

- Security Hardening
  - stricter defaults for signed messages and capability verification
  - key/session rotation guidance and test coverage
  - security threat model and hardening checklist
- Replication at Scale
  - large-cluster simulation benchmarks
  - failure injection tests for partitions, lag spikes, and node churn
  - tunable consistency templates for common operational profiles
- Protocol and Compliance Readiness
  - protocol conformance suite for adapter implementations
  - backward-compatibility policy and deprecation timeline standards

## Horizon 4: Ecosystem and Platform Expansion (2027)

Target release window: `v1.4+` progressing toward a `v2.0` planning checkpoint

### Outcomes

- evolve from a strong library into a durable ecosystem platform

### Milestones

- Extensibility
  - plugin points for reconciliation, conflict policy, and migration strategy
  - documented extension safety contracts
- Interoperability
  - bridges or adapters for adjacent collaboration ecosystems where practical
  - import/export strategy for state and migration metadata
- Operational Integrations
  - first-party integration guidance for cloud and edge runtimes
  - observability recipes for common telemetry stacks
- Open Source Governance
  - RFC process for major changes
  - maintainer triage and release process documentation

## Horizon 5: Product Re-Integration and Convergence (Post-v1.4, 2027+)

Target release window: integration wave after Horizon 4 stabilization

### Outcomes

- converge Aeon’s hardened primitives back into first-party product surfaces
- remove drift between library capabilities and application implementations
- prove production value through real end-to-end product workflows

### Milestones

- `dashrelay-app` Integration Program
  - adopt Aeon `dash` WASM persistence adapter with D1/R2 sync for durable queue/checkpoint recovery
  - migrate sync orchestration paths onto `SyncCoordinator` + `SyncProtocol`
  - validate reconnect/replay behavior across app restarts and network partitions
- `relay` Convergence Program
  - unify peer-to-peer replication logic with `ReplicationManager` policies
  - persist anti-entropy checkpoints and resume metadata via `dash` WASM + D1/R2 sync
  - enable signed/encrypted sync pathways where trust boundaries require it
- `dash` Operations and Diagnostics Program
  - integrate Aeon telemetry surfaces into operational dashboards
  - add replay/debug tooling for migration, reconciliation, and replication incidents
  - publish SLO and incident runbooks based on Aeon-native metrics
- Cross-Product Contract Lock
  - define and enforce shared compatibility contracts between Aeon and consuming apps
  - add integration test matrix: `aeon` x `dashrelay-app` x `dash` x `relay`
  - gate releases on passing convergence and rollback safety checks

## Success Metrics

By end of 2026, Aeon should be able to demonstrate:

- reliability: 99.9%+ successful sync completion in reference reliability tests
- performance: p95 sync latency and replication lag targets defined and published per deployment profile
- migration safety: zero data-loss incidents in official migration test matrix
- restart resilience: documented and tested recovery flow for persisted queue/checkpoint state
- developer adoption: reduced time-to-first-sync in examples and onboarding docs
- ecosystem health: active external issue/PR velocity and documented contribution pathways

By completion of Horizon 5, Aeon should additionally demonstrate:

- product convergence: first-party sync and replication paths use Aeon as the default foundation
- operational clarity: `dash` can diagnose major sync incidents using Aeon-native telemetry
- relay resilience: restart and partition recovery meets documented peer-to-peer durability targets using D1/R2 sync

## Non-Goals (For This Roadmap Window)

- building a full hosted backend product inside Aeon
- replacing specialized CRDT engines in every scenario
- locking into a single transport, database, or cloud runtime

Aeon remains a focused synchronization and versioning foundation that integrates cleanly with broader stacks.

## Execution Model

- Quarterly planning checkpoints with explicit go/no-go criteria per horizon
- Monthly incremental releases for non-breaking improvements
- Breaking changes batched behind clearly announced major-version gates
- Every roadmap milestone tied to tests, docs, and benchmark evidence before marked complete
