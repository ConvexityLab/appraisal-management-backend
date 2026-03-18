/**
 * Stripe Payment Provider
 *
 * Wraps the Stripe SDK behind the PaymentProvider interface.
 * The factory in ./index.ts auto-selects this provider when STRIPE_SECRET_KEY is set.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY  — sk_test_… for sandbox, sk_live_… for production
 */

import { PaymentStatus } from '../../types/payment.types.js';
import {
  PaymentProvider,
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';

import Stripe from 'stripe';

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'Stripe';

  private stripe: Stripe;
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }

  isAvailable(): boolean {
    return !!this.secretKey;
  }

  // =====================================================================
  // Charge (inbound — client pays you)
  // =====================================================================
  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: request.amountCents,
      currency: request.currency,
      confirm: true,
      ...(request.paymentMethodToken !== undefined && { payment_method: request.paymentMethodToken }),
      ...(request.description !== undefined && { description: request.description }),
      ...(request.metadata !== undefined && { metadata: request.metadata }),
    }, {
      idempotencyKey: request.idempotencyKey,
    });

    const latestCharge = paymentIntent.latest_charge;
    const receiptUrl = latestCharge && typeof latestCharge !== 'string'
      ? (latestCharge.receipt_url ?? undefined)
      : undefined;

    return {
      success: paymentIntent.status === 'succeeded',
      providerTransactionId: paymentIntent.id,
      status: paymentIntent.status === 'succeeded'
        ? PaymentStatus.COMPLETED
        : PaymentStatus.PROCESSING,
      message: `Stripe PaymentIntent ${paymentIntent.status}`,
      ...(receiptUrl !== undefined && { receiptUrl }),
      rawResponse: paymentIntent,
    };
  }

  // =====================================================================
  // Payout (outbound — you pay vendor)
  // =====================================================================
  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    const transfer = await this.stripe.transfers.create({
      amount: request.amountCents,
      currency: request.currency,
      destination: request.destinationToken!,
      ...(request.description !== undefined && { description: request.description }),
      ...(request.metadata !== undefined && { metadata: request.metadata }),
    }, {
      idempotencyKey: request.idempotencyKey,
    });

    return {
      success: true,
      providerTransactionId: transfer.id,
      status: PaymentStatus.PROCESSING,
      message: `Stripe Transfer created`,
      rawResponse: transfer,
    };
  }

  // =====================================================================
  // Refund
  // =====================================================================
  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    const refund = await this.stripe.refunds.create({
      payment_intent: request.originalTransactionId,
      amount: request.amountCents,
      reason: 'requested_by_customer',
      ...(request.metadata !== undefined && { metadata: request.metadata }),
    });

    return {
      success: refund.status === 'succeeded',
      providerTransactionId: refund.id,
      status: refund.status === 'succeeded'
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PROCESSING,
      message: `Stripe Refund ${refund.status}`,
      rawResponse: refund,
    };
  }

}
