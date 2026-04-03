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