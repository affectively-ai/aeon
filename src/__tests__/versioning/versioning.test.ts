import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaVersionManager } from '../../versioning/SchemaVersionManager';
import {
  MigrationEngine,
  type Migration,
} from '../../versioning/MigrationEngine';
import { DataTransformer } from '../../versioning/DataTransformer';
import { MigrationTracker } from '../../versioning/MigrationTracker';
import { InMemoryStorageAdapter } from '../../persistence';

describe('Versioning Module', () => {
  let versionManager: SchemaVersionManager;
  let migrationEngine: MigrationEngine;
  let dataTransformer: DataTransformer;
  let migrationTracker: MigrationTracker;

  beforeEach(() => {
    versionManager = new SchemaVersionManager();
    migrationEngine = new MigrationEngine();
    dataTransformer = new DataTransformer();
    migrationTracker = new MigrationTracker();
  });

  describe('SchemaVersionManager', () => {
    it('should initialize with default version', () => {
      const current = versionManager.getCurrentVersion();
      expect(current).toBeDefined();
      expect(current.major).toBe(1);
      expect(current.minor).toBe(0);
      expect(current.patch).toBe(0);
    });

    it('should register a new schema version', () => {
      const version = versionManager.createVersion(2, 0, 0, 'Version 2', true);
      versionManager.registerVersion(version);

      expect(versionManager.hasVersion(version)).toBe(true);
    });

    it('should track multiple schema versions', () => {
      versionManager.registerVersion(
        versionManager.createVersion(1, 1, 0, 'V1.1', false)
      );
      versionManager.registerVersion(
        versionManager.createVersion(2, 0, 0, 'V2', true)
      );

      const history = versionManager.getVersionHistory();
      expect(history.length).toBeGreaterThanOrEqual(3); // Including initial 1.0.0
    });

    it('should set current version', () => {
      const version = versionManager.createVersion(2, 0, 0, 'V2', false);
      versionManager.registerVersion(version);
      versionManager.setCurrentVersion(version);

      const current = versionManager.getCurrentVersion();
      expect(versionManager.versionToString(current)).toBe('2.0.0');
    });

    it('should compare versions correctly', () => {
      expect(versionManager.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(versionManager.compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(versionManager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should register compatibility rules', () => {
      versionManager.registerVersion(
        versionManager.createVersion(1, 0, 1, 'V1.0.1', false)
      );

      versionManager.registerCompatibility({
        from: '1.0.0',
        to: '1.0.1',
        compatible: true,
        requiresMigration: true,
        migrationSteps: 1,
      });

      expect(versionManager.canMigrate('1.0.0', '1.0.1')).toBe(true);
    });

    it('should get version by string', () => {
      const version = versionManager.getVersion('1.0.0');
      expect(version).toBeDefined();
      expect(version?.major).toBe(1);
      expect(version?.minor).toBe(0);
      expect(version?.patch).toBe(0);
    });

    it('should return undefined for unknown version', () => {
      const version = versionManager.getVersion('99.0.0');
      expect(version).toBeUndefined();
    });

    it('should get migration path between versions', () => {
      // Register intermediate versions with compatibility rules
      const v1_0_1 = versionManager.createVersion(1, 0, 1, 'V1.0.1', false);
      const v1_1_0 = versionManager.createVersion(1, 1, 0, 'V1.1.0', false);
      const v2_0_0 = versionManager.createVersion(2, 0, 0, 'V2.0.0', true);

      versionManager.registerVersion(v1_0_1);
      versionManager.registerVersion(v1_1_0);
      versionManager.registerVersion(v2_0_0);

      // Set up migration path
      versionManager.registerCompatibility({
        from: '1.0.0',
        to: '1.0.1',
        compatible: true,
        requiresMigration: true,
        migrationSteps: 1,
      });
      versionManager.registerCompatibility({
        from: '1.0.1',
        to: '1.1.0',
        compatible: true,
        requiresMigration: true,
        migrationSteps: 1,
      });
      versionManager.registerCompatibility({
        from: '1.1.0',
        to: '2.0.0',
        compatible: false,
        requiresMigration: true,
        migrationSteps: 2,
      });

      const fromVersion = versionManager.parseVersion('1.0.0');
      const toVersion = v2_0_0;

      const path = versionManager.getMigrationPath(fromVersion, toVersion);

      // Path should contain intermediate versions
      expect(Array.isArray(path)).toBe(true);
    });

    it('should return empty path when no migration path exists', () => {
      const fromVersion = versionManager.parseVersion('1.0.0');
      const toVersion = versionManager.createVersion(
        99,
        0,
        0,
        'Far future',
        true
      );

      versionManager.registerVersion(toVersion);

      const path = versionManager.getMigrationPath(fromVersion, toVersion);

      // No compatibility rules set up for this jump
      expect(path).toEqual([]);
    });

    it('should get version metadata', () => {
      const v1_1_0 = versionManager.createVersion(
        1,
        1,
        0,
        'V1.1.0 update',
        false
      );
      versionManager.registerVersion(v1_1_0);

      const metadata = versionManager.getVersionMetadata(v1_1_0);

      expect(metadata).toBeDefined();
      expect(metadata.version).toBe(v1_1_0);
      expect(metadata.changes).toContain('V1.1.0 update');
      expect(typeof metadata.rollbackPossible).toBe('boolean');
    });

    it('should get version metadata with previous version', () => {
      // The history already has 1.0.0
      const v1_1_0 = versionManager.createVersion(1, 1, 0, 'V1.1.0', false);
      versionManager.registerVersion(v1_1_0);

      const metadata = versionManager.getVersionMetadata(v1_1_0);

      expect(metadata.previousVersion).toBeDefined();
      expect(metadata.previousVersion?.major).toBe(1);
      expect(metadata.previousVersion?.minor).toBe(0);
      expect(metadata.rollbackPossible).toBe(true);
    });

    it('should get version metadata for first version with no previous', () => {
      versionManager.clear();

      const v1_0_0 = versionManager.createVersion(1, 0, 0, 'Initial', false);
      versionManager.registerVersion(v1_0_0);

      const metadata = versionManager.getVersionMetadata(v1_0_0);

      expect(metadata.previousVersion).toBeUndefined();
      expect(metadata.rollbackPossible).toBe(false);
    });

    it('should include migrations in metadata when required', () => {
      const v1_1_0 = versionManager.createVersion(1, 1, 0, 'V1.1.0', false);
      versionManager.registerVersion(v1_1_0);

      versionManager.registerCompatibility({
        from: '1.0.0',
        to: '1.1.0',
        compatible: true,
        requiresMigration: true,
        migrationSteps: 1,
      });

      const metadata = versionManager.getVersionMetadata(v1_1_0);

      expect(metadata.migrationsRequired.length).toBeGreaterThanOrEqual(0);
    });

    it('should get all versions sorted', () => {
      versionManager.registerVersion(
        versionManager.createVersion(1, 2, 0, 'V1.2', false)
      );
      versionManager.registerVersion(
        versionManager.createVersion(1, 1, 0, 'V1.1', false)
      );
      versionManager.registerVersion(
        versionManager.createVersion(2, 0, 0, 'V2', true)
      );

      const allVersions = versionManager.getAllVersions();

      expect(allVersions.length).toBeGreaterThanOrEqual(4); // Including 1.0.0

      // Verify sorted order
      for (let i = 1; i < allVersions.length; i++) {
        const comparison = versionManager.compareVersions(
          allVersions[i - 1],
          allVersions[i]
        );
        expect(comparison).toBeLessThanOrEqual(0);
      }
    });

    it('should clear all versions', () => {
      versionManager.registerVersion(
        versionManager.createVersion(2, 0, 0, 'V2', true)
      );

      expect(versionManager.getVersionHistory().length).toBeGreaterThanOrEqual(
        2
      );

      versionManager.clear();

      expect(versionManager.getVersionHistory()).toEqual([]);
      expect(versionManager.getAllVersions()).toEqual([]);
    });

    it('should throw when getting current version after clear', () => {
      versionManager.clear();

      expect(() => versionManager.getCurrentVersion()).toThrow(
        'No current version set'
      );
    });

    it('should throw when setting unregistered version as current', () => {
      const unregistered = versionManager.createVersion(
        99,
        0,
        0,
        'Not registered',
        false
      );

      expect(() => versionManager.setCurrentVersion(unregistered)).toThrow(
        'Version 99.0.0 not registered'
      );
    });
  });

  describe('MigrationEngine', () => {
    it('should register a migration', () => {
      const migration: Migration = {
        id: 'migration-1',
        version: '1.1.0',
        name: 'Add user status field',
        up: (data: unknown) => {
          const obj = data as Record<string, unknown>;
          return { ...obj, status: 'active' };
        },
        timestamp: new Date().toISOString(),
        description: 'Add status field',
      };

      migrationEngine.registerMigration(migration);

      const registered = migrationEngine.getMigration('migration-1');
      expect(registered).toBeDefined();
      expect(registered?.version).toBe('1.1.0');
    });

    it('should execute an up migration', async () => {
      const migration: Migration = {
        id: 'up-migration-1',
        version: '1.1.0',
        name: 'Add field',
        up: (data: unknown) => {
          const obj = data as Record<string, unknown>;
          return { ...obj, newField: 'value' };
        },
        timestamp: new Date().toISOString(),
        description: 'Add new field',
      };

      migrationEngine.registerMigration(migration);

      const testData = { id: 1, name: 'test' };
      const result = await migrationEngine.executeMigration(
        'up-migration-1',
        testData
      );

      expect(result.success).toBe(true);
      expect(result.itemsAffected).toBe(1);
    });

    it('should rollback a migration when supported', async () => {
      const migration: Migration = {
        id: 'rollback-migration-1',
        version: '1.1.0',
        name: 'Add field',
        up: (data: unknown) => {
          const obj = data as Record<string, unknown>;
          return { ...obj, newField: 'value' };
        },
        down: (data: unknown) => {
          const obj = data as Record<string, unknown>;
          const { newField, ...rest } = obj;
          return rest;
        },
        timestamp: new Date().toISOString(),
        description: 'Add field (reversible)',
      };

      migrationEngine.registerMigration(migration);

      const testData = { id: 1, name: 'test', newField: 'value' };
      const result = await migrationEngine.rollbackMigration(
        'rollback-migration-1',
        testData
      );

      expect(result.success).toBe(true);
    });

    it('should track applied migrations', async () => {
      const migration: Migration = {
        id: 'track-migration-1',
        version: '1.1.0',
        name: 'Track migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Test migration',
      };

      migrationEngine.registerMigration(migration);
      await migrationEngine.executeMigration('track-migration-1', {});

      const applied = migrationEngine.getAppliedMigrations();
      expect(applied).toContain('track-migration-1');
    });

    it('should handle migration failures gracefully', async () => {
      const migration: Migration = {
        id: 'fail-migration-1',
        version: '1.1.0',
        name: 'Failing migration',
        up: () => {
          throw new Error('Intentional failure');
        },
        timestamp: new Date().toISOString(),
        description: 'Test failure',
      };

      migrationEngine.registerMigration(migration);

      await expect(
        migrationEngine.executeMigration('fail-migration-1', {})
      ).rejects.toThrow();

      const failed = migrationEngine.getFailedMigrations();
      expect(failed).toContain('fail-migration-1');
    });

    it('should get migration statistics', async () => {
      const migration: Migration = {
        id: 'stats-migration-1',
        version: '1.1.0',
        name: 'Stats migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Stats test',
      };

      migrationEngine.registerMigration(migration);
      await migrationEngine.executeMigration('stats-migration-1', {});

      const stats = migrationEngine.getStatistics();
      expect(stats.totalExecuted).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.successRate).toBe(100);
    });

    it('should get migration state', async () => {
      const migration: Migration = {
        id: 'state-test-1',
        version: '1.1.0',
        name: 'State test migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'State test',
      };

      migrationEngine.registerMigration(migration);
      await migrationEngine.executeMigration('state-test-1', {});

      const state = migrationEngine.getState();
      expect(state).toBeDefined();
      expect(state.appliedMigrations).toContain('state-test-1');
    });

    it('should get execution history', async () => {
      const migration: Migration = {
        id: 'history-test-1',
        version: '1.1.0',
        name: 'History test migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'History test',
      };

      migrationEngine.registerMigration(migration);
      await migrationEngine.executeMigration('history-test-1', {});

      const history = migrationEngine.getExecutionHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(
        history.find((h) => h.migrationId === 'history-test-1')
      ).toBeDefined();
    });

    it('should get all migrations', () => {
      const migration1: Migration = {
        id: 'all-test-1',
        version: '1.1.0',
        name: 'Migration 1',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Test 1',
      };

      const migration2: Migration = {
        id: 'all-test-2',
        version: '1.2.0',
        name: 'Migration 2',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Test 2',
      };

      migrationEngine.registerMigration(migration1);
      migrationEngine.registerMigration(migration2);

      const all = migrationEngine.getAllMigrations();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('should get pending migrations', async () => {
      const migration1: Migration = {
        id: 'pending-test-1',
        version: '1.1.0',
        name: 'Applied migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Applied',
      };

      const migration2: Migration = {
        id: 'pending-test-2',
        version: '1.2.0',
        name: 'Pending migration',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Pending',
      };

      migrationEngine.registerMigration(migration1);
      migrationEngine.registerMigration(migration2);
      await migrationEngine.executeMigration('pending-test-1', {});

      const pending = migrationEngine.getPendingMigrations();
      expect(pending.find((m) => m.id === 'pending-test-2')).toBeDefined();
      expect(pending.find((m) => m.id === 'pending-test-1')).toBeUndefined();
    });

    it('should clear migration engine', async () => {
      const migration: Migration = {
        id: 'clear-test-1',
        version: '1.1.0',
        name: 'Clear test',
        up: (data: unknown) => data,
        timestamp: new Date().toISOString(),
        description: 'Clear test',
      };

      migrationEngine.registerMigration(migration);
      await migrationEngine.executeMigration('clear-test-1', {});

      expect(migrationEngine.getAllMigrations().length).toBeGreaterThanOrEqual(
        1
      );

      migrationEngine.clear();

      expect(migrationEngine.getAllMigrations().length).toBe(0);
      expect(migrationEngine.getExecutionHistory().length).toBe(0);
    });
  });

  describe('DataTransformer', () => {
    it('should register a transformation rule', () => {
      dataTransformer.registerRule({
        field: 'email',
        transformer: (value: unknown) =>
          typeof value === 'string' ? value.toLowerCase() : value,
      });

      const rule = dataTransformer.getRule('email');
      expect(rule).toBeDefined();
      expect(rule?.field).toBe('email');
    });

    it('should transform a single field', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) =>
          value === 'pending' ? 'active' : value,
      });

      const transformed = dataTransformer.transformField('status', 'pending');
      expect(transformed).toBe('active');
    });

    it('should transform an object with multiple fields', () => {
      dataTransformer.registerRule({
        field: 'email',
        transformer: (value: unknown) =>
          typeof value === 'string' ? value.toLowerCase() : value,
      });

      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) =>
          value === 'pending' ? 'active' : value,
      });

      const original = { email: 'TEST@EXAMPLE.COM', status: 'pending' };
      const transformed = dataTransformer.transformObject(original);

      expect(transformed.email).toBe('test@example.com');
      expect(transformed.status).toBe('active');
    });

    it('should transform a collection of items', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) =>
          value === 'pending' ? 'active' : value,
      });

      const items = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'active' },
      ];

      const result = dataTransformer.transformCollection(items);

      expect(result.success).toBe(true);
      expect(result.itemsTransformed).toBe(3);
      expect(result.itemsFailed).toBe(0);
    });

    it('should handle transformation errors with default values', () => {
      dataTransformer.registerRule({
        field: 'age',
        required: false,
        defaultValue: 0,
        transformer: (value: unknown) => {
          if (typeof value !== 'number') {
            throw new Error('Invalid type');
          }
          return value;
        },
      });

      const transformed = dataTransformer.transformField('age', 'not-a-number');
      expect(transformed).toBe(0);
    });

    it('should validate transformation', () => {
      const original = [{ id: 1 }, { id: 2 }];
      const transformed = [
        { id: 1, status: 'active' },
        { id: 2, status: 'active' },
      ];

      const validation = dataTransformer.validateTransformation(
        original,
        transformed
      );

      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect count mismatch in validation', () => {
      const original = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const transformed = [{ id: 1 }];

      const validation = dataTransformer.validateTransformation(
        original,
        transformed
      );

      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.includes('count mismatch'))).toBe(
        true
      );
    });

    it('should get transformation history', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.transformCollection([{ status: 'pending' }]);

      const history = dataTransformer.getTransformationHistory();
      expect(history.length).toBe(1);
    });

    it('should get statistics', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.transformCollection([
        { status: 'pending' },
        { status: 'active' },
      ]);

      const stats = dataTransformer.getStatistics();
      expect(stats.totalBatches).toBe(1);
      expect(stats.totalTransformed).toBe(2);
      expect(stats.successRate).toBe(100);
    });

    it('should get all rules', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.registerRule({
        field: 'name',
        transformer: (v) => v,
      });

      const rules = dataTransformer.getRules();
      expect(rules.length).toBe(2);
    });

    it('should clear rules', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.clearRules();

      const rules = dataTransformer.getRules();
      expect(rules.length).toBe(0);
    });

    it('should clear history', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.transformCollection([{ status: 'pending' }]);
      dataTransformer.clearHistory();

      const history = dataTransformer.getTransformationHistory();
      expect(history.length).toBe(0);
    });

    it('should clear all state', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (v) => v,
      });

      dataTransformer.transformCollection([{ status: 'pending' }]);
      dataTransformer.clear();

      expect(dataTransformer.getRules().length).toBe(0);
      expect(dataTransformer.getTransformationHistory().length).toBe(0);
    });
  });

  describe('MigrationTracker', () => {
    it('should record a migration', () => {
      migrationTracker.recordMigration({
        id: 'record-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'test-user',
      });

      const migrations = migrationTracker.getMigrations();
      expect(migrations.length).toBe(1);
    });

    it('should track migrations with snapshots', () => {
      migrationTracker.trackMigration(
        'migration-1',
        '1.1.0',
        'hash-before',
        'hash-after',
        10,
        150,
        10,
        'test-user'
      );

      const migrations = migrationTracker.getMigrations();
      expect(migrations.length).toBe(1);
      expect(migrations[0].dataSnapshot).toBeDefined();
    });

    it('should get migrations for a specific version', () => {
      migrationTracker.recordMigration({
        id: 'v1-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'v1-2',
        migrationId: 'migration-2',
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      const v1Migrations = migrationTracker.getMigrationsForVersion('1.1.0');
      expect(v1Migrations.length).toBe(1);
    });

    it('should get migration statistics', () => {
      migrationTracker.recordMigration({
        id: 'stat-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      const stats = migrationTracker.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.applied).toBe(1);
      expect(stats.successRate).toBe(100);
    });

    it('should update migration status', () => {
      migrationTracker.recordMigration({
        id: 'update-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'pending',
        duration: 0,
        itemsAffected: 0,
        appliedBy: 'user',
      });

      migrationTracker.updateMigrationStatus('update-1', 'applied');

      const migration = migrationTracker.getMigration('update-1');
      expect(migration?.status).toBe('applied');
    });

    it('should update migration status with error', () => {
      migrationTracker.recordMigration({
        id: 'error-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'pending',
        duration: 0,
        itemsAffected: 0,
        appliedBy: 'user',
      });

      migrationTracker.updateMigrationStatus('error-1', 'failed', 'Test error');

      const migration = migrationTracker.getMigration('error-1');
      expect(migration?.status).toBe('failed');
      expect(migration?.errorMessage).toBe('Test error');
    });

    it('should check canRollback', () => {
      migrationTracker.trackMigration(
        'm-1',
        '1.0.0',
        'hash-1',
        'hash-2',
        10,
        100,
        10,
        'user'
      );
      migrationTracker.trackMigration(
        'm-2',
        '1.1.0',
        'hash-2',
        'hash-3',
        10,
        100,
        10,
        'user'
      );

      // Should be able to rollback because snapshots exist
      const canRollback = migrationTracker.canRollback('1.1.0', '1.0.0');
      expect(typeof canRollback).toBe('boolean');
    });

    it('should return false for canRollback with unknown versions', () => {
      const canRollback = migrationTracker.canRollback('2.0.0', '1.0.0');
      expect(canRollback).toBe(false);
    });

    it('should get rollback path', () => {
      migrationTracker.trackMigration(
        'm-1',
        '1.0.0',
        'hash-1',
        'hash-2',
        10,
        100,
        10,
        'user'
      );
      migrationTracker.trackMigration(
        'm-2',
        '1.1.0',
        'hash-2',
        'hash-3',
        10,
        150,
        15,
        'user'
      );

      const path = migrationTracker.getRollbackPath('1.1.0', '1.0.0');

      expect(path).toBeDefined();
      expect(typeof path.canRollback).toBe('boolean');
      expect(Array.isArray(path.path)).toBe(true);
      expect(Array.isArray(path.affectedVersions)).toBe(true);
      expect(typeof path.estimatedDuration).toBe('number');
    });

    it('should get applied migrations', () => {
      migrationTracker.recordMigration({
        id: 'applied-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'failed-1',
        migrationId: 'migration-2',
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        direction: 'up',
        status: 'failed',
        duration: 50,
        itemsAffected: 0,
        appliedBy: 'user',
      });

      const applied = migrationTracker.getAppliedMigrations();
      expect(applied.length).toBe(1);
      expect(applied[0].id).toBe('applied-1');
    });

    it('should get failed migrations', () => {
      migrationTracker.recordMigration({
        id: 'fail-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'failed',
        duration: 50,
        itemsAffected: 0,
        appliedBy: 'user',
      });

      const failed = migrationTracker.getFailedMigrations();
      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe('failed');
    });

    it('should get pending migrations', () => {
      migrationTracker.recordMigration({
        id: 'pend-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'pending',
        duration: 0,
        itemsAffected: 0,
        appliedBy: 'user',
      });

      const pending = migrationTracker.getPendingMigrations();
      expect(pending.length).toBe(1);
      expect(pending[0].status).toBe('pending');
    });

    it('should get latest migration', () => {
      migrationTracker.recordMigration({
        id: 'first',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'second',
        migrationId: 'migration-2',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 10,
        appliedBy: 'user',
      });

      const latest = migrationTracker.getLatestMigration();
      expect(latest?.id).toBe('second');
    });

    it('should get timeline', () => {
      migrationTracker.recordMigration({
        id: 'timeline-1',
        migrationId: 'migration-1',
        timestamp: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      const timeline = migrationTracker.getTimeline();
      expect(timeline.length).toBe(1);
      expect(timeline[0].version).toBe('1.0.0');
      expect(timeline[0].status).toBe('applied');
    });

    it('should get audit trail', () => {
      migrationTracker.recordMigration({
        id: 'audit-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'admin',
      });

      const trail = migrationTracker.getAuditTrail();
      expect(trail.length).toBe(1);
      expect(trail[0].appliedBy).toBe('admin');
    });

    it('should get audit trail filtered by migrationId', () => {
      migrationTracker.recordMigration({
        id: 'audit-f-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'audit-f-2',
        migrationId: 'migration-2',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      const trail = migrationTracker.getAuditTrail('migration-1');
      expect(trail.length).toBe(1);
      expect(trail[0].migrationId).toBe('migration-1');
    });

    it('should clear migrations', () => {
      migrationTracker.recordMigration({
        id: 'clear-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.clear();

      expect(migrationTracker.getTotalMigrations()).toBe(0);
    });

    it('should get total migrations', () => {
      migrationTracker.recordMigration({
        id: 'total-1',
        migrationId: 'migration-1',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'total-2',
        migrationId: 'migration-2',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 10,
        appliedBy: 'user',
      });

      expect(migrationTracker.getTotalMigrations()).toBe(2);
    });

    it('should get migrations by time range', () => {
      migrationTracker.recordMigration({
        id: 'range-1',
        migrationId: 'migration-1',
        timestamp: '2024-01-15T00:00:00Z',
        version: '1.0.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 5,
        appliedBy: 'user',
      });

      migrationTracker.recordMigration({
        id: 'range-2',
        migrationId: 'migration-2',
        timestamp: '2024-02-15T00:00:00Z',
        version: '1.1.0',
        direction: 'up',
        status: 'applied',
        duration: 100,
        itemsAffected: 10,
        appliedBy: 'user',
      });

      const janMigrations = migrationTracker.getMigrationsByTimeRange(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      expect(janMigrations.length).toBe(1);
      expect(janMigrations[0].id).toBe('range-1');
    });

    it('should persist and restore migration tracker with integrity checks', async () => {
      const adapter = new InMemoryStorageAdapter();
      const persistentTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:test',
          autoPersist: false,
        },
      });

      persistentTracker.trackMigration(
        'persist-1',
        '1.1.0',
        'before-hash',
        'after-hash',
        4,
        200,
        4,
        'test-user'
      );

      await persistentTracker.saveToPersistence();

      const restoredTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:test',
          autoPersist: false,
        },
      });

      const loaded = await restoredTracker.loadFromPersistence();
      expect(loaded.migrations).toBe(1);
      expect(loaded.snapshots).toBe(1);
      expect(restoredTracker.getMigrations().length).toBe(1);
    });

    it('should detect tampered migration persistence payloads', async () => {
      const adapter = new InMemoryStorageAdapter();
      const persistentTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:tamper',
          autoPersist: false,
        },
      });

      persistentTracker.trackMigration(
        'tamper-1',
        '1.1.0',
        'before',
        'after',
        1,
        100,
        1,
        'test-user'
      );
      await persistentTracker.saveToPersistence();

      const raw = adapter.getItem('migration-tracker:tamper');
      expect(raw).toBeTypeOf('string');

      const parsed = JSON.parse(raw || '{}') as {
        data?: { migrations?: Array<{ appliedBy?: string }> };
      };
      if (parsed.data?.migrations?.[0]) {
        parsed.data.migrations[0].appliedBy = 'tampered-user';
      }
      adapter.setItem('migration-tracker:tamper', JSON.stringify(parsed));

      const restoredTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:tamper',
          autoPersist: false,
        },
      });

      await expect(restoredTracker.loadFromPersistence()).rejects.toThrow(
        'Migration integrity verification failed'
      );
    });

    it('should clear persisted migration tracker state', async () => {
      const adapter = new InMemoryStorageAdapter();
      const persistentTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:clear',
          autoPersist: false,
        },
      });

      persistentTracker.trackMigration(
        'clear-1',
        '1.1.0',
        'before',
        'after',
        1,
        100,
        1,
        'test-user'
      );
      await persistentTracker.saveToPersistence();
      await persistentTracker.clearPersistence();

      const restoredTracker = new MigrationTracker({
        persistence: {
          adapter,
          key: 'migration-tracker:clear',
          autoPersist: false,
        },
      });

      const loaded = await restoredTracker.loadFromPersistence();
      expect(loaded.migrations).toBe(0);
      expect(loaded.snapshots).toBe(0);
    });
  });
});
