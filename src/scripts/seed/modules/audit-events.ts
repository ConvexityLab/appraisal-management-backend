/**
 * Seed Module: Engagement Audit Events
 *
 * Seeds AuditEventDoc records into the `engagement-audit-events` container
 * for engagement SEED-ENG-2026-00204 (seed-engagement-004).
 *
 * This gives the Timeline and Audit Log UI components realistic test data
 * covering all 7 lifecycle stages:
 *   order_created → vendor_assignment → engagement_letter → axiom_evaluation
 *   → report_submitted → qc_review → delivered
 *
 * Container: "engagement-audit-events"  (partition /engagementId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import { ENGAGEMENT_IDS, ORDER_IDS, VENDOR_IDS, APPRAISER_IDS, STAFF_IDS } from '../seed-ids.js';

const CONTAINER = 'engagement-audit-events';

/** Partition key path for this container is /engagementId, not /tenantId. */
const PARTITION_KEY_PATH = '/engagementId';

const ENG_ID = ENGAGEMENT_IDS.SINGLE_DELIVERED_004;   // 'seed-engagement-004'
const ORDER_ID = ORDER_IDS.COMPLETED_001;              // 'seed-order-001'
const ORDER_NUMBER = 'SEED-2026-00101';

function buildAuditEvents(tenantId: string): Record<string, unknown>[] {
  /** Shorthand builder so event shapes stay consistent. */
  function evt(
    suffix: string,
    eventType: string,
    category: string,
    source: string,
    severity: 'info' | 'success' | 'warning' | 'error',
    icon: string,
    description: string,
    timestamp: string,
    data: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: `seed-audit-evt-004-${suffix}`,
      entityType: 'audit-event' as const,
      engagementId: ENG_ID,
      orderId: ORDER_ID,
      tenantId,
      eventType,
      category,
      source,
      timestamp,
      description,
      severity,
      icon,
      data: { engagementId: ENG_ID, orderId: ORDER_ID, orderNumber: ORDER_NUMBER, tenantId, ...data },
      savedAt: timestamp,
    };
  }

  return [
    // ── Stage 1: Order Created ────────────────────────────────────────────────
    evt(
      '01',
      'engagement.order.created',
      'engagement',
      'engagement.controller',
      'info',
      'add_circle',
      `Order ${ORDER_NUMBER} created for engagement`,
      daysAgo(30),
      { engagementNumber: 'SEED-ENG-2026-00204', clientName: 'First Horizon Bank', productType: 'FULL_APPRAISAL' },
    ),
    evt(
      '02',
      'order.created',
      'order',
      'orchestrator',
      'info',
      'add_circle',
      `Order ${ORDER_NUMBER} created`,
      daysAgo(30),
      { loanNumber: 'FH-2026-88001', borrowerName: 'Sarah Johnson', propertyAddress: '5432 Mockingbird Ln, Dallas TX 75206' },
    ),

    // ── Stage 2: Vendor Assignment ────────────────────────────────────────────
    evt(
      '03',
      'vendor.bid.sent',
      'vendor',
      'vendor-assignment-orchestrator',
      'info',
      'send',
      `Bid invitation sent to Premier Appraisal Group (attempt 1)`,
      daysAgo(29),
      { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', attemptNumber: 1, expiresInHours: 24 },
    ),
    evt(
      '04',
      'vendor.bid.declined',
      'vendor',
      'vendor-assignment-orchestrator',
      'warning',
      'cancel',
      `Premier Appraisal Group declined the bid: Schedule conflict`,
      daysAgo(28),
      { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', attemptNumber: 1, declineReason: 'Schedule conflict — unavailable for requested turnaround' },
    ),
    evt(
      '05',
      'vendor.bid.sent',
      'vendor',
      'vendor-assignment-orchestrator',
      'info',
      'send',
      `Bid invitation sent to Rocky Mountain Appraisal (attempt 2)`,
      daysAgo(28),
      { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Appraisal', attemptNumber: 2, expiresInHours: 24 },
    ),
    evt(
      '06',
      'vendor.bid.accepted',
      'vendor',
      'vendor-assignment-orchestrator',
      'success',
      'handshake',
      `Rocky Mountain Appraisal accepted the bid`,
      daysAgo(27),
      { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Appraisal', appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN, appraiserName: 'Patricia Nguyen', fee: 500 },
    ),

    // ── Stage 3: Engagement Letter ─────────────────────────────────────────────
    evt(
      '07',
      'engagement.letter.sent',
      'engagement',
      'engagement-letter-service',
      'info',
      'mail',
      `Engagement letter sent to vendor p.nguyen@rockymtnappraisal.com`,
      daysAgo(26),
      { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorEmail: 'p.nguyen@rockymtnappraisal.com', letterVersion: '1.0', expiresInHours: 48 },
    ),
    evt(
      '08',
      'engagement.letter.signed',
      'engagement',
      'engagement-letter-service',
      'success',
      'draw',
      `Engagement letter signed by vendor`,
      daysAgo(25),
      { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Appraisal', signedBy: 'Patricia Nguyen', signedAt: daysAgo(25) },
    ),

    // ── Stage 4: Axiom Evaluation ──────────────────────────────────────────────
    evt(
      '09',
      'axiom.evaluation.submitted',
      'axiom',
      'axiom-service',
      'info',
      'science',
      `Axiom evaluation submitted (job axiom-job-004-001)`,
      daysAgo(24),
      { jobId: 'axiom-job-004-001', evaluationType: 'pre-screen', propertyAddress: '5432 Mockingbird Ln, Dallas TX 75206' },
    ),
    evt(
      '10',
      'axiom.evaluation.completed',
      'axiom',
      'axiom-service',
      'success',
      'hub',
      `Axiom evaluation completed — status: passed, score 91`,
      daysAgo(22),
      { jobId: 'axiom-job-004-001', status: 'passed', score: 91, confidence: 0.94, flags: [], recommendation: 'Proceed to full appraisal' },
    ),

    // ── Stage 5: Report Submitted ──────────────────────────────────────────────
    evt(
      '11',
      'order.status.changed',
      'order',
      'orchestrator',
      'info',
      'update',
      `Order status changed: ASSIGNED → IN_PROGRESS`,
      daysAgo(20),
      { oldStatus: 'ASSIGNED', newStatus: 'IN_PROGRESS', changedBy: APPRAISER_IDS.PATRICIA_NGUYEN, reason: 'Inspection scheduled' },
    ),
    evt(
      '12',
      'order.status.changed',
      'order',
      'report-submission.controller',
      'info',
      'update',
      `Order status changed: IN_PROGRESS → SUBMITTED`,
      daysAgo(15),
      { oldStatus: 'IN_PROGRESS', newStatus: 'SUBMITTED', changedBy: APPRAISER_IDS.PATRICIA_NGUYEN, documentId: 'seed-doc-report-001', reportType: 'FULL_1004' },
    ),

    // ── Stage 6: QC Review ─────────────────────────────────────────────────────
    evt(
      '13',
      'review.assignment.requested',
      'qc',
      'qc-review-orchestrator',
      'info',
      'rate_review',
      `QC review assignment requested (review seed-qc-review-001)`,
      daysAgo(14),
      { qcReviewId: 'seed-qc-review-001', reviewType: 'standard', slaHours: 48 },
    ),
    evt(
      '14',
      'review.assigned',
      'qc',
      'qc-review-orchestrator',
      'info',
      'assignment',
      `QC review assigned to Alex Kim`,
      daysAgo(14),
      { qcReviewId: 'seed-qc-review-001', reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Kim', assignedAt: daysAgo(14) },
    ),
    evt(
      '15',
      'qc.started',
      'qc',
      'qc-review.controller',
      'info',
      'fact_check',
      `QC review started`,
      daysAgo(13),
      { qcReviewId: 'seed-qc-review-001', reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Kim' },
    ),
    evt(
      '16',
      'qc.ai.scored',
      'qc',
      'axiom-ai-gateway',
      'success',
      'smart_toy',
      `AI QC scored order — decision: auto_pass (score 91)`,
      daysAgo(12),
      { qcReviewId: 'seed-qc-review-001', decision: 'auto_pass', score: 91, modelVersion: 'axiom-qc-v3.2', checks: ['comp_selection', 'value_reconciliation', 'condition_rating', 'photo_count'] },
    ),
    evt(
      '17',
      'review.sla.warning',
      'qc',
      'sla-monitor',
      'warning',
      'warning',
      `QC review SLA warning — 80% of time elapsed`,
      daysAgo(10),
      { qcReviewId: 'seed-qc-review-001', elapsedPct: 80, elapsedHours: 38, slaHours: 48, remainingHours: 10 },
    ),
    evt(
      '18',
      'qc.issue.detected',
      'qc',
      'qc-review.controller',
      'warning',
      'report_problem',
      `QC issue detected: comp_selection_deviation`,
      daysAgo(9),
      { qcReviewId: 'seed-qc-review-001', issueType: 'comp_selection_deviation', issueSummary: 'Comparable 3 exceeds 1-mile radius guideline by 0.4 miles — note required', severity: 'minor', requiresRevision: false },
    ),
    evt(
      '19',
      'qc.completed',
      'qc',
      'qc-review.controller',
      'success',
      'verified',
      `QC review completed — result: passed (score 94)`,
      daysAgo(8),
      { qcReviewId: 'seed-qc-review-001', result: 'passed', score: 94, reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Kim', notes: 'Minor note on comparable 3 proximity documented. Value well-supported. Approved for delivery.' },
    ),

    // ── Stage 7: Delivered ───────────────────────────────────────────────────
    evt(
      '20',
      'engagement.status.changed',
      'engagement',
      'orchestrator',
      'info',
      'business_center',
      `Engagement status → DELIVERED`,
      daysAgo(7),
      { oldStatus: 'QC', newStatus: 'DELIVERED', changedBy: 'system', engagementNumber: 'SEED-ENG-2026-00204' },
    ),
    evt(
      '21',
      'order.completed',
      'order',
      'orchestrator',
      'success',
      'check_circle',
      `Order marked completed`,
      daysAgo(6),
      { completedBy: 'system', finalStatus: 'COMPLETED', fee: 500, daysToComplete: 24 },
    ),
    evt(
      '22',
      'order.delivered',
      'order',
      'delivery-service',
      'success',
      'local_shipping',
      `Order ${ORDER_NUMBER} delivered to client portal`,
      daysAgo(5),
      { deliveredTo: 'First Horizon Bank', deliveredBy: STAFF_IDS.COORDINATOR_1, portalPath: `/portal/first-horizon/${ORDER_NUMBER}`, documentId: 'seed-doc-report-001' },
    ),
  ];
}

export const module: SeedModule = {
  name: 'audit-events',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, PARTITION_KEY_PATH);
    }

    for (const event of buildAuditEvents(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, event, result);
    }

    return result;
  },
};
