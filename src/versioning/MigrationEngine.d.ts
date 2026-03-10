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
export interface Migration {
    id: string;
    version: string;
    name: string;
    up: (data: unknown) => unknown;
    down?: (data: unknown) => unknown;
    timestamp: string;
    description: string;
}
export interface MigrationResult {
    migrationId: string;
    success: boolean;
    timestamp: string;
    duration: number;
    itemsAffected: number;
    errors: string[];
}
export interface MigrationState {
    currentVersion: string;
    appliedMigrations: string[];
    failedMigrations: string[];
    lastMigrationTime: string;
    totalMigrationsRun: number;
}
/**
 * Migration Engine
 * Executes and manages schema migrations
 */
export declare class MigrationEngine {
    private migrations;
    private executedMigrations;
    private state;
    /**
     * Register a migration
     */
    registerMigration(migration: Migration): void;
    /**
     * Execute a migration
     */
    executeMigration(migrationId: string, data: unknown): Promise<MigrationResult>;
    /**
     * Rollback a migration
     */
    rollbackMigration(migrationId: string, data: unknown): Promise<MigrationResult>;
    /**
     * Get migration state
     */
    getState(): MigrationState;
    /**
     * Get migration execution history
     */
    getExecutionHistory(): MigrationResult[];
    /**
     * Get migration by ID
     */
    getMigration(migrationId: string): Migration | undefined;
    /**
     * Get all registered migrations
     */
    getAllMigrations(): Migration[];
    /**
     * Get applied migrations
     */
    getAppliedMigrations(): string[];
    /**
     * Get failed migrations
     */
    getFailedMigrations(): string[];
    /**
     * Get pending migrations
     */
    getPendingMigrations(): Migration[];
    /**
     * Get migration statistics
     */
    getStatistics(): {
        totalExecuted: number;
        successful: number;
        failed: number;
        successRate: number;
        totalDurationMs: number;
        averageDurationMs: number;
        totalAffected: number;
    };
    /**
     * Clear history (for testing)
     */
    clear(): void;
}
