# Test JWT Tokens - Quick Start Guide

## 🎯 Purpose

This system provides a unified authentication middleware that supports **both**:
1. **Azure Entra ID tokens** (production)
2. **Test JWT tokens** (development/testing)

This allows you to test the API with full authentication and authorization without requiring Azure AD login during development.

## 🚀 Quick Start

### 1. Generate Test Tokens

```bash
npm run generate-test-tokens
```

This creates `.env.test-tokens` with tokens for all test users:
- **Admin** - Full access
- **Manager** - Team/client management
- **QC Analyst** - Assigned items only
- **Appraiser** - Owned items only

### 2. Enable Test Tokens

Add to your `.env` file:

```bash
# Enable test tokens (DEVELOPMENT ONLY)
ALLOW_TEST_TOKENS=true

# Copy the tokens from .env.test-tokens
TEST_JWT_ADMIN=eyJhbGciOiJI...
TEST_JWT_MANAGER=eyJhbGciOiJI...
TEST_JWT_QC_ANALYST=eyJhbGciOiJI...
TEST_JWT_APPRAISER=eyJhbGciOiJI...

# Set the active test token
TEST_JWT_TOKEN=${TEST_JWT_ADMIN}
```

### 3. Test the API

```bash
# Using curl
curl -H "Authorization: Bearer $TEST_JWT_ADMIN" \
     http://localhost:3000/api/orders

# Using Postman/Insomnia
#  1. Add header: Authorization: Bearer <token>
#  2. Paste token from .env.test-tokens

# Using tests
process.env.TEST_JWT_TOKEN = process.env.TEST_JWT_ADMIN;
const response = await fetch('http://localhost:3000/api/orders', {
  headers: { 'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN}` }
});
```

## 👥 Test Users

### Admin User
```javascript
{
  email: "admin@test.local",
  role: "admin",
  permissions: ["*"],  // All permissions
  tenantId: "test-tenant",
  accessScope: {
    canViewAllOrders: true,
    canViewAllVendors: true,
    canOverrideQC: true
  }
}
```

### Manager User
```javascript
{
  email: "manager@test.local",
  role: "manager",
  permissions: [
    "order_manage", "order_view", "order_update",
    "vendor_manage", "vendor_assign",
    "analytics_view", "qc_metrics", "qc_validate"
  ],
  tenantId: "test-tenant",
  accessScope: {
    teamIds: ["team-1", "team-2"],
    managedClientIds: ["client-1", "client-2", "client-3"],
    regionIds: ["region-west"],
    statesCovered: ["CA", "NV", "AZ"]
  }
}
```

### QC Analyst User
```javascript
{
  email: "qc.analyst@test.local",
  role: "qc_analyst",
  permissions: [
    "qc_validate", "qc_execute", "qc_metrics",
    "order_view", "revision_create", "escalation_create"
  ],
  tenantId: "test-tenant",
  accessScope: {
    teamIds: ["team-qc"],
    regionIds: ["region-west"],
    statesCovered: ["CA", "NV"]
  }
}
```

### Appraiser User
```javascript
{
  email: "appraiser@test.local",
  role: "appraiser",
  permissions: [
    "order_view", "order_update",
    "revision_create", "escalation_create"
  ],
  tenantId: "test-tenant",
  accessScope: {
    teamIds: ["team-appraisers"],
    regionIds: ["region-west"],
    statesCovered: ["CA"]
  }
}
```

## 🔄 Switching Between Users

To test different permission levels, just swap the token:

```bash
# Test as admin
export TEST_JWT_TOKEN=$TEST_JWT_ADMIN
curl -H "Authorization: Bearer $TEST_JWT_TOKEN" http://localhost:3000/api/orders

# Test as appraiser (limited access)
export TEST_JWT_TOKEN=$TEST_JWT_APPRAISER
curl -H "Authorization: Bearer $TEST_JWT_TOKEN" http://localhost:3000/api/orders
```

Or in your test code:

```typescript
// Test with different users
describe('Order Authorization', () => {
  it('admin should see all orders', async () => {
    const token = process.env.TEST_JWT_ADMIN;
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThan(0);
  });

  it('appraiser should only see assigned orders', async () => {
    const token = process.env.TEST_JWT_APPRAISER;
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    // Should be filtered to assigned orders only
  });
});
```

## 🔒 Security

### ⚠️ CRITICAL WARNINGS

1. **NEVER enable test tokens in production**
   ```bash
   # Production .env should have:
   ALLOW_TEST_TOKENS=false  # or not set at all
   ```

2. **Test tokens are identified by `isTestToken: true` flag**
   - The middleware automatically rejects them if `ALLOW_TEST_TOKENS != true`
   - They are valid for 24 hours

3. **Test token secret is different from production JWT secret**
   - Test: `TEST_JWT_SECRET`
   - Production: Uses Azure AD public keys (JWKS)

### How It Works

```
Incoming Request
   ↓
Authorization: Bearer <token>
   ↓
Decode JWT (no verification yet)
   ↓
Check: isTestToken === true?
   ├─ YES → Is ALLOW_TEST_TOKENS=true?
   │           ├─ YES → Verify with TEST_JWT_SECRET
   │           │         ├─ Valid → Load test user profile
   │           │         └─ Invalid → 401 Error
   │           └─ NO → 401 Error (test tokens not allowed)
   │
   └─ NO → Verify with Azure AD (JWKS)
              ├─ Valid → Load Azure AD user profile
              └─ Invalid → 401 Error
```

## 📝 Integration Testing Example

```typescript
import request from 'supertest';
import { app } from './api/api-server';

describe('Authorization Integration Tests', () => {
  const adminToken = process.env.TEST_JWT_ADMIN!;
  const managerToken = process.env.TEST_JWT_MANAGER!;
  const appraiserToken = process.env.TEST_JWT_APPRAISER!;

  describe('POST /api/orders', () => {
    it('admin can create orders', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ /* order data */ });
      
      expect(res.status).toBe(201);
    });

    it('appraiser cannot create orders', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${appraiserToken}`)
        .send({ /* order data */ });
      
      expect(res.status).toBe(403);  // Forbidden
    });
  });

  describe('GET /api/orders', () => {
    it('admin sees all orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.orders).toBeDefined();
    });

    it('manager sees team orders only', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(res.status).toBe(200);
      // Orders should be filtered by team/client
      res.body.orders.forEach((order: any) => {
        expect(['team-1', 'team-2']).toContain(order.accessControl.teamId);
      });
    });
  });
});
```

## 🧪 Environment Variables

```bash
# Required for test tokens
ALLOW_TEST_TOKENS=true               # Enable test token validation
TEST_JWT_SECRET=test-secret-...      # Secret for signing test tokens
TEST_JWT_EXPIRES_IN=24h              # Token expiration

# Test tokens (generated by script)
TEST_JWT_ADMIN=eyJhbGciOiJIUzI1NiI...
TEST_JWT_MANAGER=eyJhbGciOiJIUzI1NiI...
TEST_JWT_QC_ANALYST=eyJhbGciOiJIUzI1NiI...
TEST_JWT_APPRAISER=eyJhbGciOiJIUzI1NiI...

# Active token (swap this to change user)
TEST_JWT_TOKEN=${TEST_JWT_ADMIN}
```

## 🎭 Role-Based Testing Scenarios

### Scenario 1: Order Creation
```bash
# Admin - Should work
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TEST_JWT_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"propertyAddress": "123 Main St", "clientId": "client-1"}'

# Appraiser - Should fail (403)
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TEST_JWT_APPRAISER" \
  -H "Content-Type: application/json" \
  -d '{"propertyAddress": "123 Main St", "clientId": "client-1"}'
```

### Scenario 2: QC Validation
```bash
# QC Analyst - Should work
curl -X POST http://localhost:3000/api/qc/validate/order-123 \
  -H "Authorization: Bearer $TEST_JWT_QC_ANALYST"

# Appraiser - Should fail (403)
curl -X POST http://localhost:3000/api/qc/validate/order-123 \
  -H "Authorization: Bearer $TEST_JWT_APPRAISER"
```

### Scenario 3: Analytics Access
```bash
# Manager - Should work
curl http://localhost:3000/api/analytics/overview \
  -H "Authorization: Bearer $TEST_JWT_MANAGER"

# Appraiser - Should fail (403)
curl http://localhost:3000/api/analytics/overview \
  -H "Authorization: Bearer $TEST_JWT_APPRAISER"
```

## 📚 Related Documentation

- `docs/AUTHORIZATION_SYSTEM.md` - Full authorization architecture
- `src/middleware/unified-auth.middleware.ts` - Authentication implementation
- `src/utils/test-token-generator.ts` - Token generation logic
- `scripts/generate-test-tokens.ts` - CLI token generator

## 💡 Tips

1. **Regenerate tokens when they expire (24h)**
   ```bash
   npm run generate-test-tokens
   ```

2. **Use different tokens for different test scenarios**
   - Don't rely on a single admin token
   - Test both allowed and forbidden actions

3. **Test authorization failures**
   - Verify 403 responses for unauthorized actions
   - Verify 401 responses for invalid tokens

4. **Profile sync**
   - Test users are automatically synced to the database
   - Check `users` container in Cosmos DB

5. **Token inspection**
   - Decode tokens at https://jwt.io to inspect claims
   - Verify permissions and access scope match expectations
