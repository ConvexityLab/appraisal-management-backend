/**
 * Payment Providers unit tests
 *
 * Tests MockPaymentProvider behaviour and the createPaymentProvider factory's
 * env-var resolution logic. No real payment API calls are made.
 *
 * Scenarios covered:
 *   MockPaymentProvider
 *     1.  isAvailable() returns true
 *     2.  charge() returns COMPLETED with a providerTransactionId
 *     3.  payout() returns PROCESSING (ACH settlement lag)
 *     4.  refund() returns COMPLETED with a providerTransactionId
 *     5.  all methods return success=true
 *     6.  providerTransactionId starts with the correct prefix
 *
 *   createPaymentProvider factory
 *     7.  No env vars → MockPaymentProvider
 *     8.  PAYMENT_PROVIDER=stripe without STRIPE_SECRET_KEY → throws
 *     9.  PAYMENT_PROVIDER=column_bank without COLUMN_API_KEY → throws
 *     10. PAYMENT_PROVIDER=plaid without PLAID_CLIENT_ID → throws
 *     11. PAYMENT_PROVIDER=yodlee without YODLEE_CLIENT_ID → throws
 *     12. STRIPE_SECRET_KEY auto-detected → StripePaymentProvider
 *     13. COLUMN_API_KEY auto-detected   → ColumnBankPaymentProvider
 *     14. PLAID_CLIENT_ID+PLAID_SECRET   → PlaidPaymentProvider
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockPaymentProvider } from '../services/payment-providers/mock.provider.js';
import { PaymentStatus } from '../types/payment.types.js';

// ─── MockPaymentProvider ───────────────────────────────────────────────────────

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('isAvailable() returns true', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('has a stable provider name', () => {
    expect(provider.name).toBe('Mock (simulated)');
  });

  describe('charge()', () => {
    const chargeRequest = {
      amountCents: 50000,
      currency: 'USD',
      description: 'Test appraisal fee',
      idempotencyKey: 'idem-charge-001',
    };

    it('returns success=true', async () => {
      const result = await provider.charge(chargeRequest);
      expect(result.success).toBe(true);
    });

    it('returns COMPLETED status', async () => {
      const result = await provider.charge(chargeRequest);
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('returns a non-empty providerTransactionId starting with mock_ch_', async () => {
      const result = await provider.charge(chargeRequest);
      expect(result.providerTransactionId).toMatch(/^mock_ch_\d+$/);
    });

    it('returns a receiptUrl', async () => {
      const result = await provider.charge(chargeRequest);
      expect(result.receiptUrl).toMatch(/mock-receipts/);
      expect(result.receiptUrl).toContain(result.providerTransactionId!);
    });
  });

  describe('payout()', () => {
    const payoutRequest = {
      amountCents: 120000,
      currency: 'USD',
      description: 'Appraiser fee payout',
      idempotencyKey: 'idem-payout-001',
    };

    it('returns success=true', async () => {
      const result = await provider.payout(payoutRequest);
      expect(result.success).toBe(true);
    });

    it('returns PROCESSING status (ACH settlement)', async () => {
      const result = await provider.payout(payoutRequest);
      expect(result.status).toBe(PaymentStatus.PROCESSING);
    });

    it('returns a non-empty providerTransactionId starting with mock_po_', async () => {
      const result = await provider.payout(payoutRequest);
      expect(result.providerTransactionId).toMatch(/^mock_po_\d+$/);
    });
  });

  describe('refund()', () => {
    const refundRequest = {
      originalTransactionId: 'mock_ch_1234567890',
      amountCents: 50000,
      reason: 'Order cancelled',
      idempotencyKey: 'idem-refund-001',
    };

    it('returns success=true', async () => {
      const result = await provider.refund(refundRequest);
      expect(result.success).toBe(true);
    });

    it('returns COMPLETED status', async () => {
      const result = await provider.refund(refundRequest);
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('returns a providerTransactionId starting with mock_rf_', async () => {
      const result = await provider.refund(refundRequest);
      expect(result.providerTransactionId).toMatch(/^mock_rf_\d+$/);
    });
  });

  it('successive calls return different providerTransactionIds', async () => {
    const req = { amountCents: 1000, currency: 'USD', idempotencyKey: 'k1' };
    const [a, b] = await Promise.all([provider.charge(req), provider.charge({ ...req, idempotencyKey: 'k2' })]);
    expect(a.providerTransactionId).not.toBe(b.providerTransactionId);
  });
});

// ─── createPaymentProvider factory ────────────────────────────────────────────

describe('createPaymentProvider factory', () => {
  type SavedEnv = Record<string, string | undefined>;
  const PAYMENT_ENV_KEYS = [
    'PAYMENT_PROVIDER',
    'STRIPE_SECRET_KEY',
    'COLUMN_API_KEY', 'COLUMN_ENV',
    'PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV',
    'YODLEE_CLIENT_ID', 'YODLEE_CLIENT_SECRET', 'YODLEE_ENV',
  ];

  let saved: SavedEnv;

  beforeEach(() => {
    saved = {};
    for (const k of PAYMENT_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    jest.resetModules();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.resetModules();
  });

  it('returns MockPaymentProvider when no env vars are set', async () => {
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    const provider = createPaymentProvider();
    expect(provider.name).toBe('Mock (simulated)');
  });

  it('throws when PAYMENT_PROVIDER=stripe but STRIPE_SECRET_KEY is absent', async () => {
    process.env['PAYMENT_PROVIDER'] = 'stripe';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    expect(() => createPaymentProvider()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('throws when PAYMENT_PROVIDER=column_bank but COLUMN_API_KEY is absent', async () => {
    process.env['PAYMENT_PROVIDER'] = 'column_bank';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    expect(() => createPaymentProvider()).toThrow(/COLUMN_API_KEY/);
  });

  it('throws when PAYMENT_PROVIDER=plaid but PLAID_CLIENT_ID is absent', async () => {
    process.env['PAYMENT_PROVIDER'] = 'plaid';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    expect(() => createPaymentProvider()).toThrow(/PLAID_CLIENT_ID/);
  });

  it('throws when PAYMENT_PROVIDER=yodlee but YODLEE_CLIENT_ID is absent', async () => {
    process.env['PAYMENT_PROVIDER'] = 'yodlee';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    expect(() => createPaymentProvider()).toThrow(/YODLEE_CLIENT_ID/);
  });

  it('auto-detects Stripe when STRIPE_SECRET_KEY is set', async () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_dummy';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    const provider = createPaymentProvider();
    expect(provider.name).toMatch(/stripe/i);
  });

  it('auto-detects Column Bank when COLUMN_API_KEY is set', async () => {
    process.env['COLUMN_API_KEY'] = 'col_test_dummy';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    const provider = createPaymentProvider();
    expect(provider.name).toMatch(/column/i);
  });

  it('auto-detects Plaid when PLAID_CLIENT_ID and PLAID_SECRET are set', async () => {
    process.env['PLAID_CLIENT_ID'] = 'plaid-client';
    process.env['PLAID_SECRET']    = 'plaid-secret';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    const provider = createPaymentProvider();
    expect(provider.name).toMatch(/plaid/i);
  });

  it('forced stripe via PAYMENT_PROVIDER=stripe with valid key', async () => {
    process.env['PAYMENT_PROVIDER'] = 'stripe';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_forced';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    expect(() => createPaymentProvider()).not.toThrow();
    const provider = createPaymentProvider();
    expect(provider.name).toMatch(/stripe/i);
  });

  it('error message includes the missing var name and context', async () => {
    process.env['PAYMENT_PROVIDER'] = 'stripe';
    const { createPaymentProvider } = await import('../services/payment-providers/index.js');
    let caught: Error | null = null;
    try {
      createPaymentProvider();
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toContain('STRIPE_SECRET_KEY');
    expect(caught!.message).toContain('PAYMENT_PROVIDER=stripe');
  });
});
