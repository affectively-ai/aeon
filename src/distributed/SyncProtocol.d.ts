/**
 * Sync Protocol
 *
 * Handles synchronization protocol messages and handshaking.
 * Manages message serialization, protocol versioning, and compatibility.
 *
 * Features:
 * - Message serialization and deserialization
 * - Protocol version management
 * - Handshake handling
 * - Message validation and error handling
 * - Protocol state machine
 * - Optional cryptographic authentication and encryption
 */
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type { AeonEncryptionMode, AuthenticatedMessageFields } from '../crypto/types';
import type { PersistenceDeserializer, PersistenceSerializer, StorageAdapter } from '../persistence';
export interface SyncMessage {
    type: 'handshake' | 'sync-request' | 'sync-response' | 'ack' | 'error';
    version: string;
    sender: string;
    receiver: string;
    messageId: string;
    timestamp: string;
    payload?: unknown;
    auth?: AuthenticatedMessageFields;
}
export interface Handshake {
    protocolVersion: string;
    nodeId: string;
    capabilities: string[];
    state: 'initiating' | 'responding' | 'completed';
    did?: string;
    publicSigningKey?: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
    ucan?: string;
}
/**
 * Crypto configuration for sync protocol
 */
export interface SyncProtocolCryptoConfig {
    /** Encryption mode for messages */
    encryptionMode: AeonEncryptionMode;
    /** Require all messages to be signed */
    requireSignatures: boolean;
    /** Require UCAN capability verification */
    requireCapabilities: boolean;
    /** Required capabilities for sync operations */
    requiredCapabilities?: Array<{
        can: string;
        with: string;
    }>;
}
export interface SyncRequest {
    sessionId: string;
    fromVersion: string;
    toVersion: string;
    filter?: Record<string, unknown>;
}
export interface SyncResponse {
    sessionId: string;
    fromVersion: string;
    toVersion: string;
    data: unknown[];
    hasMore: boolean;
    offset: number;
}
export interface ProtocolError {
    code: string;
    message: string;
    recoverable: boolean;
}
export interface SyncProtocolPersistenceData {
    protocolVersion: string;
    messageCounter: number;
    messageQueue: SyncMessage[];
    handshakes: Array<{
        nodeId: string;
        handshake: Handshake;
    }>;
    protocolErrors: Array<{
        error: ProtocolError;
        timestamp: string;
    }>;
}
export interface SyncProtocolPersistenceConfig {
    adapter: StorageAdapter;
    key?: string;
    autoPersist?: boolean;
    autoLoad?: boolean;
    persistDebounceMs?: number;
    serializer?: PersistenceSerializer<SyncProtocolPersistenceData>;
    deserializer?: PersistenceDeserializer<SyncProtocolPersistenceData>;
}
export interface SyncProtocolOptions {
    persistence?: SyncProtocolPersistenceConfig;
}
/**
 * Sync Protocol
 * Handles synchronization protocol messages and handshaking
 */
export declare class SyncProtocol {
    private static readonly DEFAULT_PERSIST_KEY;
    private version;
    private messageQueue;
    private messageMap;
    private handshakes;
    private protocolErrors;
    private messageCounter;
    private cryptoProvider;
    private cryptoConfig;
    private persistence;
    private persistTimer;
    private persistInFlight;
    private persistPending;
    constructor(options?: SyncProtocolOptions);
    /**
     * Configure cryptographic provider for authenticated/encrypted messages
     */
    configureCrypto(provider: ICryptoProvider, config?: Partial<SyncProtocolCryptoConfig>): void;
    /**
     * Check if crypto is configured
     */
    isCryptoEnabled(): boolean;
    /**
     * Get crypto configuration
     */
    getCryptoConfig(): SyncProtocolCryptoConfig | null;
    /**
     * Get protocol version
     */
    getVersion(): string;
    /**
     * Create authenticated handshake message with DID and keys
     */
    createAuthenticatedHandshake(capabilities: string[], targetDID?: string): Promise<SyncMessage>;
    /**
     * Verify and process an authenticated handshake
     */
    verifyAuthenticatedHandshake(message: SyncMessage): Promise<{
        valid: boolean;
        handshake?: Handshake;
        error?: string;
    }>;
    /**
     * Sign and optionally encrypt a message payload
     */
    signMessage<T>(message: SyncMessage, payload: T, encrypt?: boolean): Promise<SyncMessage>;
    /**
     * Verify signature and optionally decrypt a message
     */
    verifyMessage<T>(message: SyncMessage): Promise<{
        valid: boolean;
        payload?: T;
        error?: string;
    }>;
    /**
     * Create handshake message
     */
    createHandshakeMessage(nodeId: string, capabilities: string[]): SyncMessage;
    /**
     * Create sync request message
     */
    createSyncRequestMessage(sender: string, receiver: string, sessionId: string, fromVersion: string, toVersion: string, filter?: Record<string, unknown>): SyncMessage;
    /**
     * Create sync response message
     */
    createSyncResponseMessage(sender: string, receiver: string, sessionId: string, fromVersion: string, toVersion: string, data: unknown[], hasMore?: boolean, offset?: number): SyncMessage;
    /**
     * Create acknowledgement message
     */
    createAckMessage(sender: string, receiver: string, messageId: string): SyncMessage;
    /**
     * Create error message
     */
    createErrorMessage(sender: string, receiver: string, error: ProtocolError, relatedMessageId?: string): SyncMessage;
    /**
     * Validate message
     */
    validateMessage(message: SyncMessage): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Serialize message
     */
    serializeMessage(message: SyncMessage): string;
    /**
     * Deserialize message
     */
    deserializeMessage(data: string): SyncMessage;
    /**
     * Process handshake
     */
    processHandshake(message: SyncMessage): Handshake;
    /**
     * Get message
     */
    getMessage(messageId: string): SyncMessage | undefined;
    /**
     * Get all messages
     */
    getAllMessages(): SyncMessage[];
    /**
     * Get messages by type
     */
    getMessagesByType(type: SyncMessage['type']): SyncMessage[];
    /**
     * Get messages from sender
     */
    getMessagesFromSender(sender: string): SyncMessage[];
    /**
     * Get pending messages
     */
    getPendingMessages(receiver: string): SyncMessage[];
    /**
     * Get handshakes
     */
    getHandshakes(): Map<string, Handshake>;
    /**
     * Get protocol statistics
     */
    getStatistics(): {
        totalMessages: number;
        messagesByType: Record<string, number>;
        totalHandshakes: number;
        totalErrors: number;
        recoverableErrors: number;
        unrecoverableErrors: number;
    };
    /**
     * Get protocol errors
     */
    getErrors(): Array<{
        error: ProtocolError;
        timestamp: string;
    }>;
    /**
     * Persist protocol state for reconnect/replay.
     */
    saveToPersistence(): Promise<void>;
    /**
     * Load protocol state from persistence.
     */
    loadFromPersistence(): Promise<{
        messages: number;
        handshakes: number;
        errors: number;
    }>;
    /**
     * Clear persisted protocol checkpoint.
     */
    clearPersistence(): Promise<void>;
    private schedulePersist;
    private persistSafely;
    private isValidHandshake;
    private isValidProtocolErrorEntry;
    /**
     * Generate message ID
     */
    private generateMessageId;
    /**
     * Clear all state (for testing)
     */
    clear(): void;
    /**
     * Get the crypto provider (for advanced usage)
     */
    getCryptoProvider(): ICryptoProvider | null;
}
