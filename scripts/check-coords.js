const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

async function checkCoordinates() {
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
      query: 'SELECT * FROM c WHERE c.id = @orderId',
      parameters: [{ name: '@orderId', value: 'order-005' }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    if (resources.length > 0) {
      console.log('\n✅ Found order-005');
      console.log('propertyAddress:', JSON.stringify(resources[0].propertyAddress, null, 2));
      
      if (resources[0].propertyAddress?.latitude && resources[0].propertyAddress?.longitude) {
        console.log('\n✅ Coordinates are present!');
        console.log(`  Latitude: ${resources[0].propertyAddress.latitude}`);
        console.log(`  Longitude: ${resources[0].propertyAddress.longitude}`);
      } else {
        console.log('\n❌ Coordinates are missing!');
      }
    } else {
      console.log('❌ order-005 not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

checkCoordinates();
