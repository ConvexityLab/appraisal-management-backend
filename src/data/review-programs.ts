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

  // ── Thresholds ─────────────────────────────────────────────────────────────
  thresholds: {
    ltv: 0.80,
    cltv: 0.90,
    dscrMinimum: 1.0,
    appreciation24mPct: 0.25,
    appreciation36mPct: 0.35,
    netAdjustmentPct: 0.15,
    grossAdjustmentPct: 0.25,
    nonMlsPct: 0.20,
    avmGapPct: 0.10,
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
          { field: 'avgNetAdjPct', op: 'GT', thresholdKey: 'netAdjustmentPct' },
          { field: 'avgGrossAdjPct', op: 'GT', thresholdKey: 'grossAdjustmentPct' },
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
          { field: 'priorSale24mPrice', op: 'GT', value: 0 },
          { field: 'appreciation24m', op: 'GT', thresholdKey: 'appreciation24mPct' },
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
          { field: 'priorSale36mPrice', op: 'GT', value: 0 },
          { field: 'appreciation36m', op: 'GT', thresholdKey: 'appreciation36mPct' },
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
          { field: 'dscr', op: 'NOT_NULL' },
          { field: 'dscr', op: 'LT', thresholdKey: 'dscrMinimum' },
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
          { field: 'numComps', op: 'GT', value: 0 },
          { field: 'nonMlsPct', op: 'GT', thresholdKey: 'nonMlsPct' },
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
          { field: 'avmValue', op: 'GT', value: 0 },
          { field: 'avmGapPct', op: 'GT', thresholdKey: 'avmGapPct' },
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
          { field: 'ltv', op: 'NOT_NULL' },
          { field: 'ltv', op: 'GT', thresholdKey: 'ltv' },
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
          { field: 'cltv', op: 'NOT_NULL' },
          { field: 'cltv', op: 'GT', thresholdKey: 'cltv' },
        ],
      },
    },
  ],

  // ── Manual flags (fired from explicit boolean tape fields) ─────────────────
  manualFlags: [
    {
      id: 'CHAIN_OF_TITLE',
      label: 'Chain of Title Red Flags',
      description: 'Appraiser noted chain of title concerns in the report',
      field: 'chainOfTitleRedFlags',
      severity: 'CRITICAL',
      weight: 40,
    },
    {
      id: 'HIGH_RISK_GEOGRAPHY',
      label: 'High-Risk Geography',
      description: 'Property is in a flagged geographic risk area',
      field: 'highRiskGeographyFlag',
      severity: 'MEDIUM',
      weight: 10,
    },
    {
      id: 'APPRAISER_GEO_COMPETENCY',
      label: 'Appraiser Geographic Competency',
      description: 'Appraiser may lack competency for subject geography',
      field: 'appraiserGeoCompetency',
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
