/**
 * Seed Phase 3 — Timeline, SLA, & Overdue Data
 *
 * Seeds audit-trail events, SLA tracking records, and patches one order
 * to be overdue, so the Phase 3 UI (Activity tab, SLA chips, monitoring
 * jobs) has realistic data to display.
 *
 * Attaches to existing seed orders:
 *   order-seed-as-001  — ACCEPTED, full happy-path timeline + on-track SLA
 *   order-seed-as-002  — ACCEPTED, counter-offer timeline + at-risk SLA
 *   order-seed-pa-001  — PENDING_ASSIGNMENT, new order timeline (no SLA)
 *   order-seed-pa-002  — patched to OVERDUE (past due date) + breached SLA
 *
 * Run with: npx tsx src/scripts/seed-phase3-timeline.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SeedPhase3Timeline');
const cosmosDb = new CosmosDbService();

const TENANT_ID = 'test-tenant-123';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function makeAuditId(prefix: string, index: number): string {
  return `audit-phase3-${prefix}-${String(index).padStart(3, '0')}`;
}

// ─── Audit Trail Events ────────────────────────────────────────────────────

const auditEvents = [
  // ── order-seed-as-001: Full happy-path (7 events) ──
  {
    id: makeAuditId('as001', 1),
    tenantId: TENANT_ID,
    timestamp: daysAgo(5),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'ORDER_CREATED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    metadata: { source: 'manual', productType: 'FULL_APPRAISAL' },
  },
  {
    id: makeAuditId('as001', 2),
    tenantId: TENANT_ID,
    timestamp: daysAgo(4.5),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'STATUS_CHANGED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    changes: [{ field: 'status', oldValue: 'NEW', newValue: 'PENDING_ASSIGNMENT' }],
    metadata: { reason: 'Validation complete, ready for assignment' },
  },
  {
    id: makeAuditId('as001', 3),
    tenantId: TENANT_ID,
    timestamp: daysAgo(4),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'VENDOR_ASSIGNED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    after: { assignedVendorId: 'appraiser-angela-reeves', assignedVendorName: 'Angela Reeves' },
    metadata: { method: 'manual' },
  },
  {
    id: makeAuditId('as001', 4),
    tenantId: TENANT_ID,
    timestamp: daysAgo(4),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'STATUS_CHANGED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    changes: [{ field: 'status', oldValue: 'PENDING_ASSIGNMENT', newValue: 'ASSIGNED' }],
  },
  {
    id: makeAuditId('as001', 5),
    tenantId: TENANT_ID,
    timestamp: daysAgo(3.8),
    actor: { userId: 'appraiser-angela-reeves', role: 'appraiser' },
    action: 'ORDER_ACCEPTED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    changes: [{ field: 'status', oldValue: 'ASSIGNED', newValue: 'ACCEPTED' }],
    metadata: { acceptedFee: 575 },
  },
  {
    id: makeAuditId('as001', 6),
    tenantId: TENANT_ID,
    timestamp: daysAgo(3),
    actor: { userId: 'appraiser-angela-reeves', role: 'appraiser' },
    action: 'STATUS_CHANGED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    changes: [{ field: 'status', oldValue: 'ACCEPTED', newValue: 'IN_PROGRESS' }],
    metadata: { note: 'Appraiser started work' },
  },
  {
    id: makeAuditId('as001', 7),
    tenantId: TENANT_ID,
    timestamp: daysAgo(2),
    actor: { userId: 'appraiser-angela-reeves', role: 'appraiser' },
    action: 'DOCUMENT_UPLOADED',
    resource: { type: 'order', id: 'order-seed-as-001', name: 'APR-2026-AS01' },
    metadata: { documentType: 'INSPECTION_PHOTOS', count: 12 },
  },

  // ── order-seed-as-002: Counter-offer flow (6 events) ──
  {
    id: makeAuditId('as002', 1),
    tenantId: TENANT_ID,
    timestamp: daysAgo(6),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'ORDER_CREATED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    metadata: { source: 'api', productType: 'FULL_APPRAISAL' },
  },
  {
    id: makeAuditId('as002', 2),
    tenantId: TENANT_ID,
    timestamp: daysAgo(5.5),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'VENDOR_ASSIGNED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    after: { assignedVendorId: 'appraiser-brian-kowalski', assignedVendorName: 'Brian Kowalski' },
    metadata: { method: 'auto-assign', score: 87 },
  },
  {
    id: makeAuditId('as002', 3),
    tenantId: TENANT_ID,
    timestamp: daysAgo(5.3),
    actor: { userId: 'appraiser-brian-kowalski', role: 'appraiser' },
    action: 'COUNTER_OFFER_SUBMITTED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    metadata: { proposedFee: 650, originalFee: 550, reason: 'Complex property requires additional comp research' },
  },
  {
    id: makeAuditId('as002', 4),
    tenantId: TENANT_ID,
    timestamp: daysAgo(5.1),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'COUNTER_OFFER_RESPONDED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    metadata: { action: 'CLIENT_COUNTERED', counterFee: 600 },
  },
  {
    id: makeAuditId('as002', 5),
    tenantId: TENANT_ID,
    timestamp: daysAgo(5),
    actor: { userId: 'appraiser-brian-kowalski', role: 'appraiser' },
    action: 'ORDER_ACCEPTED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    changes: [{ field: 'status', oldValue: 'ASSIGNED', newValue: 'ACCEPTED' }],
    metadata: { agreedFee: 625, negotiationRounds: 3 },
  },
  {
    id: makeAuditId('as002', 6),
    tenantId: TENANT_ID,
    timestamp: daysAgo(4),
    actor: { userId: 'appraiser-brian-kowalski', role: 'appraiser' },
    action: 'STATUS_CHANGED',
    resource: { type: 'order', id: 'order-seed-as-002', name: 'APR-2026-AS02' },
    changes: [{ field: 'status', oldValue: 'ACCEPTED', newValue: 'IN_PROGRESS' }],
  },

  // ── order-seed-pa-001: New order (2 events) ──
  {
    id: makeAuditId('pa001', 1),
    tenantId: TENANT_ID,
    timestamp: daysAgo(1),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'ORDER_CREATED',
    resource: { type: 'order', id: 'order-seed-pa-001', name: 'APR-2026-PA01' },
    metadata: { source: 'manual', productType: 'FULL_APPRAISAL' },
  },
  {
    id: makeAuditId('pa001', 2),
    tenantId: TENANT_ID,
    timestamp: hoursAgo(20),
    actor: { userId: 'system', role: 'system' },
    action: 'STATUS_CHANGED',
    resource: { type: 'order', id: 'order-seed-pa-001', name: 'APR-2026-PA01' },
    changes: [{ field: 'status', oldValue: 'NEW', newValue: 'PENDING_ASSIGNMENT' }],
    metadata: { reason: 'Auto-routed after validation' },
  },

  // ── order-seed-pa-002: Overdue order (3 events) ──
  {
    id: makeAuditId('pa002', 1),
    tenantId: TENANT_ID,
    timestamp: daysAgo(10),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'ORDER_CREATED',
    resource: { type: 'order', id: 'order-seed-pa-002', name: 'APR-2026-PA02' },
    metadata: { source: 'api', productType: 'DESKTOP_APPRAISAL', priority: 'RUSH' },
  },
  {
    id: makeAuditId('pa002', 2),
    tenantId: TENANT_ID,
    timestamp: daysAgo(9),
    actor: { userId: 'admin-user-001', email: 'admin@appraisal.co', role: 'admin' },
    action: 'VENDOR_ASSIGNED',
    resource: { type: 'order', id: 'order-seed-pa-002', name: 'APR-2026-PA02' },
    after: { assignedVendorId: 'appraiser-carmen-delgado', assignedVendorName: 'Carmen Delgado' },
    metadata: { method: 'broadcast' },
  },
  {
    id: makeAuditId('pa002', 3),
    tenantId: TENANT_ID,
    timestamp: daysAgo(8),
    actor: { userId: 'appraiser-carmen-delgado', role: 'appraiser' },
    action: 'ORDER_ACCEPTED',
    resource: { type: 'order', id: 'order-seed-pa-002', name: 'APR-2026-PA02' },
    changes: [{ field: 'status', oldValue: 'ASSIGNED', newValue: 'ACCEPTED' }],
    metadata: { acceptedFee: 400 },
  },
];

// ─── SLA Tracking Records ──────────────────────────────────────────────────

const slaRecords = [
  // On-track SLA for order-seed-as-001
  {
    id: 'sla-qc_review-order-seed-as-001',
    entityType: 'QC_REVIEW',
    entityId: 'order-seed-as-001',
    orderId: 'order-seed-as-001',
    orderNumber: 'APR-2026-AS01',
    slaConfigId: 'default',
    targetMinutes: 14400, // 10 days
    targetDate: new Date(Date.now() + 7 * 86400000), // 7 days from now
    status: 'ON_TRACK',
    startTime: new Date(Date.now() - 3 * 86400000), // started 3 days ago
    elapsedMinutes: 4320, // 3 days in minutes
    remainingMinutes: 10080, // 7 days in minutes
    percentComplete: 30,
    extended: false,
    waived: false,
    atRiskAlertSent: false,
    breachAlertSent: false,
    createdAt: new Date(Date.now() - 3 * 86400000),
    updatedAt: new Date(),
    tenantId: TENANT_ID,
  },
  // At-risk SLA for order-seed-as-002 (80%+ elapsed)
  {
    id: 'sla-qc_review-order-seed-as-002',
    entityType: 'QC_REVIEW',
    entityId: 'order-seed-as-002',
    orderId: 'order-seed-as-002',
    orderNumber: 'APR-2026-AS02',
    slaConfigId: 'default',
    targetMinutes: 7200, // 5 days
    targetDate: new Date(Date.now() + 1 * 86400000), // 1 day from now
    status: 'AT_RISK',
    startTime: new Date(Date.now() - 4 * 86400000), // started 4 days ago
    elapsedMinutes: 5760, // 4 days in minutes
    remainingMinutes: 1440, // 1 day in minutes
    percentComplete: 80,
    extended: false,
    waived: false,
    atRiskAlertSent: true,
    breachAlertSent: false,
    createdAt: new Date(Date.now() - 4 * 86400000),
    updatedAt: new Date(),
    tenantId: TENANT_ID,
  },
  // Breached SLA for order-seed-pa-002 (overdue)
  {
    id: 'sla-qc_review-order-seed-pa-002',
    entityType: 'QC_REVIEW',
    entityId: 'order-seed-pa-002',
    orderId: 'order-seed-pa-002',
    orderNumber: 'APR-2026-PA02',
    slaConfigId: 'default',
    targetMinutes: 4320, // 3 days
    targetDate: new Date(Date.now() - 2 * 86400000), // 2 days ago (breached)
    status: 'BREACHED',
    startTime: new Date(Date.now() - 8 * 86400000), // started 8 days ago
    elapsedMinutes: 11520, // 8 days in minutes
    remainingMinutes: 0,
    percentComplete: 100,
    breachedAt: new Date(Date.now() - 2 * 86400000),
    breachDuration: 2880, // 2 days over
    extended: false,
    waived: false,
    atRiskAlertSent: true,
    breachAlertSent: true,
    createdAt: new Date(Date.now() - 8 * 86400000),
    updatedAt: new Date(),
    tenantId: TENANT_ID,
  },
];

// ─── Order Patches ─────────────────────────────────────────────────────────

/**
 * Patch order-seed-pa-002 to be overdue:
 *   - dueDate moved to 2 days in the past
 *   - status → IN_PROGRESS (accepted but not completed on time)
 *   - isOverdue flag set
 */
const orderPatches = [
  {
    orderId: 'order-seed-pa-002',
    patch: {
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      isOverdue: true,
      acceptedAt: daysAgo(8),
      acceptedBy: 'appraiser-carmen-delgado',
      assignedVendorId: 'appraiser-carmen-delgado',
      assignedVendorName: 'Carmen Delgado',
      updatedAt: new Date().toISOString(),
    },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function seedPhase3Timeline(): Promise<void> {
  logger.info('=== Phase 3 Timeline Seeding ===');

  logger.info('Initializing Cosmos DB...');
  await cosmosDb.initialize();

  // 1. Seed audit trail events
  logger.info(`Seeding ${auditEvents.length} audit trail events...`);
  let auditOk = 0;
  let auditSkip = 0;
  for (const event of auditEvents) {
    try {
      await cosmosDb.upsertDocument('audit-trail', event);
      auditOk++;
    } catch (err: any) {
      if (err?.code === 409) {
        auditSkip++;
      } else {
        logger.error(`Failed to seed audit event ${event.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  logger.info(`Audit trail: ${auditOk} upserted, ${auditSkip} skipped (conflict)`);

  // 2. Seed SLA tracking records
  logger.info(`Seeding ${slaRecords.length} SLA tracking records...`);
  let slaOk = 0;
  for (const sla of slaRecords) {
    try {
      await cosmosDb.upsertDocument('sla-tracking', sla);
      slaOk++;
    } catch (err: any) {
      logger.error(`Failed to seed SLA record ${sla.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  logger.info(`SLA tracking: ${slaOk} upserted`);

  // 3. Patch orders
  logger.info(`Patching ${orderPatches.length} orders...`);
  for (const { orderId, patch } of orderPatches) {
    try {
      const container = cosmosDb.getContainer('orders');
      const { resource: existing } = await container.item(orderId, TENANT_ID).read();
      if (existing) {
        await container.item(orderId, TENANT_ID).replace({ ...existing, ...patch });
        logger.info(`Patched order ${orderId}`, { status: patch.status, dueDate: patch.dueDate });
      } else {
        logger.warn(`Order ${orderId} not found — skipping patch`);
      }
    } catch (err: any) {
      logger.error(`Failed to patch order ${orderId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('=== Phase 3 Timeline Seeding Complete ===');
}

seedPhase3Timeline()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Seed script failed', { error: err });
    process.exit(1);
  });
