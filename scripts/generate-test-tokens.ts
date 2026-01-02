#!/usr/bin/env node
/**
 * Generate Test JWT Tokens Script
 * 
 * Run: npm run generate-test-tokens
 * Or: ts-node scripts/generate-test-tokens.ts
 */

import * as path from 'path';
import * as fs from 'fs';

// Add parent directory to module path
require('module').Module._initPaths();

import TestTokenGenerator from '../src/utils/test-token-generator';

const generator = new TestTokenGenerator();
const tokens = generator.generateAllTestTokens();

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║          Test JWT Tokens for Development                    ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('⚠️  WARNING: These tokens are for DEVELOPMENT/TESTING ONLY\n');

// Generate .env additions
const envContent = `
# =============================================================================
# TEST JWT TOKENS (Generated on ${new Date().toISOString()})
# =============================================================================
# Enable test tokens (DO NOT SET TO true IN PRODUCTION)
ALLOW_TEST_TOKENS=true

# Admin token (full access)
TEST_JWT_ADMIN=${tokens.admin}

# Manager token (team/client management)
TEST_JWT_MANAGER=${tokens.manager}

# QC Analyst token (assigned items only)
TEST_JWT_QC_ANALYST=${tokens.qc_analyst}

# Appraiser token (owned/assigned items)
TEST_JWT_APPRAISER=${tokens.appraiser}

# Active test token (swap this to change user)
TEST_JWT_TOKEN=\${TEST_JWT_ADMIN}
`;

// Write to file
const outputPath = path.join(__dirname, '..', '.env.test-tokens');
fs.writeFileSync(outputPath, envContent);

console.log(`✅ Tokens written to: ${outputPath}\n`);

console.log('📋 Add to your .env file or use directly:\n');
console.log('   cp .env.test-tokens .env.test-tokens.backup');
console.log('   cat .env.test-tokens >> .env\n');

console.log('🔧 Usage in API requests:\n');
console.log('   curl -H "Authorization: Bearer $TEST_JWT_ADMIN" http://localhost:3000/api/orders\n');

console.log('🧪 Usage in tests:\n');
console.log('   process.env.TEST_JWT_TOKEN = process.env.TEST_JWT_ADMIN;');
console.log('   const response = await fetch(url, {');
console.log('     headers: { Authorization: `Bearer ${process.env.TEST_JWT_TOKEN}` }');
console.log('   });\n');

console.log('👥 Test Users:\n');

const users = [
  {
    role: 'Admin',
    email: 'admin@test.local',
    permissions: 'Full access to all resources',
    scope: 'Global - all teams, departments, clients'
  },
  {
    role: 'Manager',
    email: 'manager@test.local',
    permissions: 'Manage orders, vendors, view analytics',
    scope: 'Team 1, Team 2 - CA, NV, AZ regions'
  },
  {
    role: 'QC Analyst',
    email: 'qc.analyst@test.local',
    permissions: 'QC validation, assigned items only',
    scope: 'QC Team - CA, NV regions'
  },
  {
    role: 'Appraiser',
    email: 'appraiser@test.local',
    permissions: 'View/update owned orders',
    scope: 'Appraiser Team - CA region'
  }
];

users.forEach(user => {
  console.log(`   • ${user.role} (${user.email})`);
  console.log(`     Permissions: ${user.permissions}`);
  console.log(`     Scope: ${user.scope}\n`);
});

console.log('🔒 Security Notes:');
console.log('   • Test tokens only work when ALLOW_TEST_TOKENS=true');
console.log('   • NEVER set ALLOW_TEST_TOKENS=true in production');
console.log('   • Test tokens are valid for 24 hours');
console.log('   • Tokens contain isTestToken=true flag\n');

// Decode and show admin token structure
const jwt = require('jsonwebtoken');
const adminDecoded = jwt.decode(tokens.admin);

console.log('🔍 Token Structure (Admin example):\n');
console.log(JSON.stringify(adminDecoded, null, 2));
console.log('\n');
