# Test Data Reference for Frontend Development

**Database:** `appraisal-management` (Cosmos DB)  
**Tenant ID:** `test-tenant-123`  
**Last Seeded:** February 12, 2026

## Authentication

Use this JWT token for API testing (valid 24 hours):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZXN0LXRlbmFudCIsImlzVGVzdFRva2VuIjp0cnVlLCJpc3MiOiJhcHByYWlzYWwtbWFuYWdlbWVudC10ZXN0IiwiYXVkIjoiYXBwcmFpc2FsLW1hbmFnZW1lbnQtYXBpIiwiaWF0IjoxNzcwOTI3MTUwLCJleHAiOjE3NzEwMTM1NTB9.fm_RuE9vafsicLNkS8wm5t7QqTcQIabxbjoLYYd9w_U
```

**Header:** `Authorization: Bearer <token>`

---

## Vendors (5 total)

### vendor-001: Premier Appraisal Group

**GET /api/vendors/vendor-001**
```json
{
  "id": "vendor-001",
  "type": "vendor",
  "tenantId": "test-tenant-123",
  "companyName": "Premier Appraisal Group",
  "contactName": "John Smith",
  "contactEmail": "john@premierappraisal.com",
  "contactPhone": "+12145551001",
  "specialties": ["residential", "commercial"],
  "serviceArea": ["Dallas", "Fort Worth", "Plano"],
  "rating": 4.8,
  "completedOrders": 247,
  "averageResponseTime": "2.3 hours",
  "status": "active",
  "availability": "available",
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

### vendor-002: Lone Star Valuations

```json
{
  "id": "vendor-002",
  "type": "vendor",
  "tenantId": "test-tenant-123",
  "companyName": "Lone Star Valuations",
  "contactName": "Maria Garcia",
  "contactEmail": "maria@lonestarvalue.com",
  "contactPhone": "+12145551002",
  "specialties": ["residential", "condo"],
  "serviceArea": ["Dallas", "Richardson", "Garland"],
  "rating": 4.9,
  "completedOrders": 312,
  "averageResponseTime": "1.8 hours",
  "status": "active",
  "availability": "available",
  "createdAt": "2023-06-20T00:00:00.000Z"
}
```

### vendor-003: Texas Property Experts

```json
{
  "id": "vendor-003",
  "type": "vendor",
  "tenantId": "test-tenant-123",
  "companyName": "Texas Property Experts",
  "contactName": "David Johnson",
  "contactEmail": "david@texasproperty.com",
  "contactPhone": "+12145551003",
  "specialties": ["commercial", "industrial"],
  "serviceArea": ["Dallas", "Irving", "Carrollton"],
  "rating": 4.6,
  "completedOrders": 189,
  "averageResponseTime": "3.1 hours",
  "status": "active",
  "availability": "busy",
  "createdAt": "2024-03-10T00:00:00.000Z"
}
```

### vendor-004: Rapid Appraisal Services

```json
{
  "id": "vendor-004",
  "type": "vendor",
  "tenantId": "test-tenant-123",
  "companyName": "Rapid Appraisal Services",
  "contactName": "Sarah Williams",
  "contactEmail": "sarah@rapidappraisal.com",
  "contactPhone": "+12145551004",
  "specialties": ["residential", "fha"],
  "serviceArea": ["Dallas", "Mesquite", "Rockwall"],
  "rating": 4.7,
  "completedOrders": 156,
  "averageResponseTime": "2.0 hours",
  "status": "active",
  "availability": "available",
  "createdAt": "2024-05-22T00:00:00.000Z"
}
```

### vendor-005: Heritage Valuation Co

```json
{
  "id": "vendor-005",
  "type": "vendor",
  "tenantId": "test-tenant-123",
  "companyName": "Heritage Valuation Co",
  "contactName": "Robert Lee",
  "contactEmail": "robert@heritagevalue.com",
  "contactPhone": "+12145551005",
  "specialties": ["residential", "luxury"],
  "serviceArea": ["Highland Park", "University Park", "Preston Hollow"],
  "rating": 4.9,
  "completedOrders": 98,
  "averageResponseTime": "1.5 hours",
  "status": "active",
  "availability": "available",
  "createdAt": "2025-01-08T00:00:00.000Z"
}
```

---

## Orders (7 total - covering full workflow)

### order-001: ⚠️ TIMEOUT SCENARIO

**GET /api/orders/order-001**
```json
{
  "id": "order-001",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-001",
  "clientId": "client-001",
  "clientName": "First National Bank",
  "status": "vendor_assigned",
  "propertyAddress": "123 Main St, Dallas, TX 75201",
  "propertyType": "Single Family",
  "loanAmount": 325000,
  "appraisalType": "Full Appraisal",
  "dueDate": "2026-02-19T20:17:00.000Z",
  "priority": "normal",
  "vendorAssignment": {
    "vendorId": "vendor-001",
    "assignedAt": "2026-02-12T15:17:00.000Z",
    "assignedBy": "test-user-admin",
    "status": "pending"
  },
  "createdAt": "2026-02-12T14:17:00.000Z",
  "updatedAt": "2026-02-12T15:17:00.000Z"
}
```

### order-002: ✅ INSPECTION SCHEDULED

**GET /api/orders/order-002**
```json
{
  "id": "order-002",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-002",
  "clientId": "client-002",
  "clientName": "Wells Fargo",
  "status": "inspection_scheduled",
  "propertyAddress": "456 Oak Ave, Plano, TX 75074",
  "propertyType": "Townhouse",
  "loanAmount": 280000,
  "appraisalType": "Full Appraisal",
  "dueDate": "2026-02-17T20:17:00.000Z",
  "priority": "normal",
  "vendorAssignment": {
    "vendorId": "vendor-002",
    "assignedAt": "2026-02-10T20:17:00.000Z",
    "acceptedAt": "2026-02-10T23:57:00.000Z",
    "assignedBy": "test-user-admin",
    "status": "accepted"
  },
  "inspectionDate": "2026-02-13T20:17:00.000Z",
  "createdAt": "2026-02-09T20:17:00.000Z",
  "updatedAt": "2026-02-10T23:57:00.000Z"
}
```

### order-003: 🔄 IN PROGRESS

**GET /api/orders/order-003**
```json
{
  "id": "order-003",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-003",
  "clientId": "client-001",
  "clientName": "First National Bank",
  "status": "in_progress",
  "propertyAddress": "789 Elm St, Richardson, TX 75080",
  "propertyType": "Single Family",
  "loanAmount": 415000,
  "appraisalType": "Full Appraisal",
  "dueDate": "2026-02-15T20:17:00.000Z",
  "priority": "high",
  "vendorAssignment": {
    "vendorId": "vendor-002",
    "assignedAt": "2026-02-07T20:17:00.000Z",
    "acceptedAt": "2026-02-07T22:37:00.000Z",
    "assignedBy": "test-user-admin",
    "status": "accepted"
  },
  "inspectionDate": "2026-02-10T20:17:00.000Z",
  "inspectionCompleted": true,
  "reportProgress": 65,
  "createdAt": "2026-02-06T20:17:00.000Z",
  "updatedAt": "2026-02-12T19:17:00.000Z"
}
```

### order-004: 📋 QC REVIEW

**GET /api/orders/order-004**
```json
{
  "id": "order-004",
  "type": "order",Assignment

**GET /api/communications/history/order-002** (returns array with this item)
```json
{
  "id": "comm-001",
  "type": "communication",
  "tenantId": "test-tenant-123",
  "orderId": "order-002",
  "orderNumber": "APR-2026-002",
  "channel": "email",
  "direction": "outbound",
  "status": "delivered",
  "to": "maria@lonestarvalue.com",
  "subject": "New Appraisal Assignment - APR-2026-002",
  "body": "<html>You have been assigned a new appraisal order...</html>",
  "sentAt": "2026-02-10T20:17:00.000Z",
  "createdAt": "2026-02-10T20:17:00.000Z"
}
```

### comm-002: SMS Assignment

```json
{
  "id": "comm-002",
  "type": "communication",
  "tenantId": "test-tenant-123",
  "orderId": "order-002",
  "orderNumber": "APR-2026-002",
  "channel": "sms",
  "direction": "outbound",
  "status": "delivered",
  "to": "+12145551002",
  "body": "New order APR-2026-002 assigned. Please accept within 4 hours.",
  "sentAt": "2026-02-10T20:17:00.000Z",
  "createdAt": "2026-02-10T20:17:00.000Z"
}
```

### comm-003: SMS Reminder

```json
{
  "id": "comm-003",
  "type": "communication",
  "tenantId": "test-tenant-123",
  "orderId": "order-003",
  "orderNumber": "APR-2026-003",
  "channel": "sms",
  "direction": "outbound",
  "status": "delivered",
  "to": "+12145551002",
  "body": "Reminder: Inspection for APR-2026-003 scheduled tomorrow at 10:00 AM",
  "sentAt": "2026-02-09T20:17:00.000Z",
  "createdAt": "2026-02-09T20:17:00.000Z"
}
```

**POST /api/communications/email** - Send new email
```json
{
  "orderId": "order-001",
  "to": "john@premierappraisal.com",
  "subject": "Order Assignment Reminder",
  "body": "<html><p>Please accept or decline order APR-2026-001</p></html>"
}
```

**POST /api/communications/sms** - Send new SMS
```json
{
  "orderId": "order-001",
  "to": "+12145551001",
  "body": "Reminder: Order APR-2026-001 expires in 1 hour"
}
```2-12T16:17:00.000Z"
}
```

### order-005: ✅ COMPLETED

**GET /api/orders/order-005**
```json
{
  "id": "order-005",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-005",
  "clientId": "client-002",
  "clientName": "Wells Fargo",
  "status": "completed",
  "propertyAddress": "555 Cedar Ln, Frisco, TX 75034",
  "propertyType": "Single Family",
  "loanAmount": 625000,
  "appraisalType": "Full Appraisal",
  "dueDate": "2026-02-11T20:17:00.000Z",
  "priority": "normal",
  "vendorAssignment": {
    "vendorId": "vendor-005",
    "assignedAt": "2026-01-28T20:17:00.000Z",
    "acceptedAt": "2026-01-28T22:37:00.000Z",
    "assignedBy": "test-user-admin",
    "status": "accepted"
  },
  "reportSubmittedAt": "2026-02-09T20:17:00.000Z",
  "reportUrl": "blob://reports/order-005-report.pdf",
  "qcApprovedAt": "2026-02-10T20:17:00.000Z",
  "qcApprovedBy": "test-user-qc",
  "deliveredAt": "2026-02-11T08:17:00.000Z",
  "finalValue": 625000,
  "createdAt": "2026-01-28T20:17:00.000Z",
  "updatedAt": "2026-02-11T08:17:00.000Z"
}
```

### order-006: 🆕 UNASSIGNED

**GET /api/orders/order-006**
```json
{
  "id": "order-006",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-006",
  "clientId": "client-001",
  "clientName": "First National Bank",
  "status": "unassigned",
  "propertyAddress": "888 Maple Dr, McKinney, TX 75070",
  "propertyType": "Single Family",
  "loanAmount": 475000,
  "appraisalType": "Full Appraisal",
  "dueDate": "2026-02-22T20:17:00.000Z",
  "priority": "normal",
  "createdAt": "2026-02-12T18:17:00.000Z",
  "updatedAt": "2026-02-12T18:17:00.000Z"
}
```

### order-007: 🔴 NEEDS REASSIGNMENT

**GET /api/orders/order-007**
```json
{
  "id": "order-007",
  "type": "order",
  "tenantId": "test-tenant-123",
  "orderNumber": "APR-2026-007",
  "clientId": "client-003",
  "clientName": "Chase Bank",
  "status": "unassigned",
  "propertyAddress": "2order-005

**Query:** Filter orders by `type='qc_review'` OR specific endpoint
```json
{
  "id": "qc-001",
  "type": "qc_review",
  "tenantId": "test-tenant-123",
  "orderId": "order-005",
  "orderNumber": "APR-2026-005",
  "reviewedBy": "test-user-qc",
  "reviewedAt": "2026-02-10T20:17:00.000Z",
  "status": "approved",
  "overallScore": 95,
  "categories": {
    "dataAccuracy": {
      "score": 98,
      "issues": []
    },
    "marketAnalysis": {
      "score": 94,
      "issues": []
    },
    "photoQuality": {
      "score": 96,
      "issues": []
    },
    "compliance": {
      "score": 92,
      "issues": ["Minor formatting issue in addendum"]
    }
  },
  "comments": "Excellent work. Minor formatting issue noted but does not impact report quality.",
  "createdAt": "2026-02-10T20:17:00.000Z"
}
```
      "timeoutAt": "2026-02-12T19:17:00.000Z",
      "reason": "timeout",
      "attemptNumber": 1
    }
  ],
  "createdAt": "2026-02-12T06:17:00.000Z",
  "updatedAt": "2026-02-12T19:17:00.000Z"
}
```

---

## Communications (3 messages)

### comm-001: Email to vendor-002
- **Order:** APR-2026-002
- **Channel:** Email
- **To:** maria@lonestarvalue.com
- **Subject:** "New Appraisal Assignment - APR-2026-002"
- **Status:** Delivered
- **Sent:** 2 days ago

### comm-002: SMS to vendor-002
- **Order:** APR-2026-002
- **Channel:** SMS
- **To:** +12145551002
- **Body:** "New order APR-2026-002 assigned. Please accept within 4 hours."
- **Status:** Delivered
- **Sent:** 2 days ago

### comm-003: SMS reminder to vendor-002
- **Order:** APR-2026-003
- **Channel:** SMS
- **To:** +12145551002
- **Body:** "Reminder: Inspection for APR-2026-003 scheduled tomorrow at 10:00 AM"
- **Status:** Delivered
- **Sent:** 3 days ago

---

## QC Reviews (1 review)

### qc-001: Review for APR-2026-005
- **Order:** APR-2026-005 (Completed)
- **Reviewed By:** test-user-qc
- **Reviewed At:** 2 days ago
- **Status:** Approved
- **Overall Score:** 95/100
- **Category Scores:**
  - Data Accuracy: 98
  - Market Analysis: 94
  - Photo Quality: 96
  - Compliance: 92 (minor formatting issue noted)
- **Comments:** "Excellent work. Minor formatting issue noted but does not impact report quality."

---

## Appraisers (5 appraisers - Phase 4.3)

### appraiser-001: Sarah Mitchell
```json
{
  "id": "appraiser-001",
  "type": "appraiser",
  "tenantId": "test-tenant-123",
  "firstName": "Sarah",
  "lastName": "Mitchell",
  "email": "sarah.mitchell@example.com",
  "phone": "+1-512-555-0101",
  "licenses": [
    {
      "id": "lic-001",
      "type": "certified_residential",
      "state": "TX",
      "licenseNumber": "TX-CR-123456",
      "issuedDate": "2020-01-15",
      "expirationDate": "2025-01-15",
      "status": "active",
      "verificationUrl": "https://www.talcb.texas.gov/lookup"
    }
  ],
  "certifications": [
    {
      "id": "cert-001",
      "name": "FHA Roster Certification",
      "issuingOrganization": "HUD",
      "issuedDate": "2021-06-01",
      "expirationDate": "2026-06-01"
    }
  ],
  "specialties": ["residential", "fha", "va"],
  "serviceArea": {
    "states": ["TX"],
    "counties": ["Travis", "Williamson", "Hays"],
    "cities": ["Austin", "Round Rock", "Georgetown", "Kyle"],
    "radiusMiles": 50,
    "centerPoint": { "lat": 30.2672, "lng": -97.7431 }
  },
  "yearsOfExperience": 8,
  "employmentStatus": "staff",
  "rating": 4.8,
  "completedAppraisals": 287,
  "averageTurnaroundTime": "4.2 days",
  "qcPassRate": 96.5,
  "status": "active",
  "availability": "available",
  "currentWorkload": 3,
  "maxCapacity": 10,
  "conflictProperties": []
}
```

### appraiser-002: Michael Chen
- **Location:** Dallas, TX (Multi-state: TX, OK)
- **Licenses:** Certified General (TX, OK)
- **Specialties:** Residential, Commercial, Multi-family
- **Experience:** 12 years
- **Rating:** 4.9 ⭐
- **Completed:** 512 appraisals
- **Workload:** 5/15 (Available)
- **Service Area:** 100-mile radius from Dallas

### appraiser-003: Emily Rodriguez
- **Location:** Los Angeles, CA
- **License:** Certified Residential (CA) **expires Feb 2025**
- **Specialties:** Residential, Luxury, Condo
- **Certifications:** Luxury Home Appraisal Specialist
- **Experience:** 6 years
- **Rating:** 4.7 ⭐
- **Completed:** 143 appraisals
- **Workload:** 2/8 (Available)
- **Conflict:** Owns property at "456 Ocean Ave, Malibu, CA" (10-mile radius)

### appraiser-004: David Thompson
- **Location:** Fort Worth, TX (Multi-state: TX, OK)
- **Licenses:** Certified General (TX, OK)
- **Specialties:** Commercial, Industrial, Agricultural
- **Experience:** 15 years
- **Rating:** 4.9 ⭐
- **Completed:** 678 appraisals
- **Workload:** 12/12 (**Busy - At Capacity**)
- **Service Area:** 120-mile radius

### appraiser-005: Lisa Anderson
- **Location:** Houston, TX
- **License:** Certified Residential (TX)
- **Specialties:** Residential, FHA, VA, Multi-family
- **Certifications:** FHA Roster, VA Fee Panel
- **Experience:** 9 years
- **Rating:** 4.8 ⭐
- **Completed:** 394 appraisals
- **Workload:** 4/10 (Available)

**Test Scenarios:**
- **Available Residential:** appraiser-001, appraiser-002, appraiser-003, appraiser-005
- **Available Commercial:** appraiser-002 only (appraiser-004 at capacity)
- **FHA/VA Specialists:** appraiser-001, appraiser-005
- **Expiring License:** appraiser-003 (expires Feb 2025 - within 30 days from late Jan)
- **Conflict Check:** appraiser-003 has ownership conflict in Malibu

---

## Frontend Feature Support

### ✅ Vendor Acceptance Queue (`/vendor-engagement/acceptance`)

**Backend Endpoints:**
- `POST /api/negotiations/accept` - Vendor accepts order
- `POST /api/negotiations/reject` - Vendor declines order
- `GET /api/orders?status=vendor_assigned` - Get pending assignments

**Accept Order:**
```json
POST /api/negotiations/accept
{
  "orderId": "order-001",
  "vendorId": "vendor-001"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order-001",
    "status": "inspection_scheduled",
    "acceptedAt": "2026-02-12T20:30:00.000Z",
    "acceptedBy": "vendor-001"
  }
}
```

**Decline Order:**
```json
POST /api/negotiations/reject
{
  "orderId": "order-001",
  "vendorId": "vendor-001",
  "reason": "Schedule conflict - unavailable this week"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order-001",
    "status": "unassigned",
    "rejectedAt": "2026-02-12T20:30:00.000Z",
    "rejectedBy": "vendor-001",
    "rejectionReason": "Schedule conflict - unavailable this week"
  }
}
```

**Get Pending Assignments (4-hour SLA):**
```json
GET /api/orders?status=vendor_assigned&tenantId=test-tenant-123

Response:
{
  "orders": [
    {
      "id": "order-001",
      "orderNumber": "APR-2026-001",
      "status": "vendor_assigned",
      "vendorAssignment": {
        "vendorId": "vendor-001",
        "assignedAt": "2026-02-12T15:17:00.000Z",
        "status": "pending"
      },
      "slaRemaining": "3:45:00",
      "slaExpiresAt": "2026-02-12T19:17:00.000Z"
    }
  ]
}
```

**Test Data:**
- **order-001** - Assigned 5 hours ago (PAST 4-hour SLA) - will auto-timeout
- **order-007** - Previously timed out, needs reassignment

---

### ✅ Appraiser Assignment (`/vendor-engagement/assignment`)

**Backend Endpoints:**
- `POST /api/auto-assignment/assign` - Auto-assign vendor
- `GET /api/vendors` - Get all vendors with capacity
- `GET /api/vendors/{id}/performance` - Get vendor performance metrics

**Auto-Assign Order:**
```json
POST /api/auto-assignment/assign
{
  "orderId": "order-006",
  "criteria": {
    "proximity": true,
    "availability": true,
    "rating": true
  }
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order-006",
    "assignedVendorId": "vendor-002",
    "assignedAt": "2026-02-12T20:30:00.000Z",
    "score": 92.5,
    "reasoning": {
      "proximityScore": 95,
      "availabilityScore": 100,
      "ratingScore": 98,
      "workloadScore": 85
    }
  }
}
```

**Get Vendors with Capacity:**
```json
GET /api/vendors?tenantId=test-tenant-123&includeCapacity=true

Response:
{
  "vendors": [
    {
      "id": "vendor-002",
      "companyName": "Lone Star Valuations",
      "rating": 4.9,
      "availability": "available",
      "currentWorkload": 2,
      "capacity": 5,
      "capacityPercent": 40,
      "averageResponseTime": "1.8 hours"
    },
    {
      "id": "vendor-001",
      "companyName": "Premier Appraisal Group",
      "rating": 4.8,
      "availability": "available",
      "currentWorkload": 1,
      "capacity": 5,
      "capacityPercent": 20,
      "averageResponseTime": "2.3 hours"
    }
  ]
}
```

**Test Data:**
- **vendor-002** - Has 2 active orders (APR-2026-002, APR-2026-003)
- **vendor-001** - Has 1 pending order (APR-2026-001)
- **order-006** - Unassigned, ready for auto-assignment

---

### ✅ QC Pages Enhanced

**Backend Endpoints:**
- `GET /api/orders?status=qc_review` - Get orders awaiting QC
- `POST /api/qc/reviews` - Submit QC review
- `GET /api/qc/metrics` - Get QC statistics

**Get QC Queue:**
```json
GET /api/orders?status=qc_review&tenantId=test-tenant-123

Response:
{
  "orders": [
    {
      "id": "order-004",
      "orderNumber": "APR-2026-004",
      "status": "qc_review",
      "propertyAddress": "321 Pine St, Garland, TX 75040",
      "vendorId": "vendor-004",
      "vendorName": "Rapid Appraisal Services",
      "reportSubmittedAt": "2026-02-12T16:17:00.000Z",
      "reportUrl": "blob://reports/order-004-report.pdf",
      "dueDate": "2026-02-14T20:17:00.000Z",
      "priority": "normal",
      "queueTime": "4 hours",
      "loanAmount": 195000
    }
  ],
  "stats": {
    "totalInQueue": 1,
    "averageQueueTime": "4 hours",
    "completedToday": 3,
    "approvalRate": 94.2
  }
}
```

**Submit QC Review:**
```json
POST /api/qc/reviews
{
  "orderId": "order-004",
  "reviewedBy": "test-user-qc",
  "status": "approved",
  "overallScore": 92,
  "categories": {
    "dataAccuracy": { "score": 95, "issues": [] },
    "marketAnalysis": { "score": 90, "issues": ["Comparable #3 may be too old"] },
    "photoQuality": { "score": 88, "issues": [] },
    "compliance": { "score": 95, "issues": [] }
  },
  "comments": "Good report overall. Minor concern with comparable age."
}

Response:
{
  "success": true,
  "data": {
    "reviewId": "qc-002",
    "orderId": "order-004",
    "status": "approved",
    "overallScore": 92
  }
}
```

**Test Data:**
- **order-004** - Currently in QC review (submitted 4 hours ago)
- **order-005** - Completed QC with review (qc-001)

---

### ✅ ROV (Reconsideration of Value) Detail Page (`/rov/:id`)

**Backend Endpoints:**
- `GET /api/rov` - Get all ROV requests
- `GET /api/rov/{id}` - Get specific ROV request
- `POST /api/rov/{id}/approve` - Approve ROV
- `POST /api/rov/{id}/reject` - Reject ROV
- `POST /api/rov/{id}/comments` - Add comment to ROV

**Get ROV Request:**
```json
GET /api/rov/rov-001

Response:
{
  "id": "rov-001",
  "type": "rov_request",
  "tenantId": "test-tenant-123",
  "orderId": "order-005",
  "orderNumber": "APR-2026-005",
  "requestedBy": "client-002",
  "requestedByName": "Wells Fargo",
  "requestedAt": "2026-02-11T10:00:00.000Z",
  "status": "pending",
  "originalValue": 625000,
  "requestedValue": 650000,
  "reason": "Borrower provided additional comparable sales data",
  "supportingDocuments": [
    "blob://rov/rov-001-comparable-1.pdf",
    "blob://rov/rov-001-comparable-2.pdf"
  ],
  "comparableSales": [
    {
      "address": "560 Cedar Ln, Frisco, TX",
      "saleDate": "2026-01-15",
      "salePrice": 645000,
      "sqft": 2800,
      "distance": "0.2 miles"
    },
    {
      "address": "570 Cedar Ln, Frisco, TX",
      "saleDate": "2026-01-20",
      "salePrice": 655000,
      "sqft": 2850,
      "distance": "0.3 miles"
    }
  ],
  "timeline": [
    {
      "timestamp": "2026-02-11T10:00:00.000Z",
      "event": "rov_requested",
      "user": "client-002",
      "details": "Client submitted ROV with 2 additional comparables"
    },
    {
      "timestamp": "2026-02-11T10:05:00.000Z",
      "event": "rov_assigned",
      "user": "system",
      "details": "ROV assigned to senior appraiser for review"
    }
  ]
}
```

**Approve ROV:**
```json
POST /api/rov/rov-001/approve
{
  "approvedBy": "test-user-admin",
  "revisedValue": 640000,
  "justification": "After reviewing additional comparables, adjusted value to $640,000. Comparables provided are valid and support higher valuation within reasonable range."
}

Response:
{
  "success": true,
  "data": {
    "rovId": "rov-001",
    "status": "approved",
    "revisedValue": 640000,
    "approvedAt": "2026-02-12T20:30:00.000Z",
    "approvedBy": "test-user-admin"
  }
}
```

**Reject ROV:**
```json
POST /api/rov/rov-001/reject
{
  "rejectedBy": "test-user-admin",
  "justification": "Additional comparables are outside acceptable distance range (>0.5 miles). Original valuation stands based on more appropriate comparables."
}

Response:
{
  "success": true,
  "data": {
    "rovId": "rov-001",
    "status": "rejected",
    "rejectedAt": "2026-02-12T20:30:00.000Z",
    "rejectedBy": "test-user-admin"
  }
}
```

**Test Data:**
Need to seed ROV data - currently no ROV requests in database.

---

## API Endpoints to Query Data

### Get All Vendors
```
GET /api/vendors?tenantId=test-tenant-123
```

### Get All Orders
```
GET /api/orders?tenantId=test-tenant-123
```

### Get Specific Order
```
GET /api/orders/order-001?tenantId=test-tenant-123
```

### Get Order Communications
```
GET /api/communications/history/order-002
```

### Get Vendor Performance
```
GET /api/vendors/vendor-002/performance
```

### Get Orders by Status
```
GET /api/orders?status=vendor_assigned&tenantId=test-tenant-123
GET /api/orders?status=in_progress&tenantId=test-tenant-123
GET /api/orders?status=qc_review&tenantId=test-tenant-123
```

---

## Workflow States to Test

### 1. New Order Assignment Flow
- Start with: `order-006` (unassigned)
- Assign to vendor → test acceptance/timeout

### 2. Active Order Management
- View: `order-002` (inspection scheduled)
- View: `order-003` (in progress)

### 3. QC Review Flow
- Review: `order-004` (awaiting QC)

### 4. Completed Orders
- View history: `order-005` (full lifecycle)

### 5. Timeout/Reassignment
- Monitor: `order-001` (will timeout automatically)
- Reassign: `order-007` (already timed out once)

### 6. Vendor Performance
- Best performer: `vendor-005` (1.5h response, 4.9 rating)
- Most orders: `vendor-002` (312 completed)
- Needs attention: `vendor-003` (timed out recently)

---

## Background Jobs Running

### Vendor Timeout Checker
- **Runs:** Every 5 minutes
- **Timeout Threshold:** 4 hours
- **Currently Watching:** order-001 (will trigger soon)
- **Action:** Auto-marks for reassignment, sends notifications

---

## Notes for Frontend Devs

1. **Real Data:** All IDs are real and queryable from Cosmos DB
2. **Live Updates:** order-001 will timeout automatically within minutes of server start
3. **Communications:** Stored in `orders` container with `type='communication'`
4. **QC Reviews:** Stored in `orders` container with `type='qc_review'`
5. **Partition Key:** All queries need `tenantId=test-tenant-123`
6. **Phone Numbers:** Use +1214555100X format for testing
7. **Report URLs:** Blob storage paths (implement upload separately)

---

## Quick Test Scenarios

### Scenario 1: Watch Timeout in Real-Time
1. Query `order-001` - status should be `vendor_assigned`
2. Wait 5-10 minutes
3. Query again - status should change to `unassigned`
4. Check `reassignmentRequired=true` and `reassignmentReason`

### Scenario 2: View Active Pipeline
```
GET /api/orders?status=in_progress
GET /api/orders?status=inspection_scheduled
```
Should return orders 002 and 003

### Scenario 3: QC Workflow
```
GET /api/orders?status=qc_review
```
Returns order-004, then simulate QC approval

### Scenario 4: Vendor Dashboard
```
GET /api/vendors/vendor-002
GET /api/orders?vendorId=vendor-002
```
Shows vendor with 2 active orders

---

**Questions?** All data is in Cosmos DB under `appraisal-management` database, `test-tenant-123` tenant.
