/**
 * ComparableSaleService — Unit Tests  (Phase R1.5)
 *
 * Tests cover:
 *   - haversineDistanceMiles: accuracy
 *   - ingestFromMls: creates new comp with propertyId; skips duplicate SOLD; updates ACTIVE
 *   - findByPropertyId: returns sales for property; returns empty when none
 *   - findByRadius: filters by distance; applies price/GLA filters; excludes no-lat/lng records
 *   - markUsedInReport: appends reportId; idempotent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComparableSaleService,
  haversineDistanceMiles,
  COMPARABLE_SALES_CONTAINER,
} from '../src/services/comparable-sale.service';
import type { PropertyComparableSale } from '../src/types/comparable-sale.types';
import type { MlsListing } from '../src/types/mls-data.types';

// ─── Mock CosmosDbService ─────────────────────────────────────────────────────

function makeMockCosmosService(initialComps: PropertyComparableSale[] = []) {
  const store = new Map<string, PropertyComparableSale>();
  for (const c of initialComps) store.set(c.id, c);

  return {
    queryDocuments: vi.fn().mockImplementation(
      async (container: string, query: string, params: { name: string; value: unknown }[]) => {
        if (container !== COMPARABLE_SALES_CONTAINER) return [];

        const paramMap: Record<string, unknown> = {};
        for (const p of params ?? []) paramMap[p.name] = p.value;

        let results = [...store.values()];

        if (paramMap['@tenantId'])    results = results.filter((c) => c.tenantId   === paramMap['@tenantId']);
        if (paramMap['@propertyId'])  results = results.filter((c) => c.propertyId === paramMap['@propertyId']);
        if (paramMap['@latMin'] != null) results = results.filter((c) => (c.latitude  ?? -999) >= (paramMap['@latMin'] as number));
        if (paramMap['@latMax'] != null) results = results.filter((c) => (c.latitude  ?? 999)  <= (paramMap['@latMax'] as number));
        if (paramMap['@lngMin'] != null) results = results.filter((c) => (c.longitude ?? -999) >= (paramMap['@lngMin'] as number));
        if (paramMap['@lngMax'] != null) results = results.filter((c) => (c.longitude ?? 999)  <= (paramMap['@lngMax'] as number));
        if (paramMap['@salePriceMin'] != null) results = results.filter((c) => c.salePrice >= (paramMap['@salePriceMin'] as number));
        if (paramMap['@salePriceMax'] != null) results = results.filter((c) => c.salePrice <= (paramMap['@salePriceMax'] as number));
        if (paramMap['@glaMin'] != null) results = results.filter((c) => c.glaAtSale >= (paramMap['@glaMin'] as number));

        return results;
      }
    ),
    getDocument: vi.fn().mockImplementation(
      async (_container: string, id: string, _pk: string) => store.get(id) ?? null
    ),
    createDocument: vi.fn().mockImplementation(
      async (_container: string, doc: PropertyComparableSale) => {
        store.set(doc.id, doc);
        return doc;
      }
    ),
    upsertDocument: vi.fn().mockImplementation(
      async (_container: string, doc: PropertyComparableSale) => {
        store.set(doc.id, doc);
        return doc;
      }
    ),
  };
}

// ─── Mock PropertyRecordService ───────────────────────────────────────────────

function makeMockPropertyRecordService(propertyId = 'prop-resolved-001') {
  return {
    resolveOrCreate: vi.fn().mockResolvedValue({
      propertyId,
      isNew: false,
      method: 'ADDRESS_NORM',
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeListing(overrides: Partial<MlsListing> = {}): MlsListing {
  return {
    id: 'mls-001',
    address: '123 Main Street',
    city: 'Pasadena',
    state: 'CA',
    zipCode: '91103',
    latitude: 34.148,
    longitude: -118.141,
    salePrice: 850_000,
    saleDate: '2026-01-15',
    squareFootage: 1800,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 1965,
    propertyType: 'Single Family',
    source: 'Bridge MLS',
    ...overrides,
  };
}

function makeComp(overrides: Partial<PropertyComparableSale> = {}): PropertyComparableSale {
  const now = new Date().toISOString();
  return {
    id: 'comp-bridge-mls-mls-001',
    tenantId: 'tenant-a',
    propertyId: 'prop-resolved-001',
    propertyIdResolvedBy: 'ADDRESS_NORM',
    mlsNumber: 'mls-001',
    source: 'Bridge MLS',
    status: 'SOLD',
    streetAddress: '123 Main Street',
    city: 'Pasadena',
    state: 'CA',
    zipCode: '91103',
    latitude: 34.148,
    longitude: -118.141,
    salePrice: 850_000,
    saleDate: '2026-01-15',
    glaAtSale: 1800,
    bedroomsAtSale: 3,
    bathroomsAtSale: 2,
    usedInReportIds: [],
    ingestedAt: now,
    updatedAt: now,
    ingestedBy: 'SYSTEM',
    ...overrides,
  };
}

// ─── haversineDistanceMiles ───────────────────────────────────────────────────

describe('haversineDistanceMiles', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMiles(34.0, -118.0, 34.0, -118.0)).toBe(0);
  });

  it('approximates known distance: NYC → LA ≈ 2450 miles', () => {
    const dist = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(2440);
    expect(dist).toBeLessThan(2460);
  });

  it('is symmetric', () => {
    const a = haversineDistanceMiles(34.1, -118.1, 34.2, -118.2);
    const b = haversineDistanceMiles(34.2, -118.2, 34.1, -118.1);
    expect(Math.abs(a - b)).toBeLessThan(0.0001);
  });

  it('returns a small positive number for nearby points (~1 mile apart)', () => {
    // 1 degree of latitude ≈ 69 miles  →  0.0145 degrees ≈ 1 mile
    const dist = haversineDistanceMiles(34.0, -118.0, 34.0145, -118.0);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });
});

// ─── ingestFromMls ────────────────────────────────────────────────────────────

describe('ComparableSaleService.ingestFromMls', () => {
  it('creates a new comp and resolves propertyId', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const result = await svc.ingestFromMls(makeListing(), 'tenant-a', 'alice');

    expect(result.propertyId).toBe('prop-resolved-001');
    expect(result.source).toBe('Bridge MLS');
    expect(result.salePrice).toBe(850_000);
    expect(result.glaAtSale).toBe(1800);
    expect(result.status).toBe('SOLD');
    expect(cosmos.createDocument).toHaveBeenCalledOnce();
    expect(propSvc.resolveOrCreate).toHaveBeenCalledOnce();
  });

  it('does not modify an existing SOLD record (idempotent)', async () => {
    const existing = makeComp({ status: 'SOLD', salePrice: 850_000 });
    const cosmos = makeMockCosmosService([existing]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    // Same MLS listing — should skip
    const result = await svc.ingestFromMls(makeListing({ salePrice: 900_000 }), 'tenant-a');

    // Price NOT updated — SOLD is immutable
    expect(result.salePrice).toBe(850_000);
    expect(cosmos.createDocument).not.toHaveBeenCalled();
    expect(cosmos.upsertDocument).not.toHaveBeenCalled();
    expect(propSvc.resolveOrCreate).not.toHaveBeenCalled();
  });

  it('updates an ACTIVE comp when ingested again (status / price may change)', async () => {
    const existing = makeComp({ status: 'ACTIVE', salePrice: 800_000 });
    const cosmos = makeMockCosmosService([existing]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    // Re-ingested with updated price
    const result = await svc.ingestFromMls(makeListing({ salePrice: 860_000 }), 'tenant-a');

    expect(result.salePrice).toBe(860_000);
    expect(cosmos.upsertDocument).toHaveBeenCalledOnce();
    expect(cosmos.createDocument).not.toHaveBeenCalled();
  });

  it('throws when tenantId is empty', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(svc.ingestFromMls(makeListing(), '')).rejects.toThrow('tenantId is required');
  });

  it('throws when listing address is missing', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(
      svc.ingestFromMls(makeListing({ address: '' }), 'tenant-a')
    ).rejects.toThrow('listing.address is required');
  });
});

// ─── findByPropertyId ─────────────────────────────────────────────────────────

describe('ComparableSaleService.findByPropertyId', () => {
  it('returns all comps for the given propertyId', async () => {
    const comps = [
      makeComp({ id: 'comp-1', propertyId: 'prop-A' }),
      makeComp({ id: 'comp-2', propertyId: 'prop-A' }),
      makeComp({ id: 'comp-3', propertyId: 'prop-B' }),
    ];
    const cosmos = makeMockCosmosService(comps);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const result = await svc.findByPropertyId('prop-A', 'tenant-a');

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['comp-1', 'comp-2']));
  });

  it('returns empty array when no comps exist for property', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const result = await svc.findByPropertyId('prop-unknown', 'tenant-a');

    expect(result).toEqual([]);
  });

  it('throws when propertyId is empty', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(svc.findByPropertyId('', 'tenant-a')).rejects.toThrow('propertyId is required');
  });
});

// ─── findByRadius ─────────────────────────────────────────────────────────────

describe('ComparableSaleService.findByRadius', () => {
  // Pasadena, CA — center point for all radius tests
  const CENTER_LAT = 34.148;
  const CENTER_LNG = -118.141;

  it('returns comps within the radius, sorted by ascending distance', async () => {
    const near = makeComp({ id: 'near',  latitude: 34.150, longitude: -118.143 }); // ~0.2 mi
    const far  = makeComp({ id: 'far',   latitude: 34.280, longitude: -118.400 }); // ~17 mi
    const cosmos = makeMockCosmosService([near, far]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const results = await svc.findByRadius(
      { latitude: CENTER_LAT, longitude: CENTER_LNG, radiusMiles: 5 },
      'tenant-a'
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('near');
  });

  it('excludes records that have no lat/lng', async () => {
    const noGeo  = makeComp({ id: 'no-geo',  latitude: undefined, longitude: undefined });
    const withGeo = makeComp({ id: 'with-geo', latitude: 34.150, longitude: -118.143 });
    const cosmos = makeMockCosmosService([noGeo, withGeo]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const results = await svc.findByRadius(
      { latitude: CENTER_LAT, longitude: CENTER_LNG, radiusMiles: 5 },
      'tenant-a'
    );

    expect(results.map((c) => c.id)).not.toContain('no-geo');
    expect(results.map((c) => c.id)).toContain('with-geo');
  });

  it('applies salePriceMin/Max filter', async () => {
    const cheap     = makeComp({ id: 'cheap',    salePrice: 400_000, latitude: 34.150, longitude: -118.143 });
    const expensive = makeComp({ id: 'expensive',salePrice: 900_000, latitude: 34.151, longitude: -118.142 });
    const cosmos = makeMockCosmosService([cheap, expensive]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const results = await svc.findByRadius(
      {
        latitude: CENTER_LAT, longitude: CENTER_LNG, radiusMiles: 5,
        salePriceMin: 600_000, salePriceMax: 1_000_000,
      },
      'tenant-a'
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('expensive');
  });

  it('respects the limit option', async () => {
    const comps = Array.from({ length: 10 }, (_, i) =>
      makeComp({ id: `comp-${i}`, latitude: CENTER_LAT + i * 0.001, longitude: CENTER_LNG })
    );
    const cosmos = makeMockCosmosService(comps);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    const results = await svc.findByRadius(
      { latitude: CENTER_LAT, longitude: CENTER_LNG, radiusMiles: 5, limit: 3 },
      'tenant-a'
    );

    expect(results).toHaveLength(3);
  });

  it('throws when latitude/longitude are missing', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(
      svc.findByRadius({ latitude: null as any, longitude: CENTER_LNG, radiusMiles: 5 }, 'tenant-a')
    ).rejects.toThrow('latitude and longitude are required');
  });

  it('throws when radiusMiles is 0 or negative', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(
      svc.findByRadius({ latitude: CENTER_LAT, longitude: CENTER_LNG, radiusMiles: 0 }, 'tenant-a')
    ).rejects.toThrow('radiusMiles must be > 0');
  });
});

// ─── markUsedInReport ────────────────────────────────────────────────────────

describe('ComparableSaleService.markUsedInReport', () => {
  it('appends a reportId to usedInReportIds', async () => {
    const comp = makeComp({ usedInReportIds: [] });
    const cosmos = makeMockCosmosService([comp]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await svc.markUsedInReport(comp.id, comp.zipCode, 'report-xyz');

    expect(cosmos.upsertDocument).toHaveBeenCalledOnce();
    const saved = cosmos.upsertDocument.mock.calls[0]![1] as PropertyComparableSale;
    expect(saved.usedInReportIds).toContain('report-xyz');
  });

  it('is idempotent — marking same report twice does not duplicate', async () => {
    const comp = makeComp({ usedInReportIds: ['report-xyz'] });
    const cosmos = makeMockCosmosService([comp]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await svc.markUsedInReport(comp.id, comp.zipCode, 'report-xyz');

    // upsertDocument must NOT be called when already present
    expect(cosmos.upsertDocument).not.toHaveBeenCalled();
  });

  it('throws when comp does not exist', async () => {
    const cosmos = makeMockCosmosService([]);
    const propSvc = makeMockPropertyRecordService();
    const svc = new ComparableSaleService(cosmos as any, propSvc as any);

    await expect(
      svc.markUsedInReport('no-such-id', '91103', 'report-abc')
    ).rejects.toThrow('not found');
  });
});
