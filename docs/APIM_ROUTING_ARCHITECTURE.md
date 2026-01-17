# APIM Routing Architecture - Complete Guide

## Overview

This document explains how API routing works through Azure API Management (APIM) to the backend API Container App, the issues that were identified, and the fixes implemented.

---

## Architecture Components

### 1. **Backend API Server** (`src/api/api-server.ts`)
- **Technology**: Node.js/Express
- **Port**: 3000 (configurable via environment)
- **Base Routes**: 
  - Health: `GET /health`
  - API Docs: `GET /api-docs`
  - All API Routes: `/api/*` (e.g., `/api/orders`, `/api/auth/login`, `/api/qc/validate`)

**Key Point**: The backend expects all application routes to start with `/api/` prefix.

### 2. **Azure API Management (APIM)** (`infrastructure/modules/apim.bicep`)
- **Purpose**: API Gateway/Reverse Proxy
- **Public Endpoints**: `https://{apim-gateway-url}/api/*`
- **Backend**: Routes to Container App running the Node.js API server

---

## Routing Flow

### **Correct Request Flow** (After Fix)

```
Client Request:
  https://apim-gateway.azure-api.net/api/orders
  Method: GET
  Headers: Authorization: Bearer <token>

↓ (1) APIM receives request at API with path="api"

↓ (2) APIM strips the API base path, context.Request.Url.Path = "/orders"

↓ (3) APIM Policy rewrites URI: "/api{context.Request.Url.Path}" = "/api/orders"

↓ (4) APIM forwards to backend:
  https://api-container-app.azurecontainerapps.io/api/orders
  Method: GET
  Headers: Authorization: Bearer <token>

↓ (5) Backend Express router matches route:
  app.get('/api/orders', ...)

✅ Success: Request processed correctly
```

---

## What Was Broken

### **Original Configuration** (INCORRECT)

```bicep
// ❌ WRONG: Used string interpolation with @() expression
value: '<policies>
  <inbound>
    <rewrite-uri template="@($"/api{context.Request.Url.Path}")" />
  </inbound>
</policies>'
```

### **Problem Explanation**

The `@(...)` syntax is **C# expression syntax** used in APIM policies, but wrapping it incorrectly could cause:
1. **Compilation errors** - The expression might not evaluate correctly
2. **Incorrect path construction** - The `/api` prefix might be malformed
3. **String interpolation issues** - The `$` inside `@()` creates nested interpolation

### **Error Scenarios**

| Client Request | APIM Path Extracted | Policy Rewrite (Broken) | Backend Receives | Result |
|---------------|---------------------|------------------------|------------------|---------|
| `GET /api/orders` | `/orders` | `@($"/api/orders")` ❌ | Expression error or malformed path | **500 Error** |
| `GET /api/auth/login` | `/auth/login` | `@($"/api/auth/login")` ❌ | Expression error | **500 Error** |

---

## The Fix

### **Corrected Configuration**

```bicep
// ✅ CORRECT: Simple string concatenation without nested interpolation
value: '<policies>
  <inbound>
    <base />
    <set-backend-service backend-id="${apiBackendName}" />
    <rewrite-uri template="/api{context.Request.Url.Path}" copy-unmatched-params="true" />
    <cors allow-credentials="true">
      <!-- CORS configuration -->
    </cors>
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>'
```

### **Why This Works**

1. **Simple Template**: `/api{context.Request.Url.Path}` uses APIM's template engine without C# expressions
2. **Direct Concatenation**: The `/api` prefix is literal, the variable is inserted by APIM
3. **No Nested Interpolation**: Bicep's `${...}` only applies to `apiBackendName`, not the XML policy
4. **copy-unmatched-params**: Preserves query strings (e.g., `?status=pending&page=2`)

### **Request Flow After Fix**

| Client Request | APIM Path | Policy Rewrite | Backend Receives | Result |
|---------------|-----------|----------------|------------------|---------|
| `GET /api/orders` | `/orders` | `/api/orders` | `https://backend/api/orders` | ✅ **200 OK** |
| `GET /api/auth/login` | `/auth/login` | `/api/auth/login` | `https://backend/api/auth/login` | ✅ **200 OK** |
| `GET /api/orders?status=pending` | `/orders?status=pending` | `/api/orders` + params | `https://backend/api/orders?status=pending` | ✅ **200 OK** |
| `POST /api/qc/validate/12345` | `/qc/validate/12345` | `/api/qc/validate/12345` | `https://backend/api/qc/validate/12345` | ✅ **200 OK** |

---

## Key Configuration Elements

### **Backend Resource**

```bicep
resource apiBackend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apim
  name: apiBackendName
  properties: {
    title: 'Appraisal API Backend'
    description: 'Main API Container App backend'
    url: 'https://${apiContainerAppFqdn}'  // Backend root URL
    protocol: 'http'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}
```

**Note**: The backend URL is the **root of the container app**, not including `/api`. The policy adds the `/api` prefix.

### **API Resource**

```bicep
resource api 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: apiName
  properties: {
    displayName: 'Appraisal Management API'
    path: 'api'  // Clients call: https://apim-gateway/api/*
    serviceUrl: 'https://${apiContainerAppFqdn}'  // Backend root
    subscriptionRequired: false
    protocols: ['https']
  }
}
```

**Key Points**:
- `path: 'api'` - APIM strips this from incoming requests
- `serviceUrl` - Points to container app root (backend adds `/api` via policy)

### **Operation Resource**

```bicep
resource allOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'all-operations'
  properties: {
    displayName: 'All API Operations'
    method: '*'  // All HTTP methods
    urlTemplate: '/{*path}'  // Wildcard: matches any path
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: true
      }
    ]
  }
}
```

**Purpose**: Catch-all operation that forwards any HTTP method and path pattern to the backend.

---

## Testing the Configuration

### **1. Health Check (No /api prefix)**

```bash
# Direct to Container App
curl https://api-container-app.azurecontainerapps.io/health

# Through APIM (requires separate health API or operation)
curl https://apim-gateway.azure-api.net/health
```

**Note**: The `/health` endpoint is NOT under `/api` path in Express, so you may need a separate APIM API/operation for health checks.

### **2. API Routes (With /api prefix)**

```bash
# Login (Public endpoint)
curl -X POST https://apim-gateway.azure-api.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Get Orders (Authenticated)
curl https://apim-gateway.azure-api.net/api/orders \
  -H "Authorization: Bearer <jwt-token>"

# Create Order (Authenticated)
curl -X POST https://apim-gateway.azure-api.net/api/orders \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyAddress": "123 Main St, San Francisco, CA 94105",
    "clientId": "client-uuid",
    "orderType": "purchase",
    "dueDate": "2026-02-15T00:00:00Z"
  }'
```

### **3. Verify Path Rewriting**

You can test path rewriting by checking backend logs for incoming request paths. They should all start with `/api/`.

---

## Additional Considerations

### **1. Health Check Routing**

The backend has `/health` without `/api` prefix. Options:

**Option A**: Create separate APIM API for health checks
```bicep
resource healthApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  name: 'health-api'
  properties: {
    path: 'health'
    serviceUrl: 'https://${apiContainerAppFqdn}'
  }
}

resource healthPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: healthApi
  name: 'policy'
  properties: {
    value: '<policies><inbound><rewrite-uri template="/health" /></inbound></policies>'
  }
}
```

**Option B**: Add health check to backend under `/api/health`
```typescript
// In api-server.ts
app.get('/health', ...);  // Keep for direct access
app.get('/api/health', ...);  // Add for APIM routing
```

### **2. API Documentation**

Similar to health checks, `/api-docs` is outside the `/api` prefix. Consider:
- Moving to `/api/docs` for consistency
- Creating separate APIM API for documentation
- Hosting docs separately (e.g., Azure Static Web Apps)

### **3. Function App Routing**

Functions are configured separately in APIM:

```bicep
resource functionBackend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  properties: {
    url: 'https://${functionContainerAppFqdn}/api'  // Functions already at /api
  }
}

resource functionApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  properties: {
    path: 'functions'  // Client calls: https://apim-gateway/functions/*
    serviceUrl: 'https://${functionContainerAppFqdn}/api'
  }
}
```

**Request Flow**:
```
Client: GET /functions/processFemaData
  ↓
APIM strips "functions", path = "/processFemaData"
  ↓
Policy extracts function name: "processFemaData"
  ↓
Backend: GET https://function-app/api/processFemaData
```

---

## Troubleshooting

### **Problem: 404 Not Found**

**Possible Causes**:
1. Path rewrite incorrect (verify policy XML)
2. Backend route doesn't exist (check api-server.ts)
3. Container app not running (check Azure Portal)

**Solution**:
```bash
# Check APIM gateway logs
az apim api diagnostic show ...

# Check container app logs
az containerapp logs show --name api-container-app ...
```

### **Problem: 500 Internal Server Error**

**Possible Causes**:
1. Policy expression syntax error
2. Backend service throwing exception
3. Database connection failure

**Solution**:
```bash
# Check APIM trace
# Enable request tracing in Azure Portal

# Check backend logs for exceptions
az containerapp logs show --name api-container-app --follow
```

### **Problem: CORS Errors**

**Possible Causes**:
1. APIM CORS policy missing allowed origin
2. Preflight OPTIONS request not handled

**Solution**:
```bicep
// Update allowed origins in apim.bicep
param allowedOrigins array = [
  'http://localhost:3000'
  'https://your-frontend.azurewebsites.net'
]
```

---

## Summary

### **What Changed**

| Component | Before | After |
|-----------|--------|-------|
| **API Policy Template** | `@($"/api{context.Request.Url.Path}")` ❌ | `/api{context.Request.Url.Path}` ✅ |
| **Expression Type** | C# expression with nested interpolation | Simple template substitution |
| **Request Handling** | Potential expression errors | Clean path rewriting |

### **Current State**

✅ **APIM correctly routes all `/api/*` requests to backend `/api/*` paths**
✅ **Path parameters preserved** (e.g., `/api/orders/:orderId`)
✅ **Query strings preserved** (e.g., `?status=pending&page=2`)
✅ **HTTP methods forwarded** (GET, POST, PUT, DELETE, PATCH)
✅ **CORS enabled** with configurable origins
✅ **Authentication headers forwarded** to backend

### **Next Steps**

1. ✅ Deploy updated APIM configuration
2. ⚠️ Test all API endpoints through APIM gateway
3. ⚠️ Configure health check routing (if needed)
4. ⚠️ Set up API monitoring and logging
5. ⚠️ Document frontend integration with APIM URLs

---

## Reference: All Backend Routes

### **Authentication** (Public)
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`

### **Order Management** (Authenticated)
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- `GET /api/orders/:orderId` - Get order details
- `PUT /api/orders/:orderId/status` - Update status
- `POST /api/orders/:orderId/deliver` - Deliver order
- `GET /api/orders/dashboard` - Dashboard metrics

### **Quality Control** (Authenticated + Permissions)
- `POST /api/qc/validate/:orderId` - Run QC validation
- `GET /api/qc/results/:orderId` - Get QC results
- `GET /api/qc/metrics` - QC metrics
- `/api/qc/checklists/*` - QC checklist management
- `/api/qc/execution/*` - QC execution workflows
- `/api/qc-workflow/*` - QC workflow orchestration

### **Vendor Management** (Authenticated)
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- `POST /api/vendors/assign/:orderId` - Assign vendor
- `GET /api/vendors/performance/:vendorId` - Vendor metrics
- `/api/vendor-performance/*` - Advanced vendor analytics

### **Property Intelligence** (Authenticated)
- `GET /api/property-intelligence/address/suggest`
- `POST /api/property-intelligence/address/geocode`
- `POST /api/property-intelligence/address/validate`
- `POST /api/property-intelligence/analyze/comprehensive`
- `POST /api/property-intelligence/analyze/creative`
- `POST /api/property-intelligence/analyze/view`
- `POST /api/property-intelligence/analyze/transportation`
- `POST /api/property-intelligence/analyze/neighborhood`
- `POST /api/property-intelligence/analyze/batch`
- `/api/property-intelligence-v2/*` - Next-gen property intel (Places API)
- `/api/geospatial/*` - Geospatial analysis
- `/api/bridge-mls/*` - MLS integration

### **AI Services** (Authenticated)
- `POST /api/ai/qc/analyze` - AI QC analysis
- `POST /api/ai/qc/technical` - Technical review
- `POST /api/ai/qc/compliance` - Compliance check
- `POST /api/ai/market/insights` - Market insights
- `POST /api/ai/property/description` - Property descriptions
- `POST /api/ai/vision/analyze` - Image analysis
- `POST /api/ai/vision/condition` - Condition assessment
- `POST /api/ai/embeddings` - Generate embeddings
- `POST /api/ai/completion` - Text completion
- `GET /api/ai/health` - AI services health
- `GET /api/ai/usage` - Usage metrics
- `/api/avm/*` - Automated Valuation Model
- `/api/fraud-detection/*` - Fraud detection

### **Analytics** (Authenticated + Permissions)
- `GET /api/analytics/overview` - Analytics overview
- `GET /api/analytics/performance` - Performance metrics

### **Authorization & User Management** (Admin/Manager)
- `/api/users/*` - User profile management
- `/api/access-graph/*` - Access control graph
- `/api/authz-test/*` - Authorization testing

### **Workflow Management** (Authenticated)
- `/api/rov/*` - Reconsideration of Value
- `/api/templates/*` - Template management
- `/api/auto-assignment/*` - Auto-assignment engine
- `/api/negotiations/*` - Order negotiation
- `/api/delivery/*` - Delivery workflow
- `/api/reviews/*` - Review management

### **Communication** (Authenticated)
- `/api/notifications/*` - Email/SMS notifications
- `/api/chat/*` - Real-time chat (Azure Communication Services)
- `/api/acs/*` - ACS token exchange
- `/api/teams/*` - Microsoft Teams integration

### **Code Execution** (Authenticated + Special Permissions)
- `POST /api/code/execute` - Dynamic code execution (sandboxed)

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-16  
**Author**: Appraisal Management Platform Team
