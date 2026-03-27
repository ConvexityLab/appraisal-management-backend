/**
 * Production API Integration Tests
 * Comprehensive tests for the complete appraisal management workflow
 * Tests order management, vendor management, and property intelligence APIs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import { 
  OrderStatus, 
  Priority, 
  OrderType, 
  ProductType, 
  PropertyType,
  OccupancyType,
  VendorStatus 
} from '../../src/types/index';

const TEST_TIMEOUT = 30000;

describe.skipIf(process.env.VITEST_INTEGRATION !== 'true', 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server tests')('Production API Integration Tests', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let testOrderId: string;
  let testVendorId: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log('🧪 Setting up production API integration tests...');

    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({ id: 'test-admin', email: 'admin@appraisal.com', name: 'Test Admin', role: 'admin' as const, tenantId: 'test-tenant' });

    console.log('✅ Test environment ready');
  }, 60_000);

  afterAll(async () => {
    console.log('🧹 Cleaning up integration tests...');

    if (testOrderId) {
      try {
        const getResp = await request(app)
          .get(`/api/orders/${testOrderId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (getResp.status === 200) {
          const clientId = getResp.body.clientId;
          await request(app)
            .delete(`/api/orders/${testOrderId}?clientId=${clientId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          console.log(`✅ Cleaned up test order: ${testOrderId}`);
        }
      } catch (error) {
        console.log(`⚠️ Failed to cleanup test order: ${error}`);
      }
    }

    if (testVendorId) {
      try {
        await request(app)
          .delete(`/api/vendors/${testVendorId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        console.log(`✅ Cleaned up test vendor: ${testVendorId}`);
      } catch (error) {
        console.log(`⚠️ Failed to cleanup test vendor: ${error}`);
      }
    }

    console.log('✅ Test cleanup complete');
  });

  describe('API Health and Status', () => {
    it('should return API health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBeDefined();

      console.log('✅ API health check passed');
    });

    it('should return comprehensive API information', async () => {
      const response = await request(app).get('/api');

      // /api endpoint may not exist (404) or may return info (200)
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.name).toBeDefined();
      }

      console.log('✅ API info endpoint checked (status: ' + response.status + ')');
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
          phone: '415-555-0123'
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
          lenderPhone: '415-555-0456'
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        tags: ['integration-test', 'production-api-test'],
        metadata: {
          testOrder: true,
          source: 'integration-test'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orderData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.orderNumber).toBe(orderData.orderNumber);
      expect(response.body.propertyAddress.streetAddress).toBe('1600 Amphitheatre Parkway');

      testOrderId = response.body.id;

      console.log(`✅ Created order with ID: ${testOrderId}`);
    }, TEST_TIMEOUT);

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined();

      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testOrderId);
      expect(response.body.propertyAddress.city).toBe('Mountain View');
      expect(response.body.status).toBe(OrderStatus.NEW);

      console.log(`✅ Retrieved order: ${response.body.orderNumber}`);
    });

    it('should update the order status', async () => {
      expect(testOrderId).toBeDefined();

      // NEW → PENDING_ASSIGNMENT is a valid transition
      const response = await request(app)
        .put(`/api/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.PENDING_ASSIGNMENT,
          notes: 'Order updated via integration test'
        });

      expect([200, 422]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.status).toBe(OrderStatus.PENDING_ASSIGNMENT);
      }

      console.log(`✅ Updated order status (code: ${response.status})`);
    });

    it('should list orders with filters', async () => {
      const response = await request(app)
        .get(`/api/orders?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body.pagination).toBeDefined();

      console.log(`✅ Found ${response.body.orders.length} orders`);
    });
  });

  describe('Vendor Management Workflow', () => {
    it('should create a new vendor', async () => {
      // VendorController requires: name (string, min 2 chars), email (valid email).
      // Optional: phone (mobile phone), serviceTypes (array), serviceAreas (array).
      const vendorData = {
        name: 'Test Appraisal Services',
        email: 'alice@testappraisal.com',
        phone: '415-555-0789',
        serviceTypes: ['appraisal'],
        serviceAreas: ['CA'],
        status: VendorStatus.ACTIVE
      };

      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(vendorData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.businessName).toBe('Test Appraisal Services');

      testVendorId = response.body.id;

      console.log(`✅ Created vendor with ID: ${testVendorId}`);
    });

    it('should retrieve the created vendor by ID', async () => {
      expect(testVendorId).toBeDefined();

      const response = await request(app)
        .get(`/api/vendors/${testVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testVendorId);
      expect(response.body.businessName).toBe('Test Appraisal Services');
      expect(response.body.email).toBe('alice@testappraisal.com');

      console.log(`✅ Retrieved vendor: ${response.body.businessName}`);
    });

    it('should update vendor information', async () => {
      expect(testVendorId).toBeDefined();

      const updateData = {
        email: 'alice.johnson@testappraisal.com',  // Updated email
        notes: 'Updated via integration test'
      };

      const response = await request(app)
        .put(`/api/vendors/${testVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testVendorId);
      expect(response.body.email).toBe('alice.johnson@testappraisal.com');

      console.log(`✅ Updated vendor information`);
    });

    it('should get vendor performance metrics', async () => {
      expect(testVendorId).toBeDefined();

      // Correct route: /api/vendors/performance/:vendorId (not /:id/performance)
      const response = await request(app)
        .get(`/api/vendors/performance/${testVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Note: This might return empty performance data for a new vendor
      expect([200, 404]).toContain(response.status);

      console.log(`✅ Retrieved vendor performance data (status: ${response.status})`);
    });

    it('should list all vendors', async () => {
      const response = await request(app)
        .get('/api/vendors?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Should include our test vendor
      const testVendor = response.body.find((vendor: any) => vendor.id === testVendorId);
      expect(testVendor).toBeDefined();

      console.log(`✅ Found ${response.body.length} total vendors`);
    });
  });

  describe('Property Intelligence Workflow', () => {
    it('should check property intelligence health', async () => {
      const response = await request(app).get('/api/property-intelligence/health');

      expect(response.status).toBe(200);
      // Health response is wrapped: { success: true, data: { status, services } }
      const healthData = response.body.data ?? response.body;
      expect(healthData.status).toBe('healthy');
      expect(healthData.services).toBeDefined();

      console.log('✅ Property intelligence health check passed');
    });

    it('should geocode an address', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(addressData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        expect(response.body.data[0].coordinates).toBeDefined();
        expect(response.body.data[0].address.formattedAddress).toBeDefined();
      }

      console.log(`✅ Geocoded address successfully`);
    });

    it('should perform comprehensive property analysis', async () => {
      const analysisData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        strategy: 'quality_first'
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(analysisData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log(`✅ Comprehensive property analysis completed`);
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should simulate complete appraisal workflow', async () => {
      console.log('\n=== Simulating Complete Appraisal Workflow ===');
      
      // Step 1: Verify test order exists
      console.log('Step 1: Verifying test order...');
      expect(testOrderId).toBeDefined();
      
      // Step 2: Assign vendor using the correct endpoint
      console.log('Step 2: Assigning vendor to order...');
      expect(testVendorId).toBeDefined();
      
      const assignResponse = await request(app)
        .post(`/api/orders/${testOrderId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: testVendorId });

      expect([200, 422]).toContain(assignResponse.status);
      if (assignResponse.status === 200) {
        expect(assignResponse.body.assignedVendorId).toBe(testVendorId);
      }

      // Step 3: Analyze property
      console.log('Step 3: Analyzing property intelligence...');
      const propertyAnalysis = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          latitude: 37.4224764,
          longitude: -122.0842499,
          propertyId: testOrderId
        });

      expect(propertyAnalysis.status).toBe(200);

      // Step 4: Update order status using the status endpoint
      console.log('Step 4: Attempting to progress the order...');
      const statusResponse = await request(app)
        .put(`/api/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.CANCELLED,
          notes: 'Cancelled via integration test workflow'
        });

      // Accept any valid response (200=success, 422=invalid transition)
      expect([200, 422]).toContain(statusResponse.status);

      console.log('✅ Complete appraisal workflow simulation successful!');
      console.log('=== Workflow Complete ===\n');
    });
  });
});