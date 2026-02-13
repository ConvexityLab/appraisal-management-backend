# COMPLETE API ENDPOINT REFERENCE + TEST DATA

**Base URL:** `http://localhost:3001`  
**Auth Header:** `Authorization: Bearer <JWT_TOKEN>`  
**Tenant ID:** `test-tenant-123`

---

## 🔐 AUTHENTICATION ENDPOINTS

### Test Token (Use This)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ0ZXN0LXRlbmFudCIsImlzVGVzdFRva2VuIjp0cnVlLCJpc3MiOiJhcHByYWlzYWwtbWFuYWdlbWVudC10ZXN0IiwiYXVkIjoiYXBwcmFpc2FsLW1hbmFnZW1lbnQtYXBpIiwiaWF0IjoxNzcwOTI3MTUwLCJleHAiOjE3NzEwMTM1NTB9.fm_RuE9vafsicLNkS8wm5t7QqTcQIabxbjoLYYd9w_U
```

---

## 📋 CORE ORDER MANAGEMENT

### GET /api/orders
Get all orders (with filters)

**Query Params:**
- `tenantId=test-tenant-123` (required)
- `status=vendor_assigned|inspection_scheduled|in_progress|qc_review|completed|unassigned`
- `vendorId=vendor-001`
- `clientId=client-001`

**Response:** Array of order objects (see TEST_DATA_REFERENCE.md)

**Test Data IDs:**
- `order-001` - vendor_assigned (will timeout)
- `order-002` - inspection_scheduled
- `order-003` - in_progress
- `order-004` - qc_review
- `order-005` - completed
- `order-006` - unassigned
- `order-007` - unassigned (needs reassignment)

---

## 🏢 VENDOR MANAGEMENT

### GET /api/vendors
Get all vendors

### GET /api/vendors/{id}
Get specific vendor

### POST /api/vendors
Create new vendor

### PUT /api/vendors/{id}
Update vendor

**Test Data IDs:**
- `vendor-001` - Premier Appraisal Group
- `vendor-002` - Lone Star Valuations (top performer)
- `vendor-003` - Texas Property Experts
- `vendor-004` - Rapid Appraisal Services
- `vendor-005` - Heritage Valuation Co

---

## � APPRAISER MANAGEMENT (Phase 4.3)

### GET /api/appraisers
Get all appraisers

**Query Params:**
- `tenantId=test-tenant-123` (automatic from auth)

**Response:**
```json
{
  "success": true,
  "data": [
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
          "status": "active"
        }
      ],
      "specialties": ["residential", "fha", "va"],
      "rating": 4.8,
      "currentWorkload": 3,
      "maxCapacity": 10,
      "status": "active",
      "availability": "available"
    }
  ],
  "count": 5
}
```

**Test Data IDs:**
- `appraiser-001` - Sarah Mitchell (certified residential, TX)
- `appraiser-002` - Michael Chen (certified general, multi-state)
- `appraiser-003` - Emily Rodriguez (luxury specialist, CA)
- `appraiser-004` - David Thompson (commercial, TX/OK)
- `appraiser-005` - Lisa Anderson (FHA/VA specialist, TX)

### GET /api/appraisers/available?specialty=residential
Get available appraisers with capacity

**Query Params:**
- `specialty` (optional) - Filter by specialty (residential, commercial, luxury, fha, va, etc.)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "appraiser-001",
      "firstName": "Sarah",
      "lastName": "Mitchell",
      "currentWorkload": 3,
      "maxCapacity": 10,
      "availability": "available"
    }
  ],
  "count": 3,
  "filters": { "specialty": "residential" }
}
```

### GET /api/appraisers/:id
Get specific appraiser details

**Request:**
```
GET /api/appraisers/appraiser-001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "appraiser-001",
    "type": "appraiser",
    "firstName": "Sarah",
    "lastName": "Mitchell",
    "email": "sarah.mitchell@example.com",
    "phone": "+1-512-555-0101",
    "licenses": [...],
    "certifications": [...],
    "specialties": ["residential", "fha", "va"],
    "serviceArea": {
      "states": ["TX"],
      "counties": ["Travis", "Williamson", "Hays"],
      "radiusMiles": 50
    },
    "rating": 4.8,
    "completedAppraisals": 287,
    "averageTurnaroundTime": "4.2 days",
    "qcPassRate": 96.5,
    "currentWorkload": 3,
    "maxCapacity": 10,
    "status": "active",
    "availability": "available"
  }
}
```

### POST /api/appraisers
Create new appraiser

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com",
  "phone": "+1-512-555-9999",
  "licenses": [
    {
      "id": "lic-new",
      "type": "certified_residential",
      "state": "TX",
      "licenseNumber": "TX-CR-999999",
      "issuedDate": "2023-06-01",
      "expirationDate": "2025-06-01",
      "status": "active"
    }
  ],
  "specialties": ["residential", "condo"],
  "serviceArea": {
    "states": ["TX"],
    "counties": ["Travis"],
    "radiusMiles": 30
  },
  "yearsOfExperience": 5,
  "employmentStatus": "contract",
  "rating": 0,
  "completedAppraisals": 0,
  "averageTurnaroundTime": "0 days",
  "qcPassRate": 0,
  "currentWorkload": 0,
  "maxCapacity": 8,
  "status": "active",
  "availability": "available",
  "conflictProperties": []
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "appraiser-006",
    "type": "appraiser",
    "tenantId": "test-tenant-123",
    "firstName": "John",
    "lastName": "Smith",
    "createdAt": "2025-01-13T10:30:00.000Z",
    "updatedAt": "2025-01-13T10:30:00.000Z"
  }
}
```

### PUT /api/appraisers/:id
Update appraiser details

**Request:**
```json
{
  "currentWorkload": 5,
  "availability": "busy"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "appraiser-001",
    "currentWorkload": 5,
    "availability": "busy",
    "updatedAt": "2025-01-13T11:15:00.000Z"
  }
}
```

### POST /api/appraisers/:id/assign
Assign appraiser to order

**Request:**
```json
{
  "orderId": "order-006",
  "propertyAddress": "123 Main St, Austin, TX 78701",
  "propertyLat": 30.2672,
  "propertyLng": -97.7431
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "assignment-001",
    "type": "appraiser_assignment",
    "tenantId": "test-tenant-123",
    "orderId": "order-006",
    "appraiserId": "appraiser-001",
    "assignedAt": "2025-01-13T12:00:00.000Z",
    "assignedBy": "admin-user-001",
    "status": "pending",
    "propertyAddress": "123 Main St, Austin, TX 78701",
    "propertyLat": 30.2672,
    "propertyLng": -97.7431,
    "createdAt": "2025-01-13T12:00:00.000Z"
  }
}
```

**Error (Conflict Detected):**
```json
{
  "success": false,
  "error": "Cannot assign appraiser due to conflict: Property within 10 miles of conflict property"
}
```

### GET /api/appraisers/:id/conflicts?propertyAddress=...&propertyLat=...&propertyLng=...
Check for conflicts of interest

**Query Params:**
- `propertyAddress` (required) - Property address to check
- `propertyLat` (optional) - Property latitude for distance checking
- `propertyLng` (optional) - Property longitude for distance checking

**Request:**
```
GET /api/appraisers/appraiser-001/conflicts?propertyAddress=456 Oak Ave, Austin, TX&propertyLat=30.2672&propertyLng=-97.7431
```

**Response (No Conflict):**
```json
{
  "success": true,
  "data": {
    "hasConflict": false,
    "conflicts": []
  }
}
```

**Response (Conflict Detected):**
```json
{
  "success": true,
  "data": {
    "hasConflict": true,
    "conflicts": [
      {
        "type": "property_conflict",
        "reason": "Conflict: ownership",
        "conflictProperty": {
          "address": "456 Oak Ave, Austin, TX",
          "reason": "ownership",
          "radiusMiles": 10,
          "addedAt": "2024-06-15T10:00:00.000Z"
        }
      },
      {
        "type": "distance",
        "reason": "Property within 10 miles of conflict property",
        "distance": 2.5
      }
    ]
  }
}
```

### GET /api/appraisers/:id/licenses/expiring
Check for expiring licenses (within 30 days)

**Request:**
```
GET /api/appraisers/appraiser-003/licenses/expiring
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lic-003",
      "type": "certified_residential",
      "state": "CA",
      "licenseNumber": "CA-CR-789012",
      "issuedDate": "2023-02-01",
      "expirationDate": "2025-02-01",
      "status": "active"
    }
  ],
  "count": 1
}
```

---

#

##  INSPECTION SCHEDULING (Phase 4.4)

### GET /api/inspections
Get all inspections (optional status filter)

### GET /api/inspections/:id
Get specific inspection

### GET /api/inspections/order/:orderId
Get inspections for an order

### GET /api/inspections/appraiser/:appraiserId?status=scheduled
Get inspections for appraiser

### POST /api/inspections
Schedule new inspection

### PUT /api/inspections/:id/reschedule
Reschedule inspection

### PUT /api/inspections/:id/confirm
Confirm inspection

### PUT /api/inspections/:id/start
Start inspection

### PUT /api/inspections/:id/complete
Complete inspection

### PUT /api/inspections/:id/cancel
Cancel inspection

**Test IDs:** inspection-001 (scheduled), inspection-002 (confirmed), inspection-003 (completed), inspection-004 (in_progress), inspection-005 (cancelled)

---

## 📷 PHOTO UPLOAD & MANAGEMENT (Phase 4.5)

### POST /api/photos/upload
Upload photo for inspection (multipart/form-data)

**Form Fields:**
- `photo` (file) - Image file (JPEG, PNG, max 10MB)
- `inspectionId` (string) - Required
- `orderId` (string) - Required
- `category` (string) - Optional: exterior|interior|damage|amenity|other
- `caption` (string) - Optional description
- `sequenceNumber` (number) - Optional ordering

**Request (curl):**
```bash
curl -X POST http://localhost:3001/api/photos/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "photo=@/path/to/image.jpg" \
  -F "inspectionId=inspection-001" \
  -F "orderId=order-001" \
  -F "category=exterior" \
  -F "caption=Front of property" \
  -F "sequenceNumber=1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "photo-1707753600000-abc123",
    "type": "photo",
    "tenantId": "test-tenant-123",
    "inspectionId": "inspection-001",
    "orderId": "order-001",
    "blobUrl": "https://appraisalstorage.blob.core.windows.net/inspection-photos/inspections/inspection-001/photo-1707753600000-abc123-image.jpg",
    "blobName": "inspections/inspection-001/photo-1707753600000-abc123-image.jpg",
    "containerName": "inspection-photos",
    "fileName": "image.jpg",
    "fileSize": 245678,
    "mimeType": "image/jpeg",
    "category": "exterior",
    "caption": "Front of property",
    "sequenceNumber": 1,
    "uploadedBy": "test-user",
    "uploadedAt": "2026-02-12T15:30:00.000Z"
  }
}
```

### GET /api/photos/inspection/:inspectionId
Get all photos for an inspection

**Request:**
```
GET /api/photos/inspection/inspection-001
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "photo-001",
      "inspectionId": "inspection-001",
      "orderId": "order-001",
      "blobUrl": "https://...",
      "fileName": "front.jpg",
      "fileSize": 245678,
      "mimeType": "image/jpeg",
      "category": "exterior",
      "caption": "Front of property",
      "sequenceNumber": 1,
      "uploadedAt": "2026-02-12T15:30:00.000Z"
    },
    {
      "id": "photo-002",
      "inspectionId": "inspection-001",
      "orderId": "order-001",
      "blobUrl": "https://...",
      "fileName": "kitchen.jpg",
      "category": "interior",
      "sequenceNumber": 2
    }
  ],
  "count": 2,
  "inspectionId": "inspection-001"
}
```

### GET /api/photos/:id
Get specific photo metadata

**Request:**
```
GET /api/photos/photo-001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "photo-001",
    "inspectionId": "inspection-001",
    "orderId": "order-001",
    "blobUrl": "https://appraisalstorage.blob.core.windows.net/inspection-photos/inspections/inspection-001/photo-001-front.jpg",
    "fileName": "front.jpg",
    "fileSize": 245678,
    "mimeType": "image/jpeg",
    "category": "exterior",
    "uploadedBy": "test-user",
    "uploadedAt": "2026-02-12T15:30:00.000Z"
  }
}
```

### DELETE /api/photos/:id
Delete photo (removes from blob storage and database)

**Request:**
```
DELETE /api/photos/photo-001
```

**Response:**
```json
{
  "success": true,
  "message": "Photo deleted successfully"
}
```

**Notes:**
- Photos stored in Azure Blob Storage container `inspection-photos`
- Uses multer for multipart/form-data handling
- Max file size: 10MB
- Only image files accepted (image/*)
- BlobStorageService uses Managed Identity (no keys)

---

## 📊 VENDOR PERFORMANCE

### GET /api/vendor-performance/{vendorId}
Get vendor performance metrics

**Request:**
```
GET /api/vendor-performance/vendor-002
```

**Response:**
```json
{
  "vendorId": "vendor-002",
  "rating": 4.9,
  "completedOrders": 312,
  "averageResponseTime": "1.8 hours",
  "onTimeDeliveryRate": 96.5,
  "qcPassRate": 94.2,
  "recentOrders": [
    { "orderId": "order-002", "status": "inspection_scheduled" },
    { "orderId": "order-003", "status": "in_progress" }
  ]
}
```

---

## 🎯 AUTO-ASSIGNMENT

### POST /api/auto-assignment/assign
Auto-assign vendor to order

**Request:**
```json
{
  "orderId": "order-006",
  "criteria": {
    "proximity": true,
    "availability": true,
    "rating": true,
    "workload": true
  }
}
```

**Response:**
```json
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

### GET /api/auto-assignment/suggest
Get vendor suggestions for order

**Request:**
```
GET /api/auto-assignment/suggest?orderId=order-006&tenantId=test-tenant-123
```

**Response:**
```json
{
  "suggestions": [
    {
      "vendorId": "vendor-002",
      "score": 92.5,
      "rating": 4.9,
      "availability": "available",
      "distance": "5.2 miles",
      "estimatedResponse": "1.8 hours"
    },
    {
      "vendorId": "vendor-005",
      "score": 90.8,
      "rating": 4.9,
      "availability": "available",
      "distance": "8.1 miles",
      "estimatedResponse": "1.5 hours"
    }
  ]
}
```

---

## 🤝 ORDER NEGOTIATIONS

### POST /api/negotiations/accept
Vendor accepts order

**Request:**
```json
{
  "orderId": "order-001",
  "vendorId": "vendor-001"
}
```

**Response:**
```json
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

### POST /api/negotiations/reject
Vendor rejects order

**Request:**
```json
{
  "orderId": "order-001",
  "vendorId": "vendor-001",
  "reason": "Schedule conflict - unavailable this week"
}
```

### POST /api/negotiations/counter-offer
Vendor makes counter-offer

**Request:**
```json
{
  "orderId": "order-001",
  "vendorId": "vendor-001",
  "proposedFee": 450,
  "proposedDueDate": "2026-02-20T00:00:00.000Z",
  "notes": "Can complete by Feb 20 for standard fee"
}
```

### POST /api/negotiations/respond-counter
AMC responds to counter-offer

**Request:**
```json
{
  "orderId": "order-001",
  "counterOfferId": "counter-001",
  "response": "accept",
  "notes": "Approved"
}
```

---

## 🚚 DELIVERY WORKFLOW

### GET /api/delivery/{orderId}
Get delivery status and milestones

### POST /api/delivery/{orderId}/milestone
Update milestone

**Request:**
```json
{
  "milestone": "inspection_completed",
  "notes": "Inspection completed successfully",
  "documents": []
}
```

### POST /api/delivery/{orderId}/documents
Upload document

---

## 📋 QC CHECKLISTS

### GET /api/qc/checklists
Get all QC checklists

### POST /api/qc/checklists
Create new checklist

**Request:**
```json
{
  "name": "Standard Residential QC",
  "propertyTypes": ["Single Family", "Townhouse"],
  "criteria": [
    {
      "id": "data-accuracy",
      "category": "Data Accuracy",
      "items": [
        { "id": "da-1", "description": "Property address matches tax records", "required": true },
        { "id": "da-2", "description": "Square footage verified", "required": true }
      ]
    }
  ]
}
```

---

## ✅ QC EXECUTION

### GET /api/qc/execution/{orderId}
Get QC execution for order

### POST /api/qc/execution
Start QC review

**Request:**
```json
{
  "orderId": "order-004",
  "checklistId": "checklist-001",
  "reviewedBy": "test-user-qc"
}
```

### PUT /api/qc/execution/{executionId}
Update QC review

**Request:**
```json
{
  "criteriaResults": {
    "da-1": { "passed": true, "notes": "" },
    "da-2": { "passed": true, "notes": "" }
  },
  "overallScore": 92,
  "status": "approved"
}
```

---

## 📊 QC RESULTS

### GET /api/qc/results/{orderId}
Get QC results for order

**Response:**
```json
{
  "orderId": "order-005",
  "reviewId": "qc-001",
  "status": "approved",
  "overallScore": 95,
  "categories": {
    "dataAccuracy": { "score": 98, "issues": [] },
    "marketAnalysis": { "score": 94, "issues": [] },
    "photoQuality": { "score": 96, "issues": [] },
    "compliance": { "score": 92, "issues": ["Minor formatting issue"] }
  },
  "reviewedBy": "test-user-qc",
  "reviewedAt": "2026-02-10T20:17:00.000Z"
}
```

---

## 📝 ROV (RECONSIDERATION OF VALUE)

### GET /api/rov
Get all ROV requests

### GET /api/rov/{id}
Get specific ROV request

**Test Data:** `rov-001` (pending review)

**Response:**
```json
{
  "id": "rov-001",
  "orderId": "order-005",
  "orderNumber": "APR-2026-005",
  "requestedBy": "client-002",
  "requestedByName": "Wells Fargo",
  "status": "pending",
  "originalValue": 625000,
  "requestedValue": 650000,
  "reason": "Borrower provided additional comparable sales data",
  "comparableSales": [
    {
      "address": "560 Cedar Ln, Frisco, TX",
      "saleDate": "2026-01-15",
      "salePrice": 645000,
      "sqft": 2800,
      "distance": "0.2 miles"
    }
  ],
  "timeline": [...]
}
```

### POST /api/rov/{id}/approve
Approve ROV request

**Request:**
```json
{
  "approvedBy": "test-user-admin",
  "revisedValue": 640000,
  "justification": "Additional comparables are valid and support higher valuation"
}
```

### POST /api/rov/{id}/reject
Reject ROV request

**Request:**
```json
{
  "rejectedBy": "test-user-admin",
  "justification": "Comparables are outside acceptable distance range"
}
```

### POST /api/rov/{id}/comments
Add comment to ROV

---

## 📧 COMMUNICATIONS

### POST /api/communications/email
Send email

**Request:**
```json
{
  "orderId": "order-001",
  "to": "john@premierappraisal.com",
  "subject": "Order Assignment Reminder",
  "body": "<html><p>Please accept order APR-2026-001</p></html>"
}
```

### POST /api/communications/sms
Send SMS

**Request:**
```json
{
  "orderId": "order-001",
  "to": "+12145551001",
  "body": "Reminder: Order APR-2026-001 expires in 1 hour"
}
```

### POST /api/communications/teams
Send Teams message

**Request:**
```json
{
  "orderId": "order-001",
  "teamId": "team-123",
  "channelId": "19:channel-id@thread.tacv2",
  "subject": "Order Update",
  "body": "Order APR-2026-001 status changed"
}
```

### GET /api/communications/history/{orderId}
Get communication history for order

**Test Data:** `order-002` has 2 communications (comm-001, comm-002)

---

## 💬 UNIFIED COMMUNICATION

### POST /api/communication/chat/create
Create chat thread

### POST /api/communication/meetings/create
Create Teams meeting

### GET /api/communication/threads/{threadId}
Get chat thread details

---

## 🔔 NOTIFICATIONS

### POST /api/notifications/send
Send notification

### GET /api/notifications/preferences
Get notification preferences

### PUT /api/notifications/preferences
Update preferences

---

## 👥 USER MANAGEMENT

### GET /api/users
Get all users

### GET /api/users/{id}
Get specific user

### POST /api/users
Create user

### PUT /api/users/{id}
Update user

---

## 🎓 VENDOR CERTIFICATIONS

### GET /api/vendor-certifications/{vendorId}
Get vendor certifications

### POST /api/vendor-certifications
Add certification

**Request:**
```json
{
  "vendorId": "vendor-001",
  "type": "state_license",
  "state": "TX",
  "licenseNumber": "TX-12345",
  "issuedDate": "2024-01-15",
  "expirationDate": "2027-01-15",
  "documentUrl": "blob://certs/vendor-001-tx-license.pdf"
}
```

### PUT /api/vendor-certifications/{id}
Update certification

---

## 💳 PAYMENTS

### POST /api/payments/invoices
Create invoice

**Request:**
```json
{
  "orderId": "order-005",
  "vendorId": "vendor-005",
  "amount": 450,
  "description": "Appraisal - 555 Cedar Ln, Frisco, TX"
}
```

### POST /api/payments/process
Process payment

### GET /api/payments/invoices/{vendorId}
Get vendor invoices

---

## 🚀 VENDOR ONBOARDING

### POST /api/vendor-onboarding/applications
Submit onboarding application

### GET /api/vendor-onboarding/applications/{id}
Get application status

### POST /api/vendor-onboarding/applications/{id}/approve
Approve application

### POST /api/vendor-onboarding/applications/{id}/reject
Reject application

---

## 📊 VENDOR ANALYTICS

### GET /api/vendor-analytics/performance
Get performance analytics

### GET /api/vendor-analytics/rankings
Get vendor rankings

### GET /api/vendor-analytics/trends
Get trend analysis

---

## 📝 TEMPLATES

### GET /api/templates
Get all templates

### GET /api/templates/{id}
Get specific template

### POST /api/templates
Create template

### PUT /api/templates/{id}
Update template

---

## 🌐 GEOSPATIAL

### GET /api/geospatial/nearby
Get nearby properties

### GET /api/geospatial/census
Get census data

### GET /api/geospatial/risk-assessment
Get risk assessment

---

## 🏘️ MLS INTEGRATION

### GET /api/bridge-mls/search
Search MLS listings

### GET /api/bridge-mls/listing/{id}
Get specific listing

---

## 🤖 AI SERVICES

### POST /api/axiom/analyze
Analyze document with AI

### POST /api/axiom/compliance-check
Check USPAP compliance

### POST /api/axiom/risk-score
Calculate risk score

---

## 🏠 PROPERTY INTELLIGENCE

### POST /api/property-intelligence-v2/analyze
Comprehensive property analysis

---

## 🔍 AVM (AUTOMATED VALUATION MODEL)

### POST /api/avm/estimate
Get AVM valuation

**Request:**
```json
{
  "address": "123 Main St, Dallas, TX 75201",
  "propertyType": "Single Family",
  "sqft": 2500,
  "bedrooms": 4,
  "bathrooms": 3
}
```

---

## 🛡️ FRAUD DETECTION

### POST /api/fraud-detection/analyze
Analyze for fraud risk

---

## 🏥 HEALTH & DIAGNOSTICS

### GET /health
Server health check

### GET /api/health/services
Service diagnostics

---

## 🔐 AUTHORIZATION

### GET /api/access-graph
Get access graph

### GET /api/authz-test
Test authorization

---

## 💬 ACS & TEAMS

### GET /api/acs/token
Get ACS chat token

### POST /api/teams/meeting
Create Teams meeting

---

## 📊 SEEDED TEST DATA SUMMARY

**Vendors:** 5 (vendor-001 through vendor-005)  
**Orders:** 7 (order-001 through order-007)  
**Communications:** 3 (comm-001 through comm-003)  
**QC Reviews:** 1 (qc-001 for order-005)  
**ROV Requests:** 1 (rov-001 for order-005)  

**All data uses:** `tenantId=test-tenant-123`

---

## 🎯 QUICK TEST SCENARIOS

### 1. Vendor Acceptance Flow
```bash
# Get pending assignment
GET /api/orders/order-001

# Accept it
POST /api/negotiations/accept
{"orderId": "order-001", "vendorId": "vendor-001"}
```

### 2. Auto-Assignment Flow
```bash
# Get suggestions
GET /api/auto-assignment/suggest?orderId=order-006

# Assign vendor
POST /api/auto-assignment/assign
{"orderId": "order-006", "criteria": {"proximity": true, "rating": true}}
```

### 3. QC Review Flow
```bash
# Get order in QC
GET /api/orders/order-004

# Start QC review
POST /api/qc/execution
{"orderId": "order-004", "checklistId": "checklist-001"}

# Submit review
PUT /api/qc/execution/{executionId}
{"status": "approved", "overallScore": 92}
```

### 4. ROV Processing
```bash
# Get ROV request
GET /api/rov/rov-001

# Approve it
POST /api/rov/rov-001/approve
{"revisedValue": 640000, "justification": "Valid comparables"}
```

### 5. Communication
```bash
# Send SMS
POST /api/communications/sms
{"orderId": "order-001", "to": "+12145551001", "body": "Test message"}

# Get history
GET /api/communications/history/order-001
```

---

## 17. Enhanced Order Management (Phase 5)

### 17.1 Create Order with Intelligence
**POST** `/api/enhanced-orders/create-with-intelligence`
- Creates order with automatic property intelligence analysis
- Input: `{ clientInformation, propertyDetails, orderType, priority, dueDate, orderValue, specialInstructions?, accessInstructions?, contactInstructions? }`
- Returns: Order with property intelligence data
```bash
curl -X POST http://localhost:3000/api/enhanced-orders/create-with-intelligence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientInformation": {
      "clientId": "client-001",
      "clientName": "First National Bank",
      "contactName": "Jane Smith",
      "contactEmail": "jane.smith@firstnational.com",
      "contactPhone": "555-0100"
    },
    "propertyDetails": {
      "address": {
        "street": "123 Main St",
        "city": "Austin",
        "state": "TX",
        "zipCode": "78701"
      },
      "propertyType": "single_family",
      "yearBuilt": 2015,
      "squareFootage": 2500,
      "lotSize": 7500,
      "bedrooms": 4,
      "bathrooms": 3
    },
    "orderType": "purchase",
    "priority": "rush",
    "dueDate": "2026-02-20T00:00:00Z",
    "orderValue": 450000,
    "specialInstructions": "Rush appraisal for closing"
  }'
```

### 17.2 Get Dashboard Metrics
**GET** `/api/enhanced-orders/dashboard`
- Returns comprehensive order metrics and analytics
- Query params: None (uses user context for filters)
```bash
curl http://localhost:3000/api/enhanced-orders/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

---

## 18. DOCUMENT MANAGEMENT (Phase 6)

### 18.1 Upload Document
**POST** `/api/documents/upload`
- Uploads a document file to blob storage and stores metadata
- Supports files up to 50MB
- Returns document metadata including blob URL
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "orderId=order-001" \
  -F "category=appraisal_report" \
  -F 'tags=["final", "signed"]' \
  -F 'metadata={"version": "2.0", "reviewer": "john-doe"}'
```

**Categories:** `appraisal_report`, `photo`, `invoice`, `contract`, `other`

### 18.2 List Documents
**GET** `/api/documents`
- Lists documents with optional filtering
- Query params:
  - `orderId` - Filter by order ID
  - `category` - Filter by document category
  - `limit` - Results per page (default: 50)
  - `offset` - Pagination offset (default: 0)
```bash
# List all documents
curl http://localhost:3000/api/documents \
  -H "Authorization: Bearer $TOKEN"

# List documents for specific order
curl "http://localhost:3000/api/documents?orderId=order-001" \
  -H "Authorization: Bearer $TOKEN"

# List only appraisal reports
curl "http://localhost:3000/api/documents?category=appraisal_report&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 18.3 Get Document Details
**GET** `/api/documents/:id`
- Returns full document metadata including blob URL
```bash
curl http://localhost:3000/api/documents/doc-001 \
  -H "Authorization: Bearer $TOKEN"
```

### 18.4 Get Document Download URL
**GET** `/api/documents/:id/download`
- Returns download URL and file information
- Validates user has access to the document
```bash
curl http://localhost:3000/api/documents/doc-001/download \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.blob.core.windows.net/documents/order-001/abc123.pdf",
    "name": "Final_Appraisal_Report.pdf",
    "mimeType": "application/pdf"
  }
}
```

### 18.5 Update Document Metadata
**PUT** `/api/documents/:id`
- Updates document category, tags, or custom metadata
- Does NOT update the file itself
```bash
curl -X PUT http://localhost:3000/api/documents/doc-001 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "contract",
    "tags": ["revised", "final", "signed"],
    "metadata": {
      "version": "3.0",
      "signedBy": "client",
      "signedDate": "2026-02-12"
    }
  }'
```

### 18.6 Delete Document
**DELETE** `/api/documents/:id`
- Deletes document from both blob storage and database
- Cannot be undone
```bash
curl -X DELETE http://localhost:3000/api/documents/doc-001 \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true
}
```

---

---

**Run seed script to populate all data:**
```bash
node scripts/seed-test-data.js
```

