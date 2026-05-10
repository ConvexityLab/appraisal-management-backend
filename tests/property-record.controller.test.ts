import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPropertyRecordRouter } from '../src/controllers/property-record.controller.js';

describe('property-record controller', () => {
  it('serves legacy summary endpoints from canonical PropertyRecord data', async () => {
    const property = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
      propertyType: 'single_family_residential',
      building: { gla: 1234, yearBuilt: 1999, bedrooms: 3, bathrooms: 2, stories: 1, garageSpaces: 2 },
      taxAssessments: [],
      permits: [],
      recordVersion: 2,
      versionHistory: [],
      dataSource: 'MANUAL_ENTRY',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      createdBy: 'SYSTEM',
    };
    const cosmosService = {
      getDocument: vi.fn().mockResolvedValue(null),
      createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
      queryDocuments: vi.fn().mockResolvedValue([property]),
    };
    const propertyRecordService = {
      cosmosService,
      createVersion: vi.fn(),
      getVersionHistory: vi.fn(),
      getById: vi.fn().mockResolvedValue(property),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/properties', createPropertyRecordRouter(propertyRecordService as any));

    const listRes = await request(app).get('/api/properties/summary');
    const detailRes = await request(app).get('/api/properties/summary/prop-1');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.properties).toEqual([
      expect.objectContaining({
        id: 'prop-1',
        propertyType: 'single_family_residential',
        building: expect.objectContaining({ livingAreaSquareFeet: 1234 }),
      }),
    ]);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toEqual(
      expect.objectContaining({
        id: 'prop-1',
        propertyType: 'single_family_residential',
        building: expect.objectContaining({ livingAreaSquareFeet: 1234 }),
      }),
    );
  });

  it('serves legacy detailed endpoints from canonical PropertyRecord plus observations', async () => {
    const property = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
      propertyType: 'single_family_residential',
      building: { gla: 1234, yearBuilt: 1999, bedrooms: 3, bathrooms: 2 },
      taxAssessments: [{ taxYear: 2025, totalAssessedValue: 400000 }],
      permits: [{ permitNumber: 'P-1', type: 'REMODEL', description: 'Kitchen', isMaterialChange: true }],
      recordVersion: 2,
      versionHistory: [],
      dataSource: 'MANUAL_ENTRY',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      createdBy: 'SYSTEM',
      apn: '123',
      fipsCode: '06037',
      legalDescription: 'LOT 1',
      subdivision: 'TRACT 1',
      lotSizeSqFt: 5000,
      currentCanonical: { lastSnapshotId: 'snap-1', lastSnapshotAt: '2026-05-10T00:00:00.000Z' },
    };
    const cosmosService = {
      getDocument: vi.fn().mockResolvedValue(null),
      createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
      queryDocuments: vi.fn().mockImplementation(async (container: string) => {
        if (container === 'property-records') {
          return [property];
        }

        if (container === 'property-observations') {
          return [
            {
              id: 'obs-1',
              type: 'property-observation',
              tenantId: 'tenant-1',
              propertyId: 'prop-1',
              observationType: 'document-extraction',
              sourceSystem: 'document-extraction',
              sourceFingerprint: 'fp-1',
              observedAt: '2026-05-10T00:00:00.000Z',
              ingestedAt: '2026-05-10T00:00:01.000Z',
              createdBy: 'user-1',
            },
          ];
        }

        return [];
      }),
    };
    const propertyRecordService = {
      cosmosService,
      createVersion: vi.fn(),
      getVersionHistory: vi.fn(),
      getById: vi.fn().mockResolvedValue(property),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/properties', createPropertyRecordRouter(propertyRecordService as any));

    const listRes = await request(app).get('/api/properties/detailed');
    const detailRes = await request(app).get('/api/properties/detailed/prop-1');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.properties[0]).toEqual(
      expect.objectContaining({
        id: 'prop-1',
        ids: expect.objectContaining({ apn: '123', fipsCode: '06037' }),
        observationRefs: [expect.objectContaining({ id: 'obs-1' })],
      }),
    );
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toEqual(
      expect.objectContaining({
        id: 'prop-1',
        legal: expect.objectContaining({ legalDescription: 'LOT 1' }),
        permit: expect.objectContaining({ permitCount: 1 }),
        observationRefs: [expect.objectContaining({ id: 'obs-1' })],
      }),
    );
  });

  it('returns canonical property detail with provenance summary and observation refs', async () => {
    const property = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
      propertyType: 'single_family_residential',
      building: { gla: 1, yearBuilt: 1, bedrooms: 1, bathrooms: 1 },
      taxAssessments: [],
      permits: [],
      recordVersion: 2,
      versionHistory: [
        {
          version: 2,
          createdAt: '2026-05-10T00:00:00.000Z',
          createdBy: 'user-1',
          reason: 'Canonical snapshot snap-1 updated currentCanonical',
          source: 'CANONICAL_SNAPSHOT',
          sourceProvider: 'canonical-snapshot-service',
          changedFields: ['currentCanonical'],
          previousValues: {},
        },
      ],
      dataSource: 'MANUAL_ENTRY',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      currentCanonical: {
        lastSnapshotId: 'snap-1',
        lastSnapshotAt: '2026-05-10T00:00:00.000Z',
      },
    };
    const cosmosService = {
      getDocument: vi.fn().mockResolvedValue(null),
      createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
      queryDocuments: vi.fn().mockResolvedValue([
        {
          id: 'obs-1',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'canonical-projection',
          sourceSystem: 'canonical-snapshot-service',
          sourceFingerprint: 'fp-1',
          observedAt: '2026-05-10T00:00:00.000Z',
          ingestedAt: '2026-05-10T00:00:01.000Z',
          snapshotId: 'snap-1',
          createdBy: 'user-1',
        },
      ]),
    };
    const propertyRecordService = {
      cosmosService,
      createVersion: vi.fn().mockResolvedValue(property),
      getVersionHistory: vi.fn(),
      getById: vi.fn().mockResolvedValue(property),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/v1/property-records', createPropertyRecordRouter(propertyRecordService as any));

    const res = await request(app).get('/api/v1/property-records/prop-1');

    expect(res.status).toBe(200);
    expect(res.body.provenanceSummary).toEqual(
      expect.objectContaining({
        recordVersion: 2,
        latestSnapshotId: 'snap-1',
        latestVersionReason: 'Canonical snapshot snap-1 updated currentCanonical',
      }),
    );
    expect(res.body.observationRefs).toEqual([
      expect.objectContaining({
        id: 'obs-1',
        observationType: 'canonical-projection',
        snapshotId: 'snap-1',
      }),
    ]);
  });

  it('lists property observations via the dedicated observations route', async () => {
    const cosmosService = {
      getDocument: vi.fn().mockResolvedValue(null),
      createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
      queryDocuments: vi.fn().mockResolvedValue([
        {
          id: 'obs-1',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'manual-correction',
          sourceSystem: 'manual-user',
          sourceFingerprint: 'fp-1',
          observedAt: '2026-05-10T00:00:00.000Z',
          ingestedAt: '2026-05-10T00:00:01.000Z',
          createdBy: 'user-1',
        },
      ]),
    };
    const propertyRecordService = {
      cosmosService,
      createVersion: vi.fn(),
      getVersionHistory: vi.fn(),
      getById: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/v1/property-records', createPropertyRecordRouter(propertyRecordService as any));

    const res = await request(app).get('/api/v1/property-records/prop-1/observations');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'obs-1',
        observationType: 'manual-correction',
        sourceSystem: 'manual-user',
      }),
    ]);
  });

  it('emits a manual-correction observation after a patch', async () => {
    const property = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
      propertyType: 'single_family_residential',
      building: { gla: 1, yearBuilt: 1, bedrooms: 1, bathrooms: 1 },
      taxAssessments: [],
      permits: [],
      recordVersion: 2,
      versionHistory: [],
      dataSource: 'MANUAL_ENTRY',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
    };
    const cosmosService = {
      getDocument: vi.fn().mockResolvedValue(null),
      createDocument: vi.fn().mockImplementation(async (_container: string, doc: any) => doc),
    };
    const propertyRecordService = {
      cosmosService,
      createVersion: vi.fn().mockResolvedValue(property),
      getVersionHistory: vi.fn(),
      getById: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/v1/property-records', createPropertyRecordRouter(propertyRecordService as any));

    const res = await request(app)
      .patch('/api/v1/property-records/prop-1')
      .send({ zoning: 'R1' });

    expect(res.status).toBe(200);
    expect(cosmosService.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        type: 'property-observation',
        propertyId: 'prop-1',
        tenantId: 'tenant-1',
        observationType: 'manual-correction',
        sourceSystem: 'manual-user',
        sourceRecordId: 'prop-1',
      }),
    );
  });

  it('rejects list requests without tenant context instead of silently defaulting', async () => {
    const propertyRecordService = {
      cosmosService: { queryDocuments: vi.fn() },
    };

    const app = express();
    app.use(express.json());
    app.use('/api/v1/property-records', createPropertyRecordRouter(propertyRecordService as any));

    const res = await request(app).get('/api/v1/property-records');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'tenantId is required' });
  });
});
