// src/config/appConfigLoader.ts

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * App Config key → process.env variable name
 *
 * Add entries here for every service URL this app needs from App Config.
 */
const KEY_TO_ENV: Record<string, string> = {
  // Axiom (migrated)
  'services.axiom-api.base-url': 'AXIOM_API_BASE_URL',
  'services.axiom-api.client-id': 'AXIOM_CLIENT_ID',
  'services.axiom-api.sub-client-id': 'AXIOM_SUB_CLIENT_ID',
  'services.axiom-api.pipeline-id-schema-extract': 'AXIOM_PIPELINE_ID_SCHEMA_EXTRACT',
  'services.axiom-auth.required': 'AXIOM_AUTH_REQUIRED',
  'services.axiom-auth.audience': 'AXIOM_AUTH_AUDIENCE',
  // Inspection (migrated)
  'services.inspection.provider': 'INSPECTION_PROVIDER',
  'services.inspection.base-url': 'IVUEIT_BASE_URL',
  // AI providers
  'services.openai.endpoint': 'AZURE_OPENAI_ENDPOINT',
  'services.openai.deployment': 'AZURE_OPENAI_DEPLOYMENT',
  'services.openai.model-name': 'AZURE_OPENAI_MODEL_NAME',
  'services.sambanova.endpoint': 'SAMBANOVA_ENDPOINT',
  'services.certo.endpoint': 'CERTO_ENDPOINT',
  // Storage
  'services.storage.account-name': 'AZURE_STORAGE_ACCOUNT_NAME',
  'services.storage.bulk-upload-account-name': 'BULK_UPLOAD_STORAGE_ACCOUNT_NAME',
  'services.storage.sftp-account-name': 'SFTP_STORAGE_ACCOUNT_NAME',
  'services.storage.container.documents': 'STORAGE_CONTAINER_DOCUMENTS',
  'services.storage.container.bulk-upload': 'STORAGE_CONTAINER_BULK_UPLOAD',
  // Cosmos — NOT migrated. Three controllers (criteria, results, reviews)
  // instantiate QC*Controller → CosmosDbService at module-top-level, which
  // runs before loadAppConfig(). Until those controllers are refactored to
  // lazy-instantiate, AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_DATABASE_NAME
  // must come from bicep env-block. See project memory.
  // 'services.cosmos.endpoint': 'AZURE_COSMOS_ENDPOINT',
  // 'services.cosmos.database-name': 'AZURE_COSMOS_DATABASE_NAME',
  // Service Bus / Web PubSub / Fluid Relay — partial. Service Bus is read by
  // ServiceBusEventPublisher constructor, which is called from AxiomService
  // constructor, which is in the module-top-level cascade. Until AxiomService
  // (or its consumers) lazy-instantiate, AZURE_SERVICE_BUS_NAMESPACE and
  // USE_MOCK_SERVICE_BUS must come from bicep.
  // 'services.service-bus.namespace': 'AZURE_SERVICE_BUS_NAMESPACE',
  'services.web-pubsub.endpoint': 'AZURE_WEB_PUBSUB_ENDPOINT',
  'services.fluid-relay.endpoint': 'AZURE_FLUID_RELAY_ENDPOINT',
  'services.fluid-relay.tenant-id': 'AZURE_FLUID_RELAY_TENANT_ID',
  // Communication / 3rd-party / Statebridge
  'services.communication.endpoint': 'AZURE_COMMUNICATION_ENDPOINT',
  'services.communication.email-domain': 'AZURE_COMMUNICATION_EMAIL_DOMAIN',
  'services.batchdata.endpoint': 'BATCHDATA_ENDPOINT',
  'services.statebridge.client-id': 'STATEBRIDGE_CLIENT_ID',
  'services.statebridge.client-name': 'STATEBRIDGE_CLIENT_NAME',
  'services.statebridge.tenant-id': 'STATEBRIDGE_TENANT_ID',
  // Feature flags (using regular App Config string keys; App Config's
  // dedicated feature-flag API is a separate migration if/when needed)
  'features.bulk-ingestion-criteria-stage': 'BULK_INGESTION_ENABLE_CRITERIA_STAGE',
  // USE_MOCK_SERVICE_BUS is read at module-top-level (same cascade as
  // AZURE_SERVICE_BUS_NAMESPACE) — must stay in bicep for now.
  // 'features.use-mock-service-bus': 'USE_MOCK_SERVICE_BUS',
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
