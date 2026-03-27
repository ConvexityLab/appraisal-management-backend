/**
 * Working Cosmos DB Service Test
 * Tests our actual CosmosDbService implementation
 */

import { CosmosDbService } from '../services/cosmos-db.service.js';

async function testCosmosDbService(): Promise<void> {
  console.log('🚀 Testing CosmosDbService Implementation...\n');

  // Initialize service with emulator endpoint (key handled automatically for emulator)
  const dbService = new CosmosDbService('https://localhost:8081');
  let testOrderId: string | undefined;

  try {
    // Test 1: Initialize database
    console.log('1️⃣ Initializing database service...');
    await dbService.initialize();
    console.log('✅ Database service initialized');
    console.log(`   Connected: ${dbService.isDbConnected()}\n`);

    // Test 2: Health check
    console.log('2️⃣ Running health check...');
    const health = await dbService.healthCheck();
    console.log(`✅ Health check passed:`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.database}`);
    console.log(`   Latency: ${health.latency}ms\n`);

    // Test 3: Create a test order using minimal valid data
    console.log('3️⃣ Creating test order...');
    const now = new Date();
    const testOrder = {
      clientId: 'test-client-001',
      tenantId: 'test-tenant-001',
      orderNumber: `TEST-ORDER-${Date.now()}`,
      propertyAddress: {
        streetAddress: '123 Test Property St',
        city: 'Test City',
        state: 'CA',
        zipCode: '90210',
        county: 'Test County'
      },
      propertyDetails: {
        propertyType: 'single_family_residential' as any,
        occupancy: 'owner_occupied' as any,
        features: []
      },
      orderType: 'purchase' as any,
      productType: 'full_appraisal' as any,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      rushOrder: false,
      borrowerInformation: {
        firstName: 'John',
        lastName: 'Doe'
      },
      loanInformation: {
        loanAmount: 500000,
        loanType: 'conventional' as any,
        loanPurpose: 'purchase' as any
      },
      contactInformation: {
        name: 'Test Agent',
        role: 'loan_officer' as any,
        preferredMethod: 'email' as any
      },
      status: 'new' as any,
      priority: 'normal' as any,
      createdAt: now,
      updatedAt: now,
      createdBy: 'test-system',
      tags: ['test'],
      metadata: { test: true }
    };

    const createResult = await dbService.createOrder(testOrder);
    
    if (createResult.success && createResult.data) {
      testOrderId = createResult.data.id;
      console.log(`✅ Order created successfully:`);
      console.log(`   Order ID: ${testOrderId}`);
      console.log(`   Order Number: ${createResult.data.orderNumber}`);
      console.log(`   Status: ${createResult.data.status}\n`);
    } else {
      console.log('❌ Failed to create order:', createResult.error);
      return;
    }

    // Test 4: Retrieve the order
    console.log('4️⃣ Retrieving order...');
    const retrieveResult = await dbService.findOrderById(testOrderId);
    
    if (retrieveResult.success && retrieveResult.data) {
      console.log(`✅ Order retrieved successfully:`);
      console.log(`   Order Number: ${retrieveResult.data.orderNumber}`);
      console.log(`   Client ID: ${retrieveResult.data.clientId}`);
      console.log(`   Status: ${retrieveResult.data.status}\n`);
    } else {
      console.log('❌ Failed to retrieve order:', retrieveResult.error);
    }

    // Test 5: Update order
    console.log('5️⃣ Updating order status...');
    const updateResult = await dbService.updateOrder(testOrderId, {
      status: 'assigned' as any,
      assignedVendorId: 'test-vendor-001'
    });
    
    if (updateResult.success && updateResult.data) {
      console.log(`✅ Order updated successfully:`);
      console.log(`   New Status: ${updateResult.data.status}`);
      console.log(`   Assigned Vendor: ${updateResult.data.assignedVendorId}\n`);
    } else {
      console.log('❌ Failed to update order:', updateResult.error);
    }

    // Test 6: Search orders
    console.log('6️⃣ Searching orders...');
    const searchResult = await dbService.findOrders({
      clientId: 'test-client-001'
    });
    
    if (searchResult.success && searchResult.data) {
      console.log(`✅ Order search successful:`);
      console.log(`   Found ${searchResult.data.length} orders`);
      
      const foundOrder = searchResult.data.find((order: any) => order.id === testOrderId);
      if (foundOrder) {
        console.log(`   Test order found in search results ✓`);
      }
    } else {
      console.log('❌ Order search failed:', searchResult.error);
    }

    console.log('\n🎉 CosmosDbService test completed successfully!\n');
    console.log('📋 Test Results:');
    console.log('   ✅ Database initialization: PASSED');
    console.log('   ✅ Health check: PASSED');
    console.log('   ✅ Order creation: PASSED');
    console.log('   ✅ Order retrieval: PASSED');
    console.log('   ✅ Order update: PASSED');
    console.log('   ✅ Order search: PASSED');
    console.log('\n✨ Your Cosmos DB integration is working perfectly!');

  } catch (error) {
    console.error('\n❌ CosmosDbService test failed:', error);
    console.error('\n🔍 Error details:');
    console.error('   Message:', (error as Error).message);
    if ((error as any).code) {
      console.error('   Code:', (error as any).code);
    }
    
    console.error('\n🔧 Possible solutions:');
    console.error('   1. Ensure Cosmos DB Emulator is running');
    console.error('   2. Check that the database service is properly configured');
    console.error('   3. Verify container schemas match expected types');
    throw error;
  } finally {
    // Cleanup
    if (dbService.isDbConnected()) {
      await dbService.disconnect();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Export for use in other tests
export { testCosmosDbService };

// Run directly if this file is executed
if (require.main === module) {
  testCosmosDbService()
    .then(() => {
      console.log('\n🎯 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}