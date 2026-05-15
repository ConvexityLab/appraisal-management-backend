/**
 * Unit tests for Urar1073Mapper  (R-11)
 *
 * Verifies that the condo-unit mapper:
 *  1. Returns all base urar-1004 keys (subject, comps, reconciliation …)
 *  2. Adds `condo` / `hasCondo` context when condoDetail is present
 *  3. Adds `hoa` / `hasHoa` context when hoaDetail is present
 *  4. Gracefully handles docs with neither condoDetail nor hoaDetail
 */

import { describe, it, expect } from 'vitest';
import { Urar1073Mapper } from '../../src/services/report-engine/field-mappers/urar-1073.mapper.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import { SCHEMA_VERSION } from '@l1/shared-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDoc(overrides: Partial<CanonicalReportDocument> = {}): CanonicalReportDocument {
  return {
    id: 'rpt-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: 'CONDO_1073' as any,
    status: 'draft' as any,
    schemaVersion: SCHEMA_VERSION,
    metadata: { orderId: 'order-1' } as any,
    subject: {
      address: {
        streetAddress: '100 Main St Unit 4B',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
      },
      parcelNumber: '01-0000-001',
    } as any,
    comps: [],
    ...overrides,
  } as CanonicalReportDocument;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Urar1073Mapper', () => {
  const mapper = new Urar1073Mapper();

  it('has the correct mapperKey', () => {
    expect(mapper.mapperKey).toBe('urar-1073');
  });

  it('returns base urar-1004 keys (subject, comps, reconciliation)', () => {
    const ctx = mapper.mapToFieldMap(makeDoc());
    expect(ctx).toHaveProperty('subject');
    expect(ctx).toHaveProperty('primaryComps');
    expect(ctx).toHaveProperty('reconciliation');
  });

  it('sets hasCondo=false and condo=null when condoDetail is absent', () => {
    const ctx = mapper.mapToFieldMap(makeDoc());
    expect(ctx.hasCondo).toBe(false);
    expect(ctx.condo).toBeNull();
  });

  it('sets hasHoa=false and hoa=null when hoaDetail is absent', () => {
    const ctx = mapper.mapToFieldMap(makeDoc());
    expect(ctx.hasHoa).toBe(false);
    expect(ctx.hoa).toBeNull();
  });

  it('populates condo context from condoDetail', () => {
    const doc = makeDoc({
      subject: {
        address: { streetAddress: '100 Main St Unit 4B', city: 'Miami', state: 'FL', zipCode: '33101' },
        condoDetail: {
          projectName: 'Brickell Key',
          projectType: 'Established',
          totalUnits: 200,
          unitsSold: 180,
          ownerOccupancyPct: 75,
          pendingLitigation: false,
          isPhased: false,
          commonElementsComplete: true,
          developerControlled: false,
        },
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasCondo).toBe(true);
    expect(ctx.condo.projectName).toBe('Brickell Key');
    expect(ctx.condo.totalUnits).toBe('200');           // num() formats as string
    expect(ctx.condo.ownerOccupancyPct).toBe('75.0%');  // pct() with 1 decimal
    expect(ctx.condo.pendingLitigation).toBe('No');     // boolYesNo()
    expect(ctx.condo.commonElementsComplete).toBe('Yes');
  });

  it('populates HOA context from hoaDetail', () => {
    const doc = makeDoc({
      subject: {
        address: { streetAddress: '100 Main St Unit 4B', city: 'Miami', state: 'FL', zipCode: '33101' },
        hoaDetail: {
          hoaName: 'Brickell Key HOA',
          hoaFee: 450,
          hoaFrequency: 'Monthly',
          hoaIncludes: 'Water, Trash, Building Insurance',
          mandatoryFees: 0,
          delinquentDues60Day: 5,
          delinquentDuesPct: 2.5,
        },
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasHoa).toBe(true);
    expect(ctx.hoa.hoaName).toBe('Brickell Key HOA');
    expect(ctx.hoa.hoaFee).toBe('$450');
    expect(ctx.hoa.hoaFrequency).toBe('Monthly');
    expect(ctx.hoa.delinquentDues60Day).toBe('5');
    expect(ctx.hoa.delinquentDuesPct).toBe('2.5%');
  });

  it('returns both condo and hoa when both are present', () => {
    const doc = makeDoc({
      subject: {
        address: { streetAddress: '100 Main St Unit 4B', city: 'Miami', state: 'FL', zipCode: '33101' },
        condoDetail: {
          projectName: 'Midtown Towers',
          totalUnits: 100,
          ownerOccupancyPct: 60,
          pendingLitigation: false,
          isPhased: false,
          commonElementsComplete: true,
          developerControlled: false,
        },
        hoaDetail: {
          hoaName: 'Midtown HOA',
          hoaFee: 320,
          hoaFrequency: 'Monthly',
          mandatoryFees: 25,
          delinquentDues60Day: 0,
          delinquentDuesPct: 0,
        },
      } as any,
    });
    const ctx = mapper.mapToFieldMap(doc) as any;
    expect(ctx.hasCondo).toBe(true);
    expect(ctx.hasHoa).toBe(true);
    expect(ctx.condo.projectName).toBe('Midtown Towers');
    expect(ctx.hoa.hoaFee).toBe('$320');
  });
});
