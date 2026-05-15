/**
 * PropertyRecordService — Unit Tests  (Phase R1.5)
 *
 * Tests cover:
 *   - findByApn: hit, miss, empty-APN guard
 *   - findByNormalizedAddress: hit (case-insensitive), miss, cross-zip miss
 *   - resolveOrCreate: APN path, address path, create-new path, idempotency
 *   - createVersion: version increment, versionHistory append, building merge, unknown-record guard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PropertyRecordService,
  normalizeStreetForMatch,
  PROPERTY_RECORDS_CONTAINER,
} from '../src/services/property-record.service';
import type { PropertyRecord } from '../src/types/property-record.types';

// ─── Mock CosmosDbService ─────────────────────────────────────────────────────

function makeMockCosmosService(initialRecords: PropertyRecord[] = []) {
  const store = new Map<string, PropertyRecord>();
  for (const r of initialRecords) {
    store.set(r.id, r);
  }

  return {
    queryDocuments: vi.fn().mockImplementation(
      async (container: string, query: string, params: { name: string; value: unknown }[]) => {
        if (container !== PROPERTY_RECORDS_CONTAINER) return [];

        const paramMap: Record<string, unknown> = {};
        for (const p of params ?? []) paramMap[p.name] = p.value;

        let results = [...store.values()];

        // tenantId filter (always present)
        if (paramMap['@tenantId'] !== undefined) {
          results = results.filter((r) => r.tenantId === paramMap['@tenantId']);
        }
        // APN filter
        if (paramMap['@apn'] !== undefined) {
          results = results.filter((r) => r.apn === paramMap['@apn']);
        }
        // ZIP filter
        if (paramMap['@zip'] !== undefined) {
          results = results.filter((r) => r.address.zip === paramMap['@zip']);
        }
        // State filter
        if (paramMap['@state'] !== undefined) {
          results = results.filter((r) => r.address.state === paramMap['@state']);
        }

        return results;
      }
    ),
    getDocument: vi.fn().mockImplementation(
      async (_container: string, id: string, _pk: string) => store.get(id) ?? null
    ),
    createDocument: vi.fn().mockImplementation(async (_container: string, doc: PropertyRecord) => {
      store.set(doc.id, doc);
      return doc;
    }),
    upsertDocument: vi.fn().mockImplementation(async (_container: string, doc: PropertyRecord) => {
      store.set(doc.id, doc);
      return doc;
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<PropertyRecord> = {}): PropertyRecord {
  return {
    id: 'prop-test-001',
    tenantId: 'tenant-a',
    apn: '123-456-789',
    address: {
      street: '123 MAIN STREET',
      city: 'PASADENA',
      state: 'CA',
      zip: '91103',
    },
    propertyType: 'single_family_residential',
    building: {
      gla: 1800,
      yearBuilt: 1965,
      bedrooms: 3,
      bathrooms: 2,
    },
    taxAssessments: [],
    permits: [],
    recordVersion: 1,
    versionHistory: [
      {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'alice',
        reason: 'Initial creation',
        source: 'MANUAL_CORRECTION',
        changedFields: [],
        previousValues: {},
      },
    ],
    dataSource: 'MANUAL_ENTRY',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'alice',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeStreetForMatch', () => {
  it('uppercases and strips punctuation', () => {
    expect(normalizeStreetForMatch('123 Main St.')).toBe('123 MAIN ST');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeStreetForMatch('  456   Oak  Ave  ')).toBe('456 OAK AVE');
  });

  it('handles empty string', () => {
    expect(normalizeStreetForMatch('')).toBe('');
  });

  it('expands DRIVE to DR so full-form and abbreviated addresses compare equal', () => {
    expect(normalizeStreetForMatch('8703 Como Lake Drive')).toBe('8703 COMO LAKE DR');
    expect(normalizeStreetForMatch('8703 Como Lake Dr')).toBe('8703 COMO LAKE DR');
  });

  it('expands STREET to ST', () => {
    expect(normalizeStreetForMatch('100 Main Street')).toBe('100 MAIN ST');
    expect(normalizeStreetForMatch('100 Main St')).toBe('100 MAIN ST');
  });

  it('expands BOULEVARD to BLVD', () => {
    expect(normalizeStreetForMatch('200 Sunset Boulevard')).toBe('200 SUNSET BLVD');
    expect(normalizeStreetForMatch('200 Sunset Blvd')).toBe('200 SUNSET BLVD');
  });

  it('expands AVENUE to AVE', () => {
    expect(normalizeStreetForMatch('5 Elm Avenue')).toBe('5 ELM AVE');
    expect(normalizeStreetForMatch('5 Elm Ave')).toBe('5 ELM AVE');
  });

  it('expands LANE to LN while leaving non-suffix words unchanged', () => {
    expect(normalizeStreetForMatch('123 Oak Tree Lane')).toBe('123 OAK TREE LN');
  });

  it('expands directional WEST to W', () => {
    expect(normalizeStreetForMatch('1949 Sevilla Boulevard West')).toBe('1949 SEVILLA BLVD W');
    expect(normalizeStreetForMatch('1949 Sevilla Blvd W')).toBe('1949 SEVILLA BLVD W');
  });

  it('expands all four cardinal directionals (N/S/E/W)', () => {
    expect(normalizeStreetForMatch('1 Main Street North')).toBe('1 MAIN ST N');
    expect(normalizeStreetForMatch('1 Main Street South')).toBe('1 MAIN ST S');
    expect(normalizeStreetForMatch('1 Main Street East')).toBe('1 MAIN ST E');
    expect(normalizeStreetForMatch('1 Main Street West')).toBe('1 MAIN ST W');
  });

  it('expands intercardinal directionals (NE/NW/SE/SW)', () => {
    expect(normalizeStreetForMatch('100 Northeast Road')).toBe('100 NE RD');
    expect(normalizeStreetForMatch('100 Southwest Avenue')).toBe('100 SW AVE');
  });
});

describe('PropertyRecordService.findByApn', () => {
  it('returns the matching record when APN exists', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByApn('123-456-789', 'tenant-a');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('prop-test-001');
  });

  it('returns null when APN does not exist', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByApn('999-999-999', 'tenant-a');

    expect(result).toBeNull();
  });

  it('returns null (not throws) when apn is empty', async () => {
    const cosmos = makeMockCosmosService([makeRecord()]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByApn('', 'tenant-a');

    expect(result).toBeNull();
    expect(cosmos.queryDocuments).not.toHaveBeenCalled();
  });

  it('throws when tenantId is empty', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(svc.findByApn('123-456', '')).rejects.toThrow('tenantId is required');
  });

  it('does not return records for a different tenant', async () => {
    const record = makeRecord({ tenantId: 'tenant-b' });
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByApn('123-456-789', 'tenant-a');

    expect(result).toBeNull();
  });
});

describe('PropertyRecordService.findByNormalizedAddress', () => {
  const baseRecord = makeRecord();

  it('returns a match when street + city + zip + state all match (case-insensitive input)', async () => {
    const cosmos = makeMockCosmosService([baseRecord]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByNormalizedAddress(
      { street: '123 main street', city: 'pasadena', state: 'CA', zip: '91103' },
      'tenant-a'
    );

    expect(result).not.toBeNull();
    expect(result!.id).toBe('prop-test-001');
  });

  it('returns null when no record matches the address', async () => {
    const cosmos = makeMockCosmosService([baseRecord]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByNormalizedAddress(
      { street: '999 UNKNOWN RD', city: 'PASADENA', state: 'CA', zip: '91103' },
      'tenant-a'
    );

    expect(result).toBeNull();
  });

  it('returns null when zip does not match', async () => {
    const cosmos = makeMockCosmosService([baseRecord]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.findByNormalizedAddress(
      { street: '123 MAIN STREET', city: 'PASADENA', state: 'CA', zip: '91104' },
      'tenant-a'
    );

    expect(result).toBeNull();
  });

  it('throws when tenantId is empty', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(
      svc.findByNormalizedAddress({ street: '1 A', city: 'B', state: 'CA', zip: '90210' }, '')
    ).rejects.toThrow('tenantId is required');
  });
});

describe('PropertyRecordService.resolveOrCreate', () => {
  it('resolves by APN when record exists (isNew = false)', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.resolveOrCreate({
      address: record.address,
      apn: '123-456-789',
      tenantId: 'tenant-a',
      createdBy: 'alice',
    });

    expect(result.isNew).toBe(false);
    expect(result.method).toBe('APN_MATCH');
    expect(result.propertyId).toBe('prop-test-001');
    expect(cosmos.createDocument).not.toHaveBeenCalled();
  });

  it('falls through to address lookup when APN not provided', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.resolveOrCreate({
      address: { street: '123 main street', city: 'pasadena', state: 'CA', zip: '91103' },
      tenantId: 'tenant-a',
      createdBy: 'alice',
    });

    expect(result.isNew).toBe(false);
    expect(result.method).toBe('ADDRESS_NORM');
    expect(result.propertyId).toBe('prop-test-001');
  });

  it('creates a new record when no match found and returns isNew = true', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    const result = await svc.resolveOrCreate({
      address: { street: '456 Oak Avenue', city: 'Arcadia', state: 'CA', zip: '91006' },
      apn: '500-600-700',
      tenantId: 'tenant-a',
      createdBy: 'alice',
    });

    expect(result.isNew).toBe(true);
    expect(result.propertyId).toBeTruthy();
    expect(result.propertyId).toMatch(/^prop-/);
    expect(cosmos.createDocument).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call with same APN returns the same propertyId', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    const input = {
      address: { street: '789 Elm Drive', city: 'Monrovia', state: 'CA', zip: '91016' },
      apn: '700-800-900',
      tenantId: 'tenant-a',
      createdBy: 'alice',
    };

    const first  = await svc.resolveOrCreate(input);
    const second = await svc.resolveOrCreate(input);

    expect(first.propertyId).toBe(second.propertyId);
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    // createDocument called exactly once
    expect(cosmos.createDocument).toHaveBeenCalledOnce();
  });

  it('throws when address fields are missing', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(
      svc.resolveOrCreate({
        address: { street: '', city: 'X', state: 'CA', zip: '90210' },
        tenantId: 'tenant-a',
        createdBy: 'alice',
      })
    ).rejects.toThrow('street, city, state, and zip are all required');
  });

  it('throws when tenantId is empty', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(
      svc.resolveOrCreate({
        address: { street: '1 A', city: 'B', state: 'CA', zip: '90210' },
        tenantId: '',
        createdBy: 'alice',
      })
    ).rejects.toThrow('tenantId is required');
  });
});

describe('PropertyRecordService.createVersion', () => {
  it('increments recordVersion and appends versionHistory', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const updated = await svc.createVersion(
      'prop-test-001',
      'tenant-a',
      { building: { gla: 2000, bedrooms: 4, bathrooms: 2, yearBuilt: 1965 } },
      'Added 200 sqft addition',
      'PERMIT_CLOSE',
      'alice'
    );

    expect(updated.recordVersion).toBe(2);
    expect(updated.versionHistory).toHaveLength(2);
    expect(updated.versionHistory[1]!.reason).toBe('Added 200 sqft addition');
    expect(updated.versionHistory[1]!.source).toBe('PERMIT_CLOSE');
    expect(updated.versionHistory[1]!.version).toBe(2);
  });

  it('merges building changes correctly', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const updated = await svc.createVersion(
      'prop-test-001',
      'tenant-a',
      { building: { gla: 2100, bedrooms: 4, bathrooms: 2, yearBuilt: 1965 } },
      'Rehab complete',
      'REHAB_COMPLETE',
      'bob'
    );

    expect(updated.building.gla).toBe(2100);
    // un-changed fields preserved
    expect(updated.building.yearBuilt).toBe(1965);
  });

  it('records previous values in versionHistory entry', async () => {    const record = makeRecord({ building: { gla: 1800, bedrooms: 3, bathrooms: 2, yearBuilt: 1965 } });
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const updated = await svc.createVersion(
      'prop-test-001',
      'tenant-a',
      { building: { gla: 2000, bedrooms: 4, bathrooms: 2, yearBuilt: 1965 } },
      'Addition complete',
      'PERMIT_CLOSE',
      'alice'
    );

    const lastEntry = updated.versionHistory[updated.versionHistory.length - 1]!;
    // Previous gla was 1800 — captured before the update
    expect(lastEntry.previousValues['building.gla']).toBe(1800);
  });

  it('persists optional sourceProvider on the version entry when supplied', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const updated = await svc.createVersion(
      'prop-test-001',
      'tenant-a',
      { building: { gla: 2000, bedrooms: 4, bathrooms: 2, yearBuilt: 1965 } },
      'Public-records refresh',
      'PUBLIC_RECORDS_API',
      'SYSTEM:property-enrichment',
      'ATTOM Data Solutions (Cosmos cache)',
    );

    const lastEntry = updated.versionHistory[updated.versionHistory.length - 1]!;
    expect(lastEntry.sourceProvider).toBe('ATTOM Data Solutions (Cosmos cache)');
  });

  it('omits sourceProvider when not supplied', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    const updated = await svc.createVersion(
      'prop-test-001',
      'tenant-a',
      { building: { gla: 2000, bedrooms: 4, bathrooms: 2, yearBuilt: 1965 } },
      'Manual permit close',
      'PERMIT_CLOSE',
      'alice',
    );

    const lastEntry = updated.versionHistory[updated.versionHistory.length - 1]!;
    expect(lastEntry.sourceProvider).toBeUndefined();
  });

  it('throws when the record does not exist', async () => {
    const cosmos = makeMockCosmosService([]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(
      svc.createVersion(
        'no-such-id',
        'tenant-a',
        {},
        'reason',
        'MANUAL_CORRECTION',
        'alice'
      )
    ).rejects.toThrow('not found');
  });

  it('throws when reason is empty', async () => {
    const record = makeRecord();
    const cosmos = makeMockCosmosService([record]);
    const svc = new PropertyRecordService(cosmos as any);

    await expect(
      svc.createVersion('prop-test-001', 'tenant-a', {}, '', 'MANUAL_CORRECTION', 'alice')
    ).rejects.toThrow('reason is required');
  });
});
