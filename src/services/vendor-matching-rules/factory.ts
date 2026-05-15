/**
 * VendorMatchingRulesProvider factory — env-driven selection.
 *
 *   RULES_PROVIDER=homegrown          (default; current/Phase-1 behavior)
 *   RULES_PROVIDER=mop                (MOP only; fail closed if MOP is down)
 *   RULES_PROVIDER=mop-with-fallback  (MOP primary, homegrown fallback)
 *
 *   MOP_RULES_BASE_URL=https://mop.example         (required when mop is in play)
 *   MOP_RULES_TIMEOUT_MS=2000
 *   MOP_RULES_AUTH_HEADER=                          (optional, e.g. "Bearer xyz")
 *   MOP_RULES_SERVICE_AUTH_TOKEN=                   (optional; sent as X-Service-Auth.
 *                                                   Recommended for AMS → MOP today;
 *                                                   pull from KV `sentinel-mop-webhook-secret`.)
 *   MOP_RULES_BREAKER_FAILURES=3
 *   MOP_RULES_BREAKER_WINDOW_MS=30000
 *   MOP_RULES_BREAKER_COOLDOWN_MS=60000
 *
 * Misconfiguration (e.g. RULES_PROVIDER=mop without MOP_RULES_BASE_URL) throws
 * synchronously at startup — no silent fallback to homegrown. Use the explicit
 * 'mop-with-fallback' value if you want resilience.
 */

import { Logger } from '../../utils/logger.js';
import { VendorMatchingRulesService } from '../vendor-matching-rules.service.js';
import { CosmosDbService } from '../cosmos-db.service.js';
import { HomegrownVendorMatchingRulesProvider } from './homegrown.provider.js';
import { MopVendorMatchingRulesProvider } from './mop.provider.js';
import { FallbackVendorMatchingRulesProvider } from './fallback.provider.js';
import type { VendorMatchingRulesProvider } from './provider.types.js';

const logger = new Logger('VendorMatchingRulesProviderFactory');

export interface FactoryDeps {
  /** Optional pre-built dependencies (for tests / DI). Defaults are constructed. */
  rulesService?: VendorMatchingRulesService;
  dbService?: CosmosDbService;
  /** Override env reading (for tests). */
  env?: NodeJS.ProcessEnv;
}

export function createVendorMatchingRulesProvider(deps: FactoryDeps = {}): VendorMatchingRulesProvider {
  const env = deps.env ?? process.env;
  const choice = (env.RULES_PROVIDER ?? 'homegrown').toLowerCase();

  const buildHomegrown = (): HomegrownVendorMatchingRulesProvider => {
    const dbService = deps.dbService ?? new CosmosDbService();
    const rulesService = deps.rulesService ?? new VendorMatchingRulesService(dbService);
    return new HomegrownVendorMatchingRulesProvider(rulesService);
  };

  const buildMop = (): MopVendorMatchingRulesProvider => {
    const baseUrl = env.MOP_RULES_BASE_URL;
    if (!baseUrl || baseUrl.trim() === '') {
      throw new Error(
        'RULES_PROVIDER includes MOP but MOP_RULES_BASE_URL is unset. ' +
        'Set MOP_RULES_BASE_URL=<mop endpoint> or set RULES_PROVIDER=homegrown.'
      );
    }
    const timeoutMs = parseIntEnv(env.MOP_RULES_TIMEOUT_MS, 2000);
    return new MopVendorMatchingRulesProvider({
      baseUrl,
      timeoutMs,
      ...(env.MOP_RULES_AUTH_HEADER ? { authHeader: env.MOP_RULES_AUTH_HEADER } : {}),
      ...(env.MOP_RULES_SERVICE_AUTH_TOKEN ? { serviceAuthToken: env.MOP_RULES_SERVICE_AUTH_TOKEN } : {}),
    });
  };

  switch (choice) {
    case 'homegrown': {
      logger.info('Vendor matching rules provider: homegrown');
      return buildHomegrown();
    }
    case 'mop': {
      logger.info('Vendor matching rules provider: mop (fail closed)');
      return buildMop();
    }
    case 'mop-with-fallback': {
      logger.info('Vendor matching rules provider: mop primary, homegrown fallback');
      return new FallbackVendorMatchingRulesProvider(
        buildMop(),
        buildHomegrown(),
        {
          failureThreshold: parseIntEnv(env.MOP_RULES_BREAKER_FAILURES, 3),
          windowMs: parseIntEnv(env.MOP_RULES_BREAKER_WINDOW_MS, 30_000),
          cooldownMs: parseIntEnv(env.MOP_RULES_BREAKER_COOLDOWN_MS, 60_000),
        }
      );
    }
    default:
      throw new Error(
        `Unknown RULES_PROVIDER value: "${env.RULES_PROVIDER}". ` +
        `Expected one of: homegrown, mop, mop-with-fallback.`
      );
  }
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
