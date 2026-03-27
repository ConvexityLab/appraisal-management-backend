/**
 * Seed Module: Revisions
 *
 * Seeds 2 revision request records linked to orders that have QC issues.
 * Container: revisions (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import {
  REVISION_IDS, ORDER_IDS, ORDER_NUMBERS,
  VENDOR_IDS, APPRAISER_IDS, STAFF_IDS, QC_REVIEW_IDS,
} from '../seed-ids.js';

const CONTAINER = 'revisions';

function buildRevisions(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: REVISION_IDS.REVISION_ORDER_010, tenantId, type: 'revision-request',
      orderId: ORDER_IDS.REVISION_010,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      qcReviewId: QC_REVIEW_IDS.REVIEW_ORDER_010,
      vendorId: VENDOR_IDS.TX_PROPERTY,
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR,
      requestedBy: STAFF_IDS.QC_ANALYST_2,
      requestedByName: 'Priya Patel',
      status: 'PENDING',
      revisionNumber: 1,
      dueDate: daysAgo(-3),
      items: [
        {
          category: 'COMPARABLE_SELECTION',
          description: 'Replace Comparable #2 — different zoning (commercial vs residential) makes it inappropriate.',
          severity: 'HIGH',
          resolved: false,
        },
        {
          category: 'ADJUSTMENT_ANALYSIS',
          description: 'GLA adjustment on Comparable #2 exceeds 25% UAD threshold. Justify or replace.',
          severity: 'HIGH',
          resolved: false,
        },
      ],
      requestedAt: daysAgo(4),
      vendorAcknowledgedAt: null,
      completedAt: null,
      createdAt: daysAgo(4), updatedAt: daysAgo(4),
    },
    {
      id: REVISION_IDS.REVISION_ORDER_002, tenantId, type: 'revision-request',
      orderId: ORDER_IDS.QC_REVIEW_002,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.QC_REVIEW_002],
      vendorId: VENDOR_IDS.ROCKY_MOUNTAIN,
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN,
      requestedBy: STAFF_IDS.QC_ANALYST_1,
      requestedByName: 'Alex Kim',
      status: 'COMPLETED',
      revisionNumber: 1,
      dueDate: daysAgo(5),
      items: [
        {
          category: 'UAD_COMPLIANCE',
          description: 'Room count field Q4 was empty — should be populated per UAD standards.',
          severity: 'LOW',
          resolved: true,
          resolvedAt: daysAgo(4),
        },
      ],
      requestedAt: daysAgo(8),
      vendorAcknowledgedAt: daysAgo(7),
      completedAt: daysAgo(4),
      createdAt: daysAgo(8), updatedAt: daysAgo(4),
    },
  ];
}

export const module: SeedModule = {
  name: 'revisions',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const rev of buildRevisions(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, rev, result);
    }

    return result;
  },
};
