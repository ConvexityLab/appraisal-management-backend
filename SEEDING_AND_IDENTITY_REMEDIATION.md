# Seeding & Identity Remediation

## The Problem

Three separate namespaces were conflated, causing data written by seed scripts, live-fire tests, and
the backend to be invisible to the UI after a real Azure AD login.

| Namespace | Field | Wrong value in use | Correct value |
|---|---|---|---|
| Auth / Azure AD | `tenantId` | `test-tenant` or `test-tenant-123` | `885097ba-35ea-48db-be7a-a0aa7ff451bd` |
| Axiom business | `clientId` | same as auth `tenantId` (wrong) | `test-client` |
| Axiom business | `subClientId` | same as auth `tenantId` (wrong) | `test-sub-client` |

### Why it breaks

1. The UI authenticates with Azure AD → JWT contains `tid: 885097ba-...`
2. Unified-auth middleware sets `req.tenantId = payload.tenantId` (from JWT)
3. The UI queries the backend → backend queries Cosmos with `WHERE c.tenantId = '885097ba-...'`
4. All seed data was written with `tenantId: 'test-tenant'` or `tenantId: 'test-tenant-123'`
5. Zero results returned → UI appears empty

Additionally, `axiom.service.ts` was passing `tenantId` (the AAD GUID) as Axiom's `subClientId` in
every POST to Axiom's `/api/pipelines`. This means Axiom was receiving the wrong business identity
on every evaluation submission.

---

## What Needs to be Re-seeded and Why

All containers that are partitioned by `/tenantId` (the majority) contain data stamped with
`tenantId: 'test-tenant'`. This data is unreachable from any real AAD-authenticated session.

Containers affected (partition key `/tenantId`):
- `orders`
- `engagements`
- `clients`
- `vendors`
- `documents`
- `qc-reviews`
- `qc-checklists`
- `assignments`
- `communications`
- `properties`
- `reports`
- `revisions`
- `escalations`
- `audit-events`
- `timelines`
- `sla-config`
- `matching-criteria`
- `arv-analyses`
- `inspections`
- `bulk-portfolios`
- `construction` (and related)
- `review-programs`
- `pdf-templates`
- `report-templates`
- `quickbooks`
- `communication-platform`

Additionally, all records need `clientId: 'test-client'` and `subClientId: 'test-sub-client'`
stamped on them so that future `clientId`/`subClientId` query filters work correctly.

---

## Pre-Conditions Before Re-Seeding

All 8 remediation steps below must be complete before re-seeding, because the seed script reads
`AZURE_TENANT_ID` from `.env` and the test JWTs must match what's in Cosmos:

1. ✅ Bicep: Entra directory extension attributes registered (`clientId`, `subClientId`)
2. ✅ `unified-auth.middleware.ts`: extracts `clientId`/`subClientId` from JWT payload
3. ✅ `TestTokenGenerator`: mints tokens with correct `tenantId`, `clientId`, `subClientId`
4. ✅ `.env`: test tokens regenerated with correct claims
5. ✅ `axiom.service.ts`: uses context-sourced `clientId`/`subClientId`, not `tenantId`
6. ✅ Seed scripts updated to stamp `clientId` + `subClientId` on every record

---

## How to Re-Seed

### 1. Confirm `.env` values

```
AZURE_TENANT_ID=885097ba-35ea-48db-be7a-a0aa7ff451bd
COSMOS_ENDPOINT=<your azurite or real cosmos endpoint>
AXIOM_CLIENT_ID=test-client
AXIOM_SUB_CLIENT_ID=test-sub-client
```

### 2. Wipe existing seed data

```bash
cd c:/source/appraisal-management-backend
npx tsx src/scripts/seed/index.ts --clean-only
```

This removes all documents with `id` prefixed `seed-` across all containers.

### 3. Re-seed everything

```bash
npx tsx src/scripts/seed/index.ts --clean
```

This wipes then re-seeds all modules in dependency order (clients → products → vendors → orders → ...).

### 4. Verify

```bash
# Confirm orders visible under correct tenantId
node -e "
const { CosmosClient } = require('@azure/cosmos');
require('dotenv/config');
const client = new CosmosClient(process.env.COSMOS_ENDPOINT);
client.database('appraisal-management').container('orders')
  .items.query({ query: 'SELECT COUNT(1) as n FROM c WHERE c.tenantId = @t', parameters: [{ name: '@t', value: process.env.AZURE_TENANT_ID }] })
  .fetchAll().then(r => console.log(r.resources));
"
```

---

## Seed Script Changes Required (todo item 6)

The seed orchestrator (`src/scripts/seed/index.ts`) passes a `SeedContext` to each module.
`SeedContext` currently carries `tenantId`. It needs to additionally carry `clientId` and
`subClientId` so each module stamps them on every document it writes.

### Changes to `SeedContext` type (`seed-types.ts`):
```typescript
export interface SeedContext {
  tenantId: string;      // from AZURE_TENANT_ID — auth/Cosmos partition
  clientId: string;      // from AXIOM_CLIENT_ID — business domain
  subClientId: string;   // from AXIOM_SUB_CLIENT_ID — business domain
  databaseId: string;
  cosmosClient: CosmosClient;
  // ... existing fields
}
```

### Changes to `index.ts`:
```typescript
const ctx: SeedContext = {
  tenantId:    process.env['AZURE_TENANT_ID']!,
  clientId:    process.env['AXIOM_CLIENT_ID']!,
  subClientId: process.env['AXIOM_SUB_CLIENT_ID']!,
  // ...
};
if (!ctx.tenantId)    throw new Error('AZURE_TENANT_ID is required');
if (!ctx.clientId)    throw new Error('AXIOM_CLIENT_ID is required');
if (!ctx.subClientId) throw new Error('AXIOM_SUB_CLIENT_ID is required');
```

Each module (orders, engagements, etc.) must then include `clientId: ctx.clientId` and
`subClientId: ctx.subClientId` on every document it upserts.

---

## Identity Values (single source of truth)

| Field | Dev/Test Value | Production |
|---|---|---|
| `tenantId` (auth) | `885097ba-35ea-48db-be7a-a0aa7ff451bd` | Real AAD tenant GUID — from JWT `tid` claim |
| `clientId` | `test-client` | From JWT custom claim `clientId` (set via Entra extension attribute) |
| `subClientId` | `test-sub-client` | From JWT custom claim `subClientId` (set via Entra extension attribute) |
| `TEST_JWT_SECRET` | `a8e71c1f6be4b9a4f568926975f596b40e60657dfce55d3f4e819fc258fdcfb32f6558ffbe8280507c372d44659d03f7` | N/A (test only) |
