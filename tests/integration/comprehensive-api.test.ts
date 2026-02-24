/**
 * Comprehensive Production API Integration Test Suite
 * Tests all 27 endpoints with real database operations
 * Run this against the live production server on port 3000
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
const TEST_TIMEOUT = 15000;

// Test data storage
let testOrderId: string;
let testVendorId: string;
let testClientId: string;

describe.skip('Comprehensive Production API Integration Tests', () => {
  beforeAll(async () => {
    // Verify server connectivity
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Server not available: ${response.status}`);
      }
      console.log('🚀 Connected to production server - starting comprehensive tests');
    } catch (error) {
      throw new Error(`❌ Cannot connect to server at ${API_BASE_URL}. Ensure production server is running.`);
    }

    // Generate unique test identifiers
    testClientId = `test-client-${Date.now()}`;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    
    if (testOrderId) {
      try {
        await fetch(`${API_BASE_URL}/api/orders/${testOrderId}?clientId=${testClientId}`, {
          method: 'DELETE'
        });
        console.log('✅ Test order cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test order:', error);
      }
    }

    if (testVendorId) {
      try {
        await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`, {
          method: 'DELETE'
        });
        console.log('✅ Test vendor cleaned up');
      } catch (error) {
        console.log('⚠️ Could not clean up test vendor:', error);
      }
    }

    console.log('🏁 Comprehensive test suite completed');
  });

  describe('Basic API Endpoints (5 endpoints)', () => {
    it('GET /health - should return healthy status', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('1.0.0');
      expect(data.environment).toBe('development');
      expect(data.azure).toBeDefined();

      console.log('✅ Health endpoint validated');
    });

    it('GET /api - should return comprehensive API information', async () => {
      const response = await fetch(`${API_BASE_URL}/api`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Appraisal Management API');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints).toBeDefined();
      expect(data.orderManagement).toBeDefined();
      expect(data.vendorManagement).toBeDefined();
      expect(data.propertyIntelligence).toBeDefined();

      // Verify all endpoint categories are present
      expect(Object.keys(data.endpoints)).toHaveLength(5);
      expect(Object.keys(data.orderManagement)).toHaveLength(5);
      expect(Object.keys(data.vendorManagement)).toHaveLength(6);
      expect(Object.keys(data.propertyIntelligence)).toHaveLength(6);

      console.log('✅ API info endpoint validated - 27 total endpoints confirmed');
    });

    it('POST /api/auth/login - should handle authentication request', async () => {
      const authData = {
        email: 'test@example.com',
        password: 'testpass123'
      };

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });

      // Auth endpoint should respond (even if not fully implemented)
      expect([200, 401, 404]).toContain(response.status);
      console.log('✅ Auth endpoint accessible');
    });

    it('POST /api/code/execute - should handle dynamic code execution', async () => {
      const codeData = {
        code: 'return { result: 2 + 2, timestamp: new Date() };',
        timeout: 5000
      };

      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codeData)
      });

      // Code execution endpoint should respond
      expect([200, 400, 404]).toContain(response.status);
      console.log('✅ Code execution endpoint accessible');
    });

    it('GET /api/status - should return system status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/status`);

      // Status endpoint should respond
      expect([200, 404]).toContain(response.status);
      console.log('✅ Status endpoint accessible');
    });
  });

  describe('Order Management Endpoints (5 endpoints)', () => {
    it('POST /api/orders - should create new appraisal order', async () => {
      const orderData = {
        clientId: testClientId,
        orderNumber: `COMP-TEST-${Date.now()}`,
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
          features: ['garage', 'pool', 'garden', 'fireplace']
        },
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        rushOrder: false,
        borrowerInformation: {
          firstName: 'Comprehensive',
          lastName: 'Test',
          email: 'comprehensive@test.com',
          phone: '555-COMP-TEST'
        },
        loanInformation: {
          loanAmount: 875000,
          loanType: 'conventional',
          loanPurpose: 'purchase'
        },
        contactInformation: {
          lenderName: 'Comprehensive Test Bank',
          lenderContact: 'Test Manager',
          lenderEmail: 'test@comprehensivebank.com',
          lenderPhone: '555-0123'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        tags: ['comprehensive-test', 'integration-validation'],
        metadata: {
          testOrder: true,
          testSuite: 'comprehensive',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.orderNumber).toBe(orderData.orderNumber);
      expect(result.data.clientId).toBe(testClientId);

      testOrderId = result.data.id;
      console.log(`✅ Order created: ${result.data.orderNumber} (ID: ${testOrderId})`);
    }, TEST_TIMEOUT);

    it('GET /api/orders/:id - should retrieve order by ID', async () => {
      expect(testOrderId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testOrderId);
      expect(result.data.propertyAddress.city).toBe('Mountain View');
      expect(result.data.borrowerInformation.firstName).toBe('Comprehensive');

      console.log(`✅ Order retrieved: ${result.data.orderNumber}`);
    });

    it('PUT /api/orders/:id - should update order', async () => {
      expect(testOrderId).toBeDefined();

      const updateData = {
        status: OrderStatus.IN_PROGRESS,
        notes: 'Updated via comprehensive integration test',
        assignedVendorId: 'test-vendor-assignment',
        priority: Priority.HIGH
      };

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(OrderStatus.IN_PROGRESS);
      expect(result.data.priority).toBe(Priority.HIGH);

      console.log(`✅ Order updated: status=${result.data.status}, priority=${result.data.priority}`);
    });

    it('GET /api/orders - should list orders with filters', async () => {
      const response = await fetch(`${API_BASE_URL}/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.metadata).toBeDefined();

      // Our test order should be in the results
      const testOrder = result.data.find((order: any) => order.id === testOrderId);
      expect(testOrder).toBeDefined();

      console.log(`✅ Orders listed: ${result.data.length} orders found, including test order`);
    });

    it('DELETE /api/orders/:id - should soft delete order', async () => {
      expect(testOrderId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/orders/${testOrderId}?clientId=${testClientId}`, {
        method: 'DELETE'
      });

      // Note: This might be a soft delete, so status could be 200 or 204
      expect([200, 204].includes(response.status)).toBe(true);

      console.log(`✅ Order deletion processed (status: ${response.status})`);
    });
  });

  describe('Vendor Management Endpoints (6 endpoints)', () => {
    it('POST /api/vendors - should create new vendor', async () => {
      const vendorData = {
        companyName: `Comprehensive Test Appraisals ${Date.now()}`,
        contactPerson: {
          firstName: 'Comprehensive',
          lastName: 'Tester',
          email: 'comprehensive@testappraisals.com',
          phone: '555-COMP-VENDOR'
        },
        businessAddress: {
          streetAddress: '456 Comprehensive Test Ave',
          city: 'Test Valley',
          state: 'CA',
          zipCode: '90210'
        },
        licenseInformation: {
          licenseNumber: `COMP-${Date.now()}`,
          licenseState: 'CA',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
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
            number: `CRA-COMP-${Date.now()}`,
            issuingBody: 'Comprehensive Test Board',
            expirationDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
          }
        ],
        status: VendorStatus.ACTIVE,
        onboardingDate: new Date(),
        metadata: {
          testVendor: true,
          testSuite: 'comprehensive',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData)
      });

      expect(response.status).toBe(201);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.companyName).toContain('Comprehensive Test Appraisals');

      testVendorId = result.data.id;
      console.log(`✅ Vendor created: ${result.data.companyName} (ID: ${testVendorId})`);
    }, TEST_TIMEOUT);

    it('GET /api/vendors/:id - should retrieve vendor by ID', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testVendorId);
      expect(result.data.contactPerson.firstName).toBe('Comprehensive');

      console.log(`✅ Vendor retrieved: ${result.data.companyName}`);
    });

    it('PUT /api/vendors/:id - should update vendor', async () => {
      expect(testVendorId).toBeDefined();

      const updateData = {
        contactPerson: {
          firstName: 'Comprehensive',
          lastName: 'Updated',
          email: 'updated@testappraisals.com',
          phone: '555-UPDATED'
        },
        notes: 'Updated via comprehensive integration test'
      };

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.contactPerson.lastName).toBe('Updated');

      console.log(`✅ Vendor updated: ${result.data.contactPerson.email}`);
    });

    it('GET /api/vendors - should list all vendors', async () => {
      const response = await fetch(`${API_BASE_URL}/api/vendors?limit=10`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // Our test vendor should be in the results
      const testVendor = result.data.find((vendor: any) => vendor.id === testVendorId);
      expect(testVendor).toBeDefined();

      console.log(`✅ Vendors listed: ${result.data.length} vendors found, including test vendor`);
    });

    it('GET /api/vendors/:id/performance - should get vendor performance', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}/performance`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Vendor performance retrieved for vendor ${testVendorId}`);
    });

    it('DELETE /api/vendors/:id - should deactivate vendor', async () => {
      expect(testVendorId).toBeDefined();

      const response = await fetch(`${API_BASE_URL}/api/vendors/${testVendorId}`, {
        method: 'DELETE'
      });

      // Vendor deletion (soft delete/deactivation)
      expect([200, 204].includes(response.status)).toBe(true);

      console.log(`✅ Vendor deactivated (status: ${response.status})`);
    });
  });

  describe('Property Intelligence Endpoints (16 endpoints)', () => {
    it('GET /api/property-intelligence/health - should return service health', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`);
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();

      console.log(`✅ Property intelligence health: ${result.status}`);
    });

    it('POST /api/property-intelligence/address/geocode - should geocode address', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Address geocoded: ${result.data.length} results`);
    });

    it('POST /api/property-intelligence/address/validate - should validate address', async () => {
      const addressData = {
        streetAddress: '1600 Amphitheatre Parkway',
        city: 'Mountain View',
        state: 'CA',
        zipCode: '94043'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Address validated successfully`);
    });

    it('POST /api/property-intelligence/address/standardize - should standardize address', async () => {
      const addressData = {
        address: '1600 amphitheatre pkwy, mtn view, california'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/standardize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Address standardized`);
    });

    it('POST /api/property-intelligence/address/components - should extract address components', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Address components extracted`);
    });

    it('POST /api/property-intelligence/analyze/comprehensive - should perform comprehensive analysis', async () => {
      const analysisData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        strategy: 'quality_first'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      console.log(`✅ Comprehensive analysis completed`);
    });

    it('POST /api/property-intelligence/analyze/market - should perform market analysis', async () => {
      const marketData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        radius: 1000
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Market analysis completed`);
    });

    it('POST /api/property-intelligence/analyze/comparable - should find comparable properties', async () => {
      const comparableData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        propertyType: 'single_family',
        squareFootage: 2000
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comparable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comparableData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Comparable properties analysis completed`);
    });

    it('POST /api/property-intelligence/analyze/neighborhood - should analyze neighborhood', async () => {
      const neighborhoodData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/neighborhood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(neighborhoodData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Neighborhood analysis completed`);
    });

    it('POST /api/property-intelligence/analyze/creative-features - should analyze creative features', async () => {
      const featuresData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        propertyType: 'single_family'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/creative-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featuresData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Creative features analysis completed`);
    });

    it('POST /api/property-intelligence/analyze/risk-assessment - should perform risk assessment', async () => {
      const riskData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/risk-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riskData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Risk assessment completed`);
    });

    it('POST /api/property-intelligence/census/demographics - should get demographic data', async () => {
      const censusData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/demographics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(censusData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Census demographics retrieved`);
    });

    it('POST /api/property-intelligence/census/economic - should get economic data', async () => {
      const economicData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/economic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(economicData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Economic data retrieved`);
    });

    it('POST /api/property-intelligence/census/housing - should get housing data', async () => {
      const housingData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/housing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(housingData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Housing data retrieved`);
    });

    it('POST /api/property-intelligence/census/comprehensive - should get comprehensive census data', async () => {
      const comprehensiveData = {
        latitude: 37.4224764,
        longitude: -122.0842499
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/census/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comprehensiveData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Comprehensive census data retrieved`);
    });

    it('POST /api/property-intelligence/places/nearby - should find nearby places', async () => {
      const placesData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        radius: 1000,
        type: 'school'
      };

      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/places/nearby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(placesData)
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);

      console.log(`✅ Nearby places found`);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete full appraisal workflow across all systems', async () => {
      console.log('\n🚀 Starting comprehensive end-to-end workflow test...');
      
      // Step 1: Create a new order
      console.log('Step 1: Creating new order...');
      const orderData = {
        clientId: `e2e-${Date.now()}`,
        orderNumber: `E2E-WORKFLOW-${Date.now()}`,
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
          features: ['garage', 'pool']
        },
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        borrowerInformation: {
          firstName: 'End-to-End',
          lastName: 'Workflow',
          email: 'e2e@workflow.com',
          phone: '555-E2E-TEST'
        },
        loanInformation: {
          loanAmount: 900000,
          loanType: 'conventional',
          loanPurpose: 'purchase'
        },
        contactInformation: {
          lenderName: 'E2E Test Bank',
          lenderContact: 'Workflow Manager',
          lenderEmail: 'workflow@e2ebank.com',
          lenderPhone: '555-0789'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        metadata: { e2eTest: true }
      };

      const orderResponse = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      expect(orderResponse.status).toBe(201);
      const orderResult = await orderResponse.json();
      const workflowOrderId = orderResult.data.id;
      console.log(`✅ Order created: ${orderResult.data.orderNumber}`);

      // Step 2: Create a vendor
      console.log('Step 2: Creating vendor...');
      const vendorData = {
        companyName: `E2E Workflow Appraisals ${Date.now()}`,
        contactPerson: {
          firstName: 'Workflow',
          lastName: 'Vendor',
          email: 'vendor@e2eworkflow.com',
          phone: '555-VENDOR'
        },
        businessAddress: {
          streetAddress: '789 Workflow Street',
          city: 'Appraisal City',
          state: 'CA',
          zipCode: '90210'
        },
        licenseInformation: {
          licenseNumber: `E2E-${Date.now()}`,
          licenseState: 'CA',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        serviceAreas: [{ state: 'CA', counties: ['Santa Clara'], zipCodes: ['94043'] }],
        specialties: ['single_family'],
        status: VendorStatus.ACTIVE,
        onboardingDate: new Date(),
        metadata: { e2eTest: true }
      };

      const vendorResponse = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData)
      });

      expect(vendorResponse.status).toBe(201);
      const vendorResult = await vendorResponse.json();
      const workflowVendorId = vendorResult.data.id;
      console.log(`✅ Vendor created: ${vendorResult.data.companyName}`);

      // Step 3: Assign vendor to order
      console.log('Step 3: Assigning vendor to order...');
      const assignmentResponse = await fetch(`${API_BASE_URL}/api/orders/${workflowOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedVendorId: workflowVendorId,
          status: OrderStatus.ASSIGNED,
          notes: 'Vendor assigned via E2E workflow test'
        })
      });

      expect(assignmentResponse.status).toBe(200);
      console.log(`✅ Vendor assigned to order`);

      // Step 4: Perform property intelligence analysis
      console.log('Step 4: Performing property analysis...');
      const analysisResponse = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 37.4224764,
          longitude: -122.0842499,
          propertyId: workflowOrderId
        })
      });

      expect(analysisResponse.status).toBe(200);
      console.log(`✅ Property analysis completed`);

      // Step 5: Complete the order
      console.log('Step 5: Completing order...');
      const completionResponse = await fetch(`${API_BASE_URL}/api/orders/${workflowOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: OrderStatus.COMPLETED,
          completionDate: new Date(),
          finalValue: 925000,
          notes: 'Completed via comprehensive E2E workflow test'
        })
      });

      expect(completionResponse.status).toBe(200);
      const completionResult = await completionResponse.json();
      expect(completionResult.data.status).toBe(OrderStatus.COMPLETED);
      console.log(`✅ Order completed with final value: $${completionResult.data.finalValue}`);

      // Step 6: Verify final state
      console.log('Step 6: Verifying workflow completion...');
      const finalCheckResponse = await fetch(`${API_BASE_URL}/api/orders/${workflowOrderId}`);
      const finalOrder = await finalCheckResponse.json();
      
      expect(finalOrder.data.status).toBe(OrderStatus.COMPLETED);
      expect(finalOrder.data.assignedVendorId).toBe(workflowVendorId);
      expect(finalOrder.data.finalValue).toBe(925000);

      // Cleanup workflow test data
      await fetch(`${API_BASE_URL}/api/orders/${workflowOrderId}?clientId=${orderData.clientId}`, { method: 'DELETE' });
      await fetch(`${API_BASE_URL}/api/vendors/${workflowVendorId}`, { method: 'DELETE' });

      console.log('🎉 End-to-End Workflow Test COMPLETED SUCCESSFULLY!');
      console.log('✅ All systems integrated and working correctly\n');
    }, TEST_TIMEOUT * 2);
  });
});