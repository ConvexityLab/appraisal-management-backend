/**
 * Phase O — Unit tests for URAR conditional rendering flags in Urar1004Mapper
 * (URAR_CONDITIONAL_RENDERING_PLAN.md — Phases A–N)
 *
 * Six scenarios covering every form-type discriminant path:
 *   O-1  Standard SFR interior (Form 1004)
 *   O-2  Condominium (Form 1073)
 *   O-3  Manufactured home (Form 1004C)
 *   O-4  Exterior-only inspection (Form 2055)
 *   O-5  New construction (1004, yearBuilt = current year)
 *   O-6  PUD overlay (Form 1004 with PUD property type)
 */

import { describe, it, expect } from 'vitest';
import { Urar1004Mapper } from '../../src/services/report-engine/field-mappers/urar-1004.mapper.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import { SCHEMA_VERSION } from '@l1/shared-types';

// ─── Minimal doc factory ─────────────────────────────────────────────────────

function makeDoc(overrides: Partial<CanonicalReportDocument> = {}): CanonicalReportDocument {
  return {
    id: 'rpt-test',
    reportId: 'rpt-test',
    orderId: 'order-test',
    reportType: 'FORM_1004' as any,
    status: 'draft' as any,
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      orderId: 'order-test',
      inspectionDate: '2026-05-01',
    } as any,
    subject: {
      address: {
        streetAddress: '123 Oak Lane',
        city: 'Jacksonville',
        state: 'FL',
        zipCode: '32256',
      },
      propertyType: 'SFR',
      yearBuilt: 2010,
      constructionMethod: 'SiteBuilt',
    } as any,
    comps: [],
    ...overrides,
  } as CanonicalReportDocument;
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('Urar1004Mapper — conditional rendering flags (Phase O)', () => {
  const mapper = new Urar1004Mapper();

  // ── O-1: Standard SFR interior (Form 1004) ────────────────────────────────
  describe('O-1: Standard SFR interior (FORM_1004)', () => {
    const ctx = mapper.mapToFieldMap(makeDoc()) as any;

    it('all form-type flags are false', () => {
      expect(ctx.isCondo).toBe(false);
      expect(ctx.isManufactured).toBe(false);
      expect(ctx.isPUD).toBe(false);
      expect(ctx.isExteriorOnly).toBe(false);
      expect(ctx.isNewConstruction).toBe(false);
    });

    it('uses Form 1004 display identifiers', () => {
      expect(ctx.gseFormNumber).toBe('1004');
      expect(ctx.gseFormLabel).toMatch(/Form 1004/);
    });

    it('section detail flags are all false', () => {
      expect(ctx.hasCondoDetail).toBe(false);
      expect(ctx.hasPudDetail).toBe(false);
      expect(ctx.hasManufacturedHome).toBe(false);
    });

    it('section context objects are null', () => {
      expect(ctx.condoDetail).toBe(null);
      expect(ctx.pudDetail).toBe(null);
      expect(ctx.manufacturedHome).toBe(null);
    });

    it('cost approach label says Not Required', () => {
      expect(ctx.costApproachLabel).toMatch(/Not Required/);
    });

    it('no new-construction warning', () => {
      expect(ctx.costApproachRequiredWarning).toBe(null);
    });

    it('scope statement mentions interior inspection', () => {
      expect(ctx.scopeStatement).toMatch(/Interior and exterior/);
    });
  });

  // ── O-2: Condo (Form 1073) ────────────────────────────────────────────────
  describe('O-2: Condominium (FORM_1073)', () => {
    const doc = makeDoc({
      reportType: 'FORM_1073' as any,
      subject: {
        address: { streetAddress: '500 Brickell Ave Unit 18', city: 'Miami', state: 'FL', zipCode: '33131' },
        propertyType: 'Condo',
        yearBuilt: 2005,
        constructionMethod: 'SiteBuilt',
        condoDetail: {
          projectName: 'Sunset Towers',
          projectType: 'Established',
          totalUnits: 120,
          unitsSold: 95,
          ownerOccupancyPct: 72,
          singleEntityOwnershipPct: 8,   // < 10%, no flag
          commonElementsComplete: true,
          pendingLitigation: false,
          developerControlled: false,
        },
        hoaDetail: {
          hoaFee: 400,
          hoaFrequency: 'Monthly',
          hoaIncludes: 'Water, Trash, Exterior',
          reserveFundBalance: 150000,
        },
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;

    it('isCondo is true', () => {
      expect(ctx.isCondo).toBe(true);
    });

    it('uses 1073 display identifiers', () => {
      expect(ctx.gseFormNumber).toBe('1073');
      expect(ctx.gseFormLabel).toMatch(/Form 1073/);
    });

    it('hasCondoDetail and condoDetail populated', () => {
      expect(ctx.hasCondoDetail).toBe(true);
      expect(ctx.condoDetail).not.toBe(null);
      expect(ctx.condoDetail.projectName).toBe('Sunset Towers');
    });

    it('HOA fee formatted as currency', () => {
      expect(ctx.condoDetail.hoaFee).toMatch(/\$400/);
    });

    it('singleEntityConcentrationFlag is false when < 10%', () => {
      expect(ctx.condoDetail.singleEntityConcentrationFlag).toBe(false);
    });

    it('singleEntityConcentrationFlag is true when > 10%', () => {
      const doc15 = makeDoc({
        reportType: 'FORM_1073' as any,
        subject: {
          address: { streetAddress: '500 Brickell Ave', city: 'Miami', state: 'FL', zipCode: '33131' },
          propertyType: 'Condo',
          condoDetail: { singleEntityOwnershipPct: 15 },
        } as any,
      });
      const ctx15 = mapper.mapToFieldMap(doc15) as any;
      expect(ctx15.condoDetail.singleEntityConcentrationFlag).toBe(true);
    });

    it('hasHoaDetail is true', () => {
      expect(ctx.hasHoaDetail).toBe(true);
    });
  });

  // ── O-3: Manufactured Home (Form 1004C) ───────────────────────────────────
  describe('O-3: Manufactured home (FORM_1004C)', () => {
    const doc = makeDoc({
      reportType: 'FORM_1004C' as any,
      subject: {
        address: { streetAddress: '77 Pine Ct', city: 'Ocala', state: 'FL', zipCode: '34470' },
        propertyType: 'Manufactured',
        yearBuilt: 2018,
        constructionMethod: 'Manufactured',
      } as any,
      manufacturedHome: {
        manufacturer: 'Clayton',
        model: 'Avondale',
        serialNumber: 'CLT-2018-00742',
        yearManufactured: 2018,
        widthType: 'Doublewide',
        hudDataPlatePresent: true,
        hudLabelNumbers: '123456 / 123457',
        foundationType: 'Permanent Foundation',
        factoryBuiltCertification: 'HUD Code',
        invoiceCost: 95000,
        deliveryCost: 3000,
        installationCost: 5000,
        setupCost: 2000,
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;

    it('isManufactured is true', () => {
      expect(ctx.isManufactured).toBe(true);
    });

    it('uses 1004C display identifiers', () => {
      expect(ctx.gseFormNumber).toBe('1004C');
      expect(ctx.gseFormLabel).toMatch(/Form 1004C/);
    });

    it('hasManufacturedHome and manufacturedHome populated', () => {
      expect(ctx.hasManufacturedHome).toBe(true);
      expect(ctx.manufacturedHome).not.toBe(null);
      expect(ctx.manufacturedHome.manufacturer).toBe('Clayton');
    });

    it('totalCost is computed and formatted', () => {
      // 95000 + 3000 + 5000 + 2000 = 105000
      expect(ctx.manufacturedHome.totalCost).toMatch(/\$105,000/);
    });
  });

  // ── O-4: Exterior-only inspection (Form 2055) ─────────────────────────────
  describe('O-4: Exterior-only (FORM_2055)', () => {
    const doc = makeDoc({
      reportType: 'FORM_2055' as any,
      scopeOfWork: { inspectionType: 'Exterior-Only' } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;

    it('isExteriorOnly is true', () => {
      expect(ctx.isExteriorOnly).toBe(true);
    });

    it('uses 2055 display identifiers', () => {
      expect(ctx.gseFormNumber).toBe('2055');
      expect(ctx.gseFormLabel).toMatch(/Form 2055/);
    });

    it('scope statement says Exterior-only', () => {
      expect(ctx.scopeStatement).toMatch(/Exterior-only inspection/);
    });

    it('scope statement does NOT say interior', () => {
      expect(ctx.scopeStatement).not.toMatch(/Interior and exterior/);
    });
  });

  // ── O-5: New construction ─────────────────────────────────────────────────
  describe('O-5: New construction (FORM_1004, yearBuilt = current year)', () => {
    const currentYear = new Date().getFullYear();

    it('isNewConstruction is true and label says Required', () => {
      const doc = makeDoc({ subject: { address: {} as any, propertyType: 'SFR', yearBuilt: currentYear } as any });
      const ctx = mapper.mapToFieldMap(doc) as any;
      expect(ctx.isNewConstruction).toBe(true);
      expect(ctx.costApproachLabel).toMatch(/Required/);
      expect(ctx.costApproachLabel).toMatch(/New Construction/);
    });

    it('costApproachRequiredWarning set when no cost approach data', () => {
      const doc = makeDoc({ subject: { address: {} as any, propertyType: 'SFR', yearBuilt: currentYear } as any });
      const ctx = mapper.mapToFieldMap(doc) as any;
      expect(ctx.costApproachRequiredWarning).toMatch(/WARNING/);
    });

    it('costApproachRequiredWarning is null when cost approach present', () => {
      const doc = makeDoc({
        subject: { address: {} as any, propertyType: 'SFR', yearBuilt: currentYear } as any,
        costApproach: { estimatedLandValue: 80000, indicatedValueByCostApproach: 350000 } as any,
      });
      const ctx = mapper.mapToFieldMap(doc) as any;
      expect(ctx.costApproachRequiredWarning).toBe(null);
    });
  });

  // ── O-6: PUD overlay ──────────────────────────────────────────────────────
  describe('O-6: PUD overlay (FORM_1004, propertyType = PUD)', () => {
    const doc = makeDoc({
      reportType: 'FORM_1004' as any,
      subject: {
        address: { streetAddress: '211 Harbor View Dr', city: 'St. Augustine', state: 'FL', zipCode: '32080' },
        propertyType: 'PUD',
        yearBuilt: 2015,
        constructionMethod: 'SiteBuilt',
        pudDetail: {
          projectName: 'Harbor View PUD',
          pudType: 'Established',
          totalUnits: 350,
          totalPhases: 4,
          unitsSold: 310,
          ownerOccupancyPct: 82,
          developerControlled: false,
          commonElementsComplete: true,
          projectComplete: true,
          observedDeficiencies: false,
        },
        hoaDetail: {
          hoaFee: 200,
          hoaFrequency: 'Monthly',
          hoaIncludes: 'Common areas, landscaping',
          reserveFundBalance: 200000,
        },
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;

    it('isPUD is true', () => {
      expect(ctx.isPUD).toBe(true);
    });

    it('form number stays 1004 (PUD does not change form type)', () => {
      expect(ctx.gseFormNumber).toBe('1004');
    });

    it('hasPudDetail and pudDetail populated', () => {
      expect(ctx.hasPudDetail).toBe(true);
      expect(ctx.pudDetail).not.toBe(null);
      expect(ctx.pudDetail.projectName).toBe('Harbor View PUD');
    });

    it('HOA fee formatted as currency', () => {
      expect(ctx.pudDetail.hoaFee).toMatch(/\$200/);
    });

    it('hasHoaDetail is true', () => {
      expect(ctx.hasHoaDetail).toBe(true);
    });
  });
});
