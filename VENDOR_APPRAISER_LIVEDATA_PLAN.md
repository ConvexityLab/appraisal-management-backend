# Vendor & Appraiser Management — Live Data Plan

> Created: 2026-02-18
> Goal: Make all vendor/appraiser routes functional with real data, with communications and document management naturally integrated.

---

## Phase A: Fix Core Vendor CRUD (Foundation) ✅ COMPLETE

- [x] **A1.** Rewrote `ProductionVendorController` → `VendorController` with Router pattern, `transformVendorToProfile`, validation middleware
- [x] **A2.** Mounted `VendorController` at `/api/vendors` in `api-server.ts`
- [x] **A3.** Removed inline vendor routes from `api-server.ts`
- [x] **A4.** Archived dead `VendorController` → `vendor.controller.ts.DEAD`
- [x] **A5.** Rewrote `VendorManagementService` — replaced in-memory Map with CosmosDbService delegation

## Phase B: Wire Notification Stub → Real Services

- [x] **B1.** Make `NotificationService` (the stub) delegate to real `EmailNotificationService` — sends ACS email, records communication history ✅
- [x] **B2.** Entity-scoped communication history — already implemented in `communication.controller.ts`: `/order/:orderId`, `/vendor/:vendorId`, `/appraiser/:appraiserId` ✅

## Phase C: Add Missing Routes for Frontend Features

- [x] **C1.** Negotiations controller — created `negotiation.controller.ts`, mounted at `/api/negotiations`, all 4 frontend endpoints + history/active/check-expired ✅
- [x] **C2.** Auto-Assignment — added `GET /suggest` route to existing controller, transforms `VendorMatchResult` → frontend `VendorSuggestion` shape ✅
- [x] **C3.** Appraiser portal acceptance — already fully implemented in `AppraiserController`: `/pending`, `/accept`, `/reject` all backed by real Cosmos queries ✅

## Phase D: Unify Document Management

- [x] **D1.** Added `entityType`/`entityId` to `DocumentMetadata` and upload flow — documents can now be associated with vendors, appraisers, clients, not just orders ✅
- [x] **D2.** Document listing by entity — `GET /api/documents?entityType=vendor&entityId=xyz` now supported in controller + service + types ✅

## Phase E: Connect Event-Driven Architecture

- [x] **E1.** Wired `CoreNotificationService` (event orchestrator) into app startup — subscribes to Service Bus events, routes to WebSocket/Email channels ✅
- [x] **E2.** Connected event orchestrator's email channel to real `EmailNotificationService` (ACS-backed) — no longer a stub ✅
- [x] **E3.** Web PubSub already fully implemented in `web-pubsub.service.ts` — now wired through event orchestrator startup ✅

## Phase F: Remaining Stubs & Polish

- [x] **F1.** Vendor certification `getVendorCertifications` — now queries certifications container first, falls back to vendor record ✅
- [ ] **F2.** State board verification (`performVerification`) — still mock (90% pass rate, 1-second sleep). Needs real state licensing board API integration (ASC registry).
- [x] **F3.** Onboarding `createVendorFromApplication` — now creates a real vendor record in Cosmos when application is approved ✅
- [ ] **F4.** Onboarding background check (`performBackgroundCheck`) — still mock (returns CLEAR). Needs Checkr/Sterling integration.
- [ ] **F5.** SMS sending — `SmsService` is real ACS implementation but requires purchasing an ACS phone number.
- [ ] **F6.** Payment providers — Stripe/ACH/Wire/Check handlers are stubs with fake transaction IDs. Needs real Stripe SDK wiring.
- [ ] **F7.** Historical analytics (`buildVendorHistory`) — returns current metrics for every month. Needs time-series snapshots in dedicated Cosmos container.

---

## Dependency Graph

```
Phase A (Vendor CRUD)      ──┐
Phase B (Notifications)    ──┼──→ Phase E (Event-Driven)
Phase C (Missing Routes)   ──┘
Phase D (Documents)        ──→ standalone
Phase F (Stubs)            ──→ standalone
```

Phases A, B, C, D can be worked in parallel. Phase E depends on B.
