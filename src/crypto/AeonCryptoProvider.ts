/**
 * Aeon Crypto Provider Implementation
 *
 * Default implementation using @affectively/ucan and @affectively/zk-encryption.
 */

import type { ICryptoProvider } from './CryptoProvider';
import type {
  AeonCryptoConfig,
  AeonCapabilityResult,
  SignedSyncData,
  SecureNodeInfo,
} from './types';

// Import from auth library
import {
  generateIdentity as ucanGenerateIdentity,
  exportPublicIdentity as ucanExportPublic,
  createUCAN,
  verifyUCAN,
  delegateCapabilities as ucanDelegate,
  sign as ucanSign,
  verify as ucanVerify,
  base64UrlEncode,
  base64UrlDecode,
  type Identity,
  type Capability,
} from '@affectively/auth';

// Import from ZK encryption library
import {
  generateKeyPair,
  eciesEncrypt,
  eciesDecrypt,
  aesEncrypt,
  aesDecrypt,
  deriveAESKeyFromJWK,
  sha256,
  randomBytes,
  type ECKeyPair,
} from '@affectively/zk-encryption';

/**
 * Session key cache entry
 */
interface SessionKeyEntry {
  key: Uint8Array;
  createdAt: number;
  expiresAt: number;
}

/**
 * Default Aeon Crypto Provider
 *
 * Uses @affectively/ucan for identity/UCAN and @affectively/zk-encryption for encryption.
 */
export class AeonCryptoProvider implements ICryptoProvider {
  private identity: Identity | null = null;
  private encryptionKeyPair: ECKeyPair | null = null;
  private remoteNodes = new Map<string, SecureNodeInfo>();
  private sessionKeys = new Map<string, SessionKeyEntry>();
  private config: AeonCryptoConfig;

  constructor(config?: Partial<AeonCryptoConfig>) {
    this.config = {
      defaultEncryptionMode: 'none',
      requireSignatures: false,
      requireCapabilities: false,
      allowedSignatureAlgorithms: ['ES256', 'Ed25519'],
      allowedEncryptionAlgorithms: ['ECIES-P256', 'AES-256-GCM'],
      sessionKeyExpiration: 24 * 60 * 60 * 1000,
      ...config,
    };
  }

  // ===========================================================================
  // IDENTITY OPERATIONS
  // ===========================================================================

  async generateIdentity(displayName?: string): Promise<{
    did: string;
    publicSigningKey: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
  }> {
    // Generate signing identity using UCAN library
    this.identity = await ucanGenerateIdentity({
      algorithm: 'ES256',
      displayName,
      includeEncryptionKey: true,
    });

    // Generate separate encryption key pair using ZK library
    this.encryptionKeyPair = await generateKeyPair();

    return {
      did: this.identity.did,
      publicSigningKey: this.identity.signingKey.publicKey,
      publicEncryptionKey: this.encryptionKeyPair.publicKey,
    };
  }

  getLocalDID(): string | null {
    return this.identity?.did || null;
  }

  async exportPublicIdentity(): Promise<SecureNodeInfo | null> {
    if (!this.identity) return null;

    const publicInfo = ucanExportPublic(this.identity);

    return {
      id: this.identity.did,
      did: this.identity.did,
      publicSigningKey: publicInfo.publicSigningKey,
      publicEncryptionKey: this.encryptionKeyPair?.publicKey,
      capabilities: [],
      lastSeen: Date.now(),
    };
  }

  async registerRemoteNode(node: SecureNodeInfo): Promise<void> {
    if (!node.did) {
      throw new Error('Remote node must have a DID');
    }
    this.remoteNodes.set(node.did, node);
  }

  async getRemotePublicKey(did: string): Promise<JsonWebKey | null> {
    const node = this.remoteNodes.get(did);
    return node?.publicSigningKey || null;
  }

  // ===========================================================================
  // SIGNING OPERATIONS
  // ===========================================================================

  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }
    return ucanSign(this.identity, data);
  }

  async signData<T>(data: T): Promise<SignedSyncData<T>> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }

    const payload = JSON.stringify(data);
    const payloadBytes = new TextEncoder().encode(payload);
    const signature = await this.sign(payloadBytes);

    return {
      payload: data,
      signature: base64UrlEncode(signature),
      signer: this.identity.did,
      algorithm: this.identity.signingKey.algorithm,
      signedAt: Date.now(),
    };
  }

  async verify(
    did: string,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean> {
    const node = this.remoteNodes.get(did);
    if (!node?.publicSigningKey) {
      return false;
    }

    return ucanVerify(node.publicSigningKey, signature, data);
  }

  async verifySignedData<T>(signedData: SignedSyncData<T>): Promise<boolean> {
    const payload = JSON.stringify(signedData.payload);
    const payloadBytes = new TextEncoder().encode(payload);
    const signature = base64UrlDecode(signedData.signature);

    return this.verify(signedData.signer, signature, payloadBytes);
  }

  // ===========================================================================
  // ENCRYPTION OPERATIONS
  // ===========================================================================

  async encrypt(
    plaintext: Uint8Array,
    recipientDID: string
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    epk?: JsonWebKey;
    encryptedAt: number;
  }> {
    const node = this.remoteNodes.get(recipientDID);
    if (!node?.publicEncryptionKey) {
      throw new Error(`No encryption key for recipient: ${recipientDID}`);
    }

    const encrypted = await eciesEncrypt(plaintext, node.publicEncryptionKey, {
      category: 'sync',
    });

    return {
      alg: encrypted.alg,
      ct: encrypted.ct,
      iv: encrypted.iv,
      tag: encrypted.tag,
      epk: encrypted.epk,
      encryptedAt: encrypted.encryptedAt,
    };
  }

  async decrypt(
    encrypted: {
      alg: string;
      ct: string;
      iv: string;
      tag: string;
      epk?: JsonWebKey;
    },
    _senderDID?: string
  ): Promise<Uint8Array> {
    if (!this.encryptionKeyPair) {
      throw new Error('Encryption key not initialized');
    }

    const result = await eciesDecrypt(
      {
        alg: 'ECIES-P256',
        ct: encrypted.ct,
        iv: encrypted.iv,
        tag: encrypted.tag,
        epk: encrypted.epk,
        encryptedAt: Date.now(),
      },
      this.encryptionKeyPair.privateKey
    );

    return result.plaintext;
  }

  async getSessionKey(peerDID: string): Promise<Uint8Array> {
    // Check cache
    const cached = this.sessionKeys.get(peerDID);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    // Derive new session key
    if (!this.encryptionKeyPair) {
      throw new Error('Encryption key not initialized');
    }

    const node = this.remoteNodes.get(peerDID);
    if (!node?.publicEncryptionKey) {
      throw new Error(`No encryption key for peer: ${peerDID}`);
    }

    // Derive shared key via ECDH + HKDF
    const aesKey = await deriveAESKeyFromJWK(
      this.encryptionKeyPair.privateKey,
      node.publicEncryptionKey,
      'sync',
      { info: `aeon-session-${peerDID}` }
    );

    // Export key to bytes
    const keyBytes = await crypto.subtle.exportKey('raw', aesKey);
    const key = new Uint8Array(keyBytes);

    // Cache
    const now = Date.now();
    this.sessionKeys.set(peerDID, {
      key,
      createdAt: now,
      expiresAt:
        now + (this.config.sessionKeyExpiration || 24 * 60 * 60 * 1000),
    });

    return key;
  }

  async encryptWithSessionKey(
    plaintext: Uint8Array,
    sessionKey: Uint8Array
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    encryptedAt: number;
  }> {
    const sessionKeyBuffer = new Uint8Array(sessionKey).buffer;

    // Import session key as CryptoKey
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sessionKeyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await aesEncrypt(plaintext, aesKey, { category: 'sync' });

    return {
      alg: encrypted.alg,
      ct: encrypted.ct,
      iv: encrypted.iv,
      tag: encrypted.tag,
      encryptedAt: encrypted.encryptedAt,
    };
  }

  async decryptWithSessionKey(
    encrypted: {
      ct: string;
      iv: string;
      tag: string;
    },
    sessionKey: Uint8Array
  ): Promise<Uint8Array> {
    const sessionKeyBuffer = new Uint8Array(sessionKey).buffer;

    // Import session key as CryptoKey
    const aesKey = await crypto.subtle.importKey(
      'raw',
      sessionKeyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const result = await aesDecrypt(
      {
        alg: 'AES-256-GCM',
        ct: encrypted.ct,
        iv: encrypted.iv,
        tag: encrypted.tag,
        encryptedAt: Date.now(),
      },
      aesKey
    );

    return result.plaintext;
  }

  // ===========================================================================
  // UCAN OPERATIONS
  // ===========================================================================

  async createUCAN(
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
      proofs?: string[];
    }
  ): Promise<string> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }

    return createUCAN(
      this.identity,
      audience as any,
      capabilities as Capability[],
      {
        expirationSeconds: options?.expirationSeconds,
        proofs: options?.proofs,
      }
    );
  }

  async verifyUCAN(
    token: string,
    options?: {
      expectedAudience?: string;
      requiredCapabilities?: Array<{ can: string; with: string }>;
    }
  ): Promise<AeonCapabilityResult> {
    try {
      // Parse token to get issuer
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { authorized: false, error: 'Invalid token format' };
      }

      const payload = JSON.parse(atob(parts[1]));
      const issuerDID = payload.iss;

      // Get issuer's public key
      const node = this.remoteNodes.get(issuerDID);
      if (!node?.publicSigningKey) {
        return { authorized: false, error: `Unknown issuer: ${issuerDID}` };
      }

      // Verify token
      const result = await verifyUCAN(token, node.publicSigningKey, {
        audience: options?.expectedAudience as any,
        requiredCapabilities: options?.requiredCapabilities as Capability[],
      });

      if (!result.valid) {
        return { authorized: false, error: result.error };
      }

      return {
        authorized: true,
        issuer: result.payload?.iss,
        grantedCapabilities: result.payload?.att,
      };
    } catch (error) {
      return {
        authorized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async delegateCapabilities(
    parentToken: string,
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
    }
  ): Promise<string> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }

    return ucanDelegate(
      parentToken,
      this.identity,
      audience as any,
      capabilities as Capability[],
      { expirationSeconds: options?.expirationSeconds }
    );
  }

  // ===========================================================================
  // UTILITY OPERATIONS
  // ===========================================================================

  async hash(data: Uint8Array): Promise<Uint8Array> {
    return sha256(data);
  }

  randomBytes(length: number): Uint8Array {
    return randomBytes(length);
  }

  isInitialized(): boolean {
    return this.identity !== null && this.encryptionKeyPair !== null;
  }

  // ===========================================================================
  // ADDITIONAL METHODS
  // ===========================================================================

  /**
   * Set local identity (for loading from storage)
   */
  setIdentity(identity: Identity, encryptionKeyPair: ECKeyPair): void {
    this.identity = identity;
    this.encryptionKeyPair = encryptionKeyPair;
  }

  /**
   * Clear session keys (for key rotation)
   */
  clearSessionKeys(): void {
    this.sessionKeys.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): AeonCryptoConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AeonCryptoConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
