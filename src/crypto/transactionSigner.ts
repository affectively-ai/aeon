/**
 * Aeon Transaction Signer Abstraction
 *
 * Keeps sync cryptography (`ICryptoProvider`) decoupled from on-chain write signing.
 * This interface matches custodial signer semantics so server and Aeon callers
 * converge on one contract shape.
 */

export type HexString = `0x${string}`;

export type TransactionSignerPayloadMap = Record<string, unknown>;

export type TransactionSignerExecuteRequest<
  TPayloads extends TransactionSignerPayloadMap,
  TAction extends keyof TPayloads & string = keyof TPayloads & string,
> = {
  action: TAction;
  payload: TPayloads[TAction];
  chainId?: number;
  waitForReceipt?: boolean;
  requestId?: string;
};

export type TransactionSignerErrorCode =
  | 'invalid_request'
  | 'signer_unavailable'
  | 'signer_denied'
  | 'tx_failed'
  | 'tx_reverted'
  | 'unauthorized'
  | 'forbidden'
  | 'unknown_action'
  | 'upstream_error';

export interface TransactionSignerExecuteResponse<TAction extends string = string> {
  success: boolean;
  action: TAction;
  chainId: number;
  txHash?: HexString;
  receiptStatus?: 'pending' | 'success' | 'reverted';
  signerAddress?: HexString;
  keyVersion?: string;
  errorCode?: TransactionSignerErrorCode;
  errorMessage?: string;
  revertReason?: string;
}

export interface TransactionSignerMetadata<TAction extends string = string> {
  action: TAction;
  chainId: number;
  signerAddress: HexString;
  keyVersion: string;
  keyName: string;
}

export interface TransactionSignerHealth {
  ok: boolean;
  service: string;
  timestamp: string;
}

export interface ITransactionSigner<
  TPayloads extends TransactionSignerPayloadMap = TransactionSignerPayloadMap,
> {
  execute<TAction extends keyof TPayloads & string>(
    request: TransactionSignerExecuteRequest<TPayloads, TAction>
  ): Promise<TransactionSignerExecuteResponse<TAction>>;

  getSigner<TAction extends keyof TPayloads & string>(
    action: TAction
  ): Promise<TransactionSignerMetadata<TAction>>;

  health(): Promise<TransactionSignerHealth>;
}

export class NullTransactionSigner<
  TPayloads extends TransactionSignerPayloadMap = TransactionSignerPayloadMap,
> implements ITransactionSigner<TPayloads>
{
  async execute<TAction extends keyof TPayloads & string>(
    request: TransactionSignerExecuteRequest<TPayloads, TAction>
  ): Promise<TransactionSignerExecuteResponse<TAction>> {
    return {
      success: false,
      action: request.action,
      chainId: request.chainId || 0,
      errorCode: 'signer_unavailable',
      errorMessage: 'Transaction signer not configured',
    };
  }

  async getSigner<TAction extends keyof TPayloads & string>(
    action: TAction
  ): Promise<TransactionSignerMetadata<TAction>> {
    throw new Error(`Transaction signer metadata unavailable for action: ${action}`);
  }

  async health(): Promise<TransactionSignerHealth> {
    return {
      ok: false,
      service: 'transaction-signer',
      timestamp: new Date().toISOString(),
    };
  }
}

export function createTransactionSignerAdapter<
  TPayloads extends TransactionSignerPayloadMap,
>(contract: ITransactionSigner<TPayloads>): ITransactionSigner<TPayloads> {
  return contract;
}
