# Advanced Auto-Matching, Routing & Scheduling Infrastructure Plan
**Date:** March 18, 2026
**Status:** 🟡 Not Started
**Purpose:** Massively enhance the existing basic matching capabilities into a best-in-class, zero-touch automated engine for Auto-Assign/Matching, Routing, and Scheduling.

---

## Executive Summary
Our current vendor assignment provides a functional baseline, but an industry-leading platform requires a sophisticated predictive matching algorithm, real-time routing fallbacks, and true capacity/logistics-based scheduling. This plan completely overhauls the capability, segmented into three primary pillars: **1. Auto-Matching**, **2. Intelligent Routing**, and **3. Dynamic Scheduling**.

---

## Pillar 1: The Auto-Assign & Matching Engine (Massive Enhancement)
*Upgrading the basic matching service into a multi-variable algorithmic scoring engine.*

- [ ] **1.1 Multi-Factor Vendor Scorecard System**
  - Implement dynamic scoring combining: Proximity (Drive distance, not just zip match), Historic On-Time Performance, Revision Rates, and Underwriting Quality Scores.
- [ ] **1.2 Advanced Licensing & Competency Verification**
  - Factor in specific credentials (FHA, VA, Commercial) and complex property competencies automatically mapped against the order payload.
- [ ] **1.3 Predictive Fee & SLA Acceptance Model**
  - Track historical fee acceptance to auto-select vendors mathematically most likely to accept the required fee and SLA constraints without counter-offering.
- [ ] **1.4 Enhanced Exclusion & Tiering Engine**
  - Upgrade the existing basic exclusions into a robust, configurable hierarchy: Client Preferred ➡️ Platform Preferred ➡️ General Pool ➡️ DNU (Do Not Use).

## Pillar 2: Intelligent Routing & Cascading
*Once the matched target list is built, how does the system execute the actual engagement safely if the primary vendor fails?*

- [ ] **2.1 Waterfall & Cascading Broadcast Logic**
  - **Sequential Routing:** Ping Vendor A -> Wait X hours -> Pull back automatically -> Ping Vendor B.
  - **Tiered Broadcast:** Blast strictly to Top 3 preferred vendors -> First to accept procures it -> If none within X hours, dynamically expand the radius/tier.
- [ ] **2.2 Pre-Flight Auto-Reject & Exception Handling**
  - If a matched vendor is flagged as 
