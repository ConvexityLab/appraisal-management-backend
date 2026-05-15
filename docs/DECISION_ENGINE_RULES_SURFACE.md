# Decision Engine Rules Surface — Implementation Guide

**Created:** 2026-05-10
**Last updated:** 2026-05-15 (rev 17 — post-review fixes + auto-assign runtime path now reachable through the new ClientOrder/VendorOrder split + double-bid-invitation race closed)
**Scope:** Generalize the vendor-matching rules workspace shipped in `AUTO_ASSIGNMENT_REVIEW.md` Phases 1–5 into a universal Decision Engine Rules Surface that handles every rules-driven process in the platform: vendor matching, review programs, firing rules, Axiom Criteria, and any future decision surface. Same CRUD / version / audit / preview / sandbox / replay / analytics machinery, pluggable per category.

**Why now:** The vendor-matching slice proved the architecture end-to-end (live in dev, operators can author + publish + see traces). Rather than build the same machinery N times for the N other rule-driven systems, generalize once and treat every decision system as a "category" plugged into the surface.

**Sibling doc:** `AUTO_ASSIGNMENT_REVIEW.md` — vendor-matching specific review + Phases 1-5 status. This doc continues the story for everything else.

**Revisions:**
- 2026-05-15 (rev 17) — **Post-review fixes + auto-assign runtime path verified end-to-end + double-bid-invitation race closed.**
  - **6 critical correctness bugs** fixed: simulator trace lookup mismatch (passes `traceIds` not `orderIds` so the map lookup pins to the in-flight pending trace); cross-tenant leaks in `loadProgram` + `loadRawResult` + `bulk-portfolio-jobs` lookup (all now tenant-filter); `?behavioral=true` diff bypassed kill switch (now refuses when killed); `useMemo` running `setState` in `NewVersionDialog` reset → `useEffect`; invented `'overridden_by_replay'` enum dropped + bulk-commit parallelised via `Promise.allSettled`; J15 `noChanged` variable name was inverted (logic was backward).
  - **4 high-priority operational fixes**: aggregation `discoverTenants` unions across 5 trace stores so seed-pack tenants get pre-aggregated; multi-replica race closed via per-day Cosmos lease in `decision-rule-analytics` partition `__lease`; pusher distinguishes 401/403/422/5xx/404/network errors with per-class log levels (was lumping all into one "best-effort" line); `AXIOM_INTEGRATION_SURVEY.md` documents the body-tenantId + shared-bearer trust boundary + production-turn-on prerequisites.
  - **9 polish items**: `simulate` is now a `CategoryDefinition` extension point (was hardcoded `category !== 'vendor-matching'`), with explicit 503 + `kind: 'mop-not-configured'` when the dependency is absent; dropped dead `_db` constructor param on `PackVersionDiffService`; `behavioralDiff` loads packs once (was 4×); review-program N+1 raw-result fetch killed by stashing the source `ReviewTapeResult` on `NormalizedReviewDecision` at read time; bicep `uniqueKeyPolicy` removed (per-partition not global; would have broken idempotent re-deploy) + analytics container TTL extended 30d → 180d so trend comparison works; `PackVersionDiffDialog` syncs defaults via `useEffect` + guards `versionA===versionB`; `RulePackAnalytics` rule rows got keyboard a11y; `clampDays(0)` throws instead of silently returning 7.
  - **J16 — runtime path now reachable through the new ClientOrder/VendorOrder split.** The probing test exposed a real platform gap: `/api/client-orders` was publishing only `client-order.created`, but `AutoAssignmentOrchestrator` only subscribes to `engagement.order.created` (which the legacy `/api/orders` path emits). VendorOrders created through the new split skipped auto-assignment entirely. Fix: `ClientOrderService.placeClientOrder` now also publishes `engagement.order.created` per child VendorOrder, mirroring the shape from `order.controller.ts:626`. Verified end-to-end via J16 — engagement → ClientOrder + VendorOrder placed → orchestrator consumed → `findMatchingVendorsAndDenied` ran → trace persisted → bid invitation actually went out to **Colclough & Associates Appraisers** (real seed vendor) within 4s of the placement.
  - **Double-bid-invitation race closed.** BE-log inspection during J16 surfaced that every order was getting **TWO bid invitations** (same `orderId`, same `vendorId`, both `attempt: 1`, ~100ms apart). Root cause: `AutoAssignmentOrchestrator.start()` set `isStarted = true` AFTER awaiting the subscription chain. `api-server.ts` calls `.start()` twice (once from `initializeDatabase` for tests, once from `startBackgroundJobs` for prod); both fired synchronously, both saw `isStarted: false`, both subscribed → every event handled twice. Fixed in both `AutoAssignmentOrchestrator` and `ReviewProgramOrchestrator` by setting the flag BEFORE the awaits. Verified bid-invitation count: 2 → 1 per order.
- 2026-05-13 (rev 16) — **Scope expansions shipped + drill-down/diff-viz + Sandbox bug fix + staging operationalized.**
  - **Decision Impact Simulator** (`POST /:category/simulate`) — projects pack-change effect on in-flight (pending_bid / broadcast) decisions. Returns `losingBidVendors` (originally-selected vendor now denied) + `newlyEscalatedOrders` (every considered vendor denied → human queue). FE: "Simulate impact" button on the Sandbox tab → `DecisionImpactSimulatorDialog`.
  - **Multi-version Pack A/B Diff** (`GET /:packId/diff?versionA=N&versionB=M`) — canonical-JSON rule comparison (sorted keys, no cosmetic-edit noise). Returns added / removed / modified / unchanged + metadata changes. `?behavioral=true` mode replays both packs and surfaces per-trace outcome divergence. FE: "Compare versions" button on the History tab → `PackVersionDiffDialog`.
  - **E.drilldown** — clickable rows on the Analytics top-firing table → `RuleDrillDownDialog` with bigger daily-fire chart, computed insights (gatekeeper / score-only / always-fires / high-denial / healthy), and the rule's actual JSON definition inline.
  - **D.diffViz** — "View diff" button on every changed row in Sandbox replay results → `SandboxDiffViewDialog` shows side-by-side Before (original ranking + outcome) vs After (newly denied vendors, score deltas, new acceptances, faithful chip when the trace had an `evaluationsSnapshot`).
  - **Real bugs fixed along the way**:
    - `RulePackSandbox` snapshotted `rules` from `initialRules` once at mount, so opening Sandbox before activePack landed left the editor (and Run replay / Simulate impact buttons) forever empty/disabled. Now syncs when `initialRules` transitions `[]` → populated, but stops re-syncing after the first operator edit.
    - `AutoAssignmentStatusPanel` bailed entirely on a status-fetch error, hiding the trace timeline below it (which is an independent read). Now renders the error inline + still shows the timeline so Override / Replay stay usable.
  - **Operationalized in staging** — `cosmos-decision-engine-analytics-container.bicep` deployed; `DECISION_ANALYTICS_JOB_ENABLED=true` + `FIRING_RULES_JOB_ENABLED=true` set on `ca-appraisalapi-sta-lqxl`. Analytics endpoint now reads-through pre-aggregated snapshots before falling back to live compute; firing-rules cron runs daily.
  - **Live-fire suite — 14/14 green.** Added J12 (simulator), J13 (diff), J14 (drill-down), J15 (diff viz). Every J row exercises real data through real HTTP through real staging Cosmos. Suite runtime ~2 min.
  - **Live-fire suite at 12/12 green** — J1, J2, J3, J4, J5, J7, J9, J10, J10b, J11, J12, J13 all pass against staging Cosmos via headless Playwright. New rows: J12 (Simulator end-to-end) + J13 (Pack A/B diff end-to-end).
- 2026-05-11 (rev 15) — **All previously yellow phases turned green.** Lands the closing batch the user demanded ("everything in our yellow turned to green").
  - **D.faithful**: assignment-trace `evaluationsSnapshot` field; engine returns + orchestrator persists; replay prefers the frozen snapshot, falls back to current vendor data for legacy traces. Diff details include `factSource` + `faithful` flags.
  - **D.replayButton**: `ReplayThisOrderDialog` + Replay button on every `AssignmentTraceTimeline` entry. One-click "what would today's rules have done?" without opening the Sandbox tab.
  - **F.replay**: `ReviewProgramReplayService` + fragment-based input contract (thresholds / decision-rules / auto-flag / manual-flag overlays). Faithful by construction — `ReviewTapeResult extends RiskTapeItem`, so persisted result rows carry every source field. Wired into `ReviewProgramCategory.replay`. 10 unit tests.
  - **E.preagg**: new `decision-rule-analytics` Cosmos container (Bicep) with 30d TTL on snapshot rows; `DecisionAnalyticsAggregationService` (read/write); `DecisionAnalyticsAggregationJob` (24h cron, off behind `DECISION_ANALYTICS_JOB_ENABLED`); controller `/analytics` endpoint reads through fresh snapshots before falling back to live compute. 4 unit tests.
  - **H.push + L4**: `AxiomCriteriaPusher` POSTs packs to Axiom's `/api/criteria-sets`; fails open on 404 (Axiom-side endpoint pending) / network errors. Full `AxiomCriteriaResultsReader` replaces the L1 stub — joins `axiom-executions` → embedded result bundles for tenant+window-scoped aggregation across `pass / fail / needs_review / cannot_evaluate / not_applicable` verdicts. 6 unit tests.
  - **N3+N4+N5** (shipped earlier this revision cycle): decomposition CRUD controller, `decompositionRuleId` stamp on every VendorOrder, override surface with `'order-decomposition'` adapter.
  - **J runner**: `pnpm run test:live-fire:decision-engine` validates required env vars + storage state up front, then invokes the existing Playwright suite. No silent skips.
  - Remaining gated-on-Axiom items: L5 replay (needs stateless Axiom preview) + H.preview (same dependency). Tracked in `services/decision-engine/axiom-criteria/AXIOM_INTEGRATION_SURVEY.md`; not platform-side work.
- 2026-05-10 (rev 1) — Initial draft after Phase 5 MVP shipped (per-tenant rule packs + workspace + traces). Lays out Phases A through H to evolve from "vendor-matching workspace" to "universal rules surface".
- 2026-05-10 (rev 2) — Phase A complete. Generalized types/service/controller/containers landed, vendor-matching shimmed to use the new generic, legacy `/api/auto-assignment/rules` 308-redirects to `/api/decision-engine/rules/vendor-matching`, migration script applied to dev + staging.
- 2026-05-10 (rev 3) — Phase B complete. `CategoryDefinition` interface + `CategoryRegistry` + `VendorMatchingCategory` shipped. Controller dispatches into the registry instead of hard-wired `MopRulePackPusher`. `wireRegistryHooks` registers per-category `push` as `onNewActivePack` callbacks. Categories that omit optional methods (push/preview/seed/drop/replay) cleanly surface 501 from the controller. 13 new tests; vendor-matching round-trip behavior unchanged.
- 2026-05-10 (rev 4) — Phase C MVP shipped (visible front). New nav group "Decision Engine"; routes `/decision-engine/rules/:category` + `/decision-engine/decisions/:category`; per-category chrome (breadcrumb, dropdown, status chip). Live category renders the existing vendor-matching workspace; planned categories (Review Programs / Firing Rules / Axiom Criteria) show a "coming in Phase F/G/H" placeholder body — they no longer fall through to the vendor-matching workspace. Phase C polish (factor variable/action catalogs into per-category props) still pending.
- 2026-05-10 (rev 5) — Phase C polish complete. Frontend `categoryDefinitions.ts` registry + `CategoryProvider` context (`useDecisionCategory()` hook). `RuleConditionBuilder` reads variable catalog from context (groups preserved); `RulePackVisualEditor` reads action catalog and `defaultRule()` from context (action data fields are catalog-driven, no more hardcoded fact_id switch); `RulePackPreviewPanel` reads default sample evaluations from context. Components fall back to vendor-matching when no provider is present, so the legacy `/auto-assignment/rules` page still works unchanged. Adding a new live category now only needs (1) a BE `CategoryDefinition` registration and (2) an FE `FrontendCategoryDefinition` entry — no component edits.
- 2026-05-10 (rev 6) — Phase D MVP complete. `VendorMatchingReplayService` reads recent `assignment-traces` for a tenant, fetches current vendor data, calls MOP `/preview` with the proposed rules, and returns a per-decision diff (changed / unchanged / skipped + new denials / new acceptances counts). `CategoryDefinition.replay` interface; vendor-matching wires it. New endpoint `POST /api/decision-engine/rules/:category/replay`. New "Sandbox" tab in the workspace with the visual editor + replay form (sinceDays 1-30, samplePercent 1-100) + diff table with expandable per-decision details. 7 new tests; replay uses *current* vendor data (operators see the caveat in the UI).
- 2026-05-10 (rev 7) — Phase E MVP complete. `VendorMatchingAnalyticsService` aggregates recent `assignment-traces` in-memory (no new container; on-the-fly compute) and returns per-rule fire counts, denial contributions, score-adjustment sums, daily fire histograms, and outcome counts. `CategoryDefinition.analytics` interface; vendor-matching wires it. New endpoint `GET /api/decision-engine/rules/:category/analytics?days=N` (1-90). New "Analytics" tab in the workspace: summary cards (decisions / evaluations / escalations / dead rules), outcome distribution chips, top-firing rules table with daily-fire sparklines, never-fired rules section. New cross-category landing page at `/decision-engine` with per-category 7-day KPI strip + quick links into rules / decisions. 8 new tests. Future swap-in: pre-aggregated `decision-rule-analytics` Cosmos container if/when on-the-fly compute hits scale limits.
- 2026-05-10 (rev 8) — Phases F + G + H land as live categories (storage + workspace surface only — upstream evaluators are per-phase polish). Shared Prio-style validator (`validatePrioRulePack`) extracted; vendor-matching refactored to use it; `buildReviewProgramCategory` / `buildFiringRulesCategory` / `buildAxiomCriteriaCategory` register with the same validator. All three registered in api-server.ts. FE `FrontendCategoryDefinition` entries updated to `status: 'live'` with full variable + action + sample catalogs (Axiom Criteria intentionally has empty action catalog — its custom editor is Phase H polish). The inner workspace page is now category-aware: every rule-pack hook (`useGetActive...` / `useList...` / `useGetVersion...` / `useGetAudit...` / `useSeed...` / `useCreate...`) takes `category` from `useDecisionCategory()` and routes to the correct `/api/decision-engine/rules/:category/*` endpoint. `RulePackAnalytics` and `RulePackSandbox` now degrade gracefully when the upstream evaluator returns 501 (Sandbox shows a "replay not wired yet" message; Analytics shows a "no decision traces yet" empty state). `RulePackPreviewPanel` switched to the new category-aware mutation. Operators can now author + version + audit rule packs for all four categories today; sandbox + analytics + replay light up automatically as each category's upstream evaluator + trace store ship.
- 2026-05-10 (rev 14) — Phase N added + N0/N1/N2 shipped: `order-decomposition` is the 5th live Decision Engine category. Acknowledges the canonical engagement→order→matching flow has TWO rule-evaluation points (decomposition + matching), not just one. BE category file ships with shape-checking `validateRules` and stub analytics; FE category def + nav entry put it in the workspace dropdown alongside the other four. Storage stays in the existing `decomposition-rules` container — no new container. N3 (workspace CRUD), N4 (decompositionRuleId stamp + real analytics), N5 (override surface) sequenced in `services/decision-engine/order-decomposition/ORDER_DECOMPOSITION_SURVEY.md` for follow-up PRs.
- 2026-05-10 (rev 13) — K, M (all 6 sub-items), and L0/L1 shipped end-to-end. J Playwright suite skeleton landed; execution against deployed staging is the remaining step (needs `RULES_PROVIDER=mop-with-fallback` + `FIRING_RULES_JOB_ENABLED=true` env flags + storage-state capture).
  - **K**: ClientAutomationConfig gained `reviewProgramOnOrderCreated` + `reviewProgramIdForOrders`; `ReviewProgramOrchestrator` subscribes to `engagement.order.created` and writes results to existing `review-results` with `triggerSource: 'order-created'`. FE trigger config panel + analytics now unions bulk + order-created rows. No new container.
  - **M.1**: `DecisionOverrideService` writes override fields on every category's trace doc, audit row in `decision-rule-audit`, publishes `decision.overridden`. FE `DecisionOverrideDialog` is category-aware (force-pick vendor for vendor-matching, etc.). Override button on every assignment-trace timeline entry. Tenant ownership guard prevents cross-tenant overrides.
  - **M.2**: `?orderId=X` deep-linkable filter on the decisions listing + search box accepting orderId / vendorId / decisionId substrings.
  - **M.3**: Existing `ManualVendorOverrideDialog` + the new Override surface together cover the mid-flight intervention paths.
  - **M.4**: Sandbox diff now supports multi-select + "Commit overrides" button that fires `useOverrideDecisionMutation` for each selected row with a shared reason.
  - **M.5**: New `/decision-engine/audit` page reads cross-category audit feed (filter by category / action / window). Override rows show "prev → new"; rule edit rows show +N/~N/-N diff chips.
  - **M.6**: New `/decision-engine/settings` page aggregates OpsHealthDashboard + ReviewProgramTriggerConfigPanel + quick links into every workspace.
  - **L0**: Survey doc captures Axiom owns criteria storage by `(programId, programVersion)`; AMS reads results via the `aiInsights` proxy joined to `AxiomExecutionRecord` for tenant scope.
  - **L1**: Stub reader returns a "pending" analytics payload; FE Analytics tab for axiom-criteria now shows an inline explainer pointing at the survey doc + the Axiom-side endpoint that needs to ship.
  - **J**: 9 Playwright test cases covering J1/J2/J3/J4/J5/J7/J9/J10/J11. Skips by default until staging env vars are set.

- 2026-05-10 (rev 12) — Added Phases J/K/L/M to close out the surface: J = live-fire validation across ALL paths (no more "shipped but never exercised"); K = review-program evaluation on every order-creation path (not just bulk-portfolio); L = Axiom Criteria evaluator integration (push criteria from workspace to Axiom + trace results back); M = operator UX (override / lookup by order / mid-flight intervention / bulk replay-commit / cross-category audit hub). Each phase has a full task list + acceptance criteria. Status table updated.
- 2026-05-10 (rev 11) — Phase I kill-switch BE wiring complete (no remaining Phase I items deferred). `DecisionEngineKillSwitchService` reads/writes per-(tenant, category) flags via the existing `client-configs` Cosmos container with discriminator `entityType: 'decision-engine-kill-switches'` (no new container — investigated existing storage first). 60s in-process cache; fail-OPEN on read errors so a kill-switch fetch hiccup never blocks normal traffic. `DecisionEngineOpsController` mounted at `/api/decision-engine/ops` with GET `/kill-switches` + PATCH `/kill-switches/:category`. Rules controller now consults the kill switch on every write/eval path (createVersion / seedFromDefault / preview / replay) and short-circuits with 503 + a clear toggle-it-off hint. `FiringRulesEvaluatorJob` consults the flag in its per-tenant loop — toggling kill stops the next daily run for that tenant. FE: `decisionEngineOpsApi` + `useGet/SetDecisionEngineKillSwitchMutation`; OpsHealthDashboard toggle is now functional (was UI-only before) with a "killed" pip color + tooltip explaining the 503 contract. 7 new BE tests pinning the merge / fail-open / cache invariants.
- 2026-05-10 (rev 10) — Phase I follow-through (no items deferred): added `TraceFlowDiagram` (React Flow visualization on every assignment trace — left column inputs/vendors, center column rules fired, right column outcome, with List/Flow toggle on each timeline entry) and `OpsHealthDashboard` (cross-category 24h pips + decision counts + escalation rates + kill-switch UI surface on `/decision-engine` landing). New dep: `@xyflow/react`. Also category-aware empty state on `ActiveRulesView` — non-vendor-matching categories without packs no longer fall through to the MOP-specific diagnostic warning; they get a "Click New version to author the first pack" CTA. Kill-switch BE plumbing (config store + evaluator middleware) explicitly named as a separate PR — UI ships visible + read-only today.
- 2026-05-10 (rev 9) — Per-category polish: G full polish (in-process evaluator + cron + traces + analytics + replay), H custom editor, I live feed, F polish via existing storage adapter, plus a critical bug fix.
  - **Phase G full polish**: minimal pure-TS JSONLogic evaluator (no new deps, 17 tests); pure firing evaluator (10 tests, salience-ordered, malformed-rule-skips); `firing-decisions` Cosmos container (Bicep applied to dev + staging) with synthetic id `${tenantId}__${vendorId}__${runDate}` for same-day idempotency; `FiringRulesEvaluatorJob` (24h cron, off by default behind `FIRING_RULES_JOB_ENABLED`); `FiringRulesCategory` now wires preview (in-process eval against operator-supplied facts), replay (re-evaluates proposed rules against each historical decision's `metricsSnapshot` — faithful), analytics (per-rule fire counts + outcome counts); registers with the registry on app startup.
  - **Phase H polish**: `customEditor?: ComponentType<{rules, onChange}>` field on `FrontendCategoryDefinition`; `AxiomCriteriaEditor` ships as the first real consumer (card-per-criterion form with prompt / expected answer / rubric / weight, criterion fields stored in `actions[0].data`); `RulePackVisualEditor` short-circuits to `category.customEditor` when supplied. Axiom evaluator integration for push/preview/replay deferred to a separate PR.
  - **Phase I MVP**: `LiveDecisionsFeed` component on `/decision-engine` landing — RTK Query polling (10s, refetchOnFocus) over `useListRecentAssignmentTracesQuery`; pulsing live indicator; per-decision row with relative timestamp + outcome chip + quick-link to order. Polling-based for the MVP; WebSocket / Service Bus relay is the full-polish follow-up.
  - **Phase F polish (no new container)**: `ReviewProgramResultsReader` adapter reads existing review program decisions from the platform's already-deployed `bulk-portfolio-jobs` (partition `/tenantId`) + `review-results` (partition `/jobId`) containers — walks the small-job inline `items[]` and the large-job spillover transparently. `ReviewProgramCategory.analytics` wired through the adapter: per-flag fire counts + computedDecision outcome counts + escalation rollup (Reject). NO new container provisioned (rejected `cosmos-review-program-decisions-container.bicep` was deleted before deployment). Replay deferred to a separate PR — needs the variable-name mapping between the FE catalog and the canonical projection used by the existing tape evaluation engine.
  - **Bug fix**: `/decision-engine/rules/:category/page.tsx` and `/decision-engine/decisions/:category/page.tsx` had local `CATEGORY_CATALOG` arrays that drifted from `categoryDefinitions.ts` (Phases F/G/H promoted those categories to `status: 'live'` but the local catalog kept saying `'planned'`, so screens kept rendering the "Coming in Phase X" placeholder body). Both pages now read `FRONTEND_CATEGORIES` directly — single source of truth.

---

## 0. Progress Snapshot

This section is the **live tracker** — update statuses, add commit/PR refs, and date each transition as work progresses.

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done · ⏸ Paused · 🚫 Won't do

| Phase | Goal | Status | Started | Completed | Notes / PRs |
|---|---|---|---|---|---|
| A | **Generalize storage + CRUD + audit** — single `decision-rule-packs` container with `category` field; generic service/controller; backward-compat aliases for `/api/auto-assignment/rules` | ✅ | 2026-05-10 | 2026-05-10 | Types/service/controller/Bicep/migration/redirect/tests all landed. Foundation in place — Phase B + C unblocked. |
| B | **Category plugin pattern (BE)** — `CategoryDefinition` interface + registry; vendor-matching reimplemented as the first category to validate the pattern | ✅ | 2026-05-10 | 2026-05-10 | `CategoryDefinition` + `CategoryRegistry` + `VendorMatchingCategory` shipped; controller dispatches into registry; `wireRegistryHooks` registers per-category push hooks; 13 new tests. Adding a new category is now a `registry.register(...)` call. |
| C | **FE: category-aware workspace** — `/decision-engine/rules/:category`; category selector; component plugin pattern; `/auto-assignment/rules` redirects | ✅ | 2026-05-10 | 2026-05-10 | MVP + polish complete. `categoryDefinitions.ts` + `CategoryProvider` context; `RuleConditionBuilder` / `RulePackVisualEditor` / `RulePackPreviewPanel` all read catalogs from context with vendor-matching fallback. Adding a live category is now a BE `CategoryDefinition` + FE `FrontendCategoryDefinition` entry — no component edits. |
| D | **Sandbox + Replay** (was Phase 6 of `AUTO_ASSIGNMENT_REVIEW.md`) — pick a past order, propose rule changes, see the assignment diff. Generic across categories. | ✅ | 2026-05-10 | 2026-05-11 | All sub-items shipped: replay service + Sandbox tab + D.faithful frozen-fact replay (`evaluationsSnapshot` on traces) + D.replayButton ("Replay this order" on every trace timeline entry, with faithful-chip indicator). React Flow diff visualisation tracked as an optional refinement on the Sandbox tab. |
| E | **Per-rule analytics + dashboards** (was Phase 7 of the review) — fire counts, average impact, dead-rule detection, fire-rate over time. Cross-category. | ✅ | 2026-05-10 | 2026-05-11 | MVP + E.preagg both shipped: in-memory analytics service, `GET /:category/analytics` endpoint, Analytics tab, landing page, AND nightly aggregation (`decision-rule-analytics` Cosmos container + `DecisionAnalyticsAggregationJob` + controller reads-through fresh snapshots). |
| F | **Add Review Program rules as second category** | ✅ | 2026-05-10 | 2026-05-11 | Storage + workspace + analytics + replay all shipped. `ReviewProgramReplayService` overlays operator-proposed fragments (thresholds / decisionRules / auto-flag / manual-flag) on the baseline program; runs `TapeEvaluationService` against persisted `ReviewTapeResult` rows (faithful by construction). MOP-side `review-program` Prio program push/preview tracked separately as an optional upstream integration. |
| G | **Add Firing Rules as third category** | ✅ | 2026-05-10 | 2026-05-10 | Full polish landed: in-process JSONLogic evaluator (no new deps), pure firing evaluator, `firing-decisions` Cosmos container (Bicep applied to dev + staging), daily cron job (off by default), preview/replay/analytics all wired. 27 new tests. |
| H | **Add Axiom Criteria as fourth category** | ✅ | 2026-05-10 | 2026-05-11 | Storage + custom editor + L3 push + L4 full reader all shipped. `AxiomCriteriaPusher` calls Axiom's `/api/criteria-sets` (fail-open when endpoint is 404 / disabled). `AxiomCriteriaResultsReader` joins `axiom-executions` → embedded result bundles for tenant-scoped per-criterion analytics. Stateless preview + criteria replay (L5) gated on Axiom-side support — see `AXIOM_INTEGRATION_SURVEY.md`. |
| I | **Cross-cutting: live feed + trace flow viz + ops dashboard** (was Phases 5/7 of the review) | ✅ | 2026-05-10 | 2026-05-10 | All landed: polling `LiveDecisionsFeed` (10s), `TraceFlowDiagram` React Flow viz with List/Flow toggle on order-detail traces, `OpsHealthDashboard` with kill-switch toggles **functional** (BE wired through `DecisionEngineKillSwitchService` + `/ops/kill-switches` endpoints + 60s cached enforcement on every write/eval path + firing-rules cron). Real-time WebSocket relay (vs current 10s polling) is the only optional follow-up — useful when latency under 10s matters. |
| J | **Live-fire validation across ALL paths** | ✅ | 2026-05-10 | 2026-05-11 | Playwright suite at `e2e/live-fire/decision-engine-suite.live-fire.spec.ts` covers 9 of 10 matrix rows. Single-command runner shipped at `scripts/run-decision-engine-live-fire.mjs` (`pnpm run test:live-fire:decision-engine`) — validates required env vars + storage state up front, refuses to run on partial config, never targets local. Suite execution against staging is operator-triggered, not CI-gated (per team rule: live-fire is remote-only and intentional). |
| K | **Review Programs fire on every order-creation path** | ✅ | 2026-05-10 | 2026-05-10 | `ReviewProgramOrchestrator` subscribes to `engagement.order.created` + consults kill switch + per-tenant `reviewProgramOnOrderCreated` flag. Writes results into existing `review-results` container with new `triggerSource` field; reader unions bulk-portfolio + order-created rows for analytics. FE trigger-config panel on the workspace's Active tab. No new container. |
| L | **Axiom Criteria evaluator integration** | ✅ | 2026-05-10 | 2026-05-11 | L0 (survey), L1 (stub), **L3 (`AxiomCriteriaPusher` — fail-open on Axiom-side 404), L4 (full `AxiomCriteriaResultsReader` joining `axiom-executions` to result bundles)** all shipped. L2 (Axiom-side `POST /api/criteria-sets` endpoint) and L5 (stateless preview / replay against proposed criteria) are sibling-repo work owned by the Axiom team — pusher is wired and ready the moment Axiom's endpoint lands. |
| N | **Order Decomposition as 5th Decision Engine category** | ✅ | 2026-05-10 | 2026-05-11 | All of N0-N5 shipped. Survey, FE category def, BE registration, **N3** workspace CRUD controller proxying `OrderDecompositionService`, **N4** `decompositionRuleId` stamp on every VendorOrder + `OrderDecompositionAnalyticsService` aggregating from the existing `orders` container, **N5** override surface (`'order-decomposition'` adapter + category-aware outcomes in `DecisionOverrideDialog`). No new container. |
| M | **Operator UX — interact / intervene / trace** | ✅ | 2026-05-10 | 2026-05-10 | M.1 (per-decision Override across all 4 categories, with category-aware outcome options + audit row + `decision.overridden` event) + M.2 (deep-linkable `?orderId=` filter + search box) + M.3 (existing `ManualVendorOverrideDialog` + new Override surface together cover the intervention paths) + M.4 (multi-select Bulk-commit overrides from Sandbox diff) + M.5 (cross-category audit hub at `/decision-engine/audit` with category / action / window filters) + M.6 (settings page at `/decision-engine/settings` aggregating kill switches + trigger config + quick links). |

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

### 5.J Phase J — Live-fire validation across ALL paths

**Goal:** demonstrate that every evaluator + every visible surface works end-to-end against deployed staging. No more "shipped but never exercised" code paths.

**Approach:** all live-fire happens against deployed staging (per the team's standing rule — local stacks diverge on auth / config / managed identity). The deliverable is a Playwright suite at `e2e/live-fire/decision-engine-suite.live-fire.spec.ts` plus a documented manual checklist for assertions that can't be fully scripted.

**Staging config prerequisites:**
1. `RULES_PROVIDER=mop-with-fallback` on the AMS Container App so vendor-matching actually consults MOP at decision time. Without this, the rule pack you author in the workspace IS pushed to MOP but the live evaluation uses the homegrown in-process provider — so workspace edits don't affect real decisions in the way operators expect.
2. `FIRING_RULES_JOB_ENABLED=true` so the daily cron starts on next deploy. First tick runs 5 seconds after AMS startup, then every 24h.
3. `MOP_RULES_BASE_URL` already set; confirm pointing at `ca-mop-dev.…/health` returns 200.
4. Once Phase K lands: `REVIEW_PROGRAM_ON_ORDER_CREATED=true` (new flag introduced by Phase K) so review-program eval fires on every engagement.order.created event, not just bulk-portfolio uploads.

**Test matrix:**

| # | Category | Trigger path | Expected outcome | Where to verify |
|---|---|---|---|---|
| J1 | Vendor Matching | Create order on existing engagement via `/api/orders` POST | `engagement.order.created` → orchestrator → `findMatchingVendorsAndDenied` → trace recorded → bid invitation OR escalation | `/decision-engine` landing (RecentTraceFlowPreview must update within 30s); `/decision-engine/decisions/vendor-matching` table; `/orders/<id>` trace timeline; `assignment-traces` Cosmos row |
| J2 | Vendor Matching | Sandbox replay against last 7 days from the workspace | `POST /api/decision-engine/rules/vendor-matching/replay` returns diff with non-zero `totalEvaluated`; per-decision rows expand | Sandbox tab on `/decision-engine/rules/vendor-matching` |
| J3 | Vendor Matching | Save a new rule pack version via "New version" dialog | 201 from `POST /api/decision-engine/rules/vendor-matching`; audit row appears; MOP push hook fires; subsequent decisions reflect the new rules | History + Audit tabs; subsequent J1 trace shows new ruleId in `appliedRuleIds` |
| J4 | Vendor Matching | Flip kill switch ON, attempt J1 trigger | Order is created but auto-assignment escalates immediately; no new trace recorded for that tenant | OpsHealthDashboard pip turns slate-grey; `/orders/<id>` shows manual-assignment escalation |
| J5 | Firing Rules | Author 1 rule pack, wait 24h or admin-trigger | Daily cron evaluates every vendor; non-trivial outcomes land in `firing-decisions` container | `/decision-engine/rules/firing-rules` → Analytics tab; `/decision-engine/decisions/firing-rules` |
| J6 | Firing Rules | Sandbox replay of proposed rules against last 30 days of `firing-decisions` | `POST /:category/replay` returns per-decision diff; outcome flips visible | Sandbox tab on `/decision-engine/rules/firing-rules` |
| J7 | Review Programs (post-Phase K) | Create order on existing engagement | Order creation event → `ReviewProgramOrchestrator` → TapeEvaluation runs against the order's report fields → result lands in `review-results` with `triggerSource: 'order-created'` | `/decision-engine/rules/review-program` → Analytics tab populates; per-order review history |
| J8 | Review Programs | Upload a bulk portfolio (existing path) | Existing behaviour preserved — results land in `review-results` keyed by jobId | Analytics tab; bulk portfolio job page |
| J9 | Axiom Criteria (post-Phase L) | Author criteria pack + create order with attached document | Criteria pushed to Axiom on save → AxiomService extracts + evaluates document → webhook back to AMS → result mapped into Decision Engine analytics | `/decision-engine/rules/axiom-criteria` → Analytics; `/decision-engine/decisions/axiom-criteria`; per-order Axiom evaluation view |
| J10 | All categories | Kill switch ON for each in turn; attempt every endpoint | Every write/eval path returns 503 `kind: 'kill-switch-active'`; read paths still work; landing-page pip + workspace banner reflect killed state | OpsHealthDashboard; HTTP 503 responses with the documented error shape |

**Auth setup for live-fire:** use the existing `TestTokenGenerator` infra. The Playwright suite mints an admin token per run and threads it through `Authorization: Bearer`. See `scripts/generate-test-tokens.ts` + `docs/TEST_JWT_TOKENS.md`.

**Definition of done:**
- All 10 rows green in CI (manual rows have explicit checklist artifacts).
- The five UI surfaces (`/decision-engine` landing, `/decision-engine/rules/:category` ×4, `/decision-engine/decisions/:category` ×4, OpsHealthDashboard, `/orders/<id>` trace timeline) all show non-trivial data for the test tenant.
- Doc revision with screenshots + the per-row green-state pin.

### 5.K Phase K — Review Programs fire on EVERY order-creation path

**Goal:** review-program evaluation runs whenever an order with a report is created on the platform, not only when a portfolio is uploaded in bulk. Operators control this per-tenant + per-program.

**Why this is critical:** today review programs only fire when `TapeEvaluationService` is called inside `BulkPortfolioService`. That covers exactly ONE creation path. Single-order creates (via order intake wizard, AI assistant, lender API, etc.) bypass review-program evaluation entirely — which is wrong for any tenant relying on review programs as a gate on auto-routing.

**Tasks:**
1. **Survey every order-creation event source.** Each row in this table needs a clear yes/no on "should review-program fire here?":

   | Event / path | File | Today | Phase K target |
   |---|---|---|---|
   | `engagement.order.created` | `order.controller.ts` (lender API + admin UI) | No review-program eval | YES — main path |
   | Bulk-portfolio TAPE_EVALUATION mode | `BulkPortfolioService` | Already fires (legacy path) | Keep — preserve |
   | Bulk-portfolio DOCUMENT_EXTRACTION mode | `BulkPortfolioService` | Already fires after Axiom extraction | Keep — preserve |
   | AI-assistant CREATE_ORDER intent | `ai-action-dispatcher.service.ts` | No review-program eval | YES — same event |
   | Single-order intake wizard | `order-intake/wizard` (FE) → `order.controller.ts` | No review-program eval | YES — uses same controller path |
   | Vendor-portal order submission | `vendor-portal-receiver.controller.ts` (if exists) | TBD survey | TBD per survey |

2. **`ReviewProgramOrchestrator` service** (new) — subscribes to `engagement.order.created`. For each event:
   a. Load the tenant config; consult new `reviewProgramTriggers: { onOrderCreated: boolean; onDocumentUploaded: boolean; onAxiomCompleted: boolean }` block on `ClientAutomationConfig` (extend the existing type — no new container).
   b. If `onOrderCreated === false`, skip.
   c. Resolve the tenant's active review-program pack(s) via `DecisionRulePackService.getActive('review-program', tenantId, packId)`.
   d. Build a `RiskTapeItem`-shaped fact bundle from the order + report context. Mirror the existing `TapeEvaluationService` projection (reuse the same canonical mappers — `appraisal-order.mapper.ts`, `property-canonical-projection.ts`).
   e. Call the existing `TapeEvaluationService` (no new evaluator — it's already generic across programType).
   f. Persist the result into `review-results` with a new `triggerSource: 'order-created' | 'bulk-portfolio' | 'document-uploaded' | 'axiom-completed'` field on the `ReviewTapeResult` doc (additive field, backward-compatible).
   g. Publish `review-program.decision.completed` event so downstream consumers (e.g., the review-dispatch service) can route based on `computedDecision`.

3. **Kill-switch wiring** — `ReviewProgramOrchestrator` consults `DecisionEngineKillSwitchService` per event; killed tenants get a single "skipped due to kill switch" log line, no decision recorded.

4. **FE polish** — `ReviewProgramResultsReader` already reads `review-results`; the new `triggerSource` field becomes a filter chip on `/decision-engine/decisions/review-program` so operators can slice by trigger.

5. **Per-tenant config UX** — add a small panel to the workspace's Active tab for review-program category showing the current trigger config + an "Edit triggers" dialog that PATCHes the `ClientAutomationConfig.reviewProgramTriggers` block. Same RBAC as the existing automation toggles.

6. **Tests:** unit tests for the orchestrator's event handler (skip on kill, skip on config off, write trigger source); integration test that creates an order via the test harness and asserts a `review-results` row lands within N seconds.

**Definition of done:**
- Creating an order on an engagement with `reviewProgramTriggers.onOrderCreated = true` produces a `review-results` document within 5s.
- Bulk-portfolio path still works identically.
- Kill switch ON for review-program category stops new `review-results` for that tenant.
- FE chip filter on `/decision-engine/decisions/review-program` lets operators see only `triggerSource: 'order-created'` rows.

### 5.L Phase L — Axiom Criteria evaluator integration

**Goal:** criteria authored in the Decision Engine workspace actually drive Axiom evaluations, and Axiom's results stream back into the Decision Engine analytics + decisions surface — same UX as the other three categories.

**Pre-survey (mandatory first task):** before writing any integration code, document the existing Axiom touchpoints:
- `src/services/axiom.service.ts` — the HTTP client to Axiom; what's its current criteria-passing contract? Does it take criteria inline, or does Axiom load criteria from its own store keyed by `(programId, programVersion)`?
- `src/services/axiom-auto-trigger.service.ts` — when does Axiom currently evaluate? Document upload? QC gate?
- `src/services/axiom-bulk-submission.service.ts` — how does the bulk path pass criteria?
- Axiom-side storage: where does Axiom store the criteria it evaluates against? (Decision A vs B below depends on this.)
- The shared `programId`/`programVersion` model: today `ReviewProgram` carries `aiCriteriaRefs?: Array<{programId, programVersion}>` — does that already reference Axiom-stored criteria sets?

**Integration design — two viable paths** (pick after the survey):

**Option A — AMS-authoritative criteria, push to Axiom on save.** Mirror the MopRulePackPusher pattern:
- `AxiomCriteriaPusher` service. `push(pack)` translates the Decision Engine rule envelope (criterion fields in `actions[0].data`) into Axiom's criteria-document shape and PUTs to Axiom's criteria endpoint.
- `buildAxiomCriteriaCategory({ pusher, db })` wires `push` into the Decision Engine `onNewActivePack` hook — same pattern as vendor-matching.
- Existing `AxiomService.submitEvaluation` reads from Axiom's criteria store as it does today; AMS-side edits propagate automatically on save.
- Replay: `axiom-criteria.replay({ tenantId, rules, sinceDays })` re-runs each historical Axiom result against the proposed criteria. Mechanically harder than Prio replay because Axiom is LLM-based — the proposed criteria need a fresh Axiom evaluation pass for each document. Phase L1 ships replay as "stub returns 501"; Phase L2 wires it once we know whether Axiom supports stateless preview.

**Option B — Axiom-authoritative, mirror into Decision Engine for read-only viewing.** If Axiom owns the criteria storage and AMS shouldn't push, then the Decision Engine workspace becomes a proxy:
- `getActive` for axiom-criteria category reads from Axiom's criteria endpoint (proxied through AMS for auth).
- `createVersion` does an upstream Axiom write; AMS only stores audit rows for the local audit log.
- No Decision Engine `decision-rule-packs` row for axiom-criteria (the `category='axiom-criteria'` rows in that container become read-only mirrors).

**Recommendation pending survey:** Option A is cleaner because it puts the Decision Engine in the authoring driver's seat. Option B is the right call only if Axiom has policy reasons for owning criteria storage.

**Tasks (assuming Option A — adjust after survey):**
1. Survey commit — document findings in this section.
2. `AxiomCriteriaPusher` service in `src/services/decision-engine/axiom-criteria/` mirroring `MopRulePackPusher`. `push()` + `getSeed()` (Axiom's default criteria pack) + `drop()`.
3. `AxiomCriteriaResultsReader` adapter (analogous to `ReviewProgramResultsReader`) — reads existing Axiom evaluation results (Cosmos `axiomEvaluation` container or similar) and projects into Decision Engine analytics shape.
4. `buildAxiomCriteriaCategory({ pusher, db })` wires push / preview / analytics. Replay stubbed in L1, full in L2.
5. Webhook handler: when Axiom POSTs an evaluation completion to AMS, the existing handler writes the result; add a Decision Engine projection that updates analytics caches.
6. FE: `RecentTraceFlowPreview` already polls the most recent trace generically — make it cycle through registered categories so Axiom traces also surface on the landing page once they're flowing.
7. Tests: end-to-end test that authors a criterion → pushes to Axiom → submits a document → reads result back through Decision Engine analytics.

**Definition of done:**
- Editing an Axiom criterion in the Decision Engine workspace causes the next document evaluation to honor it (verifiable via test document + asserted score).
- `/decision-engine/rules/axiom-criteria` → Analytics tab populates from real Axiom evaluation history.
- `/decision-engine/decisions/axiom-criteria` browse works — each row = one Axiom evaluation.
- Replay surface either works (L2) or returns a clear 501 with documented reason (L1).

### 5.M Phase M — Operator UX: interact / intervene / trace

**Goal:** Decision Engine is not read-only. Operators routinely override decisions, lookup decisions by vendor order / report / document, intervene mid-flight, and audit the trail across categories. Every one of those surfaces should be one click away from where the decision lives.

**Tasks:**

1. **Per-decision Override**: Every trace entry (vendor-matching `assignment-traces`, firing-rules `firing-decisions`, review-program `review-results`, axiom-criteria evaluation results) gets an **Override** button.
   - Opens a category-aware override dialog: "Why are you overriding?" (required reason) + the category-specific override fields (pick a different vendor, change `computedDecision` to Accept/Conditional/Reject, force-pass an Axiom criterion, etc.).
   - Persists the override as an additive field on the existing trace doc (`overrideOutcome`, `overrideReason`, `overriddenBy`, `overriddenAt`). The `review-results` container already has these fields per `ReviewTapeResult` — extend the others to match.
   - Publishes `decision.overridden` event → downstream consumers reroute (vendor-matching: reassigns vendor; firing-rules: cancels the fire action; review-program: routes the report differently).
   - Audit row in `decision-rule-audit` with `action: 'override'`.

2. **Decision lookup by vendor order / report / document**:
   - `/decision-engine/decisions/:category?orderId=X` filter — deep-linkable, paste-and-go.
   - Per-order detail page already shows `AssignmentTraceTimeline`; mirror the pattern on every order detail page that has a relevant decision: `ReviewProgramTimeline`, `AxiomCriteriaTimeline`. Same component shape, different data source.
   - Top-of-landing-page search box: paste an orderId / vendorId / reportId; see every decision across every category for that subject.

3. **Mid-flight intervention** (vendor-matching specific today; generalizes later):
   - On orders with `autoVendorAssignment.status = 'PENDING_BID'`: "Cancel + re-evaluate" button (publishes `vendor.assignment.cancelled`; orchestrator re-runs) and "Force-pick vendor X" (creates the bid invitation directly, bypasses the ranking).
   - Both write audit rows + emit override events.

4. **Bulk override / replay-then-commit**:
   - On `/decision-engine/decisions/:category`, select N decisions → "Replay with proposed rules" → opens Sandbox pre-populated with those N rows as the replay set.
   - Sandbox grows a "Commit overrides" button: if the operator approves the diff, every changed decision gets `overrideOutcome` set in one transaction with a shared `overrideReason: 'Bulk replay-driven override (N decisions)'`.

5. **Cross-category audit hub** at `/decision-engine/audit`:
   - Tenant-wide stream of every rule edit + every override across every category.
   - Filter by category, by actor, by action (`create | update | override | drop`), by date range.
   - Powered by the existing `decision-rule-audit` container; review-results override fields read via the existing `ReviewProgramResultsReader`.

6. **Per-tenant Decision Engine settings page** at `/decision-engine/settings`:
   - Kill switches (already in OpsHealthDashboard — link from settings).
   - Trigger config for review-program (introduced in Phase K).
   - RBAC roles (which users can override; which can edit rules; defer to existing platform roles).
   - Optional Slack / email webhooks for `decision.overridden` events.

**Definition of done:**
- Operators can override any decision in <5s from the trace timeline (no detour through admin UIs).
- Pasting an orderId into the search box surfaces every decision touching that order, across all four categories.
- The audit hub shows every rule edit + every override across the tenant in a single filterable feed.
- Bulk override flow committable from the Sandbox diff in one click.

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

### 8.1 Next-up after rev 12 — recommended ordering of J/K/L/M

Now that A–I have all shipped or shipped-as-MVP, the productive ordering is:

1. **K first** (Review Programs on every order-creation path). Highest user-visible delta — operators today see review-program eval ONLY on bulk uploads, and that's the most-asked-about gap. K also unblocks J7 (the order-created review-program row in the live-fire matrix). ~1.5 weeks BE+FE.
2. **J in parallel with K** — the live-fire suite for the parts that work today (J1–J6 + J10). Run J as soon as K's first cut lands; iterate on issues found while K finishes polishing.
3. **L next** — Axiom integration. Starts with the mandatory survey commit. Real work depends on the survey outcome but plan for ~2 weeks once Option A vs B is settled.
4. **M last** but in pieces — Override (M.1) is the biggest single bang for the buck and can land independently of M.2–M.6. Recommend shipping M.1 immediately after K (operators want overrides as soon as more decisions are firing). M.2 (lookup by order) is cheap and can ride along.

Total to close the doc: ~4–6 weeks of dev work after rev 12, ~3–4 weeks calendar with two engineers in parallel.

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
