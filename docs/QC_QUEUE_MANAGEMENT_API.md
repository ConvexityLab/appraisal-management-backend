# QC Queue Management API - Frontend Reference

**Last Updated:** February 9, 2026  
**Base URL:** `/api/qc-workflow`  
**Authentication:** Required (JWT Bearer Token)

---

## Overview

This document provides detailed specifications for the 6 Queue Management endpoints, including all query parameters, request bodies, and response objects.

All endpoints require authentication:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Endpoints

### 1. GET `/api/qc-workflow/queue`
**Search and filter the QC review queue**

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status: `PENDING`, `IN_REVIEW`, `COMPLETED` |
| `priorityLevel` | string | No | - | Filter by priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `assignedAnalystId` | string | No | - | Filter by assigned analyst user ID |
| `slaBreached` | boolean | No | - | Filter by SLA breach status (`true` or `false`) |
| `limit` | integer | No | 50 | Number of results to return (1-100) |
| `offset` | integer | No | 0 | Pagination offset |

#### Request Example
```http
GET /api/qc-workflow/queue?status=PENDING&priorityLevel=HIGH&limit=20&offset=0
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Response Object
```typescript
{
  success: boolean;
  data: QCReviewQueueItem[];
  count: number;
}
```

#### QCReviewQueueItem Interface
```typescript
interface QCReviewQueueItem {
  id: string;                    // "QQI-2024-001"
  orderId: string;               // "1"
  orderNumber: string;           // "ORD-2026-001"
  appraisalId: string;           // "appr-001"
  status: string;                // "PENDING" | "IN_REVIEW" | "COMPLETED"
  priorityLevel: string;         // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  priorityScore: number;         // 0-100 (auto-calculated)
  assignedAnalystId?: string;    // "analyst-001" (optional, null if unassigned)
  assignedAt?: string;           // ISO 8601 date (optional)
  propertyAddress: string;       // "123 Main St, Springfield, IL 62701"
  appraisedValue: number;        // 350000
  clientId: string;              // "client-001"
  clientName: string;            // "First National Bank"
  vendorId: string;              // "vendor-001"
  vendorName: string;            // "Precision Appraisal Services"
  sla: {
    dueDate: string;             // ISO 8601 date
    targetResponseTime: number;  // Minutes (e.g., 1440 = 24 hours)
    breached: boolean;           // true if past due date
    escalated: boolean;          // true if escalated to management
  };
  createdAt: string;             // ISO 8601 date
  updatedAt: string;             // ISO 8601 date
}
```

#### Example Response
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
**Get overall queue statistics and metrics**

#### Query Parameters
None

#### Request Example
```http
GET /api/qc-workflow/queue/statistics
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Response Object
```typescript
{
  success: boolean;
  data: QueueStatistics;
}
```

#### QueueStatistics Interface
```typescript
interface QueueStatistics {
  total: number;               // Total items in queue
  pending: number;             // Unassigned items
  inReview: number;            // Currently being reviewed
  completed: number;           // Completed items
  breached: number;            // SLA breached items
  averageWaitTime: number;     // Average wait time in minutes
  longestWaitTime: number;     // Longest wait time in minutes
  byPriority: {
    CRITICAL: number;          // Count of CRITICAL priority items
    HIGH: number;              // Count of HIGH priority items
    MEDIUM: number;            // Count of MEDIUM priority items
    LOW: number;               // Count of LOW priority items
  };
}
```

#### Example Response
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
**Manually assign a review to a specific analyst**

#### Query Parameters
None

#### Request Body
```typescript
{
  queueItemId: string;     // Required - Queue item ID to assign
  analystId: string;       // Required - User ID of analyst
  notes?: string;          // Optional - Assignment notes
}
```

#### Request Example
```http
POST /api/qc-workflow/queue/assign
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "queueItemId": "QQI-2024-001",
  "analystId": "analyst-001",
  "notes": "High priority order - assigned to senior analyst"
}
```

#### Response Object
```typescript
{
  success: boolean;
  data: {
    id: string;                  // Queue item ID
    status: string;              // "IN_REVIEW"
    assignedAnalystId: string;   // Analyst user ID
    assignedAt: string;          // ISO 8601 timestamp
  };
  message: string;               // Success message
}
```

#### Example Response
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

#### Validation Errors
```json
{
  "success": false,
  "errors": [
    {
      "field": "queueItemId",
      "message": "Queue item ID is required"
    }
  ]
}
```

---

### 4. POST `/api/qc-workflow/queue/auto-assign`
**Automatically assign pending reviews to balance analyst workload**

#### Query Parameters
None

#### Request Body
None (empty POST request)

#### Request Example
```http
POST /api/qc-workflow/queue/auto-assign
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

#### Response Object
```typescript
{
  success: boolean;
  data: {
    assignedCount: number;     // Number of reviews assigned
  };
  message: string;             // Success message
}
```

#### Example Response
```json
{
  "success": true,
  "data": {
    "assignedCount": 8
  },
  "message": "Auto-assigned 8 reviews"
}
```

#### How Auto-Assignment Works
- Finds all pending (unassigned) reviews in the queue
- Identifies analysts with available capacity (below max workload)
- Assigns reviews to analysts with lowest utilization percentage
- Balances workload across all available analysts
- Respects priority scoring (highest priority reviews assigned first)

---

### 5. GET `/api/qc-workflow/queue/next/:analystId`
**Get the next highest-priority review for a specific analyst**

#### URL Parameters
- `analystId` (string, required): The analyst's user ID

#### Query Parameters
None

#### Request Example
```http
GET /api/qc-workflow/queue/next/analyst-001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Response Object (Review Available)
```typescript
{
  success: boolean;
  data: QCReviewQueueItem;  // Same structure as endpoint #1
}
```

#### Example Response (Review Available)
```json
{
  "success": true,
  "data": {
    "id": "QQI-2024-005",
    "orderId": "5",
    "orderNumber": "ORD-2026-005",
    "appraisalId": "appr-005",
    "status": "IN_REVIEW",
    "priorityLevel": "CRITICAL",
    "priorityScore": 92,
    "propertyAddress": "456 Oak Ave, Chicago, IL 60601",
    "appraisedValue": 1200000,
    "clientId": "client-002",
    "clientName": "Premium Lending Corp",
    "vendorId": "vendor-003",
    "vendorName": "Elite Appraisals LLC",
    "assignedAnalystId": "analyst-001",
    "assignedAt": "2026-02-09T11:00:00.000Z",
    "sla": {
      "dueDate": "2026-02-09T13:00:00.000Z",
      "targetResponseTime": 120,
      "breached": false,
      "escalated": false
    },
    "createdAt": "2026-02-09T11:00:00.000Z",
    "updatedAt": "2026-02-09T11:00:00.000Z"
  }
}
```

#### Response Object (No Reviews Available)
```typescript
{
  success: boolean;
  data: null;
  message: string;
}
```

#### Example Response (No Reviews)
```json
{
  "success": true,
  "data": null,
  "message": "No pending reviews available"
}
```

#### Priority Selection Logic
1. Filters reviews assigned to the specified analyst
2. Orders by `priorityScore` (highest first)
3. Returns the single highest-priority review
4. Returns `null` if no reviews are assigned to the analyst

---

### 6. GET `/api/qc-workflow/analysts/workload`
**Get workload information for all analysts**

#### Query Parameters
None

#### Request Example
```http
GET /api/qc-workflow/analysts/workload
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

#### Response Object
```typescript
{
  success: boolean;
  data: AnalystWorkload[];
}
```

#### AnalystWorkload Interface
```typescript
interface AnalystWorkload {
  analystId: string;           // User ID of analyst
  analystName: string;         // Full name of analyst
  activeReviews: number;       // Current number of active reviews
  capacity: number;            // Maximum capacity (default: 10)
  utilizationPercent: number;  // Percentage of capacity used (0-100)
  averageReviewTime: number;   // Average time per review in minutes
}
```

#### Example Response
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
    },
    {
      "analystId": "analyst-003",
      "analystName": "Jennifer Martinez",
      "activeReviews": 10,
      "capacity": 10,
      "utilizationPercent": 100,
      "averageReviewTime": 168
    }
  ]
}
```

#### Use Cases
- **Dashboard Display:** Show analyst capacity and utilization in real-time
- **Load Balancing:** Identify analysts with available capacity
- **Performance Monitoring:** Track average review times per analyst
- **Capacity Planning:** Determine when to add more analysts

---

## Quick Reference Table

| Endpoint | Method | URL Params | Query Params | Request Body | Returns |
|----------|--------|------------|--------------|--------------|---------|
| **Search Queue** | GET | None | `status`, `priorityLevel`, `assignedAnalystId`, `slaBreached`, `limit`, `offset` | None | `QCReviewQueueItem[]` |
| **Statistics** | GET | None | None | None | `QueueStatistics` |
| **Assign Review** | POST | None | None | `queueItemId`, `analystId`, `notes?` | Assigned item details |
| **Auto-Assign** | POST | None | None | None | `{ assignedCount }` |
| **Get Next Review** | GET | `analystId` | None | None | `QCReviewQueueItem` or `null` |
| **Analyst Workloads** | GET | None | None | None | `AnalystWorkload[]` |

---

## Complete TypeScript Interfaces

```typescript
// Main queue item interface
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

// Queue statistics
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

// Analyst workload
interface AnalystWorkload {
  analystId: string;
  analystName: string;
  activeReviews: number;
  capacity: number;
  utilizationPercent: number;
  averageReviewTime: number;
}

// Request bodies
interface AssignReviewRequest {
  queueItemId: string;
  analystId: string;
  notes?: string;
}

// Standard response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## Frontend Integration Examples

### React Hook Example
```typescript
import { useState, useEffect } from 'react';

// Fetch queue items with filters
const useQueueItems = (filters = {}) => {
  const [items, setItems] = useState<QCReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      const params = new URLSearchParams({
        status: filters.status || '',
        priorityLevel: filters.priorityLevel || '',
        limit: '50',
        offset: '0'
      });

      const response = await fetch(`/api/qc-workflow/queue?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setItems(result.data);
      }
      setLoading(false);
    };

    fetchQueue();
  }, [filters]);

  return { items, loading };
};

// Assign review
const assignReview = async (queueItemId: string, analystId: string) => {
  const response = await fetch('/api/qc-workflow/queue/assign', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ queueItemId, analystId })
  });

  return response.json();
};
```

### Vue.js Example
```javascript
// In your component
export default {
  data() {
    return {
      statistics: null,
      analysts: []
    };
  },
  
  async mounted() {
    await this.loadStatistics();
    await this.loadAnalysts();
  },
  
  methods: {
    async loadStatistics() {
      const response = await this.$http.get('/api/qc-workflow/queue/statistics', {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      });
      
      if (response.data.success) {
        this.statistics = response.data.data;
      }
    },
    
    async loadAnalysts() {
      const response = await this.$http.get('/api/qc-workflow/analysts/workload', {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      });
      
      if (response.data.success) {
        this.analysts = response.data.data;
      }
    },
    
    async autoAssign() {
      const response = await this.$http.post('/api/qc-workflow/queue/auto-assign', {}, {
        headers: {
          'Authorization': `Bearer ${this.$store.state.authToken}`
        }
      });
      
      if (response.data.success) {
        this.$notify.success(`Auto-assigned ${response.data.data.assignedCount} reviews`);
        await this.loadStatistics();
      }
    }
  }
};
```

### Angular Service Example
```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QCQueueService {
  private baseUrl = '/api/qc-workflow';

  constructor(private http: HttpClient) {}

  getQueue(filters?: any): Observable<ApiResponse<QCReviewQueueItem[]>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priorityLevel) params = params.set('priorityLevel', filters.priorityLevel);
    
    return this.http.get<ApiResponse<QCReviewQueueItem[]>>(
      `${this.baseUrl}/queue`,
      { params }
    );
  }

  getStatistics(): Observable<ApiResponse<QueueStatistics>> {
    return this.http.get<ApiResponse<QueueStatistics>>(
      `${this.baseUrl}/queue/statistics`
    );
  }

  assignReview(queueItemId: string, analystId: string, notes?: string) {
    return this.http.post(`${this.baseUrl}/queue/assign`, {
      queueItemId,
      analystId,
      notes
    });
  }

  autoAssign() {
    return this.http.post(`${this.baseUrl}/queue/auto-assign`, {});
  }

  getNextReview(analystId: string): Observable<ApiResponse<QCReviewQueueItem>> {
    return this.http.get<ApiResponse<QCReviewQueueItem>>(
      `${this.baseUrl}/queue/next/${analystId}`
    );
  }

  getAnalystWorkloads(): Observable<ApiResponse<AnalystWorkload[]>> {
    return this.http.get<ApiResponse<AnalystWorkload[]>>(
      `${this.baseUrl}/analysts/workload`
    );
  }
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Validation Error Response
```json
{
  "success": false,
  "errors": [
    {
      "field": "queueItemId",
      "message": "Queue item ID is required"
    },
    {
      "field": "analystId",
      "message": "Analyst ID is required"
    }
  ]
}
```

### Common HTTP Status Codes
- **200 OK** - Successful request
- **400 Bad Request** - Validation errors
- **401 Unauthorized** - Missing or invalid authentication token
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

---

## Testing

### Sample Data
See `data/sample-qc-reviews.json` for example queue items.

### Test Authentication
If `BYPASS_AUTH=true` is set in environment:
```
Authorization: Bearer test-token-analyst-001
```

---

## Support

For questions or issues:
- Check authentication token validity
- Verify request body matches documented schemas
- Review error responses for validation failures
- Contact backend team for assistance

---

**Document Version:** 1.0  
**Last Updated:** February 9, 2026
