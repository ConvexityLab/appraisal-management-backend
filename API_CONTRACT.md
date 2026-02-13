# Appraisal Management API - Frontend Integration Contract

**Base URL:** `http://localhost:3001` (dev) | `https://api.yourdomain.com` (prod)

**Authentication:** Bearer token in `Authorization` header

**Response Format:** All responses follow this structure:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}
```

---

## Item 3: Enhanced Vendor Management

### 1. Certification Management

#### Create Certification
```http
POST /api/vendor-certifications/:vendorId
Authorization: Bearer {token}
Content-Type: application/json

{
  "certificationType": "APPRAISER_LICENSE" | "E_O_INSURANCE" | "CONTINUING_EDUCATION" | "STATE_LICENSE" | "PROFESSIONAL_DESIGNATION",
  "issuingAuthority": "string",
  "certificationNumber": "string",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "verificationUrl": "string (optional)"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "cert-xxx",
    "vendorId": "string",
    "status": "PENDING_VERIFICATION",
    ...
  }
}
```

#### List Certifications
```http
GET /api/vendor-certifications/:vendorId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "certifications": [...],
    "summary": {
      "total": number,
      "active": number,
      "expiringSoon": number,
      "expired": number
    }
  }
}
```

#### Get Certification by ID
```http
GET /api/vendor-certifications/:vendorId/:certificationId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* certification object */ }
}
```

#### Upload Certification Document
```http
POST /api/vendor-certifications/:vendorId/:certificationId/upload
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileName": "license.pdf",
  "fileData": "base64-encoded-file-content",
  "contentType": "application/pdf",
  "uploadedBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": {
    "documentUrl": "https://...",
    "uploadedAt": "ISO-8601-timestamp"
  }
}
```

#### Manually Verify Certification
```http
POST /api/vendor-certifications/:vendorId/:certificationId/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "verifiedBy": "admin-user-id",
  "notes": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": { /* updated certification */ }
}
```

#### State Board Verification (Stub)
```http
POST /api/vendor-certifications/:vendorId/:certificationId/verify-state
Authorization: Bearer {token}
Content-Type: application/json

{
  "licenseNumber": "string",
  "state": "TX",
  "certificationType": "APPRAISER_LICENSE"
}

Response 200:
{
  "success": true,
  "data": {
    "verified": true,
    "verificationDate": "ISO-8601",
    "source": "state-board-stub"
  }
}
```

#### Check Expiring Certifications
```http
GET /api/vendor-certifications/:vendorId/expiring?days=30
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "expiringCertifications": [...],
    "count": number
  }
}
```

#### Update Expired Certifications (Maintenance)
```http
POST /api/vendor-certifications/maintenance/update-expired
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "updatedCount": number
  }
}
```

---

### 2. Payment Processing

#### Create Invoice
```http
POST /api/payments/invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "vendorId": "string",
  "orderId": "string",
  "amount": number,
  "description": "string",
  "dueDate": "YYYY-MM-DD"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "inv-xxx",
    "invoiceNumber": "INV-20240212-001",
    "status": "PENDING",
    ...
  }
}
```

#### Send Invoice Email
```http
POST /api/payments/invoices/:invoiceId/send
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "sent": true,
    "sentAt": "ISO-8601"
  }
}
```

#### Process Payment
```http
POST /api/payments/process
Authorization: Bearer {token}
Content-Type: application/json

{
  "invoiceId": "string",
  "vendorId": "string",
  "amount": number,
  "paymentMethod": "ACH" | "WIRE" | "CHECK" | "CARD",
  "paymentReference": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "pay-xxx",
    "status": "COMPLETED",
    "processedAt": "ISO-8601",
    ...
  }
}
```

#### Get Payment History
```http
GET /api/payments/vendors/:vendorId/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "payments": [...],
    "total": number
  }
}
```

#### Get Payment Summary
```http
GET /api/payments/vendors/:vendorId/summary
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "totalPaid": number,
    "totalPending": number,
    "averagePaymentDays": number,
    "recentPayments": [...]
  }
}
```

#### Process Bulk Payments
```http
POST /api/payments/bulk
Authorization: Bearer {token}
Content-Type: application/json

{
  "payments": [
    {
      "invoiceId": "string",
      "vendorId": "string",
      "amount": number,
      "paymentMethod": "ACH"
    },
    ...
  ]
}

Response 200:
{
  "success": true,
  "data": {
    "processedCount": number,
    "failedCount": number,
    "results": [...]
  }
}
```

---

### 3. Onboarding Workflow

#### Submit Application
```http
POST /api/vendor-onboarding/applications
Authorization: Bearer {token}
Content-Type: application/json

{
  "vendorId": "string",
  "businessName": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "businessAddress": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string"
  }
}

Response 201:
{
  "success": true,
  "data": {
    "id": "onboard-xxx",
    "status": "APPLICATION_SUBMITTED",
    "currentStep": "APPLICATION_FORM",
    ...
  }
}
```

#### Get Application
```http
GET /api/vendor-onboarding/applications/:applicationId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* application object */ }
}
```

#### List Applications
```http
GET /api/vendor-onboarding/applications?status=PENDING&limit=50
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "applications": [...],
    "total": number
  }
}
```

#### Upload Document
```http
POST /api/vendor-onboarding/applications/:applicationId/documents
Authorization: Bearer {token}
Content-Type: application/json

{
  "stepType": "DOCUMENT_SUBMISSION",
  "requirementId": "string",
  "fileName": "document.pdf",
  "fileData": "base64-encoded-content",
  "contentType": "application/pdf",
  "uploadedBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": {
    "documentId": "doc-xxx",
    "documentUrl": "https://..."
  }
}
```

#### Complete Step
```http
POST /api/vendor-onboarding/applications/:applicationId/steps/:stepType/complete
Authorization: Bearer {token}
Content-Type: application/json

{
  "completedBy": "user-id",
  "notes": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": { /* updated application */ }
}
```

#### Review Application
```http
POST /api/vendor-onboarding/applications/:applicationId/review
Authorization: Bearer {token}
Content-Type: application/json

{
  "reviewedBy": "admin-id",
  "decision": "APPROVED" | "REJECTED" | "NEEDS_REVISION",
  "notes": "string"
}

Response 200:
{
  "success": true,
  "data": { /* updated application */ }
}
```

#### Request Background Check
```http
POST /api/vendor-onboarding/applications/:applicationId/background-check
Authorization: Bearer {token}
Content-Type: application/json

{
  "requestedBy": "admin-id",
  "vendorId": "string"
}

Response 200:
{
  "success": true,
  "data": {
    "checkId": "bg-xxx",
    "status": "PENDING",
    "requestedAt": "ISO-8601"
  }
}
```

---

### 4. Performance Analytics

#### Get Vendor Dashboard
```http
GET /api/vendor-analytics/dashboard/:vendorId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "metrics": {
      "totalOrders": number,
      "completedOrders": number,
      "averageTurnaroundDays": number,
      "qualityScore": number,
      "onTimeDeliveryRate": number
    },
    "recentActivity": [...]
  }
}
```

#### Get Performance Trends
```http
GET /api/vendor-analytics/trends/:vendorId?metric=turnaroundTime&period=30
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "metric": "turnaroundTime",
    "dataPoints": [
      { "date": "YYYY-MM-DD", "value": number },
      ...
    ]
  }
}
```

#### Get Vendor Rankings
```http
GET /api/vendor-analytics/rankings?region=west&limit=10
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "rankings": [
      {
        "rank": number,
        "vendorId": "string",
        "vendorName": "string",
        "score": number,
        "metrics": { ... }
      },
      ...
    ]
  }
}
```

#### Get Comparative Analysis
```http
GET /api/vendor-analytics/comparative/:vendorId?compareToTier=GOLD
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "vendor": { ... },
    "tierAverage": { ... },
    "comparison": { ... }
  }
}
```

#### Get Tier Analysis
```http
GET /api/vendor-analytics/tier-analysis
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "tiers": [
      {
        "tier": "GOLD",
        "vendorCount": number,
        "averageMetrics": { ... }
      },
      ...
    ]
  }
}
```

---

## TypeScript Types (for Frontend)

```typescript
// Copy these to your frontend project

export type CertificationType = 
  | 'APPRAISER_LICENSE' 
  | 'E_O_INSURANCE' 
  | 'CONTINUING_EDUCATION' 
  | 'STATE_LICENSE' 
  | 'PROFESSIONAL_DESIGNATION';

export type CertificationStatus = 
  | 'PENDING_VERIFICATION' 
  | 'VERIFIED' 
  | 'EXPIRED' 
  | 'REJECTED';

export interface Certification {
  id: string;
  vendorId: string;
  certificationType: CertificationType;
  issuingAuthority: string;
  certificationNumber: string;
  issueDate: string;
  expiryDate: string;
  status: CertificationStatus;
  documentUrl?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export type PaymentMethod = 'ACH' | 'WIRE' | 'CHECK' | 'CARD';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Payment {
  id: string;
  invoiceId: string;
  vendorId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  processedAt?: string;
}

export type OnboardingStatus = 
  | 'APPLICATION_SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'UNDER_REVIEW'
  | 'BACKGROUND_CHECK'
  | 'APPROVED'
  | 'REJECTED';

export interface OnboardingApplication {
  id: string;
  vendorId: string;
  status: OnboardingStatus;
  currentStep: string;
  businessName: string;
  contactEmail: string;
  submittedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## Error Codes

- `400` - Bad Request (validation error, check `error` field)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- **Default**: 100 requests/minute per IP
- **Authenticated**: 1000 requests/minute per user

---

## Next: Item 4 - Enhanced Order Management (coming next)

---

## Item 4: Enhanced Order Management

### 1. Order Lifecycle Operations

#### Create Order
```http
POST /api/orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientInformation": {
    "clientId": "string",
    "clientName": "string",
    "loanNumber": "string",
    "contactName": "string",
    "contactEmail": "string",
    "contactPhone": "string"
  },
  "propertyDetails": {
    "streetAddress": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "county": "string",
    "propertyType": "SINGLE_FAMILY" | "CONDO" | "MULTI_FAMILY" | "LAND",
    "yearBuilt": number,
    "squareFootage": number,
    "bedrooms": number,
    "bathrooms": number
  },
  "orderType": "FULL_APPRAISAL" | "DRIVE_BY" | "DESKTOP" | "BPO" | "FIELD_REVIEW",
  "priority": "ROUTINE" | "EXPEDITED" | "RUSH" | "EMERGENCY",
  "dueDate": "YYYY-MM-DD",
  "orderValue": number,
  "specialInstructions": "string (optional)"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "ord-xxx",
    "orderNumber": "2024-0001",
    "status": "SUBMITTED",
    "createdAt": "ISO-8601",
    "propertyIntelligence": { /* if enabled */ }
  }
}
```

#### Get Order by ID
```http
GET /api/orders/:orderId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": { /* full order object */ }
}
```

#### Update Order
```http
PUT /api/orders/:orderId
Authorization: Bearer {token}
Content-Type: application/json

{
  "priority": "RUSH",
  "dueDate": "YYYY-MM-DD",
  "specialInstructions": "string"
}

Response 200:
{
  "success": true,
  "data": { /* updated order */ }
}
```

#### Assign Vendor
```http
POST /api/orders/:orderId/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "vendorId": "string",
  "assignedBy": "user-id",
  "notes": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": { /* updated order with assignment */ }
}
```

#### Update Order Status
```http
PATCH /api/orders/:orderId/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "IN_PROGRESS" | "DELIVERED" | "QC_REVIEW" | etc,
  "notes": "string (optional)",
  "updatedBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": { /* updated order */ }
}
```

#### Deliver Order
```http
POST /api/orders/:orderId/deliver
Authorization: Bearer {token}
Content-Type: application/json

{
  "appraisalData": {
    "finalValue": number,
    "effectiveDate": "YYYY-MM-DD",
    "documentUrls": ["string"],
    "comparables": [...]
  },
  "deliveredBy": "vendor-id",
  "notes": "string (optional)"
}

Response 200:
{
  "success": true,
  "data": {
    "order": { /* updated order */ },
    "qcReport": { /* QC validation results if auto-enabled */ }
  }
}
```

#### Cancel Order
```http
POST /api/orders/:orderId/cancel
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "string",
  "cancelledBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": { /* cancelled order */ }
}
```

---

### 2. Advanced Search

#### Search Orders
```http
POST /api/orders/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "textQuery": "string (optional)",
  "status": ["SUBMITTED", "IN_PROGRESS"],
  "priority": ["RUSH", "EXPEDITED"],
  "orderType": ["FULL_APPRAISAL"],
  "productType": ["PROPERTY_APPRAISAL"],
  "createdDateRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "dueDateRange": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "propertyAddress": {
    "city": "string",
    "state": "TX",
    "zipCode": "75001"
  },
  "assignedVendorId": "vendor-xxx",
  "loanAmountRange": {
    "min": 100000,
    "max": 500000
  },
  "sortBy": "dueDate",
  "sortOrder": "asc",
  "limit": 50,
  "offset": 0
}

Response 200:
{
  "success": true,
  "data": {
    "orders": [...],
    "total": number,
    "aggregations": {
      "byStatus": { "SUBMITTED": 10, "IN_PROGRESS": 5 },
      "byPriority": { "RUSH": 3, "ROUTINE": 12 },
      "averageTurnaroundTime": 5.2,
      "onTimeDeliveryRate": 94.5
    }
  }
}
```

---

### 3. Batch Operations

#### Bulk Assign Orders
```http
POST /api/orders/batch/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "orderIds": ["ord-001", "ord-002", "ord-003"],
  "vendorId": "vendor-xxx",
  "assignedBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": {
    "successCount": 3,
    "failureCount": 0,
    "results": [
      { "orderId": "ord-001", "success": true },
      { "orderId": "ord-002", "success": true },
      { "orderId": "ord-003", "success": true }
    ]
  }
}
```

#### Bulk Status Update
```http
POST /api/orders/batch/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "orderIds": ["ord-001", "ord-002"],
  "status": "CANCELLED",
  "reason": "Client request",
  "updatedBy": "user-id"
}

Response 200:
{
  "success": true,
  "data": {
    "successCount": 2,
    "failureCount": 0,
    "results": [...]
  }
}
```

#### Export Orders
```http
POST /api/orders/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "orderIds": ["ord-001", "ord-002", "ord-003"],
  "format": "CSV" | "EXCEL" | "JSON",
  "includeFields": ["orderNumber", "status", "dueDate", "assignedVendor"]
}

Response 200:
{
  "success": true,
  "data": {
    "exportId": "exp-xxx",
    "downloadUrl": "https://...",
    "expiresAt": "ISO-8601"
  }
}
```

---

### 4. Dashboard & Analytics

#### Get Order Dashboard
```http
GET /api/orders/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 245,
      "activeOrders": 32,
      "completedOrders": 186,
      "averageQCScore": 87.3,
      "onTimeDeliveryRate": 94.2
    },
    "statusDistribution": {
      "SUBMITTED": 12,
      "ASSIGNED": 8,
      "IN_PROGRESS": 12,
      ...
    },
    "qcMetrics": {
      "averageScore": 87.3,
      "passRate": 91.2,
      "commonIssues": [...]
    },
    "vendorPerformance": [...]
  }
}
```

#### Get Order Timeline
```http
GET /api/orders/:orderId/timeline
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "events": [
      {
        "timestamp": "ISO-8601",
        "eventType": "ORDER_CREATED",
        "actor": "user-id",
        "details": { ... }
      },
      {
        "timestamp": "ISO-8601",
        "eventType": "VENDOR_ASSIGNED",
        "actor": "admin-id",
        "details": { "vendorId": "vendor-xxx" }
      },
      ...
    ]
  }
}
```

---

## TypeScript Types (continued)

```typescript
export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'QC_REVIEW'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'REVISION_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type OrderType =
  | 'FULL_APPRAISAL'
  | 'DRIVE_BY'
  | 'EXTERIOR_ONLY'
  | 'DESKTOP'
  | 'BPO'
  | 'FIELD_REVIEW'
  | 'DESK_REVIEW';

export type OrderPriority =
  | 'ROUTINE'      // Standard turnaround
  | 'EXPEDITED'    // Faster than routine
  | 'RUSH'         // Urgent
  | 'EMERGENCY';   // Critical/same-day

export interface AppraisalOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  priority: OrderPriority;
  clientInformation: ClientInformation;
  propertyDetails: PropertyDetails;
  assignedVendorId?: string;
  dueDate: Date;
  orderValue: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface OrderSearchCriteria {
  textQuery?: string;
  status?: OrderStatus[];
  priority?: OrderPriority[];
  orderType?: OrderType[];
  createdDateRange?: { start: Date; end: Date };
  dueDateRange?: { start: Date; end: Date };
  propertyAddress?: {
    city?: string;
    state?: string;
    zipCode?: string;
  };
  assignedVendorId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```
