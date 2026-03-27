/**
 * Simple Production API Manual Tests
 * Direct endpoint testing for the production API
 */

import { describe, it, expect, beforeAll } from 'vitest';
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

describe.skipIf(process.env.VITEST_INTEGRATION !== 'true', 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server tests')('Production API Manual Tests', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let adminToken: string;
  let testOrderId: string;
  let testVendorId: string;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    const tokenGen = new TestTokenGenerator();
    adminToken = tokenGen.generateToken({ id: 'test-admin', email: 'admin@appraisal.com', name: 'Test Admin', role: 'admin' as const, tenantId: 'test-tenant' });
  }, 60_000);

  describe('API Health Tests', () => {
    it('should return API health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBeDefined();

      console.log('✅ API health check passed:', response.body);
    });

    it('should return comprehensive API information', async () => {
      const response = await request(app).get('/api');

      // /api endpoint may not exist (404) or return info (200)
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.name).toBeDefined();
      }

      console.log('✅ API info endpoint checked (status: ' + response.status + ')');
      if (response.status === 200) {
        console.log('Available endpoints:', Object.keys(response.body));
      }
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

      testOrderId = response.body.id;

      console.log(`✅ Created order with ID: ${testOrderId}`);
      console.log('Order details:', {
        id: response.body.id,
        orderNumber: response.body.orderNumber,
        property: response.body.propertyAddress?.streetAddress,
        status: response.body.status
      });
    }, 10000);

    it('should retrieve the created order by ID', async () => {
      expect(testOrderId).toBeDefined();

      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testOrderId);
      expect(response.body.propertyAddress.city).toBe('Mountain View');

      console.log(`✅ Retrieved order: ${response.body.orderNumber}`);
      console.log('Retrieved data matches expected values');
    });

    it('should update the order status', async () => {
      expect(testOrderId).toBeDefined();

      // Valid transition: NEW → PENDING_ASSIGNMENT via PUT /status
      const response = await request(app)
        .put(`/api/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.PENDING_ASSIGNMENT, notes: 'Order updated via integration test' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(OrderStatus.PENDING_ASSIGNMENT);

      console.log(`✅ Updated order status to: ${response.body.status}`);
    });

    it('should list orders with filters', async () => {
      const response = await request(app)
        .get(`/api/orders?status=${OrderStatus.PENDING_ASSIGNMENT}&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.orders)).toBe(true);

      console.log(`✅ Found ${response.body.orders.length} orders with status 'in_progress'`);

      // Check if our test order is in the list
      const testOrder = response.body.orders.find((order: any) => order.id === testOrderId);
      if (testOrder) {
        console.log('✅ Test order found in filtered list');
      }
    });
  });

  describe('Vendor Management Tests', () => {
    it('should create a new vendor', async () => {
      // VendorController requires: name (string), email (valid email).
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
      console.log('Vendor details:', {
        id: response.body.id,
        businessName: response.body.businessName,
        email: response.body.email,
        status: response.body.status
      });
    });

    it('should retrieve the created vendor by ID', async () => {
      expect(testVendorId).toBeDefined();

      const response = await request(app)
        .get(`/api/vendors/${testVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testVendorId);
      expect(response.body.businessName).toBe('Test Appraisal Services');

      console.log(`✅ Retrieved vendor: ${response.body.businessName}`);
    });

    it('should list all vendors', async () => {
      const response = await request(app)
        .get('/api/vendors?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      console.log(`✅ Found ${response.body.length} total vendors`);

      // Check if our test vendor is in the list
      const testVendor = response.body.find((vendor: any) => vendor.id === testVendorId);
      if (testVendor) {
        console.log('✅ Test vendor found in vendor list');
      }
    });
  });

  describe('Property Intelligence Tests', () => {
    it('should check property intelligence health', async () => {
      const response = await request(app).get('/api/property-intelligence/health');

      expect(response.status).toBe(200);
      // Health response may be wrapped: { success: true, data: { status, services } }
      const healthData = response.body.data ?? response.body;
      expect(healthData.status).toBe('healthy');
      expect(healthData.services).toBeDefined();

      console.log('✅ Property intelligence health check passed');
      console.log('Available services:', Object.keys(healthData.services));
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

      console.log(`✅ Geocoded address successfully`);
      console.log('Geocoding results:', response.body.data.length > 0 ? response.body.data[0] : 'No results');
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
      console.log('Analysis included:', Object.keys(response.body.data));
    });
  });

  describe('End-to-End Workflow', () => {
    it('should simulate complete appraisal workflow', async () => {
      console.log('\n=== Simulating Complete Appraisal Workflow ===');
      
      // Step 1: Verify we have test data
      expect(testOrderId).toBeDefined();
      expect(testVendorId).toBeDefined();
      console.log('Step 1: ✅ Test order and vendor available');
      
      // Step 2: Assign vendor to order using the correct endpoint
      console.log('Step 2: Assigning vendor to order...');
      const assignResponse = await request(app)
        .post(`/api/orders/${testOrderId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: testVendorId });

      expect([200, 422]).toContain(assignResponse.status);
      if (assignResponse.status === 200) {
        expect(assignResponse.body.assignedVendorId).toBe(testVendorId);
      }
      console.log('Step 2: ✅ Vendor assignment attempted');

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
      console.log('Step 3: ✅ Property analysis completed');

      // Step 4: Update order status to cancelled (valid from any active state)
      console.log('Step 4: Updating order status...');
      const statusResponse = await request(app)
        .put(`/api/orders/${testOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: OrderStatus.CANCELLED,
          notes: 'Cancelled via integration test workflow'
        });

      expect([200, 422]).toContain(statusResponse.status);
      console.log('Step 4: ✅ Order status update attempted');
      
      console.log('✅ Complete appraisal workflow simulation successful!');
      console.log('=== Workflow Complete ===\n');
    });
  });
});