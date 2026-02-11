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
import type {
  PersistedEnvelope,
  PersistenceDeserializer,
  PersistenceSerializer,
  StorageAdapter,
} from '../persistence';

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
  previousHash?: string;
  integrityHash?: string;
}

export interface RollbackPath {
  path: string[];
  canRollback: boolean;
  affectedVersions: string[];
  estimatedDuration: number;
}

export interface MigrationIntegrityEntry {
  recordId: string;
  previousHash: string;
  hash: string;
}

export interface MigrationTrackerPersistenceData {
  migrations: MigrationRecord[];
  snapshots: Array<{
    recordId: string;
    beforeHash: string;
    afterHash: string;
    itemCount: number;
  }>;
  integrity: {
    algorithm: 'sha256-chain-v1';
    entries: MigrationIntegrityEntry[];
    rootHash: string;
  };
}

export interface MigrationTrackerPersistenceConfig {
  adapter: StorageAdapter;
  key?: string;
  autoPersist?: boolean;
  autoLoad?: boolean;
  persistDebounceMs?: number;
  serializer?: PersistenceSerializer<MigrationTrackerPersistenceData>;
  deserializer?: PersistenceDeserializer<MigrationTrackerPersistenceData>;
}

export interface MigrationTrackerOptions {
  persistence?: MigrationTrackerPersistenceConfig;
}

/**
 * Migration Tracker
 * Tracks and manages migration history with rollback support
 */
export class MigrationTracker {
  private static readonly DEFAULT_PERSIST_KEY = 'aeon:migration-tracker:v1';
  private static readonly INTEGRITY_ROOT = 'aeon:migration-integrity-root:v1';
  private migrations: MigrationRecord[] = [];
  private snapshots: Map<
    string,
    { beforeHash: string; afterHash: string; itemCount: number }
  > = new Map();
  private persistence:
    | (MigrationTrackerPersistenceConfig & { key: string })
    | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private persistPending = false;

  constructor(options?: MigrationTrackerOptions) {
    if (options?.persistence) {
      this.persistence = {
        ...options.persistence,
        key:
          options.persistence.key ?? MigrationTracker.DEFAULT_PERSIST_KEY,
        autoPersist: options.persistence.autoPersist ?? true,
        autoLoad: options.persistence.autoLoad ?? false,
        persistDebounceMs: options.persistence.persistDebounceMs ?? 25,
      };
    }

    if (this.persistence?.autoLoad) {
      void this.loadFromPersistence().catch((error) => {
        logger.error('[MigrationTracker] Failed to load persistence', {
          key: this.persistence?.key,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Track a new migration
   */
  recordMigration(record: MigrationRecord): void {
    this.migrations.push({ ...record });
    this.schedulePersist();

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
      this.schedulePersist();
    }
  }

  /**
   * Persist tracker state with integrity chain verification metadata.
   */
  async saveToPersistence(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    const normalizedMigrations = this.migrations.map((migration) => ({
      ...migration,
      previousHash: undefined,
      integrityHash: undefined,
    }));

    const integrityEntries: MigrationIntegrityEntry[] = [];
    let previousHash = MigrationTracker.INTEGRITY_ROOT;

    for (const migration of normalizedMigrations) {
      const hash = await this.computeDigestHex(
        `${previousHash}|${this.stableStringify(migration)}`,
      );
      integrityEntries.push({
        recordId: migration.id,
        previousHash,
        hash,
      });
      previousHash = hash;
    }

    const persistedMigrations = normalizedMigrations.map((migration, index) => ({
      ...migration,
      previousHash: integrityEntries[index]?.previousHash,
      integrityHash: integrityEntries[index]?.hash,
    }));

    const data: MigrationTrackerPersistenceData = {
      migrations: persistedMigrations,
      snapshots: Array.from(this.snapshots.entries()).map(
        ([recordId, snapshot]) => ({
          recordId,
          beforeHash: snapshot.beforeHash,
          afterHash: snapshot.afterHash,
          itemCount: snapshot.itemCount,
        }),
      ),
      integrity: {
        algorithm: 'sha256-chain-v1',
        entries: integrityEntries,
        rootHash: previousHash,
      },
    };

    const envelope: PersistedEnvelope<MigrationTrackerPersistenceData> = {
      version: 1,
      updatedAt: Date.now(),
      data,
    };

    const serialize =
      this.persistence.serializer ??
      ((value: PersistedEnvelope<MigrationTrackerPersistenceData>) =>
        JSON.stringify(value));

    await this.persistence.adapter.setItem(this.persistence.key, serialize(envelope));
  }

  /**
   * Load tracker state and verify integrity chain.
   */
  async loadFromPersistence(): Promise<{
    migrations: number;
    snapshots: number;
  }> {
    if (!this.persistence) {
      return { migrations: 0, snapshots: 0 };
    }

    const raw = await this.persistence.adapter.getItem(this.persistence.key);
    if (!raw) {
      return { migrations: 0, snapshots: 0 };
    }

    const deserialize =
      this.persistence.deserializer ??
      ((value: string) =>
        JSON.parse(value) as PersistedEnvelope<MigrationTrackerPersistenceData>);

    const envelope = deserialize(raw);
    if (envelope.version !== 1 || !envelope.data) {
      throw new Error('Invalid migration tracker persistence payload');
    }

    if (envelope.data.integrity.algorithm !== 'sha256-chain-v1') {
      throw new Error('Unsupported migration integrity algorithm');
    }

    if (
      envelope.data.integrity.entries.length !== envelope.data.migrations.length
    ) {
      throw new Error('Migration integrity entry count mismatch');
    }

    const validatedMigrations: MigrationRecord[] = [];
    let previousHash = MigrationTracker.INTEGRITY_ROOT;

    for (let i = 0; i < envelope.data.migrations.length; i++) {
      const migration = envelope.data.migrations[i];
      const integrity = envelope.data.integrity.entries[i];

      if (!this.isValidMigrationRecord(migration)) {
        throw new Error('Invalid persisted migration record');
      }
      if (
        !integrity ||
        integrity.recordId !== migration.id ||
        integrity.previousHash !== previousHash
      ) {
        throw new Error('Migration integrity chain mismatch');
      }

      const expectedHash = await this.computeDigestHex(
        `${previousHash}|${this.stableStringify({
          ...migration,
          previousHash: undefined,
          integrityHash: undefined,
        })}`,
      );

      if (expectedHash !== integrity.hash) {
        throw new Error('Migration integrity verification failed');
      }

      validatedMigrations.push({
        ...migration,
        previousHash: integrity.previousHash,
        integrityHash: integrity.hash,
      });

      previousHash = expectedHash;
    }

    if (previousHash !== envelope.data.integrity.rootHash) {
      throw new Error('Migration integrity root hash mismatch');
    }

    const validatedSnapshots = new Map<
      string,
      { beforeHash: string; afterHash: string; itemCount: number }
    >();

    for (const snapshot of envelope.data.snapshots) {
      if (
        typeof snapshot.recordId !== 'string' ||
        typeof snapshot.beforeHash !== 'string' ||
        typeof snapshot.afterHash !== 'string' ||
        typeof snapshot.itemCount !== 'number'
      ) {
        throw new Error('Invalid persisted migration snapshot');
      }

      validatedSnapshots.set(snapshot.recordId, {
        beforeHash: snapshot.beforeHash,
        afterHash: snapshot.afterHash,
        itemCount: snapshot.itemCount,
      });
    }

    this.migrations = validatedMigrations;
    this.snapshots = validatedSnapshots;

    logger.debug('[MigrationTracker] Loaded from persistence', {
      key: this.persistence.key,
      migrations: this.migrations.length,
      snapshots: this.snapshots.size,
    });

    return { migrations: this.migrations.length, snapshots: this.snapshots.size };
  }

  /**
   * Remove persisted migration tracker state.
   */
  async clearPersistence(): Promise<void> {
    if (!this.persistence) {
      return;
    }
    await this.persistence.adapter.removeItem(this.persistence.key);
  }

  /**
   * Clear history (for testing)
   */
  clear(): void {
    this.migrations = [];
    this.snapshots.clear();
    this.schedulePersist();
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

  private schedulePersist(): void {
    if (!this.persistence || this.persistence.autoPersist === false) {
      return;
    }

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      void this.persistSafely();
    }, this.persistence.persistDebounceMs ?? 25);
  }

  private async persistSafely(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    if (this.persistInFlight) {
      this.persistPending = true;
      return;
    }

    this.persistInFlight = true;
    try {
      await this.saveToPersistence();
    } catch (error) {
      logger.error('[MigrationTracker] Persistence write failed', {
        key: this.persistence.key,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.persistInFlight = false;
      const shouldRunAgain = this.persistPending;
      this.persistPending = false;
      if (shouldRunAgain) {
        void this.persistSafely();
      }
    }
  }

  private isValidMigrationRecord(value: unknown): value is MigrationRecord {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const record = value as Partial<MigrationRecord>;
    const validDirection = record.direction === 'up' || record.direction === 'down';
    const validStatus =
      record.status === 'pending' ||
      record.status === 'applied' ||
      record.status === 'failed' ||
      record.status === 'rolled-back';
    return (
      typeof record.id === 'string' &&
      typeof record.migrationId === 'string' &&
      typeof record.timestamp === 'string' &&
      typeof record.version === 'string' &&
      validDirection &&
      validStatus &&
      typeof record.duration === 'number' &&
      typeof record.itemsAffected === 'number' &&
      typeof record.appliedBy === 'string'
    );
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );

    return `{${entries
      .map(([key, entryValue]) =>
        `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }

  private async computeDigestHex(value: string): Promise<string> {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(value);
      const normalized = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        normalized,
      );
      return this.toHex(new Uint8Array(digest));
    }

    return this.fallbackDigestHex(value);
  }

  private toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private fallbackDigestHex(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}
