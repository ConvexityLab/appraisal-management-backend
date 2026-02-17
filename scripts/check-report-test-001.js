/**
 * Check if report-test-001 exists in the reporting container
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT;
const DATABASE_ID = 'appraisal-management';

async function checkReport() {
  try {
    console.log('\n🔍 Checking for report-test-001...\n');

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ 
      endpoint: COSMOS_ENDPOINT, 
      aadCredentials: credential 
    });
    
    const database = client.database(DATABASE_ID);
    const container = database.container('reporting');

    // Try to read the report directly
    try {
      const { resource } = await container.item('report-test-001', 'report-test-001').read();
      
      if (resource) {
        console.log('✅ Report EXISTS!');
        console.log('\nReport structure:');
        console.log('  - id:', resource.id);
        console.log('  - reportRecordId:', resource.reportRecordId);
        console.log('  - Has compsData?', !!resource.compsData);
        console.log('  - compsData length:', resource.compsData?.length || 0);
        console.log('  - Has subject?', !!resource.subject);
        
        if (resource.compsData && resource.compsData.length > 0) {
          console.log('\n📍 First comp sample:');
          console.log(JSON.stringify(resource.compsData[0], null, 2));
        } else {
          console.log('\n⚠️  Report exists but has NO compsData array!');
        }
        
        console.log('\n📄 Full report keys:', Object.keys(resource));
      }
    } catch (readError) {
      if (readError.code === 404) {
        console.log('❌ Report does NOT exist in the reporting container');
        console.log('\n💡 You need to create report-test-001 with compsData');
        console.log('\nExpected structure:');
        console.log(`{
  id: 'report-test-001',
  reportRecordId: 'report-test-001',
  type: 'report',
  tenantId: 'test-tenant-123',
  subject: {
    address: {
      street: '555 Cedar Ln',
      city: 'Frisco',
      state: 'TX',
      zipCode: '75034',
      latitude: 33.1507,
      longitude: -96.8236
    }
  },
  compsData: [
    {
      address: '560 Cedar Ln',
      city: 'Frisco',
      state: 'TX',
      zip: '75034',
      latitude: 33.1510,
      longitude: -96.8240,
      salePrice: 620000,
      saleDate: '2025-11-15',
      // ... other comp fields
    }
  ]
}`);
      } else {
        throw readError;
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkReport();
