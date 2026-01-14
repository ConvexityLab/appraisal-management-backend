// Create test user in Cosmos DB for test token authentication
// This allows full authentication flow without workarounds

const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

// Test user matching TEST_JWT_ADMIN token
const testUser = {
  id: 'test-admin', // Matches JWT 'sub' claim
  azureAdUserId: 'test-admin',
  email: 'admin@test.local',
  displayName: 'Test Admin',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'admin',
  tenantId: 'test-tenant',
  
  // Access scope - full admin access
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
  
  // Permissions
  permissions: ['*'],
  
  // Profile metadata
  isActive: true,
  isTestUser: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  
  // Contact info
  phoneNumber: '+1-555-0100',
  officeLocation: 'Test Environment',
  
  // Preferences
  preferences: {
    emailNotifications: true,
    smsNotifications: false,
    timezone: 'America/Los_Angeles',
    language: 'en-US'
  }
};

async function createTestUser() {
  try {
    console.log('\n🔧 Creating test user in Cosmos DB...\n');
    
    // Connect using Managed Identity (if available) or connection string
    let client;
    if (process.env.AZURE_COSMOS_KEY) {
      const key = process.env.AZURE_COSMOS_KEY;
      client = new CosmosClient({ endpoint, key });
      console.log('✅ Connected with API key');
    } else {
      const { DefaultAzureCredential } = require('@azure/identity');
      const credential = new DefaultAzureCredential();
      client = new CosmosClient({ endpoint, aadCredentials: credential });
      console.log('✅ Connected with Managed Identity');
    }
    
    const database = client.database(databaseName);
    const container = database.container('users');
    
    // Check if user already exists
    try {
      const { resource: existingUser } = await container.item(testUser.id, testUser.tenantId).read();
      if (existingUser) {
        console.log('⚠️  Test user already exists. Updating...');
        const { resource: updated } = await container.item(testUser.id, testUser.tenantId).replace(testUser);
        console.log('✅ Test user updated successfully!\n');
        console.log('User details:');
        console.log(`  ID: ${updated.id}`);
        console.log(`  Email: ${updated.email}`);
        console.log(`  Role: ${updated.role}`);
        console.log(`  Tenant: ${updated.tenantId}`);
        return;
      }
    } catch (error) {
      if (error.code !== 404) throw error;
    }
    
    // Create new user
    const { resource: created } = await container.items.create(testUser);
    console.log('✅ Test user created successfully!\n');
    console.log('User details:');
    console.log(`  ID: ${created.id}`);
    console.log(`  Email: ${created.email}`);
    console.log(`  Role: ${created.role}`);
    console.log(`  Tenant: ${created.tenantId}`);
    console.log('\n✅ You can now use TEST_JWT_ADMIN token with full authentication flow!\n');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure AZURE_COSMOS_ENDPOINT is set in .env');
    console.error('2. Make sure AZURE_COSMOS_KEY is set (or Managed Identity has access)');
    console.error('3. Make sure the "users" container exists in Cosmos DB');
    process.exit(1);
  }
}

createTestUser();
