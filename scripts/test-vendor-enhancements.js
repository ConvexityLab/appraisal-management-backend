/**
 * Comprehensive Test Script for Item 3: Enhanced Vendor Management
 * Tests all 29 endpoints across 4 enhancement areas
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TENANT_ID = 'test-tenant-001';
const VENDOR_ID = 'vendor-test-001';
const TEST_EMAIL = 'test-vendor@example.com';

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Shared test data
let testInvoiceId;
let testCertificationId;
let testApplicationId;
let testPaymentId;

/**
 * Helper: Make API request with error handling
 */
async function apiRequest(method, endpoint, data = null, params = null) {
  results.total++;
  
  try {
    // For testing, use a mock token or set BYPASS_AUTH=true in .env
    const authToken = process.env.TEST_AUTH_TOKEN || 'test-mock-token-bypass';
    
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
        'Authorization': `Bearer ${authToken}`
      },
      ...(data && { data }),
      ...(params && { params })
    };

    const response = await axios(config);
    results.passed++;
    return { success: true, data: response.data };
  } catch (error) {
    results.failed++;
    const errorMsg = error.response?.data?.error || error.message;
    results.errors.push({
      endpoint,
      method,
      error: errorMsg,
      status: error.response?.status
    });
    return { success: false, error: errorMsg, status: error.response?.status };
  }
}

/**
 * Helper: Log test results
 */
function logTest(category, name, result) {
  const status = result.success ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${status} - ${name}`);
  if (!result.success) {
    console.log(`    Error: ${result.error} (${result.status})`);
  }
}

/**
 * Test 1: Certification Management (8 endpoints)
 */
async function testCertificationManagement() {
  console.log('\n📋 Testing Certification Management (8 endpoints)...');

  // 1. Create certification
  let result = await apiRequest('POST', `/api/vendor-certifications/${VENDOR_ID}`, {
    type: 'APPRAISER_LICENSE',
    licenseNumber: 'TEST-LIC-12345',
    issuingAuthority: 'State Appraisal Board',
    issueDate: new Date('2024-01-01').toISOString(),
    expiryDate: new Date('2026-12-31').toISOString(),
    vendorEmail: TEST_EMAIL,
    vendorPhone: '555-0100',
    coverageStates: ['TX', 'CA'],
    restrictions: [],
    specialConditions: 'Standard residential appraisal'
  });
  logTest('Certification', 'Create certification', result);
  if (result.success) {
    testCertificationId = result.data.data.id;
  }

  // 2. List certifications
  result = await apiRequest('GET', `/api/vendor-certifications/${VENDOR_ID}`);
  logTest('Certification', 'List certifications', result);

  // 3. Get specific certification
  if (testCertificationId) {
    result = await apiRequest('GET', `/api/vendor-certifications/${VENDOR_ID}/${testCertificationId}`);
    logTest('Certification', 'Get certification by ID', result);
  }

  // 4. Upload certification document
  if (testCertificationId) {
    const fakeDocumentBuffer = Buffer.from('FAKE_PDF_CONTENT_FOR_TESTING').toString('base64');
    result = await apiRequest('POST', `/api/vendor-certifications/${VENDOR_ID}/${testCertificationId}/upload`, {
      fileName: 'appraiser-license.pdf',
      fileData: fakeDocumentBuffer,
      contentType: 'application/pdf',
      uploadedBy: 'test-admin'
    });
    logTest('Certification', 'Upload document', result);
  }

  // 5. Manual verification
  if (testCertificationId) {
    result = await apiRequest('POST', `/api/vendor-certifications/${VENDOR_ID}/${testCertificationId}/verify`, {
      verifiedBy: 'admin-001',
      notes: 'Verified via manual inspection'
    });
    logTest('Certification', 'Manual verification', result);
  }

  // 6. State board verification (will be stub)
  if (testCertificationId) {
    result = await apiRequest('POST', `/api/vendor-certifications/${VENDOR_ID}/${testCertificationId}/verify-state`, {
      licenseNumber: 'TEST-LIC-12345',
      state: 'TX',
      certificationType: 'APPRAISER_LICENSE'
    });
    logTest('Certification', 'State board verification', result);
  }

  // 7. Check expiring certifications
  result = await apiRequest('GET', '/api/vendor-certifications/alerts/expiring');
  logTest('Certification', 'Check expiring alerts', result);

  // 8. Update expired certifications (maintenance job)
  result = await apiRequest('POST', '/api/vendor-certifications/maintenance/update-expired');
  logTest('Certification', 'Update expired certs (maintenance)', result);
}

/**
 * Test 2: Payment Processing (6 endpoints)
 */
async function testPaymentProcessing() {
  console.log('\n💰 Testing Payment Processing (6 endpoints)...');

  // 1. Create invoice
  let result = await apiRequest('POST', '/api/payments/invoices', {
    vendorId: VENDOR_ID,
    orderId: 'order-test-001',
    lineItems: [
      {
        description: 'Residential Appraisal - 123 Main St',
        quantity: 1,
        unitPrice: 450.00,
        taxable: true,
        category: 'Appraisal Fee'
      },
      {
        description: 'Rush Fee (48hr turnaround)',
        quantity: 1,
        unitPrice: 75.00,
        taxable: false,
        category: 'Rush Fee'
      }
    ],
    paymentTerms: 'Net 30',
    dueInDays: 30,
    notes: 'Test invoice for Item 3 validation',
    createdBy: 'admin-001'
  });
  logTest('Payment', 'Create invoice', result);
  if (result.success) {
    testInvoiceId = result.data.data.id;
  }

  // 2. Send invoice
  if (testInvoiceId) {
    result = await apiRequest('POST', `/api/payments/invoices/${testInvoiceId}/send`, {
      vendorId: VENDOR_ID
    });
    logTest('Payment', 'Send invoice email', result);
  }

  // 3. Process payment
  if (testInvoiceId) {
    result = await apiRequest('POST', '/api/payments/process', {
      invoiceId: testInvoiceId,
      vendorId: VENDOR_ID,
      amount: 525.00,
      paymentMethod: 'ACH',
      notes: 'Test payment via ACH',
      bankDetails: {
        bankName: 'Test Bank',
        accountType: 'Checking',
        accountNumberLast4: '1234',
        routingNumber: '021000021'
      }
    });
    logTest('Payment', 'Process payment (ACH)', result);
    if (result.success) {
      testPaymentId = result.data.data?.paymentId;
    }
  }

  // 4. Get payment history
  result = await apiRequest('GET', `/api/payments/vendor/${VENDOR_ID}/payments`, null, {
    startDate: new Date('2024-01-01').toISOString(),
    endDate: new Date('2026-12-31').toISOString()
  });
  logTest('Payment', 'Get payment history', result);

  // 5. Get payment summary
  result = await apiRequest('GET', `/api/payments/vendor/${VENDOR_ID}/summary`, null, {
    startDate: new Date('2024-01-01').toISOString(),
    endDate: new Date('2026-12-31').toISOString()
  });
  logTest('Payment', 'Get payment summary', result);

  // 6. Bulk payments (testing with 2 invoices)
  result = await apiRequest('POST', '/api/payments/bulk', {
    payments: [
      {
        invoiceId: testInvoiceId || 'inv-dummy-001',
        vendorId: VENDOR_ID,
        amount: 100.00
      },
      {
        invoiceId: 'inv-dummy-002',
        vendorId: VENDOR_ID,
        amount: 150.00
      }
    ],
    paymentMethod: 'ACH',
    notes: 'Bulk payment test',
    scheduledDate: new Date().toISOString()
  });
  logTest('Payment', 'Process bulk payments', result);
}

/**
 * Test 3: Onboarding Workflow (7 endpoints)
 */
async function testOnboardingWorkflow() {
  console.log('\n🚀 Testing Onboarding Workflow (7 endpoints)...');

  // 1. Submit application
  let result = await apiRequest('POST', '/api/vendor-onboarding/applications', {
    applicantInfo: {
      firstName: 'John',
      lastName: 'Appraiser',
      email: TEST_EMAIL,
      phone: '555-0200',
      title: 'Lead Appraiser'
    },
    businessInfo: {
      companyName: 'Test Appraisal Services LLC',
      businessType: 'LLC',
      taxId: '12-3456789',
      website: 'https://testappraisal.example.com',
      yearsInBusiness: 5,
      address: {
        street: '456 Business Blvd',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001'
      }
    },
    serviceInfo: {
      serviceTypes: ['Residential Appraisal', 'Commercial Appraisal'],
      coverageAreas: ['TX', 'LA'],
      specializations: ['Single Family', 'Multi-Family'],
      certifications: ['State Licensed', 'FHA Approved']
    }
  });
  logTest('Onboarding', 'Submit application', result);
  if (result.success) {
    testApplicationId = result.data.data.id;
  }

  // 2. Get application
  if (testApplicationId) {
    result = await apiRequest('GET', `/api/vendor-onboarding/applications/${testApplicationId}`);
    logTest('Onboarding', 'Get application by ID', result);
  }

  // 3. List applications
  result = await apiRequest('GET', '/api/vendor-onboarding/applications', null, {
    status: 'IN_PROGRESS'
  });
  logTest('Onboarding', 'List applications', result);

  // 4. Upload document
  if (testApplicationId) {
    const fakeDocBuffer = Buffer.from('FAKE_LICENSE_DOCUMENT').toString('base64');
    result = await apiRequest('POST', `/api/vendor-onboarding/applications/${testApplicationId}/documents`, {
      stepType: 'LICENSE_UPLOAD',
      requirementId: 'license-doc-001',
      fileName: 'appraiser-license.pdf',
      fileData: fakeDocBuffer,
      contentType: 'application/pdf',
      uploadedBy: TEST_EMAIL
    });
    logTest('Onboarding', 'Upload document', result);
  }

  // 5. Complete step
  if (testApplicationId) {
    result = await apiRequest('POST', `/api/vendor-onboarding/applications/${testApplicationId}/steps/APPLICATION_FORM/complete`, {
      completedBy: 'admin-001',
      dataCollected: {
        reviewedAt: new Date().toISOString(),
        reviewer: 'admin-001'
      },
      notes: 'Application form reviewed and approved'
    });
    logTest('Onboarding', 'Complete step', result);
  }

  // 6. Review application (approve)
  if (testApplicationId) {
    result = await apiRequest('POST', `/api/vendor-onboarding/applications/${testApplicationId}/review`, {
      approved: true,
      reviewedBy: 'admin-001',
      reviewNotes: 'All requirements met - approved for onboarding',
      rejectionReason: null
    });
    logTest('Onboarding', 'Review application (approve)', result);
  }

  // 7. Request background check
  if (testApplicationId) {
    result = await apiRequest('POST', `/api/vendor-onboarding/applications/${testApplicationId}/background-check`, {
      applicantInfo: {
        ssn: '***-**-1234',
        dateOfBirth: '1980-01-15',
        address: {
          street: '456 Business Blvd',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001'
        }
      },
      requestedBy: 'admin-001'
    });
    logTest('Onboarding', 'Request background check', result);
  }
}

/**
 * Test 4: Performance Analytics (5 endpoints)
 */
async function testPerformanceAnalytics() {
  console.log('\n📊 Testing Performance Analytics (5 endpoints)...');

  // Note: These will return empty/stub data since we don't have performance metrics in DB yet

  // 1. Dashboard
  let result = await apiRequest('GET', `/api/vendor-analytics/dashboard/${VENDOR_ID}`, null, {
    tenantId: TENANT_ID
  });
  logTest('Analytics', 'Get vendor dashboard', result);

  // 2. Trends
  result = await apiRequest('GET', `/api/vendor-analytics/trends/${VENDOR_ID}`, null, {
    tenantId: TENANT_ID,
    months: 6
  });
  logTest('Analytics', 'Get performance trends', result);

  // 3. Rankings
  result = await apiRequest('GET', '/api/vendor-analytics/rankings', null, {
    tenantId: TENANT_ID,
    tier: 'GOLD',
    limit: 10
  });
  logTest('Analytics', 'Get vendor rankings', result);

  // 4. Comparative analysis
  result = await apiRequest('GET', `/api/vendor-analytics/comparative/${VENDOR_ID}`, null, {
    tenantId: TENANT_ID
  });
  logTest('Analytics', 'Get comparative analysis', result);

  // 5. Tier analysis
  result = await apiRequest('GET', '/api/vendor-analytics/tier-analysis', null, {
    tenantId: TENANT_ID
  });
  logTest('Analytics', 'Get tier analysis', result);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Item 3: Enhanced Vendor Management - Comprehensive Test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Tenant: ${TENANT_ID}`);
  console.log(`Test Vendor: ${VENDOR_ID}`);

  try {
    await testCertificationManagement();
    await testPaymentProcessing();
    await testOnboardingWorkflow();
    await testPerformanceAnalytics();

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Tests:  ${results.total}`);
    console.log(`✅ Passed:    ${results.passed} (${Math.round((results.passed / results.total) * 100)}%)`);
    console.log(`❌ Failed:    ${results.failed} (${Math.round((results.failed / results.total) * 100)}%)`);

    if (results.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      results.errors.forEach((err, idx) => {
        console.log(`\n${idx + 1}. ${err.method} ${err.endpoint}`);
        console.log(`   Status: ${err.status || 'N/A'}`);
        console.log(`   Error: ${err.error}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
