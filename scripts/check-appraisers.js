/**
 * Quick script to check if appraisers exist in Cosmos DB
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_NAME = 'appraisal-management';
const TENANT_ID = 'test-tenant-123';

async function checkAppraisers() {
  try {
    console.log('🔍 Checking for appraisers in Cosmos DB...\n');

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
    const database = client.database(DATABASE_NAME);
    const container = database.container('orders');

    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId',
      parameters: [
        { name: '@type', value: 'appraiser' },
        { name: '@tenantId', value: TENANT_ID }
      ]
    };

    const { resources } = await container.items.query(query).fetchAll();

    console.log(`Found ${resources.length} appraisers:\n`);
    
    if (resources.length === 0) {
      console.log('❌ No appraisers found. Run: node scripts/seed-test-data.js');
    } else {
      resources.forEach(app => {
        console.log(`  ✅ ${app.firstName} ${app.lastName} (${app.id})`);
        console.log(`     Specialties: ${app.specialties.join(', ')}`);
        console.log(`     Status: ${app.status}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAppraisers();
