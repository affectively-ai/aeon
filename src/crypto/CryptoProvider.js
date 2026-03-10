/**
 * Aeon Crypto Provider Interface
 *
 * Abstract interface for cryptographic operations.
 * Aeon core remains zero-dependency - crypto is injected through this interface.
 */
/**
 * Null crypto provider for when crypto is disabled
 *
 * All operations either throw or return permissive defaults.
 */
export class NullCryptoProvider {
    notConfiguredError() {
        return new Error('Crypto provider not configured');
    }
    async generateIdentity() {
        throw this.notConfiguredError();
    }
    getLocalDID() {
        return null;
    }
    async exportPublicIdentity() {
        return null;
    }
    async registerRemoteNode() {
        // No-op when crypto disabled
    }
    async getRemotePublicKey() {
        return null;
    }
    async sign() {
        throw this.notConfiguredError();
    }
    async signData(_data) {
        throw this.notConfiguredError();
    }
    async verify() {
        // Permissive when crypto disabled
        return true;
    }
    async verifySignedData() {
        // Permissive when crypto disabled
        return true;
    }
    async encrypt() {
        throw this.notConfiguredError();
    }
    async decrypt() {
        throw this.notConfiguredError();
    }
    async getSessionKey() {
        throw this.notConfiguredError();
    }
    async encryptWithSessionKey() {
        throw this.notConfiguredError();
    }
    async decryptWithSessionKey() {
        throw this.notConfiguredError();
    }
    async createUCAN() {
        throw this.notConfiguredError();
    }
    async verifyUCAN() {
        // Permissive when crypto disabled
        return { authorized: true };
    }
    async delegateCapabilities() {
        throw this.notConfiguredError();
    }
    async hash() {
        throw this.notConfiguredError();
    }
    randomBytes(length) {
        // Use crypto.getRandomValues even without full crypto setup
        return crypto.getRandomValues(new Uint8Array(length));
    }
    isInitialized() {
        return false;
    }
}
