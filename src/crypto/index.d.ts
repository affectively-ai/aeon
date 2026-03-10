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
export type { DID, SigningAlgorithm, KeyPair, Identity, Capability, UCANPayload, UCANToken, VerificationResult, EncryptionAlgorithm, DomainCategory, ECKeyPair, EncryptedPayload, DecryptionResult, AeonEncryptionMode, AeonCapability, AeonCryptoConfig, AuthenticatedMessageFields, SecureSyncSession, SecureNodeInfo, AeonCapabilityResult, SignedSyncData, } from './types';
export { AEON_CAPABILITIES, DEFAULT_CRYPTO_CONFIG } from './types';
export type { ICryptoProvider } from './CryptoProvider';
export { NullCryptoProvider } from './CryptoProvider';
export type { ITransactionSigner, TransactionSignerErrorCode, TransactionSignerExecuteRequest, TransactionSignerExecuteResponse, TransactionSignerHealth, TransactionSignerMetadata, TransactionSignerPayloadMap, } from './transactionSigner';
export { NullTransactionSigner, createTransactionSignerAdapter, } from './transactionSigner';
