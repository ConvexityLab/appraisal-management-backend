import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const endpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT!;
const dbId = process.env.COSMOS_DATABASE_NAME ?? process.env.AZURE_COSMOS_DATABASE_NAME!;
const c = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });

async function run() {
    const docs = c.database(dbId).container('documents');
    const ai = c.database(dbId).container('aiInsights');

    const { resources: d } = await docs.items.query({
        query: 'SELECT c.id, c.documentType, c.category, c.extractionStatus, IS_DEFINED(c.extractedData) AS hasExtractedData FROM c WHERE c.id = @i',
        parameters: [{ name: '@i', value: 'seed-doc-report-003' }],
    }).fetchAll();
    console.log('document seed-doc-report-003:', JSON.stringify(d[0], null, 2));

    const { resources: evals } = await ai.items.query({
        query: "SELECT TOP 5 c.id, c.type, c.status, c.timestamp, IS_DEFINED(c.axiomExtractionResult) AS hasExtraction, ARRAY_LENGTH(c.axiomExtractionResult) AS pageCount FROM c WHERE c.orderId = @o AND STARTSWITH(c.id, 'eval-') ORDER BY c.timestamp DESC",
        parameters: [{ name: '@o', value: 'seed-order-003' }],
    }).fetchAll();
    console.log('latest evals:', JSON.stringify(evals, null, 2));
}
run().catch(e => { console.error(e); process.exit(1); });
