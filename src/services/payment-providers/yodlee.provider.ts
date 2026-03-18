/**
 * Yodlee Payment Provider
 *
 * Yodlee (Envestnet) provides bank data aggregation (account verification,
 * balance checks) and payment initiation via its FastLink and Payments API.
 *
 * In this platform Yodlee is used as a data-enrichment / verification layer:
 *   - Verify appraiser bank accounts before initiating payouts
 *   - Real-time balance checks to prevent NSF on lender ACH debits
 *
 * Capabilities wired here:
 *   charge  → ACH payment via Yodlee Payments API
 *   payout  → ACH payout to a verified appraiser account
 *   refund  → payment cancellation / reversal
 *
 * Required env vars:
 *   YODLEE_CLIENT_ID      — OAuth 2.0 client ID
 *   YODLEE_CLIENT_SECRET  — OAuth 2.0 client secret
 *   YODLEE_ENV            — 'sandbox' | 'production'  (default: 'sandbox')
 *
 * Yodlee API reference: https://developer.envestnet.com/resources/yodlee/
 *
 * NOTE: User-level tokens (obtained after a Link/FastLink session) are stored
 * in the UserPaymentProfile and passed as destinationToken / paymentMethodToken.
 * Client-level token management is handled internally via OAuth 2.0 client credentials.
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

/** Minimal Yodlee Payment object. */
interface YodleePayment {
  paymentId: string;
  status: 'INITIATED' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETURNED';
  amount: number;
  currencyCode: string;
  failureReason?: string | null;
}

/** OAuth token response from Yodlee. */
interface YodleeTokenResponse {
  token: { accessToken: string; issuedAt: string; expiresIn: number };
}

export class YodleePaymentProvider implements PaymentProvider {
  readonly name = 'Yodlee (Envestnet)';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  // Cached client-level access token
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: string, clientSecret: string, env: string = 'sandbox') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.logger = new Logger('YodleePaymentProvider');
    this.baseUrl = env === 'production'
      ? 'https://production.api.yodlee.com/ysl'
      : 'https://sandbox.api.yodlee.com/ysl';
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // ===========================================================================
  // Charge — initiate a payment/debit from a linked bank account
  // ===========================================================================
  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    try {
      const token = await this.getAccessToken();
      const payment = await this.callYodlee<{ payment: YodleePayment }>(
        'POST',
        '/payment',
        token,
        {
          payment: {
            amount: { amount: request.amountCents / 100, currency: request.currency.toUpperCase() },
            // paymentMethodToken = Yodlee accountId or paymentInstrumentId
            ...(request.paymentMethodToken !== undefined && {
              sourcePaymentInstrumentId: request.paymentMethodToken,
            }),
            memo: request.description ?? 'Appraisal payment',
            idempotencyKey: request.idempotencyKey,
          },
        },
      );

      return {
        success: payment.payment.status !== 'FAILED' && payment.payment.status !== 'CANCELLED',
        providerTransactionId: payment.payment.paymentId,
        status: this.mapPaymentStatus(payment.payment.status),
        message: `Yodlee payment ${payment.payment.status}`,
        rawResponse: payment,
      };
    } catch (err) {
      return this.handleError('charge', err);
    }
  }

  // ===========================================================================
  // Payout — initiate an outbound payment to an appraiser account
  // ===========================================================================
  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    try {
      const token = await this.getAccessToken();
      const payment = await this.callYodlee<{ payment: YodleePayment }>(
        'POST',
        '/payment',
        token,
        {
          payment: {
            amount: { amount: request.amountCents / 100, currency: request.currency.toUpperCase() },
            ...(request.destinationToken !== undefined && {
              destinationPaymentInstrumentId: request.destinationToken,
            }),
            memo: request.description ?? 'Appraiser payout',
            idempotencyKey: request.idempotencyKey,
          },
        },
      );

      return {
        success: payment.payment.status !== 'FAILED' && payment.payment.status !== 'CANCELLED',
        providerTransactionId: payment.payment.paymentId,
        status: this.mapPaymentStatus(payment.payment.status),
        message: `Yodlee payout ${payment.payment.status}`,
        rawResponse: payment,
      };
    } catch (err) {
      return this.handleError('payout', err);
    }
  }

  // ===========================================================================
  // Refund — cancel a pending payment
  // ===========================================================================
  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    try {
      const token = await this.getAccessToken();
      const result = await this.callYodlee<Record<string, unknown>>(
        'DELETE',
        `/payment/${request.originalTransactionId}`,
        token,
      );

      return {
        success: true,
        providerTransactionId: request.originalTransactionId,
        status: PaymentStatus.REFUNDED,
        message: `Yodlee payment ${request.originalTransactionId} cancelled`,
        rawResponse: result,
      };
    } catch (err) {
      return this.handleError('refund', err);
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  /**
   * Return a valid client-level access token, refreshing if within 60s of expiry.
   * Yodlee uses OAuth 2.0 client credentials flow.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'loginName': 'clienta',  // Yodlee cobrand admin username placeholder
      },
      body: new URLSearchParams({
        clientId: this.clientId,
        secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Yodlee auth/token failed [${response.status}]: ${text}`);
    }

    const data = await response.json() as YodleeTokenResponse;
    this.accessToken = data.token.accessToken;
    this.tokenExpiresAt = Date.now() + data.token.expiresIn * 1000;
    return this.accessToken;
  }

  private async callYodlee<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    token: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Api-Version': '1.1',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Yodlee ${path} [${response.status}]: ${text}`);
    }

    // 204 No Content (DELETE)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  private mapPaymentStatus(yodleeStatus: YodleePayment['status']): PaymentStatus {
    switch (yodleeStatus) {
      case 'COMPLETED':  return PaymentStatus.COMPLETED;
      case 'PENDING':    return PaymentStatus.PROCESSING;
      case 'INITIATED':  return PaymentStatus.PROCESSING;
      case 'RETURNED':   return PaymentStatus.REFUNDED;
      case 'CANCELLED':  return PaymentStatus.FAILED;
      case 'FAILED':     return PaymentStatus.FAILED;
      default:           return PaymentStatus.PROCESSING;
    }
  }

  private handleError(operation: string, err: unknown): ProviderResult {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`YodleePaymentProvider.${operation} failed`, { error: message });
    return {
      success: false,
      status: PaymentStatus.FAILED,
      error: message,
      message: `Yodlee ${operation} failed: ${message}`,
    };
  }
}
