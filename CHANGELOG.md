# Changelog

## [1.1.0] - 2026-02-11

### Added

- **Persistence module (`@affectively/aeon/persistence`)**
  - `StorageAdapter` persistence boundary for runtime-agnostic durability.
  - `InMemoryStorageAdapter` for testing and baseline integration.
  - `DashStorageAdapter` for local-first writes with optional debounced D1/R2 sync batching.
- **Durable state for core distributed/versioning flows**
  - `OfflineOperationQueue` optional snapshot persistence (`saveToPersistence`, `loadFromPersistence`, `clearPersistence`).
  - `ReplicationManager` optional persisted replica/policy/sync status checkpoints.
  - `SyncProtocol` optional persisted message/handshake/error replay checkpoints.
  - `MigrationTracker` optional persisted audit snapshots with chained integrity metadata verification.
- **Package exports and builds**
  - New module subpath exports: `offline`, `compression`, `optimization`, `presence`, `persistence`.
  - Added missing build entries for per-module CJS/ESM bundles and declarations.

### Changed

- Strengthened persisted payload validation for replication, protocol, and migration tracker state before in-memory restore.
- Improved default persistence behavior with debounced autosave and explicit opt-in loading.

### Testing

- Added persistence test coverage for:
  - `DashStorageAdapter`
  - distributed protocol and replication persistence paths
  - migration tracker persistence integrity/tamper detection

## [1.0.0] - 2026-02-02

### Initial Release

Aeon is a distributed synchronization library for real-time collaborative applications.

### Core Features

- **DeltaSyncOptimizer**: Efficient delta-based synchronization with 70-80% bandwidth reduction.
- **AgentPresenceManager**: Rich presence tracking with cursors, sections, and activity status.
- **OfflineOperationQueue**: Priority-based offline operation queuing with automatic retry and localStorage persistence.
- **SchemaVersionManager**: Schema versioning with migration tracking and compatibility checks.
- **MigrationEngine**: Execute and rollback migrations with audit trails.
- **CompressionEngine**: Native gzip/deflate compression using CompressionStream API.
- **ReplicationManager**: Multi-node replication with configurable consistency levels.
- **SyncCoordinator**: Orchestrates sync operations across the distributed system.

### Modules

- `@affectively/aeon/core` - Core types and utilities
- `@affectively/aeon/versioning` - Schema versioning and migrations
- `@affectively/aeon/distributed` - Replication and sync coordination
- `@affectively/aeon/utils` - Logging and helper utilities
- `@affectively/aeon/crypto` - UCAN-based identity and encryption (requires optional peer deps)

### Optional Peer Dependencies

- `@affectively/auth` - For UCAN authentication
- `@affectively/zk-encryption` - For zero-knowledge encryption
