/**
 * Aeon Crypto Module
 *
 * Provides UCAN-based identity and encryption for secure sync operations.
 *
 * @example
 * ```typescript
 * import { AeonCryptoProvider, AEON_CAPABILITIES } from '@affectively/aeon/crypto';
 *
 * const crypto = new AeonCryptoProvider({
 *   defaultEncryptionMode: 'end-to-end',
 *   requireSignatures: true,
 * });
 *
 * // Generate identity
 * const { did, publicSigningKey } = await crypto.generateIdentity('My Node');
 *
 * // Create capability token
 * const token = await crypto.createUCAN(audienceDID, [
 *   { can: AEON_CAPABILITIES.SYNC_READ, with: '*' },
 * ]);
 *
 * // Sign and encrypt data
 * const signed = await crypto.signData(message);
 * const encrypted = await crypto.encrypt(data, recipientDID);
 * ```
 */

// Types - only export what actually exists in types.ts
export type {
  // Identity types
  DID,
  SigningAlgorithm,
  KeyPair,
  Identity,
  Capability,
  UCANPayload,
  UCANToken,
  VerificationResult,
  // Encryption types
  EncryptionAlgorithm,
  DomainCategory,
  ECKeyPair,
  EncryptedPayload,
  DecryptionResult,
  // Aeon-specific
  AeonEncryptionMode,
  AeonCapability,
  AeonCryptoConfig,
  AuthenticatedMessageFields,
  SecureSyncSession,
  SecureNodeInfo,
  AeonCapabilityResult,
  SignedSyncData,
} from './types';

// Constants
export { AEON_CAPABILITIES, DEFAULT_CRYPTO_CONFIG } from './types';

// Crypto Provider Interface
export type { ICryptoProvider } from './CryptoProvider';
export { NullCryptoProvider } from './CryptoProvider';

// Default Implementation - Requires @affectively/auth and @affectively/zk-encryption
// Uncomment when these packages are available
// export { AeonCryptoProvider } from './AeonCryptoProvider';
