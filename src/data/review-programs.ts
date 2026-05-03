/**
 * Review Programs Seed Data
 *
 * Versioned ReviewProgram documents upserted into the `review-programs`
 * Cosmos container during API server startup.
 *
 * The `review-programs` container must already exist (provisioned via Bicep).
 * This file must NOT call createIfNotExists or any infrastructure-creation API.
 *
 * Source: data/fraud/VisionAppraisal_Risk_Template.xlsx — Sheet 3 (Thresholds)
 *         and current-plan/FRAUD_CRITERIA_REVIEW_PLAN.md — Section 6
 */

import type { ReviewProgram } from '../types/review-tape.types.js';

export const VISION_APPRAISAL_V1_PROGRAM: ReviewProgram = {
  id: 'vision-appraisal-v1.0',
  name: 'VisionAppraisal Risk Program',
  version: '1.0',
  programType: 'FRAUD',
  status: 'ACTIVE',
  // null = platform-wide default; all clients can use it unless overridden
  clientId: null,
  createdAt: '2026-02-23T00:00:00.000Z',

  // ── Engine references ──────────────────────────────────────────────────────
  // Deterministic rules compiled and dispatched to MOP_PRIO.
  rulesetRefs: [
    { programId: 'vision-appraisal', programVersion: '1.0' },
  ],

  // Stochastic/AI criteria dispatched to the Axiom engine.
  // programId must match a registered Axiom criteria program
  // (seed file: axiom/seed-data/criteria/appraisal-qc-platform-delta.json).
  aiCriteriaRefs: [
    { programId: 'appraisal-qc', programVersion: '1.0.0' },
  ],

  // ── Inline thresholds / flags (legacy) ────────────────────────────────────
  // All percentage thresholds are expressed as PERCENTAGES (e.g. 80 means 80%)
  // to match the canonical-schema convention (LoanToValueRatioPercent: 80,
  // averageNetAdjustmentPercent: 15, etc.). DSCR is a unitless ratio.
  thresholds: {
    ltv: 80,
    cltv: 90,
    dscrMinimum: 1.0,
    appreciation24mPct: 25,
    appreciation36mPct: 35,
    netAdjustmentPct: 15,
    grossAdjustmentPct: 25,
    nonMlsPct: 20,
    avmGapPct: 10,
  },

  // ── Auto-flags (rule-based; fired by evaluation engine) ────────────────────
  autoFlags: [
    {
      id: 'HIGH_NET_GROSS_ADJ',
      label: 'High Net/Gross Adjustment',
      description: 'Average net or gross comp adjustment exceeds threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'OR',
        rules: [
          { field: 'compStatistics.averageNetAdjustmentPercent', op: 'GT', thresholdKey: 'netAdjustmentPct' },
          { field: 'compStatistics.averageGrossAdjustmentPercent', op: 'GT', thresholdKey: 'grossAdjustmentPct' },
        ],
      },
    },
    {
      id: 'UNUSUAL_APPRECIATION_24M',
      label: 'Unusual 24-Month Appreciation',
      description: 'Price appreciation over prior 24 months exceeds threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'transactionHistory.priorSalePrice24m', op: 'GT', value: 0 },
          { field: 'transactionHistory.appreciation24mPercent', op: 'GT', thresholdKey: 'appreciation24mPct' },
        ],
      },
    },
    {
      id: 'UNUSUAL_APPRECIATION_36M',
      label: 'Unusual 36-Month Appreciation',
      description: 'Price appreciation over prior 36 months exceeds threshold',
      severity: 'MEDIUM',
      weight: 10,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'transactionHistory.priorSalePrice36m', op: 'GT', value: 0 },
          { field: 'transactionHistory.appreciation36mPercent', op: 'GT', thresholdKey: 'appreciation36mPct' },
        ],
      },
    },
    {
      id: 'DSCR_FLAG',
      label: 'DSCR Below Minimum',
      description: 'Debt Service Coverage Ratio is below program minimum',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'ratios.debtServiceCoverageRatio', op: 'NOT_NULL' },
          { field: 'ratios.debtServiceCoverageRatio', op: 'LT', thresholdKey: 'dscrMinimum' },
        ],
      },
    },
    {
      id: 'NON_PUBLIC_COMPS',
      label: 'Non-MLS / Non-Public Comparables',
      description: 'Excessive use of non-MLS comparable sales',
      severity: 'MEDIUM',
      weight: 10,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'compStatistics.selectedCompCount', op: 'GT', value: 0 },
          { field: 'compStatistics.nonMlsCompPercent', op: 'GT', thresholdKey: 'nonMlsPct' },
        ],
      },
    },
    {
      id: 'AVM_GAP',
      label: 'AVM Value Gap',
      description: 'Appraised value deviates from AVM beyond threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'avmCrossCheck.avmValue', op: 'GT', value: 0 },
          { field: 'avmCrossCheck.avmGapPercent', op: 'GT', thresholdKey: 'avmGapPct' },
        ],
      },
    },
    {
      id: 'HIGH_LTV',
      label: 'High LTV',
      description: 'Loan-to-value ratio exceeds program threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'ratios.loanToValueRatioPercent', op: 'NOT_NULL' },
          { field: 'ratios.loanToValueRatioPercent', op: 'GT', thresholdKey: 'ltv' },
        ],
      },
    },
    {
      id: 'HIGH_CLTV',
      label: 'High CLTV',
      description: 'Combined loan-to-value ratio exceeds program threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'ratios.combinedLoanToValueRatioPercent', op: 'NOT_NULL' },
          { field: 'ratios.combinedLoanToValueRatioPercent', op: 'GT', thresholdKey: 'cltv' },
        ],
      },
    },
  ],

  // ── Manual flags (fired from canonical riskFlags branch) ───────────────────
  manualFlags: [
    {
      id: 'CHAIN_OF_TITLE',
      label: 'Chain of Title Red Flags',
      description: 'Appraiser noted chain of title concerns in the report',
      field: 'riskFlags.chainOfTitleRedFlags',
      severity: 'CRITICAL',
      weight: 40,
    },
    {
      id: 'HIGH_RISK_GEOGRAPHY',
      label: 'High-Risk Geography',
      description: 'Property is in a flagged geographic risk area',
      field: 'riskFlags.highRiskGeography',
      severity: 'MEDIUM',
      weight: 10,
    },
    {
      id: 'APPRAISER_GEO_COMPETENCY',
      label: 'Appraiser Geographic Competency',
      description: 'Appraiser may lack competency for subject geography',
      field: 'riskFlags.appraiserGeoCompetency',
      severity: 'MEDIUM',
      weight: 10,
    },
  ],

  // ── Decision thresholds ────────────────────────────────────────────────────
  decisionRules: {
    reject: { minScore: 70 },
    conditional: { minScore: 35 },
    accept: { maxScore: 34 },
  },
};

/** All seeded programs — iterated by the startup seeder. */
export const REVIEW_PROGRAM_SEEDS: ReviewProgram[] = [VISION_APPRAISAL_V1_PROGRAM];
