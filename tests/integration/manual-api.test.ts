/**
 * Simple Production API Manual Tests
 * Direct endpoint testing for the production API
 */

import { describe, it, expect } from 'vitest';
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

describe.skip('Production API Manual Tests', () => {
  let testOrderId: string;
  let testVendorId: string;

  describe('API Health Tests', () => {
    it('should return API health status', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBeDefined();
      
      console.log('✅ API health check passed:', data);
    });

    it('should return comprehensive API information', async () => {
      const response = await fetch(`${API_BASE_URL}/api`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Appraisal Management API');
      expect(data.orderManagement).toBeDefined();
      expect(data.vendorManagement).toBeDefined();
      expect(data.propertyIntelligence).toBeDefined();
      
      console.log('✅ API info endpoint validated');
      console.log('Available endpoints:', Object.keys(data));
    });
  });

  describe('Order Management Tests', () => {
    it('should create a new appraisal order', async () => {
      const orderData = {
        clientId: `test-client-${Date.now()}`,
        orderNumber: `TEST-ORDER-${Date.now()}`,
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
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        rushOrder: false,
        borrowerInformation: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '555-0123'
        },
        loanInformation: {
          loanAmount: 800000,
          loanType: 'conventional',
          loanPurpose: 'purchase'
        },
        contactInformation: {
          lenderName: 'Test Bank',
          lenderContact: 'Jane Smith',
          lenderEmail: 'jane@testbank.com',
          lenderPhone: '555-0456'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        tags: ['integration-test', 'production-api-test'],
        metadata: {
          testOrder: true,
          source: 'integration-test'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.orderNumber).toBe(orderData.orderNumber);

      testOrderId = result.data.id;
      
      console.log(`✅ Created order with ID: ${testOrderId}`);
      console.log('Order details:', {
        id: result.data.id,
        orderNumber: result.data.orderNumber,
        property: result.data.propertyAddress.streetAddress,
        status: result.data.status
      });
    }, 10000);

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testOrderId);
      expect(result.data.propertyAddress.city).toBe('Mountain View');

      console.log(`✅ Retrieved order: ${result.data.orderNumber}`);
      console.log('Retrieved data matches expected values');
    });

    it('should update the order status', async () => {
      expect(testOrderId).toBeDefined();

      const updateData = {
        status: OrderStatus.IN_PROGRESS,
        assignedVendorId: 'test-vendor-123',
        notes: 'Order updated via integration test'
      };

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(OrderStatus.IN_PROGRESS);

      console.log(`✅ Updated order status to: ${result.data.status}`);
    });

    it('should list orders with filters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Found ${result.data.length} orders with status 'in_progress'`);
      
      // Check if our test order is in the list
      const testOrder = result.data.find((order: any) => order.id === testOrderId);
      if (testOrder) {
        console.log('✅ Test order found in filtered list');
      }
    });
  });

  describe('Vendor Management Tests', () => {
    it('should create a new vendor', async () => {
      const vendorData = {
        companyName: 'Test Appraisal Services',
        contactPerson: {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@testappraisal.com',
          phone: '555-0789'
        },
        businessAddress: {
          streetAddress: '123 Business Ave',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105'
        },
        licenseInformation: {
          licenseNumber: 'CA-APP-12345',
          licenseState: 'CA',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        },
        serviceAreas: [
          {
            state: 'CA',
            counties: ['Santa Clara', 'San Mateo', 'Alameda'],
            zipCodes: ['94043', '94301', '94107']
          }
        ],
        specialties: ['single_family', 'condominiums', 'luxury_properties'],
        certifications: [
          {
            type: 'Certified Residential Appraiser',
            number: 'CRA-67890',
            issuingBody: 'California Bureau of Real Estate Appraisers',
            expirationDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
          }
        ],
        status: VendorStatus.ACTIVE,
        onboardingDate: new Date(),
        metadata: {
          testVendor: true,
          source: 'integration-test'
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vendorData)
      });

      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.companyName).toBe('Test Appraisal Services');

      testVendorId = result.data.id;
      
      console.log(`✅ Created vendor with ID: ${testVendorId}`);
      console.log('Vendor details:', {
        id: result.data.id,
        companyName: result.data.companyName,
        contactEmail: result.data.contactPerson.email,
        status: result.data.status
      });
    });

    it('should retrieve the created vendor by ID', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testVendorId);
      expect(result.data.companyName).toBe('Test Appraisal Services');

      console.log(`✅ Retrieved vendor: ${result.data.companyName}`);
    });

    it('should list all vendors', async () => {
      const response = await fetch(`${API_BASE_URL}/api/vendors?limit=10`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Found ${result.data.length} total vendors`);
      
      // Check if our test vendor is in the list
      const testVendor = result.data.find((vendor: any) => vendor.id === testVendorId);
      if (testVendor) {
        console.log('✅ Test vendor found in vendor list');
      }
    });
  });

  describe('Property Intelligence Tests', () => {
    it('should check property intelligence health', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();

      console.log('✅ Property intelligence health check passed');
      console.log('Available services:', Object.keys(result.services));
    });

    it('should geocode an address', async () => {
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

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Geocoded address successfully`);
      console.log('Geocoding results:', result.data.length > 0 ? result.data[0] : 'No results');
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

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log(`✅ Comprehensive property analysis completed`);
      console.log('Analysis included:', Object.keys(result.data));
    });
  });

  describe('End-to-End Workflow', () => {
    it('should simulate complete appraisal workflow', async () => {
      console.log('\n=== Simulating Complete Appraisal Workflow ===');
      
      // Step 1: Verify we have test data
      expect(testOrderId).toBeDefined();
      expect(testVendorId).toBeDefined();
      console.log('Step 1: ✅ Test order and vendor available');
      
      // Step 2: Assign vendor to order
      console.log('Step 2: Assigning vendor to order...');
      const assignmentData = {
        assignedVendorId: testVendorId,
        status: OrderStatus.ASSIGNED,
        assignmentDate: new Date(),
        notes: 'Vendor assigned via integration test workflow'
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
      console.log('Step 2: ✅ Vendor assigned successfully');
      
      // Step 3: Analyze property
      console.log('Step 3: Analyzing property intelligence...');
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
      console.log('Step 3: ✅ Property analysis completed');
      
      // Step 4: Complete the order
      console.log('Step 4: Completing appraisal order...');
      const completionData = {
        status: OrderStatus.COMPLETED,
        completionDate: new Date(),
        finalValue: 850000,
        notes: 'Appraisal completed via integration test workflow'
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
      console.log('Step 4: ✅ Order completed successfully');
      
      console.log('✅ Complete appraisal workflow simulation successful!');
      console.log('=== Workflow Complete ===\n');
    });
  });
});