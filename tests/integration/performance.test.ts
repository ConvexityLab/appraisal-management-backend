// Performance and stress tests for the API
// Tests response times, concurrent requests, and resource usage

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { AppraisalManagementAPIServer } from '../../src/api/api-server'
import type { Application } from 'express'

describe.skipIf(!process.env.AZURE_COSMOS_ENDPOINT, 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server performance tests')('API Performance Tests', () => {
  let app: Application
  let server: AppraisalManagementAPIServer
  let authToken: string

  beforeAll(async () => {
    server = new AppraisalManagementAPIServer(0)
    app = server.getExpressApp()
    await server.initDb()

    // Obtain a test token via the test-token endpoint (ALLOW_TEST_TOKENS=true in non-production)
    const tokenRes = await request(app)
      .post('/api/auth/test-token')
      .send({ email: 'perf@appraisal.com', role: 'admin', name: 'Perf Test' })
    authToken = tokenRes.body.token ?? ''
  }, 60_000)

  describe('Response Time Tests', () => {
    it('should respond to health checks within 5000ms', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      // Allow up to 5 seconds for first request (includes DB initialization)
      expect(responseTimeMs).toBeLessThan(5000)
      expect(response.body.status).toBe('healthy')
    })

    it('should issue a test token within 200ms', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .post('/api/auth/test-token')
        .send({
          email: 'speed@appraisal.com',
          role: 'admin'
        })
        .expect(200)
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      expect(responseTimeMs).toBeLessThan(200)
      expect(response.body.token).toBeTruthy()
    })

    it('should execute simple code within 500ms', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'return Math.sqrt(144);',
          timeout: 1000
        })
        .expect(200)
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      expect(responseTimeMs).toBeLessThan(500)
      expect(response.body.success).toBe(true)
      expect(response.body.result).toBe(12)
    })
  })

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent health checks', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .get('/health')
          .expect(200)
      )

      const startTime = process.hrtime.bigint()
      const responses = await Promise.all(promises)
      const endTime = process.hrtime.bigint()
      const totalTimeMs = Number(endTime - startTime) / 1000000

      // All requests should succeed
      expect(responses).toHaveLength(10)
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy')
      })

      // Should complete within 2 seconds even with 10 concurrent requests
      expect(totalTimeMs).toBeLessThan(2000)
    })

    it('should handle 5 concurrent test-token requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/auth/test-token')
          .send({
            email: `concurrent${i}@appraisal.com`,
            role: 'admin'
          })
          .expect(200)
      )

      const startTime = process.hrtime.bigint()
      const responses = await Promise.all(promises)
      const endTime = process.hrtime.bigint()
      const totalTimeMs = Number(endTime - startTime) / 1000000

      // All requests should succeed
      expect(responses).toHaveLength(5)
      responses.forEach(response => {
        expect(response.body.token).toBeTruthy()
      })

      // Should complete within 3 seconds
      expect(totalTimeMs).toBeLessThan(3000)
    })

    it('should handle 3 concurrent code execution requests', async () => {
      const promises = Array.from({ length: 3 }, (_, index) =>
        request(app)
          .post('/api/code/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: `return ${index} * 100 + Math.random();`,
            timeout: 2000
          })
          .expect(200)
      )

      const startTime = process.hrtime.bigint()
      const responses = await Promise.all(promises)
      const endTime = process.hrtime.bigint()
      const totalTimeMs = Number(endTime - startTime) / 1000000

      // All requests should succeed
      expect(responses).toHaveLength(3)
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true)
        expect(response.body.result).toBeGreaterThanOrEqual(index * 100)
        expect(response.body.result).toBeLessThan((index + 1) * 100)
      })

      // Should complete within 5 seconds
      expect(totalTimeMs).toBeLessThan(5000)
    })
  })

  describe('Load Tests', () => {
    it('should handle rapid sequential requests', async () => {
      const requestCount = 20
      const results: number[] = []

      for (let i = 0; i < requestCount; i++) {
        const startTime = process.hrtime.bigint()
        
        const response = await request(app)
          .get('/health')
          .expect(200)
        
        const endTime = process.hrtime.bigint()
        const responseTimeMs = Number(endTime - startTime) / 1000000
        results.push(responseTimeMs)

        expect(response.body.status).toBe('healthy')
      }

      // Calculate performance metrics
      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length
      const maxResponseTime = Math.max(...results)
      const minResponseTime = Math.min(...results)

      console.log(`Performance Metrics (${requestCount} requests):`)
      console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`)
      console.log(`  Min: ${minResponseTime.toFixed(2)}ms`)
      console.log(`  Max: ${maxResponseTime.toFixed(2)}ms`)

      // Performance expectations
      expect(avgResponseTime).toBeLessThan(150) // Average under 150ms
      expect(maxResponseTime).toBeLessThan(500) // No request over 500ms
    })

    it('should maintain performance under mixed load', async () => {
      const healthPromises = Array.from({ length: 10 }, () =>
        request(app).get('/health').expect(200)
      )

      const authPromises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/auth/test-token')
          .send({
            email: `mixed${i}@appraisal.com`,
            role: 'admin'
          })
          .expect(200)
      )

      const codePromises = Array.from({ length: 2 }, (_, index) =>
        request(app)
          .post('/api/code/execute')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: `return "test-${index}-" + (Date.now() % 1000);`,
            timeout: 1000
          })
          .expect(200)
      )

      const startTime = process.hrtime.bigint()
      const allResponses = await Promise.all([
        ...healthPromises,
        ...authPromises,
        ...codePromises
      ])
      const endTime = process.hrtime.bigint()
      const totalTimeMs = Number(endTime - startTime) / 1000000

      // All requests should succeed
      expect(allResponses).toHaveLength(15)
      
      // Health checks
      allResponses.slice(0, 10).forEach(response => {
        expect(response.body.status).toBe('healthy')
      })

      // Test-token requests
      allResponses.slice(10, 13).forEach(response => {
        expect(response.body.token).toBeTruthy()
      })

      // Code execution requests
      allResponses.slice(13, 15).forEach(response => {
        expect(response.body.success).toBe(true)
        expect(response.body.result).toMatch(/test-\d+-\d+/)
      })

      // Should complete within reasonable time
      expect(totalTimeMs).toBeLessThan(5000)
      console.log(`Mixed load test completed in ${totalTimeMs.toFixed(2)}ms`)
    })
  })

  describe('Memory and Resource Tests', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage()
      
      // Make 50 requests to simulate sustained load
      for (let i = 0; i < 50; i++) {
        await request(app)
          .get('/health')
          .expect(200)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`Memory usage:`)
      console.log(`  Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`)

      // Heap growth should be minimal (less than 10MB for 50 simple requests)
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024)
    })

    it('should handle code execution with reasonable memory usage', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: `
            // Create some data but not excessive
            const data = Array.from({length: 1000}, (_, i) => ({
              id: i,
              value: Math.random(),
              timestamp: new Date().toISOString()
            }));
            return data.length;
          `,
          timeout: 2000
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.result).toBe(1000)
      
      // Should execute reasonably quickly
      expect(response.body.executionTime).toBeLessThan(1000)
    })
  })

  describe('Error Handling Performance', () => {
    it('should handle authentication failures quickly', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword'
        })
        .expect(401)
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      expect(responseTimeMs).toBeLessThan(200)
      // Server returns { error, code } for auth rejection (not success: false)
      expect(response.body.error).toBeTruthy()
    })

    it('should handle 404 errors quickly', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404)
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      expect(responseTimeMs).toBeLessThan(100)
      expect(response.body.error).toBe('Endpoint not found')
    })

    it('should handle code execution errors efficiently', async () => {
      const startTime = process.hrtime.bigint()
      
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'throw new Error("Intentional test error");',
          timeout: 1000
        })
        .expect(200) // Code executor returns 200 with success: false for thrown errors
      
      const endTime = process.hrtime.bigint()
      const responseTimeMs = Number(endTime - startTime) / 1000000
      
      expect(responseTimeMs).toBeLessThan(5000)
      expect(response.body.success).toBe(false)
    })
  })
})