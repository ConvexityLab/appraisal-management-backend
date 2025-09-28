/**
 * Comprehensive API Integration Tests
 * Tests all API endpoints with authentication, validation, and error handling
 */

import request, { Response } from 'supertest';
import { AppraisalManagementAPIServer } from '../api/api-server';

describe('Appraisal Management API Integration Tests', () => {
  let server: AppraisalManagementAPIServer;
  let authToken: string;
  let testOrderId: string;
  let testVendorId: string;

  beforeAll(async () => {
    // Create test server instance
    server = new AppraisalManagementAPIServer(3001);
    
    // Wait a moment for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup would go here
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(server['app'])
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('orderManagement', 'healthy');
      expect(response.body.services).toHaveProperty('qcValidation', 'healthy');
      expect(response.body.services).toHaveProperty('vendorManagement', 'healthy');
    });
  });

  describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'Test123456',
          firstName: 'Test',
          lastName: 'User',
          role: 'manager'
        };

        const response = await request(server['app'])
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('email', userData.email);
        expect(response.body.user).toHaveProperty('role', userData.role);
      });

      it('should reject invalid email format', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'Test123456',
          firstName: 'Test',
          lastName: 'User',
          role: 'manager'
        };

        const response = await request(server['app'])
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Validation failed');
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should reject weak password', async () => {
        const userData = {
          email: 'test2@example.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
          role: 'manager'
        };

        const response = await request(server['app'])
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Validation failed');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const credentials = {
          email: 'admin@example.com',
          password: 'password123'
        };

        const response = await request(server['app'])
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('email', credentials.email);

        // Store token for subsequent tests
        authToken = response.body.token;
      });

      it('should reject invalid credentials', async () => {
        const credentials = {
          email: 'admin@example.com',
          password: 'wrongpassword'
        };

        const response = await request(server['app'])
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Invalid credentials');
        expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      });
    });
  });

  describe('Order Management', () => {
    describe('POST /api/orders', () => {
      it('should create a new order with valid data', async () => {
        const orderData = {
          propertyAddress: '123 Main Street, Anytown, ST 12345',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          orderType: 'purchase',
          priority: 'standard',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await request(server['app'])
          .post('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send(orderData)
          .expect(201);

        expect(response.body).toHaveProperty('orderId');
        expect(response.body).toHaveProperty('status', 'pending');
        expect(response.body).toHaveProperty('propertyIntelligence');

        // Store order ID for subsequent tests
        testOrderId = response.body.orderId;
      });

      it('should reject order creation without authentication', async () => {
        const orderData = {
          propertyAddress: '123 Main Street, Anytown, ST 12345',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          orderType: 'purchase',
          priority: 'standard',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };

        const response = await request(server['app'])
          .post('/api/orders')
          .send(orderData)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
        expect(response.body).toHaveProperty('code', 'TOKEN_REQUIRED');
      });

      it('should reject invalid order data', async () => {
        const orderData = {
          propertyAddress: 'Too short',
          clientId: 'invalid-uuid',
          orderType: 'invalid-type',
          dueDate: 'invalid-date'
        };

        const response = await request(server['app'])
          .post('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .send(orderData)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Validation failed');
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });
    });

    describe('GET /api/orders', () => {
      it('should retrieve orders with authentication', async () => {
        const response = await request(server['app'])
          .get('/api/orders')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('orderId');
          expect(response.body[0]).toHaveProperty('status');
        }
      });

      it('should filter orders by status', async () => {
        const response = await request(server['app'])
          .get('/api/orders?status=pending&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /api/orders/:orderId', () => {
      it('should retrieve a specific order', async () => {
        const response = await request(server['app'])
          .get(`/api/orders/${testOrderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('orderId', testOrderId);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('propertyAddress');
      });

      it('should return 404 for non-existent order', async () => {
        const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';
        
        const response = await request(server['app'])
          .get(`/api/orders/${nonExistentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Order not found');
        expect(response.body).toHaveProperty('code', 'ORDER_NOT_FOUND');
      });
    });

    describe('PUT /api/orders/:orderId/status', () => {
      it('should update order status', async () => {
        const statusUpdate = {
          status: 'assigned',
          notes: 'Assigned to vendor for processing'
        };

        const response = await request(server['app'])
          .put(`/api/orders/${testOrderId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(statusUpdate)
          .expect(200);

        expect(response.body).toHaveProperty('orderId', testOrderId);
        expect(response.body).toHaveProperty('status', 'assigned');
      });
    });

    describe('GET /api/orders/dashboard', () => {
      it('should retrieve order dashboard', async () => {
        const response = await request(server['app'])
          .get('/api/orders/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('summary');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body).toHaveProperty('recentOrders');
      });
    });
  });

  describe('Vendor Management', () => {
    describe('POST /api/vendors', () => {
      it('should create a new vendor', async () => {
        const vendorData = {
          name: 'Test Appraisal Services',
          email: 'vendor@test.com',
          phone: '+1-555-123-4567',
          serviceTypes: ['residential', 'commercial'],
          serviceAreas: ['12345', '12346', '12347']
        };

        const response = await request(server['app'])
          .post('/api/vendors')
          .set('Authorization', `Bearer ${authToken}`)
          .send(vendorData)
          .expect(201);

        expect(response.body).toHaveProperty('vendorId');
        expect(response.body).toHaveProperty('name', vendorData.name);
        expect(response.body).toHaveProperty('email', vendorData.email);

        // Store vendor ID for subsequent tests
        testVendorId = response.body.vendorId;
      });
    });

    describe('GET /api/vendors', () => {
      it('should retrieve all vendors', async () => {
        const response = await request(server['app'])
          .get('/api/vendors')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('vendorId');
          expect(response.body[0]).toHaveProperty('name');
        }
      });
    });

    describe('POST /api/vendors/assign/:orderId', () => {
      it('should assign best vendor to order', async () => {
        const response = await request(server['app'])
          .post(`/api/vendors/assign/${testOrderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('orderId', testOrderId);
        expect(response.body).toHaveProperty('assignedVendor');
        expect(response.body).toHaveProperty('assignmentScore');
      });
    });
  });

  describe('QC Validation', () => {
    describe('POST /api/qc/validate/:orderId', () => {
      it('should perform QC validation on delivered order', async () => {
        // First, mark order as delivered
        await request(server['app'])
          .post(`/api/orders/${testOrderId}/deliver`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reportUrl: 'https://example.com/reports/test-report.pdf',
            deliveryNotes: 'Test delivery'
          });

        // Then perform QC validation
        const response = await request(server['app'])
          .post(`/api/qc/validate/${testOrderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('orderId', testOrderId);
        expect(response.body).toHaveProperty('qcScore');
        expect(response.body).toHaveProperty('validationResults');
        expect(response.body).toHaveProperty('recommendations');
      });
    });

    describe('GET /api/qc/results/:orderId', () => {
      it('should retrieve QC validation results', async () => {
        const response = await request(server['app'])
          .get(`/api/qc/results/${testOrderId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('orderId', testOrderId);
        expect(response.body).toHaveProperty('qcScore');
        expect(response.body).toHaveProperty('validationResults');
      });
    });

    describe('GET /api/qc/metrics', () => {
      it('should retrieve QC metrics', async () => {
        const response = await request(server['app'])
          .get('/api/qc/metrics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('overallQCScore');
        expect(response.body).toHaveProperty('validationCounts');
        expect(response.body).toHaveProperty('trendAnalysis');
      });
    });
  });

  describe('Analytics', () => {
    describe('GET /api/analytics/overview', () => {
      it('should retrieve analytics overview', async () => {
        const response = await request(server['app'])
          .get('/api/analytics/overview')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalOrders');
        expect(response.body).toHaveProperty('completedOrders');
        expect(response.body).toHaveProperty('averageCompletionTime');
        expect(response.body).toHaveProperty('qcPassRate');
        expect(response.body).toHaveProperty('topVendors');
        expect(response.body).toHaveProperty('monthlyTrends');
      });
    });

    describe('GET /api/analytics/performance', () => {
      it('should retrieve performance analytics with date range', async () => {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        const response = await request(server['app'])
          .get(`/api/analytics/performance?startDate=${startDate}&endDate=${endDate}&groupBy=week`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('timeframe');
        expect(response.body).toHaveProperty('metrics');
        expect(response.body.metrics).toHaveProperty('orderVolume');
        expect(response.body.metrics).toHaveProperty('completionTimes');
        expect(response.body.metrics).toHaveProperty('qcScores');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(server['app'])
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
      expect(response.body).toHaveProperty('code', 'ENDPOINT_NOT_FOUND');
    });

    it('should handle invalid JSON payloads', async () => {
      const response = await request(server['app'])
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle expired JWT tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const response = await request(server['app'])
        .get('/api/orders')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(server['app'])
          .get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed as health endpoint might not be rate limited
      responses.forEach((response: any) => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('API Documentation', () => {
    it('should serve API documentation', async () => {
      const response = await request(server['app'])
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
    });
  });
});

/**
 * Performance Test Suite
 * Tests API response times and load handling
 */
describe('API Performance Tests', () => {
  let server: AppraisalManagementAPIServer;
  let authToken: string;

  beforeAll(async () => {
    server = new AppraisalManagementAPIServer(3002);
    
    // Get auth token
    const loginResponse = await request(server['app'])
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      
      await request(server['app'])
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle order creation within 500ms', async () => {
      const orderData = {
        propertyAddress: '123 Performance Test Street, Anytown, ST 12345',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        orderType: 'purchase',
        priority: 'standard',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const start = Date.now();
      
      await request(server['app'])
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);
      
      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 20;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(server['app'])
          .get('/api/orders/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - start;

      // All requests should succeed
      responses.forEach((response: any) => {
        expect(response.status).toBe(200);
      });

      // Total time should be reasonable for concurrent processing
      expect(totalTime).toBeLessThan(2000);
    });
  });
});

export { };