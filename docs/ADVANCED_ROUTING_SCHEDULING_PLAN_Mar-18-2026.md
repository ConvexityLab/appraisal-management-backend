# Advanced Auto-Matching, Routing & Scheduling Infrastructure Plan
**Date:** March 18, 2026
**Status:** 🟡 In Progress
**Purpose:** Massively enhance the existing basic matching capabilities into a best-in-class, zero-touch automated engine for Auto-Assign/Matching, Routing, and Scheduling.

---

## Executive Summary
Our current vendor assignment provides a functional baseline, but an industry-leading platform requires a sophisticated predictive matching algorithm, real-time routing fallbacks, and true capacity/logistics-based scheduling. This plan completely overhauls the capability, segmented into three primary pillars: **1. Auto-Matching**, **2. Intelligent Routing**, and **3. Dynamic Scheduling**.

---

## Pillar 1: The Auto-Assign & Matching Engine (Massive Enhancement)
*Upgrading the basic matching service into a multi-variable algorithmic scoring engine.*

- [x] 1.1 Multi-Factor Vendor Scorecard System
  - Implement dynamic scoring combining: Proximity (Drive distance, not just zip match), Historic On-Time Performance, Revision Rates, and Underwriting Quality Scores.
- [x] 1.2 Advanced Licensing & Competency Verification
  - Factor in specific credentials (FHA, VA, Commercial) and complex property competencies automatically mapped against the order payload.
- [x] 1.3 Predictive Fee & SLA Acceptance Model
  - Track historical fee acceptance to auto-select vendors mathematically most likely to accept the required fee and SLA constraints without counter-offering.
- [x] 1.4 Enhanced Exclusion & Tiering Engine
  - Upgrade the existing basic exclusions into a robust, configurable hierarchy: Client Preferred ➡️ Platform Preferred ➡️ General Pool ➡️ DNU (Do Not Use).

## Pillar 2: Intelligent Routing & Cascading Broadcasts
*Once the matched target list is built, how does the system execute the actual engagement safely if the primary vendor fails?*

- [x] 2.1 Waterfall & Cascading Broadcast Logic
  - **Sequential Routing:** Ping Vendor A -> Wait X hours -> Pull back automatically -> Ping Vendor B.
  - **Tiered Broadcast:** Blast strictly to Top 3 preferred vendors -> First to accept procures it -> If none within X hours, dynamically expand the radius/tier.
- [x] 2.2 Pre-Flight Auto-Reject & Exception Handling
  - Prevent broadcast to vendors who are currently offline/out of office.
  - Gracefully handle timeouts and escalate to internal staff if the cascading pool is exhausted.

## Pillar 3: Dynamic Capacity & Scheduling
*Integrating calendar sync and real-time appraiser bandwidth constraints.*

- [x] 3.1 Appraiser Capacity Modeling
  - Ensure vendors have daily capacity limits (e.g. max 5 active orders).
  - Suspend auto-assignment for vendors who exceed their active pipeline threshold until they complete pending orders.
- [x] 3.2 OOO (Out of Office) & Calendar Awareness
  - Give appraisers a way to flag unavailable days. The matching engine must skip them even if they score 100/100.

## Pillar 4: UI & Observability
- [ ] 4.1 Routing Activity Dashboard
  - Provide platform users a real-time view showing an order's heartbeat (e.g. "Currently pinging Vendor A [2 hours remaining]...").
- [ ] 4.2 Scorecard Transparency
  - Show the user *why* Vendor B was picked over Vendor A (displaying logic breakdown: Fee match, Proximity match, Competency).
