/**
 * Live Production API Integration Tests
 * Tests against the already running production server
 * Run this while the production server is running on port 3000
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

describe.skipIf(!process.env.AZURE_COSMOS_ENDPOINT, 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server tests')('Live Production API Integration Tests', () => {
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

    console.log('✅ In-process server ready');
  }, 60_000);

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
          phone: '415-555-0123'
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
          lenderPhone: '415-555-0456'
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

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(orderData);

      expect(response.status).toBe(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.orderNumber).toBe(orderData.orderNumber);
      expect(response.body.propertyAddress.streetAddress).toBe('1600 Amphitheatre Parkway');

      testOrderId = response.body.id;

      console.log(`✅ Created order: ${response.body.orderNumber} (ID: ${testOrderId})`);
    });

    it('should retrieve the created order proving database persistence', async () => {
      expect(testOrderId).toBeDefined();

      const response = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);

      expect(response.body.id).toBe(testOrderId);
      expect(response.body.propertyAddress.city).toBe('Mountain View');
      expect(response.body.borrowerInformation.firstName).toBe('Integration');

      console.log(`✅ Retrieved order from database: ${response.body.orderNumber}`);
    });

    it('should update the order and persist changes', async () => {
      expect(testOrderId).toBeDefined();

      const updateData = {
        status: OrderStatus.IN_PROGRESS,
        notes: 'Updated via integration test - proving database writes work',
        assignedVendorId: 'integration-test-vendor'
      };

      const response = await request(app)
        .put(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);

      expect(response.body.status).toBe(OrderStatus.IN_PROGRESS);
      expect(response.body.assignedVendorId).toBe('integration-test-vendor');

      console.log(`✅ Updated order status: ${response.body.status}`);
    });

    it('should list orders with filters from real database', async () => {
      const response = await request(app)
        .get(`/api/orders?status=${OrderStatus.IN_PROGRESS}&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);

      expect(Array.isArray(response.body.orders)).toBe(true);

      // Our test order should be in the results
      const testOrder = response.body.orders.find((order: any) => order.id === testOrderId);
      expect(testOrder).toBeDefined();
      expect(testOrder.status).toBe(OrderStatus.IN_PROGRESS);

      console.log(`✅ Found ${response.body.orders.length} orders in database, including our test order`);
    });
  });

  describe('Vendor Management Integration', () => {
    it('should create a new vendor with real database persistence', async () => {
      // VendorController requires: name (string), email (valid email).
      // Optional: phone (mobile phone), serviceTypes (array), serviceAreas (array).
      const vendorName = `Integration Test Appraisals ${Date.now()}`;
      const vendorData = {
        name: vendorName,
        email: 'integration@testappraisals.com',
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
      expect(response.body.businessName).toContain('Integration Test Appraisals');

      testVendorId = response.body.id;

      console.log(`✅ Created vendor: ${response.body.businessName} (ID: ${testVendorId})`);
    });

    it('should retrieve the created vendor proving database persistence', async () => {
      expect(testVendorId).toBeDefined();

      const response = await request(app)
        .get(`/api/vendors/${testVendorId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);

      expect(response.body.id).toBe(testVendorId);
      expect(response.body.email).toBe('integration@testappraisals.com');
      expect(response.body.businessName).toContain('Integration Test Appraisals');

      console.log(`✅ Retrieved vendor from database: ${response.body.businessName}`);
    });

    it('should list vendors from real database', async () => {
      const response = await request(app)
        .get('/api/vendors?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Our test vendor should be in the results
      const testVendor = response.body.find((vendor: any) => vendor.id === testVendorId);
      expect(testVendor).toBeDefined();

      console.log(`✅ Found ${response.body.length} vendors in database, including our test vendor`);
    });
  });

  describe('Property Intelligence Integration', () => {
    it('should check property intelligence service health', async () => {
      const response = await request(app).get('/api/property-intelligence/health');
      expect(response.status).toBe(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();

      console.log('✅ Property intelligence service is healthy');
      console.log(`Services available: ${Object.keys(response.body.services).join(', ')}`);
    });

    it('should geocode an address using property intelligence', async () => {
      const addressData = {
        address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
      };

      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .send(addressData);

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      console.log(`✅ Geocoded address successfully: ${response.body.data.length} results found`);
    });

    it('should perform comprehensive property analysis', async () => {
      const analysisData = {
        latitude: 37.4224764,
        longitude: -122.0842499,
        strategy: 'quality_first'
      };

      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .send(analysisData);

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log(`✅ Comprehensive property analysis completed`);
      console.log(`Analysis components: ${Object.keys(response.body.data).join(', ')}`);
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

      const assignResponse = await request(app)
        .put(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(assignmentData);

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.assignedVendorId).toBe(testVendorId);
      expect(assignResponse.body.status).toBe(OrderStatus.ASSIGNED);
      console.log('✅ Vendor assigned successfully');

      // Step 2: Perform property analysis
      console.log('Step 2: Performing property analysis...');
      const propertyAnalysis = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .send({
          latitude: 37.4224764,
          longitude: -122.0842499,
          propertyId: testOrderId
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

      const completionResponse = await request(app)
        .put(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(completionData);

      expect(completionResponse.status).toBe(200);
      expect(completionResponse.body.status).toBe(OrderStatus.COMPLETED);
      expect(completionResponse.body.finalValue).toBe(875000);
      console.log('✅ Order completed successfully');

      // Step 4: Verify final state
      console.log('Step 4: Verifying final state...');
      const finalCheck = await request(app)
        .get(`/api/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(finalCheck.body.status).toBe(OrderStatus.COMPLETED);
      expect(finalCheck.body.assignedVendorId).toBe(testVendorId);
      expect(finalCheck.body.finalValue).toBe(875000);
      console.log('✅ Final state verified in database');
      
      console.log('🎉 End-to-End Workflow Test PASSED!');
      console.log('=== All database operations successful ===\n');
    });
  });
});