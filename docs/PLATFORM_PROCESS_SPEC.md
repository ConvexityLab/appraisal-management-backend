# Risk-First Valuation & Appraisal Management Platform — Unified Process & Specification

## Executive Summary

This document unifies the business process, technical specification, and operational procedures for a next-generation, risk-first valuation and appraisal management platform. It combines:
- **Vision VMC × L1 Risk-First Valuation Platform** (product/AI/ML/analytics spec)
- **End-to-End Appraisal Management Processes & Procedures** (business ops)
- **Valuation and Appraisal Management Process Flow** (workflow)

The result is a single, actionable reference for product, engineering, compliance, and operations teams.

---

## 1. Platform Vision & Product Goals

- **Accuracy & Coverage**: Deliver value, range (P10/P50/P90), and confidence with calibrated coverage.
- **Risk Detection**: Identify fraud, non-arm’s-length transfers, flip inflation, illegal STR use, and declining markets.
- **Operational Efficiency**: Auto-route orders to the next-best product; surface only true exceptions.
- **Auditability**: End-to-end data provenance and action logs; reproducible outcomes for investor/regulator review.
- **Portfolio Insight**: Tape-level heatmaps, trendlines, and variance analytics for capital-markets clients.

---

## 2. End-to-End Appraisal Management Process

### 2.1 Client Onboarding & Compliance Setup
- Execute MSA/SOW; load credit box, product menus, SLAs, fees, escalation contacts.
- Configure AIR/Dodd-Frank independence rules; appraiser blocking/conflict checks.
- Set invoice model, tax handling, PCI/payment gateway.
- Map delivery formats (PDF, MISMO XML, UCDP/EAD/EVO).
- Create ROV policy/template; define timeframes, evidence requirements.
- Train users on order portal; set up API if using LOS.

### 2.2 Order Entry & Intake
- Intake via portal/API/email; auto-acknowledge within SLA.
- Validate address/APN, property type, occupancy, transaction type, rush/special conditions.
- Screen for PIW/ACE/waiver eligibility.
- Confirm due date, contact info, access instructions, HOA/tenant constraints.

### 2.3 Product Selection & Risk Triage
- Determine appropriate product (1004/URAR, Desktop, BPO, Evaluation, DVR, etc.).
- Run pre-assignment risk screen (rural/complex, high-value, fraud red flags).
- If risk high → require add-ons or escalate product.

### 2.4 Quote, Payment & Borrower Comms
- If borrower-pay: send secure payment link; enforce collection before assignment.
- If client-bill: confirm PO/fee schedule; note changes for change-in-scope.
- Provide intro email/SMS to borrower; capture blackout dates for access.

### 2.5 Vendor Panel Management
- Credentialing: license verification, E&O, background checks, W-9, ACH.
- Geographic/product competency tagging.
- Performance scorecards: turn time, revision/defect rate, CU/SSR risk, CSAT.
- Rotation + performance-based routing; avoid AIR violations.

### 2.6 Assignment & Engagement
- Select 2–3 eligible vendors; confirm fee & ETA; assign to best match.
- Issue engagement letter: scope, independence, due date, required exhibits, policies.
- Track acceptance; auto-reassign if no response within SLA.

### 2.7 Inspection Scheduling
- Vendor contacts borrower within 24 hrs; record attempts and scheduled date/time.
- Log access constraints; dispatch inspector if desktop/hybrid.

### 2.8 Ancillary Orders & Data
- Permit/record report, HOA docs, plat/survey, flood cert, STR feasibility, rent comp, cost approach, environmental screen.
- Track SLAs; attach artifacts to order; notify appraiser.

### 2.9 Work-in-Process Monitoring
- Status cadence: Accepted → Scheduled → Inspected → Drafting → Submitted.
- Watch turn-time and milestone SLAs; nudge vendors at T-24/T-48.
- Handle scope changes with client approval and fee/time resets.

### 2.10 Vendor Submission (Technical Intake)
- Require PDF + MISMO XML, sketch, photos, maps, certifications, engagement letter compliance.
- Auto-run ingestion checks: file completeness, XML validity, photo count/types, signature/date, license/E&O match, geotag.

### 2.11 QC—Multi-Layer Review
- **Level 1: Technical/UAD checks**: missing fields, UAD codes, market addendum, comp distance/time, math consistency.
- **Level 2: Compliance/AIR**: independence, scope, assumptions, occupancy, intended use/users.
- **Level 3: Analytic & risk**: comp selection, bracketing, time adjustments, fraud signals.
- **Level 4: Investor system checks**: UCDP/SSR/EAD submissions, warnings, findings.

### 2.12 Client Delivery
- Deliver via portal/API/email with agreed package (PDF, XML, SSR/EAD feedback, QC memo, invoice).
- Update LOS status; log delivery timestamp and recipients.

### 2.13 Revisions & ROVs
- **Revision**: issue structured request; time-boxed turnaround.
- **ROV**: accept in policy format only; triage for merit, forward to appraiser, document rationale.
- Maintain full audit trail of all changes and communications.

### 2.14 Billing & Payables
- If borrower-pay: post payment; handle refunds/partials for cancelled orders.
- If client-bill: generate invoice; bundle monthly if contract requires.
- Vendor pay: release on client acceptance or delivery + X days; ACH with remittance; 1099 at year-end.

### 2.15 Post-Delivery Tasks
- **1004D/Final**: track completion/CO for “subject to” assignments; auto-remind client.
- **Field/Desk Reviews**: trigger per variance thresholds, CU/SSR scores, or investor overlay.
- **Archiving & retention**: store files securely per policy and requirements.

---

## 3. Risk-First Valuation Platform: Data, Models, and Rule Engine

### 3.1 Data Plumbing & Identity Resolution
- Connectors: MLS, public record, parcel, permits, courts, HOA, FEMA, imagery, listing portals, rental feeds, vendor systems, borrower docs, macro indices.
- Normalization: address/APN, geocode, unit parsing, harmonization, timestamps, doc type.
- Dedup/merge: record linkage, near-duplicate detection.
- Entity resolution: owner/LLC graph, brokers, appraisers, recurring relationships.
- Data provenance tagging: source_id, source_type, ts_ingested, license_id, transform_history, human_action_log, confidence_flags.

### 3.2 Feature Layers (AI Inputs)
- Property, market regime, geospatial/hazards, STR/regulation, ownership chain, price dynamics, NLP (listings/reports), computer vision, vendor KPIs, loan metrics.

### 3.3 Models by Task
- Valuation core (GBM, OLS, quantile regression), uncertainty/sufficiency, anomaly/fraud, STR revenue, market-decline detector.

### 3.4 Rule Engine & Waterfall
- Configurable routing based on confidence, dispersion, value deltas, fraud flags.
- Example: If AVM.conf < 65 or AVM.dispersion > T1, route = "Interactive AVM"; if iAVM.conf < 70, route = "DVR"; if DVR.flag_count >= 2, route = "Desktop/Field Review".

### 3.5 Red-Flag Library
- Non-arm’s-length, flip inflation, comp gaming, GLA/feature conflicts, image reuse, STR misrep, market stress, builder/GC risk.

### 3.6 Outputs (Machine + Human)
- Valuation: point, P10/P50/P90, confidence, comp grid, adjustments.
- Scores: valuation risk, fraud risk, data sufficiency, market regime.
- Reason codes, next-best action, audit pack, portfolio analytics.

### 3.7 QC Automation (by Product)
- AVM/iAVM: comp sufficiency, leverage, range width, cross-checks.
- BPOs: EXIF checks, broker overlap, condition calibration.
- DVR/Desktop/Full: NLP for adjustments, UAD consistency, photo contradictions.
- Evaluations/1033s: policy fit, signature/date, COI, geographic competency.
- RECON: multi-benchmark variance.

### 3.8 Model Governance & Compliance
- Champion/challenger, drift monitoring, out-of-time validation, privacy/security, MRM docs.

---

## 4. Platform Workflow: Step-by-Step

### 4.1 Order Lifecycle (Waterfall)
1. **Order Entry**: Intake, validation, compliance check, order ID assignment, payment/invoice.
2. **Vendor Engagement**: Panel search, independence check, assignment, acceptance, escalation.
3. **Inspection Scheduling**: Vendor/borrower contact, status update, follow-up.
4. **Order Tracking**: Pipeline management, escalation, revision/ROV, fee increases.
5. **Product Receipt**: Vendor upload, receipt confirmation, status to "In QC".
6. **QC Review**: Multi-layer review, fraud/risk checks, revision requests, escalation.
7. **Delivery to Client**: PDF conversion, upload, notification, status update.
8. **Post-Delivery Compliance**: Audit log, PII retention, random audits.
9. **Team Prioritization**: Daily ops, revision/late/ROV prioritization, inspection follow-ups.

---

## 5. Security, Privacy, and Compliance
- PII minimization, role-based access, encryption in transit/at rest, audit logs, SOC controls, licensing compliance.
- PCI scope for payments, incident response, client notification protocol.
- Data retention: 5–7 years, purge payment tokens after settlement.

---

## 6. Analytics, Dashboards, and Continuous Improvement
- Portfolio heatmaps, trendlines, variance analytics, segment scorecards.
- Truth-set benchmarking, backcast engine, unified product snapshot.
- Variance & calibration analytics, residual attribution, segment cuts.
- DVR/QC ingestion to structured insights, deficiency taxonomy, best-tool selector.
- Waterfall auto-learning: segment scorecards update post-truth, underperformers tighten gates.
- A/B tests, alerts, coaching, experiment harness.

---

## 7. Minimal Schemas (Dev-Ready)

- **valuation_product_result**(loan_id, product_id, product_type, value_point, value_low, value_high, conf_0_100, turn_time_hours, cost, data_suff_class, reason_codes[], qc_result, qc_flags[], model_version, analyst_actions_log_ref)
- **loan_truth**(loan_id, truth_value, truth_low, truth_high, truth_tier, method_notes)
- **residuals**(loan_id, product_id, abs_err, pct_err, in_range_80, in_range_90, ts_recorded)
- **deficiency_event**(loan_id, product_id, code, severity, source, note, remediation_status)
- **scorecard_product_segment**(product_type, segment_id, MAE, Coverage90, TurnTimeMed, DefectRate, CostMed, Score, period_start, period_end)

---

## 8. Implementation Roadmap

### MVP (90–120 days)
- Data connectors, AVM/iAVM, fraud/decline detectors, rule engine, dashboards v1, provenance logs, scorecards, PDF ingestion, DVR NLP v1, basic selector.

### V1.5 (60–90 days)
- STR legality layer, CV photo hashing, graph anomalies, enhanced selector, QC automation for BPO & Evaluations, portfolio tapes.

### V2
- Desktop/Field integrations, advanced doc forensics, champion/challenger, A/B harness, client-config UI, automated coaching loops.

### Acceptance
- MAE/coverage targets, SLA turn-time, audit pack completeness, selector uplift, fraud false-positive rate.

---

## 9. Appendices
- Reason Code Catalog
- Data Dictionary
- Model Cards
- Waterfall Policy Templates
- Dashboard Wireframes
