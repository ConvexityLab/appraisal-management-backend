/**
 * Minimal Server Integration Tests
 * 
 * Tests only the endpoints actually available in the minimal server
 * configuration (no database required)
 */

import { describe, test, beforeAll, expect } from 'vitest';

const API_BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 15000;

// Test coordinates
const TEST_COORDINATES = {
  latitude: 37.4224764,
  longitude: -122.0842499
};

let authToken: string = '';

describe('Minimal Server Integration Tests', () => {
  
  beforeAll(async () => {
    console.log('🧪 Setting up test environment...');
    
    // Verify server connectivity
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Server not responding: ${response.status}`);
      }
      console.log('✅ Connected to minimal server');
      
      // Get authentication token for protected endpoints
      const authResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@example.com',
          password: 'demo123'
        })
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        authToken = authData.token;
        console.log('✅ Authentication token obtained');
      }
      
    } catch (error) {
      throw new Error(`❌ Cannot connect to server at ${API_BASE_URL}: ${error}`);
    }
    
    console.log('✅ Test environment ready');
  }, TEST_TIMEOUT);

  describe('Basic Server Health', () => {
    test('should respond to health check', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();
      expect(result.services.propertyIntelligence).toBe('active');
      expect(result.services.dynamicCodeExecution).toBe('active');
      
      console.log('✅ Health check successful');
    }, TEST_TIMEOUT);
  });

  describe('Authentication', () => {
    test('should authenticate with demo credentials', async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@example.com',
          password: 'demo123'
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('demo@example.com');
      
      console.log('✅ Authentication successful');
    }, TEST_TIMEOUT);

    test('should reject invalid credentials', async () => {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'wrong@example.com',
          password: 'wrong123'
        })
      });

      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.error).toBe('Invalid credentials');
      
      console.log('✅ Invalid credentials properly rejected');
    }, TEST_TIMEOUT);
  });

  describe('Property Intelligence - Available Endpoints', () => {
    test('should get property intelligence health status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/health`);
      
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('healthy');
      
      console.log('✅ Property intelligence health check successful');
    }, TEST_TIMEOUT);

    test('should perform address geocoding with authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/geocode`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      console.log('✅ Address geocoding successful');
      console.log(`   � Coordinates: ${result.data.latitude}, ${result.data.longitude}`);
    }, TEST_TIMEOUT);

    test('should perform comprehensive property analysis with authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          latitude: TEST_COORDINATES.latitude,
          longitude: TEST_COORDINATES.longitude,
          strategy: 'quality_first'
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      console.log('✅ Comprehensive property analysis successful');
      if (result.data.riskAssessment) {
        console.log(`   🎯 Risk Score: ${result.data.riskAssessment.overallRiskScore || 'N/A'}`);
      }
    }, TEST_TIMEOUT);

    test('should reject requests without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/property-intelligence/address/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '1600 Amphitheatre Parkway, Mountain View, CA 94043'
        })
      });

      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.error).toBe('Access token required');
      expect(result.code).toBe('TOKEN_REQUIRED');
      
      console.log('✅ Unauthenticated requests properly rejected');
    }, TEST_TIMEOUT);
  });

  describe('Dynamic Code Execution', () => {
    test('should execute simple JavaScript code with authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          code: 'return { result: 2 + 2, message: "Hello from dynamic execution!" };',
          timeout: 5000
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.result.result).toBe(4);
      
      console.log('✅ Dynamic code execution successful');
      console.log(`   💻 Result: ${JSON.stringify(result.result)}`);
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

      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          code: loanCalculationCode,
          context: {
            principal: 500000,
            annualRate: 0.0675,
            years: 30
          }
        })
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.result.monthlyPayment).toBeGreaterThan(0);
      
      console.log('✅ Loan calculation successful');
      console.log(`   🏠 $${result.result.principal} at ${result.result.annualRate}% for ${result.result.years} years`);
      console.log(`   💰 Monthly Payment: $${result.result.monthlyPayment}`);
      console.log(`   📊 Total Interest: $${result.result.totalInterest}`);
    }, TEST_TIMEOUT);

    test('should reject code execution without authentication', async () => {
      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'return { test: true };'
        })
      });

      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.error).toBe('Access token required');
      
      console.log('✅ Unauthenticated code execution properly rejected');
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent endpoints', async () => {
      const response = await fetch(`${API_BASE_URL}/api/non-existent-endpoint`);
      
      expect(response.status).toBe(404);
      
      const result = await response.json();
      expect(result.error).toBe('Endpoint not found');
      expect(result.code).toBe('NOT_FOUND');
      
      console.log('✅ 404 errors handled correctly');
    }, TEST_TIMEOUT);

    test('should handle malformed requests', async () => {
      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          // Missing required 'code' field
          context: {}
        })
      });

      expect(response.status).toBe(400);
      
      const result = await response.json();
      expect(result.error).toBe('Validation failed');
      expect(result.code).toBe('VALIDATION_ERROR');
      
      console.log('✅ Validation errors handled correctly');
    }, TEST_TIMEOUT);
  });
});