# Auto-Assignment System — End-to-End Review

**Created:** 2026-05-08
**Last updated:** 2026-05-08
**Scope:** Vendor auto-assignment across `appraisal-management-backend` (logic + storage) and `l1-valuation-platform-ui` (admin/operator surfaces).
**Reviewer:** Claude (Opus 4.7)
**Revisions:**
- 2026-05-08 (initial) — End-to-end review.
- 2026-05-08 (rev 1) — F2/recommendations corrected after re-reading `VendorMatchingRulesService` properly. Original draft mistakenly recommended retiring the rules engine in favor of `MatchingCriteriaSet`; the corrected position is the opposite (see §7 F2).
- 2026-05-08 (rev 2) — Added Progress Snapshot (§0) for live tracking; status columns added to findings table and recommendations.

---

## 0. Progress Snapshot

This section is the **live tracker** — update statuses, add commit/PR refs, and date each transition as work progresses.

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Paused · 🚫 Won't do

| Phase | Goal | Status | Started | Completed | Notes / PRs |
|---|---|---|---|---|---|
| Phase 1 | Make the rules engine real (F1 + F7 + F9) | ✅ | 2026-05-08 | 2026-05-08 | All tasks ✅. BE master: 25f3a2d, d691bbc, c86b2a3, c749676, 1568fa6, 10477ac, 4e45871 (+ doc commits). FE main: T7 (MatchExplanation + DeniedVendor components). 151 tests added (43 rules + 77 engine + 17 orchestrator → 20 + 14 FE). |
| Phase 2 | Make rules engine the backbone (F2 + F8) | ⬜ | — | — | Blocked on Phase 1 |
| Phase 3 | Express scoring + vendor data as rules (F3 + F4 + F5 + F6 + F11) | ⬜ | — | — | Blocked on Phase 2 |
| Phase 4 | Close the loop + cleanup (F10 + F12 + versioning) | ⬜ | — | — | Blocked on Phase 3 |

**Per-finding status** — see Status column in §1 table.

**Phase 1 task progress** — see §10.5; T1–T5 complete, T6–T8 remain.

**Open questions** — see §9. PF1 ⚠ (perf calc on-read, follow-up Phase 1.5 task); PF2 ⏳ (needs ops Cosmos query); PF3 ✅ confirmed.

---

## 1. Executive Summary

The auto-assignment system is **functional but architecturally fragmented**. Three independent matching subsystems coexist with overlapping concerns, the most capable of the three is not wired into the real assignment path, and the core attributes that drive matching are scattered across multiple competing fields on the vendor model. Tuning the system today requires code changes in several places.

**There is, however, a clean path forward:** the existing `VendorMatchingRulesService` is a real rules engine (priority ordering, deny/allow/boost/reduce action semantics, override logic, audit-friendly deny reasons). Wired into the engine and extended with a `field_predicate` rule type, it becomes the natural backbone that subsumes most of the other findings — scoring weights, product eligibility, geographic coverage, and the capability catalog all collapse into rule-driven data.

**Top-line risks (detail in §7):**

| # | Finding | Severity | Status | Phase |
|---|---|---|---|---|
| F1 | `VendorMatchingRulesService` exists, has CRUD + evaluate endpoints, and a documented contract that says it filters ineligible vendors before scoring — **but it is never called by `VendorMatchingEngine`**. The rules engine is dead code in the production path. | **P0** | ✅ (T4+T5+T1) | 1 |
| F2 | `MatchingCriteriaSet` (RFB criteria) and `VendorMatchingRules` (engine rules) are two separate rule systems with two separate stores, two separate UIs, and two separate semantic models. The rules engine is structurally richer (priority, actions, overrides, deny reasons); criteria sets are a flat predicate list. Recommend consolidating onto the rules engine by adding a `field_predicate` rule type. | **P1** | ⬜ | 2 |
| F3 | Scoring weights (30/25/20/15/10) and all band thresholds (distance, capacity, fee ratio, experience tiers) are `private readonly` in code with no tenant override. Tuning requires a deploy. **Subsumed by F2 consolidation: weights become `boost`/`reduce` rules; bands become rule thresholds.** | **P1** | ⬜ | 3 |
| F4 | Vendor "what products can this vendor do" is represented in **three** non-canonical fields: `productTypes` (legacy), `eligibleProductIds` (new hard-gate), `productGrades` (per-product grade). They can drift. **Subsumed by F2 consolidation: product eligibility becomes a `required_capability` rule (e.g. `product_xyz_certified`); grade becomes a `boost` rule.** | **P1** | ⬜ | 3 |
| F5 | Geographic coverage lives in **three** places: `vendor.serviceAreas`, `vendor.geographicCoverage` (3-zone), `vendor-availability.serviceAreas`. The engine reads one, rules read another, availability reads a third. **Subsumed by F2 consolidation: coverage becomes `state_restriction` + `max_distance_miles` rules.** | **P1** | ⬜ | 3 |
| F6 | `VendorCapability` is a hardcoded string union of 16 values (`fha_approved`, `uad36_compliant`, etc.). Adding a capability requires a code change in the FE *and* BE. **Subsumed by F2 consolidation: capabilities become catalog data the rules reference.** | **P2** | ⬜ | 3 |
| F7 | The matching engine has zero direct unit tests. Orchestrator tests mock the engine entirely. | **P1** | ✅ (T1+T2+T8) | 1 |
| F8 | No FE admin UI exists for `vendor-matching-rules` (BE controller + endpoints exist; FE has none). Operators cannot manage rules through the product. **Resolved naturally by F2: existing `/matching-criteria` page gets repurposed/extended into the unified rules admin.** | **P1** | ⬜ | 2 |
| F9 | Audit trail for "why this vendor was picked over the others" is incomplete — score components, rule denials, and tiebreaks are not persisted per assignment decision. **Mostly free from F1: `RuleEvaluationResult` already returns `appliedRuleIds` + `denyReasons`; just persist them.** | **P1** | ✅ (T6+T7) | 1 |
| F10 | Decline/timeout outcomes do not feed back into vendor performance metrics; no closed loop. | **P2** | ⬜ | 4 |
| F11 | Internal-staff direct-assignment branch bypasses the bid loop but still relies on the same scoring model that was designed around external bid behavior (cost score, blackout dates). | **P2** | ⬜ | 3 |
| F12 | Four assignment endpoints (`/suggest`, `/find-matches`, `/assign`, `/broadcast`) plus `/orders/:id/auto-assignment/trigger` and `/orders/:id/rfb` overlap in capability with no documented decision tree for when to use which. | **P2** | ⬜ | 4 |

**Bottom line:** the matching engine code is reasonable, but the configuration model is fragmented across seven surfaces (three of them being source code). The highest-leverage fix is to **wire the existing rules engine into the matching engine** (F1). Once that is done, the rules engine becomes the consolidation target that absorbs F3/F4/F5/F6/F8/F9 — turning what looks like ten separate problems into one coherent re-platforming.

---

## 2. System Map

### 2.1 The three matching subsystems

| # | Subsystem | Where | What it does | Who calls it |
|---|---|---|---|---|
| A | **`VendorMatchingEngine`** | `src/services/vendor-matching-engine.service.ts` | 5-factor weighted scoring (30/25/20/15/10). Hard-gates on state, `eligibleProductIds`, `requiredCapabilities`. Returns ranked vendors. | `AutoAssignmentOrchestratorService`, `auto-assignment.controller.ts` |
| B | **`VendorMatchingRulesService`** | `src/services/vendor-matching-rules.service.ts` | Rule-engine: `deny` / `allow` / `boost` / `reduce` rules with priority. Rule types: `license_required`, `state_restriction`, `min_performance_score`, `blacklist`, `whitelist`, `required_capability`, `max_order_value`, `max_distance_miles`, `property_type_restriction`, `score_boost`, `score_reduce`. | `vendor-matching-rules.controller.ts` (admin/test only), `exclusion-list.controller.ts`. **NOT called by Engine A.** |
| C | **`MatchingCriteriaSet` / RFB** | `src/services/rfb.service.ts`, `src/types/matching.types.ts` | Field/operator/value criteria (`eq`, `gt`, `in`, `within_radius_miles`, etc.) attached to Products and evaluated during RFB broadcast preview. | `rfb.controller.ts`, FE `/orders/:id/rfb` page |

A and C are reachable from real flows. B is reachable from its own admin endpoint and from the exclusion-list controller, but **is not on the path from "order created" → "vendor assigned"**.

Architecturally, B is the most capable of the three (priority, four action types, override semantics, captured deny reasons, bulk apply). C is a flat predicate list with no actions. The recommendation in §7 F2 is to make B the backbone and absorb C into it as a `field_predicate` rule type.

### 2.2 The orchestrator and FSM

`AutoAssignmentOrchestratorService` owns the end-to-end FSM, embedded in the order document as `autoVendorAssignment`:

```
NOT_STARTED → PENDING_BID → ACCEPTED
                          → DECLINED / TIMEOUT → (advance currentAttempt) → PENDING_BID
                                                                          → EXHAUSTED
```

Triggers: Service Bus events (`engagement.order.created`, `vendor.bid.timeout`, `vendor.bid.declined`, etc.), or the manual HTTP trigger.

For internal staff (top match has `staffType === 'internal'`), the orchestrator skips the bid loop and assigns directly.

If `BULK_INGESTION_AI_BID_SCORING=true`, Axiom is asked to re-rank the top vendors; its output is honored only above a confidence threshold (default `0.85`).

### 2.3 Storage (Cosmos DB)

| Container | Partition | Purpose |
|---|---|---|
| `orders` | `/tenantId` | Order doc + embedded `autoVendorAssignment` FSM |
| `vendors` | `/tenantId` | Vendor profiles (capabilities, eligible products, grades, coverage) |
| `vendor-availability` | `/vendorId` (likely) | Capacity, blackouts, current load |
| `vendor-performance-metrics` | `/tenantId` | Calculated scorecards (overall score, tier) |
| `vendor-bids` | `/tenantId` | Bid invitations + responses |
| `vendor-matching-rules` | `/tenantId` | Rules engine documents (orphaned in production path — see F1) |
| `products` | `/tenantId` | Product catalog (fees, SLA, links to criteria sets) |
| `matching-criteria-sets` | `/tenantId` | RFB criteria sets |
| `rfb-requests` | `/tenantId` | RFB lifecycle docs |

No Cosmos migrations exist; schema is implicit / read-time.

### 2.4 Maintenance surfaces

| Concern | BE controller | FE page |
|---|---|---|
| Vendors | `production-vendor.controller.ts` | `/vendors`, `/vendors/:id` |
| Vendor availability | `production-vendor.controller.ts` | `/vendors/:id` (Profile tab) |
| Products & fees | (product controller) | `/products-fees` |
| Matching criteria sets (RFB) | `matching-criteria.controller.ts` | `/matching-criteria` (not in nav) |
| **Vendor matching rules (engine B)** | `vendor-matching-rules.controller.ts` | **none** (F8) |
| Tenant automation toggles | `tenant-automation-config.controller.ts` | (no dedicated FE page surfaced in map) |
| Order-level assignment | `auto-assignment.controller.ts` | `/orders/:id` (`AutoAssignmentStatusPanel`), `/orders/:id/rfb`, `/vendor-engagement/assignment` |

---

## 3. Attribute Inventory — what feeds matching

### 3.1 Inputs from the order
`propertyAddress` · `propertyType` · `dueDate` · `urgency` (`STANDARD`/`RUSH`/`SUPER_RUSH`) · `budget` · `productId` · `requiredCapabilities[]` · `clientPreferences` (preferred/excluded vendor IDs, min tier, max distance, max fee).

`urgency` is captured but **not used in the core scorer** — it is a known attribute that does not drive ranking.

### 3.2 Vendor attributes consumed by the engine

**Hard gates (eligibility):**
- `status === ACTIVE`
- `licenseState` (state restriction)
- `eligibleProductIds` includes `request.productId` (if list non-empty)
- `capabilities` is a superset of `request.requiredCapabilities`
- `availability.blackoutDates` does not contain `request.dueDate` (drives availability score to 0 — effectively a soft gate)
- `budget.maxFee` not exceeded by vendor fee (drives cost score to 0 — effectively a soft gate)

**Soft signals (scored):**
- `performance.overallScore` → performance (30%)
- `availability.availableSlots` / `currentLoad` / `maxCapacity`, or fallback `vendor.activeOrderCount` / `vendor.maxConcurrentOrders` for internal staff → availability (25%)
- `location.{lat,lng}` + `geographicCoverage.preferred.states` → proximity (20%)
- `propertyTypeExpertise[propertyType]` + `productGrades[productId]` (`trainee`/`proficient`/`expert`/`lead`) → experience (15%)
- `averageFee` / `typicalFees[propertyType]` vs `request.budget` → cost (10%)

### 3.3 Vendor attributes that sound matching-relevant but aren't read by the engine
- `productTypes` (legacy enum list)
- `specialties`
- `serviceAreas` (legacy nested model — engine uses the newer `geographicCoverage` instead, but `vendor-availability.serviceAreas` is yet a third copy)
- `workSchedule` (day-of-week / time-of-day)
- `certifications[]` (matched only via rules engine B, which isn't wired in)
- `licenseExpiry` (no compliance check in the scoring path)

This is the F4/F5 problem made concrete: there are fields that *look like* they should affect matching but don't.

---

## 4. Algorithm Walkthrough

```
findMatchingVendors(request, topN=10):
  coords = geocode(request.propertyAddress)               # falls back to state centroid
  eligible = getEligibleVendors(request)                  # hard gates: state, productId, capabilities, ACTIVE
  scored = parallel-map(eligible, scoreVendor)
  return scored.sort(desc by matchScore).slice(0, topN)

scoreVendor(vendor, request, coords):
  perf  = vendor.performance.overallScore                                    # 0-100
  avail = blackoutHit(vendor, request.dueDate) ? 0 : capacityBand(vendor)    # 0-100
  prox  = haversine(vendor.location, coords) → distanceBand + preferredStateBonus
  exp   = 50 + specializationBonus + propertyTypeOrdersBonus + productGradeBonus
  cost  = budgetExceeded(vendor, request.budget) ? 0 : feeRatioBand(vendor, request.budget)
  return round(0.30*perf + 0.25*avail + 0.20*prox + 0.15*exp + 0.10*cost)
```

Then `autoAssignOrder` applies post-filters: `criteria.minMatchScore`, `criteria.maxDistance`, `criteria.requiredTier`. There is no tiebreaker rule — sort is by raw score; if two vendors tie, ordering is stable on the eligible set (which is itself a Cosmos query order — implicit and brittle).

**Implicit assumptions worth flagging:**
- A vendor with no `performance.overallScore` recorded gets 0 on the largest factor. Cold-start vendors are systematically penalized.
- The geocoding fallback to state centroid means rural vendors near a state border can be over- or under-credited for proximity by ~100 miles.
- "Cost" is computed against `vendor.averageFee` / `typicalFees[propertyType]` — both attributes that are operator-maintained and likely stale.

---

## 5. Storage & Lifecycle — how data is maintained

### 5.1 Vendors
Created/edited via `/vendors` and `/vendors/:id`. No version history; updates are destructive overwrites. There is no "effective date" concept — a coverage change applies retroactively to in-flight matching.

### 5.2 Performance metrics
`VendorPerformanceCalculatorService` exists, but the **trigger** for recalculation is not visible in either repo's map (no obvious cron, no obvious hook on `order.completed`). Either it runs on read inside `scoreVendor` (slow, no caching) or it runs out-of-band on a schedule we haven't surfaced. **Open question** — see §9.

### 5.3 Rules and criteria sets
- `vendor-matching-rules`: BE CRUD only; no FE.
- `matching-criteria-sets`: BE CRUD + FE at `/matching-criteria` (page exists but not in navigation).
- Both stores are mutable in place. No audit log of edits, no "who changed this rule and when".

### 5.4 Products
Created/edited at `/products-fees`. A product can reference `matchingCriteriaSets[]` (consumed by RFB only) but cannot reference `vendor-matching-rules` (engine B is global per tenant, not per product).

### 5.5 Tenant configuration
`TenantAutomationConfig` holds: `autoAssignmentEnabled`, `bidLoopEnabled`, `maxVendorAttempts`, `bidExpiryHours`, `reviewExpiryHours`, `bidMode` (`sequential`|`broadcast`), `broadcastCount`, `preferredVendorIds`, `escalationRecipients`, `supervisoryReviewForAllOrders`, `supervisoryReviewValueThreshold`.
**Notably absent:** scoring weights, band thresholds, tiebreaker rules, cold-start policy.

### 5.6 Configuration scattered across surfaces
A complete answer to "how do we want orders auto-assigned for tenant X" today requires touching:
1. Vendor records (capabilities, eligible products, grades, coverage)
2. Product records (criteria set references)
3. Matching criteria sets (RFB-only)
4. Vendor matching rules (effectively unused, see F1)
5. Tenant automation config (toggles, expiries, bid mode)
6. Engine source code (weights, bands, hard-gates)
7. Capability string union (`VendorCapability` enum)

Seven surfaces. Three of them are code.

---

## 6. Maintenance Surfaces — operator experience

| Surface | What an operator can do | Gap |
|---|---|---|
| `/vendors`, `/vendors/:id` | CRUD vendor profile, toggle availability, see analytics | No way to see "which open orders would this vendor currently match for and why" |
| `/products-fees` | CRUD products, attach criteria sets | No preview of which vendors a given product would match against |
| `/matching-criteria` | CRUD criteria sets (RFB) | Not in main nav (only direct URL) |
| `/orders/:id` `AutoAssignmentStatusPanel` | See FSM state, ranked vendors with scores, accept/decline, manual override | Score is shown as a single number; no breakdown of which factor pushed it up or down |
| `/orders/:id/rfb` | Preview matches, broadcast, see bids, award, accept AI recommendation | RFB matching uses criteria sets; bid-loop uses engine. Operators may not realize they are different rule systems |
| `/vendor-engagement/assignment` | Filter PENDING_ASSIGNMENT, manual or auto-assign, broadcast | Duplicates much of `AutoAssignmentStatusPanel` |
| **(missing)** Vendor matching rules admin | — | Cannot manage `vendor-matching-rules` from the FE at all (F8) |
| **(missing)** Tenant automation config | — | No FE page mapped to `TenantAutomationConfig` controller |
| **(missing)** "Score weights / bands" admin | — | Tunable knobs are in code only (F3) |

---

## 7. Findings (detail)

### F1 — `VendorMatchingRulesService` is dead code in the assignment path · **P0**
**Evidence:** `vendor-matching-engine.service.ts` does not import `VendorMatchingRulesService`. The only consumers are `vendor-matching-rules.controller.ts` (CRUD + `/evaluate` test endpoint) and `exclusion-list.controller.ts`. The service's own header comment states it is "called before scoring to filter ineligible vendors" — that contract is unmet.
**Impact:** Every rule an operator creates (blacklists, whitelists, license requirements, score boosts, distance caps, max order value, property-type restrictions) has **no effect** on real auto-assignment. Operators may believe the system is configurable when it is not.
**Fix:** Inject `VendorMatchingRulesService` into `VendorMatchingEngine`. In `getEligibleVendors`, call `evaluateRules(tenantId, ctx)` for each candidate; drop those returned as denied; apply the net `adjustmentPoints` to `matchScore` after the weighted sum. Persist applied rule IDs and denial reasons on the assignment record (feeds F9).

### F2 — Two parallel rule systems; consolidate onto the rules engine · **P1**
**Evidence:** Two systems with overlapping concerns:

- **`VendorMatchingRulesService`** (`vendor-matching-rules.service.ts`) — a real rules engine: priority ordering, four action semantics (`deny` / `allow` / `boost` / `reduce`), whitelist-overrides-deny logic, per-rule scope filters (`productTypes`, `states`), captured deny reasons, pure synchronous `applyRules()` for bulk evaluation. Currently 11 rule types via switch in `evalDenyRule`.
- **`MatchingCriteriaSet`** (`matching.types.ts`, `rfb.service.ts`) — a flat list of `field/operator/value` predicates joined by ONE combinator (AND or OR), producing match/no-match plus a count. No priority. No actions. No score adjustments. No overrides. No deny reasons. It is a query DSL, not a rules engine.

They overlap on: state restriction, capability requirement, performance threshold, distance cap.

**Impact:** Operator confusion; double-maintenance; ambiguity about which rule "wins" when both exist; two FE/BE surfaces to keep in sync.

**Fix — consolidate onto the rules engine.** The asymmetry of work makes the direction obvious:

| Direction | What it takes | Verdict |
|---|---|---|
| Port criteria-set capabilities into the rules engine | Add **one** new rule type — `field_predicate` with `{field, operator, value}` payload. Add geo operators (`within_radius_miles`, `within_polygon`, `within_bbox`) as either operator extensions on that rule type or dedicated rule types. Roughly 50 LOC plus tests. | **Extension.** |
| Port rules-engine capabilities into criteria sets | Add priority on every set/criterion. Add an action enum (deny/allow/boost/reduce). Add score-adjustment fields. Add override semantics across sets. Add deny-reason capture. Add per-criterion scope filters. Then redesign the FE to expose all of it. | **Redesign.** |

The rule-type "enum" is not a constraint — it is the engine's extensibility surface. Adding a rule type is a switch case in `evalDenyRule` (~6 LOC). The semantic richness (priority, actions, overrides, audit) is the part that would be expensive to recreate elsewhere.

**Migration path:**
1. Add `field_predicate` rule type to `RuleType` and a corresponding case in `evalDenyRule` / `evalAllowRule` (and `boost`/`reduce` if predicate-driven score adjustments are wanted).
2. Write a one-shot migration that converts each `MatchingCriteriaSet` + its `criteria[]` into N `VendorMatchingRule` documents (one per criterion, sharing a `name`/`description`/scope, priority assigned by combinator semantics).
3. Update RFB flow to call `evaluateRules` instead of the criteria-set evaluator.
4. Repurpose the existing `/matching-criteria` FE page (resolves F8) into a unified rules admin.
5. Delete the criteria-set service, controller, types, and Cosmos container.

### F3 — Scoring weights and thresholds are hardcoded · **P1**
**Evidence:** `vendor-matching-engine.service.ts:36-51` — `private readonly WEIGHTS` and `private readonly DISTANCE_THRESHOLDS`. Capacity bands (1/3/5), experience bands (5/20/50), fee bands (0.8/1.0/1.1/1.2), grade points (0/5/10/15) all inline in `scoreVendor`.
**Impact:** A tenant who values turnaround over price cannot say so. A tenant in a high-density urban market cannot tighten distance bands. Tuning requires a deploy.
**Fix (subsumed by F2 consolidation):** Once the rules engine is the backbone, scoring weights and bands become rules:
- "performance ≥ 90 → +30 points" is a `boost` rule keyed on a `min_performance_score` predicate.
- "distance ≤ 25 miles → +20 points" becomes a `boost` rule keyed on a `max_distance_miles` predicate (with banded variants at 75/150/300).
- Tenant tunes by editing rules (or adopting a tenant-default rule pack), not by deploying.
- The deterministic "factor × weight" arithmetic in `scoreVendor` survives only as the **default rule pack**; tenants override individual rules without touching the engine.

### F4 — Vendor-product eligibility represented in three competing fields · **P1**
**Evidence:** `Vendor.productTypes` (legacy enum), `Vendor.eligibleProductIds` (hard-gate), `Vendor.productGrades` (per-product grade for experience bonus). Engine reads `eligibleProductIds` for the gate and `productGrades` for the bonus; `productTypes` is ignored.
**Impact:** Operators editing one field assume the others follow. Drift produces silent matching errors.
**Fix (subsumed by F2 consolidation):** Eligibility and grade both express through rules:
- Eligibility → `required_capability` rule referencing a capability the vendor must have (e.g. `product_xyz_certified`). Vendor record carries the capability; rule checks it.
- Grade → `boost` rules per grade tier (`product_xyz_expert` → +10, `product_xyz_lead` → +15).
- Migration: walk every vendor, emit capability strings derived from `eligibleProductIds` ∪ `productGrades`. Delete `productTypes` and `eligibleProductIds` on the Vendor model. Grade lives on the vendor as part of the capability string OR as separate metadata that rules read — either is consistent.
- Net effect: one source of truth (vendor capabilities), one mechanism (rules), no drift.

### F5 — Geographic coverage represented in three places · **P1**
**Evidence:** `Vendor.serviceAreas` (legacy), `Vendor.geographicCoverage` (3-zone licensed/preferred/extended), `VendorAvailability.serviceAreas` (zips/counties/radius). Engine uses `geographicCoverage.preferred.states` for the proximity bonus and `licenseState` for the gate; the other two are inert in the matching path.
**Fix (subsumed by F2 consolidation):** Coverage expresses through rules:
- "Vendor not licensed in property state" → `state_restriction` deny rule per vendor (or per tenant referencing vendor's `licenseState`).
- "Beyond X miles" → `max_distance_miles` deny rule.
- "Preferred state bonus" → `boost` rule.
- One coverage source on the vendor (`geographicCoverage` is the most expressive — keep it). Rules read it; the duplicate `serviceAreas` fields go away. One coverage editor on the vendor detail page.

### F6 — `VendorCapability` is a hardcoded string union · **P2**
**Evidence:** 16 capability strings are baked into both BE types and FE forms.
**Impact:** Adding `as_is_inspection_certified` (or whatever is next) requires a coordinated FE+BE deploy.
**Fix (subsumed by F2 consolidation):** In a rules-engine world, capabilities are just strings the rules reference. Move the catalog into a `capability-catalog` Cosmos container with `{id, label, category, description}`. Both the rules admin UI and vendor edit form read from it. New capabilities are data, not deploys. Especially natural after F4 lands, since product eligibility starts producing capability strings programmatically.

### F7 — Matching engine has no direct tests · **P1**
**Evidence:** `tests/auto-assignment-orchestrator.test.ts` (1196 lines) mocks `VendorMatchingEngine` entirely. No `vendor-matching-engine.test.ts` exists. Same for `vendor-matching-rules.service.ts`.
**Impact:** Refactoring weights or band tables (which we want to do per F3) is unsafe.
**Fix:** Add unit tests for `scoreVendor` (each factor independently with fixtures), `getEligibleVendors` (each hard-gate), and the tiebreak/sort path. Aim for coverage of every band edge.

### F8 — No FE admin UI for `vendor-matching-rules` · **P1**
**Evidence:** Grep across `l1-valuation-platform-ui/src` for `vendor-matching-rules` / `VendorMatchingRules` returned zero matches.
**Impact:** Even after F1 is fixed, operators cannot configure rules through the product. They would need to call the API directly.
**Fix (subsumed by F2 consolidation):** The existing `/matching-criteria` FE page becomes the unified rules admin. Its current criterion-builder UI (field/operator/value rows, geo operators) maps directly onto the new `field_predicate` rule type. Add UI for priority, action (deny/allow/boost/reduce), score adjustment, and scope filters (productTypes/states). The old criteria-set RTK Query slice (`matchingApi.ts`) gets repointed at `/api/vendor-matching-rules`.

### F9 — Audit trail of "why this vendor was picked" is incomplete · **P1**
**Evidence:** `order.autoVendorAssignment.rankedVendors` stores `{vendorId, vendorName, score}`. The component breakdown (perf/avail/prox/exp/cost), applied rules (once F1 is fixed), and tiebreak reasons are not persisted. `vendorBidAnalysis` (Axiom) is persisted when AI is used, but not the deterministic engine output.
**Impact:** Disputes ("why did we send this to vendor B and not vendor A") are unresolvable from the order record. Drift in the engine over time is invisible — last week's assignment can't be replayed.
**Fix (mostly free from F1):** `RuleEvaluationResult` already returns `appliedRuleIds` + `denyReasons` + `scoreAdjustment`. As soon as F1 wires the engine to the rules service, persist that result per vendor on the assignment decision. Add per-vendor score components (perf/avail/prox/exp/cost) to the same record. Store as `matchExplanation` on the order, or in a sibling `assignment-decisions` container if write-amplification is a concern.

### F10 — Decline/timeout outcomes do not feed back · **P2**
**Evidence:** Bid declines bump `currentAttempt` and advance to next vendor. Performance metrics are not updated by decline events. A vendor who declines every order continues to score the same.
**Fix:** Either include `declineRate` in the performance scorecard, or add a tenant-config "decline penalty" that automatically reduces availability score for vendors with high recent decline rates.

### F11 — Internal-staff branch reuses external-vendor scoring model · **P2**
**Evidence:** Orchestrator branches on `staffType === 'internal'` to skip the bid loop, but `VendorMatchingEngine` scores internal staff with the same model — including `costScore` (an internal staff member doesn't have a "fee") and `blackoutDates` (likely PTO, not a "won't bid" signal).
**Fix:** Either skip cost-scoring for internal staff (re-normalize the remaining weights) or use a separate "staff matching" profile (lands naturally inside F3's per-tenant matching profile).

### F12 — Endpoint sprawl with overlapping semantics · **P2**
**Evidence:** `/api/auto-assignment/{suggest,find-matches,assign,broadcast,accept-bid}` plus `/api/orders/:id/auto-assignment/trigger` plus `/api/orders/:id/rfb/{preview,broadcast,bids/:id/award}` plus `/api/vendors/assign/:orderId`.
**Impact:** FE has multiple API slices doing similar things (`autoAssignmentApi`, `vendorsApi.assignVendor`, `ordersApi.assignOrderVendor`, `matchingApi.previewRfbMatches`). Hard to reason about.
**Fix:** Document a decision tree (when do you use suggest vs. find-matches vs. preview-rfb). Then deprecate the duplicates and have FE consume one slice.

---

## 8. Recommendations (prioritized)

The headline insight: most of the findings collapse into **one consolidation effort** built on the existing rules engine. The phases below sequence that consolidation so each phase is deliverable on its own and unlocks the next.

### Phase 1 — make the rules engine real (1-2 weeks)
The single most important deliverable. Today the engine exists but isn't on the assignment path; everything downstream depends on this.

1. **F1** — Inject `VendorMatchingRulesService` into `VendorMatchingEngine`. In `getEligibleVendors`, after the existing hard-gate filter, call `evaluateRules(tenantId, ctx)` per candidate. Drop denied vendors. Apply `scoreAdjustment` after the weighted sum.
2. **F7** — Add direct unit tests: `scoreVendor` (each factor at band edges), `getEligibleVendors` (each hard-gate), `applyRules` (each rule type, override semantics, priority ordering). Prerequisite for safe refactor.
3. **F9** — Persist `RuleEvaluationResult` (already produced by the rules service) plus per-vendor score components onto the assignment record. Free explainability.

Exit criteria: an operator-created rule actually changes assignment behavior; the order record shows why each candidate was picked or denied.

### Phase 2 — make the rules engine the backbone (2-3 weeks)
Add the one rule type that lets the rules engine express what criteria sets express today.

4. **F2 (part 1)** — Add `field_predicate` rule type (`{field, operator, value}` payload) and corresponding cases in `evalDenyRule` / `evalAllowRule` (and boost/reduce variants if predicate-driven score adjustments are wanted). Add geo operators (`within_radius_miles`, `within_polygon`, `within_bbox`).
5. **F2 (part 2)** — Migrate existing `MatchingCriteriaSet` data into `VendorMatchingRule` documents. Repoint RFB flow (`rfb.service.ts`) at `evaluateRules`.
6. **F8** — Repurpose the existing `/matching-criteria` FE page into the unified rules admin: add UI for priority, action, score adjustment, scope filters. Repoint `matchingApi.ts` RTK Query slice at `/api/vendor-matching-rules`.
7. **F2 (part 3)** — Once nothing reads criteria sets, delete `matching-criteria.controller.ts`, `MatchingCriteriaSet` types, and the `matching-criteria-sets` Cosmos container.

Exit criteria: one rule system, one admin UI, one Cosmos container for rules.

### Phase 3 — express scoring and vendor data as rules (3-4 weeks)
With the backbone in place, retire the hardcoded weights and the duplicate vendor fields.

8. **F3** — Replace `private readonly WEIGHTS` and `DISTANCE_THRESHOLDS` with a default rule pack (seeded per tenant on creation). Engine becomes the executor; rules carry the policy. Optionally keep the deterministic 5-factor sum as the *default* rule pack so behavior is unchanged out of the box.
9. **F4** — Migrate vendor product eligibility / grade to capability strings + rules. Drop `productTypes` and `eligibleProductIds` from the Vendor model.
10. **F5** — Make `geographicCoverage` the sole coverage source. Rules read from it. Drop `Vendor.serviceAreas` and `VendorAvailability.serviceAreas`.
11. **F6** — Move capability catalog into a `capability-catalog` Cosmos container. Rules and FE pickers read from it. Add capabilities without deploys.
12. **F11** — Add an internal-staff rule pack (or per-staffType rule overrides) so internal assignment doesn't reuse the cost/blackout logic designed for external bids.

Exit criteria: zero scoring logic in code outside the engine itself; one source of truth for every vendor attribute; no hardcoded enums.

### Phase 4 — close the loop and clean up endpoints (ongoing)
13. **F10** — Decline/timeout feedback. Either include `declineRate` in the performance scorecard, or expose it as a rule predicate (`min_acceptance_rate`) so tenants tune the penalty.
14. **F12** — Endpoint deprecation pass. Document a decision tree (`/suggest` vs `/find-matches` vs `/preview-rfb`), retire the duplicates, collapse the FE API slices.
15. **(new)** Rules versioning + audit log — `vendor-matching-rules` is mutable in place today. Add change history (who/when/before/after) so rule edits are accountable. Especially important once rules carry scoring policy (Phase 3).

---

## 9. Open Questions

These would benefit from a brief conversation before Phase 1 starts:

1. **What triggers `VendorPerformanceCalculatorService`?** I could not find a cron or event handler in the maps. If it runs on-read inside `scoreVendor`, every assignment recomputes scorecards — performance concern. If it runs on a schedule, we should document the cadence.
2. **Is `vendor-matching-rules` actually used by anyone today?** If operators have never created rules through the API, F1 is purely a "fix the contract" issue. If they have, those rules have been silently ineffective for the lifetime of the system.
3. **Why does RFB exist in parallel to bid-loop auto-assignment?** Is RFB a "future replacement" for the bid loop, or are they intentionally separate flows for different order types? The §7 F2 recommendation has RFB calling `evaluateRules` after migration, so both flows use the same rules engine — but if RFB is meant to replace the bid loop entirely, that changes the prioritization of Phase 2 vs. Phase 3.
4. **Internal staff capacity model** — is `vendor.activeOrderCount` updated transactionally, or eventually? Concurrent assignments to the same internal staffer could over-allocate.
5. **AI override (Axiom)** — the 0.85 confidence threshold is set per-environment. Should that be per-tenant?

---

## 10. Phase 1 — Detailed Implementation Plan

**Status:** ⬜ Not started · **Owner:** TBD · **Target:** F1 + F7 + F9

### 10.1 Goal

Wire the existing `VendorMatchingRulesService` into `VendorMatchingEngine` so operator-created rules actually affect assignment decisions. Add direct unit tests for the engine and the rules service. Persist `MatchExplanation` records onto the order so "why was vendor X picked over vendor Y" is answerable from the order document alone.

**Exit criterion:** an operator creates a `deny` rule via `POST /api/vendor-matching-rules`; a subsequent order trigger excludes the targeted vendor from `rankedVendors`; the order's `autoVendorAssignment.matchExplanations[]` shows the deny reason. A `boost` rule shifts the targeted vendor's `matchScore` by the configured points and the explanation reflects it.

### 10.2 Out of scope (deferred)
- `field_predicate` rule type → Phase 2
- `MatchingCriteriaSet` migration → Phase 2
- FE rules admin page → Phase 2
- Default tenant rule pack seeding → Phase 3
- Scoring weights as rules → Phase 3
- Vendor data consolidation (F4/F5) → Phase 3
- Capability catalog out of code → Phase 3

### 10.3 Design decisions (made; rationale included)

**D1 — Hoist distance computation out of `scoreVendor`.**
`scoreVendor` currently calls `calculateDistance` inside the proximity factor. The rules engine needs `ctx.vendor.distance` available *before* scoring (for `max_distance_miles` deny rules). Choice: precompute distance once in `getEligibleVendors` after geocoding, pass it as a param to both `applyRules` and `scoreVendor`. Avoids double computation; preserves eligibility-then-score ordering.

**D2 — Persist `MatchExplanation` on `order.autoVendorAssignment.matchExplanations[]`.**
Co-located with the FSM state. Write amplification is bounded (one write per rank event, not per read). If it becomes a hotspot later, move to a sibling `assignment-decisions` container — one FE query change. No premature optimization.

**D3 — `VendorMatchingEngine` constructor change is additive.**
Add `constructor(rulesService?: VendorMatchingRulesService)` with default-construct fallback. Both existing `new VendorMatchingEngine()` call sites (`auto-assignment-orchestrator.service.ts:207`, `auto-assignment.controller.ts:27`) get a one-line update to inject the service. Test code that omits the param still works. No DI framework introduction in this phase.

**D4 — Tenants with zero rules see zero behavior change.**
`applyRules` already returns `{eligible: true, scoreAdjustment: 0}` when no rules apply. Wiring is therefore safe-by-construction for the production rollout. Default rule pack waits for Phase 3.

**D5 — Minimal FE update is in scope for Phase 1.**
`AutoAssignmentStatusPanel` gets read-only rendering of `denyReasons`, `appliedRuleIds`, and `scoreComponents`. Without this, audit data is invisible to operators, defeating half of F9. Full rules admin UI still waits for Phase 2.

**D6 — Final `matchScore` clamped to `[0, 100]`.**
After `boost`/`reduce` adjustments. Keeps FE display predictable. Document the clamp; revisit when Phase 3 makes scoring data-driven.

**D7 — `RankedVendorEntry` gains optional `explanation` field.**
Backwards compatible. Old order records without the field render fine on the FE.

### 10.4 Pre-flight checks (must complete before T1)

| ID | Check | Method | Action if positive |
|---|---|---|---|
| PF1 | Is `VendorPerformanceCalculatorService` invoked on-read inside `scoreVendor`? | Grep callers; trace `scoreVendor` perf path | Add per-request metrics caching as a Phase 1.5 task |
| PF2 | Are there existing `vendor-matching-rules` Cosmos documents (any tenant)? | `SELECT VALUE COUNT(1) FROM c WHERE c.type = 'vendor-matching-rule'` per tenant | Surface list to product/ops; communicate before deploy |
| PF3 | Does RFB flow share code with `VendorMatchingEngine`? | Grep `rfb.service.ts` for `VendorMatchingEngine` import | Scope T4 to bid-loop only; defer RFB rule integration to Phase 2 |

Pre-flight results (filled 2026-05-08):

**PF1 — ⚠ Finding (pre-existing perf concern; Phase 1 doesn't compound it):**
`vendor-matching-engine.service.ts:591` calls `performanceService.calculateVendorMetrics(vendorId, tenantId)` on every `scoreVendor` invocation. `calculateVendorMetrics` fully recomputes from raw orders (no caching layer): fetches all completed orders for the vendor, runs six metric category calculations, derives the overall score. A request with N eligible vendors does N full Cosmos scans + recompute, in parallel via `Promise.all`. The nightly batch job (`calculate-vendor-metrics.job.ts`) calls the same function but doesn't appear to feed a cache the engine reads. **Wiring rules in does not compound this** — `applyRules` is a synchronous switch over already-loaded rules. No new Cosmos calls per vendor in T4. **Action:** add **Phase 1.5 task** — per-request memoization in the engine (compute metrics once per vendor per `findMatchingVendors` call) and consider reading the persisted scorecard from `VendorPerformanceUpdaterService` instead of recomputing.

**PF2 — ⏳ Pending (needs ops query):**
Cannot query Cosmos from local environment. **Action for ops:** run the following per tenant DB and report counts back:
```sql
SELECT VALUE COUNT(1) FROM c WHERE c.type = 'vendor-matching-rule'
```
If non-zero, also list active rules by tenant for review before deploy:
```sql
SELECT c.tenantId, c.id, c.name, c.ruleType, c.action, c.priority, c.isActive
FROM c WHERE c.type = 'vendor-matching-rule'
```
**Decision rule:** if any tenant has active rules, schedule a brief comms ("these rules are about to start applying") before T4 deploys.

**PF3 — ✅ Confirmed independent:**
Neither `rfb.service.ts` nor `rfb.controller.ts` imports `VendorMatchingEngine`. RFB is a parallel flow; T4 wiring is bid-loop only. RFB rule integration is correctly scoped to Phase 2.

### 10.5 Task breakdown (sequenced commits)

Each task is a separate commit. Each leaves the build green and tests passing.

**T1 — Unit tests for `VendorMatchingRulesService.applyRules`**
- New file: `tests/vendor-matching-rules.service.test.ts`
- Coverage: each `RuleType` deny case, `allow` overriding `deny` via priority + whitelist match, `boost`/`reduce` accumulation, priority ordering, `ruleAppliesTo` scope filters (`productTypes`, `states`)
- All tests pass against current implementation (this is harness coverage, not behavior change)
- Files touched: 1 new file
- Target: 20+ tests

**T2 — Unit tests for `VendorMatchingEngine.scoreVendor` band edges**
- New file: `tests/vendor-matching-engine.service.test.ts`
- Coverage: each factor (perf/avail/prox/exp/cost) at every band edge; blackout-date hard-zero on availability; budget-exceeded hard-zero on cost; no-geocode state-only fallback; `Vendor.activeOrderCount` fallback when `VendorAvailability` missing; tiebreak determinism
- Files touched: 1 new file
- Target: 25+ tests

**T3 — Hoist distance into `getEligibleVendors`**
- Move per-vendor `calculateDistance` into `getEligibleVendors`; produce `Map<vendorId, distance>`
- Change `scoreVendor` signature: accept `precomputedDistance: number | null`
- Update `findMatchingVendors` to pass distance map through
- Update T2 tests for new signature
- Files: `vendor-matching-engine.service.ts`, `vendor-matching-engine.service.test.ts`
- Behavior change: **none** (same numbers, computed once)

**T4 — Wire rules service into `VendorMatchingEngine`**
- Modify constructor: `constructor(rulesService?: VendorMatchingRulesService)` with default-construct fallback
- In `getEligibleVendors`, after existing hard-gate filter:
  - Load rules once: `const rules = await rulesService.listRules(tenantId, true)`
  - For each candidate, build `RuleEvaluationContext` (vendor + order fields), call `applyRules(rules, ctx)` (sync — already loaded), drop denied
  - Return per-vendor `{vendor, distance, ruleResult}` for the scoring step
- Update both call sites:
  - `auto-assignment-orchestrator.service.ts:207`
  - `auto-assignment.controller.ts:27`
- Files: `vendor-matching-engine.service.ts`, `auto-assignment-orchestrator.service.ts`, `auto-assignment.controller.ts`
- Behavior change: tenants with zero rules — **none**. Tenants with rules — denied vendors filtered out.

**T5 — Apply `scoreAdjustment` after the weighted sum**
- `scoreVendor` accepts `ruleAdjustment: number` (default 0)
- After computing weighted `matchScore`, add `ruleAdjustment`
- Clamp final score to `[0, 100]` (D6)
- Add tests for boost, reduce, combined adjustments, clamp behavior at both ends
- Files: `vendor-matching-engine.service.ts`, `vendor-matching-engine.service.test.ts`
- Behavior change: tenants with `boost`/`reduce` rules — score shifts. Others — none.

**T6 — Define `MatchExplanation` type; persist on order**
- New type in `src/types/vendor-marketplace.types.ts`:
  ```typescript
  export interface MatchExplanation {
    vendorId: string;
    scoreComponents: {
      performance: number;
      availability: number;
      proximity: number;
      experience: number;
      cost: number;
    };
    ruleResult: {
      appliedRuleIds: string[];
      denyReasons: string[];
      scoreAdjustment: number;
    };
    finalScore: number;
    weightsVersion: string; // e.g. "v1-30/25/20/15/10" — detect drift after Phase 3
  }
  ```
- Add `explanation: MatchExplanation` to `VendorMatchResult`
- Add `explanation?: MatchExplanation` to `RankedVendorEntry` (FSM state)
- In `triggerVendorAssignment`, populate from engine output
- Files: `vendor-marketplace.types.ts`, `vendor-matching-engine.service.ts`, `auto-assignment-orchestrator.service.ts`, FE `src/types/backend/` mirror types
- Behavior change: orders gain a new field; old orders without it render fine.

**T7 — FE rendering of `MatchExplanation`**
- `AutoAssignmentStatusPanel.tsx`: per-ranked-vendor expandable row showing
  - Score component breakdown (5 small chips: P/A/Px/E/C with values)
  - Rule adjustment (single value, +/-)
  - Applied rule IDs (badge list, link to rule detail in Phase 2)
  - Deny reasons (only if vendor was considered then dropped — see D8 below)
- Update `RankedVendorEntry` type in `src/store/api/autoAssignmentApi.ts`
- Snapshot tests updated
- Files: `AutoAssignmentStatusPanel.tsx`, `autoAssignmentApi.ts`, optional new `MatchExplanationDisplay.tsx`

**D8 (sub-decision in T7) — Surface denied vendors in explanation?**
Two options:
- **(a)** Drop denied vendors entirely in `getEligibleVendors` — current behavior. Simple. Operators see only ranked vendors.
- **(b)** Keep denied vendors in a separate `deniedVendors[]` field on the FSM state with their `denyReasons`. Better explainability ("why didn't vendor X get considered?") but more storage.
**Recommendation:** **(b)** — implement in T6/T7. The whole point of F9 is "why this vendor over that vendor." Without seeing denied candidates, half the question is unanswerable. Storage cost is bounded by eligible vendor count per tenant (small).

**T8 — End-to-end integration test with real rule**
- Extend `tests/auto-assignment-orchestrator.test.ts`:
  - Replace engine mock with real `VendorMatchingEngine` + real `VendorMatchingRulesService` (seeded with in-memory `CosmosDbService` mock)
  - **Test 1:** seed `deny` rule targeting vendor A; trigger; assert vendor A in `deniedVendors[]` with reason; assert vendor A not in `rankedVendors[]`
  - **Test 2:** seed `boost` rule (+15 points) targeting vendor B; trigger; assert vendor B's `matchScore` is 15 higher than baseline; assert `appliedRuleIds` contains the rule ID
- Confidence-builder before merge

**T9 — Update Progress Snapshot in this doc**
- F1, F7, F9 → ✅ with date
- Phase 1 row → ✅ with date and PR ref
- Add brief retrospective note if anything diverged from plan

### 10.6 Test plan summary

| Suite | New tests | Existing impact |
|---|---|---|
| `vendor-matching-rules.service.test.ts` | 20+ | New file |
| `vendor-matching-engine.service.test.ts` | 25+ (incl. T5 adjustment cases) | New file |
| `auto-assignment-orchestrator.test.ts` | 2 (T8) | Existing 1196 lines remain valid (engine mock surface unchanged) |

**Run commands:**
- Targeted: `pnpm vitest run tests/vendor-matching-rules.service.test.ts tests/vendor-matching-engine.service.test.ts tests/auto-assignment-orchestrator.test.ts`
- Full: `pnpm vitest` — must remain green
- FE: `pnpm vitest` from `l1-valuation-platform-ui` — `AutoAssignmentStatusPanel` snapshot suite must pass

### 10.7 Migration & rollback

- **Data migration:** none. New fields on documents are optional; old docs remain valid.
- **Rollback:** revert commits. The `MatchExplanation` field on existing orders becomes orphaned data — harmless, ignored by reverted code.
- **Feature flag:** none. Behavior is unchanged for tenants with zero rules. For tenants with rules, this *is* the fix — gating it behind a flag would defeat the purpose.

### 10.8 Risk register

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | `VendorPerformanceCalculatorService` is on-read → wiring rules compounds per-assignment cost | Low (need PF1) | Per-request metrics cache as a follow-up Phase 1.5 task |
| R2 | Tenants have silently-ineffective rules that now suddenly apply | Medium (need PF2) | Surface rule list to product/ops before deploy; staged rollout if any tenant has rules |
| R3 | Score clamp `[0, 100]` (D6) surprises operators tuning rules | Low | Document the clamp in admin UI; revisit in Phase 3 |
| R4 | FE snapshot tests break on `AutoAssignmentStatusPanel` changes | High (expected) | T7 explicitly includes snapshot updates |
| R5 | Order document write amplification from `matchExplanations[]` + `deniedVendors[]` exceeds Cosmos RU/s headroom | Low | Bounded by eligible vendor count (typically <50). If it bites, move to sibling container per D2 fallback. |

### 10.9 Definition of done

- [ ] PF1, PF2, PF3 results recorded in §10.4
- [ ] T1–T8 committed, each on its own
- [ ] All new tests passing; full BE suite green; FE snapshots updated
- [ ] One manual smoke test: create a `deny` rule via API → create an order → verify targeted vendor in `deniedVendors[]` with reason, not in `rankedVendors[]`
- [ ] One manual smoke test: create a `boost` rule (+10) → create an order → verify targeted vendor's `matchScore` higher than baseline and `appliedRuleIds` contains the rule
- [ ] §0 Progress Snapshot updated (T9)
- [ ] PR description references findings F1, F7, F9 by ID and links back to this plan

### 10.10 What I'll do when greenlit

In execution order, before writing any production code:
1. Run pre-flight checks PF1, PF2, PF3; write results into §10.4.
2. If any pre-flight surfaces a blocker (e.g. PF1 confirms on-read perf calc + measurable cost), pause and discuss before proceeding.
3. Start with T1 (red tests against rules service) and T2 (red tests against engine). These are pure additions — no risk to existing behavior. Once they're green-against-current-behavior, the engine and rules service have a safety net for the rest of the changes.
4. T3 → T4 → T5 → T6 → T7 → T8 in sequence. Each commit after T1/T2 has tests that move with it.
5. T9 closes the loop on this doc.

---

## 11. UI/UX Plan

This section is the FE-side companion to the implementation plan. Goal: make the auto-assignment system not just functional but **observable, explorable, and tunable** by operators — and visually polished enough to be a flagship surface of the product.

### 11.1 Design principles

1. **Explainability first.** Every score, every assignment, every rule effect is traceable to its inputs. No "magic numbers."
2. **Sandbox before production.** Operators preview the effect of a rule change against live data before saving.
3. **Progressive disclosure.** Headline view stays clean; click to drill into score components, rule chains, vendor history.
4. **Live feedback.** Editing a rule shows a real-time count of "X vendors will be affected by this change."
5. **Match the existing visual language.** Material UI base; existing chip / card / table patterns extended, not replaced.
6. **Color semantics:** `deny` red, `allow` green, `boost` blue, `reduce` amber, `eligible` neutral grey. Used consistently across rules admin, score breakdowns, and audit views.
7. **Drag where it makes sense.** Rule priority ordering is drag-to-reorder; everything else uses standard form controls.
8. **Empty states are educational.** First-time operators see annotated examples, not blank pages.

### 11.2 Information architecture

New top-level nav section: **Auto-Assignment** (gear icon). Sub-pages:

```
Auto-Assignment
├── Dashboard          ← landing: KPIs + recent decisions + system health
├── Rules              ← unified rules admin (replaces /matching-criteria in Phase 2)
├── Scoring Profiles   ← rule packs / weight tuning (Phase 3)
├── Capabilities       ← capability catalog admin (Phase 3)
├── Sandbox            ← test rules + scoring against historical or hypothetical orders
└── Decisions          ← per-order assignment audit log (Phase 4)
```

Existing pages enhanced:
- **`/orders/:id`** — `AutoAssignmentStatusPanel` becomes a rich, expandable surface (Phase 1+)
- **`/vendors/:id`** — adds "Rule preview" tab: which rules currently affect this vendor (Phase 2+)
- **`/products-fees`** — products gain a "Rule attachments" section showing which rules are scoped to each product (Phase 2+)

### 11.3 Phase 1 UI — order-detail explainability

**Surface:** `AutoAssignmentStatusPanel.tsx` (existing component, extended)

**Layout sketch (ranked vendor row, expanded):**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [▼] #1  Acme Appraisers              Score: 91   [ACCEPTED]            │
│       ──────────────────────────────────────────                       │
│       Score breakdown                                                  │
│       ┌──────────────┬──────────┬───────┬─────────┐                    │
│       │ Factor       │ Raw      │ Weight│ Weighted│                    │
│       ├──────────────┼──────────┼───────┼─────────┤                    │
│       │ Performance  │  92      │  30%  │  27.6   │                    │
│       │ Availability │  85      │  25%  │  21.3   │                    │
│       │ Proximity    │  90      │  20%  │  18.0   │                    │
│       │ Experience   │  80      │  15%  │  12.0   │                    │
│       │ Cost         │  70      │  10%  │   7.0   │                    │
│       │              │          │       │  ─────  │                    │
│       │ Subtotal     │          │       │  85.9   │                    │
│       │ Rule adj.    │          │       │  +5.0   │                    │
│       │ Final        │          │       │  91.0   │                    │
│       └──────────────┴──────────┴───────┴─────────┘                    │
│                                                                        │
│       Rules applied                                                    │
│       [BOOST]  "VA panel preferred"  +5    →  rule#a3f2…  [view]       │
│                                                                        │
│       Bid status: PENDING_BID · expires in 3h 22m                      │
│       [Accept]  [Decline]  [Override vendor]                           │
└────────────────────────────────────────────────────────────────────────┘
```

**Denied vendors collapsed section** (below ranked list):

```
┌────────────────────────────────────────────────────────────────────────┐
│ ▶  3 vendors not considered                                  [expand]  │
│                                                                        │
│    Beta Appraisals    [DENY]  blacklist: "AMC restricted list"        │
│    Gamma Valuations   [DENY]  state_restriction: not licensed in FL    │
│    Delta Inspect      [DENY]  min_performance_score: 65 < 70 minimum   │
└────────────────────────────────────────────────────────────────────────┘
```

**Visual touches:**
- Score breakdown table renders with progress bars in the "Raw" column (0-100 fill)
- Rule chips use the action color palette (boost = blue badge with `+N`, reduce = amber `-N`, deny = red, allow = green)
- Each rule chip is clickable → opens a popover with the full rule definition; in Phase 2, "Edit rule" link
- Subtle weight column animation: the `Weighted` cell reveals when row expands (~150ms slide-down)
- Vendor avatar / logo if available (existing pattern in the vendor list)
- "Why was this vendor picked?" one-liner above the breakdown for quick scanning ("Highest performance + within preferred state + VA-panel boost")

**Components to add:**
- `MatchExplanationCard.tsx` — the breakdown table + rule chips
- `DeniedVendorList.tsx` — collapsed denial section
- `RulePopover.tsx` — rule definition popover (read-only in Phase 1; gains edit affordance in Phase 2)

### 11.4 Phase 2 UI — unified Rules admin

**Surface:** `/auto-assignment/rules` (repurpose `/matching-criteria`)

**Layout — list view:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Rules                                                  [+ New rule] [Import] │
│  ──────────────────────────────────────────────────────────────────────────── │
│  Filter: [All actions ▾] [All scopes ▾] [Active ▾] [Search rules…       ]   │
│  ──────────────────────────────────────────────────────────────────────────── │
│  ⠿  Pri  Name                              Action      Scope          Status │
│  ⠿   5   Blacklist: AMC restricted        [DENY]      All products    ●     │
│  ⠿  10   Florida-licensed only            [DENY]      FL              ●     │
│  ⠿  15   Minimum 80 performance           [DENY]      Rush orders     ●     │
│  ⠿  20   Whitelist: VIP vendors           [ALLOW]     All             ●     │
│  ⠿  50   VA panel +5                      [BOOST]     VA loans        ●     │
│  ⠿  60   Same-state preferred +10         [BOOST]     All             ●     │
│  ⠿  70   Distance > 200mi -15             [REDUCE]    All             ○     │
│         (drag handle ⠿ to reorder priority)                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Layout — rule builder:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Edit rule                                              [Save] [Cancel] [Test] │
│  ──────────────────────────────────────────────────────────────────────────── │
│  Name        [VA panel preferred                                          ]   │
│  Description [Boost vendors who are on the VA approved panel              ]   │
│                                                                              │
│  Action      ( ) Deny    ( ) Allow    (●) Boost    ( ) Reduce               │
│  Adjustment  [ +5 ] points                                                   │
│  Priority    [ 50 ]   ⓘ lower runs first; deny rules typically ≤ 20        │
│                                                                              │
│  Conditions  ── all of (AND) ──                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ vendor.capabilities  [contains ▾]  [va_panel              ]    [×]  │  │
│   │ order.productType    [in       ▾]  [VA_LOAN, VA_REFI      ]    [×]  │  │
│   │ [+ Add condition]                                                    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Scope                                                                       │
│   Product types  [VA_LOAN ×] [VA_REFI ×] [+ add]    (empty = all)          │
│   States         [+ add]                            (empty = all)          │
│                                                                              │
│  ─── Live preview ───────────────────────────────────────────────────────    │
│  This rule would currently apply to: 47 active vendors / 12 open orders     │
│  [▶ Show affected vendors]                                                   │
│                                                                              │
│  ─── Test ──────────────────────────────────────────────────────────────     │
│  Pick an order to simulate:  [Order #4521 ▾]                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Vendor          Without rule    With rule    Δ                       │  │
│  │ Acme            85              90           +5                      │  │
│  │ Beta            78              78           —                       │  │
│  │ Gamma           82              87           +5                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key UX patterns:**
- **Drag handle (`⠿`) on the list view** for priority reorder; a debounced PATCH commits the new priorities. Optimistic update + toast on save.
- **Status dot:** ● active / ○ inactive. Click to toggle (with confirmation for active rules in production).
- **Rule type detection:** the builder picks `RuleType` automatically based on which condition fields the operator selects, then surfaces the canonical rule type as a small chip ("This is a `min_performance_score` rule"). For Phase 2's `field_predicate` rule type, this becomes the default when conditions don't match a canonical type.
- **Live preview:** "This rule would currently apply to N vendors / M open orders." Updates as the operator types. Server endpoint: `POST /api/vendor-matching-rules/preview` with the unsaved rule body, returns affected counts.
- **Sandbox test:** the "Test" panel lets the operator pick an order (recent or fixture) and see Δ score per vendor before saving. Reuses Phase 1's explanation engine.
- **Validation rail (right side, sticky):** unsaved changes shown as a side bar with field-by-field diff. "3 unsaved changes."
- **Bulk import:** YAML/JSON paste for migrating from external systems. Validated then previewed before commit.

**Components:**
- `RulesList.tsx` (new) — drag-to-reorder table
- `RuleBuilder.tsx` (new, replaces `/matching-criteria` page form) — left: form; right: live preview + sandbox
- `ConditionRow.tsx` (extracted from existing criteria-set page) — field/operator/value picker
- `RulePreviewPanel.tsx` — affected vendors / orders count
- `RuleSandbox.tsx` — order picker + Δ score table

### 11.5 Phase 3 UI — Scoring Profiles + Capabilities + Vendor consolidation

**Surface:** `/auto-assignment/scoring-profiles`

**Layout — profile editor:**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Default Scoring Profile                                          [Save] [⋯]  │
│  ──────────────────────────────────────────────────────────────────────────── │
│  Weights  ── must sum to 100 ──                                              │
│                                                                              │
│   Performance   ████████████████████░░░░░░░░░░  30%  [─][+]                  │
│   Availability  █████████████████░░░░░░░░░░░░░  25%  [─][+]                  │
│   Proximity     ██████████████░░░░░░░░░░░░░░░░  20%  [─][+]                  │
│   Experience    ██████████░░░░░░░░░░░░░░░░░░░░  15%  [─][+]                  │
│   Cost          ███████░░░░░░░░░░░░░░░░░░░░░░░  10%  [─][+]                  │
│                 ──────────────────────────────  ───                          │
│                                              Σ  100                          │
│                                                                              │
│  Distance bands                                                              │
│   ┌──────────────┬──────────┬────────┐                                       │
│   │ Range (mi)   │ Score    │ Action │                                       │
│   ├──────────────┼──────────┼────────┤                                       │
│   │ 0 – 25       │ 100      │ [edit] │                                       │
│   │ 25 – 75      │  80      │ [edit] │                                       │
│   │ 75 – 150     │  60      │ [edit] │                                       │
│   │ 150 – 300    │  40      │ [edit] │                                       │
│   │ 300+         │   0      │ [edit] │                                       │
│   └──────────────┴──────────┴────────┘                                       │
│                                                                              │
│  ─── Profile impact ────────────────────────────────────────────────────     │
│  Backtest against last 30 days of orders:                                    │
│   • 1,247 orders re-scored                                                   │
│   • Vendor ranking would have differed on 89 orders (7.1%)                   │
│   • Top assignment would have changed on 23 orders (1.8%)                    │
│   [▶ View affected orders]                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Visual touches:**
- **Weight sliders are linked**: dragging Performance up auto-decreases the others proportionally. Manual override via [+]/[─] buttons. A constraint badge ("Σ 100 ✓") turns red if invalid.
- **Distance bands are visualized as a histogram** above the table — hover a band to highlight the row.
- **Backtest is the killer feature**: before saving, the operator sees how the new profile *would* have behaved against real recent orders. Uses persisted `MatchExplanation` data from Phase 1 — the system can replay assignments without re-querying vendor data.

**Surface:** `/auto-assignment/capabilities`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Capability Catalog                                              [+ New]     │
│  ──────────────────────────────────────────────────────────────────────────── │
│  Category       Capability                Description                        │
│  ─────────────  ───────────────────────  ──────────────────────────────────  │
│  Compliance     fha_approved             FHA-approved appraiser              │
│  Compliance     va_panel                 On VA approved panel                │
│  Compliance     uad36_compliant          UAD 3.6 compliant                   │
│  Specialty      drone_certified          Drone inspection certified          │
│  Specialty      luxury_over_1m           Luxury homes >$1M                   │
│  Property type  manufactured_housing     Manufactured housing                │
│  ...                                                                         │
│                                                                              │
│  [Each row: edit description, add to category, archive]                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Vendor detail page (existing) — Phase 3 enhancements:**
- Replace 3 coverage fields with one **interactive map editor** (Leaflet/Mapbox) where operators draw or pick states/counties for licensed/preferred/extended zones with color-coded overlays.
- Capability picker becomes a multi-select dropdown sourced from `/capability-catalog`.
- New tab: **"Rule preview"** — lists every active rule that currently affects this vendor (deny / allow / boost / reduce), grouped by action.

### 11.6 Phase 4 UI — Sandbox + Decisions audit

**Surface:** `/auto-assignment/sandbox`

A standalone "what-if" environment. Operator picks any combination of:
- An order (real recent or constructed)
- A scoring profile
- A set of rule changes (uncommitted)

…and sees the full ranked vendor list with explanations, *without affecting production*. Save the simulation as a named scenario for later replay.

**Surface:** `/auto-assignment/decisions`

Searchable, filterable audit log of every assignment decision. Per-decision drill-in:
- Full `MatchExplanation[]` (already persisted from Phase 1)
- `deniedVendors[]` with reasons
- Scoring profile version + rules version at decision time
- Outcome timeline: bid sent → declined → next vendor → accepted (etc.)
- "Replay this decision with current rules" button — runs the engine again with today's config and shows the diff

### 11.7 Auto-Assignment Dashboard

**Surface:** `/auto-assignment` (landing)

**Top KPI strip** (4 cards):
- **Auto-assignment rate** — % of orders auto-assigned without human override (last 7 days, with sparkline)
- **Mean time to assignment** — from order created → vendor accepted
- **Decline rate** — % of bids declined; trend
- **Active rules** — count + how many fired in the last 24h

**Center widgets:**
- **Recent decisions stream** — live feed of "Order #X assigned to Vendor Y in Z minutes" with click-through to decision detail
- **Top vendors by acceptance rate** — leaderboard
- **Rules health** — list of rules that haven't fired in N days (candidates for archive)

**Right rail:**
- **System health**: orchestrator listener status, Service Bus event lag, last performance metric refresh
- **Open issues**: stuck orders (PENDING_BID > expiry), vendors with declining performance scores

### 11.8 Cross-cutting interactions

- **AI Assistant integration** (existing in this codebase): teach it new intents — "show me why order X was assigned to vendor Y", "create a rule that boosts VA panel vendors by 5 points", "which vendors would be affected if I raised the minimum performance score to 80?"
- **Keyboard shortcuts:** `g r` go to rules, `g d` go to dashboard, `n` new rule from anywhere in /auto-assignment
- **URL-deep-linkable filters:** `/auto-assignment/rules?action=deny&scope=FL&status=active` so operators can share specific views
- **Notifications:** rule edit by another user → toast "Sara just updated rule #abc — refresh to see"

### 11.9 Visual / brand polish

- **Iconography:** custom SVG set per action (deny: octagon-stop, allow: check-shield, boost: arrow-up-circle, reduce: arrow-down-circle). Animated on rule fire (subtle pulse).
- **Empty states:** illustrated, with one-click "create my first rule from a template" affordance. Templates: "Blacklist a vendor", "Require a license", "Boost preferred vendors", "Distance cap".
- **Onboarding tour** (first visit): three-step coach-mark walkthrough of dashboard → rules → sandbox.
- **Dark mode parity** with existing app theme.
- **Loading skeletons** matched to final layout (no layout shift).
- **Micro-interactions:** rule reorder animates with FLIP transition; weight sliders snap with haptic-style tick at 5% increments; live preview counts animate with `react-spring` count-up.

### 11.10 UI work sequencing (mapped to BE phases)

| BE Phase | FE Deliverable | Estimated FE effort |
|---|---|---|
| Phase 1 | `MatchExplanationCard`, `DeniedVendorList`, `RulePopover` in `AutoAssignmentStatusPanel` | ~3-5 days |
| Phase 2 | Unified Rules admin page (list + builder + sandbox + live preview); deprecate `/matching-criteria` page | ~2-3 weeks |
| Phase 3 | Scoring Profiles page; Capabilities page; vendor detail map editor + rule preview tab | ~3-4 weeks |
| Phase 4 | Auto-Assignment Dashboard; Decisions audit log; Sandbox; AI assistant intents | ~3-4 weeks |

### 11.11 Design artifacts to produce before each FE phase

For each phase before code:
1. **Figma frames** for primary surfaces (3-5 frames per phase)
2. **Component inventory** — which existing components reused, which new
3. **Empty / loading / error state** for every new surface
4. **Interaction spec** for non-trivial flows (drag-to-reorder, weight slider linking, sandbox simulation)
5. **Accessibility checklist** — keyboard nav, ARIA labels, focus management on dialogs
6. **Responsive breakpoints** — admin pages targeted at desktop but should degrade gracefully to tablet

These should be produced and reviewed before each phase's BE work starts, so FE and BE work in parallel.

---

## Appendix A — Key file references

**Backend**
- `src/services/vendor-matching-engine.service.ts` — engine A (5-factor scorer)
- `src/services/vendor-matching-rules.service.ts` — engine B (rules; orphaned)
- `src/services/auto-assignment-orchestrator.service.ts` — FSM + Service Bus listener
- `src/services/rfb.service.ts` — RFB lifecycle (uses MatchingCriteriaSet)
- `src/services/vendor-performance-calculator.service.ts` — performance scorecard
- `src/controllers/auto-assignment.controller.ts` — HTTP entry points
- `src/controllers/vendor-matching-rules.controller.ts` — rules CRUD (FE-less)
- `src/controllers/matching-criteria.controller.ts` — criteria sets CRUD
- `src/controllers/tenant-automation-config.controller.ts` — toggles
- `src/types/vendor-marketplace.types.ts` — vendor / availability / metrics types
- `src/types/matching.types.ts` — criteria set + RFB types
- `src/types/index.ts` — Vendor profile, Order, Product types
- `tests/auto-assignment-orchestrator.test.ts` — orchestrator tests (engine mocked)

**Frontend**
- `src/components/order/AutoAssignmentStatusPanel.tsx` — order-level status + override
- `src/components/order/ManualVendorOverrideDialog.tsx` — manual override
- `src/app/(control-panel)/vendors/page.tsx` + `[vendorId]/page.tsx` — vendor admin
- `src/app/(control-panel)/products-fees/page.tsx` — product admin (inline criteria)
- `src/app/(control-panel)/matching-criteria/page.tsx` — criteria sets admin
- `src/app/(control-panel)/orders/[id]/rfb/page.tsx` — RFB lifecycle UI
- `src/app/(control-panel)/vendor-engagement/assignment/page.tsx` — manual/auto/broadcast
- `src/store/api/vendorsApi.ts`, `ordersApi.ts`, `matchingApi.ts`, `autoAssignmentApi.ts`, `productsApi.ts`
- `src/types/backend/matching.types.ts` — FE-side matching types

---

## Confidence

- **High confidence**: F1 (verified directly — engine does not import rules service), F2 direction (verified by reading both `vendor-matching-rules.service.ts` and `matching.types.ts` end-to-end after the initial draft mistakenly recommended the opposite), F3 (verified — weights are `private readonly`), F8 (verified — zero FE references to `vendor-matching-rules`).
- **Medium confidence**: Other findings are based on the structured maps from the exploration agents; file:line references are theirs and were not all re-verified.
- **Open**: items in §9. Phases 2–4 sequencing may shift depending on the answer to "is RFB a replacement for the bid loop or a parallel flow."

### Revision note (2026-05-08)
The first draft of this report recommended retiring `VendorMatchingRulesService` in favor of `MatchingCriteriaSet`, on the basis that criteria sets are "more general." That was a surface-level reading of the rule-type enum as a constraint rather than as the engine's extensibility surface. After re-reading both implementations: criteria sets are a flat predicate list with no priority, no actions, no overrides, no deny reasons; the rules engine has all of those. The corrected recommendation in §7 F2 is to keep the rules engine and absorb criteria sets into it as a `field_predicate` rule type. F3/F4/F5/F6/F8/F9 then collapse into that consolidation rather than being independent fixes.
