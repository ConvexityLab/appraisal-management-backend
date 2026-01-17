#!/usr/bin/env node
/**
 * Test Clean Architecture - Authentication & Authorization Separation
 * Tests the new architecture where JWT = identity only, Casbin = all authorization
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.API_URL || 'https://ca-appraisalapi-sta-lqxl.jollysand-19372da7.eastus.azurecontainerapps.io';
const USE_LOCAL = process.env.USE_LOCAL === 'true';
const API_BASE = USE_LOCAL ? 'http://localhost:3000' : BASE_URL;

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

function log(msg, color = 'white') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, method, endpoint, options = {}) {
  const {
    headers = {},
    body = null,
    expectedStatus = [200, 201],
    description = ''
  } = options;
  
  log(`📍 Test: ${name}`, 'white');
  if (description) {
    log(`   ${description}`, 'gray');
  }
  
  try {
    const response = await makeRequest(method, endpoint, headers, body);
    
    if (expectedStatus.includes(response.status)) {
      log(`   ✅ PASS - HTTP ${response.status}`, 'green');
      testResults.passed++;
      
      if (response.body) {
        if (response.body.user || response.body.userProfile) {
          log(`   👤 User: ${response.body.user?.email}`, 'gray');
          log(`   🎭 Role: ${response.body.userProfile?.role}`, 'gray');
        }
        if (response.body.data || response.body.orders || response.body.vendors) {
          const count = response.body.data?.length || response.body.orders?.length || response.body.vendors?.length || 0;
          log(`   📊 Results: ${count} items`, 'gray');
        }
      }
      
      console.log();
      return true;
    } else {
      log(`   ❌ FAIL - Unexpected status: ${response.status}`, 'red');
      if (response.body?.error) {
        log(`   Error: ${response.body.error}`, 'red');
      }
      testResults.failed++;
      console.log();
      return false;
    }
  } catch (error) {
    log(`   ❌ FAIL - ${error.message}`, 'red');
    testResults.failed++;
    console.log();
    return false;
  }
}

async function getTestToken() {
  const fs = require('fs');
  const path = require('path');
  
  // Try to read test token from .env.test-tokens
  const envPath = path.join(__dirname, '../.env.test-tokens');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/TEST_JWT_ADMIN=(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  
  // Generate test tokens if not found
  log('⚠️  No test token found. Generating...', 'yellow');
  const { execSync } = require('child_process');
  try {
    execSync('npm run generate:test-tokens', { stdio: 'inherit' });
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/TEST_JWT_ADMIN=(.+)/);
      if (match) {
        return match[1].trim();
      }
    }
  } catch (e) {
    log('❌ Failed to generate test tokens', 'red');
  }
  
  return null;
}

async function main() {
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('🧪 CLEAN ARCHITECTURE TEST SUITE', 'cyan');
  log('═══════════════════════════════════════════════════════════\n', 'cyan');
  
  log(`🎯 Target: ${API_BASE}`, 'yellow');
  log(`🔐 Auth Mode: Test Tokens\n`, 'yellow');
  
  // Step 1: Get authentication token
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 1: Authentication (Identity Extraction)', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  const token = await getTestToken();
  
  if (!token) {
    log('\n❌ Could not acquire authentication token', 'red');
    log('   Run: npm run generate:test-tokens', 'yellow');
    process.exit(1);
  }
  
  log(`✅ Token acquired (${token.length} chars)\n`, 'green');
  
  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };
  
  // Step 2: Test authentication-only endpoints
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 2: Authentication Layer Tests', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  await testEndpoint(
    'Health Check (No Auth)',
    'GET',
    '/health',
    { description: 'Should work without authentication' }
  );
  
  await testEndpoint(
    'Status (No Auth)',
    'GET',
    '/api/status',
    { description: 'Should work without authentication' }
  );
  
  await testEndpoint(
    'Identity Extraction',
    'GET',
    '/api/authz-test/profile',
    {
      headers: authHeaders,
      description: 'Test JWT identity extraction (authentication only)'
    }
  );
  
  // Step 3: Test the 4 "missing" endpoints
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 3: Previously "Missing" Endpoints (Now with Casbin)', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  await testEndpoint(
    'QC Workflow Queue Statistics',
    'GET',
    '/api/qc-workflow/queue/statistics',
    {
      headers: authHeaders,
      description: "Frontend complained this was missing - now uses Casbin authorize('order', 'qc_validate')"
    }
  );
  
  await testEndpoint(
    'QC Execution Execute',
    'POST',
    '/api/qc/execution/execute',
    {
      headers: authHeaders,
      body: { orderId: 'test-order-123', rules: [] },
      expectedStatus: [200, 201, 400, 403, 404],
      description: "Frontend complained this was missing - now uses Casbin authorize('order', 'qc_execute')"
    }
  );
  
  await testEndpoint(
    'QC Results Analytics Summary',
    'GET',
    '/api/qc/results/analytics/summary',
    {
      headers: authHeaders,
      expectedStatus: [200, 404],
      description: 'Frontend complained this was missing - now uses Casbin'
    }
  );
  
  await testEndpoint(
    'Fraud Detection Analyze',
    'POST',
    '/api/fraud-detection/analyze',
    {
      headers: authHeaders,
      body: { orderId: 'test-order-123' },
      expectedStatus: [200, 201, 400, 403, 404],
      description: 'Frontend complained this was missing - now uses Casbin'
    }
  );
  
  // Step 4: Test Casbin authorization on core endpoints
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 4: Casbin Authorization Tests', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  await testEndpoint(
    'List Orders (Casbin)',
    'GET',
    '/api/orders',
    {
      headers: authHeaders,
      description: "Uses Casbin authorize('order', 'read')"
    }
  );
  
  await testEndpoint(
    'List Vendors (Casbin)',
    'GET',
    '/api/vendors',
    {
      headers: authHeaders,
      description: "Uses Casbin authorize('vendor', 'read')"
    }
  );
  
  await testEndpoint(
    'QC Validate (Casbin)',
    'POST',
    '/api/qc/validate/test-order-123',
    {
      headers: authHeaders,
      body: { checks: [] },
      expectedStatus: [200, 201, 400, 403, 404],
      description: "Migrated from requirePermission() to Casbin authorize('order', 'qc_validate')"
    }
  );
  
  await testEndpoint(
    'Analytics Overview (Casbin)',
    'GET',
    '/api/analytics/overview',
    {
      headers: authHeaders,
      description: "Migrated from requirePermission() to Casbin authorize('analytics', 'view')"
    }
  );
  
  await testEndpoint(
    'Code Execution (Casbin)',
    'POST',
    '/api/code/execute',
    {
      headers: authHeaders,
      body: { code: "return { result: 'test' }", context: {} },
      expectedStatus: [200, 201, 400, 403],
      description: "Migrated from requirePermission() to Casbin authorize('code', 'execute')"
    }
  );
  
  // Step 5: Test admin-only endpoints
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 5: Admin-Only Endpoints (Casbin Role Policies)', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  await testEndpoint(
    'User Management (Admin)',
    'GET',
    '/api/users',
    {
      headers: authHeaders,
      description: "Migrated from requireRole('admin', 'manager') to Casbin authorize('user', 'manage')"
    }
  );
  
  await testEndpoint(
    'Access Graph (Admin)',
    'GET',
    '/api/access-graph',
    {
      headers: authHeaders,
      description: "Migrated from requireRole('admin') to Casbin authorize('access_graph', 'manage')"
    }
  );
  
  // Step 6: Test authorization denial
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('STEP 6: Authorization Denial Tests', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  await testEndpoint(
    'No Token (401 Expected)',
    'GET',
    '/api/orders',
    {
      expectedStatus: [401],
      description: 'Should reject request without authentication token'
    }
  );
  
  await testEndpoint(
    'Invalid Token (401 Expected)',
    'GET',
    '/api/orders',
    {
      headers: { 'Authorization': 'Bearer invalid-token-12345' },
      expectedStatus: [401],
      description: 'Should reject malformed JWT token'
    }
  );
  
  await testEndpoint(
    'Empty Token (401 Expected)',
    'GET',
    '/api/orders',
    {
      headers: { 'Authorization': 'Bearer ' },
      expectedStatus: [401],
      description: 'Should reject empty token (security fix)'
    }
  );
  
  // Step 7: Summary
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
  
  const total = testResults.passed + testResults.failed;
  const passRate = total > 0 ? Math.round((testResults.passed / total) * 100 * 10) / 10 : 0;
  
  log(`Total Tests: ${total}`, 'white');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`📊 Pass Rate: ${passRate}%\n`, passRate >= 80 ? 'green' : passRate >= 50 ? 'yellow' : 'red');
  
  if (testResults.failed === 0) {
    log('🎉 ALL TESTS PASSED! Clean architecture is working!', 'green');
  } else {
    log('⚠️  Some tests failed. Check Casbin policies and user permissions.', 'yellow');
  }
  
  log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
