# Decision Engine Rules Surface — Implementation Guide

**Created:** 2026-05-10
**Last updated:** 2026-05-10
**Scope:** Generalize the vendor-matching rules workspace shipped in `AUTO_ASSIGNMENT_REVIEW.md` Phases 1–5 into a universal Decision Engine Rules Surface that handles every rules-driven process in the platform: vendor matching, review programs, firing rules, Axiom Criteria, and any future decision surface. Same CRUD / version / audit / preview / sandbox / replay / analytics machinery, pluggable per category.

**Why now:** The vendor-matching slice proved the architecture end-to-end (live in dev, operators can author + publish + see traces). Rather than build the same machinery N times for the N other rule-driven systems, generalize once and treat every decision system as a "category" plugged into the surface.

**Sibling doc:** `AUTO_ASSIGNMENT_REVIEW.md` — vendor-matching specific review + Phases 1-5 status. This doc continues the story for everything else.

**Revisions:**
- 2026-05-10 (rev 1) — Initial draft after Phase 5 MVP shipped (per-tenant rule packs + workspace + traces). Lays out Phases A through H to evolve from "vendor-matching workspace" to "universal rules surface".
- 2026-05-10 (rev 2) — Phase A complete. Generalized types/service/controller/containers landed, vendor-matching shimmed to use the new generic, legacy `/api/auto-assignment/rules` 308-redirects to `/api/decision-engine/rules/vendor-matching`, migration script applied to dev + staging.
- 2026-05-10 (rev 3) — Phase B complete. `CategoryDefinition` interface + `CategoryRegistry` + `VendorMatchingCategory` shipped. Controller dispatches into the registry instead of hard-wired `MopRulePackPusher`. `wireRegistryHooks` registers per-category `push` as `onNewActivePack` callbacks. Categories that omit optional methods (push/preview/seed/drop/replay) cleanly surface 501 from the controller. 13 new tests; vendor-matching round-trip behavior unchanged.
- 2026-05-10 (rev 4) — Phase C MVP shipped (visible front). New nav group "Decision Engine"; routes `/decision-engine/rules/:category` + `/decision-engine/decisions/:category`; per-category chrome (breadcrumb, dropdown, status chip). Live category renders the existing vendor-matching workspace; planned categories (Review Programs / Firing Rules / Axiom Criteria) show a "coming in Phase F/G/H" placeholder body — they no longer fall through to the vendor-matching workspace. Phase C polish (factor variable/action catalogs into per-category props) still pending.
- 2026-05-10 (rev 5) — Phase C polish complete. Frontend `categoryDefinitions.ts` registry + `CategoryProvider` context (`useDecisionCategory()` hook). `RuleConditionBuilder` reads variable catalog from context (groups preserved); `RulePackVisualEditor` reads action catalog and `defaultRule()` from context (action data fields are catalog-driven, no more hardcoded fact_id switch); `RulePackPreviewPanel` reads default sample evaluations from context. Components fall back to vendor-matching when no provider is present, so the legacy `/auto-assignment/rules` page still works unchanged. Adding a new live category now only needs (1) a BE `CategoryDefinition` registration and (2) an FE `FrontendCategoryDefinition` entry — no component edits.
- 2026-05-10 (rev 6) — Phase D MVP complete. `VendorMatchingReplayService` reads recent `assignment-traces` for a tenant, fetches current vendor data, calls MOP `/preview` with the proposed rules, and returns a per-decision diff (changed / unchanged / skipped + new denials / new acceptances counts). `CategoryDefinition.replay` interface; vendor-matching wires it. New endpoint `POST /api/decision-engine/rules/:category/replay`. New "Sandbox" tab in the workspace with the visual editor + replay form (sinceDays 1-30, samplePercent 1-100) + diff table with expandable per-decision details. 7 new tests; replay uses *current* vendor data (operators see the caveat in the UI).

---

## 0. Progress Snapshot

This section is the **live tracker** — update statuses, add commit/PR refs, and date each transition as work progresses.

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Paused · 🚫 Won't do

| Phase | Goal | Status | Started | Completed | Notes / PRs |
|---|---|---|---|---|---|
| A | **Generalize storage + CRUD + audit** — single `decision-rule-packs` container with `category` field; generic service/controller; backward-compat aliases for `/api/auto-assignment/rules` | ✅ | 2026-05-10 | 2026-05-10 | Types/service/controller/Bicep/migration/redirect/tests all landed. Foundation in place — Phase B + C unblocked. |
| B | **Category plugin pattern (BE)** — `CategoryDefinition` interface + registry; vendor-matching reimplemented as the first category to validate the pattern | ✅ | 2026-05-10 | 2026-05-10 | `CategoryDefinition` + `CategoryRegistry` + `VendorMatchingCategory` shipped; controller dispatches into registry; `wireRegistryHooks` registers per-category push hooks; 13 new tests. Adding a new category is now a `registry.register(...)` call. |
| C | **FE: category-aware workspace** — `/decision-engine/rules/:category`; category selector; component plugin pattern; `/auto-assignment/rules` redirects | ✅ | 2026-05-10 | 2026-05-10 | MVP + polish complete. `categoryDefinitions.ts` + `CategoryProvider` context; `RuleConditionBuilder` / `RulePackVisualEditor` / `RulePackPreviewPanel` all read catalogs from context with vendor-matching fallback. Adding a live category is now a BE `CategoryDefinition` + FE `FrontendCategoryDefinition` entry — no component edits. |
| D | **Sandbox + Replay** (was Phase 6 of `AUTO_ASSIGNMENT_REVIEW.md`) — pick a past order, propose rule changes, see the assignment diff. Generic across categories. | 🟡 | 2026-05-10 | — | **MVP shipped:** `VendorMatchingReplayService` + `replay` on `CategoryDefinition` + `POST /:category/replay` + Sandbox tab with diff table. **Pending follow-ups:** trace fact-snapshot field for faithful (vs current-data) replay; "Replay this order" button on order-detail; React Flow diff visualisation. |
| E | **Per-rule analytics + dashboards** (was Phase 7 of the review) — fire counts, average impact, dead-rule detection, fire-rate over time. Cross-category. | ⬜ | — | — | Backed by `assignment-traces` (and equivalents per category). |
| F | **Add Review Program rules as second category** | ⬜ | — | — | Validates the plugin pattern against a non-vendor-matching surface. |
| G | **Add Firing Rules as third category** | ⬜ | — | — | Vendor performance / decline rate / SLA driven. |
| H | **Add Axiom Criteria as fourth category** | ⬜ | — | — | Different evaluator (LLM, not RETE) — proves the surface generalizes beyond MOP/Prio. |
| I | **Cross-cutting: live feed + trace flow viz + ops dashboard** (was Phases 5/7 of the review) — WebSocket evaluation stream, React Flow trace visualization on order detail, per-tenant kill switch UI. | ⬜ | — | — | Polish + ops; depends on A-H. |

---

## 1. Vision

A single operator surface where every rules-driven decision in the platform is visible, editable, testable, replayable, and observable. One mental model, one CRUD pattern, one audit log shape, one preview/sandbox/replay flow, regardless of whether the rules drive vendor selection, review program assignment, vendor firing, or Axiom criteria evaluation.

**The user-visible deliverable:** an operator opens **Decision Engine → Rules** in the nav, picks a category from a dropdown ("Vendor Matching", "Review Programs", "Firing Rules", "Axiom Criteria", …), and sees the same workspace they already know from vendor matching today — Active / History / Audit / Runs tabs, JSON + visual editor, live preview, sandbox replay — wired to the appropriate evaluator and fact catalog for that category.

**Why this beats N separate workspaces:**
- Operators learn one tool, not N.
- A new rules-driven feature ships its UI by registering a `CategoryDefinition` instead of building a workspace.
- Audit, history, version, replay, and analytics are written once and inherited by every category.
- Cross-category analytics become possible (e.g., "show me all rules I edited last week across every category").

---

## 2. Current state (post-Phase 5 MVP of `AUTO_ASSIGNMENT_REVIEW.md`)

**What's already shipped end-to-end for vendor matching:**

- AMS-side immutable versioned rule packs in Cosmos (`vendor-matching-rule-packs`).
- Append-only audit log (`vendor-matching-rule-audit`).
- Per-assignment evaluation traces (`assignment-traces`).
- BE CRUD: `POST/GET/DELETE /api/auto-assignment/rules` + `/seed`, `/seed-from-default`, `/preview`, `/:packId/versions`, `/:packId/audit`.
- BE push to MOP via `MopRulePackPusher` on every successful create; per-tenant `TenantReasonerRegistry` in MOP swaps reasoners atomically.
- Schema validation parity (C++ in MOP + TS in AMS service + TS in FE editor — all surface the same error format).
- FE workspace at `/auto-assignment/rules`: Active / History / Audit / Runs tabs.
- FE components: `RulePackJsonEditor`, `RulePackVisualEditor`, `RuleConditionBuilder`, `RulePackPreviewPanel`, `RulePackVersionsTable`, `RulePackAuditList`, `RecentAssignmentRunsList`, `AssignmentTraceTimeline`.
- One-click "Seed v1 from default" + "Customize first" flows.
- Live preview against sample vendors (MOP `/preview` endpoint, stateless).
- Per-order trace timeline on the order-detail page.
- Recent decisions browse at `/auto-assignment/decisions`.

**Gaps that this plan fills (besides the new categories themselves):**

- Storage + CRUD + types are vendor-matching-specific by name. Need to generalize before adding a second category.
- The visual condition builder's variable catalog (`vendor.*`, `order.*`) is hardcoded. Needs a plugin.
- The preview pane's sample evaluation fixtures are hardcoded vendor/order pairs. Needs a plugin.
- The push hook calls MOP. Other categories may use other evaluators. Needs a plugin.
- No sandbox/replay against historical decisions yet (Phase D / was Phase 6 of the review).
- No analytics across rules (Phase E / was Phase 7 of the review).

---

## 3. Target architecture

### 3.1 The category abstraction

Every decision system the surface manages is a **category**. A category bundles:

```typescript
// Conceptual — exact shape evolves in Phase B.
interface CategoryDefinition {
  /** Stable id used in URLs, Cosmos docs, audit rows. e.g. 'vendor-matching'. */
  id: string;
  /** Human-readable label for the category dropdown + page header. */
  label: string;
  /** Short helper text shown under the category header. */
  description: string;
  /** Icon name (heroicons-outline:*) for nav and selectors. */
  icon: string;

  /**
   * Validation: catches malformed rule definitions before they're persisted.
   * Mirrors the C++ validateRulesJson in MOP for vendor-matching today.
   * Each category supplies its own validator with its own error messages.
   */
  validateRules(rules: unknown[]): { errors: string[]; warnings: string[] };

  /**
   * Push-on-write: AMS calls this whenever a new active pack version lands.
   * Vendor-matching pushes to MOP; Review Programs may push to a different
   * service or write to App Configuration; Firing Rules may stay in-process.
   * Best-effort by contract — failures don't roll back the AMS storage write.
   */
  push(pack: RulePackDocument): Promise<void>;

  /**
   * Stateless preview: evaluate proposed rules against sample facts.
   * For vendor-matching this proxies to MOP /preview; for other categories
   * it's whatever the evaluator's preview surface is.
   */
  preview(input: { rules: RuleDef[]; samples: unknown[] }): Promise<PreviewResult[]>;

  /**
   * Replay: re-evaluate historical decisions with proposed rules and return
   * a diff. Each category supplies its own historical-decision source
   * (assignment-traces for vendor-matching, review-decisions for review
   * programs, etc).
   */
  replay(input: { rules: RuleDef[]; sinceDays?: number; ids?: string[] }): Promise<ReplayDiff>;
}
```

The BE keeps a registry: `categoryRegistry.register('vendor-matching', vendorMatchingCategory)`, etc. The generic CRUD controller dispatches to the registered category at request time.

### 3.2 Generalized storage

Single Cosmos container `decision-rule-packs` (replaces `vendor-matching-rule-packs`), with `category` and `tenantId` as the partition key path components. Synthetic id pattern:

```
${tenantId}__${category}__${packId}__v${version}
```

Same indexing + uniqueness story as today, just with `category` as a first-class column. Every existing query in the service gets `AND c.category = @category` added.

Audit container similarly: `decision-rule-audit` with `category` field.

Trace storage stays per-category for now (`assignment-traces` keeps its name and shape; review programs would have `review-decisions`, etc.) — each category's traces have category-specific fields that don't generalize cleanly. The cross-cutting analytics surface in Phase E reads all of them.

### 3.3 Generic AMS service

`DecisionRulePackService` (replaces `VendorMatchingRulePackService`) has the same CRUD surface as today but takes `category` as an explicit parameter on every call:

```typescript
service.createVersion({ category: 'vendor-matching', tenantId, packId, rules, ... })
service.getActive(category, tenantId, packId)
service.listVersions(category, tenantId, packId)
service.listAudit(category, tenantId, packId)
```

The `onNewActivePack` hook pulls the category from the pack and dispatches to `categoryRegistry.get(pack.category).push(pack)`.

### 3.4 Generic AMS controller

Single controller mounted at `/api/decision-engine/rules/:category` handles all the existing routes:

```
POST   /api/decision-engine/rules/:category                   create new version
GET    /api/decision-engine/rules/:category/seed              read upstream seed (per category)
POST   /api/decision-engine/rules/:category/seed-from-default fork seed as v1
POST   /api/decision-engine/rules/:category/preview           stateless preview
POST   /api/decision-engine/rules/:category/replay            historical replay (Phase D)
GET    /api/decision-engine/rules/:category/:packId           active version
GET    /api/decision-engine/rules/:category/:packId/versions  all versions
GET    /api/decision-engine/rules/:category/:packId/versions/:v  specific version
GET    /api/decision-engine/rules/:category/:packId/audit     audit log
DELETE /api/decision-engine/rules/:category/:packId           drop tenant pack
```

`/api/auto-assignment/rules/*` stays as a deprecated alias that hard-redirects to `/api/decision-engine/rules/vendor-matching/*` — keeps existing FE / curl scripts working through the migration.

### 3.5 Generic FE workspace

Page at `/decision-engine/rules/:category`. The existing components stay, but:

- A `CategorySelector` component reads the registry and renders the dropdown.
- The visual condition builder's variable catalog comes from a `useCategoryFactCatalog(category)` hook.
- The preview pane's sample fixtures come from the registered category.
- The action picker (`vendor_denied` / `vendor_score_adjustment` / `vendor_whitelist_override` for vendor-matching) comes from the registered category's action catalog.
- The header copy + status chip wording come from the category definition.

`/auto-assignment/rules` remains as a thin redirect to `/decision-engine/rules/vendor-matching` so existing nav + bookmarks keep working.

### 3.6 Backward compatibility

All breaking changes ship behind aliases. Concretely:

| Old | New | Compat |
|---|---|---|
| Cosmos container `vendor-matching-rule-packs` | `decision-rule-packs` (new) | One-shot data migration script copies docs, then old container kept read-only for 1 release before drop. |
| Cosmos container `vendor-matching-rule-audit` | `decision-rule-audit` | Same. |
| API `/api/auto-assignment/rules/*` | `/api/decision-engine/rules/vendor-matching/*` | Old route 308-redirects to new. |
| FE route `/auto-assignment/rules` | `/decision-engine/rules/vendor-matching` | Old route renders a redirect component. |
| FE `vendorMatchingRulePacksApi` slice | `decisionEngineRulesApi` slice | Old slice re-exports from new for one release. |

---

## 4. Category catalog

Each category section captures: identity, evaluator architecture, fact catalog, action catalog, example rules, sample fixtures for preview, sources of historical decisions for replay, and any open questions.

### 4.1 Vendor Matching (already shipped)

- **id:** `vendor-matching`
- **Evaluator:** MOP (Prio RETE engine), per-tenant reasoner cache, push via `MopRulePackPusher`.
- **Facts:** vendor (id, capabilities, states, performance score, license type, distance), order (productType, propertyState, orderValueUsd).
- **Actions:** `vendor_denied` (with `reason`), `vendor_score_adjustment` (with `points`), `vendor_whitelist_override`.
- **Decision source for replay:** `assignment-traces` Cosmos container.
- **Status:** complete. Phase A migrates it to live under the generalized surface; behavior unchanged.

### 4.2 Review Programs

- **id:** `review-program`
- **Purpose:** Determine which review program a submitted appraisal report routes to (e.g., desk review vs field review vs full-scope).
- **Evaluator candidates:**
  - **Option 1 — MOP/Prio with a `review-program` reasoner.** Reuses the architecture; needs a new program registered + new fact pattern.
  - **Option 2 — In-process AMS evaluation.** Faster to ship; loses cross-service consistency.
  - **Recommendation:** Option 1. Same plumbing, separate program id.
- **Facts to surface:** report fields (loanType, propertyType, loanAmount, ARV, complexity score), appraiser context (tier, recent revisions, certifications), order context (clientId, urgency).
- **Actions:** `route_to_program` (with `programId`), `escalate_to_human` (with `reason`), `score_adjustment` (for tie-breaking when multiple programs match).
- **Decision source for replay:** new `review-program-decisions` container OR use existing review records in Cosmos. Phase F decides.
- **Open questions:** does the existing review program selector logic exist already? If so, where? Phase F starts with a survey.

### 4.3 Firing Rules

- **id:** `firing-rules`
- **Purpose:** Determine when a vendor should be put on probation or fired (e.g., decline rate > X%, performance score < Y for N consecutive evaluations).
- **Evaluator:** could be in-process (fires on a schedule reading from `vendor-performance-metrics`) OR MOP-driven (push performance facts every refresh).
- **Recommendation:** in-process initially — firing decisions are infrequent and don't need RETE. Move to MOP if we want a single fact-flow.
- **Facts to surface:** vendor performance metrics (overall score, completion rate, revision rate, decline rate, ordersLast30Days, ordersLast90Days), trend deltas, tenant policy thresholds.
- **Actions:** `vendor_probation` (with `reason`, `untilDate`), `vendor_fire` (with `reason`), `notify_supervisor` (with `message`).
- **Decision source for replay:** new `firing-decisions` container.
- **Open questions:** what's the trigger? Cron job? Event-driven? Per-completed-order? Phase G picks.

### 4.4 Axiom Criteria

- **id:** `axiom-criteria`
- **Purpose:** CRUD over Axiom's evaluation criteria — the questions/checks Axiom runs against documents.
- **Evaluator:** Axiom service (LLM-based), not RETE. Different paradigm entirely.
- **Implication:** the JSONLogic visual condition builder doesn't apply. The category needs a different editor (criteria text + expected answer + scoring rubric).
- **What generalizes:** versioning, audit log, history, replay (run criteria against past documents and see how they would score), preview (run criteria against a sample document).
- **What doesn't generalize:** the editor surface. Plugin pattern lets each category supply its own editor component; generic shell handles tabs / chrome / version selector / audit.
- **Decision source for replay:** existing Axiom evaluation results in Cosmos (TBD — survey Axiom-side storage in Phase H).
- **Open questions:** does Axiom already have versioning? Audit? Phase H starts with that survey to avoid duplication.

### 4.5 Future categories (placeholder)

Categories the surface should accommodate but isn't shipping yet:
- **QC Gates** — pass/fail rules on QC checklists.
- **Pricing Adjustments** — vendor fee rules, rush surcharges, geographic differentials.
- **Auto-routing rules** — order-to-team / order-to-product mappings.
- **Compliance rules** — state-specific or product-specific compliance gates.

The plugin pattern means adding any of these is a CategoryDefinition + a few component swaps, not a workspace rewrite.

---

## 5. Phase plans

### 5.A Phase A — Generalize storage + CRUD + audit

**Goal:** every existing vendor-matching CRUD operation works through a category-parameterized service + controller against generalized containers, with backward-compat aliases keeping old paths working.

**Tasks:**
1. New types: `RulePackDocument`, `RulePackAuditEntry`, `CreateRulePackInput` get a `category: string` field. Move types from `vendor-matching-rule-pack.types.ts` to `decision-rule-pack.types.ts`; old file re-exports for one release.
2. New service `DecisionRulePackService` based on `VendorMatchingRulePackService` but every method takes `category` first. Old service becomes a thin shim that calls the new one with `category: 'vendor-matching'`.
3. New Cosmos containers `decision-rule-packs` + `decision-rule-audit` provisioned via Bicep + applied to dev/staging via `az deployment group create`.
4. One-shot migration script `scripts/migrate-vendor-matching-rule-packs.ts` reads from old container, writes to new with `category: 'vendor-matching'`. Idempotent.
5. New controller `DecisionEngineRulesController` mounted at `/api/decision-engine/rules/:category`. All existing routes implemented.
6. `/api/auto-assignment/rules/*` becomes a `308 Permanent Redirect` to the new path.
7. Tests: clone existing `rule-pack.service.test.ts` and `mop-rule-pack-pusher.test.ts` into the new namespace; old tests still pass against the shim.

**Definition of done:**
- Every existing FE call still works (via the redirect).
- New API path returns identical responses.
- Migrated docs visible in new container; old container untouched for safety.
- All BE tests green.

### 5.B Phase B — Category plugin pattern (BE)

**Goal:** the `CategoryDefinition` interface + registry exists; vendor-matching is the first registered category and behavior is unchanged.

**Tasks:**
1. `CategoryDefinition` interface (validators, push, preview, replay surface).
2. `CategoryRegistry` — register at app startup; `get(category)` returns the definition or 404s.
3. `VendorMatchingCategory` definition: `validateRules` wraps the existing TS validator; `push` wraps `MopRulePackPusher.push`; `preview` wraps `MopRulePackPusher.preview`; `replay` is `null` for now (Phase D).
4. The generic controller dispatches each request to the resolved category's methods.
5. Service's `onNewActivePack` hook becomes category-dispatched.
6. Tests: registry lookup, unknown-category 404, vendor-matching round-trip.

**Definition of done:**
- All vendor-matching CRUD goes through the registry.
- Tests prove unknown categories return 404 with a clear message.
- No behavior change visible to operators.

### 5.C Phase C — FE category-aware workspace

**Goal:** workspace lives at `/decision-engine/rules/:category`, picks up the category's plugin metadata, renders the correct fact catalog + action catalog + sample fixtures.

**Tasks:**
1. New routes `/decision-engine/rules/:category` + `/decision-engine/decisions/:category` (or one combined).
2. `CategoryProvider` React context exposes `useCategoryDefinition()` to children — variable catalog, action catalog, sample evaluations, evaluator name (for the "Provider:" chip), category label/icon/description.
3. FE `CategoryDefinition` mirror: each category registers its own client-side metadata. Vendor-matching is the first.
4. Refactor `RuleConditionBuilder` to take its variable catalog as a prop instead of the hardcoded constants.
5. Refactor `RulePackVisualEditor` to take its action catalog as a prop.
6. Refactor `RulePackPreviewPanel` to take default sample evaluations from the category.
7. New page header: category dropdown + breadcrumb.
8. Old `/auto-assignment/rules` redirects to `/decision-engine/rules/vendor-matching`.
9. Nav restructure: "Auto-Assignment" group becomes "Decision Engine" with sub-items per category (initially just "Vendor Matching" + "Recent Decisions").

**Definition of done:**
- Picking a category from the dropdown swaps the workspace contents.
- Visual condition builder shows the right variables for the selected category.
- Action picker shows the right actions.
- Preview pane's default fixtures match the category.

### 5.D Phase D — Sandbox + Replay

**Goal:** for any category, operators can take historical decisions, propose rule changes, and see a side-by-side diff before publishing. The single highest-leverage operator surface in this entire plan.

**Tasks:**
1. BE: each category's `replay()` implementation. For vendor-matching: read N days of `assignment-traces`; for each, re-call the category's preview with the proposed rules + the original facts; collect diffs (which orders flipped vendors, score deltas, denial rate change, etc.).
2. BE endpoint: `POST /api/decision-engine/rules/:category/replay` body `{rules, sinceDays|ids[], samplePercent?}`. Returns the diff summary + per-decision details.
3. FE: new "Sandbox" tab in the workspace (5th tab after Active/History/Audit/Runs). Shows the editor + a "Replay against last N days" panel below.
4. Diff UI: outcome counts (changed / unchanged / new denials / new escalations), per-decision drill-down with old-vs-new vendor + score breakdown.
5. Replay-from-an-order-detail-page button: "Replay this order with current rules" + "Replay with proposed rules" — opens the sandbox pre-populated.
6. Tests for the diff computation; small fixture-based integration test.

**Definition of done:**
- Operator can edit a proposed rule, click "Replay against last 7 days", see the diff in <5s for typical traffic.
- Diff is correct (regression-tested with hand-crafted fixtures).
- Saving from sandbox works (creates a new version normally, with the audit row's reason field auto-suggested as "Replay diff: N orders changed, M new denials").

### 5.E Phase E — Per-rule analytics + dashboards

**Goal:** a dashboard per category showing rule effectiveness — fire counts, average impact, dead rules, fire-rate over time — backed by the trace data.

**Tasks:**
1. BE: a daily aggregation job per category. For vendor-matching, reads `assignment-traces`, computes per-rule fire counts, average score adjustment, denial contributions; writes to `decision-rule-analytics` Cosmos container keyed by `(category, tenantId, ruleId, date)`.
2. BE endpoints: `GET /api/decision-engine/rules/:category/analytics?days=30`, `GET /api/decision-engine/rules/:category/analytics/:ruleId`.
3. FE: new "Analytics" tab — top-firing rules table, never-fired rules section ("candidates for archive"), fire-rate sparklines per rule, distribution of score adjustments.
4. Cross-category landing page at `/decision-engine` showing per-category KPI strip.
5. Optional: Application Insights metric channel — emit `decision.eval.fired` per fire so we get real-time graphs alongside the daily aggregates.

**Definition of done:**
- Operators can identify dead rules and archive them.
- Top-firing-rule changes (e.g., a new rule suddenly firing way more than expected) are visible at a glance.
- Cross-category analytics page shows health at a glance.

### 5.F Phase F — Add Review Program rules

**Goal:** review programs become the second category. Plugin pattern proven against a non-vendor-matching surface.

**Tasks:**
1. Survey: where does review program selection happen today? Hard-coded? Config-driven? Find the existing logic and assess what it would take to express as rules.
2. Decide evaluator (MOP with new `review-program` Prio program is the recommended path — keeps the architecture consistent).
3. Define facts schema: report fields, appraiser context, order context. Document in this doc and in MOP.
4. Define action catalog: `route_to_program`, `escalate_to_human`, `score_adjustment`.
5. MOP-side: register the new program; ship a default seed pack with current logic translated.
6. AMS-side: register `ReviewProgramCategory` definition.
7. FE-side: register the FE category metadata (variable catalog, action catalog, sample fixtures).
8. Backfill historical review decisions into a `review-program-decisions` container so replay works.

**Definition of done:**
- Operator picks "Review Programs" from the category dropdown and sees a fully working workspace.
- Existing review program selection logic is functionally equivalent under the new rules.
- Replay against the last 30 days of submissions works.

### 5.G Phase G — Add Firing Rules

**Goal:** firing decisions become rules-driven and observable.

**Tasks:**
1. Survey: how are vendors currently put on probation / fired? Manual? Existing automation? What signals are used?
2. Decide evaluator location (in-process AMS recommended — firing is infrequent and reads from `vendor-performance-metrics`).
3. Decide trigger model — daily cron, event-driven on metric refresh, or per-order-completion.
4. Define facts schema: vendor performance metrics, trend deltas, tenant policy thresholds.
5. Define actions: `vendor_probation`, `vendor_fire`, `notify_supervisor`.
6. AMS-side: in-process evaluator; register `FiringRulesCategory` definition.
7. FE-side: register category metadata.
8. New `firing-decisions` container for traces.

**Definition of done:**
- Tenants can define their firing policy as rules through the workspace.
- Decisions are recorded with explanations operators can review.
- Replay confirms a proposed change wouldn't have unintended effects.

### 5.H Phase H — Add Axiom Criteria

**Goal:** criteria CRUD lives under the same surface, even though the evaluator is LLM-based and the editor is different.

**Tasks:**
1. Survey: what does Axiom's existing criteria storage look like? Is there versioning? Audit?
2. If Axiom has its own storage, decide: does the workspace become a thin proxy over Axiom's API, or do we mirror into AMS Cosmos and push to Axiom? (Recommendation: proxy if Axiom's API is rich enough, mirror if not.)
3. Generalize the editor surface: each category supplies its own editor component (Vendor Matching gets the JSON/visual builder; Axiom Criteria gets a criteria-specific form with text + expected answer + rubric).
4. Generalize the preview surface similarly.
5. Define what "replay" means for Axiom (re-run criteria against past documents and show scoring drift).
6. Register `AxiomCriteriaCategory` on AMS + FE.

**Definition of done:**
- Operators manage Axiom criteria without leaving the workspace.
- Replay shows how a criteria change would have affected past evaluations.

### 5.I Phase I — Cross-cutting polish

**Goal:** the live feed, trace flow viz (React Flow), and ops dashboard surfaces from `AUTO_ASSIGNMENT_REVIEW.md` Phases 5+7, generalized to all categories.

**Tasks:**
1. **Live evaluation feed** (was Phase 5 T40-T41 of the review): Service Bus topic per category for `decision.evaluation.completed`; WebSocket relay; FE live-feed page with click-through to the trace.
2. **Trace flow visualization** using React Flow: vendor inputs (or category-equivalent) on the left → rules-fired in the middle → outcome on the right. Used on the order-detail page (vendor-matching) AND analogous detail pages for other categories.
3. **Ops dashboard** (was Phase 7 T49-T53): cross-category health, breaker state, fallback rate, error budget burn. Per-tenant kill switch for each category.
4. **Cross-category search**: "find all rules that reference `performance_score`" works regardless of category.
5. **Audit hub**: tenant-wide rule edit history across all categories, filterable.

**Definition of done:**
- Live feed updates within 2s of an evaluation across any category.
- Trace flow viz renders in <500ms for a typical trace.
- Ops dashboard shows the platform's decision-engine health at a glance.

---

## 6. Migration plan

### 6.1 Sequencing

The phases are not strictly serial. Recommended sequencing:

```
A (storage/CRUD) ──┐
                   ├──► B (BE plugin pattern) ──► C (FE category-aware) ──┐
                   │                                                      │
                   │                                                      ├──► D (sandbox/replay) ──┐
                   │                                                      │                         │
                   │                                                      ├──► E (analytics) ───────┤
                   │                                                      │                         │
                   │                                                      ├──► F (review programs) ─┤
                   │                                                      │                         │
                   │                                                      ├──► G (firing rules) ────┤
                   │                                                      │                         │
                   │                                                      └──► H (axiom criteria) ──┤
                   │                                                                                │
                   │                                                                                ▼
                   └────────────────────────────────────────────────────────────────────────► I (polish + dashboards)
```

A blocks everything; B blocks C; C blocks D-H; D-H run in parallel; I depends on all.

Estimated effort (calibration, not commitments):
- A: ~3-4 days BE (mostly mechanical refactor + migration script).
- B: ~2-3 days BE.
- C: ~1-1.5 weeks FE (refactor + plugin pattern).
- D: ~1.5-2 weeks BE+FE.
- E: ~1 week BE+FE.
- F: ~1.5 weeks BE+FE+MOP (depends on existing review-program complexity).
- G: ~1 week BE+FE.
- H: ~2 weeks BE+FE (Axiom integration is the unknown).
- I: ~2 weeks BE+FE.

Total: ~10-12 weeks of dev work, ~7-9 weeks calendar with two engineers in parallel after A+B+C land.

### 6.2 Risks

| Risk | Mitigation |
|---|---|
| Generalization makes the vendor-matching path slower / less observable | Ship A behind a feature flag; soak the redirect for a week before retiring `/api/auto-assignment/rules`; monitor latency + error rates per route. |
| Plugin pattern leaks category-specific concerns into the generic surface | Each category's tests assert it can be swapped in/out without modifying generic code. |
| Review Programs / Firing Rules have implicit complexity not surfaced today | Phase F and G start with a survey commit. No code until the surface is mapped. |
| Axiom Criteria's evaluator architecture doesn't fit the same UX | Editor is a per-category plugin component — Axiom can have a totally different editor. Versioning / audit / history / replay still generalize. |
| Operator confusion during the `/auto-assignment/rules` → `/decision-engine/rules/vendor-matching` rename | Old route renders a redirect with a one-time toast: "Moved to Decision Engine — bookmark updated." |

---

## 7. Open questions

These would benefit from a brief conversation before we get deep into A:

1. **Naming**: `Decision Engine` vs `Rules Hub` vs `Decision Center` for the user-facing surface? (Recommendation: "Decision Engine" — accurate, technical, room to grow.)
2. **Cosmos partition model**: single container with `(tenantId, category)` composite vs container-per-category? (Recommendation: single container; partition on `/tenantId`; index includes `category`.)
3. **Permission model**: should each category have its own RBAC, or do all categories share the existing `manager` role? (Recommendation: start shared; per-category roles in Phase I if/when needed.)
4. **Review Programs**: is there existing logic to translate, or does this need to be built from scratch? Phase F's first task is the survey.
5. **Firing Rules**: currently manual or already partially automated? Same — Phase G surveys first.
6. **Axiom Criteria**: where is criteria storage today? Versioned? Phase H surveys first.
7. **Cross-tenant analytics**: do platform admins want a view across all tenants? (Probably yes for ops; deferred to Phase I.)

---

## 8. What I recommend tackling next

**Phase A** — generalize the storage / CRUD / audit. It's mechanical (~3-4 days), unblocks every other phase, and the redirect-based backward compat means nothing user-visible changes. Get the foundation right before adding categories.

After A lands, **Phase B + C in parallel** (BE plugin pattern + FE category-aware) — they're independent enough that two devs can work in parallel.

Then **Phase D (sandbox/replay)** — the single biggest operator value-add in this entire plan, and it's category-generic so all subsequent categories inherit it for free.

Then F/G/H pick up new categories one by one; E (analytics) and I (polish) can run alongside as the trace dataset grows.

---

## Appendix A — Naming conventions

To keep the codebase coherent across the surface:

- BE container names: `decision-rule-packs`, `decision-rule-audit`, `decision-rule-analytics`. Category-specific decision logs (e.g. `assignment-traces`, `review-program-decisions`, `firing-decisions`) keep their domain names.
- BE service: `DecisionRulePackService`. Category implementations: `VendorMatchingCategory`, `ReviewProgramCategory`, `FiringRulesCategory`, `AxiomCriteriaCategory`.
- BE controller: `DecisionEngineRulesController` mounted at `/api/decision-engine/rules`.
- FE RTK slice: `decisionEngineRulesApi`. Category-specific FE metadata: `vendorMatchingCategoryDef`, `reviewProgramCategoryDef`, etc.
- FE routes: `/decision-engine/rules/:category`, `/decision-engine/decisions/:category`, `/decision-engine` (landing).
- FE components: existing names stay (`RulePackVisualEditor`, etc.); they take category-specific data as props.
- Cache tags (RTK Query): `DecisionRulePack`, `DecisionRulePackAudit`, `DecisionRuleAnalytics`. Old `VendorMatchingRulePack` re-exports for one release.

---

## Appendix B — Key file references at start of plan

**Backend (`appraisal-management-backend`):**
- `src/types/vendor-matching-rule-pack.types.ts` — types to generalize (Phase A).
- `src/services/vendor-matching-rule-pack.service.ts` — service to generalize.
- `src/services/mop-rule-pack-pusher.service.ts` — vendor-matching push client; becomes one of N category push clients.
- `src/controllers/vendor-matching-rule-packs.controller.ts` — controller to generalize.
- `src/services/assignment-trace-recorder.service.ts` — vendor-matching trace recorder; pattern other categories follow.
- `infrastructure/modules/cosmos-vendor-matching-rule-pack-containers.bicep` — provisions containers; gets a sibling `cosmos-decision-engine-rule-containers.bicep` in Phase A.

**Frontend (`l1-valuation-platform-ui`):**
- `src/store/api/vendorMatchingRulePacksApi.ts` — RTK slice to generalize.
- `src/store/api/assignmentTracesApi.ts` — trace API; pattern other categories follow.
- `src/types/backend/vendor-matching-rule-pack.types.ts` — types mirror.
- `src/components/auto-assignment/*` — components to refactor for category-awareness.
- `src/components/order/AssignmentTraceTimeline.tsx` — trace timeline; reused per category.
- `src/app/(control-panel)/auto-assignment/rules/page.tsx` — workspace; becomes `/decision-engine/rules/[category]/page.tsx`.
- `src/app/(control-panel)/auto-assignment/decisions/page.tsx` — decisions list; becomes per-category.
- `src/configs/navigationConfig.ts` — nav; restructure in Phase C.

**MOP (`mortgage-origination-platform`):**
- `src/vendor_matching/VendorMatchingService.cpp` — vendor-matching evaluator; pattern other Prio-evaluated categories follow.
- `src/vendor_matching/TenantReasonerRegistry.cpp` — generic enough to reuse for other Prio programs; rename to `TenantProgramRegistry` + parameterize on program id when Phase F adds review programs.
- `config/rules/vendor-matching.json` — seed pack; sibling files per category.

---

## Confidence

- **High**: that A (storage/CRUD generalization) is mechanical and safe; B (plugin pattern) is well-understood; C (FE category-aware refactor) is straightforward. These are standard refactors.
- **Medium**: D (sandbox/replay) timing — depends on the per-category replay implementation; the diff UI is non-trivial.
- **Lower** until the surveys land: F (Review Programs), G (Firing Rules), H (Axiom Criteria) — sized assuming the existing logic is extractable; if it's tightly coupled to other systems, scope grows.
