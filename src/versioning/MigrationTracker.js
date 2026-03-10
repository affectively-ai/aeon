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
/**
 * Migration Tracker
 * Tracks and manages migration history with rollback support
 */
export class MigrationTracker {
    static DEFAULT_PERSIST_KEY = 'aeon:migration-tracker:v1';
    static INTEGRITY_ROOT = 'aeon:migration-integrity-root:v1';
    migrations = [];
    snapshots = new Map();
    persistence = null;
    persistTimer = null;
    persistInFlight = false;
    persistPending = false;
    constructor(options) {
        if (options?.persistence) {
            this.persistence = {
                ...options.persistence,
                key: options.persistence.key ?? MigrationTracker.DEFAULT_PERSIST_KEY,
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
    recordMigration(record) {
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
    trackMigration(migrationId, version, beforeHash, afterHash, itemCount, duration, itemsAffected, appliedBy = 'system') {
        const record = {
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
    getMigrations() {
        return this.migrations.map((m) => ({ ...m }));
    }
    /**
     * Get migrations for a specific version
     */
    getMigrationsForVersion(version) {
        return this.migrations.filter((m) => m.version === version);
    }
    /**
     * Get migration by ID
     */
    getMigration(id) {
        return this.migrations.find((m) => m.id === id);
    }
    /**
     * Check if can rollback
     */
    canRollback(fromVersion, toVersion) {
        // Find all migrations from fromVersion going down to toVersion
        const fromIndex = this.migrations.findIndex((m) => m.version === fromVersion);
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
    getRollbackPath(fromVersion, toVersion) {
        const canRollback = this.canRollback(fromVersion, toVersion);
        const path = [];
        const affectedVersions = [];
        let estimatedDuration = 0;
        if (canRollback) {
            const fromIndex = this.migrations.findIndex((m) => m.version === fromVersion);
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
    getAppliedMigrations() {
        return this.migrations.filter((m) => m.status === 'applied');
    }
    /**
     * Get failed migrations
     */
    getFailedMigrations() {
        return this.migrations.filter((m) => m.status === 'failed');
    }
    /**
     * Get pending migrations
     */
    getPendingMigrations() {
        return this.migrations.filter((m) => m.status === 'pending');
    }
    /**
     * Get latest migration
     */
    getLatestMigration() {
        return this.migrations[this.migrations.length - 1];
    }
    /**
     * Get migration timeline
     */
    getTimeline() {
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
        const applied = this.migrations.filter((m) => m.status === 'applied').length;
        const failed = this.migrations.filter((m) => m.status === 'failed').length;
        const pending = this.migrations.filter((m) => m.status === 'pending').length;
        const rolledBack = this.migrations.filter((m) => m.status === 'rolled-back').length;
        const totalDuration = this.migrations.reduce((sum, m) => sum + m.duration, 0);
        const totalAffected = this.migrations.reduce((sum, m) => sum + m.itemsAffected, 0);
        return {
            total: this.migrations.length,
            applied,
            failed,
            pending,
            rolledBack,
            successRate: this.migrations.length > 0
                ? (applied / this.migrations.length) * 100
                : 0,
            totalDurationMs: totalDuration,
            averageDurationMs: this.migrations.length > 0 ? totalDuration / this.migrations.length : 0,
            totalItemsAffected: totalAffected,
        };
    }
    /**
     * Get audit trail
     */
    getAuditTrail(migrationId) {
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
    getSnapshot(recordId) {
        return this.snapshots.get(recordId);
    }
    /**
     * Update migration status
     */
    updateMigrationStatus(recordId, status, error) {
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
    async saveToPersistence() {
        if (!this.persistence) {
            return;
        }
        const normalizedMigrations = this.migrations.map((migration) => ({
            ...migration,
            previousHash: undefined,
            integrityHash: undefined,
        }));
        const integrityEntries = [];
        let previousHash = MigrationTracker.INTEGRITY_ROOT;
        for (const migration of normalizedMigrations) {
            const hash = await this.computeDigestHex(`${previousHash}|${this.stableStringify(migration)}`);
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
        const data = {
            migrations: persistedMigrations,
            snapshots: Array.from(this.snapshots.entries()).map(([recordId, snapshot]) => ({
                recordId,
                beforeHash: snapshot.beforeHash,
                afterHash: snapshot.afterHash,
                itemCount: snapshot.itemCount,
            })),
            integrity: {
                algorithm: 'sha256-chain-v1',
                entries: integrityEntries,
                rootHash: previousHash,
            },
        };
        const envelope = {
            version: 1,
            updatedAt: Date.now(),
            data,
        };
        const serialize = this.persistence.serializer ??
            ((value) => JSON.stringify(value));
        await this.persistence.adapter.setItem(this.persistence.key, serialize(envelope));
    }
    /**
     * Load tracker state and verify integrity chain.
     */
    async loadFromPersistence() {
        if (!this.persistence) {
            return { migrations: 0, snapshots: 0 };
        }
        const raw = await this.persistence.adapter.getItem(this.persistence.key);
        if (!raw) {
            return { migrations: 0, snapshots: 0 };
        }
        const deserialize = this.persistence.deserializer ??
            ((value) => JSON.parse(value));
        const envelope = deserialize(raw);
        if (envelope.version !== 1 || !envelope.data) {
            throw new Error('Invalid migration tracker persistence payload');
        }
        if (!Array.isArray(envelope.data.migrations) ||
            !Array.isArray(envelope.data.snapshots) ||
            !envelope.data.integrity ||
            !Array.isArray(envelope.data.integrity.entries) ||
            typeof envelope.data.integrity.rootHash !== 'string') {
            throw new Error('Invalid migration tracker persistence structure');
        }
        if (envelope.data.integrity.algorithm !== 'sha256-chain-v1') {
            throw new Error('Unsupported migration integrity algorithm');
        }
        if (envelope.data.integrity.entries.length !== envelope.data.migrations.length) {
            throw new Error('Migration integrity entry count mismatch');
        }
        const validatedMigrations = [];
        let previousHash = MigrationTracker.INTEGRITY_ROOT;
        for (let i = 0; i < envelope.data.migrations.length; i++) {
            const migration = envelope.data.migrations[i];
            const integrity = envelope.data.integrity.entries[i];
            if (!this.isValidMigrationRecord(migration)) {
                throw new Error('Invalid persisted migration record');
            }
            if (!integrity ||
                integrity.recordId !== migration.id ||
                integrity.previousHash !== previousHash) {
                throw new Error('Migration integrity chain mismatch');
            }
            const expectedHash = await this.computeDigestHex(`${previousHash}|${this.stableStringify({
                ...migration,
                previousHash: undefined,
                integrityHash: undefined,
            })}`);
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
        const validatedSnapshots = new Map();
        for (const snapshot of envelope.data.snapshots) {
            if (typeof snapshot.recordId !== 'string' ||
                typeof snapshot.beforeHash !== 'string' ||
                typeof snapshot.afterHash !== 'string' ||
                typeof snapshot.itemCount !== 'number') {
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
        return {
            migrations: this.migrations.length,
            snapshots: this.snapshots.size,
        };
    }
    /**
     * Remove persisted migration tracker state.
     */
    async clearPersistence() {
        if (!this.persistence) {
            return;
        }
        await this.persistence.adapter.removeItem(this.persistence.key);
    }
    /**
     * Clear history (for testing)
     */
    clear() {
        this.migrations = [];
        this.snapshots.clear();
        this.schedulePersist();
    }
    /**
     * Get total migrations tracked
     */
    getTotalMigrations() {
        return this.migrations.length;
    }
    /**
     * Find migrations by time range
     */
    getMigrationsByTimeRange(startTime, endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        return this.migrations.filter((m) => {
            const time = new Date(m.timestamp).getTime();
            return time >= start && time <= end;
        });
    }
    schedulePersist() {
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
    async persistSafely() {
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
        }
        catch (error) {
            logger.error('[MigrationTracker] Persistence write failed', {
                key: this.persistence.key,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.persistInFlight = false;
            const shouldRunAgain = this.persistPending;
            this.persistPending = false;
            if (shouldRunAgain) {
                void this.persistSafely();
            }
        }
    }
    isValidMigrationRecord(value) {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const record = value;
        const validDirection = record.direction === 'up' || record.direction === 'down';
        const validStatus = record.status === 'pending' ||
            record.status === 'applied' ||
            record.status === 'failed' ||
            record.status === 'rolled-back';
        return (typeof record.id === 'string' &&
            typeof record.migrationId === 'string' &&
            typeof record.timestamp === 'string' &&
            typeof record.version === 'string' &&
            validDirection &&
            validStatus &&
            typeof record.duration === 'number' &&
            typeof record.itemsAffected === 'number' &&
            typeof record.appliedBy === 'string');
    }
    stableStringify(value) {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
        }
        const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
        return `{${entries
            .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`)
            .join(',')}}`;
    }
    async computeDigestHex(value) {
        if (globalThis.crypto?.subtle) {
            const bytes = new TextEncoder().encode(value);
            const normalized = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            const digest = await globalThis.crypto.subtle.digest('SHA-256', normalized);
            return this.toHex(new Uint8Array(digest));
        }
        return this.fallbackDigestHex(value);
    }
    toHex(bytes) {
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }
    fallbackDigestHex(value) {
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
