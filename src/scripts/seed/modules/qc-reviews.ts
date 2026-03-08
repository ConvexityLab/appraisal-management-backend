/**
 * Seed Module: QC Reviews
 *
 * Seeds 3 QC review records: 1 passed (order-001), 1 in-review (order-002),
 * 1 revision-required (order-009).
 * Container: qc-reviews (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import {
  QC_REVIEW_IDS, QC_CHECKLIST_IDS,
  ORDER_IDS, ORDER_NUMBERS,
  DOCUMENT_IDS, STAFF_IDS,
} from '../seed-ids.js';

const CONTAINER = 'qc-reviews';

function buildQcReviews(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: QC_REVIEW_IDS.REVIEW_ORDER_001, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      documentId: DOCUMENT_IDS.REPORT_ORDER_001,
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      reviewerId: STAFF_IDS.QC_ANALYST_1,
      reviewerName: 'Alex Kim',
      status: 'COMPLETED',
      result: 'PASS',
      overallScore: 94,
      startedAt: daysAgo(15),
      completedAt: daysAgo(10),
      findings: [
        {
          questionId: 'q-subj-02', category: 'Subject Property',
          severity: 'LOW', score: 8, maxScore: 10,
          note: 'Lot dimensions slightly inconsistent with county records — minor variance of 2ft.',
        },
      ],
      summary: 'Report meets all UAD requirements. Minor lot dimension variance noted but within tolerance.',
      createdAt: daysAgo(15), updatedAt: daysAgo(10),
    },
    {
      id: QC_REVIEW_IDS.REVIEW_ORDER_002, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.QC_REVIEW_002,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.QC_REVIEW_002],
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      status: 'IN_REVIEW',
      result: null,
      overallScore: null,
      startedAt: daysAgo(2),
      findings: [],
      summary: null,
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    {
      id: QC_REVIEW_IDS.REVIEW_ORDER_009, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.SUBMITTED_009,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      documentId: DOCUMENT_IDS.REPORT_ORDER_009,
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      reviewerId: STAFF_IDS.QC_ANALYST_2,
      reviewerName: 'Priya Patel',
      status: 'COMPLETED',
      result: 'REVISION_REQUIRED',
      overallScore: 68,
      startedAt: daysAgo(5),
      completedAt: daysAgo(4),
      findings: [
        {
          questionId: 'q-comp-01', category: 'Comparable Selection',
          severity: 'HIGH', score: 0, maxScore: 10,
          note: 'Only 2 closed comparables used within 1 mile — minimum is 3.',
        },
        {
          questionId: 'q-comp-03', category: 'Comparable Selection',
          severity: 'MEDIUM', score: 4, maxScore: 10,
          note: 'Gross adjustment on comparable #2 is 32% (exceeds 25% UAD threshold).',
        },
        {
          questionId: 'q-val-01', category: 'Reconciliation & Value',
          severity: 'HIGH', score: 5, maxScore: 10,
          note: 'Final value appears unsupported — highest comparable is $680K but appraised at $720K without adequate explanation.',
        },
      ],
      summary: 'Material comparable selection and value reconciliation issues require revision before delivery.',
      createdAt: daysAgo(5), updatedAt: daysAgo(4),
    },
  ];
}

export const module: SeedModule = {
  name: 'qc-reviews',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const review of buildQcReviews(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, review, result);
    }

    return result;
  },
};
