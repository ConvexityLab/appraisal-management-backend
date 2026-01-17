# Authentication & Authorization Architecture

## Overview

Clean separation of concerns between **authentication** (identity) and **authorization** (permissions).

```
┌───────────────────────────────────────────────────────────────┐
│ APIM (Optional Gateway)                                        │
│ - Rate limiting, IP filtering, request logging                │
│ - Can validate JWT (offload from backend)                     │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ AUTHENTICATION LAYER                                          │
│ Purpose: WHO ARE YOU?                                         │
│                                                               │
│ unified-auth.middleware.ts                                    │
│ ├─ Test tokens (development)                                 │
│ └─ Azure AD tokens (production)                              │
│     └─ azure-entra-auth.middleware.ts                        │
│         - Validate JWT signature via JWKS                    │
│         - Extract identity claims only:                      │
│           * userId (sub/oid)                                 │
│           * email (email/preferred_username/upn)             │
│           * name                                             │
│           * tenantId                                         │
│           * groups (for Casbin)                              │
│           * appRoles (for Casbin)                            │
│         - Set req.user = identity only                       │
│         - NO ROLES, NO PERMISSIONS                           │
└───────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────┐
│ AUTHORIZATION LAYER                                           │
│ Purpose: WHAT CAN YOU DO?                                     │
│                                                               │
│ authorization.middleware.ts                                   │
│                                                               │
│ 1. loadUserProfile()                                          │
│    - Query database with req.user.id                         │
│    - Load full UserProfile from Cosmos DB:                   │
│      * role (admin, manager, qc_analyst, appraiser)          │
│      * accessScope (teams, departments, regions)             │
│      * customPermissions                                     │
│    - Set req.userProfile                                     │
│                                                               │
│ 2. authorize(resourceType, action)                           │
│    - resourceType: 'order', 'vendor', 'user', 'analytics'    │
│    - action: 'create', 'read', 'update', 'delete', etc.      │
│    - Check Casbin policies (attribute-based)                 │
│    - Check access graph (relationship-based)                 │
│    - Allow/deny request                                      │
│                                                               │
│ Powered by:                                                   │
│ └─ authorization.service.ts                                   │
│     └─ casbin-engine.service.ts (policy evaluation)          │
│     └─ access-graph.service.ts (relationship checks)         │
└───────────────────────────────────────────────────────────────┘
                            ↓
                        Handler
```

---

## Authentication Flow

### Step 1: Token Validation

**File:** `unified-auth.middleware.ts` → `azure-entra-auth.middleware.ts`

```typescript
// Extract and validate JWT token
const token = req.headers.authorization.replace('Bearer ', '').trim();

// Validate signature with Azure AD public keys (cached 24h)
const payload = jwt.verify(token, signingKey, {
  algorithms: ['RS256'],
  audience: clientId,
  issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  maxAge: '24h' // Prevent old token reuse
});

// Validate required claims
if (!payload.sub && !payload.oid) throw new Error('Missing user ID');
if (!payload.email && !payload.preferred_username) throw new Error('Missing email');
if (payload.tid !== tenantId) throw new Error('Cross-tenant attack');
```

### Step 2: Extract Identity Only

**Critical:** No role mapping, no permission checks here!

```typescript
// Set identity-only user object
req.user = {
  id: payload.sub || payload.oid,           // User ID
  email: payload.email || payload.preferred_username,
  name: payload.name || 'Unknown',
  tenantId: payload.tid,
  oid: payload.oid,
  // Preserve for Casbin to reference
  groups: payload.groups || [],
  appRoles: payload.roles || []
};

// NO req.user.role
// NO req.user.permissions
// Identity extraction complete - authorization handled by Casbin
```

---

## Authorization Flow

### Step 1: Load User Profile

**File:** `authorization.middleware.ts` → `authorization.service.ts`

```typescript
// Load full profile from database
const userProfile = await authzService.getUserProfile(req.user.id, tenantId);

req.userProfile = {
  id: userId,
  email: email,
  tenantId: tenantId,
  role: 'manager', // From database, not JWT
  accessScope: {
    teamIds: ['team-1', 'team-2'],
    departmentIds: ['dept-operations'],
    managedClientIds: ['client-1', 'client-2'],
    regionIds: ['region-west'],
    statesCovered: ['CA', 'NV', 'AZ'],
    canViewAllOrders: false
  },
  customPermissions: ['special_report_access'],
  isActive: true
};
```

### Step 2: Casbin Policy Evaluation

**File:** `casbin-engine.service.ts`

```typescript
// Build authorization context
const context = {
  user: {
    id: userProfile.id,
    role: userProfile.role,
    teamIds: userProfile.accessScope.teamIds,
    departmentIds: userProfile.accessScope.departmentIds
  },
  resource: {
    type: 'order',
    id: orderId,
    ownerId: order.createdBy,
    teamId: order.teamId,
    clientId: order.clientId
  },
  action: 'update'
};

// Evaluate policies (ABAC - Attribute-Based Access Control)
const decision = await enforcer.enforce(context);

if (!decision.allowed) {
  // ENFORCED: Block request with 403
  return res.status(403).json({
    error: 'Access denied',
    reason: decision.reason,
    requiredPermissions: decision.missing
  });
}

// Allowed - proceed to handler
next();
```

---

## Route Patterns

### ❌ OLD WAY (JWT Authorization - REMOVED)

```typescript
// BAD: Hardcoded permission check in JWT middleware
this.app.post('/api/orders',
  this.unifiedAuth.authenticate(),
  this.requirePermission('order_create'), // ❌ JWT role/permission check
  createOrderHandler
);
```

**Problems:**
- Hardcoded role mappings
- Can't change permissions without code deploy
- No attribute-based checks (user's team, region, etc.)
- Competing with Casbin

### ✅ NEW WAY (Casbin Authorization)

```typescript
// GOOD: Database-driven Casbin policies
this.app.post('/api/orders',
  this.unifiedAuth.authenticate(),           // Step 1: Identity
  this.authzMiddleware.loadUserProfile(),    // Step 2: Load profile from DB
  this.authzMiddleware.authorize('order', 'create'), // Step 3: Casbin
  createOrderHandler
);
```

**Benefits:**
- Dynamic policies in database
- Attribute-based: Check user's team, department, region
- Relationship-based: Check access graph
- Easy to update without code changes
- Audit logging built-in

---

## Casbin Policies

### Policy Storage

**Location:** Cosmos DB container `authorization` with document type `policy`

**Format:** Casbin model + policies

```
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _
g2 = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

### Example Policies

```
# Role-based policies
p, role:admin, *, *
p, role:manager, order, create
p, role:manager, order, update
p, role:manager, vendor, manage
p, role:qc_analyst, order, qc_validate
p, role:qc_analyst, order, qc_execute
p, role:appraiser, order, view
p, role:appraiser, order, update

# Role assignments (from UserProfile.role)
g, user:john@example.com, role:manager
g, user:jane@example.com, role:qc_analyst

# Attribute-based policies (checked via context)
# - User's team matches resource team
# - User's department matches resource department
# - User's region covers resource state
# - Custom permissions override
```

### Enforcement Mode

**Default:** `ENFORCE_AUTHORIZATION=true` (enabled by default)

```typescript
// Environment variable controls enforcement
if (process.env.ENFORCE_AUTHORIZATION === 'false') {
  // AUDIT MODE: Log decisions but don't block
  logger.warn('Would have blocked request', { decision });
  next(); // Allow through
} else {
  // ENFORCEMENT MODE: Block unauthorized requests
  if (!decision.allowed) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}
```

**Use audit mode for testing:**
```bash
ENFORCE_AUTHORIZATION=false npm start
```

---

## Security Best Practices

### 1. JWT Validation

✅ **DO:**
- Validate signature with JWKS from Azure AD
- Check `aud` (audience) matches client ID
- Check `iss` (issuer) matches tenant
- Check `tid` (tenant ID) matches expected tenant
- Enforce `maxAge` to prevent old token reuse
- Cache JWKS keys (24h) to prevent rate limiting
- Use singleton pattern for middleware (shared cache)

❌ **DON'T:**
- Trust JWT payload without signature validation
- Accept tokens from other tenants
- Skip claim validation
- Fetch JWKS on every request
- Use test tokens in production

### 2. Authorization

✅ **DO:**
- Load UserProfile from database (single source of truth)
- Use Casbin for all authorization decisions
- Check attributes (team, department, region)
- Check relationships (access graph)
- Log all authorization decisions (audit trail)
- Enable enforcement in production
- Use audit mode for testing

❌ **DON'T:**
- Store roles/permissions in JWT
- Hardcode permission checks in routes
- Mix JWT authorization with Casbin
- Skip profile loading
- Trust client-side role claims

### 3. Separation of Concerns

```
Authentication (unified-auth)     Authorization (Casbin)
├─ JWT signature validation       ├─ Database-driven policies
├─ Tenant validation              ├─ Attribute-based checks
├─ Claim extraction               ├─ Relationship checks
├─ Identity only                  ├─ Dynamic updates
└─ req.user = { id, email }       └─ req.userProfile = full profile
```

**Never mix these layers!**

---

## Testing

### Unit Tests

```typescript
// Test authentication (identity extraction)
describe('Azure AD Authentication', () => {
  it('should extract identity from valid token', async () => {
    const token = generateAzureADToken();
    const req = { headers: { authorization: `Bearer ${token}` } };
    
    await authMiddleware.authenticate(req, res, next);
    
    expect(req.user).toEqual({
      id: '12345',
      email: 'user@example.com',
      name: 'Test User',
      tenantId: 'tenant-123'
    });
    expect(req.user.role).toBeUndefined(); // No role in auth!
  });
});

// Test authorization (Casbin policies)
describe('Casbin Authorization', () => {
  it('should allow manager to create order', async () => {
    req.userProfile = { role: 'manager', ... };
    
    await authzMiddleware.authorize('order', 'create')(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
  
  it('should deny appraiser from creating order', async () => {
    req.userProfile = { role: 'appraiser', ... };
    
    await authzMiddleware.authorize('order', 'create')(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

```bash
# Test with real Azure AD tokens
export AZURE_TENANT_ID=<your-tenant-id>
export AZURE_CLIENT_ID=<your-client-id>
export ENFORCE_AUTHORIZATION=true

npm test:integration
```

### Manual Testing

```bash
# Get Azure AD token
az account get-access-token --resource <client-id>

# Test endpoint
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/orders
```

---

## Migration from JWT Authorization

### Phase 1: ✅ COMPLETED

- [x] Simplified `azure-entra-auth.middleware.ts` to identity-only
- [x] Removed `requirePermission()` and `requireRole()` methods
- [x] Simplified `unified-auth.middleware.ts` to authentication-only
- [x] Updated `AuthenticatedUser` interface (removed role/permissions)
- [x] Changed all routes to use Casbin `authorize()` instead
- [x] Enabled Casbin enforcement by default

### Phase 2: TODO

- [ ] Configure Casbin policies in database
- [ ] Create UserProfile documents for all users
- [ ] Map Azure AD groups to application roles (in UserProfile, not JWT)
- [ ] Test all endpoints with real tokens
- [ ] Update integration tests
- [ ] Document policy management for admins

### Phase 3: TODO

- [ ] Implement policy management UI
- [ ] Add policy versioning/history
- [ ] Add real-time policy updates (without restart)
- [ ] Advanced: Implement data filtering based on policies
- [ ] Advanced: Implement field-level authorization

---

## Configuration

### Environment Variables

```bash
# Authentication
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_AUDIENCE=<optional-audience>
AZURE_ISSUER=<optional-issuer>

# Test tokens (development only)
ALLOW_TEST_TOKENS=true
TEST_JWT_SECRET=<test-secret>

# Authorization
ENFORCE_AUTHORIZATION=true  # Default: true (enable enforcement)

# Database
COSMOS_ENDPOINT=<cosmos-endpoint>
COSMOS_KEY=<cosmos-key>
COSMOS_DATABASE=appraisal-management
```

### Casbin Configuration

**Model file:** `config/casbin/model.conf`
**Policies:** Stored in Cosmos DB `authorization` container

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause:** JWT validation failed

**Check:**
1. Token not expired: `jwt.decode(token)` → check `exp`
2. Signature valid: JWKS keys cached correctly
3. Tenant ID matches: Token `tid` === `AZURE_TENANT_ID`
4. Audience correct: Token `aud` === `AZURE_CLIENT_ID`

**Logs:**
```
Azure Entra ID authentication failed: TokenExpiredError
Azure Entra ID authentication failed: JsonWebTokenError: invalid signature
Token tenant mismatch - possible cross-tenant attack
```

### Issue: 403 Forbidden

**Cause:** Casbin authorization denied

**Check:**
1. UserProfile exists in database: `users` container
2. UserProfile.role assigned correctly
3. Casbin policies configured for role
4. Resource ownership/team membership
5. Enforcement enabled: `ENFORCE_AUTHORIZATION=true`

**Logs:**
```
Authorization denied: {
  userId: 'user-123',
  resourceType: 'order',
  action: 'create',
  reason: 'No matching policy found',
  mode: 'ENFORCED'
}
```

### Issue: req.userProfile undefined

**Cause:** `loadUserProfile()` middleware not called

**Fix:** Add middleware to route:
```typescript
this.app.post('/api/orders',
  this.unifiedAuth.authenticate(),
  this.authzMiddleware.loadUserProfile(), // ← Add this!
  this.authzMiddleware.authorize('order', 'create'),
  handler
);
```

---

## Performance Considerations

### Caching

**JWKS Keys:** Cached 24h (singleton pattern ensures one cache per instance)
**Authorization Decisions:** Cached 5min (opt-in via `cacheDecision: true`)
**UserProfile:** Not cached (load on every request for consistency)

### Optimization Tips

1. **Use APIM for JWT validation** (offload crypto from backend)
2. **Enable decision caching** for read-heavy workloads
3. **Index database** for UserProfile lookups (`userId` + `tenantId`)
4. **Batch authorization checks** for multi-resource requests
5. **Use access graph** for relationship-based checks (fast graph queries)

---

## References

- [Casbin Documentation](https://casbin.org/docs/overview)
- [Azure AD Token Validation](https://learn.microsoft.com/en-us/azure/active-directory/develop/access-tokens)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Attribute-Based Access Control (ABAC)](https://csrc.nist.gov/projects/attribute-based-access-control)
