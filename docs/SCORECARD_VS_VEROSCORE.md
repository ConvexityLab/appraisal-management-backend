# L1 Vendor Scorecard vs Veros VeroScore — Capability Comparison

> Snapshot date: 2026-05-13. Tracks the public Veros press release on VeroScore
> for UAD 3.6 vs. our admin-driven vendor scorecard rollup. Revisit when Veros
> publishes API docs or product detail beyond the marketing material.

## TL;DR

These two products score **different things**:

| | VeroScore (Veros) | L1 Vendor Scorecard |
|---|---|---|
| **What it scores** | The **appraisal artifact** — does the report's data look defensible, internally consistent, UAD 3.6 compliant? | The **vendor relationship** — across many orders, how reliable / accurate / responsive has this appraiser been? |
| **Input** | One report + comparables + public records. | A trailing window of completed orders + reviewer scorecards + derived signals (revisions, late deliveries, reassignments). |
| **Output** | Per-report risk / confidence score. | Per-vendor blended overallScore (0-100) + tier (PLATINUM/GOLD/SILVER/BRONZE/PROBATION). |
| **Consumer** | Lender QC, secondary market, regulator-facing risk officer. | AMS auto-assignment, vendor management, ops dashboards. |
| **Lifecycle** | Computed once per report (or on revision). | Recomputed continuously as new scorecards / orders land. |

They are **complementary**. A vendor with great per-order VeroScores can still
have terrible turn time and miss deadlines — our scorecard catches that. A
fast vendor with weak quality flags from VeroScore should still score worse
in our system, because reviewer Quality scores will be lower. Both signals
belong in the same risk picture; neither replaces the other.

The competitive question isn't "beat VeroScore at appraisal-artifact scoring"
(that's their long-standing analytics lane). The competitive question is
"give an AMS operator a richer, more configurable, ML-capable view of vendor
quality and reliability than anyone else." That's where we're ahead.

---

## Where we are ahead

### 1. Per-tenant configurability (David's algorithm)

VeroScore is a single proprietary score. The press release calls out
UAD 3.6 compliance heuristics and public-records checks, but customers don't
adjust the weights.

Our scorecard is **per-tenant authored** through `/admin/scorecard-rollup`:

- **Category weights** (Report / Quality / Communication / Turn Time / Professionalism) sum to 1; admin sliders preserve the invariant via renormalization.
- **Hard gates** ("clamp tier to BRONZE if Quality < 4") cap a vendor's tier if a critical category is weak. Multiple gates compose; the strictest applicable one wins.
- **Penalties** (`revision_count`, `late_delivery_days`, `reassignment_count`) shave from the overall score, capped per signal.
- **Tier thresholds** (PLATINUM/GOLD/SILVER/BRONZE) are tenant-specific.
- **Window + time decay** — trailing 25 orders by default with optional half-life decay so recent performance weighs more.
- **JSONLogic escape hatch** (`customFormulaOverride`) for the rare client that needs an exotic algorithm — we evaluate the fixed-shape parameters AND the override.

A different lender (DVR vs full appraisal vs review-only) gets a different
algorithm via the overlay cascade — BASE → CLIENT → PRODUCT → CLIENT_PRODUCT
× phase × version. Veros has no analog to per-client algorithm authoring.

### 2. ML-ready event stream

Every scorecard write fires `vendor-scorecard.created`, which lands a
denormalized row in the `scorecard-events` Cosmos container with **full
context at scoring time**:

- Raw 5-category scores + computed overall
- Order context (productType, clientId, programId, dueDate, deliveredAt)
- Vendor prior tier + prior overallScore
- Derived signals (revisionCount, daysLate)
- The **rollup-profile id chain in force at scoring time** (so ML training
  joins know which algorithm version produced each score)

This is intentionally separate from `order.scorecards[]` (which is the live
operational source of truth). The events stream is append-only, partitioned
by tenantId, with composite indexes for the common ML join shapes
(`vendorId + reviewedAt`, `productType + reviewedAt`, `reviewedBy + reviewedAt`).

VeroScore's training set is internal to Veros. Our training set is the
customer's own data, attributable to the algorithm version in force, ready
to feed a downstream model. That's a structural advantage for any tenant
who wants to build a custom routing model.

### 3. Auto-seed BASE profile

First time `resolveProfile` runs for a new tenant with no doc, we
idempotently seed a `BASE/ANY/v1` profile mirroring `DEFAULT_BASE_PROFILE`.
Admins land on the editor with an editable starting point instead of an empty
list. The seed is logged in the audit trail with actor `system:auto-seed`.

### 4. Versioned + audited

Every save creates a new version; the prior version is deactivated, not
overwritten. The audit trail records the actor, scope, phase, version, and
whether a custom formula was attached. Veros's marketing material doesn't
mention versioning customer-visible scoring rules — likely because customers
don't see them.

---

## Where Veros is ahead (or appears to be)

These are gaps to close in adjacent systems, **not** the vendor scorecard:

### 1. UAD 3.6 compliance heuristics

VeroScore says "first system to leverage the new UAD 3.6 dataset." Our
Decision Engine and Axiom integration consume the UAD 3.6 dataset but we
don't currently expose a per-report compliance score the reviewer can read.

Where this fits in our stack: **Decision Engine + Axiom**, not the vendor
scorecard. A "report compliance score" would be a Decision Engine output
that the QC reviewer sees on the order detail page. We can derive it from
the same Axiom extraction pipeline that already runs.

### 2. Public-records cross-check

VeroScore claims it cross-checks subject-property data against public
records. Same fit: this is property intelligence / decision engine
territory. We have BatchData + Census + Bridge already feeding into
property intel; surfacing a "claim vs public-record" diff per appraisal
field is the missing piece.

### 3. Single proprietary score per report

VeroScore distills compliance into one number. Our equivalent would be:
"Decision Engine confidence score per report." That's adjacent work, not
vendor scorecard work.

---

## Risks to flag

- **Confusion in sales conversations**: a buyer might hear "scorecard" and
  assume report-level scoring. The admin UI labels matter: page title is
  **"Scorecard Algorithm"**, scoped under admin tools, not the QC flow.
- **Decision-Engine compliance score is a separate roadmap item**: if a
  customer asks "do you do what VeroScore does?" the honest answer is "for
  the vendor / appraiser, yes and more deeply; for the report artifact, we
  consume UAD 3.6 in Axiom + Decision Engine but don't surface a single
  compliance number yet — that's on the Decision Engine roadmap."

---

## Next steps (separate from this PR)

1. Decision Engine: derive a per-report UAD-3.6 compliance score from
   the Axiom extraction output. Surface it on QC review.
2. Property Intelligence: claim-vs-public-records field-level diff,
   either as a Decision Engine rule pack output or a dedicated panel.
3. Marketing one-pager that positions L1 vendor scorecard alongside (not
   against) a future L1 report compliance score, and contrasts both with
   single-vendor VeroScore.
