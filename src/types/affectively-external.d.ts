declare module '@affectively/auth' {
  export interface Identity {
    did: string;
    signingKey: {
      algorithm: string;
      publicKey: JsonWebKey;
      privateKey?: JsonWebKey;
    };
    encryptionKey?: {
      algorithm: string;
      publicKey: JsonWebKey;
      privateKey?: JsonWebKey;
    };
    createdAt?: number;
    displayName?: string;
  }

  export interface Capability {
    can: string;
    with: string;
    constraints?: Record<string, unknown>;
  }

  export function generateIdentity(options?: {
    algorithm?: string;
    displayName?: string;
    includeEncryptionKey?: boolean;
  }): Promise<Identity>;

  export function exportPublicIdentity(identity: Identity): {
    did: string;
    publicSigningKey: JsonWebKey;
    publicEncryptionKey?: JsonWebKey;
  };

  export function createUCAN(
    identity: Identity,
    audience: string,
    capabilities: Capability[],
    options?: {
      expirationSeconds?: number;
      proofs?: string[];
    }
  ): Promise<string>;

  export function verifyUCAN(
    token: string,
    publicKey: JsonWebKey,
    options?: {
      audience?: string;
      requiredCapabilities?: Capability[];
    }
  ): Promise<{
    valid: boolean;
    payload?: {
      iss: string;
      att?: Array<{ can: string; with: string }>;
    };
    error?: string;
  }>;

  export function delegateCapabilities(
    parentToken: string,
    identity: Identity,
    audience: string,
    capabilities: Capability[],
    options?: {
      expirationSeconds?: number;
    }
  ): Promise<string>;

  export function sign(
    identity: Identity,
    data: Uint8Array
  ): Promise<Uint8Array>;

  export function verify(
    publicKey: JsonWebKey,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean>;

  export function base64UrlEncode(data: Uint8Array): string;
  export function base64UrlDecode(value: string): Uint8Array;
}

declare module '@affectively/zk-encryption' {
  export interface ECKeyPair {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
    keyId: string;
    createdAt: string;
  }

  export function generateKeyPair(): Promise<ECKeyPair>;

  export function eciesEncrypt(
    plaintext: Uint8Array,
    recipientPublicKey: JsonWebKey,
    options?: { category?: string }
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    epk?: JsonWebKey;
    encryptedAt: number;
  }>;

  export function eciesDecrypt(
    encrypted: {
      alg: string;
      ct: string;
      iv: string;
      tag: string;
      epk?: JsonWebKey;
      encryptedAt: number;
    },
    privateKey: JsonWebKey
  ): Promise<{ plaintext: Uint8Array }>;

  export function aesEncrypt(
    plaintext: Uint8Array,
    key: CryptoKey,
    options?: { category?: string }
  ): Promise<{
    alg: string;
    ct: string;
    iv: string;
    tag: string;
    encryptedAt: number;
  }>;

  export function aesDecrypt(
    encrypted: {
      alg: string;
      ct: string;
      iv: string;
      tag: string;
      encryptedAt: number;
    },
    key: CryptoKey
  ): Promise<{ plaintext: Uint8Array }>;

  export function deriveAESKeyFromJWK(
    privateKey: JsonWebKey,
    publicKey: JsonWebKey,
    category: string,
    options?: { info?: string }
  ): Promise<CryptoKey>;

  export function sha256(data: Uint8Array): Promise<Uint8Array>;
  export function randomBytes(length: number): Uint8Array;
}
