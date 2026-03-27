# Automation Pipeline — End-to-End Reference

**Last updated:** March 14, 2026  
**Scope:** Full appraisal lifecycle — engagement creation through final delivery  
**Architecture:** Azure Service Bus event pipeline. Every service subscribes independently to the `appraisal-events` topic. No service calls another service directly.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1 — Engagement & Order Creation](#phase-1--engagement--order-creation)
3. [Phase 2 — Vendor Assignment (Auto-Bid Loop)](#phase-2--vendor-assignment-auto-bid-loop)
4. [Phase 3 — Report Submission & QC Auto-Assignment](#phase-3--report-submission--qc-auto-assignment)
5. [Phase 4 — Axiom AI QC Scoring](#phase-4--axiom-ai-qc-scoring)
6. [Phase 5 — Human QC Review](#phase-5--human-qc-review)
7. [Phase 6 — Delivery & Engagement Close-Out](#phase-6--delivery--engagement-close-out)
8. [Phase 7 — ROV Intake & AI Triage](#phase-7--rov-intake--ai-triage)
9. [Timeout Watchdogs (Background Jobs)](#timeout-watchdogs-background-jobs)
10. [SLA & Overdue Monitoring](#sla--overdue-monitoring)
11. [Dead Letter Queue Monitor](#dead-letter-queue-monitor)
12. [Service Bus Subscriptions Reference](#service-bus-subscriptions-reference)
13. [Tenant Automation Config Defaults](#tenant-automation-config-defaults)
14. [Human Intervention Points](#human-intervention-points)
15. [How to Watch It Happening](#how-to-watch-it-happening)
16. [Test Coverage Reference](#test-coverage-reference)

---

## Architecture Overview

```
Client / Lender
     │
     │  HTTP  POST /api/engagements
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   appraisal-management-backend                  │
│                                                                 │
│  Controllers (HTTP)  ──publish──►  Azure Service Bus           │
│                                    topic: appraisal-events      │
│                                         │                       │
│                        ┌────────────────┼──────────────────┐   │
│                        │  subscriptions │ (one per service) │   │
│                        └────────────────┼──────────────────┘   │
│                                         │                       │
│  Background Services  ◄──subscribe──────┘                      │
│  (run inside the same Node.js process)                          │
└─────────────────────────────────────────────────────────────────┘
         │
         │  writes
         ▼
    Azure Cosmos DB
    (orders, engagements, vendor-bids, qc-reviews, …)
```

**Key design rules:**
- Services publish events and return immediately. They do not wait for downstream services to process.
- Every handler is idempotent — re-processing the same event is safe.
- No service mutates another service's data directly. The `AutoAssignmentOrchestratorService` is the sole owner of `order.autoVendorAssignment` and `order.autoReviewAssignment` state.
- Automation features are all **gated by `TenantAutomationConfig`** — each flag can be flipped per tenant without a deployment.

---

## Phase 1 — Engagement & Order Creation

**Trigger:** `POST /api/engagements`

**What happens:**
1. `EngagementController` validates the request and creates a `LenderEngagement` document in Cosmos DB.
2. For each loan product in the engagement, a vendor order document is created in the `orders` container with `status: NEW`.
3. The controller publishes **`engagement.order.created`** for each new order.
4. If `engagementLetterAutoSend: true` — `EngagementLetterAutoSendService` receives `engagement.order.created` and generates + dispatches the engagement letter to the vendor.

**Duplicate detection (advisory):**  
Before the order is written, `DuplicateOrderDetectionService` checks for existing orders with the same property address + borrower. If potential duplicates are found, the 201 response includes a `duplicateWarning` object. The order is still created — this is advisory only and never blocks intake.

**State after Phase 1:**
```
LenderEngagement.status = IN_PROGRESS
Order.status            = NEW
Order.autoVendorAssignment = undefined (not yet started)
```

---

## Phase 2 — Vendor Assignment (Auto-Bid Loop)

**Trigger:** Event `engagement.order.created`  
**Service:** `AutoAssignmentOrchestratorService` (subscription: `auto-assignment-service`)

**Guard:** `autoAssignmentEnabled: true` in tenant config (default: `true`)

### 2a. Initial bid dispatch

1. Calls `VendorMatchingEngine.findMatchingVendors()` — scores all eligible vendors by geography, license, workload, past performance, and preferred-vendor list.
2. Saves the ranked list to `order.autoVendorAssignment`.
3. Checks if the top-ranked vendor is **internal staff** (field `vendor.staffType === 'internal'`):
   - **Internal:** directly assigns the order, sets `status = ACCEPTED`, publishes **`vendor.staff.assigned`** — no bid loop needed.
   - **External:** creates a `vendor-bids` document, publishes **`vendor.bid.sent`** — vendor has `bidExpiryHours` (default: **4 hours**) to respond.
4. If `VendorMatchingEngine` returns zero results → immediately publishes **`vendor.assignment.exhausted`** and flags `order.requiresHumanVendorAssignment = true`.

**State after 2a:**
```
Order.autoVendorAssignment.status = PENDING_BID
Order.autoVendorAssignment.currentAttempt = 0
Order.autoVendorAssignment.currentBidExpiresAt = <now + 4h>
vendor-bids document: { vendorId, status: PENDING, expiresAt }
```

### 2b. Vendor accepts → `vendor.bid.accepted`

1. Orchestrator receives **`vendor.bid.accepted`**.
2. Sets `order.assignedVendorId`, `order.status = ASSIGNED`.
3. Sets `order.autoVendorAssignment.status = ACCEPTED`.
4. Publishes **`order.status.changed`** `{newStatus: ASSIGNED}`.

### 2c. Vendor declines → `vendor.bid.declined`

1. Orchestrator receives **`vendor.bid.declined`**.
2. Advances `currentAttempt` by 1.
3. If another vendor remains in the ranked list → sends new bid (back to 2a loop, next vendor).
4. If list exhausted → publishes **`vendor.assignment.exhausted`** (human step required).

### 2d. Vendor times out (watchdog-detected)

`VendorTimeoutCheckerJob` runs every **5 minutes**, queries for orders where:
```sql
autoVendorAssignment.status = 'PENDING_BID'
AND autoVendorAssignment.currentBidExpiresAt <= @now
```
It publishes **`vendor.bid.timeout`** for each expired bid. The orchestrator handles the event identically to a decline (step 2c).

### 2e. Engagement letter declined → `engagement.letter.declined`

If the vendor declines the engagement letter and `requireSignedLetterBeforeProgress: false` (default), the order proceeds anyway. If `requireSignedLetterBeforeProgress: true`, the order waits.

### Bid loop summary

```
engagement.order.created
    │
    ▼
rank vendors
    │
    ├─ internal staff? ──yes──► direct assign → vendor.staff.assigned → Phase 3
    │
    └─ external vendor
          │
          ▼
    vendor.bid.sent ──► [vendor has 4h]
          │
    ┌─────┴───────────────────┐
    ▼                         ▼
vendor.bid.accepted    vendor.bid.declined / vendor.bid.timeout
    │                         │
    ▼                      next vendor? ──no──► vendor.assignment.exhausted
Phase 3                       │                 (human assigns manually)
                           yes │
                               ▼
                         vendor.bid.sent (next vendor)
                         [repeat up to maxVendorAttempts = 5]
```

---

## Phase 3 — Report Submission & QC Auto-Assignment

**Trigger:** `order.status.changed { newStatus: SUBMITTED }`  
**Services:** `AutoAssignmentOrchestratorService`, `MismoAutoGenerateService`, `AxiomAutoTriggerService`

**What fires in parallel when a vendor submits:**

| Service | Action | Config gate |
|---|---|---|
| `AutoAssignmentOrchestratorService` | Adds order to QC queue; ranks reviewers by workload; assigns lowest-workload reviewer; publishes `review.assigned` | Always (not gated) |
| `MismoAutoGenerateService` | Calls `FinalReportService.generateMismoXmlForReport()` to produce MISMO 3.4 XML blob (idempotent) | Always |
| `AxiomAutoTriggerService` | Triggers Axiom AI QC analysis | `axiomAutoTrigger: true` (default: `true`) |

### Review assignment loop

Same ranked-list retry pattern as vendor assignment, using `order.autoReviewAssignment`:
- Reviewer has `reviewExpiryHours` (default: **8 hours**) to accept.
- `ReviewAssignmentTimeoutJob` runs every **5 minutes**, publishes **`review.assignment.timeout`** for expired assignments.
- If all reviewers exhausted → **`review.assignment.exhausted`** published; `order.requiresHumanReviewAssignment = true`.

---

## Phase 4 — Axiom AI QC Scoring

**Trigger:** Axiom job completes  
**Events:** `axiom.evaluation.completed` or `axiom.evaluation.timed.out`  
**Service:** `AutoAssignmentOrchestratorService` handles the result

**Axiom timeout watchdog:**  
`AxiomTimeoutWatcherJob` runs every **5 minutes**, publishes `axiom.evaluation.timed.out` if Axiom hasn't responded within `axiomTimeoutMinutes` (default: **10 min**).

**Scoring thresholds (`aiQcPassThreshold: 90`, `aiQcFlagThreshold: 70`):**

| Score | Outcome |
|---|---|
| ≥ 90 | Auto-approved by AI; proceeds directly to delivery path |
| 70–89 | Flagged for human review — analyst receives report with AI notes |
| < 70 | Flagged for human review with escalation note |
| timed out | Falls back to normal human QC routing |

---

## Phase 5 — Human QC Review

**No automation in this phase** — human analyst reviews the report.

**Human actions available:**
- Approve → triggers Phase 6
- Request revision → order returns to vendor; revision cycle tracked
- Escalate → `SupervisoryReviewService` creates a supervisory review record

**Supervisory review (optional):**  
If `supervisoryReviewForAllOrders: true` or loan amount exceeds `supervisoryReviewValueThreshold`, a supervisory layer is added before final approval. `SupervisionTimeoutWatcherJob` runs every **15 minutes** to monitor supervisor response.

---

## Phase 6 — Delivery & Engagement Close-Out

**Trigger:** Order approved by QC → `order.status.changed { newStatus: APPROVED }`  
**Then:** `order.delivered` is published once delivery is confirmed

### What fires on `order.delivered`

| Service | Action | Config gate |
|---|---|---|
| `AutoDeliveryService` | Uploads final report to client portal; sets `order.status = DELIVERED` | `autoDeliveryEnabled: true` (default: `true`) |
| `EngagementLifecycleService` | Checks if all orders in the engagement are delivered; if so, closes the engagement | `autoCloseEngagementEnabled: true` (default: `true`) |
| `UcdpEadAutoSubmitService` | Submits to UCDP and/or EAD GSE portals if loan type is FHA or VA | Always (skips if loan type ineligible) |
| `VendorPerformanceUpdaterService` | Recalculates vendor scorecard (on-time rate, quality score, acceptance rate) | Always |
| `AuditEventSinkService` | Persists full audit trail entry | Always |
| `CoreNotificationOrchestrator` | Sends delivery confirmation to lender and borrower | Always |

**Final state:**
```
Order.status             = DELIVERED
LenderEngagement.status  = DELIVERED  (when all loans delivered)
vendor performance doc   = updated
MISMO XML blob           = generated (from Phase 3)
UCDP/EAD submission      = confirmed (if FHA/VA)
```

---

## Phase 7 — ROV Intake & AI Triage

**Trigger:** `POST /api/rov/requests`  
**Service:** `ROVManagementService`

ROV (Reconsideration of Value) is a separate lifecycle that runs in parallel to the main order flow and can be initiated at any point after appraisal delivery.

**What happens on submission:**
1. `ROVManagementService.createROVRequest()` validates and persists the ROV document.
2. SLA tracking is started (default: 10 business days to respond).
3. AI triage fires **asynchronously** (fire-and-forget from the caller's perspective):
   - Calls `UniversalAIService.generateCompletion()` with the challenge description, property, and evidence.
   - Response is validated against `ROVAITriageResult` schema before any DB write.
   - Triage result is appended to `rov.internalNotes` and a `AI_TRIAGE_COMPLETED` timeline entry is added.
   - `rov.priority` is updated to the AI-recommended level (`NORMAL` / `HIGH` / `URGENT`).
   - `rov.complianceFlags` auto-escalated:
     - `complianceRisk: 'medium'` → `legalReview = true`
     - `complianceRisk: 'high'` → `legalReview = true` + `regulatoryEscalation = true`
     - Existing flags are **never cleared** (OR-semantics).

**Manual re-trigger:** `POST /api/rov/requests/:id/triage` (e.g., when new evidence is uploaded)

**AI triage output fields:**
```
meritScore              0-100 (100 = overwhelming evidence for reconsideration)
challengeMerit          strong | moderate | weak | frivolous
recommendedPriority     NORMAL | HIGH | URGENT
primaryChallengeIssues  [ ... ]
evidenceGaps            [ ... ]
suggestedComparableSearch { distanceMiles, saleDateWindowMonths, sqft range, features }
complianceRisk          none | low | medium | high
triageSummary           2-4 sentence plain-language summary for reviewer
```

---

## Timeout Watchdogs (Background Jobs)

These jobs run as `setInterval` loops inside the server process. They do **not** mutate data directly — they publish events and let the orchestrator handle state transitions.

| Job | Interval | Publishes | What it scans |
|---|---|---|---|
| `VendorTimeoutCheckerJob` | 5 min | `vendor.bid.timeout` | `orders` where `autoVendorAssignment.status = PENDING_BID AND currentBidExpiresAt <= now` |
| `ReviewAssignmentTimeoutJob` | 5 min | `review.assignment.timeout` | `qc-reviews` where `autoAssignmentExpiresAt <= now` |
| `AxiomTimeoutWatcherJob` | 5 min | `axiom.evaluation.timed.out` | Orders waiting for Axiom beyond `axiomTimeoutMinutes` |
| `SupervisionTimeoutWatcherJob` | 15 min | `supervision.timeout` | `supervisory-reviews` where `expiresAt <= now` |

---

## SLA & Overdue Monitoring

| Job | Interval | What it does |
|---|---|---|
| `SLAMonitoringJob` | 10 min | Scans all active orders for SLA breach; publishes `order.sla.breach` |
| `OverdueOrderDetectionJob` | periodic | Detects past-due orders; publishes `order.overdue` |
| `ReviewSLAWatcherJob` | 5 min | Monitors QC review SLA deadlines |

---

## Dead Letter Queue Monitor

`DeadLetterQueueMonitorService` scans the dead-letter sub-queues of all 10 Service Bus subscriptions every **10 minutes**. Any DLQ message triggers an alert log and (if configured) an escalation notification. This catches any event that failed all 5 delivery attempts.

**Monitored subscriptions:**
`notification-service`, `auto-assignment-service`, `auto-delivery-service`, `ai-qc-gate-service`, `engagement-lifecycle-service`, `engagement-letter-autosend-service`, `axiom-auto-trigger-service`, `vendor-performance-updater-service`, `ucdp-ead-auto-submit-service`, `mismo-auto-generate-service`

---

## Service Bus Subscriptions Reference

All on the **`appraisal-events`** topic (Standard/Premium SKU — Basic not supported).

| Subscription name | Service | Listens for |
|---|---|---|
| `notification-service` | `CoreNotificationOrchestrator` | All events |
| `auto-assignment-service` | `AutoAssignmentOrchestratorService` | `engagement.order.created`, `vendor.bid.*`, `order.status.changed`, `review.assignment.timeout`, `axiom.evaluation.*` |
| `auto-delivery-service` | `AutoDeliveryService` | `order.status.changed { APPROVED }` |
| `ai-qc-gate-service` | AI QC gate | `order.status.changed { SUBMITTED }` |
| `engagement-lifecycle-service` | `EngagementLifecycleService` | `order.delivered` |
| `engagement-letter-autosend-service` | `EngagementLetterAutoSendService` | `engagement.order.created` |
| `axiom-auto-trigger-service` | `AxiomAutoTriggerService` | `order.status.changed { SUBMITTED }` |
| `vendor-performance-updater-service` | `VendorPerformanceUpdaterService` | `order.delivered` |
| `ucdp-ead-auto-submit-service` | `UcdpEadAutoSubmitService` | `order.delivered` |
| `mismo-auto-generate-service` | `MismoAutoGenerateService` | `order.status.changed { SUBMITTED }` |

All subscriptions are configured with:
- `maxDeliveryCount: 5` — 5 attempts before dead-lettering
- `lockDuration: PT5M` — 5 minute processing lock
- `deadLetteringOnMessageExpiration: true`

---

## Tenant Automation Config Defaults

All automation is controlled by `TenantAutomationConfig` (stored per tenant in Cosmos DB, falls back to these defaults):

| Setting | Default | Effect when changed |
|---|---|---|
| `autoAssignmentEnabled` | `true` | Disable to require manual vendor assignment for all orders |
| `bidLoopEnabled` | `true` | Disable to stop automatic retry on timeout/decline |
| `maxVendorAttempts` | `5` | Max vendors tried before escalation |
| `bidExpiryHours` | `4` | Hours a vendor has to accept/decline a bid |
| `reviewExpiryHours` | `8` | Hours a reviewer has to accept a QC assignment |
| `supervisorTimeoutHours` | `8` | Hours before supervisory review times out |
| `bidMode` | `'sequential'` | `'broadcast'` sends to `broadcastCount` vendors simultaneously |
| `broadcastCount` | `5` | Vendors contacted in parallel when `bidMode = 'broadcast'` |
| `aiQcEnabled` | `false` | Enable/disable Axiom AI QC scoring (overridden to `true` by `axiomAutoTrigger`) |
| `axiomAutoTrigger` | `true` | Auto-trigger Axiom on every SUBMITTED order |
| `axiomTimeoutMinutes` | `10` | Minutes before Axiom evaluation times out |
| `aiQcPassThreshold` | `90` | Score ≥ this → auto-approved by AI |
| `aiQcFlagThreshold` | `70` | Score < this → flagged with escalation note |
| `autoDeliveryEnabled` | `true` | Auto-upload report to client portal on approval |
| `autoCloseEngagementEnabled` | `true` | Auto-close engagement when all orders delivered |
| `engagementLetterAutoSend` | `true` | Auto-generate and send engagement letter on order creation |
| `requireSignedLetterBeforeProgress` | `false` | Block order progression until letter is countersigned |
| `supervisoryReviewForAllOrders` | `false` | Require supervisory review on every order |
| `supervisoryReviewValueThreshold` | `0` | Require supervisor review when loan amount exceeds this value (`0` = disabled) |

**To update config for a tenant:**  
`PUT /api/tenants/:tenantId/automation-config`

---

## Human Intervention Points

The system emails/notifies the escalation recipients (`escalationRecipients` in config) and sets a flag on the order document when human action is required.

| Trigger | Flag set on order | Required human action |
|---|---|---|
| `vendor.assignment.exhausted` | `requiresHumanVendorAssignment: true` | Manually assign a vendor via `POST /api/orders/:id/assign` |
| `review.assignment.exhausted` | `requiresHumanReviewAssignment: true` | Manually assign QC reviewer via `POST /api/qc/reviews/:id/assign` |
| `axiom.evaluation.timed.out` | — | Falls back to normal reviewer queue; no manual action needed |
| Axiom score < 70 | `axiomFlagged: true` | Reviewer sees AI flag notes; must approve or reject manually |
| ROV `complianceRisk: high` | `complianceFlags.regulatoryEscalation: true` | Legal/compliance team review required before responding |

---

## How to Watch It Happening

### Local server logs

```powershell
cd c:\source\appraisal-management-backend
pnpm start
```

All background services log every event they handle with structured JSON. Filter for the automation pipeline:

```powershell
pnpm start 2>&1 | Select-String 'vendor\.bid|review\.|order\.status|engagement\.order|axiom\.|order\.delivered'
```

Key log messages to watch:
- `"Scanning for expired vendor bids..."` — VendorTimeoutCheckerJob running
- `"Published vendor.bid.timeout"` — bid expired, orchestrator will retry
- `"vendor bid accepted"` — order moves to ASSIGNED
- `"Assigning reviewer"` — QC assignment happening
- `"Auto-delivery triggered"` — order being delivered
- `"EngagementLifecycleService: closing engagement"` — final close-out

### Azure Service Bus (deployed environment)

Azure Portal → Service Bus namespace → `appraisal-events` topic → each subscription:
- **Active messages** — events currently being processed
- **Dead-letter messages** — events that failed 5 times (investigate these)
- **Message count** — backlog building up indicates a service is down

### Server status endpoint

```
GET /api/health/jobs
```

Returns the running status and last-scan timestamp of all background jobs.

---

## Test Coverage Reference

| Test file | What it covers | How to run |
|---|---|---|
| [tests/auto-assignment-orchestrator.test.ts](tests/auto-assignment-orchestrator.test.ts) | Full FSM: vendor bid happy path, timeout, decline, exhaustion, internal staff direct-assign, reviewer assignment, reviewer timeout, reviewer exhaustion, idempotency | `pnpm vitest run tests/auto-assignment-orchestrator.test.ts` |
| [tests/vendor-timeout-checker.test.ts](tests/vendor-timeout-checker.test.ts) | VendorTimeoutCheckerJob: expired bid detection, event publishing, firewall lockout | `pnpm vitest run tests/vendor-timeout-checker.test.ts` |
| [tests/rov-ai-triage.test.ts](tests/rov-ai-triage.test.ts) | ROV AI triage: happy path, compliance flag escalation (high/medium/none), schema validation, error paths | `pnpm vitest run tests/rov-ai-triage.test.ts` |
| [tests/qc-workflow-e2e.test.ts](tests/qc-workflow-e2e.test.ts) | QC queue management, SLA tracking, revision workflow, escalation — **requires running server** | `INTEGRATION_TESTS=true pnpm vitest run tests/qc-workflow-e2e.test.ts` |
| [tests/duplicate-order-detection.test.ts](tests/duplicate-order-detection.test.ts) | Address normalization, duplicate matching, advisory-only behaviour | `pnpm vitest run tests/duplicate-order-detection.test.ts` |
| [tests/rov-research-phase0.test.ts](tests/rov-research-phase0.test.ts) | ROV comparable search and market trend analysis via MLS provider interface | `pnpm vitest run tests/rov-research-phase0.test.ts` |

**Run all 62 test files (1275 tests):**
```powershell
pnpm vitest run
```

---

## Known Gaps & Deferred Work

> These are **intentionally deferred** items — they are documented here so they are not forgotten.
> None of them affect runtime correctness today. Each has a clear action when the time comes.

### 1. Audit event container TTL — data retention not yet enforced

**File:** `infrastructure/modules/cosmos-audit-events-container.bicep`  
**Current state:** `defaultTtl: -1` — TTL is enabled at the container level but no documents carry a `ttl` field, so **nothing ever expires**. Audit events accumulate indefinitely.

**Why this matters:**
- Storage grows without bound. At 1,000 orders/month the container reaches ~1.2 GB/year and ~6 GB over five years.
- USPAP requires appraisal records to be retained for **5 years** (or 2 years past final judicial proceedings). There is no regulatory obligation to retain them longer.

**When to fix:** Before production go-live, or once the first environment accumulates a non-trivial data set.

**How to fix (one-line Bicep change):**
```bicep
// In infrastructure/modules/cosmos-audit-events-container.bicep
defaultTtl: 220752000  // 7 years in seconds (USPAP: 5 yr minimum; 7 yr is conservative industry standard)
```
Cosmos will auto-expire documents in the background — no application code change required. Also apply the same treatment to the `audit-trail` container (that container has no Bicep module yet; one needs to be created).

**Also needed:** The new-event-type gap — `AuditEventSinkService.ALL_EVENT_TYPES` is a static list. Any new event type published to the bus that is not in that list will be silently dropped by the sink. When new event types are added to the system, `ALL_EVENT_TYPES` and the `EVENT_META` table in `src/services/audit-event-sink.service.ts` must be updated in the same PR.
