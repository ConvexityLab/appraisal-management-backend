/**
 * Debug the exact same query that getResult controller method is making
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

async function debugGetResult(resultId) {
  try {
    console.log(`🔍 Debug: getResult() flow for resultId: ${resultId}\n`);
    
    // Step 1: Try getItem from results container (what controller does first)
    console.log('Step 1: Try getItem from results container...');
    const resultsContainer = database.container('results');
    
    let result = null;
    try {
      const { resource } = await resultsContainer.item(resultId, resultId).read();
      result = resource;
      console.log('✅ Found in results container:', result ? 'YES' : 'NO');
    } catch (error) {
      if (error.code === 404) {
        console.log('❌ Not found in results container (404)');
      } else {
        console.log('❌ Error in results container:', error.message);
      }
    }
    
    if (!result) {
      // Step 2: Try queryItems from qc-reviews (what controller does second)  
      console.log('\nStep 2: Try queryItems from qc-reviews by orderId...');
      const qcReviewsContainer = database.container('qc-reviews');
      
      const query = {
        query: 'SELECT * FROM c WHERE c.orderId = @orderId',
        parameters: [{ name: '@orderId', value: resultId }]
      };
      
      console.log('Query:', JSON.stringify(query, null, 2));
      
      const { resources } = await qcReviewsContainer.items.query(query).fetchAll();
      console.log(`✅ Found ${resources.length} items in qc-reviews by orderId`);
      
      if (resources.length > 0) {
        result = resources[0];
        console.log('✅ Using first result:', {
          id: result.id,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          status: result.status,
          hasCategoriesResults: !!result.categoriesResults
        });
      } else {
        console.log('❌ No results found with orderId =', resultId);
        
        // Debug: Show what orderIds actually exist
        console.log('\nDebug: Checking what orderIds exist in qc-reviews...');
        const { resources: allItems } = await qcReviewsContainer.items.query('SELECT c.id, c.orderId, c.orderNumber FROM c').fetchAll();
        console.log('Available items:');
        allItems.forEach(item => {
          console.log(`  - id: ${item.id}, orderId: ${item.orderId}, orderNumber: ${item.orderNumber}`);
        });
      }
    }
    
    if (result) {
      console.log('\n✅ Final result found:', {
        id: result.id,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        status: result.status
      });
    } else {
      console.log('\n❌ No result found anywhere');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Test with the problem ID
const testId = process.argv[2] || 'ord_2024_00123456';
console.log(`Testing getResult() flow with: ${testId}\n`);

debugGetResult(testId)
  .then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });