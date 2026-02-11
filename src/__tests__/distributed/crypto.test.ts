/**
 * Crypto Integration Tests for Distributed Module
 *
 * Tests cryptographic functionality in SyncProtocol, SyncCoordinator,
 * StateReconciler, and ReplicationManager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SyncProtocol } from '../../distributed/SyncProtocol';
import { SyncCoordinator } from '../../distributed/SyncCoordinator';
import { StateReconciler } from '../../distributed/StateReconciler';
import { ReplicationManager } from '../../distributed/ReplicationManager';
import type { ICryptoProvider } from '../../crypto/CryptoProvider';
import type {
  AeonCapabilityResult,
  SignedSyncData,
  SecureNodeInfo,
} from '../../crypto/types';

/**
 * Mock Crypto Provider for testing
 */
class MockCryptoProvider implements ICryptoProvider {
  private did: string;
  private initialized: boolean;
  private remoteNodes: Map<string, SecureNodeInfo> = new Map();
  private verifyResult: boolean = true;
  private ucanVerifyResult: AeonCapabilityResult = { authorized: true };
  private failEncryption: boolean = false;
  private failDecryption: boolean = false;

  constructor(
    did: string = 'did:key:zTestLocal123',
    initialized: boolean = true,
  ) {
    this.did = did;
    this.initialized = initialized;
  }

  setVerifyResult(result: boolean): void {
    this.verifyResult = result;
  }

  setUCANVerifyResult(result: AeonCapabilityResult): void {
    this.ucanVerifyResult = result;
  }

  setFailEncryption(fail: boolean): void {
    this.failEncryption = fail;
  }

  setFailDecryption(fail: boolean): void {
    this.failDecryption = fail;
  }

  async generateIdentity(displayName?: string): Promise<{
    did: string;
    publicSigningKey: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
  }> {
    return {
      did: this.did,
      publicSigningKey: {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
      },
      publicEncryptionKey: {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-enc-x',
        y: 'test-enc-y',
      },
    };
  }

  getLocalDID(): string | null {
    return this.initialized ? this.did : null;
  }

  async exportPublicIdentity(): Promise<SecureNodeInfo | null> {
    if (!this.initialized) return null;
    return {
      id: 'local-node',
      did: this.did,
      publicSigningKey: {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-x',
        y: 'test-y',
      },
      publicEncryptionKey: {
        kty: 'EC',
        crv: 'P-256',
        x: 'test-enc-x',
        y: 'test-enc-y',
      },
    };
  }

  async registerRemoteNode(node: SecureNodeInfo): Promise<void> {
    this.remoteNodes.set(node.did, node);
  }

  async getRemotePublicKey(did: string): Promise<JsonWebKey | null> {
    const node = this.remoteNodes.get(did);
    return node?.publicSigningKey || null;
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    // Return a mock signature
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async signData<T>(data: T): Promise<SignedSyncData<T>> {
    return {
      payload: data,
      signature: 'mock-signature-base64',
      signer: this.did,
      algorithm: 'ES256',
      signedAt: Date.now(),
    };
  }

  async verify(
    did: string,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean> {
    return this.verifyResult;
  }

  async verifySignedData<T>(signedData: SignedSyncData<T>): Promise<boolean> {
    return this.verifyResult;
  }

  async encrypt(
    plaintext: Uint8Array,
    recipientDID: string,
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    epk?: JsonWebKey;
    encryptedAt: number;
  }> {
    if (this.failEncryption) {
      throw new Error('Encryption failed');
    }
    // Convert plaintext to base64 for mock
    const ct = btoa(String.fromCharCode(...plaintext));
    return {
      alg: 'ECIES-P256',
      ct,
      iv: 'mock-iv-base64',
      tag: 'mock-tag-base64',
      epk: {
        kty: 'EC',
        crv: 'P-256',
        x: 'ephemeral-x',
        y: 'ephemeral-y',
      },
      encryptedAt: Date.now(),
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
    senderDID?: string,
  ): Promise<Uint8Array> {
    if (this.failDecryption) {
      throw new Error('Decryption failed');
    }
    // Decode mock ciphertext
    const decoded = atob(encrypted.ct);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }

  async getSessionKey(peerDID: string): Promise<Uint8Array> {
    return new Uint8Array(32).fill(42);
  }

  async encryptWithSessionKey(
    plaintext: Uint8Array,
    sessionKey: Uint8Array,
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    encryptedAt: number;
  }> {
    const ct = btoa(String.fromCharCode(...plaintext));
    return {
      alg: 'AES-256-GCM',
      ct,
      iv: 'mock-session-iv',
      tag: 'mock-session-tag',
      encryptedAt: Date.now(),
    };
  }

  async decryptWithSessionKey(
    encrypted: {
      ct: string;
      iv: string;
      tag: string;
    },
    sessionKey: Uint8Array,
  ): Promise<Uint8Array> {
    const decoded = atob(encrypted.ct);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }

  async createUCAN(
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
      proofs?: string[];
    },
  ): Promise<string> {
    // Return a mock UCAN token
    const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        iss: this.did,
        aud: audience,
        att: capabilities,
        exp:
          Math.floor(Date.now() / 1000) + (options?.expirationSeconds || 3600),
        prf: options?.proofs || [],
      }),
    );
    return `${header}.${payload}.mock-signature`;
  }

  async verifyUCAN(
    token: string,
    options?: {
      expectedAudience?: string;
      requiredCapabilities?: Array<{ can: string; with: string }>;
    },
  ): Promise<AeonCapabilityResult> {
    return this.ucanVerifyResult;
  }

  async delegateCapabilities(
    parentToken: string,
    audience: string,
    capabilities: Array<{ can: string; with: string }>,
    options?: {
      expirationSeconds?: number;
    },
  ): Promise<string> {
    return this.createUCAN(audience, capabilities, {
      ...options,
      proofs: [parentToken],
    });
  }

  async hash(data: Uint8Array): Promise<Uint8Array> {
    // Simple mock hash
    const sum = data.reduce((a, b) => a + b, 0);
    return new Uint8Array([sum % 256, (sum >> 8) % 256]);
  }

  randomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

describe('Crypto Integration', () => {
  describe('SyncProtocol Crypto', () => {
    let protocol: SyncProtocol;
    let cryptoProvider: MockCryptoProvider;

    beforeEach(() => {
      protocol = new SyncProtocol();
      cryptoProvider = new MockCryptoProvider();
    });

    describe('configureCrypto', () => {
      it('should configure crypto provider with default options', () => {
        protocol.configureCrypto(cryptoProvider);

        expect(protocol.isCryptoEnabled()).toBe(true);
        const config = protocol.getCryptoConfig();
        expect(config).toBeDefined();
        expect(config!.encryptionMode).toBe('none');
        expect(config!.requireSignatures).toBe(false);
        expect(config!.requireCapabilities).toBe(false);
      });

      it('should configure crypto with custom options', () => {
        protocol.configureCrypto(cryptoProvider, {
          encryptionMode: 'end-to-end',
          requireSignatures: true,
          requireCapabilities: true,
          requiredCapabilities: [{ can: 'aeon:sync:*', with: '*' }],
        });

        const config = protocol.getCryptoConfig();
        expect(config!.encryptionMode).toBe('end-to-end');
        expect(config!.requireSignatures).toBe(true);
        expect(config!.requireCapabilities).toBe(true);
        expect(config!.requiredCapabilities).toHaveLength(1);
      });

      it('should return false for isCryptoEnabled when not configured', () => {
        expect(protocol.isCryptoEnabled()).toBe(false);
      });

      it('should return null for getCryptoConfig when not configured', () => {
        expect(protocol.getCryptoConfig()).toBeNull();
      });

      it('should return crypto provider via getCryptoProvider', () => {
        protocol.configureCrypto(cryptoProvider);
        expect(protocol.getCryptoProvider()).toBe(cryptoProvider);
      });

      it('should return null for getCryptoProvider when not configured', () => {
        expect(protocol.getCryptoProvider()).toBeNull();
      });
    });

    describe('createAuthenticatedHandshake', () => {
      it('should create authenticated handshake with DID', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = await protocol.createAuthenticatedHandshake([
          'sync',
          'replicate',
        ]);

        expect(message.type).toBe('handshake');
        expect(message.sender).toBe('did:key:zTestLocal123');

        const payload = message.payload as {
          did?: string;
          publicSigningKey?: JsonWebKey;
        };
        expect(payload.did).toBe('did:key:zTestLocal123');
        expect(payload.publicSigningKey).toBeDefined();
      });

      it('should create handshake with UCAN when capabilities required', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireCapabilities: true,
          requiredCapabilities: [{ can: 'aeon:sync:read', with: '*' }],
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        const payload = message.payload as { ucan?: string };
        expect(payload.ucan).toBeDefined();
        expect(payload.ucan).toContain('.');
      });

      it('should sign handshake when signatures required', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireSignatures: true,
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        expect(message.auth).toBeDefined();
        expect(message.auth!.signature).toBe('mock-signature-base64');
        expect(message.auth!.senderDID).toBe('did:key:zTestLocal123');
      });

      it('should throw when crypto provider not initialized', async () => {
        const uninitializedProvider = new MockCryptoProvider('test-did', false);
        protocol.configureCrypto(uninitializedProvider);

        await expect(
          protocol.createAuthenticatedHandshake(['sync']),
        ).rejects.toThrow('Crypto provider not initialized');
      });

      it('should throw when no crypto provider configured', async () => {
        await expect(
          protocol.createAuthenticatedHandshake(['sync']),
        ).rejects.toThrow('Crypto provider not initialized');
      });

      it('should add message to queue', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = await protocol.createAuthenticatedHandshake(['sync']);

        const allMessages = protocol.getAllMessages();
        expect(allMessages).toContainEqual(message);
      });
    });

    describe('verifyAuthenticatedHandshake', () => {
      it('should verify valid handshake without crypto', async () => {
        const message = protocol.createHandshakeMessage('node-1', ['sync']);

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(true);
        expect(result.handshake).toBeDefined();
      });

      it('should reject non-handshake message', async () => {
        const message = protocol.createSyncRequestMessage(
          'node-1',
          'node-2',
          'session-1',
          '1.0',
          '1.1',
        );

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Message is not a handshake');
      });

      it('should verify handshake signature when required', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireSignatures: true,
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(true);
      });

      it('should reject handshake with invalid signature', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireSignatures: true,
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        // Make verification fail
        cryptoProvider.setVerifyResult(false);

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid signature');
      });

      it('should verify UCAN when capabilities required', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireCapabilities: true,
          requiredCapabilities: [{ can: 'aeon:sync:read', with: '*' }],
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(true);
      });

      it('should reject handshake with unauthorized UCAN', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireCapabilities: true,
          requiredCapabilities: [{ can: 'aeon:sync:write', with: '*' }],
        });

        const message = await protocol.createAuthenticatedHandshake(
          ['sync'],
          'did:key:zRemote456',
        );

        // Make UCAN verification fail
        cryptoProvider.setUCANVerifyResult({
          authorized: false,
          error: 'Missing required capability',
        });

        const result = await protocol.verifyAuthenticatedHandshake(message);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Missing required capability');
      });

      it('should register remote node keys', async () => {
        protocol.configureCrypto(cryptoProvider);

        // Create a handshake message from a remote node
        const remoteHandshake = {
          type: 'handshake' as const,
          version: '1.0.0',
          sender: 'did:key:zRemote789',
          receiver: 'did:key:zTestLocal123',
          messageId: 'msg-1',
          timestamp: new Date().toISOString(),
          payload: {
            protocolVersion: '1.0.0',
            nodeId: 'did:key:zRemote789',
            capabilities: ['sync'],
            state: 'initiating',
            did: 'did:key:zRemote789',
            publicSigningKey: {
              kty: 'EC',
              crv: 'P-256',
              x: 'remote-x',
              y: 'remote-y',
            },
          },
        };

        await protocol.verifyAuthenticatedHandshake(remoteHandshake);

        // Check that the node was registered
        const publicKey =
          await cryptoProvider.getRemotePublicKey('did:key:zRemote789');
        expect(publicKey).toBeDefined();
        expect(publicKey!.x).toBe('remote-x');
      });
    });

    describe('signMessage', () => {
      it('should sign message payload', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = protocol.createSyncRequestMessage(
          'node-1',
          'node-2',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'test' };
        const signed = await protocol.signMessage(message, payload);

        expect(signed.auth).toBeDefined();
        expect(signed.auth!.signature).toBe('mock-signature-base64');
        expect(signed.auth!.encrypted).toBe(false);
      });

      it('should encrypt payload when requested', async () => {
        protocol.configureCrypto(cryptoProvider, {
          encryptionMode: 'end-to-end',
        });

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'secret' };
        const signed = await protocol.signMessage(message, payload, true);

        expect(signed.auth!.encrypted).toBe(true);
        expect(signed.payload).toHaveProperty('alg');
        expect(signed.payload).toHaveProperty('ct');
        expect(signed.payload).toHaveProperty('iv');
      });

      it('should not encrypt when encryption mode is none', async () => {
        protocol.configureCrypto(cryptoProvider, {
          encryptionMode: 'none',
        });

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'test' };
        const signed = await protocol.signMessage(message, payload, true);

        expect(signed.auth!.encrypted).toBe(false);
        expect(signed.payload).toEqual(payload);
      });

      it('should throw when crypto not initialized', async () => {
        const message = protocol.createSyncRequestMessage(
          'node-1',
          'node-2',
          'session-1',
          '1.0',
          '1.1',
        );

        await expect(
          protocol.signMessage(message, { data: 'test' }),
        ).rejects.toThrow('Crypto provider not initialized');
      });
    });

    describe('verifyMessage', () => {
      it('should verify and return payload when no crypto', async () => {
        const message = protocol.createSyncRequestMessage(
          'node-1',
          'node-2',
          'session-1',
          '1.0',
          '1.1',
        );

        const result = await protocol.verifyMessage(message);

        expect(result.valid).toBe(true);
        expect(result.payload).toBeDefined();
      });

      it('should verify signed message', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'test' };
        const signed = await protocol.signMessage(message, payload);

        const result = await protocol.verifyMessage<typeof payload>(signed);

        expect(result.valid).toBe(true);
        expect(result.payload).toEqual(payload);
      });

      it('should reject message with invalid signature', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'test' };
        const signed = await protocol.signMessage(message, payload);

        // Make verification fail
        cryptoProvider.setVerifyResult(false);

        const result = await protocol.verifyMessage(signed);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid signature');
      });

      it('should decrypt encrypted message', async () => {
        protocol.configureCrypto(cryptoProvider, {
          encryptionMode: 'end-to-end',
        });

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'secret' };
        const signed = await protocol.signMessage(message, payload, true);

        const result = await protocol.verifyMessage<typeof payload>(signed);

        expect(result.valid).toBe(true);
        expect(result.payload).toEqual(payload);
      });

      it('should return error when decryption fails', async () => {
        protocol.configureCrypto(cryptoProvider, {
          encryptionMode: 'end-to-end',
        });

        const message = protocol.createSyncRequestMessage(
          'did:key:zLocal',
          'did:key:zRemote',
          'session-1',
          '1.0',
          '1.1',
        );

        const payload = { data: 'secret' };
        const signed = await protocol.signMessage(message, payload, true);

        // Make decryption fail
        cryptoProvider.setFailDecryption(true);

        const result = await protocol.verifyMessage(signed);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('Decryption failed');
      });

      it('should return payload as-is when no auth field', async () => {
        protocol.configureCrypto(cryptoProvider);

        const message = protocol.createSyncRequestMessage(
          'node-1',
          'node-2',
          'session-1',
          '1.0',
          '1.1',
        );
        // Message has no auth field

        const result = await protocol.verifyMessage(message);

        expect(result.valid).toBe(true);
        expect(result.payload).toBeDefined();
      });
    });

    describe('clear', () => {
      it('should clear crypto state', async () => {
        protocol.configureCrypto(cryptoProvider, {
          requireSignatures: true,
        });

        expect(protocol.isCryptoEnabled()).toBe(true);

        protocol.clear();

        expect(protocol.isCryptoEnabled()).toBe(false);
        expect(protocol.getCryptoConfig()).toBeNull();
        expect(protocol.getCryptoProvider()).toBeNull();
      });
    });
  });

  describe('NullCryptoProvider', () => {
    let protocol: SyncProtocol;
    let nullProvider: ICryptoProvider;

    beforeEach(async () => {
      // Import NullCryptoProvider dynamically
      const { NullCryptoProvider } = await import(
        '../../crypto/CryptoProvider'
      );
      nullProvider = new NullCryptoProvider();
      protocol = new SyncProtocol();
    });

    it('should not be initialized', () => {
      expect(nullProvider.isInitialized()).toBe(false);
    });

    it('should return null for getLocalDID', () => {
      expect(nullProvider.getLocalDID()).toBeNull();
    });

    it('should return null for exportPublicIdentity', async () => {
      const result = await nullProvider.exportPublicIdentity();
      expect(result).toBeNull();
    });

    it('should return null for getRemotePublicKey', async () => {
      const result = await nullProvider.getRemotePublicKey('did:key:z123');
      expect(result).toBeNull();
    });

    it('should throw on generateIdentity', async () => {
      await expect(nullProvider.generateIdentity()).rejects.toThrow(
        'Crypto provider not configured',
      );
    });

    it('should throw on sign', async () => {
      await expect(
        nullProvider.sign(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on signData', async () => {
      await expect(nullProvider.signData({ test: 'data' })).rejects.toThrow(
        'Crypto provider not configured',
      );
    });

    it('should return true for verify (permissive)', async () => {
      const result = await nullProvider.verify(
        'did:key:z123',
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
      );
      expect(result).toBe(true);
    });

    it('should return true for verifySignedData (permissive)', async () => {
      const result = await nullProvider.verifySignedData({
        payload: { test: 'data' },
        signature: 'sig',
        signer: 'did:key:z123',
        algorithm: 'ES256',
        signedAt: Date.now(),
      });
      expect(result).toBe(true);
    });

    it('should throw on encrypt', async () => {
      await expect(
        nullProvider.encrypt(new Uint8Array([1, 2, 3]), 'did:key:z123'),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on decrypt', async () => {
      await expect(
        nullProvider.decrypt({
          alg: 'test',
          ct: 'test',
          iv: 'test',
          tag: 'test',
        }),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on getSessionKey', async () => {
      await expect(nullProvider.getSessionKey('did:key:z123')).rejects.toThrow(
        'Crypto provider not configured',
      );
    });

    it('should throw on encryptWithSessionKey', async () => {
      await expect(
        nullProvider.encryptWithSessionKey(
          new Uint8Array([1, 2, 3]),
          new Uint8Array(32),
        ),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on decryptWithSessionKey', async () => {
      await expect(
        nullProvider.decryptWithSessionKey(
          { ct: 'test', iv: 'test', tag: 'test' },
          new Uint8Array(32),
        ),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on createUCAN', async () => {
      await expect(
        nullProvider.createUCAN('did:key:z123', [{ can: 'read', with: '*' }]),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should return authorized for verifyUCAN (permissive)', async () => {
      const result = await nullProvider.verifyUCAN('mock.token.here');
      expect(result.authorized).toBe(true);
    });

    it('should throw on delegateCapabilities', async () => {
      await expect(
        nullProvider.delegateCapabilities('parent-token', 'did:key:z123', [
          { can: 'read', with: '*' },
        ]),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should throw on hash', async () => {
      await expect(
        nullProvider.hash(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow('Crypto provider not configured');
    });

    it('should generate random bytes', () => {
      const bytes = nullProvider.randomBytes(16);
      expect(bytes.length).toBe(16);

      // Should be random (different each time)
      const bytes2 = nullProvider.randomBytes(16);
      expect(bytes).not.toEqual(bytes2);
    });

    it('should return null for exportPublicIdentity', async () => {
      const result = await nullProvider.exportPublicIdentity();
      expect(result).toBeNull();
    });

    it('should not enable crypto when configured with NullCryptoProvider', () => {
      protocol.configureCrypto(nullProvider);
      expect(protocol.isCryptoEnabled()).toBe(false);
    });
  });

  describe('SyncCoordinator Crypto', () => {
    let coordinator: SyncCoordinator;
    let cryptoProvider: MockCryptoProvider;

    beforeEach(() => {
      coordinator = new SyncCoordinator();
      cryptoProvider = new MockCryptoProvider();
    });

    afterEach(() => {
      coordinator.stopHeartbeatMonitoring();
      coordinator.clear();
    });

    describe('configureCrypto', () => {
      it('should configure crypto provider', () => {
        coordinator.configureCrypto(cryptoProvider);

        expect(coordinator.isCryptoEnabled()).toBe(true);
        expect(coordinator.getCryptoProvider()).toBe(cryptoProvider);
      });

      it('should return false for isCryptoEnabled when not configured', () => {
        expect(coordinator.isCryptoEnabled()).toBe(false);
      });

      it('should return null for getCryptoProvider when not configured', () => {
        expect(coordinator.getCryptoProvider()).toBeNull();
      });
    });

    describe('registerAuthenticatedNode', () => {
      it('should register node with DID', async () => {
        coordinator.configureCrypto(cryptoProvider);

        const node = await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        expect(node.id).toBe('node-1');
        expect(node.did).toBe('did:key:zNode1');
        expect(node.publicSigningKey).toBeDefined();
      });

      it('should register node with crypto provider', async () => {
        coordinator.configureCrypto(cryptoProvider);

        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
          publicEncryptionKey: { kty: 'EC', crv: 'P-256', x: 'ex1', y: 'ey1' },
        });

        const publicKey =
          await cryptoProvider.getRemotePublicKey('did:key:zNode1');
        expect(publicKey).toBeDefined();
        expect(publicKey!.x).toBe('x1');
      });

      it('should emit node-joined event', async () => {
        let emittedNode: unknown = null;
        coordinator.on('node-joined', (node) => {
          emittedNode = node;
        });

        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        expect(emittedNode).toBeDefined();
        expect((emittedNode as { did: string }).did).toBe('did:key:zNode1');
      });
    });

    describe('getNodeByDID', () => {
      it('should find node by DID', async () => {
        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        const node = coordinator.getNodeByDID('did:key:zNode1');

        expect(node).toBeDefined();
        expect(node!.id).toBe('node-1');
      });

      it('should return undefined for unknown DID', () => {
        const node = coordinator.getNodeByDID('did:key:zUnknown');

        expect(node).toBeUndefined();
      });
    });

    describe('getAuthenticatedNodes', () => {
      it('should return only nodes with DIDs', async () => {
        coordinator.registerNode({
          id: 'node-anon',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
        });

        await coordinator.registerAuthenticatedNode({
          id: 'node-auth',
          address: 'localhost',
          port: 3001,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNodeAuth',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        const authenticatedNodes = coordinator.getAuthenticatedNodes();

        expect(authenticatedNodes).toHaveLength(1);
        expect(authenticatedNodes[0].id).toBe('node-auth');
      });
    });

    describe('createAuthenticatedSyncSession', () => {
      beforeEach(async () => {
        coordinator.configureCrypto(cryptoProvider);

        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        await coordinator.registerAuthenticatedNode({
          id: 'node-2',
          address: 'localhost',
          port: 3001,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode2',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x2', y: 'y2' },
        });
      });

      it('should create authenticated sync session', async () => {
        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
        );

        expect(session.initiatorDID).toBe('did:key:zNode1');
        expect(session.participantDIDs).toContain('did:key:zNode2');
        expect(session.status).toBe('pending');
      });

      it('should create session with encryption mode', async () => {
        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
          { encryptionMode: 'end-to-end' },
        );

        expect(session.encryptionMode).toBe('end-to-end');
      });

      it('should create session token when crypto available', async () => {
        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
          { requiredCapabilities: ['aeon:sync:read'] },
        );

        expect(session.sessionToken).toBeDefined();
        expect(session.sessionToken).toContain('.');
      });

      it('should throw for unknown initiator DID', async () => {
        await expect(
          coordinator.createAuthenticatedSyncSession('did:key:zUnknown', [
            'did:key:zNode2',
          ]),
        ).rejects.toThrow('Initiator node with DID did:key:zUnknown not found');
      });

      it('should emit sync-started event', async () => {
        let emittedSession: unknown = null;
        coordinator.on('sync-started', (session) => {
          emittedSession = session;
        });

        await coordinator.createAuthenticatedSyncSession('did:key:zNode1', [
          'did:key:zNode2',
        ]);

        expect(emittedSession).toBeDefined();
        expect((emittedSession as { initiatorDID: string }).initiatorDID).toBe(
          'did:key:zNode1',
        );
      });
    });

    describe('verifyNodeCapabilities', () => {
      beforeEach(async () => {
        coordinator.configureCrypto(cryptoProvider);

        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        await coordinator.registerAuthenticatedNode({
          id: 'node-2',
          address: 'localhost',
          port: 3001,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode2',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x2', y: 'y2' },
        });
      });

      it('should verify authorized node', async () => {
        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
        );

        const result = await coordinator.verifyNodeCapabilities(
          session.id,
          'did:key:zNode2',
          'mock.token.here',
        );

        expect(result.authorized).toBe(true);
      });

      it('should reject unauthorized node', async () => {
        cryptoProvider.setUCANVerifyResult({
          authorized: false,
          error: 'Missing capability',
        });

        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
        );

        const result = await coordinator.verifyNodeCapabilities(
          session.id,
          'did:key:zNode2',
          'mock.token.here',
        );

        expect(result.authorized).toBe(false);
        expect(result.error).toBe('Missing capability');
      });

      it('should return authorized without crypto', async () => {
        coordinator.clear();

        coordinator.registerNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
        });

        const session = coordinator.createSyncSession('node-1', ['node-2']);

        const result = await coordinator.verifyNodeCapabilities(
          session.id,
          'did:key:zNode2',
          'mock.token.here',
        );

        expect(result.authorized).toBe(true);
      });

      it('should return error for unknown session', async () => {
        const result = await coordinator.verifyNodeCapabilities(
          'unknown-session',
          'did:key:zNode2',
          'mock.token.here',
        );

        expect(result.authorized).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should verify capabilities with session requiredCapabilities', async () => {
        // Create session with requiredCapabilities set
        const session = await coordinator.createAuthenticatedSyncSession(
          'did:key:zNode1',
          ['did:key:zNode2'],
          { requiredCapabilities: ['aeon:sync:read', 'aeon:sync:write'] },
        );

        expect(session.requiredCapabilities).toBeDefined();
        expect(session.requiredCapabilities).toContain('aeon:sync:read');

        // Verify - this should use the requiredCapabilities mapping
        const result = await coordinator.verifyNodeCapabilities(
          session.id,
          'did:key:zNode2',
          'mock.token.here',
        );

        expect(result.authorized).toBe(true);
      });
    });

    describe('clear', () => {
      it('should clear crypto state', async () => {
        coordinator.configureCrypto(cryptoProvider);

        await coordinator.registerAuthenticatedNode({
          id: 'node-1',
          address: 'localhost',
          port: 3000,
          status: 'online',
          lastHeartbeat: new Date().toISOString(),
          version: '1.0.0',
          capabilities: ['sync'],
          did: 'did:key:zNode1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        coordinator.clear();

        expect(coordinator.isCryptoEnabled()).toBe(false);
        expect(coordinator.getNodeByDID('did:key:zNode1')).toBeUndefined();
        expect(coordinator.getNodes()).toHaveLength(0);
      });
    });
  });

  describe('StateReconciler Crypto', () => {
    let reconciler: StateReconciler;
    let cryptoProvider: MockCryptoProvider;

    beforeEach(() => {
      reconciler = new StateReconciler();
      cryptoProvider = new MockCryptoProvider();
    });

    afterEach(() => {
      reconciler.clear();
    });

    describe('configureCrypto', () => {
      it('should configure crypto provider', () => {
        reconciler.configureCrypto(cryptoProvider);

        expect(reconciler.isCryptoEnabled()).toBe(true);
        expect(reconciler.getCryptoProvider()).toBe(cryptoProvider);
      });

      it('should configure with requireSigned option', () => {
        reconciler.configureCrypto(cryptoProvider, true);

        expect(reconciler.isCryptoEnabled()).toBe(true);
      });

      it('should return false for isCryptoEnabled when not configured', () => {
        expect(reconciler.isCryptoEnabled()).toBe(false);
      });
    });

    describe('recordSignedStateVersion', () => {
      it('should record signed state version', async () => {
        reconciler.configureCrypto(cryptoProvider);

        const stateVersion = await reconciler.recordSignedStateVersion(
          'user:123',
          '1.0',
          { name: 'Alice', age: 30 },
        );

        expect(stateVersion.version).toBe('1.0');
        expect(stateVersion.signerDID).toBe('did:key:zTestLocal123');
        expect(stateVersion.signature).toBeDefined();
        expect(stateVersion.hash).toBeDefined();
      });

      it('should throw when crypto not initialized', async () => {
        await expect(
          reconciler.recordSignedStateVersion('key', '1.0', { data: 'test' }),
        ).rejects.toThrow('Crypto provider not initialized');
      });

      it('should add version to tracked versions', async () => {
        reconciler.configureCrypto(cryptoProvider);

        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });

        const versions = reconciler.getStateVersions('user:123');
        expect(versions).toHaveLength(1);
        expect(versions[0].signature).toBeDefined();
      });
    });

    describe('verifyStateVersion', () => {
      it('should verify signed state version', async () => {
        reconciler.configureCrypto(cryptoProvider);

        const stateVersion = await reconciler.recordSignedStateVersion(
          'user:123',
          '1.0',
          { name: 'Alice' },
        );

        const result = await reconciler.verifyStateVersion(stateVersion);

        expect(result.valid).toBe(true);
      });

      it('should reject invalid signature', async () => {
        reconciler.configureCrypto(cryptoProvider);

        const stateVersion = await reconciler.recordSignedStateVersion(
          'user:123',
          '1.0',
          { name: 'Alice' },
        );

        cryptoProvider.setVerifyResult(false);

        const result = await reconciler.verifyStateVersion(stateVersion);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid signature');
      });

      it('should verify unsigned version when not required', async () => {
        // Without crypto configured, unsigned versions pass
        const unsignedVersion = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          nodeId: 'node-1',
          hash: 'somehash',
          data: { name: 'Alice' },
        };

        const result = await reconciler.verifyStateVersion(unsignedVersion);

        expect(result.valid).toBe(true);
      });

      it('should reject unsigned version when required', async () => {
        reconciler.configureCrypto(cryptoProvider, true);

        const unsignedVersion = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          nodeId: 'node-1',
          hash: 'somehash',
          data: { name: 'Alice' },
        };

        const result = await reconciler.verifyStateVersion(unsignedVersion);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Signature required but not present');
      });

      it('should return error when crypto not configured for signed version', async () => {
        const signedVersion = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          nodeId: 'node-1',
          hash: 'somehash',
          data: { name: 'Alice' },
          signerDID: 'did:key:z123',
          signature: 'some-sig',
        };

        const result = await reconciler.verifyStateVersion(signedVersion);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Crypto provider not configured');
      });
    });

    describe('reconcileWithVerification', () => {
      it('should reconcile with verified versions only', async () => {
        reconciler.configureCrypto(cryptoProvider);

        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });
        await reconciler.recordSignedStateVersion('user:123', '1.1', {
          name: 'Bob',
        });

        const result = await reconciler.reconcileWithVerification('user:123');

        expect(result.success).toBe(true);
        expect(result.verificationErrors).toHaveLength(0);
        expect(result.conflictsResolved).toBe(1);
      });

      it('should exclude invalid versions', async () => {
        reconciler.configureCrypto(cryptoProvider);

        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });

        // Make next version fail verification
        cryptoProvider.setVerifyResult(false);
        await reconciler.recordSignedStateVersion('user:123', '1.1', {
          name: 'Bob',
        });

        const result = await reconciler.reconcileWithVerification('user:123');

        expect(result.verificationErrors.length).toBeGreaterThan(0);
      });

      it('should return failure when no versions pass verification', async () => {
        reconciler.configureCrypto(cryptoProvider, true);

        reconciler.recordStateVersion(
          'user:123',
          '1.0',
          new Date().toISOString(),
          'node-1',
          'hash',
          { name: 'Alice' },
        );

        const result = await reconciler.reconcileWithVerification('user:123');

        expect(result.success).toBe(false);
        expect(result.mergedState).toBeNull();
      });

      it('should use specified strategy', async () => {
        reconciler.configureCrypto(cryptoProvider);

        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });
        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });
        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Bob',
        });

        const result = await reconciler.reconcileWithVerification(
          'user:123',
          'majority-vote',
        );

        expect(result.success).toBe(true);
        expect(result.strategy).toBe('majority-vote');
      });
    });

    describe('clear', () => {
      it('should clear crypto state', async () => {
        reconciler.configureCrypto(cryptoProvider, true);

        await reconciler.recordSignedStateVersion('user:123', '1.0', {
          name: 'Alice',
        });

        reconciler.clear();

        expect(reconciler.isCryptoEnabled()).toBe(false);
        expect(reconciler.getStateVersions('user:123')).toHaveLength(0);
      });
    });
  });

  describe('ReplicationManager Crypto', () => {
    let replicationManager: ReplicationManager;
    let cryptoProvider: MockCryptoProvider;

    beforeEach(() => {
      replicationManager = new ReplicationManager();
      cryptoProvider = new MockCryptoProvider();
    });

    afterEach(() => {
      replicationManager.clear();
    });

    describe('configureCrypto', () => {
      it('should configure crypto provider', () => {
        replicationManager.configureCrypto(cryptoProvider);

        expect(replicationManager.isCryptoEnabled()).toBe(true);
        expect(replicationManager.getCryptoProvider()).toBe(cryptoProvider);
      });

      it('should return false for isCryptoEnabled when not configured', () => {
        expect(replicationManager.isCryptoEnabled()).toBe(false);
      });
    });

    describe('registerAuthenticatedReplica', () => {
      it('should register replica with DID', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        const replica = await replicationManager.registerAuthenticatedReplica({
          id: 'replica-1',
          nodeId: 'node-1',
          status: 'primary',
          lastSyncTime: new Date().toISOString(),
          lagBytes: 0,
          lagMillis: 0,
          did: 'did:key:zReplica1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
        });

        expect(replica.did).toBe('did:key:zReplica1');
      });

      it('should register replica with encryption flag', async () => {
        const replica = await replicationManager.registerAuthenticatedReplica(
          {
            id: 'replica-1',
            nodeId: 'node-1',
            status: 'primary',
            lastSyncTime: new Date().toISOString(),
            lagBytes: 0,
            lagMillis: 0,
            did: 'did:key:zReplica1',
          },
          true,
        );

        expect(replica.encrypted).toBe(true);
      });

      it('should register with crypto provider when keys provided', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        await replicationManager.registerAuthenticatedReplica({
          id: 'replica-1',
          nodeId: 'node-1',
          status: 'primary',
          lastSyncTime: new Date().toISOString(),
          lagBytes: 0,
          lagMillis: 0,
          did: 'did:key:zReplica1',
          publicSigningKey: { kty: 'EC', crv: 'P-256', x: 'x1', y: 'y1' },
          publicEncryptionKey: { kty: 'EC', crv: 'P-256', x: 'ex1', y: 'ey1' },
        });

        const publicKey =
          await cryptoProvider.getRemotePublicKey('did:key:zReplica1');
        expect(publicKey).toBeDefined();
      });
    });

    describe('getReplicaByDID', () => {
      it('should find replica by DID', async () => {
        await replicationManager.registerAuthenticatedReplica({
          id: 'replica-1',
          nodeId: 'node-1',
          status: 'primary',
          lastSyncTime: new Date().toISOString(),
          lagBytes: 0,
          lagMillis: 0,
          did: 'did:key:zReplica1',
        });

        const replica = replicationManager.getReplicaByDID('did:key:zReplica1');

        expect(replica).toBeDefined();
        expect(replica!.id).toBe('replica-1');
      });

      it('should return undefined for unknown DID', () => {
        const replica = replicationManager.getReplicaByDID('did:key:zUnknown');

        expect(replica).toBeUndefined();
      });
    });

    describe('getEncryptedReplicas', () => {
      it('should return only encrypted replicas', async () => {
        await replicationManager.registerAuthenticatedReplica(
          {
            id: 'replica-1',
            nodeId: 'node-1',
            status: 'primary',
            lastSyncTime: new Date().toISOString(),
            lagBytes: 0,
            lagMillis: 0,
            did: 'did:key:zReplica1',
          },
          true,
        );

        await replicationManager.registerAuthenticatedReplica(
          {
            id: 'replica-2',
            nodeId: 'node-2',
            status: 'secondary',
            lastSyncTime: new Date().toISOString(),
            lagBytes: 0,
            lagMillis: 0,
            did: 'did:key:zReplica2',
          },
          false,
        );

        const encrypted = replicationManager.getEncryptedReplicas();

        expect(encrypted).toHaveLength(1);
        expect(encrypted[0].id).toBe('replica-1');
      });
    });

    describe('encryptForReplica / decryptReplicationData', () => {
      it('should encrypt and decrypt data for replica', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        const data = { name: 'Alice', value: 42 };

        const encrypted = await replicationManager.encryptForReplica(
          data,
          'did:key:zTarget',
        );

        expect(encrypted.ct).toBeDefined();
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.tag).toBeDefined();
        expect(encrypted.targetDID).toBe('did:key:zTarget');
        expect(encrypted.senderDID).toBe('did:key:zTestLocal123');

        const decrypted =
          await replicationManager.decryptReplicationData<typeof data>(
            encrypted,
          );

        expect(decrypted).toEqual(data);
      });

      it('should throw when crypto not initialized for encryption', async () => {
        await expect(
          replicationManager.encryptForReplica({ data: 'test' }, 'did:key:z'),
        ).rejects.toThrow('Crypto provider not initialized');
      });

      it('should throw when crypto not initialized for decryption', async () => {
        const mockEncrypted = {
          ct: 'test',
          iv: 'test',
          tag: 'test',
          senderDID: 'did:key:z',
          targetDID: 'did:key:z',
          encryptedAt: Date.now(),
        };

        await expect(
          replicationManager.decryptReplicationData(mockEncrypted),
        ).rejects.toThrow('Crypto provider not initialized');
      });
    });

    describe('createEncryptedPolicy', () => {
      it('should create policy with encryption mode', () => {
        const policy = replicationManager.createEncryptedPolicy(
          'encrypted-policy',
          3,
          'strong',
          'end-to-end',
        );

        expect(policy.name).toBe('encrypted-policy');
        expect(policy.encryptionMode).toBe('end-to-end');
        expect(policy.replicationFactor).toBe(3);
        expect(policy.consistencyLevel).toBe('strong');
      });

      it('should create policy with required capabilities', () => {
        const policy = replicationManager.createEncryptedPolicy(
          'cap-policy',
          2,
          'read-after-write',
          'session',
          {
            requiredCapabilities: [
              'aeon:replicate:read',
              'aeon:replicate:write',
            ],
          },
        );

        expect(policy.requiredCapabilities).toHaveLength(2);
        expect(policy.requiredCapabilities).toContain('aeon:replicate:read');
      });

      it('should set custom sync interval and lag', () => {
        const policy = replicationManager.createEncryptedPolicy(
          'custom-policy',
          2,
          'eventual',
          'end-to-end',
          {
            syncInterval: 5000,
            maxReplicationLag: 30000,
          },
        );

        expect(policy.syncInterval).toBe(5000);
        expect(policy.maxReplicationLag).toBe(30000);
      });
    });

    describe('verifyReplicaCapabilities', () => {
      it('should verify authorized replica', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        const result = await replicationManager.verifyReplicaCapabilities(
          'did:key:zReplica',
          'mock.token.here',
        );

        expect(result.authorized).toBe(true);
      });

      it('should reject unauthorized replica', async () => {
        replicationManager.configureCrypto(cryptoProvider);
        cryptoProvider.setUCANVerifyResult({
          authorized: false,
          error: 'Missing capability',
        });

        const result = await replicationManager.verifyReplicaCapabilities(
          'did:key:zReplica',
          'mock.token.here',
        );

        expect(result.authorized).toBe(false);
        expect(result.error).toBe('Missing capability');
      });

      it('should verify against policy capabilities', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        const policy = replicationManager.createEncryptedPolicy(
          'test-policy',
          2,
          'eventual',
          'end-to-end',
          {
            requiredCapabilities: ['aeon:replicate:read'],
          },
        );

        const result = await replicationManager.verifyReplicaCapabilities(
          'did:key:zReplica',
          'mock.token.here',
          policy.id,
        );

        expect(result.authorized).toBe(true);
      });

      it('should return authorized without crypto', async () => {
        const result = await replicationManager.verifyReplicaCapabilities(
          'did:key:zReplica',
          'mock.token.here',
        );

        expect(result.authorized).toBe(true);
      });
    });

    describe('clear', () => {
      it('should clear crypto state', async () => {
        replicationManager.configureCrypto(cryptoProvider);

        await replicationManager.registerAuthenticatedReplica({
          id: 'replica-1',
          nodeId: 'node-1',
          status: 'primary',
          lastSyncTime: new Date().toISOString(),
          lagBytes: 0,
          lagMillis: 0,
          did: 'did:key:zReplica1',
        });

        replicationManager.clear();

        expect(replicationManager.isCryptoEnabled()).toBe(false);
        expect(
          replicationManager.getReplicaByDID('did:key:zReplica1'),
        ).toBeUndefined();
        expect(replicationManager.getAllReplicas()).toHaveLength(0);
      });
    });
  });

  describe('End-to-End Crypto Workflow', () => {
    let protocol: SyncProtocol;
    let aliceProvider: MockCryptoProvider;
    let bobProvider: MockCryptoProvider;

    beforeEach(() => {
      protocol = new SyncProtocol();
      aliceProvider = new MockCryptoProvider('did:key:zAlice');
      bobProvider = new MockCryptoProvider('did:key:zBob');
    });

    it('should complete authenticated handshake between two nodes', async () => {
      // Alice initiates
      protocol.configureCrypto(aliceProvider, {
        requireSignatures: true,
        requireCapabilities: true,
      });

      const aliceHandshake = await protocol.createAuthenticatedHandshake(
        ['sync', 'replicate'],
        'did:key:zBob',
      );

      expect(aliceHandshake.auth?.senderDID).toBe('did:key:zAlice');

      // Bob verifies
      protocol.configureCrypto(bobProvider, {
        requireSignatures: true,
        requireCapabilities: true,
      });

      const result =
        await protocol.verifyAuthenticatedHandshake(aliceHandshake);

      expect(result.valid).toBe(true);
      expect(result.handshake?.did).toBe('did:key:zAlice');
    });

    it('should exchange encrypted sync messages', async () => {
      protocol.configureCrypto(aliceProvider, {
        encryptionMode: 'end-to-end',
        requireSignatures: true,
      });

      // Alice sends encrypted request
      const request = protocol.createSyncRequestMessage(
        'did:key:zAlice',
        'did:key:zBob',
        'session-1',
        '1.0',
        '2.0',
      );

      const syncData = {
        items: [{ id: 1, value: 'secret' }],
        cursor: 'abc123',
      };

      const encryptedRequest = await protocol.signMessage(
        request,
        syncData,
        true,
      );

      expect(encryptedRequest.auth?.encrypted).toBe(true);
      expect(encryptedRequest.auth?.signature).toBeDefined();

      // Bob decrypts and verifies
      protocol.configureCrypto(bobProvider, {
        encryptionMode: 'end-to-end',
        requireSignatures: true,
      });

      const decrypted =
        await protocol.verifyMessage<typeof syncData>(encryptedRequest);

      expect(decrypted.valid).toBe(true);
      expect(decrypted.payload?.items).toHaveLength(1);
      expect(decrypted.payload?.items[0].value).toBe('secret');
    });

    it('should reject messages with tampered signatures', async () => {
      protocol.configureCrypto(aliceProvider, {
        requireSignatures: true,
      });

      const message = protocol.createSyncRequestMessage(
        'did:key:zAlice',
        'did:key:zBob',
        'session-1',
        '1.0',
        '2.0',
      );

      const signed = await protocol.signMessage(message, { data: 'test' });

      // Switch to Bob's provider and make verification fail
      protocol.configureCrypto(bobProvider, {
        requireSignatures: true,
      });
      bobProvider.setVerifyResult(false);

      const result = await protocol.verifyMessage(signed);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });
});
