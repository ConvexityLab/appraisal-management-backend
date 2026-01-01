# QC Workflow Testing Guide

## Overview

This guide provides end-to-end testing procedures for the QC Workflow Automation system, covering all four services: Review Queue, Revision Management, Escalation Workflow, and SLA Tracking.

## Prerequisites

### 1. Database Setup

Create required Cosmos DB containers:

```bash
# Using Azure CLI
az cosmosdb sql container create \
  --account-name <account-name> \
  --database-name appraisal-management \
  --name qc-review-queue \
  --partition-key-path /orderId

az cosmosdb sql container create \
  --account-name <account-name> \
  --database-name appraisal-management \
  --name revisions \
  --partition-key-path /orderId

az cosmosdb sql container create \
  --account-name <account-name> \
  --database-name appraisal-management \
  --name escalations \
  --partition-key-path /orderId

az cosmosdb sql container create \
  --account-name <account-name> \
  --database-name appraisal-management \
  --name sla-tracking \
  --partition-key-path /orderId

az cosmosdb sql container create \
  --account-name <account-name> \
  --database-name appraisal-management \
  --name sla-configurations \
  --partition-key-path /clientId
```

### 2. Environment Variables

Ensure all required environment variables are set:

```bash
# .env
AZURE_COSMOS_ENDPOINT=https://<account-name>.documents.azure.com:443/
AZURE_COSMOS_KEY=<your-cosmos-key>
JWT_SECRET=<your-jwt-secret>

# Email notifications (optional for testing)
SENDGRID_API_KEY=<your-sendgrid-key>
NOTIFICATION_FROM_EMAIL=noreply@yourcompany.com
```

### 3. Test Data

Create test users (analysts, appraisers, managers):

```json
{
  "analysts": [
    {
      "id": "analyst-001",
      "name": "John Analyst",
      "email": "john.analyst@company.com",
      "role": "QC_ANALYST",
      "maxConcurrent": 10
    },
    {
      "id": "analyst-002",
      "name": "Jane Analyst",
      "email": "jane.analyst@company.com",
      "role": "QC_ANALYST",
      "maxConcurrent": 10
    }
  ],
  "managers": [
    {
      "id": "manager-001",
      "name": "Mike Manager",
      "email": "mike.manager@company.com",
      "role": "QC_MANAGER"
    }
  ],
  "appraisers": [
    {
      "id": "appraiser-001",
      "name": "Bob Appraiser",
      "email": "bob.appraiser@vendor.com",
      "licenseNumber": "CRA-12345",
      "licenseState": "CA"
    }
  ]
}
```

---

## Test Scenario 1: QC Review Queue - Priority Scoring

### Objective
Verify that priority scoring correctly calculates based on order age, value, priority level, client tier, and vendor risk.

### Steps

#### 1. Add Orders to Queue

```bash
curl -X POST http://localhost:3000/api/qc-workflow/queue \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-2024-001",
    "orderNumber": "AP-2024-0001",
    "orderPriority": "RUSH",
    "orderValue": 1200000,
    "clientId": "client-premium-001",
    "clientTier": "PREMIUM",
    "vendorId": "vendor-001",
    "appraisalId": "APR-2024-001",
    "propertyAddress": "123 Main St, Seattle, WA 98101"
  }'
```

**Expected Result:**
- Priority score calculated (70-90 points for RUSH + high value + premium client)
- Status: `PENDING`
- SLA target set (RUSH: 120 minutes = 2 hours)

#### 2. View Queue Statistics

```bash
curl -X GET http://localhost:3000/api/qc-workflow/queue/statistics \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "total": 1,
  "pending": 1,
  "inReview": 0,
  "completed": 0,
  "breached": 0,
  "averageWaitTimeMinutes": 5,
  "longestWaitTimeMinutes": 5,
  "byPriority": {
    "LOW": 0,
    "MEDIUM": 0,
    "HIGH": 0,
    "CRITICAL": 1
  }
}
```

#### 3. Search Queue by Priority

```bash
curl -X GET "http://localhost:3000/api/qc-workflow/queue?priorityLevel=CRITICAL&status=PENDING" \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
- Returns `ORD-2024-001` with priority score and SLA details

---

## Test Scenario 2: Workload Balancing

### Objective
Verify automatic assignment distributes work to analysts with lowest capacity utilization.

### Steps

#### 1. Check Initial Analyst Workload

```bash
curl -X GET http://localhost:3000/api/qc-workflow/analysts/workload \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
[
  {
    "analystId": "analyst-001",
    "analystName": "John Analyst",
    "pending": 0,
    "inProgress": 0,
    "completedToday": 0,
    "totalAssigned": 0,
    "maxConcurrent": 10,
    "utilizationPercent": 0
  },
  {
    "analystId": "analyst-002",
    "analystName": "Jane Analyst",
    "pending": 0,
    "inProgress": 3,
    "completedToday": 5,
    "totalAssigned": 3,
    "maxConcurrent": 10,
    "utilizationPercent": 30
  }
]
```

#### 2. Trigger Auto-Assignment

```bash
curl -X POST http://localhost:3000/api/qc-workflow/queue/auto-assign \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "assignedCount": 1
}
```

- Order should be assigned to `analyst-001` (0% utilization vs 30%)

#### 3. Get Next Review for Analyst

```bash
curl -X GET http://localhost:3000/api/qc-workflow/queue/next/analyst-001 \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
- Returns `ORD-2024-001`
- Status automatically changed to `IN_REVIEW`
- Analyst workload updated

---

## Test Scenario 3: Revision Workflow with Auto Re-QC

### Objective
Verify revision creation, submission, and automatic re-QC trigger.

### Steps

#### 1. Create Revision Request

```bash
curl -X POST http://localhost:3000/api/qc-workflow/revisions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-2024-001",
    "appraisalId": "APR-2024-001",
    "qcReportId": "QCR-2024-001",
    "severity": "MAJOR",
    "issues": [
      {
        "category": "COMPARABLE_SELECTION",
        "description": "Comp #2 is 1.5 miles away - exceeds adjustment guidelines",
        "severity": "MAJOR"
      },
      {
        "category": "VALUE_CONCLUSION",
        "description": "Final value does not align with adjusted comp grid",
        "severity": "MODERATE"
      }
    ],
    "requestNotes": "Please address comp selection and provide additional market analysis",
    "requestedBy": "analyst-001"
  }'
```

**Expected Result:**
- Revision created with version `v1`
- Due date set to 24 hours (MAJOR severity)
- Status: `PENDING`
- Appraiser notified via email

#### 2. Check Revision History

```bash
curl -X GET http://localhost:3000/api/qc-workflow/revisions/order/ORD-2024-001/history \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "orderId": "ORD-2024-001",
  "totalRevisions": 1,
  "revisions": [
    {
      "revisionId": "REV-2024-001",
      "version": "v1",
      "status": "PENDING",
      "severity": "MAJOR",
      "issueCount": 2,
      "createdAt": "2024-01-15T10:30:00Z",
      "dueDate": "2024-01-16T10:30:00Z"
    }
  ]
}
```

#### 3. Submit Revised Appraisal

```bash
curl -X POST http://localhost:3000/api/qc-workflow/revisions/REV-2024-001/submit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "responseNotes": "Updated comp selection - replaced with comp within 0.5 miles. Added market trend analysis to support value conclusion.",
    "submittedBy": "appraiser-001",
    "resolvedIssues": [
      {
        "issueId": "ISS-001",
        "resolution": "Replaced comp #2 with property at 0.4 miles - similar condition and features"
      },
      {
        "issueId": "ISS-002",
        "resolution": "Added 3-month market trend data showing 2.1% appreciation - aligns value with comp grid"
      }
    ]
  }'
```

**Expected Result:**
- Revision status changed to `SUBMITTED`
- **Auto re-QC triggered:**
  - Order added back to queue with `EXPEDITED` priority
  - New queue item created with reference to revision
  - Analyst notified of re-QC requirement

#### 4. Verify Auto Re-QC

```bash
curl -X GET "http://localhost:3000/api/qc-workflow/queue?orderId=ORD-2024-001&status=PENDING" \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
- New queue item exists with:
  - `orderPriority`: `EXPEDITED`
  - `metadata.revisionId`: `REV-2024-001`
  - `metadata.isReQC`: `true`
  - Higher priority score than routine reviews

---

## Test Scenario 4: SLA Tracking with Breach Detection

### Objective
Verify real-time SLA monitoring, at-risk warnings, and automatic breach escalation.

### Steps

#### 1. Start SLA Tracking

```bash
curl -X POST http://localhost:3000/api/qc-workflow/sla/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "QC_REVIEW",
    "entityId": "QQI-2024-001",
    "orderId": "ORD-2024-001",
    "orderNumber": "AP-2024-0001",
    "orderPriority": "RUSH"
  }'
```

**Expected Result:**
```json
{
  "trackingId": "SLA-2024-001",
  "targetMinutes": 120,
  "targetDate": "2024-01-15T12:30:00Z",
  "status": "ON_TRACK"
}
```

#### 2. Simulate 80% Elapsed Time (At-Risk Warning)

**Manually update `startTime` in database to 96 minutes ago:**

```bash
curl -X GET http://localhost:3000/api/qc-workflow/sla/SLA-2024-001 \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "trackingId": "SLA-2024-001",
  "status": "AT_RISK",
  "elapsedMinutes": 96,
  "targetMinutes": 120,
  "percentComplete": 80.0,
  "atRiskAlertSent": true
}
```

- **Alert sent** to analyst and manager
- Database field `atRiskAlertSent` = `true`

#### 3. Simulate SLA Breach (100%+ Elapsed)

**Manually update `startTime` to 121 minutes ago:**

```bash
curl -X GET http://localhost:3000/api/qc-workflow/sla/SLA-2024-001 \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "trackingId": "SLA-2024-001",
  "status": "BREACHED",
  "elapsedMinutes": 121,
  "targetMinutes": 120,
  "percentComplete": 100.8,
  "breachedAt": "2024-01-15T12:31:00Z",
  "breachDurationMinutes": 1
}
```

- **Critical alert sent** to manager
- **Auto-escalation triggered:**
  - Escalation case created with type `SLA_BREACH`
  - Priority: `HIGH`
  - Assigned to QC manager

#### 4. Verify Auto-Escalation

```bash
curl -X GET http://localhost:3000/api/qc-workflow/escalations/open \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
[
  {
    "escalationId": "ESC-2024-001",
    "escalationType": "SLA_BREACH",
    "orderId": "ORD-2024-001",
    "priority": "HIGH",
    "title": "SLA Breach: QC Review exceeded target time",
    "status": "OPEN",
    "assignedTo": "manager-001",
    "metadata": {
      "slaTrackingId": "SLA-2024-001",
      "breachDurationMinutes": 1
    }
  }
]
```

---

## Test Scenario 5: Escalation with Dispute Resolution

### Objective
Verify escalation creation, QC dispute resolution, and manager override capabilities.

### Steps

#### 1. Create QC Dispute Escalation

```bash
curl -X POST http://localhost:3000/api/qc-workflow/escalations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-2024-001",
    "escalationType": "QC_DISPUTE",
    "priority": "HIGH",
    "title": "Appraiser disputes QC findings on comp adjustments",
    "description": "Appraiser provided additional market data showing comp adjustments are supported by local trends",
    "raisedBy": "appraiser-001",
    "appraisalId": "APR-2024-001",
    "qcReportId": "QCR-2024-001",
    "revisionId": "REV-2024-001",
    "metadata": {
      "disputedFindings": [
        "Comp distance exceeds guidelines",
        "Adjustment amounts too high"
      ],
      "supportingEvidence": "Local MLS data shows 3-month trend of similar adjustments"
    }
  }'
```

**Expected Result:**
- Escalation created with ID `ESC-2024-002`
- Auto-assigned to QC manager (based on `QC_DISPUTE` type)
- Status: `OPEN`

#### 2. Add Manager Comment

```bash
curl -X POST http://localhost:3000/api/qc-workflow/escalations/ESC-2024-002/comment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "commentBy": "manager-001",
    "comment": "Reviewed appraiser market data. Adjustments appear reasonable given local trends.",
    "visibility": "INTERNAL"
  }'
```

**Expected Result:**
- Comment added to audit trail
- Not visible to vendor (INTERNAL visibility)

#### 3. Resolve QC Dispute (Overturn QC Finding)

```bash
curl -X POST http://localhost:3000/api/qc-workflow/escalations/ESC-2024-002/resolve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "QC finding overturned based on additional market evidence. Comp adjustments are justified by local trends.",
    "resolvedBy": "manager-001",
    "actions": [
      {
        "actionType": "QC_OVERRIDE",
        "description": "Overrode QC finding on comp distance - market data supports appraiser position",
        "performedBy": "manager-001",
        "performedAt": "2024-01-15T14:00:00Z",
        "metadata": {
          "originalQCFinding": "Comp distance exceeds guidelines",
          "resolutionType": "OVERTURN_QC",
          "justification": "Local market conditions support longer comp distances"
        }
      },
      {
        "actionType": "ACCEPT_REVISION",
        "description": "Accepted revision without further changes required",
        "performedBy": "manager-001",
        "performedAt": "2024-01-15T14:00:00Z"
      }
    ]
  }'
```

**Expected Result:**
- Escalation status: `RESOLVED`
- Resolution type: `OVERTURN_QC`
- Revision automatically accepted
- Order proceeds to next workflow stage
- All parties notified

---

## Test Scenario 6: SLA Extension and Waiver

### Objective
Verify manager ability to extend or waive SLA requirements.

### Steps

#### 1. Extend SLA Deadline

```bash
curl -X POST http://localhost:3000/api/qc-workflow/sla/SLA-2024-001/extend \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "extensionMinutes": 60,
    "reason": "Complex property requires additional research and comparable verification",
    "extendedBy": "manager-001"
  }'
```

**Expected Result:**
- Target time increased by 60 minutes (120 → 180 minutes)
- New target date calculated
- Extension recorded in audit trail
- Status recalculated (may change from BREACHED to AT_RISK)

#### 2. Waive SLA Requirement

```bash
curl -X POST http://localhost:3000/api/qc-workflow/sla/SLA-2024-001/waive \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Client requested delay for additional property documentation",
    "waivedBy": "manager-001"
  }'
```

**Expected Result:**
- SLA status: `WAIVED`
- No breach alerts or escalations
- Waiver reason recorded
- Does not count in breach metrics

---

## Test Scenario 7: SLA Performance Metrics

### Objective
Verify SLA metrics calculation and reporting.

### Steps

#### 1. Get Weekly Metrics

```bash
curl -X GET "http://localhost:3000/api/qc-workflow/sla/metrics?period=WEEK&entityType=QC_REVIEW" \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
```json
{
  "period": "WEEK",
  "entityType": "QC_REVIEW",
  "startDate": "2024-01-08T00:00:00Z",
  "endDate": "2024-01-15T23:59:59Z",
  "totalTracked": 150,
  "onTrack": 110,
  "atRisk": 25,
  "breached": 10,
  "waived": 5,
  "averageCompletionMinutes": 95.7,
  "onTimePercentage": 93.3,
  "breachRate": 6.7
}
```

#### 2. Get Metrics by Entity Type

```bash
curl -X GET "http://localhost:3000/api/qc-workflow/sla/metrics?period=MONTH&entityType=REVISION" \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
- Revision-specific SLA metrics
- Default target: 1440 minutes (24 hours)

---

## Background Jobs Testing

### SLA Status Checker

This job runs every 5 minutes to update all active SLA statuses.

#### Setup Cron Job

```typescript
// In src/services/background-jobs.service.ts
import { SLATrackingService } from './sla-tracking.service';
import cron from 'node-cron';

const slaService = new SLATrackingService();

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running SLA status check...');
  await slaService.checkActiveSLAs();
});
```

#### Verify Job Execution

1. Check logs for SLA status updates
2. Verify at-risk alerts sent at 80%
3. Verify breach alerts sent at 100%+
4. Verify auto-escalation triggered for breaches

### Revision Reminder Job

This job runs every hour to send reminders for approaching due dates.

#### Setup Cron Job

```typescript
// In src/services/background-jobs.service.ts
import { RevisionManagementService } from './revision-management.service';

const revisionService = new RevisionManagementService();

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Processing revision reminders...');
  await revisionService.processRevisionReminders();
});
```

#### Verify Reminders

1. Create revision with due date in 4 hours
2. Wait for reminder job to run
3. Verify appraiser receives 4-hour reminder
4. Verify 1-hour reminder before due date

---

## Integration Testing

### Complete Workflow End-to-End

#### Scenario: Order → QC → Revision → Re-QC → Approval

1. **Create Order** → Add to queue
2. **Auto-assign** → Analyst receives review
3. **Complete QC** → Find issues, create revision
4. **Appraiser submits revision** → Auto re-QC triggered
5. **Re-QC passes** → Accept revision
6. **Order proceeds** to next stage

#### Expected Timeline with SLA Tracking

```
T+0:00  - Order created, added to queue
T+0:01  - Auto-assigned to analyst
T+0:05  - SLA tracking started (target: 4 hours)
T+1:30  - QC completed, revision requested (2 issues)
T+3:00  - SLA: 80% elapsed (at-risk warning sent)
T+18:00 - Appraiser submits revision
T+18:01 - Auto re-QC triggered (expedited priority)
T+18:05 - Re-QC assigned
T+19:00 - Re-QC completed, revision accepted
T+19:01 - Order proceeds to delivery
```

---

## Performance Testing

### Load Testing Scenarios

#### 1. High Queue Volume

- Add 1,000 orders to queue
- Trigger auto-assignment
- Verify priority scoring performance (<100ms per order)
- Verify workload balancing distributes evenly

#### 2. SLA Status Updates

- Create 10,000 active SLA tracking records
- Run `checkActiveSLAs()` background job
- Verify completion time (<5 seconds)
- Verify correct status updates

#### 3. Concurrent Revisions

- Create 500 concurrent revisions
- Simulate 250 appraiser submissions
- Verify auto re-QC triggers correctly
- Check for race conditions

---

## Error Scenarios

### 1. Analyst at Capacity

```bash
# Analyst already has 10 reviews (max)
curl -X POST http://localhost:3000/api/qc-workflow/queue/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "queueItemId": "QQI-2024-050",
    "analystId": "analyst-001"
  }'
```

**Expected Result:**
```json
{
  "error": "Analyst at capacity",
  "code": "ANALYST_AT_CAPACITY",
  "details": {
    "analystId": "analyst-001",
    "currentLoad": 10,
    "maxConcurrent": 10
  }
}
```

### 2. Revision Not Found

```bash
curl -X POST http://localhost:3000/api/qc-workflow/revisions/REV-INVALID/submit \
  -H "Authorization: Bearer <token>"
```

**Expected Result:**
- HTTP 404
- Error: `Revision not found`

### 3. SLA Already Completed

```bash
# Try to extend SLA that is already completed
curl -X POST http://localhost:3000/api/qc-workflow/sla/SLA-2024-001/extend \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "extensionMinutes": 60,
    "reason": "Need more time",
    "extendedBy": "manager-001"
  }'
```

**Expected Result:**
```json
{
  "error": "Cannot extend completed SLA",
  "code": "SLA_ALREADY_COMPLETED"
}
```

---

## Monitoring & Observability

### Key Metrics to Track

1. **Queue Metrics:**
   - Average wait time in queue
   - Longest wait time
   - Queue depth by priority level
   - Analyst utilization rates

2. **Revision Metrics:**
   - Total revisions per period
   - Average revision time
   - Revision rate (% of orders requiring revision)
   - Issues by category and severity

3. **Escalation Metrics:**
   - Total escalations by type
   - Average resolution time
   - Escalation rate
   - Resolution types distribution

4. **SLA Metrics:**
   - On-time percentage
   - Breach rate
   - Average completion time vs target
   - At-risk count

### Sample Dashboard Queries

```typescript
// Get daily metrics
const dailyMetrics = {
  queue: await qcReviewQueueService.getQueueStatistics(),
  revisions: await revisionService.getRevisionAnalytics(),
  escalations: await escalationService.getEscalationMetrics(),
  sla: await slaTrackingService.getSLAMetrics('TODAY', undefined)
};
```

---

## Troubleshooting

### Issue: Auto re-QC not triggering

**Check:**
1. Revision status changed to `SUBMITTED`
2. QCReviewQueueService is accessible
3. Queue item created with correct order reference
4. Priority set to `EXPEDITED`

**Fix:**
```typescript
// Manually trigger re-QC
await revisionService.triggerAutoReQC(revisionId, orderId);
```

### Issue: SLA breach not auto-escalating

**Check:**
1. SLA configuration has `autoEscalate: true`
2. EscalationWorkflowService is accessible
3. Escalation created with type `SLA_BREACH`

**Debug:**
```typescript
const slaConfig = await slaTrackingService.getSLAConfiguration(clientId);
console.log('Auto-escalate:', slaConfig.autoEscalate);
```

### Issue: Workload balancing not distributing evenly

**Check:**
1. All analysts have same `maxConcurrent` setting
2. Analysts have correct capacity calculations
3. Queue items have correct status

**Verify:**
```bash
curl -X GET http://localhost:3000/api/qc-workflow/analysts/workload \
  -H "Authorization: Bearer <token>"
```

---

## Success Criteria

✅ **Queue Management:**
- Priority scoring calculates correctly (0-100 scale)
- Auto-assignment distributes to lowest-utilized analysts
- Queue statistics accurate in real-time

✅ **Revision Workflow:**
- Revision requests create with correct version numbers
- Appraiser submissions trigger auto re-QC
- Email notifications sent at each stage

✅ **Escalation Handling:**
- Auto-assignment routes to correct manager by type
- QC disputes resolve with audit trail
- Manager overrides recorded properly

✅ **SLA Tracking:**
- At-risk warnings sent at 80% elapsed
- Breach alerts sent at 100%+ elapsed
- Auto-escalation creates escalation cases
- Metrics calculate correctly by period

✅ **Performance:**
- Priority scoring: <50ms per order
- SLA status updates: <5 seconds for 10k records
- API response times: <200ms (95th percentile)

---

## Next Steps

After testing completion:

1. **Production Deployment:**
   - Create Cosmos DB containers in production
   - Set up background jobs (cron/Azure Functions)
   - Configure notification service (SendGrid/Azure Communication Services)

2. **Monitoring Setup:**
   - Application Insights for metrics
   - Azure Monitor alerts for SLA breaches
   - Dashboard for real-time queue visibility

3. **Phase 2 - Document Intelligence:**
   - Form recognition (1004, 1025, 1004D)
   - Photo compliance checking
   - Field extraction and validation

4. **Phase 3 - Portals:**
   - Vendor self-service portal
   - Client white-label portal
   - Mobile apps for field inspections
