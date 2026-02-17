/**
 * Dump full QC review documents to see their actual structure
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

async function dumpQCReviews() {
  try {
    console.log('📄 Fetching full QC review documents...\n');
    
    const container = database.container('qc-reviews');
    
    const { resources } = await container.items
      .query('SELECT * FROM c')
      .fetchAll();
    
    if (resources.length === 0) {
      console.log('❌ No QC reviews found');
      return;
    }
    
    resources.forEach((review, i) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`QC Review ${i+1}: ${review.id}`);
      console.log('='.repeat(80));
      console.log(JSON.stringify(review, null, 2));
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

dumpQCReviews()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
