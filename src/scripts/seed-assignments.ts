/**
 * Seed Appraiser Assignments Script
 * Creates pending appraiser_assignment records in the orders container
 * so the acceptance queue page (/appraiser-portal/acceptance) has data.
 *
 * Records are assigned to appraiser 'appraiser-angela-reeves' (seeded by seed-vendors.ts)
 * with tenantId 'test-tenant-123' (matches the default in appraiser.controller.ts).
 *
 * Run with: npx tsx src/scripts/seed-assignments.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { AppraiserAssignment } from '../types/appraiser.types.js';

const logger = new Logger('SeedAssignments');
const cosmosDb = new CosmosDbService();

const TENANT_ID = 'test-tenant-123';
const APPRAISER_ID = 'appraiser-angela-reeves';

const assignments: AppraiserAssignment[] = [
  {
    id: 'assignment-seed-001',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-001',
    orderNumber: 'APR-2026-PA01',
    appraiserId: APPRAISER_ID,
    assignedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    assignedBy: 'vendor-ca-apr-12345',
    status: 'pending',
    propertyAddress: '742 Evergreen Terrace, Denver, CO 80202',
    propertyLat: 39.7392,
    propertyLng: -104.9903,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'assignment-seed-002',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-002',
    orderNumber: 'APR-2026-PA02',
    appraiserId: APPRAISER_ID,
    assignedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    assignedBy: 'vendor-tx-val-67890',
    status: 'pending',
    propertyAddress: '1600 Pennsylvania Ave, Aurora, CO 80012',
    propertyLat: 39.7294,
    propertyLng: -104.8319,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'assignment-seed-003',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-003',
    orderNumber: 'APR-2026-PA03',
    appraiserId: APPRAISER_ID,
    assignedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
    assignedBy: 'vendor-fl-lic-24680',
    status: 'pending',
    propertyAddress: '221B Baker Street, Boulder, CO 80301',
    propertyLat: 40.0150,
    propertyLng: -105.2705,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'assignment-seed-004',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-004',
    orderNumber: 'APR-2026-PA04',
    appraiserId: APPRAISER_ID,
    assignedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    assignedBy: 'vendor-ca-apr-12345',
    status: 'pending',
    propertyAddress: '350 Fifth Avenue, Lakewood, CO 80226',
    propertyLat: 39.7047,
    propertyLng: -105.0814,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  // One assignment for a second appraiser (Brian Kowalski) to prove multi-appraiser works
  {
    id: 'assignment-seed-005',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-as-001',
    orderNumber: 'APR-2026-AS01',
    appraiserId: 'appraiser-brian-kowalski',
    assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    assignedBy: 'vendor-tx-val-67890',
    status: 'pending',
    propertyAddress: '100 Maple Drive, Fort Collins, CO 80521',
    propertyLat: 40.5853,
    propertyLng: -105.0844,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

async function seedAssignments(): Promise<void> {
  logger.info('🌱 Initializing Cosmos DB...');
  await cosmosDb.initialize();

  const container = (cosmosDb as any)['ordersContainer'];
  if (!container) {
    throw new Error('Orders container not initialized — check COSMOS_DB_NAME and container names');
  }

  let upserted = 0;

  logger.info('');
  logger.info('📋 Seeding Appraiser Assignments...');
  for (const assignment of assignments) {
    try {
      await container.items.upsert(assignment);
      logger.info(`  ✅ ${assignment.orderNumber} → ${assignment.appraiserId} (${assignment.id})`);
      upserted++;
    } catch (error: any) {
      logger.error(`  ❌ ${assignment.orderNumber}: ${error.message || error}`);
    }
  }

  logger.info('');
  logger.info('📊 Seeding Summary:');
  logger.info(`   Total assignments: ${assignments.length}`);
  logger.info(`   Upserted:          ${upserted}`);
  logger.info(`   Appraiser:         ${APPRAISER_ID}`);
  logger.info(`   Tenant:            ${TENANT_ID}`);
  logger.info('');
  logger.info('📋 Test at: http://localhost:3010/appraiser-portal/acceptance');
}

seedAssignments()
  .then(() => {
    logger.info('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  });
