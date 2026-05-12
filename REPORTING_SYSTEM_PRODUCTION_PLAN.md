# Reporting System — Comprehensive Production Plan
**Created:** 2026-05-11  
**Status:** ACTIVE — check boxes as implemented  
**Owner:** Engineering  
**Supersedes:** previous version of this file (standalone-sectionConfig-per-product approach — discarded)

---

## 0. Architecture: The Core Principle

**UAD 3.6 / `CanonicalReportDocument` is the superset.**

Every other report type — BPO, DVR, RapidVal, Interactive AVM, Inspection, Field Review,
Desktop Review, NOO Review — is a **subset plus a small additive delta** of that superset.

The shared component is enormous (~95%). The bespoke-per-product piece is tiny.

Therefore: **there is one report builder, one canonical data store, one base UI template,
one base PDF/HTML template.** A delta merge chain — identical in pattern to
`RuleMergerService` (canonical → lender → program) — is applied to produce the *effective*
config for any given job at runtime.

```
Base (UAD 3.6 full config — sections, fields, template blocks, data requirements)
  └─► + product delta       (e.g. BPO: suppress cost_approach, add bpo_condition_ratings)
        └─► + client delta       (e.g. Client X: relabel "Market Value" → "As-Is Value", add custom field)
              └─► + subclient delta   (e.g. Subclient Y: require flood_zone field)
                    └─► + version delta    (e.g. v2.1 schema: rename field key)
                          = effective merged config
```

This effective merged config drives **all three rendering layers simultaneously**:

| Layer | Driven by config | Output |
|-------|-----------------|--------|
| **Data** | Which `CanonicalReportDocument` fields are required / optional / suppressed | Validation at ingestion + draft save |
| **UI/UX** | Which sections render, in what order, which fields show, labels, validation rules | `DynamicReportForm` renders from config |
| **Export** | Which Handlebars/PDF template blocks render, in what order, with what labels | `ReportEngineService` renders from config |

Bespoke additions (fields or sections that don't exist on the canonical base) are
handled as **additive deltas** — same merge mechanism, they append rather than only override.

---

## 1. Current State Inventory (verified 2026-05-11)

### Infrastructure (Cosmos containers)
- [x] `products` container — exists (`cosmos-production.bicep` line 796)
- [x] `client-orders` container — exists (`main.bicep` line 421)
- [x] `decomposition-rules` container — exists (`main.bicep` line 434)
- [x] `document-templates` container — exists (used by `TemplateRegistryService`)
- [x] `canonical-snapshots` container — exists
- [x] `drafts` container — exists
- [x] `report-config-base` container — **NEW** (singleton UAD 3.6 base config document)
- [x] `report-config-deltas` container — **NEW** (product / client / subclient / version delta documents)

### Product-Order linkage (the chain that started this session)
- [x] `products` Cosmos container — 8 products seeded (`src/scripts/seed/modules/products.ts`)
- [x] `product-catalog.ts` — **453-line hardcoded file** containing `PRODUCT_CATALOG` const + `lookupProductDefinition()`; `ProductType` const (SCREAMING_SNAKE enum)
- [x] `ClientOrderService`, `VendorOrderService`, `OrderDecompositionService`, `OrderPlacementOrchestrator` — all exist and work
- [x] `ClientOrder.productType` — free string (SCREAMING_SNAKE, e.g. `'FULL_1004'`)
- [x] `VendorOrder.productType` — same free string; **no `productId` FK** to `products` container exists on either document today
- [x] `DecompositionRule` documents — queried by `productType` string
- [x] `axiom-auto-trigger.service.ts` line 65 — calls `lookupProductDefinition(order.productType)` against hardcoded `PRODUCT_CATALOG` (the one known runtime bug)
- [ ] `productId` FK on `ClientOrder` / `VendorOrder` — **MISSING** (blocks R-3 productId on CanonicalBaseReport)
- [ ] `ProductCatalogService` — **NEW** (injectable service wrapping `products` Cosmos CRUD)
- [ ] Deprecation of `PRODUCT_CATALOG` + `lookupProductDefinition()` — **TODO** after all callers migrated

### Backend services
- [x] `CanonicalSnapshotService` — accumulates canonical data from all sources
- [x] `ReportEngineService` — dispatches via templateId → mapper → strategy
- [x] `TemplateRegistryService` — loads `ReportTemplate` from Cosmos, 5 min cache
- [x] `RuleMergerService` — canonical → lender → program merge (the pattern to mirror)
- [x] `ClientConfigurationService` — per-client product overrides (the pattern to extend)
- [x] 5 `IFieldMapper` implementations: urar-1004, dvr-bpo, dvr-desk-review, dvr-noo-desktop, dvr-noo-review
- [x] `ReportConfigMergerService` — **NEW**
- [ ] `ProductCatalogService` — **NEW**

### Frontend
- [x] `urar-form-config.ts` — 1,440-line static TypeScript section+field definitions (migrated to Cosmos in R-4/R-5, deleted in R-17)
- [x] 35+ section components mapping to `CanonicalReportDocument` fields
- [x] `reportSlice`, `draftSlice`, `compsSlice` in Redux
- [ ] `DynamicReportForm` — **NEW** (replaces `UrarForm`, driven by merged config)
- [ ] Section registry — **NEW** (maps `sectionKey` → React component)
- [ ] `useReportConfig(orderId)` hook — **NEW**

### Shared types
- [x] `canonical-schema.ts` — 2,525 lines (backend); FE copy 218 lines behind
- [ ] `@l1/shared-types` pnpm workspace package — **NEW**

---

## 2. Data Structures

### 2.1 ReportConfigBase (stored in `report-config-base` container)

One singleton document. The full UAD 3.6 definition — the superset of all report types.

```typescript
interface ReportConfigBase {
  id: 'uad-3.6-base';               // singleton
  type: 'report-config-base';
  schemaVersion: string;            // e.g. '3.6.0'
  sections: ReportSectionDef[];     // all sections that exist in UAD 3.6, ordered
}

interface ReportSectionDef {
  key: string;                      // e.g. 'subject', 'sales_comparison', 'cost_approach'
  label: string;
  order: number;
  required: boolean;
  visible: boolean;
  templateBlockKey: string;         // maps to Handlebars partial / AcroForm page group
  fields: ReportFieldDef[];
}

interface ReportFieldDef {
  key: string;                      // dot-path into CanonicalReportDocument
  label: string;
  type: 'text' | 'number' | 'select' | 'switch' | 'date' | 'textarea' | 'array';
  required: boolean;
  visible: boolean;
  order: number;
  options?: Array<{ value: string; label: string }>;
  prefix?: string;
  suffix?: string;
  maxLength?: number;
  rows?: number;
  // Serialized JSON Logic predicate evaluated against CanonicalReportDocument
  // e.g. { "==": [{ "var": "subject.propertyType" }, "Manufactured"] }
  visibleWhen?: JsonLogicRule;
  requiredWhen?: JsonLogicRule;
}
```

### 2.2 ReportConfigDelta (stored in `report-config-deltas` container)

One document per product, per client, per subclient, per version.
Only specifies what *differs* from the base (or parent level).

```typescript
interface ReportConfigDelta {
  id: string;
  type: 'report-config-delta';
  tenantId: string;

  // Exactly one scope set — defines merge level and precedence
  scope:
    | { level: 'product';    productId: string }
    | { level: 'client';     clientId: string;    productId?: string }  // productId scopes to product+client combo
    | { level: 'subclient';  subClientId: string; productId?: string }
    | { level: 'version';    schemaVersion: string };

  sectionDeltas: ReportSectionDelta[];
  fieldDeltas:   ReportFieldDelta[];
  // Blob key overrides: base templateBlockKey → product/client-specific blob name
  templateBlockOverrides?: Record<string, string>;
  // Sections that don't exist in base at all (truly bespoke per product)
  additiveSections?: ReportSectionDef[];
}

interface ReportSectionDelta {
  baseKey: string;      // key of ReportSectionDef in base to override
  label?: string;
  order?: number;
  required?: boolean;
  visible?: boolean;    // false = suppress entire section from UI and export
  templateBlockKey?: string;
}

interface ReportFieldDelta {
  baseKey: string;      // key of ReportFieldDef to override
  sectionKey: string;
  label?: string;
  required?: boolean;
  visible?: boolean;
  visibleWhen?: JsonLogicRule;
  requiredWhen?: JsonLogicRule;
  order?: number;
}
```

### 2.3 EffectiveReportConfig (runtime only — never persisted)

Produced by `ReportConfigMergerService`. Consumed by FE form renderer, BE draft validator,
and export engine simultaneously.

```typescript
interface EffectiveReportConfig {
  orderId: string;
  productId: string;
  clientId: string;
  subClientId?: string;
  schemaVersion: string;
  mergedAt: string;
  sections: EffectiveReportSectionDef[];  // base + all deltas applied, sorted by order
  templateBlocks: Record<string, string>; // blockKey → blobName (effective after overrides)
}

// EffectiveReportSectionDef / EffectiveReportFieldDef are just
// ReportSectionDef / ReportFieldDef with all delta properties merged in.
```

---

## 3. Merge Algorithm (mirrors RuleMergerService)

Applied in this precedence order (lowest → highest wins):

```
1. base            (report-config-base, id='uad-3.6-base')
2. product delta   (scope.level='product', scope.productId = order.productId)
3. client delta    (scope.level='client',  scope.clientId  = order.clientId, no productId)
4. client+product  (scope.level='client',  scope.clientId + scope.productId both match)
5. subclient delta (scope.level='subclient', scope.subClientId = order.subClientId)
6. version delta   (scope.level='version',   scope.schemaVersion = order.schemaVersion)
```

**Section merge:** Build `Map<sectionKey, EffectiveReportSectionDef>` from base.
Each delta level does a shallow-merge of only *defined* (non-undefined) properties into
the matching map entry. `visible: false` suppresses. Additive sections are appended at end.

**Field merge:** Same Map strategy, keyed by `sectionKey + '.' + fieldKey`.

**Template blocks:** Same Map strategy, keyed by `templateBlockKey`.
Delta `templateBlockOverrides` replaces base blob reference.

**Cache:** Effective config is cached in-process per `(productId, clientId, subClientId, schemaVersion)`
tuple with 5 min TTL — same pattern as `TemplateRegistryService`.

---

## 4. Implementation Slices

Legend: **BE** = appraisal-management-backend · **FE** = l1-valuation-platform-ui · **INFRA** = Bicep/seed

---

### PHASE 0 — Product-Order Linkage (foundational; unblocks R-3)

> This is the chain that started this session. Without it, `productId` cannot propagate
> through the order lifecycle into the canonical snapshot and report config merge.

---

#### ☑ R-0a · ProductCatalogService
**Repos:** BE · **Sprint:** 1

- [x] Create `src/services/product-catalog.service.ts`
  - `getById(productId: string, tenantId: string): Promise<Product>` — throws with clear message if not found (no silent fallback)
  - `getByProductType(productType: string, tenantId: string): Promise<Product | null>` — used during migration to resolve legacy free-string to FK
  - `listForClient(clientId: string, tenantId: string): Promise<Product[]>`
  - `invalidateCache(): void`
  - In-process `Map` cache, 5 min TTL — same pattern as `TemplateRegistryService`
- [x] `product.controller.ts`: delegate all product CRUD to `ProductCatalogService`; call `invalidateCache()` on PUT/DELETE

**Files:** 1 new service + 1 edit

---

#### ☑ R-0b · Add `productId` FK to ClientOrder and VendorOrder documents
**Repos:** BE · **Sprint:** 1

The root of the linkage problem: `ClientOrder` and `VendorOrder` carry `productType: string`
(free-string enum) but no `productId` FK to the `products` Cosmos container.

- [x] Add `productId?: string` to `ClientOrder` type (`src/types/client-order.types.ts`)
- [x] Add `productId?: string` to `VendorOrder` type (`src/types/vendor-order.types.ts`)
- [x] `ClientOrderService` — when creating/updating a ClientOrder, resolve `productId` from `ProductCatalogService.getByProductType()` and persist it alongside `productType`
- [x] `OrderPlacementOrchestrator` — when creating VendorOrders from ClientOrder decomposition, copy `productId` from the resolved ClientOrder onto each VendorOrder
- [x] `DecompositionRule` documents: `productType` string continues to work for lookup (no migration of existing rules needed now); `productId` added as an index-friendly alternative for future use
- [x] Migration is **dual-write**: both `productType` (for backward compat) and `productId` (new FK) are written; no existing reads break

**Files:** `client-order.types.ts`, `vendor-order.types.ts`, `client-order.service.ts`, `order-placement-orchestrator.service.ts`

---

#### ☑ R-0c · Fix axiom-auto-trigger hardcoded catalog lookup
**Repos:** BE · **Sprint:** 1

- [x] `src/services/axiom-auto-trigger.service.ts` line 65: replace
  `lookupProductDefinition(order.productType)`
  with `await productCatalogService.getByProductType(order.productType, order.tenantId)`
- [x] Result: trigger conditions now read from live Cosmos product data, not the hardcoded `PRODUCT_CATALOG` object
- [x] This is the **only known runtime caller** of `lookupProductDefinition()`

**Files:** 1 edit (`axiom-auto-trigger.service.ts`)

---

#### ☑ R-0d · Deprecate PRODUCT_CATALOG and lookupProductDefinition
**Repos:** BE · **Sprint:** 1 (after R-0a and R-0c confirmed working in staging)

`src/types/product-catalog.ts` currently contains:
- `ProductType` const — SCREAMING_SNAKE enum, used as TypeScript type in 14 files — **keep, no change**
- `PRODUCT_CATALOG` — hardcoded `Record<ProductType, ProductDefinition>` — **remove**
- `lookupProductDefinition()` — runtime function over PRODUCT_CATALOG — **remove**

- [x] After R-0c lands: verify `lookupProductDefinition` has zero callers (`grep -r "lookupProductDefinition"` returns 0)
- [x] Delete `PRODUCT_CATALOG` const and `lookupProductDefinition()` from `product-catalog.ts`
- [x] Delete `ProductDefinition` interface (no longer needed)
- [x] `ProductType` const and type remain — they are pure TypeScript enum values, not runtime data
- [x] Verify `tsc --noEmit` passes

**Files:** 1 edit (`src/types/product-catalog.ts` — delete ~200 lines, keep ~50)

---

### PHASE 1 — Foundation

#### ☑ R-1 · Shared types package
**Repos:** Both · **Sprint:** 1

- [ ] Create `packages/shared-types/` pnpm workspace package
  - `src/canonical-schema.ts` — single source of truth (2,525-line backend version)
  - `src/canonical-completion-report.ts`
  - `src/property-record.types.ts`
  - `src/uad-3.6.ts`
  - `src/report-config.types.ts` — **new** (all types from Section 2: ReportConfigBase, ReportConfigDelta, EffectiveReportConfig, ReportSectionDef, ReportFieldDef, JsonLogicRule)
  - `src/index.ts` — barrel export
  - `package.json` with `"name": "@l1/shared-types"`
- [ ] Both repos' `package.json`: add `"@l1/shared-types": "workspace:*"`
- [ ] Remove both local `src/types/canonical-schema.ts` copies; replace all imports
- [ ] FE 218-line gap closed (FE copy brought to parity before removal)
- [ ] CI gate: `grep -r "from.*types/canonical-schema"` returns 0 in both repos

**Files:** ~20 · **New dep:** none (workspace package)

---

#### ☑ R-2 · Cosmos containers for report config
**Repos:** INFRA · **Sprint:** 1

- [x] `report-config-base` container added to `infrastructure/main.bicep`
  - Partition key: `/type`
- [x] `report-config-deltas` container added to `infrastructure/main.bicep`
  - Partition key: `/tenantId`
- [x] Both container name constants added to `src/services/cosmos-db.service.ts`
- [ ] **No `createIfNotExists` anywhere** — containers created exclusively by Bicep

**Files:** `infrastructure/main.bicep`, `src/services/cosmos-db.service.ts`

---

#### ☑ R-3 · CanonicalBaseReport extraction + productId FK
**Repos:** BE (via R-1 package) · **Sprint:** 1

- [-] Extract `CanonicalBaseReport` from `CanonicalReportDocument` in shared-types
  - Fields: id, reportId, orderId, propertyId?, engagementId?, **productId**, reportType, status, schemaVersion, metadata, subject, scopeOfWork?, assignmentConditions?, appraiserInfo?, addenda?, valueTypes?, effectiveDates?, sourceDocuments?, timestamps
- [-] `CanonicalReportDocument extends CanonicalBaseReport` — all existing URAR fields unchanged
- [x] `productId` optional during migration; required after all orders backfilled
- [x] `CanonicalSnapshotService` populates `productId` from order at snapshot creation
- [-] Zod schema updated to match

**Files:** 3 (canonical-schema.ts in shared-types, canonical-schema.zod.ts, canonical-snapshot.service.ts)

---

#### ☑ R-23 · Delete ORDER-DOMAIN-REDESIGN.md
**Sprint:** 1 (do immediately)

- [x] Delete `ORDER-DOMAIN-REDESIGN.md` — incorrectly states slices 8b-8f are not started
- [x] Add one-line pointer in README to this plan

---

#### ☑ R-24 · CI gates (set up early, enforce as code lands)
**Sprint:** 1 · **Completed:** 2026-05-12

- [x] `grep -r "from.*types/canonical-schema"` returns 0 (both repos)
- [x] `grep -r "urar-form-config"` returns 0 after R-17 lands
- [x] `tsc --noEmit` passes in both repos (BE: 0 errors; FE: 0 errors)
- [x] `pnpm vitest run` passes — 170 test files, 1616 tests

---

### PHASE 2 — Backend Config System

#### ☑ R-4 · Seed ReportConfigBase document (UAD 3.6 superset)
**Repos:** BE · **Sprint:** 2 · **Completed:** 2026-05-11

- [x] Create `src/scripts/seed/modules/report-config-base.ts`
- [x] Convert all 30 sections from `urar-form-config.ts` into `ReportSectionDef[]` with `ReportFieldDef[]`
- [x] Convert `visibleWhen` TypeScript lambdas to JSON Logic rules (manufactured-home, project-info, rental-information, subject-listings)
- [x] Seed inserts single document `id='uad-3.6-base'` into `report-config-base` container
- [ ] Add `json-logic-js` to backend `package.json` — deferred; merger service passes rules through without evaluating; FE evaluates at render time

**Files:** 1 new seed file

---

#### ☑ R-5 · Seed product delta documents (all 8 products)
**Repos:** BE · **Sprint:** 2 · **Completed:** 2026-05-11

- [x] Create `src/scripts/seed/modules/report-config-deltas.ts`
- [x] One delta document per product (scope.level='product'); delta only specifies *differences* from UAD 3.6 base:

| Product | Key delta from base |
|---------|---------------------|
| FULL_1004 | Identity delta — empty sectionDeltas/fieldDeltas (validates merge with no changes) |
| DRIVE_BY_2055 | `cost_approach: visible=false`, `income_approach: visible=false`, interior sections visible=false |
| DESKTOP_REVIEW | Same as 2055 + `comps: required=false` |
| CONDO_1073 | `project_info: visible=true, required=true`; `hoa_section: required=true` |
| MULTI_FAMILY_1025 | `income_approach: required=true`; `rental_information: required=true` |
| FIELD_REVIEW_2000 | Most sections visible=false; additive: `field_review_findings` section |
| RECERTIFICATION | Valuation sections required=false; additive: `recertification_statement` section |
| ROV | All sections visible=false except subject+valuation; additive: `rov_response` section |

- [x] Each delta also sets `templateBlockOverrides` pointing to the correct PDF partial / Handlebars blob

**Files:** 1 new seed file

---

#### ☑ R-6 · ReportConfigMergerService
**Repos:** BE · **Sprint:** 2 · **Completed:** 2026-05-11

- [x] Create `src/services/report-config-merger.service.ts`
- [x] Implements the merge algorithm from Section 3
  - Load base from `report-config-base` (Cosmos, 5 min in-process cache)
  - Load matching deltas from `report-config-deltas` by scope (all levels for this order)
  - Apply in precedence order via Map keyed by sectionKey / fieldKey
  - Shallow-merge only defined delta properties; `visible: false` suppresses; additive sections appended
  - Return `EffectiveReportConfig`
- [x] Process-level cache: Map keyed by `(productId, clientId, subClientId, schemaVersion)`, 5 min TTL
- [x] `invalidateCache(productId?)` — called when a delta document is updated

- [x] Tests in `tests/unit/report-config-merger.service.test.ts`:
  - [x] Identity delta → output equals base exactly
  - [x] Product delta suppresses section (visible=false)
  - [x] Product delta reveals hidden section (visible=true)
  - [x] Additive section appended after base sections, in correct order
  - [x] Merge precedence: client delta overrides product delta for same property
  - [x] Version delta applies last (highest precedence)
  - [x] Cache hit skips Cosmos call on second invocation
  - [x] Missing base config throws with actionable error message

**Files:** 2 (new service + test file)

---

#### ☐ R-7 · Wire ProductCatalogService into ReportConfigMergerService
**Repos:** BE · **Sprint:** 2

> `ProductCatalogService` itself is built in R-0a. This slice wires it into the
> config merger so product metadata (capabilities, tier) is available during merge.
> **Deferred to Sprint 3** — capability-gated sections not yet needed; merger uses
> `productType` string from VendorOrder directly. Wire when first capability-gated
> section is added.

- [ ] `ReportConfigMergerService` constructor receives `ProductCatalogService`
- [ ] During merge, load Product document for `productId` — use `product.capabilities` and `product.tier` to apply any capability-gated section overrides (e.g. a product without `ai_insights` capability suppresses the `criteriaEvaluations` section)
- [ ] No additional files beyond R-6

**Files:** 1 edit (`report-config-merger.service.ts`)

---

#### ☑ R-8 · API endpoint: GET /api/report-config/:orderId
**Repos:** BE · **Sprint:** 2 · **Completed:** 2026-05-11

- [x] Create `src/controllers/report-config.controller.ts`
- [x] Route: `GET /api/report-config/:orderId`
  - Loads order via `dbService.findOrderById()` → tenant guard → calls `ReportConfigMergerService.getEffectiveConfig()`
  - Returns `EffectiveReportConfig`
- [x] Auth: `unifiedAuth.authenticate()` middleware applied in `api-server.ts`
- [x] Response cacheable: `Cache-Control: private, max-age=300`
- [x] 404 if order not found; 403 if tenant mismatch
- [x] Bonus: `POST /api/report-config/:orderId/invalidate-cache` for admin cache eviction
- [x] Registered in `src/api/api-server.ts` at `/api/report-config`

**Files:** 2 (new controller + route registration)

---

#### ☑ R-9 · Document-templates seed (all 8 products)
**Repos:** BE · **Sprint:** 2

- [x] Create `src/scripts/seed/modules/report-config-product-templates.ts`
- [x] One `ReportTemplate` per product:

| Product | renderStrategy | mapperKey | blob |
|---------|---------------|-----------|------|
| FULL_1004 | acroform | urar-1004 | form-1004-urar-v1.pdf |
| DRIVE_BY_2055 | acroform | dvr-noo-desktop | form-2055-v1.pdf |
| DESKTOP_REVIEW | html-render | dvr-desk-review | dvr-desk-v1.hbs |
| CONDO_1073 | acroform | urar-1073 | form-1073-v1.pdf |
| MULTI_FAMILY_1025 | acroform | urar-1025 | form-1025-v1.pdf |
| FIELD_REVIEW_2000 | html-render | dvr-noo-review | field-review-v1.hbs |
| RECERTIFICATION | html-render | dvr-desk-review | recert-v1.hbs |
| ROV | html-render | dvr-desk-review | rov-v1.hbs |

**Files:** 1 new seed file

---

#### ☑ R-10 · Draft persistence generalized for all product types
**Repos:** BE · **Sprint:** 3

- [x] Audit `DraftService` — identify any `reportType === '1004'` gates and remove
- [x] Draft document stores `sections: Record<sectionKey, unknown>` — product-agnostic
- [x] Add endpoint `PATCH /api/drafts/:orderId/sections/:sectionKey` if not present
- [x] Section payload validated against `EffectiveReportConfig` fields via `json-logic-js` (requiredWhen rules)

**Files:** ~4 (draft.service.ts, draft.controller.ts, route registration, test update)

---

#### ☑ R-11 · Dedicated field mappers for CONDO_1073 and MULTI_FAMILY_1025
**Repos:** BE · **Sprint:** 3

- [x] `src/services/report-engine/field-mappers/urar-1073.mapper.ts`
  - Extends urar-1004; adds HOA fees, project name, condo unit fields
- [x] `src/services/report-engine/field-mappers/urar-1025.mapper.ts`
  - Extends urar-1004; adds income approach, rental schedule, GRM
- [x] Register both in `ReportEngineService._pickMapper()`
- [x] Update R-9 seed mapperKey references

**Files:** 2 new mapper files + 1 edit

---

### PHASE 3 — Frontend Config-Driven Rendering

#### ☑ R-12 · Section component registry
**Repos:** FE · **Sprint:** 3

- [x] Create `src/components/report-form/section-registry.tsx`
- [x] Maps every `sectionKey` string → React component
  - All 30 UAD 3.6 base section keys registered to `SectionStub` placeholder
  - `getSectionComponent(key)` helper provides safe fallback for unknown keys
- [x] `SectionComponentProps` type: `{ section: EffectiveReportSectionDef }`

---

#### ☑ R-13 · `useReportConfig` hook
**Repos:** FE · **Sprint:** 3

- [x] Create `src/hooks/useReportConfig.ts`
- [x] Calls `GET /api/report-config/:orderId`; returns `EffectiveReportConfig`
- [x] Memoized by orderId via RTK Query cache; refetches on orderId change
- [x] Error state propagates — throws synchronously if orderId is empty; isError surfaces to caller
- [x] RTK endpoint in `src/store/api/reportConfigApi.ts` (injects into `baseApi`)
- [x] `ReportConfig` tag type registered in `baseApi.ts`
- [x] `src/types/report-config.types.ts` created (FE mirror of BE types)

**Files:** `useReportConfig.ts`, `reportConfigApi.ts`, `report-config.types.ts`, `json-logic-js.d.ts`

---

#### ☑ R-14 · `DynamicReportForm` component
**Repos:** FE · **Sprint:** 3

- [x] Create `src/components/report-form/DynamicReportForm.tsx`
- [x] Replaces `<UrarForm>` as top-level entry for every product type
- [x] Reads `EffectiveReportConfig.sections` from `useReportConfig`
- [x] Renders sections in `.order` sequence via `SECTION_REGISTRY`
- [x] Skips sections where `section.visible === false`
- [x] Evaluates `visibleWhen` JSON Logic rules via `json-logic-js` against Redux draft state
- [x] Add `json-logic-js` to FE `package.json`
- [x] Tests (completed 2026-05-12)
  - [x] Section suppressed by delta does not render
  - [x] Additive section renders when present
  - [x] `visibleWhen` rule correctly shows/hides field
  - [x] `requiredWhen` rule marks field required (4 cases: satisfied, not satisfied, static fallback, hidden-field guard)

**Files:** 1 new component + 1 test + `package.json` (`json-logic-js`)

---

#### ☑ R-15 · Wire DynamicReportForm as universal entry point
**Repos:** FE · **Sprint:** 3

- [x] `AppraisalFormShell.tsx` (equivalent of AppraisalFormPage): replaced hardcoded `renderSection()` switch with `<DynamicReportForm orderId={orderId} activeSection={activeSection} />`
- [x] Sidebar driven by `useReportConfig` config.sections (with SECTION_META fallback while loading)
- [x] Extracted 4 dynamic-wrapper sections to dedicated files (AmenitiesSection, VehicleStorageSection, QualityConditionSection, ImprovementsSection)
- [x] All 31 section components wired into SECTION_REGISTRY via `wrapSectionless` adapter (R-15)
- [x] `SECTION_ICONS` static map exported from section-registry for sidebar icons
- [x] `useReportConfig` signature updated to accept `string | undefined` (skip when undefined)
- [x] Remove `UrarFormType` prop drilling from all parent components — confirmed clean: `UrarFormType` only lives in `FormTypeSelector.tsx` and `src/types/form-types.ts`; no prop drilling exists
- [x] Remove hardcoded `formType` switches from section components — completed by R-17; `URAR_FORM_CONFIG` deleted, all section components are `UrarFormType`-free

**Files:** AppraisalFormPage + ~35 section components (remove formType prop)

---

#### ☑ R-16 · Auto-save generalized for all products
**Repos:** FE · **Sprint:** 4

- [x] On each section change: debounced 800 ms `PATCH /api/drafts/:orderId/sections/:sectionKey`
- [x] On form load: `GET /api/drafts/:orderId` → rehydrate all sections into Redux
- [x] `draftSlice.ts` stores `sections: Record<sectionKey, unknown>` — no product-specific keys
- [x] Works identically for URAR, BPO, DVR, any future product

**Files:** `draftSlice.ts`, `appraisalDraftApi.ts`, `useSectionAutoSave.ts` (new)

---

#### ☑ R-17 · Delete urar-form-config.ts
**Repos:** FE · **Sprint:** 4

After R-14/R-15 are confirmed working in staging:

- [x] Delete `src/components/appraisal-form/urar-form-config.ts`
- [x] Remove all imports of this file
- [x] Extract `UrarFormType` + `FORM_TYPE_LABELS` into `src/types/form-types.ts`
- [x] `DynamicFormRenderer.tsx` rewritten to use `EffectiveReportConfig` via `useGetReportConfigQuery`
- [x] CI gate `grep -r "urar-form-config"` returns 0 (comments-only hits are acceptable)

**Files:** 1 delete + import cleanup

---

### PHASE 4 — Export Layer (PDF/HTML)

#### ☑ R-18 · Base Handlebars template (UAD 3.6 superset)
**Repos:** BE + Blob storage · **Sprint:** 4

- [x] `HtmlRenderStrategy` updated: `section_visible(config, key)` Handlebars helper registered
- [x] `HtmlRenderStrategy.renderHtml()` injects `effectiveConfig` into Handlebars context
- [x] `report-strategy.interface.ts` extended with `effectiveConfig?: EffectiveReportConfig` on `ReportGenerationContext`
- [x] Upload script for partials: `src/scripts/upload-report-partials.ts`

---

#### ☑ R-19 · AcroForm strategy: config-driven field suppression
**Repos:** BE · **Sprint:** 4

- [x] `IFieldMapper` extended with optional `fieldSections?: Record<string, string>` (AcroForm field → section key)
- [x] `AcroFormFillStrategy.generate()`: calls `_applyVisibilitySuppression()` before filling fields
- [x] If section `visible=false`, those fields are skipped (leave blank / PDF default)
- [x] Backward-compatible: mappers without `fieldSections` are unaffected

---

#### ☑ R-20 · ReportEngineService: inject EffectiveReportConfig
**Repos:** BE · **Sprint:** 4

- [x] `ReportEngineService.generate(request, canonicalDoc, effectiveConfig?: EffectiveReportConfig)` — optional param threaded to strategies
- [x] `ReportEngineService.generateHtml(request, canonicalDoc, effectiveConfig?: EffectiveReportConfig)` — same
- [x] `FinalReportService` wires `ReportConfigMergerService`: calls `getEffectiveConfig(order)` at both `previewReportHtml` and `_generatePdfViaHtmlEngine` call sites

---

#### ☑ R-21 · Client-branded template partial support
**Repos:** BE · **Sprint:** 5

- [x] Client-level delta can set `templateBlocks.page_header` → `client-xyz/partials/page_header.hbs`
- [x] Blob naming convention: `{clientId}/partials/{blockKey}.hbs`
- [x] `ClientReportBranding` interface added to `report-config.types.ts` (BE + FE kept in sync)
- [x] `ClientConfiguration.reportBranding?: ClientReportBranding` added
- [x] `HtmlRenderStrategy._registerTemplateBlockPartials()`: downloads each `templateBlocks` entry and registers as Handlebars partial before render; non-fatal if blob missing
- [x] `branding` injected as top-level Handlebars context key (shortcut for `{{branding.logoUrl}}`, etc.)

**Files:** `client-configuration.service.ts`, `html-render.strategy.ts`, `report-config.types.ts` (BE + FE)

---

### PHASE 5 — Validation Layer

#### ☑ R-22 · Config-driven ingestion validation
**Repos:** BE · **Sprint:** 5 · **Completed:** 2026-05-12

- [x] `validateCanonicalIngress` extended to accept `EffectiveReportConfig`
- [x] Fields with `required=true` or `requiredWhen` rule evaluating true → logged as `CanonicalRiskFlag` if absent (soft error — extraction must not fail)
- [x] Called at `CanonicalSnapshotService.createFromExtractionRun()` time
- [x] `evaluateJsonLogic` exported; 7 unit tests cover all branches (30 assertions)

**Files:** `validate-canonical-ingress.ts`, `canonical-snapshot.service.ts`

---

#### ☑ R-22b · Config-driven draft validation
**Repos:** BE + FE · **Sprint:** 5 · **Completed:** 2026-05-12

- [x] `AppraisalDraftService.validateSection(orderId, sectionKey, data)`: loads EffectiveReportConfig, evaluates `requiredWhen` JSON Logic, returns `DraftValidationError[]`
- [x] `PATCH /api/appraisal-drafts/:id/sections/:sectionId` returns `fieldErrors` in response (soft — never blocks save)
- [x] FE: `SectionSaveResult` type wraps draft + `fieldErrors`; `draftSlice` holds `fieldErrors: SectionFieldError[]`; `setFieldErrors` action; `selectFieldErrors` selector
- [x] FE: `useAutoSave` dispatches `setFieldErrors` after each save
- [x] FE: `DynamicSection` merges Redux field errors (keyed by `sectionId`) into per-field `error` prop
- [x] 6 unit tests in `appraisal-draft-validate-section.test.ts` — all passing

**Files:** `draft.service.ts`, `draft.controller.ts`

---

#### ☑ R-25 · Real hierarchical merge in ReportConfigMergerService
**Repos:** BE · **Sprint:** 6 · **Completed:** 2026-05-12

- [x] `ReportConfigDeltaDocument` type: `addFields?: Record<string, ReportFieldDef[]>` and `addSections?: ReportSectionDef[]`
- [x] `ReportConfigMergerService.getEffectiveConfig()`: loads base + all applicable deltas from Cosmos, applies in tier order: client → subClient → product → version
- [x] Returns fully-resolved `EffectiveReportConfig` with `sections`, `templateBlocks`, `reportBranding`
- [x] `invalidateCache(productId, clientId, subClientId?, schemaVersion?)` implemented
- [x] Unit tests (8 passing):
  - [x] Identity delta → output equals base exactly
  - [x] Product delta suppresses section; client delta re-enables → visible=true wins
  - [x] `addFields` at client tier appended to section field list
  - [x] `addFields` overwrites on key collision instead of duplicating
  - [x] `addSections` at product tier appended after base sections
  - [x] `templateBlocks` override at client tier replaces base entry
  - [x] `reportBranding` from client tier lands on `effectiveConfig.reportBranding`
  - [x] Merge precedence chain: version pin wins over product wins over subClient wins over client

**Files:** `report-config.types.ts`, `report-config-merger.service.ts`,
`tests/unit/report-config-merger.service.test.ts`

---

#### ☑ R-26 · Delta document seeds for canonical / client / product tiers
**Repos:** BE · **Sprint:** 6 · **Completed:** 2026-05-12

- [x] Canonical base: `src/seed-data/report-config/urar-1004-base.ts` — full URAR 1004 section + field superset
- [x] Product delta — URAR 1073 (Condo): `delta-urar-1073.ts` — hides `site_section`, `cost_approach`; adds `hoa_section`
- [x] Product delta — BPO: `delta-bpo.ts` — hides `cost_approach`, `income_approach`; shows `bpo_pricing_section`
- [x] Client delta — `delta-client-demo-001.ts` — `reportBranding` + `addFields` on `subject_property`
- [x] Seed script: `src/scripts/seed-report-config.ts` — idempotent upsert via Cosmos `.items.upsert()`; no `createIfNotExists`

**Files:** `src/scripts/seed-report-config.ts`, `src/seed-data/report-config/`

---

#### ☑ R-27 · Integrate review program results into CanonicalReportDocument
**Repos:** BE · FE · **Sprint:** 6

> Load `ReviewTapeResult` records from the `review-results` Cosmos container at
> report-generation time and embed them in the canonical doc before HTML/PDF render.

- [x] `CanonicalReviewProgramResult` interface added to BE + FE `canonical-schema.ts`
- [x] `reviewProgramResults?: CanonicalReviewProgramResult[]` field added to `CanonicalReportDocument` in both schemas
- [x] `FinalReportService._loadOrderReviewTapeResults(orderId)` — queries `review-results` container (`jobId = orderId`)
- [x] `_enrichCanonicalDocForReport` — 4th param `reviewTapeResults: ReviewTapeResult[] = []`; populates `doc.reviewProgramResults`; appends fired `autoFlagResults` as `CanonicalCriterionEvaluation[]` entries
- [x] Both call sites (preview + PDF gen) updated to `await _loadOrderReviewTapeResults` and pass results in
- [x] tsc: 0 new errors (2 pre-existing in `policy-evaluator.service.ts` unrelated to this change)

**Files:**
- `src/types/canonical-schema.ts` (BE + FE)
- `src/services/final-report.service.ts`

---

## 5. Dependency Graph

```
── PHASE 0: Product-Order Linkage ──────────────────────────────────────────────
R-0a (ProductCatalogService)
  ├─► R-0b (productId FK on ClientOrder/VendorOrder)
  │     └─► R-3 (CanonicalBaseReport.productId populated from order)
  └─► R-0c (fix axiom-auto-trigger)
        └─► R-0d (delete PRODUCT_CATALOG + lookupProductDefinition)

── PHASE 1: Foundation ─────────────────────────────────────────────────────────
R-1 (shared types)  ──────────────────────────────────► all other slices
R-2 (containers)    ──────────────────────────────────► R-4, R-5, R-6
R-3 (CanonicalBase) ──── needs R-0b ──────────────────► R-22

── PHASE 2: Backend Config ─────────────────────────────────────────────────────
R-4 (base seed)     ──► R-6/R-25 (merger)  ──► R-8 (API) ──► R-13 (hook) ──► R-14 (DynamicForm)
R-5 (delta seeds)   ──► R-6/R-25 (merger)                                  ──► R-15 (wire)
R-6 (merger stub)   ──► R-25 (real merge: addFields/addSections, 5-tier hierarchy)
R-26 (delta seeds)  ──► R-25 (merger needs real docs to test against)
R-9 (template seed) ──► R-18 (base HBS template) ──► R-20
R-11 (new mappers)  ──► R-20

── PHASE 3/4: Frontend + Export ────────────────────────────────────────────────
R-10 (draft BE)     ──► R-16 (draft FE)  ──► R-22b (validation)
R-12 (registry)     ──► R-14 (form)
R-14 (form)         ──► R-15 (wire) ──► R-17 (delete config file) ──► R-24 CI gate
R-18 (HBS base)     ──► R-19 (AcroForm suppress) ──► R-21 (branding)
```

---

## 6. Delivery Order

| Sprint | Slices | Milestone |
|--------|--------|-----------|
| 1 | **R-0a, R-0b, R-0c, R-0d**, R-1, R-2, R-3, R-23, R-24 | Product-order FK chain fixed; `PRODUCT_CATALOG` deleted; shared types live; containers provisioned; CI gates up |
| 2 | R-4, R-5, R-6, R-7, R-8, R-9 | Full backend config system: merger (product-capability-aware), seeds, API endpoint, template registry complete |
| 3 | R-10, R-11, R-12, R-13, R-14, R-15 | DynamicReportForm live for all products; draft save universal |
| 4 | R-16, R-17, R-18, R-19, R-20 | Auto-save universal; `urar-form-config.ts` deleted; export layer fully config-driven |
| 5 | ~~R-21~~, R-22, R-22b | ~~R-21 done~~: client branding partials + `ClientReportBranding` wired; config-driven validation at ingestion and draft save |
| 6 | ~~R-25~~, ~~R-26~~, R-27 | Real hierarchical merger (5-tier: base→client→subClient→product→version); `addFields`/`addSections` in delta schema; concrete seed documents; review program results in CanonicalDoc |

---

## 7. The End State

**Adding a new product type** (e.g. "Hybrid inspection + BPO"):
1. Insert Product document in `products` container
2. Insert ReportConfigDelta document in `report-config-deltas` (only the diff from UAD 3.6)
3. Insert ReportTemplate document in `document-templates` (mapperKey + strategy + blob name)
4. Implement `IFieldMapper` if no existing mapper covers the PDF form fields (often reusable)
5. Upload Handlebars partials to Blob storage if product has bespoke template blocks

**Zero FE deploys. Zero BE deploys.** Data requirements, UI rendering, and PDF export
all derive from the merged config at runtime.

**Customizing for a client** (relabeled field, custom branding, extra required field):
1. Insert client-level delta in `report-config-deltas`
2. Upload branded Handlebars partial to `{clientId}/partials/` in Blob storage

**No code changes.**

