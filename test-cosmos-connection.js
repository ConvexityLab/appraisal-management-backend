/**
 * Simple Cosmos DB connection test for debugging
 */
const { CosmosClient } = require('@azure/cosmos');

// Emulator configuration (same as in cosmos-config.ts)
const endpoint = 'https://localhost:8081';
const key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const databaseName = 'appraisal-management';

// Connection options for local emulator
const connectionPolicy = {
  requestTimeout: 10000,
  enableEndpointDiscovery: false,
  preferredLocations: []
};

async function testConnection() {
  console.log('🧪 Testing Cosmos DB Emulator Connection...');
  console.log(`📡 Endpoint: ${endpoint}`);
  console.log(`🗄️  Database: ${databaseName}`);
  
  // Disable SSL verification for local emulator (required for self-signed certs)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔓 SSL verification disabled for local emulator');
  
  try {
    // Create client with relaxed SSL for emulator
    const client = new CosmosClient({
      endpoint,
      key,
      connectionPolicy,
      options: {
        // Disable SSL validation for local emulator
        enableEndpointDiscovery: false,
        userAgentSuffix: 'TestScript/1.0.0'
      }
    });

    // Test 1: Client creation
    console.log('✅ Cosmos Client created successfully');

    // Test 2: Database access
    console.log('🔍 Testing database access...');
    const { database } = await client.databases.createIfNotExists({ id: databaseName });
    console.log('✅ Database access successful');

    // Test 3: Container creation
    console.log('🔍 Testing container operations...');
    const { container } = await database.containers.createIfNotExists({
      id: 'test-container',
      partitionKey: '/id'
    });
    console.log('✅ Container operations successful');

    // Test 4: Document operations
    console.log('🔍 Testing document operations...');
    const testDoc = {
      id: `test-${Date.now()}`,
      message: 'Hello from connection test',
      timestamp: new Date().toISOString()
    };

    const { item } = await container.items.create(testDoc);
    console.log('✅ Document creation successful');

    // Read it back
    const { resource } = await item.read();
    console.log('✅ Document read successful');
    console.log(`📄 Document: ${JSON.stringify(resource, null, 2)}`);

    // Clean up
    await item.delete();
    console.log('✅ Document cleanup successful');

    console.log('🎉 All tests passed! Cosmos DB Emulator is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Possible solutions:');
      console.log('   1. Make sure Cosmos DB Emulator is running: docker ps');
      console.log('   2. Wait for emulator to fully start (can take 1-2 minutes)');
      console.log('   3. Check if port 8081 is accessible: curl -k https://localhost:8081');
    } else if (error.code === 'ECONNRESET') {
      console.log('💡 SSL/TLS connection issues detected');
      console.log('   This is common with the Cosmos DB Linux emulator');
      console.log('   The application might need SSL certificate configuration');
    }
    
    process.exit(1);
  }
}

// Add process handlers
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the test
testConnection().catch(console.error);