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

import { logger } from '../utils/logger';
import type { ICryptoProvider } from '../crypto/CryptoProvider';
import type {
  AeonEncryptionMode,
  AuthenticatedMessageFields,
} from '../crypto/types';

export interface SyncMessage {
  type: 'handshake' | 'sync-request' | 'sync-response' | 'ack' | 'error';
  version: string;
  sender: string;
  receiver: string;
  messageId: string;
  timestamp: string;
  payload?: unknown;
  // Authentication fields (populated when crypto is configured)
  auth?: AuthenticatedMessageFields;
}

export interface Handshake {
  protocolVersion: string;
  nodeId: string;
  capabilities: string[];
  state: 'initiating' | 'responding' | 'completed';
  // DID for authenticated handshakes
  did?: string;
  // Public signing key (JWK)
  publicSigningKey?: JsonWebKey;
  // Public encryption key (JWK)
  publicEncryptionKey?: JsonWebKey;
  // UCAN token for capability verification
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
  requiredCapabilities?: Array<{ can: string; with: string }>;
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

/**
 * Sync Protocol
 * Handles synchronization protocol messages and handshaking
 */
export class SyncProtocol {
  private version: string = '1.0.0';
  private messageQueue: SyncMessage[] = [];
  private messageMap: Map<string, SyncMessage> = new Map();
  private handshakes: Map<string, Handshake> = new Map();
  private protocolErrors: Array<{ error: ProtocolError; timestamp: string }> = [];
  private messageCounter: number = 0;

  // Crypto support
  private cryptoProvider: ICryptoProvider | null = null;
  private cryptoConfig: SyncProtocolCryptoConfig | null = null;

  /**
   * Configure cryptographic provider for authenticated/encrypted messages
   */
  configureCrypto(
    provider: ICryptoProvider,
    config?: Partial<SyncProtocolCryptoConfig>,
  ): void {
    this.cryptoProvider = provider;
    this.cryptoConfig = {
      encryptionMode: config?.encryptionMode ?? 'none',
      requireSignatures: config?.requireSignatures ?? false,
      requireCapabilities: config?.requireCapabilities ?? false,
      requiredCapabilities: config?.requiredCapabilities,
    };

    logger.debug('[SyncProtocol] Crypto configured', {
      encryptionMode: this.cryptoConfig.encryptionMode,
      requireSignatures: this.cryptoConfig.requireSignatures,
      requireCapabilities: this.cryptoConfig.requireCapabilities,
    });
  }

  /**
   * Check if crypto is configured
   */
  isCryptoEnabled(): boolean {
    return this.cryptoProvider !== null && this.cryptoProvider.isInitialized();
  }

  /**
   * Get crypto configuration
   */
  getCryptoConfig(): SyncProtocolCryptoConfig | null {
    return this.cryptoConfig ? { ...this.cryptoConfig } : null;
  }

  /**
   * Get protocol version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Create authenticated handshake message with DID and keys
   */
  async createAuthenticatedHandshake(
    capabilities: string[],
    targetDID?: string,
  ): Promise<SyncMessage> {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }

    const localDID = this.cryptoProvider.getLocalDID();
    if (!localDID) {
      throw new Error('Local DID not available');
    }

    const publicInfo = await this.cryptoProvider.exportPublicIdentity();
    if (!publicInfo) {
      throw new Error('Cannot export public identity');
    }

    // Create UCAN if target DID is specified and capabilities are required
    let ucan: string | undefined;
    if (targetDID && this.cryptoConfig?.requireCapabilities) {
      const caps = this.cryptoConfig.requiredCapabilities || [
        { can: 'aeon:sync:read', with: '*' },
        { can: 'aeon:sync:write', with: '*' },
      ];
      ucan = await this.cryptoProvider.createUCAN(targetDID, caps);
    }

    const handshakePayload: Handshake = {
      protocolVersion: this.version,
      nodeId: localDID,
      capabilities,
      state: 'initiating',
      did: localDID,
      publicSigningKey: publicInfo.publicSigningKey,
      publicEncryptionKey: publicInfo.publicEncryptionKey,
      ucan,
    };

    const message: SyncMessage = {
      type: 'handshake',
      version: this.version,
      sender: localDID,
      receiver: targetDID || '',
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: handshakePayload,
    };

    // Sign the message if signatures are required
    if (this.cryptoConfig?.requireSignatures) {
      const signed = await this.cryptoProvider.signData(handshakePayload);
      message.auth = {
        senderDID: localDID,
        receiverDID: targetDID,
        signature: signed.signature,
      };
    }

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    logger.debug('[SyncProtocol] Authenticated handshake created', {
      messageId: message.messageId,
      did: localDID,
      capabilities: capabilities.length,
      hasUCAN: !!ucan,
    });

    return message;
  }

  /**
   * Verify and process an authenticated handshake
   */
  async verifyAuthenticatedHandshake(
    message: SyncMessage,
  ): Promise<{ valid: boolean; handshake?: Handshake; error?: string }> {
    if (message.type !== 'handshake') {
      return { valid: false, error: 'Message is not a handshake' };
    }

    const handshake = message.payload as Handshake;

    // If crypto is not configured, just process normally
    if (!this.cryptoProvider || !this.cryptoConfig) {
      this.handshakes.set(message.sender, handshake);
      return { valid: true, handshake };
    }

    // Register the remote node if we have their keys
    if (handshake.did && handshake.publicSigningKey) {
      await this.cryptoProvider.registerRemoteNode({
        id: handshake.nodeId,
        did: handshake.did,
        publicSigningKey: handshake.publicSigningKey,
        publicEncryptionKey: handshake.publicEncryptionKey,
      });
    }

    // Verify signature if required
    if (this.cryptoConfig.requireSignatures && message.auth?.signature) {
      const signed = {
        payload: handshake,
        signature: message.auth.signature,
        signer: message.auth.senderDID || message.sender,
        algorithm: 'ES256',
        signedAt: Date.now(),
      };

      const isValid = await this.cryptoProvider.verifySignedData(signed);
      if (!isValid) {
        logger.warn('[SyncProtocol] Handshake signature verification failed', {
          messageId: message.messageId,
          sender: message.sender,
        });
        return { valid: false, error: 'Invalid signature' };
      }
    }

    // Verify UCAN if required
    if (this.cryptoConfig.requireCapabilities && handshake.ucan) {
      const localDID = this.cryptoProvider.getLocalDID();
      const result = await this.cryptoProvider.verifyUCAN(handshake.ucan, {
        expectedAudience: localDID || undefined,
        requiredCapabilities: this.cryptoConfig.requiredCapabilities,
      });

      if (!result.authorized) {
        logger.warn('[SyncProtocol] Handshake UCAN verification failed', {
          messageId: message.messageId,
          error: result.error,
        });
        return { valid: false, error: result.error || 'Unauthorized' };
      }
    }

    this.handshakes.set(message.sender, handshake);

    logger.debug('[SyncProtocol] Authenticated handshake verified', {
      messageId: message.messageId,
      did: handshake.did,
    });

    return { valid: true, handshake };
  }

  /**
   * Sign and optionally encrypt a message payload
   */
  async signMessage<T>(
    message: SyncMessage,
    payload: T,
    encrypt: boolean = false,
  ): Promise<SyncMessage> {
    if (!this.cryptoProvider || !this.cryptoProvider.isInitialized()) {
      throw new Error('Crypto provider not initialized');
    }

    const localDID = this.cryptoProvider.getLocalDID();

    // Sign the payload
    const signed = await this.cryptoProvider.signData(payload);

    message.auth = {
      senderDID: localDID || undefined,
      receiverDID: message.receiver || undefined,
      signature: signed.signature,
      encrypted: false,
    };

    // Encrypt if requested and we have a recipient
    if (encrypt && message.receiver && this.cryptoConfig?.encryptionMode !== 'none') {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      const encrypted = await this.cryptoProvider.encrypt(payloadBytes, message.receiver);

      message.payload = encrypted;
      message.auth.encrypted = true;

      logger.debug('[SyncProtocol] Message encrypted', {
        messageId: message.messageId,
        recipient: message.receiver,
      });
    } else {
      message.payload = payload;
    }

    return message;
  }

  /**
   * Verify signature and optionally decrypt a message
   */
  async verifyMessage<T>(
    message: SyncMessage,
  ): Promise<{ valid: boolean; payload?: T; error?: string }> {
    if (!this.cryptoProvider || !message.auth) {
      // No crypto or no auth - return payload as-is
      return { valid: true, payload: message.payload as T };
    }

    let payload = message.payload;

    // Decrypt if encrypted
    if (message.auth.encrypted && message.payload) {
      try {
        const encrypted = message.payload as {
          alg: string;
          ct: string;
          iv: string;
          tag: string;
          epk?: JsonWebKey;
        };

        const decrypted = await this.cryptoProvider.decrypt(
          encrypted,
          message.auth.senderDID,
        );

        payload = JSON.parse(new TextDecoder().decode(decrypted));

        logger.debug('[SyncProtocol] Message decrypted', {
          messageId: message.messageId,
        });
      } catch (error) {
        return {
          valid: false,
          error: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Verify signature if present
    if (message.auth.signature && message.auth.senderDID) {
      const signed = {
        payload,
        signature: message.auth.signature,
        signer: message.auth.senderDID,
        algorithm: 'ES256',
        signedAt: Date.now(),
      };

      const isValid = await this.cryptoProvider.verifySignedData(signed);
      if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
      }
    }

    return { valid: true, payload: payload as T };
  }

  /**
   * Create handshake message
   */
  createHandshakeMessage(
    nodeId: string,
    capabilities: string[],
  ): SyncMessage {
    const message: SyncMessage = {
      type: 'handshake',
      version: this.version,
      sender: nodeId,
      receiver: '',
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: {
        protocolVersion: this.version,
        nodeId,
        capabilities,
        state: 'initiating',
      } as Handshake,
    };

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    logger.debug('[SyncProtocol] Handshake message created', {
      messageId: message.messageId,
      nodeId,
      capabilities: capabilities.length,
    });

    return message;
  }

  /**
   * Create sync request message
   */
  createSyncRequestMessage(
    sender: string,
    receiver: string,
    sessionId: string,
    fromVersion: string,
    toVersion: string,
    filter?: Record<string, unknown>,
  ): SyncMessage {
    const message: SyncMessage = {
      type: 'sync-request',
      version: this.version,
      sender,
      receiver,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: {
        sessionId,
        fromVersion,
        toVersion,
        filter,
      } as SyncRequest,
    };

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    logger.debug('[SyncProtocol] Sync request created', {
      messageId: message.messageId,
      sessionId,
      fromVersion,
      toVersion,
    });

    return message;
  }

  /**
   * Create sync response message
   */
  createSyncResponseMessage(
    sender: string,
    receiver: string,
    sessionId: string,
    fromVersion: string,
    toVersion: string,
    data: unknown[],
    hasMore: boolean = false,
    offset: number = 0,
  ): SyncMessage {
    const message: SyncMessage = {
      type: 'sync-response',
      version: this.version,
      sender,
      receiver,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: {
        sessionId,
        fromVersion,
        toVersion,
        data,
        hasMore,
        offset,
      } as SyncResponse,
    };

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    logger.debug('[SyncProtocol] Sync response created', {
      messageId: message.messageId,
      sessionId,
      itemCount: data.length,
      hasMore,
    });

    return message;
  }

  /**
   * Create acknowledgement message
   */
  createAckMessage(sender: string, receiver: string, messageId: string): SyncMessage {
    const message: SyncMessage = {
      type: 'ack',
      version: this.version,
      sender,
      receiver,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: { acknowledgedMessageId: messageId },
    };

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    return message;
  }

  /**
   * Create error message
   */
  createErrorMessage(
    sender: string,
    receiver: string,
    error: ProtocolError,
    relatedMessageId?: string,
  ): SyncMessage {
    const message: SyncMessage = {
      type: 'error',
      version: this.version,
      sender,
      receiver,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      payload: {
        error,
        relatedMessageId,
      },
    };

    this.messageMap.set(message.messageId, message);
    this.messageQueue.push(message);

    this.protocolErrors.push({
      error,
      timestamp: new Date().toISOString(),
    });

    logger.error('[SyncProtocol] Error message created', {
      messageId: message.messageId,
      errorCode: error.code,
      recoverable: error.recoverable,
    });

    return message;
  }

  /**
   * Validate message
   */
  validateMessage(message: SyncMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message.type) {
      errors.push('Message type is required');
    }

    if (!message.sender) {
      errors.push('Sender is required');
    }

    if (!message.messageId) {
      errors.push('Message ID is required');
    }

    if (!message.timestamp) {
      errors.push('Timestamp is required');
    }

    try {
      new Date(message.timestamp);
    } catch {
      errors.push('Invalid timestamp format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serialize message
   */
  serializeMessage(message: SyncMessage): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      logger.error('[SyncProtocol] Message serialization failed', {
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(`Failed to serialize message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deserialize message
   */
  deserializeMessage(data: string): SyncMessage {
    try {
      const message = JSON.parse(data) as SyncMessage;
      const validation = this.validateMessage(message);

      if (!validation.valid) {
        throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
      }

      return message;
    } catch (error) {
      logger.error('[SyncProtocol] Message deserialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(`Failed to deserialize message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process handshake
   */
  processHandshake(message: SyncMessage): Handshake {
    if (message.type !== 'handshake') {
      throw new Error('Message is not a handshake');
    }

    const handshake = message.payload as Handshake;
    const nodeId = message.sender;

    this.handshakes.set(nodeId, handshake);

    logger.debug('[SyncProtocol] Handshake processed', {
      nodeId,
      protocolVersion: handshake.protocolVersion,
      capabilities: handshake.capabilities.length,
    });

    return handshake;
  }

  /**
   * Get message
   */
  getMessage(messageId: string): SyncMessage | undefined {
    return this.messageMap.get(messageId);
  }

  /**
   * Get all messages
   */
  getAllMessages(): SyncMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: SyncMessage['type']): SyncMessage[] {
    return this.messageQueue.filter(m => m.type === type);
  }

  /**
   * Get messages from sender
   */
  getMessagesFromSender(sender: string): SyncMessage[] {
    return this.messageQueue.filter(m => m.sender === sender);
  }

  /**
   * Get pending messages
   */
  getPendingMessages(receiver: string): SyncMessage[] {
    return this.messageQueue.filter(m => m.receiver === receiver);
  }

  /**
   * Get handshakes
   */
  getHandshakes(): Map<string, Handshake> {
    return new Map(this.handshakes);
  }

  /**
   * Get protocol statistics
   */
  getStatistics() {
    const messagesByType: Record<string, number> = {};
    for (const message of this.messageQueue) {
      messagesByType[message.type] = (messagesByType[message.type] || 0) + 1;
    }

    const errorCount = this.protocolErrors.length;
    const recoverableErrors = this.protocolErrors.filter(e => e.error.recoverable).length;

    return {
      totalMessages: this.messageQueue.length,
      messagesByType,
      totalHandshakes: this.handshakes.size,
      totalErrors: errorCount,
      recoverableErrors,
      unrecoverableErrors: errorCount - recoverableErrors,
    };
  }

  /**
   * Get protocol errors
   */
  getErrors(): Array<{ error: ProtocolError; timestamp: string }> {
    return [...this.protocolErrors];
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    this.messageCounter++;
    return `msg-${Date.now()}-${this.messageCounter}`;
  }

  /**
   * Clear all state (for testing)
   */
  clear(): void {
    this.messageQueue = [];
    this.messageMap.clear();
    this.handshakes.clear();
    this.protocolErrors = [];
    this.messageCounter = 0;
    this.cryptoProvider = null;
    this.cryptoConfig = null;
  }

  /**
   * Get the crypto provider (for advanced usage)
   */
  getCryptoProvider(): ICryptoProvider | null {
    return this.cryptoProvider;
  }
}
