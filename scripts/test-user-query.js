// Test querying the test user directly
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();

const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
const databaseName = process.env.AZURE_COSMOS_DATABASE_NAME || 'appraisal-management';

async function testQuery() {
  try {
    console.log('\n🔧 Testing user query...\n');
    
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
    
    // Test 1: Read by ID and partition key
    console.log('\n📋 Test 1: Reading test-admin with partition key "test-tenant"');
    try {
      const { resource: user1 } = await container.item('test-admin', 'test-tenant').read();
      console.log('✅ User found!');
      console.log('  ID:', user1.id);
      console.log('  Email:', user1.email);
      console.log('  TenantId:', user1.tenantId);
      console.log('  Role:', user1.role);
    } catch (error) {
      console.log('❌ Error:', error.code, error.message);
    }
    
    // Test 2: Query by ID
    console.log('\n📋 Test 2: Querying for test-admin');
    const { resources: users } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: 'test-admin' }]
      })
      .fetchAll();
    
    console.log(`✅ Found ${users.length} user(s)`);
    users.forEach(u => {
      console.log('  ID:', u.id);
      console.log('  Email:', u.email);
      console.log('  TenantId:', u.tenantId);
      console.log('  Partition Key:', u.tenantId);
    });
    
    // Test 3: List all users
    console.log('\n📋 Test 3: Listing all users');
    const { resources: allUsers } = await container.items.readAll().fetchAll();
    console.log(`✅ Total users: ${allUsers.length}`);
    allUsers.forEach(u => {
      console.log(`  - ${u.id} (${u.email}) - tenant: ${u.tenantId}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testQuery();
