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
// at module-top-level (e.g. `export const x = new SomeService()` patterns)
// is read before this runs and CANNOT be migrated to App Config until the
// offending service tree is refactored to lazy-instantiate.
//
// As of commit ea0b923 the QC controllers (criteria/results/reviews) defer
// their instantiation to api-server.ts:initializeDatabase() — which means
// the previously-blocked Cosmos / Service Bus / Storage / AI / Web PubSub /
// Fluid Relay / Communication / Batchdata cascades are now safe to migrate.
const KEY_TO_ENV: Record<string, string> = {
  // Axiom
  'services.axiom-api.base-url': 'AXIOM_API_BASE_URL',
  'services.axiom-api.client-id': 'AXIOM_CLIENT_ID',
  'services.axiom-api.sub-client-id': 'AXIOM_SUB_CLIENT_ID',
  'services.axiom-api.pipeline-id-schema-extract': 'AXIOM_PIPELINE_ID_SCHEMA_EXTRACT',
  'services.axiom-auth.required': 'AXIOM_AUTH_REQUIRED',
  'services.axiom-auth.audience': 'AXIOM_AUTH_AUDIENCE',
  // Inspection
  'services.inspection.provider': 'INSPECTION_PROVIDER',
  'services.inspection.base-url': 'IVUEIT_BASE_URL',
  // AI providers (endpoints / deployment ids — secrets stay as keyVaultUrl refs)
  'services.openai.endpoint': 'AZURE_OPENAI_ENDPOINT',
  'services.openai.deployment': 'AZURE_OPENAI_DEPLOYMENT',
  'services.openai.model-name': 'AZURE_OPENAI_MODEL_NAME',
  // Phase 17b token-meter (2026-05-11): per-1k-token rates + per-tenant
  // budget ceilings.  Override per environment via App Config push so
  // the values are tenant-tunable without a redeploy.
  'services.openai.cost-per-1k-input-usd': 'AZURE_OPENAI_COST_PER_1K_INPUT_USD',
  'services.openai.cost-per-1k-output-usd': 'AZURE_OPENAI_COST_PER_1K_OUTPUT_USD',
  'features.ai-cost.hard-limit-usd': 'AI_COST_HARD_LIMIT_USD',
  'features.ai-cost.warn-threshold-usd': 'AI_COST_WARN_THRESHOLD_USD',
  'features.ai-cost.period-days': 'AI_COST_PERIOD_DAYS',
  'services.sambanova.endpoint': 'SAMBANOVA_ENDPOINT',
  'services.certo.endpoint': 'CERTO_ENDPOINT',
  // Storage (account names + logical container names; SAS keys stay in KV)
  'services.storage.account-name': 'AZURE_STORAGE_ACCOUNT_NAME',
  'services.storage.bulk-upload-account-name': 'BULK_UPLOAD_STORAGE_ACCOUNT_NAME',
  'services.storage.container.documents': 'STORAGE_CONTAINER_DOCUMENTS',
  'services.storage.container.bulk-upload': 'STORAGE_CONTAINER_BULK_UPLOAD',
  // Cosmos
  'services.cosmos.endpoint': 'AZURE_COSMOS_ENDPOINT',
  'services.cosmos.database-name': 'AZURE_COSMOS_DATABASE_NAME',
  // Service Bus / Web PubSub / Fluid Relay
  'services.service-bus.namespace': 'AZURE_SERVICE_BUS_NAMESPACE',
  'services.web-pubsub.endpoint': 'AZURE_WEB_PUBSUB_ENDPOINT',
  'services.fluid-relay.endpoint': 'AZURE_FLUID_RELAY_ENDPOINT',
  'services.fluid-relay.tenant-id': 'AZURE_FLUID_RELAY_TENANT_ID',
  // Communication
  'services.communication.endpoint': 'AZURE_COMMUNICATION_ENDPOINT',
  'services.communication.email-domain': 'AZURE_COMMUNICATION_EMAIL_DOMAIN',
  // 3rd-party
  'services.batchdata.endpoint': 'BATCHDATA_ENDPOINT',
  // Feature flags (stored as plain App Config string keys; the dedicated
  // feature-flag API is a separate migration if/when needed).
  'features.bulk-ingestion-criteria-stage': 'BULK_INGESTION_ENABLE_CRITERIA_STAGE',
  'features.use-mock-service-bus': 'USE_MOCK_SERVICE_BUS',
  // When MOP connectivity is resolved (see APP_CONFIG_SERVICE_DISCOVERY.md §2):
  // 'services.mop-api.internal-url': 'MOP_API_BASE_URL',

  // MOP vendor-matching evaluator (Phase 2 of AUTO_ASSIGNMENT_REVIEW.md).
  // Reachable via MOP's external Container App ingress (auth-proxy on :3001).
  // Per-consumer service auth: AMS sends `X-Service-Auth: <token>` where the
  // token comes from KV secret `sentinel-mop-webhook-secret`; AMS bicep must
  // reference that secret and surface it as MOP_RULES_SERVICE_AUTH_TOKEN.
  // The App Config key `services.mop-api.external-url` should hold the
  // external (no `.internal.`) FQDN, e.g.
  //   https://ca-mop-dev.delightfulbush-a7c589f7.eastus2.azurecontainerapps.io
  'services.mop-api.external-url': 'MOP_RULES_BASE_URL',
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
