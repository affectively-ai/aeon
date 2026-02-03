import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaVersionManager } from '../../versioning/SchemaVersionManager';
import { MigrationEngine, type Migration } from '../../versioning/MigrationEngine';
import { DataTransformer } from '../../versioning/DataTransformer';
import { MigrationTracker } from '../../versioning/MigrationTracker';

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
      versionManager.registerVersion(versionManager.createVersion(1, 1, 0, 'V1.1', false));
      versionManager.registerVersion(versionManager.createVersion(2, 0, 0, 'V2', true));

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
      versionManager.registerVersion(versionManager.createVersion(1, 0, 1, 'V1.0.1', false));

      versionManager.registerCompatibility({
        from: '1.0.0',
        to: '1.0.1',
        compatible: true,
        requiresMigration: true,
        migrationSteps: 1,
      });

      expect(versionManager.canMigrate('1.0.0', '1.0.1')).toBe(true);
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
      const result = await migrationEngine.executeMigration('up-migration-1', testData);

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
      const result = await migrationEngine.rollbackMigration('rollback-migration-1', testData);

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
        migrationEngine.executeMigration('fail-migration-1', {}),
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
  });

  describe('DataTransformer', () => {
    it('should register a transformation rule', () => {
      dataTransformer.registerRule({
        field: 'email',
        transformer: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value),
      });

      const rule = dataTransformer.getRule('email');
      expect(rule).toBeDefined();
      expect(rule?.field).toBe('email');
    });

    it('should transform a single field', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) => (value === 'pending' ? 'active' : value),
      });

      const transformed = dataTransformer.transformField('status', 'pending');
      expect(transformed).toBe('active');
    });

    it('should transform an object with multiple fields', () => {
      dataTransformer.registerRule({
        field: 'email',
        transformer: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value),
      });

      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) => (value === 'pending' ? 'active' : value),
      });

      const original = { email: 'TEST@EXAMPLE.COM', status: 'pending' };
      const transformed = dataTransformer.transformObject(original);

      expect(transformed.email).toBe('test@example.com');
      expect(transformed.status).toBe('active');
    });

    it('should transform a collection of items', () => {
      dataTransformer.registerRule({
        field: 'status',
        transformer: (value: unknown) => (value === 'pending' ? 'active' : value),
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
        'test-user',
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
  });
});
