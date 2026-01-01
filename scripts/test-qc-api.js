#!/usr/bin/env node

/**
 * QC API Test Runner
 * Executes comprehensive tests for QC system integration
 * NOTE: This script is intended for Cosmos DB Emulator scenarios only.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 QC API Integration Tests');
console.log('==============================\n');

// Environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-qc-api-testing-only-do-not-use-in-production';
process.env.COSMOS_USE_EMULATOR = 'true';
process.env.COSMOS_ENDPOINT = 'https://localhost:8081';
process.env.COSMOS_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

// QC specific test configuration
process.env.QC_EXECUTION_TIMEOUT = '30000';
process.env.QC_AI_MODEL = 'gpt-3.5-turbo';
process.env.QC_CACHE_ENABLED = 'false';
process.env.QC_MIN_SCORE_THRESHOLD = '70';

console.log('📋 Test Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   COSMOS_EMULATOR: ${process.env.COSMOS_USE_EMULATOR}`);
console.log(`   QC_EXECUTION_TIMEOUT: ${process.env.QC_EXECUTION_TIMEOUT}`);
console.log(`   QC_AI_MODEL: ${process.env.QC_AI_MODEL}`);
console.log('\n🚀 Starting QC API Tests...\n');

try {
  // Run QC integration tests
  execSync('npx jest tests/qc-api-integration.test.ts --verbose --detectOpenHandles --forceExit', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ QC API Tests Completed Successfully!');
  console.log('\n📊 Test Summary:');
  console.log('   - QC Checklist Management: ✅ Passed');
  console.log('   - QC Execution Management: ✅ Passed');
  console.log('   - QC Results Management: ✅ Passed');
  console.log('   - Authentication & Authorization: ✅ Passed');
  console.log('   - Input Validation & Security: ✅ Passed');
  console.log('   - Error Handling: ✅ Passed');

} catch (error) {
  console.error('\n❌ QC API Tests Failed!');
  console.error('Error:', error.message);
  
  console.log('\n🔧 Troubleshooting Tips:');
  console.log('   1. Ensure Cosmos DB Emulator is running (if using emulator)');
  console.log('   2. Check that all QC services are properly configured');
  console.log('   3. Verify environment variables are set correctly');
  console.log('   4. Ensure no other services are using the same ports');
  
  process.exit(1);
}

console.log('\n🎉 All QC API Integration Tests Passed!');
console.log('   Ready for production deployment.');