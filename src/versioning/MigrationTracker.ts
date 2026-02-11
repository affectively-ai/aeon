/**
 * Migration Tracker
 *
 * Tracks migration history and enables rollback.
 * Maintains detailed audit trail of all schema changes.
 *
 * Features:
 * - Migration history tracking
 * - Rollback path calculation
 * - Data snapshots for recovery
 * - Audit trail with timestamps
 * - Migration dependency tracking
 */

import { logger } from '../utils/logger';

export interface MigrationRecord {
  id: string;
  migrationId: string;
  timestamp: string;
  version: string;
  direction: 'up' | 'down';
  status: 'pending' | 'applied' | 'failed' | 'rolled-back';
  duration: number;
  itemsAffected: number;
  dataSnapshot?: {
    beforeHash: string;
    afterHash: string;
    itemCount: number;
  };
  errorMessage?: string;
  appliedBy: string;
  metadata?: Record<string, unknown>;
}

export interface RollbackPath {
  path: string[];
  canRollback: boolean;
  affectedVersions: string[];
  estimatedDuration: number;
}

/**
 * Migration Tracker
 * Tracks and manages migration history with rollback support
 */
export class MigrationTracker {
  private migrations: MigrationRecord[] = [];
  private snapshots: Map<
    string,
    { beforeHash: string; afterHash: string; itemCount: number }
  > = new Map();

  /**
   * Track a new migration
   */
  recordMigration(record: MigrationRecord): void {
    this.migrations.push({ ...record });

    logger.debug('[MigrationTracker] Migration recorded', {
      id: record.id,
      migrationId: record.migrationId,
      version: record.version,
      status: record.status,
    });
  }

  /**
   * Track migration with snapshot
   */
  trackMigration(
    migrationId: string,
    version: string,
    beforeHash: string,
    afterHash: string,
    itemCount: number,
    duration: number,
    itemsAffected: number,
    appliedBy: string = 'system',
  ): void {
    const record: MigrationRecord = {
      id: `${migrationId}-${Date.now()}`,
      migrationId,
      timestamp: new Date().toISOString(),
      version,
      direction: 'up',
      status: 'applied',
      duration,
      itemsAffected,
      dataSnapshot: {
        beforeHash,
        afterHash,
        itemCount,
      },
      appliedBy,
    };

    this.recordMigration(record);
    this.snapshots.set(record.id, {
      beforeHash,
      afterHash,
      itemCount,
    });
  }

  /**
   * Get all migration records
   */
  getMigrations(): MigrationRecord[] {
    return this.migrations.map((m) => ({ ...m }));
  }

  /**
   * Get migrations for a specific version
   */
  getMigrationsForVersion(version: string): MigrationRecord[] {
    return this.migrations.filter((m) => m.version === version);
  }

  /**
   * Get migration by ID
   */
  getMigration(id: string): MigrationRecord | undefined {
    return this.migrations.find((m) => m.id === id);
  }

  /**
   * Check if can rollback
   */
  canRollback(fromVersion: string, toVersion: string): boolean {
    // Find all migrations from fromVersion going down to toVersion
    const fromIndex = this.migrations.findIndex(
      (m) => m.version === fromVersion,
    );
    const toIndex = this.migrations.findIndex((m) => m.version === toVersion);

    if (fromIndex === -1 || toIndex === -1) {
      return false;
    }

    if (toIndex >= fromIndex) {
      return false;
    }

    // Check all migrations in between have rollback support (dataSnapshot)
    for (let i = fromIndex; i > toIndex; i--) {
      if (!this.migrations[i]?.dataSnapshot) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get rollback path
   */
  getRollbackPath(fromVersion: string, toVersion: string): RollbackPath {
    const canRollback = this.canRollback(fromVersion, toVersion);
    const path: string[] = [];
    const affectedVersions: string[] = [];
    let estimatedDuration = 0;

    if (canRollback) {
      const fromIndex = this.migrations.findIndex(
        (m) => m.version === fromVersion,
      );
      const toIndex = this.migrations.findIndex((m) => m.version === toVersion);

      for (let i = fromIndex; i > toIndex; i--) {
        const migration = this.migrations[i];
        if (migration) {
          path.push(migration.migrationId);
          affectedVersions.push(migration.version);
          estimatedDuration += migration.duration;
        }
      }
    }

    return {
      path,
      canRollback,
      affectedVersions,
      estimatedDuration,
    };
  }

  /**
   * Get applied migrations
   */
  getAppliedMigrations(): MigrationRecord[] {
    return this.migrations.filter((m) => m.status === 'applied');
  }

  /**
   * Get failed migrations
   */
  getFailedMigrations(): MigrationRecord[] {
    return this.migrations.filter((m) => m.status === 'failed');
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): MigrationRecord[] {
    return this.migrations.filter((m) => m.status === 'pending');
  }

  /**
   * Get latest migration
   */
  getLatestMigration(): MigrationRecord | undefined {
    return this.migrations[this.migrations.length - 1];
  }

  /**
   * Get migration timeline
   */
  getTimeline(): Array<{ timestamp: string; version: string; status: string }> {
    return this.migrations.map((m) => ({
      timestamp: m.timestamp,
      version: m.version,
      status: m.status,
    }));
  }

  /**
   * Get migration statistics
   */
  getStatistics() {
    const applied = this.migrations.filter(
      (m) => m.status === 'applied',
    ).length;
    const failed = this.migrations.filter((m) => m.status === 'failed').length;
    const pending = this.migrations.filter(
      (m) => m.status === 'pending',
    ).length;
    const rolledBack = this.migrations.filter(
      (m) => m.status === 'rolled-back',
    ).length;

    const totalDuration = this.migrations.reduce(
      (sum, m) => sum + m.duration,
      0,
    );
    const totalAffected = this.migrations.reduce(
      (sum, m) => sum + m.itemsAffected,
      0,
    );

    return {
      total: this.migrations.length,
      applied,
      failed,
      pending,
      rolledBack,
      successRate:
        this.migrations.length > 0
          ? (applied / this.migrations.length) * 100
          : 0,
      totalDurationMs: totalDuration,
      averageDurationMs:
        this.migrations.length > 0 ? totalDuration / this.migrations.length : 0,
      totalItemsAffected: totalAffected,
    };
  }

  /**
   * Get audit trail
   */
  getAuditTrail(migrationId?: string) {
    const filtered = migrationId
      ? this.migrations.filter((m) => m.migrationId === migrationId)
      : this.migrations;

    return filtered.map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      migrationId: m.migrationId,
      version: m.version,
      status: m.status,
      appliedBy: m.appliedBy,
      duration: m.duration,
      itemsAffected: m.itemsAffected,
      error: m.errorMessage,
    }));
  }

  /**
   * Get data snapshot for recovery
   */
  getSnapshot(recordId: string) {
    return this.snapshots.get(recordId);
  }

  /**
   * Update migration status
   */
  updateMigrationStatus(
    recordId: string,
    status: MigrationRecord['status'],
    error?: string,
  ): void {
    const migration = this.migrations.find((m) => m.id === recordId);
    if (migration) {
      migration.status = status;
      if (error) {
        migration.errorMessage = error;
      }

      logger.debug('[MigrationTracker] Migration status updated', {
        recordId,
        status,
        hasError: !!error,
      });
    }
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.migrations = [];
    this.snapshots.clear();
  }

  /**
   * Get total migrations tracked
   */
  getTotalMigrations(): number {
    return this.migrations.length;
  }

  /**
   * Find migrations by time range
   */
  getMigrationsByTimeRange(
    startTime: string,
    endTime: string,
  ): MigrationRecord[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return this.migrations.filter((m) => {
      const time = new Date(m.timestamp).getTime();
      return time >= start && time <= end;
    });
  }
}
