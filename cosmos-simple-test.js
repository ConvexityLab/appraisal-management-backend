/**
 * Simplified Cosmos DB Service Test
 * Tests with minimal container configuration for emulator compatibility
 */

import { CosmosClient } from '@azure/cosmos';
import * as https from 'https';

async function testSimpleCosmosDbConnection() {
  console.log('🚀 Testing Simple Cosmos DB Connection...\n');

  try {
    // Create HTTPS agent for emulator
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    // Create client
    console.log('1️⃣ Creating Cosmos DB client...');
    const client = new CosmosClient({
      endpoint: 'https://localhost:8081',
      key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
      agent: httpsAgent
    });
    console.log('✅ Client created successfully');

    // Create or get database
    console.log('2️⃣ Creating database...');
    const { database } = await client.databases.createIfNotExists({
      id: 'appraisal-management-test'
    });
    console.log('✅ Database ready');

    // Create simple orders container
    console.log('3️⃣ Creating orders container...');
    const { container: ordersContainer } = await database.containers.createIfNotExists({
      id: 'orders',
      partitionKey: '/clientId'
      // Using default indexing policy for simplicity
    });
    console.log('✅ Orders container ready');

    // Test document operations
    console.log('4️⃣ Testing document operations...');
    
    // Create test order
    const testOrder = {
      id: `test-order-${Date.now()}`,
      clientId: 'test-client-001',
      orderNumber: `ORDER-${Date.now()}`,
      status: 'new',
      propertyAddress: '123 Test St, Test City, CA',
      orderType: 'purchase',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: 'test-system'
    };

    const { resource: createdOrder } = await ordersContainer.items.create(testOrder);
    console.log(`✅ Order created: ${createdOrder?.id}`);

    // Read the order back
    const { resource: retrievedOrder } = await ordersContainer.item(createdOrder?.id, 'test-client-001').read();
    console.log(`✅ Order retrieved: ${retrievedOrder?.orderNumber}`);

    // Update the order
    const updatedOrder = {
      ...retrievedOrder,
      status: 'assigned',
      assignedVendorId: 'vendor-001',
      updatedAt: new Date().toISOString()
    };
    
    const { resource: updatedResult } = await ordersContainer.item(createdOrder?.id, 'test-client-001').replace(updatedOrder);
    console.log(`✅ Order updated: status = ${updatedResult?.status}`);

    // Query orders
    const { resources: orders } = await ordersContainer.items
      .query('SELECT * FROM c WHERE c.clientId = "test-client-001"')
      .fetchAll();
    console.log(`✅ Query successful: found ${orders.length} orders`);

    // Delete the test order
    await ordersContainer.item(createdOrder?.id, 'test-client-001').delete();
    console.log(`✅ Test order deleted`);

    console.log('\n🎉 Simple Cosmos DB test completed successfully!\n');
    console.log('📋 Test Results:');
    console.log('   ✅ Client connection: PASSED');
    console.log('   ✅ Database creation: PASSED');
    console.log('   ✅ Container creation: PASSED');
    console.log('   ✅ Document create: PASSED');
    console.log('   ✅ Document read: PASSED');
    console.log('   ✅ Document update: PASSED');
    console.log('   ✅ Document query: PASSED');
    console.log('   ✅ Document delete: PASSED');
    console.log('\n✨ Your Cosmos DB Emulator is working perfectly!');
    console.log('\n🔧 Next Steps:');
    console.log('   1. The emulator connectivity is confirmed');
    console.log('   2. Basic CRUD operations are working');
    console.log('   3. You can now fix the complex indexing policies in the main service');
    console.log('   4. Consider using simpler indexing for emulator development');

  } catch (error) {
    console.error('\n❌ Simple Cosmos DB test failed:', error);
    console.error('\n🔍 Error details:');
    console.error('   Message:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
    throw error;
  }
}

// Run the test
testSimpleCosmosDbConnection()
  .then(() => {
    console.log('\n🎯 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });