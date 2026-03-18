/**
 * LOS Provider Factory
 *
 * Selects the appropriate LosProvider implementation based on environment config.
 * Callers never import a concrete provider directly — wire this factory and
 * swap LOS backends by changing env vars.
 *
 * Resolution order (first match wins):
 *   1. LOS_PROVIDER=encompass + ENCOMPASS_* vars set  → EncompassLosProvider
 *   2. LOS_PROVIDER=black_knight + BLACKKNIGHT_* vars → BlackKnightLosProvider
 *   3. Nothing configured                              → MockLosProvider (dev/test)
 *
 * Env vars:
 *   LOS_PROVIDER           — 'encompass' | 'black_knight'  (optional; auto-detected if omitted)
 *   ENCOMPASS_CLIENT_ID    — Encompass OAuth client ID
 *   ENCOMPASS_CLIENT_SECRET— Encompass OAuth client secret
 *   ENCOMPASS_INSTANCE_ID  — Encompass instance ID (e.g. BE11223344)
 *   ENCOMPASS_ENV          — 'production' | 'sandbox'  (default: 'sandbox')
 *   BLACKKNIGHT_API_KEY    — Black Knight API key
 *   BLACKKNIGHT_BASE_URL   — Full base URL for your Black Knight instance
 */

import type { LosProvider } from './los-provider.interface.js';
import { EncompassLosProvider } from './encompass.provider.js';
import { BlackKnightLosProvider } from './black-knight.provider.js';
import { MockLosProvider } from './mock.provider.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('LosProviderFactory');

export function createLosProvider(): LosProvider {
  const forced = process.env.LOS_PROVIDER?.toLowerCase();

  // ── Explicit override ─────────────────────────────────────────────────
  if (forced === 'encompass') {
    const clientId    = requireEnv('ENCOMPASS_CLIENT_ID',     'LOS_PROVIDER=encompass');
    const secret      = requireEnv('ENCOMPASS_CLIENT_SECRET', 'LOS_PROVIDER=encompass');
    const instanceId  = requireEnv('ENCOMPASS_INSTANCE_ID',   'LOS_PROVIDER=encompass');
    const env         = process.env.ENCOMPASS_ENV ?? 'sandbox';
    logger.info(`LOS provider: ICE Encompass (forced, env=${env})`);
    return new EncompassLosProvider(clientId, secret, instanceId, env);
  }

  if (forced === 'black_knight') {
    const apiKey  = requireEnv('BLACKKNIGHT_API_KEY',  'LOS_PROVIDER=black_knight');
    const baseUrl = requireEnv('BLACKKNIGHT_BASE_URL', 'LOS_PROVIDER=black_knight');
    logger.info('LOS provider: Black Knight Empower (forced)');
    return new BlackKnightLosProvider(apiKey, baseUrl);
  }

  // ── Auto-detect ───────────────────────────────────────────────────────
  const encompassClientId   = process.env.ENCOMPASS_CLIENT_ID;
  const encompassSecret     = process.env.ENCOMPASS_CLIENT_SECRET;
  const encompassInstanceId = process.env.ENCOMPASS_INSTANCE_ID;
  if (encompassClientId && encompassSecret && encompassInstanceId) {
    const env = process.env.ENCOMPASS_ENV ?? 'sandbox';
    logger.info(`LOS provider: ICE Encompass (auto-detected, env=${env})`);
    return new EncompassLosProvider(encompassClientId, encompassSecret, encompassInstanceId, env);
  }

  const bkApiKey  = process.env.BLACKKNIGHT_API_KEY;
  const bkBaseUrl = process.env.BLACKKNIGHT_BASE_URL;
  if (bkApiKey && bkBaseUrl) {
    logger.info('LOS provider: Black Knight Empower (auto-detected)');
    return new BlackKnightLosProvider(bkApiKey, bkBaseUrl);
  }

  logger.info('LOS provider: Mock (no LOS credentials configured)');
  return new MockLosProvider();
}

function requireEnv(name: string, context: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `[LosProviderFactory] Missing required env var "${name}" (needed when ${context}). ` +
      `Set it in your .env file or Azure App Settings before starting the server.`,
    );
  }
  return val;
}

// Re-export types for convenience
export type { LosProvider, LosLoan, LosImportRequest, LosImportResult, LosPushRequest, LosPushResult } from './los-provider.interface.js';
