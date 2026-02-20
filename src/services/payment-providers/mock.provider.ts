/**
 * Mock Payment Provider
 * 
 * Returns realistic simulated responses for local development and testing.
 * This is the default provider when no real payment backend is configured.
 */

import { PaymentStatus } from '../../types/payment.types.js';
import {
  PaymentProvider,
  ProviderChargeRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderResult,
} from './payment-provider.interface.js';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'Mock (simulated)';

  isAvailable(): boolean {
    return true; // always available
  }

  async charge(request: ProviderChargeRequest): Promise<ProviderResult> {
    // Simulate network latency
    await this.delay(300);

    const txId = `mock_ch_${Date.now()}`;
    console.log(`🧪 [MOCK] charge $${(request.amountCents / 100).toFixed(2)} → ${txId}`);

    return {
      success: true,
      providerTransactionId: txId,
      status: PaymentStatus.COMPLETED,
      message: 'Mock charge completed successfully',
      receiptUrl: `https://mock-receipts.local/${txId}`,
    };
  }

  async payout(request: ProviderPayoutRequest): Promise<ProviderResult> {
    await this.delay(400);

    const txId = `mock_po_${Date.now()}`;
    console.log(`🧪 [MOCK] payout $${(request.amountCents / 100).toFixed(2)} → ${txId}`);

    // ACH-style payouts are typically PROCESSING (1-3 day settlement)
    return {
      success: true,
      providerTransactionId: txId,
      status: PaymentStatus.PROCESSING,
      message: 'Mock payout initiated — would settle in 1-3 business days',
    };
  }

  async refund(request: ProviderRefundRequest): Promise<ProviderResult> {
    await this.delay(250);

    const txId = `mock_rf_${Date.now()}`;
    console.log(`🧪 [MOCK] refund $${(request.amountCents / 100).toFixed(2)} against ${request.originalTransactionId} → ${txId}`);

    return {
      success: true,
      providerTransactionId: txId,
      status: PaymentStatus.COMPLETED,
      message: 'Mock refund processed',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
