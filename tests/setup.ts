// Test setup file for Vitest
// This file runs before all tests

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