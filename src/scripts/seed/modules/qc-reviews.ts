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
  VENDOR_IDS, ENGAGEMENT_IDS,
  REVISION_IDS,
} from '../seed-ids.js';

const CONTAINER = 'qc-reviews';

function buildQcReviews(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: QC_REVIEW_IDS.REVIEW_ORDER_001, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
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
        {
          questionId: 'q-subj-05', category: 'Subject Property',
          severity: 'MEDIUM', score: 5, maxScore: 10,
          note: 'Effective age listed as 15 years but property shows deferred maintenance consistent with 20+ years.',
        },
        {
          questionId: 'q-neigh-03', category: 'Neighborhood Analysis',
          severity: 'MEDIUM', score: 4, maxScore: 10,
          note: "Market conditions section does not address the neighborhood's increasing supply of new construction within 0.5 miles.",
        },
        {
          questionId: 'q-comp-04', category: 'Comparable Selection',
          severity: 'HIGH', score: 2, maxScore: 10,
          note: 'Comparable #3 closed 13 months prior to inspection — exceeds UAD 12-month recency guideline without justification.',
        },
        {
          questionId: 'q-comp-07', category: 'Comparable Selection',
          severity: 'HIGH', score: 3, maxScore: 10,
          note: 'Net adjustment on comparable #1 is 28% of sale price (UAD threshold is 25%). No explanation provided.',
        },
        {
          questionId: 'q-val-03', category: 'Reconciliation & Value',
          severity: 'MEDIUM', score: 6, maxScore: 10,
          note: 'Reconciliation narrative is two sentences — insufficient to justify the $525,000 conclusion given the adjustment spread across comparables.',
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
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
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
      // Shape 1: top-level categoriesResults with questions[] and document citations.
      // The adapter reads raw.categoriesResults to build the rich Evidence Panel.
      categoriesResults: [
        {
          categoryId: 'salesComparison', categoryName: 'Sales Comparison', categoryCode: 'SALES_COMP',
          score: 55, passed: false,
          summary: { totalQuestions: 2, questionsAnswered: 2, errors: 2, warnings: 0, averageConfidence: 0.93 },
          questions: [
            {
              questionId: 'COMP_MIN_THREE_CLOSED',
              questionCode: 'COMP_MIN_THREE_CLOSED',
              questionText: 'Are at least 3 closed comparables within 1 mile used?',
              questionType: 'PASS_FAIL',
              passed: false, severity: 'critical', verificationStatus: 'disputed',
              issue: {
                code: 'COMP_DISTANCE_EXCEEDED',
                title: 'Comparable #2 Distance Exceeds Guidelines',
                description: 'Comparable sale #2 is located 1.5 miles from the subject property, exceeding the 1-mile guideline for urban areas.',
                category: 'salesComparison',
                source: 'ai',
                recommendedAction: 'Replace comparable #2 with a sale within 1 mile or provide detailed market support for the expanded search.',
              },
              criteria: {
                ruleId: 'RULE-COMP-DISTANCE-URBAN',
                description: 'Urban properties require at least 3 closed comparables within 1 mile absent market condition justification',
                sourceDocument: {
                  documentId: 'doc-fnma-guidelines',
                  documentName: 'FNMA Selling Guide',
                  documentType: 'guideline',
                  pageNumber: 47,
                  sectionReference: 'B4-1.3-09',
                },
              },
              answer: {
                questionId: 'COMP_MIN_THREE_CLOSED',
                value: false, confidence: 0.96, source: 'ai',
                evidence: { actual: 'Comparable #2 at 1.5 mi', expected: '\u22641.0 mi for urban market', variance: 0.5 },
                citations: [
                  {
                    documentId: 'seed-doc-report-003',
                    documentName: 'SEED-2026-00103_Rush_1004_Report.pdf',
                    documentType: 'appraisal',
                    pageNumber: 5,
                    sectionReference: 'Sales Comparison Grid',
                    highlightText: '1.50 miles',
                  },
                ],
              },
            },
            {
              questionId: 'GROSS_ADJUSTMENT_THRESHOLD',
              questionCode: 'GROSS_ADJUSTMENT_THRESHOLD',
              questionText: 'Are gross adjustments within the 25% UAD threshold?',
              questionType: 'SCORED',
              passed: false, severity: 'high', verificationStatus: 'pending',
              issue: {
                code: 'GROSS_ADJ_EXCEEDED',
                title: 'Gross Adjustment Exceeds 25% Threshold',
                description: 'Comparable #2 gross adjustment is 31% of sale price, exceeding the UAD 25% guideline. No explanatory addendum provided.',
                category: 'salesComparison',
                source: 'ai',
                recommendedAction: 'Add an addendum explaining the adjustment rationale, or replace comparable #2.',
              },
              criteria: {
                ruleId: 'RULE-COMP-ADJUSTMENT-LIMITS',
                description: 'UAD requires gross adjustments \u226425% and net adjustments \u226415% of sale price without explanation',
                sourceDocument: {
                  documentId: 'doc-fnma-guidelines',
                  documentName: 'FNMA Selling Guide',
                  documentType: 'guideline',
                  pageNumber: 49,
                  sectionReference: 'B4-1.3-09',
                },
              },
              answer: {
                questionId: 'GROSS_ADJUSTMENT_THRESHOLD',
                value: 4, confidence: 0.91, source: 'ai',
                evidence: { actual: 'Comp #2 gross adj: 31%', expected: '\u226425% without addendum' },
                citations: [
                  {
                    documentId: 'seed-doc-report-003',
                    documentName: 'SEED-2026-00103_Rush_1004_Report.pdf',
                    documentType: 'appraisal',
                    pageNumber: 6,
                    sectionReference: 'Adjustment Grid',
                    highlightText: '31%',
                  },
                ],
              },
            },
          ],
        },
        {
          categoryId: 'appraiser', categoryName: 'Reconciliation & Value', categoryCode: 'APPRAISER',
          score: 62, passed: false,
          summary: { totalQuestions: 2, questionsAnswered: 2, errors: 1, warnings: 1, averageConfidence: 0.84 },
          questions: [
            {
              questionId: 'VALUE_RECONCILIATION_SUPPORTED',
              questionCode: 'VALUE_RECONCILIATION_SUPPORTED',
              questionText: 'Is the final value opinion supported by the reconciliation narrative?',
              questionType: 'SCORED',
              passed: false, severity: 'high', verificationStatus: 'pending',
              issue: {
                code: 'VALUE_UNSUPPORTED',
                title: 'Final Value Not Adequately Supported',
                description: 'Final value is 3% higher than the indicated range from comparables without narrative justification.',
                category: 'appraiser',
                source: 'ai',
                recommendedAction: 'Expand reconciliation narrative to explain the premium above the comparable-indicated range.',
              },
              criteria: {
                ruleId: 'RULE-VALUE-SUPPORT',
                description: 'The final value opinion must be supported by a reconciliation narrative referencing the weight given to each approach',
                sourceDocument: {
                  documentId: 'doc-uspap-standards',
                  documentName: 'USPAP Standards',
                  documentType: 'guideline',
                  pageNumber: 22,
                  sectionReference: 'Standards Rule 1-6',
                },
              },
              answer: {
                questionId: 'VALUE_RECONCILIATION_SUPPORTED',
                value: 5, confidence: 0.82, source: 'ai',
                evidence: { actual: '$525,000 — above comp range of $505K\u2013$518K', expected: 'Value within or explained above comp range' },
                citations: [
                  {
                    documentId: 'seed-doc-report-003',
                    documentName: 'SEED-2026-00103_Rush_1004_Report.pdf',
                    documentType: 'appraisal',
                    pageNumber: 8,
                    sectionReference: 'Reconciliation',
                    highlightText: '$525,000',
                  },
                ],
              },
            },
            {
              questionId: 'APPROACHES_CONSIDERED',
              questionCode: 'APPROACHES_CONSIDERED',
              questionText: 'Are all applicable approaches to value considered and reported?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-APPROACHES',
                description: 'Sales comparison approach required; cost and income approaches must be considered and their exclusion explained',
              },
              answer: {
                questionId: 'APPROACHES_CONSIDERED',
                value: true, confidence: 0.92, source: 'ai',
                evidence: { actual: 'Sales comparison used; cost approach noted not applicable', expected: 'All applicable approaches considered' },
                citations: [
                  {
                    documentId: 'seed-doc-report-003',
                    documentName: 'SEED-2026-00103_Rush_1004_Report.pdf',
                    documentType: 'appraisal',
                    pageNumber: 8,
                    sectionReference: 'Reconciliation',
                    highlightText: 'cost approach is not applicable',
                  },
                ],
              },
            },
          ],
        },
      ],
      version: 5,
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },

    // ── Full QCValidationReport (proper Shape 1: categoriesResults[].questions[]) ──
    // This is the document that drives the rich Evidence Panel in the UI:
    // Issue Description, Evidence (actual/expected), Validation Criteria, document links.
    {
      id: QC_REVIEW_IDS.FULL_VALIDATION_REPORT_001, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      engagementId: ENGAGEMENT_IDS.SINGLE_DELIVERED_004,
      sessionId: 'session-full-001',
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      checklistName: 'UAD Standard Residential QC Checklist (2026)',
      checklistVersion: '2026.1',
      propertyAddress: '1234 Maple Street, Sacramento, CA 95814',
      appraisedValue: 525_000,
      status: 'COMPLETED',
      overallScore: 88,
      passFailStatus: 'CONDITIONAL_PASS',
      reviewedBy: STAFF_IDS.QC_ANALYST_1,
      reviewedByName: 'Alex Kim',
      summary: {
        totalCategories: 4, totalQuestions: 12, totalAnswered: 12,
        totalErrors: 2, totalWarnings: 2, criticalIssues: 1, averageConfidence: 0.91,
      },
      // Top-level categoriesResults — this is the Shape 1 that mapToChecklistItem() uses
      categoriesResults: [
        {
          categoryId: 'subject', categoryName: 'Subject Property', categoryCode: 'SUBJECT',
          score: 78, passed: false,
          summary: { totalQuestions: 5, questionsAnswered: 5, errors: 1, warnings: 1, averageConfidence: 0.89 },
          questions: [
            {
              questionId: 'PROPERTY_ADDRESS_CORRECT',
              questionCode: 'PROPERTY_ADDRESS_CORRECT',
              questionText: 'Is the property address accurate and matches title documents?',
              questionType: 'PASS_FAIL',
              passed: false,
              severity: 'high',
              verificationStatus: 'pending',
              issue: {
                code: 'ADDR_MISMATCH',
                title: 'Property Address Discrepancy',
                description: 'Issue detected: Verify street address, city, state, ZIP match title documents and public records',
                category: 'subject',
                source: 'system',
                recommendedAction: 'Cross-reference with title commitment and public records to confirm correct address.',
              },
              criteria: {
                ruleId: 'RULE-PROPERTY-ADDRESS-CORRECT',
                description: 'Verify street address, city, state, ZIP match title documents and public records',
                sourceDocument: {
                  documentId: 'doc-uspap-standards',
                  documentName: 'USPAP Standards',
                  documentType: 'guideline',
                  pageNumber: 14,
                  sectionReference: 'Standards Rule 1-2(e)',
                },
              },
              answer: {
                questionId: 'PROPERTY_ADDRESS_CORRECT',
                value: false,
                confidence: 0.95,
                source: 'ai',
                evidence: { actual: 'Issue detected', expected: 'Compliant' },
                citations: [
                  {
                    documentId: 'e2b2bc5f-a46d-49af-bfd2-eb40bac0b89e', // 17 David Dr.pdf (uploaded)
                    documentName: '17 David Dr.pdf',
                    documentType: 'appraisal',
                    pageNumber: 1,
                    sectionReference: 'Property Identification & Description',
                    highlightText: '1234 Maple Street',
                  },
                ],
              },
            },
            {
              questionId: 'LEGAL_DESCRIPTION',
              questionCode: 'LEGAL_DESCRIPTION',
              questionText: 'Is the legal description complete and accurate?',
              questionType: 'PASS_FAIL',
              passed: true,
              severity: 'low',
              verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-LEGAL-DESCRIPTION',
                description: 'Legal description must match county assessor records and title commitment',
                sourceDocument: {
                  documentId: 'doc-uspap-standards',
                  documentName: 'USPAP Standards',
                  documentType: 'guideline',
                  pageNumber: 14,
                },
              },
              answer: {
                questionId: 'LEGAL_DESCRIPTION',
                value: true, confidence: 0.97, source: 'ai',
                evidence: { actual: 'Compliant', expected: 'Compliant' },
                citations: [
                  {
                    documentId: 'e2b2bc5f-a46d-49af-bfd2-eb40bac0b89e', // 17 David Dr.pdf (uploaded)
                    documentName: '17 David Dr.pdf',
                    documentType: 'appraisal',
                    pageNumber: 1,
                    sectionReference: 'Property Identification & Description',
                  },
                ],
              },
            },
            {
              questionId: 'EXTERIOR_PHOTOS_ADEQUATE',
              questionCode: 'EXTERIOR_PHOTOS_ADEQUATE',
              questionText: 'Are exterior photos clear and show all required views?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-PHOTO-EXTERIOR',
                description: 'Front, rear, and street scene photos required per UAD photo standards',
                sourceDocument: {
                  documentId: 'doc-uad-guidelines',
                  documentName: 'UAD Implementation Guidelines',
                  documentType: 'guideline',
                  pageNumber: 22,
                },
              },
              answer: {
                questionId: 'EXTERIOR_PHOTOS_ADEQUATE',
                value: true, confidence: 0.93, source: 'ai',
                evidence: { actual: 'Compliant', expected: 'Compliant' },
              },
            },
            {
              questionId: 'INTERIOR_PHOTOS_ADEQUATE',
              questionCode: 'INTERIOR_PHOTOS_ADEQUATE',
              questionText: 'Are interior photos clear and show all major rooms?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-PHOTO-INTERIOR',
                description: 'Kitchen, bathrooms, living areas, and all bedrooms must be photographed',
                sourceDocument: {
                  documentId: 'doc-uad-guidelines',
                  documentName: 'UAD Implementation Guidelines',
                  documentType: 'guideline',
                  pageNumber: 23,
                },
              },
              answer: {
                questionId: 'INTERIOR_PHOTOS_ADEQUATE',
                value: true, confidence: 0.91, source: 'ai',
                evidence: { actual: 'Compliant', expected: 'Compliant' },
              },
            },
            {
              questionId: 'CONDITION_RATING_SUPPORTED',
              questionCode: 'CONDITION_RATING_SUPPORTED',
              questionText: 'Is the condition rating supported by photos and description?',
              questionType: 'SCORED',
              passed: false, severity: 'medium', verificationStatus: 'pending',
              issue: {
                code: 'CONDITION_UNSUPPORTED',
                title: 'Condition Rating Not Fully Supported',
                description: 'C3 condition rating is assigned but photos show evidence of deferred maintenance inconsistent with C3. Description does not address the condition of the HVAC system or roof.',
                category: 'subject',
                source: 'ai',
                recommendedAction: 'Add specific description of HVAC and roof condition or revise condition rating to C4.',
              },
              criteria: {
                ruleId: 'RULE-CONDITION-SUPPORT',
                description: 'Condition rating must be supported by evidence in the property description and photos',
                sourceDocument: {
                  documentId: 'doc-uad-guidelines',
                  documentName: 'UAD Implementation Guidelines',
                  documentType: 'guideline',
                  pageNumber: 18,
                },
              },
              answer: {
                questionId: 'CONDITION_RATING_SUPPORTED',
                value: 6, confidence: 0.82, source: 'ai',
                evidence: { actual: 'C3 — partially supported', expected: 'C3 — fully supported with description', variance: 0 },
                citations: [
                  {
                    documentId: 'e2b2bc5f-a46d-49af-bfd2-eb40bac0b89e', // 17 David Dr.pdf (uploaded)
                    documentName: '17 David Dr.pdf',
                    documentType: 'appraisal',
                    pageNumber: 3,
                    sectionReference: 'Improvements Section',
                    highlightText: 'C3',
                  },
                ],
              },
            },
          ],
        },
        {
          categoryId: 'salesComparison', categoryName: 'Sales Comparison', categoryCode: 'SALES_COMP',
          score: 82, passed: true,
          summary: { totalQuestions: 3, questionsAnswered: 3, errors: 1, warnings: 0, averageConfidence: 0.90 },
          questions: [
            {
              questionId: 'COMP_MIN_THREE_CLOSED',
              questionCode: 'COMP_MIN_THREE_CLOSED',
              questionText: 'Are at least 3 closed comparables within 1 mile used?',
              questionType: 'PASS_FAIL',
              passed: false, severity: 'critical', verificationStatus: 'disputed',
              issue: {
                code: 'COMP_DISTANCE_EXCEEDED',
                title: 'Comparable #2 Distance Exceeds Guidelines',
                description: 'Comparable sale #2 is located 1.5 miles from the subject property, exceeding the 1-mile guideline for urban areas.',
                category: 'salesComparison',
                source: 'ai',
                recommendedAction: 'Replace comparable #2 with a sale within 1 mile or provide detailed market support for the expanded search.',
              },
              criteria: {
                ruleId: 'RULE-COMP-DISTANCE-URBAN',
                description: 'Urban properties require at least 3 closed comparables within 1 mile absent market condition justification',
                sourceDocument: {
                  documentId: 'doc-fnma-guidelines',
                  documentName: 'FNMA Selling Guide',
                  documentType: 'guideline',
                  pageNumber: 47,
                  sectionReference: 'B4-1.3-09',
                },
              },
              answer: {
                questionId: 'COMP_MIN_THREE_CLOSED',
                value: false, confidence: 0.96, source: 'ai',
                evidence: { actual: 'Comparable #2 at 1.5 mi', expected: '≤ 1.0 mi for urban market', variance: 0.5 },
                citations: [
                  {
                    documentId: 'e2b2bc5f-a46d-49af-bfd2-eb40bac0b89e', // 17 David Dr.pdf (uploaded)
                    documentName: '17 David Dr.pdf',
                    documentType: 'appraisal',
                    pageNumber: 5,
                    sectionReference: 'Sales Comparison Grid',
                    highlightText: '1.50 miles',
                  },
                ],
              },
            },
            {
              questionId: 'COMP_DATE_WITHIN_12MO',
              questionCode: 'COMP_DATE_WITHIN_12MO',
              questionText: 'Are all comparables within the 12-month sale date guideline?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-COMP-RECENCY',
                description: 'Comparable sales should be within 12 months of effective date without market justification',
              },
              answer: {
                questionId: 'COMP_DATE_WITHIN_12MO',
                value: true, confidence: 0.99, source: 'ai',
                evidence: { actual: 'All within 10 months', expected: '≤ 12 months' },
              },
            },
            {
              questionId: 'COMP_ADJUSTMENTS_WITHIN_THRESHOLD',
              questionCode: 'COMP_ADJUSTMENTS_WITHIN_THRESHOLD',
              questionText: 'Are gross adjustments within 25% and net adjustments within 15%?',
              questionType: 'SCORED',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-COMP-ADJUSTMENT-LIMITS',
                description: 'UAD requires gross adjustments ≤25% and net adjustments ≤15% of sale price without explanation',
                sourceDocument: {
                  documentId: 'doc-fnma-guidelines',
                  documentName: 'FNMA Selling Guide',
                  documentType: 'guideline',
                  pageNumber: 49,
                },
              },
              answer: {
                questionId: 'COMP_ADJUSTMENTS_WITHIN_THRESHOLD',
                value: 9, confidence: 0.88, source: 'ai',
                evidence: { actual: 'Max gross 22%; max net 12%', expected: '≤25% gross / ≤15% net' },
              },
            },
          ],
        },
        {
          categoryId: 'appraiser', categoryName: 'Appraiser', categoryCode: 'APPRAISER',
          score: 100, passed: true,
          summary: { totalQuestions: 2, questionsAnswered: 2, errors: 0, warnings: 0, averageConfidence: 0.98 },
          questions: [
            {
              questionId: 'APPRAISER_LICENSE_ACTIVE',
              questionCode: 'APPRAISER_LICENSE_ACTIVE',
              questionText: 'Is the appraiser license current and appropriate for this assignment?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-APPRAISER-LICENSE',
                description: 'Appraiser must hold a valid Certified Residential or Certified General license for the subject state',
              },
              answer: {
                questionId: 'APPRAISER_LICENSE_ACTIVE',
                value: true, confidence: 0.99, source: 'system',
                evidence: { actual: 'License AR-CA-2024-98765 — Active, exp 2026-12-31', expected: 'Active state license' },
              },
            },
            {
              questionId: 'APPRAISER_COMPETENCY',
              questionCode: 'APPRAISER_COMPETENCY',
              questionText: 'Does the appraiser demonstrate competency for the subject property type?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-COMPETENCY',
                description: 'Appraiser must certify competency per USPAP Competency Rule',
                sourceDocument: {
                  documentId: 'doc-uspap-standards',
                  documentName: 'USPAP Standards',
                  documentType: 'guideline',
                  pageNumber: 5,
                  sectionReference: 'Competency Rule',
                },
              },
              answer: {
                questionId: 'APPRAISER_COMPETENCY',
                value: true, confidence: 0.97, source: 'ai',
                evidence: { actual: 'Competency certified in report', expected: 'USPAP competency certification present' },
              },
            },
          ],
        },
        {
          categoryId: 'neighborhood', categoryName: 'Neighborhood Analysis', categoryCode: 'NEIGHBORHOOD',
          score: 90, passed: true,
          summary: { totalQuestions: 2, questionsAnswered: 2, errors: 0, warnings: 1, averageConfidence: 0.87 },
          questions: [
            {
              questionId: 'NEIGHBORHOOD_TREND_REPORTED',
              questionCode: 'NEIGHBORHOOD_TREND_REPORTED',
              questionText: 'Are neighborhood market trends (supply, demand, pricing) correctly reported?',
              questionType: 'PASS_FAIL',
              passed: true, severity: 'low', verificationStatus: 'verified',
              criteria: {
                ruleId: 'RULE-NEIGH-TRENDS',
                description: 'Neighborhood section must address supply, demand, and price trend direction',
              },
              answer: {
                questionId: 'NEIGHBORHOOD_TREND_REPORTED',
                value: true, confidence: 0.91, source: 'ai',
                evidence: { actual: 'Stable — supported', expected: 'Trend reported and supported' },
              },
            },
            {
              questionId: 'NEIGHBORHOOD_BOUNDARIES_DEFINED',
              questionCode: 'NEIGHBORHOOD_BOUNDARIES_DEFINED',
              questionText: 'Are neighborhood boundaries clearly defined and consistent with MLS data?',
              questionType: 'SCORED',
              passed: true, severity: 'medium', verificationStatus: 'pending',
              issue: {
                code: 'NEIGH_BOUNDARY_MINOR',
                title: 'Neighborhood Boundary Vague',
                description: 'Neighborhood boundaries described as "East Sacramento" — suggest adding cardinal direction boundaries for precision.',
                category: 'neighborhood',
                source: 'ai',
                recommendedAction: 'Define boundaries as street names or census boundaries for compliance with UAD best practices.',
              },
              criteria: {
                ruleId: 'RULE-NEIGH-BOUNDARIES',
                description: 'Boundaries should be defined by physical features, jurisdictions, or specific streets',
              },
              answer: {
                questionId: 'NEIGHBORHOOD_BOUNDARIES_DEFINED',
                value: 7, confidence: 0.82, source: 'ai',
                evidence: { actual: 'Defined — somewhat vague', expected: 'Specific boundary definition' },
              },
            },
          ],
        },
      ],
      criticalIssues: [
        {
          questionId: 'COMP_MIN_THREE_CLOSED',
          code: 'COMP_DISTANCE_EXCEEDED',
          title: 'Comparable #2 Distance Exceeds Guidelines',
          description: 'Comparable sale #2 is located 1.5 miles from the subject property, exceeding the 1-mile guideline for urban areas.',
          severity: 'critical',
          category: 'salesComparison',
          source: 'ai',
          verificationStatus: 'disputed',
          recommendedAction: 'Replace with a comparable within 1 mile or provide detailed justification for distance.',
        },
      ],
      startedAt: daysAgo(10),
      completedAt: daysAgo(10),
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },

    // ── Order 010 — REVISION_REQUESTED ──────────────────────────────────────────
    // Full QC review that resulted in REVISION_REQUIRED. This is the primary review
    // record that triggered the revision request documents in revisions.ts.
    {
      id: QC_REVIEW_IDS.REVIEW_ORDER_010, tenantId, type: 'qc-review',
      orderId: ORDER_IDS.REVISION_010,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      checklistId: QC_CHECKLIST_IDS.UAD_STANDARD,
      reviewerId: STAFF_IDS.QC_ANALYST_1,
      reviewerName: 'Alex Rivera',
      status: 'COMPLETED',
      result: 'REVISION_REQUIRED',
      overallScore: 68,
      propertyAddress: '2350 McKinney Ave, Dallas, TX 75201',
      appraisedValue: 510_000,
      vendorId: VENDOR_IDS.TX_PROPERTY,
      vendorName: 'Texas Property Experts LLC',
      startedAt: daysAgo(7),
      completedAt: daysAgo(4),
      findings: [
        {
          questionId: 'q-comp-02',
          category: 'Comparable Selection',
          severity: 'HIGH',
          score: 0,
          maxScore: 10,
          note: 'Comparable #2 (2280 Commerce St) is commercially zoned — fundamentally incompatible with a residential subject. Must be replaced.',
        },
        {
          questionId: 'q-comp-05',
          category: 'Comparable Selection',
          severity: 'HIGH',
          score: 2,
          maxScore: 10,
          note: 'GLA adjustment on Comparable #2 is 31% of sale price, exceeding the UAD 25% gross adjustment threshold. No explanatory addendum provided.',
        },
        {
          questionId: 'q-comp-07',
          category: 'Comparable Selection',
          severity: 'MEDIUM',
          score: 5,
          maxScore: 10,
          note: 'Net adjustment on Comparable #3 is 22% — approaching threshold. Appraiser should add a brief narrative justifying the condition differential.',
        },
        {
          questionId: 'q-val-02',
          category: 'Reconciliation & Value',
          severity: 'MEDIUM',
          score: 6,
          maxScore: 10,
          note: 'Reconciliation narrative relies heavily on Comparable #2 to support the $510K conclusion. With #2 requiring replacement the reconciliation must be redone.',
        },
        {
          questionId: 'q-subj-04',
          category: 'Subject Property',
          severity: 'LOW',
          score: 7,
          maxScore: 10,
          note: 'Effective age listed as 12 years on a 2008-built property — lower than expected given cosmetic deferred maintenance observed in photos.',
        },
      ],
      summary: 'Two HIGH-severity findings require mandatory correction: inappropriate zoning on Comparable #2 and a GLA adjustment exceeding UAD thresholds. Revision required before delivery.',
      revisionItemIds: [REVISION_IDS.REVISION_ORDER_010],
      createdAt: daysAgo(7), updatedAt: daysAgo(4),
    },
  ];
}

export const module: SeedModule = {
  name: 'qc-reviews',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, '/orderId');
    }

    for (const review of buildQcReviews(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, review, result);
    }

    return result;
  },
};
