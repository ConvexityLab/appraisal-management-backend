import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const db = client.database('appraisal-management');
const { resources: containers } = await db.containers.readAll().fetchAll();
console.log('total containers:', containers.length);
const matching = containers.filter(c => /checklist|qc/i.test(c.id));
console.log('matching qc/checklist:', matching.map(c => c.id));
