# QC Review Routes - Frontend Integration Guide

## 🎯 Overview

This document provides comprehensive details about all QC Review/Workflow routes available for frontend integration. The QC system manages review queues, revisions, escalations, and SLA tracking for the appraisal management platform.

**Base URL:** `/api/qc-workflow`
**Authentication:** Required for all endpoints (JWT Bearer Token)
**Content-Type:** `application/json`

---

## 📋 Quick Reference

### Available Endpoints Summary

#### Queue Management (7 endpoints)
- `GET /queue` - Search queue with filters
- `GET /queue/statistics` - Get queue statistics  
- `POST /queue/assign` - Manually assign review to analyst
- `POST /queue/auto-assign` - Auto-assign reviews to balance workload
- `GET /queue/next/:analystId` - Get next review for analyst
- `GET /analysts/workload` - Get all analyst workloads

#### Revision Management (7 endpoints)
- `POST /revisions` - Create revision request
- `POST /revisions/:revisionId/submit` - Submit revised appraisal
- `POST /revisions/:revisionId/accept` - Accept revision
- `POST /revisions/:revisionId/reject` - Reject revision
- `GET /revisions/order/:orderId/history` - Get revision history
- `GET /revisions/active` - Get all active revisions
- `GET /revisions/overdue` - Get overdue revisions

#### Escalation Management (6 endpoints)
- `POST /escalations` - Create escalation
- `GET /escalations/open` - Get all open escalations
- `GET /escalations/manager/:managerId` - Get manager's escalations
- `POST /escalations/:escalationId/comment` - Add comment
- `POST /escalations/:escalationId/resolve` - Resolve escalation
- `POST /escalations/:escalationId/close` - Close escalation

#### SLA Tracking (6 endpoints)
- `POST /sla/start` - Start SLA tracking
- `GET /sla/:trackingId` - Get SLA status
- `POST /sla/:trackingId/extend` - Extend SLA deadline
- `POST /sla/:trackingId/waive` - Waive SLA
- `GET /sla/metrics` - Get SLA performance metrics

---

## 🔐 Authentication

All endpoints require a valid JWT token in the Authorization header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

**Development/Testing:** If `BYPASS_AUTH=true` is set in environment, you can use test tokens:
```javascript
headers: {
  'Authorization': 'Bearer test-token-analyst-001',
  'Content-Type': 'application/json'
}
```

---

## 📊 Queue Management Endpoints

### 1. GET `/api/qc-workflow/queue`
**Purpose:** Search and filter the QC review queue

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: `PENDING`, `IN_REVIEW`, `COMPLETED` |
| priorityLevel | string | No | Filter by priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| assignedAnalystId | string | No | Filter by assigned analyst |
| slaBreached | boolean | No | Filter by SLA breach status |
| limit | integer | No | Number of results (1-100, default: 50) |
| offset | integer | No | Pagination offset (default: 0) |

#### Example Request
```javascript
// React/TypeScript example
const fetchQueueItems = async (filters = {}) => {
  const params = new URLSearchParams({
    status: filters.status || '',
    priorityLevel: filters.priorityLevel || '',
    limit: '50',
    offset: '0'
  });

  const response = await fetch(`/api/qc-workflow/queue?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  return data;
};

// Usage
const queueData = await fetchQueueItems({ 
  status: 'PENDING', 
  priorityLevel: 'HIGH' 
});
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "QQI-2024-001",
      "orderId": "1",
      "orderNumber": "ORD-2026-001",
      "appraisalId": "appr-001",
      "status": "PENDING",
      "priorityLevel": "HIGH",
      "priorityScore": 85,
      "assignedAnalystId": null,
      "propertyAddress": "123 Main St, Springfield, IL 62701",
      "appraisedValue": 350000,
      "clientId": "client-001",
      "clientName": "First National Bank",
      "vendorId": "vendor-001",
      "vendorName": "Precision Appraisal Services",
      "sla": {
        "dueDate": "2026-02-09T17:00:00.000Z",
        "targetResponseTime": 1440,
        "breached": false,
        "escalated": false
      },
      "createdAt": "2026-02-08T09:15:00.000Z",
      "updatedAt": "2026-02-08T14:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. GET `/api/qc-workflow/queue/statistics`
**Purpose:** Get overall queue statistics and metrics

#### Example Request
```javascript
// Vue.js example
async function loadQueueStats() {
  try {
    const response = await fetch('/api/qc-workflow/queue/statistics', {
      headers: {
        'Authorization': `Bearer ${this.$store.state.authToken}`
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      this.statistics = result.data;
    }
  } catch (error) {
    console.error('Failed to load statistics:', error);
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "total": 45,
    "pending": 12,
    "inReview": 18,
    "completed": 15,
    "breached": 3,
    "averageWaitTime": 125,
    "longestWaitTime": 340,
    "byPriority": {
      "CRITICAL": 5,
      "HIGH": 15,
      "MEDIUM": 20,
      "LOW": 5
    }
  }
}
```

---

### 3. POST `/api/qc-workflow/queue/assign`
**Purpose:** Manually assign a review to a specific analyst

#### Request Body
```typescript
interface AssignReviewRequest {
  queueItemId: string;     // Required
  analystId: string;       // Required
  notes?: string;          // Optional
}
```

#### Example Request
```javascript
// Angular example
assignReview(queueItemId: string, analystId: string, notes?: string) {
  return this.http.post('/api/qc-workflow/queue/assign', {
    queueItemId,
    analystId,
    notes
  }, {
    headers: {
      'Authorization': `Bearer ${this.authService.getToken()}`
    }
  }).subscribe({
    next: (result) => {
      console.log('Review assigned:', result.data);
      this.refreshQueue();
    },
    error: (error) => {
      console.error('Assignment failed:', error);
    }
  });
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "QQI-2024-001",
    "status": "IN_REVIEW",
    "assignedAnalystId": "analyst-001",
    "assignedAt": "2026-02-09T10:30:00.000Z"
  },
  "message": "Review assigned successfully"
}
```

---

### 4. POST `/api/qc-workflow/queue/auto-assign`
**Purpose:** Automatically assign pending reviews to balance analyst workload

#### Example Request
```javascript
// Plain JavaScript example
async function autoAssignReviews() {
  const response = await fetch('/api/qc-workflow/queue/auto-assign', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();
  
  if (result.success) {
    alert(`${result.data.assignedCount} reviews auto-assigned!`);
    refreshQueueView();
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "assignedCount": 8
  },
  "message": "Auto-assigned 8 reviews"
}
```

---

### 5. GET `/api/qc-workflow/queue/next/:analystId`
**Purpose:** Get the next highest-priority review for a specific analyst

#### URL Parameters
- `analystId` (required): The analyst's user ID

#### Example Request
```javascript
// React Hook example
const useNextReview = (analystId) => {
  const [nextReview, setNextReview] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchNext = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/qc-workflow/queue/next/${analystId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      const result = await response.json();
      setNextReview(result.data);
    } catch (error) {
      console.error('Error fetching next review:', error);
    } finally {
      setLoading(false);
    }
  };

  return { nextReview, loading, fetchNext };
};
```

#### Response (Review Available)
```json
{
  "success": true,
  "data": {
    "id": "QQI-2024-005",
    "orderId": "5",
    "orderNumber": "ORD-2026-005",
    "status": "IN_REVIEW",
    "priorityLevel": "CRITICAL",
    "priorityScore": 92,
    "propertyAddress": "456 Oak Ave, Chicago, IL 60601",
    "assignedAnalystId": "analyst-001",
    "assignedAt": "2026-02-09T11:00:00.000Z"
  }
}
```

#### Response (No Reviews Available)
```json
{
  "success": true,
  "data": null,
  "message": "No pending reviews available"
}
```

---

### 6. GET `/api/qc-workflow/analysts/workload`
**Purpose:** Get workload information for all analysts

#### Example Request
```javascript
// React example with dashboard component
const AnalystWorkloadDashboard = () => {
  const [workloads, setWorkloads] = useState([]);

  useEffect(() => {
    const fetchWorkloads = async () => {
      const response = await fetch('/api/qc-workflow/analysts/workload', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        setWorkloads(result.data);
      }
    };

    fetchWorkloads();
    // Refresh every 30 seconds
    const interval = setInterval(fetchWorkloads, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="workload-dashboard">
      <h2>Analyst Workload</h2>
      {workloads.map(analyst => (
        <div key={analyst.analystId} className="analyst-card">
          <h3>{analyst.analystName}</h3>
          <p>Active: {analyst.activeReviews} / {analyst.capacity}</p>
          <p>Utilization: {analyst.utilizationPercent}%</p>
          <div className="progress-bar">
            <div 
              style={{ width: `${analyst.utilizationPercent}%` }}
              className={analyst.utilizationPercent > 80 ? 'high' : 'normal'}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "analystId": "analyst-001",
      "analystName": "Sarah Johnson",
      "activeReviews": 8,
      "capacity": 10,
      "utilizationPercent": 80,
      "averageReviewTime": 145
    },
    {
      "analystId": "analyst-002",
      "analystName": "Mike Chen",
      "activeReviews": 5,
      "capacity": 10,
      "utilizationPercent": 50,
      "averageReviewTime": 132
    }
  ]
}
```

---

## 🔄 Revision Management Endpoints

### 7. POST `/api/qc-workflow/revisions`
**Purpose:** Create a revision request for an appraisal that failed QC

#### Request Body
```typescript
interface CreateRevisionRequest {
  orderId: string;                    // Required
  appraisalId: string;                // Required
  qcReportId: string;                 // Required
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';  // Required
  dueDate?: string;                   // Optional (ISO 8601)
  issues: Array<{                     // Required (min 1 issue)
    category: string;                 // e.g., "COMPARABLE_SELECTION"
    description: string;              // Detailed description
    severity: string;                 // Issue-specific severity
  }>;
  requestNotes: string;               // Required
  requestedBy: string;                // Required (analyst user ID)
}
```

#### Example Request
```javascript
// React example with form
const createRevisionRequest = async (formData) => {
  const revisionData = {
    orderId: formData.orderId,
    appraisalId: formData.appraisalId,
    qcReportId: formData.qcReportId,
    severity: 'MAJOR',
    issues: [
      {
        category: 'COMPARABLE_SELECTION',
        description: 'Comp #2 is 1.5 miles away, exceeds 1-mile guideline',
        severity: 'MAJOR'
      },
      {
        category: 'MARKET_CONDITIONS',
        description: 'Market conditions adjustment not adequately explained',
        severity: 'MODERATE'
      }
    ],
    requestNotes: 'Please address comparable selection and provide additional market analysis support',
    requestedBy: 'analyst-001'
  };

  try {
    const response = await fetch('/api/qc-workflow/revisions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(revisionData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Revision created:', result.data.id);
      // Redirect to revision tracking page
      window.location.href = `/revisions/${result.data.id}`;
    }
  } catch (error) {
    console.error('Failed to create revision:', error);
  }
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "REV-2024-001",
    "orderId": "1",
    "appraisalId": "appr-001",
    "qcReportId": "QCR-2024-001",
    "version": "v1",
    "status": "PENDING",
    "severity": "MAJOR",
    "dueDate": "2026-02-10T14:30:00.000Z",
    "issues": [
      {
        "id": "ISS-001",
        "category": "COMPARABLE_SELECTION",
        "description": "Comp #2 is 1.5 miles away",
        "severity": "MAJOR",
        "resolved": false
      }
    ],
    "requestNotes": "Please address comparable selection",
    "requestedBy": "analyst-001",
    "requestedAt": "2026-02-09T14:30:00.000Z",
    "createdAt": "2026-02-09T14:30:00.000Z"
  },
  "message": "Revision request created successfully"
}
```

---

### 8. POST `/api/qc-workflow/revisions/:revisionId/submit`
**Purpose:** Submit a revised appraisal (triggers automatic re-QC)

#### URL Parameters
- `revisionId` (required): The revision request ID

#### Request Body
```typescript
interface SubmitRevisionRequest {
  responseNotes: string;              // Required
  submittedBy: string;                // Required (appraiser user ID)
  resolvedIssues: Array<{             // Required (can be empty array)
    issueId: string;
    resolution: string;
  }>;
}
```

#### Example Request
```javascript
// Vue.js example
async submitRevision(revisionId, responseData) {
  const payload = {
    responseNotes: responseData.notes,
    submittedBy: this.$store.state.user.id,
    resolvedIssues: responseData.issues.map(issue => ({
      issueId: issue.id,
      resolution: issue.resolutionText
    }))
  };

  try {
    const response = await this.$http.post(
      `/api/qc-workflow/revisions/${revisionId}/submit`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      }
    );

    if (response.data.success) {
      this.$notify.success('Revision submitted - automatic re-QC initiated');
      this.$router.push(`/queue/${response.data.data.reQCQueueItemId}`);
    }
  } catch (error) {
    this.$notify.error('Submission failed');
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "REV-2024-001",
    "status": "SUBMITTED",
    "submittedAt": "2026-02-09T16:45:00.000Z",
    "autoReQCTriggered": true,
    "reQCQueueItemId": "QQI-2024-010",
    "resolvedIssues": [
      {
        "issueId": "ISS-001",
        "resolved": true,
        "resolution": "Replaced comp #2 with property 0.4 miles away"
      }
    ]
  },
  "message": "Revision submitted successfully - auto re-QC triggered"
}
```

---

### 9. POST `/api/qc-workflow/revisions/:revisionId/accept`
**Purpose:** Accept a revised appraisal (QC passed)

#### URL Parameters
- `revisionId` (required): The revision request ID

#### Request Body
```typescript
interface AcceptRevisionRequest {
  acceptedBy: string;     // Required (analyst user ID)
  notes?: string;         // Optional
}
```

#### Example Request
```javascript
// React example
const acceptRevision = async (revisionId, notes = '') => {
  const response = await fetch(
    `/api/qc-workflow/revisions/${revisionId}/accept`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        acceptedBy: getCurrentUserId(),
        notes: notes
      })
    }
  );

  const result = await response.json();
  
  if (result.success) {
    showNotification('Revision accepted!', 'success');
    refreshRevisionList();
  }
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "REV-2024-001",
    "status": "ACCEPTED",
    "acceptedBy": "analyst-001",
    "acceptedAt": "2026-02-09T17:00:00.000Z",
    "notes": "All issues adequately addressed"
  },
  "message": "Revision accepted"
}
```

---

### 10. POST `/api/qc-workflow/revisions/:revisionId/reject`
**Purpose:** Reject a revised appraisal (still has issues)

#### URL Parameters
- `revisionId` (required): The revision request ID

#### Request Body
```typescript
interface RejectRevisionRequest {
  rejectedBy: string;     // Required (analyst user ID)
  reason: string;         // Required
}
```

#### Example Request
```javascript
// Angular example
rejectRevision(revisionId: string, reason: string) {
  this.http.post(
    `/api/qc-workflow/revisions/${revisionId}/reject`,
    {
      rejectedBy: this.authService.getCurrentUser().id,
      reason: reason
    },
    {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`
      }
    }
  ).subscribe({
    next: (result: any) => {
      this.toastr.warning('Revision rejected - appraiser notified');
      this.router.navigate(['/revisions']);
    },
    error: (error) => {
      this.toastr.error('Failed to reject revision');
    }
  });
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "REV-2024-001",
    "status": "REJECTED",
    "rejectedBy": "analyst-001",
    "rejectedAt": "2026-02-09T17:15:00.000Z",
    "reason": "Comparable selection still inadequate - needs local comps within 0.5 miles"
  },
  "message": "Revision rejected - appraiser notified"
}
```

---

### 11. GET `/api/qc-workflow/revisions/order/:orderId/history`
**Purpose:** Get complete revision history for an order

#### URL Parameters
- `orderId` (required): The order ID

#### Example Request
```javascript
// React example with revision history component
const RevisionHistory = ({ orderId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `/api/qc-workflow/revisions/order/${orderId}/history`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        const result = await response.json();
        if (result.success) {
          setHistory(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [orderId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="revision-history">
      <h3>Revision History</h3>
      {history.map((revision, index) => (
        <div key={revision.id} className="revision-item">
          <h4>Version {revision.version}</h4>
          <p>Status: {revision.status}</p>
          <p>Created: {new Date(revision.createdAt).toLocaleString()}</p>
          {revision.submittedAt && (
            <p>Submitted: {new Date(revision.submittedAt).toLocaleString()}</p>
          )}
        </div>
      ))}
    </div>
  );
};
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "REV-2024-001",
      "version": "v1",
      "status": "ACCEPTED",
      "severity": "MAJOR",
      "requestedAt": "2026-02-09T14:30:00.000Z",
      "submittedAt": "2026-02-09T16:45:00.000Z",
      "acceptedAt": "2026-02-09T17:00:00.000Z",
      "issues": [
        {
          "category": "COMPARABLE_SELECTION",
          "description": "Comp #2 too far",
          "resolved": true,
          "resolution": "Replaced with closer comp"
        }
      ]
    }
  ]
}
```

---

### 12. GET `/api/qc-workflow/revisions/active`
**Purpose:** Get all currently active revision requests

#### Example Request
```javascript
// Plain JavaScript example
async function loadActiveRevisions() {
  const response = await fetch('/api/qc-workflow/revisions/active', {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });

  const result = await response.json();
  
  if (result.success) {
    displayRevisions(result.data);
  }
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "REV-2024-002",
      "orderId": "5",
      "status": "PENDING",
      "severity": "MAJOR",
      "dueDate": "2026-02-10T14:00:00.000Z",
      "requestedAt": "2026-02-09T14:00:00.000Z"
    },
    {
      "id": "REV-2024-003",
      "orderId": "8",
      "status": "IN_PROGRESS",
      "severity": "MODERATE",
      "dueDate": "2026-02-11T10:00:00.000Z",
      "requestedAt": "2026-02-09T10:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

### 13. GET `/api/qc-workflow/revisions/overdue`
**Purpose:** Get all overdue revision requests

#### Example Request
```javascript
// Vue.js example
async mounted() {
  try {
    const response = await this.$http.get('/api/qc-workflow/revisions/overdue', {
      headers: {
        'Authorization': `Bearer ${this.$store.state.authToken}`
      }
    });
    
    if (response.data.success) {
      this.overdueRevisions = response.data.data;
      
      // Show alert if there are overdue revisions
      if (response.data.count > 0) {
        this.$notify.warning(`${response.data.count} overdue revisions require attention!`);
      }
    }
  } catch (error) {
    console.error('Failed to load overdue revisions:', error);
  }
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "REV-2024-004",
      "orderId": "12",
      "status": "PENDING",
      "severity": "CRITICAL",
      "dueDate": "2026-02-08T14:00:00.000Z",
      "hoursOverdue": 27,
      "requestedAt": "2026-02-08T14:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## 🚨 Escalation Management Endpoints

### 14. POST `/api/qc-workflow/escalations`
**Purpose:** Create an escalation case

#### Request Body
```typescript
interface CreateEscalationRequest {
  orderId: string;                    // Required
  escalationType: EscalationType;     // Required (see enum below)
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';  // Required
  title: string;                      // Required
  description: string;                // Required
  raisedBy: string;                   // Required (user ID)
  relatedEntityId?: string;           // Optional (revision ID, etc.)
}

enum EscalationType {
  'QC_DISPUTE',
  'SLA_BREACH',
  'COMPLEX_CASE',
  'REVISION_FAILURE',
  'FRAUD_SUSPECTED',
  'COMPLIANCE_ISSUE',
  'CLIENT_COMPLAINT'
}
```

#### Example Request
```javascript
// React example
const createEscalation = async (escalationData) => {
  const payload = {
    orderId: escalationData.orderId,
    escalationType: 'QC_DISPUTE',
    priority: 'HIGH',
    title: 'Appraiser disputes QC comparable selection findings',
    description: 'Appraiser provided additional market data showing their comp selection is valid based on recent sales trends in micro-market',
    raisedBy: getCurrentUserId(),
    relatedEntityId: escalationData.qcReportId
  };

  try {
    const response = await fetch('/api/qc-workflow/escalations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.success) {
      alert('Escalation created and assigned to manager');
      window.location.href = `/escalations/${result.data.id}`;
    }
  } catch (error) {
    console.error('Failed to create escalation:', error);
  }
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "ESC-2024-001",
    "orderId": "5",
    "escalationType": "QC_DISPUTE",
    "priority": "HIGH",
    "title": "Appraiser disputes QC findings",
    "description": "Additional market data provided",
    "status": "OPEN",
    "raisedBy": "appraiser-001",
    "raisedAt": "2026-02-09T15:00:00.000Z",
    "assignedTo": "manager-001",
    "assignedAt": "2026-02-09T15:00:00.000Z"
  },
  "message": "Escalation created and assigned"
}
```

---

### 15. GET `/api/qc-workflow/escalations/open`
**Purpose:** Get all open escalations

#### Example Request
```javascript
// Angular example with polling
export class EscalationListComponent implements OnInit, OnDestroy {
  escalations: any[] = [];
  private refreshInterval: any;

  ngOnInit() {
    this.loadEscalations();
    // Refresh every 60 seconds
    this.refreshInterval = setInterval(() => {
      this.loadEscalations();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadEscalations() {
    this.http.get('/api/qc-workflow/escalations/open', {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`
      }
    }).subscribe({
      next: (result: any) => {
        if (result.success) {
          this.escalations = result.data;
        }
      },
      error: (error) => {
        console.error('Failed to load escalations:', error);
      }
    });
  }
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "ESC-2024-001",
      "orderId": "5",
      "escalationType": "QC_DISPUTE",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "title": "Appraiser disputes QC findings",
      "assignedTo": "manager-001",
      "raisedAt": "2026-02-09T15:00:00.000Z"
    },
    {
      "id": "ESC-2024-002",
      "orderId": "8",
      "escalationType": "SLA_BREACH",
      "priority": "URGENT",
      "status": "OPEN",
      "title": "QC review SLA breached",
      "assignedTo": "manager-002",
      "raisedAt": "2026-02-09T16:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

### 16. GET `/api/qc-workflow/escalations/manager/:managerId`
**Purpose:** Get all escalations assigned to a specific manager

#### URL Parameters
- `managerId` (required): The manager's user ID

#### Example Request
```javascript
// React Hook example
const useManagerEscalations = (managerId) => {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const response = await fetch(
          `/api/qc-workflow/escalations/manager/${managerId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        const result = await response.json();
        if (result.success) {
          setEscalations(result.data);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEscalations();
  }, [managerId]);

  return { escalations, loading };
};
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "ESC-2024-001",
      "orderId": "5",
      "escalationType": "QC_DISPUTE",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "title": "Appraiser disputes QC findings"
    }
  ],
  "count": 1
}
```

---

### 17. POST `/api/qc-workflow/escalations/:escalationId/comment`
**Purpose:** Add a comment to an escalation

#### URL Parameters
- `escalationId` (required): The escalation ID

#### Request Body
```typescript
interface AddCommentRequest {
  commentBy: string;                  // Required (user ID)
  comment: string;                    // Required
  visibility: 'INTERNAL' | 'EXTERNAL';  // Required
}
```

#### Example Request
```javascript
// Vue.js example
async addComment(escalationId, commentText) {
  const payload = {
    commentBy: this.$store.state.user.id,
    comment: commentText,
    visibility: 'INTERNAL'
  };

  try {
    const response = await this.$http.post(
      `/api/qc-workflow/escalations/${escalationId}/comment`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      }
    );

    if (response.data.success) {
      this.$notify.success('Comment added');
      this.loadEscalation(escalationId);  // Refresh
    }
  } catch (error) {
    this.$notify.error('Failed to add comment');
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "ESC-2024-001",
    "comments": [
      {
        "id": "CMT-001",
        "commentBy": "manager-001",
        "comment": "Reviewing additional market data provided",
        "commentedAt": "2026-02-09T15:30:00.000Z",
        "visibility": "INTERNAL"
      }
    ]
  },
  "message": "Comment added successfully"
}
```

---

### 18. POST `/api/qc-workflow/escalations/:escalationId/resolve`
**Purpose:** Resolve an escalation

#### URL Parameters
- `escalationId` (required): The escalation ID

#### Request Body
```typescript
interface ResolveEscalationRequest {
  resolvedBy: string;       // Required (user ID)
  resolution: string;       // Required (resolution details)
  resolutionType?: string;  // Optional (specific to escalation type)
}
```

#### Example Request
```javascript
// React example
const resolveEscalation = async (escalationId, resolutionData) => {
  const payload = {
    resolvedBy: getCurrentUserId(),
    resolution: resolutionData.notes,
    resolutionType: 'OVERTURN_QC'  // For QC disputes
  };

  try {
    const response = await fetch(
      `/api/qc-workflow/escalations/${escalationId}/resolve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    
    if (result.success) {
      showNotification('Escalation resolved', 'success');
      redirectToEscalationsList();
    }
  } catch (error) {
    showNotification('Failed to resolve escalation', 'error');
  }
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "ESC-2024-001",
    "status": "RESOLVED",
    "resolution": "After reviewing additional market data, QC finding overturned",
    "resolutionType": "OVERTURN_QC",
    "resolvedBy": "manager-001",
    "resolvedAt": "2026-02-09T16:00:00.000Z"
  },
  "message": "Escalation resolved"
}
```

---

## ⏱️ SLA Tracking Endpoints

### 19. POST `/api/qc-workflow/sla/start`
**Purpose:** Start SLA tracking for an entity

#### Request Body
```typescript
interface StartSLATrackingRequest {
  entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION';  // Required
  entityId: string;           // Required
  orderId: string;            // Required
  orderNumber: string;        // Required
  orderPriority: string;      // Required
  targetMinutes?: number;     // Optional (uses default if not provided)
}
```

#### Example Request
```javascript
// React example - start tracking when review begins
const startQCReviewTracking = async (queueItem) => {
  const payload = {
    entityType: 'QC_REVIEW',
    entityId: queueItem.id,
    orderId: queueItem.orderId,
    orderNumber: queueItem.orderNumber,
    orderPriority: queueItem.orderPriority
    // targetMinutes will use default (240 for QC_REVIEW)
  };

  try {
    const response = await fetch('/api/qc-workflow/sla/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('SLA tracking started:', result.data.id);
      // Store tracking ID for later reference
      return result.data.id;
    }
  } catch (error) {
    console.error('Failed to start SLA tracking:', error);
  }
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "SLA-2024-001",
    "entityType": "QC_REVIEW",
    "entityId": "QQI-2024-001",
    "orderId": "5",
    "orderNumber": "ORD-2026-005",
    "orderPriority": "RUSH",
    "status": "ON_TRACK",
    "startTime": "2026-02-09T10:00:00.000Z",
    "targetMinutes": 120,
    "targetDate": "2026-02-09T12:00:00.000Z",
    "elapsedMinutes": 0,
    "percentComplete": 0
  },
  "message": "SLA tracking started"
}
```

---

### 20. GET `/api/qc-workflow/sla/:trackingId`
**Purpose:** Get current SLA status

#### URL Parameters
- `trackingId` (required): The SLA tracking ID

#### Example Request
```javascript
// React Hook with real-time updates
const useSLAStatus = (trackingId) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `/api/qc-workflow/sla/${trackingId}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        const result = await response.json();
        if (result.success) {
          setStatus(result.data);
        }
      } catch (error) {
        console.error('Error fetching SLA status:', error);
      }
    };

    fetchStatus();
    // Refresh every minute
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [trackingId]);

  return status;
};

// Usage in component
const SLAIndicator = ({ trackingId }) => {
  const status = useSLAStatus(trackingId);

  if (!status) return <div>Loading...</div>;

  const getStatusColor = () => {
    if (status.status === 'ON_TRACK') return 'green';
    if (status.status === 'AT_RISK') return 'orange';
    if (status.status === 'BREACHED') return 'red';
    return 'gray';
  };

  return (
    <div className={`sla-indicator ${getStatusColor()}`}>
      <div className="progress-bar">
        <div style={{ width: `${status.percentComplete}%` }} />
      </div>
      <span>{status.percentComplete.toFixed(1)}% elapsed</span>
      <span>{status.status}</span>
    </div>
  );
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "SLA-2024-001",
    "entityType": "QC_REVIEW",
    "status": "AT_RISK",
    "startTime": "2026-02-09T10:00:00.000Z",
    "targetMinutes": 120,
    "targetDate": "2026-02-09T12:00:00.000Z",
    "elapsedMinutes": 100,
    "percentComplete": 83.3,
    "atRiskAlertSent": true,
    "atRiskAlertSentAt": "2026-02-09T11:36:00.000Z"
  }
}
```

---

### 21. POST `/api/qc-workflow/sla/:trackingId/extend`
**Purpose:** Extend an SLA deadline

#### URL Parameters
- `trackingId` (required): The SLA tracking ID

#### Request Body
```typescript
interface ExtendSLARequest {
  extensionMinutes: number;   // Required (must be > 0)
  reason: string;             // Required
  extendedBy: string;         // Required (user ID)
}
```

#### Example Request
```javascript
// Angular example
extendSLA(trackingId: string, minutes: number, reason: string) {
  const payload = {
    extensionMinutes: minutes,
    reason: reason,
    extendedBy: this.authService.getCurrentUser().id
  };

  this.http.post(
    `/api/qc-workflow/sla/${trackingId}/extend`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`
      }
    }
  ).subscribe({
    next: (result: any) => {
      this.toastr.success(`SLA extended by ${minutes} minutes`);
      this.refreshSLAStatus();
    },
    error: (error) => {
      this.toastr.error('Failed to extend SLA');
    }
  });
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "SLA-2024-001",
    "targetMinutes": 180,
    "targetDate": "2026-02-09T13:00:00.000Z",
    "extensions": [
      {
        "extensionMinutes": 60,
        "reason": "Additional market research required",
        "extendedBy": "manager-001",
        "extendedAt": "2026-02-09T11:40:00.000Z"
      }
    ]
  },
  "message": "SLA extended by 60 minutes"
}
```

---

### 22. POST `/api/qc-workflow/sla/:trackingId/waive`
**Purpose:** Waive an SLA (no longer applies)

#### URL Parameters
- `trackingId` (required): The SLA tracking ID

#### Request Body
```typescript
interface WaiveSLARequest {
  reason: string;       // Required
  waivedBy: string;     // Required (user ID)
}
```

#### Example Request
```javascript
// Vue.js example
async waiveSLA(trackingId, reason) {
  const payload = {
    reason: reason,
    waivedBy: this.$store.state.user.id
  };

  try {
    const response = await this.$http.post(
      `/api/qc-workflow/sla/${trackingId}/waive`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      }
    );

    if (response.data.success) {
      this.$notify.success('SLA waived');
      this.refreshStatus();
    }
  } catch (error) {
    this.$notify.error('Failed to waive SLA');
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "SLA-2024-001",
    "status": "WAIVED",
    "waivedAt": "2026-02-09T11:45:00.000Z",
    "waivedBy": "manager-001",
    "waiveReason": "Client requested hold on review pending additional documentation"
  },
  "message": "SLA waived"
}
```

---

### 23. GET `/api/qc-workflow/sla/metrics`
**Purpose:** Get SLA performance metrics

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | Yes | `TODAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR` |
| entityType | string | No | Filter by type: `QC_REVIEW`, `REVISION`, `ESCALATION` |

#### Example Request
```javascript
// React Dashboard Component
const SLAMetricsDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [period, setPeriod] = useState('WEEK');

  useEffect(() => {
    const fetchMetrics = async () => {
      const params = new URLSearchParams({
        period: period,
        entityType: 'QC_REVIEW'
      });

      try {
        const response = await fetch(
          `/api/qc-workflow/sla/metrics?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        const result = await response.json();
        if (result.success) {
          setMetrics(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    fetchMetrics();
  }, [period]);

  if (!metrics) return <div>Loading metrics...</div>;

  return (
    <div className="sla-metrics-dashboard">
      <h2>SLA Performance - {period}</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Compliance Rate</h3>
          <div className="metric-value">
            {metrics.complianceRate.toFixed(1)}%
          </div>
        </div>

        <div className="metric-card">
          <h3>Average Completion</h3>
          <div className="metric-value">
            {metrics.averageCompletionTime} min
          </div>
        </div>

        <div className="metric-card">
          <h3>Breached</h3>
          <div className="metric-value danger">
            {metrics.breachedCount}
          </div>
        </div>

        <div className="metric-card">
          <h3>At Risk</h3>
          <div className="metric-value warning">
            {metrics.atRiskCount}
          </div>
        </div>
      </div>

      <div className="period-selector">
        <button onClick={() => setPeriod('TODAY')}>Today</button>
        <button onClick={() => setPeriod('WEEK')}>This Week</button>
        <button onClick={() => setPeriod('MONTH')}>This Month</button>
      </div>
    </div>
  );
};
```

#### Response
```json
{
  "success": true,
  "data": {
    "period": "WEEK",
    "entityType": "QC_REVIEW",
    "totalTracked": 145,
    "completed": 132,
    "active": 13,
    "complianceRate": 91.7,
    "breachedCount": 11,
    "atRiskCount": 5,
    "waivedCount": 2,
    "averageCompletionTime": 187,
    "medianCompletionTime": 165,
    "p95CompletionTime": 285,
    "onTimeCount": 121,
    "breachRate": 8.3
  }
}
```

---

## 🔧 TypeScript Interfaces

Here are the complete TypeScript interfaces for use in your frontend:

```typescript
// ============= Queue Management =============

interface QCReviewQueueItem {
  id: string;
  orderId: string;
  orderNumber: string;
  appraisalId: string;
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED';
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priorityScore: number;
  assignedAnalystId?: string;
  assignedAt?: string;
  propertyAddress: string;
  appraisedValue: number;
  clientId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  sla: {
    dueDate: string;
    targetResponseTime: number;
    breached: boolean;
    escalated: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface QueueStatistics {
  total: number;
  pending: number;
  inReview: number;
  completed: number;
  breached: number;
  averageWaitTime: number;
  longestWaitTime: number;
  byPriority: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

interface AnalystWorkload {
  analystId: string;
  analystName: string;
  activeReviews: number;
  capacity: number;
  utilizationPercent: number;
  averageReviewTime: number;
}

// ============= Revision Management =============

interface RevisionRequest {
  id: string;
  orderId: string;
  appraisalId: string;
  qcReportId: string;
  version: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';
  dueDate: string;
  issues: RevisionIssue[];
  requestNotes: string;
  requestedBy: string;
  requestedAt: string;
  responseNotes?: string;
  submittedBy?: string;
  submittedAt?: string;
  autoReQCTriggered?: boolean;
  reQCQueueItemId?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  reason?: string;
}

interface RevisionIssue {
  id: string;
  category: string;
  description: string;
  severity: string;
  resolved: boolean;
  resolution?: string;
}

// ============= Escalation Management =============

type EscalationType = 
  | 'QC_DISPUTE'
  | 'SLA_BREACH'
  | 'COMPLEX_CASE'
  | 'REVISION_FAILURE'
  | 'FRAUD_SUSPECTED'
  | 'COMPLIANCE_ISSUE'
  | 'CLIENT_COMPLAINT';

interface EscalationCase {
  id: string;
  orderId: string;
  escalationType: EscalationType;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  raisedBy: string;
  raisedAt: string;
  assignedTo: string;
  assignedAt: string;
  resolution?: string;
  resolutionType?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  comments?: EscalationComment[];
}

interface EscalationComment {
  id: string;
  commentBy: string;
  comment: string;
  commentedAt: string;
  visibility: 'INTERNAL' | 'EXTERNAL';
}

// ============= SLA Tracking =============

interface SLATracking {
  id: string;
  entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION';
  entityId: string;
  orderId: string;
  orderNumber: string;
  orderPriority: string;
  status: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'COMPLETED' | 'WAIVED';
  startTime: string;
  targetMinutes: number;
  targetDate: string;
  elapsedMinutes: number;
  percentComplete: number;
  atRiskAlertSent?: boolean;
  atRiskAlertSentAt?: string;
  breachAlertSent?: boolean;
  breachAlertSentAt?: string;
  completedAt?: string;
  waivedAt?: string;
  waivedBy?: string;
  waiveReason?: string;
  extensions?: SLAExtension[];
}

interface SLAExtension {
  extensionMinutes: number;
  reason: string;
  extendedBy: string;
  extendedAt: string;
}

interface SLAMetrics {
  period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  entityType?: 'QC_REVIEW' | 'REVISION' | 'ESCALATION';
  totalTracked: number;
  completed: number;
  active: number;
  complianceRate: number;
  breachedCount: number;
  atRiskCount: number;
  waivedCount: number;
  averageCompletionTime: number;
  medianCompletionTime: number;
  p95CompletionTime: number;
  onTimeCount: number;
  breachRate: number;
}
```

---

## 🚀 Complete Frontend Integration Example

Here's a complete example of a QC Review Dashboard component:

```typescript
// QCReviewDashboard.tsx
import React, { useState, useEffect } from 'react';

const QCReviewDashboard: React.FC = () => {
  const [queue, setQueue] = useState<QCReviewQueueItem[]>([]);
  const [statistics, setStatistics] = useState<QueueStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const authToken = localStorage.getItem('authToken');

  // Fetch queue items and statistics
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        };

        // Fetch queue and statistics in parallel
        const [queueRes, statsRes] = await Promise.all([
          fetch('/api/qc-workflow/queue?status=PENDING&limit=20', { headers }),
          fetch('/api/qc-workflow/queue/statistics', { headers })
        ]);

        const queueData = await queueRes.json();
        const statsData = await statsRes.json();

        if (queueData.success) setQueue(queueData.data);
        if (statsData.success) setStatistics(statsData.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authToken]);

  // Assign review to analyst
  const assignReview = async (queueItemId: string, analystId: string) => {
    try {
      const response = await fetch('/api/qc-workflow/queue/assign', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queueItemId, analystId })
      });

      const result = await response.json();
      if (result.success) {
        alert('Review assigned successfully!');
        // Refresh queue
        window.location.reload();
      }
    } catch (error) {
      console.error('Assignment failed:', error);
      alert('Failed to assign review');
    }
  };

  // Get next review for current analyst
  const getNextReview = async (analystId: string) => {
    try {
      const response = await fetch(
        `/api/qc-workflow/queue/next/${analystId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const result = await response.json();
      if (result.success && result.data) {
        // Navigate to review detail page
        window.location.href = `/review/${result.data.id}`;
      } else {
        alert('No pending reviews available');
      }
    } catch (error) {
      console.error('Failed to get next review:', error);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="qc-dashboard">
      {/* Statistics Panel */}
      {statistics && (
        <div className="statistics-panel">
          <h2>Queue Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total</h3>
              <div className="stat-value">{statistics.total}</div>
            </div>
            <div className="stat-card">
              <h3>Pending</h3>
              <div className="stat-value">{statistics.pending}</div>
            </div>
            <div className="stat-card">
              <h3>In Review</h3>
              <div className="stat-value">{statistics.inReview}</div>
            </div>
            <div className="stat-card danger">
              <h3>Breached</h3>
              <div className="stat-value">{statistics.breached}</div>
            </div>
          </div>
        </div>
      )}

      {/* Queue Items */}
      <div className="queue-panel">
        <div className="panel-header">
          <h2>Pending Reviews</h2>
          <button onClick={() => getNextReview('analyst-001')}>
            Get Next Review
          </button>
        </div>

        <table className="queue-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Property</th>
              <th>Priority</th>
              <th>Client</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(item => (
              <tr key={item.id}>
                <td>{item.orderNumber}</td>
                <td>{item.propertyAddress}</td>
                <td>
                  <span className={`priority-badge ${item.priorityLevel.toLowerCase()}`}>
                    {item.priorityLevel}
                  </span>
                </td>
                <td>{item.clientName}</td>
                <td>
                  {new Date(item.sla.dueDate).toLocaleString()}
                  {item.sla.breached && (
                    <span className="breach-indicator">BREACHED</span>
                  )}
                </td>
                <td>
                  <button onClick={() => assignReview(item.id, 'analyst-001')}>
                    Assign
                  </button>
                  <button onClick={() => window.location.href = `/review/${item.id}`}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QCReviewDashboard;
```

---

## ❌ Error Handling

All endpoints return consistent error responses:

### Validation Error (400)
```json
{
  "success": false,
  "errors": [
    {
      "field": "orderId",
      "message": "Order ID is required"
    }
  ]
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": "Unauthorized - Invalid or missing token"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message"
}
```

---

## 📝 Next Steps

1. **Test the endpoints** using the sample code above
2. **Check authentication** - make sure you have a valid token
3. **Review sample data** - see `data/sample-qc-reviews.json` for example queue items
4. **Monitor SLA status** - implement real-time updates for critical metrics
5. **Coordinate on missing endpoints** - let us know if you need additional functionality

---

## 🆘 Support

If you encounter any issues or need additional endpoints:
- Check authentication token validity
- Verify request body matches the documented schemas
- Review error responses for specific validation failures
- Contact backend team for assistance

**Last Updated:** February 9, 2026
