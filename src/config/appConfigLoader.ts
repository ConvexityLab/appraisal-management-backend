// src/config/appConfigLoader.ts

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * App Config key → process.env variable name
 *
 * Add entries here for every service URL this app needs from App Config.
 */
// IMPORTANT: this loader runs from app-production.ts:93 — AFTER all module
// imports complete, BEFORE the server is constructed. Any env var consumed
// at module-top-level (e.g. `export const x = new SomeService()` patterns
// in src/controllers/{criteria,results,reviews}.controller.ts) is read
// before this runs and CANNOT be migrated to App Config until the offending
// service tree is refactored to lazy-instantiate.
//
// Verified-safe migrations below. Other candidates (storage, openai endpoint,
// service bus, web pubsub, fluid relay, communication, statebridge, batchdata
// endpoint, cosmos) all fall in the module-top-level cascade and stay in bicep.
const KEY_TO_ENV: Record<string, string> = {
  // Axiom — read by AxiomService constructor which uses fallbacks (no throw at startup)
  'services.axiom-api.base-url': 'AXIOM_API_BASE_URL',
  'services.axiom-api.client-id': 'AXIOM_CLIENT_ID',
  'services.axiom-api.sub-client-id': 'AXIOM_SUB_CLIENT_ID',
  'services.axiom-api.pipeline-id-schema-extract': 'AXIOM_PIPELINE_ID_SCHEMA_EXTRACT',
  'services.axiom-auth.required': 'AXIOM_AUTH_REQUIRED',
  'services.axiom-auth.audience': 'AXIOM_AUTH_AUDIENCE',
  // Inspection — read by IVueitInspectionProvider, instantiated via
  // setupAuthorizationRoutes which runs from server.start() (post-loadAppConfig)
  'services.inspection.provider': 'INSPECTION_PROVIDER',
  'services.inspection.base-url': 'IVUEIT_BASE_URL',
  // When MOP connectivity is resolved (see APP_CONFIG_SERVICE_DISCOVERY.md §2):
  // 'services.mop-api.internal-url': 'MOP_API_BASE_URL',
};

/**
 * Load service discovery URLs from Azure App Configuration into process.env.
 *
 * - Skips entirely if AZURE_APP_CONFIGURATION_ENDPOINT is not set (local dev / tests).
 * - Never overwrites an env var that already has a value (explicit env always wins).
 * - Errors are logged but do not crash startup — the server continues with whatever
 *   env vars were already set.
 */
export async function loadAppConfig(): Promise<void> {
  const endpoint = process.env['AZURE_APP_CONFIGURATION_ENDPOINT'];
  if (!endpoint) {
    return; // Not configured — local dev or tests; no-op
  }

  const label = process.env['APP_CONFIG_LABEL'] ?? 'dev';

  try {
    const client = new AppConfigurationClient(endpoint, new DefaultAzureCredential());

    for (const [appConfigKey, envVar] of Object.entries(KEY_TO_ENV)) {
      try {
        const setting = await client.getConfigurationSetting({ key: appConfigKey, label });

        if (!setting.value) continue;

        if (process.env[envVar]) {
          console.log(`[appconfig] Skipped ${envVar} (already set via env)`);
        } else {
          process.env[envVar] = setting.value;
          console.log(`[appconfig] Set ${envVar} from App Config`);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 404
        ) {
          // Key doesn't exist for this label — not an error
          continue;
        }
        console.warn(`[appconfig] Failed to read "${appConfigKey}" (label=${label}):`, err);
      }
    }
  } catch (err) {
    // Could not connect to App Config — continue with existing env vars.
    // This is non-fatal: the server may still work if env vars were set directly.
    console.warn('[appconfig] Could not connect to App Configuration — continuing with env vars:', err);
  }
}
