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
 */

import { logger } from '../utils/logger';

export interface SyncMessage {
  type: 'handshake' | 'sync-request' | 'sync-response' | 'ack' | 'error';
  version: string;
  sender: string;
  receiver: string;
  messageId: string;
  timestamp: string;
  payload?: unknown;
}

export interface Handshake {
  protocolVersion: string;
  nodeId: string;
  capabilities: string[];
  state: 'initiating' | 'responding' | 'completed';
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

  /**
   * Get protocol version
   */
  getVersion(): string {
    return this.version;
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
  }
}
