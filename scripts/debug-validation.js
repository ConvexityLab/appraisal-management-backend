const axios = require('axios');

const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItYWRtaW4iLCJ1c2VySWQiOiJ0ZXN0LXVzZXItYWRtaW4iLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwibmFtZSI6IlRlc3QgQWRtaW4gVXNlciIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjoidGVzdC10ZW5hbnQtMTIzIiwicGVybWlzc2lvbnMiOlsicmVhZCIsIndyaXRlIiwiYWRtaW4iXSwiaXNzIjoiYXBwcmFpc2FsLW1hbmFnZW1lbnQtdGVzdCIsImF1ZCI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LWFwaSIsImlhdCI6MTc3MDkwNzE0OCwiaXNUZXN0VG9rZW4iOnRydWUsImV4cCI6MTc3MzQ5OTE0OH0.z8ZM1OoT9UxE_1-tfv9qTqcNJq_FdtcvMlRhPhhXKTM";

async function testOnboarding() {
  console.log('\n🧪 Testing Onboarding Application Submission...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/api/vendor-onboarding/applications', {
      applicantInfo: {
        firstName: 'John',
        lastName: 'Appraiser',
        email: 'test@example.com',
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
    }, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
        'x-tenant-id': 'test-tenant-001'
      }
    });
    
    console.log('✅ SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ FAILED:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    if (error.response?.data?.errors) {
      console.log('Validation Errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
  }
}

async function testBulkPayment() {
  console.log('\n🧪 Testing Bulk Payment Processing...\n');
  
  try {
    const response = await axios.post('http://localhost:3001/api/payments/bulk', {
      payments: [
        {
          invoiceId: 'inv-test-001',
          vendorId: 'vendor-test-001',
          amount: 100.00
        }
      ],
      paymentMethod: 'ACH',
      notes: 'Bulk payment test',
      scheduledDate: new Date().toISOString()
    }, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
        'x-tenant-id': 'test-tenant-001'
      }
    });
    
    console.log('✅ SUCCESS:', response.data);
  } catch (error) {
    console.log('❌ FAILED:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    if (error.response?.data?.errors) {
      console.log('Validation Errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
  }
}

(async () => {
  await testOnboarding();
  await testBulkPayment();
})();
