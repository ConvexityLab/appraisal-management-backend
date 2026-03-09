# Engagement Multi-Loan Refactor — Implementation Plan

**Created:** 2026-03-08  
**Completed:** 2026-03-08  
**Goal:** Restructure `LenderEngagement` from a flat single-loan document into a portfolio-capable
aggregate where one engagement holds **N loans**, each loan holds **M products**, each product holds
**P vendor order IDs**.

**Status:** ✅ COMPLETE — all 8 phases implemented, verified, and merged.

---

## Target Data Model

```
LenderEngagement  (Cosmos container: engagements, pk: /tenantId)
  ├── id, engagementNumber, tenantId
  ├── engagementType: EngagementType     (SINGLE | PORTFOLIO)
  ├── loansStoredExternally: boolean      (always false for now — future guard)
  ├── client: EngagementClient            (org-level only — NO loan-level fields)
  │     clientId, clientName, loanOfficer?, loanOfficerEmail?, loanOfficerPhone?
  ├── status: EngagementStatus            (engagement-level lifecycle)
  ├── priority, receivedAt, clientDueDate?, internalDueDate?, closedAt?
  ├── totalEngagementFee?, accessInstructions?, specialInstructions?, engagementInstructions?
  ├── createdAt, createdBy, updatedAt?, updatedBy?
  └── loans: EngagementLoan[]             (1..1000 embedded)
        ├── id                            (generated: loan-<ts>-<rand>)
        ├── loanNumber, borrowerName, borrowerEmail?
        ├── loanOfficer?, loanOfficerEmail?, loanOfficerPhone?
        ├── loanType?, fhaCase?
        ├── property: PropertyDetails
        ├── status: EngagementLoanStatus  (per-loan lifecycle)
        └── products: EngagementProduct[] (1..N per loan)
              ├── id, productType, status, instructions?, fee?, dueDate?
              └── vendorOrderIds: string[]
```

### Field migration map

| Currently on `Engagement` / `EngagementClient` | Moves to |
|---|---|
| `client.loanNumber` | `EngagementLoan.loanNumber` |
| `client.borrowerName` | `EngagementLoan.borrowerName` |
| `client.borrowerEmail?` | `EngagementLoan.borrowerEmail?` |
| `client.loanType?` | `EngagementLoan.loanType?` |
| `client.fhaCase?` | `EngagementLoan.fhaCase?` |
| `engagement.property` | `EngagementLoan.property` |
| `engagement.products[]` | `EngagementLoan.products[]` |

### Storage rules (finalized)
- Embed loans inside Cosmos document while `loans.length ≤ 1000`
- Above 1000: throw `400 Bad Request` — `"Large portfolio ingestion (>1000 loans) is not yet supported. Contact support."`
- `loansStoredExternally: boolean` is reserved on the type but **always `false`** — do NOT build the external path
- Service abstracts all loan access. Controller / API / UI never read `loansStoredExternally`

---

## Enum constraints (CRITICAL)

All status/type fields **must** use enum member syntax, never string literals.
Reason: `exactOptionalPropertyTypes: true` and established codebase pattern.

| Enum | Values |
|---|---|
| `EngagementType` | `SINGLE`, `PORTFOLIO` |
| `EngagementLoanStatus` | `PENDING`, `IN_PROGRESS`, `QC`, `DELIVERED`, `CANCELLED` |
| `EngagementStatus` | (unchanged) `RECEIVED`, `ACCEPTED`, `IN_PROGRESS`, `QC`, `REVISION`, `DELIVERED`, `CANCELLED`, `ON_HOLD` |
| `EngagementProductStatus` | (unchanged) |
| `EngagementProductType` | (unchanged) |

---

## Completion Summary

| Phase | Files | Status | Verified |
|---|---|---|---|
| 1 — Backend types | `engagement.types.ts`, `order-management.ts`, `bulk-portfolio.types.ts` | ✅ Done | tsc clean |
| 2 — Backend service | `engagement.service.ts` (678 lines) | ✅ Done | tsc clean |
| 3 — Backend controller | `engagement.controller.ts` | ✅ Done | tsc clean |
| 4 — Seed data | `scripts/seed-engagements.js` | ✅ Done | 6 docs upserted |
| 5 — Unit tests | `tests/unit/engagement-service.test.ts` | ✅ Done | 48/48 pass |
| 6 — Frontend types | `src/types/backend/engagement.types.ts` | ✅ Done | tsc exit 0 |
| 7 — Frontend RTK Query | `engagementsApi.ts`, `index.ts` | ✅ Done | tsc exit 0 |
| 8 — Frontend UI pages | `engagements/page.tsx`, `[id]/page.tsx`, `new/page.tsx` | ✅ Done | tsc exit 0 |

---

## Smoke Test Sequence

Run in order after `npm run dev` (frontend) and backend server are both up.

### 1 — Create a SINGLE engagement

1. Navigate to `/engagements/new`
2. Fill in **Client Name**, **Loan Number**, **Borrower Name**, **Address**, **State**, **Zip**, keep 1 product row
3. Submit → should redirect to `/engagements/<id>`
4. **Assert:** detail page loads without error; header shows `borrowerName · loanNumber · clientName`
5. **Assert:** Property card shows the address entered
6. **Assert:** status badge reads `PENDING`

### 2 — Verify SINGLE type

1. On the detail page, open browser DevTools → Network
2. Confirm the `GET /api/engagements/<id>` response body has `"engagementType": "SINGLE"` and `loans` array with exactly 1 entry

### 3 — Add a second loan → type flips to PORTFOLIO

1. `POST /api/engagements/<id>/loans` with a second loan payload (different `loanNumber`, `borrowerName`, valid `property`, 1 product)
2. `GET /api/engagements/<id>` — **assert** `"engagementType": "PORTFOLIO"` and `loans.length === 2`

### 4 — Change loan status through valid transitions

```
PENDING → IN_PROGRESS  (PATCH /:id/loans/:loanId/status  { newStatus: "IN_PROGRESS" })
IN_PROGRESS → QC        (PATCH ...   { newStatus: "QC" })
QC → DELIVERED          (PATCH ...   { newStatus: "DELIVERED" })
```

For each step:  
- **Assert** HTTP 200 and updated `status` in response body  

Also verify an **invalid transition** returns 400:
```
DELIVERED → IN_PROGRESS  → expect HTTP 400  "Invalid status transition"
```

### 5 — Add a product to a loan

1. `POST /api/engagements/<id>/loans/<loanId>/products` with `{ productType: "DESKTOP_REVIEW", fee: 125 }`
2. **Assert** 201; new product appears in `GET /api/engagements/<id>` under correct loan

### 6 — Link a vendor order to a product

1. `POST /api/engagements/<id>/loans/<loanId>/products/<productId>/vendor-orders` with `{ vendorOrderId: "ord-test-000" }`
2. **Assert** 200; product's `vendorOrderIds` array includes `"ord-test-000"`
3. Attempt `DELETE /api/engagements/<id>/loans/<loanId>` (loan with linked vendor orders) → **assert** HTTP 400 `"Cannot remove a loan that has linked vendor orders"`

### 7 — Remove a clean loan

1. Add a third loan with no products (or set `products: []` if schema allows)
2. `DELETE /api/engagements/<id>/loans/<cleanLoanId>` → **assert** HTTP 200
3. `GET /api/engagements/<id>` → **assert** `loans.length` reduced by 1

### 8 — List page smoke test

1. Navigate to `/engagements`
2. **Assert** both SINGLE and PORTFOLIO engagements appear in the table
3. For SINGLE row: `loanNumber` and `borrowerName` columns render from `loans[0]`
4. For PORTFOLIO row: same columns show first loan's data

---

## Phase 1 — Backend types

**Files:** `src/types/engagement.types.ts`, `src/types/order-management.ts`, `src/types/bulk-portfolio.types.ts`

### engagement.types.ts changes
1. Add `EngagementType` enum: `SINGLE = 'SINGLE', PORTFOLIO = 'PORTFOLIO'`
2. Add `EngagementLoanStatus` enum: `PENDING`, `IN_PROGRESS`, `QC`, `DELIVERED`, `CANCELLED`
3. Slim `EngagementClient` — remove `loanNumber`, `borrowerName`, `borrowerEmail`, `loanType`, `fhaCase` (these move to EngagementLoan)
4. Add `EngagementLoan` interface:
   ```ts
   export interface EngagementLoan {
     id: string;
     loanNumber: string;
     borrowerName: string;
     borrowerEmail?: string;
     loanOfficer?: string;
     loanOfficerEmail?: string;
     loanOfficerPhone?: string;
     loanType?: string;
     fhaCase?: string;
     property: PropertyDetails;
     status: EngagementLoanStatus;
     products: EngagementProduct[];
   }
   ```
5. On `Engagement`: replace `property: PropertyDetails` and `products: EngagementProduct[]` with `loans: EngagementLoan[]`; add `engagementType: EngagementType` and `loansStoredExternally: boolean`
6. Update `CreateEngagementRequest`: replace `property + products` with `loans: Omit<EngagementLoan, 'id' | 'status'>[]`
7. Update `UpdateEngagementRequest`: remove `property?`, keep `client?`
8. Add `CreateEngagementLoanRequest = Omit<EngagementLoan, 'id' | 'status'>`
9. Add `UpdateEngagementLoanRequest = Partial<Omit<EngagementLoan, 'id' | 'status' | 'products'>>`

### order-management.ts changes
10. Add `engagementLoanId?: string` to `AppraisalOrder` (after `engagementProductId`)

### bulk-portfolio.types.ts changes
11. Add `engagementId?: string` to `BulkPortfolioJob`
12. Add `engagementId?: string` to `BulkPortfolioItem`

**Verify:** `npx tsc --noEmit` — must show only pre-existing `reports.controller.ts:159` error.

---

## Phase 2 — Backend service

**File:** `src/services/engagement.service.ts`

1. Add `MAX_EMBEDDED_LOANS = 1000` constant; add `generateLoanId()` helper
2. Import `EngagementLoan`, `EngagementLoanStatus`, `EngagementType`, `CreateEngagementLoanRequest`, `UpdateEngagementLoanRequest`
3. Rewrite `createEngagement`:
   - Validate `request.loans` exists and `length >= 1` (not `request.products`)
   - Guard: `if (request.loans.length > MAX_EMBEDDED_LOANS) throw new Error(...)`
   - Assign `id` and `status: EngagementLoanStatus.PENDING` to each loan
   - Assign `id` and `status: EngagementProductStatus.PENDING` to each product inside each loan
   - Set `engagementType = request.loans.length === 1 ? EngagementType.SINGLE : EngagementType.PORTFOLIO`
   - Set `loansStoredExternally = false`
4. Add `getLoans(engagementId, tenantId): Promise<EngagementLoan[]>`:
   - Call `getEngagement()`, return `engagement.loans`
   - (Future: if `loansStoredExternally`, query external container — not implemented yet)
5. Add `addLoanToEngagement(engagementId, tenantId, loanData, updatedBy)`:
   - Guard: `if (existing.loans.length >= MAX_EMBEDDED_LOANS) throw new Error(...)`
   - Assign `id` and `status: EngagementLoanStatus.PENDING`; assign product IDs
   - Push to `loans[]`; `updateEngagement()`
6. Add `updateLoan(engagementId, tenantId, loanId, updates, updatedBy)`:
   - Find loan by `loanId`; throw if not found
   - Merge non-product, non-status fields from updates
   - Write back via `updateEngagement()`
7. Add `removeLoan(engagementId, tenantId, loanId, updatedBy)`:
   - Find loan; throw if not found
   - Throw if any product on the loan has `vendorOrderIds.length > 0`
   - Splice from `loans[]`; `updateEngagement()`
8. Add `ALLOWED_LOAN_TRANSITIONS` static constant:
   ```
   PENDING     → [IN_PROGRESS, CANCELLED]
   IN_PROGRESS → [QC, CANCELLED]
   QC          → [DELIVERED, IN_PROGRESS, CANCELLED]
   DELIVERED   → []
   CANCELLED   → []
   ```
9. Add `changeLoanStatus(engagementId, tenantId, loanId, newStatus, updatedBy)`:
   - Find loan; check `ALLOWED_LOAN_TRANSITIONS`; update status; write back
10. Add `addProductToLoan(engagementId, tenantId, loanId, productData, updatedBy)`:
    - Find loan; assign product `id` and `status: EngagementProductStatus.PENDING`; push; write back
11. Update `addVendorOrderToProduct(engagementId, tenantId, loanId, productId, vendorOrderId, updatedBy)`:
    - Add `loanId` parameter; find product inside the loan (not at root)
12. Update `listEngagements` searchText query:
    - Change `c.client.loanNumber` → `c.loans[0].loanNumber`
    - Change `c.client.borrowerName` → `c.loans[0].borrowerName`
    - Change `c.property.city` → `c.loans[0].property.city`

**Verify:** `npx tsc --noEmit` — must show only pre-existing error.

---

## Phase 3 — Backend controller

**File:** `src/controllers/engagement.controller.ts`

1. Import `EngagementLoanStatus`, `CreateEngagementLoanRequest`, `UpdateEngagementLoanRequest` from types
2. Update `validateCreate`:
   - Remove validators for `client.loanNumber`, `client.borrowerName`, `property.*`, `products.*`
   - Add `body('loans').isArray({ min: 1 }).withMessage('At least one loan is required')`
   - Add per-loan validators: `loans.*.loanNumber`, `loans.*.borrowerName`, `loans.*.property.address`, `loans.*.property.state`, `loans.*.property.zipCode`, `loans.*.products` (array min 1)
3. Update `POST /` handler — pass `req.body.loans` through `CreateEngagementRequest`
4. Replace `POST /:id/products/:productId/vendor-orders` with `POST /:id/loans/:loanId/products/:productId/vendor-orders`
   - Add `param('loanId')` validation
   - Pass `loanId` to `service.addVendorOrderToProduct()`
5. Add `GET /:id/loans` → `service.getLoans()`
6. Add `POST /:id/loans` → `service.addLoanToEngagement()`
7. Add `GET /:id/loans/:loanId` → `service.getLoans()` then `.find()`
8. Add `PUT /:id/loans/:loanId` → `service.updateLoan()`
9. Add `PATCH /:id/loans/:loanId/status` → `service.changeLoanStatus()`
10. Add `DELETE /:id/loans/:loanId` → `service.removeLoan()`
11. Add `POST /:id/loans/:loanId/products` → `service.addProductToLoan()`
12. Update controller header docstring route table

**Verify:** `npx tsc --noEmit` — must show only pre-existing error.

---

## Phase 4 — Seed data

**File:** `scripts/seed-engagements.js`

1. Rewrite `eng-seed-001` through `eng-seed-005` — wrap current `property + products` as `loans[0]`:
   - Move `client.loanNumber`, `client.borrowerName` etc. into `loans[0]`
   - Add `engagementType: 'SINGLE'`, `loansStoredExternally: false`
   - Keep `client` with org-level fields only
2. Add `eng-seed-006` as a PORTFOLIO engagement with 3 loans (different addresses/borrowers)
3. Run: `node scripts/seed-engagements.js` — must report 6 docs upserted/created, no errors

---

## Phase 5 — Unit tests

**File:** `tests/unit/engagement-service.test.ts`

1. Update `makeEngagement()` helper — replace `property` and root-level `products` with `loans: [{ id: 'loan-001', loanNumber: '...', borrowerName: '...', property: {...}, status: EngagementLoanStatus.PENDING, products: [] }]`; add `engagementType`, `loansStoredExternally`
2. Update `makeEngagement()` — remove `client.loanNumber`, `client.borrowerName`
3. Fix all existing tests that reference `engagement.property` or `engagement.products` or `engagement.client.loanNumber`
4. Add test: `createEngagement` with valid `loans[]` succeeds and wraps products correctly
5. Add test: `createEngagement` with 0 loans throws
6. Add test: `createEngagement` with 1001 loans throws `"not yet supported"`
7. Add test: `addLoanToEngagement` successfully adds a loan
8. Add test: `addLoanToEngagement` at 1000 loans throws
9. Add test: `changeLoanStatus` PENDING → IN_PROGRESS succeeds
10. Add test: `changeLoanStatus` PENDING → DELIVERED throws
11. Add test: `removeLoan` with active vendorOrderIds throws
12. Add test: `removeLoan` with empty vendorOrderIds succeeds
13. Add test: `addVendorOrderToProduct` finds product inside `loans[0].products` (not root)

**Run:** `npx vitest run tests/unit/engagement-service.test.ts` — all tests must pass, count must be ≥ 25 + new tests.

---

## Phase 6 — Frontend types

**File:** `l1-valuation-platform-ui/src/types/backend/engagement.types.ts`

1. Add `EngagementType` enum (mirrors backend)
2. Add `EngagementLoanStatus` enum (mirrors backend)
3. Slim `EngagementClient` — remove `loanNumber`, `borrowerName`, `borrowerEmail`, `loanType`, `fhaCase`
4. Add `EngagementLoan` interface (mirrors backend)
5. Update `Engagement`: replace `property` and `products` with `loans: EngagementLoan[]`; add `engagementType`, `loansStoredExternally`
6. Update `CreateEngagementRequest`: replace `property + products` with `loans`
7. Add `CreateEngagementLoanRequest`

**Verify:** `npx tsc --noEmit` (in `l1-valuation-platform-ui`) — must show 0 errors.

---

## Phase 7 — Frontend RTK Query

**Files:** `src/store/api/engagementsApi.ts`, `src/store/api/index.ts`

1. Update `addVendorOrderToEngagementProduct`:
   - Add `loanId: string` to arg type
   - Change URL to `/${id}/loans/${loanId}/products/${productId}/vendor-orders`
2. Add `getEngagementLoans` query: `GET /:id/loans`
3. Add `addLoanToEngagement` mutation: `POST /:id/loans`
4. Add `updateEngagementLoan` mutation: `PUT /:id/loans/:loanId`
5. Add `changeEngagementLoanStatus` mutation: `PATCH /:id/loans/:loanId/status`
6. Add `removeEngagementLoan` mutation: `DELETE /:id/loans/:loanId`
7. Add `addProductToLoan` mutation: `POST /:id/loans/:loanId/products`
8. Export all new hooks from `index.ts`

**Verify:** `npx tsc --noEmit` — 0 errors.

---

## Phase 8 — Frontend UI

**Files:** `engagements/new/page.tsx`, `engagements/[id]/page.tsx`

### new/page.tsx
- Replace single-property form section with a **Loans table**: add/remove rows
- Each loan row captures: `loanNumber`, `borrowerName`, `loanType?`, `address`, `city?`, `state`, `zipCode`, and a products multi-select
- Top section: `clientId`, `clientName`, `loanOfficer?` (org-level only)
- `engagementType` auto-set: `SINGLE` if 1 loan row, `PORTFOLIO` if >1
- Validation: ≥1 loan row; each loan needs loanNumber + borrowerName + address + state + zip + ≥1 product

### [id]/page.tsx
- **Loans tab** replaces single-property overview as first/default tab
- Loans listed in a table/accordion: each row expandable → shows products → each product shows vendor order ID chips
- Per-loan `EngagementLoanStatus` badge + "Change Status" button
- "Add Loan" button visible for PORTFOLIO engagements (hidden for SINGLE)
- All existing tabs (Vendor Orders, ARV, QC, Documents) remain unchanged

**Verify:** `npx tsc --noEmit` — 0 errors.

---

## Implementation Rules (non-negotiable)

1. Use `EnumName.VALUE` syntax — never string literals for enum fields
2. `exactOptionalPropertyTypes` — spread optional fields conditionally: `...(x !== undefined && { field: x })`
3. No `createIfNotExists`, no infrastructure creation in code
4. No silent defaults — throw with clear messages if required values are missing
5. After every phase: run `tsc --noEmit` before marking done
6. Tests use vitest, not Jest — `vi.fn()`, not `jest.fn()`
7. Do NOT build the external loans container path
8. Do NOT modify `EngagementStatus` enum or `ALLOWED_TRANSITIONS` map

---

## Deferred (explicitly out of scope)

- External `engagement-loans` Cosmos container (> 1000 loans)
- Bulk CSV tape ingestion → engagement intake bridge
- Per-loan QC workflow
- Portfolio-level full-text search across all embedded loans
