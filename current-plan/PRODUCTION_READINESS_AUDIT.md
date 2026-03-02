# Production Readiness Audit — Core Order Review Flow

> Conducted: Session prior to Phase 7 (Photo Intelligence)  
> Scope: Order intake → assignment/bidding → document upload → Axiom processing → QC review → decision/completion  
> Verdict: **FLOW IS PRODUCTION-READY** for the current single-tenant deployment. One code bug fixed; known tech-debt items documented.

---

## Audit Scope

The "core order review process":

```
Order Created → SUBMITTED → [Axiom auto-submit] → [QC queue auto-route]
     ↓                              ↓
 Documents uploaded        Axiom webhook returns
 (appraisal-report)        → stamps axiomStatus/riskScore/decision on order
     ↓                              ↓
 Auto-submitted to Axiom   QC analyst assigned
                                    ↓
                           QC review executed (criteria + Axiom bridge)
                                    ↓
                           QC Decision (APPROVED / REJECTED / CONDITIONAL)
                                    ↓
                   APPROVED → order completion
                   REJECTED → REVISION_REQUESTED + auto-create revision
```

---

## ✅ GREEN — Fully Wired and Verified

| Segment | Component | Evidence |
|---------|-----------|----------|
| **Order → SUBMITTED** | `PUT /api/orders/:orderId/status` | `order.controller.ts` UpdateOrderStatus |
| **SUBMITTED → Axiom** | `setImmediate` → `submitOrderEvaluation()` | `order.controller.ts` ~line 416. Fire-and-forget; stamps `axiomEvaluationId`, `axiomPipelineJobId`, `axiomStatus:'submitted'` on success |
| **SUBMITTED → QC queue** | `qcQueueService.addToQueue()` | Same handler, synchronous after Axiom kick-off; SLA tracking started |
| **Document upload → Axiom** | `AXIOM_AUTO_SUBMIT_CATEGORIES = {'appraisal-report', 'appraisal_report'}` | `document.controller.ts` uploadDocument, fire-and-forget |
| **Axiom webhook (ORDER)** | `POST /api/axiom/webhook` | `axiom.controller.ts` handleWebhook — handles `correlationType:'ORDER'`, stamps `axiomStatus`, `axiomRiskScore`, `axiomDecision`, `axiomFlags`, `axiomCompletedAt` on order |
| **Axiom webhook (BULK TAPE)** | `POST /api/axiom/webhook` | Same handler, handles `correlationType:'TAPE_LOAN'` → `bulkPortfolioService.stampBatchEvaluationResults()` |
| **Axiom webhook (EXTRACTION)** | `POST /api/axiom/webhook/extraction` | `processExtractionCompletion()` called |
| **Axiom webhook HMAC security** | `verifyAxiomWebhook` middleware | Applied to `/webhook`, `/webhook/bulk`, `/webhook/extraction` |
| **Axiom results → QC execute** | Axiom bridge in `reviews.controller.ts` | `getEvaluationsForOrder(targetId)` → injected into `QCExecutionContext.axiomEvaluation` at both execute paths (lines 196–245 and 1263–1290) |
| **QC queue operations** | GET/POST `/api/qc-workflow/queue` | Statistics, list, auto-assign, assign — all wired |
| **Return to queue** | `POST /api/qc-workflow/queue/:id/return` ↔ `useReturnToQueueMutation` → `POST /api/qc-workflow/queue/${id}/return` | **URL confirmed matching** |
| **Record QC decision** | `POST /api/qc-workflow/queue/:id/decision` ↔ `useRecordQCDecisionMutation` → `POST /api/qc-workflow/queue/${id}/decision` | **URL confirmed matching** |
| **Decision downstream (REJECTED)** | `qc-workflow.controller.ts` line 1155 | Order → `REVISION_REQUESTED`, auto-creates revision from conditions/notes |
| **Decision downstream (APPROVED)** | Same handler | Downstream completion logic fires |
| **QC Revisions CRUD** | `/api/qc-workflow/revisions/*` | Create, submit, accept, reject, history, active, overdue — all wired and frontend hooks exported |
| **QC Escalations CRUD** | `/api/qc-workflow/escalations/*` | Create, comment, resolve, close, open — all wired |
| **SLA tracking** | `/api/qc-workflow/sla/*` | Start, get, metrics — all wired; SLA started on SUBMITTED and on ACCEPTED |
| **QC Rules CRUD** | `/api/qc-rules` | Full CRUD; wired and mounted |
| **All routes auth-gated** | `api-server.ts` | Every core route mounted under `unifiedAuth.authenticate()` |
| **Phase 6.2 dead code** | `order-negotiation.controller.ts` | Already deleted from `src/` prior to this audit. No `.bak` files in `src/`. `order-negotiation.service.ts` retained (still imported by live `negotiation.controller.ts`). |

---

## 🔧 FIXED IN THIS SESSION

### `order.controller.ts` — tenantId derived from order record, not hardcoded

**Location:** `src/controllers/order.controller.ts`, SUBMITTED status handler, inside `setImmediate` block  
**Before:**
```typescript
setImmediate(() => {
  const tenantId = 'test-tenant-123';  // ← hardcoded
  this.dbService.findOrderById(orderId).then((orderResult) => {
    const orderData = ...
    return this.documentService.listDocuments(tenantId, { orderId })...
```

**After:**
```typescript
setImmediate(() => {
  this.dbService.findOrderById(orderId).then((orderResult) => {
    const orderData = orderResult.success ? orderResult.data : null;
    const tenantId = (orderData as any)?.tenantId as string | undefined;
    if (!tenantId) {
      logger.error('Cannot auto-submit to Axiom: order has no tenantId', { orderId });
      return;
    }
    ...
    return this.documentService.listDocuments(tenantId, { orderId })...
```

**Why:** The order record already stores its own `tenantId` in Cosmos. Deriving it from there is always correct and requires no hardcoded value. If the field is missing the call is skipped with an explicit error log (no silent failure).

---

## 🟡 YELLOW — Known Technical Debt (not blocking)

These are acknowledged, pre-commented items that work correctly in the current single-tenant deployment but will need attention before multi-tenant is introduced.

### `APP_TENANT_ID = 'test-tenant-123'` static constant

**Affected files:**
| File | Lines | Note |
|------|-------|------|
| `document.controller.ts` | 90, 225, 298, 342, 372, 414, 444 | Class-level static constant with an explicit comment: _"Azure AD tid claim is a directory GUID, not our app tenant. All seed data uses this value, so we hard-code it until tenant resolution middleware is built."_ |
| `axiom.controller.ts` | 23, 229 | Static constant; used in document-lookup Cosmos query |
| `delivery.controller.ts` | 24, 71, 108, 142, 181, 263, 324, 367, 401, 444, 478 | Module-level constant |
| `appraiser.controller.ts` | 23 | Static constant |

**Impact:** Zero impact in current single-tenant deployment — all Cosmos records carry `tenantId: 'test-tenant-123'` and the constant matches. Will need to be replaced with `process.env.APP_TENANT_ID` (with a startup-time guard, no silent default) before adding a second tenant.

**Note:** `document.controller.ts` has an explicit dev comment documenting the intent. The other files should add the same comment for clarity (not blocking).

### `userId = req.user?.id || 'unknown'` in audit/event calls

**Affected files:** `order.controller.ts` event publishing, `document.controller.ts` uploadDocument  
**Impact:** Audit trail entries show `userId: 'unknown'` if `req.user` is missing. Auth middleware rejects unauthenticated requests before reaching these handlers, so `req.user` should always be present. The fallback is defensive dead code in practice.  
**Recommendation:** `req.user!.id` (assert non-null since auth middleware guarantees it) or throw with a clear message — but this is cosmetic.

### Duplicate Axiom bridge in `reviews.controller.ts`

**Location:** Lines 196–245 (synchronous execute path) AND lines 1263–1290 (async execute path)  
**Impact:** None — both paths correctly call `getEvaluationsForOrder(targetId)` and inject into `QCExecutionContext.axiomEvaluation`. The duplication is a refactoring opportunity (extract to a shared helper), not a bug.

---

## ❌ RED — No blocking issues found

No production-blocking gaps in the core order review flow.

---

## End-to-End URL Verification

Key frontend mutation → backend route matches confirmed:

| Mutation hook | Frontend URL | Backend route |
|---|---|---|
| `useReturnToQueueMutation` | `POST /api/qc-workflow/queue/${id}/return` | `router.post('/queue/:queueItemId/return', ...)` ✅ |
| `useRecordQCDecisionMutation` | `POST /api/qc-workflow/queue/${id}/decision` | `router.post('/queue/:queueItemId/decision', ...)` ✅ |
| `useAssignQCMutation` | `POST /api/qc-workflow/queue/assign` | wired ✅ |
| `useAutoAssignQCMutation` | `POST /api/qc-workflow/queue/auto-assign` | wired ✅ |
| `useCreateRevisionMutation` | `POST /api/qc-workflow/revisions` | wired ✅ |
| `useSubmitRevisionMutation` | `POST /api/qc-workflow/revisions/:id/submit` | wired ✅ |
| `useAcceptRevisionMutation` | `POST /api/qc-workflow/revisions/:id/accept` | wired ✅ |
| `useRejectRevisionMutation` | `POST /api/qc-workflow/revisions/:id/reject` | wired ✅ |
| `useStartSLATrackingMutation` | `POST /api/qc-workflow/sla/start` | wired ✅ |
| `useCreateEscalationMutation` | `POST /api/qc-workflow/escalations` | wired ✅ |

> Note: The frontend hook for the final QC decision is `useRecordQCDecisionMutation` (NOT `completeWithDecision` — that is an internal service method name). The exported hook and URL are correct.

---

## Phase 7 Clearance

The core order review process is production-ready. Safe to start Phase 7 (Photo Intelligence).
