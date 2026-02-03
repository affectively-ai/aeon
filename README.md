# Aeon

> Distributed synchronization, schema versioning, and conflict resolution for real-time collaborative applications.

[![npm version](https://badge.fury.io/js/@affectively%2Faeon.svg)](https://www.npmjs.com/package/@affectively/aeon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)

## Overview

**Aeon** (Greek: "an immeasurably long period of time") is a comprehensive TypeScript library for building distributed, collaborative applications. It provides the primitives needed for:

- **Distributed Synchronization** - Coordinate sync sessions across multiple nodes
- **Schema Versioning** - Manage schema evolution with migrations and rollbacks
- **Data Replication** - Configure consistency levels and replication policies
- **Conflict Resolution** - Multiple strategies for resolving divergent state
- **Real-time Presence** - Track node health and status in real-time

## Installation

```bash
npm install @affectively/aeon
# or
yarn add @affectively/aeon
# or
pnpm add @affectively/aeon
# or
bun add @affectively/aeon
```

## Quick Start

### Distributed Synchronization

```typescript
import { SyncCoordinator } from '@affectively/aeon';

// Create a sync coordinator
const coordinator = new SyncCoordinator();

// Register nodes
coordinator.registerNode({
  id: 'node-1',
  address: 'localhost',
  port: 3000,
  status: 'online',
  lastHeartbeat: new Date().toISOString(),
  version: '1.0.0',
  capabilities: ['sync', 'replicate'],
});

// Create a sync session
const session = coordinator.createSyncSession('node-1', ['node-2', 'node-3']);

// Listen for sync events
coordinator.on('sync-completed', (session) => {
  console.log(`Session ${session.id} completed:`, session.itemsSynced, 'items synced');
});

// Start heartbeat monitoring
coordinator.startHeartbeatMonitoring(5000);
```

### Schema Versioning & Migrations

```typescript
import { SchemaVersionManager, MigrationEngine, MigrationTracker } from '@affectively/aeon';

// Initialize version manager
const versionManager = new SchemaVersionManager();

// Register schema versions
versionManager.registerVersion({
  major: 1,
  minor: 0,
  patch: 0,
  timestamp: new Date().toISOString(),
  description: 'Initial schema',
  breaking: false,
});

versionManager.registerVersion({
  major: 2,
  minor: 0,
  patch: 0,
  timestamp: new Date().toISOString(),
  description: 'Added user status field',
  breaking: true,
});

// Create migration engine
const migrationEngine = new MigrationEngine();

// Register a migration
migrationEngine.registerMigration({
  id: 'add-status-field',
  version: '2.0.0',
  name: 'Add user status field',
  up: (data) => ({ ...data, status: 'active' }),
  down: (data) => {
    const { status, ...rest } = data;
    return rest;
  },
  timestamp: new Date().toISOString(),
  description: 'Adds status field to all user records',
});

// Execute migration
const result = await migrationEngine.executeMigration('add-status-field', userData);
console.log(`Migration completed: ${result.itemsAffected} items affected`);
```

### Data Replication

```typescript
import { ReplicationManager } from '@affectively/aeon';

const replicationManager = new ReplicationManager();

// Create a replication policy
const policy = replicationManager.createPolicy(
  'user-data-policy',
  3,                    // replication factor
  'read-after-write',   // consistency level
  1000,                 // sync interval (ms)
  10000                 // max replication lag (ms)
);

// Register replicas
replicationManager.registerReplica({
  id: 'replica-1',
  nodeId: 'node-1',
  status: 'primary',
  lastSyncTime: new Date().toISOString(),
  lagBytes: 0,
  lagMillis: 0,
});

// Check replication health
const health = replicationManager.checkReplicationHealth(policy.id);
console.log('Replication healthy:', health.healthy);
```

### Conflict Resolution

```typescript
import { StateReconciler } from '@affectively/aeon';

const reconciler = new StateReconciler();

// Record state versions from different nodes
reconciler.recordStateVersion('user:123', '1.0', '2024-01-01T00:00:00Z', 'node-1', 'hash-a', { name: 'Alice' });
reconciler.recordStateVersion('user:123', '1.0', '2024-01-01T00:00:01Z', 'node-2', 'hash-b', { name: 'Bob' });

// Detect conflicts
if (reconciler.detectConflicts('user:123')) {
  // Reconcile using last-write-wins strategy
  const versions = reconciler.getStateVersions('user:123');
  const result = reconciler.reconcileLastWriteWins(versions);

  console.log('Resolved state:', result.mergedState);
  console.log('Conflicts resolved:', result.conflictsResolved);
}
```

## Modules

### Core (`@affectively/aeon/core`)

Shared types and utilities used across all modules.

```typescript
import type { Operation, VectorClock, PresenceInfo } from '@affectively/aeon/core';
```

### Versioning (`@affectively/aeon/versioning`)

Schema versioning and migration system.

- `SchemaVersionManager` - Version tracking and compatibility
- `MigrationEngine` - Migration execution and rollback
- `DataTransformer` - Data transformation during migrations
- `MigrationTracker` - Migration history and audit trails

### Distributed (`@affectively/aeon/distributed`)

Distributed synchronization primitives.

- `SyncCoordinator` - Sync session management
- `ReplicationManager` - Replica management and policies
- `SyncProtocol` - Protocol messages and handshaking
- `StateReconciler` - Conflict detection and resolution

### Utils (`@affectively/aeon/utils`)

Shared utilities including pluggable logging.

```typescript
import { setLogger, disableLogging } from '@affectively/aeon/utils';

// Use custom logger
setLogger({
  debug: (...args) => myLogger.debug(...args),
  info: (...args) => myLogger.info(...args),
  warn: (...args) => myLogger.warn(...args),
  error: (...args) => myLogger.error(...args),
});

// Or disable logging entirely
disableLogging();
```

## API Reference

### SyncCoordinator

| Method | Description |
|--------|-------------|
| `registerNode(node)` | Register a node in the cluster |
| `deregisterNode(nodeId)` | Remove a node from the cluster |
| `createSyncSession(initiatorId, participantIds)` | Create a new sync session |
| `updateSyncSession(sessionId, updates)` | Update sync session status |
| `recordConflict(sessionId, nodeId, data)` | Record a conflict |
| `getStatistics()` | Get sync statistics |
| `startHeartbeatMonitoring(interval)` | Start health monitoring |

### SchemaVersionManager

| Method | Description |
|--------|-------------|
| `registerVersion(version)` | Register a schema version |
| `getCurrentVersion()` | Get current active version |
| `setCurrentVersion(version)` | Set the current version |
| `canMigrate(from, to)` | Check if migration path exists |
| `getMigrationPath(from, to)` | Get migration steps |
| `compareVersions(v1, v2)` | Compare two versions |

### MigrationEngine

| Method | Description |
|--------|-------------|
| `registerMigration(migration)` | Register a migration |
| `executeMigration(id, data)` | Execute a migration |
| `rollbackMigration(id, data)` | Rollback a migration |
| `getState()` | Get current migration state |
| `getPendingMigrations()` | Get pending migrations |
| `getStatistics()` | Get migration statistics |

### ReplicationManager

| Method | Description |
|--------|-------------|
| `registerReplica(replica)` | Register a replica |
| `removeReplica(replicaId)` | Remove a replica |
| `createPolicy(...)` | Create replication policy |
| `updateReplicaStatus(...)` | Update replica status |
| `checkReplicationHealth(policyId)` | Check replication health |
| `getStatistics()` | Get replication statistics |

### StateReconciler

| Method | Description |
|--------|-------------|
| `recordStateVersion(...)` | Record a state version |
| `detectConflicts(key)` | Detect state conflicts |
| `compareStates(s1, s2)` | Generate state diff |
| `reconcileLastWriteWins(versions)` | LWW reconciliation |
| `reconcileVectorClock(versions)` | Vector clock reconciliation |
| `reconcileMajorityVote(versions)` | Majority vote reconciliation |

## Comparison with Similar Libraries

| Feature | Aeon | Yjs | Automerge |
|---------|------|-----|-----------|
| Schema Versioning | ✅ | ❌ | ❌ |
| Migrations | ✅ | ❌ | ❌ |
| Replication Policies | ✅ | ❌ | ❌ |
| Multiple Merge Strategies | ✅ | ⚠️ | ⚠️ |
| TypeScript-first | ✅ | ⚠️ | ⚠️ |
| Zero Dependencies* | ✅ | ❌ | ❌ |

*Only `eventemitter3` for event handling

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (for types)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT - see [LICENSE](LICENSE) for details.

## Credits

Built with care by [Affectively AI](https://github.com/affectively-ai).
