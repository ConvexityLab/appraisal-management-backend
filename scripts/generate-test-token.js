/**
 * Generate Fresh Test JWT Token
 * Creates a new test token with extended expiration
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';

function generateTestToken(userId = 'test-user-admin', role = 'admin', expiresIn = '30d') {
  const payload = {
    sub: userId,
    userId: userId,
    email: 'admin@test.com',
    name: 'Test Admin User',
    role: role,
    tenantId: 'test-tenant-123',
    permissions: ['read', 'write', 'admin'],
    iss: 'appraisal-management-test',
    aud: 'appraisal-management-api',
    iat: Math.floor(Date.now() / 1000),
    isTestToken: true // CRITICAL: Flag to identify test tokens
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn });

  console.log('\n🔑 Test JWT Token Generated\n');
  console.log('='.repeat(80));
  console.log('\nAdd this to your .env file:');
  console.log('\nTEST_JWT_ADMIN=' + token);
  console.log('\n='.repeat(80));
  console.log('\nToken Details:');
  console.log(`  User ID: ${userId}`);
  console.log(`  Role: ${role}`);
  console.log(`  Expires: ${expiresIn}`);
  console.log(`  Tenant: ${payload.tenantId}`);
  console.log('\n✅ Token is valid for 30 days\n');

  return token;
}

// Generate tokens for different roles
console.log('🚀 Generating Test Tokens...\n');

const adminToken = generateTestToken('test-user-admin', 'admin', '30d');
console.log('\n' + '-'.repeat(80) + '\n');

const managerToken = generateTestToken('test-user-manager', 'manager', '30d');
console.log('\nTEST_JWT_MANAGER=' + managerToken);
console.log('\n' + '-'.repeat(80) + '\n');

const appraiserToken = generateTestToken('test-user-appraiser', 'appraiser', '30d');
console.log('\nTEST_JWT_APPRAISER=' + appraiserToken);
console.log('\n✅ All tokens generated successfully!\n');
