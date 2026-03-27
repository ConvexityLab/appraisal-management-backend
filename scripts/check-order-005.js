/**
 * Check EXACTLY what order-005 looks like in Cosmos DB right now
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT;
const DATABASE_ID = 'appraisal-management';

async function checkOrder005() {
  try {
    console.log(`\n🔍 Querying Cosmos DB for order-005...\n`);

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ 
      endpoint: COSMOS_ENDPOINT, 
      aadCredentials: credential 
    });
    
    const database = client.database(DATABASE_ID);
    const container = database.container('orders');

    // Query for order-005 specifically
    const query = {
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: 'order-005' }]
    };

    const { resources } = await container.items.query(query).fetchAll();

    if (resources.length === 0) {
      console.log('❌ order-005 NOT FOUND in database!');
    } else {
      console.log('✅ Found order-005 in database:\n');
      console.log(JSON.stringify(resources[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkOrder005();
