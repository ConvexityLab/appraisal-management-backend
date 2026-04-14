import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

async function main(): Promise<void> {
  const client = new CosmosClient({
    endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/',
    aadCredentials: new DefaultAzureCredential(),
  });

  const db = client.database('appraisal-management');
  const container = db.container('bulk-portfolio-jobs');

  // Get the most recent test-client job in full detail
  const { resources } = await container.items
    .query({
      query: 'SELECT TOP 1 * FROM c WHERE c.type = @type AND c.clientId = @clientId ORDER BY c._ts DESC',
      parameters: [
        { name: '@type', value: 'bulk-ingestion-job' },
        { name: '@clientId', value: 'test-client' },
      ],
    })
    .fetchAll();

  if (!resources.length) { console.log('No jobs found'); return; }
  const job = resources[0];
  console.log(JSON.stringify(job, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
