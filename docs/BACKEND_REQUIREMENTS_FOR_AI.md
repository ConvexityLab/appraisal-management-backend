# Backend API Requirements - For AI Agent Implementation

**Date**: February 8, 2026  
**From**: Frontend AI Agent  
**To**: Backend AI Agent  
**Priority**: P0 - Critical Path Blocked

---

## Context

Frontend application is fully configured and ready. All 82 API endpoints are correctly formatted and pointing to APIM gateway at `https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net`. However, backend has critical authentication issue and missing endpoint implementations.

**Frontend Configuration**:
- APIM Gateway: `https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net`
- Routing: `/api/*` → API Container, `/functions/*` → Functions Container
- All frontend routes verified correct ✅

---

## CRITICAL: Authentication Configuration Issue

### Problem Statement
All authenticated API calls receive this error:
```json
{
  "error": "Authentication failed",
  "code": "AUTH_FAILED", 
  "message": "Token tenant validation failed"
}
```

### Token Details Being Sent
```
Issuer: https://login.microsoftonline.com/885097ba-35ea-48db-be7a-a0aa7ff451bd/v2.0
Tenant ID: 885097ba-35ea-48db-be7a-a0aa7ff451bd
Audience: dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a
Client ID (azp): ee1cad4a-3049-409d-96e4-70c73fad2139
```

### Required Fix

**Locate the tenant validation code** in one of these locations:
1. Backend authentication middleware (e.g., `src/middleware/auth.middleware.js`)
2. Environment configuration (`.env` files)
3. APIM policy files (if validation happens at gateway level)
4. JWT validation configuration

**Update the allowed tenant ID**:

```javascript
// BEFORE (incorrect - causes rejection):
const ALLOWED_TENANT_ID = '<some-other-tenant-id>';

// AFTER (correct - must match frontend):
const ALLOWED_TENANT_ID = '885097ba-35ea-48db-be7a-a0aa7ff451bd';
```

**Or in .env file**:
```bash
ALLOWED_TENANT_ID=885097ba-35ea-48db-be7a-a0aa7ff451bd
AZURE_TENANT_ID=885097ba-35ea-48db-be7a-a0aa7ff451bd
```

**Validation**:
After fix, token with tenant `885097ba-35ea-48db-be7a-a0aa7ff451bd` should pass authentication.

### Affected Endpoints (18 total)
All return 401 with tenant validation error:
- GET /api/orders
- GET /api/orders?status=active&limit=10
- GET /api/orders/{orderId}
- POST /api/orders
- GET /api/orders/dashboard
- GET /api/qc-workflow/queue
- GET /api/vendors
- POST /api/vendors
- GET /api/vendors/performance/{vendorId}
- POST /api/property-intelligence/address/geocode
- POST /api/property-intelligence/address/validate
- GET /api/property-intelligence/address/suggest
- POST /api/property-intelligence/analyze/comprehensive
- GET /api/analytics/overview
- GET /api/analytics/performance
- GET /api/fraud-detection/alerts

---

## Required Endpoint Implementations (4 Missing)

### 1. GET /api/qc-workflow/queue/statistics

**Current Status**: 404 Not Found  
**Frontend Expects**: JSON object with queue statistics

**Required Implementation**:

```javascript
// File: src/routes/qc-workflow.routes.js (or similar)
router.get('/queue/statistics', authenticate, async (req, res) => {
  try {
    // Count reviews by status
    const totalInQueue = await db.qc_reviews.count({ 
      where: { status: 'pending' } 
    });
    
    const assignedReviews = await db.qc_reviews.count({ 
      where: { status: 'assigned' } 
    });
    
    const completedToday = await db.qc_reviews.count({
      where: {
        status: 'completed',
        completed_at: { 
          [Op.gte]: new Date(new Date().setHours(0,0,0,0)) 
        }
      }
    });
    
    // Calculate average wait time (in hours)
    const pendingReviews = await db.qc_reviews.findAll({
      where: { status: 'pending' },
      attributes: ['created_at']
    });
    
    const avgWaitTime = pendingReviews.length > 0
      ? pendingReviews.reduce((sum, review) => {
          const hours = (Date.now() - new Date(review.created_at)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / pendingReviews.length
      : 0;
    
    res.json({
      totalInQueue,
      avgWaitTime: Math.round(avgWaitTime * 10) / 10, // Round to 1 decimal
      assignedReviews,
      completedToday
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch queue statistics',
      message: error.message 
    });
  }
});
```

**Response Schema**:
```typescript
{
  totalInQueue: number;      // Count of pending reviews
  avgWaitTime: number;       // Hours (decimal)
  assignedReviews: number;   // Count of assigned reviews
  completedToday: number;    // Count completed today
}
```

---

### 2. POST /api/qc/execution/execute

**Current Status**: 404 Not Found  
**Frontend Expects**: JSON object with execution result

**Required Implementation**:

```javascript
// File: src/routes/qc-execution.routes.js (or similar)
router.post('/execution/execute', authenticate, async (req, res) => {
  try {
    const { orderId, reviewerId, reviewData } = req.body;
    
    // Validation
    if (!orderId) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'orderId is required' 
      });
    }
    
    if (!reviewerId) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'reviewerId is required' 
      });
    }
    
    // Create QC execution record
    const execution = await db.qc_executions.create({
      order_id: orderId,
      reviewer_id: reviewerId,
      review_data: reviewData,
      status: 'in_progress',
      started_at: new Date()
    });
    
    // Run QC validation logic (placeholder - implement actual logic)
    const validationResult = await runQCValidation(orderId, reviewData);
    
    // Update execution with results
    await execution.update({
      status: 'completed',
      completed_at: new Date(),
      result: validationResult
    });
    
    res.json({
      success: true,
      executionId: execution.id,
      orderId: orderId,
      status: 'completed',
      findings: validationResult.findings || [],
      issuesFound: validationResult.issuesCount || 0
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'QC execution failed',
      message: error.message 
    });
  }
});

// Helper function (implement actual validation logic)
async function runQCValidation(orderId, reviewData) {
  // TODO: Implement actual QC validation algorithms
  // This is a placeholder implementation
  return {
    findings: [],
    issuesCount: 0,
    passed: true
  };
}
```

**Request Schema**:
```typescript
{
  orderId: string;           // Required
  reviewerId: string;        // Required
  reviewData?: object;       // Optional review data
}
```

**Response Schema**:
```typescript
{
  success: boolean;
  executionId: string;
  orderId: string;
  status: string;            // 'completed', 'failed'
  findings: Array<object>;
  issuesFound: number;
}
```

---

### 3. GET /api/qc/results/analytics/summary

**Current Status**: 404 Not Found  
**Frontend Expects**: JSON object with analytics summary

**Required Implementation**:

```javascript
// File: src/routes/qc-results.routes.js (or similar)
router.get('/results/analytics/summary', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, reviewerId } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter[Op.gte] = new Date(startDate);
    }
    if (endDate) {
      dateFilter[Op.lte] = new Date(endDate);
    }
    
    // Build base query
    const baseWhere = {
      created_at: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
    };
    
    if (reviewerId) {
      baseWhere.reviewer_id = reviewerId;
    }
    
    // Get total reviews
    const totalReviews = await db.qc_results.count({ where: baseWhere });
    
    // Get passed reviews
    const passedReviews = await db.qc_results.count({
      where: { ...baseWhere, status: 'passed' }
    });
    
    // Calculate pass rate
    const passRate = totalReviews > 0 
      ? Math.round((passedReviews / totalReviews) * 100) 
      : 0;
    
    // Get average review time
    const reviews = await db.qc_results.findAll({
      where: baseWhere,
      attributes: ['started_at', 'completed_at']
    });
    
    const avgReviewTime = reviews.length > 0
      ? reviews.reduce((sum, review) => {
          if (review.completed_at && review.started_at) {
            const minutes = (new Date(review.completed_at) - new Date(review.started_at)) / (1000 * 60);
            return sum + minutes;
          }
          return sum;
        }, 0) / reviews.length
      : 0;
    
    // Get top issues
    const topIssues = await db.qc_issues.findAll({
      attributes: [
        'issue_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: {
        created_at: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
      },
      group: ['issue_type'],
      order: [[db.sequelize.literal('count'), 'DESC']],
      limit: 5
    });
    
    res.json({
      totalReviews,
      passRate,
      avgReviewTime: Math.round(avgReviewTime),
      topIssues: topIssues.map(issue => ({
        type: issue.issue_type,
        count: parseInt(issue.get('count'))
      })),
      dateRange: {
        start: startDate || null,
        end: endDate || null
      },
      reviewerId: reviewerId || null
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch analytics summary',
      message: error.message 
    });
  }
});
```

**Query Parameters**:
```typescript
{
  startDate?: string;    // ISO date string
  endDate?: string;      // ISO date string
  reviewerId?: string;   // Optional filter by reviewer
}
```

**Response Schema**:
```typescript
{
  totalReviews: number;
  passRate: number;              // Percentage (0-100)
  avgReviewTime: number;         // Minutes
  topIssues: Array<{
    type: string;
    count: number;
  }>;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  reviewerId: string | null;
}
```

---

### 4. POST /api/fraud-detection/analyze

**Current Status**: 404 Not Found  
**Frontend Expects**: JSON object with fraud analysis result

**Required Implementation**:

```javascript
// File: src/routes/fraud-detection.routes.js (or similar)
router.post('/analyze', authenticate, async (req, res) => {
  try {
    const { orderId, appraisalData } = req.body;
    
    // Validation
    if (!orderId) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'orderId is required' 
      });
    }
    
    // Fetch order data if not provided
    let dataToAnalyze = appraisalData;
    if (!dataToAnalyze) {
      const order = await db.orders.findByPk(orderId, {
        include: ['appraisal_data']
      });
      if (!order) {
        return res.status(404).json({ 
          error: 'Order not found',
          message: `Order ${orderId} does not exist` 
        });
      }
      dataToAnalyze = order.appraisal_data;
    }
    
    // Run fraud detection algorithms
    const analysis = await analyzeFraudRisk(orderId, dataToAnalyze);
    
    // Store analysis result
    const fraudAnalysis = await db.fraud_analyses.create({
      order_id: orderId,
      risk_score: analysis.riskScore,
      risk_level: analysis.riskLevel,
      flags: analysis.flags,
      analyzed_at: new Date()
    });
    
    res.json({
      analysisId: fraudAnalysis.id,
      orderId: orderId,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      flags: analysis.flags,
      recommendations: analysis.recommendations,
      timestamp: fraudAnalysis.analyzed_at
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Fraud analysis failed',
      message: error.message 
    });
  }
});

// Helper function for fraud detection
async function analyzeFraudRisk(orderId, appraisalData) {
  // TODO: Implement actual fraud detection algorithms
  // This is a placeholder implementation
  
  const flags = [];
  let riskScore = 0;
  
  // Example checks (implement real logic):
  
  // 1. Value manipulation check
  if (appraisalData.value && appraisalData.comparables) {
    const avgCompValue = appraisalData.comparables.reduce((sum, comp) => 
      sum + comp.value, 0) / appraisalData.comparables.length;
    
    const deviation = Math.abs(appraisalData.value - avgCompValue) / avgCompValue;
    
    if (deviation > 0.2) { // 20% deviation
      flags.push({
        type: 'value_manipulation',
        severity: 'high',
        description: 'Appraisal value significantly different from comparables'
      });
      riskScore += 40;
    }
  }
  
  // 2. Rapid transaction check
  if (appraisalData.previousSaleDate) {
    const daysSinceLastSale = (Date.now() - new Date(appraisalData.previousSaleDate)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSale < 90) { // Less than 3 months
      flags.push({
        type: 'property_flipping',
        severity: 'medium',
        description: 'Property sold recently (possible flipping)'
      });
      riskScore += 25;
    }
  }
  
  // Determine risk level
  let riskLevel;
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 30) riskLevel = 'medium';
  else riskLevel = 'low';
  
  // Generate recommendations
  const recommendations = [];
  if (riskScore > 50) {
    recommendations.push('Manual review recommended');
    recommendations.push('Verify all comparable properties');
  }
  if (flags.some(f => f.type === 'property_flipping')) {
    recommendations.push('Investigate previous transaction details');
  }
  
  return {
    riskScore,
    riskLevel,
    flags,
    recommendations
  };
}
```

**Request Schema**:
```typescript
{
  orderId: string;              // Required
  appraisalData?: object;       // Optional, fetched from DB if not provided
}
```

**Response Schema**:
```typescript
{
  analysisId: string;
  orderId: string;
  riskScore: number;            // 0-100
  riskLevel: string;            // 'low' | 'medium' | 'high' | 'critical'
  flags: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  recommendations: Array<string>;
  timestamp: Date;
}
```

---

## Functions Container Issues (Lower Priority)

### Issue 1: runInteractiveAvm - 500 Error

**Endpoint**: `POST /functions/runInteractiveAvm`  
**Current Status**: 500 Internal Server Error

**Action Required**:
1. Check Azure Functions logs for stack trace
2. Locate the error in the function code
3. Common issues to check:
   - Missing environment variables
   - Database connection failures
   - External API timeouts
   - Invalid input data handling

**No specific code required** - debug existing implementation

---

### Issue 2: createOrder - 400 Validation

**Endpoint**: `POST /functions/createOrder`  
**Current Status**: 400 - `{"error":"Field 'clientId' is required and cannot be blank"}`

**Action Required**:
1. Document the complete request schema required
2. Return better error messages listing all required fields
3. Optionally: Make clientId optional with a default value

**Example improvement**:
```javascript
// Improved validation with clear error messages
const requiredFields = ['clientId', 'propertyAddress', 'orderType'];
const missingFields = requiredFields.filter(field => !req.body[field]);

if (missingFields.length > 0) {
  return res.status(400).json({
    error: 'Validation failed',
    message: 'Missing required fields',
    missingFields: missingFields,
    requiredSchema: {
      clientId: 'string',
      propertyAddress: 'string',
      orderType: 'string',
      // ... list all fields
    }
  });
}
```

---

## Validation Steps

After implementing the fixes, verify with these tests:

### 1. Test Authentication
```bash
curl -X GET https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/orders \
  -H "Authorization: Bearer <token-with-tenant-885097ba>"
```

**Expected**: NOT 401 with tenant validation error  
**Expected**: 200 OK or different error (e.g., 404 if no orders exist)

### 2. Test Queue Statistics
```bash
curl -X GET https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/qc-workflow/queue/statistics \
  -H "Authorization: Bearer <token>"
```

**Expected**: 200 OK with JSON containing `totalInQueue`, `avgWaitTime`, etc.

### 3. Test QC Execution
```bash
curl -X POST https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/qc/execution/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-123","reviewerId":"reviewer-456"}'
```

**Expected**: 200 OK with execution result

### 4. Test QC Analytics
```bash
curl -X GET "https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/qc/results/analytics/summary?startDate=2026-01-01&endDate=2026-02-08" \
  -H "Authorization: Bearer <token>"
```

**Expected**: 200 OK with analytics data

### 5. Test Fraud Detection
```bash
curl -X POST https://apim-appraisal-staging-nktl4aetqq2h4.azure-api.net/api/fraud-detection/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-123"}'
```

**Expected**: 200 OK with fraud analysis result

---

## Automated Test Suite

Frontend has a test script at `test-apim-routes.js`. After completing fixes, run:

```bash
node test-apim-routes.js --token "<your-jwt-token>"
```

**Success Criteria**:
- 0 "Token tenant validation failed" errors
- 0 404 errors on implemented endpoints
- All endpoints return 200 OK or appropriate error codes (400 for validation, etc.)

---

## Summary Checklist

- [ ] **CRITICAL**: Fix tenant validation to accept `885097ba-35ea-48db-be7a-a0aa7ff451bd`
- [ ] Implement `GET /api/qc-workflow/queue/statistics`
- [ ] Implement `POST /api/qc/execution/execute`
- [ ] Implement `GET /api/qc/results/analytics/summary`
- [ ] Implement `POST /api/fraud-detection/analyze`
- [ ] Debug `POST /functions/runInteractiveAvm` 500 error
- [ ] Improve `POST /functions/createOrder` validation messages
- [ ] Run automated test suite and verify all pass

---

## Database Schema Assumptions

The code examples assume these tables exist. Adjust field names to match your actual schema:

- `qc_reviews` (id, status, created_at, completed_at, reviewer_id)
- `qc_executions` (id, order_id, reviewer_id, review_data, status, started_at, completed_at, result)
- `qc_results` (id, order_id, reviewer_id, status, started_at, completed_at, created_at)
- `qc_issues` (id, result_id, issue_type, severity, created_at)
- `orders` (id, client_id, property_address, appraisal_data)
- `fraud_analyses` (id, order_id, risk_score, risk_level, flags, analyzed_at)

If your schema is different, adjust the code accordingly but maintain the same response structures.

---

**Questions?** The frontend AI agent is ready to clarify any requirements or provide additional context.
