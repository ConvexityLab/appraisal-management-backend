/**
 * Production API Integration Tests
 * Comprehensive tests for the complete appraisal management workflow
 * Tests order management, vendor management, and property intelligence APIs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
const TEST_TIMEOUT = 30000;

describe('Production API Integration Tests', () => {
  let testOrderId: string;
  let testVendorId: string;
  let authToken: string;

  beforeAll(async () => {
    console.log('🧪 Setting up production API integration tests...');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    
    // Wait for server to be ready
    await waitForServer();
    
    // Authenticate for protected endpoints
    authToken = await authenticateUser();
    
    console.log('✅ Test environment ready');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('🧹 Cleaning up integration tests...');
    
    // Clean up test data
    if (testOrderId) {
      await cleanupTestOrder(testOrderId);
    }
    
    if (testVendorId) {
      await cleanupTestVendor(testVendorId);
    }
    
    console.log('✅ Test cleanup complete');
  });

  describe('API Health and Status', () => {
    it('should return API health status', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBeDefined();
      
      console.log('✅ API health check passed');
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
    });
  });

  describe('Order Management Workflow', () => {
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
      expect(result.data.propertyAddress.streetAddress).toBe('1600 Amphitheatre Parkway');

      testOrderId = result.data.id;
      
      console.log(`✅ Created order with ID: ${testOrderId}`);
    }, TEST_TIMEOUT);

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testOrderId);
      expect(result.data.propertyAddress.city).toBe('Mountain View');
      expect(result.data.status).toBe(OrderStatus.NEW);
      
      console.log(`✅ Retrieved order: ${result.data.orderNumber}`);
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
      expect(result.data.assignedVendorId).toBe('test-vendor-123');
      
      console.log(`✅ Updated order status to: ${result.data.status}`);
    });

    it('should list orders with filters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata).toBeDefined();

      // Should include our test order
      const testOrder = result.data.find((order: any) => order.id === testOrderId);
      expect(testOrder).toBeDefined();
      expect(testOrder.status).toBe(OrderStatus.IN_PROGRESS);
      
      console.log(`✅ Found ${result.data.length} orders with status 'in_progress'`);
    });
  });

  describe('Vendor Management Workflow', () => {
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
      expect(result.data.status).toBe(VendorStatus.ACTIVE);

      testVendorId = result.data.id;
      
      console.log(`✅ Created vendor with ID: ${testVendorId}`);
    });

    it('should retrieve the created vendor by ID', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testVendorId);
      expect(result.data.companyName).toBe('Test Appraisal Services');
      expect(result.data.licenseInformation.licenseState).toBe('CA');
      
      console.log(`✅ Retrieved vendor: ${result.data.companyName}`);
    });

    it('should update vendor information', async () => {
      expect(testVendorId).toBeDefined();

      const updateData = {
        contactPerson: {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice.johnson@testappraisal.com', // Updated email
          phone: '555-0789'
        },
        businessAddress: {
          streetAddress: '456 Updated Street', // Updated address
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105'
        },
        notes: 'Updated via integration test'
      };

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.contactPerson.email).toBe('alice.johnson@testappraisal.com');
      expect(result.data.businessAddress.streetAddress).toBe('456 Updated Street');
      
      console.log(`✅ Updated vendor information`);
    });

    it('should get vendor performance metrics', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}/performance`);
      const result = await response.json();

      // Note: This might return empty performance data for a new vendor
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      
      console.log(`✅ Retrieved vendor performance data`);
    });

    it('should list all vendors', async () => {
      const response = await fetch(`${API_BASE_URL}/api/vendors?limit=10`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // Should include our test vendor
      const testVendor = result.data.find((vendor: any) => vendor.id === testVendorId);
      expect(testVendor).toBeDefined();
      
      console.log(`✅ Found ${result.data.length} total vendors`);
    });
  });

  describe('Property Intelligence Workflow', () => {
    it('should check property intelligence health', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();
      
      console.log('✅ Property intelligence health check passed');
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
      
      if (result.data.length > 0) {
        expect(result.data[0].coordinates).toBeDefined();
        expect(result.data[0].formattedAddress).toBeDefined();
      }
      
      console.log(`✅ Geocoded address successfully`);
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
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should simulate complete appraisal workflow', async () => {
      console.log('\n=== Simulating Complete Appraisal Workflow ===');
      
      // Step 1: Create order
      console.log('Step 1: Creating new appraisal order...');
      expect(testOrderId).toBeDefined();
      
      // Step 2: Assign vendor
      console.log('Step 2: Assigning vendor to order...');
      expect(testVendorId).toBeDefined();
      
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

      const assignResult = await assignResponse.json();
      expect(assignResponse.status).toBe(200);
      expect(assignResult.data.assignedVendorId).toBe(testVendorId);
      
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
      
      // Step 4: Update order to completed
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

      const completionResult = await completionResponse.json();
      expect(completionResponse.status).toBe(200);
      expect(completionResult.data.status).toBe(OrderStatus.COMPLETED);
      
      console.log('✅ Complete appraisal workflow simulation successful!');
      console.log('=== Workflow Complete ===\n');
    });
  });
});

// Helper functions
async function waitForServer(): Promise<void> {
  const maxAttempts = 10;
  const delay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        console.log('✅ Server is ready');
        return;
      }
    } catch (error) {
      console.log(`🔄 Waiting for server... (attempt ${attempt}/${maxAttempts})`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Server did not become available within the timeout period');
}

async function authenticateUser(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'demo@appraisal.com',
        password: 'demo123'
      })
    });

    const result = await response.json();
    if (result.success && result.token) {
      console.log('✅ Authentication successful');
      return result.token;
    }
  } catch (error) {
    console.log('⚠️ Authentication failed, proceeding without token');
  }
  
  return '';
}

async function cleanupTestOrder(orderId: string): Promise<void> {
  try {
    // For cleanup, we need to get the order first to get the clientId
    const getResponse = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
    if (getResponse.ok) {
      const getResult = await getResponse.json();
      const clientId = getResult.data.clientId;
      
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}?clientId=${clientId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`✅ Cleaned up test order: ${orderId}`);
      }
    }
  } catch (error) {
    console.log(`⚠️ Failed to cleanup test order: ${error}`);
  }
}

async function cleanupTestVendor(vendorId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vendors/${vendorId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      console.log(`✅ Cleaned up test vendor: ${vendorId}`);
    }
  } catch (error) {
    console.log(`⚠️ Failed to cleanup test vendor: ${error}`);
  }
}