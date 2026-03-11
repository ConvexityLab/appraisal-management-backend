/**
 * Seed Module: QC Reviews
 *
 * Seeds 4 QC review records: 1 passed (order-001), 1 in-review (order-002),
 * 1 revision-required (order-009), and 1 enhanced AI-prescreened review.
 * Container: qc-reviews (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import {
  QC_REVIEW_IDS, QC_CHECKLIST_IDS,
  ORDER_IDS, ORDER_NUMBERS,
  DOCUMENT_IDS, STAFF_IDS,
  VENDOR_IDS,
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
    // Enhanced AI-prescreened review with full QC workflow detail
    {
      id: QC_REVIEW_IDS.ENHANCED_AI_REVIEW, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      documentId: DOCUMENT_IDS.REPORT_ORDER_001,
      appraisalId: 'appr-001',
      status: 'IN_PROGRESS',
      statusHistory: [
        { status: 'PENDING', timestamp: daysAgo(3), changedBy: 'system' },
        { status: 'IN_PROGRESS', timestamp: daysAgo(3), changedBy: STAFF_IDS.QC_ANALYST_1 },
      ],
      priorityLevel: 'HIGH',
      priorityScore: 85,
      riskFactors: [
        { factor: 'HIGH_VALUE', description: 'Appraisal over $500,000', riskLevel: 'MEDIUM', weight: 20 },
        { factor: 'RUSH_ORDER', description: 'Priority order with tight SLA', riskLevel: 'HIGH', weight: 30 },
        { factor: 'COMPLEX_PROPERTY', description: 'Unique property characteristics requiring additional scrutiny', riskLevel: 'MEDIUM', weight: 15 },
      ],
      propertyAddress: '1234 Maple Street, Sacramento, CA 95814',
      propertyType: 'SINGLE_FAMILY',
      appraisedValue: 525_000,
      inspectionDate: daysAgo(5),
      vendorId: VENDOR_IDS.PREMIER,
      vendorName: 'Premier Appraisal Services',
      loanNumber: 'LN-2024-987654',
      borrowerName: 'John Michael Smith',
      loanAmount: 420_000,
      loanToValue: 80,
      reviewers: [
        {
          userId: STAFF_IDS.QC_ANALYST_1, userName: 'Alex Kim', userEmail: 'alex.kim@example.com',
          role: 'PRIMARY', assignedAt: daysAgo(3), assignedBy: STAFF_IDS.QC_ANALYST_2, status: 'ACTIVE',
        },
        {
          userId: STAFF_IDS.QC_ANALYST_2, userName: 'Priya Patel', userEmail: 'priya.patel@example.com',
          role: 'SECONDARY', assignedAt: daysAgo(3), assignedBy: STAFF_IDS.QC_ANALYST_2, status: 'ACTIVE',
        },
      ],
      checklists: [
        {
          checklistId: QC_CHECKLIST_IDS.UAD_STANDARD, checklistName: 'UAD Compliance Checklist',
          checklistType: 'COMPLIANCE', status: 'IN_PROGRESS',
          maxScore: 100, currentScore: 0, completedQuestions: 0, totalQuestions: 45,
          startedAt: daysAgo(3),
        },
        {
          checklistId: 'checklist-market-analysis', checklistName: 'Market Analysis Review',
          checklistType: 'TECHNICAL', status: 'NOT_STARTED',
          maxScore: 100, currentScore: 0, completedQuestions: 0, totalQuestions: 38,
        },
        {
          checklistId: 'checklist-comparable-sales', checklistName: 'Comparable Sales Verification',
          checklistType: 'TECHNICAL', status: 'NOT_STARTED',
          maxScore: 100, currentScore: 0, completedQuestions: 0, totalQuestions: 52,
        },
      ],
      results: {
        overallScore: 87, overallStatus: 'PASSED', maxScore: 100, percentScore: 87,
        riskLevel: 'LOW', decision: 'APPROVED',
        categoriesCompleted: 2, totalCategories: 4,
        questionsAnswered: 13, totalQuestions: 45,
        criticalIssuesCount: 1, majorIssuesCount: 2, minorIssuesCount: 4,
        categoriesResults: [
          {
            categoryId: 'subject', categoryName: 'Subject Property',
            categoryScore: 92, categoryStatus: 'PASSED',
            questionsAnswered: 4, totalQuestions: 12, completedAt: daysAgo(3),
          },
          {
            categoryId: 'neighborhood', categoryName: 'Neighborhood Analysis',
            categoryScore: 85, categoryStatus: 'PASSED',
            questionsAnswered: 9, totalQuestions: 15,
          },
        ],
        findings: [
          {
            findingId: 'finding-001', severity: 'CRITICAL', category: 'salesComparison',
            title: 'Comparable #2 Distance Exceeds Guidelines',
            description: 'Comparable sale #2 is located 1.5 miles from subject property, exceeding the 1-mile guideline for urban areas',
            recommendation: 'Replace with a comparable within 1 mile or provide detailed justification for distance',
            status: 'OPEN', verificationStatus: 'DISPUTED',
            raisedAt: daysAgo(3), raisedBy: STAFF_IDS.QC_ANALYST_1,
          },
        ],
      },
      sla: {
        dueDate: daysAgo(-1), targetResponseTime: 1440, breached: false, escalated: false,
        elapsedTime: 310, remainingTime: 1130, percentComplete: 21.5,
        atRiskThreshold: 80, atRisk: false, extensions: [],
      },
      queuePosition: 5,
      estimatedReviewTime: 45,
      turnaroundTime: 3,
      aiPreScreening: {
        completed: true, completedAt: daysAgo(3),
        riskScore: 42, riskLevel: 'MEDIUM', confidence: 0.87,
        flaggedItems: [
          { itemId: 'ai-flag-001', category: 'comparable_selection', severity: 'MEDIUM', description: 'Comparable #2 distance may exceed guidelines', confidence: 0.92 },
          { itemId: 'ai-flag-002', category: 'value_reconciliation', severity: 'LOW', description: 'Final value is 3% higher than indicated range', confidence: 0.78 },
        ],
        recommendedFocus: [
          'Comparable sales selection and distance',
          'Value reconciliation methodology',
          'Market conditions adjustments',
        ],
      },
      vendorHistory: {
        totalReviewsCompleted: 12, passRate: 91.7, averageScore: 88.5,
        lastReviewDate: daysAgo(25), lastReviewStatus: 'PASSED', lastReviewScore: 92,
        criticalIssuesLast6Months: 1, majorIssuesLast6Months: 3, averageTurnaroundDays: 2.8,
      },
      notes: [
        { noteId: 'note-001', noteType: 'SYSTEM', content: 'Review automatically assigned based on workload balancing', createdAt: daysAgo(3), createdBy: 'system', visibility: 'INTERNAL' },
        { noteId: 'note-002', noteType: 'MANAGER', content: 'High priority - client requested expedited review', createdAt: daysAgo(3), createdBy: STAFF_IDS.QC_ANALYST_2, visibility: 'INTERNAL' },
      ],
      timeline: [
        { eventId: 'evt-001', eventType: 'CREATED', description: 'QC review created', timestamp: daysAgo(3), performedBy: 'system' },
        { eventId: 'evt-002', eventType: 'AI_PRESCREENING_COMPLETED', description: 'AI pre-screening completed - Risk score: 42 (MEDIUM)', timestamp: daysAgo(3), performedBy: 'ai-engine' },
        { eventId: 'evt-003', eventType: 'ASSIGNED', description: 'Review assigned to Alex Kim (PRIMARY)', timestamp: daysAgo(3), performedBy: STAFF_IDS.QC_ANALYST_2 },
        { eventId: 'evt-004', eventType: 'STARTED', description: 'Review started - UAD Compliance Checklist in progress', timestamp: daysAgo(3), performedBy: STAFF_IDS.QC_ANALYST_1 },
        { eventId: 'evt-005', eventType: 'FINDING_RAISED', description: 'Critical finding raised: Comparable #2 Distance Exceeds Guidelines', timestamp: daysAgo(3), performedBy: STAFF_IDS.QC_ANALYST_1 },
      ],
      accessControl: {
        ownerId: STAFF_IDS.QC_ANALYST_1, ownerEmail: 'alex.kim@example.com',
        teamId: 'qc-team-west', visibilityScope: 'TEAM',
        assignedUserIds: [STAFF_IDS.QC_ANALYST_1, STAFF_IDS.QC_ANALYST_2],
      },
      version: 5,
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
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
