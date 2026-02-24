# Fraud Criteria Review — Comprehensive Implementation Plan

**Created:** February 23, 2026  
**Status:** Planning — Not Started  
**Primary Source:** `data/fraud/VisionAppraisal_Risk_Template.xlsx`  
**Related Plans:** `PORTFOLIO_ANALYTICS_ARCHITECTURE.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Spreadsheet Anatomy — What the Source Defines](#2-spreadsheet-anatomy)
3. [What Already Exists](#3-what-already-exists)
4. [Gap Analysis — What Is Missing](#4-gap-analysis)
5. [End-to-End Process Design](#5-end-to-end-process-design)
6. [Canonical Fraud Program / Criteria Format](#6-canonical-fraud-program--criteria-format)
7. [Architecture Decisions](#7-architecture-decisions)
8. [Full Build Checklist — Sprint by Sprint](#8-full-build-checklist)
9. [File-Level Change Index](#9-file-level-change-index)
10. [Data Model Reference](#10-data-model-reference)
11. [API Endpoint Reference](#11-api-endpoint-reference)
12. [UI Component Reference](#12-ui-component-reference)
13. [Risk Register](#13-risk-register)
14. [Testing Strategy](#14-testing-strategy)

---

## 1. Executive Summary

The **Fraud Criteria Review** feature enables clients and internal reviewers to process a portfolio of loans — potentially hundreds at once — through a predefined fraud risk evaluation framework.

The primary input is an **Appraisal Risk Tape**: a structured spreadsheet (or set of appraisal documents) containing 73 data fields per loan. These fields are evaluated against a **Fraud Program** (a versioned, client-attributed set of thresholds and flag rules) to produce an **Overall Decision** (Accept / Conditional / Reject) per loan, along with color-coded risk flags and a portfolio-level summary.

**Two data paths must be supported:**
- **Path A (Tape Upload):** The client provides a pre-filled Excel/CSV Risk Tape. Evaluate immediately.
- **Path B (Document Extraction):** The client provides appraisal PDFs per loan. Axiom extracts the 73 fields. Then evaluate.
- **Path C (Hybrid):** Tape provides loan/borrower data; documents provide the appraisal extraction fields. Merge, then evaluate.

This is one of the **primary use cases for the platform** and lives inside the Bulk Portfolios workflow with `analysisType = 'FRAUD'`.

---

## 2. Spreadsheet Anatomy

Source file: `data/fraud/VisionAppraisal_Risk_Template.xlsx`

### Sheet 1 — Appraisal Risk Tape (73 columns — the data schema)

This sheet defines the canonical field list. It has **1001 rows** (row 1 = headers, rows 2–1001 = data entry). The column structure groups into 8 functional sections:

#### Section A — Loan / Borrower Identity (cols 1–15)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 1 | Loan Number | string | External identifier from client |
| 2 | Borrower Name | string | Full name |
| 3 | Loan Purpose | enum | Purchase / Rate-Term Refi / Cash-Out Refi / Bridge / DSCR / Other |
| 4 | Loan Type | enum | Conventional / Jumbo / Non-QM / DSCR / Bridge / Private Lender |
| 5 | Loan Amount | number | Dollar amount |
| 6 | First Lien Balance | number | |
| 7 | Second Lien Balance | number | |
| 8 | Appraised Value | number | From appraisal report |
| 9 | Contract Price | number | Purchase price on contract |
| 10 | Purchase Price (Prior) | number | Prior sale price |
| 11 | Purchase Price Date (Prior) | date | |
| 12 | LTV (Calc) | decimal | `loanAmount / appraisedValue` — **calculated** |
| 13 | CLTV (Calc) | decimal | `(firstLien + secondLien) / appraisedValue` — **calculated** |
| 14 | Occupancy Type | enum | Owner-Occupied / Second Home / Investment |
| 15 | DSCR | decimal | Debt Service Coverage Ratio |

#### Section B — Property Identity (cols 16–21)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 16 | Address | string | Street address |
| 17 | City | string | |
| 18 | County | string | |
| 19 | State | string | 2-letter code |
| 20 | ZIP | string | 5-digit |
| 21 | Census Tract | string | FIPS census tract |

#### Section C — Property Classification (cols 22–23)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 22 | Property Type | enum | SFR / Condo / Townhome / 2-4 Unit / Manufactured / Mixed-Use (SBC) / Other |
| 23 | Units | number | |

#### Section D — Physical Characteristics (cols 24–35)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 24 | Year Built | number | |
| 25 | GLA (SF) | number | Gross Living Area in sq ft |
| 26 | Basement (SF) | number | |
| 27 | Lot Size (SF/Acres) | string | Mixed format |
| 28 | Beds | number | |
| 29 | Baths Full | number | |
| 30 | Baths Half | number | |
| 31 | Parking/Garage | string | |
| 32 | Condition Rating | enum | C1–C6 or Good/Average/Fair/Poor |
| 33 | Quality Rating | enum | Q1–Q6 or Good/Average/Fair/Poor |
| 34 | Effective Age | string | Years |
| 35 | Renovation Date | string | |

#### Section E — Transaction / Appraisal (cols 36–39)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 36 | Appraisal Effective Date | date | |
| 37 | Appraiser License | string | |
| 38 | Form Type | string | 1004 / 1073 / 1025 / 2090 / 2055 |
| 39 | Reconciliation Notes | string | |

#### Section F — Prior Sales / Appreciation (cols 40–45)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 40 | Prior Sale 24M Price | number | Sale price within 24 months |
| 41 | Prior Sale 24M Date | date | |
| 42 | 24M Appreciation % (Calc) | decimal | `(appraisedValue - priorSale24mPrice) / priorSale24mPrice` — **calculated** |
| 43 | Prior Sale 36M Price | number | |
| 44 | Prior Sale 36M Date | date | |
| 45 | 36M Appreciation % (Calc) | decimal | **calculated** |

#### Section G — Market & Comparables (cols 46–59)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 46 | Market Trend | enum | Increasing / Stable / Declining |
| 47 | Avg DOM | number | Average days on market |
| 48 | Months of Inventory | decimal | |
| 49 | Number of Comps | number | |
| 50 | Comp Price Range Low | number | |
| 51 | Comp Price Range High | number | |
| 52 | Avg Price/SF (Comps) | decimal | |
| 53 | Avg Distance (mi) | decimal | |
| 54 | Max Distance (mi) | decimal | |
| 55 | Comps Date Range (Months Back) | number | |
| 56 | Non-MLS Count | number | Count of non-public comparable sales |
| 57 | Non-MLS % (Calc) | decimal | `nonMlsCount / numComps` — **calculated** |
| 58 | Avg Net Adj % | decimal | Average net adjustment percent |
| 59 | Avg Gross Adj % | decimal | Average gross adjustment percent |

#### Section H — Risk Flags & Decision (cols 60–73)
| # | Column | Type | Notes |
|---|--------|------|-------|
| 60 | High Net/Gross Flag (Auto) | string | Auto-computed |
| 61 | Chain of Title Red Flags (Y/N) | bool | Manual / extracted |
| 62 | Cash-Out Refi (Y/N) | bool | Derived from loan purpose |
| 63 | AVM Value | number | External AVM |
| 64 | AVM Gap % (Calc) | decimal | `abs(appraisedValue - avmValue) / avmValue` — **calculated** |
| 65 | High-Risk Geography Flag (Y/N) | bool | External lookup or manual |
| 66 | UCDP SSR Score | string | Fannie Mae Collateral Underwriter |
| 67 | Collateral Risk Rating | enum | Low / Medium / High |
| 68 | Appraiser Geo Competency Flag (Y/N) | bool | |
| 69 | Unusual Appreciation Flag (Auto) | string | Auto-computed from Section F |
| 70 | DSCR Flag (Auto) | string | Auto-computed from DSCR |
| 71 | Non-Public Comps Flag (Auto) | string | Auto-computed from Non-MLS % |
| 72 | Overall Decision | enum | **Accept / Conditional / Reject** |
| 73 | Reviewer Notes | string | |

---

### Sheet 3 — Thresholds (the Fraud Program config)

These thresholds drive all auto-flag calculations. They are **versioned per program**:

| Threshold | Default Value | Used By |
|-----------|--------------|---------|
| LTV threshold | 0.80 (80%) | High-LTV flag |
| CLTV threshold | 0.90 (90%) | High-CLTV flag |
| DSCR minimum | 1.0 | DSCR Flag (Auto) |
| 24M Appreciation % threshold | 0.25 (25%) | Unusual Appreciation Flag |
| 36M Appreciation % threshold | 0.35 (35%) | Unusual Appreciation Flag |
| Net Adjustment % threshold | 0.15 (15%) | High Net/Gross Flag |
| Gross Adjustment % threshold | 0.25 (25%) | High Net/Gross Flag |
| Non-MLS % threshold | 0.20 (20%) | Non-Public Comps Flag |
| AVM Gap % threshold | 0.10 (10%) | AVM Gap Flag |

---

### Sheet 4 — Scratchpad (proof of LLM extraction)

This sheet shows a real appraisal PDF was already fed through an LLM which successfully extracted all 73 fields. This confirms **Axiom can already extract these fields from PDFs** — the integration path already works conceptually. The field mapping is 1:1 with the Risk Tape headers.

---

### Sheet 5 — Lists (valid enum values)

Loan Purpose: `Purchase, Rate/Term Refi, Cash-Out Refi, Bridge, DSCR, Other`  
Loan Type: `Conventional, Jumbo, Non-QM, DSCR, Bridge, Private Lender`  
Occupancy: `Owner-Occupied, Second Home, Investment`  
Property Type: `SFR, Condo, Townhome, 2-4 Unit, Manufactured, Mixed-Use (SBC), Other`  
Y/N: `Yes, No`  
Market Trend: `Increasing, Stable, Declining`  
Collateral Risk: `Low, Medium, High`  
Overall Decision: `Accept, Conditional, Reject`  

---

## 3. What Already Exists

### Backend — Existing (do not rebuild)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| `BulkPortfolioService` | `src/services/bulk-portfolio.service.ts` | ✅ Production | Accepts batches, creates orders, tracks jobs in Cosmos |
| `BulkPortfolioJob` | `src/types/bulk-portfolio.types.ts` | ✅ Production | Job record with status, items, counts |
| `FRAUD` analysis type | `src/types/bulk-portfolio.types.ts` | ✅ Wired | Maps to `fraud_analysis` product type |
| `FraudDetectionService` | `src/services/fraud-detection.service.ts` | ✅ Production | Rule-based + AI analysis for single appraisals |
| `AxiomService` | `src/services/axiom.service.ts` | ✅ Production | Document extraction → `CriterionEvaluation[]` |
| `QCRiskAssessmentService` | `src/services/qc-risk-assessment.service.ts` | ✅ Production | Risk scoring from multiple validation sources |
| `BulkPortfolioController` | `src/controllers/bulk-portfolio.controller.ts` | ✅ Production | `POST /api/bulk-portfolios/submit`, `GET /api/bulk-portfolios` |
| `FraudDetectionController` | `src/controllers/fraud-detection.controller.ts` | ✅ Production | `/api/fraud-detection/analyze`, `/api/fraud-detection/batch-analyze` |
| `api-server.ts` routing | `src/api/api-server.ts` | ✅ Wired | All above routes registered |
| Portfolio Analytics Architecture | `current-plan/PORTFOLIO_ANALYTICS_ARCHITECTURE.md` | ✅ Designed | Loom/BullMQ batch orchestration plan for large portfolios |

### Frontend — Existing (do not rebuild)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Bulk Portfolios wizard | `src/app/(control-panel)/bulk-portfolios/page.tsx` | ✅ Production | 3-step: upload→review→submit |
| XLSX parsing | `bulk-portfolios/page.tsx` | ✅ Production | Client-side parse via `xlsx` library |
| Column alias map | `bulk-portfolios/page.tsx` | ✅ Partial | Has ~25 of 73 tape fields |
| Fraud Detection page | `src/app/(control-panel)/fraud-detection/page.tsx` | ✅ Production | Individual alert monitoring |
| `fraudDetectionApi` | `src/store/api/fraudDetectionApi.ts` | ✅ Production | RTK Query hooks |
| `bulkPortfoliosApi` | `src/store/api/bulkPortfoliosApi.ts` | ✅ Production | RTK Query hooks |
| `BulkPortfolioItem` FE type | `src/types/backend/bulk-portfolio.types.ts` | ✅ Partial | Has ~25 of 73 fields |

---

## 4. Gap Analysis

### Backend Gaps

#### GAP-B1 — `FraudRiskTapeItem` type missing 48 fields
`BulkPortfolioItem` has ~25 of the 73 tape fields. The following are absent:
```
firstLienBalance, secondLienBalance, contractPrice,
ltv, cltv, dscr, occupancyType,
censusTract, units, basementSf,
bathsFull, bathsHalf, parking,
effectiveAge, renovationDate,
priorSale24mPrice, priorSale24mDate, appreciation24m,
priorSale36mPrice, priorSale36mDate, appreciation36m,
marketTrend, avgDom, monthsInventory,
numComps, compPriceRangeLow, compPriceRangeHigh, avgPricePerSf,
avgDistanceMi, maxDistanceMi, compsDateRangeMonths,
nonMlsCount, nonMlsPct, avgNetAdjPct, avgGrossAdjPct,
highNetGrossFlag, chainOfTitleRedFlags, cashOutRefi,
avmValue, avmGapPct, highRiskGeographyFlag,
ucdpSsrScore, collateralRiskRating, appraiserGeoCompetency,
unusualAppreciationFlag, dscrFlag, nonPublicCompsFlag,
overallDecision, reviewerNotes
```

#### GAP-B2 — `FraudProgram` type does not exist
No versioned, client-attributed fraud program config. Thresholds are currently only in the spreadsheet. Programs must be a first-class entity supporting multiple clients and versions.

#### GAP-B3 — No fraud tape evaluation engine
`BulkPortfolioService` creates orders — it has no path that evaluates tape rows against threshold criteria. A `FraudTapeEvaluationService` needs to be built that:
1. Computes calculated fields (LTV, CLTV, appreciation %, AVM gap %, Non-MLS %)
2. Applies auto-flag rules against configurable thresholds
3. Scores each flag by severity
4. Derives `overallDecision` from combined flags
5. Returns a `FraudTapeResult` per row

#### GAP-B4 — No fraud-programs API
No endpoints exist for creating, reading, or selecting fraud programs. These are needed for clients to pick which program/version to run their tape against.

#### GAP-B5 — Dual processing mode not wired
When `analysisType === 'FRAUD'`, the service currently creates an order record (for vendor assignment). For tape processing, we need an **immediate evaluation path** that doesn't route through vendor assignment.

#### GAP-B6 — No Axiom extraction spec for the 73 fields
Axiom takes a document URL + metadata and returns `CriterionEvaluation[]`. For fraud tape, a structured extraction spec (field list + expected types) needs to be passed with the document to instruct extraction of the 73 fields specifically.

---

### Frontend Gaps

#### GAP-F1 — Column alias map incomplete
`COLUMN_ALIASES` in `bulk-portfolios/page.tsx` covers ~25 fields. Missing all fraud-tape-specific headers (e.g., `Non-MLS Count`, `Chain of Title Red Flags`, `UCDP SSR Score`, `Avg Net Adj %`, `Avg Gross Adj %`, etc.).

#### GAP-F2 — No computed field logic in `parseSheet()`
When a tape is parsed, calculated fields (`LTV`, `CLTV`, `24M Appreciation %`, `AVM Gap %`, `Non-MLS %`) must be computed from source inputs if not already present in the tape. These are not being computed today.

#### GAP-F3 — No Fraud Program selector in wizard
Step 1 of the Bulk Portfolios wizard needs a Fraud Program / Version selector when the user picks `FRAUD` as the analysis type.

#### GAP-F4 — No `FraudTapeResultsGrid` component
The existing `FraudDetectionPage` is an **alert monitoring** view. Tape results require a fundamentally different UI: a dense data grid with one row per loan, color-coded flag columns, aggregate stats, and row-level drill-down. This component does not exist.

#### GAP-F5 — No loan-level drill-down panel
Users need to open a single loan from the results grid and see all 73 fields plus flag explanations, evidence, and threshold comparisons.

#### GAP-F6 — No batch decision actions
No mechanism exists to bulk-approve, bulk-escalate, or export the fraud results grid to Excel.

#### GAP-F7 — No document upload path in bulk wizard
The wizard's upload step handles a single tape file. For Path B/Hybrid, users need to upload N appraisal PDFs associated with specific loan numbers.

---

## 5. End-to-End Process Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 0 — Program Selection (before upload)                                 │
│                                                                             │
│  User selects: Client → Fraud Program → Version                             │
│  Program loads: thresholds, required fields, auto-flag rules                │
│  System validates program is active and client has access                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1 — Data Ingestion (Wizard Step 1 — Upload)                          │
│                                                                             │
│  Path A — Tape Upload (primary for Sprint 1)                                │
│    User drops Excel/CSV file                                                │
│    Parser normalizes headers using COLUMN_ALIASES (extended)                │
│    Computed fields calculated: LTV, CLTV, appreciation %, AVM gap %        │
│    Rows validated against program's required field list                     │
│    Grid preview shows errors highlighted in red                             │
│                                                                             │
│  Path B — Document Upload (Sprint 4)                                        │
│    User uploads N appraisal PDFs                                            │
│    Each PDF associated with a loan number (filename or metadata)            │
│    Files uploaded to Blob Storage per loan                                  │
│    Axiom batch-submitted with 73-field extraction spec                      │
│    Async progress tracked via WebPubSub                                     │
│    Extracted fields merged into FraudRiskTapeItem records                  │
│                                                                             │
│  Path C — Hybrid (Sprint 4)                                                 │
│    Tape provides: loan/borrower/LTV data                                    │
│    PDFs provide: appraisal extraction fields                                │
│    Merge on Loan Number, then evaluate                                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2 — Review & Configure (Wizard Step 2 — Review)                      │
│                                                                             │
│  Parsed grid: columns = tape fields, rows = loans                           │
│  Error rows highlighted (missing required fields, invalid values)           │
│  User can correct inline or remove invalid rows                             │
│  Row count stats: total / valid / invalid / skipped                        │
│  User confirms program/version before proceeding                           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3 — Fraud Evaluation (server-side, synchronous for tape ≤ 500 rows)  │
│                                                                             │
│  For each loan in the batch (parallelized):                                 │
│    1. Apply computed fields if not already present                          │
│    2. Evaluate auto-flag rules:                                             │
│         High Net/Gross Flag:      avgNetAdjPct > 15% OR avgGrossAdjPct > 25% │
│         Unusual Appreciation:     appreciation24m > 25% OR 36m > 35%       │
│         DSCR Flag:                dscr != null AND dscr < 1.0              │
│         Non-Public Comps:         nonMlsPct > 20%                          │
│         AVM Gap:                  avmGapPct > 10%                          │
│         High LTV:                 ltv > 80%                                │
│         High CLTV:                cltv > 90%                               │
│    3. Weight flags by severity (CRITICAL=40, HIGH=20, MEDIUM=10, LOW=5)    │
│    4. Sum weighted score → overallRiskScore (0–100)                        │
│    5. Derive overallDecision:                                               │
│         score >= 70 → Reject                                               │
│         score >= 35 → Conditional                                           │
│         score < 35  → Accept                                               │
│    6. Optionally invoke AI analysis if score >= 50                         │
│    7. Write FraudTapeResult to Cosmos (bulk-portfolio-jobs container)      │
│                                                                             │
│  For large batches (> 500 rows): route through Loom/BullMQ job queue       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4 — Results Review (Wizard Step 3 — Results)                         │
│                                                                             │
│  FraudTapeResultsGrid:                                                      │
│    Header: Job name, program, version, submit date, totals                  │
│    Summary cards: Total | Accept | Conditional | Reject | Avg Risk Score   │
│    Data grid columns:                                                       │
│      - Loan # | Borrower | Address | Appraised Value                       │
│      - LTV | CLTV (color: red if > threshold)                              │
│      - Risk Score (0–100, color gradient)                                  │
│      - Flag indicators: one chip per auto-flag, red/yellow/green           │
│      - Overall Decision (Accept/Conditional/Reject badge)                  │
│      - Actions: View Details, Override Decision                            │
│    Grid controls:                                                           │
│      - Filter by Decision, Risk Level, specific flag                       │
│      - Sort by any column                                                   │
│      - Select all / select filtered → Bulk approve / Bulk escalate         │
│      - Export to Excel (original tape + decision columns)                  │
│                                                                             │
│  Drill-down panel (per loan):                                               │
│      - All 73 fields organized in sections                                  │
│      - Each active flag with: rule description, actual value vs threshold  │
│      - Reviewer notes field                                                 │
│      - Decision override with audit trail                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Canonical Fraud Program / Criteria Format

This is the seed data for the first program. Will be stored in Cosmos `fraud-programs` container.

```json
{
  "id": "vision-appraisal-v1.0",
  "name": "VisionAppraisal Risk Program",
  "version": "1.0",
  "status": "ACTIVE",
  "clientId": null,
  "createdAt": "2026-02-23T00:00:00.000Z",
  "thresholds": {
    "ltv": 0.80,
    "cltv": 0.90,
    "dscrMinimum": 1.0,
    "appreciation24mPct": 0.25,
    "appreciation36mPct": 0.35,
    "netAdjustmentPct": 0.15,
    "grossAdjustmentPct": 0.25,
    "nonMlsPct": 0.20,
    "avmGapPct": 0.10
  },
  "autoFlags": [
    {
      "id": "HIGH_NET_GROSS_ADJ",
      "label": "High Net/Gross Adjustment",
      "description": "Average net or gross comp adjustment exceeds threshold",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "OR",
        "rules": [
          { "field": "avgNetAdjPct", "op": "GT", "thresholdKey": "netAdjustmentPct" },
          { "field": "avgGrossAdjPct", "op": "GT", "thresholdKey": "grossAdjustmentPct" }
        ]
      }
    },
    {
      "id": "UNUSUAL_APPRECIATION_24M",
      "label": "Unusual 24-Month Appreciation",
      "description": "Price appreciation over prior 24 months exceeds threshold",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "priorSale24mPrice", "op": "GT", "value": 0 },
          { "field": "appreciation24m", "op": "GT", "thresholdKey": "appreciation24mPct" }
        ]
      }
    },
    {
      "id": "UNUSUAL_APPRECIATION_36M",
      "label": "Unusual 36-Month Appreciation",
      "description": "Price appreciation over prior 36 months exceeds threshold",
      "severity": "MEDIUM",
      "weight": 10,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "priorSale36mPrice", "op": "GT", "value": 0 },
          { "field": "appreciation36m", "op": "GT", "thresholdKey": "appreciation36mPct" }
        ]
      }
    },
    {
      "id": "DSCR_FLAG",
      "label": "DSCR Below Minimum",
      "description": "Debt Service Coverage Ratio is below program minimum",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "dscr", "op": "NOT_NULL" },
          { "field": "dscr", "op": "LT", "thresholdKey": "dscrMinimum" }
        ]
      }
    },
    {
      "id": "NON_PUBLIC_COMPS",
      "label": "Non-MLS / Non-Public Comparables",
      "description": "Excessive use of non-MLS comparable sales",
      "severity": "MEDIUM",
      "weight": 10,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "numComps", "op": "GT", "value": 0 },
          { "field": "nonMlsPct", "op": "GT", "thresholdKey": "nonMlsPct" }
        ]
      }
    },
    {
      "id": "AVM_GAP",
      "label": "AVM Value Gap",
      "description": "Appraised value deviates from AVM beyond threshold",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "avmValue", "op": "GT", "value": 0 },
          { "field": "avmGapPct", "op": "GT", "thresholdKey": "avmGapPct" }
        ]
      }
    },
    {
      "id": "HIGH_LTV",
      "label": "High LTV",
      "description": "Loan-to-value ratio exceeds program threshold",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "ltv", "op": "GT", "thresholdKey": "ltv" }
        ]
      }
    },
    {
      "id": "HIGH_CLTV",
      "label": "High CLTV",
      "description": "Combined loan-to-value ratio exceeds program threshold",
      "severity": "HIGH",
      "weight": 20,
      "condition": {
        "operator": "AND",
        "rules": [
          { "field": "cltv", "op": "NOT_NULL" },
          { "field": "cltv", "op": "GT", "thresholdKey": "cltv" }
        ]
      }
    }
  ],
  "manualFlags": [
    {
      "id": "CHAIN_OF_TITLE",
      "label": "Chain of Title Red Flags",
      "description": "Manual: appraiser noted chain of title concerns",
      "field": "chainOfTitleRedFlags",
      "severity": "CRITICAL",
      "weight": 40
    },
    {
      "id": "HIGH_RISK_GEOGRAPHY",
      "label": "High-Risk Geography",
      "description": "Property is in a flagged geographic area",
      "field": "highRiskGeographyFlag",
      "severity": "MEDIUM",
      "weight": 10
    },
    {
      "id": "APPRAISER_GEO_COMPETENCY",
      "label": "Appraiser Geographic Competency",
      "description": "Appraiser may lack competency for subject geography",
      "field": "appraiserGeoCompetency",
      "severity": "MEDIUM",
      "weight": 10
    }
  ],
  "decisionRules": {
    "reject": { "minScore": 70 },
    "conditional": { "minScore": 35 },
    "accept": { "maxScore": 34 }
  }
}
```

---

## 7. Architecture Decisions

### Decision 1 — Use Bulk Portfolios as the Entry Point (NOT a New Page)

**Decision:** Extend Bulk Portfolios for fraud tape processing. Do NOT create a separate page.

**Rationale:**
- The 3-step wizard paradigm (upload → review → submit) is exactly right for tape processing
- Job tracking, history, and audit trail are already built
- `FRAUD` is already a valid `BulkAnalysisType` and routes correctly
- The Fraud Detection page remains the **alert monitoring hub** for individual cases — complementary, not duplicated

**Behavior difference when `analysisType === 'FRAUD'`:**
- Step 1: Fraud Program selector appears
- Column aliases cover all 73 tape fields
- Computed fields are calculated
- Step 3: Shows `FraudTapeResultsGrid` instead of the standard order-creation results table

---

### Decision 2 — Tape Mode Does NOT Create AppraisalOrders

**Decision:** When processing a fraud tape, the bulk service evaluates the rows immediately and stores `FraudTapeResult` records. It does NOT create `AppraisalOrder` records.

**Rationale:**
- A fraud tape review is a standalone analytical product, not a vendor assignment workflow
- Creating orders would trigger SLA monitoring, vendor assignment, and other workflows that are not applicable
- The `BulkPortfolioJob` container can store both job types — differentiate by `processingMode: 'TAPE_EVALUATION' | 'ORDER_CREATION'`

---

### Decision 3 — Synchronous Evaluation for ≤ 500 Rows; Queue for > 500

**Decision:** Evaluate up to 500-row batches synchronously within the API request. Route larger batches through the async Loom/BullMQ infrastructure from `PORTFOLIO_ANALYTICS_ARCHITECTURE.md`.

**Rationale:**
- Most client tapes are 50–200 rows. Synchronous is simpler and faster for these.
- LLM API concurrency limits and Axiom rate limits make > 500 async mandatory anyway
- This keeps Sprint 1–3 simple and Sprint 4 enables unlimited scale

---

### Decision 4 — FraudProgram is a First-Class Cosmos Entity

**Decision:** Fraud programs live in a dedicated `fraud-programs` Cosmos container, not config files or environment variables.

**Rationale:**
- Multiple clients may have different programs
- Programs need versioning with backward compatibility (historical jobs reference a specific version)
- Admin UI for managing programs requires API-backed data

---

### Decision 5 — Calculated Fields Computed Server-Side, Not Client-Side

**Decision:** LTV, CLTV, appreciation %, AVM gap %, and Non-MLS % are computed server-side in `FraudTapeEvaluationService`, even if the tape already contains them.

**Rationale:**
- Client-provided calculated fields may be wrong or manipulated
- Server always recomputes from source inputs
- If a required source field is missing, the calculated field is `null` and the flag cannot fire — this is the correct behavior, logged as a data quality issue

---

## 8. Full Build Checklist

### Sprint 1 — Schema, Types, and Column Parsing (Est. 2–3 days)

#### Backend

- [ ] **S1-B1** — Create `src/types/fraud-tape.types.ts`
  - `FraudRiskTapeItem` interface (all 73 fields, typed)
  - `FraudAutoFlag` interface (id, label, description, severity, weight, isFired, actualValue, thresholdValue)
  - `FraudTapeResult` interface (extends `FraudRiskTapeItem` with flags + decision + riskScore)
  - `FraudProgram` interface (id, name, version, clientId, thresholds, autoFlags, manualFlags, decisionRules)
  - `FraudThresholds` interface (all 9 threshold fields)
  - `FraudProcessingMode` type: `'TAPE_EVALUATION' | 'ORDER_CREATION' | 'DOCUMENT_EXTRACTION'`

- [ ] **S1-B2** — Extend `src/types/bulk-portfolio.types.ts`
  - Add `processingMode?: FraudProcessingMode` to `BulkPortfolioJob`
  - Add `fraudProgramId?: string` to `BulkPortfolioJob`
  - Add `fraudProgramVersion?: string` to `BulkPortfolioJob`

- [ ] **S1-B3** — Create seed data file `src/data/fraud-programs.ts`
  - Export `VISION_APPRAISAL_V1_PROGRAM: FraudProgram` with the config from Section 6

#### Frontend

- [ ] **S1-F1** — Create `src/types/backend/fraud-tape.types.ts` (mirror of backend types)
  - `FraudRiskTapeItem`, `FraudAutoFlag`, `FraudTapeResult`, `FraudProgram`, `FraudThresholds`

- [ ] **S1-F2** — Add to `src/types/backend/index.ts`
  - `export * from './fraud-tape.types'`

- [ ] **S1-F3** — Extend `COLUMN_ALIASES` in `bulk-portfolios/page.tsx`
  - Add all 48 missing fraud tape field mappings (see Gap-F1)
  - Aliases must handle variations: `'non-mls count'`, `'non mls count'`, `'nonmls'` → `nonMlsCount`
  - Aliases for: `firstLienBalance`, `secondLienBalance`, `contractPrice`, `ltv`, `cltv`, `dscr`, `occupancyType`, `censusTract`, `units`, `basementSf`, `bathsFull`, `bathsHalf`, `parking`, `effectiveAge`, `renovationDate`, `priorSale24mPrice`, `priorSale24mDate`, `appreciation24m`, `priorSale36mPrice`, `priorSale36mDate`, `appreciation36m`, `marketTrend`, `avgDom`, `monthsInventory`, `numComps`, `compPriceRangeLow`, `compPriceRangeHigh`, `avgPricePerSf`, `avgDistanceMi`, `maxDistanceMi`, `compsDateRangeMonths`, `nonMlsCount`, `nonMlsPct`, `avgNetAdjPct`, `avgGrossAdjPct`, `chainOfTitleRedFlags`, `avmValue`, `avmGapPct`, `ucdpSsrScore`, `collateralRiskRating`, `appraiserGeoCompetency`, `overallDecision`, `reviewerNotes`

- [ ] **S1-F4** — Add computed-field logic to `parseSheet()` in `bulk-portfolios/page.tsx`
  - Compute `ltv = loanAmount / appraisedValue` if `ltv` is absent and both sources present
  - Compute `cltv = (firstLienBalance + secondLienBalance) / appraisedValue` if absent
  - Compute `appreciation24m = (appraisedValue - priorSale24mPrice) / priorSale24mPrice` if absent
  - Compute `appreciation36m = (appraisedValue - priorSale36mPrice) / priorSale36mPrice` if absent
  - Compute `avmGapPct = Math.abs(appraisedValue - avmValue) / avmValue` if absent and both present
  - Compute `nonMlsPct = nonMlsCount / numComps` if absent and both present

---

### Sprint 2 — Fraud Program API and Evaluation Engine (Est. 3–4 days)

#### Backend

- [ ] **S2-B1** — Create `src/services/fraud-tape-evaluation.service.ts`
  - `evaluate(items: FraudRiskTapeItem[], program: FraudProgram): FraudTapeResult[]`
  - Private: `computeCalculatedFields(item: FraudRiskTapeItem): FraudRiskTapeItem`
  - Private: `evaluateAutoFlags(item: FraudRiskTapeItem, program: FraudProgram): FraudAutoFlag[]`
  - Private: `evaluateManualFlags(item: FraudRiskTapeItem, program: FraudProgram): FraudAutoFlag[]`
  - Private: `computeRiskScore(flags: FraudAutoFlag[]): number`
  - Private: `deriveDecision(score: number, program: FraudProgram): 'Accept' | 'Conditional' | 'Reject'`
  - Rules engine must NOT silently swallow missing fields — log data quality issues per row

- [ ] **S2-B2** — Create `src/controllers/fraud-programs.controller.ts`
  - `GET /api/fraud-programs` — list all active programs (optionally filtered by clientId)
  - `GET /api/fraud-programs/:id` — get single program
  - `GET /api/fraud-programs/:id/versions` — list all versions of a program

- [ ] **S2-B3** — Register `/api/fraud-programs` route in `src/api/api-server.ts`

- [ ] **S2-B4** — Extend `src/services/bulk-portfolio.service.ts`
  - When `request.processingMode === 'TAPE_EVALUATION'`:
    - Do NOT call `dbService.createOrder()`
    - Call `FraudTapeEvaluationService.evaluate()`
    - Store results on `BulkPortfolioJob.items` as `FraudTapeResult[]`
  - Keep existing order-creation path for all other processing modes

- [ ] **S2-B5** — Extend `POST /api/bulk-portfolios/submit` validation
  - Accept `processingMode`, `fraudProgramId` in request body
  - If `analysisType === 'FRAUD'` AND `processingMode === 'TAPE_EVALUATION'`: require `fraudProgramId`

- [ ] **S2-B6** — Add `GET /api/bulk-portfolios/:jobId/fraud-results` endpoint
  - Returns job with full `FraudTapeResult[]` items (may be large — consider pagination)
  - Endpoint in `bulk-portfolio.controller.ts`

- [ ] **S2-B7** — Seed `VISION_APPRAISAL_V1_PROGRAM` in Cosmos on startup (if not present)
  - Use `CosmosDbService.upsertItem()` with the seed data from `src/data/fraud-programs.ts`
  - Respect the "no createIfNotExists" rule — the `fraud-programs` container must already exist (Bicep deploys it first)

#### Infrastructure

- [ ] **S2-INFRA1** — Add `fraud-programs` Cosmos container to Bicep
  - File: create `infrastructure/modules/cosmos-fraud-containers.bicep`
  - Container: `fraud-programs` with partition key `/clientId`
  - Deploy to staging before writing seeding code

---

### Sprint 3 — Fraud Results UI (Est. 4–5 days)

#### Frontend

- [ ] **S3-F1** — Create `src/app/(control-panel)/bulk-portfolios/FraudProgramSelector.tsx`
  - Dropdown populated from `GET /api/fraud-programs`
  - Shows: program name, version, client (if client-specific)
  - Appears in Step 1 of wizard when `analysisType === 'FRAUD'`

- [ ] **S3-F2** — Wire `fraudProgramId` into the Step 1→Step 2 form state and the final submit payload

- [ ] **S3-F3** — Add RTK Query endpoint to `bulkPortfoliosApi.ts`
  - `getFraudPrograms: builder.query<FraudProgram[], { clientId?: string }>`
  - `getFraudResults: builder.query<FraudTapeResult[], { jobId: string }>`

- [ ] **S3-F4** — Create `src/app/(control-panel)/bulk-portfolios/FraudTapeResultsGrid.tsx`
  - Summary header: total / accept / conditional / reject / avg risk score
  - Data table (use MUI `DataGrid` or existing table pattern):
    - Columns: Loan #, Borrower, Address, Appraised Value, LTV, CLTV, Risk Score, flags chips, Decision badge, Actions
    - Flag columns: one `Chip` per fired flag (color: red=HIGH/CRITICAL, orange=MEDIUM, yellow=LOW)
    - Decision badge: green=Accept, orange=Conditional, red=Reject
    - LTV/CLTV cells: red background if above threshold
  - Filter controls: by Decision, by risk level, by specific flag
  - Column sorting on all numeric columns
  - Bulk action bar: approve selected, escalate selected
  - Export button → downloads original tape + decision/score/flag columns as Excel

- [ ] **S3-F5** — Create `src/app/(control-panel)/bulk-portfolios/FraudLoanDetailPanel.tsx`
  - Side drawer or dialog
  - Organized in sections matching the 8 tape sections
  - Active flags section: each flag with rule description, actual value, threshold value
  - Reviewer Notes text field (saved via PATCH on the job item)
  - Override Decision selector with reason (audit trail)

- [ ] **S3-F6** — Modify `bulk-portfolios/page.tsx` Step 3 rendering
  - If `job.processingMode === 'TAPE_EVALUATION'`: render `<FraudTapeResultsGrid>`
  - Else: render existing order-creation results table

- [ ] **S3-F7** — Add `processingMode` to `BulkSubmitRequest` in frontend type + form submission

---

### Sprint 4 — Document Extraction Path (Est. 5–7 days)

#### Backend

- [ ] **S4-B1** — Create `src/types/fraud-tape.types.ts` addition: `FraudExtractionSpec`
  - 73-field extraction spec formatted for Axiom API
  - Maps each field to: type, description, required, extraction hints

- [ ] **S4-B2** — Create `src/services/fraud-document-extraction.service.ts`
  - `submitDocuments(loanDocMap: Map<string, string>, spec: FraudExtractionSpec): Promise<Map<string, string>>` — returns map of loanNumber → evaluationId
  - `pollResults(evaluationIds: string[]): Promise<Map<string, AxiomEvaluationResult>>`
  - `mapAxiomResultToTapeItem(result: AxiomEvaluationResult, loanNumber: string): Partial<FraudRiskTapeItem>`

- [ ] **S4-B3** — Extend `BulkPortfolioService` for `processingMode === 'DOCUMENT_EXTRACTION'`
  - Accept document map in request (Blob SAS URLs per loan number)
  - Submit to `FraudDocumentExtractionService`
  - Track async progress via `BulkPortfolioJob.status = 'PROCESSING'`
  - On Axiom webhook completion: map results → `FraudRiskTapeItem` → evaluate → store results

- [ ] **S4-B4** — Create webhook handler for Axiom completion during fraud extraction
  - Correlate `evaluationId` back to a `BulkPortfolioJob` and loan number
  - Trigger evaluation of completed loan when extracted

#### Frontend

- [ ] **S4-F1** — Add document upload tab/path in Step 1 of the bulk wizard
  - Secondary upload zone: "Upload Appraisal PDFs (one per loan)"
  - Each PDF must be associated with a loan number
  - Auto-associate by filename: `{loanNumber}.pdf` or `{loanNumber}_{anything}.pdf`
  - Manual association UI for unmatched PDFs

- [ ] **S4-F2** — Add processing status UI for async extraction jobs
  - Progress bar during Axiom extraction
  - WebPubSub integration for real-time updates
  - Per-loan status: Queued → Extracting → Complete / Failed

---

### Sprint 5 — Fraud Programs Admin (Est. 2–3 days)

#### Frontend

- [ ] **S5-F1** — Create `src/app/(control-panel)/fraud-detection/programs/page.tsx`
  - List all fraud programs (active + archived)
  - Create new program (copy from existing version)
  - View program detail: thresholds, flag rules, decision rules

- [ ] **S5-F2** — Threshold editor component
  - Numeric inputs for all 9 thresholds
  - Validation: thresholds must be within reasonable bounds
  - "Preview impact" feature: show how many loans in recent jobs would change decision under new thresholds

#### Backend

- [ ] **S5-B1** — Add to `fraud-programs.controller.ts`:
  - `POST /api/fraud-programs` — create new program version
  - `PATCH /api/fraud-programs/:id` — update thresholds (creates a new version)
  - `DELETE /api/fraud-programs/:id` — soft-delete (set status to ARCHIVED)

---

## 9. File-Level Change Index

### New Files (Backend)

| File | Sprint | Purpose |
|------|--------|---------|
| `src/types/fraud-tape.types.ts` | S1 | All fraud tape types |
| `src/data/fraud-programs.ts` | S1 | VisionAppraisal v1.0 seed data |
| `src/services/fraud-tape-evaluation.service.ts` | S2 | Flag evaluation engine |
| `src/controllers/fraud-programs.controller.ts` | S2 | Fraud programs CRUD API |
| `src/services/fraud-document-extraction.service.ts` | S4 | Axiom extraction orchestration |
| `infrastructure/modules/cosmos-fraud-containers.bicep` | S2 | `fraud-programs` Cosmos container |

### Modified Files (Backend)

| File | Sprint | Change |
|------|--------|--------|
| `src/types/bulk-portfolio.types.ts` | S1 | Add `processingMode`, `fraudProgramId`, `fraudProgramVersion` to `BulkPortfolioJob` |
| `src/services/bulk-portfolio.service.ts` | S2 | Branch on `processingMode` to call evaluation vs. order creation |
| `src/controllers/bulk-portfolio.controller.ts` | S2 | Accept + validate `processingMode`, `fraudProgramId`; add fraud-results endpoint |
| `src/api/api-server.ts` | S2 | Register `/api/fraud-programs` router |

### New Files (Frontend)

| File | Sprint | Purpose |
|------|--------|---------|
| `src/types/backend/fraud-tape.types.ts` | S1 | Mirror of backend fraud tape types |
| `src/app/(control-panel)/bulk-portfolios/FraudProgramSelector.tsx` | S3 | Program/version dropdown |
| `src/app/(control-panel)/bulk-portfolios/FraudTapeResultsGrid.tsx` | S3 | Results data grid |
| `src/app/(control-panel)/bulk-portfolios/FraudLoanDetailPanel.tsx` | S3 | Per-loan drill-down |
| `src/app/(control-panel)/fraud-detection/programs/page.tsx` | S5 | Admin UI |

### Modified Files (Frontend)

| File | Sprint | Change |
|------|--------|--------|
| `src/types/backend/index.ts` | S1 | Export fraud-tape.types |
| `src/app/(control-panel)/bulk-portfolios/page.tsx` | S1+S3 | Extend COLUMN_ALIASES, add computed fields, FraudProgramSelector, conditional Step 3 |
| `src/store/api/bulkPortfoliosApi.ts` | S3 | Add `getFraudPrograms`, `getFraudResults` endpoints |

---

## 10. Data Model Reference

### `FraudRiskTapeItem` (all 73 fields, TypeScript)

```typescript
export interface FraudRiskTapeItem {
  // Row tracking
  rowIndex: number;
  loanNumber?: string;

  // Section A — Loan / Borrower
  borrowerName?: string;
  loanPurpose?: 'Purchase' | 'Rate/Term Refi' | 'Cash-Out Refi' | 'Bridge' | 'DSCR' | 'Other';
  loanType?: 'Conventional' | 'Jumbo' | 'Non-QM' | 'DSCR' | 'Bridge' | 'Private Lender';
  loanAmount?: number;
  firstLienBalance?: number;
  secondLienBalance?: number;
  appraisedValue?: number;
  contractPrice?: number;
  priorPurchasePrice?: number;
  priorPurchaseDate?: string;        // ISO date
  ltv?: number;                      // CALCULATED: loanAmount / appraisedValue
  cltv?: number;                     // CALCULATED: (firstLien + secondLien) / appraisedValue
  occupancyType?: 'Owner-Occupied' | 'Second Home' | 'Investment';
  dscr?: number;

  // Section B — Property Identity
  address: string;
  city: string;
  county?: string;
  state: string;
  zip: string;
  censusTract?: string;

  // Section C — Classification
  propertyType?: 'SFR' | 'Condo' | 'Townhome' | '2-4 Unit' | 'Manufactured' | 'Mixed-Use (SBC)' | 'Other';
  units?: number;

  // Section D — Physical
  yearBuilt?: number;
  glaSf?: number;
  basementSf?: number;
  lotSize?: string;
  beds?: number;
  bathsFull?: number;
  bathsHalf?: number;
  parking?: string;
  conditionRating?: string;
  qualityRating?: string;
  effectiveAge?: string;
  renovationDate?: string;

  // Section E — Appraisal
  appraisalEffectiveDate?: string;   // ISO date
  appraiserLicense?: string;
  formType?: string;
  reconciliationNotes?: string;

  // Section F — Prior Sales
  priorSale24mPrice?: number;
  priorSale24mDate?: string;
  appreciation24m?: number;          // CALCULATED
  priorSale36mPrice?: number;
  priorSale36mDate?: string;
  appreciation36m?: number;          // CALCULATED

  // Section G — Market & Comps
  marketTrend?: 'Increasing' | 'Stable' | 'Declining';
  avgDom?: number;
  monthsInventory?: number;
  numComps?: number;
  compPriceRangeLow?: number;
  compPriceRangeHigh?: number;
  avgPricePerSf?: number;
  avgDistanceMi?: number;
  maxDistanceMi?: number;
  compsDateRangeMonths?: number;
  nonMlsCount?: number;
  nonMlsPct?: number;                // CALCULATED: nonMlsCount / numComps
  avgNetAdjPct?: number;
  avgGrossAdjPct?: number;

  // Section H — Flags & Decision
  highNetGrossFlag?: string;         // AUTO-COMPUTED
  chainOfTitleRedFlags?: boolean;
  cashOutRefi?: boolean;             // Derived from loanPurpose
  avmValue?: number;
  avmGapPct?: number;               // CALCULATED
  highRiskGeographyFlag?: boolean;
  ucdpSsrScore?: string;
  collateralRiskRating?: 'Low' | 'Medium' | 'High';
  appraiserGeoCompetency?: boolean;
  unusualAppreciationFlag?: string;  // AUTO-COMPUTED
  dscrFlag?: string;                 // AUTO-COMPUTED
  nonPublicCompsFlag?: string;       // AUTO-COMPUTED
  overallDecision?: 'Accept' | 'Conditional' | 'Reject';
  reviewerNotes?: string;
}
```

### `FraudTapeResult` (extends FraudRiskTapeItem)

```typescript
export interface FraudTapeResult extends FraudRiskTapeItem {
  // Evaluation output
  riskScore: number;                 // 0–100
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';
  firedFlags: FraudAutoFlag[];       // Only flags that fired
  allFlags: FraudAutoFlag[];         // All evaluated flags with fired status
  computedDecision: 'Accept' | 'Conditional' | 'Reject';
  reviewerOverrideDecision?: 'Accept' | 'Conditional' | 'Reject';
  reviewerOverrideReason?: string;
  reviewerOverrideBy?: string;
  reviewerOverrideAt?: string;

  // Metadata
  evaluatedAt: string;
  fraudProgramId: string;
  fraudProgramVersion: string;
  dataQualityIssues: string[];       // Missing required fields, etc.

  // Axiom extraction (Path B/C only)
  axiomEvaluationId?: string;
  axiomExtractionConfidence?: number;
}
```

---

## 11. API Endpoint Reference

### Existing (already wired, extend only)

| Method | Route | Change in Sprint |
|--------|-------|-----------------|
| `POST` | `/api/bulk-portfolios/submit` | S2: add `processingMode`, `fraudProgramId` fields |
| `GET` | `/api/bulk-portfolios` | No change |
| `GET` | `/api/bulk-portfolios/:jobId` | No change |

### New Endpoints

| Method | Route | Sprint | Description |
|--------|-------|--------|-------------|
| `GET` | `/api/fraud-programs` | S2 | List active fraud programs |
| `GET` | `/api/fraud-programs/:id` | S2 | Get program by ID |
| `GET` | `/api/fraud-programs/:id/versions` | S2 | Get version history |
| `POST` | `/api/fraud-programs` | S5 | Create new program |
| `PATCH` | `/api/fraud-programs/:id` | S5 | Update thresholds (new version) |
| `DELETE` | `/api/fraud-programs/:id` | S5 | Archive program |
| `GET` | `/api/bulk-portfolios/:jobId/fraud-results` | S2 | Get tape evaluation results |

### Existing Fraud Detection Endpoints (no change)

| Method | Route | Notes |
|--------|-------|-------|
| `POST` | `/api/fraud-detection/analyze` | Single-appraisal analysis |
| `POST` | `/api/fraud-detection/quick-check` | Rules-only check |
| `POST` | `/api/fraud-detection/batch-analyze` | Batch by orderIds |

---

## 12. UI Component Reference

### Existing Components (reuse)

| Component | Location | Reuse Notes |
|-----------|----------|-------------|
| `BulkPortfoliosPage` | `bulk-portfolios/page.tsx` | Extend with fraud-specific behavior |
| `FraudDetectionPage` | `fraud-detection/page.tsx` | No change — complementary use |
| `useSubmitBulkPortfolioMutation` | `bulkPortfoliosApi.ts` | Extend payload shape |

### New Components

| Component | Sprint | Description |
|-----------|--------|-------------|
| `FraudProgramSelector` | S3 | Dropdown for fraud program selection in Step 1 |
| `FraudTapeResultsGrid` | S3 | Main results view — data grid with flags |
| `FraudLoanDetailPanel` | S3 | Per-loan drill-down side drawer |
| `FraudFlagChip` | S3 | Reusable colored chip for a single flag |
| `FraudDecisionBadge` | S3 | Accept/Conditional/Reject badge |
| `FraudSummaryStats` | S3 | Summary cards at top of results (totals, avg score) |
| `FraudThresholdEditor` | S5 | Admin threshold editing form |
| `FraudProgramsPage` | S5 | Admin program management page |

---

## 13. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Axiom extraction spec for 73 fields needs to be co-designed with Axiom team | Medium | High | Sprint 4 depends on this — confirm Axiom field spec format before starting S4 |
| Large tapes (> 500 rows) require async orchestration not yet built | Low (most tapes are < 200) | Medium | Enforce 500-row cap server-side in Sprints 1–3; build async path in Sprint 4 via PORTFOLIO_ANALYTICS_ARCHITECTURE.md pattern |
| `fraud-programs` Cosmos container must be deployed before seeding | High (infra change required) | High | S2-INFRA1 must be merged and deployed to staging before S2-B7 is coded |
| Different clients may use different field names in their tapes | Medium | Medium | Extend COLUMN_ALIASES liberally; accept `null` for unknown fields; never throw on unrecognized columns |
| Computed fields silently wrong if source inputs are bad data | Medium | Medium | S2-B1: log data quality issues per row; never silently produce a computed flag from bad input |
| Reviewer override decisions not tracked properly (audit risk) | Low | High | S3-F5: override must capture who, when, and reason — stored immutably |
| Frontend type drift from backend types | Medium | Medium | `src/types/backend/fraud-tape.types.ts` is a **mirror** — any backend change requires parallel frontend update; document this in the type file header |

---

## 14. Testing Strategy

### Unit Tests (Backend)

- [ ] `FraudTapeEvaluationService.evaluate()` — test each auto-flag with values just at, above, and below threshold
- [ ] `FraudTapeEvaluationService` computed fields — LTV, CLTV, appreciation %, AVM gap %
- [ ] `FraudTapeEvaluationService` decision derivation — verify score → decision mapping
- [ ] Missing source field handling — verify null computed field when source is null
- [ ] `FraudProgram` threshold override — verify custom thresholds fire correctly

### Integration Tests (Backend)

- [ ] `POST /api/bulk-portfolios/submit` with `processingMode: 'TAPE_EVALUATION'` returns results (not orders)
- [ ] `GET /api/bulk-portfolios/:jobId/fraud-results` returns the full tape result array
- [ ] `GET /api/fraud-programs` returns the seeded VisionAppraisal v1.0 program
- [ ] Missing `fraudProgramId` when `processingMode === 'TAPE_EVALUATION'` returns 400

### Frontend Tests

- [ ] `parseSheet()` with the VisionAppraisal tape headers normalizes all 73 columns correctly
- [ ] Computed fields are calculated when source columns are present
- [ ] Computed fields are `undefined` (not `NaN`) when source fields are absent
- [ ] `FraudTapeResultsGrid` renders with zero rows without crashing
- [ ] `FraudTapeResultsGrid` filter by Decision narrows the displayed rows correctly
- [ ] Export produces an Excel file (XLSX library test)

### End-to-End

- [ ] Upload the actual `VisionAppraisal_Risk_Template.xlsx` (populate 5 rows of test data in Sheet 1) through the bulk portfolios wizard with `analysisType: FRAUD` → verify results grid shows correct flags and decisions
- [ ] Verify a `Conditional` loan can be overridden to `Accept` with a reason captured

---

## Progress Tracking

> **⚠️ ARCHITECTURAL RENAME (applied retroactively):**  
> All `Fraud*` type/file names were refactored to generic `Review*` / `RiskTape*` names
> because fraud is merely a `programType` value — the engine is completely generic.
> File name mappings: `fraud-tape.types.ts` → `review-tape.types.ts`,
> `fraud-programs.ts` → `review-programs.ts`, `FraudTapeEvaluationService` → `TapeEvaluationService`,
> `cosmos-fraud-containers.bicep` → `cosmos-review-containers.bicep`,
> `fraudProgramId` → `reviewProgramId`, `/api/fraud-programs` → `/api/review-programs`.  
> Plan task IDs are unchanged for traceability.

Update the status column as work progresses.

| Task ID | Description | Sprint | Status | Notes |
|---------|-------------|--------|--------|-------|
| S1-B1 | `review-tape.types.ts` backend (was `fraud-tape.types.ts`) | 1 | ✅ Done | `RiskTapeItem` (73 fields), `ReviewProgram`, `TapeProcessingMode`, `ReviewTapeResult`, `ReviewTapeJobSummary` |
| S1-B2 | Extend `bulk-portfolio.types.ts` | 1 | ✅ Done | Added `processingMode`, `reviewProgramId`, `reviewProgramVersion`, `reviewSummary` |
| S1-B3 | Seed data `review-programs.ts` (was `fraud-programs.ts`) | 1 | ✅ Done | `VISION_APPRAISAL_V1_PROGRAM` with 8 auto-flags + 3 manual flags |
| S1-F1 | `review-tape.types.ts` frontend mirror (was `fraud-tape.types.ts`) | 1 | ✅ Done | Mirror in `src/types/backend/review-tape.types.ts` |
| S1-F2 | Export from `types/backend/index.ts` | 1 | ✅ Done | `export * from './review-tape.types'` |
| S1-F3 | Extend `COLUMN_ALIASES` (73 fields) | 1 | ✅ Done | All 73 tape fields in `bulk-portfolios/page.tsx` |
| S1-F4 | Computed fields in `parseSheet()` → `computeTapeFields()` | 1 | ✅ Done | LTV, CLTV, appreciation%, AVM gap%, Non-MLS% |
| S2-INFRA1 | `cosmos-review-containers.bicep` (was `cosmos-fraud-containers.bicep`) | 2 | ✅ Done | `review-programs` + `review-results` containers |
| S2-B1 | `TapeEvaluationService` (was `FraudTapeEvaluationService`) | 2 | ✅ Done | 66/66 unit tests passing — `tape-evaluation.test.ts` |
| S2-B2 | `ReviewProgramsController` (was `FraudProgramsController`) | 2 | ✅ Done | `src/controllers/review-programs.controller.ts` — GET /, GET /:id, GET /:id/versions |
| S2-B3 | Register `/api/review-programs` route (was `/api/fraud-programs`) | 2 | ✅ Done | Registered in `api-server.ts` after `/api/bulk-portfolios` |
| S2-B4 | Extend `BulkPortfolioService` | 2 | ✅ Done | `_submitTapeEvaluation()` private method + `_computeTapeJobSummary()` |
| S2-B5 | Extend submit endpoint validation | 2 | ✅ Done | `processingMode` + conditional ORDER_CREATION item validators |
| S2-B6 | Add `review-results` endpoint (was `fraud-results`) | 2 | ✅ Done | `GET /:jobId/review-results` in `bulk-portfolio.controller.ts` |
| S2-B7 | Seed VisionAppraisal v1.0 to Cosmos | 2 | ✅ Done | `seedReviewPrograms()` in `api-server.ts` `initializeDatabase()` |
| S3-F1 | `ReviewProgramSelector` component (was `FraudProgramSelector`) | 3 | ✅ Done | `bulk-portfolios/ReviewProgramSelector.tsx` — dropdown from GET /api/review-programs |
| S3-F2 | Wire programId into wizard state | 3 | ✅ Done | `selectedProgramId` state + passed in both TAPE_EVALUATION and DOCUMENT_EXTRACTION submit paths |
| S3-F3 | RTK Query endpoints for review programs | 3 | ✅ Done | `getReviewPrograms`, `getReviewResults`, `getExtractionProgress` in `bulkPortfoliosApi.ts` |
| S3-F4 | `ReviewTapeResultsGrid` component (was `FraudTapeResultsGrid`) | 3 | ✅ Done | `bulk-portfolios/ReviewTapeResultsGrid.tsx` — summary cards, sort, filter, export, bulk actions |
| S3-F5 | `ReviewLoanDetailPanel` component (was `FraudLoanDetailPanel`) | 3 | ✅ Done | `bulk-portfolios/ReviewLoanDetailPanel.tsx` — all 8 sections + flags + reviewer notes + override decision |
| S3-F6 | Conditional Step 3 in bulk wizard | 3 | ✅ Done | `page.tsx` renders `<ReviewTapeResultsGrid>` when `processingMode === 'TAPE_EVALUATION'` |
| S3-F7 | `processingMode` in submit payload | 3 | ✅ Done | Submit body includes `processingMode` and `reviewProgramId` |
| S4-B1 | `ReviewExtractionSpec` type (was `FraudExtractionSpec`) | 4 | ✅ Done | `TapeExtractionRequest` in `review-tape.types.ts`; Axiom contract v1.0 in `API_CONTRACT.md` |
| S4-B2 | `ReviewDocumentExtractionService` (was `FraudDocumentExtractionService`) | 4 | ✅ Done | `src/services/review-document-extraction.service.ts` |
| S4-B3 | `BulkPortfolioService` document path | 4 | ✅ Done | `_submitDocumentExtraction()` + `processExtractionCompletion()` |
| S4-B4 | Axiom webhook for extraction | 4 | ✅ Done | `src/controllers/axiom.controller.ts` `/webhook/extraction` endpoint |
| S4-F1 | Document upload in wizard Step 1 | 4 | ✅ Done | DOCUMENT_EXTRACTION mode in `bulk-portfolios/page.tsx` with PDF upload zone |
| S4-F2 | Async extraction progress UI | 4 | ✅ Done | `ExtractionProgressPanel.tsx` with per-loan status and polling |
| S5-B1 | Review program admin endpoints | 5 | ✅ Done | POST, PUT, PATCH /status, DELETE in `review-programs.controller.ts` |
| S5-F1 | Review programs admin page | 5 | ✅ Done | `review-programs/page.tsx` with paginated table, status filter, CRUD dialogs |
| S5-F2 | Threshold editor + flag editor | 5 | ✅ Done | `ReviewProgramFormDialog.tsx` — 3 tabs (Config / Auto-flags / Manual Flags) with full condition builder |

**Status legend:** ⬜ Not Started · 🔄 In Progress · ✅ Done · 🚫 Blocked

---

*End of document — last updated February 23, 2026 · progress updated (all sprints S1–S5 complete · reviewer notes PATCH endpoint added)*
