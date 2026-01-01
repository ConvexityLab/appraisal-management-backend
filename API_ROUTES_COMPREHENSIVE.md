# Appraisal Management Platform - Comprehensive API Routes Documentation

**Last Updated:** January 1, 2026  
**Base URL:** `http://localhost:3000` (Development) | `https://api.yourdomain.com` (Production)  
**API Version:** 1.0  
**Authentication:** JWT Bearer Token (bypassed in development with `BYPASS_AUTH=true`)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Order Management](#2-order-management)
3. [QC Validation](#3-qc-validation)
4. [QC Management (Checklists)](#4-qc-management-checklists)
5. [QC Execution](#5-qc-execution)
6. [QC Results & Analytics](#6-qc-results--analytics)
7. [QC Workflow Automation](#7-qc-workflow-automation)
8. [Vendor Management](#8-vendor-management)
9. [Analytics](#9-analytics)
10. [Property Intelligence (V1)](#10-property-intelligence-v1)
11. [Property Intelligence V2 (Places API)](#11-property-intelligence-v2-places-api)
12. [Geospatial Risk Assessment](#12-geospatial-risk-assessment)
13. [Bridge MLS Integration](#13-bridge-mls-integration)
14. [AVM (Automated Valuation)](#14-avm-automated-valuation)
15. [Fraud Detection](#15-fraud-detection)
16. [AI Services](#16-ai-services)
17. [Dynamic Code Execution](#17-dynamic-code-execution)
18. [System](#18-system)

---

## 1. Authentication

### POST `/api/auth/login`
**Login user and obtain JWT token**

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "qc_analyst"
  }
}
```

---

### POST `/api/auth/register`
**Register new user account**

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "appraiser"
}
```

**Validation:**
- Password: minimum 8 characters, must contain uppercase, lowercase, and number
- Role: `admin`, `manager`, `appraiser`, `qc_analyst`

---

### POST `/api/auth/refresh`
**Refresh JWT token**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 2. Order Management

### POST `/api/orders`
**Create new appraisal order**

**Request Body:**
```json
{
  "propertyAddress": "123 Main St, San Francisco, CA 94102",
  "clientId": "client-uuid-123",
  "orderType": "purchase",
  "priority": "rush",
  "dueDate": "2026-01-15T17:00:00Z",
  "propertyDetails": {
    "squareFootage": 2500,
    "yearBuilt": 1995,
    "bedrooms": 4,
    "bathrooms": 2.5
  }
}
```

**Order Types:** `purchase`, `refinance`, `heloc`, `other`  
**Priorities:** `standard`, `rush`, `super_rush`

---

### GET `/api/orders`
**List orders with filters**

**Query Parameters:**
- `status` (optional): `pending`, `assigned`, `in_progress`, `delivered`, `completed`, `cancelled`
- `priority` (optional): `standard`, `rush`, `super_rush`
- `limit` (optional): 1-100, default 50
- `offset` (optional): default 0

**Response:**
```json
{
  "success": true,
  "orders": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

### GET `/api/orders/:orderId`
**Get specific order details**

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "order-123",
    "orderNumber": "ORD-2026-001",
    "status": "in_progress",
    "propertyAddress": "123 Main St, San Francisco, CA 94102",
    "assignedVendor": {...},
    "timeline": {...}
  }
}
```

---

### PUT `/api/orders/:orderId/status`
**Update order status**

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Appraiser on-site inspection scheduled for tomorrow"
}
```

---

### POST `/api/orders/:orderId/deliver`
**Deliver completed appraisal report**

**Request Body:**
```json
{
  "reportUrl": "https://storage.example.com/reports/order-123.pdf",
  "deliveryNotes": "Final report with all revisions addressed"
}
```

---

### GET `/api/orders/dashboard`
**Get order dashboard metrics**

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalOrders": 1250,
    "pendingOrders": 45,
    "inProgressOrders": 120,
    "completedOrders": 1085,
    "averageTurnaroundTime": "4.5 days",
    "slaComplianceRate": 94.2
  }
}
```

---

## 3. QC Validation

### POST `/api/qc/validate/:orderId`
**Perform QC validation on order**

**Permissions Required:** `qc_validate`

**Request Body:**
```json
{
  "checklistId": "checklist-uuid",
  "appraisalReportUrl": "https://storage.example.com/reports/order-123.pdf",
  "validatorId": "analyst-456"
}
```

---

### GET `/api/qc/results/:orderId`
**Get QC validation results**

**Response:**
```json
{
  "success": true,
  "results": {
    "orderId": "order-123",
    "overallStatus": "PASSED_WITH_CONDITIONS",
    "criticalIssues": 0,
    "majorIssues": 2,
    "minorIssues": 5,
    "findings": [...]
  }
}
```

---

### GET `/api/qc/metrics`
**Get QC metrics and performance**

**Permissions Required:** `qc_metrics`

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalReviews": 500,
    "passRate": 78.5,
    "averageReviewTime": "45 minutes",
    "topIssueCategories": [...]
  }
}
```

---

## 4. QC Management (Checklists)

**Base Path:** `/api/qc/checklists`

### POST `/checklists`
**Create new QC checklist**

**Request Body:**
```json
{
  "name": "UAD Compliance Checklist",
  "description": "Comprehensive UAD 3.6 validation",
  "version": "1.0",
  "criteria": [
    {
      "id": "cr-001",
      "category": "Property Identification",
      "severity": "CRITICAL",
      "description": "Subject property address matches title",
      "validationRule": "address.normalize() === title.address.normalize()"
    }
  ]
}
```

---

### GET `/checklists/:id`
**Get checklist by ID**

---

### PUT `/checklists/:id`
**Update existing checklist**

---

### DELETE `/checklists/:id`
**Delete checklist**

---

### GET `/checklists`
**List all checklists**

**Query Parameters:**
- `status` (optional): `DRAFT`, `ACTIVE`, `ARCHIVED`
- `category` (optional): Filter by category
- `limit`, `offset`: Pagination

---

### POST `/checklists/from-template`
**Create checklist from template**

**Request Body:**
```json
{
  "templateId": "template-uuid",
  "name": "Custom FNMA Checklist",
  "customizations": {...}
}
```

---

### POST `/checklists/:id/clone`
**Clone existing checklist**

---

### POST `/assignments`
**Assign checklist to target**

**Request Body:**
```json
{
  "checklistId": "checklist-uuid",
  "targetId": "order-123",
  "targetType": "ORDER",
  "assignedBy": "manager-456"
}
```

---

### GET `/assignments`
**List checklist assignments**

---

### GET `/assignments/active/:targetId`
**Get active assignments for target**

---

### DELETE `/assignments/:id`
**Remove checklist assignment**

---

### POST `/checklists/:id/validate`
**Validate checklist structure**

---

## 5. QC Execution

**Base Path:** `/api/qc/execution`

### POST `/execute`
**Execute QC review synchronously**

**Request Body:**
```json
{
  "checklistId": "checklist-uuid",
  "targetId": "order-123",
  "targetType": "ORDER",
  "reviewerId": "analyst-456",
  "appraisalData": {...}
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-abc123",
  "results": {
    "totalCriteria": 45,
    "passed": 38,
    "failed": 7,
    "findings": [...]
  },
  "processingTime": "2.3s"
}
```

---

### POST `/execute/async`
**Execute QC review asynchronously**

**Response:**
```json
{
  "success": true,
  "sessionId": "session-abc123",
  "status": "PROCESSING",
  "estimatedCompletionTime": "2026-01-01T15:05:00Z"
}
```

---

### POST `/batch/execute`
**Execute QC reviews in batch**

**Request Body:**
```json
{
  "checklistId": "checklist-uuid",
  "targets": [
    { "targetId": "order-123", "targetType": "ORDER" },
    { "targetId": "order-124", "targetType": "ORDER" }
  ],
  "reviewerId": "analyst-456"
}
```

---

### GET `/sessions/:sessionId/status`
**Get QC session status**

---

### GET `/sessions/:sessionId/progress`
**Get QC session progress**

**Response:**
```json
{
  "success": true,
  "progress": {
    "status": "IN_PROGRESS",
    "completedCriteria": 30,
    "totalCriteria": 45,
    "percentComplete": 66.7,
    "currentStep": "Validating comparable sales"
  }
}
```

---

### GET `/sessions/:sessionId/results`
**Get QC session results**

---

### GET `/sessions`
**List QC sessions**

**Query Parameters:**
- `reviewerId`: Filter by reviewer
- `status`: Filter by status
- `startDate`, `endDate`: Date range

---

### DELETE `/sessions/:sessionId`
**Cancel/delete QC session**

---

### POST `/preview`
**Preview QC execution (dry run)**

---

### POST `/validate-config`
**Validate QC configuration**

---

### GET `/history`
**Get QC execution history**

---

### GET `/analytics`
**Get QC execution analytics**

---

## 6. QC Results & Analytics

**Base Path:** `/api/qc/results`

### GET `/search`
**Search QC results**

**Query Parameters:**
- `checklistId`: Filter by checklist
- `targetId`: Filter by target
- `status`: `PASSED`, `FAILED`, `PASSED_WITH_CONDITIONS`
- `startDate`, `endDate`: Date range
- `severity`: `CRITICAL`, `MAJOR`, `MODERATE`, `MINOR`

---

### GET `/:resultId`
**Get specific QC result**

---

### GET `/checklist/:checklistId`
**Get all results for checklist**

---

### GET `/target/:targetId`
**Get all results for target (order)**

---

### GET `/analytics/summary`
**Get QC analytics summary**

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalReviews": 1500,
    "passRate": 82.3,
    "averageScore": 87.5,
    "issueDistribution": {
      "critical": 45,
      "major": 180,
      "moderate": 320,
      "minor": 580
    }
  }
}
```

---

### GET `/analytics/trends`
**Get QC trends over time**

---

### GET `/analytics/performance`
**Get QC performance metrics**

---

### GET `/analytics/issues`
**Get top QC issues**

---

### POST `/reports/generate`
**Generate QC report**

**Request Body:**
```json
{
  "resultIds": ["result-1", "result-2", "result-3"],
  "format": "PDF",
  "includeCharts": true,
  "includeFindingsDetails": true
}
```

---

### GET `/reports`
**List generated reports**

---

### GET `/reports/:reportId`
**Get specific report**

---

### DELETE `/reports/:reportId`
**Delete report**

---

### POST `/export`
**Export QC results**

**Request Body:**
```json
{
  "filters": {...},
  "format": "CSV",
  "fields": ["orderId", "status", "findings", "reviewDate"]
}
```

---

### GET `/export/:exportId/download`
**Download exported results**

---

### POST `/compare`
**Compare QC results**

---

### GET `/benchmarks`
**Get QC benchmarks**

---

## 7. QC Workflow Automation

**Base Path:** `/api/qc-workflow`

### 7.1 Queue Management

#### GET `/queue`
**Get QC review queue with filters**

**Query Parameters:**
- `status`: `PENDING`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`
- `priorityLevel`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `assignedAnalystId`: Filter by assigned analyst
- `slaBreached`: `true`/`false`
- `limit`: 1-100, default 50
- `offset`: default 0

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "queue-item-123",
      "orderId": "order-456",
      "orderNumber": "ORD-2026-001",
      "priorityScore": 85,
      "priorityLevel": "HIGH",
      "status": "PENDING",
      "assignedAnalystId": null,
      "slaDeadline": "2026-01-02T14:00:00Z",
      "createdAt": "2026-01-01T09:00:00Z"
    }
  ],
  "count": 25
}
```

---

#### GET `/queue/statistics`
**Get queue statistics**

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 125,
    "byStatus": {
      "PENDING": 45,
      "ASSIGNED": 60,
      "IN_PROGRESS": 18,
      "COMPLETED": 2
    },
    "byPriority": {
      "LOW": 20,
      "MEDIUM": 45,
      "HIGH": 50,
      "URGENT": 10
    },
    "slaBreached": 3,
    "avgPriorityScore": 65.5
  }
}
```

---

#### POST `/queue`
**Add order to QC queue**

**Request Body:**
```json
{
  "orderId": "order-456",
  "orderNumber": "ORD-2026-001",
  "orderType": "PURCHASE",
  "orderValue": 850000,
  "orderPriority": "RUSH",
  "clientId": "client-123",
  "clientTier": "GOLD",
  "vendorId": "vendor-789",
  "vendorPerformanceScore": 92.5,
  "appraisalId": "appraisal-abc",
  "propertyAddress": "123 Main St, San Francisco, CA",
  "dueDate": "2026-01-05T17:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queueItem": {...},
    "priorityScore": 85,
    "priorityBreakdown": {
      "orderAge": 10,
      "orderValue": 18,
      "orderPriority": 30,
      "clientTier": 15,
      "vendorRisk": 8
    }
  }
}
```

---

#### POST `/queue/auto-assign`
**Auto-assign reviews to analysts**

**Request Body:**
```json
{
  "maxAssignments": 10,
  "priorityThreshold": 70
}
```

---

#### GET `/queue/analyst/:analystId`
**Get analyst's assigned queue items**

---

#### GET `/analysts/workload`
**Get all analysts with workload**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "analystId": "analyst-123",
      "analystName": "Jane Smith",
      "assignedCount": 8,
      "capacity": 10,
      "utilizationPercent": 80,
      "avgCompletionTime": "45 minutes"
    }
  ]
}
```

---

### 7.2 Revision Management

#### POST `/revisions`
**Create revision request**

**Request Body:**
```json
{
  "orderId": "order-456",
  "appraisalId": "appraisal-abc",
  "qcReportId": "qc-report-789",
  "severity": "MAJOR",
  "dueDate": "2026-01-03T17:00:00Z",
  "issues": [
    {
      "category": "Comparable Sales",
      "description": "Comp #2 is outside 1-mile radius",
      "severity": "MAJOR",
      "requiresCorrection": true
    }
  ],
  "requestNotes": "Please provide explanation or replace comparable sale",
  "requestedBy": "analyst-123"
}
```

**Severity Levels:** `MINOR`, `MODERATE`, `MAJOR`, `CRITICAL`

---

#### POST `/revisions/:revisionId/submit`
**Submit revised appraisal**

**Request Body:**
```json
{
  "responseNotes": "Replaced Comp #2 with closer comparable at 0.7 miles",
  "submittedBy": "appraiser-456",
  "resolvedIssues": [
    {
      "issueId": "issue-001",
      "resolution": "Replaced comparable sale",
      "notes": "New comp is more recent and closer"
    }
  ]
}
```

**Auto Re-QC Trigger:** Automatically adds to QC queue for verification

---

#### POST `/revisions/:revisionId/accept`
**Accept revision (QC passed)**

**Request Body:**
```json
{
  "reviewedBy": "analyst-123",
  "reviewNotes": "All issues resolved satisfactorily"
}
```

---

#### POST `/revisions/:revisionId/reject`
**Reject revision (issues remain)**

**Request Body:**
```json
{
  "reviewedBy": "analyst-123",
  "rejectionReasons": [
    "Comp #2 still requires adjustment explanation"
  ],
  "nextAction": "ESCALATE"
}
```

---

#### GET `/revisions/:revisionId`
**Get revision details**

---

#### GET `/revisions/active`
**Get all active revisions**

---

#### GET `/revisions/overdue`
**Get overdue revisions**

---

### 7.3 Escalation Workflow

#### POST `/escalations`
**Create escalation**

**Request Body:**
```json
{
  "orderId": "order-456",
  "escalationType": "QC_DISPUTE",
  "priority": "HIGH",
  "title": "Appraiser disputes comp adjustment methodology",
  "description": "Appraiser claims QC analyst's adjustment calculation is incorrect per UAD guidelines",
  "raisedBy": "appraiser-456",
  "relatedEntities": {
    "revisionId": "revision-789",
    "qcReportId": "qc-report-123"
  }
}
```

**Escalation Types:**
- `QC_DISPUTE` - Appraiser disputes QC finding
- `SLA_BREACH` - Deadline breach
- `COMPLEX_CASE` - Requires senior review
- `REVISION_FAILURE` - Multiple revision cycles
- `FRAUD_SUSPECTED` - Potential fraud indicators
- `COMPLIANCE_ISSUE` - Regulatory compliance concern
- `CLIENT_COMPLAINT` - Client escalation

**Priorities:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`

---

#### GET `/escalations/open`
**Get all open escalations**

---

#### GET `/escalations/:escalationId`
**Get escalation details**

---

#### POST `/escalations/:escalationId/resolve`
**Resolve escalation**

**Request Body:**
```json
{
  "resolution": "QC analyst methodology upheld per FNMA guidelines section 5.2",
  "outcome": "UPHELD_QC_DECISION",
  "resolvedBy": "manager-789",
  "actions": [
    "Provided additional training resources to appraiser",
    "Scheduled follow-up call with appraiser and QC analyst"
  ]
}
```

**Outcomes:**
- `UPHELD_QC_DECISION`
- `OVERRODE_QC_DECISION`
- `COMPROMISED`
- `REASSIGNED`
- `CANCELLED`

---

#### POST `/escalations/:escalationId/reassign`
**Reassign escalation to different manager**

---

#### POST `/escalations/:escalationId/override-qc`
**Manager override of QC decision**

**Request Body:**
```json
{
  "managerId": "manager-789",
  "overrideReason": "QC interpretation too strict for this specific property type",
  "newStatus": "APPROVED",
  "requiredActions": []
}
```

---

### 7.4 SLA Tracking

#### POST `/sla/start`
**Start SLA tracking**

**Request Body:**
```json
{
  "entityType": "QC_REVIEW",
  "entityId": "queue-item-123",
  "orderId": "order-456",
  "orderNumber": "ORD-2026-001",
  "orderPriority": "RUSH"
}
```

**Entity Types:**
- `QC_REVIEW` - QC review SLA (default: 24 hours standard, 12 hours rush)
- `REVISION` - Revision turnaround (default: 48 hours)
- `ESCALATION` - Escalation resolution (default: 72 hours)

---

#### GET `/sla/:trackingId`
**Get SLA tracking status**

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sla-tracking-123",
    "entityType": "QC_REVIEW",
    "entityId": "queue-item-456",
    "orderId": "order-789",
    "status": "AT_RISK",
    "slaMinutes": 1440,
    "elapsedMinutes": 1200,
    "remainingMinutes": 240,
    "percentElapsed": 83.3,
    "deadline": "2026-01-02T14:00:00Z",
    "breachDuration": null,
    "extensions": []
  }
}
```

**SLA Status:**
- `ON_TRACK` - <80% elapsed
- `AT_RISK` - 80-100% elapsed
- `BREACHED` - >100% elapsed

---

#### POST `/sla/:trackingId/extend`
**Extend SLA deadline**

**Request Body:**
```json
{
  "extensionMinutes": 480,
  "reason": "Additional comparable research required",
  "extendedBy": "manager-789"
}
```

---

#### POST `/sla/:trackingId/waive`
**Waive SLA breach**

**Request Body:**
```json
{
  "reason": "Client requested delay for additional property documents",
  "waivedBy": "manager-789"
}
```

---

#### GET `/sla/metrics`
**Get SLA metrics**

**Query Parameters:**
- `period`: `TODAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`
- `entityType`: `QC_REVIEW`, `REVISION`, `ESCALATION`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "MONTH",
    "totalTracked": 500,
    "onTrack": 425,
    "atRisk": 55,
    "breached": 20,
    "complianceRate": 96.0,
    "avgCompletionPercent": 75.5,
    "breachedByType": {
      "QC_REVIEW": 10,
      "REVISION": 8,
      "ESCALATION": 2
    }
  }
}
```

---

## 8. Vendor Management

### GET `/api/vendors`
**List all vendors**

---

### POST `/api/vendors`
**Create new vendor**

**Permissions Required:** `vendor_manage`

**Request Body:**
```json
{
  "name": "ABC Appraisal Services",
  "email": "contact@abcappraisal.com",
  "phone": "+1-555-123-4567",
  "serviceTypes": ["RESIDENTIAL", "COMMERCIAL"],
  "serviceAreas": ["CA-94102", "CA-94103", "CA-94104"],
  "licenseNumber": "APP-12345-CA",
  "insuranceInfo": {...}
}
```

---

### PUT `/api/vendors/:vendorId`
**Update vendor information**

---

### POST `/api/vendors/assign/:orderId`
**Assign vendor to order**

**Permissions Required:** `vendor_assign`

---

### GET `/api/vendors/performance/:vendorId`
**Get vendor performance metrics**

**Response:**
```json
{
  "success": true,
  "performance": {
    "vendorId": "vendor-123",
    "totalOrders": 250,
    "completedOrders": 235,
    "completionRate": 94.0,
    "averageTurnaroundTime": "4.2 days",
    "qualityScore": 92.5,
    "onTimeDeliveryRate": 96.5,
    "revisionRate": 8.5
  }
}
```

---

## 9. Analytics

### GET `/api/analytics/overview`
**Get analytics overview**

**Permissions Required:** `analytics_view`

---

### GET `/api/analytics/performance`
**Get performance analytics**

**Query Parameters:**
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date
- `groupBy`: `day`, `week`, `month`

---

## 10. Property Intelligence (V1)

**Base Path:** `/api/property-intelligence`

### POST `/address/geocode`
**Geocode property address**

**Request Body:**
```json
{
  "address": "123 Main St, San Francisco, CA 94102"
}
```

---

### POST `/address/validate`
**Validate and standardize address**

---

### POST `/analyze/comprehensive`
**Comprehensive property analysis**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "strategy": "quality_first"
}
```

**Strategies:** `speed_first`, `quality_first`, `balanced`

**Response Includes:**
- Google Maps data (places, demographics)
- Census data (population, income, housing)
- Environmental data
- Transportation analysis

---

### POST `/analyze/creative`
**Creative feature analysis**

---

### POST `/analyze/view`
**View quality analysis**

---

### POST `/analyze/transportation`
**Transportation accessibility analysis**

---

### POST `/analyze/neighborhood`
**Neighborhood characteristics analysis**

---

### POST `/analyze/batch`
**Batch property analysis**

---

### GET `/census/demographics`
**Get Census demographics data**

---

### GET `/census/economics`
**Get Census economics data**

---

### GET `/census/housing`
**Get Census housing data**

---

### GET `/census/comprehensive`
**Get comprehensive Census data**

---

### GET `/health`
**Service health check**

---

## 11. Property Intelligence V2 (Places API)

**Base Path:** `/api/property-intelligence-v2`

### POST `/analyze`
**Comprehensive property analysis with Places API (New)**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "propertyAddress": "123 Main St, San Francisco, CA"
}
```

**Features:**
- Address descriptors
- Landmark context
- Accessibility scoring
- Sustainability analysis
- EV charging infrastructure
- Moved place tracking
- Rich metadata

---

### GET `/place/:placeId`
**Get detailed place information**

**Query Parameters:**
- `fields`: Comma-separated field mask
- `languageCode`: Language for results
- `regionCode`: Region code

---

### GET `/place/:placeId/moved`
**Follow moved place chain**

**Response:**
```json
{
  "success": true,
  "data": {...},
  "metadata": {
    "originalPlaceId": "ChIJold-place-id",
    "currentPlaceId": "ChIJnew-place-id",
    "hasMoved": true
  }
}
```

---

### POST `/search/nearby`
**Search places near location**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "includedTypes": ["restaurant", "school", "park"],
  "excludedTypes": ["bar"],
  "maxResultCount": 20,
  "radiusMeters": 5000,
  "rankPreference": "DISTANCE"
}
```

---

### POST `/search/text`
**Natural language place search**

**Request Body:**
```json
{
  "textQuery": "coffee shops with outdoor seating",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radiusMeters": 2000,
  "maxResultCount": 10,
  "minRating": 4.0,
  "openNow": true
}
```

---

### POST `/autocomplete`
**Place autocomplete suggestions**

---

### POST `/ev-charging`
**Find EV charging stations**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radiusMeters": 5000,
  "connectorTypes": ["J1772", "CHADEMO", "CCS"],
  "includeLevel2": true,
  "includeDCFast": true
}
```

---

### POST `/gas-stations`
**Find gas stations with fuel prices**

**Response:**
```json
{
  "success": true,
  "data": [...],
  "metadata": {
    "totalStations": 15,
    "cheapestPricesByFuelType": {
      "REGULAR": {...},
      "PREMIUM": {...},
      "DIESEL": {...}
    }
  }
}
```

---

### POST `/accessible-places`
**Find wheelchair-accessible places**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "placeTypes": ["restaurant", "grocery_store", "pharmacy"],
  "radiusMeters": 2000
}
```

---

### GET `/photo/:photoName`
**Get place photo URL**

**Query Parameters:**
- `maxWidthPx`: 1-4800
- `maxHeightPx`: 1-4800
- `skipHttpRedirect`: true/false

---

### POST `/location-context`
**Get address descriptors and location context**

---

## 12. Geospatial Risk Assessment

**Base Path:** `/api/geospatial`

### POST `/risk-assessment`
**Comprehensive property risk assessment**

**Request Body:**
```json
{
  "coordinates": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "propertyId": "prop-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "propertyId": "prop-123",
    "coordinates": {...},
    "overallRiskScore": 42.5,
    "riskCategory": "MODERATE",
    "floodRisk": {...},
    "environmentalRisk": {...},
    "tribalLand": {...},
    "historicDesignation": {...},
    "census": {...}
  }
}
```

---

### POST `/batch-risk-assessment`
**Batch risk assessment**

**Request Body:**
```json
{
  "properties": [
    {
      "propertyId": "prop-1",
      "coordinates": { "latitude": 37.7749, "longitude": -122.4194 }
    },
    {
      "propertyId": "prop-2",
      "coordinates": { "latitude": 37.7849, "longitude": -122.4094 }
    }
  ]
}
```

---

### GET `/flood-zone`
**Get FEMA flood zone information**

**Query Parameters:**
- `latitude`
- `longitude`

---

### GET `/tribal-land`
**Check if property is on tribal land**

---

### GET `/environmental-risk`
**Get environmental hazard assessment**

---

### GET `/census-data`
**Get Census data for location**

---

### GET `/historic-places`
**Check for historic place designations**

---

## 13. Bridge MLS Integration

**Base Path:** `/api/bridge-mls`

### GET `/datasets`
**Get available MLS datasets**

---

### POST `/active-listings`
**Get active MLS listings**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radiusMiles": 1.0,
  "minPrice": 500000,
  "maxPrice": 1000000,
  "propertyType": "Residential",
  "limit": 50,
  "datasetId": "mls-dataset-123"
}
```

---

### POST `/sold-comps`
**Get sold comparables**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radiusMiles": 1.0,
  "minPrice": 500000,
  "maxPrice": 1000000,
  "soldDateStart": "2025-01-01",
  "soldDateEnd": "2026-01-01",
  "limit": 50
}
```

---

### POST `/search-address`
**Search property by address**

---

### GET `/property/:listingKey`
**Get property details by listing key**

---

### POST `/market-stats`
**Get market statistics**

**Request Body:**
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radiusMiles": 2.0,
  "propertyType": "Residential",
  "startDate": "2025-01-01",
  "endDate": "2026-01-01"
}
```

---

### GET `/member/:memberKey`
**Get MLS member details**

---

### GET `/office/:officeKey`
**Get MLS office details**

---

### GET `/metadata/:datasetId`
**Get MLS dataset metadata**

---

### POST `/parcels/search`
**Search parcels**

---

### GET `/parcels/:parcelId`
**Get parcel details**

---

### GET `/parcels/:parcelId/assessments`
**Get parcel assessments**

---

### GET `/parcels/:parcelId/transactions`
**Get parcel transaction history**

---

### POST `/assessments/search`
**Search property assessments**

---

### POST `/transactions/search`
**Search property transactions**

---

### POST `/zestimate`
**Get Zillow-style Zestimate**

---

### POST `/market-report`
**Generate market report**

---

### POST `/region`
**Get regional data**

---

### GET `/metric-types`
**Get available metric types**

---

### GET `/reviews`
**Get property reviews**

---

### GET `/reviewees`
**Get review subjects**

---

## 14. AVM (Automated Valuation)

**Base Path:** `/api/avm`

### POST `/valuation`
**Get property valuation using AVM cascade**

**Request Body:**
```json
{
  "address": "123 Main St, San Francisco, CA 94102",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "squareFootage": 2500,
  "yearBuilt": 1995,
  "bedrooms": 4,
  "bathrooms": 2.5,
  "propertyType": "Single Family",
  "strategy": "quality",
  "forceMethod": null
}
```

**Strategies:**
- `speed` - Use fastest method first
- `quality` - Use most accurate method first
- `cost` - Use cheapest method first

**Force Method:** `bridge`, `hedonic`, `cost`

**Response:**
```json
{
  "success": true,
  "valuation": {
    "estimatedValue": 1250000,
    "valuationRange": {
      "low": 1125000,
      "high": 1375000
    },
    "confidence": 85.5,
    "method": "BRIDGE_MLS",
    "comparableCount": 12,
    "marketConditions": "APPRECIATING",
    "lastUpdated": "2026-01-01T15:00:00Z"
  },
  "attempts": [
    { "method": "BRIDGE_MLS", "success": true }
  ],
  "processingTime": "2.3s"
}
```

---

### POST `/batch`
**Batch property valuations**

**Request Body:**
```json
{
  "properties": [
    { "address": "123 Main St...", "squareFootage": 2500 },
    { "address": "456 Oak Ave...", "squareFootage": 3200 }
  ],
  "strategy": "quality"
}
```

---

### GET `/methods`
**Get available AVM methods**

---

### GET `/confidence`
**Get confidence scoring explanation**

---

## 15. Fraud Detection

**Base Path:** `/api/fraud-detection`

### POST `/analyze`
**Analyze appraisal for fraud indicators**

**Request Body:**
```json
{
  "appraisalId": "appraisal-123",
  "propertyAddress": "123 Main St, San Francisco, CA",
  "appraisedValue": 1500000,
  "appraisalDate": "2026-01-01",
  "subjectProperty": {
    "squareFootage": 2500,
    "yearBuilt": 1995,
    "condition": "Average",
    "propertyType": "Single Family"
  },
  "comparables": [
    {
      "address": "125 Main St",
      "soldPrice": 1400000,
      "soldDate": "2025-12-15",
      "distance": 0.2,
      "squareFootage": 2450,
      "adjustments": {
        "total": 100000,
        "breakdown": {...}
      }
    }
  ],
  "appraiser": {
    "name": "John Doe",
    "licenseNumber": "APP-12345-CA",
    "licenseState": "CA"
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "overallRiskScore": 68.5,
    "riskLevel": "MODERATE",
    "flaggedIssues": [
      {
        "category": "VALUE_INFLATION",
        "severity": "HIGH",
        "description": "Appraised value 15% higher than comparable average",
        "score": 85
      },
      {
        "category": "ADJUSTMENT_INCONSISTENCY",
        "severity": "MEDIUM",
        "description": "Comp #2 has excessive total adjustments (32%)",
        "score": 65
      }
    ],
    "patterns": {
      "valueDeviation": 15.2,
      "avgCompDistance": 0.45,
      "excessiveAdjustments": 2,
      "suspiciousPatterns": []
    },
    "recommendation": "MANUAL_REVIEW_REQUIRED"
  }
}
```

---

### POST `/quick-check`
**Quick fraud risk assessment (rules-based only)**

**Request Body:**
```json
{
  "appraisedValue": 1500000,
  "comparables": [...]
}
```

---

### POST `/batch-analyze`
**Batch fraud analysis**

---

### GET `/risk-factors`
**Get fraud risk factors**

---

### GET `/patterns`
**Get common fraud patterns**

---

## 16. AI Services

**Base Path:** `/api/ai`

### POST `/qc/analyze`
**AI-powered QC analysis**

**Permissions Required:** `qc_validate`

**Request Body:**
```json
{
  "appraisalReport": {...},
  "analysisType": "COMPREHENSIVE"
}
```

---

### POST `/qc/technical`
**Technical QC review**

---

### POST `/qc/compliance`
**Compliance checking**

---

### POST `/market/insights`
**Generate market insights**

**Request Body:**
```json
{
  "propertyAddress": "123 Main St, San Francisco, CA",
  "marketData": {...},
  "analysisDepth": "DETAILED"
}
```

---

### POST `/property/description`
**Generate property description**

---

### POST `/vision/analyze`
**Analyze property images**

**Request Body:**
```json
{
  "imageUrls": [
    "https://storage.example.com/photos/exterior.jpg",
    "https://storage.example.com/photos/kitchen.jpg"
  ],
  "analysisType": "COMPREHENSIVE"
}
```

---

### POST `/vision/condition`
**Analyze property condition from images**

---

### POST `/embeddings`
**Generate text embeddings**

---

### POST `/completion`
**Generate AI completions**

**Permissions Required:** `ai_generate`

---

### GET `/health`
**AI service health check**

---

### GET `/usage`
**Get AI usage statistics**

**Permissions Required:** `analytics_view`

---

## 17. Dynamic Code Execution

### POST `/api/code/execute`
**Execute sandboxed JavaScript code**

**Permissions Required:** `code_execute`

**Request Body:**
```json
{
  "code": "function calculateAdjustment(value, percent) { return value * (percent / 100); } return calculateAdjustment(1000000, 5);",
  "timeout": 5000,
  "context": {
    "propertyValue": 1000000,
    "adjustmentPercent": 5
  }
}
```

**Security:**
- VM2 isolation
- No file system access
- Memory limits enforced
- Timeout protection

---

## 18. System

### GET `/health`
**System health check**

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-01T15:00:00Z",
  "services": {
    "database": "connected",
    "propertyIntelligence": "operational",
    "aiServices": "operational"
  },
  "version": "1.0.0"
}
```

---

### GET `/api-docs`
**Swagger API documentation**

Interactive API documentation with request/response examples and testing interface.

---

## Authentication & Authorization

### Development Mode
Set `BYPASS_AUTH=true` or `NODE_ENV=development` to bypass authentication.

### Production Mode
Include JWT token in Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Roles & Permissions
- **Admin:** Full access
- **Manager:** Order management, analytics, QC oversight, escalations
- **QC Analyst:** QC execution, queue management, revisions
- **Appraiser:** Order viewing, revision submission

---

## Rate Limiting

- **Window:** 15 minutes (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Max Requests:** 100 per window (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- **Applies to:** All `/api/*` routes

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-01-01T15:00:00Z",
  "details": {...}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Pagination

List endpoints support pagination:
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Number of results to skip (default: 0)

---

## Filtering & Sorting

Query parameters for filtering:
- Status filters: `?status=PENDING,ASSIGNED`
- Date ranges: `?startDate=2026-01-01&endDate=2026-01-31`
- Sorting: `?sortBy=createdAt&sortOrder=desc`

---

## Webhooks (Future)

Webhook endpoints for event notifications:
- Order status changes
- QC completion
- SLA breaches
- Escalations created

---

## API Versioning

Current version: **v1**  
Version strategy: URL path versioning (`/api/v2/...` for future versions)

---

## Support & Resources

- **API Documentation:** `/api-docs` (Swagger UI)
- **Health Check:** `/health`
- **GitHub Repository:** [Link to repo]
- **Support Email:** api-support@example.com

---

**Total API Endpoints:** 150+  
**Last Build:** January 1, 2026  
**Build Status:** ✅ All TypeScript errors resolved (0 errors)  
**Database:** Azure Cosmos DB (15 containers)  
**Infrastructure:** Azure (Bicep IaC)
