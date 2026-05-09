/**
 * MopRulePackPusher — pushes a freshly-created AMS rule pack to MOP via
 * PUT /api/v1/vendor-matching/tenants/:tenantId/rules.
 *
 * Phase 3 T22/T24 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.4. Wired into
 * VendorMatchingRulePackService.onNewActivePack so every successful CRUD
 * triggers a push. Best-effort: a push failure does NOT roll back the
 * AMS storage write (service handles that). Failed pushes are logged
 * and self-heal via the startup re-seeder (T22b — separate piece).
 */

import { Logger } from '../utils/logger.js';
import type { RulePackDocument } from '../types/vendor-matching-rule-pack.types.js';

export interface MopRulePackPusherConfig {
  baseUrl: string;
  /** Per-PUT timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** X-Service-Auth header value (mirror of sentinel-mop-webhook-secret). */
  serviceAuthToken?: string;
  /** Optional Authorization header (Entra JWT) — used when auth-proxy is JWT-only. */
  authHeader?: string;
}

export class MopRulePackPusher {
  private readonly logger = new Logger('MopRulePackPusher');
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly serviceAuthToken: string | null;
  private readonly authHeader: string | null;

  constructor(config: MopRulePackPusherConfig) {
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      throw new Error('MopRulePackPusher requires a non-empty baseUrl');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.serviceAuthToken = config.serviceAuthToken ?? null;
    this.authHeader = config.authHeader ?? null;
  }

  /**
   * PUT a rule pack to MOP. Throws on any non-2xx — callers (typically
   * the rule-pack service hook) should catch and log so storage writes
   * don't get rolled back on push failures.
   */
  async push(pack: RulePackDocument): Promise<void> {
    const url =
      `${this.baseUrl}/api/v1/vendor-matching/tenants/` +
      encodeURIComponent(pack.tenantId) + '/rules';

    // Wire format MOP expects (matches VendorMatchingService.cpp's load path):
    // a program block + rules array. We tag the body with __amsVersion so
    // MOP's diagnostics surface the right version.
    const body = {
      program: {
        name: pack.metadata.name ?? `Tenant ${pack.tenantId} pack ${pack.packId}`,
        programId: 'vendor-matching',
        version: String(pack.version),
        description:
          pack.metadata.description ??
          `Pack ${pack.packId} v${pack.version} for tenant ${pack.tenantId}`,
      },
      rules: pack.rules,
      __amsVersion: pack.version,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = Date.now();

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.authHeader) headers['Authorization'] = this.authHeader;
      if (this.serviceAuthToken) headers['X-Service-Auth'] = this.serviceAuthToken;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errBody = '';
        try { errBody = await response.text(); } catch { /* ignore */ }
        throw new Error(
          `MOP PUT returned ${response.status} ${response.statusText}: ${errBody.slice(0, 500)}`
        );
      }

      this.logger.info('mop.rules.push.success', {
        tenantId: pack.tenantId,
        packId: pack.packId,
        version: pack.version,
        ruleCount: pack.rules.length,
        latencyMs: Date.now() - start,
      });
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      this.logger.error('mop.rules.push.failure', {
        tenantId: pack.tenantId,
        packId: pack.packId,
        version: pack.version,
        latencyMs: Date.now() - start,
        kind: isTimeout ? 'timeout' : err?.constructor?.name ?? 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
      if (isTimeout) {
        throw new Error(`MOP PUT timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Stateless rule-pack preview. Forwards to MOP's
   * POST /api/v1/vendor-matching/preview which compiles a transient
   * VendorMatchingService from the request body, evaluates, returns
   * results — no persistence, no registry mutation. Used by the FE
   * rules workspace to test an unsaved rule pack against sample vendors.
   *
   * Throws on non-2xx (bubbles MOP's validation errors up to the caller
   * verbatim so the operator sees the C++ validator's error list).
   */
  async preview(input: {
    rulePack: { program: Record<string, unknown>; rules: unknown[] };
    evaluations: Array<Record<string, unknown>>;
  }): Promise<{ results: Array<{
    eligible: boolean;
    scoreAdjustment: number;
    appliedRuleIds: string[];
    denyReasons: string[];
  }> }> {
    const url = `${this.baseUrl}/api/v1/vendor-matching/preview`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = Date.now();

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.authHeader) headers['Authorization'] = this.authHeader;
      if (this.serviceAuthToken) headers['X-Service-Auth'] = this.serviceAuthToken;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        // Bubble the MOP validator's error message so the FE can show it
        // exactly as the operator would see on save.
        throw new Error(
          `MOP preview returned ${response.status} ${response.statusText}: ${text.slice(0, 1000)}`
        );
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error(`MOP preview returned non-JSON body: ${text.slice(0, 200)}`);
      }
      if (!parsed || !Array.isArray(parsed.results)) {
        throw new Error(`MOP preview response missing results[]; got: ${text.slice(0, 200)}`);
      }

      this.logger.info('mop.rules.preview.success', {
        evaluations: input.evaluations.length,
        ruleCount: input.rulePack.rules.length,
        latencyMs: Date.now() - start,
      });
      return parsed;
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      this.logger.error('mop.rules.preview.failure', {
        evaluations: input.evaluations.length,
        latencyMs: Date.now() - start,
        kind: isTimeout ? 'timeout' : err?.constructor?.name ?? 'Error',
        message: err instanceof Error ? err.message : String(err),
      });
      if (isTimeout) {
        throw new Error(`MOP preview timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Drop a tenant's rules from MOP (DELETE). Used when a tenant disables
   * their custom pack and wants to fall back to the default seed.
   */
  async drop(tenantId: string): Promise<void> {
    const url =
      `${this.baseUrl}/api/v1/vendor-matching/tenants/` +
      encodeURIComponent(tenantId) + '/rules';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {};
      if (this.authHeader) headers['Authorization'] = this.authHeader;
      if (this.serviceAuthToken) headers['X-Service-Auth'] = this.serviceAuthToken;

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`MOP DELETE returned ${response.status} ${response.statusText}`);
      }
      this.logger.info('mop.rules.drop.success', { tenantId });
    } finally {
      clearTimeout(timer);
    }
  }
}
