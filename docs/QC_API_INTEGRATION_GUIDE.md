# QC API Integration Guide

## Overview

The Quality Control (QC) API system has been successfully integrated into the Appraisal Management Platform. This document provides comprehensive guidance for using, testing, and maintaining the QC API endpoints.

## 🏗 Architecture Overview

### Core Components

1. **QC Checklist Controller** (`/api/qc/checklists/*`)
   - Create and manage QC checklists
   - Template management and cloning
   - Client/organization assignments
   - 15 REST endpoints for comprehensive checklist operations

2. **QC Execution Controller** (`/api/qc/execution/*`)
   - Execute QC reviews (sync and async)
   - Monitor execution progress and status
   - Batch execution capabilities
   - 12 REST endpoints with AI integration

3. **QC Results Controller** (`/api/qc/results/*`)
   - Query and analyze QC results
   - Generate reports and exports
   - Analytics and benchmarking
   - 20 REST endpoints for comprehensive analytics

4. **QC API Validation Middleware**
   - JWT authentication and role-based access
   - Input sanitization and validation
   - Rate limiting and security headers
   - Comprehensive error handling

## 🔐 Authentication & Authorization

### Required Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Role-Based Permissions

| Role | Permissions | Access Level |
|------|-------------|--------------|
| `admin` | All permissions (`*`) | Full system access |
| `manager` | `qc_execute`, `qc_manage`, `qc_checklist_manage`, `qc_results_view` | Management operations |
| `qc_analyst` | `qc_execute`, `qc_manage`, `qc_checklist_manage`, `qc_results_view` | QC operations |
| `appraiser` | `qc_results_view` | Read-only access |

### JWT Token Structure
```json
{
  "id": "user_id",
  "email": "user@example.com", 
  "role": "qc_analyst",
  "permissions": ["qc_execute", "qc_manage", "qc_results_view"]
}
```

## 📋 API Endpoints Reference

### QC Checklist Management

#### Create Checklist
```http
POST /api/qc/checklists
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Appraisal QC Checklist",
  "description": "Comprehensive appraisal quality control",
  "category": "appraisal",
  "documentType": "appraisal_report",
  "priority": "high",
  "items": [
    {
      "id": "item-1",
      "title": "Property Address Verification",
      "description": "Verify property address accuracy",
      "category": "property_details", 
      "criticality": "high",
      "checkType": "manual_review",
      "weight": 10,
      "validationRules": {
        "required": true,
        "mustMatch": ["subject_property"]
      }
    }
  ],
  "clientId": "client_123"
}
```

#### Search Checklists
```http
GET /api/qc/checklists?category=appraisal&status=active&limit=20
Authorization: Bearer <token>
```

#### Get Checklist Details
```http
GET /api/qc/checklists/{checklistId}
Authorization: Bearer <token>
```

### QC Execution Management

#### Execute QC Review (Synchronous)
```http
POST /api/qc/execution/execute
Content-Type: application/json
Authorization: Bearer <token>

{
  "checklistId": "checklist_456",
  "targetId": "appraisal_doc_789",
  "executionMode": "comprehensive",
  "documentData": {
    "propertyAddress": "123 Main St, City, ST 12345",
    "appraisalValue": 450000,
    "comparables": [
      {
        "address": "125 Main St",
        "salePrice": 440000,
        "adjustedValue": 445000
      }
    ]
  }
}
```

#### Execute QC Review (Asynchronous)
```http
POST /api/qc/execution/execute-async
Content-Type: application/json  
Authorization: Bearer <token>

{
  "checklistId": "checklist_456",
  "targetId": "appraisal_doc_789", 
  "executionMode": "comprehensive"
}
```

#### Check Execution Status
```http
GET /api/qc/execution/status/{executionId}
Authorization: Bearer <token>
```

### QC Results Management

#### Search Results
```http
GET /api/qc/results/search?checklistId=checklist_456&startDate=2024-01-01&endDate=2024-12-31&limit=50
Authorization: Bearer <token>
```

#### Get Analytics Summary
```http
GET /api/qc/results/analytics/summary?timeframe=last_30_days&category=appraisal
Authorization: Bearer <token>
```

#### Generate Report
```http
POST /api/qc/results/reports/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Monthly QC Report",
  "type": "summary",
  "format": "pdf",
  "filters": {
    "checklistIds": ["checklist_456"],
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  },
  "includeCharts": true
}
```

#### Export Results
```http
GET /api/qc/results/export?format=csv&checklistId=checklist_456
Authorization: Bearer <token>
```

## 🗄 Database Configuration

### Cosmos DB Containers

The following containers are automatically created during initialization:

| Container | Partition Key | Purpose |
|-----------|---------------|---------|
| `qc-checklists` | `/clientId` | QC checklist definitions |
| `qc-executions` | `/checklistId` | Execution records and results |
| `qc-results` | `/checklistId` | Historical QC results |
| `qc-sessions` | `/userId` | Active execution sessions |
| `qc-templates` | `/category` | Reusable checklist templates |

### Environment Variables

Configure these variables in your `.env` file:

```bash
# QC System Configuration
QC_EXECUTION_TIMEOUT=300000
QC_EXECUTION_MAX_CONCURRENT=10
QC_EXECUTION_RETRY_ATTEMPTS=3
QC_EXECUTION_BATCH_SIZE=50

# QC AI Integration  
QC_AI_MODEL=gpt-4
QC_AI_MAX_TOKENS=4000
QC_AI_TEMPERATURE=0.1
QC_AI_TIMEOUT=60000

# QC Cache Settings
QC_CACHE_TTL=3600
QC_CACHE_MAX_ENTRIES=10000
QC_CACHE_ENABLED=true

# QC Validation Thresholds
QC_MIN_SCORE_THRESHOLD=70
QC_WARNING_SCORE_THRESHOLD=80
QC_EXCELLENT_SCORE_THRESHOLD=95

# Database Containers
COSMOS_CONTAINER_QC_CHECKLISTS=qc-checklists
COSMOS_CONTAINER_QC_EXECUTIONS=qc-executions
COSMOS_CONTAINER_QC_RESULTS=qc-results
COSMOS_CONTAINER_QC_SESSIONS=qc-sessions
COSMOS_CONTAINER_QC_TEMPLATES=qc-templates
```

## 🧪 Testing

### Running QC API Tests

```bash
# Install dependencies
npm install

# Run comprehensive QC API tests
node scripts/test-qc-api.js

# Run specific test suites
npx jest tests/qc-api-integration.test.ts --verbose
```

### Test Coverage

The test suite covers:

- ✅ **QC Checklist Management** (15 endpoints)
- ✅ **QC Execution Management** (12 endpoints) 
- ✅ **QC Results Management** (20 endpoints)
- ✅ **Authentication & Authorization**
- ✅ **Input Validation & Security**
- ✅ **Error Handling**

### Sample Test Commands

```bash
# Test checklist creation
curl -X POST http://localhost:3000/api/qc/checklists \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Checklist","category":"appraisal"}'

# Test QC execution
curl -X POST http://localhost:3000/api/qc/execution/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"checklistId":"test-id","targetId":"doc-id"}'

# Test results search
curl -X GET "http://localhost:3000/api/qc/results/search?limit=10" \
  -H "Authorization: Bearer <token>"
```

## 🚀 Deployment

### Production Checklist

- [ ] Configure Azure Cosmos DB with production settings
- [ ] Set up proper JWT secret (minimum 256 bits)
- [ ] Configure CORS for production domains
- [ ] Set appropriate rate limiting values
- [ ] Enable HTTPS and security headers
- [ ] Configure monitoring and logging
- [ ] Set up backup strategies for QC data
- [ ] Test all QC workflows end-to-end

### Scaling Considerations

1. **Database Performance**
   - Use composite indexes for complex queries
   - Implement proper partition key distribution
   - Monitor RU consumption patterns

2. **API Performance** 
   - Enable response caching for read operations
   - Implement connection pooling
   - Use async execution for long-running QC processes

3. **Security**
   - Regular JWT secret rotation
   - Implement API versioning
   - Add request logging and audit trails

## 🔧 Troubleshooting

### Common Issues

**1. Authentication Failures**
```bash
# Verify JWT token
curl -H "Authorization: Bearer <token>" http://localhost:3000/health

# Check token expiration
node -e "console.log(require('jsonwebtoken').decode('<token>'))"
```

**2. Database Connection Issues**
```bash
# Test Cosmos DB connection
npm run test:cosmos

# Verify container creation
curl http://localhost:3000/health
```

**3. QC Execution Timeouts**
- Increase `QC_EXECUTION_TIMEOUT` value
- Check AI service availability
- Verify document data format

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug npm start
```

## 📚 Additional Resources

- **API Documentation**: `/api-docs` (Swagger UI)
- **Health Check**: `/health`
- **Source Code**: `src/controllers/qc-*.controller.ts`
- **Middleware**: `src/middleware/qc-api-validation.middleware.ts`
- **Services**: `src/services/qc-*.service.ts`

## 🤝 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review test files for usage examples
3. Consult the API documentation at `/api-docs`
4. Check service logs for error details

---

**Last Updated**: November 23, 2024
**API Version**: 1.0.0
**QC System Status**: ✅ Production Ready