# QC Review Schema Updates - Frontend Integration

**Date:** February 9, 2026  
**Status:** ✅ Complete

## Overview

Updated the QC Review types and interfaces to match the frontend's proposed schema. All changes maintain backward compatibility while adding enhanced fields for richer functionality.

---

## Changes Made

### 1. **QCReviewStatus Enum - Added IN_PROGRESS**
```typescript
export enum QCReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',     // ✅ NEW - More granular than IN_REVIEW
  IN_REVIEW = 'IN_REVIEW',         // Kept for backward compatibility
  COMPLETED = 'COMPLETED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}
```

### 2. **QCReview Interface - Major Enhancements**

#### Added Status Tracking
- `statusHistory?: StatusHistoryEntry[]` - Full audit trail of status changes

#### Enhanced Property Information
- `propertyType?: string` - SINGLE_FAMILY, CONDO, etc.
- `inspectionDate?: string` - When property was inspected

#### Enhanced Client/Loan Information
- `loanNumber?: string` - Loan identifier
- `borrowerName?: string` - Borrower name
- `loanAmount?: number` - Loan amount
- `loanToValue?: number` - LTV ratio

#### Risk Assessment
- `riskFactors?: RiskFactor[]` - Array of risk factors with weights

#### Queue Management
- `queuePosition?: number` - Position in queue
- `estimatedReviewTime?: number` - Estimated minutes to complete
- `turnaroundTime?: number` - Expected turnaround in days

#### Documents
- `documents?: QCDocument[]` - Attached appraisal documents

#### AI Integration
- `aiPreScreening?: AIPreScreening` - AI pre-screening results

#### Vendor Performance
- `vendorHistory?: VendorHistory` - Historical vendor performance

#### Communication
- `notes?: QCNote[]` - Notes and comments
- `timeline?: TimelineEvent[]` - Activity timeline

#### Access Control
- `accessControl?: AccessControl` - Team/role-based access

#### Version Control
- `lastUpdatedBy?: string` - Last user to update
- `version?: number` - Document version number

### 3. **QCReviewChecklist - Enhanced Progress Tracking**
```typescript
export interface QCReviewChecklist {
  // ... existing fields ...
  currentScore?: number;           // ✅ NEW
  completedQuestions?: number;     // ✅ NEW
  totalQuestions?: number;         // ✅ NEW
  startedAt?: string;              // ✅ NEW
}
```

### 4. **QCReviewer - Added Status**
```typescript
export interface QCReviewer {
  // ... existing fields ...
  status?: string;  // ✅ NEW - ACTIVE, INACTIVE, etc.
}
```

### 5. **QCReviewResults - Comprehensive Results**
```typescript
export interface QCReviewResults {
  // ... existing fields ...
  overallStatus?: string;                // ✅ NEW - PASSED, FAILED, CONDITIONAL
  categoriesCompleted?: number;          // ✅ NEW
  totalCategories?: number;              // ✅ NEW
  questionsAnswered?: number;            // ✅ NEW
  totalQuestions?: number;               // ✅ NEW
  majorIssuesCount?: number;             // ✅ NEW
  minorIssuesCount?: number;             // ✅ NEW
  categoriesResults?: CategoryResult[];  // ✅ NEW - Detailed category breakdown
  findings?: Finding[];                  // ✅ NEW - Individual findings
}
```

### 6. **QCReviewSLA - Real-Time Tracking**
```typescript
export interface QCReviewSLA {
  // ... existing fields ...
  elapsedTime?: number;        // ✅ NEW - Minutes elapsed
  remainingTime?: number;      // ✅ NEW - Minutes remaining
  percentComplete?: number;    // ✅ NEW - 0-100
  atRiskThreshold?: number;    // ✅ NEW - Warning threshold (e.g., 80%)
  atRisk?: boolean;            // ✅ NEW - If at risk of breach
  extensions?: SLAExtension[]; // ✅ NEW - Extension history
}
```

---

## New Supporting Interfaces

### StatusHistoryEntry
Tracks every status change with timestamp and user:
```typescript
export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  changedBy: string;
}
```

### RiskFactor
Structured risk assessment factors:
```typescript
export interface RiskFactor {
  factor: string;              // e.g., "HIGH_VALUE", "RUSH_ORDER"
  description: string;
  riskLevel: string;           // LOW, MEDIUM, HIGH, CRITICAL
  weight: number;              // Impact weight (0-100)
}
```

### CategoryResult
Detailed breakdown by category:
```typescript
export interface CategoryResult {
  categoryId: string;
  categoryName: string;
  categoryScore: number;
  categoryStatus: string;
  questionsAnswered: number;
  totalQuestions: number;
  completedAt?: string;
}
```

### Finding
Individual QC findings:
```typescript
export interface Finding {
  findingId: string;
  severity: string;             // CRITICAL, MAJOR, MODERATE, MINOR
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  status: string;               // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  verificationStatus?: string;  // VERIFIED, DISPUTED, PENDING
  raisedAt: string;
  raisedBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
```

### QCDocument
Document attachments:
```typescript
export interface QCDocument {
  documentId: string;
  documentName: string;
  documentType: string;         // APPRAISAL_REPORT, COMPARABLE_SALES, PHOTOS
  pageCount?: number;
  fileSizeBytes?: number;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}
```

### AIPreScreening
AI analysis results:
```typescript
export interface AIPreScreening {
  completed: boolean;
  completedAt?: string;
  riskScore: number;            // 0-100
  riskLevel: string;
  confidence: number;           // 0-1
  flaggedItems?: AIFlaggedItem[];
  recommendedFocus?: string[];
}
```

### VendorHistory
Historical vendor performance:
```typescript
export interface VendorHistory {
  totalReviewsCompleted: number;
  passRate: number;
  averageScore: number;
  lastReviewDate?: string;
  lastReviewStatus?: string;
  lastReviewScore?: number;
  criticalIssuesLast6Months: number;
  majorIssuesLast6Months: number;
  averageTurnaroundDays: number;
}
```

### QCNote
Notes and comments:
```typescript
export interface QCNote {
  noteId: string;
  noteType: string;             // SYSTEM, MANAGER, ANALYST
  content: string;
  createdAt: string;
  createdBy: string;
  visibility: string;           // INTERNAL, EXTERNAL
}
```

### TimelineEvent
Activity timeline:
```typescript
export interface TimelineEvent {
  eventId: string;
  eventType: string;            // CREATED, ASSIGNED, STARTED, etc.
  description: string;
  timestamp: string;
  performedBy: string;
  metadata?: Record<string, any>;
}
```

### AccessControl
Role-based access:
```typescript
export interface AccessControl {
  ownerId: string;
  ownerEmail?: string;
  teamId?: string;
  visibilityScope: string;      // PRIVATE, TEAM, ORGANIZATION, PUBLIC
  allowedUserIds?: string[];
  allowedRoles?: string[];
}
```

### SLAExtension
SLA extension tracking:
```typescript
export interface SLAExtension {
  extensionMinutes: number;
  reason: string;
  extendedBy: string;
  extendedAt: string;
}
```

---

## Backward Compatibility

✅ **All existing fields preserved**  
✅ **New fields are optional** (marked with `?`)  
✅ **Existing API responses will continue to work**  
✅ **Frontend can gradually adopt new fields**

---

## Next Steps

### 1. Seed Sample Data
Use the provided `proposed-qc-review-example.json` to seed the database:

```typescript
// Example seeding
const sampleReview: QCReview = {
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
    }
  ],
  // ... rest of fields
};

// Insert into Cosmos DB
await cosmosDbService.createItem('qc-reviews', sampleReview);
```

### 2. Update API Routes (Optional)
Current routes will work with enhanced schema. Optionally add new endpoints:

```typescript
// GET /api/qc-workflow/reviews/:reviewId
// Returns full enhanced QC review with all new fields

// GET /api/qc-workflow/reviews/:reviewId/timeline
// Returns detailed timeline

// POST /api/qc-workflow/reviews/:reviewId/notes
// Add a note

// GET /api/qc-workflow/reviews/:reviewId/documents
// List documents
```

### 3. Frontend Integration
Frontend can now expect these additional fields:
- Display status history timeline
- Show risk factors with visual indicators
- Display AI pre-screening results
- Show vendor performance history
- Real-time SLA progress bars with at-risk warnings
- Document attachments list
- Activity timeline

---

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:cosmos
```

### Verify Schema
```typescript
// Test that all new fields are optional
const minimalReview: QCReview = {
  id: "test-001",
  orderId: "order-001",
  status: "PENDING",
  priorityLevel: "MEDIUM",
  checklists: [],
  reviewers: [],
  sla: {
    dueDate: new Date().toISOString(),
    breached: false,
    escalated: false
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Should compile and work - all new fields are optional
```

---

## Database Considerations

### Cosmos DB Indexing
Consider adding indexes for new query patterns:

```json
{
  "indexingPolicy": {
    "includedPaths": [
      { "path": "/status/*" },
      { "path": "/priorityLevel/*" },
      { "path": "/priorityScore/*" },
      { "path": "/propertyType/*" },
      { "path": "/queuePosition/*" },
      { "path": "/aiPreScreening/riskLevel/*" },
      { "path": "/vendorId/*" },
      { "path": "/createdAt/*" },
      { "path": "/updatedAt/*" }
    ]
  }
}
```

### Storage Impact
- New fields are optional and only stored when present
- Estimated storage increase: 20-30% for fully populated reviews
- Most reviews will have partial data

---

## Migration Notes

### Existing Data
No migration needed - existing records remain valid:
- New optional fields will be `undefined` for existing records
- Frontend should handle missing fields gracefully
- Gradually populate new fields as reviews are updated

### Gradual Adoption
1. **Phase 1:** Backend accepts new fields (✅ Complete)
2. **Phase 2:** Seed sample data for testing
3. **Phase 3:** Frontend begins sending new fields
4. **Phase 4:** Backend services populate new fields automatically
5. **Phase 5:** Full adoption across all services

---

## API Response Example

### Before (Minimal)
```json
{
  "id": "qc-review-001",
  "orderId": "1",
  "status": "PENDING",
  "priorityLevel": "HIGH",
  "checklists": [],
  "reviewers": [],
  "sla": {
    "dueDate": "2026-02-09T17:00:00.000Z",
    "breached": false,
    "escalated": false
  },
  "createdAt": "2026-02-08T09:15:00.000Z",
  "updatedAt": "2026-02-08T14:30:00.000Z"
}
```

### After (Enhanced)
```json
{
  "id": "qc-review-001",
  "orderId": "ord_2024_00123456",
  "orderNumber": "ORD-2026-001",
  "status": "IN_PROGRESS",
  "statusHistory": [
    {
      "status": "PENDING",
      "timestamp": "2026-02-08T09:15:00.000Z",
      "changedBy": "system"
    },
    {
      "status": "IN_PROGRESS",
      "timestamp": "2026-02-08T14:30:00.000Z",
      "changedBy": "analyst-001"
    }
  ],
  "priorityLevel": "HIGH",
  "priorityScore": 85,
  "riskFactors": [
    {
      "factor": "HIGH_VALUE",
      "description": "Appraisal over $500,000",
      "riskLevel": "MEDIUM",
      "weight": 20
    }
  ],
  "propertyType": "SINGLE_FAMILY",
  "loanNumber": "LN-2024-987654",
  "loanAmount": 420000,
  "loanToValue": 80,
  "queuePosition": 5,
  "estimatedReviewTime": 45,
  "aiPreScreening": {
    "completed": true,
    "riskScore": 42,
    "riskLevel": "MEDIUM",
    "confidence": 0.87,
    "flaggedItems": [...]
  },
  "vendorHistory": {
    "totalReviewsCompleted": 12,
    "passRate": 91.7,
    "averageScore": 88.5
  },
  "sla": {
    "dueDate": "2026-02-09T17:00:00.000Z",
    "targetResponseTime": 1440,
    "breached": false,
    "escalated": false,
    "elapsedTime": 310,
    "remainingTime": 1130,
    "percentComplete": 21.5,
    "atRisk": false
  },
  "documents": [...],
  "notes": [...],
  "timeline": [...],
  "createdAt": "2026-02-08T09:15:00.000Z",
  "updatedAt": "2026-02-08T15:25:00.000Z",
  "version": 5
}
```

---

## Summary

✅ **All type definitions updated**  
✅ **100% backward compatible**  
✅ **Ready for frontend integration**  
✅ **Enhanced schema supports rich UI features**  
✅ **Optional fields allow gradual adoption**

The backend is now ready to accept and return the enhanced QC review schema. You can seed the sample data and the frontend can begin using the new fields immediately.
