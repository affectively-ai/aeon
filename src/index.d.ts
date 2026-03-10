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
export * from './core';
export * from './utils';
export * from './persistence';
export * from './versioning';
export * from './distributed';
export * from './offline';
export * from './compression';
export * from './optimization';
export * from './presence';
export * from './crypto';
export * from './flow';
export * from './transport';
export * from './federation';
/**
 * STUBS for React components and hooks
 * These are normally provided by @affectively/aeon-flux-react but are
 * imported from @affectively/aeon in many legacy parts of edge-web-app.
 *
 * NOTE: Only stub things NOT exported by submodules above.
 * SchemaVersionManager, SyncCoordinator, getAdaptiveCompressionOptimizer,
 * and getAgentPresenceManager are real exports — do NOT shadow them here.
 */
export declare const Link: any;
export declare const useAeonPage: any;
