# Appraisal Management — Process Automation Audit

**Date:** March 14, 2026  
**Scope:** Full lifecycle automation — Phase 1 (Order Intake) through Phase 7 (Final Delivery)  
**Basis:** Code-verified — cross-referenced against all 150+ service files, the event pipeline, and tenant config defaults

---

## How to Read This Document

Each phase is rated on two axes:

- **Built** — Is the code written and wired into the running server?
- **Automated** — Does it run without a human touching it?

A feature can be Built but not Automated (e.g. a service exists but its tenant-config flag defaults to `false`).

**Ratings:** ✅ Complete · ⚠️ Partial · ❌ Missing/Manual · 🔒 Flag-gated (off by default)

---

## The Event Bus

The entire automation pipeline rides on Azure Service Bus Topic `appraisal-events`.
Every service subscribes independently — no service calls another service directly.

| Subscription | Service | Status |
|---|---|---|
| `notification-service` | `CoreNotificationOrchestrator` | ✅ Active |
| `auto-assignment-service` | `AutoAssignmentOrchestratorService` | ✅ Active |
| `auto-delivery-service` | `AutoDeliveryService` | ✅ Active (subscription added today) |
| `audit-event-sink` | `AuditEventSinkService` | ✅ Active (subscription added today) |
| `ai-qc-gate-service` | `AIQCGateService` | ✅ Active (subscription added today) |
| `engagement-lifecycle-service` | `EngagementLifecycleService` | ✅ Active (subscription added today) |
| `engagement-letter-autosend-service` | `EngagementLetterAutoSendService` | ✅ Active (subscription added today) |
| `axiom-auto-trigger-service` | `AxiomAutoTriggerService` | ✅ Active (subscription added today) |
| `vendor-performance-updater-service` | `VendorPerformanceUpdaterService` | ✅ Active (subscription added today) |

> **Note:** 6 of 9 subscriptions were missing from the Bicep until today, causing silent `MessagingEntityNotFound`
> errors. The services existed and were registered in the server, but could not receive any messages.
> This means all automation downstream of the event bus was broken in staging for an unknown period.

---

## Phase 1: Order Intake & Routing

### 1.1 Order Creation
| Step | Built | Automated | Notes |
|---|---|---|---|
| REST API `POST /api/orders` | ✅ | ✅ | Immediate ID + Cosmos write |
| Required field validation | ✅ | ✅ | `OrderIntakeService` |
| Order number generation | ✅ | ✅ | Sequential, year-prefixed |
| `order.created` event published | ✅ | ✅ | `OrderEventService` fires on every create |
| Audit trail entry | ✅ | ✅ | `AuditEventSinkService` persists to Cosmos |

### 1.2 Property Intelligence / Pre-Screening
| Step | Built | Automated | Notes |
|---|---|---|---|
| Census data enrichment | ✅ | ✅ | Fires on order create |
| Google Places nearby | ✅ | ✅ | Fires on order create |
| Geospatial risk scoring | ✅ | ✅ | Fires on order create |
| USPAP pre-check | ⚠️ | ❌ | Service exists, not wired to intake |
| Flood zone (FEMA) | ❌ | ❌ | Planned, not built |
| AVM comparison at intake | ❌ | ❌ | Planned |
| Duplicate order detection | ✅ | ⚠️ | Service built, not confirmed wired to intake path |

### 1.3 Routing Decision
| Step | Built | Automated | Notes |
|---|---|---|---|
| Manual assignment | ✅ | N/A | Staff-initiated via UI |
| Auto-assignment via bid loop | ✅ | 🔒 | `autoAssignmentEnabled` defaults `true` — **but see Phase 2** |
| Broadcast bid mode | ✅ | 🔒 | `bidMode: 'sequential'` default; broadcast requires config change |
| Risk-based routing (Axiom score) | ❌ | ❌ | Designed, not implemented |

---

## Phase 2: Vendor Engagement — Auto-Assignment Orchestrator

This is the most sophisticated automation in the system.
`AutoAssignmentOrchestratorService` (~1,528 lines) is a full **event-driven state machine**.

### Event chain — Vendor Side
```
engagement.order.created
  → rank vendors (VendorMatchingEngine)
  → dispatch bid to vendor[0]
  → publish vendor.bid.sent

vendor.bid.timeout  |  vendor.bid.declined
  → try vendor[n+1] (up to maxVendorAttempts=5)
  → if exhausted → publish vendor.assignment.exhausted → human escalation

vendor.bid.accepted
  → update order status → ASSIGNED
  → if engagementLetterAutoSend=true → trigger letter send
```

### Event chain — QC Reviewer Side
```
order.status.changed { newStatus: SUBMITTED }
  → add to QC queue
  → rank reviewers (staff with 'reviewer' role)
  → assign reviewer[0]
  → publish review.assignment.requested + review.assigned

review.assignment.timeout
  → try reviewer[n+1] (up to maxReviewerAttempts=5)
  → if exhausted → publish review.assignment.exhausted → human escalation
```

| Capability | Built | Automated | Notes |
|---|---|---|---|
| Vendor ranking (VendorMatchingEngine) | ✅ | ✅ | Score-based: license, distance, workload, performance |
| Sequential bid dispatch | ✅ | ✅ | Fire-and-forget with expiry timestamp written to order doc |
| Bid timeout detection | ✅ | ⚠️ | Service handles the event but **nothing publishes `vendor.bid.timeout`** unless a job fires it |
| Bid retry (next vendor) | ✅ | ✅ | Handles on receiving timeout/declined event |
| Broadcast mode | ✅ | 🔒 | `bidMode: 'broadcast'` off by default |
| Human escalation when exhausted | ✅ | ✅ | Publishes `vendor.assignment.exhausted` → notification service |
| Reviewer ranking | ✅ | ✅ | Staff pool with `reviewer` role |
| Reviewer timeout/retry | ✅ | ✅ | Same pattern as vendor side |
| Supervisory review trigger | ✅ | 🔒 | `supervisoryReviewForAllOrders` and `supervisoryReviewValueThreshold` both off by default |

**Critical gap:** Bid timeout detection requires a periodic job (timer trigger) to scan orders with `autoVendorAssignment.currentBidExpiresAt < now` and publish `vendor.bid.timeout`. This job is **not implemented**. Without it, timed-out bids sit forever and the retry loop never fires.

---

## Phase 3: Inspection & Data Collection

| Step | Built | Automated | Notes |
|---|---|---|---|
| Inspection record creation | ✅ | ❌ | Manual create via API |
| Inspection scheduling reminder (SLA) | ✅ | ⚠️ | `SLATrackingService` detects breach; unclear if reminders fire |
| Borrower contact (ACS) | ⚠️ | ❌ | ACS integration built; automated trigger not wired |
| Photo upload / storage | ✅ | N/A | Vendor-driven upload to Blob |
| Photo quality validation (AI) | ❌ | ❌ | Planned |
| MLS comp retrieval (Bridge API) | ✅ | ❌ | Service built; manual pull only |
| Appraiser workload notification | ✅ | ✅ | Notification fires on assignment |

---

## Phase 4: Report Creation / Axiom Integration

| Step | Built | Automated | Notes |
|---|---|---|---|
| Axiom auto-trigger on SUBMITTED | ✅ | 🔒 | `AxiomAutoTriggerService` built; `axiomAutoTrigger` defaults `false` |
| Axiom evaluation status polling | ✅ | ✅ | Polls until complete or `axiomTimeoutMinutes` exceeded |
| Axiom timeout fallback to human QC | ✅ | ✅ | `AxiomEvaluationTimedOutEvent` → normal QC routing |
| Risk score stored on order | ✅ | 🔒 | Only when Axiom auto-trigger enabled |
| UAD 3.6 field validation | ⚠️ | ❌ | Service exists, not integrated into submission path |
| MISMO XML generation | ✅ | ❌ | On-demand only; not auto-generated on submission |
| Risk-based routing (<30 / 30-70 / >70) | ❌ | ❌ | Designed, not implemented |

---

## Phase 5: QC Review

| Step | Built | Automated | Notes |
|---|---|---|---|
| QC queue entry on SUBMITTED | ✅ | ✅ | Orchestrator adds to queue on status change |
| Priority scoring | ✅ | ✅ | Rush/SLA/complexity factored in |
| AI QC gate (auto-pass at score ≥ 90) | ✅ | 🔒 | `AIQCGateService` built; `aiQcEnabled` defaults `false` |
| QC checklist creation | ✅ | ⚠️ | Checklist created; Axiom auto-population gated on Axiom trigger |
| Axiom checklist auto-population | ⚠️ | 🔒 | Partial; requires `axiomAutoTrigger: true` |
| Reviewer assignment (auto) | ✅ | ✅ | Orchestrator handles when SUBMITTED (see Phase 2) |
| Reviewer timeout/retry | ✅ | ⚠️ | Handles event but timer job to publish `review.assignment.timeout` is missing (same gap as vendor timeout) |
| Revision request workflow | ✅ | ❌ | Manual: analyst creates revision, notifies vendor |
| Revision received → auto re-QC | ✅ | ✅ | Status change to SUBMITTED re-triggers queue entry |
| Bias screening | ✅ | ⚠️ | `BiasScoringService` built; integration into QC flow unclear |
| Fraud detection flags | ✅ | ⚠️ | `FraudDetectionService` built; auto-trigger on QC unclear |

### QC Decision Routing
| Decision | Automation |
|---|---|
| APPROVED | ✅ Auto-triggers delivery pipeline |
| APPROVED_WITH_CONDITIONS | ✅ Status updates; condition tracking manual |
| REVISION_REQUIRED | ✅ Sends to vendor; SLA clock resets |
| REJECTED | ✅ Notifies vendor; order marked rejected |

---

## Phase 5A/5B: Revision Loop & Disputes

| Step | Built | Automated | Notes |
|---|---|---|---|
| Revision creation by analyst | ✅ | N/A | Manual |
| Revision notification to vendor | ✅ | ✅ | Notification fires on revision.requested event |
| Revision deadline tracking | ✅ | ✅ | SLA tracking monitors revision window |
| Overdue revision escalation | ⚠️ | ⚠️ | Overdue detection exists; escalation notification unclear |
| Revision received → auto re-queue | ✅ | ✅ | Re-SUBMITTED → orchestrator re-adds to QC queue |
| Dispute management | ✅ | ❌ | Manual workflow, no automation |

---

## Phase 6: ROV (Reconsideration of Value)

| Step | Built | Automated | Notes |
|---|---|---|---|
| ROV request ingestion | ✅ | N/A | Client/borrower initiated |
| AI triage (new comp analysis) | ⚠️ | ❌ | `ROVManagementService` built; AI analysis stub |
| Route to original appraiser | ✅ | ❌ | Manual routing |
| 7-day response window tracking | ✅ | ✅ | SLA integration tracks deadline |
| Value revised → back to QC | ✅ | ✅ | Status transition triggers QC queue entry |
| Notification on all transitions | ✅ | ✅ | Event bus fires notifications |

---

## Phase 7: Final Delivery

| Step | Built | Automated | Notes |
|---|---|---|---|
| PDF report generation | ✅ | ⚠️ | `FinalReportService` built; manually triggered or post-QC-approval |
| MISMO XML generation | ✅ | ❌ | On-demand only |
| Auto-delivery on QC approval | ✅ | 🔒 | `AutoDeliveryService` built; `autoDeliveryEnabled` defaults `false` |
| Client portal upload | ✅ | 🔒 | Part of auto-delivery |
| Delivery confirmation notification | ✅ | ✅ | Fires on `order.delivered` event |
| Engagement auto-close | ✅ | 🔒 | `EngagementLifecycleService` listens for `order.delivered`; `autoCloseEngagementEnabled` defaults `false` |
| Engagement letter to vendor | ✅ | 🔒 | `EngagementLetterAutoSendService`; `engagementLetterAutoSend` defaults `false` |
| Post-delivery compliance audit | ✅ | ✅ | `AuditEventSinkService` persists everything |
| Vendor performance recalculation | ✅ | ✅ | `VendorPerformanceUpdaterService` listens to `order.delivered` |
| UCDP/EAD submission | ✅ | ❌ | Service built; no auto-trigger on delivery |

---

## Cross-Cutting Concerns

| Concern | Built | Automated | Notes |
|---|---|---|---|
| SLA tracking | ✅ | ✅ | `SLATrackingService` monitors all active orders |
| Overdue order detection | ✅ | ✅ | Scans for past-due, publishes events |
| Audit trail | ✅ | ✅ | Every status change persisted via `AuditEventSinkService` |
| Dead letter queue monitor | ✅ | ✅ | `DeadLetterQueueMonitorService` monitors notification-service + auto-assignment-service subscriptions |
| Notification delivery (email/SMS/in-app) | ✅ | ✅ | `CoreNotificationOrchestrator` handles all channels |
| In-app notifications | ✅ | ✅ | `InAppNotificationService` wired to core events |
| Duplicate order detection | ✅ | ⚠️ | Service built; integration into intake path unclear |
| Access control (RBAC/ABAC) | ✅ | ✅ | Casbin engine with role-based rules |
| Payment/billing | ✅ | ❌ | `PaymentProcessingService` + `BillingEnhancementService` exist; no auto-trigger |

---

## Summary — What Actually Runs Automatically Today

When `autoAssignmentEnabled: true` (the default) and all Service Bus subscriptions are present (as of today), the following chain runs without human intervention:

```
Order created
  → Census/Places/Geospatial enrichment fires
  → AuditEventSink records it
  → AutoAssignment ranks vendors, dispatches bid to vendor[0]
  → If vendor accepts → order → ASSIGNED → notification fires
  → If vendor submits (SUBMITTED) → QC queue entry + reviewer assigned
  → If QC approved → (manual today, auto-delivery if flag enabled)
  → order.delivered → vendor performance recalculated
  → order.delivered → engagement lifecycle checks auto-close
```

**Everything else is either manual, flag-gated (off by default), or has a missing timer job.**

---

## Top 10 Gaps — Prioritized by Impact

| Priority | Gap | Impact | Effort |
|---|---|---|---|
| 1 | **Bid/review timeout timer job** — no job publishes `vendor.bid.timeout` or `review.assignment.timeout`; timed-out assignments sit forever | Breaks core assignment retry loop | 1 day |
| 2 | **Dead letter monitor only covers 2 of 9 subscriptions** — `DeadLetterQueueMonitorService` hardcodes `notification-service` + `auto-assignment-service`; 7 others are uncovered | Silent message loss | 0.5 day |
| 3 | **`autoDeliveryEnabled` defaults false** — QC-approved orders require manual delivery trigger; the entire auto-delivery service is wired but never fires | Eliminates Phase 7 automation | Config + validation |
| 4 | **`axiomAutoTrigger` defaults false** — Axiom is the AI brain of QC; without it the AI QC gate, checklist auto-population, and risk-based routing are all inert | AI value not realized | Config + testing |
| 5 | **`autoCloseEngagementEnabled` defaults false** — Engagements never auto-close; staff must manually move them to COMPLETED | Operational overhead | Config + validation |
| 6 | **`engagementLetterAutoSend` defaults false** — Engagement letters sent manually; the entire `EngagementLetterAutoSendService` is inert | Friction in vendor onboarding | Config + testing |
| 7 | **UCDP/EAD submission not triggered on delivery** — Service built but not wired to the `order.delivered` event | Regulatory reporting is manual | 0.5 day |
| 8 | **MISMO XML not auto-generated on submission** — Underwriting integration manual | Client integration friction | 0.5 day |
| 9 | **Duplicate order detection not wired to intake** — Service exists, runs in isolation | Potential duplicate orders | 1 day |
| 10 | **ROV AI triage is a stub** — `ROVManagementService` has the interface but no real AI analysis for new comps | ROV is fully manual | 3-5 days |

---

## Recommended Next Steps

### Immediate (this sprint)
1. **Implement the bid/review timeout timer job** — a simple Azure Container App scheduled job (or cron in the existing container) that runs every 15 minutes, queries orders with expired bid/review timestamps, and publishes the timeout events. This unblocks the entire retry/escalation chain.
2. **Enable `autoDeliveryEnabled` and `autoCloseEngagementEnabled` for the staging tenant** — both services are fully built and tested; they just need the config flip. Validate the end-to-end flow in staging first.
3. **Expand dead letter monitor to all 9 subscriptions** — mechanical change, prevents silent message loss.

### Short term (next 2-4 weeks)
4. **Enable `axiomAutoTrigger` for staging** — with subscriptions now working, test the full Axiom pipeline.
5. **Enable `engagementLetterAutoSend`** — confirm e-signature flow (internal e-sign service) works end to end.
6. **Wire UCDP/EAD auto-submit on `order.delivered`** — add a listener in `AutoDeliveryService` or a new subscriber.

### Medium term (next quarter)
7. **Risk-based routing** — use Axiom score (<30 / 30-70 / >70) to branch QC routing instead of the current flat queue.
8. **Vendor acceptance portal** — vendors currently accept/decline via API; a lightweight web view would close the loop without staff intervention.
9. **Borrower communication automation** — ACS infrastructure is built; wire automated inspection appointment reminders based on inspection record creation.
10. **ROV AI triage** — integrate Axiom or GPT-4 to pre-analyze new comps before routing to the original appraiser.
