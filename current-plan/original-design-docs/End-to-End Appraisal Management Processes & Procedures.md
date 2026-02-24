**End-to-End Appraisal Management Processes & Procedures**

**Client onboarding & compliance setup**

*   Execute MSA/SOW; load credit box, product menus, SLAs, fees, and escalation contacts.
*   Configure AIR/Dodd-Frank independence rules; add appraiser blocking rules and conflict checks.
*   Set invoice model (borrower-pay, client-bill, split), tax handling, and PCI/payment gateway.
*   Map delivery formats (PDF + MISMO XML; UCDP/EAD/EVO as needed).
*   Create ROV policy and template; define timeframes and evidence requirements.
*   Train client/broker users on order portal; set up API if using Encompass/Mercury/LOS.

**Order intake & acknowledgment**

*   Intake via portal/API/email; auto-acknowledge within SLA (e.g., 1–2 hrs).
*   Validate address/APN, property type, occupancy, transaction type (purchase/refi/SFR/DSCR), rush or special conditions.
*   Screen for PIW/ACE/waiver eligibility (if applicable) to avoid unnecessary orders.
*   Confirm due date, contact info, access instructions, and HOA/tenant constraints.

**Product selection & risk triage**

*   Determine appropriate product: 1004/URAR, Desktop/Hybrid, 1073 Condo, 1025 2–4, 1004D, BPO (ext/int), Evaluation, DVR/Field Review (2000/2000A), STR Feasibility, Rent comp (1007/216), Small-balance commercial when applicable.
*   Run pre-assignment risk screen: rural/complex, high-value, waterfront/view, new construction, condo litigation, comp scarcity, fraud red flags (rapid resale, related-party).
*   If risk high → require supporting add-ons (photos, inspection, permit report) or escalate product (e.g., from Desktop → Interior).

**Quote, payment & borrower comms**

*   If borrower-pay: send secure payment link; enforce collection before assignment unless client policy overrides.
*   If client-bill: confirm PO/fee schedule; note changes for change-in-scope.
*   Provide intro email/SMS to borrower with what to expect and timelines; capture any black-out dates for access.

**Vendor panel management (standing SOP)**

*   Credentialing: license verification, E&O coverage, background/disciplinary checks, W-9, ACH.
*   Geographic competency & product competency tagging (luxury view, rural, 2–4, condo, small-balance CRE).
*   Performance scorecards: turn time, revision/defect rate, CU/SSR risk, client CSAT.
*   Rotation + performance-based routing; avoid steering/reuse that violates AIR.

**Assignment & engagement**

*   Select 2–3 eligible vendors; confirm fee & ETA; assign to the best match per rules.
*   Issue engagement letter: scope of work, AIR independence, due date/time zone, required exhibits (photos, sketch, floor plan, permit docs), change-order policy, contact protocol, revision policy, late penalties (if any).
*   Track acceptance; auto-reassign if no response within SLA.

**Inspection scheduling (when applicable)**

*   Vendor (or property data collector) contacts borrower within 24 hrs to schedule; record attempts and scheduled date/time.
*   Log access constraints (gated, tenants, lockbox, pets); capture HOA/parking details for condos.
*   If desktop/hybrid: dispatch PDC/inspector with photo and geo-tag requirements.

**Ancillary orders & data (as needed)**

*   Permit/record report, HOA docs, plat/survey, flood cert, views/amenity photos, STR feasibility, rent comp addendum (1007/216), cost approach for new builds, environmental screen (SB9/ADU, wildfire, flood).
*   Track ancillary SLAs; attach artifacts to the order record; notify appraiser.

**Work-in-process monitoring**

*   Status cadence: Accepted → Scheduled → Inspected → Drafting → Submitted.
*   Watch turn-time and milestone SLAs; nudge vendors at T-24/T-48 to due date.
*   Handle scope changes (complexity, extra units, outbuildings) with client approval and fee/time resets.

**Vendor submission (technical intake)**

*   Require PDF + MISMO XML (if applicable), sketch, photos, location map, comps map, certifications, engagement letter compliance.
*   Auto-run ingestion checks: file completeness, XML validity, photo count/types, signature/date, license/E&O match, geotag (if required).

**10) QC—multi-layer review**

**Level 1: Technical/UAD checks**

*   Missing fields, UAD codes, market conditions addendum, comp distance/time, net/gross adjustments, cost/math consistency.

**Level 2: Compliance/AIR**

*   No prohibited contact or attempt at value influence; scope matches order; proper assumptions/extraordinary assumptions are disclosed; occupancy, intended use/users correct.

**Level 3: Analytic & risk**

*   Comp selection appropriateness (view/lot utility), bracketing of GLA/bed/bath, time adjustments support, concessions, market trend consistency, fraud signals (EXIF anomalies, photo reuse, listing copy pasted).

**Level 4: Investor system checks (if applicable)**

*   **UCDP/SSR** (GSE) and/or **EAD** (FHA) submissions; review **CU/SSR** warnings; resolve hard stops with appraiser; capture SSR findings in the file.

**11) Client delivery**

*   Deliver via client’s portal/API/email with the agreed package: PDF, XML, SSR/EAD feedback, QC memo (if used), and invoice (if client-bill).
*   Update LOS status (Encompass/Mercury/Valuelink) to Delivered/Complete; log delivery timestamp and recipients.

**12) Revisions & ROVs (reconsideration of value)**

*   **Revision (defect/clarification)**: issue structured request referencing pages/lines; time-boxed turnaround (e.g., 24–48 hrs).
*   **ROV**: accept in policy format only (market-supported alt comps/data). Triage for merit, forward to appraiser without influence, track outcomes, and document rationale. Escalate to review appraiser when value change requested.
*   Maintain a full **audit trail** of all changes and communications.

**13) Billing & payables**

*   If borrower-pay: post payment; handle refunds/partials for cancelled orders per policy.
*   If client-bill: generate invoice; bundle monthly if contract requires; include SSR/EAD fees if pass-through.
*   **Vendor pay**: release on client acceptance or delivery + X days; ACH with remittance; 1099 at year-end.

**14) Post-delivery tasks**

*   **1004D/Final**: track completion/CO for “subject to” assignments; auto-remind client near project completion.
*   **Field/Desk Reviews**: trigger per variance thresholds, CU/SSR scores, or investor overlay.
*   **Archiving & retention**: store files securely per policy and state/federal requirements (e.g., 5–7 years).

**Risk, Fraud & Quality Controls (embedded)**

*   **Identity/geo checks** on inspection photos (EXIF/geo-hash), duplicate photo detection, date anomalies.
*   **Non-arm’s-length screen**: ownership chain, rapid resale, shared mailing addresses/LLC principals.
*   **Market stress flags**: rising MOI/DOM, price-cut rates, declining market note required.
*   **STR legality & use**: brief check where relevant (illegal use can impair value/marketability).
*   **Permit/GLA deltas**: reconcile MLS vs public record; require support or comment.
*   **Vendor rotation & COI**: prevent assignment to conflicted appraiser/agent; enforce cooling-off after complaints.
*   **Escalation paths**: complex rural/luxury → senior reviewer; fraud suspicion → compliance/legal.

**Status codes & typical SLAs (example)**

*   **New/Received (0–2 hrs)** → **Assigned (same day)** → **Accepted (≤24 hrs)** → **Scheduled (≤48 hrs)** → **Inspected (≤5 days)** → **Drafting** → **Submitted** → **QC (24–48 hrs)** → **Delivered**.
*   Rush tiers: **24–72 hr** deliverables (with fee premium and vendor confirmation).
*   Attempt cadence: **3 contact attempts** in 48–72 hrs before client alert.

**Engagement letter essentials (template cues)**

*   Scope (form, interior/exterior/desktop/hybrid), effective date, due date/time zone.
*   Required exhibits: sketch, floor plan/photos, market conditions addendum, rent schedule (if DSCR), STR note (if relevant).
*   Independence/law references (AIR, FIRREA, USPAP), no value targets, no prohibited terms.
*   Change-order policy and fee/time impacts; communication channel (portal only).
*   Security/PII handling and deliverables (PDF/XML/SSR/EAD).

**Vendor performance management**

*   Quarterly scorecards: turn time, revision rate, CU/SSR risk tier, defect rate, client CSAT.
*   Coaching for common defects; suspension for non-performance; recertification annually.
*   Geo/product expansion for high performers (luxury view/rural/2–4).

**Data security & privacy**

*   GLBA/PII controls; least-privilege access; audit logs; encryption at rest/in transit.
*   PCI scope for borrower payments; purge payment tokens after settlement.
*   Incident response and client notification protocol.

**Nice-to-have automations (high ROI)**

*   **Milestone nudges** (T-48/T-24) and automated reassign if no movement.
*   **Dynamic routing** (performance × competency × complexity).
*   **Change-in-scope wizard** (auto generate addendum + fee approval).
*   **Real-time QC bots** (UAD checks, comp/view mismatches, math/consistency).
*   **ROV intake form** enforcing evidence standards and timestamps.