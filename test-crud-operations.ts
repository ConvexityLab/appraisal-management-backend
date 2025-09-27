/**
 * Comprehensive CRUD Operations Test Runner
 * Tests all fundamental entity management functionality without external dependencies
 */

import { PropertyManagementService } from './src/services/property-management.service.js';
import { VendorManagementService } from './src/services/vendor-management.service.js';
import { OrderManagementService } from './src/services/order-management.service.js';
import { DatabaseService } from './src/services/enhanced-database.service.js';
import { NotificationService } from './src/services/notification.service.js';
import { AuditService } from './src/services/audit.service.js';
import { Logger } from './src/utils/logger.js';
import { 
  PropertyType, 
  PropertyCondition, 
  OrderStatus, 
  Priority, 
  ProductType, 
  OrderType, 
  VendorStatus,
  OccupancyType,
  ViewType,
  ConstructionType
} from '../src/types/index.js';

/**
 * Test suite runner with comprehensive CRUD validation
 */
class CrudTestRunner {
  private propertyService: PropertyManagementService;
  private vendorService: VendorManagementService;
  private orderService: OrderManagementService;
  private databaseService: DatabaseService;
  private logger: Logger;
  private testResults: { name: string; passed: boolean; error?: string }[];

  constructor() {
    this.logger = new Logger();
    this.testResults = [];
    
    // Initialize services
    this.databaseService = new DatabaseService();
    this.propertyService = new PropertyManagementService();
    this.vendorService = new VendorManagementService(this.databaseService);
    
    const notificationService = new NotificationService();
    const auditService = new AuditService();
    
    this.orderService = new OrderManagementService(
      this.databaseService,
      this.vendorService,
      notificationService,
      auditService,
      this.logger
    );
  }

  /**
   * Run all CRUD tests
   */
  async runAllTests(): Promise<void> {
    this.logger.info('🚀 Starting Comprehensive CRUD Test Suite');
    console.log('\n='.repeat(70));
    console.log('🏗️  COMPREHENSIVE CRUD OPERATIONS TEST SUITE');
    console.log('='.repeat(70));

    try {
      await this.runPropertyTests();
      await this.runVendorTests();
      await this.runOrderTests();
      await this.runIntegrationTests();
      
      this.printResults();
      
    } catch (error) {
      this.logger.error('Test suite failed', { error });
      console.error('❌ Test suite failed:', error);
    }
  }

  /**
   * Property Management Tests
   */
  private async runPropertyTests(): Promise<void> {
    console.log('\n🏠 Property Management Tests');
    console.log('-'.repeat(40));

    const samplePropertyData = {
      address: {
        streetAddress: '456 Test Avenue',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94103',
        county: 'San Francisco',
        coordinates: {
          latitude: 37.7849,
          longitude: -122.4094
        }
      },
      details: {
        propertyType: PropertyType.SFR,
        occupancy: OccupancyType.OWNER_OCCUPIED,
        yearBuilt: 2020,
        grossLivingArea: 2800,
        lotSize: 7000,
        bedrooms: 4,
        bathrooms: 3.5,
        stories: 2,
        garage: true,
        pool: true,
        features: ['modern kitchen', 'hardwood floors', 'solar panels'],
        condition: PropertyCondition.EXCELLENT,
        viewType: ViewType.WATER,
        constructionType: ConstructionType.FRAME
      },
      metadata: {
        notes: 'Test property for CRUD validation'
      }
    };

    // Test 1: Create Property
    await this.runTest('Create Property', async () => {
      const result = await this.propertyService.createProperty(samplePropertyData);
      
      if (!result.propertyId) {
        throw new Error('Property ID not returned');
      }
      
      if (result.address.streetAddress !== samplePropertyData.address.streetAddress) {
        throw new Error('Address not saved correctly');
      }
      
      return result.propertyId;
    });

    // Test 2: Retrieve Property
    await this.runTest('Retrieve Property', async () => {
      // First create a property
      const createResult = await this.propertyService.createProperty(samplePropertyData);
      const propertyId = createResult.propertyId;
      
      const property = await this.propertyService.getPropertyById(propertyId);
      
      if (!property) {
        throw new Error('Property not found');
      }
      
      if (property.address.streetAddress !== samplePropertyData.address.streetAddress) {
        throw new Error('Retrieved property data incorrect');
      }
      
      return propertyId;
    });

    // Test 3: Update Property
    await this.runTest('Update Property', async () => {
      const createResult = await this.propertyService.createProperty(samplePropertyData);
      const propertyId = createResult.propertyId;
      
      const updates = {
        details: {
          yearBuilt: 2021,
          features: ['updated kitchen', 'new flooring']
        }
      };
      
      const updatedProperty = await this.propertyService.updateProperty(propertyId, updates);
      
      if (updatedProperty.details.yearBuilt !== 2021) {
        throw new Error('Property not updated correctly');
      }
      
      return propertyId;
    });

    // Test 4: Search Properties
    await this.runTest('Search Properties', async () => {
      // Create multiple properties
      const property1 = {
        ...samplePropertyData,
        address: { ...samplePropertyData.address, city: 'Oakland' }
      };
      
      await this.propertyService.createProperty(property1);
      
      const searchResults = await this.propertyService.searchProperties({
        address: { city: 'Oakland' }
      });
      
      if (searchResults.properties.length === 0) {
        throw new Error('Search returned no results');
      }
      
      const foundProperty = searchResults.properties.find(p => p.address.city === 'Oakland');
      if (!foundProperty) {
        throw new Error('Expected property not found in search results');
      }
      
      return searchResults.total;
    });

    // Test 5: Delete Property
    await this.runTest('Delete Property', async () => {
      const createResult = await this.propertyService.createProperty(samplePropertyData);
      const propertyId = createResult.propertyId;
      
      const deleted = await this.propertyService.deleteProperty(propertyId);
      
      if (!deleted) {
        throw new Error('Property deletion failed');
      }
      
      // Try to retrieve deleted property - should fail
      try {
        await this.propertyService.getPropertyById(propertyId);
        throw new Error('Deleted property still accessible');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return true; // Expected behavior
        }
        throw error;
      }
    });

    // Test 6: Property Analytics
    await this.runTest('Property Analytics', async () => {
      const createResult = await this.propertyService.createProperty(samplePropertyData);
      const propertyId = createResult.propertyId;
      
      const analytics = await this.propertyService.getPropertyAnalytics(propertyId);
      
      if (!analytics.propertyOverview) {
        throw new Error('Analytics missing property overview');
      }
      
      if (!analytics.performanceMetrics) {
        throw new Error('Analytics missing performance metrics');
      }
      
      return propertyId;
    });

    console.log('✅ Property tests completed');
  }

  /**
   * Vendor Management Tests
   */
  private async runVendorTests(): Promise<void> {
    console.log('\n👤 Vendor Management Tests');
    console.log('-'.repeat(40));

    const sampleVendorData = {
      name: 'Test Appraisal Services',
      email: 'test@appraisal.com',
      phone: '555-TEST',
      licenseNumber: 'TEST-12345',
      licenseState: 'CA',
      licenseExpiry: new Date('2025-12-31'),
      certifications: [],
      serviceAreas: [],
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
      specialties: [],
      bankingInfo: {
        accountName: 'Test Appraisal Services',
        routingNumber: '123456789',
        accountNumber: '987654321'
      },
      insuranceInfo: {
        provider: 'Test Insurance Co',
        policyNumber: 'TEST-POL-123',
        coverage: 1000000,
        expiryDate: new Date('2025-06-30'),
        status: 'active' as const
      },
      paymentInfo: {
        method: 'ach' as const,
        bankName: 'Test Bank',
        accountNumber: '987654321',
        routingNumber: '123456789'
      },
      preferences: {
        orderTypes: [OrderType.PURCHASE],
        productTypes: [ProductType.FULL_APPRAISAL],
        maxOrdersPerDay: 3,
        workingHours: { start: '09:00', end: '17:00' },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        notificationPreferences: {
          email: true,
          sms: false,
          portal: true
        }
      }
    };

    // Test 1: Create Vendor
    await this.runTest('Create Vendor', async () => {
      const result = await this.vendorService.createVendor(sampleVendorData);
      
      if (!result.id) {
        throw new Error('Vendor ID not returned');
      }
      
      if (result.name !== sampleVendorData.name) {
        throw new Error('Vendor name not saved correctly');
      }
      
      return result.id;
    });

    // Test 2: Retrieve Vendor
    await this.runTest('Retrieve Vendor', async () => {
      const createResult = await this.vendorService.createVendor(sampleVendorData);
      const vendorId = createResult.id;
      
      const vendor = await this.vendorService.getVendorById(vendorId);
      
      if (!vendor) {
        throw new Error('Vendor not found');
      }
      
      if (vendor.name !== sampleVendorData.name) {
        throw new Error('Retrieved vendor data incorrect');
      }
      
      return vendorId;
    });

    // Test 3: Update Vendor
    await this.runTest('Update Vendor', async () => {
      const createResult = await this.vendorService.createVendor(sampleVendorData);
      const vendorId = createResult.id;
      
      const updates = {
        phone: '555-UPDATED',
        preferences: {
          ...sampleVendorData.preferences,
          maxOrdersPerDay: 10
        }
      };
      
      const updatedVendor = await this.vendorService.updateVendor(vendorId, updates);
      
      if (updatedVendor.phone !== '555-UPDATED') {
        throw new Error('Vendor not updated correctly');
      }
      
      return vendorId;
    });

    // Test 4: List Vendors
    await this.runTest('List Vendors', async () => {
      // Create multiple vendors
      const vendor1 = { ...sampleVendorData, name: 'Vendor A', licenseState: 'CA' };
      const vendor2 = { ...sampleVendorData, name: 'Vendor B', licenseState: 'TX' };
      
      await this.vendorService.createVendor(vendor1);
      await this.vendorService.createVendor(vendor2);
      
      const results = await this.vendorService.listVendors({
        licenseState: 'CA',
        limit: 10,
        offset: 0
      });
      
      if (results.vendors.length === 0) {
        throw new Error('List returned no vendors');
      }
      
      return results.total;
    });

    // Test 5: Search Vendors
    await this.runTest('Search Vendors', async () => {
      await this.vendorService.createVendor(sampleVendorData);
      
      const searchResults = await this.vendorService.searchVendors({
        name: 'Test Appraisal',
        licenseState: 'CA'
      });
      
      if (searchResults.vendors.length === 0) {
        throw new Error('Search returned no results');
      }
      
      return searchResults.vendors.length;
    });

    console.log('✅ Vendor tests completed');
  }

  /**
   * Order Management Tests
   */
  private async runOrderTests(): Promise<void> {
    console.log('\n📋 Order Management Tests');
    console.log('-'.repeat(40));

    const sampleOrderData = {
      clientId: 'test-client-001',
      orderNumber: 'TEST-ORDER-001',
      propertyAddress: {
        streetAddress: '789 Order Test Street',
        city: 'San Jose',
        state: 'CA',
        zipCode: '95123',
        county: 'Santa Clara'
      },
      propertyDetails: {
        propertyType: PropertyType.SFR,
        occupancy: OccupancyType.OWNER_OCCUPIED,
        yearBuilt: 2015,
        grossLivingArea: 2200,
        bedrooms: 3,
        bathrooms: 2,
        features: ['updated kitchen', 'hardwood floors']
      },
      orderType: OrderType.PURCHASE,
      productType: ProductType.FULL_APPRAISAL,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      rushOrder: false,
      borrowerInformation: {
        firstName: 'Test',
        lastName: 'Borrower',
        email: 'test.borrower@email.com',
        phone: '555-BORR'
      },
      loanInformation: {
        loanAmount: 500000,
        loanType: 'Conventional' as any,
        loanPurpose: 'Purchase' as any,
        contractPrice: 650000
      },
      contactInformation: {
        name: 'Test Loan Officer',
        role: 'loan_officer' as any,
        email: 'test.lo@lender.com',
        phone: '555-LOAN',
        preferredMethod: 'email' as any
      },
      priority: Priority.NORMAL,
      specialInstructions: 'Test order for CRUD validation',
      status: OrderStatus.NEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-system',
      tags: ['test'],
      metadata: {}
    };

    // Test 1: Create Order
    await this.runTest('Create Order', async () => {
      const result = await this.orderService.createOrder(sampleOrderData);
      
      if (!result.id) {
        throw new Error('Order ID not returned');
      }
      
      if (result.orderNumber !== sampleOrderData.orderNumber) {
        throw new Error('Order number not saved correctly');
      }
      
      if (result.status !== OrderStatus.NEW) {
        throw new Error('Order status not set correctly');
      }
      
      return result.id;
    });

    // Test 2: Retrieve Order
    await this.runTest('Retrieve Order', async () => {
      const createResult = await this.orderService.createOrder(sampleOrderData);
      const orderId = createResult.id;
      
      const order = await this.orderService.getOrderById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.orderNumber !== sampleOrderData.orderNumber) {
        throw new Error('Retrieved order data incorrect');
      }
      
      return orderId;
    });

    // Test 3: Update Order
    await this.runTest('Update Order', async () => {
      const createResult = await this.orderService.createOrder(sampleOrderData);
      const orderId = createResult.id;
      
      const updates = {
        status: OrderStatus.IN_PROGRESS,
        specialInstructions: 'Updated instructions'
      };
      
      const updatedOrder = await this.orderService.updateOrder(orderId, updates);
      
      if (updatedOrder.status !== OrderStatus.IN_PROGRESS) {
        throw new Error('Order not updated correctly');
      }
      
      return orderId;
    });

    // Test 4: List Orders
    await this.runTest('List Orders', async () => {
      // Create multiple orders
      const order1 = { ...sampleOrderData, orderNumber: 'ORDER-001', priority: Priority.HIGH };
      const order2 = { ...sampleOrderData, orderNumber: 'ORDER-002', priority: Priority.NORMAL };
      
      await this.orderService.createOrder(order1);
      await this.orderService.createOrder(order2);
      
      const results = await this.orderService.getOrders({
        priority: [Priority.HIGH],
        limit: 10,
        offset: 0
      });
      
      if (results.orders.length === 0) {
        throw new Error('List returned no orders');
      }
      
      return results.total;
    });

    console.log('✅ Order tests completed');
  }

  /**
   * Integration Tests
   */
  private async runIntegrationTests(): Promise<void> {
    console.log('\n🔗 Integration Tests');
    console.log('-'.repeat(40));

    // Test: Complete workflow
    await this.runTest('Complete Workflow Integration', async () => {
      // 1. Create property
      const propertyData = {
        address: {
          streetAddress: '123 Integration Test St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94101',
          county: 'San Francisco'
        },
        details: {
          propertyType: PropertyType.SFR,
          occupancy: OccupancyType.OWNER_OCCUPIED,
          yearBuilt: 2020,
          grossLivingArea: 2500,
          bedrooms: 3,
          bathrooms: 2,
          features: ['modern kitchen']
        }
      };

      const propertyResult = await this.propertyService.createProperty(propertyData);
      if (!propertyResult.propertyId) {
        throw new Error('Property creation failed');
      }

      // 2. Create vendor
      const vendorData = {
        name: 'Integration Test Vendor',
        email: 'integration@test.com',
        phone: '555-INTEG',
        licenseNumber: 'INTEG-123',
        licenseState: 'CA',
        licenseExpiry: new Date('2025-12-31'),
        productTypes: [ProductType.FULL_APPRAISAL],
        preferences: {
          orderTypes: [OrderType.PURCHASE],
          productTypes: [ProductType.FULL_APPRAISAL],
          maxOrdersPerDay: 5,
          workingHours: { start: '08:00', end: '18:00' },
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          notificationPreferences: { email: true, sms: false, portal: true }
        }
      };

      const vendorResult = await this.vendorService.createVendor(vendorData);
      if (!vendorResult.id) {
        throw new Error('Vendor creation failed');
      }

      // 3. Create order
      const orderData = {
        clientId: 'integration-client-001',
        orderNumber: 'INTEG-ORDER-001',
        propertyAddress: propertyData.address,
        propertyDetails: propertyData.details,
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        rushOrder: false,
        borrowerInformation: {
          firstName: 'Integration',
          lastName: 'Test',
          email: 'integration@test.com',
          phone: '555-TEST'
        },
        loanInformation: {
          loanAmount: 600000,
          loanType: 'Conventional' as any,
          loanPurpose: 'Purchase' as any
        },
        contactInformation: {
          name: 'Integration LO',
          role: 'loan_officer' as any,
          email: 'lo@integration.com',
          phone: '555-LO',
          preferredMethod: 'email' as any
        },
        priority: Priority.NORMAL,
        status: OrderStatus.NEW,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'integration-test',
        tags: ['integration'],
        metadata: {}
      };

      const orderResult = await this.orderService.createOrder(orderData);
      if (!orderResult.id) {
        throw new Error('Order creation failed');
      }

      // 4. Assign vendor to order
      const assignResult = await this.orderService.assignVendor(orderResult.id, vendorResult.id);
      if (assignResult.assignedVendorId !== vendorResult.id) {
        throw new Error('Vendor assignment failed');
      }

      // 5. Update order status
      const statusUpdate = await this.orderService.updateOrder(orderResult.id, {
        status: OrderStatus.IN_PROGRESS
      });

      if (statusUpdate.status !== OrderStatus.IN_PROGRESS) {
        throw new Error('Status update failed');
      }

      return 'Complete workflow successful';
    });

    console.log('✅ Integration tests completed');
  }

  /**
   * Run individual test with error handling
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    try {
      console.log(`  🔍 ${testName}...`);
      const result = await testFn();
      this.testResults.push({ name: testName, passed: true });
      console.log(`  ✅ ${testName} - PASSED`);
      if (result !== undefined && result !== true) {
        console.log(`     Result: ${result}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`  ❌ ${testName} - FAILED: ${errorMessage}`);
    }
  }

  /**
   * Print final test results
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(70));

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    console.log(`\n📈 Overall Results:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults
        .filter(r => !r.passed)
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }

    console.log('\n' + '='.repeat(70));
    
    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! CRUD Operations are working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Review the errors above.');
    }
    
    console.log('='.repeat(70));
  }
}

/**
 * Run the test suite
 */
async function runTests() {
  const testRunner = new CrudTestRunner();
  await testRunner.runAllTests();
}

// Export for use as module or run directly
export { CrudTestRunner };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}