/**
 * Unit tests for UadValidationService.validateCanonicalSections()
 *
 * Covers all 12 URAR v1.3 section validators (UAD-901 through UAD-999W)
 * that feed the finalization gate via UadFinalizationValidationError.
 */

import { describe, it, expect } from 'vitest';
import { UadValidationService } from '../../src/services/uad-validation.service.js';
import { UadFinalizationValidationError } from '../../src/services/appraisal-draft.service.js';
import type { CanonicalReportDocument } from '@l1/shared-types';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid CanonicalReportDocument — everything absent → no errors. */
function emptyDoc(): CanonicalReportDocument {
  return {} as CanonicalReportDocument;
}

const svc = new UadValidationService();

function validate(doc: CanonicalReportDocument) {
  return svc.validateCanonicalSections(doc);
}

function codes(doc: CanonicalReportDocument) {
  return validate(doc).map(e => e.uadRule);
}

// ── validateCanonicalSections — integration ───────────────────────────────────

describe('validateCanonicalSections — base contract', () => {
  it('returns empty array for an empty doc (all sections absent)', () => {
    expect(validate(emptyDoc())).toEqual([]);
  });

  it('returns only ERROR and WARNING severities', () => {
    const doc: CanonicalReportDocument = {
      assignmentConditions: { intendedUse: 'Mortgage financing', marketValueDefinition: undefined },
    } as unknown as CanonicalReportDocument;
    const results = validate(doc);
    for (const r of results) {
      expect(['ERROR', 'WARNING']).toContain(r.severity);
    }
  });
});

// ── UAD-900: Disaster Mitigation ─────────────────────────────────────────────

describe('UAD-900 disasterMitigation', () => {
  it('no errors for valid item', () => {
    const doc = {
      disasterMitigation: {
        items: [{ disasterCategory: 'Flood', mitigationFeature: 'Elevation certificate' }],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-901: missing disasterCategory', () => {
    const doc = {
      disasterMitigation: {
        items: [{ mitigationFeature: 'Storm shutters' }],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-901');
  });

  it('UAD-902: invalid disasterCategory enum', () => {
    const doc = {
      disasterMitigation: {
        items: [{ disasterCategory: 'Volcano', mitigationFeature: 'Lava moat' }],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-902');
  });

  it('UAD-903: missing mitigationFeature', () => {
    const doc = {
      disasterMitigation: {
        items: [{ disasterCategory: 'Wind' }],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-903');
  });
});

// ── UAD-910: Energy Efficiency ───────────────────────────────────────────────

describe('UAD-910 energyEfficiency', () => {
  it('no errors for valid feature', () => {
    const doc = {
      energyEfficiency: { features: [{ feature: 'Solar panels', impact: 'Beneficial' }] },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-911: missing feature name', () => {
    const doc = {
      energyEfficiency: { features: [{}] },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-911');
  });

  it('UAD-912: invalid impact enum', () => {
    const doc = {
      energyEfficiency: { features: [{ feature: 'Insulation', impact: 'Positive' }] },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-912');
  });
});

// ── UAD-920: Functional Obsolescence ─────────────────────────────────────────

describe('UAD-920 functionalObsolescence', () => {
  it('no errors for valid item', () => {
    const doc = {
      functionalObsolescence: [{ feature: 'Outdated plumbing', type: 'Incurable' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-921: missing feature', () => {
    const doc = {
      functionalObsolescence: [{ type: 'Curable' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-921');
  });
});

// ── UAD-930: Vehicle Storage ──────────────────────────────────────────────────

describe('UAD-930 vehicleStorage', () => {
  it('no errors for valid item', () => {
    const doc = {
      vehicleStorage: [{ type: 'Attached Garage', spaces: 2 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-931: missing type', () => {
    const doc = {
      vehicleStorage: [{ spaces: 2 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-931');
  });

  it('UAD-932: invalid type enum', () => {
    const doc = {
      vehicleStorage: [{ type: 'Underground Bunker', spaces: 1 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-932');
  });

  it('UAD-933: negative spaces', () => {
    const doc = {
      vehicleStorage: [{ type: 'Carport', spaces: -1 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-933');
  });
});

// ── UAD-940: Outbuildings ─────────────────────────────────────────────────────

describe('UAD-940 outbuildings', () => {
  it('no errors for valid item', () => {
    const doc = {
      outbuildings: [{ type: 'Barn', gba: 400 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-941: missing type', () => {
    const doc = {
      outbuildings: [{ gba: 200 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-941');
  });

  it('UAD-942: gba <= 0', () => {
    const doc = {
      outbuildings: [{ type: 'Shed', gba: 0 }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-942');
  });
});

// ── UAD-950: Amenities ────────────────────────────────────────────────────────

describe('UAD-950 amenities', () => {
  it('no errors for valid item', () => {
    const doc = {
      amenities: [{ category: 'Outdoor Living', feature: 'Pool', impact: 'Beneficial' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-951: missing category', () => {
    const doc = {
      amenities: [{ feature: 'Pool' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-951');
  });

  it('UAD-952: invalid category enum', () => {
    const doc = {
      amenities: [{ category: 'Swimming', feature: 'Pool' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-952');
  });

  it('UAD-953: missing feature', () => {
    const doc = {
      amenities: [{ category: 'Water Features' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-953');
  });

  it('UAD-954: invalid impact enum', () => {
    const doc = {
      amenities: [{ category: 'Miscellaneous', feature: 'Bike rack', impact: 'Mixed' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-954');
  });
});

// ── UAD-960: Overall Quality & Condition ─────────────────────────────────────

describe('UAD-960 overallQualityCondition', () => {
  it('no errors for valid data', () => {
    const doc = {
      overallQualityCondition: {
        overallQuality: 'Q3',
        overallCondition: 'C3',
        exteriorFeatures: [],
        interiorFeatures: [],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-961: invalid overallQuality', () => {
    const doc = {
      overallQualityCondition: {
        overallQuality: 'Q9',
        overallCondition: 'C3',
        exteriorFeatures: [],
        interiorFeatures: [],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-961');
  });

  it('UAD-962: invalid overallCondition', () => {
    const doc = {
      overallQualityCondition: {
        overallQuality: 'Q3',
        overallCondition: 'C9',
        exteriorFeatures: [],
        interiorFeatures: [],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-962');
  });

  it('UAD-963: invalid feature quality rating', () => {
    const doc = {
      overallQualityCondition: {
        overallQuality: 'Q3',
        overallCondition: 'C3',
        exteriorFeatures: [{ feature: 'Roof', quality: 'Q7', condition: 'C2' }],
        interiorFeatures: [],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-963');
  });

  it('UAD-964: invalid feature condition rating', () => {
    const doc = {
      overallQualityCondition: {
        overallQuality: 'Q3',
        overallCondition: 'C3',
        exteriorFeatures: [],
        interiorFeatures: [{ feature: 'Kitchen', quality: 'Q2', condition: 'C0' }],
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-964');
  });
});

// ── UAD-970: Analyzed Properties Not Used ────────────────────────────────────

describe('UAD-970 analyzedPropertiesNotUsed', () => {
  it('no errors for valid item', () => {
    const doc = {
      analyzedPropertiesNotUsed: [{ address: '100 Oak St', reasonNotUsed: 'Excessive adjustments' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-971: missing address', () => {
    const doc = {
      analyzedPropertiesNotUsed: [{ reasonNotUsed: 'Too dissimilar' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-971');
  });

  it('UAD-972: missing reasonNotUsed', () => {
    const doc = {
      analyzedPropertiesNotUsed: [{ address: '200 Pine Rd' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-972');
  });
});

// ── UAD-980: Prior Transfers ──────────────────────────────────────────────────

describe('UAD-980 priorTransfers', () => {
  it('no errors for valid item', () => {
    const doc = {
      priorTransfers: [{ salePrice: 450000, transactionDate: '2024-06-01' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-981: salePrice <= 0', () => {
    const doc = {
      priorTransfers: [{ salePrice: 0, transactionDate: '2024-01-01' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-981');
  });

  it('UAD-982: invalid transactionDate', () => {
    const doc = {
      priorTransfers: [{ salePrice: 300000, transactionDate: 'not-a-date' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-982');
  });
});

// ── UAD-990: Revision History ─────────────────────────────────────────────────

describe('UAD-990 revisionHistory', () => {
  it('no errors for valid entry', () => {
    const doc = {
      revisionHistory: [{ revisionDate: '2024-09-15', description: 'Updated comps grid' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-991: missing revisionDate', () => {
    const doc = {
      revisionHistory: [{ description: 'some change' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-991');
  });

  it('UAD-992: invalid revisionDate format', () => {
    const doc = {
      revisionHistory: [{ revisionDate: 'yesterday', description: 'fix' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-992');
  });

  it('UAD-993: missing description', () => {
    const doc = {
      revisionHistory: [{ revisionDate: '2024-11-01' }],
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-993');
  });
});

// ── UAD-994: Reconsideration of Value ────────────────────────────────────────

describe('UAD-994 reconsiderationOfValue', () => {
  it('no errors for fully populated entry', () => {
    const doc = {
      reconsiderationOfValue: { type: 'Formal', date: '2025-01-10', result: 'Value maintained' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-995: missing type', () => {
    const doc = {
      reconsiderationOfValue: { date: '2025-01-10', result: 'Value maintained' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-995');
  });

  it('UAD-996: missing date', () => {
    const doc = {
      reconsiderationOfValue: { type: 'Informal', result: 'Revised' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-996');
  });

  it('UAD-997: invalid date format', () => {
    const doc = {
      reconsiderationOfValue: { type: 'Formal', date: 'not-a-date', result: 'Maintained' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-997');
  });

  it('UAD-998: missing result', () => {
    const doc = {
      reconsiderationOfValue: { type: 'Formal', date: '2025-03-01' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-998');
  });
});

// ── UAD-999: Assignment Conditions ───────────────────────────────────────────

describe('UAD-999 assignmentConditions', () => {
  it('no errors when all required fields present', () => {
    const doc = {
      assignmentConditions: {
        intendedUse: 'Mortgage financing',
        marketValueDefinition: 'Most probable price…',
      },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toEqual([]);
  });

  it('UAD-999: missing intendedUse', () => {
    const doc = {
      assignmentConditions: { marketValueDefinition: 'Most probable price…' },
    } as unknown as CanonicalReportDocument;
    expect(codes(doc)).toContain('UAD-999');
  });

  it('UAD-999W: missing marketValueDefinition is a WARNING (not ERROR)', () => {
    const doc = {
      assignmentConditions: { intendedUse: 'Mortgage financing' },
    } as unknown as CanonicalReportDocument;
    const results = validate(doc);
    const warning = results.find(e => e.uadRule === 'UAD-999W');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('WARNING');
  });
});

// ── UadFinalizationValidationError — shape verification ──────────────────────

describe('UadFinalizationValidationError', () => {
  it('stores the validation errors on validationErrors property', () => {
    const fakeErrors = [
      {
        fieldPath: 'foo.bar',
        errorCode: 'REQUIRED_FIELD_MISSING',
        errorMessage: 'bar is required',
        severity: 'ERROR' as const,
        uadRule: 'UAD-901',
      },
    ];
    const err = new UadFinalizationValidationError(fakeErrors);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UadFinalizationValidationError');
    expect(err.validationErrors).toEqual(fakeErrors);
    expect(err.message).toContain('UAD-901');
    expect(err.message).toContain('bar is required');
  });

  it('includes all errors in the message summary', () => {
    const errs = [
      { fieldPath: 'a', errorCode: 'E', errorMessage: 'msg1', severity: 'ERROR' as const, uadRule: 'UAD-911' },
      { fieldPath: 'b', errorCode: 'E', errorMessage: 'msg2', severity: 'ERROR' as const, uadRule: 'UAD-921' },
    ];
    const err = new UadFinalizationValidationError(errs);
    expect(err.message).toContain('UAD-911');
    expect(err.message).toContain('UAD-921');
  });
});

// ── validateCanonicalCore — subject / comps / reconciliation ─────────────────
// These tests drive the UAD-100/200/500 rules added in the core-validation
// extension to validateCanonicalSections.

/** Minimal fully-valid CanonicalReportDocument for core tests. */
function validCoreDoc(): CanonicalReportDocument {
  return {
    subject: {
      address: { streetAddress: '123 Main St', city: 'Springfield', state: 'IL', zipCode: '62701' },
      propertyType: 'SFR',
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2000,
      grossLivingArea: 1500,
    },
    comps: [
      {
        selected: true,
        salePrice: 350000,
        saleDate: '2026-03-15',
        grossLivingArea: 1400,
        address: { streetAddress: '100 Elm St', city: 'Springfield', state: 'IL', zipCode: '62701' },
      },
    ],
    valuation: {
      estimatedValue: 365000,
      effectiveDate: '2026-05-01',
    },
  } as unknown as CanonicalReportDocument;
}

describe('validateCanonicalCore — subject required fields (UAD-100)', () => {
  it('no errors for a fully valid doc', () => {
    expect(validate(validCoreDoc())).toEqual([]);
  });

  it('UAD-100: missing streetAddress', () => {
    const doc = validCoreDoc();
    (doc.subject.address as any).streetAddress = undefined;
    expect(codes(doc)).toContain('UAD-100');
  });

  it('UAD-100: missing city', () => {
    const doc = validCoreDoc();
    (doc.subject.address as any).city = '';
    expect(codes(doc)).toContain('UAD-100');
  });

  it('UAD-101: invalid state code', () => {
    const doc = validCoreDoc();
    (doc.subject.address as any).state = 'Illinois';
    expect(codes(doc)).toContain('UAD-101');
  });

  it('UAD-102: invalid zip code', () => {
    const doc = validCoreDoc();
    (doc.subject.address as any).zipCode = '1234';
    expect(codes(doc)).toContain('UAD-102');
  });

  it('UAD-103: invalid quality rating', () => {
    const doc = validCoreDoc();
    (doc.subject as any).quality = 'Good';
    expect(codes(doc)).toContain('UAD-103');
  });

  it('UAD-104: invalid condition rating', () => {
    const doc = validCoreDoc();
    (doc.subject as any).condition = 'Average';
    expect(codes(doc)).toContain('UAD-104');
  });

  it('UAD-105: year built too early', () => {
    const doc = validCoreDoc();
    (doc.subject as any).yearBuilt = 1400;
    expect(codes(doc)).toContain('UAD-105');
  });

  it('UAD-106 (WARNING): GLA out of range', () => {
    const doc = validCoreDoc();
    (doc.subject as any).grossLivingArea = 90;
    const errs = validate(doc);
    const warning = errs.find(e => e.uadRule === 'UAD-106');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('WARNING');
  });
});

describe('validateCanonicalCore — comparables (UAD-200)', () => {
  it('UAD-200: no selected comps', () => {
    const doc = validCoreDoc();
    (doc as any).comps = [];
    expect(codes(doc)).toContain('UAD-200');
  });

  it('UAD-200: all comps unselected', () => {
    const doc = validCoreDoc();
    (doc as any).comps = [{ selected: false, salePrice: 300000, saleDate: '2026-01-01' }];
    expect(codes(doc)).toContain('UAD-200');
  });

  it('UAD-201: selected comp missing sale price', () => {
    const doc = validCoreDoc();
    (doc as any).comps[0].salePrice = null;
    expect(codes(doc)).toContain('UAD-201');
  });

  it('UAD-202: selected comp missing sale date', () => {
    const doc = validCoreDoc();
    (doc as any).comps[0].saleDate = null;
    expect(codes(doc)).toContain('UAD-202');
  });

  it('UAD-203: selected comp missing GLA', () => {
    const doc = validCoreDoc();
    (doc as any).comps[0].grossLivingArea = 0;
    expect(codes(doc)).toContain('UAD-203');
  });

  it('UAD-204: selected comp missing address', () => {
    const doc = validCoreDoc();
    (doc as any).comps[0].address.streetAddress = '';
    expect(codes(doc)).toContain('UAD-204');
  });
});

describe('validateCanonicalCore — valuation (UAD-500)', () => {
  it('UAD-500: valuation is null', () => {
    const doc = validCoreDoc();
    (doc as any).valuation = null;
    expect(codes(doc)).toContain('UAD-500');
  });

  it('UAD-501: estimatedValue is 0', () => {
    const doc = validCoreDoc();
    (doc as any).valuation.estimatedValue = 0;
    expect(codes(doc)).toContain('UAD-501');
  });

  it('UAD-502: missing effectiveDate', () => {
    const doc = validCoreDoc();
    (doc as any).valuation.effectiveDate = '';
    expect(codes(doc)).toContain('UAD-502');
  });
});

describe('validateCanonicalCore — 422 gate integration', () => {
  it('UAD-100 error would block finalization (ERROR severity)', () => {
    const doc = validCoreDoc();
    (doc.subject.address as any).streetAddress = undefined;
    const errors = validate(doc).filter(e => e.severity === 'ERROR');
    expect(errors.length).toBeGreaterThan(0);
    // Confirm it would produce UadFinalizationValidationError
    expect(() => {
      if (errors.length > 0) throw new UadFinalizationValidationError(errors);
    }).toThrow(UadFinalizationValidationError);
  });

  it('UAD-106 warning does NOT block finalization', () => {
    const doc = validCoreDoc();
    (doc.subject as any).grossLivingArea = 90; // triggers WARNING only
    const errors = validate(doc).filter(e => e.severity === 'ERROR');
    expect(errors.length).toBe(0); // warnings don't trigger 422
  });
});
