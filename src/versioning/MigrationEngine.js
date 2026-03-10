/**
 * Migration Engine
 *
 * Executes schema migrations with rollback support.
 * Manages migration execution, error handling, and state management.
 *
 * Features:
 * - Migration execution and tracking
 * - Rollback support
 * - Error handling and recovery
 * - Migration state management
 */
import { logger } from '../utils/logger';
/**
 * Migration Engine
 * Executes and manages schema migrations
 */
export class MigrationEngine {
    migrations = new Map();
    executedMigrations = [];
    state = {
        currentVersion: '1.0.0',
        appliedMigrations: [],
        failedMigrations: [],
        lastMigrationTime: new Date().toISOString(),
        totalMigrationsRun: 0,
    };
    /**
     * Register a migration
     */
    registerMigration(migration) {
        this.migrations.set(migration.id, migration);
        logger.debug('[MigrationEngine] Migration registered', {
            id: migration.id,
            version: migration.version,
            name: migration.name,
        });
    }
    /**
     * Execute a migration
     */
    async executeMigration(migrationId, data) {
        const migration = this.migrations.get(migrationId);
        if (!migration) {
            throw new Error(`Migration ${migrationId} not found`);
        }
        const startTime = Date.now();
        const result = {
            migrationId,
            success: false,
            timestamp: new Date().toISOString(),
            duration: 0,
            itemsAffected: 0,
            errors: [],
        };
        try {
            logger.debug('[MigrationEngine] Executing migration', {
                id: migrationId,
                version: migration.version,
            });
            // Execute up migration
            migration.up(data);
            result.success = true;
            result.itemsAffected = Array.isArray(data)
                ? data.length
                : 1;
            result.duration = Date.now() - startTime;
            // Track as applied
            this.state.appliedMigrations.push(migrationId);
            this.state.currentVersion = migration.version;
            this.state.totalMigrationsRun++;
            this.state.lastMigrationTime = result.timestamp;
            this.executedMigrations.push(result);
            logger.debug('[MigrationEngine] Migration executed successfully', {
                id: migrationId,
                duration: result.duration,
                itemsAffected: result.itemsAffected,
            });
            return result;
        }
        catch (error) {
            result.errors = [error instanceof Error ? error.message : String(error)];
            this.state.failedMigrations.push(migrationId);
            this.executedMigrations.push(result);
            logger.error('[MigrationEngine] Migration failed', {
                id: migrationId,
                error: result.errors[0],
            });
            throw new Error(`Migration ${migrationId} failed: ${result.errors[0]}`);
        }
    }
    /**
     * Rollback a migration
     */
    async rollbackMigration(migrationId, data) {
        const migration = this.migrations.get(migrationId);
        if (!migration) {
            throw new Error(`Migration ${migrationId} not found`);
        }
        if (!migration.down) {
            throw new Error(`Migration ${migrationId} does not support rollback`);
        }
        const startTime = Date.now();
        const result = {
            migrationId,
            success: false,
            timestamp: new Date().toISOString(),
            duration: 0,
            itemsAffected: 0,
            errors: [],
        };
        try {
            logger.debug('[MigrationEngine] Rolling back migration', {
                id: migrationId,
                version: migration.version,
            });
            // Execute down migration
            migration.down(data);
            result.success = true;
            result.itemsAffected = Array.isArray(data)
                ? data.length
                : 1;
            result.duration = Date.now() - startTime;
            // Remove from applied migrations
            this.state.appliedMigrations = this.state.appliedMigrations.filter((id) => id !== migrationId);
            this.executedMigrations.push(result);
            logger.debug('[MigrationEngine] Migration rolled back', {
                id: migrationId,
                duration: result.duration,
            });
            return result;
        }
        catch (error) {
            result.errors = [error instanceof Error ? error.message : String(error)];
            this.executedMigrations.push(result);
            logger.error('[MigrationEngine] Rollback failed', {
                id: migrationId,
                error: result.errors[0],
            });
            throw new Error(`Rollback for ${migrationId} failed: ${result.errors[0]}`);
        }
    }
    /**
     * Get migration state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get migration execution history
     */
    getExecutionHistory() {
        return [...this.executedMigrations];
    }
    /**
     * Get migration by ID
     */
    getMigration(migrationId) {
        return this.migrations.get(migrationId);
    }
    /**
     * Get all registered migrations
     */
    getAllMigrations() {
        return Array.from(this.migrations.values());
    }
    /**
     * Get applied migrations
     */
    getAppliedMigrations() {
        return [...this.state.appliedMigrations];
    }
    /**
     * Get failed migrations
     */
    getFailedMigrations() {
        return [...this.state.failedMigrations];
    }
    /**
     * Get pending migrations
     */
    getPendingMigrations() {
        return this.getAllMigrations().filter((m) => !this.state.appliedMigrations.includes(m.id));
    }
    /**
     * Get migration statistics
     */
    getStatistics() {
        const successful = this.executedMigrations.filter((m) => m.success).length;
        const failed = this.executedMigrations.filter((m) => !m.success).length;
        const totalDuration = this.executedMigrations.reduce((sum, m) => sum + m.duration, 0);
        const totalAffected = this.executedMigrations.reduce((sum, m) => sum + m.itemsAffected, 0);
        return {
            totalExecuted: this.executedMigrations.length,
            successful,
            failed,
            successRate: this.executedMigrations.length > 0
                ? (successful / this.executedMigrations.length) * 100
                : 0,
            totalDurationMs: totalDuration,
            averageDurationMs: this.executedMigrations.length > 0
                ? totalDuration / this.executedMigrations.length
                : 0,
            totalAffected,
        };
    }
    /**
     * Clear history (for testing)
     */
    clear() {
        this.migrations.clear();
        this.executedMigrations = [];
        this.state = {
            currentVersion: '1.0.0',
            appliedMigrations: [],
            failedMigrations: [],
            lastMigrationTime: new Date().toISOString(),
            totalMigrationsRun: 0,
        };
    }
}
