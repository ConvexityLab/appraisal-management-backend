/**
 * Payment Provider Factory
 * 
 * Picks the right PaymentProvider based on environment config.
 * This is the ONE file you change to swap payment backends.
 * 
 * Priority:
 *   1. STRIPE_SECRET_KEY set  →  StripePaymentProvider
 *   2. (future) COLUMN_API_KEY →  ColumnPaymentProvider
 *   3. Nothing configured     →  MockPaymentProvider (simulated)
 */

import { PaymentProvider } from './payment-provider.interface.js';
import { MockPaymentProvider } from './mock.provider.js';
import { StripePaymentProvider } from './stripe.provider.js';

export function createPaymentProvider(): PaymentProvider {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (stripeKey) {
    console.log('💳 Payment provider: Stripe');
    return new StripePaymentProvider(stripeKey);
  }

  // ── Future providers ──────────────────────────────────────────────────
  // const columnKey = process.env.COLUMN_API_KEY;
  // if (columnKey) {
  //   console.log('🏦 Payment provider: Column');
  //   return new ColumnPaymentProvider(columnKey);
  // }

  console.log('🧪 Payment provider: Mock (no STRIPE_SECRET_KEY configured)');
  return new MockPaymentProvider();
}

// Re-export everything consumers might need
export type { PaymentProvider } from './payment-provider.interface.js';
export type {
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';
