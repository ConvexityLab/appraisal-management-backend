/**
 * Vendor Matching Rules Provider — abstraction over rule-evaluation backends.
 *
 * The matching engine asks a provider "given these vendor/order facts, are
 * each of these vendors eligible, and what's the score adjustment per vendor?".
 * The provider delegates to one of:
 *   - HomegrownVendorMatchingRulesProvider — wraps the in-process
 *     VendorMatchingRulesService (Cosmos-backed rules, switch-based eval).
 *   - MopVendorMatchingRulesProvider — calls MOP's HTTP eval endpoint
 *     (which wraps Prio's RETE engine).
 *   - FallbackRulesProvider — decorator: tries primary, falls back to
 *     secondary on error / when circuit breaker is open.
 *
 * The interface is intentionally minimal:
 *   1. evaluateForVendors() — batch evaluation, one call per request
 *      regardless of vendor count. Returns results in input order.
 *   2. isHealthy() — for circuit-breaker checks and readiness probes.
 *
 * CRUD on rules stays on the homegrown side (vendor-matching-rules.controller
 * + Cosmos container). This interface only abstracts evaluation.
 *
 * Phase 2 of docs/AUTO_ASSIGNMENT_REVIEW.md.
 */

import type {
  RuleEvaluationContext,
  RuleEvaluationResult,
} from '../vendor-matching-rules.service.js';

export type ProviderName = 'homegrown' | 'mop' | 'mop-with-fallback';

export interface VendorMatchingRulesProvider {
  /** Stable identifier for logs / metrics / explanations. */
  readonly name: ProviderName;

  /**
   * Evaluate rules for many vendor/order pairs in a single call.
   * The returned array has the same length as `contexts` and matches by index.
   *
   * Implementations MUST never throw under normal conditions for individual
   * vendors — return a result with `eligible: true, scoreAdjustment: 0,
   * appliedRuleIds: [], denyReasons: []` if a single vendor's evaluation
   * fails. Throw only on full-provider failure (network down, total timeout)
   * so the FallbackRulesProvider can catch + degrade.
   */
  evaluateForVendors(
    tenantId: string,
    contexts: RuleEvaluationContext[]
  ): Promise<RuleEvaluationResult[]>;

  /**
   * Liveness check used by the fallback provider's circuit breaker.
   * Returns true when the provider is currently usable, false otherwise.
   * Should be cheap — a cached health bit or a lightweight ping.
   */
  isHealthy(): Promise<boolean>;
}

/** Re-export the underlying types so callers don't reach into the service. */
export type { RuleEvaluationContext, RuleEvaluationResult };
