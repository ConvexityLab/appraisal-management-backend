import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPropertyRecordRouter } from '../src/controllers/property-record.controller.js';

describe('property-record controller', () => {
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
});
