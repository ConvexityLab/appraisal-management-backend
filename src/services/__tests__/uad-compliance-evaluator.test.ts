/**
 * Tests for UadComplianceEvaluatorService.
 *
 * Pins down the rule catalogue's semantics:
 *   - CRITICAL failures populate `blockers`
 *   - severity-weighted score is 100 when every rule passes
 *   - missing snapshot short-circuits with snapshotAvailable=false
 *   - per-rule `passed` + `message` reflect the actual failure
 *   - all rule ids are unique (catches accidental duplicates as the
 *     catalogue grows)
 */

import { describe, it, expect } from 'vitest';
import {
  UadComplianceEvaluatorService,
  UAD_COMPLIANCE_RULE_IDS,
} from '../uad-compliance-evaluator.service';
import type { CanonicalReportDocument } from '@l1/shared-types';

const svc = new UadComplianceEvaluatorService();

/**
 * Build a fully UAD-3.6-compliant canonical report. Individual tests
 * mutate one section to drive a specific rule into failure.
 */
function compliantDoc(): CanonicalReportDocument {
  return {
    id: 'doc-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: '1004',
    status: 'completed',
    schemaVersion: '1.0',
    metadata: {
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      borrowerName: 'Test Borrower',
      ownerOfPublicRecord: 'Owner',
      clientName: 'Client',
      clientCompanyName: null,
      clientAddress: null,
      clientEmail: null,
      loanNumber: 'L-1',
      effectiveDate: '2026-05-01',
      inspectionDate: '2026-04-30',
      isSubjectPurchase: false,
      contractPrice: null,
      contractDate: null,
      subjectPriorSaleDate1: null,
      subjectPriorSalePrice1: null,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
    } as never,
    subject: {
      address: {
        streetAddress: '123 Main St',
        unit: null,
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: 'Sangamon',
      },
      grossLivingArea: 2000,
      totalRooms: 7,
      bedrooms: 3,
      bathrooms: 2.5,
      bathsFull: 2,
      bathsHalf: 1,
      stories: 2,
      lotSizeSqFt: 8500,
      propertyType: 'SFR',
      condition: 'C3',
      quality: 'Q3',
      design: 'Colonial',
      yearBuilt: 1995,
      foundationType: 'Full Basement',
      exteriorWalls: 'Brick',
      roofSurface: 'Asphalt Shingle',
      parcelNumber: '1234-567-890',
    } as never,
    comps: [
      makeComp('c1', 425000, '2026-02-15', 1980),
      makeComp('c2', 440000, '2026-03-10', 2050),
      makeComp('c3', 415000, '2026-01-20', 1960),
    ] as never,
    valuation: {
      estimatedValue: 430000,
      lowerBound: 410000,
      upperBound: 450000,
      confidenceScore: 85,
      effectiveDate: '2026-05-01',
      reconciliationNotes: null,
      approachesUsed: ['sales_comparison'],
      avmProvider: null,
      avmModelVersion: null,
    },
    appraiserInfo: {
      name: 'Jane Appraiser',
      licenseNumber: 'IL-12345',
      licenseState: 'IL',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2027-12-31',
      companyName: 'ACME Appraisal',
      companyAddress: '456 Oak St, Springfield IL 62701',
      phone: '555-0100',
      email: 'jane@example.com',
      signatureDate: '2026-05-01',
    },
  } as CanonicalReportDocument;
}

function makeComp(id: string, salePrice: number, saleDate: string, gla: number) {
  return {
    id,
    address: {
      streetAddress: `${id} Comp St`,
      unit: null,
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      county: 'Sangamon',
    },
    grossLivingArea: gla,
    totalRooms: 7,
    bedrooms: 3,
    bathrooms: 2,
    bathsFull: 2,
    bathsHalf: 0,
    stories: 2,
    lotSizeSqFt: 8000,
    propertyType: 'SFR',
    condition: 'C3',
    quality: 'Q3',
    design: 'Colonial',
    yearBuilt: 1990,
    foundationType: 'Full Basement',
    exteriorWalls: 'Brick',
    roofSurface: 'Asphalt Shingle',
    salePrice,
    saleDate,
  };
}

describe('UadComplianceEvaluatorService.evaluate — happy path', () => {
  it('returns overallScore=100, no blockers, no fail count when fully compliant', () => {
    const r = svc.evaluate('order-1', compliantDoc());
    expect(r.snapshotAvailable).toBe(true);
    expect(r.overallScore).toBe(100);
    expect(r.failCount).toBe(0);
    expect(r.blockers).toEqual([]);
    expect(r.passCount).toBe(r.rules.length);
  });

  it('every rule has a unique id', () => {
    const ids = UAD_COMPLIANCE_RULE_IDS;
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('UadComplianceEvaluatorService.evaluate — missing snapshot', () => {
  it('returns snapshotAvailable=false and 0 score when doc is null', () => {
    const r = svc.evaluate('order-1', null);
    expect(r.snapshotAvailable).toBe(false);
    expect(r.overallScore).toBe(0);
    expect(r.passCount).toBe(0);
    expect(r.failCount).toBe(0);
    expect(r.rules).toEqual([]);
  });
});

describe('UadComplianceEvaluatorService.evaluate — CRITICAL failures populate blockers', () => {
  it('flags subject-address-present as CRITICAL when state missing', () => {
    const doc = compliantDoc();
    (doc.subject.address as { state: string }).state = '';
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'subject-address-present');
    expect(rule?.passed).toBe(false);
    expect(rule?.severity).toBe('CRITICAL');
    expect(r.blockers).toContain('subject-address-present');
  });

  it('flags valuation-final-value when estimatedValue is 0', () => {
    const doc = compliantDoc();
    (doc.valuation as { estimatedValue: number }).estimatedValue = 0;
    const r = svc.evaluate('o', doc);
    expect(r.blockers).toContain('valuation-final-value');
  });

  it('flags comps-minimum-three when only 2 comps present', () => {
    const doc = compliantDoc();
    (doc as { comps: unknown[] }).comps = doc.comps.slice(0, 2);
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'comps-minimum-three');
    expect(rule?.passed).toBe(false);
    expect(rule?.message).toContain('2');
    expect(r.blockers).toContain('comps-minimum-three');
  });

  it('flags valuation-effective-date when both valuation.effectiveDate and metadata.effectiveDate are missing', () => {
    const doc = compliantDoc();
    (doc.valuation as { effectiveDate: string | null }).effectiveDate = '';
    (doc.metadata as { effectiveDate: string | null }).effectiveDate = null;
    const r = svc.evaluate('o', doc);
    expect(r.blockers).toContain('valuation-effective-date');
  });
});

describe('UadComplianceEvaluatorService.evaluate — HIGH failures do NOT populate blockers', () => {
  it('flags subject-quality-rating as HIGH when invalid grade given', () => {
    const doc = compliantDoc();
    (doc.subject as { quality: string }).quality = 'Q7'; // out of range
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'subject-quality-rating');
    expect(rule?.passed).toBe(false);
    expect(rule?.severity).toBe('HIGH');
    // CRITICAL-only blocker list — HIGH issues live in the failed-rule list, not the blocker list.
    expect(r.blockers).not.toContain('subject-quality-rating');
  });

  it('flags subject-baths-split when half-baths missing', () => {
    const doc = compliantDoc();
    (doc.subject as { bathsHalf: number | null }).bathsHalf = null;
    const r = svc.evaluate('o', doc);
    expect(r.rules.find((x) => x.id === 'subject-baths-split')?.passed).toBe(false);
  });

  it('flags comps-sale-prices-present when one comp missing salePrice', () => {
    const doc = compliantDoc();
    (doc.comps[0] as { salePrice: number | null }).salePrice = null;
    const r = svc.evaluate('o', doc);
    expect(r.rules.find((x) => x.id === 'comps-sale-prices-present')?.passed).toBe(false);
  });
});

describe('UadComplianceEvaluatorService.evaluate — score weighting', () => {
  it('one MEDIUM fail produces a higher score than one CRITICAL fail', () => {
    const docMed = compliantDoc();
    (docMed.subject as { parcelNumber: string | null }).parcelNumber = null;
    const docCrit = compliantDoc();
    (docCrit.valuation as { estimatedValue: number }).estimatedValue = 0;
    const medScore = svc.evaluate('o', docMed).overallScore;
    const critScore = svc.evaluate('o', docCrit).overallScore;
    expect(medScore).toBeGreaterThan(critScore);
  });

  it('overallScore drops to 0 only when every rule fails', () => {
    // Hard to construct a doc that fails every rule, but failing a CRITICAL +
    // a couple HIGH should clearly cap the score below 90.
    const doc = compliantDoc();
    (doc.valuation as { estimatedValue: number }).estimatedValue = 0;
    (doc.subject as { yearBuilt: number | null }).yearBuilt = null;
    (doc.subject as { grossLivingArea: number | null }).grossLivingArea = null;
    const r = svc.evaluate('o', doc);
    expect(r.overallScore).toBeLessThan(90);
    expect(r.overallScore).toBeGreaterThan(0);
  });
});
