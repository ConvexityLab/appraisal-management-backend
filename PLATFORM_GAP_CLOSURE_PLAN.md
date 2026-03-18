# Platform Gap Closure Plan

**Date:** 2025-01  
**Status:** 🟡 In Progress  
**Purpose:** Track implementation of competitive features identified against Privy.pro and Reggora.com.  

---

## Executive Summary

Full codebase audit was performed before writing this plan.  Several items initially flagged as "gaps" were already substantially implemented — that context is captured below.  The 18 items are organized into four phases based on dependency order and scope.

---

## Audit Findings — What We Actually Have

| Area | What Exists | Verdict |
|---|---|---|
| Fee escalation | `EscalationCase`, `EscalationStatus`, `EscalationReason` types; `communication-event-handler` resolves escalation recipients | ✅ Built |
| Counter-offer / negotiation | Full `negotiationsApi.ts` RTK Query slice; `/api/negotiations/active/:id`, `/history/:id`, `/pending-counter-offers`, `/accept`, `/reject`, `/counter-offer`, `/respond-counter` | ✅ Built |
| Vendor blacklist (exclusionary) | `blacklist` rule type in `vendor-matching-rules.service.ts`; client exclusion check in `vendor-assignment.service.ts` | ⚠️ Partial — no admin API or UI |
| ROV | Full `rov.controller.ts` + `rov-management.service.ts`; POST create, GET list/single, POST assign, PUT research, POST response | ✅ Built — needs enhancement |
| Payment provider abstraction | `payment.types.ts` with ACH/WIRE/CHECK/CARD/STRIPE; `StripePaymentProvider` class in `src/services/payment-providers/stripe.provider.ts` | ⚠️ Partial — Stripe SDK not installed, provider not wired to controller |
| WebPubSub | `web-pubsub.service.ts` with `broadcastNotification`, `sendToGroup`, `sendToAll`, `addUserToGroup`, group access URL generation | ✅ Built — event catalog incomplete |
| MLS data model | `MlsExtension` interface; `mlsData` on every `CanonicalComp`; `mlsNumber`, `soldDate`, `daysOnMarket`, `listingStatus`, photos | ✅ Modeled — live provider call path needs audit |
| Delivery receipt | `post-delivery.service.ts` has `DELIVERY_CONFIRMATION` task — no structured model, no timestamp/identity capture, no RESPA tracking | ❌ Stub only |
| E-consent | Not found | ❌ Missing |
| Investor activity / market data | Not found | ❌ Missing |
| Auto Deal Finder | Not found | ❌ Missing |
| Strategy-based comp search | Not found | ❌ Missing |
| Before/After photos | Not found | ❌ Missing |
| Investment proforma | Not found | ❌ Missing |
| Market map visualization | Not found | ❌ Missing |
| Alert system | Not found | ❌ Missing |
| Off-market data module | Not found | ❌ Missing |
| GSE UCDP/EAD submission | MISMO XML generator + MISMO mapper exists; UAD 3.6 types built | ⚠️ Partial — no UCDP submission client |
| LOS integrations | Not found | ❌ Missing |
| Borrower-facing | Not found | 📋 Architecture plan only |

---

## Phase 0 — Quick Wins (Wire existing stubs, < 1 day each)

### 0.1 — Install and wire Stripe SDK  
**Status:** ✅ Completed

**What exists:** `src/services/payment-providers/stripe.provider.ts` — `StripePaymentProvider` class is fully written but imports `stripe` which is not in `package.json`.  `payment.types.ts` has `stripePaymentIntentId`, `stripeChargeId`, `stripePaymentMethodId`, `stripeAccountId`, `stripeCustomerId` fields.

**What's needed:**
- [ ] `pnpm add stripe` in `appraisal-management-backend`
- [ ] Wire `StripePaymentProvider` into the payment service factory (check for `PaymentProviderFactory` or equivalent)
- [ ] Add `STRIPE_SECRET_KEY` to env var documentation and Azure Key Vault reference
- [x] Add integration test: create payment intent → confirm → webhook event

**Files to change:** `package.json`, `src/services/payment-providers/` (factory), env docs.

---

### 0.2 — Appraiser Exclusionary List — admin API + UI  
**Status:** 🟡 In Progress

**What exists:** `vendor-matching-rules.service.ts` already enforces `blacklist` rules at assignment time.  `vendor-assignment.service.ts` has a client exclusion check.  No management API for creating/reading/deleting exclusion entries exists.

**What's needed:**
- [ ] New `ExclusionListEntry` type in `src/types/exclusion.types.ts`:
  ```ts
  interface ExclusionListEntry {
    id: string;
    tenantId: string;
    appraiserId: string;   // vendor user ID
    appraiserName: string;
    reason: ExclusionReason;   // 'performance' | 'conflict_of_interest' | 'regulatory' | 'client_request'
    addedBy: string;
    addedAt: string;
    expiresAt?: string | null;   // null = permanent
    notes?: string;
  }
  ```
- [ ] New `ExclusionListController` at `src/controllers/exclusion-list.controller.ts`
  - `GET  /api/exclusion-list` — list all for tenant
  - `POST /api/exclusion-list` — add entry
  - `DELETE /api/exclusion-list/:id` — remove entry
- [ ] Wire entry to `VendorMatchingRulesService` so it generates a `blacklist` rule at query time
- [ ] Frontend: table + add/remove modal in AMC admin → Vendor Management section
- [ ] Cosmos container: use `vendor-management` container (partition `/tenantId`) — **DO NOT create new container without infra PR**

**Files to change:** `src/types/exclusion.types.ts` (new), `src/controllers/exclusion-list.controller.ts` (new), `src/services/vendor-matching-rules.service.ts`, `src/app.ts` (route registration), frontend `src/store/api/exclusionListApi.ts` (new), frontend exclusion list page.

---

## Phase 1 — Core Operations Enhancements (P0 — billing & compliance)

### 1.1 — Delivery Receipts + E-Consent Tracking  
**Status:** ✅ Completed

**What exists:** `post-delivery.service.ts` creates a `DELIVERY_CONFIRMATION` checklist task but does not record delivery event with timestamp, viewer identity, IP, or RESPA/ECOA consent state.

**What's needed:**

**Backend:**
- [x] `DeliveryReceipt` type:
  ```ts
  interface DeliveryReceipt {
    id: string;
    orderId: string;
    tenantId: string;
    deliveredAt: string;       // ISO timestamp
    deliveredTo: string;       // recipient userId or email
    deliveredBy: string;       // sending userId
    channel: 'portal' | 'email' | 'api' | 'fax';
    reportVersionId: string;
    openedAt?: string;
    downloadedAt?: string;
    ipAddress?: string;
    userAgent?: string;
  }
  ```
- [x] `EConsentRecord` type:
  ```ts
  interface EConsentRecord {
    id: string;
    tenantId: string;
    orderId: string;
    borrowerEmail: string;
    consentStatus: 'pending' | 'given' | 'denied' | 'withdrawn';
    consentGivenAt?: string;
    consentMethod: 'portal' | 'email_link' | 'esign';
    disclosureVersion: string;   // tracks which RESPA disclosure was shown
    ipAddress?: string;
  }
  ```
- [x] `DeliveryController` at `src/controllers/delivery.controller.ts`:
  - `POST /api/orders/:id/deliver` — record delivery event
  - `GET  /api/orders/:id/delivery-receipts` — list receipts
  - `POST /api/orders/:id/consent` — record e-consent
  - `GET  /api/orders/:id/consent` — get current consent state
- [x] Update `post-delivery.service.ts` to persist `DeliveryReceipt` on send

**Frontend:**
- [x] Delivery receipt timeline component in order detail
- [x] E-consent banner in borrower-accessible view (plan now, show when portal is built)

**Cosmos:** persist in `engagement-audit-events` container (existing) — partition `/orderId`.

---

### 1.2 — WebPubSub — Full 30+ Event Catalog  
**Status:** ✅ Completed

**What exists:** `web-pubsub.service.ts` is fully functional (`broadcastNotification`, `sendToGroup`, `sendToAll`, group management, access URL generation).  `events.ts` defines these event types: `order.created`, `order.status.changed`, `order.assigned`, `order.completed`, `order.delivered`, `order.overdue`, `vendor.bid.sent`, `vendor.bid.accepted`, `vendor.bid.timeout`, `vendor.bid.declined`, `vendor.assignment.exhausted`, `vendor.bid.round.started`, `vendor.bid.round.exhausted`, `vendor.performance.updated`, `vendor.availability.changed`, `vendor.staff.assigned`.

**Note from audit:** The typescript schema files (`src/types/events.ts`) actually DO contain the interfaces and enums for these events, meaning the main work is service emission and subscriber handling, not redefining the types.

**Currently missing event types:**

| Category | Missing Events |
|---|---|
| Payment | `payment.initiated`, `payment.completed`, `payment.failed`, `payment.disputed` |
| Submission | `submission.uploaded`, `submission.approved`, `submission.rejected`, `submission.revision.requested` |
| Escalation | `escalation.created`, `escalation.resolved`, `escalation.timeout` |
| ROV | `rov.created`, `rov.assigned`, `rov.decision.issued` |
| Delivery | `delivery.confirmed`, `delivery.opened`, `delivery.downloaded` |
| Consent | `consent.given`, `consent.denied`, `consent.withdrawn` |
| Negotiation | `negotiation.counter_offer.submitted`, `negotiation.accepted`, `negotiation.rejected` |
| QC | `qc.review.started`, `qc.review.completed`, `qc.review.failed` |
| Engagement | `engagement.letter.sent`, `engagement.signed`, `engagement.declined` |

**What's needed:**
- [x] Add missing event interfaces to `src/types/events.ts`
- [ ] Add missing `EventCategory` enum values: `PAYMENT`, `SUBMISSION`, `ESCALATION`, `ROV`, `DELIVERY`, `CONSENT`, `NEGOTIATION`
- [x] Update `subscriber.subscribe()` calls in `communication-event-handler.service.ts` to handle each new event type
- [x] Add `broadcastNotification()` calls at each relevant service action point (payment service, ROV service, delivery service, etc.)
- [x] Update Service Bus topic subscriptions if needed

---

### 1.3 — ROV Workflow Enhancements  
**Status:** 🟡 In Progress

**What exists:** `rov.controller.ts` has `POST /api/rov/requests`, `GET /api/rov/requests`, `GET /api/rov/requests/:id`, `POST /api/rov/requests/:id/assign`, `PUT /api/rov/requests/:id/research`, `POST /api/rov/requests/:id/response`.  `rov.types.ts` has `CreateROVRequestInput`, `UpdateROVResearchInput`, `SubmitROVResponseInput`, `ROVChallengeReason`, `ROVDecision`.

**Enhancement gaps:**
- [x] `POST /api/rov/requests/:id/withdraw` — borrower/lender can retract before decision
- [x] `POST /api/rov/requests/:id/escalate` — escalate to supervisory appraiser or AMC management
- [x] `GET /api/rov/requests/:id/timeline` — full event audit trail for the ROV
- [x] `PATCH /api/rov/requests/:id/deadline` — extend or override SLA deadline
- [x] Deadline tracking: add `slaDeadline` field + cron/timer trigger when deadline breaches
- [x] Fire `rov.created`, `rov.assigned`, `rov.decision.issued` WebPubSub events from service
- [ ] Frontend: ROV dashboard with status columns (Pending / In Research / Decision Issued)
- [ ] Frontend: "Challenge Value" button in appraisal report delivery view — launches ROV intake modal

---

## Phase 2 — MLS / Data Infrastructure (P1 — core product quality)

### 2.1 — MLS Bridge — Vendor-Agnostic Data Layer  
**Status:** 🟡 In Progress

**What exists:**
- `MlsExtension` interface in `canonical-schema.ts` (comprehensive — `mlsNumber`, `listDate`, `soldDate`, `daysOnMarket`, `listingStatus`, `listingAgent`, `sellingAgent`, `photos`, `hoaFee`, `schoolDistrict`, `interiorFeatures`, `exteriorFeatures`, `heating`, `cooling`)
- `CanonicalComp.mlsData: MlsExtension | null` — every comp can carry MLS data
- `rov-research.service.ts` calls `mlsProvider.searchSoldListings()` — provider interface exists
- `comps.controller.ts` calls `ValuationEngine.findComparableProperties()` — **currently mocked**
- `dvr-desk-review.mapper.ts` reads `mlsData` fields when generating reports

**What's needed:**
- [ ] Define `MlsProvider` interface in `src/types/mls-provider.types.ts`:
  ```ts
  interface MlsProvider {
    searchSoldListings(criteria: MlsSearchCriteria): Promise<MlsListing[]>;
    getPropertyDetail(mlsNumber: string): Promise<MlsListing | null>;
    getActiveListings(criteria: MlsSearchCriteria): Promise<MlsListing[]>;
    getListingPhotos(mlsNumber: string): Promise<string[]>;
  }
  interface MlsSearchCriteria {
    lat: number; lng: number; radiusMiles: number;
    soldWithinDays?: number;
    minSqft?: number; maxSqft?: number;
    minBeds?: number; maxBeds?: number;
    propertyType?: string;
    limit?: number;
  }
  ```
- [ ] `BridgeInteractiveMlsProvider` implementing `MlsProvider` in `src/services/mls-providers/bridge.provider.ts`
  - Reads `BRIDGE_API_TOKEN` and `BRIDGE_API_BASE_URL` from config (no hardcoded values)
  - Maps Bridge Interactive response → `MlsListing` → `MlsExtension`
- [ ] `MockMlsProvider` in `src/services/mls-providers/mock.provider.ts` — for tests and local dev
- [ ] `MlsProviderFactory` — reads `MLS_PROVIDER=bridge|mock` env var; throws if unrecognized value
- [ ] Replace `ValuationEngine.findComparableProperties()` mock body with call to `MlsProvider`
- [ ] Add comp caching layer (Redis or Cosmos TTL) to avoid redundant MLS calls
- [ ] Routes: add `GET /api/mls/listings/:mlsNumber` — single listing by MLS number
- [ ] Routes: add `GET /api/mls/active?lat=&lng=&radius=` — active listings search

---

### 2.2 — Off-Market Data Module  
**Status:** 🟡 In Progress

**What's needed:**
- [ ] `OffMarketProperty` type in `src/types/off-market.types.ts`:
  ```ts
  interface OffMarketProperty {
    id: string;
    tenantId: string;
    address: string; city: string; state: string; zip: string;
    lat: number; lng: number;
    ownerName?: string;
    ownerMailingAddress?: string;
    estimatedValue?: number;
    lastSaleDate?: string; lastSalePrice?: number;
    equityEstimate?: number;
    distressIndicators: DistressIndicator[];  // 'pre_foreclosure' | 'tax_lien' | 'probate' | 'divorce' | 'vacancy'
    dataSource: 'attom' | 'propstream' | 'datatree' | 'manual';
    importedAt: string;
  }
  ```
- [ ] `OffMarketController` at `src/controllers/off-market.controller.ts`:
  - `POST /api/off-market/search` — search by geography + distress filters
  - `POST /api/off-market/import` — bulk import from CSV or provider webhook
  - `GET  /api/off-market/:id` — property detail
  - `POST /api/off-market/:id/tag` — add investor tag / note
- [ ] Cosmos container: `off-market-properties` (partition `/zip`) — **add to infra Bicep**
- [ ] Provider abstraction: `OffMarketProvider` interface → `AttomProvider`, `MockProvider`
- [ ] Frontend: Off-Market search page with map overlay and distress filter chips

---

## Phase 3 — Investment Intelligence Features (P1 — Privy-parity)

### 3.1 — Investor Activity Tracking  
**Status:** 🟡 In Progress

Track who is buying what, where, how often — institutional vs individual, flip vs hold, price bands.

**Types:**
```ts
interface InvestorProfile {
  id: string; tenantId: string;
  entityName: string;   // LLC, person, corp
  entityType: 'individual' | 'llc' | 'corporation' | 'reit' | 'fund';
  primaryMarkets: string[];   // zip codes or MSAs
  acquisitionCount: number;
  avgPurchasePrice: number;
  avgHoldDays: number;
  strategy: InvestmentStrategy[];
}
type InvestmentStrategy = 'fix_and_flip' | 'buy_and_hold' | 'wholesale' | 'development' | 'brrrr';
```

**Routes:**
- `POST /api/investors/search` — filter by market, strategy, price band, activity recency
- `GET  /api/investors/:id` — investor profile + transaction history
- `GET  /api/investors/market/:zipCode` — top investors active in a zip

**Implementation notes:**
- [ ] Ingest from MLS sold data (buyer name / entity extraction) + public records
- [ ] `investor-profiles` Cosmos container (partition `/primaryMarket`) — **add to infra Bicep**
- [ ] Background job: nightly investor activity roll-up from new sold listings

---

### 3.2 — Auto Deal Finder  
**Status:** 🟡 In Progress

Match investor buy-box criteria against live + off-market inventory.

**Types:**
```ts
interface BuyBox {
  id: string; tenantId: string; investorId: string;
  name: string;
  markets: string[];   // zip codes or MSAs
  propertyTypes: string[];
  minBeds?: number; maxBeds?: number;
  minSqft?: number; maxSqft?: number;
  maxPurchasePrice: number;
  targetArv?: number;   // after-repair value target
  maxRehabBudget?: number;
  strategies: InvestmentStrategy[];
  minCocReturn?: number;   // cash-on-cash %
}
```

**Routes:**
- `POST /api/deal-finder/run` — run deal finder against a buy-box, returns scored matches
- `GET  /api/deal-finder/results/:runId` — paginated results
- `POST /api/deal-finder/buy-boxes` — create/update buy-box
- `GET  /api/deal-finder/buy-boxes` — list buy-boxes for investor

**Implementation notes:**
- [ ] Scoring algorithm: weights for price-to-ARV ratio, days on market, estimated rehab, CoC return
- [ ] Integrates with `MlsProvider` (active listings) + off-market module
- [ ] `deal-finder-results` container or TTL documents in `off-market-properties` — **add to infra Bicep**

---

### 3.3 — Strategy-Based Comparative Search  
**Status:** 🟡 In Progress

Allow users to filter comp search by investment strategy context — comparable flips, comparable rentals, comparable new construction sales.

**Enhancement to existing comp search:**
- [ ] Add `strategyContext: 'flip' | 'rental' | 'new_construction' | 'land' | 'standard'` to `CompSearchCriteria`
- [ ] When `strategyContext = 'flip'`: boost comps with short hold times (<180 days), add `holdDays` to comp card
- [ ] When `strategyContext = 'rental'`: include `grossYield` and `capRateEstimate` calculated fields
- [ ] Add `POST /api/comps/strategy-search` endpoint (wraps existing search with strategy filter layer)
- [ ] Frontend: strategy toggle on comp search panel

---

### 3.4 — Before/After Photos + Rehab Cost Data  
**Status:** 🟡 In Progress

Capture pre-rehab and post-rehab property photos tied to a transaction/comp; track rehab scope + spend.

**Types:**
```ts
interface RehabRecord {
  id: string; tenantId: string;
  propertyId: string;   // links to comp or off-market property
  acquisitionPrice: number;
  acquisitionDate: string;
  rehabBudget: number;
  rehabActual?: number;
  rehabStartDate?: string;
  rehabCompletedDate?: string;
  salePrice?: number;
  saleDate?: string;
  beforePhotos: PhotoRecord[];
  afterPhotos: PhotoRecord[];
  rehabLineItems: RehabLineItem[];
}
interface RehabLineItem {
  category: 'kitchen' | 'bathrooms' | 'roof' | 'mechanical' | 'cosmetic' | 'additions' | 'other';
  description: string;
  budgeted: number;
  actual?: number;
}
```

**Routes:**
- `POST /api/rehab/:propertyId/photos` — upload before/after photos (multipart, to Azure Blob)
- `GET  /api/rehab/:propertyId` — get rehab record with signed photo URLs
- `PUT  /api/rehab/:propertyId` — update rehab line items + costs

**Implementation notes:**
- [ ] Photos stored in Azure Blob Storage (`rehab-photos` container) — **add to infra Bicep**
- [ ] `rehab-records` Cosmos container (partition `/tenantId`) — **add to infra Bicep**
- [ ] Rehab data can be attached to a comp to give ARV context in appraisal

---

### 3.5 — Investment Proforma (ROI, Cap Rate, Cash-on-Cash)  
**Status:** 🟡 In Progress

Calculate and store investment performance projections and actuals.

**Types:**
```ts
interface InvestmentProforma {
  id: string; tenantId: string; propertyId: string;
  scenarioName: string;
  strategy: InvestmentStrategy;
  // Purchase
  purchasePrice: number; closingCosts: number; rehabBudget: number;
  // Financing
  loanAmount?: number; interestRate?: number; loanTermMonths?: number; downPayment?: number;
  // Rental income (hold strategy)
  monthlyRent?: number; vacancyRate?: number; managementFeeRate?: number;
  annualExpenses?: number;
  // Flip projection
  arvEstimate?: number; holdMonths?: number;
  // Calculated outputs (derived, not stored)
  totalInvestment: number;
  netProfit: number;
  roi: number;         // %
  cocReturn?: number;  // %
  capRate?: number;    // %
  cashFlow?: number;   // monthly
}
```

**Routes:**
- `POST /api/proforma/calculate` — stateless calculation (no DB write)
- `POST /api/proforma` — save proforma to deal
- `GET  /api/proforma/:dealId` — list saved proformas
- `PUT  /api/proforma/:id` — update assumptions

**Implementation notes:**
- [ ] Pure calculation functions should be unit-testable with no side effects
- [ ] Frontend: proforma builder with live recalculation as inputs change (no submit needed for calc)
- [ ] Proformas stored in `deal-finder-results` or `investor-profiles` container

---

## Phase 4 — Market Intelligence & Alerts (P2)

### 4.1 — Market Map Visualization  
**Status:** 🟡 In Progress

Heatmaps + market trend overlays on a geographic map.

**What's needed:**

**Backend data APIs:**
- [ ] `GET /api/market/heatmap?zipCodes[]=&metric=median_price|price_psf|days_on_market|investor_activity` — returns zip-level aggregated stats
- [ ] `GET /api/market/trends/:zipCode?metric=&months=12` — time series for a single market
- [ ] `GET /api/market/comparable-activity?lat=&lng=&radiusMiles=` — recent sales as GeoJSON FeatureCollection

**Background aggregation:**
- [ ] Nightly job: aggregate MLS sold data by zip code → `market-stats` Cosmos container (partition `/zipCode`) — **add to infra Bicep**
- [ ] Aggregated fields per zip: `medianPrice`, `medianPricePerSqft`, `medianDaysOnMarket`, `salesVolume`, `listToSaleRatio`, `investorSalesShare`

**Frontend:**
- [ ] Map component (MapLibre GL or Azure Maps) with choropleth layer toggle
- [ ] Metric selector: price, PSF, DOM, investor activity, price change %
- [ ] Click-to-drill: zip → list of recent sales

---

### 4.2 — Alert System (Buy-Box Matching)  
**Status:** 🟡 In Progress

Notify users when new listings or sold data match their saved criteria.

**Types:**
```ts
interface Alert {
  id: string; tenantId: string; userId: string;
  name: string;
  triggerType: 'new_listing' | 'price_reduction' | 'new_sold' | 'investor_activity' | 'market_trend';
  criteria: AlertCriteria;   // reuses BuyBox shape + trend thresholds
  channels: AlertChannel[];  // 'email' | 'sms' | 'push' | 'webhook'
  webhookUrl?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}
```

**Routes:**
- `POST /api/alerts` — create alert
- `GET  /api/alerts` — list user's alerts
- `PUT  /api/alerts/:id` — update
- `DELETE /api/alerts/:id` — delete
- `POST /api/alerts/:id/test` — trigger a test notification

**Implementation notes:**
- [ ] Alert evaluation job runs after each MLS data ingest batch
- [ ] Delivery via WebPubSub (`alert.triggered` event type) + email (existing comms system)
- [ ] `alerts` Cosmos container (partition `/userId`) — **add to infra Bicep**

---

## Phase 5 — Architecture Plans (No Code Yet)

### 5.1 — Multi-Provider Payment Layer  
**Status:** 📋 Plan only

**Current state:** `StripePaymentProvider` is written.  The interface pattern is established.  After Stripe is wired (Phase 0.1), the following providers should be implemented as separate classes behind the same `PaymentProvider` interface:

| Provider | Use Case |
|---|---|
| **Stripe** | Card transactions, borrower payments |
| **Plaid** | ACH / bank account verification |
| **Yodlee** | Bank account data enrichment for underwriting |
| **Column Bank** | Embedded banking / instant pay for appraiser payouts |

**Provider selection:** `PaymentProviderFactory` reads `PAYMENT_PROVIDER` env var per payment type. A single order can use different providers for different legs (e.g., Plaid for borrower ACH, Column Bank for appraiser payout).

**No implementation until Stripe wire-up (Phase 0.1) is complete and in production.**

---

### 5.2 — LOS Integrations (Encompass, Black Knight, ICE Mortgage)  
**Status:** 📋 Feasibility pending

**Encompass (ICE Mortgage Technology):**
- Encompass SDK / Encompass360 REST API — well-documented; field-level mapping is complex (3000+ loan fields)
- MISMO 3.4 standard is our common language (we already generate MISMO XML)
- Feasibility: **Yes — ~80%**. Core push/pull: loan open, order create, status push, delivery
- Risk: Encompass partner certification requires ICE approval process

**Black Knight (now ICE):**
- Empower LOS — REST API available; less open than Encompass
- Feasibility: **Moderate — ~60%** without a sandbox agreement

**Architecture plan:**
```
LosProvider interface
  ├── EncompassLosProvider
  ├── BlackKnightLosProvider  
  └── MockLosProvider

Endpoints to add:
  POST /api/los/orders/import      — pull loan from LOS → create order
  POST /api/los/orders/:id/push    — push status update to LOS
  GET  /api/los/loans/:loanNumber  — query loan from LOS
```

**No implementation until an Encompass sandbox is available.**

---

### 5.3 — Borrower-Facing Portal (Architecture Plan)  
**Status:** 📋 Architecture plan only — do not build yet

**Planned capabilities:**
- View appraisal order status
- Receive and sign e-consent
- View and download delivered appraisal
- Submit ROV request
- Make payment (borrower-paid appraisal)

**Architecture approach:**
- Separate SPA route prefix `/portal` with its own auth context (Azure AD B2C or Entra External ID)
- Token scope: `portal.read`, `portal.submit` — narrower than AMC/lender scopes
- Backend: new `PortalController` with endpoints gated to `portal.*` scopes only
- Borrower has no access to: vendor details, internal notes, fee negotiations, QC workflow

**No implementation until delivery receipts + e-consent (Phase 1.1) is complete.**

---

### 5.4 — GSE Direct Submission (UCDP / EAD)  
**Status:** 📋 Plan + partial feasibility

**What we have:**
- `mismo-xml-generator.service.ts` — generates MISMO 2.6 XML
- `canonical-to-uad.mapper.ts` — maps our canonical schema to UAD fields
- UAD 3.6 types built

**UCDP (Fannie Mae):**
- Fannie Mae UCDP Web Services API — SOAP-based (`SubmitAppraisalReport`, `GetSSR`)
- Our MISMO XML output would need adjustment to UCDP XML envelope format
- Feasibility: **Yes — ~75%**. Core submit + get Submission Summary Report (SSR)

**EAD (FHA/HUD):**
- Electronic Appraisal Delivery portal — REST API available (FHA Connection)
- Feasibility: **Yes — ~70%**. Requires FHA sponsor approval for direct submission

**Planned routes:**
```
POST /api/gse/ucdp/submit/:orderId   — submit to Fannie UCDP
GET  /api/gse/ucdp/status/:docId     — poll SSR status
POST /api/gse/ead/submit/:orderId    — submit to FHA EAD
GET  /api/gse/ead/status/:caseNumber — poll EAD status
```

**No implementation until a UAT/sandbox agreement with Fannie or FHA is in place.**

---

## Cosmos Infrastructure Additions Required

All new containers must be added via Bicep PR — **never created in application code**.

| Container Name | Partition Key | Phase |
|---|---|---|
| `off-market-properties` | `/zip` | Phase 2.2 |
| `investor-profiles` | `/primaryMarket` | Phase 3.1 |
| `deal-finder-results` | `/tenantId` | Phase 3.2 |
| `rehab-records` | `/tenantId` | Phase 3.4 |
| `market-stats` | `/zipCode` | Phase 4.1 |
| `alerts` | `/userId` | Phase 4.2 |

Azure Blob Storage containers:
- `rehab-photos` — Phase 3.4

---

## Implementation Priority Order

| # | Item | Phase | Priority | Est. Scope |
|---|---|---|---|---|
| 0.1 | Stripe SDK wire-up | 0 | 🔴 P0 | 2h |
| 0.2 | Exclusionary List API + UI | 0 | 🔴 P0 | 1 day |
| 1.1 | Delivery Receipts + E-Consent | 1 | 🔴 P0 | 1 day |
| 1.2 | WebPubSub — full event catalog | 1 | 🔴 P0 | 1 day |
| 1.3 | ROV enhancements | 1 | 🟠 P1 | 2 days |
| 2.1 | MLS Bridge vendor-agnostic layer | 2 | 🟠 P1 | 2 days |
| 2.2 | Off-Market Data module | 2 | 🟠 P1 | 3 days |
| 3.1 | Investor Activity Tracking | 3 | 🟡 P2 | 3 days |
| 3.2 | Auto Deal Finder | 3 | 🟡 P2 | 3 days |
| 3.3 | Strategy-Based Comp Search | 3 | 🟡 P2 | 1 day |
| 3.4 | Before/After Photos + Rehab Cost | 3 | 🟡 P2 | 2 days |
| 3.5 | Investment Proforma | 3 | 🟡 P2 | 2 days |
| 4.1 | Market Map Visualization | 4 | 🟢 P3 | 3 days |
| 4.2 | Alert System (buy-box matching) | 4 | 🟢 P3 | 2 days |
| 5.1 | Multi-provider payments (plan) | 5 | 📋 Plan | After 0.1 |
| 5.2 | LOS Integrations (plan) | 5 | 📋 Plan | Needs sandbox |
| 5.3 | Borrower Portal (plan) | 5 | 📋 Plan | After 1.1 |
| 5.4 | GSE UCDP/EAD (plan) | 5 | 📋 Plan | Needs sandbox |

---

## Progress Tracker

### Phase 0 — Quick Wins
- [ ] 0.1 Stripe SDK wire-up
- [ ] 0.2 Exclusionary List API
- [ ] 0.2 Exclusionary List Frontend

### Phase 1 — Core Operations
- [x] 1.1 `DeliveryReceipt` type + controller
- [x] 1.1 `EConsentRecord` type + controller
- [x] 1.1 `post-delivery.service.ts` update
- [x] 1.2 Missing event types in `events.ts`
- [x] 1.2 WebPubSub event subscriptions
- [x] 1.2 Broadcast calls at service action points
- [x] 1.3 ROV withdraw endpoint
- [x] 1.3 ROV escalate endpoint
- [x] 1.3 ROV timeline endpoint
- [x] 1.3 ROV deadline tracking
- [x] 1.3 ROV WebPubSub events
- [ ] 1.3 ROV frontend dashboard
- [ ] 1.3 ROV "Challenge Value" intake modal

### Phase 2 — MLS / Data Infrastructure
- [ ] 2.1 `MlsProvider` interface + `MlsSearchCriteria`
- [ ] 2.1 `BridgeInteractiveMlsProvider`
- [ ] 2.1 `MockMlsProvider`
- [ ] 2.1 `MlsProviderFactory`
- [ ] 2.1 Replace mocked comps in `ValuationEngine`
- [ ] 2.1 Comp caching
- [ ] 2.1 Single listing + active listings routes
- [ ] 2.2 `OffMarketProperty` type
- [ ] 2.2 `OffMarketController`
- [ ] 2.2 `OffMarketProvider` interface + providers
- [ ] 2.2 Cosmos container (infra PR)
- [ ] 2.2 Frontend search page

### Phase 3 — Investment Intelligence
- [ ] 3.1 `InvestorProfile` type + controller + container
- [ ] 3.1 MLS ingest → investor activity extraction
- [ ] 3.2 `BuyBox` type + Deal Finder engine + controller
- [ ] 3.3 Strategy-based comp search filter layer
- [ ] 3.4 `RehabRecord` type + photo upload + controller
- [ ] 3.4 Blob storage container (infra PR)
- [ ] 3.5 Proforma calculation engine (pure functions)
- [ ] 3.5 Proforma API + frontend builder

### Phase 4 — Market Intelligence
- [ ] 4.1 Market aggregation job + `market-stats` container
- [ ] 4.1 Market API endpoints
- [ ] 4.1 Frontend map component
- [ ] 4.2 `Alert` type + controller + evaluation job
- [ ] 4.2 Alert delivery via WebPubSub + email

### Phase 5 — Plans (No Code Yet)
- [ ] 5.1 Document Stripe in production → add Plaid provider
- [ ] 5.2 Obtain Encompass sandbox → build `EncompassLosProvider`
- [ ] 5.3 Borrower portal architecture review with stakeholders
- [ ] 5.4 Obtain UCDP sandbox → build UCDP submission client
