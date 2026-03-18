import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StripePaymentProvider } from '../../src/services/payment-providers/stripe.provider.js';
import { PaymentStatus } from '../../src/types/payment.types.js';

// Mock Stripe using vitest
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_test_123',
          status: 'succeeded',
          latest_charge: { receipt_url: 'https://receipt.stripe.com/test' }
        })
      },
      transfers: {
        create: vi.fn().mockResolvedValue({
          id: 'tr_test_123',
          status: 'succeeded'
        })
      },
      refunds: {
        create: vi.fn().mockResolvedValue({
          id: 're_test_123',
          status: 'succeeded'
        })
      }
    }))
  };
});

describe('StripePaymentProvider Integration', () => {
  const mockSecretKey = 'sk_test_fake_key';
  let provider: StripePaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new StripePaymentProvider(mockSecretKey);
  });

  describe('charge', () => {
    it('creates a payment intent and confirms it', async () => {
      const result = await provider.charge({
        amountCents: 50000,
        currency: 'usd',
        paymentMethodToken: 'pm_card_visa',
        idempotencyKey: 'idemp-charge-01',
        description: 'Appraisal fee'
      });

      expect(result.success).toBe(true);
      expect(result.providerTransactionId).toBe('pi_test_123');
      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.receiptUrl).toBe('https://receipt.stripe.com/test');
    });
  });

  describe('payout', () => {
    it('creates a transfer to connected account', async () => {
      const result = await provider.payout({
        amountCents: 40000,
        currency: 'usd',
        destinationToken: 'acct_test_xyz',
        idempotencyKey: 'idemp-payout-01',
        description: 'Appraiser payout'
      });

      expect(result.success).toBe(true);
      expect(result.providerTransactionId).toBe('tr_test_123');
      expect(result.status).toBe(PaymentStatus.PROCESSING);
    });
  });

  describe('refund', () => {
    it('refunds a payment intent', async () => {
      const result = await provider.refund({
        amountCents: 50000,
        originalTransactionId: 'pi_test_123',
        description: 'Order cancelled'
      });

      expect(result.success).toBe(true);
      expect(result.providerTransactionId).toBe('re_test_123');
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
