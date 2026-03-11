/**
 * Transforms tests/integration/comprehensive-api.test.ts
 * from fetch-based external server calls to in-process supertest calls.
 */
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tests', 'integration', 'comprehensive-api.test.ts');
let src = readFileSync(filePath, 'utf8');

// ────────────────────────────────────────────────────────────────
// 1. Replace the import block and config constants
// ────────────────────────────────────────────────────────────────
const oldHeader = `/**
 * Comprehensive Production API Integration Test Suite
 * Tests all 27 endpoints with real database operations
 * Run this against the live production server on port 3000
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType,
  VendorStatus 
} from '../../src/types/index';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3011';
const TEST_TIMEOUT = 15000;`;

const newHeader = `/**
 * Comprehensive Production API Integration Test Suite
 * Tests all 27 endpoints with real database operations
 * Runs in-process via supertest — no external server required.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import { TestTokenGenerator } from '../../src/utils/test-token-generator';
import { 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType,
  VendorStatus 
} from '../../src/types/index';

// Test configuration
const AZURE_COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT;
const TEST_TIMEOUT = 30000;

let serverInstance: AppraisalManagementAPIServer;
let app: Application;
let adminToken: string;`;

src = src.replace(oldHeader, newHeader);

// ────────────────────────────────────────────────────────────────
// 2. Replace skipIf condition
// ────────────────────────────────────────────────────────────────
src = src.replace(
  "describe.skipIf(!process.env.RUN_SERVER_TESTS, 'Set RUN_SERVER_TESTS=true and start the server first')('Comprehensive Production API Integration Tests', () => {",
  "describe.skipIf(!AZURE_COSMOS_ENDPOINT, 'Set AZURE_COSMOS_ENDPOINT to run these tests')('Comprehensive Production API Integration Tests', () => {"
);

// ────────────────────────────────────────────────────────────────
// 3. Replace beforeAll connectivity check with in-process setup
// ────────────────────────────────────────────────────────────────
const oldBeforeAll = `  beforeAll(async () => {
    // Verify server connectivity
    try {
      const response = await fetch(\`\${API_BASE_URL}/health\`);
      if (!response.ok) {
        throw new Error(\`Server not available: \${response.status}\`);
      }
      console.log('🚀 Connected to production server - starting comprehensive tests');
    } catch (error) {
      throw new Error(\`❌ Cannot connect to server at \${API_BASE_URL}. Ensure production server is running.\`);
    }

    // Generate unique test identifiers
    testClientId = \`test-client-\${Date.now()}\`;
  }, TEST_TIMEOUT);`;

const newBeforeAll = `  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    // Get admin token for authenticated endpoints
    const tokenRes = await request(app).post('/api/auth/test-token').send({
      email: 'admin@test.com',
      role: 'admin'
    });
    adminToken = tokenRes.body.token as string;

    // Generate unique test identifiers
    testClientId = \`test-client-\${Date.now()}\`;
    console.log('🚀 In-process server ready - starting comprehensive tests');
  }, 60000);`;

src = src.replace(oldBeforeAll, newBeforeAll);

// ────────────────────────────────────────────────────────────────
// 4. Replace afterAll fetch calls with supertest + auth
// ────────────────────────────────────────────────────────────────
const oldAfterAll = `  afterAll(async () => {
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    
    if (testOrderId) {
      try {
        await fetch(\`\${API_BASE_URL}/api/orders/\${testOrderId}?clientId=\${testClientId}\`, {
          method: 'DELETE'
        });
        console.log('✅ Test order cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test order:', error);
      }
    }

    if (testVendorId) {
      try {
        await fetch(\`\${API_BASE_URL}/api/vendors/\${testVendorId}\`, {
          method: 'DELETE'
        });
        console.log('✅ Test vendor cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test vendor:', error);
      }
    }

    console.log('🏁 Comprehensive test suite completed');
  });`;

const newAfterAll = `  afterAll(async () => {
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    
    if (testOrderId) {
      try {
        await request(app)
          .delete(\`/api/orders/\${testOrderId}?clientId=\${testClientId}\`)
          .set('Authorization', \`Bearer \${adminToken}\`);
        console.log('✅ Test order cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test order:', error);
      }
    }

    if (testVendorId) {
      try {
        await request(app)
          .delete(\`/api/vendors/\${testVendorId}\`)
          .set('Authorization', \`Bearer \${adminToken}\`);
        console.log('✅ Test vendor cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test vendor:', error);
      }
    }

    console.log('🏁 Comprehensive test suite completed');
  });`;

src = src.replace(oldAfterAll, newAfterAll);

// ────────────────────────────────────────────────────────────────
// 5. Convert all fetch() calls to supertest equivalents
//    Pattern: multi-line fetch with method/headers/body → request(app).method(path).send(data)
// ────────────────────────────────────────────────────────────────

// Helper to determine if a path needs auth headers
function needsAuth(path) {
  return path.includes('/api/orders') || path.includes('/api/vendors');
}

// Convert DELETE with no body:  await fetch(`${X}/path`, { method: 'DELETE' })
src = src.replace(
  /const (\w+) = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`, \{[\s\n]*method: 'DELETE'[\s\n]*\}\);/g,
  (match, varName, path) => {
    const authPart = needsAuth(path) ? `\n          .set('Authorization', \`Bearer \${adminToken}\`)` : '';
    return `const ${varName} = await request(app).delete(\`${path}\`)${authPart};`;
  }
);

// Convert POST/PUT with headers+body (multi-line) — store body variable name
src = src.replace(
  /const (\w+) = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`, \{[\s\n]*method: '(POST|PUT)',[\s\n]*headers: \{ 'Content-Type': 'application\/json' \},[\s\n]*body: JSON\.stringify\((\w+)\)[\s\n]*\}\);/g,
  (match, varName, path, method, bodyVar) => {
    const authPart = needsAuth(path) ? `\n          .set('Authorization', \`Bearer \${adminToken}\`)` : '';
    return `const ${varName} = await request(app).${method.toLowerCase()}(\`${path}\`).send(${bodyVar})${authPart};`;
  }
);

// Convert simple GET: await fetch(`${API_BASE_URL}/path`)  (no options)
src = src.replace(
  /const (\w+) = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`\);/g,
  (match, varName, path) => {
    const authPart = needsAuth(path) ? `\n          .set('Authorization', \`Bearer \${adminToken}\`)` : '';
    return `const ${varName} = await request(app).get(\`${path}\`)${authPart};`;
  }
);

// ────────────────────────────────────────────────────────────────
// 6. Remove `const result = await response.json();` lines (various variable names)
// ────────────────────────────────────────────────────────────────
src = src.replace(/\s*const (\w+) = await (\w+)\.json\(\);\n/g, '\n');

// ────────────────────────────────────────────────────────────────
// 7. Replace `result.` → `response.body.`, `orderResult.` → `orderResponse.body.`, etc.
// ────────────────────────────────────────────────────────────────
// Map each result variable to its corresponding response variable
src = src.replace(/\borderResult\b\./g, 'orderResponse.body.');
src = src.replace(/\bvendorResult\b\./g, 'vendorResponse.body.');
src = src.replace(/\bassignmentResponse\b\.json\(\)/g, 'assignmentResponse.body');
src = src.replace(/\bcompletionResult\b\./g, 'completionResponse.body.');
src = src.replace(/\bfinalOrder\b\./g, 'finalCheckResponse.body.');

// Single-response patterns like `const result = await response.json(); ... result.`
// We already removed `const result = await response.json();` above
// Now replace `result.` with `response.body.`
src = src.replace(/\bresult\b\./g, 'response.body.');

// ────────────────────────────────────────────────────────────────
// 8. Fix invalid phone numbers (555 used as area code)
// ────────────────────────────────────────────────────────────────
src = src.replace(/'555-COMP-TEST'/g, "'415-555-0123'");
src = src.replace(/'555-COMP-VENDOR'/g, "'415-555-0124'");
src = src.replace(/'555-UPDATED'/g, "'415-555-0125'");
src = src.replace(/'555-E2E-TEST'/g, "'415-555-0126'");
src = src.replace(/'555-VENDOR'/g, "'415-555-0127'");
// '555-0123' and '555-0789' are fine as local numbers if they appear as full 10-digit in different format
// but replace standalone 555-xxxx patterns that use 555 as an area code
src = src.replace(/'555-0123'/g, "'415-555-0128'");
src = src.replace(/'555-0789'/g, "'415-555-0129'");

// ────────────────────────────────────────────────────────────────
// 9. Fix invalid order status transitions
//    NEW → IN_PROGRESS is not valid; use PENDING_ASSIGNMENT
// ────────────────────────────────────────────────────────────────
// In the update test — change IN_PROGRESS to PENDING_ASSIGNMENT
src = src.replace(
  /status: OrderStatus\.IN_PROGRESS,\n        notes: 'Updated via comprehensive integration test'/,
  "status: OrderStatus.PENDING_ASSIGNMENT,\n        notes: 'Updated via comprehensive integration test'"
);
// List orders filtered by IN_PROGRESS → PENDING_ASSIGNMENT
src = src.replace(
  '/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`',
  '/api/orders?status=${OrderStatus.PENDING_ASSIGNMENT}&limit=10`'
);

// In E2E: COMPLETED transition — leave as is (it's a direct assignment which may be fine)

// ────────────────────────────────────────────────────────────────
// 10. Fix remaining inline fetch calls that weren't caught by generic patterns
//     (cleanup section in E2E test)
// ────────────────────────────────────────────────────────────────
src = src.replace(
  /await fetch\(`\$\{API_BASE_URL\}(\/api\/orders\/[^`]+)`, \{ method: 'DELETE' \}\);/g,
  (match, path) => `await request(app).delete(\`${path}\`).set('Authorization', \`Bearer \${adminToken}\`);`
);
src = src.replace(
  /await fetch\(`\$\{API_BASE_URL\}(\/api\/vendors\/[^`]+)`, \{ method: 'DELETE' \}\);/g,
  (match, path) => `await request(app).delete(\`${path}\`).set('Authorization', \`Bearer \${adminToken}\`);`
);

// ────────────────────────────────────────────────────────────────
// 11. Final cleanup — remove any leftover API_BASE_URL references
// ────────────────────────────────────────────────────────────────
if (src.includes('API_BASE_URL')) {
  console.warn('WARNING: API_BASE_URL still present in file!');
  // Find and print the lines
  src.split('\n').forEach((line, i) => {
    if (line.includes('API_BASE_URL')) console.warn(`  L${i+1}: ${line}`);
  });
}

// Similarly check for remaining fetch() calls
if (src.includes('await fetch(')) {
  console.warn('WARNING: fetch() still present in file!');
  src.split('\n').forEach((line, i) => {
    if (line.includes('await fetch(')) console.warn(`  L${i+1}: ${line}`);
  });
}

writeFileSync(filePath, src, 'utf8');
console.log('Done:', filePath);
