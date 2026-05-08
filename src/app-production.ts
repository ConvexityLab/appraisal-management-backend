/**
 * Production Server Startup
 * Clean entry point for Azure deployment
 */

// Load environment variables FIRST, before any other imports
// This ensures env vars are available when modules are loaded
import dotenv from 'dotenv';
dotenv.config(); // Loads from .env in current working directory (project root)

// loadAppConfig must run BEFORE any module that triggers controller imports —
// the controllers do `const x = new SomeService()` at module-top-level, which
// fires service constructors that read process.env at construct time.
// api-server.js (which transitively imports all controllers) is therefore
// imported dynamically inside the IIFE, after loadAppConfig completes.
import { loadAppConfig } from './config/appConfigLoader.js';
import type { AppraisalManagementAPIServer as AppraisalManagementAPIServerType } from './api/api-server.js';

// Env validation moved into the async IIFE below — many of these env vars are
// now sourced from App Configuration via loadAppConfig(), which can only run
// after process startup. Validating at module-top-level fired BEFORE the IIFE
// could populate them and exited the process with a false-positive failure.
const requiredEnvVars: string[] = [
  'AZURE_COSMOS_ENDPOINT',       // Used by all services and controllers
  'AZURE_STORAGE_ACCOUNT_NAME',  // Used by blob storage service
];
// Axiom mock-vs-live mode is decided in AxiomService by `AXIOM_API_BASE_URL`
// alone (see services/axiom.service.ts: `this.enabled = !!baseURL && !forceMock`).
// Other AXIOM_* vars below are only relevant for specific code paths
// (webhooks, static-bearer auth, pipeline IDs) — missing them does NOT put
// Axiom in mock mode.
const axiomLiveModeVar = 'AXIOM_API_BASE_URL';
const axiomFeatureVars: Array<{ name: string; purpose: string }> = [
  { name: 'AXIOM_WEBHOOK_SECRET',           purpose: 'webhook signature verification' },
  { name: 'AXIOM_API_KEY',                  purpose: 'static-bearer auth (skip when using managed identity)' },
  { name: 'AXIOM_PIPELINE_ID_RISK_EVAL',    purpose: 'risk-eval pipeline submissions (has a default)' },
  { name: 'AXIOM_PIPELINE_ID_DOC_EXTRACT',  purpose: 'doc-extraction pipeline submissions (has a default)' },
  { name: 'AXIOM_PIPELINE_ID_BULK_EVAL',    purpose: 'bulk-eval pipeline submissions (has a default)' },
  { name: 'AXIOM_REQUIRED_DOCUMENT_TYPES',  purpose: 'required-doc validation (defaults to "appraisal-report")' },
];

function validateEnvOrExit(): void {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (missingVars.length > 0) {
    if (isProduction) {
      console.error(
        `❌ Missing required environment variable(s): ${missingVars.join(', ')}\n` +
        `   Each must be set via App Configuration, Key Vault reference, or a local .env file.\n` +
        `   Server cannot start without them.`
      );
      process.exit(1);
    } else {
      console.warn(
        `⚠️  Missing env var(s) for cloud services: ${missingVars.join(', ')}\n` +
        `   Running in dev/mock mode — cloud features that depend on these will be unavailable.`
      );
    }
  }

  // Axiom live-vs-mock decision: only AXIOM_API_BASE_URL controls this.
  if (!process.env[axiomLiveModeVar]) {
    console.warn(
      `⚠️  Axiom is in mock/dev mode — ${axiomLiveModeVar} not set.\n` +
      `   Set it in .env (or App Configuration) to point at a live Axiom deployment.`,
    );
  }

  // Per-feature notices — these gate specific code paths but don't trigger
  // global mock mode. Surfaced as a single info line so they're discoverable
  // without spamming the startup log.
  const missingFeatures = axiomFeatureVars.filter((v) => !process.env[v.name]);
  if (missingFeatures.length > 0) {
    console.info(
      `ℹ️  Optional Axiom env vars not set (specific features only — Axiom itself is live):\n` +
        missingFeatures.map((v) => `   • ${v.name} — ${v.purpose}`).join('\n'),
    );
  }
}

// Server configuration
const config = {
  port: parseInt(process.env.PORT || '8080'), // Azure App Service uses PORT
  nodeEnv: process.env.NODE_ENV || 'production'
};

// Error handling — register before the async startup so crashes before server creation
// are also caught.
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Service Bus SDK can leak rejections during reconnection attempts.
  // Log but do NOT crash the process for these — the subscriber already
  // handles MessagingEntityNotFound by closing the receiver.
  const msg = reason instanceof Error ? reason.message : String(reason);
  const isServiceBus = msg.includes('MessagingEntity') || msg.includes('ServiceBus');
  if (isServiceBus) {
    console.warn('⚠️  Service Bus unhandled rejection (non-fatal):', msg);
    return;
  }
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Async startup — wrapped in IIFE because CommonJS modules do not support top-level await.
void (async () => {
  console.log('🚀 Starting Production Appraisal Management API...');
  console.log(`📦 Environment: ${config.nodeEnv}`);
  console.log(`🔧 Port: ${config.port}`);

  if (process.env.WEBSITE_SITE_NAME) {
    console.log(`☁️  Azure App Service: ${process.env.WEBSITE_SITE_NAME}`);
  }

  // Load service-discovery URLs from Azure App Configuration FIRST. Many
  // controllers do `const x = new SomeService()` at module-top-level — those
  // service constructors read process.env at construct time, so we must populate
  // process.env BEFORE the api-server module (which transitively imports them)
  // is imported.
  await loadAppConfig();

  // Validate env AFTER loadAppConfig has populated values from App Config.
  // (Validating at module-top-level would fire BEFORE this and false-positive.)
  validateEnvOrExit();

  // Dynamic import — runs after loadAppConfig has populated process.env.
  // Static `import { AppraisalManagementAPIServer } from './api/api-server.js'`
  // would fire all controller side effects at parse time, BEFORE this point.
  const { AppraisalManagementAPIServer } = await import('./api/api-server.js');

  // Construct and start the server
  const server: AppraisalManagementAPIServerType = new AppraisalManagementAPIServer(config.port);

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
    server.stopBackgroundJobs();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  await server.start();
})().catch((error: Error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});