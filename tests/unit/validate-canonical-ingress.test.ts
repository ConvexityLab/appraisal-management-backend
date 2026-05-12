import { describe, expect, it } from 'vitest';
import { validateCanonicalIngress, evaluateJsonLogic } from '../../src/utils/validate-canonical-ingress.js';
import type { EffectiveReportConfig } from '../../src/types/report-config.types.js';

describe('validateCanonicalIngress', () => {
  describe('null / empty', () => {
    it('returns ok=true for null/undefined', () => {
      expect(validateCanonicalIngress(null).ok).toBe(true);
      expect(validateCanonicalIngress(undefined).ok).toBe(true);
    });

    it('returns ok=true for empty fragment', () => {
      const out = validateCanonicalIngress({});
      expect(out.ok).toBe(true);
      expect(out.branchesChecked).toEqual({
        subjectAddress: false,
        compAddresses: 0,
        loan: false,
        ratios: false,
        riskFlags: false,
      });
    });
  });

  describe('subject.address', () => {
    it('passes for a well-formed address', () => {
      const out = validateCanonicalIngress({
        subject: {
          address: {
            streetAddress: '123 Main St',
            unit: null,
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            county: 'Sangamon',
          },
        } as any,
      });
      expect(out.ok).toBe(true);
      expect(out.branchesChecked.subjectAddress).toBe(true);
    });

    it('flags drifted address (number where string expected)', () => {
      const out = validateCanonicalIngress({
        subject: {
          address: {
            streetAddress: 12345 as unknown as string,
            unit: null,
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            county: 'Sangamon',
          },
        } as any,
      });
      expect(out.ok).toBe(false);
      expect(out.issues).toContainEqual(
        expect.objectContaining({ branch: 'subject.address', path: 'streetAddress' }),
      );
    });

    it('skips validation when subject.address is absent', () => {
      const out = validateCanonicalIngress({ subject: { propertyType: 'SFR' } as any });
      expect(out.ok).toBe(true);
      expect(out.branchesChecked.subjectAddress).toBe(false);
    });

    it('passes for address with unit set', () => {
      const out = validateCanonicalIngress({
        subject: {
          address: {
            streetAddress: '123 Main St',
            unit: 'Apt 4',
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            county: 'Sangamon',
          },
        } as any,
      });
      expect(out.ok).toBe(true);
    });
  });

  describe('comps[*].address', () => {
    it('checks every comp address and reports per-index issues', () => {
      const out = validateCanonicalIngress({
        comps: [
          {
            address: {
              streetAddress: '1 Maple',
              unit: null,
              city: 'X',
              state: 'IL',
              zipCode: '60001',
              county: 'Y',
            },
          },
          {
            address: {
              streetAddress: 99999 as unknown as string, // drift
              unit: null,
              city: 'Z',
              state: 'IL',
              zipCode: '60002',
              county: 'Y',
            },
          },
        ] as any,
      });
      expect(out.branchesChecked.compAddresses).toBe(2);
      expect(out.issues.some((i) => i.branch === 'comps[1].address' && i.path === 'streetAddress')).toBe(true);
      expect(out.issues.some((i) => i.branch === 'comps[0].address')).toBe(false);
    });
  });

  describe('loan branch', () => {
    it('passes for valid CanonicalLoan', () => {
      const out = validateCanonicalIngress({
        loan: {
          baseLoanAmount: 320000,
          loanPurposeType: 'Purchase',
          mortgageType: 'Conventional',
          lienPriorityType: 'FirstLien',
          firstLienBalance: null,
          secondLienBalance: null,
          totalLienBalance: null,
          refinanceCashOutDeterminationType: null,
          refinanceCashOutAmount: null,
          isCashOutRefinance: null,
          occupancyType: 'PrimaryResidence',
          interestRatePercent: 6.875,
          loanTermMonths: 360,
          loanNumber: 'LN-1',
        },
      });
      expect(out.ok).toBe(true);
    });

    it('flags negative baseLoanAmount', () => {
      const out = validateCanonicalIngress({
        loan: {
          baseLoanAmount: -1000,
          loanPurposeType: 'Purchase',
          mortgageType: 'Conventional',
          lienPriorityType: 'FirstLien',
          firstLienBalance: null,
          secondLienBalance: null,
          totalLienBalance: null,
          refinanceCashOutDeterminationType: null,
          refinanceCashOutAmount: null,
          isCashOutRefinance: null,
          occupancyType: 'PrimaryResidence',
          interestRatePercent: null,
          loanTermMonths: null,
          loanNumber: null,
        },
      });
      expect(out.ok).toBe(false);
      expect(out.issues.some((i) => i.branch === 'loan' && i.path === 'baseLoanAmount')).toBe(true);
    });

    it('flags non-MISMO loanPurposeType', () => {
      const out = validateCanonicalIngress({
        loan: {
          baseLoanAmount: 100000,
          loanPurposeType: 'Buy Some' as any,
          mortgageType: 'Conventional',
          lienPriorityType: 'FirstLien',
          firstLienBalance: null,
          secondLienBalance: null,
          totalLienBalance: null,
          refinanceCashOutDeterminationType: null,
          refinanceCashOutAmount: null,
          isCashOutRefinance: null,
          occupancyType: 'PrimaryResidence',
          interestRatePercent: null,
          loanTermMonths: null,
          loanNumber: null,
        },
      });
      expect(out.ok).toBe(false);
      expect(out.issues.some((i) => i.branch === 'loan' && i.path === 'loanPurposeType')).toBe(true);
    });
  });

  describe('ratios branch', () => {
    it('passes for finite percentage values', () => {
      const out = validateCanonicalIngress({
        ratios: {
          loanToValueRatioPercent: 80,
          combinedLoanToValueRatioPercent: 90,
          highCombinedLoanToValueRatioPercent: null,
          debtServiceCoverageRatio: null,
          debtToIncomeRatioPercent: null,
        },
      });
      expect(out.ok).toBe(true);
    });

    it('flags NaN / Infinity', () => {
      const out = validateCanonicalIngress({
        ratios: {
          loanToValueRatioPercent: NaN,
          combinedLoanToValueRatioPercent: null,
          highCombinedLoanToValueRatioPercent: null,
          debtServiceCoverageRatio: null,
          debtToIncomeRatioPercent: null,
        },
      });
      expect(out.ok).toBe(false);
    });
  });

  describe('riskFlags branch', () => {
    it('passes for valid risk-flag fields', () => {
      const out = validateCanonicalIngress({
        riskFlags: {
          chainOfTitleRedFlags: false,
          ucdpSsrScore: 'A',
          collateralRiskRating: 'low',
          appraiserGeoCompetency: true,
        },
      });
      expect(out.ok).toBe(true);
    });

    it('flags non-boolean chainOfTitleRedFlags', () => {
      const out = validateCanonicalIngress({
        riskFlags: {
          chainOfTitleRedFlags: 'maybe' as any,
          ucdpSsrScore: null,
          collateralRiskRating: null,
          appraiserGeoCompetency: null,
        },
      });
      expect(out.ok).toBe(false);
      expect(out.issues.some((i) => i.branch === 'riskFlags' && i.path === 'chainOfTitleRedFlags')).toBe(true);
    });
  });

  describe('passthrough on unknown fields', () => {
    it('accepts addresses with extra fields beyond the canonical shape', () => {
      const out = validateCanonicalIngress({
        subject: {
          address: {
            streetAddress: '1 X',
            unit: null,
            city: 'Y',
            state: 'IL',
            zipCode: '60001',
            county: 'Z',
            // future extension — must not flag
            geocodedAt: '2026-04-01',
          },
        } as any,
      });
      expect(out.ok).toBe(true);
    });
  });

  // ── R-22: config-driven required-field checks ────────────────────────────

  function makeConfig(requiredKeys: string[]): EffectiveReportConfig {
    return {
      orderId: 'o1', productId: 'P', clientId: 'c1', schemaVersion: '1.0.0',
      mergedAt: new Date().toISOString(),
      templateBlocks: {},
      sections: [
        {
          key: 'subject_property', label: 'Subject', order: 1,
          required: true, visible: true, templateBlockKey: 'tmpl',
          fields: requiredKeys.map((k, i) => ({
            key: k, label: `Label ${k}`, type: 'text' as const,
            required: true, visible: true, order: i + 1,
          })),
        },
      ],
    };
  }

  describe('config required-field checks (R-22)', () => {
    it('returns empty configRiskFlags when all required fields are present', () => {
      const config = makeConfig(['address', 'city']);
      const out = validateCanonicalIngress({}, {
        config,
        fieldData: { address: '123 Main St', city: 'Atlanta' },
      });
      expect(out.configRiskFlags).toHaveLength(0);
      expect(out.ok).toBe(true);
    });

    it('flags absent required fields', () => {
      const config = makeConfig(['address', 'city', 'state']);
      const out = validateCanonicalIngress({}, {
        config,
        fieldData: { address: '123 Main St' }, // city + state absent
      });
      expect(out.configRiskFlags).toHaveLength(2);
      const keys = out.configRiskFlags.map(f => f.fieldKey);
      expect(keys).toContain('city');
      expect(keys).toContain('state');
    });

    it('ok=false when configRiskFlags are present (even if Zod issues=0)', () => {
      const config = makeConfig(['required_field']);
      const out = validateCanonicalIngress({}, { config, fieldData: {} });
      expect(out.ok).toBe(false);
      expect(out.issues).toHaveLength(0);
      expect(out.configRiskFlags).toHaveLength(1);
    });

    it('skips config check when fieldData not provided', () => {
      const config = makeConfig(['address']);
      const out = validateCanonicalIngress({}, { config });
      expect(out.configRiskFlags).toHaveLength(0);
      expect(out.ok).toBe(true);
    });

    it('skips invisible fields', () => {
      const config: EffectiveReportConfig = {
        orderId: 'o1', productId: 'P', clientId: 'c1', schemaVersion: '1.0.0',
        mergedAt: new Date().toISOString(), templateBlocks: {},
        sections: [{
          key: 'sec', label: 'Sec', order: 1, required: true, visible: true, templateBlockKey: 't',
          fields: [
            { key: 'hidden_req', label: 'Hidden', type: 'text', required: true, visible: false, order: 1 },
          ],
        }],
      };
      const out = validateCanonicalIngress({}, { config, fieldData: {} });
      expect(out.configRiskFlags).toHaveLength(0);
    });

    it('requiredWhen evaluated against fieldData', () => {
      const config: EffectiveReportConfig = {
        orderId: 'o1', productId: 'P', clientId: 'c1', schemaVersion: '1.0.0',
        mergedAt: new Date().toISOString(), templateBlocks: {},
        sections: [{
          key: 'sec', label: 'Sec', order: 1, required: false, visible: true, templateBlockKey: 't',
          fields: [
            {
              key: 'hoa_amount', label: 'HOA Amount', type: 'number',
              required: false, visible: true, order: 1,
              requiredWhen: { '==': [{ var: 'has_hoa' }, true] },
            },
          ],
        }],
      };
      // has_hoa = true → hoa_amount required, absent → flagged
      const withHoa = validateCanonicalIngress({}, {
        config,
        fieldData: { has_hoa: true }, // hoa_amount absent
      });
      expect(withHoa.configRiskFlags).toHaveLength(1);
      expect(withHoa.configRiskFlags[0]!.fieldKey).toBe('hoa_amount');

      // has_hoa = false → not required
      const withoutHoa = validateCanonicalIngress({}, {
        config,
        fieldData: { has_hoa: false },
      });
      expect(withoutHoa.configRiskFlags).toHaveLength(0);
    });
  });

  describe('evaluateJsonLogic (R-22)', () => {
    it('evaluates {var} lookup', () => {
      expect(evaluateJsonLogic({ var: 'x' }, { x: true })).toBe(true);
      expect(evaluateJsonLogic({ var: 'x' }, { x: false })).toBe(false);
      expect(evaluateJsonLogic({ var: 'missing' }, { x: 1 })).toBe(false);
    });

    it('evaluates == comparison', () => {
      expect(evaluateJsonLogic({ '==': [{ var: 'v' }, 'yes'] }, { v: 'yes' })).toBe(true);
      expect(evaluateJsonLogic({ '==': [{ var: 'v' }, 'yes'] }, { v: 'no' })).toBe(false);
    });

    it('evaluates and / or', () => {
      expect(evaluateJsonLogic({ and: [{ var: 'a' }, { var: 'b' }] }, { a: true, b: true })).toBe(true);
      expect(evaluateJsonLogic({ and: [{ var: 'a' }, { var: 'b' }] }, { a: true, b: false })).toBe(false);
      expect(evaluateJsonLogic({ or:  [{ var: 'a' }, { var: 'b' }] }, { a: false, b: true })).toBe(true);
    });
  });
});
