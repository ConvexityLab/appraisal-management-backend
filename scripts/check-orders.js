/**
 * Quick diagnostic to check what orders exist in Cosmos DB
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || process.env.COSMOS_ENDPOINT;
const DATABASE_ID = 'appraisal-management';

async function checkOrders() {
  try {
    console.log(`\n🔍 Checking orders in Cosmos DB at: ${COSMOS_ENDPOINT}\n`);

    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({ 
      endpoint: COSMOS_ENDPOINT, 
      aadCredentials: credential 
    });
    
    const database = client.database(DATABASE_ID);
    const container = database.container('orders');

    // Query all documents with type='order'
    const query = {
      query: 'SELECT c.id, c.orderNumber, c.status, c.clientName, c.propertyAddress FROM c WHERE c.type = @type ORDER BY c.createdAt DESC',
      parameters: [{ name: '@type', value: 'order' }]
    };

    const { resources } = await container.items.query(query).fetchAll();

    console.log(`📦 Found ${resources.length} orders:\n`);

    if (resources.length === 0) {
      console.log('❌ NO ORDERS FOUND!');
      console.log('\n💡 Run: node scripts/seed-test-data.js\n');
    } else {
      resources.forEach(order => {
        const address = order.propertyAddress 
          ? `${order.propertyAddress.street}, ${order.propertyAddress.city}` 
          : 'N/A';
        console.log(`  ✅ ${order.orderNumber} (${order.id})`);
        console.log(`     Status: ${order.status}`);
        console.log(`     Client: ${order.clientName}`);
        console.log(`     Address: ${address}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error checking orders:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Ensure you are signed into Azure CLI: az login');
    console.error('2. Check AZURE_COSMOS_ENDPOINT in .env');
    console.error('3. Verify you have permissions to read from Cosmos DB');
  }
}

checkOrders();
