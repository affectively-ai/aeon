/**
 * Schema Version Manager
 *
 * Manages schema versioning across the application.
 * Tracks version history, compatibility, and migration paths.
 *
 * Features:
 * - Version tracking and comparison
 * - Compatibility matrix management
 * - Migration path calculation
 * - Version validation
 */
export interface SchemaVersion {
    major: number;
    minor: number;
    patch: number;
    timestamp: string;
    description: string;
    breaking: boolean;
}
export interface VersionMetadata {
    version: SchemaVersion;
    previousVersion?: SchemaVersion;
    changes: string[];
    migrationsRequired: string[];
    rollbackPossible: boolean;
}
export interface CompatibilityRule {
    from: string;
    to: string;
    compatible: boolean;
    requiresMigration: boolean;
    migrationSteps: number;
}
/**
 * Schema Version Manager
 * Tracks and manages schema versions across the application
 */
export declare class SchemaVersionManager {
    private versions;
    private versionHistory;
    private compatibilityMatrix;
    private currentVersion;
    constructor();
    /**
     * Initialize default versions
     */
    private initializeDefaultVersions;
    /**
     * Register a new schema version
     */
    registerVersion(version: SchemaVersion): void;
    /**
     * Get current version
     */
    getCurrentVersion(): SchemaVersion;
    /**
     * Set current version
     */
    setCurrentVersion(version: SchemaVersion): void;
    /**
     * Get version history
     */
    getVersionHistory(): SchemaVersion[];
    /**
     * Check if version exists
     */
    hasVersion(version: SchemaVersion): boolean;
    /**
     * Get version by string (e.g., "1.2.3")
     */
    getVersion(versionString: string): SchemaVersion | undefined;
    /**
     * Register compatibility rule
     */
    registerCompatibility(rule: CompatibilityRule): void;
    /**
     * Check if migration path exists
     */
    canMigrate(fromVersion: SchemaVersion | string, toVersion: SchemaVersion | string): boolean;
    /**
     * Get migration path
     */
    getMigrationPath(fromVersion: SchemaVersion, toVersion: SchemaVersion): SchemaVersion[];
    /**
     * Compare two versions
     * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
     */
    compareVersions(v1: SchemaVersion | string, v2: SchemaVersion | string): number;
    /**
     * Parse version string to SchemaVersion
     */
    parseVersion(versionString: string): SchemaVersion;
    /**
     * Create new version
     */
    createVersion(major: number, minor: number, patch: number, description: string, breaking?: boolean): SchemaVersion;
    /**
     * Convert version to string
     */
    versionToString(version: SchemaVersion): string;
    /**
     * Get version metadata
     */
    getVersionMetadata(version: SchemaVersion): VersionMetadata;
    /**
     * Get all registered versions
     */
    getAllVersions(): SchemaVersion[];
    /**
     * Clear all versions (for testing)
     */
    clear(): void;
}
