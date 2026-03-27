// Quick Cosmos query to verify E2E test orders
require("dotenv").config();
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");

const endpoint = process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT;
const dbName = process.env.COSMOS_DATABASE_NAME || process.env.AZURE_COSMOS_DATABASE_NAME;

(async () => {
  const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
  const container = client.database(dbName).container("orders");

  const { resources } = await container.items.query({
    query: `SELECT c.id, c.externalOrderId, c.streetAddress, c.city, c.state, c.zip,
                   c.propertyType, c.productType, c.borrowerName, c.occupancy, c.lockboxCode
            FROM c WHERE c.source = 'statebridge-sftp'
              AND c.id IN ('sftp-ord-7ce22737139ba4a3','sftp-ord-6f2f4ed9f5697811','sftp-ord-9b85a19500714453')`,
  }).fetchAll();

  for (const r of resources) {
    console.log(JSON.stringify(r, null, 2));
  }
  console.log(`\nTotal: ${resources.length} orders`);
})();
