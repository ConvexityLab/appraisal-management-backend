/**
 * Column Bank Payment Provider
 *
 * Column Bank N.A. is a developer-first bank offering real-time ACH, wire
 * transfers, and instant payouts via a REST API.  This provider targets
 * the appraiser-payout use-case: instant same-day credit to an appraiser's
 * linked bank account.
 *
 * Capabilities wired here:
 *   charge  → ACH pull from a linked lender/AMC bank account
 *   payout  → instant ACH push to an appraiser bank account
 *   refund  → reverse/void a payment before settlement
 *
 * Required env vars:
 *   COLUMN_API_KEY  — Bearer token from Column dashboard
 *   COLUMN_ENV      — 'sandbox' | 'production'  (default: 'sandbox')
 *
 * Column API reference: https://column.com/docs/api
 *
 * NOTE: Bank account tokens (Column "counterparty" IDs) are obtained via
 * the Column Bank Account Verification flow and stored in AppraiserProfile.
 * They are never generated or stored inside this provider.
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

/** Minimal shape of a Column Transfer object. */
interface ColumnTransfer {
  id: string;
  status: 'created' | 'pending_submission' | 'submitted' | 'completed' | 'returned' | 'failed';
  failure_code?: string | null;
  amount: number;          // cents
  currency_code: string;
}

/** Column API error envelope. */
interface ColumnApiError {
  error_code: string;
  message: string;
}

export class ColumnBankPaymentProvider implements PaymentProvider {
  readonly name = 'Column Bank';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(apiKey: string, env: string = 'sandbox') {
    this.apiKey = apiKey;
    this.logger = new Logger('ColumnBankPaymentProvider');
    this.baseUrl = env === 'production'
      ? 'https://api.column.com'
      : 'https://api.sandbox.column.com';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // ===========================================================================
  // Charge — ACH pull (debit lender bank account)
  // ===========================================================================
  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    try {
      const transfer = await this.callColumn<ColumnTransfer>('POST', '/transfers/ach', {
        amount: request.amountCents,
        currency_code: request.currency.toUpperCase(),
        type: 'debit',
        // paymentMethodToken is the Column counterparty_id for the source account
        ...(request.paymentMethodToken !== undefined && { counterparty_id: request.paymentMethodToken }),
        description: request.description ?? 'Appraisal payment',
        idempotency_key: request.idempotencyKey,
        ...(request.metadata !== undefined && { metadata: request.metadata }),
      });

      return {
        success: transfer.status !== 'failed',
        providerTransactionId: transfer.id,
        status: this.mapTransferStatus(transfer.status),
        message: `Column Bank ACH debit ${transfer.status}`,
        rawResponse: transfer,
      };
    } catch (err) {
      return this.handleError('charge', err);
    }
  }

  // ===========================================================================
  // Payout — instant ACH credit to appraiser account
  // ===========================================================================
  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    try {
      const transfer = await this.callColumn<ColumnTransfer>('POST', '/transfers/ach', {
        amount: request.amountCents,
        currency_code: request.currency.toUpperCase(),
        type: 'credit',
        // destinationToken is the Column counterparty_id for the destination account
        ...(request.destinationToken !== undefined && { counterparty_id: request.destinationToken }),
        // Fall back to direct bank details if no token provided (Column supports both)
        ...(request.bankDetails !== undefined && request.destinationToken === undefined && {
          bank_account_number: request.bankDetails.accountNumber,
          bank_routing_number: request.bankDetails.routingNumber,
          account_holder_name: request.bankDetails.accountHolderName,
        }),
        description: request.description ?? 'Appraiser payout',
        idempotency_key: request.idempotencyKey,
        ...(request.metadata !== undefined && { metadata: request.metadata }),
      });

      return {
        success: transfer.status !== 'failed',
        providerTransactionId: transfer.id,
        status: this.mapTransferStatus(transfer.status),
        message: `Column Bank ACH credit ${transfer.status}`,
        rawResponse: transfer,
      };
    } catch (err) {
      return this.handleError('payout', err);
    }
  }

  // ===========================================================================
  // Refund — void / reverse a transfer
  // ===========================================================================
  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    try {
      const result = await this.callColumn<{ id: string }>(
        'POST',
        `/transfers/${request.originalTransactionId}/return`,
        {
          ...(request.reason !== undefined && { reason: request.reason }),
        },
      );

      return {
        success: true,
        providerTransactionId: result.id,
        status: PaymentStatus.REFUNDED,
        message: `Column Bank transfer ${request.originalTransactionId} reversed`,
        rawResponse: result,
      };
    } catch (err) {
      return this.handleError('refund', err);
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private async callColumn<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    const json = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const colErr = json as unknown as ColumnApiError;
      throw new Error(`Column Bank ${path} error [${colErr.error_code}]: ${colErr.message}`);
    }

    return json as T;
  }

  private mapTransferStatus(status: ColumnTransfer['status']): PaymentStatus {
    switch (status) {
      case 'completed':           return PaymentStatus.COMPLETED;
      case 'submitted':           return PaymentStatus.PROCESSING;
      case 'pending_submission':  return PaymentStatus.PROCESSING;
      case 'created':             return PaymentStatus.PROCESSING;
      case 'returned':            return PaymentStatus.REFUNDED;
      case 'failed':              return PaymentStatus.FAILED;
      default:                    return PaymentStatus.PROCESSING;
    }
  }

  private handleError(operation: string, err: unknown): ProviderResult {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`ColumnBankPaymentProvider.${operation} failed`, { error: message });
    return {
      success: false,
      status: PaymentStatus.FAILED,
      error: message,
      message: `Column Bank ${operation} failed: ${message}`,
    };
  }
}
