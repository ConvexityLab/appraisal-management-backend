# L1 Risk Stack vs Veros VeroScore — Capability Comparison

> Snapshot date: 2026-05-15. Tracks the public Veros press release on VeroScore
> for UAD 3.6 against the L1 risk surfaces in production today: vendor
> scorecard rollup, UAD-3.6 report compliance score, and property field
> diff. Revisit when Veros publishes API docs or product detail beyond
> the marketing material.
>
> What changed since the 2026-05-13 cut: the two items previously listed as
> "where Veros is ahead" — UAD-3.6 per-report compliance score and
> claim-vs-public-records field diff — have shipped. The competitive picture
> is now "three complementary L1 surfaces" against VeroScore's single
> per-report number.

## TL;DR

L1 has **three distinct risk surfaces**; VeroScore is a single per-report
number. They are not directly comparable feature-for-feature — L1 emits
richer signals that the QC reviewer, the auto-assignment matcher, and
downstream ML can all consume.

| Surface | What it scores | Input | Output | Consumer |
|---|---|---|---|---|
| **UAD-3.6 Compliance** (closest to VeroScore) | The **appraisal artifact** — required fields, federal-spec rules, custom tenant rules | One canonical extraction snapshot per report | Per-report 0-100 score + per-rule pass/fail + CRITICAL blocker list | QC reviewer (badge on QC detail) |
| **Property Field Diff** | The **claimed vs reality** gap | Canonical extraction + Bridge/ATTOM public records | Per-field MATCH / MINOR / MAJOR / MISSING_* with tolerance bands | QC reviewer (panel on order detail) |
| **Vendor Scorecard Rollup** | The **vendor relationship** over time | Trailing window of completed orders + reviewer scorecards + derived signals | Per-vendor blended overallScore + tier (PLATINUM…PROBATION) | AMS auto-assignment, vendor management, ops dashboards |
| _VeroScore_ | _Appraisal artifact_ | _Report + comparables + public records_ | _Single proprietary score per report_ | _Lender QC, secondary market, risk officer_ |

The competitive question isn't "match VeroScore's single number" — we
emit a structured rule-by-rule report instead. The competitive picture
is: **VeroScore makes the artifact more reviewable; the L1 stack makes
the artifact more reviewable AND the vendor more steerable AND the data
more reusable for downstream ML.**

---

## Surface 1 — UAD-3.6 Compliance Score

**Status:** shipped. Powered by `UadComplianceEvaluatorService` running
over the canonical extraction snapshot for an order; route is
`GET /api/orders/:orderId/uad-compliance`.

### What we score

A curated catalogue of UAD-3.6 / URAR v1.3 compliance rules over the
extracted canonical document:

- **CRITICAL** (report unusable without): subject address completeness,
  ≥3 comparable sales, comp sale prices + dates, final reconciled value,
  effective date of value, appraiser identity + signature date.
- **HIGH** (report usable but materially incomplete): subject GLA, year
  built, bedroom count, baths-full + baths-half split (UAD 3.6 split
  requirement), condition C-rating, quality Q-rating, lot size.
- **MEDIUM** (reportable detail, often filled by enrichment): subject
  APN, comp GLA values, appraiser license info.

Output: `{ overallScore: 0-100, passCount, failCount, blockers: ruleId[],
rules: [{id, label, severity, passed, message, fieldPath?}] }`. Score is
severity-weighted (CRITICAL=10, HIGH=4, MEDIUM=1) so one CRITICAL fail
dominates the result. The QC review header surfaces the score as a chip
with a tooltip listing CRITICAL blockers.

### Where we are ahead of VeroScore on artifact scoring

**1. Admin-authored per-tenant overrides.** VeroScore is a single
proprietary algorithm. Our rules live in the Decision Engine pack store
(`/admin/decision-engine/rules/uad-compliance`) with per-tenant BASE +
per-client overlay packs. Admins can:

- Disable rules that don't apply per scope (e.g., a tenant that doesn't
  underwrite ground-up construction can turn off year-built checks).
- Raise or lower severity (a tenant policy can make APN a CRITICAL blocker).
- Replace remediation copy with the tenant's own vocabulary.
- Add **fully custom rules with JSONLogic predicates** against the
  canonical document for tenant-specific checks outside the
  federal-spec catalogue.

The pack is versioned + audited per the generic Decision Engine surface
(immutable rule packs, full audit trail, replay-ready); admins author a
new version rather than mutating the active one.

**2. Per-client overlay.** BASE pack covers the tenant default; a
`client:<clientId>` pack overlays per-client carve-outs. The resolver
layers BASE → CLIENT at compute time, replacing whole entries (not
field-merging) so the configuration semantics are predictable.

**3. Structured output.** Reviewers see the score AND the rule-by-rule
breakdown AND the canonical schema field path for each failure (so a
deep-link to the relevant editor section is possible). VeroScore's
public output is a single number.

**4. Source-of-truth catalogue endpoint.** The FE editor renders rule
rows from `GET /api/uad-compliance/catalogue` — there's no hand-mirrored
client-side rule list. Adding a built-in rule on the BE surfaces on the
FE on the next cache miss with zero FE edit.

**5. Failure-mode hardening.** Custom-rule predicate errors are caught
and surfaced as a rule-level failure (`"Custom rule evaluation error:
... Edit this rule in /admin/decision-engine"`), never propagating to
the order-level compliance call. The category validator enforces a
nesting-depth cap on conditions (32 levels) so a malformed payload
can't stack-overflow the recursive evaluator.

### Where VeroScore may still be ahead

- **ML training data on appraisal artifact quality.** VeroScore has years
  of historical accept/reject signals to tune against; we have a fresher
  rule set + audit log per evaluation but less calibration data.
- **Public records cross-check baked into the same score.** VeroScore
  appears to fold public-records signals into the report score; we
  emit those as a separate surface (see Surface 2 below). For sales
  positioning, "one number" is easier to communicate than "two
  panels" even when the structured output is more useful operationally.

---

## Surface 2 — Property Field Diff (Claim vs Public Records)

**Status:** shipped. Powered by `PropertyFieldDiffService` running on
demand over the latest canonical snapshot + latest property enrichment;
route is `GET /api/orders/:orderId/property-field-diff`.

### What we score

A per-field comparison between the appraiser's reported subject-property
values (claim, from the canonical extraction) and the public-records
enrichment (Bridge / ATTOM). Each field gets a verdict + rationale:

- **MATCH** — within tolerance band.
- **MINOR_MISMATCH** — between minor and major thresholds.
- **MAJOR_MISMATCH** — beyond the major threshold; investigate.
- **MISSING_CLAIM** — appraiser didn't state this value.
- **MISSING_PUBLIC_RECORD** — public records didn't include this value.

Tolerance bands per field type:

- **Numeric**: percent-fraction bands. GLA: 5% MATCH / 10% MAJOR. Lot
  size: 10% / 20% (public records often round). Uses
  `max(claim, public) - 1` as denominator so the verdict is symmetric
  on value swap.
- **Discrete**: absolute deltas. Year built: ±1 MINOR (assessor lag).
  Bedrooms / full baths / half baths / stories: any difference MINOR,
  ≥2 MAJOR.
- **APN**: normalized exact match. Strips dashes / whitespace / case;
  any genuine difference is MAJOR (APNs are stable identifiers).

Output: `{ entries: [...], summary: {match, minorMismatch, majorMismatch,
missingClaim, missingPublicRecord}, snapshotAvailable, enrichmentAvailable,
publicRecordSource, publicRecordFetchedAt }`. The order detail page
renders a side-by-side table under the existing Bridge Enrichment Data
block.

### Where we are ahead

- **Distinguishes "appraiser didn't state" from "no public record"** so
  the reviewer's next action differs accordingly. VeroScore's
  public output collapses both into "unverified".
- **Per-field rationale** is shown in a tooltip on the verdict chip
  ("Off by 23% — beyond the 20% threshold"). The reviewer can act on
  the disagreement without leaving the page.
- **Partial data states** are first-class. Three distinct empty-state
  messages: neither side loaded, extraction pending, public records
  unavailable for this property. The panel stays useful while the
  upstream pipelines fill in.
- **Stateless compute** keeps the diff in sync with whichever
  extraction + enrichment is current. No third copy of the same data
  to drift; no schema change to maintain.

### Where VeroScore may still be ahead

- **Multi-source public records.** We currently pull from Bridge /
  ATTOM. VeroScore aggregates additional sources; deeper coverage
  outside major MLS regions is plausible.
- **Photo cross-check.** VeroScore mentions photo analysis; we don't
  cross-check claimed photos against external imagery yet.

---

## Surface 3 — Vendor Scorecard Rollup (David's algorithm)

**Status:** shipped. Powered by `VendorPerformanceCalculatorService`
resolving per-tenant `ScorecardRollupProfile` packs; admin UI at
`/admin/scorecard-rollup`.

### What we score

The vendor relationship, not the artifact. A trailing window of completed
orders + reviewer scorecards + derived signals (revisions, late
deliveries, reassignments) blends into a per-vendor overallScore (0-100)
and tier (PLATINUM / GOLD / SILVER / BRONZE / PROBATION).

### Where we are ahead

**1. Per-tenant configurability.** VeroScore is a single proprietary
score. Our scorecard is **per-tenant authored** through
`/admin/scorecard-rollup`:

- **Category weights** (Report / Quality / Communication / Turn Time
  / Professionalism) sum to 1; admin sliders preserve the invariant via
  renormalization.
- **Hard gates** ("clamp tier to BRONZE if Quality < 4") cap a vendor's
  tier if a critical category is weak. Multiple gates compose; the
  strictest applicable one wins.
- **Penalties** (revision_count, late_delivery_days, reassignment_count)
  shave from the overall score, capped per signal.
- **Tier thresholds** (PLATINUM/GOLD/SILVER/BRONZE) are tenant-specific.
- **Window + time decay** — trailing 25 orders by default with optional
  half-life decay so recent performance weighs more.
- **JSONLogic escape hatch** (`customFormulaOverride`) for the rare
  client that needs an exotic algorithm.

A different lender (DVR vs full appraisal vs review-only) gets a
different algorithm via the overlay cascade — BASE → CLIENT → PRODUCT
→ CLIENT_PRODUCT × phase × version. Veros has no analog to per-client
algorithm authoring.

**2. ML-ready event stream.** Every scorecard write fires
`vendor-scorecard.created`, which lands a denormalized row in the
`scorecard-events` Cosmos container with full context at scoring time:

- Raw 5-category scores + computed overall
- Order context (productType, clientId, programId, dueDate, deliveredAt)
- Vendor prior tier + prior overallScore
- Derived signals (revisionCount, daysLate)
- The **rollup-profile id chain in force at scoring time** (so ML
  training joins know which algorithm version produced each score)

VeroScore's training set is internal to Veros. Our training set is the
customer's own data, attributable to the algorithm version in force,
ready to feed a downstream model.

**3. Auto-seed BASE profile.** First time `resolveProfile` runs for a
new tenant with no doc, we idempotently seed a `BASE/ANY/v1` profile
mirroring `DEFAULT_BASE_PROFILE`. Admins land on the editor with an
editable starting point instead of an empty list. The seed is logged
in the audit trail with actor `system:auto-seed`.

**4. Versioned + audited.** Every save creates a new version; the
prior version is deactivated, not overwritten. The audit trail records
the actor, scope, phase, version, and whether a custom formula was
attached. Veros's marketing material doesn't mention versioning
customer-visible scoring rules — likely because customers don't see them.

---

## The three surfaces in one picture

| Signal that's bad | UAD-3.6 surface says | Property Diff says | Scorecard surface says |
|---|---|---|---|
| Wrong APN reported | (silent — APN is MEDIUM, no blocker) | MAJOR mismatch on parcelNumber | Eventually drops Quality category score after QC scorecard lands |
| Missing comp sale price | CRITICAL blocker (`comps-sale-prices-present`) | (n/a — different surface) | Triggers revision; revision_count penalty kicks in over time |
| GLA off by 18% vs public records | (no built-in rule on GLA cross-check) | MAJOR mismatch on grossLivingArea | Eventually drops Quality score after reviewer flags it |
| Appraiser late on 4 of last 25 orders | (n/a — vendor signal, not artifact) | (n/a) | `late_delivery_days` penalty + Turn Time category score drop; tier clamp possible |

Each surface catches what the others don't. Together they cover the
artifact, the data, and the relationship.

---

## Sales positioning

When a buyer asks "do you do what VeroScore does?", the structured
honest answer is now:

> Yes for artifact compliance (Surface 1, with admin-authored per-tenant
> overrides VeroScore doesn't expose), yes for public-records cross-check
> (Surface 2, with per-field rationale and distinct missing-side
> verdicts), and we also score the **vendor relationship** over time
> (Surface 3, which VeroScore doesn't do at all). VeroScore is one
> proprietary number per report; we emit three structured surfaces
> reviewers, the matcher, and ML can all consume.

Before: VeroScore appeared to outpace us on artifact + public-records
checks. After this round: those gaps are closed. The remaining
positioning risk is "VeroScore has more historical calibration data"
which we close through usage at the tenants who deploy us.

---

## Next steps (separate from this PR)

1. **Marketing one-pager** that walks through the three-surface picture
   above and contrasts it with single-vendor VeroScore. The buyer's
   instinct is to compare "their number" to "our number"; the one-pager
   needs to reframe that to "their number" vs "our three structured
   signals."
2. **Photo cross-check** to close the remaining gap on Surface 2.
   Likely a separate Decision Engine category consuming photo
   embeddings against vendor-supplied imagery.
3. **Compliance score historical trace** — persist the per-report
   UAD-3.6 compliance score on a small Cosmos container keyed
   (orderId, packVersion, computedAt) so the FE can show "score after
   this revision: 87, was 64" on the order detail page. Today the
   score is recomputed on every GET and isn't trended.
