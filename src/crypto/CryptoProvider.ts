/**
 * Aeon Crypto Provider Interface
 *
 * Abstract interface for cryptographic operations.
 * Aeon core remains zero-dependency - crypto is injected through this interface.
 */

import type {
  AeonCapabilityResult,
  SignedSyncData,
  SecureNodeInfo,
} from './types';

/**
 * Abstract crypto provider interface
 *
 * Implementations use @affectively/ucan and @affectively/zk-encryption
 * or other compatible libraries.
 */
export interface ICryptoProvider {
  // ===========================================================================
  // IDENTITY OPERATIONS
  // ===========================================================================

  /**
   * Generate a new identity with DID and key pairs
   */
  generateIdentity(displayName?: string): Promise<{
    did: string;
    publicSigningKey: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
  }>;

  /**
   * Get the local identity's DID
   */
  getLocalDID(): string | null;

  /**
   * Export local identity's public info for sharing
   */
  exportPublicIdentity(): Promise<SecureNodeInfo | null>;

  /**
   * Register a known remote node's public keys
   */
  registerRemoteNode(node: SecureNodeInfo): Promise<void>;

  /**
   * Get a remote node's public key
   */
  getRemotePublicKey(did: string): Promise<JsonWebKey | null>;

  // ===========================================================================
  // SIGNING OPERATIONS
  // ===========================================================================

  /**
   * Sign data with local identity's private key
   */
  sign(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Sign structured data and wrap in SignedSyncData envelope
   */
  signData<T>(data: T): Promise<SignedSyncData<T>>;

  /**
   * Verify a signature from a remote node
   */
  verify(did: string, signature: Uint8Array, data: Uint8Array): Promise<boolean>;

  /**
   * Verify a SignedSyncData envelope
   */
  verifySignedData<T>(signedData: SignedSyncData<T>): Promise<boolean>;

  // ===========================================================================
  // ENCRYPTION OPERATIONS
  // ===========================================================================

  /**
   * Encrypt data for a recipient
   */
  encrypt(plaintext: Uint8Array, recipientDID: string): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    epk?: JsonWebKey;
    encryptedAt: number;
  }>;

  /**
   * Decrypt data
   */
  decrypt(
    encrypted: {
      alg: string;
      ct: string;
      iv: string;
      tag: string;
      epk?: JsonWebKey;
    },
    senderDID?: string,
  ): Promise<Uint8Array>;

  /**
   * Derive or get a session key for communication with a peer
   */
  getSessionKey(peerDID: string): Promise<Uint8Array>;

  /**
   * Encrypt with a session key
   */
  encryptWithSessionKey(
    plaintext: Uint8Array,
    sessionKey: Uint8Array,
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    encryptedAt: number;
  }>;

  /**
   * Decrypt with a session key
   */
  decryptWithSessionKey(
    encrypted: {
      ct: string;
      iv: string;
      tag: string;
    },
    sessionKey: Uint8Array,
  ): Promise<Uint8Array>;

  // ===========================================================================
  // UCAN OPERATIONS
  // ===========================================================================

  /**
   * Create a UCAN token
   */
  createUCAN(
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
      proofs?: string[];
    },
  ): Promise<string>;

  /**
   * Verify a UCAN token
   */
  verifyUCAN(
    token: string,
    options?: {
      expectedAudience?: string;
      requiredCapabilities?: Array<{ can: string; with: string }>;
    },
  ): Promise<AeonCapabilityResult>;

  /**
   * Delegate capabilities
   */
  delegateCapabilities(
    parentToken: string,
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
    },
  ): Promise<string>;

  // ===========================================================================
  // UTILITY OPERATIONS
  // ===========================================================================

  /**
   * Compute hash of data
   */
  hash(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Generate random bytes
   */
  randomBytes(length: number): Uint8Array;

  /**
   * Check if crypto is properly initialized
   */
  isInitialized(): boolean;
}

/**
 * Null crypto provider for when crypto is disabled
 *
 * All operations either throw or return permissive defaults.
 */
export class NullCryptoProvider implements ICryptoProvider {
  private notConfiguredError(): Error {
    return new Error('Crypto provider not configured');
  }

  async generateIdentity(): Promise<{
    did: string;
    publicSigningKey: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
  }> {
    throw this.notConfiguredError();
  }

  getLocalDID(): string | null {
    return null;
  }

  async exportPublicIdentity(): Promise<SecureNodeInfo | null> {
    return null;
  }

  async registerRemoteNode(): Promise<void> {
    // No-op when crypto disabled
  }

  async getRemotePublicKey(): Promise<JsonWebKey | null> {
    return null;
  }

  async sign(): Promise<Uint8Array> {
    throw this.notConfiguredError();
  }

  async signData<T>(_data: T): Promise<SignedSyncData<T>> {
    throw this.notConfiguredError();
  }

  async verify(): Promise<boolean> {
    // Permissive when crypto disabled
    return true;
  }

  async verifySignedData(): Promise<boolean> {
    // Permissive when crypto disabled
    return true;
  }

  async encrypt(): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    epk?: JsonWebKey;
    encryptedAt: number;
  }> {
    throw this.notConfiguredError();
  }

  async decrypt(): Promise<Uint8Array> {
    throw this.notConfiguredError();
  }

  async getSessionKey(): Promise<Uint8Array> {
    throw this.notConfiguredError();
  }

  async encryptWithSessionKey(): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    encryptedAt: number;
  }> {
    throw this.notConfiguredError();
  }

  async decryptWithSessionKey(): Promise<Uint8Array> {
    throw this.notConfiguredError();
  }

  async createUCAN(): Promise<string> {
    throw this.notConfiguredError();
  }

  async verifyUCAN(): Promise<AeonCapabilityResult> {
    // Permissive when crypto disabled
    return { authorized: true };
  }

  async delegateCapabilities(): Promise<string> {
    throw this.notConfiguredError();
  }

  async hash(): Promise<Uint8Array> {
    throw this.notConfiguredError();
  }

  randomBytes(length: number): Uint8Array {
    // Use crypto.getRandomValues even without full crypto setup
    return crypto.getRandomValues(new Uint8Array(length));
  }

  isInitialized(): boolean {
    return false;
  }
}
