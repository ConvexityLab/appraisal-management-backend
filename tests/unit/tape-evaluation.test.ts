/**
 * TapeEvaluationService — Unit Tests
 *
 * Coverage plan:
 *   1. computeCalculatedFields  — LTV, CLTV, appreciation24m/36m, avmGapPct, nonMlsPct, cashOutRefi
 *   2. evaluateAutoFlags        — each of the 8 auto-flags: fires above threshold, does NOT fire below
 *   3. evaluateManualFlags      — CHAIN_OF_TITLE, HIGH_RISK_GEOGRAPHY, APPRAISER_GEO_COMPETENCY
 *   4. computeRiskScore         — correct weight summing from fired flags
 *   5. deriveDecision           — Reject ≥70, Conditional ≥35, Accept <35
 *   6. data quality             — missing source fields reported in dataQualityIssues, flag not fired
 *   7. evaluate() (end-to-end)  — full item → ReviewTapeResult shape
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TapeEvaluationService } from '../../src/services/tape-evaluation.service.js';
import { VISION_APPRAISAL_V1_PROGRAM } from '../../src/data/review-programs.js';
import type { RiskTapeItem, ReviewProgram, ReviewTapeResult } from '../../src/types/review-tape.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid item — all source fields present, all calculated values derivable */
function makeItem(overrides: Partial<RiskTapeItem> = {}): RiskTapeItem {
  return {
    rowIndex: 0,
    loanNumber: 'LN-001',
    loanAmount: 200_000,
    appraisedValue: 250_000,
    firstLienBalance: 200_000,
    secondLienBalance: 0,
    // Low-risk defaults — no auto-flags should fire
    avgNetAdjPct: 0.05,
    avgGrossAdjPct: 0.10,
    priorSale24mPrice: 230_000,   // appreciation = 250k-230k / 230k ≈ 8.7%
    priorSale36mPrice: 225_000,   // appreciation = 250k-225k / 225k ≈ 11.1%
    dscr: 1.5,
    numComps: 5,
    nonMlsCount: 0,
    avmValue: 252_000,            // avmGapPct = |250k-252k| / 252k ≈ 0.79%
    chainOfTitleRedFlags: false,
    highRiskGeographyFlag: false,
    appraiserGeoCompetency: true, // "competent" = true (not a concern)
    loanPurpose: 'Purchase',
    ...overrides,
  };
}

// ─── Strict-mode assertion helpers ───────────────────────────────────────────

function assertDefined<T>(value: T | undefined, label = 'value'): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined but was undefined`);
  }
  return value;
}

function findFlag(flags: ReviewTapeResult['autoFlagResults'], id: string) {
  return assertDefined(flags.find(f => f.id === id), `flag[${id}]`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TapeEvaluationService', () => {
  let service: TapeEvaluationService;
  const program: ReviewProgram = VISION_APPRAISAL_V1_PROGRAM;

  beforeEach(() => {
    service = new TapeEvaluationService();
  });

  // ─── 1. computeCalculatedFields ─────────────────────────────────────────────

  describe('computeCalculatedFields()', () => {
    it('computes LTV = loanAmount / appraisedValue', () => {
      const result = service.computeCalculatedFields(makeItem({ loanAmount: 160_000, appraisedValue: 200_000 }));
      expect(result.ltv).toBeCloseTo(0.80, 5);
    });

    it('computes CLTV = (firstLienBalance + secondLienBalance) / appraisedValue', () => {
      const result = service.computeCalculatedFields(makeItem({
        firstLienBalance: 150_000,
        secondLienBalance: 30_000,
        appraisedValue: 200_000,
      }));
      expect(result.cltv).toBeCloseTo(0.90, 5);
    });

    it('computes CLTV using only firstLienBalance when secondLienBalance is absent', () => {
      const item = makeItem({ firstLienBalance: 160_000, appraisedValue: 200_000 });
      delete item.secondLienBalance;
      const result = service.computeCalculatedFields(item);
      expect(result.cltv).toBeCloseTo(0.80, 5);
    });

    it('computes appreciation24m = (appraisedValue - priorSale24mPrice) / priorSale24mPrice', () => {
      const result = service.computeCalculatedFields(makeItem({
        appraisedValue: 300_000,
        priorSale24mPrice: 200_000,
      }));
      expect(result.appreciation24m).toBeCloseTo(0.50, 5);
    });

    it('computes appreciation36m = (appraisedValue - priorSale36mPrice) / priorSale36mPrice', () => {
      const result = service.computeCalculatedFields(makeItem({
        appraisedValue: 300_000,
        priorSale36mPrice: 200_000,
      }));
      expect(result.appreciation36m).toBeCloseTo(0.50, 5);
    });

    it('computes avmGapPct = |appraisedValue - avmValue| / avmValue', () => {
      const result = service.computeCalculatedFields(makeItem({
        appraisedValue: 110_000,
        avmValue: 100_000,
      }));
      expect(result.avmGapPct).toBeCloseTo(0.10, 5);
    });

    it('computes avmGapPct when appraised value is BELOW avm (absolute value)', () => {
      const result = service.computeCalculatedFields(makeItem({
        appraisedValue: 90_000,
        avmValue: 100_000,
      }));
      expect(result.avmGapPct).toBeCloseTo(0.10, 5);
    });

    it('computes nonMlsPct = nonMlsCount / numComps', () => {
      const result = service.computeCalculatedFields(makeItem({
        nonMlsCount: 2,
        numComps: 5,
      }));
      expect(result.nonMlsPct).toBeCloseTo(0.40, 5);
    });

    it('sets cashOutRefi = true when loanPurpose is Cash-Out Refi', () => {
      const result = service.computeCalculatedFields(makeItem({ loanPurpose: 'Cash-Out Refi' }));
      expect(result.cashOutRefi).toBe(true);
    });

    it('sets cashOutRefi = false for non-cash-out loan purposes', () => {
      for (const purpose of ['Purchase', 'Rate-Term Refi', 'Bridge', 'DSCR']) {
        const result = service.computeCalculatedFields(makeItem({ loanPurpose: purpose }));
        expect(result.cashOutRefi).toBe(false);
      }
    });

    it('leaves ltv undefined when appraisedValue is absent', () => {
      const item = makeItem();
      delete item.appraisedValue;
      const result = service.computeCalculatedFields(item);
      expect(result.ltv).toBeUndefined();
    });

    it('leaves ltv undefined when loanAmount is absent', () => {
      const item = makeItem();
      delete item.loanAmount;
      const result = service.computeCalculatedFields(item);
      expect(result.ltv).toBeUndefined();
    });

    it('leaves appreciation24m undefined when priorSale24mPrice is absent', () => {
      const item = makeItem();
      delete item.priorSale24mPrice;
      const result = service.computeCalculatedFields(item);
      expect(result.appreciation24m).toBeUndefined();
    });

    it('leaves nonMlsPct undefined when numComps is 0', () => {
      const result = service.computeCalculatedFields(makeItem({ numComps: 0, nonMlsCount: 0 }));
      expect(result.nonMlsPct).toBeUndefined();
    });
  });

  // ─── 2. Auto-flags — fires above threshold, silent below ────────────────────

  describe('HIGH_NET_GROSS_ADJ auto-flag', () => {
    it('fires when avgNetAdjPct > 0.15 (netAdjustmentPct threshold)', () => {
      const results = service.evaluate([makeItem({ avgNetAdjPct: 0.16, avgGrossAdjPct: 0.10 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_NET_GROSS_ADJ').isFired).toBe(true);
    });

    it('fires when avgGrossAdjPct > 0.25 (grossAdjustmentPct threshold)', () => {
      const results = service.evaluate([makeItem({ avgNetAdjPct: 0.05, avgGrossAdjPct: 0.26 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_NET_GROSS_ADJ').isFired).toBe(true);
    });

    it('does NOT fire when both adjustments are at or below threshold', () => {
      const results = service.evaluate([makeItem({ avgNetAdjPct: 0.15, avgGrossAdjPct: 0.25 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_NET_GROSS_ADJ').isFired).toBe(false);
    });
  });

  describe('UNUSUAL_APPRECIATION_24M auto-flag', () => {
    it('fires when appreciation24m > 0.25 with a valid prior sale', () => {
      // 300k vs 200k prior → 50% appreciation
      const results = service.evaluate([makeItem({ appraisedValue: 300_000, priorSale24mPrice: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_24M').isFired).toBe(true);
    });

    it('does NOT fire when appreciation24m <= 0.25', () => {
      const results = service.evaluate([makeItem({ appraisedValue: 225_000, priorSale24mPrice: 210_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_24M').isFired).toBe(false);
    });

    it('does NOT fire when priorSale24mPrice is absent (no prior sale)', () => {
      const item = makeItem();
      delete item.priorSale24mPrice;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_24M').isFired).toBe(false);
    });
  });

  describe('UNUSUAL_APPRECIATION_36M auto-flag', () => {
    it('fires when appreciation36m > 0.35 with a valid prior sale', () => {
      // 340k vs 200k prior → 70% appreciation
      const results = service.evaluate([makeItem({ appraisedValue: 340_000, priorSale36mPrice: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_36M').isFired).toBe(true);
    });

    it('does NOT fire when appreciation36m <= 0.35', () => {
      const results = service.evaluate([makeItem({ appraisedValue: 225_000, priorSale36mPrice: 210_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_36M').isFired).toBe(false);
    });
  });

  describe('DSCR_FLAG auto-flag', () => {
    it('fires when dscr is present and < 1.0 (dscrMinimum)', () => {
      const results = service.evaluate([makeItem({ dscr: 0.85 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'DSCR_FLAG').isFired).toBe(true);
    });

    it('does NOT fire when dscr >= 1.0', () => {
      const results = service.evaluate([makeItem({ dscr: 1.0 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'DSCR_FLAG').isFired).toBe(false);
    });

    it('does NOT fire when dscr is absent (NOT_NULL rule)', () => {
      const item = makeItem();
      delete item.dscr;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'DSCR_FLAG').isFired).toBe(false);
    });
  });

  describe('NON_PUBLIC_COMPS auto-flag', () => {
    it('fires when nonMlsPct > 0.20 with numComps > 0', () => {
      // 2 of 5 comps are non-MLS → 40%
      const results = service.evaluate([makeItem({ numComps: 5, nonMlsCount: 2 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'NON_PUBLIC_COMPS').isFired).toBe(true);
    });

    it('does NOT fire when nonMlsPct <= 0.20', () => {
      // 1 of 6 comps → ~16.7%
      const results = service.evaluate([makeItem({ numComps: 6, nonMlsCount: 1 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'NON_PUBLIC_COMPS').isFired).toBe(false);
    });
  });

  describe('AVM_GAP auto-flag', () => {
    it('fires when |appraisedValue - avmValue| / avmValue > 0.10', () => {
      // gap = 25k / 175k ≈ 14.3%
      const results = service.evaluate([makeItem({ appraisedValue: 200_000, avmValue: 175_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP').isFired).toBe(true);
    });

    it('does NOT fire when avmGapPct <= 0.10', () => {
      // gap = 2k / 198k ≈ 1%
      const results = service.evaluate([makeItem({ appraisedValue: 200_000, avmValue: 198_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP').isFired).toBe(false);
    });

    it('does NOT fire when avmValue is absent', () => {
      const item = makeItem();
      delete item.avmValue;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP').isFired).toBe(false);
    });
  });

  describe('HIGH_LTV auto-flag', () => {
    it('fires when ltv > 0.80', () => {
      // ltv = 170k / 200k = 85%
      const results = service.evaluate([makeItem({ loanAmount: 170_000, appraisedValue: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV').isFired).toBe(true);
    });

    it('does NOT fire when ltv = 0.80 exactly (GT, not GTE)', () => {
      // ltv = 160k / 200k = 80%
      const results = service.evaluate([makeItem({ loanAmount: 160_000, appraisedValue: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV').isFired).toBe(false);
    });

    it('does NOT fire when ltv is missing (appraisedValue absent)', () => {
      const item = makeItem();
      delete item.appraisedValue;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV').isFired).toBe(false);
    });
  });

  describe('HIGH_CLTV auto-flag', () => {
    it('fires when cltv > 0.90', () => {
      // cltv = 190k / 200k = 95%
      const results = service.evaluate([makeItem({
        firstLienBalance: 180_000,
        secondLienBalance: 10_000,
        appraisedValue: 200_000,
      })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_CLTV').isFired).toBe(true);
    });

    it('does NOT fire when cltv = 0.90 exactly', () => {
      // cltv = 180k / 200k = 90%
      const results = service.evaluate([makeItem({
        firstLienBalance: 180_000,
        secondLienBalance: 0,
        appraisedValue: 200_000,
      })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_CLTV').isFired).toBe(false);
    });
  });

  // ─── 3. Manual flags ────────────────────────────────────────────────────────

  describe('CHAIN_OF_TITLE manual flag', () => {
    it('fires when chainOfTitleRedFlags is true (boolean)', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: true })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'CHAIN_OF_TITLE').isFired).toBe(true);
    });

    it('fires when chainOfTitleRedFlags is "Yes" (string)', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: 'Yes' })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'CHAIN_OF_TITLE').isFired).toBe(true);
    });

    it('does NOT fire when chainOfTitleRedFlags is false', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: false })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'CHAIN_OF_TITLE').isFired).toBe(false);
    });

    it('does NOT fire when chainOfTitleRedFlags is "No" (string)', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: 'No' })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'CHAIN_OF_TITLE').isFired).toBe(false);
    });

    it('has weight 40 and severity CRITICAL', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: true })], program);
      const flag = findFlag(assertDefined(results[0]).manualFlagResults, 'CHAIN_OF_TITLE');
      expect(flag.weight).toBe(40);
      expect(flag.severity).toBe('CRITICAL');
    });
  });

  describe('HIGH_RISK_GEOGRAPHY manual flag', () => {
    it('fires when highRiskGeographyFlag is true', () => {
      const results = service.evaluate([makeItem({ highRiskGeographyFlag: true })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'HIGH_RISK_GEOGRAPHY').isFired).toBe(true);
    });

    it('does NOT fire when highRiskGeographyFlag is false', () => {
      const results = service.evaluate([makeItem({ highRiskGeographyFlag: false })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'HIGH_RISK_GEOGRAPHY').isFired).toBe(false);
    });
  });

  describe('APPRAISER_GEO_COMPETENCY manual flag', () => {
    it('fires when appraiserGeoCompetency is false (lack of competency IS the risk)', () => {
      const results = service.evaluate([makeItem({ appraiserGeoCompetency: false })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'APPRAISER_GEO_COMPETENCY').isFired).toBe(true);
    });

    it('does NOT fire when appraiserGeoCompetency is true (appraiser IS competent)', () => {
      const results = service.evaluate([makeItem({ appraiserGeoCompetency: true })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'APPRAISER_GEO_COMPETENCY').isFired).toBe(false);
    });

    it('fires when appraiserGeoCompetency is "No" (not competent)', () => {
      const results = service.evaluate([makeItem({ appraiserGeoCompetency: 'No' })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'APPRAISER_GEO_COMPETENCY').isFired).toBe(true);
    });

    it('does NOT fire when appraiserGeoCompetency is "Yes" (competent)', () => {
      const results = service.evaluate([makeItem({ appraiserGeoCompetency: 'Yes' })], program);
      expect(findFlag(assertDefined(results[0]).manualFlagResults, 'APPRAISER_GEO_COMPETENCY').isFired).toBe(false);
    });
  });

  // ─── 4. computeRiskScore ────────────────────────────────────────────────────

  describe('risk score computation', () => {
    it('returns 0 when no flags fire', () => {
      const results = service.evaluate([makeItem()], program);
      expect(assertDefined(results[0]).overallRiskScore).toBe(0);
    });

    it('returns 40 when only CHAIN_OF_TITLE (weight 40) fires', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: true })], program);
      expect(assertDefined(results[0]).overallRiskScore).toBe(40);
    });

    it('returns 60 when CHAIN_OF_TITLE(40) + HIGH_RISK_GEOGRAPHY(10) + APPRAISER_GEO_COMPETENCY(10) all fire', () => {
      const results = service.evaluate([makeItem({
        chainOfTitleRedFlags: true,
        highRiskGeographyFlag: true,
        appraiserGeoCompetency: false,
      })], program);
      expect(assertDefined(results[0]).overallRiskScore).toBe(60);
    });

    it('caps score at 100 when total weights exceed 100', () => {
      const results = service.evaluate([makeItem({
        chainOfTitleRedFlags: true,
        highRiskGeographyFlag: true,
        appraiserGeoCompetency: false,
        loanAmount: 185_000,
        firstLienBalance: 185_000,
        secondLienBalance: 5_000,
        appraisedValue: 200_000,   // ltv=92.5% → HIGH_LTV; cltv=95% → HIGH_CLTV
        avmValue: 160_000,          // gap=25% → AVM_GAP
        avgNetAdjPct: 0.20,         // >15% → HIGH_NET_GROSS_ADJ
        dscr: 0.8,                  // <1.0 → DSCR_FLAG
        priorSale24mPrice: 100_000, // 100% appreciation → UNUSUAL_APPRECIATION_24M
        numComps: 5,
        nonMlsCount: 2,             // 40% → NON_PUBLIC_COMPS
      })], program);
      expect(assertDefined(results[0]).overallRiskScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── 5. deriveDecision ──────────────────────────────────────────────────────

  describe('decision derivation', () => {
    it('derives Accept when score < 35 (score=0)', () => {
      const results = service.evaluate([makeItem()], program);
      expect(assertDefined(results[0]).computedDecision).toBe('Accept');
    });

    it('derives Conditional when score is 40 (CHAIN_OF_TITLE alone)', () => {
      const results = service.evaluate([makeItem({ chainOfTitleRedFlags: true })], program);
      expect(assertDefined(results[0]).computedDecision).toBe('Conditional');
      expect(assertDefined(results[0]).overallRiskScore).toBe(40);
    });

    it('derives Conditional when score is between 35 and 69 (score=60)', () => {
      const results = service.evaluate([makeItem({
        chainOfTitleRedFlags: true,    // 40
        highRiskGeographyFlag: true,   // 10
        appraiserGeoCompetency: false, // 10
      })], program);
      expect(assertDefined(results[0]).overallRiskScore).toBe(60);
      expect(assertDefined(results[0]).computedDecision).toBe('Conditional');
    });

    it('derives Reject when score >= 70 (score=80)', () => {
      const results = service.evaluate([makeItem({
        chainOfTitleRedFlags: true,    // 40
        highRiskGeographyFlag: true,   // 10
        appraiserGeoCompetency: false, // 10
        loanAmount: 170_000,           // ltv=85% → HIGH_LTV (+20)
        appraisedValue: 200_000,
        firstLienBalance: 170_000,
        secondLienBalance: 0,
        avmValue: 200_000,             // avmGapPct=0% → AVM_GAP does NOT fire
      })], program);
      expect(assertDefined(results[0]).overallRiskScore).toBe(80);
      expect(assertDefined(results[0]).computedDecision).toBe('Reject');
    });
  });

  // ─── 6. Data quality issues ─────────────────────────────────────────────────

  describe('data quality issue reporting', () => {
    it('reports missing appraisedValue as a data quality issue', () => {
      const item = makeItem();
      delete item.appraisedValue;
      const results = service.evaluate([item], program);
      const issues = assertDefined(results[0]).dataQualityIssues;
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(msg => msg.includes('appraisedValue'))).toBe(true);
    });

    it('reports missing loanAmount as a data quality issue', () => {
      const item = makeItem();
      delete item.loanAmount;
      const results = service.evaluate([item], program);
      expect(assertDefined(results[0]).dataQualityIssues.some(msg => msg.includes('loanAmount'))).toBe(true);
    });

    it('does NOT report a quality issue for dscr when absent (optional field)', () => {
      const item = makeItem({ loanType: 'Conventional' });
      delete item.dscr;
      const results = service.evaluate([item], program);
      const dscrIssues = assertDefined(results[0]).dataQualityIssues.filter(msg => msg.includes('dscr'));
      expect(dscrIssues).toHaveLength(0);
    });

    it('has no data quality issues when all source fields are present', () => {
      const results = service.evaluate([makeItem()], program);
      expect(assertDefined(results[0]).dataQualityIssues).toHaveLength(0);
    });
  });

  // ─── 7. evaluate() end-to-end shape ─────────────────────────────────────────

  describe('evaluate() — result shape', () => {
    it('returns one ReviewTapeResult per input item', () => {
      const results = service.evaluate([makeItem({ loanNumber: 'A' }), makeItem({ loanNumber: 'B' })], program);
      expect(results).toHaveLength(2);
    });

    it('result includes all required ReviewTapeResult fields', () => {
      const result = assertDefined(service.evaluate([makeItem()], program)[0]);
      expect(typeof result.overallRiskScore).toBe('number');
      expect(['Accept', 'Conditional', 'Reject']).toContain(result.computedDecision);
      expect(Array.isArray(result.autoFlagResults)).toBe(true);
      expect(Array.isArray(result.manualFlagResults)).toBe(true);
      expect(Array.isArray(result.dataQualityIssues)).toBe(true);
      expect(typeof result.evaluatedAt).toBe('string');
      expect(result.programId).toBe(program.id);
      expect(result.programVersion).toBe(program.version);
    });

    it('autoFlagResults has one entry per auto-flag definition', () => {
      const result = assertDefined(service.evaluate([makeItem()], program)[0]);
      expect(result.autoFlagResults).toHaveLength(program.autoFlags.length);
    });

    it('manualFlagResults has one entry per manual-flag definition', () => {
      const result = assertDefined(service.evaluate([makeItem()], program)[0]);
      expect(result.manualFlagResults).toHaveLength(program.manualFlags.length);
    });

    it('result preserves source fields from input item', () => {
      const result = assertDefined(service.evaluate([makeItem({ loanNumber: 'LN-PRESERVE-001' })], program)[0]);
      expect(result.loanNumber).toBe('LN-PRESERVE-001');
    });

    it('computed field ltv is present in result', () => {
      const result = assertDefined(service.evaluate([makeItem({ loanAmount: 160_000, appraisedValue: 200_000 })], program)[0]);
      expect(result.ltv).toBeCloseTo(0.80, 5);
    });

    it('evaluatedAt is a valid ISO timestamp', () => {
      const result = assertDefined(service.evaluate([makeItem()], program)[0]);
      expect(() => new Date(result.evaluatedAt).toISOString()).not.toThrow();
    });

    it('handles an empty items array', () => {
      expect(service.evaluate([], program)).toHaveLength(0);
    });
  });

  // ─── Additional coverage ─────────────────────────────────────────────────────

  // Missing guard-absent tests for UNUSUAL_APPRECIATION_36M and HIGH_CLTV

  describe('UNUSUAL_APPRECIATION_36M — absent prior sale', () => {
    it('does NOT fire when priorSale36mPrice is absent (no prior sale data)', () => {
      const item = makeItem();
      delete item.priorSale36mPrice;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_36M').isFired).toBe(false);
    });
  });

  describe('HIGH_CLTV — absent firstLienBalance', () => {
    it('does NOT fire when firstLienBalance is absent (cltv cannot be computed)', () => {
      const item = makeItem();
      delete item.firstLienBalance;
      const results = service.evaluate([item], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_CLTV').isFired).toBe(false);
    });
  });

  // Exact boundary values for deriveDecision() — tests the >= semantics directly

  describe('deriveDecision() — exact boundary values', () => {
    it('returns Accept at score 34 (one below conditional threshold of 35)', () => {
      expect(service.deriveDecision(34, program.decisionRules)).toBe('Accept');
    });

    it('returns Conditional at score 35 (exactly at conditional threshold)', () => {
      expect(service.deriveDecision(35, program.decisionRules)).toBe('Conditional');
    });

    it('returns Conditional at score 69 (one below reject threshold of 70)', () => {
      expect(service.deriveDecision(69, program.decisionRules)).toBe('Conditional');
    });

    it('returns Reject at score 70 (exactly at reject threshold)', () => {
      expect(service.deriveDecision(70, program.decisionRules)).toBe('Reject');
    });
  });

  // Zero-value edge cases for critical source fields

  describe('data quality — zero and absent source field edge cases', () => {
    it('reports appraisedValue = 0 as a data quality issue', () => {
      const results = service.evaluate([makeItem({ appraisedValue: 0 })], program);
      const issues = assertDefined(results[0]).dataQualityIssues;
      expect(issues.some(msg => msg.includes('appraisedValue'))).toBe(true);
    });

    it('reports loanAmount = 0 as a data quality issue', () => {
      const results = service.evaluate([makeItem({ loanAmount: 0 })], program);
      const issues = assertDefined(results[0]).dataQualityIssues;
      expect(issues.some(msg => msg.includes('loanAmount'))).toBe(true);
    });

    it('does NOT report firstLienBalance = 0 as a data quality issue (free-and-clear is valid)', () => {
      const results = service.evaluate([makeItem({ firstLienBalance: 0, secondLienBalance: 0 })], program);
      const issues = assertDefined(results[0]).dataQualityIssues;
      expect(issues.some(msg => msg.includes('firstLienBalance'))).toBe(false);
    });

    it('leaves ltv undefined when appraisedValue = 0 (division guard)', () => {
      const result = service.computeCalculatedFields(makeItem({ appraisedValue: 0 }));
      expect(result.ltv).toBeUndefined();
    });

    it('leaves cashOutRefi unchanged when loanPurpose is absent', () => {
      const item = makeItem();
      delete item.loanPurpose;
      delete item.cashOutRefi;
      const result = service.computeCalculatedFields(item);
      // When loanPurpose is absent the field is simply not set — must not be NaN or crash
      expect(result.cashOutRefi).toBeUndefined();
    });

    it('leaves nonMlsPct undefined when nonMlsCount is absent but numComps > 0', () => {
      const item = makeItem({ numComps: 5 });
      delete item.nonMlsCount;
      const result = service.computeCalculatedFields(item);
      expect(result.nonMlsPct).toBeUndefined();
    });
  });

  // Custom threshold override — engine must honour program-specific thresholds

  describe('custom threshold override', () => {
    it('fires HIGH_LTV at ltv=0.71 when program threshold is 0.70', () => {
      const strictProgram: ReviewProgram = {
        ...VISION_APPRAISAL_V1_PROGRAM,
        id: 'test-strict',
        version: '0.1',
        thresholds: {
          ...VISION_APPRAISAL_V1_PROGRAM.thresholds,
          ltv: 0.70,
        },
      };
      // ltv = 142k / 200k = 0.71 — fires under strict (0.70) but NOT under default (0.80)
      const results = service.evaluate([makeItem({ loanAmount: 142_000, appraisedValue: 200_000 })], strictProgram);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV').isFired).toBe(true);
    });

    it('does NOT fire HIGH_LTV at ltv=0.71 with the default 0.80 threshold', () => {
      const results = service.evaluate([makeItem({ loanAmount: 142_000, appraisedValue: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV').isFired).toBe(false);
    });
  });

  // At-threshold-exact values — GT means strictly greater-than, so at-threshold must NOT fire

  describe('at-threshold-exact values (GT operator boundary)', () => {
    it('UNUSUAL_APPRECIATION_24M does NOT fire when appreciation24m is exactly 0.25', () => {
      // 287500 / 230000 = 1.25 → appreciation = 0.25 exactly
      const results = service.evaluate([makeItem({ appraisedValue: 287_500, priorSale24mPrice: 230_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_24M').isFired).toBe(false);
    });

    it('UNUSUAL_APPRECIATION_36M does NOT fire when appreciation36m is exactly 0.35', () => {
      // 270000 / 200000 = 1.35 → appreciation = 0.35 exactly
      const results = service.evaluate([makeItem({ appraisedValue: 270_000, priorSale36mPrice: 200_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'UNUSUAL_APPRECIATION_36M').isFired).toBe(false);
    });

    it('AVM_GAP does NOT fire when avmGapPct is exactly 0.10', () => {
      // |110k - 100k| / 100k = 0.10 exactly
      const results = service.evaluate([makeItem({ appraisedValue: 110_000, avmValue: 100_000 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP').isFired).toBe(false);
    });

    it('NON_PUBLIC_COMPS does NOT fire when nonMlsPct is exactly 0.20', () => {
      // 1 / 5 = 0.20 exactly
      const results = service.evaluate([makeItem({ numComps: 5, nonMlsCount: 1 })], program);
      expect(findFlag(assertDefined(results[0]).autoFlagResults, 'NON_PUBLIC_COMPS').isFired).toBe(false);
    });
  });

  // Display value regression tests — assert that fired flags surface the correct
  // field value and threshold for UI consumption (guards the AND-rule display fix)

  describe('fired flag display values', () => {
    it('HIGH_LTV: thresholdValue is the ltv threshold (0.80), not null', () => {
      // ltv = 170k / 200k = 0.85 → fires
      const results = service.evaluate([makeItem({ loanAmount: 170_000, appraisedValue: 200_000 })], program);
      const flag = findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV');
      expect(flag.isFired).toBe(true);
      expect(flag.thresholdValue).toBeCloseTo(0.80, 5);
    });

    it('HIGH_LTV: actualValue is the computed ltv, not a raw balance', () => {
      const results = service.evaluate([makeItem({ loanAmount: 170_000, appraisedValue: 200_000 })], program);
      const flag = findFlag(assertDefined(results[0]).autoFlagResults, 'HIGH_LTV');
      // actualValue must be the ltv (0.85), not loanAmount (170000) or null
      expect(typeof flag.actualValue).toBe('number');
      expect((flag.actualValue as number)).toBeCloseTo(0.85, 5);
    });

    it('AVM_GAP: actualValue is avmGapPct (< 1), not avmValue (a large dollar amount)', () => {
      // avmGapPct = |200k - 175k| / 175k ≈ 0.143
      const results = service.evaluate([makeItem({ appraisedValue: 200_000, avmValue: 175_000 })], program);
      const flag = findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP');
      expect(flag.isFired).toBe(true);
      // actualValue must be a ratio (< 1), not a raw dollar value
      expect(typeof flag.actualValue).toBe('number');
      expect((flag.actualValue as number)).toBeLessThan(1);
    });

    it('AVM_GAP: thresholdValue is the avmGapPct threshold (0.10), not 0', () => {
      const results = service.evaluate([makeItem({ appraisedValue: 200_000, avmValue: 175_000 })], program);
      const flag = findFlag(assertDefined(results[0]).autoFlagResults, 'AVM_GAP');
      expect(flag.thresholdValue).toBeCloseTo(0.10, 5);
    });
  });
});
