/**
 * Plaid Payment Provider
 *
 * Uses Plaid's Transfer API for ACH bank-to-bank payments and the Bank
 * Account Verification (IAV) flow to tokenise bank accounts.
 *
 * Capabilities wired here:
 *   charge  → ACH debit (pull funds from a lender/borrower bank account)
 *   payout  → ACH credit (push funds to an appraiser bank account)
 *   refund  → reverse/cancel a transfer before it settles
 *
 * Required env vars:
 *   PLAID_CLIENT_ID     — from Plaid dashboard
 *   PLAID_SECRET        — environment-specific secret (sandbox/development/production)
 *   PLAID_ENV           — 'sandbox' | 'development' | 'production'  (default: 'sandbox')
 *
 * NOTE: Bank routing/account numbers are never stored here.
 * The `paymentMethodToken` / `destinationToken` fields carry Plaid processor tokens
 * (obtained via the client-side Link + server-side processor_token_create call).
 */

import { PaymentStatus } from '../../types/payment.types.js';
import {
  PaymentProvider,
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';
import { Logger } from '../../utils/logger.js';

// Plaid Transfer direction / type enums (mirrors Plaid SDK — typed narrowly to avoid pulling the full SDK dep)
type PlaidTransferType = 'debit' | 'credit';
type PlaidACHClass = 'ppd' | 'ccd' | 'web';

/** Minimal shape of the Plaid Transfer object we care about. */
interface PlaidTransfer {
  id: string;
  status: 'pending' | 'posted' | 'settled' | 'cancelled' | 'failed' | 'returned';
  failure_reason?: { ach_return_code: string; description: string } | null;
}

/** Minimal shape of a Plaid API error */
interface PlaidApiError {
  error_code: string;
  error_message: string;
  display_message?: string | null;
}

export class PlaidPaymentProvider implements PaymentProvider {
  readonly name = 'Plaid';

  private readonly clientId: string;
  private readonly secret: string;
  private readonly env: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(clientId: string, secret: string, env: string = 'sandbox') {
    this.clientId = clientId;
    this.secret = secret;
    this.env = env;
    this.logger = new Logger('PlaidPaymentProvider');

    // Plaid hosts per environment
    switch (env) {
      case 'production':
        this.baseUrl = 'https://production.plaid.com';
        break;
      case 'development':
        this.baseUrl = 'https://development.plaid.com';
        break;
      default:
        this.baseUrl = 'https://sandbox.plaid.com';
    }
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.secret);
  }

  // ===========================================================================
  // Charge — ACH debit (pull money from client/lender bank account)
  // ===========================================================================
  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    const amountDollars = (request.amountCents / 100).toFixed(2);

    try {
      const transfer = await this.createTransfer({
        type: 'debit',
        amount: amountDollars,
        currency: request.currency,
        achClass: 'ppd',
        description: request.description ?? 'Appraisal payment',
        idempotencyKey: request.idempotencyKey,
        ...(request.paymentMethodToken !== undefined ? { processorToken: request.paymentMethodToken } : {}),
        ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
      });

      return {
        success: transfer.status !== 'failed',
        providerTransactionId: transfer.id,
        status: this.mapTransferStatus(transfer.status),
        message: `Plaid ACH debit ${transfer.status}`,
        rawResponse: transfer,
      };
    } catch (err) {
      return this.handleError('charge', err);
    }
  }

  // ===========================================================================
  // Payout — ACH credit (push money to appraiser bank account)
  // ===========================================================================
  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    const amountDollars = (request.amountCents / 100).toFixed(2);

    try {
      const transfer = await this.createTransfer({
        type: 'credit',
        amount: amountDollars,
        currency: request.currency,
        achClass: 'ppd',
        description: request.description ?? 'Appraiser payout',
        idempotencyKey: request.idempotencyKey,
        ...(request.destinationToken !== undefined ? { processorToken: request.destinationToken } : {}),
        ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
      });

      return {
        success: transfer.status !== 'failed',
        providerTransactionId: transfer.id,
        status: this.mapTransferStatus(transfer.status),
        message: `Plaid ACH credit ${transfer.status} — settles in 1-3 business days`,
        rawResponse: transfer,
      };
    } catch (err) {
      return this.handleError('payout', err);
    }
  }

  // ===========================================================================
  // Refund — cancel or reverse a pending transfer
  // ===========================================================================
  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    try {
      // Plaid cancels transfers that are still pending (before ACH cutoff).
      // After settlement a return (reversal) must be initiated via a separate API;
      // here we call transfer/cancel which is valid while status === 'pending'.
      const result = await this.callPlaid<{ transfer: PlaidTransfer }>(
        '/transfer/cancel',
        { transfer_id: request.originalTransactionId },
      );

      return {
        success: true,
        providerTransactionId: request.originalTransactionId,
        status: PaymentStatus.REFUNDED,
        message: `Plaid transfer ${request.originalTransactionId} cancelled`,
        rawResponse: result,
      };
    } catch (err) {
      return this.handleError('refund', err);
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private async createTransfer(params: {
    type: PlaidTransferType;
    amount: string;
    currency: string;
    achClass: PlaidACHClass;
    processorToken?: string;
    description: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }): Promise<PlaidTransfer> {
    const body: Record<string, unknown> = {
      client_id: this.clientId,
      secret: this.secret,
      idempotency_key: params.idempotencyKey,
      type: params.type,
      network: 'ach',
      ach_class: params.achClass,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      ...(params.processorToken !== undefined && { processor_token: params.processorToken }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
    };

    const response = await this.callPlaid<{ transfer: PlaidTransfer }>('/transfer/create', body);
    return response.transfer;
  }

  private async callPlaid<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        secret: this.secret,
        ...body,
      }),
    });

    const json = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const plaidErr = json as unknown as PlaidApiError;
      throw new Error(`Plaid ${path} error [${plaidErr.error_code}]: ${plaidErr.error_message}`);
    }

    return json as T;
  }

  private mapTransferStatus(plaidStatus: PlaidTransfer['status']): PaymentStatus {
    switch (plaidStatus) {
      case 'settled':   return PaymentStatus.COMPLETED;
      case 'posted':    return PaymentStatus.PROCESSING;
      case 'pending':   return PaymentStatus.PROCESSING;
      case 'cancelled': return PaymentStatus.FAILED;
      case 'failed':    return PaymentStatus.FAILED;
      case 'returned':  return PaymentStatus.REFUNDED;
      default:          return PaymentStatus.PROCESSING;
    }
  }

  private handleError(operation: string, err: unknown): ProviderResult {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`PlaidPaymentProvider.${operation} failed`, { error: message });
    return {
      success: false,
      status: PaymentStatus.FAILED,
      error: message,
      message: `Plaid ${operation} failed: ${message}`,
    };
  }
}
