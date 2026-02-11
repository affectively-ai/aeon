/**
 * Aeon Versioning Module
 *
 * Schema versioning and migration system for distributed applications.
 *
 * Features:
 * - Schema version management
 * - Migration execution and rollback
 * - Data transformation during migrations
 * - Migration tracking and audit trails
 */

export { SchemaVersionManager } from './SchemaVersionManager';
export type {
  SchemaVersion,
  VersionMetadata,
  CompatibilityRule,
} from './SchemaVersionManager';

export { MigrationEngine } from './MigrationEngine';
export type {
  Migration,
  MigrationResult,
  MigrationState,
} from './MigrationEngine';

export { DataTransformer } from './DataTransformer';
export type {
  FieldTransformer,
  TransformationRule,
  TransformationResult,
} from './DataTransformer';

export { MigrationTracker } from './MigrationTracker';
export type { MigrationRecord, RollbackPath } from './MigrationTracker';
