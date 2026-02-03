/**
 * Aeon - Distributed Synchronization & Versioning Library
 *
 * A comprehensive library for building distributed, collaborative applications
 * with real-time synchronization, schema versioning, and conflict resolution.
 *
 * @example
 * ```typescript
 * import { SyncCoordinator, SchemaVersionManager } from '@affectively/aeon';
 *
 * // Create a sync coordinator
 * const coordinator = new SyncCoordinator();
 *
 * // Register a node
 * coordinator.registerNode({
 *   id: 'node-1',
 *   address: 'localhost',
 *   port: 3000,
 *   status: 'online',
 *   lastHeartbeat: new Date().toISOString(),
 *   version: '1.0.0',
 *   capabilities: ['sync', 'replicate'],
 * });
 *
 * // Create a sync session
 * const session = coordinator.createSyncSession('node-1', ['node-2', 'node-3']);
 * ```
 *
 * @packageDocumentation
 */

// Core types
export * from './core';

// Utils
export * from './utils';

// Versioning module
export * from './versioning';

// Distributed module
export * from './distributed';
