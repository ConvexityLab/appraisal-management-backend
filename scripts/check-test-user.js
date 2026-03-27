// Check if test user exists in Cosmos DB and what partition key it has
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

async function checkTestUser() {
  try {
    console.log('\n🔍 Checking test user in Cosmos DB...\n');
    
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
    
    // Try to read with expected partition key
    try {
      const { resource } = await container.item('test-admin', 'test-tenant').read();
      console.log('\n✅ Test user found!');
      console.log(`  ID: ${resource.id}`);
      console.log(`  Email: ${resource.email}`);
      console.log(`  Role: ${resource.role}`);
      console.log(`  Tenant ID: ${resource.tenantId}`);
      console.log(`  Is Active: ${resource.isActive}`);
      console.log(`  Access Scope:`, JSON.stringify(resource.accessScope, null, 2));
    } catch (error) {
      if (error.code === 404) {
        console.log('\n❌ Test user NOT found with partition key "test-tenant"');
        
        // Try querying to find the user
        console.log('\n🔍 Searching for user with ID "test-admin"...');
        const { resources } = await container.items
          .query({
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: 'test-admin' }]
          })
          .fetchAll();
        
        if (resources.length > 0) {
          console.log(`\n✅ Found ${resources.length} user(s) with ID "test-admin":`);
          resources.forEach(user => {
            console.log(`\n  ID: ${user.id}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Tenant ID (partition key): ${user.tenantId}`);
            console.log(`  Role: ${user.role}`);
          });
        } else {
          console.log('\n❌ No users found with ID "test-admin"');
        }
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkTestUser();
