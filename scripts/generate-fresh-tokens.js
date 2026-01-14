// Generate fresh test JWT tokens with current timestamps
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Must match TEST_JWT_SECRET from .env (or default if not set)
const JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-key-DO-NOT-USE-IN-PRODUCTION';
const ISSUER = 'appraisal-management-test';
const AUDIENCE = 'appraisal-management-api';

// Token expires in 30 days
const EXPIRES_IN = '30d';

const generateToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: Math.floor(Date.now() / 1000),
      isTestToken: true
    },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
};

// Admin token
const adminToken = generateToken({
  sub: 'test-admin',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  tenantId: 'test-tenant',
  accessScope: {
    teamIds: ['team-all'],
    departmentIds: ['dept-all'],
    managedClientIds: ['client-all'],
    managedVendorIds: ['vendor-all'],
    managedUserIds: ['user-all'],
    regionIds: ['region-all'],
    statesCovered: ['ALL'],
    canViewAllOrders: true,
    canViewAllVendors: true,
    canOverrideQC: true
  },
  permissions: ['*']
});

console.log('\n✅ Fresh test tokens generated!\n');
console.log('Copy these to your .env file (replace old tokens):\n');
console.log('TEST_JWT_ADMIN=' + adminToken);
console.log('\nExpires in: 30 days');
console.log('Generated at:', new Date().toISOString());
