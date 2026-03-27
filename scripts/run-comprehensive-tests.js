#!/usr/bin/env node

/**
 * Test Runner for Comprehensive API Integration Tests
 * Validates that the production server is running before executing tests
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000';
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

async function checkServerHealth(retryCount = 0) {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Production server is healthy and ready');
      console.log(`📊 Server status: ${data.status}, Environment: ${data.environment}`);
      return true;
    }
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Server not ready, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return checkServerHealth(retryCount + 1);
    }
  }
  return false;
}

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive API Integration Test Suite');
  console.log('================================================');
  
  // Check if server is running
  console.log('🔍 Checking production server status...');
  const serverReady = await checkServerHealth();
  
  if (!serverReady) {
    console.error('❌ Production server is not running or not healthy');
    console.error('💡 Please start the production server first:');
    console.error('   $env:NODE_ENV="development"; $env:PORT="3000"; node dist/app-production.js');
    process.exit(1);
  }

  // Run the comprehensive test suite
  console.log('\n🧪 Starting comprehensive integration tests...');
  console.log('Testing all 27 production API endpoints with real data');
  
  const testProcess = spawn('npx', [
    'vitest',
    'tests/integration/comprehensive-api.test.ts',
    '--run',
    '--reporter=verbose'
  ], {
    stdio: 'inherit',
    shell: true
  });

  testProcess.on('close', (code) => {
    console.log('\n📊 Test Results Summary');
    console.log('======================');
    
    if (code === 0) {
      console.log('🎉 ALL COMPREHENSIVE TESTS PASSED!');
      console.log('✅ Production API is fully functional');
      console.log('✅ Database integration working correctly');
      console.log('✅ All 27 endpoints validated');
      console.log('✅ End-to-end workflows successful');
    } else {
      console.log('❌ Some tests failed');
      console.log('🔍 Check the test output above for details');
    }
    
    console.log('\n🏁 Comprehensive test suite completed');
    process.exit(code);
  });

  testProcess.on('error', (error) => {
    console.error('❌ Failed to run tests:', error);
    process.exit(1);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test runner interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test runner terminated');
  process.exit(0);
});

// Run the tests
runComprehensiveTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});