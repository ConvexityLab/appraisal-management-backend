import { describe, expect, it, vi } from 'vitest';
import {
  buildObservationFingerprint,
  PropertyObservationService,
  PROPERTY_OBSERVATIONS_CONTAINER,
} from '../src/services/property-observation.service';
import type { PropertyObservationRecord } from '../src/types/property-observation.types';

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'prop-1';

function makeObservation(
  overrides: Partial<PropertyObservationRecord> = {},
): PropertyObservationRecord {
  return {
    id: 'propobs-1',
    type: 'property-observation',
    tenantId: TENANT_ID,
    propertyId: PROPERTY_ID,
    observationType: 'provider-enrichment',
    sourceSystem: 'property-enrichment-service',
    sourceFingerprint: 'abc123',
    observedAt: '2026-05-10T00:00:00.000Z',
    ingestedAt: '2026-05-10T00:01:00.000Z',
    normalizedFacts: {
      buildingPatch: {
        gla: 2500,
      },
    },
    rawPayload: {
      source: 'bridge',
    },
    createdBy: 'SYSTEM',
    ...overrides,
  };
}

function makeCosmosService(initialRows: PropertyObservationRecord[] = []) {
  const store = new Map<string, PropertyObservationRecord>();
  for (const row of initialRows) {
    store.set(row.id, row);
  }

  return {
    getDocument: vi.fn().mockImplementation(async (_container: string, id: string) => store.get(id) ?? null),
    createDocument: vi.fn().mockImplementation(async (_container: string, row: PropertyObservationRecord) => {
      store.set(row.id, row);
      return row;
    }),
    queryDocuments: vi.fn().mockImplementation(
      async (_container: string, _query: string, params: { name: string; value: unknown }[]) => {
        const paramMap = Object.fromEntries(params.map((p) => [p.name, p.value]));
        let rows = [...store.values()].filter(
          (row) => row.tenantId === paramMap['@tenantId'] && row.propertyId === paramMap['@propertyId'],
        );
        if (paramMap['@observationType']) {
          rows = rows.filter((row) => row.observationType === paramMap['@observationType']);
        }
        rows.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        return rows;
      },
    ),
  };
}

describe('buildObservationFingerprint', () => {
  it('is stable for semantically identical payloads with different key order', () => {
    const a = buildObservationFingerprint({
      propertyId: PROPERTY_ID,
      observationType: 'provider-enrichment',
      sourceSystem: 'property-enrichment-service',
      observedAt: '2026-05-10T00:00:00.000Z',
      rawPayload: { b: 2, a: 1 },
      normalizedFacts: { propertyPatch: { z: 9, y: 8 } },
    });
    const b = buildObservationFingerprint({
      propertyId: PROPERTY_ID,
      observationType: 'provider-enrichment',
      sourceSystem: 'property-enrichment-service',
      observedAt: '2026-05-10T00:00:00.000Z',
      rawPayload: { a: 1, b: 2 },
      normalizedFacts: { propertyPatch: { y: 8, z: 9 } },
    });

    expect(a).toBe(b);
  });
});

describe('PropertyObservationService.createObservation', () => {
  it('creates an immutable property observation', async () => {
    const cosmos = makeCosmosService();
    const svc = new PropertyObservationService(cosmos as any);

    const created = await svc.createObservation({
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      observationType: 'provider-enrichment',
      sourceSystem: 'property-enrichment-service',
      observedAt: '2026-05-10T00:00:00.000Z',
      sourceProvider: 'Bridge Interactive',
      normalizedFacts: {
        buildingPatch: { bedrooms: 4 },
      },
      rawPayload: { provider: 'bridge' },
    });

    expect(created.id).toMatch(/^propobs-/);
    expect(created.type).toBe('property-observation');
    expect(created.sourceProvider).toBe('Bridge Interactive');
    expect(cosmos.createDocument).toHaveBeenCalledOnce();
    expect(cosmos.createDocument).toHaveBeenCalledWith(
      PROPERTY_OBSERVATIONS_CONTAINER,
      expect.objectContaining({
        propertyId: PROPERTY_ID,
        tenantId: TENANT_ID,
        observationType: 'provider-enrichment',
      }),
    );
  });

  it('returns the existing row when the observation fingerprint already exists', async () => {
    const existing = makeObservation({
      id: `propobs-${buildObservationFingerprint({
        propertyId: PROPERTY_ID,
        observationType: 'provider-enrichment',
        sourceSystem: 'property-enrichment-service',
        observedAt: '2026-05-10T00:00:00.000Z',
        normalizedFacts: { buildingPatch: { bedrooms: 4 } },
        rawPayload: { provider: 'bridge' },
      })}`,
      sourceFingerprint: buildObservationFingerprint({
        propertyId: PROPERTY_ID,
        observationType: 'provider-enrichment',
        sourceSystem: 'property-enrichment-service',
        observedAt: '2026-05-10T00:00:00.000Z',
        normalizedFacts: { buildingPatch: { bedrooms: 4 } },
        rawPayload: { provider: 'bridge' },
      }),
      normalizedFacts: { buildingPatch: { bedrooms: 4 } },
      rawPayload: { provider: 'bridge' },
    });
    const cosmos = makeCosmosService([existing]);
    const svc = new PropertyObservationService(cosmos as any);

    const result = await svc.createObservation({
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      observationType: 'provider-enrichment',
      sourceSystem: 'property-enrichment-service',
      observedAt: '2026-05-10T00:00:00.000Z',
      normalizedFacts: { buildingPatch: { bedrooms: 4 } },
      rawPayload: { provider: 'bridge' },
    });

    expect(result).toEqual(existing);
    expect(cosmos.createDocument).not.toHaveBeenCalled();
  });

  it('throws when required fields are missing', async () => {
    const cosmos = makeCosmosService();
    const svc = new PropertyObservationService(cosmos as any);

    await expect(
      svc.createObservation({
        tenantId: '',
        propertyId: PROPERTY_ID,
        observationType: 'provider-enrichment',
        sourceSystem: 'property-enrichment-service',
        observedAt: '2026-05-10T00:00:00.000Z',
      }),
    ).rejects.toThrow('tenantId is required');
  });
});

describe('PropertyObservationService query helpers', () => {
  it('lists observations newest-first for a property', async () => {
    const older = makeObservation({ id: 'propobs-old', observedAt: '2026-05-09T00:00:00.000Z' });
    const newer = makeObservation({ id: 'propobs-new', observedAt: '2026-05-10T00:00:00.000Z' });
    const cosmos = makeCosmosService([older, newer]);
    const svc = new PropertyObservationService(cosmos as any);

    const rows = await svc.listByPropertyId(PROPERTY_ID, TENANT_ID);

    expect(rows.map((row) => row.id)).toEqual(['propobs-new', 'propobs-old']);
    expect(cosmos.queryDocuments).toHaveBeenCalledOnce();
  });

  it('returns the latest observation by type', async () => {
    const older = makeObservation({ id: 'propobs-old', observedAt: '2026-05-09T00:00:00.000Z' });
    const newer = makeObservation({ id: 'propobs-new', observedAt: '2026-05-10T00:00:00.000Z' });
    const cosmos = makeCosmosService([older, newer]);
    const svc = new PropertyObservationService(cosmos as any);

    const row = await svc.getLatestByType(PROPERTY_ID, TENANT_ID, 'provider-enrichment');

    expect(row?.id).toBe('propobs-new');
  });
});
