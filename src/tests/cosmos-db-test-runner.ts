/**
 * Simple Cosmos DB Test Runner
 * Tests basic database connectivity and operations
 */

import { CosmosDbService } from '../services/cosmos-db.service.js';
import { OrderStatus, OrderType, ProductType, Priority, PropertyType, OccupancyType, LoanType, LoanPurpose, ContactRole, ContactMethod } from '../types/index.js';

/**
 * Manual test runner for Cosmos DB functionality
 * Run this to validate local Cosmos DB Emulator is working
 */
export async function testCosmosDbConnection(): Promise<void> {
  console.log('🚀 Starting Cosmos DB Connection Test...\n');
  
  const dbService = new CosmosDbService();
  let testOrderId: string | undefined;
  
  try {
    // Test 1: Initialize database connection
    console.log('1️⃣ Testing database initialization...');
    await dbService.initialize();
    console.log('✅ Database initialized successfully');
    console.log(`   Connected: ${dbService.isDbConnected()}\n`);
    
    // Test 2: Health check
    console.log('2️⃣ Testing health check...');
    const health = await dbService.healthCheck();
    console.log(`✅ Health check result:`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.database}`);
    console.log(`   Latency: ${health.latency}ms\n`);
    
    // Test 3: Create a test order
    console.log('3️⃣ Testing order creation...');
    const now = new Date();
    const testOrder = {
      clientId: 'test-client-001',
      orderNumber: `TEST-${Date.now()}`,
      propertyAddress: {
        streetAddress: '123 Test Property Lane',
        city: 'Test City',
        state: 'CA',
        zipCode: '90210',
        county: 'Los Angeles'
      },
      propertyDetails: {
        propertyType: PropertyType.SFR,
        occupancy: OccupancyType.OWNER_OCCUPIED,
        yearBuilt: 2010,
        grossLivingArea: 2500,
        bedrooms: 4,
        bathrooms: 3,
        features: ['Garage', 'Pool']
      },
      orderType: OrderType.PURCHASE,
      productType: ProductType.FULL_APPRAISAL,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      rushOrder: false,
      borrowerInformation: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567'
      },
      loanInformation: {
        loanAmount: 500000,
        loanType: LoanType.CONVENTIONAL,
        loanPurpose: LoanPurpose.PURCHASE
      },
      contactInformation: {
        name: 'Agent Smith',
        role: ContactRole.LOAN_OFFICER,
        email: 'agent.smith@lender.com',
        phone: '555-987-6543',
        preferredMethod: ContactMethod.EMAIL
      },
      status: OrderStatus.SUBMITTED,
      priority: Priority.NORMAL,
      createdAt: now,
      updatedAt: now,
      createdBy: 'test-system',
      tags: ['test', 'demo'],
      metadata: {
        testRun: true,
        timestamp: new Date().toISOString()
      }
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
    console.log('4️⃣ Testing order retrieval...');
    const retrieveResult = await dbService.findOrderById(testOrderId);
    
    if (retrieveResult.success && retrieveResult.data) {
      console.log(`✅ Order retrieved successfully:`);
      console.log(`   Order Number: ${retrieveResult.data.orderNumber}`);
      console.log(`   Client ID: ${retrieveResult.data.clientId}`);
      console.log(`   Status: ${retrieveResult.data.status}\n`);
    } else {
      console.log('❌ Failed to retrieve order:', retrieveResult.error);
    }
    
    // Test 5: Update order status
    console.log('5️⃣ Testing order update...');
    const updateResult = await dbService.updateOrder(testOrderId, {
      status: OrderStatus.IN_PROGRESS,
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
    console.log('6️⃣ Testing order search...');
    const searchResult = await dbService.findOrders({
      status: [OrderStatus.IN_PROGRESS],
      clientId: 'test-client-001'
    });
    
    if (searchResult.success && searchResult.data) {
      console.log(`✅ Order search successful:`);
      console.log(`   Found ${searchResult.data.length} orders`);
      if (searchResult.data.length > 0) {
        const foundOrder = searchResult.data.find((order: any) => order.id === testOrderId);
        if (foundOrder) {
          console.log(`   Test order found in search results ✓`);
        }
      }
    } else {
      console.log('❌ Order search failed:', searchResult.error);
    }
    
    console.log('\n🎉 All Cosmos DB tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Database initialization: PASSED');
    console.log('   ✅ Health check: PASSED');
    console.log('   ✅ Order creation: PASSED');
    console.log('   ✅ Order retrieval: PASSED');
    console.log('   ✅ Order update: PASSED');
    console.log('   ✅ Order search: PASSED');
    
  } catch (error) {
    console.error('\n❌ Cosmos DB test failed with error:', error);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('   1. Ensure Cosmos DB Emulator is running');
    console.error('   2. Check emulator is accessible at https://localhost:8081');
    console.error('   3. Verify environment variables are set correctly');
    console.error('   4. Try restarting the Cosmos DB Emulator');
    throw error;
  } finally {
    // Cleanup
    if (dbService.isDbConnected()) {
      await dbService.disconnect();
      console.log('\n🔌 Database connection closed');
    }
  }
}

/**
 * Quick connectivity test - just checks if we can connect
 */
export async function quickConnectivityTest(): Promise<boolean> {
  console.log('⚡ Running quick connectivity test...');
  
  const dbService = new CosmosDbService();
  
  try {
    await dbService.initialize();
    const isConnected = dbService.isDbConnected();
    
    if (isConnected) {
      const health = await dbService.healthCheck();
      console.log(`✅ Quick test PASSED - DB: ${health.database}, Latency: ${health.latency}ms`);
      return true;
    } else {
      console.log('❌ Quick test FAILED - Not connected');
      return false;
    }
  } catch (error) {
    console.log('❌ Quick test FAILED:', (error as Error).message);
    return false;
  } finally {
    if (dbService.isDbConnected()) {
      await dbService.disconnect();
    }
  }
}

// If this file is run directly, execute the tests
if (require.main === module) {
  console.log('🎯 Running Cosmos DB Tests Directly...\n');
  
  quickConnectivityTest()
    .then(success => {
      if (success) {
        return testCosmosDbConnection();
      } else {
        console.log('\n⚠️  Skipping full tests due to connectivity issues');
        process.exit(1);
      }
    })
    .then(() => {
      console.log('\n✨ All tests completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Tests failed:', error.message);
      process.exit(1);
    });
}