import request from 'supertest';
import { ProductionAPIServer } from '../production-server';

describe('API Integration Tests', () => {
  let server: ProductionAPIServer;
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    // Start the server for testing
    server = new ProductionAPIServer(0); // Use port 0 to get a random available port
    app = server.getExpressApp();
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up after tests
    if (server) {
      // Server cleanup if needed
    }
  });

  describe('Health and Info Endpoints', () => {
    test('GET /health should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        environment: expect.any(String),
        azure: {
          region: 'unknown',
          appService: 'local'
        }
      });

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('GET /api should return API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Appraisal Management API',
        version: '1.0.0',
        description: 'Production-ready appraisal management platform',
        endpoints: {
          'GET /health': 'Health check',
          'GET /api': 'API information',
          'POST /api/auth/login': 'Authentication',
          'POST /api/code/execute': 'Dynamic code execution',
          'GET /api/status': 'System status'
        },
        azure: {
          deployed: false,
          resourceGroup: 'unknown'
        }
      });
    });

    test('GET /api/status should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toMatchObject({
        server: 'running',
        database: 'not_configured',
        storage: 'not_configured',
        serviceBus: 'not_configured',
        uptime: expect.any(Number),
        memory: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        },
        environment: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          nodeEnv: expect.any(String)
        }
      });

      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.memory.rss).toBeGreaterThan(0);
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login should authenticate valid credentials', async () => {
      const credentials = {
        email: 'demo@appraisal.com',
        password: 'demo123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          email: 'demo@appraisal.com',
          role: 'admin'
        },
        message: 'Authentication successful'
      });

      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);

      // Store token for subsequent tests
      authToken = response.body.token;
    });

    test('POST /api/auth/login should reject invalid credentials', async () => {
      const invalidCredentials = {
        email: 'wrong@email.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid credentials',
        hint: 'Use demo@appraisal.com / demo123'
      });
    });

    test('POST /api/auth/login should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('POST /api/auth/login should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });
  });

  describe('Dynamic Code Execution Endpoints', () => {
    beforeEach(() => {
      // Ensure we have an auth token
      if (!authToken) {
        throw new Error('Auth token not available. Authentication test may have failed.');
      }
    });

    test('POST /api/code/execute should execute simple JavaScript code', async () => {
      const codeRequest = {
        code: 'return Math.max(1, 2, 3, 4, 5);',
        timeout: 1000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        result: 5,
        timestamp: expect.any(String)
      });

      expect(response.body.executionTime).toBeGreaterThanOrEqual(0);
      expect(response.body.executionTime).toBeLessThan(1000);
    });

    test('POST /api/code/execute should execute code with context', async () => {
      const codeRequest = {
        code: 'return context.multiplier ? context.value * context.multiplier : context.value;',
        context: {
          value: 10,
          multiplier: 5
        },
        timeout: 1000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        result: 50,
        timestamp: expect.any(String)
      });
    });

    test('POST /api/code/execute should handle code execution errors', async () => {
      const codeRequest = {
        code: 'throw new Error("Test error");',
        timeout: 1000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Code execution failed',
        timestamp: expect.any(String)
      });
    });

    test('POST /api/code/execute should require authentication', async () => {
      const codeRequest = {
        code: 'return 42;',
        timeout: 1000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .send(codeRequest)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('POST /api/code/execute should handle missing code', async () => {
      const codeRequest = {
        timeout: 1000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Code is required'
      });
    });

    test('POST /api/code/execute should handle complex code execution', async () => {
      const codeRequest = {
        code: `
          const numbers = [1, 2, 3, 4, 5];
          const sum = numbers.reduce((acc, num) => acc + num, 0);
          const average = sum / numbers.length;
          return {
            sum,
            average,
            count: numbers.length,
            timestamp: new Date().getTime()
          };
        `,
        timeout: 2000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result).toMatchObject({
        sum: 15,
        average: 3,
        count: 5,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent should return 404 with helpful error', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Endpoint not found',
        path: '/api/nonexistent',
        method: 'GET',
        availableEndpoints: [
          'GET /health',
          'GET /api',
          'GET /api/status',
          'POST /api/auth/login',
          'POST /api/code/execute'
        ]
      });
    });

    test('POST /api/nonexistent should return 404', async () => {
      const response = await request(app)
        .post('/api/nonexistent')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.method).toBe('POST');
    });

    test('PUT /api/status should return 404', async () => {
      const response = await request(app)
        .put('/api/status')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.method).toBe('PUT');
    });
  });

  describe('Security Headers', () => {
    test('All endpoints should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers added by Helmet
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    test('CORS headers should be present', async () => {
      const response = await request(app)
        .options('/api')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    test('Health endpoint should respond quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
    });

    test('API should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/health')
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      expect(totalTime).toBeLessThan(5000); // All 10 requests should complete in under 5 seconds
      
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Data Validation', () => {
    test('Authentication should validate email format', async () => {
      const invalidEmailCredentials = {
        email: 'not-an-email',
        password: 'demo123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidEmailCredentials)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('Code execution should handle large payloads', async () => {
      const largeCode = 'return ' + JSON.stringify({ data: 'x'.repeat(1000) }) + ';';
      
      const codeRequest = {
        code: largeCode,
        timeout: 2000
      };

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send(codeRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.data).toHaveLength(1000);
    });
  });
});