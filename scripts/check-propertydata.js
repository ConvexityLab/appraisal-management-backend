const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

async function checkPropertyData() {
  try {
    const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
    if (!endpoint) {
      throw new Error('AZURE_COSMOS_ENDPOINT environment variable is required');
    }

    const client = new CosmosClient({
      endpoint,
      aadCredentials: new DefaultAzureCredential()
    });

    const database = client.database('appraisal-management');
    const container = database.container('orders');

    const querySpec = {
      query: 'SELECT c.propertyData FROM c WHERE c.id = @orderId',
      parameters: [{ name: '@orderId', value: 'order-005' }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    if (resources.length > 0 && resources[0].propertyData) {
      console.log('\n✅ Found propertyData in order-005:');
      console.log(JSON.stringify(resources[0].propertyData, null, 2));
      
      if (resources[0].propertyData?.address?.latitude && resources[0].propertyData?.address?.longitude) {
        console.log('\n✅ Address coordinates are present!');
        console.log(`  Latitude: ${resources[0].propertyData.address.latitude}`);
        console.log(`  Longitude: ${resources[0].propertyData.address.longitude}`);
      } else {
        console.log('\n❌ Address coordinates are missing!');
      }
    } else {
      console.log('❌ propertyData field not found in order-005');
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

checkPropertyData();
