/**
 * Live Production API Integration Tests
 * Tests against the already running production server
 * Run this while the production server is running on port 3000
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType,
  VendorStatus 
} from '../../src/types/index';

// Test configuration
const API_BASE_URL = 'http://localhost:3000';

describe('Live Production API Integration Tests', () => {
  let testOrderId: string;
  let testVendorId: string;

  beforeAll(async () => {
    // Quick connectivity test
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Server not available: ${response.status}`);
      }
      console.log('✅ Connected to production server');
    } catch (error) {
      throw new Error(`❌ Cannot connect to server at ${API_BASE_URL}. Make sure the production server is running.`);
    }
  });

  describe('Order Management Integration', () => {
    it('should create a new order with real database persistence', async () => {
      const orderData = {
        clientId: `test-client-${Date.now()}`,
        orderNumber: `INTEGRATION-${Date.now()}`,
        propertyAddress: {
          streetAddress: '1600 Amphitheatre Parkway',
          city: 'Mountain View',
          state: 'CA',
          zipCode: '94043',
          county: 'Santa Clara'
        },
        propertyDetails: {
          propertyType: PropertyType.SFR,
          occupancy: OccupancyType.OWNER_OCCUPIED,
          features: ['garage', 'pool', 'garden']
        },
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        rushOrder: false,
        borrowerInformation: {
          firstName: 'Integration',
          lastName: 'Test',
          email: 'integration@test.com',
          phone: '555-0123'
        },
        loanInformation: {
          loanAmount: 850000,
          loanType: 'conventional',
          loanPurpose: 'purchase'
        },
        contactInformation: {
          lenderName: 'Integration Test Bank',
          lenderContact: 'Test Manager',
          lenderEmail: 'test@integrationbank.com',
          lenderPhone: '555-0456'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        tags: ['integration-test', 'database-validation'],
        metadata: {
          testOrder: true,
          source: 'integration-test',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.orderNumber).toBe(orderData.orderNumber);
      expect(result.data.propertyAddress.streetAddress).toBe('1600 Amphitheatre Parkway');

      testOrderId = result.data.id;
      
      console.log(`✅ Created order: ${result.data.orderNumber} (ID: ${testOrderId})`);
    });

    it('should retrieve the created order proving database persistence', async () => {
      expect(testOrderId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testOrderId);
      expect(result.data.propertyAddress.city).toBe('Mountain View');
      expect(result.data.borrowerInformation.firstName).toBe('Integration');

      console.log(`✅ Retrieved order from database: ${result.data.orderNumber}`);
    });

    it('should update the order and persist changes', async () => {
      expect(testOrderId).toBeDefined();

      const updateData = {
        status: OrderStatus.IN_PROGRESS,
        notes: 'Updated via integration test - proving database writes work',
        assignedVendorId: 'integration-test-vendor'
      };

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(OrderStatus.IN_PROGRESS);
      expect(result.data.assignedVendorId).toBe('integration-test-vendor');

      console.log(`✅ Updated order status: ${result.data.status}`);
    });

    it('should list orders with filters from real database', async () => {
      const response = await fetch(`${API_BASE_URL}/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // Our test order should be in the results
      const testOrder = result.data.find((order: any) => order.id === testOrderId);
      expect(testOrder).toBeDefined();
      expect(testOrder.status).toBe(OrderStatus.IN_PROGRESS);

      console.log(`✅ Found ${result.data.length} orders in database, including our test order`);
    });
  });

  describe('Vendor Management Integration', () => {
    it('should create a new vendor with real database persistence', async () => {
      const vendorData = {
        companyName: `Integration Test Appraisals ${Date.now()}`,
        contactPerson: {
          firstName: 'Integration',
          lastName: 'Tester',
          email: 'integration@testappraisals.com',
          phone: '555-0789'
        },
        businessAddress: {
          streetAddress: '123 Integration Street',
          city: 'Test City',
          state: 'CA',
          zipCode: '90210'
        },
        licenseInformation: {
          licenseNumber: `INT-${Date.now()}`,
          licenseState: 'CA',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        serviceAreas: [
          {
            state: 'CA',
            counties: ['Santa Clara', 'San Mateo'],
            zipCodes: ['94043', '94301']
          }
        ],
        specialties: ['single_family', 'condominiums'],
        certifications: [
          {
            type: 'Certified Residential Appraiser',
            number: `CRA-INT-${Date.now()}`,
            issuingBody: 'Integration Test Board',
            expirationDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
          }
        ],
        status: VendorStatus.ACTIVE,
        onboardingDate: new Date(),
        metadata: {
          testVendor: true,
          source: 'integration-test',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vendorData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.companyName).toContain('Integration Test Appraisals');

      testVendorId = result.data.id;
      
      console.log(`✅ Created vendor: ${result.data.companyName} (ID: ${testVendorId})`);
    });

    it('should retrieve the created vendor proving database persistence', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testVendorId);
      expect(result.data.contactPerson.firstName).toBe('Integration');
      expect(result.data.businessAddress.city).toBe('Test City');

      console.log(`✅ Retrieved vendor from database: ${result.data.companyName}`);
    });

    it('should list vendors from real database', async () => {
      const response = await fetch(`${API_BASE_URL}/api/vendors?limit=10`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // Our test vendor should be in the results
      const testVendor = result.data.find((vendor: any) => vendor.id === testVendorId);
      expect(testVendor).toBeDefined();

      console.log(`✅ Found ${result.data.length} vendors in database, including our test vendor`);
    });
  });

  describe('Property Intelligence Integration', () => {
    it('should check property intelligence service health', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();

      console.log('✅ Property intelligence service is healthy');
      console.log(`Services available: ${Object.keys(result.services).join(', ')}`);
    });

    it('should geocode an address using property intelligence', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Geocoded address successfully: ${result.data.length} results found`);
    });

    it('should perform comprehensive property analysis', async () => {
      const analysisData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        strategy: 'quality_first'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log(`✅ Comprehensive property analysis completed`);
      console.log(`Analysis components: ${Object.keys(result.data).join(', ')}`);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete full appraisal workflow with database persistence', async () => {
      expect(testOrderId).toBeDefined();
      expect(testVendorId).toBeDefined();

      console.log('\n=== End-to-End Workflow Test ===');
      
      // Step 1: Assign vendor to order
      console.log('Step 1: Assigning vendor to order...');
      const assignmentData = {
        assignedVendorId: testVendorId,
        status: OrderStatus.ASSIGNED,
        assignmentDate: new Date(),
        notes: 'Vendor assigned via end-to-end integration test'
      };

      const assignResponse = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignmentData)
      });

      expect(assignResponse.status).toBe(200);
      const assignResult = await assignResponse.json();
      expect(assignResult.data.assignedVendorId).toBe(testVendorId);
      expect(assignResult.data.status).toBe(OrderStatus.ASSIGNED);
      console.log('✅ Vendor assigned successfully');
      
      // Step 2: Perform property analysis
      console.log('Step 2: Performing property analysis...');
      const propertyAnalysis = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude: 37.4224764,
          longitude: -122.0842499,
          propertyId: testOrderId
        })
      });

      expect(propertyAnalysis.status).toBe(200);
      console.log('✅ Property analysis completed');
      
      // Step 3: Complete the order
      console.log('Step 3: Completing the order...');
      const completionData = {
        status: OrderStatus.COMPLETED,
        completionDate: new Date(),
        finalValue: 875000,
        notes: 'Order completed via end-to-end integration test'
      };

      const completionResponse = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(completionData)
      });

      expect(completionResponse.status).toBe(200);
      const completionResult = await completionResponse.json();
      expect(completionResult.data.status).toBe(OrderStatus.COMPLETED);
      expect(completionResult.data.finalValue).toBe(875000);
      console.log('✅ Order completed successfully');
      
      // Step 4: Verify final state
      console.log('Step 4: Verifying final state...');
      const finalCheck = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`);
      const finalResult = await finalCheck.json();
      
      expect(finalResult.data.status).toBe(OrderStatus.COMPLETED);
      expect(finalResult.data.assignedVendorId).toBe(testVendorId);
      expect(finalResult.data.finalValue).toBe(875000);
      console.log('✅ Final state verified in database');
      
      console.log('🎉 End-to-End Workflow Test PASSED!');
      console.log('=== All database operations successful ===\n');
    });
  });
});