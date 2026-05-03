/**
 * MOP Criteria Seed Data
 *
 * Canonical (platform-wide) MopCriteriaDefinition documents.
 * These are the base rule sets that any client can use as-is or override
 * with a client-tier document in the same `mop-criteria` container.
 *
 * Rule values are extracted from the original VISION_APPRAISAL_V1_PROGRAM
 * inline definition and promoted into the first-class tier hierarchy.
 *
 * The `mop-criteria` container must already exist (provisioned via Bicep).
 * This file must NOT call createIfNotExists or any infrastructure-creation API.
 */

import type { MopCriteriaDefinition } from '../types/mop-criteria.types.js';

export const CANONICAL_VISION_APPRAISAL_V1: MopCriteriaDefinition = {
  id: 'canonical-vision-appraisal-1.0',
  programId: 'vision-appraisal',
  programVersion: '1.0',
  tier: 'canonical',
  clientId: null,
  status: 'ACTIVE',
  createdAt: '2026-02-23T00:00:00.000Z',
  updatedAt: '2026-02-23T00:00:00.000Z',

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
      id: 'HIGH_LTV',
      label: 'High LTV',
      description: 'Loan-to-value ratio exceeds threshold',
      severity: 'HIGH',
      weight: 15,
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
      description: 'Combined loan-to-value ratio exceeds threshold',
      severity: 'MEDIUM',
      weight: 10,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'cltv', op: 'NOT_NULL' },
          { field: 'cltv', op: 'GT', thresholdKey: 'cltv' },
        ],
      },
    },
    {
      id: 'DSCR_BELOW_MINIMUM',
      label: 'DSCR Below Minimum',
      description: 'Debt service coverage ratio is below the required minimum',
      severity: 'CRITICAL',
      weight: 25,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'dscr', op: 'NOT_NULL' },
          { field: 'dscr', op: 'LT', thresholdKey: 'dscrMinimum' },
        ],
      },
    },
    {
      id: 'HIGH_AVM_GAP',
      label: 'High AVM Gap',
      description: 'Difference between appraised value and AVM value exceeds threshold',
      severity: 'HIGH',
      weight: 20,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'avmGapPct', op: 'NOT_NULL' },
          { field: 'avmGapPct', op: 'GT', thresholdKey: 'avmGapPct' },
        ],
      },
    },
    {
      id: 'HIGH_NON_MLS_COMPS',
      label: 'High Non-MLS Comparable Ratio',
      description: 'Percentage of non-public comparable sales exceeds threshold',
      severity: 'MEDIUM',
      weight: 10,
      condition: {
        operator: 'AND',
        rules: [
          { field: 'nonMlsPct', op: 'NOT_NULL' },
          { field: 'nonMlsPct', op: 'GT', thresholdKey: 'nonMlsPct' },
        ],
      },
    },
  ],

  manualFlags: [
    {
      id: 'CHAIN_OF_TITLE_RED_FLAGS',
      label: 'Chain of Title Red Flags',
      description: 'Appraiser noted chain of title concerns in report',
      field: 'chainOfTitleRedFlags',
      severity: 'HIGH',
      weight: 20,
    },
    {
      id: 'CASH_OUT_REFI',
      label: 'Cash-Out Refinance',
      description: 'Loan purpose is cash-out refinance',
      field: 'cashOutRefi',
      severity: 'LOW',
      weight: 5,
    },
    {
      id: 'HIGH_RISK_GEOGRAPHY',
      label: 'High-Risk Geography',
      description: 'Property is in a high-risk geographic area',
      field: 'highRiskGeographyFlag',
      severity: 'HIGH',
      weight: 20,
    },
  ],

  decisionRules: {
    reject:      { minScore: 60 },
    conditional: { minScore: 30 },
    accept:      { maxScore: 29 },
  },
};

/** All canonical MOP criteria definitions for seeding. */
export const ALL_CANONICAL_MOP_CRITERIA: MopCriteriaDefinition[] = [
  CANONICAL_VISION_APPRAISAL_V1,
];
