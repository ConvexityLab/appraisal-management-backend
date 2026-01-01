/**
 * Simple QC Workflow Test - Verify API routes are accessible
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testRoutes() {
  console.log('Testing QC Workflow API Routes...\n');
  
  try {
    // Test 1: Health check (no auth required)
    console.log('✓ Test 1: Health check');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('  Status:', healthResponse.data.status);
    console.log('');
    
    // Test 2: Check Swagger docs
    console.log('✓ Test 2: API Documentation');
    const docsResponse = await axios.get(`${API_BASE_URL}/api-docs`);
    console.log('  Swagger UI loaded:', docsResponse.status === 200);
    console.log('');
    
    // Test 3: Try QC workflow route (expect 401 unauthorized - which proves route exists)
    console.log('✓ Test 3: QC Workflow Routes');
    try {
      await axios.get(`${API_BASE_URL}/api/qc-workflow/queue`);
      console.log('  ERROR: Should have required authentication');
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('  ✓ Route exists and requires authentication (401)');
      } else if (error.response?.status === 404) {
        console.log('  ✗ Route not found (404) - routes not registered!');
      } else {
        console.log('  ? Unexpected status:', error.response?.status);
      }
    }
    console.log('');
    
    // Test 4: Check if routes are visible in Swagger
    console.log('✓ Test 4: Swagger API spec');
    const swaggerJsonResponse = await axios.get(`${API_BASE_URL}/api-docs.json`).catch(() => ({data: null}));
    if (!swaggerJsonResponse.data) {
      console.log('  Swagger JSON not available at /api-docs.json');
    } else {
      const paths = swaggerJsonResponse.data.paths || {};
      const qcWorkflowPaths = Object.keys(paths).filter(path => path.includes('qc-workflow'));
      console.log(`  QC Workflow paths in Swagger: ${qcWorkflowPaths.length}`);
      qcWorkflowPaths.slice(0, 5).forEach(path => console.log(`    - ${path}`));
    }
    console.log('');
    
    console.log('================================================');
    console.log('SUMMARY');
    console.log('================================================');
    console.log('✓ API server is running');
    console.log('✓ Health check endpoint works');
    console.log('✓ Swagger documentation is available');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify QC workflow routes are registered (check for 401 not 404)');
    console.log('2. Create test JWT token for authenticated testing');
    console.log('3. Create Cosmos DB containers for QC workflow');
    console.log('');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testRoutes();
