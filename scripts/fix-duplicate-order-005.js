/**
 * Fix duplicate order-005 by deleting the old lowercase status version
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT;
const DATABASE_ID = 'appraisal-management';

async function fixDuplicateOrder() {
  try {
    console.log('\n🔄 Fixing duplicate order-005...\n');

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ 
      endpoint: COSMOS_ENDPOINT, 
      aadCredentials: credential 
    });
    
    const database = client.database(DATABASE_ID);
    const container = database.container('orders');

    // Find all documents with id = order-005
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @orderId',
      parameters: [{ name: '@orderId', value: 'order-005' }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    
    console.log(`Found ${resources.length} document(s) with id="order-005":\n`);
    
    for (const doc of resources) {
      console.log(`  - Status: "${doc.status}" (partition key)`);
      console.log(`    Has coordinates: ${doc.propertyAddress?.latitude ? 'YES' : 'NO'}`);
    }

    // Delete the old lowercase status version
    const oldDoc = resources.find(d => d.status === 'completed');
    if (oldDoc) {
      console.log('\n🗑️  Deleting old document with status="completed"...');
      await container.item('order-005', 'completed').delete();
      console.log('✅ Old document deleted!');
    }

    const newDoc = resources.find(d => d.status === 'COMPLETED');
    if (newDoc) {
      console.log('\n✅ Keeping new document with status="COMPLETED"');
      console.log(`   Has coordinates: ${newDoc.propertyAddress?.latitude && newDoc.propertyAddress?.longitude ? 'YES' : 'NO'}`);
      if (newDoc.propertyAddress?.latitude) {
        console.log(`   Lat: ${newDoc.propertyAddress.latitude}, Lon: ${newDoc.propertyAddress.longitude}`);
      }
    }

    console.log('\n✨ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

fixDuplicateOrder();
