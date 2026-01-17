# Frontend API Routing Guide

## Base URLs

### Appraisal Management API (Main API)
```
https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api
```

### Functions API
```
https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/functions
```

## Authentication

All requests require JWT Bearer token:

```http
Authorization: Bearer <jwt-token>
```

**Token Format:** JWT with claims for `sub`, `email`, `role`, `permissions`

## Complete API Routes Reference

### Authentication (No Auth Required)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh token (Auth required)

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/dashboard` - Get order dashboard
- `GET /api/orders/{orderId}` - Get specific order (ID format: `1767325279959-irkg9b3c9`)
- `PUT /api/orders/{orderId}/status` - Update order status
- `POST /api/orders/{orderId}/deliver` - Deliver order

### Quality Control (QC)
- `POST /api/qc/validate/{orderId}` - Validate QC for order
- `GET /api/qc/results/{orderId}` - Get QC results for order
- `GET /api/qc/metrics` - Get QC metrics
- `GET /api/qc-workflow/*` - QC workflow operations (sub-router)
- `GET /api/qc/results/*` - QC results operations (sub-router)
- `GET /api/qc/execution/*` - QC execution operations (sub-router)
- `GET /api/qc/checklists/*` - QC checklists (sub-router)

### Vendors
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/{vendorId}` - Update vendor
- `POST /api/vendors/assign/{orderId}` - Assign vendor to order
- `GET /api/vendors/performance/{vendorId}` - Get vendor performance
- `GET /api/vendor-performance/*` - Vendor performance analytics (sub-router)

### Analytics
- `GET /api/analytics/overview` - Analytics overview
- `GET /api/analytics/performance` - Performance metrics

### Property Intelligence

#### Address Operations
- `GET /api/property-intelligence/address/suggest` - Address suggestions
- `POST /api/property-intelligence/address/geocode` - Geocode address
- `POST /api/property-intelligence/address/validate` - Validate address

#### Analysis Operations (POST with body)
- `POST /api/property-intelligence/analyze/comprehensive` - Comprehensive property analysis
- `POST /api/property-intelligence/analyze/creative` - Creative feature analysis
- `POST /api/property-intelligence/analyze/view` - View analysis
- `POST /api/property-intelligence/analyze/transportation` - Transportation analysis
- `POST /api/property-intelligence/analyze/neighborhood` - Neighborhood analysis
- `POST /api/property-intelligence/analyze/batch` - Batch property analysis

#### Census Data (GET with query params: latitude, longitude, propertyId)
- `GET /api/property-intelligence/census/demographics?latitude={lat}&longitude={lng}` - Census demographics
- `GET /api/property-intelligence/census/economics?latitude={lat}&longitude={lng}` - Census economics
- `GET /api/property-intelligence/census/housing?latitude={lat}&longitude={lng}` - Census housing data
- `GET /api/property-intelligence/census/comprehensive?latitude={lat}&longitude={lng}` - Comprehensive census

#### Property Intelligence V2 & Other
- `GET /api/property-intelligence/health` - Health check (No auth)
- `GET /api/property-intelligence-v2/*` - Places API New (sub-router)

### AI Services

#### QC Analysis
- `POST /api/ai/qc/analyze` - AI QC analysis
- `POST /api/ai/qc/technical` - AI technical QC
- `POST /api/ai/qc/compliance` - AI compliance QC

#### Vision/Image Analysis
- `POST /api/ai/vision/analyze` - Analyze property images
- `POST /api/ai/vision/condition` - Assess property condition

#### Content Generation
- `POST /api/ai/market/insights` - Generate market insights
- `POST /api/ai/property/description` - Generate property description
- `POST /api/ai/completion` - Generate AI completion
- `POST /api/ai/embeddings` - Generate embeddings

#### AI Management
- `GET /api/ai/health` - AI service health (No auth)
- `GET /api/ai/usage` - Get AI usage stats

### Automated Valuation Model (AVM)
- `GET /api/avm/*` - AVM operations (sub-router)

### Fraud Detection
- `GET /api/fraud-detection/*` - Fraud detection operations (sub-router)

### Geospatial & Risk Assessment
- `GET /api/geospatial/*` - Geospatial risk assessment (FEMA, Census, Tribal) (sub-router)

### Bridge MLS Integration
- `GET /api/bridge-mls/*` - Bridge Interactive MLS integration (sub-router)

### Reviews & Workflow
- `GET /api/reviews/*` - Appraisal reviews (sub-router)
- `GET /api/auto-assignment/*` - Auto-assignment engine (sub-router)
- `GET /api/delivery/*` - Delivery workflow (sub-router)
- `GET /api/negotiations/*` - Order negotiation (sub-router)

### Templates & ROV
- `GET /api/templates/*` - Template management (sub-router)
- `GET /api/rov/*` - Reconsideration of Value (sub-router)

### Communication Services
- `GET /api/teams/*` - Microsoft Teams integration (sub-router)
- `GET /api/chat/*` - Real-time chat (sub-router)
- `GET /api/notifications/*` - Notifications (sub-router)
- `GET /api/acs/*` - Azure Communication Services token exchange (sub-router)

### Authorization & Security
- `GET /api/users/*` - User management (sub-router)
- `GET /api/access-graph/*` - Access graph operations (sub-router)
- `GET /api/authz-test/*` - Authorization testing (sub-router)

### Code Execution
- `POST /api/code/execute` - Execute dynamic code (requires `code_execute` permission)

## Request Examples

### Get Orders
```http
GET https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/orders
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "orders": [...],
  "pagination": {
    "total": 12,
    "offset": 0,
    "limit": 20
  }
}
```

### Get Specific Order
```http
GET https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/orders/1767325279959-irkg9b3c9
Authorization: Bearer eyJhbGc...
```

### Census Data with Query Params
```http
GET https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/property-intelligence/census/housing?latitude=37.7749&longitude=-122.4194&propertyId=test123
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "processingTime": 0,
    "dataSource": "U.S. Census Bureau ACS 2022",
    "geographicLevel": "Census Block Group"
  }
}
```

## Important Notes

1. **All routes use HTTPS only**
2. **Order IDs:** Timestamp-based format `{timestamp}-{random}`, NOT UUIDs
3. **Query Parameters:** Property intelligence endpoints require lat/long as query params, not body
4. **CORS:** Enabled for localhost origins (3000, 4200, 5173)
5. **Rate Limiting:** Standard APIM rate limits apply
6. **Error Format:**
   ```json
   {
     "success": false,
     "error": "Error message",
     "code": "ERROR_CODE"
   }
   ```

## Functions API Routes

Functions API is available at `/functions` base path. Specific routes TBD based on deployed Azure Functions.

## Health Checks

- **Backend Health:** `GET /health` (no auth required)
- **AI Services Health:** `GET /api/ai/health` (no auth required)
- **Property Intelligence Health:** `GET /api/property-intelligence/health` (no auth required)

## Testing

Valid test token (24h expiry) can be generated using the test token generator in the backend repository.

**Example token generation:**
```powershell
# PowerShell
$token = # Generate via JWT with test-secret-key-DO-NOT-USE-IN-PRODUCTION
```

## Support

For issues or questions about API routing, refer to:
- Swagger spec: `infrastructure/api-swagger.json`
- APIM configuration: `infrastructure/modules/apim.bicep`
- Full API documentation: `docs/API_DOCUMENTATION.md`
