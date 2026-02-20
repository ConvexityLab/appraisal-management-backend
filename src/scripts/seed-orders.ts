/**
 * Seed Orders Script
 * Creates order records (type='order') in the Cosmos DB orders container
 * so the assignment page (/vendor-engagement/assignment) has data.
 *
 * These are the actual appraisal orders that need appraisers assigned.
 * The assignment page queries CosmosDbService.findOrders() which filters
 * by c.type = 'order'.
 *
 * Run with: npx tsx src/scripts/seed-orders.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SeedOrders');
const cosmosDb = new CosmosDbService();

const TENANT_ID = 'test-tenant-123';

const orders = [
  // ---- PENDING_ASSIGNMENT orders (need an appraiser) ----
  {
    id: 'order-seed-pa-001',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-PA01',
    clientId: 'client-first-national',
    status: 'PENDING_ASSIGNMENT',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      street: '742 Evergreen Terrace',
      city: 'Denver',
      state: 'CO',
      zipCode: '80202',
      county: 'Denver',
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2018,
      squareFeet: 2450,
      bedrooms: 4,
      bathrooms: 3,
    },
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    orderFee: 550,
    totalFee: 550,
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Jane Doe',
      loanOfficerEmail: 'jane.doe@firstnational.com',
      loanNumber: 'LN-2026-001234',
      borrowerName: 'Robert Johnson',
    },
    specialInstructions: 'Include exterior photos of all sides',
    documents: [],
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },
  {
    id: 'order-seed-pa-002',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-PA02',
    clientId: 'client-summit-lending',
    status: 'PENDING_ASSIGNMENT',
    priority: 'RUSH',
    orderType: 'REFINANCE',
    productType: 'DESKTOP_APPRAISAL',
    propertyAddress: {
      street: '1600 Pennsylvania Ave',
      city: 'Aurora',
      state: 'CO',
      zipCode: '80012',
      county: 'Arapahoe',
    },
    propertyDetails: {
      propertyType: 'CONDOMINIUM',
      yearBuilt: 2015,
      squareFeet: 1800,
      bedrooms: 3,
      bathrooms: 2,
    },
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    orderFee: 400,
    totalFee: 450,
    clientInformation: {
      clientName: 'Summit Lending Group',
      loanOfficer: 'Mark Thompson',
      loanOfficerEmail: 'mark.t@summitlend.com',
      loanNumber: 'LN-2026-002345',
      borrowerName: 'Maria Garcia',
    },
    specialInstructions: 'Rush order — 3-day turnaround required',
    documents: [],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },
  {
    id: 'order-seed-pa-003',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-PA03',
    clientId: 'client-first-national',
    status: 'PENDING_ASSIGNMENT',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      street: '221B Baker Street',
      city: 'Boulder',
      state: 'CO',
      zipCode: '80301',
      county: 'Boulder',
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 1995,
      squareFeet: 3200,
      bedrooms: 5,
      bathrooms: 3,
    },
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    orderFee: 650,
    totalFee: 650,
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Jane Doe',
      loanOfficerEmail: 'jane.doe@firstnational.com',
      loanNumber: 'LN-2026-003456',
      borrowerName: 'David Chen',
    },
    documents: [],
    createdAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },
  {
    id: 'order-seed-pa-004',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-PA04',
    clientId: 'client-horizon-mortgage',
    status: 'PENDING_ASSIGNMENT',
    priority: 'EXPEDITED',
    orderType: 'PURCHASE',
    productType: 'HYBRID_APPRAISAL',
    propertyAddress: {
      street: '350 Fifth Avenue',
      city: 'Lakewood',
      state: 'CO',
      zipCode: '80226',
      county: 'Jefferson',
    },
    propertyDetails: {
      propertyType: 'TOWNHOUSE',
      yearBuilt: 2020,
      squareFeet: 2100,
      bedrooms: 3,
      bathrooms: 2,
    },
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    orderFee: 500,
    totalFee: 500,
    clientInformation: {
      clientName: 'Horizon Mortgage',
      loanOfficer: 'Sarah Williams',
      loanOfficerEmail: 'sarah.w@horizonmtg.com',
      loanNumber: 'LN-2026-004567',
      borrowerName: 'Angela Reeves',
    },
    documents: [],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },

  // ---- ASSIGNED orders (already have a vendor) ----
  {
    id: 'order-seed-as-001',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-AS01',
    clientId: 'client-summit-lending',
    status: 'ASSIGNED',
    priority: 'NORMAL',
    orderType: 'REFINANCE',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      street: '100 Maple Drive',
      city: 'Fort Collins',
      state: 'CO',
      zipCode: '80521',
      county: 'Larimer',
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2010,
      squareFeet: 2800,
      bedrooms: 4,
      bathrooms: 3,
    },
    dueDate: new Date(Date.now() + 6 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 4 * 86400000).toISOString(),
    orderFee: 575,
    totalFee: 575,
    assignedVendorId: 'vendor-ca-apr-12345',
    assignedVendorName: 'James Williams - Elite Appraisal',
    clientInformation: {
      clientName: 'Summit Lending Group',
      loanOfficer: 'Mark Thompson',
      loanOfficerEmail: 'mark.t@summitlend.com',
      loanNumber: 'LN-2026-005678',
      borrowerName: 'Brian Kowalski',
    },
    documents: [],
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },
  {
    id: 'order-seed-as-002',
    type: 'order',
    tenantId: TENANT_ID,
    orderNumber: 'APR-2026-AS02',
    clientId: 'client-first-national',
    status: 'ASSIGNED',
    priority: 'NORMAL',
    orderType: 'PURCHASE',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      street: '55 Aspen Way',
      city: 'Colorado Springs',
      state: 'CO',
      zipCode: '80903',
      county: 'El Paso',
    },
    propertyDetails: {
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 2005,
      squareFeet: 2600,
      bedrooms: 4,
      bathrooms: 2,
    },
    dueDate: new Date(Date.now() + 8 * 86400000).toISOString(),
    requestedDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    orderFee: 600,
    totalFee: 600,
    assignedVendorId: 'vendor-tx-val-67890',
    assignedVendorName: 'Michael Rodriguez - Texas Valuations',
    clientInformation: {
      clientName: 'First National Bank',
      loanOfficer: 'Jane Doe',
      loanOfficerEmail: 'jane.doe@firstnational.com',
      loanNumber: 'LN-2026-006789',
      borrowerName: 'Carmen Delgado',
    },
    documents: [],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdBy: 'admin-user-001',
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedBy: 'admin-user-001',
  },
];

async function seedOrders(): Promise<void> {
  logger.info('🌱 Initializing Cosmos DB...');
  await cosmosDb.initialize();

  const container = (cosmosDb as any)['ordersContainer'];
  if (!container) {
    throw new Error('Orders container not initialized — check COSMOS_DB_NAME and container names');
  }

  let upserted = 0;

  logger.info('');
  logger.info('📦 Seeding Orders (type=order)...');
  for (const order of orders) {
    try {
      await container.items.upsert(order);
      logger.info(`  ✅ ${order.orderNumber} [${order.status}] — ${order.propertyAddress.street}, ${order.propertyAddress.city}`);
      upserted++;
    } catch (error: any) {
      logger.error(`  ❌ ${order.orderNumber}: ${error.message || error}`);
    }
  }

  logger.info('');
  logger.info('📊 Seeding Summary:');
  logger.info(`   Total orders:        ${orders.length}`);
  logger.info(`   PENDING_ASSIGNMENT:  ${orders.filter(o => o.status === 'PENDING_ASSIGNMENT').length}`);
  logger.info(`   ASSIGNED:            ${orders.filter(o => o.status === 'ASSIGNED').length}`);
  logger.info(`   Upserted:            ${upserted}`);
  logger.info('');
  logger.info('📋 Test at: http://localhost:3010/vendor-engagement/assignment');
}

seedOrders()
  .then(() => {
    logger.info('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  });
