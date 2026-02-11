/**
 * Seed Enhanced QC Review Sample Data
 * 
 * Seeds the database with the frontend's proposed QC review schema example
 */

import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { QCReview } from '../types/qc-workflow.js';

const logger = new Logger();
const cosmosDb = new CosmosDbService();

async function seedEnhancedQCReview() {
  logger.info('Starting enhanced QC review data seeding...');

  try {
    await cosmosDb.initialize();

    const enhancedReview: QCReview = {
      id: "qc-review-001",
      orderId: "ord_2024_00123456",
      orderNumber: "ORD-2026-001",
      appraisalId: "appr-001",
      
      status: "IN_PROGRESS",
      statusHistory: [
        {
          status: "PENDING",
          timestamp: "2026-02-08T09:15:00.000Z",
          changedBy: "system"
        },
        {
          status: "IN_PROGRESS",
          timestamp: "2026-02-08T14:30:00.000Z",
          changedBy: "analyst-001"
        }
      ],
      
      priorityLevel: "HIGH",
      priorityScore: 85,
      riskFactors: [
        {
          factor: "HIGH_VALUE",
          description: "Appraisal over $500,000",
          riskLevel: "MEDIUM",
          weight: 20
        },
        {
          factor: "RUSH_ORDER",
          description: "Priority order with tight SLA",
          riskLevel: "HIGH",
          weight: 30
        },
        {
          factor: "COMPLEX_PROPERTY",
          description: "Unique property characteristics requiring additional scrutiny",
          riskLevel: "MEDIUM",
          weight: 15
        }
      ],
      
      propertyAddress: "1234 Maple Street, Sacramento, CA 95814",
      propertyType: "SINGLE_FAMILY",
      appraisedValue: 525000,
      inspectionDate: "2026-02-06T14:00:00.000Z",
      
      clientId: "client-001",
      clientName: "First National Bank",
      vendorId: "vendor-001",
      vendorName: "Precision Appraisal Services",
      loanNumber: "LN-2024-987654",
      borrowerName: "John Michael Smith",
      loanAmount: 420000,
      loanToValue: 80,
      
      reviewers: [
        {
          userId: "analyst-001",
          userName: "Sarah Johnson",
          userEmail: "sarah.johnson@example.com",
          role: "PRIMARY",
          assignedAt: "2026-02-08T14:30:00.000Z",
          assignedBy: "supervisor-001",
          status: "ACTIVE"
        },
        {
          userId: "analyst-002",
          userName: "Mike Chen",
          userEmail: "mike.chen@example.com",
          role: "SECONDARY",
          assignedAt: "2026-02-08T15:00:00.000Z",
          assignedBy: "supervisor-001",
          status: "ACTIVE"
        }
      ],
      
      checklists: [
        {
          checklistId: "checklist-uad-compliance",
          checklistName: "UAD Compliance Checklist",
          checklistType: "COMPLIANCE",
          status: "IN_PROGRESS",
          maxScore: 100,
          currentScore: 0,
          completedQuestions: 0,
          totalQuestions: 45,
          startedAt: "2026-02-08T14:35:00.000Z"
        },
        {
          checklistId: "checklist-market-analysis",
          checklistName: "Market Analysis Review",
          checklistType: "TECHNICAL",
          status: "NOT_STARTED",
          maxScore: 100,
          currentScore: 0,
          completedQuestions: 0,
          totalQuestions: 38
        },
        {
          checklistId: "checklist-comparable-sales",
          checklistName: "Comparable Sales Verification",
          checklistType: "TECHNICAL",
          status: "NOT_STARTED",
          maxScore: 100,
          currentScore: 0,
          completedQuestions: 0,
          totalQuestions: 52
        }
      ],
      
      results: {
        overallScore: 87,
        overallStatus: "PASSED",
        maxScore: 100,
        percentScore: 87,
        riskLevel: "LOW",
        decision: "APPROVED",
        categoriesCompleted: 2,
        totalCategories: 4,
        questionsAnswered: 13,
        totalQuestions: 45,
        criticalIssuesCount: 1,
        majorIssuesCount: 2,
        minorIssuesCount: 4,
        categoriesResults: [
          {
            categoryId: "subject",
            categoryName: "Subject Property",
            categoryScore: 92,
            categoryStatus: "PASSED",
            questionsAnswered: 4,
            totalQuestions: 12,
            completedAt: "2026-02-08T15:10:00.000Z"
          },
          {
            categoryId: "neighborhood",
            categoryName: "Neighborhood Analysis",
            categoryScore: 85,
            categoryStatus: "PASSED",
            questionsAnswered: 9,
            totalQuestions: 15
          }
        ],
        findings: [
          {
            findingId: "finding-001",
            severity: "CRITICAL",
            category: "salesComparison",
            title: "Comparable #2 Distance Exceeds Guidelines",
            description: "Comparable sale #2 is located 1.5 miles from subject property, exceeding the 1-mile guideline for urban areas",
            recommendation: "Replace with a comparable within 1 mile or provide detailed justification for distance",
            status: "OPEN",
            verificationStatus: "DISPUTED",
            raisedAt: "2026-02-08T15:25:00.000Z",
            raisedBy: "analyst-001"
          }
        ]
      },
      
      sla: {
        dueDate: "2026-02-09T17:00:00.000Z",
        targetResponseTime: 1440,
        breached: false,
        escalated: false,
        elapsedTime: 310,
        remainingTime: 1130,
        percentComplete: 21.5,
        atRiskThreshold: 80,
        atRisk: false,
        extensions: []
      },
      
      queuePosition: 5,
      estimatedReviewTime: 45,
      turnaroundTime: 3,
      
      documents: [
        {
          documentId: "doc_appraisal_20260208_001",
          documentName: "Full Appraisal Report 1004.pdf",
          documentType: "APPRAISAL_REPORT",
          pageCount: 35,
          fileSizeBytes: 2457600,
          uploadedAt: "2026-02-08T09:00:00.000Z",
          uploadedBy: "vendor-001"
        },
        {
          documentId: "doc_comps_20260208_001",
          documentName: "Comparable Sales Data.pdf",
          documentType: "COMPARABLE_SALES",
          pageCount: 4,
          fileSizeBytes: 524288,
          uploadedAt: "2026-02-08T09:05:00.000Z",
          uploadedBy: "vendor-001"
        },
        {
          documentId: "doc_photos_20260208_001",
          documentName: "Property Photos.pdf",
          documentType: "PHOTOS",
          pageCount: 12,
          fileSizeBytes: 8388608,
          uploadedAt: "2026-02-08T09:10:00.000Z",
          uploadedBy: "vendor-001"
        }
      ],
      
      aiPreScreening: {
        completed: true,
        completedAt: "2026-02-08T10:30:00.000Z",
        riskScore: 42,
        riskLevel: "MEDIUM",
        confidence: 0.87,
        flaggedItems: [
          {
            itemId: "ai-flag-001",
            category: "comparable_selection",
            severity: "MEDIUM",
            description: "Comparable #2 distance may exceed guidelines",
            confidence: 0.92
          },
          {
            itemId: "ai-flag-002",
            category: "value_reconciliation",
            severity: "LOW",
            description: "Final value is 3% higher than indicated range",
            confidence: 0.78
          }
        ],
        recommendedFocus: [
          "Comparable sales selection and distance",
          "Value reconciliation methodology",
          "Market conditions adjustments"
        ]
      },
      
      vendorHistory: {
        totalReviewsCompleted: 12,
        passRate: 91.7,
        averageScore: 88.5,
        lastReviewDate: "2026-01-15T10:00:00.000Z",
        lastReviewStatus: "PASSED",
        lastReviewScore: 92,
        criticalIssuesLast6Months: 1,
        majorIssuesLast6Months: 3,
        averageTurnaroundDays: 2.8
      },
      
      notes: [
        {
          noteId: "note-001",
          noteType: "SYSTEM",
          content: "Review automatically assigned based on workload balancing",
          createdAt: "2026-02-08T14:30:00.000Z",
          createdBy: "system",
          visibility: "INTERNAL"
        },
        {
          noteId: "note-002",
          noteType: "MANAGER",
          content: "High priority - client requested expedited review",
          createdAt: "2026-02-08T14:35:00.000Z",
          createdBy: "supervisor-001",
          visibility: "INTERNAL"
        }
      ],
      
      timeline: [
        {
          eventId: "evt-001",
          eventType: "CREATED",
          description: "QC review created",
          timestamp: "2026-02-08T09:15:00.000Z",
          performedBy: "system"
        },
        {
          eventId: "evt-002",
          eventType: "AI_PRESCREENING_COMPLETED",
          description: "AI pre-screening completed - Risk score: 42 (MEDIUM)",
          timestamp: "2026-02-08T10:30:00.000Z",
          performedBy: "ai-engine"
        },
        {
          eventId: "evt-003",
          eventType: "ASSIGNED",
          description: "Review assigned to Sarah Johnson (PRIMARY)",
          timestamp: "2026-02-08T14:30:00.000Z",
          performedBy: "supervisor-001"
        },
        {
          eventId: "evt-004",
          eventType: "STARTED",
          description: "Review started - UAD Compliance Checklist in progress",
          timestamp: "2026-02-08T14:35:00.000Z",
          performedBy: "analyst-001"
        },
        {
          eventId: "evt-005",
          eventType: "FINDING_RAISED",
          description: "Critical finding raised: Comparable #2 Distance Exceeds Guidelines",
          timestamp: "2026-02-08T15:25:00.000Z",
          performedBy: "analyst-001"
        }
      ],
      
      createdAt: "2026-02-08T09:15:00.000Z",
      updatedAt: "2026-02-08T15:25:00.000Z",
      createdBy: "system",
      lastUpdatedBy: "analyst-001",
      version: 5,
      
      accessControl: {
        ownerId: "analyst-001",
        ownerEmail: "sarah.johnson@example.com",
        teamId: "qc-team-west",
        visibilityScope: "TEAM",
        allowedUserIds: ["analyst-001", "analyst-002", "supervisor-001"],
        allowedRoles: ["QC_ANALYST", "QC_SUPERVISOR", "QC_MANAGER"]
      }
    };

    logger.info('Creating enhanced QC review in database...');
    
    // Insert into qc-reviews container
    const result = await cosmosDb.createItem('qc-reviews', enhancedReview);
    
    logger.info('✅ Enhanced QC review seeded successfully!');
    logger.info(`   Review ID: ${result.id}`);
    logger.info(`   Status: ${result.status}`);
    logger.info(`   Priority: ${result.priorityLevel} (Score: ${result.priorityScore})`);
    logger.info(`   Property: ${result.propertyAddress}`);
    logger.info(`   Reviewers: ${result.reviewers.length}`);
    logger.info(`   Documents: ${result.documents?.length || 0}`);
    logger.info(`   Timeline Events: ${result.timeline?.length || 0}`);
    logger.info(`   AI Risk Score: ${result.aiPreScreening?.riskScore}`);

    return result;

  } catch (error) {
    logger.error('Failed to seed enhanced QC review', { error });
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedEnhancedQCReview()
    .then(() => {
      logger.info('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed', { error });
      process.exit(1);
    });
}

export { seedEnhancedQCReview };
