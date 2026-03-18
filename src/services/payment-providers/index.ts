/**
 * Payment Provider Factory
 *
 * Picks the right PaymentProvider based on environment config.
 * This is the ONE file you change to swap payment backends.
 *
 * Resolution order (first match wins):
 *   1. STRIPE_SECRET_KEY set           → StripePaymentProvider  (card / Connect payouts)
 *   2. COLUMN_API_KEY set              → ColumnBankPaymentProvider  (instant ACH payouts)
 *   3. PLAID_CLIENT_ID + PLAID_SECRET  → PlaidPaymentProvider  (ACH bank-to-bank)
 *   4. YODLEE_CLIENT_ID + YODLEE_SECRET → YodleePaymentProvider  (bank data + payments)
 *   5. Nothing configured              → MockPaymentProvider  (simulated — dev/test only)
 *
 * Set PAYMENT_PROVIDER env var to force a specific provider by name:
 *   stripe | column_bank | plaid | yodlee
 */

import { PaymentProvider } from './payment-provider.interface.js';
import { MockPaymentProvider } from './mock.provider.js';
import { StripePaymentProvider } from './stripe.provider.js';
import { ColumnBankPaymentProvider } from './column-bank.provider.js';
import { PlaidPaymentProvider } from './plaid.provider.js';
import { YodleePaymentProvider } from './yodlee.provider.js';

export function createPaymentProvider(): PaymentProvider {
  const forced = process.env.PAYMENT_PROVIDER?.toLowerCase();

  // ── Explicit override ─────────────────────────────────────────────────
  if (forced === 'stripe') {
    const key = requireEnv('STRIPE_SECRET_KEY', 'PAYMENT_PROVIDER=stripe');
    console.log('💳 Payment provider: Stripe (forced)');
    return new StripePaymentProvider(key);
  }

  if (forced === 'column_bank') {
    const key = requireEnv('COLUMN_API_KEY', 'PAYMENT_PROVIDER=column_bank');
    const env = process.env.COLUMN_ENV ?? 'sandbox';
    console.log(`🏦 Payment provider: Column Bank (forced, env=${env})`);
    return new ColumnBankPaymentProvider(key, env);
  }

  if (forced === 'plaid') {
    const clientId = requireEnv('PLAID_CLIENT_ID', 'PAYMENT_PROVIDER=plaid');
    const secret   = requireEnv('PLAID_SECRET', 'PAYMENT_PROVIDER=plaid');
    const env      = process.env.PLAID_ENV ?? 'sandbox';
    console.log(`🔗 Payment provider: Plaid (forced, env=${env})`);
    return new PlaidPaymentProvider(clientId, secret, env);
  }

  if (forced === 'yodlee') {
    const clientId = requireEnv('YODLEE_CLIENT_ID', 'PAYMENT_PROVIDER=yodlee');
    const secret   = requireEnv('YODLEE_CLIENT_SECRET', 'PAYMENT_PROVIDER=yodlee');
    const env      = process.env.YODLEE_ENV ?? 'sandbox';
    console.log(`📊 Payment provider: Yodlee (forced, env=${env})`);
    return new YodleePaymentProvider(clientId, secret, env);
  }

  // ── Auto-detect from available env vars ──────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    console.log('💳 Payment provider: Stripe (auto-detected)');
    return new StripePaymentProvider(stripeKey);
  }

  const columnKey = process.env.COLUMN_API_KEY;
  if (columnKey) {
    const env = process.env.COLUMN_ENV ?? 'sandbox';
    console.log(`🏦 Payment provider: Column Bank (auto-detected, env=${env})`);
    return new ColumnBankPaymentProvider(columnKey, env);
  }

  const plaidClientId = process.env.PLAID_CLIENT_ID;
  const plaidSecret   = process.env.PLAID_SECRET;
  if (plaidClientId && plaidSecret) {
    const env = process.env.PLAID_ENV ?? 'sandbox';
    console.log(`🔗 Payment provider: Plaid (auto-detected, env=${env})`);
    return new PlaidPaymentProvider(plaidClientId, plaidSecret, env);
  }

  const yodleeClientId = process.env.YODLEE_CLIENT_ID;
  const yodleeSecret   = process.env.YODLEE_CLIENT_SECRET;
  if (yodleeClientId && yodleeSecret) {
    const env = process.env.YODLEE_ENV ?? 'sandbox';
    console.log(`📊 Payment provider: Yodlee (auto-detected, env=${env})`);
    return new YodleePaymentProvider(yodleeClientId, yodleeSecret, env);
  }

  console.log('🧪 Payment provider: Mock (no payment credentials configured)');
  return new MockPaymentProvider();
}

/** Throw with a clear message if a required env var is missing. */
function requireEnv(name: string, context: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `[PaymentProviderFactory] Missing required env var "${name}" (needed when ${context}). ` +
      `Set it in your .env file or Azure App Settings before starting the server.`,
    );
  }
  return val;
}

// Re-export everything consumers might need
export type { PaymentProvider } from './payment-provider.interface.js';
export type {
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';
