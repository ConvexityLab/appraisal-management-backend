import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { OrderController } from '../src/controllers/order.controller.js';
import { VendorController } from '../src/controllers/vendor.controller.js';
import { PropertyController } from '../src/controllers/property.controller.js';
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
 * Comprehensive API Tests for CRUD Operations
 * Tests all fundamental entity management functionality
 */
describe('Comprehensive CRUD API Tests', () => {
  let app: express.Application;
  let orderController: OrderController;
  let vendorController: VendorController;
  let propertyController: PropertyController;

  beforeEach(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());

    // Initialize controllers
    orderController = new OrderController();
    vendorController = new VendorController();
    propertyController = new PropertyController();

    // Setup routes
    orderController.setupRoutes(app);
    vendorController.setupRoutes(app);
    propertyController.setupRoutes(app);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  // ===============================
  // Property CRUD Tests
  // ===============================

  describe('Property Management API', () => {
    let createdPropertyId: string;

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
        notes: 'Test property for API validation'
      }
    };

    it('should create a new property', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send(samplePropertyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('propertyId');
      expect(response.body.data.address.streetAddress).toBe(samplePropertyData.address.streetAddress);
      expect(response.body.data.details.propertyType).toBe(samplePropertyData.details.propertyType);

      createdPropertyId = response.body.data.propertyId;
    });

    it('should validate required fields when creating property', async () => {
      const incompleteData = {
        address: {
          streetAddress: 'Test Street'
          // Missing required fields
        },
        details: {}
      };

      const response = await request(app)
        .post('/api/properties')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should retrieve property by ID', async () => {
      // First create a property
      const createResponse = await request(app)
        .post('/api/properties')
        .send(samplePropertyData);

      const propertyId = createResponse.body.data.propertyId;

      // Then retrieve it
      const response = await request(app)
        .get(`/api/properties/${propertyId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(propertyId);
      expect(response.body.data.address.streetAddress).toBe(samplePropertyData.address.streetAddress);
    });

    it('should update property details', async () => {
      // First create a property
      const createResponse = await request(app)
        .post('/api/properties')
        .send(samplePropertyData);

      const propertyId = createResponse.body.data.propertyId;

      // Update the property
      const updates = {
        details: {
          yearBuilt: 2021,
          features: ['updated kitchen', 'new flooring']
        }
      };

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.details.yearBuilt).toBe(2021);
    });

    it('should delete property', async () => {
      // First create a property
      const createResponse = await request(app)
        .post('/api/properties')
        .send(samplePropertyData);

      const propertyId = createResponse.body.data.propertyId;

      // Delete the property
      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's deleted
      await request(app)
        .get(`/api/properties/${propertyId}`)
        .expect(404);
    });

    it('should list properties with pagination', async () => {
      // Create multiple properties first
      for (let i = 0; i < 3; i++) {
        const testData = {
          ...samplePropertyData,
          address: {
            ...samplePropertyData.address,
            streetAddress: `${i + 100} Test Street`
          }
        };
        await request(app).post('/api/properties').send(testData);
      }

      const response = await request(app)
        .get('/api/properties')
        .query({ limit: 2, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should search properties with filters', async () => {
      // Create properties with different characteristics
      const property1 = {
        ...samplePropertyData,
        address: { ...samplePropertyData.address, city: 'Oakland' },
        details: { ...samplePropertyData.details, propertyType: PropertyType.CONDO }
      };

      await request(app).post('/api/properties').send(property1);

      const response = await request(app)
        .get('/api/properties')
        .query({ 
          city: 'Oakland',
          propertyType: PropertyType.CONDO
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].address.city).toBe('Oakland');
    });

    it('should get property analytics', async () => {
      // Create a property first
      const createResponse = await request(app)
        .post('/api/properties')
        .send(samplePropertyData);

      const propertyId = createResponse.body.data.propertyId;

      const response = await request(app)
        .get(`/api/properties/${propertyId}/analytics`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('propertyOverview');
      expect(response.body.data).toHaveProperty('marketMetrics');
      expect(response.body.data).toHaveProperty('riskAssessment');
    });

    it('should validate property data', async () => {
      const validData = {
        address: samplePropertyData.address,
        details: samplePropertyData.details
      };

      const response = await request(app)
        .post('/api/properties/validate')
        .send(validData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBe(true);
    });

    it('should get property enums', async () => {
      const response = await request(app)
        .get('/api/properties/meta/enums')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('propertyTypes');
      expect(response.body.data).toHaveProperty('propertyConditions');
      expect(response.body.data.propertyTypes).toContain(PropertyType.SFR);
    });
  });

  // ===============================
  // Vendor CRUD Tests
  // ===============================

  describe('Vendor Management API', () => {
    const sampleVendorData = {
      name: 'Test Appraisal Services',
      email: 'test@appraisal.com',
      phone: '555-TEST',
      licenseNumber: 'TEST-12345',
      licenseState: 'CA',
      licenseExpiry: new Date('2025-12-31').toISOString(),
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

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(sampleVendorData.name);
      expect(response.body.data.licenseNumber).toBe(sampleVendorData.licenseNumber);
    });

    it('should validate required vendor fields', async () => {
      const incompleteData = {
        name: 'Test Vendor'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/vendors')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should retrieve vendor by ID', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      const vendorId = createResponse.body.data.id;

      // Retrieve vendor
      const response = await request(app)
        .get(`/api/vendors/${vendorId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(vendorId);
      expect(response.body.data.name).toBe(sampleVendorData.name);
    });

    it('should update vendor information', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      const vendorId = createResponse.body.data.id;

      // Update vendor
      const updates = {
        phone: '555-UPDATED',
        preferences: {
          maxOrdersPerDay: 10
        }
      };

      const response = await request(app)
        .put(`/api/vendors/${vendorId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBe('555-UPDATED');
    });

    it('should list vendors with filtering', async () => {
      // Create multiple vendors
      const vendor1 = { ...sampleVendorData, name: 'Vendor A', licenseState: 'CA' };
      const vendor2 = { ...sampleVendorData, name: 'Vendor B', licenseState: 'TX' };

      await request(app).post('/api/vendors').send(vendor1);
      await request(app).post('/api/vendors').send(vendor2);

      const response = await request(app)
        .get('/api/vendors')
        .query({ licenseState: 'CA' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search vendors', async () => {
      // Create vendor first
      await request(app).post('/api/vendors').send(sampleVendorData);

      const response = await request(app)
        .post('/api/vendors/search')
        .send({
          name: 'Test Appraisal',
          licenseState: 'CA'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get vendor performance metrics', async () => {
      // Create vendor first
      const createResponse = await request(app)
        .post('/api/vendors')
        .send(sampleVendorData);

      const vendorId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/vendors/${vendorId}/performance`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performanceMetrics');
      expect(response.body.data).toHaveProperty('orderHistory');
    });
  });

  // ===============================
  // Order CRUD Tests
  // ===============================

  describe('Order Management API', () => {
    let createdVendorId: string;
    let createdPropertyId: string;

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
    };

    beforeEach(async () => {
      // Create a vendor for order assignment tests
      const vendorResponse = await request(app)
        .post('/api/vendors')
        .send({
          name: 'Order Test Vendor',
          email: 'ordertest@vendor.com',
          phone: '555-VENDOR',
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

      createdVendorId = vendorResponse.body.data.id;
    });

    it('should create a new order', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send(sampleOrderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.orderNumber).toBe(sampleOrderData.orderNumber);
      expect(response.body.data.status).toBe(OrderStatus.NEW);
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

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should retrieve order by ID', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      const orderId = createResponse.body.data.id;

      // Retrieve order
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(orderId);
      expect(response.body.data.orderNumber).toBe(sampleOrderData.orderNumber);
    });

    it('should update order status', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      const orderId = createResponse.body.data.id;

      // Update order status
      const updates = {
        status: OrderStatus.IN_PROGRESS,
        specialInstructions: 'Updated instructions'
      };

      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(OrderStatus.IN_PROGRESS);
    });

    it('should assign vendor to order', async () => {
      // Create order first
      const createResponse = await request(app)
        .post('/api/orders')
        .send(sampleOrderData);

      const orderId = createResponse.body.data.id;

      // Assign vendor
      const response = await request(app)
        .post(`/api/orders/${orderId}/assign`)
        .send({ vendorId: createdVendorId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedVendorId).toBe(createdVendorId);
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

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should search orders', async () => {
      // Create order first
      await request(app).post('/api/orders').send(sampleOrderData);

      const response = await request(app)
        .post('/api/orders/search')
        .send({
          clientId: 'test-client-001',
          productType: ProductType.FULL_APPRAISAL
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
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
        phone: '555-INTEG',
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
          phone: '555-TEST'
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
          phone: '555-LO',
          preferredMethod: 'email'
        },
        priority: Priority.NORMAL
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .send(orderData);

      expect(orderResponse.status).toBe(201);

      // 4. Assign vendor to order
      const assignResponse = await request(app)
        .post(`/api/orders/${orderResponse.body.data.id}/assign`)
        .send({ vendorId: vendorResponse.body.data.id });

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.data.assignedVendorId).toBe(vendorResponse.body.data.id);

      // 5. Update order status
      const statusResponse = await request(app)
        .put(`/api/orders/${orderResponse.body.data.id}`)
        .send({ status: OrderStatus.IN_PROGRESS });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.status).toBe(OrderStatus.IN_PROGRESS);
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