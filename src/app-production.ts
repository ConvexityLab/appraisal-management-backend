/**
 * Production Server Startup
 * Clean entry point for Azure deployment
 */

// Load environment variables FIRST, before any other imports
// This ensures env vars are available when modules are loaded
import dotenv from 'dotenv';
dotenv.config(); // Loads from .env in current working directory (project root)

// Now safe to import modules that need env vars
import { AppraisalManagementAPIServer } from './api/api-server.js';

// Environment validation
// In production ALL of these are required; in dev/test we warn only so local
// mock/azurite setups can start without a full cloud config.
const requiredEnvVars: string[] = [
  'COSMOS_DB_ENDPOINT',
  'COSMOS_DB_DATABASE_ID',
  'AZURE_STORAGE_ACCOUNT_NAME',
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
const isProduction = process.env['NODE_ENV'] === 'production';

if (missingVars.length > 0) {
  if (isProduction) {
    console.error(
      `❌ Missing required environment variable(s): ${missingVars.join(', ')}\n` +
      `   Each must be set via Azure App Service config, Key Vault reference, or a local .env file.\n` +
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

// Warn about Axiom integration vars — optional but logged so ops teams notice
// AXIOM_TENANT_ID + AXIOM_CLIENT_ID + AXIOM_PIPELINE_ID_* are required when AXIOM_API_BASE_URL is set (live mode).
const axiomOptionalVars = [
  'AXIOM_WEBHOOK_SECRET', 'AXIOM_API_URL', 'AXIOM_API_KEY', 'AXIOM_API_BASE_URL',
  'AXIOM_TENANT_ID', 'AXIOM_CLIENT_ID',
  'AXIOM_PIPELINE_ID_RISK_EVAL', 'AXIOM_PIPELINE_ID_DOC_EXTRACT', 'AXIOM_PIPELINE_ID_BULK_EVAL',
];
const missingAxiom = axiomOptionalVars.filter(v => !process.env[v]);
if (missingAxiom.length > 0) {
  console.warn(`⚠️  Axiom integration env vars not set (mock/dev mode will be used): ${missingAxiom.join(', ')}`);
}

// Server configuration
const config = {
  port: parseInt(process.env.PORT || '8080'), // Azure App Service uses PORT
  nodeEnv: process.env.NODE_ENV || 'production'
};

console.log('🚀 Starting Production Appraisal Management API...');
console.log(`📦 Environment: ${config.nodeEnv}`);
console.log(`🔧 Port: ${config.port}`);

if (process.env.WEBSITE_SITE_NAME) {
  console.log(`☁️  Azure App Service: ${process.env.WEBSITE_SITE_NAME}`);
}

// Start server
const server = new AppraisalManagementAPIServer(config.port);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  server.stopBackgroundJobs();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
server.start().catch((error: Error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});