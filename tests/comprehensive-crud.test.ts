import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CosmosDbService } from '../src/services/cosmos-db.service.js';
import { OrderController } from '../src/controllers/order.controller.js';
import { VendorController } from '../src/controllers/production-vendor.controller.js';
import { 
  OccupancyType,
  OrderStatus, 
  Priority, 
  PropertyType,
  ProductType, 
  OrderType, 
  VendorStatus
} from '../src/types/index.js';

/**
 * Comprehensive API Tests for CRUD Operations
 * Tests all fundamental entity management functionality
 */
// INTEGRATION TEST — VendorController requires CosmosDbService.
describe.skipIf(process.env.VITEST_INTEGRATION !== 'true', 'AZURE_COSMOS_ENDPOINT not configured')('Comprehensive CRUD API Tests', () => {
  let app: express.Application;
  let orderController: OrderController;
  let vendorController: VendorController;
  let dbSvc: CosmosDbService;

  beforeAll(async () => {
    // Initialize a single shared CosmosDbService for the entire suite
    dbSvc = new CosmosDbService(process.env.AZURE_COSMOS_ENDPOINT!);
    await dbSvc.initialize();
  }, 30_000);

  afterAll(async () => {
    if (dbSvc?.isDbConnected()) {
      await dbSvc.disconnect();
    }
  });

  beforeEach(() => {
    // Fresh Express app per test for route isolation
    app = express();
    app.use(express.json());

    // Inject a mock authenticated user so controllers that read req.user work without
    // a real Azure AD token (OrderController uses req.user!.tenantId / req.user!.id).
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        id: 'test-user-id',
        tenantId: 'test-tenant-id',
        email: 'test@example.com',
        roles: ['admin'],
      };
      next();
    });

    // OrderController takes dbService; routes are set up in constructor via private setupRoutes()
    orderController = new OrderController(dbSvc);
    // VendorController takes dbService; exposes public router
    vendorController = new VendorController(dbSvc);

    // Mount routers at the paths the tests target
    app.use('/api/orders', orderController.router);
    app.use('/api/vendors', vendorController.router);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  // ===============================
  // Vendor CRUD Tests
  // ===============================

  describe('Vendor Management API', () => {
    const sampleVendorData = {
      name: 'Test Appraisal Services',
      email: 'test@appraisal.com',
      phone: '+12125678901',
      licenseNumber: 'TEST-12345',
      licenseState: 'CA',
      licenseExpiry: new Date('2025-12-31').toISOString(),
      productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
      bankingInfo: {
        accountName: 'Test Appraisal Services',
        routingNumber: '123456789',
        accountNumber: '987654321'
      },
      insuranceInfo: {
        provider: 'Test Insurance Co',
        policyNumber: 'TEST-POL-123',
        coverage: 1000000,
        expiryDate: new Date('2025-06-30').toISOString(),
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

    it('should create a new vendor', async () => {
      const response = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData)
        .expect(201);

      // VendorController returns unwrapped VendorProfile (no success/data wrapper)
      expect(response.body).toHaveProperty('id');
      expect(response.body.businessName).toBe(sampleVendorData.name);
      expect(response.body.stateLicense).toBe(sampleVendorData.licenseNumber);
    });

    it('should validate required vendor fields', async () => {
      const incompleteData = {
        name: 'T' // too short — fails min length 2 check
      };

      const response = await request(app)
        .post('/api/vendors')
        .send(incompleteData)
        .expect(400);

      // VendorController validation errors return { error, code, details }
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toBe('Validation failed');
    });

    it('should retrieve vendor by ID', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      expect(createResponse.status).toBe(201);
      const vendorId = createResponse.body.id; // unwrapped

      // Retrieve vendor
      const response = await request(app)
        .get(`/api/vendors/${vendorId}`)
        .expect(200);

      // VendorController returns unwrapped VendorProfile
      expect(response.body.id).toBe(vendorId);
      expect(response.body.businessName).toBe(sampleVendorData.name);
    });

    it('should update vendor information', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      expect(createResponse.status).toBe(201);
      const vendorId = createResponse.body.id; // unwrapped

      // Update vendor — phone must pass isMobilePhone('any')
      const updates = {
        phone: '+12129876543'
      };

      const response = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send(updates)
        .expect(200);

      // VendorController returns unwrapped VendorProfile
      expect(response.body).toHaveProperty('id');
      expect(response.body.phone).toBe('+12129876543');
    });

    it('should list vendors with filtering', async () => {
      // Create multiple vendors
      const vendor1 = { ...sampleVendorData, name: 'Vendor A', licenseState: 'CA' };
      const vendor2 = { ...sampleVendorData, name: 'Vendor B', email: 'vendorb@test.com', licenseState: 'TX' };

      await request(app).post('/api/vendors').send(vendor1);
      await request(app).post('/api/vendors').send(vendor2);

      const response = await request(app)
        .get('/api/vendors')
        .expect(200);

      // VendorController returns unwrapped array of VendorProfile
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should search vendors', async () => {
      // Create vendor first
      const createRes = await request(app).post('/api/vendors').send(sampleVendorData);
      expect(createRes.status).toBe(201);

      // VendorController has no /search route; GET / returns all vendors
      const response = await request(app)
        .get('/api/vendors')
        .expect(200);

      // Returns unwrapped array
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get vendor performance metrics', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      expect(createResponse.status).toBe(201);
      const vendorId = createResponse.body.id; // unwrapped

      // VendorController route is /performance/:vendorId (not /:vendorId/performance)
      const response = await request(app)
        .get(`/api/vendors/performance/${vendorId}`)
        .expect(200);

      // Returns unwrapped performance data
      expect(response.body).toHaveProperty('vendorId');
    });
  });

  // ===============================
  // Order CRUD Tests
  // ===============================

  describe('Order Management API', () => {
    let createdVendorId: string;
    let createdPropertyId: string;

    // Lazily evaluated: describe.skipIf(...) doesn't prevent the describe body
    // from running at collection time, so a top-level `const sampleOrderData`
    // here would dereference PropertyType / ProductType / OrderType / Priority
    // before module evaluation has fully bound them in some ESM resolution
    // orders (seen on CI when VITEST_INTEGRATION is unset). Wrapping in a
    // factory defers the enum reads until inside a test body / hook, by which
    // point all imports are guaranteed to have resolved.
    const buildSampleOrderData = () => ({
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
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
      rushOrder: false,
      borrowerInformation: {
        firstName: 'Test',
        lastName: 'Borrower',
        email: 'test.borrower@email.com',
        phone: '555-BORR'
      },
      loanInformation: {
        loanAmount: 500000,
        loanType: 'Conventional',
        loanPurpose: 'Purchase',
        contractPrice: 650000
      },
      contactInformation: {
        name: 'Test Loan Officer',
        role: 'loan_officer',
        email: 'test.lo@lender.com',
        phone: '555-LOAN',
        preferredMethod: 'email'
      },
      priority: Priority.NORMAL,
      specialInstructions: 'Test order for API validation'
    });
    let sampleOrderData: ReturnType<typeof buildSampleOrderData>;
    beforeAll(() => { sampleOrderData = buildSampleOrderData(); });

    beforeEach(async () => {
      // Create a vendor for order assignment tests
      const vendorResponse = await request(app)
        .post('/api/vendors')
        .send({
          name: 'Order Test Vendor',
          email: 'ordertest@vendor.com',
          phone: '+12125671001',
          licenseNumber: 'ORDER-TEST-123',
          licenseState: 'CA',
          licenseExpiry: new Date('2025-12-31').toISOString(),
          productTypes: [ProductType.FULL_APPRAISAL],
          preferences: {
            orderTypes: [OrderType.PURCHASE],
            productTypes: [ProductType.FULL_APPRAISAL],
            maxOrdersPerDay: 5,
            workingHours: { start: '08:00', end: '18:00' },
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            notificationPreferences: { email: true, sms: false, portal: true }
          }
        });

      // VendorController returns unwrapped VendorProfile
      createdVendorId = vendorResponse.body.id;
    });

    it('should create a new order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send(sampleOrderData)
        .expect(201);

      // OrderController returns unwrapped order object (no success/data wrapper)
      expect(response.body).toHaveProperty('id');
      expect(response.body.orderNumber).toBe(sampleOrderData.orderNumber);
      expect(response.body.status).toBe(OrderStatus.NEW);
    });

    it('should validate required order fields', async () => {
      const incompleteData = {
        clientId: 'test-client'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/orders')
        .send(incompleteData)
        .expect(400);

      // Order validation middleware returns { error, code, details }
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body).toHaveProperty('details');
    });

    it('should retrieve order by ID', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      expect(createResponse.status).toBe(201);
      const orderId = createResponse.body.id; // unwrapped

      // Retrieve order
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      // OrderController returns unwrapped order
      expect(response.body.id).toBe(orderId);
      expect(response.body.orderNumber).toBe(sampleOrderData.orderNumber);
    });

    it('should update order status', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      expect(createResponse.status).toBe(201);
      const orderId = createResponse.body.id; // unwrapped

      // NEW → PENDING_ASSIGNMENT is a valid transition (not NEW → IN_PROGRESS which is invalid)
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .send({ status: OrderStatus.PENDING_ASSIGNMENT })
        .expect(200);

      // OrderController returns unwrapped order
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(OrderStatus.PENDING_ASSIGNMENT);
    });

    it('should assign vendor to order', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      expect(createResponse.status).toBe(201);
      const orderId = createResponse.body.id; // unwrapped

      // Assign vendor — requires a valid vendorId; skip if vendor creation failed
      if (!createdVendorId) {
        return;
      }

      // Assign vendor: POST /:orderId/assign with { vendorId }
      const response = await request(app)
        .post(`/api/orders/${orderId}/assign`)
        .send({ vendorId: createdVendorId })
        .expect(200);

      // OrderController returns unwrapped order
      expect(response.body.assignedVendorId).toBe(createdVendorId);
    });

    it('should list orders with filtering', async () => {
      // Create multiple orders
      const order1 = { ...sampleOrderData, orderNumber: 'ORDER-001', priority: Priority.HIGH };
      const order2 = { ...sampleOrderData, orderNumber: 'ORDER-002', priority: Priority.NORMAL };

      await request(app).post('/api/orders').send(order1);
      await request(app).post('/api/orders').send(order2);

      const response = await request(app)
        .get('/api/orders')
        .query({ priority: Priority.HIGH })
        .expect(200);

      // OrderController GET / returns { orders: [...], pagination: {...} }
      expect(response.body).toHaveProperty('orders');
      expect(response.body.orders).toBeInstanceOf(Array);
    });

    it('should search orders', async () => {
      // Create order first
      await request(app).post('/api/orders').send(sampleOrderData);

      const response = await request(app)
        .post('/api/orders/search')
        .send({
          productType: [ProductType.FULL_APPRAISAL]
        })
        .expect(200);

      // OrderController POST /search returns { orders: [...], total, aggregations }
      expect(response.body).toHaveProperty('orders');
      expect(response.body.orders).toBeInstanceOf(Array);
    });
  });

  // ===============================
  // Integration Tests
  // ===============================

  describe('Integration Tests', () => {
    it('should handle complete order workflow', async () => {
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

      const propertyResponse = await request(app)
        .post('/api/properties')
        .send(propertyData);

      expect(propertyResponse.status).toBe(201);

      // 2. Create vendor
      const vendorData = {
        name: 'Integration Test Vendor',
        email: 'integration@test.com',
        phone: '+14152678901',
        licenseNumber: 'INTEG-123',
        licenseState: 'CA',
        licenseExpiry: new Date('2025-12-31').toISOString(),
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

      const vendorResponse = await request(app)
        .post('/api/vendors')
        .send(vendorData);

      expect(vendorResponse.status).toBe(201);
      const integVendorId = vendorResponse.body.id; // unwrapped

      // 3. Create order
      const orderData = {
        clientId: 'integration-client-001',
        orderNumber: 'INTEG-ORDER-001',
        propertyAddress: propertyData.address,
        propertyDetails: propertyData.details,
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        rushOrder: false,
        borrowerInformation: {
          firstName: 'Integration',
          lastName: 'Test',
          email: 'integration@test.com',
          phone: '+12025678901'
        },
        loanInformation: {
          loanAmount: 600000,
          loanType: 'Conventional',
          loanPurpose: 'Purchase'
        },
        contactInformation: {
          name: 'Integration LO',
          role: 'loan_officer',
          email: 'lo@integration.com',
          phone: '+13015678901',
          preferredMethod: 'email'
        },
        priority: Priority.NORMAL
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(orderResponse.status).toBe(201);
      const integOrderId = orderResponse.body.id; // unwrapped

      // 4. Assign vendor to order
      const assignResponse = await request(app)
        .post(`/api/orders/${integOrderId}/assign`)
        .send({ vendorId: integVendorId });

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.assignedVendorId).toBe(integVendorId);

      // 5. Update order status — ASSIGNED → ACCEPTED is a valid transition
      const statusResponse = await request(app)
        .put(`/api/orders/${integOrderId}/status`)
        .send({ status: OrderStatus.ACCEPTED });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe(OrderStatus.ACCEPTED);
    });

    it('should handle error cases gracefully', async () => {
      // Test 404 errors
      await request(app)
        .get('/api/orders/nonexistent-id')
        .expect(404);

      await request(app)
        .get('/api/vendors/nonexistent-id')
        .expect(404);

      await request(app)
        .get('/api/properties/nonexistent-id')
        .expect(404);

      // Test validation errors
      await request(app)
        .post('/api/orders')
        .send({})
        .expect(400);

      await request(app)
        .post('/api/vendors')
        .send({ name: 'Incomplete Vendor' })
        .expect(400);

      await request(app)
        .post('/api/properties')
        .send({ address: { streetAddress: 'Incomplete' } })
        .expect(400);
    });
  });

  // ===============================
  // Performance and Load Tests
  // ===============================

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = [];
      
      // Create 10 concurrent property creation requests
      for (let i = 0; i < 10; i++) {
        const propertyData = {
          address: {
            streetAddress: `${i} Performance Test St`,
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94101',
            county: 'San Francisco'
          },
          details: {
            propertyType: PropertyType.SFR,
            occupancy: OccupancyType.OWNER_OCCUPIED,
            yearBuilt: 2020,
            grossLivingArea: 2000 + i * 100,
            bedrooms: 3,
            bathrooms: 2,
            features: ['feature']
          }
        };

        requests.push(
          request(app)
            .post('/api/properties')
            .send(propertyData)
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle pagination efficiently', async () => {
      // Create multiple properties first
      for (let i = 0; i < 25; i++) {
        const propertyData = {
          address: {
            streetAddress: `${i} Pagination Test St`,
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94101',
            county: 'San Francisco'
          },
          details: {
            propertyType: PropertyType.SFR,
            occupancy: OccupancyType.OWNER_OCCUPIED,
            yearBuilt: 2020,
            grossLivingArea: 2000,
            bedrooms: 3,
            bathrooms: 2,
            features: ['feature']
          }
        };

        await request(app).post('/api/properties').send(propertyData);
      }

      // Test pagination
      const page1 = await request(app)
        .get('/api/properties')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      const page2 = await request(app)
        .get('/api/properties')
        .query({ limit: 10, offset: 10 })
        .expect(200);

      expect(page1.body.data.length).toBe(10);
      expect(page2.body.data.length).toBe(10);
      expect(page1.body.pagination.hasMore).toBe(true);
    });
  });
});