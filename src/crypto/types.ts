/**
 * Aeon Crypto Types
 *
 * Type definitions for cryptographic operations in Aeon.
 * These are compatible with @affectively/ucan and @affectively/zk-encryption.
 */

// =============================================================================
// IDENTITY TYPES (compatible with @affectively/ucan)
// =============================================================================

/**
 * Decentralized Identifier (DID)
 * Format: did:method:identifier
 */
export type DID = `did:${string}:${string}`;

/**
 * Supported signing algorithms
 */
export type SigningAlgorithm = 'ES256' | 'Ed25519' | 'ES384' | 'ES512';

/**
 * Key pair for signing and verification
 */
export interface KeyPair {
  algorithm: SigningAlgorithm;
  publicKey: JsonWebKey;
  privateKey?: JsonWebKey;
  fingerprint: string;
}

/**
 * Identity representing a user or node
 */
export interface Identity {
  did: DID;
  signingKey: KeyPair;
  encryptionKey?: KeyPair;
  createdAt: number;
  displayName?: string;
}

/**
 * UCAN Capability structure
 */
export interface Capability {
  can: string;
  with: string;
  constraints?: Record<string, unknown>;
}

/**
 * UCAN Token payload
 */
export interface UCANPayload {
  iss: DID;
  aud: DID;
  exp: number;
  nbf?: number;
  iat?: number;
  nonce?: string;
  jti?: string;
  att: Capability[];
  prf?: string[];
  fct?: Record<string, unknown>;
}

/**
 * Parsed UCAN Token
 */
export interface UCANToken {
  payload: UCANPayload;
  raw: string;
  signature: Uint8Array;
  algorithm: string;
}

/**
 * UCAN verification result
 */
export interface VerificationResult {
  valid: boolean;
  payload?: UCANPayload;
  error?: string;
  expired?: boolean;
  shouldRotate?: boolean;
  expiresIn?: number;
}

// =============================================================================
// ENCRYPTION TYPES (compatible with @affectively/zk-encryption)
// =============================================================================

/**
 * Encryption algorithms supported
 */
export type EncryptionAlgorithm = 'ECIES-P256' | 'AES-256-GCM';

/**
 * HKDF domain separator categories
 */
export type DomainCategory =
  | 'default'
  | 'sync'
  | 'message'
  | 'api-key'
  | 'personal-data'
  | string;

/**
 * EC Key pair for ECDH operations
 */
export interface ECKeyPair {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  keyId: string;
  createdAt: string;
}

/**
 * Encrypted data envelope
 */
export interface EncryptedPayload {
  alg: EncryptionAlgorithm;
  ct: string;
  iv: string;
  tag: string;
  epk?: JsonWebKey;
  category?: DomainCategory;
  nonce?: string;
  encryptedAt: number;
}

/**
 * Decryption result
 */
export interface DecryptionResult {
  plaintext: Uint8Array;
  category?: DomainCategory;
  encryptedAt: number;
}

// =============================================================================
// AEON-SPECIFIC TYPES
// =============================================================================

/**
 * Aeon encryption mode
 */
export type AeonEncryptionMode =
  | 'none' // No encryption (development/testing)
  | 'transport' // Encrypt in transit only (session keys)
  | 'at-rest' // Encrypt for storage
  | 'end-to-end'; // Full E2E encryption between nodes

/**
 * Aeon sync capability namespace
 */
export const AEON_CAPABILITIES = {
  // Basic sync operations
  SYNC_READ: 'aeon:sync:read',
  SYNC_WRITE: 'aeon:sync:write',
  SYNC_ADMIN: 'aeon:sync:admin',

  // Node operations
  NODE_REGISTER: 'aeon:node:register',
  NODE_HEARTBEAT: 'aeon:node:heartbeat',

  // Replication operations
  REPLICATE_READ: 'aeon:replicate:read',
  REPLICATE_WRITE: 'aeon:replicate:write',

  // State operations
  STATE_READ: 'aeon:state:read',
  STATE_WRITE: 'aeon:state:write',
  STATE_RECONCILE: 'aeon:state:reconcile',
} as const;

export type AeonCapability =
  (typeof AEON_CAPABILITIES)[keyof typeof AEON_CAPABILITIES];

/**
 * Crypto configuration for Aeon
 */
export interface AeonCryptoConfig {
  /** Default encryption mode for sync messages */
  defaultEncryptionMode: AeonEncryptionMode;
  /** Require all messages to be signed */
  requireSignatures: boolean;
  /** Require UCAN capability verification */
  requireCapabilities: boolean;
  /** Allowed signature algorithms */
  allowedSignatureAlgorithms: string[];
  /** Allowed encryption algorithms */
  allowedEncryptionAlgorithms: string[];
  /** UCAN audience DID for verification */
  ucanAudience?: string;
  /** Session key expiration (ms) */
  sessionKeyExpiration?: number;
}

/**
 * Default crypto configuration
 */
export const DEFAULT_CRYPTO_CONFIG: AeonCryptoConfig = {
  defaultEncryptionMode: 'none',
  requireSignatures: false,
  requireCapabilities: false,
  allowedSignatureAlgorithms: ['ES256', 'Ed25519'],
  allowedEncryptionAlgorithms: ['ECIES-P256', 'AES-256-GCM'],
  sessionKeyExpiration: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Authenticated sync message fields
 */
export interface AuthenticatedMessageFields {
  /** Sender DID */
  senderDID?: string;
  /** Receiver DID */
  receiverDID?: string;
  /** UCAN token for capability verification */
  ucan?: string;
  /** Message signature (base64url) */
  signature?: string;
  /** Whether payload is encrypted */
  encrypted?: boolean;
}

/**
 * Secure sync session
 */
export interface SecureSyncSession {
  id: string;
  initiator: string;
  participants: string[];
  sessionKey?: Uint8Array;
  encryptionMode: AeonEncryptionMode;
  requiredCapabilities: string[];
  status: 'pending' | 'active' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
}

/**
 * Node with identity information
 */
export interface SecureNodeInfo {
  id: string;
  did?: string;
  publicSigningKey?: JsonWebKey;
  publicEncryptionKey?: JsonWebKey;
  capabilities?: string[];
  lastSeen?: number;
}

/**
 * Capability verification result
 */
export interface AeonCapabilityResult {
  authorized: boolean;
  error?: string;
  issuer?: string;
  grantedCapabilities?: Array<{ can: string; with: string }>;
}

/**
 * Signed data envelope for sync operations
 */
export interface SignedSyncData<T = unknown> {
  payload: T;
  signature: string;
  signer: string;
  algorithm: string;
  signedAt: number;
}
