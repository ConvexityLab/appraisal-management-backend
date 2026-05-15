/**
 * MopVendorMatchingRulesProvider
 *
 * Calls MOP's HTTP vendor-matching eval endpoint. MOP wraps Prio's RETE
 * engine — same semantics as our homegrown service but evaluated by a real
 * production rules engine with native priority/whitelist/aggregation/RETE.
 *
 * MOP IS OWNED AND CONTROLLED BY US. The wire format below is the contract
 * MOP must implement to support vendor-matching evaluation. If MOP doesn't
 * yet expose this endpoint, the path forward is to add it — not to bend
 * this provider around a different shape. Treat this file as the canonical
 * spec for what MOP needs to deliver.
 *
 * To enable in production:
 *   1. Make sure MOP exposes the contract below (POST to EVAL_PATH).
 *   2. Set MOP_RULES_BASE_URL env var.
 *   3. Set RULES_PROVIDER=mop-with-fallback (recommended for resilience)
 *      or RULES_PROVIDER=mop (fail-closed if MOP is down).
 *
 * Wire format (the contract MOP implements):
 *
 *   POST {MOP_RULES_BASE_URL}/api/v1/vendor-matching/evaluate
 *   Body: {
 *     tenantId: string,
 *     program:  "vendor-matching",
 *     evaluations: [
 *       { vendor: { id, capabilities, licenseType?, performanceScore?, states, distance },
 *         order:  { productType?, propertyState?, orderValueUsd? } },
 *       ...
 *     ]
 *   }
 *
 *   Response 200:
 *   {
 *     results: [
 *       { eligible: boolean,
 *         scoreAdjustment: number,
 *         appliedRuleIds: string[],
 *         denyReasons: string[] },
 *       ...   // length and order MUST match the request's evaluations[]
 *     ]
 *   }
 *
 *   Errors: any non-2xx response or malformed body throws — callers
 *   (typically FallbackVendorMatchingRulesProvider) decide whether to
 *   degrade or surface.
 */

import { Logger } from '../../utils/logger.js';
import type {
  VendorMatchingRulesProvider,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './provider.types.js';

/**
 * Wraps a non-2xx HTTP response from MOP. Status is preserved so the
 * retry classifier can keep 5xx (transient — retry) distinct from 4xx
 * (deterministic — don't retry).
 */
export class MopHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'MopHttpError';
  }
}

export interface MopProviderConfig {
  baseUrl: string;
  /** Per-request timeout in ms. Default 2000. */
  timeoutMs?: number;
  /**
   * Optional value for the standard `Authorization` header (e.g.
   * `Bearer <jwt>`). Use when MOP's auth-proxy is configured to validate JWTs.
   */
  authHeader?: string;
  /**
   * Optional value for MOP's `X-Service-Auth` header — the documented
   * service-to-service token that bypasses JWT/Aegis at the auth-proxy.
   * Pulled from Key Vault secret `sentinel-mop-webhook-secret` (see
   * mortgage-origination-platform/infrastructure/main.bicep). This is the
   * recommended path for AMS → MOP calls until per-consumer JWT auth lands.
   */
  serviceAuthToken?: string;
  /**
   * Bounded retry attempts for transient network failures (ECONNRESET,
   * ECONNREFUSED, EAI_AGAIN) and HTTP 5xx responses. Excludes timeouts
   * (we've already burned the time budget) and 4xx (request-shape bugs
   * don't get better on retry). Default 1 (one retry, so up to 2 calls).
   */
  retryAttempts?: number;
  /**
   * Base delay in ms between retries; the actual wait is base * 2^(attempt).
   * Default 100ms — at retryAttempts=1, total added latency cap is ~100ms.
   */
  retryBaseDelayMs?: number;
}

export class MopVendorMatchingRulesProvider implements VendorMatchingRulesProvider {
  readonly name = 'mop' as const;
  private readonly logger = new Logger('MopRulesProvider');
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly authHeader: string | null;
  private readonly serviceAuthToken: string | null;
  private readonly retryAttempts: number;
  private readonly retryBaseDelayMs: number;

  /** Path on MOP for vendor-matching evaluation (when MOP supports it). */
  private static readonly EVAL_PATH = '/api/v1/vendor-matching/evaluate';
  /** Path on MOP for liveness — uses MOP's existing /health. */
  private static readonly HEALTH_PATH = '/health';

  constructor(config: MopProviderConfig) {
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      throw new Error('MopVendorMatchingRulesProvider requires a non-empty baseUrl');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 2000;
    this.authHeader = config.authHeader ?? null;
    this.serviceAuthToken = config.serviceAuthToken ?? null;
    this.retryAttempts = Math.max(0, config.retryAttempts ?? 1);
    this.retryBaseDelayMs = Math.max(0, config.retryBaseDelayMs ?? 100);
  }

  async evaluateForVendors(
    tenantId: string,
    contexts: RuleEvaluationContext[]
  ): Promise<RuleEvaluationResult[]> {
    if (contexts.length === 0) return [];

    const url = `${this.baseUrl}${MopVendorMatchingRulesProvider.EVAL_PATH}`;
    const body = {
      tenantId,
      program: 'vendor-matching',
      evaluations: contexts.map(ctx => ({ vendor: ctx.vendor, order: ctx.order })),
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authHeader) headers['Authorization'] = this.authHeader;
    if (this.serviceAuthToken) headers['X-Service-Auth'] = this.serviceAuthToken;

    const maxAttempts = this.retryAttempts + 1;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.singleEvalCall(url, headers, body, contexts.length, tenantId, attempt);
      } catch (err) {
        lastErr = err;
        // Retry only for transient network errors + 5xx. Timeouts do NOT
        // retry — we've already burned the per-request budget and a retry
        // would just double the latency hit. 4xx do not retry — bad
        // request shapes don't get better on retry.
        if (attempt < maxAttempts && this.isTransient(err)) {
          const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn('mop.eval.retry', {
            tenantId,
            attempt,
            nextDelayMs: delay,
            message: err instanceof Error ? err.message : String(err),
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    // Unreachable — the loop always either returns or throws — but TS needs it.
    throw lastErr;
  }

  /**
   * One-shot call to MOP — no retry logic. The outer evaluateForVendors
   * wraps this in a bounded retry loop for transient network failures only.
   */
  private async singleEvalCall(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    expectedCount: number,
    tenantId: string,
    attempt: number,
  ): Promise<RuleEvaluationResult[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = Date.now();
    let httpStatus: number | null = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      httpStatus = response.status;

      if (!response.ok) {
        throw new MopHttpError(response.status, `MOP eval returned ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { results?: unknown };

      if (!Array.isArray(data.results) || data.results.length !== expectedCount) {
        throw new Error(
          `MOP eval response malformed: expected results[] of length ${expectedCount}, got ${
            Array.isArray(data.results) ? data.results.length : typeof data.results
          }`
        );
      }

      const results = data.results.map(r => this.normalizeResult(r));

      // Observability: structured per-request log so we can graph latency,
      // denial rate, fallback rate, and shape regressions over time.
      const denied = results.filter(r => !r.eligible).length;
      const adjusted = results.filter(r => r.scoreAdjustment !== 0).length;
      this.logger.info('mop.eval.success', {
        tenantId,
        vendorCount: expectedCount,
        deniedCount: denied,
        adjustedCount: adjusted,
        latencyMs: Date.now() - start,
        httpStatus,
        attempt,
      });

      return results;
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      this.logger.error('mop.eval.failure', {
        tenantId,
        vendorCount: expectedCount,
        latencyMs: Date.now() - start,
        httpStatus,
        attempt,
        kind: isTimeout ? 'timeout' : err?.constructor?.name ?? 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
      if (isTimeout) {
        throw new Error(`MOP eval timed out after ${this.timeoutMs}ms`);
      }
      // Re-throw so the FallbackRulesProvider can degrade. Single-vendor failures
      // never reach here — the whole batch fails or the whole batch succeeds.
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Classify whether an error is retryable. Conservative — only network
   * connectivity issues and HTTP 5xx are retried; everything else
   * (timeouts, 4xx, malformed body) is surfaced immediately.
   */
  private isTransient(err: unknown): boolean {
    if (err instanceof MopHttpError) {
      return err.status >= 500;
    }
    // node-fetch/undici errors expose a cause/code chain for ECONNRESET etc.
    const code = (err as { code?: string; cause?: { code?: string } })?.code
      ?? (err as { cause?: { code?: string } })?.cause?.code;
    if (typeof code === 'string') {
      return code === 'ECONNRESET'
        || code === 'ECONNREFUSED'
        || code === 'EAI_AGAIN'
        || code === 'ETIMEDOUT'
        || code === 'UND_ERR_SOCKET';
    }
    return false;
  }

  async isHealthy(): Promise<boolean> {
    const url = `${this.baseUrl}${MopVendorMatchingRulesProvider.HEALTH_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(1000, this.timeoutMs));
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Defensive normalization: clamp/coerce a raw MOP result entry into our
   * RuleEvaluationResult shape so a slightly-off MOP response doesn't crash
   * the engine. Logs (without throwing) when fields are missing.
   */
  private normalizeResult(raw: unknown): RuleEvaluationResult {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const eligible = typeof r.eligible === 'boolean' ? r.eligible : true;
    const scoreAdjustment = typeof r.scoreAdjustment === 'number' ? r.scoreAdjustment : 0;
    const appliedRuleIds = Array.isArray(r.appliedRuleIds)
      ? r.appliedRuleIds.filter((id): id is string => typeof id === 'string')
      : [];
    const denyReasons = Array.isArray(r.denyReasons)
      ? r.denyReasons.filter((s): s is string => typeof s === 'string')
      : [];

    return { eligible, scoreAdjustment, appliedRuleIds, denyReasons };
  }
}
