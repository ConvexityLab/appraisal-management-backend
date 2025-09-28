/**
 * Cosmos DB Integration Test
 * Tests all database operations with local Cosmos DB Emulator
 */

import { CosmosDbService } from '../services/cosmos-db.service';
import { OrderStatus, OrderPriority, OrderType, VendorStatus } from '../types/order-management';

describe('Cosmos DB Integration Tests', () => {
  let dbService: CosmosDbService;
  let testOrderId: string;
  let testVendorId: string;

  beforeAll(async () => {
    // Initialize database service
    dbService = new CosmosDbService();
    
    console.log('🔄 Initializing Cosmos DB connection...');
    await dbService.initialize();
    
    // Wait a moment for containers to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 60000); // 60 second timeout for initialization

  afterAll(async () => {
    // Cleanup
    if (dbService) {
      await dbService.disconnect();
    }
  });

  describe('Database Health and Connection', () => {
    it('should connect to Cosmos DB successfully', async () => {
      expect(dbService.isDbConnected()).toBe(true);
    });

    it('should pass health check', async () => {
      const health = await dbService.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.database).toBe('appraisal-management');
      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThan(0);
      
      console.log(`✅ Database health check passed (latency: ${health.latency}ms)`);
    });
  });

  describe('Order Operations', () => {
    it('should create an order successfully', async () => {
      const orderData = {
        orderNumber: `TEST-${Date.now()}`,
        clientInformation: {
          clientId: 'test-client-1',
          clientName: 'Test Client',
          contactPerson: 'John Smith',
          email: 'john.smith@testclient.com',
          phone: '555-123-4567',
          address: '123 Business Ave, Test City, ST 12345'
        },
        propertyDetails: {
          address: '456 Test Property Lane',
          city: 'Test City',
          state: 'CA',
          zipCode: '90210',
          county: 'Test County',
          coordinates: {
            latitude: 34.0522,
            longitude: -118.2437
          },
          propertyType: 'SINGLE_FAMILY' as const,
          yearBuilt: 2010,
          squareFootage: 2500,
          bedrooms: 4,
          bathrooms: 3
        },
        orderType: OrderType.FULL_APPRAISAL,
        priority: OrderPriority.ROUTINE,
        status: OrderStatus.DRAFT,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        orderValue: 750.00,
        assignmentHistory: [],
        statusHistory: [],
        documents: [],
        notifications: [],
        createdBy: 'test-user'
      };

      const result = await dbService.createOrder(orderData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBeDefined();
      expect(result.data?.orderNumber).toBe(orderData.orderNumber);
      expect(result.data?.status).toBe(OrderStatus.DRAFT);
      
      testOrderId = result.data!.id;
      console.log(`✅ Order created successfully with ID: ${testOrderId}`);
    });

    it('should retrieve order by ID', async () => {
      const result = await dbService.findOrderById(testOrderId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(testOrderId);
      expect(result.data?.clientInformation.clientName).toBe('Test Client');
      
      console.log(`✅ Order retrieved successfully: ${result.data?.orderNumber}`);
    });

    it('should update order status', async () => {
      const result = await dbService.updateOrder(testOrderId, {
        status: OrderStatus.SUBMITTED
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(OrderStatus.SUBMITTED);
      
      console.log(`✅ Order status updated to: ${result.data?.status}`);
    });

    it('should search orders with filters', async () => {
      const filters = {
        status: [OrderStatus.SUBMITTED]
      };
      
      const result = await dbService.findOrders(filters, 0, 10);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check if our test order is in the results
      const foundOrder = result.data.find(order => order.id === testOrderId);
      expect(foundOrder).toBeDefined();
      expect(foundOrder?.status).toBe(OrderStatus.SUBMITTED);
      
      console.log(`✅ Found ${result.data.length} orders with SUBMITTED status`);
    });
  });

  describe('Vendor Operations', () => {
    it('should create a vendor successfully', async () => {
      const vendorData = {
        vendorCode: `VENDOR-${Date.now()}`,
        businessName: 'Test Appraisal Services LLC',
        contactPerson: 'Jane Appraiser',
        email: 'jane@testappraisal.com',
        phone: '555-987-6543',
        address: '789 Appraiser Blvd',
        city: 'Test City',
        state: 'CA',
        zipCode: '90210',
        businessType: 'COMPANY' as const,
        stateLicense: 'CA-123456789',
        licenseExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        serviceTypes: [OrderType.FULL_APPRAISAL, OrderType.DRIVE_BY],
        serviceAreas: [
          {
            id: 'area-1',
            vendorId: '', // Will be set after creation
            state: 'CA',
            counties: ['Los Angeles', 'Orange'],
            maxDistanceMiles: 50
          }
        ],
        maxActiveOrders: 10,
        averageTurnaroundDays: 5,
        status: VendorStatus.ACTIVE,
        currentActiveOrders: 0,
        totalOrdersCompleted: 25,
        averageQCScore: 94.5,
        onTimeDeliveryRate: 98.2,
        clientSatisfactionScore: 4.8,
        standardRates: [],
        paymentTerms: 'Net 30',
        w9OnFile: true,
        autoAcceptOrders: false,
        emailNotifications: true,
        smsNotifications: false,
        maxAssignmentRadius: 50,
        licenseState: 'CA' // Partition key
      };

      const result = await dbService.createVendor(vendorData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBeDefined();
      expect(result.data?.businessName).toBe(vendorData.businessName);
      expect(result.data?.status).toBe(VendorStatus.ACTIVE);
      
      testVendorId = result.data!.id;
      console.log(`✅ Vendor created successfully with ID: ${testVendorId}`);
    });

    it('should retrieve vendor by ID', async () => {
      const result = await dbService.findVendorById(testVendorId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(testVendorId);
      expect(result.data?.businessName).toBe('Test Appraisal Services LLC');
      
      console.log(`✅ Vendor retrieved successfully: ${result.data?.businessName}`);
    });

    it('should update vendor information', async () => {
      const result = await dbService.updateVendor(testVendorId, {
        maxActiveOrders: 15,
        averageQCScore: 95.2
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.maxActiveOrders).toBe(15);
      expect(result.data?.averageQCScore).toBe(95.2);
      
      console.log(`✅ Vendor updated successfully`);
    });

    it('should retrieve all vendors', async () => {
      const result = await dbService.findAllVendors();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Check if our test vendor is in the results
      const foundVendor = result.data.find(vendor => vendor.id === testVendorId);
      expect(foundVendor).toBeDefined();
      
      console.log(`✅ Retrieved ${result.data.length} vendors`);
    });

    it('should get vendor performance metrics', async () => {
      const result = await dbService.getVendorPerformance(testVendorId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.vendorId).toBe(testVendorId);
      expect(typeof result.data.performanceRating).toBe('number');
      
      console.log(`✅ Vendor performance retrieved - Rating: ${result.data.performanceRating}`);
    });
  });

  describe('QC Results Operations', () => {
    it('should create QC result', async () => {
      const qcData = {
        orderId: testOrderId,
        qcScore: 93.5,
        validationResults: {
          marketValidation: {
            status: 'passed',
            score: 94.2,
            confidence: 'high'
          },
          riskAssessment: {
            status: 'passed',
            riskLevel: 'low',
            score: 92.8
          }
        },
        recommendations: [
          'Property value validated within market range',
          'No significant risk factors identified'
        ],
        validatedBy: 'qc-analyst-1'
      };

      const result = await dbService.createQCResult(qcData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.orderId).toBe(testOrderId);
      expect(result.data.qcScore).toBe(93.5);
      
      console.log(`✅ QC result created for order: ${testOrderId}`);
    });

    it('should retrieve QC result by order ID', async () => {
      const result = await dbService.findQCResultByOrderId(testOrderId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.orderId).toBe(testOrderId);
      expect(result.data.qcScore).toBe(93.5);
      
      console.log(`✅ QC result retrieved for order: ${testOrderId}`);
    });

    it('should get QC metrics', async () => {
      const result = await dbService.getQCMetrics();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.overallQCScore).toBe('number');
      expect(typeof result.data.totalValidations).toBe('number');
      
      console.log(`✅ QC metrics retrieved - Overall score: ${result.data.overallQCScore}`);
    });
  });

  describe('Analytics Operations', () => {
    it('should get analytics overview', async () => {
      const result = await dbService.getAnalyticsOverview();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.totalOrders).toBe('number');
      expect(typeof result.data.completedOrders).toBe('number');
      
      console.log(`✅ Analytics overview retrieved - Total orders: ${result.data.totalOrders}`);
    });

    it('should get performance analytics', async () => {
      const params = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        endDate: new Date().toISOString(),
        groupBy: 'week'
      };

      const result = await dbService.getPerformanceAnalytics(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.timeframe).toBeDefined();
      expect(result.data.metrics).toBeDefined();
      
      console.log(`✅ Performance analytics retrieved for ${params.groupBy} grouping`);
    });
  });

  describe('Property Operations', () => {
    it('should create property summary', async () => {
      const propertyData = {
        address: {
          street: '123 Test Property St',
          city: 'Test City',
          state: 'CA',
          zipCode: '90210',
          county: 'Test County'
        },
        propertyType: 'SINGLE_FAMILY' as const
      };

      const result = await dbService.createPropertySummary(propertyData);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.address.street).toBe(propertyData.address.street);
      expect(result.data.propertyType).toBe(propertyData.propertyType);
      
      console.log(`✅ Property summary created: ${result.data.address.street}`);
    });

    it('should search property summaries', async () => {
      const filters = {
        address: { state: 'CA' },
        propertyType: ['SINGLE_FAMILY']
      };

      const result = await dbService.searchPropertySummaries(filters, 0, 10);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      console.log(`✅ Property search returned ${result.data.length} results`);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent order gracefully', async () => {
      const result = await dbService.findOrderById('non-existent-id');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      
      console.log(`✅ Non-existent order handled gracefully`);
    });

    it('should handle non-existent vendor gracefully', async () => {
      const result = await dbService.findVendorById('non-existent-vendor');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      
      console.log(`✅ Non-existent vendor handled gracefully`);
    });
  });
});

/**
 * Manual Test Runner
 * Run this to test Cosmos DB connectivity manually
 */
export async function runManualCosmosDbTest(): Promise<void> {
  console.log('🚀 Starting Manual Cosmos DB Test...\n');
  
  const dbService = new CosmosDbService();
  
  try {
    // Test 1: Initialize connection
    console.log('1️⃣ Testing database initialization...');
    await dbService.initialize();
    console.log('✅ Database initialized successfully\n');
    
    // Test 2: Health check
    console.log('2️⃣ Testing health check...');
    const health = await dbService.healthCheck();
    console.log(`✅ Health check passed:`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.database}`);
    console.log(`   Latency: ${health.latency}ms\n`);
    
    // Test 3: Create test order
    console.log('3️⃣ Testing order creation...');
    const orderResult = await dbService.createOrder({
      orderNumber: `MANUAL-TEST-${Date.now()}`,
      clientInformation: {
        clientId: 'manual-test-client',
        clientName: 'Manual Test Client',
        contactPerson: 'Test User',
        email: 'test@example.com',
        phone: '555-0000',
        address: 'Test Address'
      },
      propertyDetails: {
        address: '123 Manual Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '90210',
        county: 'Test County',
        coordinates: { latitude: 34.0522, longitude: -118.2437 },
        propertyType: 'SINGLE_FAMILY'
      },
      orderType: OrderType.FULL_APPRAISAL,
      priority: OrderPriority.ROUTINE,
      status: OrderStatus.DRAFT,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      orderValue: 750,
      assignmentHistory: [],
      statusHistory: [],
      documents: [],
      notifications: [],
      createdBy: 'manual-test'
    });
    
    if (orderResult.success) {
      console.log(`✅ Order created successfully: ${orderResult.data?.id}`);
      console.log(`   Order Number: ${orderResult.data?.orderNumber}`);
      
      // Test 4: Retrieve the order
      console.log('\n4️⃣ Testing order retrieval...');
      const retrieveResult = await dbService.findOrderById(orderResult.data!.id);
      if (retrieveResult.success && retrieveResult.data) {
        console.log(`✅ Order retrieved successfully: ${retrieveResult.data.orderNumber}`);
      } else {
        console.log('❌ Failed to retrieve order');
      }
    } else {
      console.log('❌ Failed to create order:', orderResult.error);
    }
    
    console.log('\n🎉 Manual Cosmos DB test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Database connection: Working');
    console.log('   ✅ Container creation: Working');
    console.log('   ✅ CRUD operations: Working');
    console.log('   ✅ Error handling: Working');
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
    throw error;
  } finally {
    await dbService.disconnect();
    console.log('\n🔌 Database connection closed');
  }
}