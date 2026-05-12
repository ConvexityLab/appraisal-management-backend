import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
const client = new CosmosClient({ endpoint: 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/', aadCredentials: new DefaultAzureCredential() });
const c = client.database('appraisal-management').container('aiInsights');

const orderId = 'SEED-VO-00101';
const tenantId = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
const criterionId = 'program:FNMA-1004:SubjectProperty.PropertyIdentification.OccupancyStatusIndicated:006';
const evalId = '46cb0101-cd5a-4796-aef7-661922a2b3b0';
const now = new Date().toISOString();

const record = {
  id: `qc-issue-${orderId}-${criterionId}-${evalId.substring(0,16)}`,
  type: 'qc-issue',
  tenantId, orderId, criterionId,
  issueSummary: 'Occupancy status not one of Owner/Tenant/Vacant — seeded as "Squatter" for live-fire test',
  issueType: 'criterion-fail',
  severity: 'MAJOR',
  status: 'OPEN',
  reasoning: 'Expression evaluated to false (fail). Occupancy value "Squatter" is not in the FNMA-1004 enum ["Owner","Tenant","Vacant"].',
  evaluationId: evalId,
  programId: 'FNMA-1004',
  programVersion: '1.0.0',
  createdBy: 'axiom',
  createdAt: now,
  updatedAt: now,
};
const { resource } = await c.items.upsert(record);
console.log('issue upserted:', resource.id);
