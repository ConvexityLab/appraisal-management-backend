/**
 * Azure Entra ID Authentication Test
 * 
 * This demonstrates how to test the Azure Entra ID integration
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

/**
 * Test 1: Development Mode (Bypass Auth)
 */
async function testDevMode() {
  console.log('\n=== Test 1: Development Mode (BYPASS_AUTH=true) ===\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/orders`);
    console.log('✅ Request succeeded without token (dev mode)');
    console.log('Response status:', response.status);
    console.log('User context:', response.config.headers);
  } catch (error: any) {
    console.error('❌ Request failed:', error.response?.data || error.message);
  }
}

/**
 * Test 2: Production Mode (No Token)
 */
async function testNoToken() {
  console.log('\n=== Test 2: Production Mode - No Token ===\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/orders`);
    console.log('❌ Request should have failed but succeeded');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✅ Request correctly rejected with 401');
      console.log('Error:', error.response.data);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

/**
 * Test 3: Production Mode (Invalid Token)
 */
async function testInvalidToken() {
  console.log('\n=== Test 3: Production Mode - Invalid Token ===\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/orders`, {
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    });
    console.log('❌ Request should have failed but succeeded');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✅ Invalid token correctly rejected with 401');
      console.log('Error:', error.response.data);
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

/**
 * Test 4: Production Mode (Valid Azure AD Token)
 * 
 * To test with real token:
 * 1. Get token from Azure AD (see docs/AZURE_ENTRA_AUTHENTICATION.md)
 * 2. Replace TOKEN_HERE with your actual access token
 */
async function testValidToken() {
  console.log('\n=== Test 4: Production Mode - Valid Azure AD Token ===\n');
  
  const token = process.env.TEST_AZURE_TOKEN || 'TOKEN_HERE';
  
  if (token === 'TOKEN_HERE') {
    console.log('⚠️  Skipping - No test token provided');
    console.log('   Set TEST_AZURE_TOKEN environment variable to test with real token');
    return;
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Request succeeded with valid Azure AD token');
    console.log('Response status:', response.status);
    console.log('Orders:', response.data.orders?.length || 0);
  } catch (error: any) {
    console.error('❌ Request failed:', error.response?.data || error.message);
  }
}

/**
 * Test 5: Health Check (No Auth Required)
 */
async function testHealthCheck() {
  console.log('\n=== Test 5: Health Check (No Auth) ===\n');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check succeeded');
    console.log('Status:', response.data.status);
    console.log('Services:', response.data.services);
  } catch (error: any) {
    console.error('❌ Health check failed:', error.response?.data || error.message);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Azure Entra ID Authentication Test Suite                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 Testing Azure Entra ID authentication integration...\n');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Bypass Auth:', process.env.BYPASS_AUTH || 'not set');
  
  await testHealthCheck();
  
  if (process.env.BYPASS_AUTH === 'true') {
    await testDevMode();
  } else {
    await testNoToken();
    await testInvalidToken();
    await testValidToken();
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Tests Complete                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests, testDevMode, testNoToken, testInvalidToken, testValidToken, testHealthCheck };
