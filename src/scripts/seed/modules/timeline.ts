/**
 * Seed Module: Timeline / Audit Trail + SLA Tracking
 *
 * Seeds audit-trail events and sla-tracking snapshots for key orders.
 * Containers: audit-trail, sla-tracking (both partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import { ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, APPRAISER_IDS, STAFF_IDS } from '../seed-ids.js';

function buildAuditTrail(tenantId: string): Record<string, unknown>[] {
  return [
    // Order 001 — complete lifecycle audit trail
    {
      id: 'seed-audit-001-01', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'ORDER_CREATED', actor: 'system', actorName: 'System',
      detail: 'Order created from client submission.',
      timestamp: daysAgo(30),
    },
    {
      id: 'seed-audit-001-02', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'VENDOR_ASSIGNED', actor: STAFF_IDS.COORDINATOR_1, actorName: 'Coordinator',
      detail: `Assigned to ${VENDOR_IDS.PREMIER} / Michael Thompson.`,
      timestamp: daysAgo(28),
    },
    {
      id: 'seed-audit-001-03', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'VENDOR_ACCEPTED', actor: APPRAISER_IDS.MICHAEL_THOMPSON, actorName: 'Michael Thompson',
      detail: 'Vendor accepted assignment.',
      timestamp: daysAgo(28),
    },
    {
      id: 'seed-audit-001-04', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'INSPECTION_COMPLETED', actor: APPRAISER_IDS.MICHAEL_THOMPSON, actorName: 'Michael Thompson',
      detail: 'Property inspection completed.',
      timestamp: daysAgo(22),
    },
    {
      id: 'seed-audit-001-05', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'REPORT_SUBMITTED', actor: APPRAISER_IDS.MICHAEL_THOMPSON, actorName: 'Michael Thompson',
      detail: 'Appraisal report submitted for QC review.',
      timestamp: daysAgo(18),
    },
    {
      id: 'seed-audit-001-06', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'QC_REVIEW_PASSED', actor: STAFF_IDS.QC_ANALYST_1, actorName: 'Alex Kim',
      detail: 'QC review passed with score 94.',
      timestamp: daysAgo(12),
    },
    {
      id: 'seed-audit-001-07', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      event: 'ORDER_COMPLETED', actor: 'system', actorName: 'System',
      detail: 'Order marked completed and delivered to client.',
      timestamp: daysAgo(10),
    },
    // Order 010 — revision requested audit trail
    {
      id: 'seed-audit-010-01', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.REVISION_010, orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      event: 'ORDER_CREATED', actor: 'system', actorName: 'System',
      detail: 'Order created from client submission.',
      timestamp: daysAgo(18),
    },
    {
      id: 'seed-audit-010-02', tenantId, type: 'audit-event',
      orderId: ORDER_IDS.REVISION_010, orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      event: 'QC_REVISION_REQUESTED', actor: STAFF_IDS.QC_ANALYST_2, actorName: 'Priya Patel',
      detail: 'Revision requested — comparable selection and value reconciliation issues.',
      timestamp: daysAgo(4),
    },
  ];
}

function buildSlaTracking(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: 'seed-sla-track-001', tenantId, type: 'sla-tracking',
      orderId: ORDER_IDS.COMPLETED_001, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      slaType: 'ORDER_TURNAROUND',
      targetDays: 14, actualDays: 20, isMet: false,
      startEvent: 'ORDER_CREATED', startTimestamp: daysAgo(30),
      endEvent: 'ORDER_COMPLETED', endTimestamp: daysAgo(10),
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    {
      id: 'seed-sla-track-003', tenantId, type: 'sla-tracking',
      orderId: ORDER_IDS.IN_PROGRESS_003, orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      slaType: 'RUSH_TURNAROUND',
      targetDays: 5, actualDays: null, isMet: null,
      startEvent: 'ORDER_CREATED', startTimestamp: daysAgo(7),
      endEvent: null, endTimestamp: null,
      isAtRisk: true,
      createdAt: daysAgo(7), updatedAt: hoursAgo(1),
    },
    {
      id: 'seed-sla-track-012', tenantId, type: 'sla-tracking',
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012, orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      slaType: 'ORDER_TURNAROUND',
      targetDays: 10, actualDays: 10, isMet: true,
      startEvent: 'ORDER_CREATED', startTimestamp: daysAgo(25),
      endEvent: 'ORDER_COMPLETED', endTimestamp: daysAgo(15),
      createdAt: daysAgo(15), updatedAt: daysAgo(15),
    },
  ];
}

export const module: SeedModule = {
  name: 'timeline',
  containers: ['audit-trail', 'sla-tracking'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'audit-trail');
      result.cleaned += await cleanContainer(ctx, 'sla-tracking');
    }

    for (const event of buildAuditTrail(ctx.tenantId)) {
      await upsert(ctx, 'audit-trail', event, result);
    }
    for (const sla of buildSlaTracking(ctx.tenantId)) {
      await upsert(ctx, 'sla-tracking', sla, result);
    }

    return result;
  },
};
