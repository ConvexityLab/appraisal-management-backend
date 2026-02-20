/**
 * Quick verification: query the orders container for appraiser_assignment records
 * Run with: npx tsx src/scripts/verify-assignments.ts
 */
import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('VerifyAssignments');
const cosmosDb = new CosmosDbService();

async function verify(): Promise<void> {
  await cosmosDb.initialize();
  const container = cosmosDb.getContainer('orders');

  // Query 1: All appraiser_assignment documents
  const q1 = {
    query: `SELECT c.id, c.type, c.appraiserId, c.tenantId, c.status, c.orderNumber 
            FROM c WHERE c.type = 'appraiser_assignment'`
  };
  const { resources: allAssignments } = await container.items.query(q1).fetchAll();
  logger.info(`All appraiser_assignment records: ${allAssignments.length}`);
  for (const a of allAssignments) {
    logger.info(`  ${a.id} | appraiser=${a.appraiserId} | tenant=${a.tenantId} | status=${a.status} | order=${a.orderNumber}`);
  }

  // Query 2: Exact query the service uses
  const q2 = {
    query: `SELECT * FROM c 
            WHERE c.type = @type 
            AND c.appraiserId = @appraiserId 
            AND c.tenantId = @tenantId 
            AND c.status = @status
            ORDER BY c.assignedAt DESC`,
    parameters: [
      { name: '@type', value: 'appraiser_assignment' },
      { name: '@appraiserId', value: 'appraiser-angela-reeves' },
      { name: '@tenantId', value: 'test-tenant-123' },
      { name: '@status', value: 'pending' }
    ]
  };
  const { resources: pendingForAngela } = await container.items.query(q2).fetchAll();
  logger.info(`\nPending for appraiser-angela-reeves (tenant=test-tenant-123): ${pendingForAngela.length}`);
  for (const a of pendingForAngela) {
    logger.info(`  ${a.id} | ${a.orderNumber} | ${a.propertyAddress}`);
  }

  // Query 3: All type='order' documents
  const q3 = {
    query: `SELECT c.id, c.type, c.status, c.orderNumber FROM c WHERE c.type = 'order'`
  };
  const { resources: allOrders } = await container.items.query(q3).fetchAll();
  logger.info(`\nAll order records: ${allOrders.length}`);
  for (const o of allOrders) {
    logger.info(`  ${o.id} | status=${o.status} | order=${o.orderNumber}`);
  }
}

verify()
  .then(() => process.exit(0))
  .catch((e) => { logger.error('Failed:', e); process.exit(1); });
