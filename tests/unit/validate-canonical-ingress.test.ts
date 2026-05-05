import { describe, expect, it } from 'vitest';
import { validateCanonicalIngress } from '../../src/utils/validate-canonical-ingress.js';

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
});
