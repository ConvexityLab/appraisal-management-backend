// Integration tests for the Production API Server
// Tests all endpoints and functionality

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { ProductionAPIServer } from '../../src/production-server'
import type { Application } from 'express'

describe('Production API Server Integration Tests', () => {
  let app: Application
  let server: ProductionAPIServer
  let authToken: string

  beforeAll(async () => {
    // Create server instance for testing
    server = new ProductionAPIServer(0) // Use random port
    app = server.getExpressApp()
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // Cleanup if needed
  })

  describe('Health and Status Endpoints', () => {
    it('should return healthy status from /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: '1.0.0',
          environment: expect.any(String),
          azure: expect.objectContaining({
            region: expect.any(String),
            appService: expect.any(String)
          })
        })
      )

      // Validate timestamp is a valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow()
    })

    it('should return API information from /api', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          name: 'Appraisal Management API',
          version: '1.0.0',
          description: expect.any(String),
          endpoints: expect.objectContaining({
            'GET /health': expect.any(String),
            'GET /api': expect.any(String),
            'POST /api/auth/login': expect.any(String),
            'POST /api/code/execute': expect.any(String),
            'GET /api/status': expect.any(String)
          }),
          azure: expect.objectContaining({
            deployed: expect.any(Boolean),
            resourceGroup: expect.any(String)
          })
        })
      )
    })

    it('should return system status from /api/status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          server: 'running',
          database: expect.any(String),
          storage: expect.any(String),
          serviceBus: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.objectContaining({
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number)
          }),
          environment: expect.objectContaining({
            nodeVersion: expect.any(String),
            platform: expect.any(String),
            nodeEnv: expect.any(String)
          })
        })
      )

      // Validate uptime is positive
      expect(response.body.uptime).toBeGreaterThan(0)
    })
  })

  describe('Authentication Endpoint', () => {
    it('should authenticate with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'demo@appraisal.com',
          password: 'demo123'
        })
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'demo@appraisal.com',
            role: 'admin'
          }),
          message: 'Authentication successful'
        })
      )

      // Store token for subsequent tests
      authToken = response.body.token
      expect(authToken).toBeTruthy()
      expect(authToken.length).toBeGreaterThan(50) // Base64 encoded should be reasonably long
    })

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword'
        })
        .expect(401)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Invalid credentials',
          hint: 'Use demo@appraisal.com / demo123'
        })
      )
    })

    it('should handle missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(401)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Invalid credentials'
        })
      )
    })

    it('should handle malformed request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400)

      // Should handle malformed JSON gracefully
    })
  })

  describe('Dynamic Code Execution Endpoint', () => {
    beforeEach(async () => {
      // Ensure we have a valid auth token for each test
      if (!authToken) {
        const authResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'demo@appraisal.com',
            password: 'demo123'
          })
          .expect(200)
        
        authToken = authResponse.body.token
      }
    })

    it('should execute simple JavaScript code', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'return Math.max(1, 2, 3, 4, 5);',
          timeout: 1000
        })
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          result: 5,
          executionTime: expect.any(Number),
          timestamp: expect.any(String)
        })
      )

      expect(response.body.executionTime).toBeGreaterThan(0)
      expect(response.body.executionTime).toBeLessThan(1000) // Should be fast
    })

    it('should execute code with context', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'return context.multiplier ? 10 * context.multiplier : 42;',
          context: { multiplier: 3 },
          timeout: 1000
        })
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          result: 30,
          executionTime: expect.any(Number)
        })
      )
    })

    it('should handle code execution errors gracefully', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'throw new Error("Test error");',
          timeout: 1000
        })
        .expect(500)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Code execution failed',
          timestamp: expect.any(String)
        })
      )
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .send({
          code: 'return 42;',
          timeout: 1000
        })
        .expect(401)

      // Should reject without proper authorization
    })

    it('should reject requests with invalid auth token', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          code: 'return 42;',
          timeout: 1000
        })
        .expect(401)

      // Should reject with invalid token
    })

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required 'code' field
          timeout: 1000
        })
        .expect(400)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Code is required'
        })
      )
    })

    it('should respect timeout limits', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'while(true) {}', // Infinite loop
          timeout: 100 // Short timeout
        })
        .expect(500)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Code execution failed'
        })
      )
    }, 10000) // Allow extra time for timeout test
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Endpoint not found',
          path: '/api/nonexistent',
          method: 'GET',
          availableEndpoints: expect.arrayContaining([
            'GET /health',
            'GET /api',
            'GET /api/status',
            'POST /api/auth/login',
            'POST /api/code/execute'
          ])
        })
      )
    })

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)

      // Should handle invalid JSON gracefully
    })

    it('should handle large request bodies', async () => {
      // Create a large JSON payload
      const largePayload = {
        email: 'test@example.com',
        password: 'password',
        largeData: 'x'.repeat(20 * 1024 * 1024) // 20MB
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(largePayload)
        .expect(413) // Payload too large

      // Should reject oversized requests
    })
  })

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      // Check for Helmet.js security headers
      expect(response.headers).toEqual(
        expect.objectContaining({
          'x-frame-options': expect.any(String),
          'x-content-type-options': expect.any(String),
          'x-dns-prefetch-control': expect.any(String),
          'x-download-options': expect.any(String),
          'x-permitted-cross-domain-policies': expect.any(String)
        })
      )
    })

    it('should set CORS headers correctly', async () => {
      const response = await request(app)
        .options('/health')
        .expect(204)

      expect(response.headers).toEqual(
        expect.objectContaining({
          'access-control-allow-origin': expect.any(String),
          'access-control-allow-methods': expect.stringMatching(/GET|POST|PUT|DELETE|OPTIONS/),
          'access-control-allow-headers': expect.stringMatching(/Content-Type|Authorization/)
        })
      )
    })
  })

  describe('Performance', () => {
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now()
      
      await request(app)
        .get('/health')
        .expect(200)
      
      const responseTime = Date.now() - startTime
      expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
    })

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/health')
          .expect(200)
      )

      const responses = await Promise.all(promises)
      
      // All requests should succeed
      expect(responses).toHaveLength(10)
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.status).toBe('healthy')
      })
    })
  })
})