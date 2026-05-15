/**
 * Unit tests for the pure helpers exported by review-program-replay.service.
 *
 * Phase F.replay of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * The full integration path (loading historical decisions + running
 * TapeEvaluationService) is exercised live-fire; here we cover the
 * deterministic helpers that future regressions would silently break:
 *   - collectFragments: filters unknown shapes, accepts the four kinds
 *   - applyFragments:  threshold/decision-rules replace; flags upsert by id
 *   - projectResultToTapeItem: strips result-only fields, preserves source
 */

import { describe, it, expect } from 'vitest';
import {
  collectFragments,
  applyFragments,
  projectResultToTapeItem,
} from '../review-program-replay.service.js';
import type {
  ReviewProgram,
  ReviewProgramAutoFlagDef,
  ReviewProgramManualFlagDef,
  ReviewTapeResult,
} from '../../../../types/review-tape.types.js';

const baselineProgram = (): ReviewProgram => ({
  id: 'prog-1',
  name: 'Baseline',
  version: '1',
  programType: 'FRAUD',
  status: 'ACTIVE',
  clientId: null,
  createdAt: '2026-01-01T00:00:00Z',
  thresholds: {
    ltv: 0.8,
    cltv: 0.9,
    dscrMinimum: 1.0,
    appreciation24mPct: 0.25,
    appreciation36mPct: 0.35,
    netAdjustmentPct: 0.15,
    grossAdjustmentPct: 0.25,
    nonMlsPct: 0.2,
    avmGapPct: 0.1,
  },
  autoFlags: [
    {
      id: 'HIGH_LTV',
      label: 'High LTV',
      description: 'LTV exceeds threshold',
      severity: 'HIGH',
      weight: 10,
      condition: {
        operator: 'AND',
        rules: [{ field: 'ratios.loanToValueRatioPercent', op: 'GT', thresholdKey: 'ltv' }],
      },
    },
  ],
  manualFlags: [
    {
      id: 'CHAIN_OF_TITLE',
      label: 'Chain of title red flags',
      description: '',
      field: 'riskFlags.chainOfTitleRedFlags',
      severity: 'MEDIUM',
      weight: 5,
    },
  ],
  decisionRules: {
    reject: { minScore: 50 },
    conditional: { minScore: 20 },
    accept: { maxScore: 19 },
  },
});

describe('collectFragments', () => {
  it('returns [] for undefined / non-array input', () => {
    expect(collectFragments(undefined)).toEqual([]);
    expect(collectFragments(null as unknown as unknown[])).toEqual([]);
    expect(collectFragments('not an array' as unknown as unknown[])).toEqual([]);
  });

  it('drops items without a recognized kind discriminator', () => {
    expect(collectFragments([
      { name: 'unrelated', pattern_id: 'data', salience: 0, conditions: {}, actions: [] },
      null,
      'string',
      42,
    ])).toEqual([]);
  });

  it('accepts the four supported fragment kinds', () => {
    const thresholds: ReviewProgram['thresholds'] = baselineProgram().thresholds!;
    const decisionRules: ReviewProgram['decisionRules'] = baselineProgram().decisionRules!;
    const af: ReviewProgramAutoFlagDef = baselineProgram().autoFlags![0]!;
    const mf: ReviewProgramManualFlagDef = baselineProgram().manualFlags![0]!;

    const out = collectFragments([
      { kind: 'thresholds', thresholds },
      { kind: 'decision-rules', decisionRules },
      { kind: 'auto-flag', def: af },
      { kind: 'manual-flag', def: mf },
    ]);
    expect(out).toHaveLength(4);
    expect(out.map(o => o.kind)).toEqual([
      'thresholds',
      'decision-rules',
      'auto-flag',
      'manual-flag',
    ]);
  });

  it('drops malformed fragments (correct kind, missing payload)', () => {
    expect(collectFragments([
      { kind: 'thresholds' },
      { kind: 'auto-flag' },
      { kind: 'manual-flag', def: 'not-an-object' },
    ])).toEqual([]);
  });
});

describe('applyFragments', () => {
  it('returns a fresh program — base is untouched', () => {
    const base = baselineProgram();
    const out = applyFragments(base, [
      { kind: 'thresholds', thresholds: { ...base.thresholds!, ltv: 0.7 } },
    ]);
    expect(out).not.toBe(base);
    expect(out.thresholds!.ltv).toBe(0.7);
    expect(base.thresholds!.ltv).toBe(0.8);
  });

  it('replaces thresholds + decision-rules wholesale', () => {
    const base = baselineProgram();
    const out = applyFragments(base, [
      { kind: 'decision-rules', decisionRules: {
        reject: { minScore: 80 },
        conditional: { minScore: 40 },
        accept: { maxScore: 39 },
      } },
    ]);
    expect(out.decisionRules).toEqual({
      reject: { minScore: 80 },
      conditional: { minScore: 40 },
      accept: { maxScore: 39 },
    });
  });

  it('upserts auto-flag by id (replaces existing)', () => {
    const base = baselineProgram();
    const replaced: ReviewProgramAutoFlagDef = {
      id: 'HIGH_LTV',
      label: 'High LTV (tuned)',
      description: 'tuned',
      severity: 'CRITICAL',
      weight: 25,
      condition: {
        operator: 'AND',
        rules: [{ field: 'ratios.loanToValueRatioPercent', op: 'GT', thresholdKey: 'ltv' }],
      },
    };
    const out = applyFragments(base, [{ kind: 'auto-flag', def: replaced }]);
    expect(out.autoFlags!).toHaveLength(1);
    expect(out.autoFlags![0]!.weight).toBe(25);
    expect(out.autoFlags![0]!.severity).toBe('CRITICAL');
  });

  it('upserts auto-flag by id (appends new)', () => {
    const base = baselineProgram();
    const added: ReviewProgramAutoFlagDef = {
      id: 'NEW_FLAG',
      label: 'New flag',
      description: '',
      severity: 'LOW',
      weight: 3,
      condition: { operator: 'AND', rules: [{ field: 'ratios.loanToValueRatioPercent', op: 'NOT_NULL' }] },
    };
    const out = applyFragments(base, [{ kind: 'auto-flag', def: added }]);
    expect(out.autoFlags!).toHaveLength(2);
    expect(out.autoFlags!.find(f => f.id === 'NEW_FLAG')).toBeDefined();
  });

  it('upserts manual-flag by id', () => {
    const base = baselineProgram();
    const newMf: ReviewProgramManualFlagDef = {
      id: 'CHAIN_OF_TITLE',
      label: 'Chain of title — tuned',
      description: '',
      field: 'riskFlags.chainOfTitleRedFlags',
      severity: 'HIGH',
      weight: 12,
    };
    const out = applyFragments(base, [{ kind: 'manual-flag', def: newMf }]);
    expect(out.manualFlags![0]!.weight).toBe(12);
    expect(out.manualFlags![0]!.severity).toBe('HIGH');
  });
});

describe('projectResultToTapeItem', () => {
  it('strips result-only fields and preserves RiskTapeItem source fields', () => {
    const result: ReviewTapeResult = {
      rowIndex: 7,
      loanNumber: 'L-1',
      loanAmount: 400_000,
      appraisedValue: 500_000,
      ltv: 0.8,
      overallRiskScore: 35,
      computedDecision: 'Conditional',
      autoFlagResults: [],
      manualFlagResults: [],
      dataQualityIssues: [],
      evaluatedAt: '2026-05-01T00:00:00Z',
      programId: 'prog-1',
      programVersion: '1',
      overrideDecision: 'Reject',
      overriddenAt: '2026-05-02T00:00:00Z',
      overriddenBy: 'someone',
      triggerSource: 'order-created',
      tenantId: 't1',
      orderId: 'ord-1',
    };

    const item = projectResultToTapeItem(result);
    expect(item.rowIndex).toBe(7);
    expect(item.loanNumber).toBe('L-1');
    expect(item.loanAmount).toBe(400_000);
    expect(item.appraisedValue).toBe(500_000);
    expect(item.ltv).toBe(0.8);
    // Result-only fields must not leak through.
    expect((item as unknown as { overallRiskScore?: number }).overallRiskScore).toBeUndefined();
    expect((item as unknown as { computedDecision?: string }).computedDecision).toBeUndefined();
    expect((item as unknown as { autoFlagResults?: unknown }).autoFlagResults).toBeUndefined();
    expect((item as unknown as { overrideDecision?: string }).overrideDecision).toBeUndefined();
    expect((item as unknown as { triggerSource?: string }).triggerSource).toBeUndefined();
  });
});
