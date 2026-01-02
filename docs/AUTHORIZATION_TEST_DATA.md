# Authorization Test Data Structure

## Overview
This document describes the test orders created for authorization testing and filtering verification.

## Test Orders Summary

### 1. TEST-ADMIN-001
- **Owner**: test-admin
- **Team**: team-1
- **Client**: client-1
- **Assigned Users**: None
- **Visibility**: TEAM
- **Purpose**: Base order owned by admin in team-1
- **Expected Access**:
  - ✓ Admin (owner + team-1 member)
  - ✓ Manager (if in team-1 or has client-1 access)
  - ✗ QC Analyst (different team)
  - ✗ Appraiser (different team, not assigned)

### 2. TEST-MGR-001
- **Owner**: test-manager
- **Team**: team-2
- **Client**: client-2
- **Assigned Users**: None
- **Visibility**: TEAM
- **Purpose**: Manager-owned order in separate team
- **Expected Access**:
  - ✗ Admin (different team, not in team-2)
  - ✓ Manager (owner + team-2 member)
  - ✗ QC Analyst (different team)
  - ✗ Appraiser (different team, not assigned)

### 3. TEST-MGR-002
- **Owner**: test-manager
- **Team**: team-1
- **Client**: client-1
- **Assigned Users**: None
- **Visibility**: TEAM
- **Purpose**: Test team-based filtering (shared team between admin and manager)
- **Expected Access**:
  - ✓ Admin (team-1 member)
  - ✓ Manager (owner + team-1 member)
  - ✗ QC Analyst (different team)
  - ✗ Appraiser (different team, not assigned)

### 4. TEST-QC-001
- **Owner**: test-qc-analyst
- **Team**: team-qc
- **Client**: client-qc
- **Assigned Users**: [test-qc-analyst]
- **Visibility**: ASSIGNED_ONLY
- **Purpose**: QC review order with ASSIGNED_ONLY visibility
- **Expected Access**:
  - ✗ Admin (ASSIGNED_ONLY, not assigned)
  - ✗ Manager (ASSIGNED_ONLY, not assigned)
  - ✓ QC Analyst (owner + assigned)
  - ✗ Appraiser (not assigned)

### 5. TEST-APP-001
- **Owner**: test-appraiser
- **Team**: None
- **Client**: client-appraiser
- **Assigned Users**: [test-appraiser]
- **Visibility**: ASSIGNED_ONLY
- **Purpose**: Appraiser's own order
- **Expected Access**:
  - ✗ Admin (ASSIGNED_ONLY, not assigned)
  - ✗ Manager (ASSIGNED_ONLY, not assigned)
  - ✗ QC Analyst (not assigned)
  - ✓ Appraiser (owner + assigned)

### 6. TEST-ADMIN-002
- **Owner**: test-admin
- **Team**: team-1
- **Client**: client-1
- **Assigned Users**: [test-appraiser]
- **Visibility**: TEAM
- **Purpose**: Test assignment-based access (admin assigns to appraiser)
- **Expected Access**:
  - ✓ Admin (owner + team-1 member)
  - ✓ Manager (if in team-1)
  - ✗ QC Analyst (different team, not assigned)
  - ✓ Appraiser (assigned to order)

## User Permissions Summary

### Admin (test-admin)
- **Role**: admin
- **Teams**: [team-1]
- **Clients**: [client-1]
- **Permissions**: Full access to all resources
- **Expected Order Count**: 3
  - TEST-ADMIN-001 (owned, team-1)
  - TEST-MGR-002 (team-1)
  - TEST-ADMIN-002 (owned, team-1)

### Manager (test-manager)
- **Role**: manager
- **Teams**: [team-1, team-2]
- **Clients**: [client-1, client-2]
- **Permissions**: Read/write orders in teams/clients, assign vendors
- **Expected Order Count**: 3
  - TEST-MGR-001 (owned, team-2/client-2)
  - TEST-MGR-002 (owned, team-1/client-1)
  - TEST-ADMIN-001 (team-1/client-1)

### QC Analyst (test-qc-analyst)
- **Role**: qc_analyst
- **Teams**: [team-qc]
- **Clients**: []
- **Permissions**: Read/write QC reviews, assigned orders only
- **Expected Order Count**: 1
  - TEST-QC-001 (owned, assigned)

### Appraiser (test-appraiser)
- **Role**: appraiser
- **Teams**: []
- **Clients**: []
- **Permissions**: Read/write only own orders or assigned orders
- **Expected Order Count**: 2
  - TEST-APP-001 (owned, assigned)
  - TEST-ADMIN-002 (assigned)

## Query Filter Examples

### Admin Query Filter
```sql
-- Admin sees all records (no filtering)
WHERE 1=1
```

### Manager Query Filter
```sql
-- Manager filtered by teams and clients
WHERE (
  c.accessControl.teamId IN ('team-1', 'team-2')
  OR c.accessControl.clientId IN ('client-1', 'client-2')
  OR c.accessControl.ownerId = 'test-manager'
  OR ARRAY_CONTAINS(c.accessControl.assignedUserIds, 'test-manager')
)
```

### QC Analyst Query Filter
```sql
-- QC Analyst sees only assigned or owned
WHERE (
  c.accessControl.ownerId = 'test-qc-analyst'
  OR ARRAY_CONTAINS(c.accessControl.assignedUserIds, 'test-qc-analyst')
)
```

### Appraiser Query Filter
```sql
-- Appraiser sees only assigned or owned
WHERE (
  c.accessControl.ownerId = 'test-appraiser'
  OR ARRAY_CONTAINS(c.accessControl.assignedUserIds, 'test-appraiser')
)
```

## Testing Workflow

### 1. Create Test Orders
```bash
npm run create-test-orders
```

### 2. Test Queries (Audit Mode)
```powershell
# Get orders as each user
$headers = @{ "Authorization" = "Bearer $env:TEST_JWT_ADMIN" }
Invoke-RestMethod -Uri "http://localhost:3000/api/orders" -Headers $headers

$headers = @{ "Authorization" = "Bearer $env:TEST_JWT_MANAGER" }
Invoke-RestMethod -Uri "http://localhost:3000/api/orders" -Headers $headers

$headers = @{ "Authorization" = "Bearer $env:TEST_JWT_QC_ANALYST" }
Invoke-RestMethod -Uri "http://localhost:3000/api/orders" -Headers $headers

$headers = @{ "Authorization" = "Bearer $env:TEST_JWT_APPRAISER" }
Invoke-RestMethod -Uri "http://localhost:3000/api/orders" -Headers $headers
```

### 3. Check Audit Logs
Look for log entries like:
```
[Authorization audit] Policy decision: {
  allowed: true,
  reason: 'Policy matched',
  filter: "(c.accessControl.teamId IN (@teamIds) ...)"
}
```

### 4. Enable Enforcement
```bash
# Set in .env
ENFORCE_AUTHORIZATION=true

# Restart API
npm run api
```

### 5. Verify Enforcement
- Admin should see 3 orders
- Manager should see 3 orders
- QC Analyst should see 1 order
- Appraiser should see 2 orders

### 6. Test Unauthorized Access
```powershell
# Appraiser trying to create order (should fail with 403)
$body = @{
  orderNumber = "UNAUTHORIZED-001"
  clientId = "client-1"
  # ... other fields
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/orders" `
  -Method POST `
  -Headers @{ "Authorization" = "Bearer $env:TEST_JWT_APPRAISER" } `
  -Body $body `
  -ContentType "application/json"
# Expected: 403 Forbidden (if create endpoint has authorization)
```

## Verification Checklist

- [ ] All 6 test orders created successfully
- [ ] Admin query returns 3 orders (team-1 filtering)
- [ ] Manager query returns 3 orders (team + client filtering)
- [ ] QC Analyst query returns 1 order (own + assigned)
- [ ] Appraiser query returns 2 orders (own + assigned)
- [ ] Audit logs show correct query filters for each user
- [ ] Enforcement mode blocks unauthorized access
- [ ] 403 responses for operations outside user permissions

## Next Steps After Verification

1. **Wire Authorization to More Endpoints**
   - POST /api/orders (authorize 'create')
   - PUT /api/orders/:id (authorizeResource 'update')
   - DELETE /api/orders/:id (authorizeResource 'delete')

2. **Create Cosmos DB Indexes**
   - Index on accessControl.teamId
   - Index on accessControl.clientId
   - Index on accessControl.ownerId
   - Index on accessControl.assignedUserIds (array index)

3. **Full Integration Testing**
   - Test all endpoints with all user roles
   - Verify edge cases (missing metadata, null values)
   - Performance testing with large datasets

4. **Production Rollout**
   - Enable enforcement mode globally
   - Monitor authorization decisions
   - Review and adjust policies based on usage patterns
