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
import type { PersistenceDeserializer, PersistenceSerializer, StorageAdapter } from '../persistence';
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
export declare class MigrationTracker {
    private static readonly DEFAULT_PERSIST_KEY;
    private static readonly INTEGRITY_ROOT;
    private migrations;
    private snapshots;
    private persistence;
    private persistTimer;
    private persistInFlight;
    private persistPending;
    constructor(options?: MigrationTrackerOptions);
    /**
     * Track a new migration
     */
    recordMigration(record: MigrationRecord): void;
    /**
     * Track migration with snapshot
     */
    trackMigration(migrationId: string, version: string, beforeHash: string, afterHash: string, itemCount: number, duration: number, itemsAffected: number, appliedBy?: string): void;
    /**
     * Get all migration records
     */
    getMigrations(): MigrationRecord[];
    /**
     * Get migrations for a specific version
     */
    getMigrationsForVersion(version: string): MigrationRecord[];
    /**
     * Get migration by ID
     */
    getMigration(id: string): MigrationRecord | undefined;
    /**
     * Check if can rollback
     */
    canRollback(fromVersion: string, toVersion: string): boolean;
    /**
     * Get rollback path
     */
    getRollbackPath(fromVersion: string, toVersion: string): RollbackPath;
    /**
     * Get applied migrations
     */
    getAppliedMigrations(): MigrationRecord[];
    /**
     * Get failed migrations
     */
    getFailedMigrations(): MigrationRecord[];
    /**
     * Get pending migrations
     */
    getPendingMigrations(): MigrationRecord[];
    /**
     * Get latest migration
     */
    getLatestMigration(): MigrationRecord | undefined;
    /**
     * Get migration timeline
     */
    getTimeline(): Array<{
        timestamp: string;
        version: string;
        status: string;
    }>;
    /**
     * Get migration statistics
     */
    getStatistics(): {
        total: number;
        applied: number;
        failed: number;
        pending: number;
        rolledBack: number;
        successRate: number;
        totalDurationMs: number;
        averageDurationMs: number;
        totalItemsAffected: number;
    };
    /**
     * Get audit trail
     */
    getAuditTrail(migrationId?: string): {
        id: string;
        timestamp: string;
        migrationId: string;
        version: string;
        status: "pending" | "failed" | "applied" | "rolled-back";
        appliedBy: string;
        duration: number;
        itemsAffected: number;
        error: string | undefined;
    }[];
    /**
     * Get data snapshot for recovery
     */
    getSnapshot(recordId: string): {
        beforeHash: string;
        afterHash: string;
        itemCount: number;
    } | undefined;
    /**
     * Update migration status
     */
    updateMigrationStatus(recordId: string, status: MigrationRecord['status'], error?: string): void;
    /**
     * Persist tracker state with integrity chain verification metadata.
     */
    saveToPersistence(): Promise<void>;
    /**
     * Load tracker state and verify integrity chain.
     */
    loadFromPersistence(): Promise<{
        migrations: number;
        snapshots: number;
    }>;
    /**
     * Remove persisted migration tracker state.
     */
    clearPersistence(): Promise<void>;
    /**
     * Clear history (for testing)
     */
    clear(): void;
    /**
     * Get total migrations tracked
     */
    getTotalMigrations(): number;
    /**
     * Find migrations by time range
     */
    getMigrationsByTimeRange(startTime: string, endTime: string): MigrationRecord[];
    private schedulePersist;
    private persistSafely;
    private isValidMigrationRecord;
    private stableStringify;
    private computeDigestHex;
    private toHex;
    private fallbackDigestHex;
}
