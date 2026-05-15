#!/usr/bin/env node
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.AZURE_COSMOS_ENDPOINT
	?? 'https://appraisal-mgmt-staging-cosmos.documents.azure.com';
const dbName = process.env.AZURE_COSMOS_DATABASE_NAME ?? 'appraisal-management';

const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
const container = client.database(dbName).container('users');
const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
console.log(`endpoint = ${endpoint}`);
console.log(`database = ${dbName}`);
console.log(`total docs: ${resources.length}`);
for (const d of resources.slice(0, 10)) {
	console.log(`  id=${d.id} tenantId=${d.tenantId} oid=${d.azureAdObjectId} isActive=${d.isActive} role=${d.role}`);
}
process.exit(0);
