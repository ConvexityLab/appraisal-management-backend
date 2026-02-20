/**
 * PaymentProvider Interface
 * 
 * Provider-agnostic contract for payment processing.
 * Implement this interface to add a new payment backend (Stripe, Column, Plaid, etc.).
 * The PaymentProcessingService delegates all money-movement operations here —
 * swapping providers is a one-file change in the factory (./index.ts).
 */

import { PaymentStatus } from '../../types/payment.types.js';

// ============================================================================
// Provider-level types (intentionally decoupled from domain types)
// ============================================================================

/** The kind of operation the provider should perform. */
export type PaymentOperationType = 'charge' | 'payout' | 'refund';

/** Charge request — collect money from a client/lender. */
export interface ProviderChargeRequest {
  /** Idempotency key (use invoiceId or paymentId). */
  idempotencyKey: string;
  /** Amount in the smallest currency unit (cents for USD). */
  amountCents: number;
  currency: string;
  /** Provider-specific payment method token (e.g. Stripe PaymentMethod ID). */
  paymentMethodToken?: string;
  description?: string;
  metadata?: Record<string, string>;
}

/** Payout request — send money to a vendor/appraiser. */
export interface ProviderPayoutRequest {
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  /** Provider-specific destination (e.g. Stripe Connected Account, Column ledger ID). */
  destinationToken?: string;
  /** Bank details for ACH / wire if provider needs them directly. */
  bankDetails?: {
    routingNumber: string;
    accountNumber: string;
    accountHolderName: string;
    accountType: 'checking' | 'savings';
  };
  description?: string;
  metadata?: Record<string, string>;
}

/** Refund request. */
export interface ProviderRefundRequest {
  /** The original provider transaction ID to refund. */
  originalTransactionId: string;
  amountCents: number;
  currency: string;
  reason?: string;
  metadata?: Record<string, string>;
}

/** Unified result from any provider operation. */
export interface ProviderResult {
  success: boolean;
  /** Provider's own transaction / payment-intent / transfer ID. */
  providerTransactionId?: string;
  status: PaymentStatus;
  message?: string;
  error?: string;
  /** URL the user can visit to see a receipt (Stripe receipt_url, etc.). */
  receiptUrl?: string;
  /** Raw provider response for debugging (never sent to clients). */
  rawResponse?: unknown;
}

// ============================================================================
// The interface
// ============================================================================

export interface PaymentProvider {
  /** Human-readable name shown in logs and admin UI. */
  readonly name: string;

  /**
   * Charge a client / lender (inbound money).
   * Not every provider supports charges — throw if unsupported.
   */
  charge(request: ProviderChargeRequest): Promise<ProviderResult>;

  /**
   * Pay out to a vendor / appraiser (outbound money).
   */
  payout(request: ProviderPayoutRequest): Promise<ProviderResult>;

  /**
   * Refund a previous charge or claw back a payout.
   */
  refund(request: ProviderRefundRequest): Promise<ProviderResult>;

  /**
   * Health-check — can the provider accept requests right now?
   * Return false if API keys are missing, service is down, etc.
   */
  isAvailable(): boolean;
}
