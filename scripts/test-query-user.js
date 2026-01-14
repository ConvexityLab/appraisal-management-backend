// Quick test to verify user query works
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

async function testQuery() {
  try {
    const userId = 'test-admin';
    const tenantId = 'test-tenant';
    
    console.log('\n🔍 Testing Cosmos DB query...');
    console.log(`  userId: ${userId}`);
    console.log(`  tenantId (partition key): ${tenantId}\n`);
    
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
    
    // This is how the service queries it
    const { resource: user } = await container.item(userId, tenantId).read();
    
    if (user) {
      console.log('\n✅ User found!');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  TenantId: ${user.tenantId}`);
      console.log(`  IsActive: ${user.isActive}`);
    } else {
      console.log('\n❌ User not found');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 404) {
      console.log('\nThis means the user doesn\'t exist with those exact id/tenantId values.');
    }
  }
}

testQuery();
