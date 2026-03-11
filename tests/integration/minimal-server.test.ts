/**
 * Minimal Server Integration Tests
 * 
 * Tests only the endpoints actually available in the minimal server
 * configuration (no database required)
 */

import { describe, test, beforeAll, expect } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';

const TEST_TIMEOUT = 15000;

// Test coordinates
const TEST_COORDINATES = {
  latitude: 37.4224764,
  longitude: -122.0842499
};

describe.skipIf(!process.env.AZURE_COSMOS_ENDPOINT, 'AZURE_COSMOS_ENDPOINT not set — skipping in-process API server tests')('Minimal Server Integration Tests', () => {
  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;
  let authToken: string = '';

  beforeAll(async () => {
    console.log('🧪 Setting up test environment...');

    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    await serverInstance.initDb();

    // Get authentication token via test-token endpoint (no DB required)
    const tokenRes = await request(app)
      .post('/api/auth/test-token')
      .send({ email: 'admin@appraisal.com', role: 'admin', name: 'Test Admin' });
    authToken = tokenRes.body.token ?? '';
    if (authToken) {
      console.log('✅ Test token obtained');
    }

    console.log('✅ Test environment ready');
  }, 60_000);

  describe('Basic Server Health', () => {
    test('should respond to health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
      // Services object includes database, orderManagement, etc.
      expect(response.body.version).toBe('1.0.0');

      console.log('✅ Health check successful');
    }, TEST_TIMEOUT);
  });

  describe('Authentication', () => {
    // NOTE: /api/auth/login requires a real user in the database.
    // /api/auth/test-token works without DB and is the correct endpoint for in-process tests.
    test('should issue a test token via /api/auth/test-token', async () => {
      const response = await request(app)
        .post('/api/auth/test-token')
        .send({
          email: 'admin@appraisal.com',
          role: 'admin',
          name: 'Test Admin'
        });

      expect(response.status).toBe(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('admin@appraisal.com');

      console.log('✅ Test token endpoint successful');
    }, TEST_TIMEOUT);

    test('should reject invalid credentials for login endpoint', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrong123'
        });

      expect(response.status).toBe(401);

      expect(response.body.error).toBe('Invalid credentials');

      console.log('✅ Invalid credentials properly rejected');
    }, TEST_TIMEOUT);
  });

  describe('Property Intelligence - Available Endpoints', () => {
    test('should get property intelligence health status', async () => {
      const response = await request(app).get('/api/property-intelligence/health');

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');

      console.log('✅ Property intelligence health check successful');
    }, TEST_TIMEOUT);

    test('should perform address geocoding with authentication', async () => {
      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('✅ Address geocoding successful');
      console.log(`   Coordinates: ${response.body.data.latitude}, ${response.body.data.longitude}`);
    }, TEST_TIMEOUT);


    test('should perform comprehensive property analysis with authentication', async () => {
      const response = await request(app)
        .post('/api/property-intelligence/analyze/comprehensive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          latitude: TEST_COORDINATES.latitude,
          longitude: TEST_COORDINATES.longitude,
          strategy: 'quality_first'
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      console.log('✅ Comprehensive property analysis successful');
      if (response.body.data.riskAssessment) {
        console.log(`   🎯 Risk Score: ${response.body.data.riskAssessment.overallRiskScore || 'N/A'}`);
      }
    }, TEST_TIMEOUT);

    test('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/property-intelligence/address/geocode')
        .send({
          address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
        });

      expect(response.status).toBe(401);

      expect(response.body.error).toBe('Authentication required');
      expect(response.body.code).toBe('NO_AUTH_TOKEN');
    }, TEST_TIMEOUT);
  });

  describe('Dynamic Code Execution', () => {
    test('should execute simple JavaScript code with authentication', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'return { result: 2 + 2, message: "Hello from dynamic execution!" };',
          timeout: 5000
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.result).toBe(4);

      console.log('✅ Dynamic code execution successful');
      console.log(`   💻 Result: ${JSON.stringify(response.body.result)}`);
    }, TEST_TIMEOUT);

    test('should calculate loan payment with dynamic code', async () => {
      const loanCalculationCode = `
        const principal = context.principal || 300000;
        const annualRate = context.annualRate || 0.05;
        const years = context.years || 30;
        
        const monthlyRate = annualRate / 12;
        const numberOfPayments = years * 12;
        
        const monthlyPayment = principal * 
          (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
        
        return {
          principal,
          annualRate: annualRate * 100,
          years,
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          totalPayment: Math.round(monthlyPayment * numberOfPayments * 100) / 100,
          totalInterest: Math.round((monthlyPayment * numberOfPayments - principal) * 100) / 100
        };
      `;

      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: loanCalculationCode,
          context: {
            principal: 500000,
            annualRate: 0.0675,
            years: 30
          }
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.monthlyPayment).toBeGreaterThan(0);

      console.log('✅ Loan calculation successful');
      console.log(`   🏠 $${response.body.result.principal} at ${response.body.result.annualRate}% for ${response.body.result.years} years`);
      console.log(`   💰 Monthly Payment: $${response.body.result.monthlyPayment}`);
      console.log(`   📊 Total Interest: $${response.body.result.totalInterest}`);
    }, TEST_TIMEOUT);

    test('should reject code execution without authentication', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .send({
          code: 'return { test: true };'
        });

      expect(response.status).toBe(401);

      expect(response.body.error).toBe('Authentication required');

      console.log('✅ Unauthenticated code execution properly rejected');
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await request(app).get('/api/non-existent-endpoint');

      expect(response.status).toBe(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.code).toBe('ENDPOINT_NOT_FOUND');

      console.log('✅ 404 errors handled correctly');
    }, TEST_TIMEOUT);

    test('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/code/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required 'code' field
          context: {}
        });

      expect(response.status).toBe(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');

      console.log('✅ Validation errors handled correctly');
    }, TEST_TIMEOUT);
  });
});