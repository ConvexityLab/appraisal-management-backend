# Authorization Testing Guide

## Overview

You now have **interactive authorization testing endpoints** at `/api/authz-test/*` that let you test authorization decisions, query filtering, and access control in real-time.

## Quick Start

### 1. Get Your Profile

**Request:**
```powershell
$admin_token = $env:TEST_JWT_ADMIN
$headers = @{ Authorization = "Bearer $admin_token" }
Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/profile -Headers $headers | ConvertTo-Json -Depth 5
```

**Response:**
```json
{
  "user": {
    "id": "test-admin",
    "email": "admin@test.local",
    "role": "admin",
    "permissions": ["*"],
    "accessScope": {
      "teamIds": ["team-all"],
      "canViewAllOrders": true
    }
  },
  "interpretation": {
    "can_view_all": true,
    "teams": ["team-all"],
    "clients": ["client-all"]
  }
}
```

### 2. Test Authorization Decision

Check if you can perform specific actions:

**Request:**
```powershell
$body = @{
  resourceType = "order"
  resourceId = "order-123"
  action = "read"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/check `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -ContentType "application/json" | ConvertTo-Json -Depth 5
```

**Response:**
```json
{
  "decision": {
    "allowed": true,
    "reason": "Admin has full access"
  },
  "user": {
    "id": "test-admin",
    "email": "admin@test.local",
    "role": "admin"
  }
}
```

### 3. Get Query Filter

See what filter would be applied to your queries:

**Request:**
```powershell
$body = @{
  resourceType = "order"
  action = "read"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/filter `
  -Method POST `
  -Headers $headers `
  -Body $body `
  -ContentType "application/json" | ConvertTo-Json -Depth 5
```

**Response (Admin - No Filter):**
```json
{
  "filter": {
    "sql": "1=1",
    "parameters": []
  },
  "interpretation": {
    "message": "User can see ALL resources"
  }
}
```

**Response (Manager - Filtered):**
```json
{
  "filter": {
    "sql": "c.accessControl.teamId IN (@team0, @team1) OR c.accessControl.clientId IN (@client0, @client1)",
    "parameters": [
      { "name": "@team0", "value": "team-1" },
      { "name": "@team1", "value": "team-2" }
    ]
  },
  "interpretation": {
    "message": "User can only see FILTERED resources"
  }
}
```

## Test with Different Users

### Admin (Full Access)
```powershell
$headers = @{ Authorization = "Bearer $env:TEST_JWT_ADMIN" }
```

### Manager (Team-Scoped)
```powershell
$headers = @{ Authorization = "Bearer $env:TEST_JWT_MANAGER" }
```

### QC Analyst (Assigned Items)
```powershell
$headers = @{ Authorization = "Bearer $env:TEST_JWT_QC_ANALYST" }
```

### Appraiser (Own Items Only)
```powershell
$headers = @{ Authorization = "Bearer $env:TEST_JWT_APPRAISER" }
```

## Test Scenarios

### Scenario 1: Check Team-Specific Access

Test if a user can access an order belonging to a specific team:

```powershell
$manager_headers = @{ Authorization = "Bearer $env:TEST_JWT_MANAGER" }

$body = @{
  resourceType = "order"
  resourceId = "order-123"
  action = "read"
  accessControl = @{
    teamId = "team-1"
    clientId = "client-1"
    ownerId = "other-user"
    assignedUserIds = @()
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/check `
  -Method POST `
  -Headers $manager_headers `
  -Body $body `
  -ContentType "application/json"
```

**Expected:** Manager can see it (team-1 is in their scope)

### Scenario 2: Check Outside-Scope Access

```powershell
$body = @{
  resourceType = "order"
  resourceId = "order-456"
  action = "read"
  accessControl = @{
    teamId = "team-99"  # Not in manager's scope!
    clientId = "client-99"
    ownerId = "other-user"
    assignedUserIds = @()
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/check `
  -Method POST `
  -Headers $manager_headers `
  -Body $body `
  -ContentType "application/json"
```

**Expected:** Manager CANNOT see it (team-99 not in scope)

### Scenario 3: Grant Special Access (Admin Only)

Admins can grant special access via the access graph:

```powershell
$admin_headers = @{ Authorization = "Bearer $env:TEST_JWT_ADMIN" }

$body = @{
  targetUserId = "test-appraiser"
  objectType = "order"
  objectId = "order-special"
  actions = @("read", "update")
  reason = "Special project assignment"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/grant `
  -Method POST `
  -Headers $admin_headers `
  -Body $body `
  -ContentType "application/json"
```

This creates an **exception** - the appraiser can now access `order-special` even if it's outside their normal scope!

## CLI Script

You can also run a comprehensive test from the command line:

```bash
npm run test:authorization
```

This will:
- Test all 4 users against various resources
- Show policy decisions (allowed/denied)
- Display query filters for each user
- Test access graph relationships

## Audit Mode vs Enforcement Mode

Currently in **AUDIT MODE** (`ENFORCE_AUTHORIZATION=false`):
- ✅ Policies are evaluated
- ✅ Decisions are logged
- ❌ Requests are NOT blocked

When you're ready, enable **ENFORCEMENT MODE**:
```env
ENFORCE_AUTHORIZATION=true
```

Then unauthorized requests will be blocked with 403 Forbidden.

## Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/authz-test/profile` | GET | Show your auth profile and access scope |
| `/api/authz-test/check` | POST | Test if you can perform an action |
| `/api/authz-test/filter` | POST | Get query filter for a resource type |
| `/api/authz-test/grant` | POST | Grant special access (admin only) |
| `/api/authz-test/scenarios` | GET | Get example test scenarios |

## Example: Complete Workflow

```powershell
# 1. Get your profile
$token = $env:TEST_JWT_MANAGER
$headers = @{ Authorization = "Bearer $token" }

Write-Host "1. Your Profile:"
Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/profile -Headers $headers | ConvertTo-Json

# 2. Get your query filter
Write-Host "`n2. Your Query Filter:"
$filter_body = @{ resourceType = "order"; action = "read" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/filter -Method POST -Headers $headers -Body $filter_body -ContentType "application/json" | ConvertTo-Json -Depth 5

# 3. Check if you can create orders
Write-Host "`n3. Can You Create Orders?"
$check_body = @{ resourceType = "order"; action = "create" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/check -Method POST -Headers $headers -Body $check_body -ContentType "application/json" | ConvertTo-Json

# 4. Check access to specific order
Write-Host "`n4. Can You Access Order in Team-1?"
$access_body = @{
  resourceType = "order"
  resourceId = "order-123"
  action = "read"
  accessControl = @{
    teamId = "team-1"
    clientId = "client-1"
    ownerId = "test-admin"
  }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri http://localhost:3000/api/authz-test/check -Method POST -Headers $headers -Body $access_body -ContentType "application/json" | ConvertTo-Json
```

## Observing Audit Logs

When hitting protected endpoints (like `/api/orders`), check the server logs for:

```
🔍 AUDIT MODE: Would apply query filter
  userId: test-manager
  email: manager@test.local
  role: manager
  resourceType: order
  filter: { sql: "c.accessControl.teamId IN (@team0, @team1)", ... }
```

This shows what WOULD happen if enforcement was enabled!

## Next Steps

1. ✅ Test with different users using `/api/authz-test/*`
2. ✅ Observe audit logs on GET `/api/orders`
3. ✅ Verify query filters match expectations
4. 🔄 Enable enforcement on one endpoint: `ENFORCE_AUTHORIZATION=true`
5. 🔄 Test with real data
6. 🔄 Roll out to more endpoints
7. 🔄 Full production enforcement

Happy testing! 🚀
