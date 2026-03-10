/**
 * Aeon Transaction Signer Abstraction
 *
 * Keeps sync cryptography (`ICryptoProvider`) decoupled from on-chain write signing.
 * This interface matches custodial signer semantics so server and Aeon callers
 * converge on one contract shape.
 */
export class NullTransactionSigner {
    async execute(request) {
        return {
            success: false,
            action: request.action,
            chainId: request.chainId || 0,
            errorCode: 'signer_unavailable',
            errorMessage: 'Transaction signer not configured',
        };
    }
    async getSigner(action) {
        throw new Error(`Transaction signer metadata unavailable for action: ${action}`);
    }
    async health() {
        return {
            ok: false,
            service: 'transaction-signer',
            timestamp: new Date().toISOString(),
        };
    }
}
export function createTransactionSignerAdapter(contract) {
    return contract;
}
