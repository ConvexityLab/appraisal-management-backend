// Test setup file for Vitest
// This file runs before all tests

// Load .env FIRST so that all Azure service env vars are available when
// test files import their services (e.g. CosmosDbService, AcsIdentityService).
import dotenv from 'dotenv';
dotenv.config(); // reads .env from CWD (project root when running vitest)

// Ensure test mode is active before any test module imports service classes.
// Some services read env at module/constructor time (during test collection).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// In CI there is no .env file, so services whose constructors validate
// COSMOS_ENDPOINT at instantiation time would throw before any test runs.
// Set a dummy endpoint so construction succeeds; tests that actually talk
// to Cosmos are gated behind VITEST_INTEGRATION=true and are skipped in CI.
if (!process.env.COSMOS_ENDPOINT && !process.env.AZURE_COSMOS_ENDPOINT) {
  process.env.COSMOS_ENDPOINT = 'https://test-placeholder.documents.azure.com:443/';
}
if (!process.env.AZURE_COSMOS_ENDPOINT) {
  process.env.AZURE_COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://test-placeholder.documents.azure.com:443/';
}

// CI does not provide these by default; set non-production placeholders so
// constructor-time validation in services does not fail test collection.
if (!process.env.AZURE_STORAGE_ACCOUNT_NAME) {
  process.env.AZURE_STORAGE_ACCOUNT_NAME = 'teststorageacct';
}
if (!process.env.WEBSOCKET_NOTIFICATION_URL) {
  process.env.WEBSOCKET_NOTIFICATION_URL = 'ws://localhost:8080/notifications';
}
if (!process.env.STORAGE_CONTAINER_DOCUMENTS) {
  process.env.STORAGE_CONTAINER_DOCUMENTS = 'test-documents';
}
if (!process.env.STORAGE_CONTAINER_DOCUMENTS) {
  process.env.STORAGE_CONTAINER_DOCUMENTS = 'test-documents';
}

// BulkPortfolioService instantiates ReviewDocumentExtractionService eagerly in
// its constructor (P2-AX-01 startup-validation guardrail), which throws when
// AXIOM_API_BASE_URL is empty. CI has no .env file, so any test that does
// `new BulkPortfolioService(db)` would fail at construction. Provide a
// non-empty placeholder so the constructor passes; tests that exercise real
// Axiom behaviour set their own value (e.g. axiom-platform-parity.test.ts).
// AXIOM_AUTH_REQUIRED=false keeps AxiomService from constructing a
// DefaultAzureCredential, which would also fail in CI without managed identity.
if (!process.env.AXIOM_API_BASE_URL) {
  process.env.AXIOM_API_BASE_URL = 'https://test-placeholder.axiom.local';
}
if (!process.env.AXIOM_AUTH_REQUIRED) {
  process.env.AXIOM_AUTH_REQUIRED = 'false';
}

// Inspection provider factory throws at startup if INSPECTION_PROVIDER is
// missing (src/services/inspection-providers/factory.ts). The API server
// constructor calls it via setupAuthorizationRoutes, so any test that boots
// the server (e.g. tests/authorization/http-authz.test.ts) trips it. Prod
// gets the value from App Config via appConfigLoader; tests don't run that
// loader, so seed a placeholder here.
if (!process.env.INSPECTION_PROVIDER) {
  process.env.INSPECTION_PROVIDER = 'ivueit';
}
if (!process.env.IVUEIT_BASE_URL) {
  process.env.IVUEIT_BASE_URL = 'https://test-placeholder.ivueit.local';
}
// IVueitInspectionProvider constructor requires API key + secret. In prod
// these come from Key Vault via Container App secret refs; for tests we just
// need non-empty values to satisfy the constructor — no real iVueit calls.
if (!process.env.IVUEIT_API_KEY) {
  process.env.IVUEIT_API_KEY = 'test-placeholder-key';
}
if (!process.env.IVUEIT_SECRET) {
  process.env.IVUEIT_SECRET = 'test-placeholder-secret';
}

// Additional placeholders for env vars now sourced from App Config in prod.
// loadAppConfig() does not run in tests, so any service constructor that
// validates these would throw. Real values are written to App Config /
// Key Vault per environment; tests just need non-empty placeholders.
const appConfigBackedPlaceholders: Record<string, string> = {
  // AI providers
  AZURE_OPENAI_ENDPOINT: 'https://test-placeholder.openai.azure.com/',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini',
  AZURE_OPENAI_MODEL_NAME: 'gpt-4o-mini',
  AZURE_OPENAI_API_KEY: 'test-placeholder-openai-key',
  GOOGLE_GEMINI_API_KEY: 'test-placeholder-gemini-key',
  SAMBANOVA_ENDPOINT: 'https://test-placeholder.sambanova.local/v1',
  SAMBANOVA_API_KEY: 'test-placeholder-sambanova-key',
  CERTO_ENDPOINT: 'https://test-placeholder.certo.local/tgi/v1',
  // Storage
  BULK_UPLOAD_STORAGE_ACCOUNT_NAME: 'teststorageacct',
  SFTP_STORAGE_ACCOUNT_NAME: 'testsftpacct',
  STORAGE_CONTAINER_BULK_UPLOAD: 'bulk-upload',
  // Cosmos
  AZURE_COSMOS_DATABASE_NAME: 'test-database',
  // Service Bus / Web PubSub / Fluid Relay
  AZURE_SERVICE_BUS_NAMESPACE: 'test-placeholder.servicebus.windows.net',
  AZURE_WEB_PUBSUB_ENDPOINT: 'https://test-placeholder.webpubsub.azure.com',
  AZURE_FLUID_RELAY_ENDPOINT: 'https://test-placeholder.fluidrelay.local',
  AZURE_FLUID_RELAY_TENANT_ID: 'test-fluid-relay-tenant',
  // Communication / 3rd-party / Statebridge
  AZURE_COMMUNICATION_ENDPOINT: 'https://test-placeholder.communication.azure.com',
  AZURE_COMMUNICATION_EMAIL_DOMAIN: 'DoNotReply@test-placeholder.local',
  BATCHDATA_ENDPOINT: 'https://test-placeholder.batchdata.local/api/v1/',
  STATEBRIDGE_CLIENT_ID: 'statebridge',
  STATEBRIDGE_CLIENT_NAME: 'Statebridge',
  STATEBRIDGE_TENANT_ID: 'test-statebridge-tenant',
  // Feature flags (consumed as strings from process.env)
  BULK_INGESTION_ENABLE_CRITERIA_STAGE: 'true',
  USE_MOCK_SERVICE_BUS: 'true',
};
for (const [name, value] of Object.entries(appConfigBackedPlaceholders)) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

// Global test configuration
const TEST_TIMEOUT = 30000

// Set up global test environment
beforeAll(async () => {
  console.log('🧪 Setting up test environment...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.PORT = '0' // Use random available port
  process.env.LOG_LEVEL = 'error' // Reduce log noise during tests
  
  console.log('✅ Test environment ready')
}, TEST_TIMEOUT)

// Clean up after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  // Any global cleanup goes here
  
  console.log('✅ Test cleanup complete')
})

// Before each test
beforeEach(() => {
  // Reset any global state before each test
})

// After each test
afterEach(() => {
  // Clean up any test-specific state
})

// Global test utilities
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidJSON(): any
      toBeValidURL(): any
    }
  }
}

// Custom matchers for API testing
expect.extend({
  toBeValidJSON(received: string) {
    try {
      JSON.parse(received)
      return {
        message: () => `Expected ${received} not to be valid JSON`,
        pass: true
      }
    } catch {
      return {
        message: () => `Expected ${received} to be valid JSON`,
        pass: false
      }
    }
  },
  
  toBeValidURL(received: string) {
    try {
      new URL(received)
      return {
        message: () => `Expected ${received} not to be a valid URL`,
        pass: true
      }
    } catch {
      return {
        message: () => `Expected ${received} to be a valid URL`,
        pass: false
      }
    }
  }
})