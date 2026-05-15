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
      queryDocuments: vi.fn().mockImplementation(async (container: string) => {
        if (container === 'property-records') {
          return [property];
        }

        if (container === 'property-observations') {
          return [
            {
              id: 'obs-avm',
              type: 'property-observation',
              tenantId: 'tenant-1',
              propertyId: 'prop-1',
              observationType: 'avm-update',
              sourceSystem: 'bridge-interactive',
              sourceFingerprint: 'fp-avm',
              observedAt: '2026-05-10T00:00:00.000Z',
              ingestedAt: '2026-05-10T00:00:01.000Z',
              normalizedFacts: {
                avm: {
                  value: 412000,
                  fetchedAt: '2026-05-10T00:00:00.000Z',
                  source: 'bridge-zestimate',
                },
              },
              createdBy: 'SYSTEM',
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

    const listRes = await request(app).get('/api/properties/summary');
    const detailRes = await request(app).get('/api/properties/summary/prop-1');

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.properties).toEqual([
      expect.objectContaining({
        id: 'prop-1',
        propertyType: 'single_family_residential',
        building: expect.objectContaining({ livingAreaSquareFeet: 1234 }),
        valuation: expect.objectContaining({ estimatedValue: 412000 }),
      }),
    ]);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toEqual(
      expect.objectContaining({
        id: 'prop-1',
        propertyType: 'single_family_residential',
        building: expect.objectContaining({ livingAreaSquareFeet: 1234 }),
        valuation: expect.objectContaining({ estimatedValue: 412000 }),
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
      taxAssessments: [],
      permits: [],
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
            {
              id: 'obs-2',
              type: 'property-observation',
              tenantId: 'tenant-1',
              propertyId: 'prop-1',
              observationType: 'provider-enrichment',
              sourceSystem: 'property-enrichment-service',
              sourceFingerprint: 'fp-2',
              observedAt: '2026-05-11T00:00:00.000Z',
              ingestedAt: '2026-05-11T00:00:01.000Z',
              normalizedFacts: {
                taxAssessment: {
                  taxYear: 2025,
                  totalAssessedValue: 410000,
                  annualTaxAmount: 9200,
                },
              },
              createdBy: 'user-1',
            },
            {
              id: 'obs-3',
              type: 'property-observation',
              tenantId: 'tenant-1',
              propertyId: 'prop-1',
              observationType: 'permit-update',
              sourceSystem: 'manual-user',
              sourceFingerprint: 'fp-3',
              observedAt: '2026-05-12T00:00:00.000Z',
              ingestedAt: '2026-05-12T00:00:01.000Z',
              normalizedFacts: {
                permit: {
                  permitNumber: 'P-1',
                  type: 'REMODEL',
                  description: 'Kitchen',
                  issuedDate: '2026-05-01',
                  valuationAmount: 15000,
                  isMaterialChange: true,
                },
              },
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
        observationRefs: expect.arrayContaining([expect.objectContaining({ id: 'obs-1' })]),
      }),
    );
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toEqual(
      expect.objectContaining({
        id: 'prop-1',
        legal: expect.objectContaining({ legalDescription: 'LOT 1' }),
        assessment: expect.objectContaining({ totalAssessedValue: 410000, assessmentYear: 2025 }),
        taxAssessments: [expect.objectContaining({ taxYear: 2025, totalAssessedValue: 410000 })],
        permit: expect.objectContaining({ permitCount: 1, totalJobValue: 15000 }),
        permits: [expect.objectContaining({ permitNumber: 'P-1', description: 'Kitchen' })],
        observationRefs: expect.arrayContaining([expect.objectContaining({ id: 'obs-1' })]),
      }),
    );
  });

  it('returns canonical property detail with observation-derived permit and tax history', async () => {
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
      queryDocuments: vi.fn().mockResolvedValue([
        {
          id: 'obs-tax',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'tax-assessment-update',
          sourceSystem: 'manual-user',
          sourceFingerprint: 'fp-tax',
          observedAt: '2026-05-10T00:00:00.000Z',
          ingestedAt: '2026-05-10T00:00:01.000Z',
          normalizedFacts: {
            taxAssessment: { taxYear: 2025, totalAssessedValue: 425000, annualTaxAmount: 9100 },
          },
          createdBy: 'user-1',
        },
        {
          id: 'obs-permit',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'permit-update',
          sourceSystem: 'manual-user',
          sourceFingerprint: 'fp-permit',
          observedAt: '2026-05-11T00:00:00.000Z',
          ingestedAt: '2026-05-11T00:00:01.000Z',
          normalizedFacts: {
            permit: {
              permitNumber: 'PMT-9',
              type: 'SOLAR',
              description: 'Solar install',
              issuedDate: '2026-05-09',
              valuationAmount: 22000,
              isMaterialChange: false,
            },
          },
          createdBy: 'user-1',
        },
        {
          id: 'obs-avm',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'avm-update',
          sourceSystem: 'bridge-interactive',
          sourceFingerprint: 'fp-avm',
          observedAt: '2026-05-12T00:00:00.000Z',
          ingestedAt: '2026-05-12T00:00:01.000Z',
          normalizedFacts: {
            avm: {
              value: 440000,
              fetchedAt: '2026-05-12T00:00:00.000Z',
              source: 'bridge-zestimate',
            },
          },
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
    expect(res.body.taxAssessments).toEqual([
      expect.objectContaining({ taxYear: 2025, totalAssessedValue: 425000 }),
    ]);
    expect(res.body.permits).toEqual([
      expect.objectContaining({ permitNumber: 'PMT-9', type: 'SOLAR' }),
    ]);
    expect(res.body.avm).toEqual(
      expect.objectContaining({ value: 440000, source: 'bridge-zestimate' }),
    );
  });

  it('lists canonical property records with observation-derived avm values', async () => {
    const property = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
      propertyType: 'single_family_residential',
      building: { gla: 1200, yearBuilt: 1990, bedrooms: 3, bathrooms: 2 },
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
      queryDocuments: vi.fn().mockImplementation(async (container: string) => {
        if (container === 'property-records') {
          return [property];
        }

        if (container === 'property-observations') {
          return [
            {
              id: 'obs-avm-list',
              type: 'property-observation',
              tenantId: 'tenant-1',
              propertyId: 'prop-1',
              observationType: 'avm-update',
              sourceSystem: 'bridge-interactive',
              sourceFingerprint: 'fp-avm-list',
              observedAt: '2026-05-13T00:00:00.000Z',
              ingestedAt: '2026-05-13T00:00:01.000Z',
              normalizedFacts: {
                avm: {
                  value: 460000,
                  fetchedAt: '2026-05-13T00:00:00.000Z',
                  source: 'bridge-zestimate',
                },
              },
              createdBy: 'SYSTEM',
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
      getById: vi.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'user-1', tenantId: 'tenant-1' };
      next();
    });
    app.use('/api/v1/property-records', createPropertyRecordRouter(propertyRecordService as any));

    const res = await request(app).get('/api/v1/property-records');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'prop-1',
        avm: expect.objectContaining({ value: 460000, source: 'bridge-zestimate' }),
      }),
    ]);
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

  it('replays currentCanonical for a single property', async () => {
    const replayCurrentCanonicalFromObservations = vi.fn().mockResolvedValue(undefined);
    const propertyRecordService = {
      cosmosService: { queryDocuments: vi.fn() },
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
    app.use(
      '/api/v1/property-records',
      createPropertyRecordRouter(propertyRecordService as any, {
        projectorService: { replayCurrentCanonicalFromObservations },
      }),
    );

    const res = await request(app).post('/api/v1/property-records/prop-1/replay-current-canonical');

    expect(res.status).toBe(200);
    expect(replayCurrentCanonicalFromObservations).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      initiatedBy: 'user-1',
    });
  });

  it('replays currentCanonical for many explicit property ids', async () => {
    const replayCurrentCanonicalFromObservations = vi.fn().mockResolvedValue(undefined);
    const propertyRecordService = {
      cosmosService: { queryDocuments: vi.fn() },
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
    app.use(
      '/api/v1/property-records',
      createPropertyRecordRouter(propertyRecordService as any, {
        projectorService: { replayCurrentCanonicalFromObservations },
      }),
    );

    const res = await request(app)
      .post('/api/v1/property-records/replay-current-canonical')
      .send({ propertyIds: ['prop-1', ' prop-2 ', 'prop-1'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        propertyIds: ['prop-1', 'prop-2'],
        replayedCount: 2,
        requestedBy: 'user-1',
      }),
    );
    expect(replayCurrentCanonicalFromObservations).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      initiatedBy: 'user-1',
    });
    expect(replayCurrentCanonicalFromObservations).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-1',
      propertyId: 'prop-2',
      initiatedBy: 'user-1',
    });
  });

  it('rejects bulk replay without explicit targets or all=true', async () => {
    const replayCurrentCanonicalFromObservations = vi.fn().mockResolvedValue(undefined);
    const propertyRecordService = {
      cosmosService: { queryDocuments: vi.fn() },
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
    app.use(
      '/api/v1/property-records',
      createPropertyRecordRouter(propertyRecordService as any, {
        projectorService: { replayCurrentCanonicalFromObservations },
      }),
    );

    const res = await request(app)
      .post('/api/v1/property-records/replay-current-canonical')
      .send({ city: 'Dallas' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'propertyIds or all=true is required for replay requests',
    });
    expect(replayCurrentCanonicalFromObservations).not.toHaveBeenCalled();
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

  it('moves manual permit, tax, and avm updates into immutable observations', async () => {
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
      getById: vi.fn().mockResolvedValue(property),
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
      .send({
        zoning: 'R1',
        avm: { value: 455000, fetchedAt: '2026-05-10T00:00:00.000Z', source: 'bridge-zestimate' },
        taxAssessments: [{ taxYear: 2026, totalAssessedValue: 430000, annualTaxAmount: 9300 }],
        permits: [{ permitNumber: 'P-99', type: 'REMODEL', description: 'Bath remodel', isMaterialChange: true }],
      });

    expect(res.status).toBe(200);
    expect(propertyRecordService.createVersion).toHaveBeenCalledWith(
      'prop-1',
      'tenant-1',
      { zoning: 'R1' },
      'manual_update',
      'MANUAL_CORRECTION',
      'user-1',
      'api',
    );
    expect(cosmosService.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        observationType: 'avm-update',
        normalizedFacts: expect.objectContaining({
          avm: expect.objectContaining({ value: 455000, source: 'bridge-zestimate' }),
        }),
      }),
    );
    expect(cosmosService.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        observationType: 'tax-assessment-update',
        normalizedFacts: expect.objectContaining({
          taxAssessment: expect.objectContaining({ taxYear: 2026, totalAssessedValue: 430000 }),
        }),
      }),
    );
    expect(cosmosService.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        observationType: 'permit-update',
        normalizedFacts: expect.objectContaining({
          permit: expect.objectContaining({ permitNumber: 'P-99', description: 'Bath remodel' }),
        }),
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
