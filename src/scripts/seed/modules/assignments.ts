/**
 * Seed Module: Assignments (vendor assignment + negotiation records)
 *
 * Seeds assignment records in the `orders` container (updates existing orders)
 * and negotiation records in the `negotiations` container.
 * Containers: negotiations (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import { ORDER_IDS, VENDOR_IDS, APPRAISER_IDS } from '../seed-ids.js';

const CONTAINER = 'negotiations';

function buildNegotiations(tenantId: string): Record<string, unknown>[] {
  return [
    // Order 001 — accepted immediately, no counter
    {
      id: `seed-negotiation-001`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.COMPLETED_001,
      vendorId: VENDOR_IDS.PREMIER,
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      status: 'ACCEPTED',
      offeredFee: 375, counterFee: null, finalFee: 375,
      offeredAt: daysAgo(28), respondedAt: daysAgo(28),
      turnaroundDaysOffered: 10, turnaroundDaysAccepted: 10,
      notes: 'Vendor accepted standard rate immediately.',
      createdAt: daysAgo(28), updatedAt: daysAgo(28),
    },
    // Order 003 — rush negotiation, fee bumped
    {
      id: `seed-negotiation-002`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      vendorId: VENDOR_IDS.TX_PROPERTY,
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR,
      status: 'ACCEPTED',
      offeredFee: 450, counterFee: 500, finalFee: 500,
      offeredAt: daysAgo(6), respondedAt: daysAgo(6),
      turnaroundDaysOffered: 4, turnaroundDaysAccepted: 5,
      notes: 'Rush order — vendor countered at $500 due to compressed timeline.',
      createdAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    // Order 007 — assigned, no response yet
    {
      id: `seed-negotiation-003`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.ASSIGNED_007,
      vendorId: VENDOR_IDS.NVN,
      status: 'PENDING',
      offeredFee: 250, counterFee: null, finalFee: null,
      offeredAt: daysAgo(1), respondedAt: null,
      turnaroundDaysOffered: 7, turnaroundDaysAccepted: null,
      notes: 'Awaiting vendor response.',
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    // Order 004 — RFB sent to multiple, all declined so far
    {
      id: `seed-negotiation-004`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.PENDING_004,
      vendorId: VENDOR_IDS.PREMIER,
      status: 'DECLINED',
      offeredFee: 375, counterFee: null, finalFee: null,
      offeredAt: daysAgo(2), respondedAt: daysAgo(1),
      turnaroundDaysOffered: 10, turnaroundDaysAccepted: null,
      declineReason: 'Outside service area for condos in this zip code.',
      createdAt: daysAgo(2), updatedAt: daysAgo(1),
    },
  ];
}

export const module: SeedModule = {
  name: 'assignments',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const neg of buildNegotiations(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, neg, result);
    }

    return result;
  },
};
