# Auto-Assignment System — End-to-End Review

**Created:** 2026-05-08
**Last updated:** 2026-05-08
**Scope:** Vendor auto-assignment across `appraisal-management-backend` (logic + storage) and `l1-valuation-platform-ui` (admin/operator surfaces).
**Reviewer:** Claude (Opus 4.7)
**Revisions:**
- 2026-05-08 (initial) — End-to-end review.
- 2026-05-08 (rev 1) — F2/recommendations corrected after re-reading `VendorMatchingRulesService` properly. Original draft mistakenly recommended retiring the rules engine in favor of `MatchingCriteriaSet`; the corrected position is the opposite (see §7 F2).
- 2026-05-08 (rev 2) — Added Progress Snapshot (§0) for live tracking; status columns added to findings table and recommendations.
- 2026-05-09 (rev 3) — **Major direction change.** Original review failed to survey sibling repos and missed that we own a production-grade rules engine: **Prio** (RETE-based, in `c:\source\prio`), wrapped by **MOP** (`c:\source\mortgage-origination-platform`) which already exposes HTTP eval. Phase 2-4 plans rewritten around MOP/Prio. Phase 2 starting work: a `VendorMatchingRulesProvider` interface that lets the engine call homegrown OR MOP, with circuit-breaker fallback. See §12 for the new Phase 2 plan.
- 2026-05-09 (rev 4) — **Phase 2 complete in dev** + **end-state vision (§13)**. MOP serves vendor-matching live in Azure dev. AMS dev configured for `mop-with-fallback`. Hardening landed (CI smoke tests, schema validator, wire-contract fixture, structured eval logs, AMS bicep wiring, RBAC follow-up runbook entry). New §13 lays out Phases 3-8 as the path from "MOP works" to "operators can see + do EVERYTHING with rules" — full CRUD UI, per-order trace, sandbox/replay, ops dashboard, prod cutover, homegrown retirement.

---

## 0. Progress Snapshot

This section is the **live tracker** — update statuses, add commit/PR refs, and date each transition as work progresses.

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Paused · 🚫 Won't do

| Phase | Goal | Status | Started | Completed | Notes / PRs |
|---|---|---|---|---|---|
| Phase 1 | Make the rules engine real (F1 + F7 + F9) | ✅ | 2026-05-08 | 2026-05-08 | All tasks ✅. BE master: 25f3a2d, d691bbc, c86b2a3, c749676, 1568fa6, 10477ac, 4e45871 (+ doc commits). FE main: T7 (MatchExplanation + DeniedVendor components). 151 tests added (43 rules + 77 engine + 17 orchestrator → 20 + 14 FE). |
| Phase 2 | **MOP/Prio integration** — F2 + F8. See §12. | ✅ | 2026-05-09 | 2026-05-09 | All BE + MOP-side work landed. MOP eval live in dev: external FQDN, auth-proxy + X-Service-Auth, vendor-matching reasoner + route serving 200s. AMS dev configured `RULES_PROVIDER=mop-with-fallback`. CI smoke tests on every deploy. Schema validator + wire-contract tests both sides. Live-trace script for end-to-end smoke. |
| Phase 3 | **Rules CRUD + Live Reload (MOP foundation for UI)** — see §13.4 | ⬜ | — | — | Foundation for Phases 4-7. Per-tenant rule packs in Cosmos, CRUD API, hot-reload via change feed, audit trail. ~2w. |
| Phase 4 | **Rules Authoring Workspace (FE)** — see §13.5 | ⬜ | — | — | Full operator UI for rule CRUD with visual condition builder, sandbox preview, diff/version. ~3w. Blocked on Phase 3. |
| Phase 5 | **Per-Order Trace + Live Feed (visibility)** — see §13.6 | ⬜ | — | — | Per-assignment evaluation trace persisted; FE order-detail "why this vendor" timeline; live feed page. ~2.5w. Parallel with Phase 4 after Phase 3. |
| Phase 6 | **Sandbox + Replay (safety)** — see §13.7 | ⬜ | — | — | What-if eval against historical orders; replay any past assignment with proposed rules. ~2w. Parallel with Phase 4/5. |
| Phase 7 | **Operations + Tenant Controls** — see §13.8 | ⬜ | — | — | Live dashboard, alerts, per-tenant kill switch. ~2w. Parallel after Phase 5. |
| Phase 8 | **Production cutover + retire homegrown** — see §13.9 | ⬜ | — | — | Promote MOP to staging then prod, soak, then delete `VendorMatchingRulesService`. ~1.5w. Final phase. |

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
| F2 | THREE rule systems coexist: `MatchingCriteriaSet` (RFB criteria, in BE), `VendorMatchingRules` (homegrown engine, in BE), and **MOP/Prio** (production RETE engine, in sibling repo, owned by us). The original review missed MOP/Prio entirely. Recommend MOP becomes the eval backbone for vendor matching; the homegrown service stays as a fallback during transition. Both BE-side rule systems eventually retire. | **P1** | 🟡 (provider interface ✅; MOP-side evaluator + cutover pending) | 2 |
| F3 | Scoring weights (30/25/20/15/10) and all band thresholds (distance, capacity, fee ratio, experience tiers) are `private readonly` in code with no tenant override. Tuning requires a deploy. **Solved by F2 in MOP: weights/bands live in Prio's JSON DSL.** | **P1** | ⬜ | 3 |
| F4 | Vendor "what products can this vendor do" is represented in **three** non-canonical fields: `productTypes` (legacy), `eligibleProductIds` (new hard-gate), `productGrades` (per-product grade). They can drift. **Solved by F2 in MOP: product eligibility + grade are facts asserted to Prio; rules reference them.** | **P1** | ⬜ | 3 |
| F5 | Geographic coverage lives in **three** places: `vendor.serviceAreas`, `vendor.geographicCoverage` (3-zone), `vendor-availability.serviceAreas`. The engine reads one, rules read another, availability reads a third. **Solved by F2 in MOP: coverage becomes facts + Prio rules.** | **P1** | ⬜ | 3 |
| F6 | `VendorCapability` is a hardcoded string union of 16 values (`fha_approved`, `uad36_compliant`, etc.). Adding a capability requires a code change in the FE *and* BE. **Solved by F2 in MOP: capabilities become free-form fact strings referenced by Prio rules; FE picker reads from a catalog.** | **P2** | ⬜ | 3 |
| F7 | The matching engine has zero direct unit tests. Orchestrator tests mock the engine entirely. | **P1** | ✅ (T1+T2+T8) | 1 |
| F8 | No FE admin UI exists for `vendor-matching-rules` (BE controller + endpoints exist; FE has none). Operators cannot manage rules through the product. **F2 (MOP) shifts the question: long-term, rules admin lives wherever MOP exposes its rule CRUD; short-term, the existing `/matching-criteria` page can be repurposed for managing the homegrown fallback rules.** | **P1** | ⬜ | 2 |
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

### F2 — Three rule systems; MOP/Prio is the one we should be using · **P1**
**Evidence:** Three systems with overlapping concerns, only the third of which is production-grade:

- **`VendorMatchingRulesService`** (BE, `vendor-matching-rules.service.ts`) — a homegrown, in-process rules engine. Priority ordering, four action semantics (`deny` / `allow` / `boost` / `reduce`), whitelist-overrides-deny logic, per-rule scope filters, captured deny reasons. 11 hardcoded rule types via switch in `evalDenyRule`.
- **`MatchingCriteriaSet`** (BE, `matching.types.ts`, `rfb.service.ts`) — a flat list of `field/operator/value` predicates joined by ONE combinator (AND or OR). No priority, no actions, no score adjustments, no overrides, no deny reasons. A query DSL, not a rules engine.
- **MOP/Prio** (sibling repo, owned by us, currently unused by this BE) — production RETE engine with JSON DSL, alpha/beta networks, working memory, aggregation, native explanation/audit, multi-program support, HTTP/gRPC/WASM surfaces, ~1330 LOC of HTTP server alone. MOP wraps it for loan use cases today; vendor-matching is a natural next consumer.

The original review missed MOP/Prio entirely (didn't survey sibling repos). Both BE-side rule systems are reinventing capabilities that MOP/Prio already provides.

**Impact:** Three rule systems instead of one. Two of the three are homegrown reimplementations of less than 5% of what Prio already does. Tuning, audit, RETE optimization, and explanation are all DIY in the homegrown engine; MOP/Prio gives them for free.

**Fix — MOP becomes the eval backbone, with the homegrown service as a fallback during transition.**

A `VendorMatchingRulesProvider` interface (Phase 2 ✅ landed) lets the engine call either backend. Three providers ship:
- `HomegrownVendorMatchingRulesProvider` — wraps the existing service.
- `MopVendorMatchingRulesProvider` — calls MOP's HTTP eval contract.
- `FallbackVendorMatchingRulesProvider` — circuit-breaker decorator: MOP primary, homegrown fallback.

Selected at startup via `RULES_PROVIDER` env var. Default stays `homegrown` until MOP exposes the vendor-matching evaluator + we're confident in cutover.

**Migration path (now §12 — Phase 2):**
1. Provider interface + factory ✅ (committed: see §0 Progress Snapshot).
2. Add a vendor-matching reasoner to MOP — register a Prio program, define vendor-matching rules in JSON DSL, expose `POST /api/v1/vendor-matching/evaluate`.
3. Migrate any active `vendor-matching-rules` Cosmos documents into Prio JSON rule files.
4. Smoke test in dev: `RULES_PROVIDER=mop-with-fallback`, observe traffic, validate parity with homegrown via shadow comparison.
5. Promote to staging, then production.
6. After a stable period, retire the homegrown rules service, the `vendor-matching-rules` Cosmos container, and the homegrown CRUD endpoints (rules admin moves to whatever MOP exposes).
7. RFB flow's criteria-set path also moves to MOP eval; `MatchingCriteriaSet` retires.

### F3 — Scoring weights and thresholds are hardcoded · **P1**
**Evidence:** `vendor-matching-engine.service.ts:36-51` — `private readonly WEIGHTS` and `private readonly DISTANCE_THRESHOLDS`. Capacity bands (1/3/5), experience bands (5/20/50), fee bands (0.8/1.0/1.1/1.2), grade points (0/5/10/15) all inline in `scoreVendor`.
**Impact:** A tenant who values turnaround over price cannot say so. A tenant in a high-density urban market cannot tighten distance bands. Tuning requires a deploy.
**Fix (Phase 3, on top of F2/MOP):** Once MOP owns rule evaluation, scoring weights and bands become Prio JSON rules:
- "performance ≥ 90 → boost score by 30" is a `boost` rule with a `min_performance_score` antecedent.
- Distance bands become rules at 25/75/150/300mi thresholds with the corresponding boost values.
- Per-tenant rule packs override the default.
- The deterministic 5-factor sum in `scoreVendor` survives only as the **default rule pack** seeded for new tenants; the math moves into Prio and out of TypeScript.

### F4 — Vendor-product eligibility represented in three competing fields · **P1**
**Evidence:** `Vendor.productTypes` (legacy enum), `Vendor.eligibleProductIds` (hard-gate), `Vendor.productGrades` (per-product grade for experience bonus). Engine reads `eligibleProductIds` for the gate and `productGrades` for the bonus; `productTypes` is ignored.
**Impact:** Operators editing one field assume the others follow. Drift produces silent matching errors.
**Fix (Phase 3, on top of F2/MOP):** Eligibility and grade become facts asserted to Prio's working memory; rules reference them.
- The vendor's product capabilities (set of strings like `va_loan_certified`, `jumbo_eligible`) are asserted as facts; Prio rules say "deny if `va_loan_certified` not in vendor.capabilities".
- Grade is a separate fact (per-product); a `score_boost` rule fires when grade matches.
- Migration: walk every vendor, emit derived facts from `eligibleProductIds` ∪ `productGrades`. Delete `productTypes` and `eligibleProductIds` on the Vendor model.
- Net effect: one source of truth (vendor capabilities + grades), one mechanism (Prio rules), no drift.

### F5 — Geographic coverage represented in three places · **P1**
**Evidence:** `Vendor.serviceAreas` (legacy), `Vendor.geographicCoverage` (3-zone licensed/preferred/extended), `VendorAvailability.serviceAreas` (zips/counties/radius). Engine uses `geographicCoverage.preferred.states` for the proximity bonus and `licenseState` for the gate; the other two are inert in the matching path.
**Fix (Phase 3, on top of F2/MOP):** Coverage facts get asserted to Prio; rules consume them.
- "Vendor not licensed in property state" → Prio rule with antecedent `vendor.licensedStates not contains order.propertyState`.
- "Beyond X miles" → Prio rule on `vendor.distance > 200`.
- "Preferred state bonus" → Prio score_boost rule.
- Pick `geographicCoverage` as the canonical source on the Vendor model; the BE asserts its three zones to Prio as facts. The duplicate `serviceAreas` fields are deleted. One coverage editor on the vendor detail page.

### F6 — `VendorCapability` is a hardcoded string union · **P2**
**Evidence:** 16 capability strings are baked into both BE types and FE forms.
**Impact:** Adding `as_is_inspection_certified` (or whatever is next) requires a coordinated FE+BE deploy.
**Fix (Phase 3, on top of F2/MOP):** Prio doesn't care about a fixed enum — capabilities become free-form strings asserted as facts. Move the catalog into a `capability-catalog` Cosmos container with `{id, label, category, description}`. The FE picker reads from it; the BE asserts whatever strings the vendor record carries. New capabilities are data: add one to the catalog, write a Prio rule referencing it, no BE/FE deploy.

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

### Phase 2 — MOP/Prio integration (rev 3 rewrite — was "make rules engine the backbone") (3-4 weeks)
Stand up MOP as the rules eval backbone. Provider abstraction in the BE lets us flip via env var. Detailed plan in §12.

4. **Provider interface in the BE** ✅ (committed 2026-05-09; see §0 Progress Snapshot). `VendorMatchingRulesProvider` with `homegrown` / `mop` / `mop-with-fallback` selectable via `RULES_PROVIDER` env var.
5. **MOP-side: vendor-matching evaluator.** Register a Prio program `vendor-matching` with seed JSON rules. Add HTTP route `POST /api/v1/vendor-matching/evaluate` matching the contract in `mop.provider.ts`. Includes audit/explanation surface from Prio's working memory.
6. **Migration tooling.** One-shot script that reads `vendor-matching-rules` Cosmos documents and emits Prio JSON rule files. (Skip if no tenant has any rules — see PF2 in §10.4.)
7. **Shadow comparison + cutover.** In dev: `RULES_PROVIDER=mop-with-fallback`; capture both engine outputs side-by-side via temporary instrumentation; verify parity before promoting to staging. Then production with the breaker tuned conservatively.
8. **Retire the homegrown rules engine** after a stable observation period (defined ahead of cutover). Delete `vendor-matching-rules.service.ts`, the controller, Cosmos container, and CRUD endpoints. Rules admin moves to whatever MOP exposes (or a thin BE wrapper around MOP rule CRUD if we want to keep ours).
9. **F8** — FE rules admin: pointed at the MOP-backed CRUD (not the homegrown one). The existing `/matching-criteria` page can serve as the starting point for the UI.

Exit criteria: production traffic evaluating vendor-matching rules through MOP; homegrown rules engine retired or kept only as the fallback layer of `mop-with-fallback`.

### Phase 3 — express scoring + vendor data as MOP rules (3-4 weeks)
With MOP as the backbone, retire the hardcoded weights and the duplicate vendor fields.

10. **F3** — Move `WEIGHTS` and `DISTANCE_THRESHOLDS` into Prio JSON rules (default rule pack seeded per tenant). Engine continues to compute the 5-factor weighted sum, OR — preferable long-term — the math itself moves into Prio rules and the engine becomes a pure orchestrator.
11. **F4** — Migrate vendor product eligibility / grade to facts + Prio rules. Drop `productTypes` and `eligibleProductIds`.
12. **F5** — `geographicCoverage` becomes the sole coverage source on Vendor; the BE asserts coverage facts; Prio rules consume them. Drop the duplicate `serviceAreas` fields.
13. **F6** — Capability catalog → `capability-catalog` Cosmos container. Prio rules reference catalog IDs; new capabilities are data not deploys.
14. **F11** — Internal-staff rule pack in MOP (different scoring/exclusions than external vendors).

Exit criteria: scoring policy lives in MOP rules; one source of truth for every vendor attribute; no hardcoded enums.

### Phase 4 — close the loop and clean up endpoints (ongoing)
15. **F10** — Decline/timeout feedback. Acceptance/decline rate becomes a fact asserted to MOP for use by score-boost/reduce rules.
16. **F12** — Endpoint deprecation pass. Document a decision tree (`/suggest` vs `/find-matches` vs `/preview-rfb`), retire the duplicates, collapse the FE API slices.
17. **(new)** Rules versioning + audit log on the MOP side. (Prio likely already has this; verify and surface in the BE/FE if so.)

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

## 12. Phase 2 — Detailed Implementation Plan (MOP/Prio integration)

**Status:** 🟡 In progress · **Owner:** TBD · **Target:** F2 (consolidation onto MOP), prerequisite for F3-F6 in Phase 3

### 12.1 Goal

Make MOP the production rules-evaluation backbone for vendor matching. The BE engine sends per-vendor facts; MOP runs Prio inference; results come back with eligibility, score adjustments, and applied rule IDs. The homegrown rules service stays in place as a fallback layer until MOP is proven, then retires.

**Exit criterion:** Production tenants evaluate vendor-matching rules via MOP. The breaker stays closed under normal load. Per-vendor `MatchExplanation` records carry the MOP-side rule audit data unchanged from Phase 1's persistence pipeline.

### 12.2 Out of scope (deferred)
- Migrating `MatchingCriteriaSet` (RFB criteria) — Phase 2.5 or Phase 3.
- Moving scoring weights into Prio rules — Phase 3.
- Vendor data consolidation (F4, F5) — Phase 3.
- Capability catalog data store — Phase 3.
- Decline/timeout feedback — Phase 4.

### 12.3 Design decisions

**D1 — Provider abstraction over rule evaluation, not over rule storage.** CRUD on rules stays homegrown (Cosmos + existing controller) for now. Only evaluation goes through the provider interface. Reason: rule storage migration is independent and can happen later without disturbing eval cutover.

**D2 — Three providers ship together.** `homegrown` (default), `mop` (fail-closed), `mop-with-fallback` (recommended once MOP is live). Selected at startup via `RULES_PROVIDER`. Misconfiguration throws — no silent degrades.

**D3 — Batch eval per request.** The provider interface takes an array of contexts and returns an array of results in input order. Both implementations are naturally batch: homegrown loads rules once + loops; MOP makes one HTTP call per request regardless of vendor count.

**D4 — Circuit breaker is a sliding window.** 3 failures in 30 seconds opens; 60-second cooldown to half-open trial. Tunable via env. Open breaker skips primary entirely.

**D5 — MOP wire format is OUR contract.** We own MOP. The contract documented in `mop.provider.ts` is what MOP needs to implement, not what we accommodate. If MOP's existing endpoints don't fit, the answer is "extend MOP", not "bend the BE provider around the wrong shape."

**D6 — Migration of existing rules is data-driven.** A one-shot script reads `vendor-matching-rules` Cosmos documents per tenant and emits Prio JSON rule files. Skipped if PF2 (the prod query in §10.4) shows no tenant has rules.

**D7 — Cutover is observable, not a flag flip.** Shadow comparison runs both providers in parallel during a soak period; results compared. Promotion to MOP-primary happens only when shadow agreement is at expected levels.

### 12.4 Pre-flight checks (Phase 2)

| ID | Check | Method | Action |
|---|---|---|---|
| PF4 | Does MOP's deployment already accept arbitrary new programs / endpoints, or does it require a release pipeline? | Ask the MOP team / read MOP's deploy docs | Plan the MOP-side release accordingly |
| PF5 | Does MOP/Prio have a pre-existing vendor-matching reasoner or anything close? | Search `mortgage-origination-platform` for vendor-related rules | If yes, build on it; if no, register fresh |
| PF6 | Auth model between BE and MOP — does the existing `MopApiClient` use a token, mTLS, internal network, etc.? | Read `MopApiClient.ts` and any deploy config | Mirror in `MopVendorMatchingRulesProvider` |

### 12.5 Task breakdown

**T10 — `VendorMatchingRulesProvider` interface in BE** ✅
Done 2026-05-09. Interface, three providers (homegrown/mop/fallback), factory, 40 new unit tests, engine refactor to use the provider. See commit log on `master`.

**T11 — Add vendor-matching reasoner to MOP**
- Register a new Prio program `vendor-matching` in MOP's reasoner setup.
- Define seed JSON rules covering the 11 rule types currently in the homegrown engine (deny: license_required, state_restriction, min_performance_score, blacklist, required_capability, max_order_value, max_distance_miles, property_type_restriction; allow: whitelist; adjust: score_boost, score_reduce). Whitelist-overrides-deny semantics are native to RETE.
- Decide pattern_id naming for vendor + order facts (analogous to `loan_application` / `loan_profile` for the loan domain).

**T12 — Add HTTP route `POST /api/v1/vendor-matching/evaluate` in MOP**
- Route handler in MOP's HTTP server (likely `multi_program_server.cpp` or a new file).
- Accepts the contract format: `{tenantId, program: "vendor-matching", evaluations: [{vendor, order}, ...]}`.
- For each evaluation: clear working memory → assert vendor + order facts → run inference → collect `(eligible, scoreAdjustment, appliedRuleIds, denyReasons)` from working memory.
- Returns `{results: [...]}`.
- Health endpoint `/health` already exists.

**T13 — MOP-side tests**
- C++ unit/integration tests using GoogleTest (per CLAUDE.md default test command for C++).
- Cover each rule type at band edges, whitelist override, score adjustment accumulation. Mirrors what `vendor-matching-rules.service.test.ts` does on the BE.
- Smoke-test the HTTP route with a known good fixture.

**T14 — Migration script (BE)**
- Reads `vendor-matching-rules` Cosmos container per tenant.
- Emits a Prio JSON rule file per tenant (or one file with tenant-scoped rules).
- Idempotent + dry-run by default.
- Skip if PF2 shows no tenant has rules.

**T15 — Shadow comparison instrumentation (BE, behind a flag)**
- Temporary instrumentation: when `RULES_PROVIDER=homegrown` and `RULES_PROVIDER_SHADOW=mop` is set, fire-and-forget a duplicate eval to MOP for each request, log diffs.
- Used in dev/staging soak only; removed before retiring homegrown.

**T16 — Cutover sequence**
1. Dev: `RULES_PROVIDER_SHADOW=mop` for soak; resolve any diffs.
2. Staging: `RULES_PROVIDER=mop-with-fallback` (MOP primary, homegrown fallback).
3. Production: same. Watch breaker metrics.
4. After N days of zero unexpected breaker trips: announce homegrown retirement window.

**T17 — Retire homegrown rules engine**
- Delete `vendor-matching-rules.service.ts`.
- Delete `vendor-matching-rules.controller.ts` (or repoint at MOP).
- Drop the `vendor-matching-rules` Cosmos container.
- Delete the homegrown provider; factory simplifies to `mop` only.
- (Optional) Repoint FE `/matching-criteria` page at the MOP-backed rules surface.

**T18 — Update Progress Snapshot in this doc**
- Mark Phase 2 complete; F2 → ✅; F8 → ✅ if FE work landed.

### 12.6 Test plan summary

| Suite | Coverage |
|---|---|
| `tests/unit/vendor-matching-rules/*.test.ts` | Provider interface (40 tests, ✅ landed) |
| `tests/auto-assignment-orchestrator.test.ts` | Existing E2E continues to pass with provider injected |
| MOP-side GoogleTest (T13) | Vendor-matching rule evaluation in Prio + HTTP route smoke |
| Shadow soak (T15) | Statistical agreement between homegrown and MOP eval over real traffic |

### 12.7 Risk register (Phase 2)

| ID | Risk | Mitigation |
|---|---|---|
| R6 | MOP HTTP latency under load is much higher than in-process homegrown | Tune `MOP_RULES_TIMEOUT_MS`; measure; consider co-locating MOP or caching idempotent evals |
| R7 | Subtle semantic differences between homegrown switch-based eval and Prio RETE (esp. priority interactions, allow/deny precedence) | Shadow comparison (T15) catches these before cutover |
| R8 | MOP becomes a single point of failure for the assignment pipeline | `mop-with-fallback` provider chain + breaker; homegrown stays available until retired |
| R9 | Migration script (T14) misencodes a rule, silently changing tenant behavior | Dry-run output reviewed before apply; rules version-controlled in Prio JSON; rollback = re-point provider to homegrown |

### 12.8 Definition of done

- [ ] T10 ✅
- [ ] PF4, PF5, PF6 results recorded
- [ ] T11 + T12 + T13 merged in MOP repo, tests green
- [ ] T14 dry-run output reviewed and applied
- [ ] T15 shadow soak shows expected agreement in dev + staging
- [ ] Production running on `RULES_PROVIDER=mop-with-fallback` for ≥ N days with no unexpected breaker trips
- [ ] T17 retirement of homegrown done OR formally deferred
- [ ] §0 Progress Snapshot updated (T18)
- [ ] PR descriptions reference findings F2 (and F8 if FE landed) by ID

---

## 13. End-state vision & Phase 3-8 plan

**Goal (verbatim from product):** "fully automatic rules-based system for assignment with FULL UI/UX visibility and observability and CRUD for rules as well as their assignment and execution — we need to be able to see and do EVERYTHING with these rules."

This section breaks that goal into a concrete, executable plan from where we are today (Phase 2 complete in dev) to the end state.

### 13.1 Current state (post-Phase 2 in dev, 2026-05-09)

**Working end-to-end in dev:**
- MOP `ca-mop-dev` serves `POST /api/v1/vendor-matching/evaluate` via Prio's RETE engine. Returns `{eligible, scoreAdjustment, appliedRuleIds, denyReasons}` per vendor in input order.
- AMS `MopVendorMatchingRulesProvider` calls MOP with `X-Service-Auth`. Circuit-breaker + homegrown fallback in place.
- `RULES_PROVIDER=mop-with-fallback` set on `ca-appraisalapi-dev-7iqx`. Engine routes through MOP for every assignment.
- Per-vendor `MatchExplanation` (score components, applied rule IDs, deny reasons) persisted on the order document. AMS FE renders score breakdown + denied vendor list.
- CI: post-deploy smoke tests probe `/health`, `/api/v1/quote` regression, and `/api/v1/vendor-matching/evaluate` shape on every MOP deploy. C++ schema validator catches malformed rule files at build time AND server startup. Wire-contract fixture asserts both sides of the BE↔MOP shape.

**Constraints today:**
- Rules live as a single `config/rules/vendor-matching.json` file baked into the MOP image. Editing a rule requires a code commit + image rebuild + container redeploy. No live reload, no per-tenant rules, no admin UI.
- No way for an operator to see "what rules fire for this order" — the data is in the persisted `MatchExplanation` but no FE surface exposes it directly (the existing `AutoAssignmentStatusPanel` shows score breakdown + denial reasons but doesn't link back to rule definitions).
- No analytics on rule effectiveness (how often does each rule fire? what's its average impact on assignments?).
- No replay / what-if (can't simulate "if I added this rule yesterday, how would last week's assignments have changed").
- No tenant-level isolation of rules (one global rule pack).
- No audit trail of who edited which rule.
- Production traffic still on `RULES_PROVIDER=homegrown` (only dev is on `mop-with-fallback`).

**The remaining gap:** everything between "MOP works in dev" and "operators can see + do EVERYTHING with rules" is what Phases 3-8 deliver.

### 13.2 End-state surfaces (the user-visible deliverables)

1. **Rules workspace** — full CRUD with visual condition builder, validation, preview, diff, audit log, version history.
2. **Rule assignment** — bind rule packs to tenants, products, geographies, time windows. Roll a rule out to one tenant, observe, expand.
3. **Per-order trace** — for any assignment (live or historical): the inputs (order facts), the candidates (each vendor's facts), the evaluation (which rules fired, in priority order, with their effect), the outcome (final ranking + chosen vendor), and the latency.
4. **Live evaluation feed** — real-time stream of assignments being made; click any to drill into the trace.
5. **Sandbox** — clone a tenant's rule pack, edit freely, evaluate against historical orders OR synthetic ones, see the diff in outcomes.
6. **Replay** — pick a past assignment, re-evaluate with current (or proposed) rules, show how it would change.
7. **Rule analytics** — per-rule fire count, average score impact, denial contribution, and outcome influence (did this rule change which vendor got picked?).
8. **Operations dashboard** — MOP throughput, P50/P95/P99 latency, breaker state, fallback rate, error budget burn. Per-tenant slice.
9. **Alerts** — breaker open >Xs, fallback rate >Y%, MOP error rate >Z%, rule-fire-rate anomaly.
10. **Tenant-level kill switch** — turn rules engine off for a tenant if it misbehaves; falls back to legacy assignment behavior.

### 13.3 Architecture additions to support the end state

| Concern | Today | End state | Phase |
|---|---|---|---|
| Rule storage | Single JSON file in MOP image | Per-tenant collections in MOP-fronted Cosmos (or sentinel KV-backed); versioned with immutable rule packs | 3 |
| Rule loading | Read at startup, never reread | Watch for changes; hot-reload reasoners; A/B between versions | 3 |
| Rule eval audit | `MatchExplanation` per assignment in AMS Cosmos | Full evaluation trace persisted in a dedicated `assignment-traces` container with rule-version stamping | 5 |
| Rule CRUD API | None on MOP; AMS has a homegrown CRUD | MOP exposes `POST/GET/PUT/DELETE /api/v1/vendor-matching/rules` (per-tenant); AMS proxies for FE | 3 |
| FE rule UI | None | Full workspace under `/auto-assignment/rules` (laid out in §11.4) | 4 |
| FE order trace | Score breakdown + denied list | Full evaluation trace with rule chain visualization, latency, candidate diff | 5 |
| Real-time visibility | Logs only | WebSocket-driven feed in FE; backed by Service Bus topic `assignment.evaluation.completed` | 5 |
| Sandbox / what-if | None | Standalone evaluation endpoint that takes `{tenantId, ruleOverrides[], order, vendorPool}` and returns the trace without persisting | 6 |
| Analytics | Logs only | Persisted aggregates in Cosmos: per-rule-version fire count, avg adjustment, hit rate; dashboards in FE | 5/7 |
| Operations dashboards | None | Live in FE; backed by Application Insights metrics | 7 |
| Tenant kill switch | `RULES_PROVIDER` env var (process-wide) | Per-tenant in App Configuration; AMS reads the tenant's flag at request time | 7 |

### 13.4 Phase 3 — Rules CRUD + Live Reload (MOP foundation for everything FE-side)

**Status:** ⬜ Not started · **Target:** unblocks Phase 4 (rules UI) and Phase 5 (per-order trace).

**Goal:** Rules become data, not deploys. MOP exposes a CRUD API; vendors can be added/removed/edited at runtime; reasoners hot-reload on change; every change is versioned and audited.

#### 13.4.1 Design decisions (locked up front)

- **D1.** Per-tenant rule storage. Default rule pack still ships in `config/rules/vendor-matching.json` (seeds new tenants); each tenant's edits live in MOP-backed Cosmos under `vendor-matching-rules` partitioned by `/tenantId`. Schema is the same JSON shape the file uses today.
- **D2.** Immutable rule packs. Editing a rule creates a new version; the previous version stays around for replay. A `vendor-matching-rule-pack` document with `{tenantId, packId, version, createdAt, createdBy, parentVersion}` is the unit of versioning.
- **D3.** Hot reload via Cosmos change feed. MOP's `VendorMatchingHost` subscribes to the `vendor-matching-rules` change feed; on a rule pack version bump, it loads the new pack into a fresh `Reasoner` and atomically swaps the active reference. Old reasoner reaches end-of-life when in-flight evaluations complete.
- **D4.** Tenant resolution comes from the request body's `tenantId` (already in the wire contract). MOP holds one reasoner per tenant; defaults to the seed pack if no tenant rules exist.
- **D5.** API on MOP, mirror on AMS. The authoritative CRUD is `POST/GET/PUT/DELETE /api/v1/vendor-matching/rules` on MOP, gated by `X-Service-Auth`. AMS exposes a thin proxy at `/api/auto-assignment/rules` so the FE can call AMS auth and AMS forwards to MOP — keeps Aegis policy enforcement at one layer.
- **D6.** Audit trail in MOP Cosmos: every CRUD writes to `vendor-matching-rule-audit` with `{tenantId, packId, oldVersion, newVersion, diff, actor, timestamp}`. Append-only, never mutated.

#### 13.4.2 Tasks

| # | Task | Repo | Touch points |
|---|---|---|---|
| T19 | Rule pack data model + Cosmos container | MOP | `src/vendor_matching/RulePackStore.{cpp,hpp}`; `infrastructure/main.bicep` (container) |
| T20 | Per-tenant `Reasoner` registry inside `VendorMatchingHost` | MOP | `VendorMatchingHost`, `VendorMatchingService` (constructor takes a single rule pack, not a path) |
| T21 | CRUD endpoints `/api/v1/vendor-matching/rules` (list, get, create-version, deactivate) | MOP | `VendorMatchingRoutes.cpp` |
| T22 | Cosmos change-feed listener; atomic reasoner swap on version bump | MOP | New `RulePackChangeFeedListener`; integrates with `VendorMatchingHost` |
| T23 | Audit-log writes on every CRUD; `vendor-matching-rule-audit` container | MOP | `RulePackStore` |
| T24 | AMS proxy endpoints `/api/auto-assignment/rules/*` → MOP | AMS | New `vendor-matching-rules-proxy.controller.ts` |
| T25 | Update `MopVendorMatchingRulesProvider.evaluateForVendors` to send `tenantId` so MOP routes to the right per-tenant reasoner | AMS | `mop.provider.ts` (already sends it; verify wire contract still holds) |
| T26 | Catch2 tests: per-tenant isolation, hot-reload, version rollback, audit-trail correctness | MOP | `tests/unit/test_vendor_matching_rules_crud.cpp` |
| T27 | Vitest tests: AMS proxy parity (request/response equality with direct MOP) | AMS | New `tests/integration/rules-crud-proxy.test.ts` |
| T28 | Migration: read existing seed `vendor-matching.json`, write per-tenant copies for any tenant currently using it (initially: zero tenants) | MOP | One-shot script in `scripts/seed-tenant-rules.cpp` |
| T29 | Runbook update: how to author + ship a rule via API instead of file edit | MOP | `docs/VENDOR_MATCHING_INTEGRATION.md` |

**Definition of done:**
- An operator can `POST /api/v1/vendor-matching/rules` with a new rule, see it return version 2, and have the next `POST /api/v1/vendor-matching/evaluate` for that tenant fire the new rule — no restart, no deploy.
- Multiple tenants run distinct rule packs; an evaluation for tenant A is not affected by tenant B's rules.
- The audit log records the change with diff and actor.

### 13.5 Phase 4 — Rules Authoring Workspace (FE)

**Goal:** the operator UI laid out in §11.4 — rule list, drag-to-reorder priority, visual condition builder with live validation, sandbox preview before save, diff view for changes.

**Tasks (high level — full FE plan per §11.4):**
| T30 | RTK Query slice for the AMS proxy endpoints | AMS-FE | `src/store/api/vendorMatchingRulesApi.ts` |
| T31 | `/auto-assignment/rules` page — list view with drag-to-reorder priority + status toggle | AMS-FE | New page + `RulesList` component |
| T32 | Rule builder dialog — condition builder, action selector, scope filters; uses the C++ schema validator's error format for inline feedback | AMS-FE | `RuleBuilder`, `ConditionRow` (already exists) |
| T33 | Live preview pane — calls a new MOP endpoint `POST /api/v1/vendor-matching/preview` that runs an unsaved rule against fixture vendors | AMS-FE + MOP | `RulePreviewPanel` + MOP route |
| T34 | Sandbox — pick a recent order, eval with proposed rule, show Δ vs current | AMS-FE + AMS-BE | `RuleSandbox` + AMS endpoint that loads a historical order's facts and forwards to `/preview` |
| T35 | Diff view + version history per rule — reads from `vendor-matching-rule-audit` via AMS proxy | AMS-FE | `RuleHistoryDrawer` |
| T36 | E2E tests covering create → preview → save → see in eval | AMS-FE | Playwright or vitest+RTL |

**DoD:** an operator can author a new rule end-to-end in the FE — no curl, no JSON editing — and watch their tenant's next assignment honor it.

### 13.6 Phase 5 — Per-Order Trace + Live Feed

**Goal:** for any assignment, see the full evaluation; for any moment, see assignments happening live.

**Tasks:**
| T37 | Persist full evaluation trace per assignment in `assignment-traces` Cosmos container — every candidate vendor, every rule that fired with its effect, scoring breakdown, latency, rule-pack version, model version | AMS-BE | `auto-assignment-orchestrator.service.ts`; new `AssignmentTraceRecorder` |
| T38 | `GET /api/auto-assignment/traces/:orderId` — returns the full trace; FE renders it | AMS-BE + AMS-FE | New controller + page |
| T39 | Order-detail page enhancement: "Why this vendor" expandable section on the assignment panel showing the chained-rule trace, rule definitions, vendor facts that mattered | AMS-FE | Extends `AutoAssignmentStatusPanel`; new `EvaluationTraceTimeline` component |
| T40 | Service Bus topic `assignment.evaluation.completed` published by orchestrator after each evaluation | AMS-BE | `orchestrator.service.ts` |
| T41 | WebSocket from FE to AMS BE relaying that topic; FE renders a live feed page | AMS-FE + AMS-BE | New `/auto-assignment/live` page; uses existing collaboration WebSocket infra |
| T42 | Per-rule analytics: aggregate fire counts + impact persisted by a daily job | AMS-BE | New `vendor-matching-analytics.job.ts` |
| T43 | Analytics page in FE — per-rule fire rate, average score impact, change in assignment outcome attribution | AMS-FE | New page under `/auto-assignment/analytics` |

**DoD:** for any order assigned in the last 90 days, the FE shows the full per-vendor evaluation in <1s. The live feed updates within 2s of an assignment occurring.

### 13.7 Phase 6 — Sandbox + Replay

**Goal:** safe experimentation. Edit rules without affecting production; rerun history with proposed rules.

**Tasks:**
| T44 | MOP `/preview` endpoint — accepts unsaved rule pack + facts, returns trace, persists nothing | MOP | `VendorMatchingRoutes.cpp` |
| T45 | AMS `/api/auto-assignment/replay/:orderId` — reads original order facts + vendor pool snapshot, calls MOP `/preview` with proposed rule pack, returns side-by-side trace | AMS-BE | New controller |
| T46 | AMS `/api/auto-assignment/backtest` — runs a proposed rule pack against the last N days of historical orders; aggregates outcome diff (which orders would have gone to a different vendor, average score swing per outcome class) | AMS-BE | New controller; uses `assignment-traces` from Phase 5 |
| T47 | FE sandbox surface (per §11.5) — weight sliders + rule-pack editor + backtest result table | AMS-FE | `/auto-assignment/sandbox` page |
| T48 | Replay surface on order detail — "what if I changed rule X today" button on any past order | AMS-FE | Extends `AutoAssignmentStatusPanel` |

**DoD:** an operator can take last week's order #ABC, propose a new rule, and within 3s see "with this rule, vendor X would have gotten the order instead of vendor Y, with these score deltas." Backtest against 30 days of orders runs in <2 minutes.

### 13.8 Phase 7 — Operations + Tenant Controls

**Goal:** prod-grade observability and per-tenant safety.

**Tasks:**
| T49 | App Insights custom metrics for MOP eval (latency, fallback rate, breaker state, per-tenant request rate) | AMS-BE | Wire `MopVendorMatchingRulesProvider`'s structured logs to App Insights metric channel |
| T50 | FE operations dashboard `/auto-assignment/dashboard` — KPI strip + recent decisions feed + breaker state + per-tenant slice | AMS-FE | New page (per §11.7) |
| T51 | Per-tenant `RULES_PROVIDER` setting in App Configuration (`tenants.<tid>.rules-provider = mop-with-fallback | mop | homegrown`); AMS reads at request time | AMS-BE | Extend `tenant-automation-config.service.ts`; per-request override in factory |
| T52 | Alerts: Application Insights alert rules for breaker open >5min, fallback rate >5%, MOP P95 >2s, rule-fire anomaly | infra (Bicep) | New module |
| T53 | Per-tenant kill switch on the FE dashboard — operator can flip a tenant to `homegrown` mid-incident with one click; logged + audited | AMS-FE + AMS-BE | New control + audit-log entry |

**DoD:** a single dashboard shows MOP health for every tenant; an oncall can flip a misbehaving tenant to fallback in <10s.

### 13.9 Phase 8 — Production Cutover + Retire Homegrown

**Goal:** prod traffic on MOP; homegrown rules engine deleted.

**Tasks:**
| T54 | Promote: `RULES_PROVIDER=mop-with-fallback` in staging; soak period with shadow comparison (Phase 2 §12.5 T15) | AMS infra |
| T55 | Promote to prod; observe breaker stability for N days |
| T56 | Migrate any in-Cosmos `vendor-matching-rules` documents (homegrown CRUD format) into MOP rule packs (Phase 3 storage) |
| T57 | Delete `vendor-matching-rules.service.ts` + controller + Cosmos container + homegrown provider; factory simplifies to MOP-only |
| T58 | Update review doc: archive Phases 1-2 details; mark migration complete |

**DoD:** zero references to `VendorMatchingRulesService` in the AMS codebase; production traffic 100% on MOP; old Cosmos container empty and removed.

### 13.10 Sequencing rationale

```
Phase 3 (rules CRUD + live reload)
   │  unblocks
   ├──► Phase 4 (rule authoring UI) ──┐
   │                                  │
   ├──► Phase 5 (trace + live feed) ──┤
   │                                  │  feeds into
   ├──► Phase 6 (sandbox + replay) ──┤
   │                                  │
   └──► Phase 7 (ops dashboard) ──────┘
                                      │
                                      ▼
                                  Phase 8 (prod cutover + retire homegrown)
```

Phases 4-7 can run in parallel after Phase 3 lands. The narrowest critical path is Phase 3 → Phase 8 (everything else is FE/observability that adds value without gating).

### 13.11 Estimated effort (calibration, not commitments)

| Phase | BE | FE | Infra | Total |
|---|---|---|---|---|
| 3 — Rules CRUD + live reload (MOP) | 1.5w | — | 1d | ~2w |
| 4 — Rules workspace (FE) | 0.5w | 2-3w | — | ~3w |
| 5 — Trace + live feed | 1w | 1.5w | — | ~2.5w |
| 6 — Sandbox + replay | 1w | 1w | — | ~2w |
| 7 — Ops + tenant controls | 0.5w | 1w | 0.5w | ~2w |
| 8 — Prod cutover | 0.5w | — | 1w obs | ~1.5w |

Total: ~12-13 weeks of dev work, 8-10 weeks calendar with two engineers in parallel.

### 13.12 What I recommend tackling next

**Phase 3.** It's the foundation for everything visible: there's nothing meaningful for the FE to CRUD until MOP exposes a CRUD API and supports per-tenant rules + hot-reload. The C++ work is well-scoped (extend `VendorMatchingHost`, add a Cosmos store, plumb a change-feed listener). After Phase 3 lands, Phases 4-7 can run truly in parallel.

The alternative — start FE work first against the homegrown rules engine — would create throwaway code, since the homegrown engine retires in Phase 8. Better to build the FE once against the right backend.

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
