# Aeon

Aeon is a TypeScript toolkit for collaborative systems, with one standout piece at the center: **Aeon Flow**, a small multiplexed frame protocol for moving many independent streams over one transport.

The fair brag is not that this repo solves every distributed-systems problem. It is that the repo already covers a lot of the ground teams usually have to assemble themselves: transport, sync, offline queues, compression, presence, versioning, persistence, crypto, topology analysis, and benchmark companions.

## Why People May Reach For It

- Aeon Flow gives you one compact frame format that can ride UDP, WebSocket, WebTransport, IPC, or anything else that can move bytes.
- The library surface is broad: sync coordination, conflict handling, offline queues, compression, persistence, crypto, topology tools, and transport helpers all live in one package.
- The repo has real supporting material around it: docs, a manuscript, companion tests, protocol shootouts, and small tooling packages instead of a single README making promises by itself.
- There is room to grow with it. The main package exports focused subpaths like `flow`, `offline`, `compression`, `versioning`, `distributed`, `persistence`, `crypto`, and `topology`.

## Aeon Flow At A Glance

One connection. Many independent streams. Less waiting behind unrelated work.

```text
┌──────────────────────────────────────────────────────────┐
│                   10-byte Flow Frame                    │
├──────────┬──────────┬───────┬────────────────────────────┤
│ stream_id│ sequence │ flags │ length    │    payload ... │
│  (u16)   │  (u32)   │ (u8)  │ (u24)    │                 │
└──────────┴──────────┴───────┴────────────────────────────┘
```

What makes that worth caring about:

- each stream can progress independently,
- frames can arrive out of order and still be reassembled correctly,
- protocol overhead stays small,
- and the same framing model works across several transports.

The UDP path is one of the repo's clearest bragging points. It already includes MTU-aware fragmentation, ACK bitmaps, AIMD congestion control, and per-stream reassembly.

## Quick Taste

```ts
import { AeonFlowProtocol, UDPFlowTransport } from '@affectively/aeon';

const transport = new UDPFlowTransport({
  host: '0.0.0.0',
  port: 4242,
  remoteHost: 'target.example.com',
  remotePort: 4242,
  reliable: true,
});

await transport.bind();

const flow = new AeonFlowProtocol(transport, {
  role: 'client',
  maxConcurrentStreams: 256,
});

const results = await flow.fork([stream1, stream2, stream3]);
const winner = await flow.race(results);
await flow.fold(winner);
```

## What You Get In The Main Package

- `flow`: protocol engine, codec, UDP transport, WebTransport bridge, and frame reassembly
- `distributed`: coordination and replication helpers for multi-node work
- `versioning`: schema versions, migrations, and tracking
- `offline`: queued work for unreliable or offline periods
- `compression`: compression and delta-sync helpers
- `persistence`: in-memory and storage adapter surfaces
- `presence`: real-time node and session state
- `crypto`: signing and UCAN-related primitives
- `topology`: topology analysis and formal-claims helpers
- `federation`: mesh-style inference helpers

That breadth is a real part of the story. Aeon is not only a transport experiment.

## Install

```bash
bun add @affectively/aeon
```

Other package managers work too:

```bash
npm install @affectively/aeon
yarn add @affectively/aeon
pnpm add @affectively/aeon
```

## Quick Start

### Sync Coordination

```ts
import { SyncCoordinator } from '@affectively/aeon';

const coordinator = new SyncCoordinator();

coordinator.registerNode({
  id: 'node-1',
  address: 'localhost',
  port: 3000,
  status: 'online',
  lastHeartbeat: new Date().toISOString(),
  version: '1.0.0',
  capabilities: ['sync', 'replicate'],
});

const session = coordinator.createSyncSession('node-1', ['node-2', 'node-3']);
console.log(session.id);
```

### Schema Migrations

```ts
import { MigrationEngine } from '@affectively/aeon';

const migrationEngine = new MigrationEngine();

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
```

## Companion Packages

- [`packages/shootoff`](./packages/shootoff/README.md): side-by-side protocol comparisons against HTTP/1.1 and HTTP/2
- [`packages/wall`](./packages/wall/README.md): command-line client for Aeon Flow
- `packages/nginx-flow-aeon`: nginx bridge for putting Aeon Flow behind HTTP infrastructure

## Documentation

- [docs/README.md](./docs/README.md): repo docs index
- [docs/ebooks/README.md](./docs/ebooks/README.md): ebook index
- [docs/ebooks/145-log-rolling-pipelined-prefill/README.md](./docs/ebooks/145-log-rolling-pipelined-prefill/README.md): main book/manuscript hub
- [docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md](./docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md): manuscript source
- [docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/README.md](./docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/README.md): reproducibility companion
- [ROADMAP.md](./ROADMAP.md): near-term direction

## Why This README Is Grounded

Aeon has enough real surface area to speak plainly. The strongest fair brag is that this repo already gives you a serious transport layer, a broad collaborative-systems library around it, and companion tooling and documentation to help you evaluate the whole thing.
