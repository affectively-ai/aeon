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
import type { ICryptoProvider } from '../crypto/CryptoProvider';
export interface StateVersion {
  version: string;
  timestamp: string;
  nodeId: string;
  hash: string;
  data: unknown;
  signerDID?: string;
  signature?: string;
  signedAt?: number;
}
export interface StateDiff {
  added: Record<string, unknown>;
  modified: Record<
    string,
    {
      old: unknown;
      new: unknown;
    }
  >;
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
export declare class StateReconciler {
  private stateVersions;
  private reconciliationHistory;
  private cryptoProvider;
  private requireSignedVersions;
  /**
   * Configure cryptographic provider for signed state versions
   */
  configureCrypto(provider: ICryptoProvider, requireSigned?: boolean): void;
  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean;
  /**
   * Record a signed state version with cryptographic verification
   */
  recordSignedStateVersion(
    key: string,
    version: string,
    data: unknown
  ): Promise<StateVersion>;
  /**
   * Verify a state version's signature
   */
  verifyStateVersion(version: StateVersion): Promise<{
    valid: boolean;
    error?: string;
  }>;
  /**
   * Reconcile with verification - only accept verified versions
   */
  reconcileWithVerification(
    key: string,
    strategy?: MergeStrategy
  ): Promise<
    ReconciliationResult & {
      verificationErrors: string[];
    }
  >;
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
  ): void;
  /**
   * Detect conflicts in state versions
   */
  detectConflicts(key: string): boolean;
  /**
   * Compare two states and generate diff
   */
  compareStates(
    state1: Record<string, unknown>,
    state2: Record<string, unknown>
  ): StateDiff;
  /**
   * Reconcile states using last-write-wins strategy
   */
  reconcileLastWriteWins(versions: StateVersion[]): ReconciliationResult;
  /**
   * Reconcile states using vector clock strategy
   */
  reconcileVectorClock(versions: StateVersion[]): ReconciliationResult;
  /**
   * Reconcile states using majority vote strategy
   */
  reconcileMajorityVote(versions: StateVersion[]): ReconciliationResult;
  /**
   * Merge multiple states
   */
  mergeStates(states: Record<string, unknown>[]): unknown;
  /**
   * Validate state after reconciliation
   */
  validateState(state: unknown): {
    valid: boolean;
    errors: string[];
  };
  /**
   * Get state versions for a key
   */
  getStateVersions(key: string): StateVersion[];
  /**
   * Get all state versions
   */
  getAllStateVersions(): Record<string, StateVersion[]>;
  /**
   * Get reconciliation history
   */
  getReconciliationHistory(): ReconciliationResult[];
  /**
   * Get reconciliation statistics
   */
  getStatistics(): {
    totalReconciliations: number;
    successfulReconciliations: number;
    totalConflictsResolved: number;
    averageConflictsPerReconciliation: number;
    strategyUsage: Record<string, number>;
    trackedKeys: number;
  };
  /**
   * Clear all state (for testing)
   */
  clear(): void;
  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null;
}
