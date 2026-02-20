/**
 * Stripe Payment Provider
 * 
 * Wraps the Stripe SDK behind the PaymentProvider interface.
 * 
 * To activate:
 *   1. pnpm add stripe
 *   2. Set STRIPE_SECRET_KEY in .env  (sk_test_… for sandbox)
 *   3. Uncomment the SDK import and constructor block below
 *   4. The factory in ./index.ts will auto-select this provider
 * 
 * Everything else (service, controller, routes, UI) stays untouched.
 */

import { PaymentStatus } from '../../types/payment.types.js';
import {
  PaymentProvider,
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';

// ── Step 1: Uncomment when `stripe` package is installed ────────────────
// import Stripe from 'stripe';

export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'Stripe';

  // private stripe: Stripe;
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;

    // ── Step 2: Uncomment to initialise the SDK ─────────────────────────
    // this.stripe = new Stripe(secretKey, {
    //   apiVersion: '2024-12-18.acacia',   // pin to a stable API version
    //   typescript: true,
    // });
  }

  isAvailable(): boolean {
    return !!this.secretKey;
  }

  // =====================================================================
  // Charge (inbound — client pays you)
  // =====================================================================
  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    // ── Step 3: Replace the placeholder below with real SDK call ───────
    //
    // const paymentIntent = await this.stripe.paymentIntents.create({
    //   amount: request.amountCents,
    //   currency: request.currency,
    //   payment_method: request.paymentMethodToken,
    //   confirm: true,
    //   description: request.description,
    //   metadata: request.metadata,
    // }, {
    //   idempotencyKey: request.idempotencyKey,
    // });
    //
    // return {
    //   success: paymentIntent.status === 'succeeded',
    //   providerTransactionId: paymentIntent.id,
    //   status: paymentIntent.status === 'succeeded'
    //     ? PaymentStatus.COMPLETED
    //     : PaymentStatus.PROCESSING,
    //   message: `Stripe PaymentIntent ${paymentIntent.status}`,
    //   receiptUrl: paymentIntent.latest_charge
    //     ? (typeof paymentIntent.latest_charge === 'string'
    //         ? undefined
    //         : paymentIntent.latest_charge.receipt_url ?? undefined)
    //     : undefined,
    //   rawResponse: paymentIntent,
    // };

    return this.notYetWired('charge');
  }

  // =====================================================================
  // Payout (outbound — you pay vendor)
  // =====================================================================
  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    // ── Step 3: Replace with real SDK call ─────────────────────────────
    //
    // Option A — Stripe Connect Transfer:
    // const transfer = await this.stripe.transfers.create({
    //   amount: request.amountCents,
    //   currency: request.currency,
    //   destination: request.destinationToken!,  // Connected Account ID
    //   description: request.description,
    //   metadata: request.metadata,
    // }, {
    //   idempotencyKey: request.idempotencyKey,
    // });
    //
    // return {
    //   success: true,
    //   providerTransactionId: transfer.id,
    //   status: PaymentStatus.PROCESSING,
    //   message: `Stripe Transfer created`,
    //   rawResponse: transfer,
    // };

    return this.notYetWired('payout');
  }

  // =====================================================================
  // Refund
  // =====================================================================
  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    // ── Step 3: Replace with real SDK call ─────────────────────────────
    //
    // const refund = await this.stripe.refunds.create({
    //   payment_intent: request.originalTransactionId,
    //   amount: request.amountCents,
    //   reason: 'requested_by_customer',
    //   metadata: request.metadata,
    // });
    //
    // return {
    //   success: refund.status === 'succeeded',
    //   providerTransactionId: refund.id,
    //   status: refund.status === 'succeeded'
    //     ? PaymentStatus.REFUNDED
    //     : PaymentStatus.PROCESSING,
    //   message: `Stripe Refund ${refund.status}`,
    //   rawResponse: refund,
    // };

    return this.notYetWired('refund');
  }

  // =====================================================================
  // Placeholder until SDK is installed
  // =====================================================================
  private async notYetWired(operation: string): Promise<ProviderResult> {
    console.warn(
      `⚠️  Stripe provider: "${operation}" called but SDK is not yet wired.`,
      'Install the stripe package and uncomment the SDK code in stripe.provider.ts.'
    );
    return {
      success: false,
      status: PaymentStatus.FAILED,
      error: `Stripe SDK not yet wired — install "stripe" package and uncomment code in stripe.provider.ts`,
    };
  }
}
