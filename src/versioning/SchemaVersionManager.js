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
import { logger } from '../utils/logger';
/**
 * Schema Version Manager
 * Tracks and manages schema versions across the application
 */
export class SchemaVersionManager {
    versions = new Map();
    versionHistory = [];
    compatibilityMatrix = new Map();
    currentVersion = null;
    constructor() {
        this.initializeDefaultVersions();
    }
    /**
     * Initialize default versions
     */
    initializeDefaultVersions() {
        const v1_0_0 = {
            major: 1,
            minor: 0,
            patch: 0,
            timestamp: new Date().toISOString(),
            description: 'Initial schema version',
            breaking: false,
        };
        this.registerVersion(v1_0_0);
        this.currentVersion = v1_0_0;
    }
    /**
     * Register a new schema version
     */
    registerVersion(version) {
        const versionString = this.versionToString(version);
        this.versions.set(versionString, version);
        this.versionHistory.push(version);
        logger.debug('[SchemaVersionManager] Version registered', {
            version: versionString,
            breaking: version.breaking,
            description: version.description,
        });
    }
    /**
     * Get current version
     */
    getCurrentVersion() {
        if (!this.currentVersion) {
            throw new Error('No current version set');
        }
        return this.currentVersion;
    }
    /**
     * Set current version
     */
    setCurrentVersion(version) {
        if (!this.versions.has(this.versionToString(version))) {
            throw new Error(`Version ${this.versionToString(version)} not registered`);
        }
        this.currentVersion = version;
        logger.debug('[SchemaVersionManager] Current version set', {
            version: this.versionToString(version),
        });
    }
    /**
     * Get version history
     */
    getVersionHistory() {
        return [...this.versionHistory];
    }
    /**
     * Check if version exists
     */
    hasVersion(version) {
        return this.versions.has(this.versionToString(version));
    }
    /**
     * Get version by string (e.g., "1.2.3")
     */
    getVersion(versionString) {
        return this.versions.get(versionString);
    }
    /**
     * Register compatibility rule
     */
    registerCompatibility(rule) {
        if (!this.compatibilityMatrix.has(rule.from)) {
            this.compatibilityMatrix.set(rule.from, []);
        }
        const rules = this.compatibilityMatrix.get(rule.from);
        if (rules) {
            rules.push(rule);
        }
        logger.debug('[SchemaVersionManager] Compatibility rule registered', {
            from: rule.from,
            to: rule.to,
            compatible: rule.compatible,
            requiresMigration: rule.requiresMigration,
        });
    }
    /**
     * Check if migration path exists
     */
    canMigrate(fromVersion, toVersion) {
        const fromStr = typeof fromVersion === 'string'
            ? fromVersion
            : this.versionToString(fromVersion);
        const toStr = typeof toVersion === 'string'
            ? toVersion
            : this.versionToString(toVersion);
        const rules = this.compatibilityMatrix.get(fromStr) || [];
        return rules.some((r) => r.to === toStr && r.requiresMigration);
    }
    /**
     * Get migration path
     */
    getMigrationPath(fromVersion, toVersion) {
        const path = [];
        let current = fromVersion;
        const maxSteps = 100; // Prevent infinite loops
        let steps = 0;
        while (this.compareVersions(current, toVersion) !== 0 && steps < maxSteps) {
            const fromStr = this.versionToString(current);
            const rules = this.compatibilityMatrix.get(fromStr) || [];
            let found = false;
            for (const rule of rules) {
                const nextVersion = this.getVersion(rule.to);
                if (nextVersion) {
                    // Find the closest path to target
                    if (this.compareVersions(nextVersion, toVersion) <= 0 ||
                        this.compareVersions(current, nextVersion) <
                            this.compareVersions(current, toVersion)) {
                        current = nextVersion;
                        path.push(current);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                break;
            }
            steps++;
        }
        return path;
    }
    /**
     * Compare two versions
     * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
     */
    compareVersions(v1, v2) {
        const ver1 = typeof v1 === 'string' ? this.parseVersion(v1) : v1;
        const ver2 = typeof v2 === 'string' ? this.parseVersion(v2) : v2;
        if (ver1.major !== ver2.major) {
            return ver1.major < ver2.major ? -1 : 1;
        }
        if (ver1.minor !== ver2.minor) {
            return ver1.minor < ver2.minor ? -1 : 1;
        }
        if (ver1.patch !== ver2.patch) {
            return ver1.patch < ver2.patch ? -1 : 1;
        }
        return 0;
    }
    /**
     * Parse version string to SchemaVersion
     */
    parseVersion(versionString) {
        const parts = versionString.split('.').map(Number);
        const safeInt = (v) => v !== undefined && Number.isFinite(v) ? v : 0;
        return {
            major: safeInt(parts[0]),
            minor: safeInt(parts[1]),
            patch: safeInt(parts[2]),
            timestamp: new Date().toISOString(),
            description: '',
            breaking: false,
        };
    }
    /**
     * Create new version
     */
    createVersion(major, minor, patch, description, breaking = false) {
        return {
            major,
            minor,
            patch,
            timestamp: new Date().toISOString(),
            description,
            breaking,
        };
    }
    /**
     * Convert version to string
     */
    versionToString(version) {
        return `${version.major}.${version.minor}.${version.patch}`;
    }
    /**
     * Get version metadata
     */
    getVersionMetadata(version) {
        const history = this.versionHistory;
        const currentIndex = history.findIndex((v) => this.versionToString(v) === this.versionToString(version));
        return {
            version,
            previousVersion: currentIndex > 0 ? history[currentIndex - 1] : undefined,
            changes: [version.description],
            migrationsRequired: this.canMigrate(this.currentVersion || version, version)
                ? [this.versionToString(version)]
                : [],
            rollbackPossible: currentIndex > 0,
        };
    }
    /**
     * Get all registered versions
     */
    getAllVersions() {
        return Array.from(this.versions.values()).sort((a, b) => this.compareVersions(a, b));
    }
    /**
     * Clear all versions (for testing)
     */
    clear() {
        this.versions.clear();
        this.versionHistory = [];
        this.compatibilityMatrix.clear();
        this.currentVersion = null;
    }
}
