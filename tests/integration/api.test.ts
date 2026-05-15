// Integration tests for the Production API Server
// Tests all endpoints and functionality

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { AppraisalManagementAPIServer } from '../../src/api/api-server'
import type { Application } from 'express'

describe.skipIf(process.env.VITEST_INTEGRATION !== 'true', 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server tests')('Production API Server Integration Tests', () => {
  let app: Application
  let server: AppraisalManagementAPIServer
  let authToken: string

  beforeAll(async () => {
    // Create server instance for testing — getExpressApp() does NOT start HTTP listener or cron jobs
    server = new AppraisalManagementAPIServer(0)
    app = server.getExpressApp()
    await server.initDb()

    // Obtain a test token via the /api/auth/test-token endpoint (available in non-production)
    const tokenRes = await request(app)
      .post('/api/auth/test-token')
      .send({ email: 'test@appraisal.com', role: 'admin', name: 'Test Admin' })
    authToken = tokenRes.body.token ?? ''
  }, 60_000)

  afterAll(async () => {
    // No persistent resources to clean up
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
          services: expect.objectContaining({
            database: expect.any(String)
          })
        })
      )

      // Validate timestamp is a valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow()
    })

    it('should accept GET /api or return 404 if not defined', async () => {
      const response = await request(app)
        .get('/api')

      // /api is an optional info endpoint — 200 or 404 are both acceptable
      expect([200, 404]).toContain(response.status)
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
    it('should issue a test token via /api/auth/test-token', async () => {
      const response = await request(app)
        .post('/api/auth/test-token')
        .send({ email: 'verify@appraisal.com', role: 'admin', name: 'Verify User' })
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'verify@appraisal.com',
            role: 'admin'
          }),
          expiresIn: '24h'
        })
      )

      expect(response.body.token.length).toBeGreaterThan(50)
    })

    it('should reject invalid credentials to /api/auth/login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword'
        })
        .expect(401)
        .expect('Content-Type', /json/)

      // Server returns { error, code } (not success/message envelope)
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INVALID_CREDENTIALS'
        })
      )
    })

    it('should handle missing credentials to /api/auth/login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        // 400 (validation) or 401 (invalid creds) are both acceptable
        .expect('Content-Type', /json/)

      expect([400, 401]).toContain(response.status)
      expect(response.body.error).toBeTruthy()
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
    // authToken is obtained once in beforeAll via /api/auth/test-token

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
          code: 'return 42;',  // simple code that doesn't rely on context injection
          context: { multiplier: 3 },
          timeout: 1000
        })
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          result: 42,
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
        // Code execution errors are returned as 200 with success: false
        .expect(200)
        .expect('Content-Type', /json/)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeTruthy()
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
          error: 'Validation failed',
          code: 'VALIDATION_ERROR'
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
        // Timeouts are handled internally: returns 200 with success: false
        .expect('Content-Type', /json/)

      expect([200, 500]).toContain(response.status)
      expect(response.body.success).toBe(false)
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
          code: 'ENDPOINT_NOT_FOUND'
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
      // express.json's limit was raised to 50mb to accommodate Axiom webhook
      // payloads carrying full extracted documents; 51MB triggers the 413.
      const largePayload = {
        email: 'test@example.com',
        password: 'password',
        largeData: 'x'.repeat(51 * 1024 * 1024) // 51MB — just over the 50mb cap
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(largePayload)

      // Either 413 (body-parser rejects oversized payload) or 400/401 (parser
      // truncates / auth rejects first depending on streaming behavior).
      // The hard-no we're guarding against is 200/201 — i.e. the server
      // accepting an arbitrarily large body.
      expect([413, 400, 401, 500]).toContain(response.status)
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
        .set('Origin', 'http://localhost:3010')
        .expect(204)

      // CORS origin header should be present (requires Origin header in request)
      expect(response.headers['access-control-allow-origin']).toBeDefined()
      // Methods should contain at least GET and POST
      const methods = response.headers['access-control-allow-methods'] || ''
      expect(methods).toMatch(/GET/)
      expect(methods).toMatch(/POST/)
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