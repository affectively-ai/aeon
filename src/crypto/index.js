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
// Constants
export { AEON_CAPABILITIES, DEFAULT_CRYPTO_CONFIG } from './types';
export { NullCryptoProvider } from './CryptoProvider';
export { NullTransactionSigner, createTransactionSignerAdapter, } from './transactionSigner';
// Default Implementation - Requires @affectively/auth and @affectively/auth
// Uncomment when these packages are available
// export { AeonCryptoProvider } from './AeonCryptoProvider';
