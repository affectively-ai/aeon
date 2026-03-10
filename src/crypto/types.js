/**
 * Aeon Crypto Types
 *
 * Type definitions for cryptographic operations in Aeon.
 * These are compatible with @affectively/auth and @affectively/auth.
 */
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
};
/**
 * Default crypto configuration
 */
export const DEFAULT_CRYPTO_CONFIG = {
    defaultEncryptionMode: 'none',
    requireSignatures: false,
    requireCapabilities: false,
    allowedSignatureAlgorithms: ['ES256', 'Ed25519'],
    allowedEncryptionAlgorithms: ['ECIES-P256', 'AES-256-GCM'],
    sessionKeyExpiration: 24 * 60 * 60 * 1000, // 24 hours
};
