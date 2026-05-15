/**
 * FallbackVendorMatchingRulesProvider
 *
 * Decorator that tries a primary provider first, falls back to a secondary
 * on error. Includes a sliding-window circuit breaker: after N failures in
 * a window, the breaker opens and all calls go straight to secondary for a
 * cooldown period before the breaker tentatively closes again.
 *
 * Default config (overridable):
 *   failures:   3 in 30 seconds → open
 *   cooldown:   60 seconds → half-open (next request tests primary)
 *
 * If the secondary also fails, the original primary error is re-thrown
 * (callers can decide whether to fail the whole assignment or proceed
 * without rules).
 */

import { Logger } from '../../utils/logger.js';
import type {
  ProviderName,
  VendorMatchingRulesProvider,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './provider.types.js';

export interface FallbackProviderConfig {
  /** Number of failures within the window that opens the breaker. Default 3. */
  failureThreshold?: number;
  /** Sliding window in ms over which failures are counted. Default 30_000. */
  windowMs?: number;
  /** Time in ms the breaker stays open before half-opening. Default 60_000. */
  cooldownMs?: number;
}

type BreakerState = 'closed' | 'open' | 'half-open';

export class FallbackVendorMatchingRulesProvider implements VendorMatchingRulesProvider {
  readonly name: ProviderName;
  private readonly logger = new Logger('FallbackRulesProvider');
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;

  private state: BreakerState = 'closed';
  private failureTimestamps: number[] = [];
  private openedAt: number | null = null;

  constructor(
    private readonly primary: VendorMatchingRulesProvider,
    private readonly secondary: VendorMatchingRulesProvider,
    config: FallbackProviderConfig = {}
  ) {
    this.failureThreshold = config.failureThreshold ?? 3;
    this.windowMs = config.windowMs ?? 30_000;
    this.cooldownMs = config.cooldownMs ?? 60_000;
    // Compose the name so logs / explanations show e.g. "mop-with-fallback".
    this.name = `${primary.name}-with-fallback` as ProviderName;
  }

  async evaluateForVendors(
    tenantId: string,
    contexts: RuleEvaluationContext[]
  ): Promise<RuleEvaluationResult[]> {
    if (this.shouldUsePrimary()) {
      try {
        const result = await this.primary.evaluateForVendors(tenantId, contexts);
        this.onPrimarySuccess();
        return result;
      } catch (err) {
        this.onPrimaryFailure(err);
        return this.callSecondary(tenantId, contexts, err);
      }
    }
    // Breaker open: skip primary entirely.
    this.logger.info('Circuit breaker open; calling secondary directly', {
      primary: this.primary.name,
      secondary: this.secondary.name,
    });
    return this.callSecondary(tenantId, contexts, null);
  }

  async isHealthy(): Promise<boolean> {
    // Healthy if either layer is up.
    if (await this.primary.isHealthy()) return true;
    return this.secondary.isHealthy();
  }

  // ── Internal: breaker state machine ─────────────────────────────────────

  private shouldUsePrimary(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      const cooled = this.openedAt !== null && Date.now() - this.openedAt >= this.cooldownMs;
      if (cooled) {
        // Move to half-open: allow one trial request through.
        this.state = 'half-open';
        this.logger.info('Circuit breaker half-open; trialing primary', {
          primary: this.primary.name,
        });
        return true;
      }
      return false;
    }
    // half-open: trial in progress; this method is called once before
    // onPrimarySuccess/onPrimaryFailure fires. Allow the trial.
    return true;
  }

  private onPrimarySuccess(): void {
    if (this.state !== 'closed') {
      this.logger.info('Primary recovered; closing circuit breaker', {
        primary: this.primary.name,
      });
    }
    this.state = 'closed';
    this.failureTimestamps = [];
    this.openedAt = null;
  }

  private onPrimaryFailure(err: unknown): void {
    const now = Date.now();
    this.failureTimestamps.push(now);
    this.failureTimestamps = this.failureTimestamps.filter(t => now - t <= this.windowMs);

    this.logger.error('Primary rules provider failed; will fall back', {
      primary: this.primary.name,
      failuresInWindow: this.failureTimestamps.length,
      error: err instanceof Error ? err.message : String(err),
    });

    if (this.state === 'half-open' || this.failureTimestamps.length >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = now;
      this.logger.error('Circuit breaker OPEN', {
        primary: this.primary.name,
        cooldownMs: this.cooldownMs,
      });
    }
  }

  private async callSecondary(
    tenantId: string,
    contexts: RuleEvaluationContext[],
    primaryError: unknown
  ): Promise<RuleEvaluationResult[]> {
    try {
      return await this.secondary.evaluateForVendors(tenantId, contexts);
    } catch (secondaryErr) {
      this.logger.error('Secondary rules provider also failed', {
        secondary: this.secondary.name,
        error: secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr),
      });
      // Prefer surfacing the primary error if we have one (it's the root cause).
      throw primaryError ?? secondaryErr;
    }
  }
}
