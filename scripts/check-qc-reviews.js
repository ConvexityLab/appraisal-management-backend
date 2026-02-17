/**
 * Check QC Reviews in Cosmos DB
 * Shows what QC review results exist and how many criteria/questions they have
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

async function checkQCReviews() {
  try {
    console.log('🔍 Checking qc-reviews container...\n');
    
    const container = database.container('qc-reviews');
    
    const { resources } = await container.items
      .query({
        query: 'SELECT c.id, c.orderId, c.orderNumber, c.checklistId, c.status, ARRAY_LENGTH(c.categoriesResults) as categoryCount FROM c'
      })
      .fetchAll();
    
    if (resources.length === 0) {
      console.log('❌ No QC reviews found in database');
      return;
    }
    
    console.log(`✅ Found ${resources.length} QC review(s):\n`);
    
    for (const review of resources) {
      console.log(`📋 QC Review: ${review.id}`);
      console.log(`   Order ID: ${review.orderId}`);
      console.log(`   Order Number: ${review.orderNumber || 'N/A'}`);
      console.log(`   Checklist ID: ${review.checklistId}`);
      console.log(`   Status: ${review.status}`);
      console.log(`   Categories: ${review.categoryCount}`);
      
      // Get full review to see questions
      const { resource: fullReview } = await container.item(review.id, review.orderId).read();
      
      if (fullReview && fullReview.categoriesResults) {
        fullReview.categoriesResults.forEach((cat, i) => {
          const questionCount = cat.questions ? cat.questions.length : 0;
          console.log(`   └─ Category ${i+1}: ${cat.categoryName} (${questionCount} questions)`);
        });
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 404) {
      console.log('   Container may not exist yet');
    }
  }
}

checkQCReviews()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
