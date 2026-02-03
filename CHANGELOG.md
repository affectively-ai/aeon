# Changelog

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
