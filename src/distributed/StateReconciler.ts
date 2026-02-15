/**
 * State Reconciler
 *
 * Reconciles conflicting state across multiple nodes in a distributed system.
 * Applies merge strategies and resolves divergent state.
 *
 * Features:
 * - State comparison and diff generation
 * - Multiple merge strategies (last-write-wins, vector-clock based, custom)
 * - Conflict detection and resolution
 * - State validation and verification
 * - Version tracking
 * - Cryptographic verification of state versions
 * - Signed state for tamper detection
 */

import { logger } from '../utils/logger';
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type { SignedSyncData } from '../crypto/types';

export interface StateVersion {
  version: string;
  timestamp: string;
  nodeId: string;
  hash: string;
  data: unknown;
  // Cryptographic fields for signed versions
  signerDID?: string;
  signature?: string;
  signedAt?: number;
}

export interface StateDiff {
  added: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
  removed: string[];
  timestamp: string;
}

export interface ReconciliationResult {
  success: boolean;
  mergedState: unknown;
  conflictsResolved: number;
  strategy: string;
  timestamp: string;
}

export type MergeStrategy =
  | 'last-write-wins'
  | 'vector-clock'
  | 'majority-vote'
  | 'custom';

/**
 * State Reconciler
 * Reconciles state conflicts across distributed nodes
 */
export class StateReconciler {
  private stateVersions: Map<string, StateVersion[]> = new Map();
  private reconciliationHistory: ReconciliationResult[] = [];
  private cryptoProvider: ICryptoProvider | null = null;
  private requireSignedVersions: boolean = false;

  /**
   * Configure cryptographic provider for signed state versions
   */
  configureCrypto(
    provider: ICryptoProvider,
    requireSigned: boolean = false
  ): void {
    this.cryptoProvider = provider;
    this.requireSignedVersions = requireSigned;

    logger.debug('[StateReconciler] Crypto configured', {
      initialized: provider.isInitialized(),
      requireSigned,
    });
  }

  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean {
    return this.cryptoProvider !== null && this.cryptoProvider.isInitialized();
  }

  /**
   * Record a signed state version with cryptographic verification
   */
  async recordSignedStateVersion(
    key: string,
    version: string,
    data: unknown
  ): Promise<StateVersion> {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }

    const localDID = this.cryptoProvider.getLocalDID();
    if (!localDID) {
      throw new Error('Local DID not available');
    }

    // Hash the data
    const dataBytes = new TextEncoder().encode(JSON.stringify(data));
    const hashBytes = await this.cryptoProvider.hash(dataBytes);
    const hash = Array.from(hashBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Sign the version
    const versionData = { version, data, hash };
    const signed = await this.cryptoProvider.signData(versionData);

    const stateVersion: StateVersion = {
      version,
      timestamp: new Date().toISOString(),
      nodeId: localDID,
      hash,
      data,
      signerDID: localDID,
      signature: signed.signature,
      signedAt: signed.signedAt,
    };

    if (!this.stateVersions.has(key)) {
      this.stateVersions.set(key, []);
    }

    this.stateVersions.get(key)!.push(stateVersion);

    logger.debug('[StateReconciler] Signed state version recorded', {
      key,
      version,
      signerDID: localDID,
      hash: hash.slice(0, 16) + '...',
    });

    return stateVersion;
  }

  /**
   * Verify a state version's signature
   */
  async verifyStateVersion(
    version: StateVersion
  ): Promise<{ valid: boolean; error?: string }> {
    // If no signature, verify based on hash only
    if (!version.signature || !version.signerDID) {
      if (this.requireSignedVersions) {
        return { valid: false, error: 'Signature required but not present' };
      }

      // Verify hash matches data
      const dataBytes = new TextEncoder().encode(JSON.stringify(version.data));
      if (this.cryptoProvider) {
        const hashBytes = await this.cryptoProvider.hash(dataBytes);
        const computedHash = Array.from(hashBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        if (computedHash !== version.hash) {
          return { valid: false, error: 'Hash mismatch' };
        }
      }

      return { valid: true };
    }

    // Verify signature
    if (!this.cryptoProvider) {
      return { valid: false, error: 'Crypto provider not configured' };
    }

    const versionData = {
      version: version.version,
      data: version.data,
      hash: version.hash,
    };

    const signed: SignedSyncData<typeof versionData> = {
      payload: versionData,
      signature: version.signature,
      signer: version.signerDID,
      algorithm: 'ES256',
      signedAt: version.signedAt || Date.now(),
    };

    const isValid = await this.cryptoProvider.verifySignedData(signed);
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  }

  /**
   * Reconcile with verification - only accept verified versions
   */
  async reconcileWithVerification(
    key: string,
    strategy: MergeStrategy = 'last-write-wins'
  ): Promise<ReconciliationResult & { verificationErrors: string[] }> {
    const versions = this.stateVersions.get(key) || [];
    const verifiedVersions: StateVersion[] = [];
    const verificationErrors: string[] = [];

    // Verify all versions
    for (const version of versions) {
      const result = await this.verifyStateVersion(version);
      if (result.valid) {
        verifiedVersions.push(version);
      } else {
        verificationErrors.push(
          `Version ${version.version} from ${version.nodeId}: ${result.error}`
        );
        logger.warn('[StateReconciler] Version verification failed', {
          version: version.version,
          nodeId: version.nodeId,
          error: result.error,
        });
      }
    }

    if (verifiedVersions.length === 0) {
      return {
        success: false,
        mergedState: null,
        conflictsResolved: 0,
        strategy,
        timestamp: new Date().toISOString(),
        verificationErrors,
      };
    }

    // Apply reconciliation strategy
    let result: ReconciliationResult;
    switch (strategy) {
      case 'last-write-wins':
        result = this.reconcileLastWriteWins(verifiedVersions);
        break;
      case 'vector-clock':
        result = this.reconcileVectorClock(verifiedVersions);
        break;
      case 'majority-vote':
        result = this.reconcileMajorityVote(verifiedVersions);
        break;
      default:
        result = this.reconcileLastWriteWins(verifiedVersions);
    }

    return { ...result, verificationErrors };
  }

  /**
   * Record a state version
   */
  recordStateVersion(
    key: string,
    version: string,
    timestamp: string,
    nodeId: string,
    hash: string,
    data: unknown
  ): void {
    if (!this.stateVersions.has(key)) {
      this.stateVersions.set(key, []);
    }

    const versions = this.stateVersions.get(key)!;
    versions.push({
      version,
      timestamp,
      nodeId,
      hash,
      data,
    });

    logger.debug('[StateReconciler] State version recorded', {
      key,
      version,
      nodeId,
      hash,
    });
  }

  /**
   * Detect conflicts in state versions
   */
  detectConflicts(key: string): boolean {
    const versions = this.stateVersions.get(key);
    if (!versions || versions.length <= 1) {
      return false;
    }

    const hashes = new Set(versions.map((v) => v.hash));
    return hashes.size > 1;
  }

  /**
   * Compare two states and generate diff
   */
  compareStates(
    state1: Record<string, unknown>,
    state2: Record<string, unknown>
  ): StateDiff {
    const diff: StateDiff = {
      added: {},
      modified: {},
      removed: [],
      timestamp: new Date().toISOString(),
    };

    // Find added and modified
    for (const [key, value] of Object.entries(state2)) {
      if (!(key in state1)) {
        diff.added[key] = value;
      } else if (JSON.stringify(state1[key]) !== JSON.stringify(value)) {
        diff.modified[key] = { old: state1[key], new: value };
      }
    }

    // Find removed
    for (const key of Object.keys(state1)) {
      if (!(key in state2)) {
        diff.removed.push(key);
      }
    }

    return diff;
  }

  /**
   * Reconcile states using last-write-wins strategy
   */
  reconcileLastWriteWins(versions: StateVersion[]): ReconciliationResult {
    if (versions.length === 0) {
      throw new Error('No versions to reconcile');
    }

    // Sort by timestamp descending, most recent first
    const sorted = [...versions].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latest = sorted[0];
    const conflictsResolved = versions.length - 1;

    const result: ReconciliationResult = {
      success: true,
      mergedState: latest.data,
      conflictsResolved,
      strategy: 'last-write-wins',
      timestamp: new Date().toISOString(),
    };

    this.reconciliationHistory.push(result);

    logger.debug('[StateReconciler] State reconciled (last-write-wins)', {
      winnerNode: latest.nodeId,
      conflictsResolved,
    });

    return result;
  }

  /**
   * Reconcile states using vector clock strategy
   */
  reconcileVectorClock(versions: StateVersion[]): ReconciliationResult {
    if (versions.length === 0) {
      throw new Error('No versions to reconcile');
    }

    // For vector clock, use the version with highest timestamp
    // In production, this would use actual vector clocks
    const sorted = [...versions].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latest = sorted[0];
    let conflictsResolved = 0;

    // Count concurrent versions (those with similar timestamps)
    for (const v of versions) {
      const timeDiff = Math.abs(
        new Date(v.timestamp).getTime() - new Date(latest.timestamp).getTime()
      );
      if (timeDiff > 100) {
        // More than 100ms difference
        conflictsResolved++;
      }
    }

    const result: ReconciliationResult = {
      success: true,
      mergedState: latest.data,
      conflictsResolved,
      strategy: 'vector-clock',
      timestamp: new Date().toISOString(),
    };

    this.reconciliationHistory.push(result);

    logger.debug('[StateReconciler] State reconciled (vector-clock)', {
      winnerVersion: latest.version,
      conflictsResolved,
    });

    return result;
  }

  /**
   * Reconcile states using majority vote strategy
   */
  reconcileMajorityVote(versions: StateVersion[]): ReconciliationResult {
    if (versions.length === 0) {
      throw new Error('No versions to reconcile');
    }

    // Group versions by hash
    const hashGroups: Map<string, StateVersion[]> = new Map();
    for (const version of versions) {
      if (!hashGroups.has(version.hash)) {
        hashGroups.set(version.hash, []);
      }
      hashGroups.get(version.hash)!.push(version);
    }

    // Find the majority
    let majorityVersion: StateVersion | null = null;
    let maxCount = 0;

    for (const [, versionGroup] of hashGroups) {
      if (versionGroup.length > maxCount) {
        maxCount = versionGroup.length;
        majorityVersion = versionGroup[0];
      }
    }

    if (!majorityVersion) {
      majorityVersion = versions[0];
    }

    const conflictsResolved = versions.length - maxCount;

    const result: ReconciliationResult = {
      success: true,
      mergedState: majorityVersion.data,
      conflictsResolved,
      strategy: 'majority-vote',
      timestamp: new Date().toISOString(),
    };

    this.reconciliationHistory.push(result);

    logger.debug('[StateReconciler] State reconciled (majority-vote)', {
      majorityCount: maxCount,
      conflictsResolved,
    });

    return result;
  }

  /**
   * Merge multiple states
   */
  mergeStates(states: Record<string, unknown>[]): unknown {
    if (states.length === 0) {
      return {};
    }

    if (states.length === 1) {
      return states[0];
    }

    // Simple merge: take all keys, preferring later states
    const merged: Record<string, unknown> = {};

    for (const state of states) {
      if (typeof state === 'object' && state !== null) {
        Object.assign(merged, state);
      }
    }

    return merged;
  }

  /**
   * Validate state after reconciliation
   */
  validateState(state: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (state === null) {
      errors.push('State is null');
    } else if (state === undefined) {
      errors.push('State is undefined');
    } else if (typeof state !== 'object') {
      errors.push('State is not an object');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get state versions for a key
   */
  getStateVersions(key: string): StateVersion[] {
    return this.stateVersions.get(key) || [];
  }

  /**
   * Get all state versions
   */
  getAllStateVersions(): Record<string, StateVersion[]> {
    const result: Record<string, StateVersion[]> = {};

    for (const [key, versions] of this.stateVersions) {
      result[key] = [...versions];
    }

    return result;
  }

  /**
   * Get reconciliation history
   */
  getReconciliationHistory(): ReconciliationResult[] {
    return [...this.reconciliationHistory];
  }

  /**
   * Get reconciliation statistics
   */
  getStatistics() {
    const resolvedConflicts = this.reconciliationHistory.reduce(
      (sum, r) => sum + r.conflictsResolved,
      0
    );

    const strategyUsage: Record<string, number> = {};
    for (const result of this.reconciliationHistory) {
      strategyUsage[result.strategy] =
        (strategyUsage[result.strategy] || 0) + 1;
    }

    return {
      totalReconciliations: this.reconciliationHistory.length,
      successfulReconciliations: this.reconciliationHistory.filter(
        (r) => r.success
      ).length,
      totalConflictsResolved: resolvedConflicts,
      averageConflictsPerReconciliation:
        this.reconciliationHistory.length > 0
          ? resolvedConflicts / this.reconciliationHistory.length
          : 0,
      strategyUsage,
      trackedKeys: this.stateVersions.size,
    };
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.stateVersions.clear();
    this.reconciliationHistory = [];
    this.cryptoProvider = null;
    this.requireSignedVersions = false;
  }

  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null {
    return this.cryptoProvider;
  }
}
