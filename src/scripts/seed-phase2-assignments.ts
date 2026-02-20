/**
 * Phase 2 Seed Script — Assignment & Acceptance
 *
 * Attaches to EXISTING seed orders (from seed-orders.ts) and creates:
 *   1. Mixed-status assignments (pending, accepted, declined) with fee/SLA fields
 *   2. Negotiation records (ACCEPTED, VENDOR_COUNTERED, REJECTED) in the negotiations container
 *   3. Updates two seed orders to ACCEPTED and NEGOTIATING statuses
 *
 * Prerequisites:
 *   - seed-orders.ts has been run   (creates order-seed-pa-001…pa-004, as-001, as-002)
 *   - seed-vendors.ts has been run  (creates vendor-* and appraiser-* records)
 *
 * IDs are stable so the script is idempotent (safe to re-run via upsert).
 *
 * Run with: npx tsx src/scripts/seed-phase2-assignments.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { AppraiserAssignment } from '../types/appraiser.types.js';
import type { OrderNegotiation } from '../types/vendor-marketplace.types.js';

const logger = new Logger('SeedPhase2');
const cosmosDb = new CosmosDbService();

const TENANT_ID = 'test-tenant-123';

// ---------- helpers ----------

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

// ---------- 1. Assignments with fee/SLA fields ----------

const assignments: AppraiserAssignment[] = [
  // ACCEPTED — Angela Reeves accepted order-seed-as-001 with agreed fee
  {
    id: 'assignment-phase2-accepted-001',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-as-001',
    orderNumber: 'APR-2026-AS01',
    appraiserId: 'appraiser-angela-reeves',
    assignedAt: hoursAgo(48),
    assignedBy: 'vendor-ca-apr-12345',
    acceptedAt: hoursAgo(46),
    status: 'accepted',
    propertyAddress: '100 Maple Drive, Fort Collins, CO 80521',
    propertyLat: 40.5853,
    propertyLng: -105.0844,
    proposedFee: 575,
    agreedFee: 575,
    slaDeadline: daysFromNow(5),
    slaStartedAt: hoursAgo(46),
    negotiationId: 'negotiation-phase2-accepted-001',
    estimatedCompletionDate: daysFromNow(5),
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(46),
  },

  // ACCEPTED — Brian Kowalski accepted order-seed-as-002 with negotiated fee
  {
    id: 'assignment-phase2-accepted-002',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-as-002',
    orderNumber: 'APR-2026-AS02',
    appraiserId: 'appraiser-brian-kowalski',
    assignedAt: hoursAgo(24),
    assignedBy: 'vendor-tx-val-67890',
    acceptedAt: hoursAgo(20),
    status: 'accepted',
    propertyAddress: '500 Mountain Rd, Colorado Springs, CO 80903',
    propertyLat: 38.8339,
    propertyLng: -104.8214,
    proposedFee: 600,
    agreedFee: 625, // agreed after counter-offer
    counterOfferFee: 650,
    counterOfferNotes: 'Complex property requires additional comp research',
    slaDeadline: daysFromNow(7),
    slaStartedAt: hoursAgo(20),
    negotiationId: 'negotiation-phase2-countered-001',
    estimatedCompletionDate: daysFromNow(7),
    createdAt: hoursAgo(24),
    updatedAt: hoursAgo(20),
  },

  // DECLINED — Carmen Delgado declined order-seed-pa-003
  {
    id: 'assignment-phase2-declined-001',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-003',
    orderNumber: 'APR-2026-PA03',
    appraiserId: 'appraiser-carmen-delgado',
    assignedAt: hoursAgo(6),
    assignedBy: 'vendor-fl-lic-24680',
    declinedAt: hoursAgo(4),
    declineReason: 'Schedule conflict — already committed on that date',
    status: 'declined',
    propertyAddress: '221B Baker Street, Boulder, CO 80301',
    propertyLat: 40.0150,
    propertyLng: -105.2705,
    proposedFee: 650,
    negotiationId: 'negotiation-phase2-rejected-001',
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(4),
  },

  // PENDING — Daniel Park pending for order-seed-pa-004 (counter-offer in progress)
  {
    id: 'assignment-phase2-pending-counter-001',
    type: 'appraiser_assignment',
    tenantId: TENANT_ID,
    orderId: 'order-seed-pa-004',
    orderNumber: 'APR-2026-PA04',
    appraiserId: 'appraiser-daniel-park',
    assignedAt: hoursAgo(2),
    assignedBy: 'vendor-ca-apr-12345',
    status: 'pending',
    propertyAddress: '350 Fifth Avenue, Lakewood, CO 80226',
    propertyLat: 39.7047,
    propertyLng: -105.0814,
    proposedFee: 500,
    counterOfferFee: 575,
    counterOfferNotes: 'Rural property — additional mileage and comparable difficulty',
    negotiationId: 'negotiation-phase2-active-001',
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1),
  },
];

// ---------- 2. Negotiation records ----------

const negotiations: OrderNegotiation[] = [
  // ACCEPTED — direct accept, no counter-offer (order-seed-as-001)
  {
    id: 'negotiation-phase2-accepted-001',
    orderId: 'order-seed-as-001',
    vendorId: 'vendor-ca-apr-12345',
    clientId: 'client-first-national',
    tenantId: TENANT_ID,
    status: 'ACCEPTED',
    originalTerms: {
      fee: 575,
      dueDate: new Date(daysFromNow(5)),
      rushFee: false,
      specialInstructions: '',
    },
    currentTerms: {
      fee: 575,
      dueDate: new Date(daysFromNow(5)),
      additionalConditions: [],
    },
    rounds: [
      {
        roundNumber: 1,
        timestamp: new Date(hoursAgo(46)),
        actor: 'VENDOR',
        action: 'ACCEPT',
        proposedTerms: { fee: 575, dueDate: new Date(daysFromNow(5)), notes: 'Order accepted' },
      },
    ],
    maxRounds: 3,
    expirationTime: new Date(hoursAgo(44)), // expired (already decided)
    createdAt: new Date(hoursAgo(48)),
    updatedAt: new Date(hoursAgo(46)),
    decidedAt: new Date(hoursAgo(46)),
    decidedBy: 'vendor-ca-apr-12345',
  },

  // ACCEPTED via counter-offer (order-seed-as-002)
  {
    id: 'negotiation-phase2-countered-001',
    orderId: 'order-seed-as-002',
    vendorId: 'vendor-tx-val-67890',
    clientId: 'client-summit-lending',
    tenantId: TENANT_ID,
    status: 'ACCEPTED',
    originalTerms: {
      fee: 600,
      dueDate: new Date(daysFromNow(7)),
      rushFee: false,
      specialInstructions: '',
    },
    currentTerms: {
      fee: 625,
      dueDate: new Date(daysFromNow(7)),
      additionalConditions: ['Additional comp research'],
      vendorNotes: 'Complex property requires additional comp research',
    },
    rounds: [
      {
        roundNumber: 1,
        timestamp: new Date(hoursAgo(24)),
        actor: 'VENDOR',
        action: 'COUNTER',
        proposedTerms: { fee: 650, dueDate: new Date(daysFromNow(7)), notes: 'Complex property requires additional comp research' },
      },
      {
        roundNumber: 2,
        timestamp: new Date(hoursAgo(22)),
        actor: 'CLIENT',
        action: 'COUNTER',
        proposedTerms: { fee: 625, dueDate: new Date(daysFromNow(7)), notes: 'Will meet halfway at $625' },
      },
      {
        roundNumber: 3,
        timestamp: new Date(hoursAgo(20)),
        actor: 'VENDOR',
        action: 'ACCEPT',
        proposedTerms: { fee: 625, dueDate: new Date(daysFromNow(7)), notes: 'Agreed at $625' },
      },
    ],
    maxRounds: 3,
    expirationTime: new Date(hoursAgo(18)),
    autoAcceptThreshold: { maxFeeDelta: 5, maxDateDelta: 2 },
    createdAt: new Date(hoursAgo(24)),
    updatedAt: new Date(hoursAgo(20)),
    decidedAt: new Date(hoursAgo(20)),
    decidedBy: 'vendor-tx-val-67890',
  },

  // REJECTED — vendor declined order-seed-pa-003
  {
    id: 'negotiation-phase2-rejected-001',
    orderId: 'order-seed-pa-003',
    vendorId: 'vendor-fl-lic-24680',
    clientId: 'client-rocky-credit',
    tenantId: TENANT_ID,
    status: 'REJECTED',
    originalTerms: {
      fee: 650,
      dueDate: new Date(daysFromNow(10)),
      rushFee: false,
      specialInstructions: '',
    },
    currentTerms: {
      fee: 650,
      dueDate: new Date(daysFromNow(10)),
      additionalConditions: [],
      vendorNotes: 'Schedule conflict — already committed on that date',
    },
    rounds: [
      {
        roundNumber: 1,
        timestamp: new Date(hoursAgo(4)),
        actor: 'VENDOR',
        action: 'REJECT',
        proposedTerms: { fee: 650, dueDate: new Date(daysFromNow(10)), notes: 'Schedule conflict' },
        reason: 'Schedule conflict — already committed on that date',
      },
    ],
    maxRounds: 3,
    expirationTime: new Date(hoursAgo(2)),
    createdAt: new Date(hoursAgo(6)),
    updatedAt: new Date(hoursAgo(4)),
    decidedAt: new Date(hoursAgo(4)),
    decidedBy: 'vendor-fl-lic-24680',
  },

  // VENDOR_COUNTERED — active negotiation for order-seed-pa-004
  {
    id: 'negotiation-phase2-active-001',
    orderId: 'order-seed-pa-004',
    vendorId: 'vendor-ca-apr-12345',
    clientId: 'client-alpine-mortgage',
    tenantId: TENANT_ID,
    status: 'VENDOR_COUNTERED',
    originalTerms: {
      fee: 500,
      dueDate: new Date(daysFromNow(14)),
      rushFee: false,
      specialInstructions: '',
    },
    currentTerms: {
      fee: 575,
      dueDate: new Date(daysFromNow(14)),
      additionalConditions: ['Mileage surcharge'],
      vendorNotes: 'Rural property — additional mileage and comparable difficulty',
    },
    rounds: [
      {
        roundNumber: 1,
        timestamp: new Date(hoursAgo(1)),
        actor: 'VENDOR',
        action: 'COUNTER',
        proposedTerms: {
          fee: 575,
          dueDate: new Date(daysFromNow(14)),
          notes: 'Rural property — additional mileage and comparable difficulty',
        },
      },
    ],
    maxRounds: 3,
    expirationTime: new Date(Date.now() + 3 * 3600_000), // expires in 3 hours
    autoAcceptThreshold: { maxFeeDelta: 5, maxDateDelta: 2 },
    createdAt: new Date(hoursAgo(2)),
    updatedAt: new Date(hoursAgo(1)),
  },
];

// ---------- 3. Order status patches ----------
// Update existing seed orders to reflect negotiation outcomes

interface OrderPatch {
  id: string;
  patch: Record<string, unknown>;
}

const orderPatches: OrderPatch[] = [
  // order-seed-as-001 → ACCEPTED
  {
    id: 'order-seed-as-001',
    patch: {
      status: 'ACCEPTED',
      acceptedAt: hoursAgo(46),
      acceptedBy: 'vendor-ca-apr-12345',
      fee: 575,
      updatedAt: hoursAgo(46),
    },
  },
  // order-seed-as-002 → ACCEPTED (via counter-offer)
  {
    id: 'order-seed-as-002',
    patch: {
      status: 'ACCEPTED',
      acceptedAt: hoursAgo(20),
      acceptedBy: 'vendor-tx-val-67890',
      fee: 625,
      updatedAt: hoursAgo(20),
    },
  },
  // order-seed-pa-003 → back to PENDING_ASSIGNMENT (vendor declined, needs reassignment)
  {
    id: 'order-seed-pa-003',
    patch: {
      status: 'PENDING_ASSIGNMENT',
      assignedVendorId: null,
      assignedVendorName: null,
      rejectedAt: hoursAgo(4),
      rejectedBy: 'vendor-fl-lic-24680',
      rejectionReason: 'Schedule conflict — already committed on that date',
      updatedAt: hoursAgo(4),
    },
  },
  // order-seed-pa-004 → ASSIGNED with vendor (counter-offer in progress, order stays ASSIGNED)
  {
    id: 'order-seed-pa-004',
    patch: {
      status: 'ASSIGNED',
      assignedVendorId: 'vendor-ca-apr-12345',
      assignedVendorName: 'California Appraisal Services',
      updatedAt: hoursAgo(1),
    },
  },
];

// ---------- main ----------

async function seedPhase2(): Promise<void> {
  logger.info('🌱 Phase 2 Seed: Assignment & Acceptance');
  logger.info('   Initializing Cosmos DB...');
  await cosmosDb.initialize();

  const ordersContainer = (cosmosDb as any)['ordersContainer'];
  if (!ordersContainer) {
    throw new Error('Orders container not initialised — check COSMOS_DB_NAME');
  }

  // Negotiations go in their own container
  let negotiationsContainer: any;
  try {
    negotiationsContainer = (cosmosDb as any)['negotiationsContainer'];
    if (!negotiationsContainer) {
      // Try to get it via the database
      const db = (cosmosDb as any)['database'];
      if (db) {
        negotiationsContainer = db.container('negotiations');
      }
    }
  } catch {
    // If negotiations container doesn't exist, we'll create items in orders container
    logger.warn('⚠️  negotiations container not found — storing in orders container');
  }

  // ---- Assignments ----
  let assignmentCount = 0;
  logger.info('');
  logger.info('📋 Seeding Phase 2 Assignments (mixed statuses with fee/SLA)...');
  for (const assignment of assignments) {
    try {
      await ordersContainer.items.upsert(assignment);
      logger.info(`  ✅ ${assignment.orderNumber} → ${assignment.appraiserId} [${assignment.status}] fee=$${assignment.proposedFee || '–'}`);
      assignmentCount++;
    } catch (error: any) {
      logger.error(`  ❌ ${assignment.orderNumber}: ${error.message || error}`);
    }
  }

  // ---- Negotiations ----
  let negotiationCount = 0;
  const negContainer = negotiationsContainer || ordersContainer;
  logger.info('');
  logger.info('🤝 Seeding Negotiation Records...');
  for (const negotiation of negotiations) {
    try {
      await negContainer.items.upsert(negotiation);
      logger.info(`  ✅ ${negotiation.id} [${negotiation.status}] order=${negotiation.orderId}`);
      negotiationCount++;
    } catch (error: any) {
      logger.error(`  ❌ ${negotiation.id}: ${error.message || error}`);
    }
  }

  // ---- Order Patches ----
  let patchCount = 0;
  logger.info('');
  logger.info('📝 Patching Existing Orders...');
  for (const { id, patch } of orderPatches) {
    try {
      // Read existing order, merge patch, upsert
      const { resource: existing } = await ordersContainer.item(id, TENANT_ID).read();
      if (!existing) {
        logger.warn(`  ⚠️  ${id} not found — skip patch (run seed-orders.ts first)`);
        continue;
      }
      const merged = { ...existing, ...patch };
      await ordersContainer.items.upsert(merged);
      logger.info(`  ✅ ${id} → status=${patch.status}`);
      patchCount++;
    } catch (error: any) {
      logger.error(`  ❌ ${id}: ${error.message || error}`);
    }
  }

  // ---- Summary ----
  logger.info('');
  logger.info('📊 Phase 2 Seeding Summary:');
  logger.info(`   Assignments upserted:  ${assignmentCount}/${assignments.length}`);
  logger.info(`   Negotiations upserted: ${negotiationCount}/${negotiations.length}`);
  logger.info(`   Orders patched:        ${patchCount}/${orderPatches.length}`);
  logger.info('');
  logger.info('📋 Test pages:');
  logger.info('   Assignment:     http://localhost:3010/vendor-engagement/assignment');
  logger.info('   Acceptance:     http://localhost:3010/vendor-engagement/acceptance');
  logger.info('   Counter-offer:  http://localhost:3010/appraiser-portal/acceptance');
}

seedPhase2()
  .then(() => {
    logger.info('✅ Phase 2 seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Phase 2 seeding failed:', error);
    process.exit(1);
  });
