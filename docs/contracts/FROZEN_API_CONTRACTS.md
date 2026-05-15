# Frozen API Contracts — Review Programs

> **STATUS: FROZEN 2026-05-01**
> These contracts are derived directly from the TypeScript type definitions in the codebase.
> Any change to the request/response shapes of the routes below MUST be reflected here.
> This document is Phase 0 deliverable of `REVIEW_PROGRAM_REQUIREMENTS_GAP_ANALYSIS.md`.

---

## Scope — First Supported Review Program Set

**As of 2026-05-01 the following review programs are seeded as platform-wide defaults:**

| Program ID | Name | Program Type | Engine Refs |
|---|---|---|---|
| `vision-appraisal-v1.0` | VisionAppraisal Risk Program | `FRAUD` | Inline legacy flags only (no `aiCriteriaRefs` / `rulesetRefs`) |

> **Gap (Phase 1):** No production review programs with populated `aiCriteriaRefs` or `rulesetRefs` pointing to real Axiom or MOP/Prio program IDs exist in seed data. The first `aiCriteriaRefs`-based program must be defined before Phase 1 can be completed. See Phase 1 checklist in `REVIEW_PROGRAM_REQUIREMENTS_GAP_ANALYSIS.md`.

---

## Route Inventory

| Route | Status | Description |
|---|---|---|
| `POST /api/review-programs/prepare` | **CANONICAL — new path** | Assemble context; report readiness; produce persisted `PreparedReviewContextArtifact`. No dispatch. |
| `POST /api/review-programs/:preparedContextId/dispatch` | **CANONICAL — new path** | Dispatch one or more programs from a previously persisted prepared context. |
| `POST /api/review-programs/:id/submit` | **LEGACY — migration-fallback only** | Snapshot-first direct submission. Still live; not feature-flagged. Must be retired in Phase 9. |

---

## POST /api/review-programs/prepare

### Request

```typescript
// src/types/review-preparation.types.ts → PrepareReviewProgramsRequest
{
  orderId: string;                    // required — platform order ID
  reviewProgramIds: string[];         // required — min 1 — IDs from review-programs container
  engagementId?: string;              // optional — engagement context
  clientId?: string;                  // optional — client scope for program key resolution
  subClientId?: string;               // optional — sub-client scope
  options?: {
    includeCompContext?: boolean;
    includeDocumentInventory?: boolean;
    attemptAutoResolveDerivedFields?: boolean;
    attemptAutoPlanExtraction?: boolean;
  };
}
```

**Headers:**

| Header | Required | Notes |
|---|---|---|
| `Authorization` | Yes | Bearer JWT — tenantId resolved from claims |
| `X-Correlation-Id` | No | Forwarded to Service Bus events; auto-generated if absent |
| `Idempotency-Key` | No | Used for context persistence dedup; auto-generated if absent |

### Response — 200 OK

```typescript
// src/types/review-preparation.types.ts → PrepareReviewProgramsResponse (via PreparedReviewContextArtifact)
{
  success: true,
  data: {
    preparedContextId: string;        // UUID — used as the key for /dispatch
    preparedContextVersion: string;   // matches context.contextVersion
    orderId: string;
    engagementId?: string;
    preparedAt: string;               // ISO-8601
    contextSummary: {
      clientId?: string;
      subClientId?: string;
      documentCount: number;
      hasDocuments: boolean;
      hasEnrichment: boolean;
      extractionRunCount: number;
      criteriaRunCount: number;
      latestSnapshotId?: string;
      reviewProgramsRequested: number;
      reviewProgramsResolved: number;
    };
    programs: ProgramReadiness[];     // one entry per requested reviewProgramId
    warnings: string[];
    recommendedActions: ReviewRecommendedAction[];
    plannedEngineDispatches: PreparedEngineDispatch[];
    context: ReviewContext;           // full assembled context — see review-context.types.ts
  }
}
```

**`ProgramReadiness` shape** (src/types/review-preparation.types.ts):

```typescript
{
  reviewProgramId: string;
  reviewProgramName: string;
  reviewProgramVersion: string;
  readiness: ReviewReadinessState;    // see values below
  canDispatch: boolean;
  axiomRefCount: number;
  mopRefCount: number;
  blockers: string[];
  warnings: string[];
  recommendedActions: ReviewRecommendedAction[];
  criterionResolutions: CriterionResolution[];
}
```

**`ReviewReadinessState` values** (src/types/review-context.types.ts):

```
'ready'
'ready_with_warnings'
'partially_ready'
'requires_extraction'
'requires_documents'
'requires_comp_selection'
'requires_manual_resolution'
'blocked_by_configuration'
'blocked_by_data_integrity'
'not_runnable'
```

> **Gap (Phase 4):** `'blocked'` and `'cannot_evaluate'` states from the gap analysis are not yet emitted.

### Response — 400 Bad Request

```json
{ "errors": [{ "type": "field", "msg": "...", "path": "reviewProgramIds", "location": "body" }] }
```

### Response — 401 Unauthorized

```json
{ "error": "User tenant not resolved — authentication required" }
```

### Response — 404 Not Found

```json
{ "success": false, "error": "Order '...' not found" }
```

### Response — 500 Internal Server Error

```json
{ "success": false, "error": "Failed to prepare review programs" }
```

---

## POST /api/review-programs/:preparedContextId/dispatch

Also accepted as `POST /api/review-programs/dispatch` with `preparedContextId` in the body. When both are supplied they must match.

### Request

```typescript
// src/types/review-preparation.types.ts → DispatchPreparedReviewProgramsRequest
{
  preparedContextId?: string;         // required if not in route param
  reviewProgramIds: string[];         // required — min 1 — must match prepared programs
  dispatchMode?: 'all_ready_only' | 'include_partial';  // default: all_ready_only
  confirmWarnings?: boolean;          // default: false
}
```

**Headers:** same as `/prepare` above.

### Response — 200 OK

```typescript
// src/types/review-preparation.types.ts → DispatchPreparedReviewProgramsResponse
{
  dispatchId: string;
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  dispatchedAt: string;               // ISO-8601
  dispatchMode: 'all_ready_only' | 'include_partial';
  submittedPrograms: Array<{
    reviewProgramId: string;
    reviewProgramName: string;
    reviewProgramVersion: string;
    overallStatus: 'all_submitted' | 'partial' | 'none_submitted';
    axiomLegs: Array<{
      engine: 'AXIOM' | 'MOP_PRIO';
      programId: string;
      programVersion: string;
      status: 'submitted' | 'skipped' | 'failed';
      runId?: string;
      error?: string;
    }>;
    mopLegs: Array<{
      engine: 'AXIOM' | 'MOP_PRIO';
      programId: string;
      programVersion: string;
      status: 'submitted' | 'skipped' | 'failed';
      runId?: string;
      error?: string;
    }>;
    skippedReason?: string;
  }>;
  skippedPrograms: Array<{
    reviewProgramId: string;
    reason: string;
  }>;
  warnings: string[];
}
```

---

## POST /api/review-programs/:id/submit  ⚠️ LEGACY

> **This route is migration-fallback. Do not use for new integrations.**
> Controller location: `src/controllers/review-programs.controller.ts` lines 1057–1130.
> Must be retired in Phase 9.

### Request

```typescript
// src/types/review-program-orchestration.types.ts → ReviewProgramOrchestrationRequest (partial)
{
  snapshotId: string;                 // required — canonical snapshot from prior extraction run
  clientId: string;                   // required
  subClientId: string;                // required
  runMode?: 'FULL' | 'STEP_ONLY';    // default: 'FULL'
  rerunReason?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
}
```

### Response — 200 OK

```typescript
// src/types/review-program-orchestration.types.ts → ReviewProgramOrchestrationResult
{
  reviewProgramId: string;
  reviewProgramName: string;
  overallStatus: 'all_submitted' | 'partial' | 'none_submitted';
  axiomLegs: OrchestrationRunLeg[];
  mopLegs: OrchestrationRunLeg[];
  skippedReason?: string;
}
```

---

## Canonical Data Types — Key References

| Type | Location |
|---|---|
| `ReviewProgram` | `src/types/review-tape.types.ts` |
| `ReviewContext` | `src/types/review-context.types.ts` |
| `ReviewReadinessState` | `src/types/review-context.types.ts` |
| `ReviewRecommendedAction` | `src/types/review-context.types.ts` |
| `CriterionResolution` | `src/types/review-preparation.types.ts` |
| `ProgramReadiness` | `src/types/review-preparation.types.ts` |
| `PreparedEngineDispatch` | `src/types/review-preparation.types.ts` |
| `PrepareReviewProgramsRequest` | `src/types/review-preparation.types.ts` |
| `PrepareReviewProgramsResponse` | `src/types/review-preparation.types.ts` |
| `PreparedReviewContextArtifact` | `src/types/review-preparation.types.ts` |
| `DispatchPreparedReviewProgramsRequest` | `src/types/review-preparation.types.ts` |
| `DispatchPreparedReviewProgramsResponse` | `src/types/review-preparation.types.ts` |
| `ReviewProgramOrchestrationRequest` | `src/types/review-program-orchestration.types.ts` |
| `ReviewProgramOrchestrationResult` | `src/types/review-program-orchestration.types.ts` |

---

## Service Bus Events Emitted

### On POST /prepare

| Event type | When |
|---|---|
| `review-program.prepare.started` | Before `prepare()` call |
| `review-program.prepare.completed` | After successful persist |
| `review-program.prepare.failed` | On any error |

### On POST /dispatch

| Event type | When |
|---|---|
| `review-program.submitted` | After each successfully submitted program leg |

---

## Known Snapshot Dependencies

| Location | Description | Migration status |
|---|---|---|
| `POST /:id/submit` request body | `snapshotId` is required | Retired — endpoint now returns `410 Gone` with migration guidance |
| `ReviewProgramOrchestrationService.orchestrate()` | Passes snapshotId into run ledger record | Legacy service path only; no longer used by review-program controller |
| `PreparedReviewContextArtifact.context.runSummary.latestSnapshotId` | Used in dispatch event publishing | New path — carry-through only |
| `ReviewProgramWorkspace.tsx` | Uses prepared-context dispatch only | Migrated |

---

## Sample Payloads

### Sample: POST /prepare (known-good)

```json
POST /api/review-programs/prepare
Content-Type: application/json
Authorization: Bearer <token>
X-Correlation-Id: rp-prepare-test-001

{
  "orderId": "order-abc123",
  "reviewProgramIds": ["vision-appraisal-v1.0"],
  "clientId": "client-vision",
  "subClientId": "sub-vision-default"
}
```

### Sample: POST /dispatch (known-good)

```json
POST /api/review-programs/ctx-uuid-here/dispatch
Content-Type: application/json
Authorization: Bearer <token>

{
  "reviewProgramIds": ["vision-appraisal-v1.0"],
  "dispatchMode": "all_ready_only"
}
```

### Sample: POST /submit (legacy — reference only)

```json
POST /api/review-programs/vision-appraisal-v1.0/submit
Content-Type: application/json
Authorization: Bearer <token>

{
  "snapshotId": "snapshot-uuid-here",
  "clientId": "client-vision",
  "subClientId": "sub-vision-default",
  "engagementId": "engagement-uuid-here"
}
```

> **NOTE:** `snapshotId` is a UUID produced by a prior extraction run. The value must reference an existing `CanonicalSnapshotRecord` in the run ledger (`run-ledger` Cosmos container).

---

## Critical Blockers

### RESOLVED 2026-05-01: BLOCKER-01 — `AxiomService.getCompiledCriteria()` / `compileCriteria()` route mismatch

**File**: `appraisal-management-backend/src/services/axiom.service.ts` — lines 3627-3629

**Previous (wrong)**:
```
GET /api/programs/{programId}/{programVersion}/compiled
  ?clientId={clientId}&tenantId={tenantId}
```

**Axiom's actual route** (`axiom/src/api/routes/criteria.ts` line 400-420, mounted at `/api/criteria/`):
```
GET /api/criteria/clients/{clientId}/sub-clients/{subClientId}/programs/{programId}/{programVersion}/compiled
```

**Fixed in code**:
1. `AxiomService.getCompiledCriteria()` now calls the mounted `/api/criteria/clients/.../sub-clients/.../programs/.../compiled` route directly.
2. `AxiomService.compileCriteria()` now calls the matching `/compile` route and only sends `{ userId? }` in the request body, which matches Axiom's API contract.
3. The method parameter name is now `subClientId` instead of `tenantId` for both compile helpers.
4. `current-plan/AXIOM_INTEGRATION_STATUS.md` now documents the correct route/signature.

**Platform decision (2026-05-01)**: prefer **Axiom platform fallback** over seeding tenant-by-tenant duplicate appraisal-QC deltas. `axiom/src/services/CriteriaCompilerService.ts` now attempts `{clientId, subClientId}` first and falls back to `PLATFORM/default` for the same `programId`/`programVersion` when no tenant-specific delta exists. This preserves room for client overrides later without forcing duplicate seed data today.

---

## Open Decisions (see Section 20 in gap analysis)

1. **Scope freeze**: Which review program IDs are in scope for the first production deployment? `vision-appraisal-v1.0` is the only seeded program. As of 2026-05-01 it uses `aiCriteriaRefs: [{ programId: 'appraisal-qc', programVersion: '1.0.0' }]` backed by the canonical seed at `axiom/seed-data/criteria/appraisal-qc-canonical-v1.0.0.json`.
2. ~~**First `aiCriteriaRefs` program**: What Axiom program ID / version will the first criteria-backed review program reference?~~ **RESOLVED 2026-05-01**: `appraisal-qc` / `1.0.0` — see `axiom/seed-data/criteria/appraisal-qc-platform-delta.json`.
3. **`snapshotId` optionality**: The new `/prepare` → `/dispatch` path does NOT require a snapshot upfront. The snapshot is resolved from recent run history. Is this correct for all program types?
