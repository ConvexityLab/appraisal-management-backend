import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockListDefinitions,
  mockGetDefinition,
  mockCreateDefinition,
  mockUpdateDefinition,
  mockDeleteDefinition,
} = vi.hoisted(() => ({
  mockListDefinitions: vi.fn(),
  mockGetDefinition: vi.fn(),
  mockCreateDefinition: vi.fn(),
  mockUpdateDefinition: vi.fn(),
  mockDeleteDefinition: vi.fn(),
}));

vi.mock('../../src/services/bulk-adapter-definition.service.js', () => ({
  BulkAdapterDefinitionService: vi.fn().mockImplementation(() => ({
    listDefinitions: mockListDefinitions,
    getDefinition: mockGetDefinition,
    createDefinition: mockCreateDefinition,
    updateDefinition: mockUpdateDefinition,
    deleteDefinition: mockDeleteDefinition,
  })),
}));

import { createBulkAdapterDefinitionsRouter } from '../../src/controllers/bulk-adapter-definitions.controller.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bulk-adapter-definitions', createBulkAdapterDefinitionsRouter({} as any));
  return app;
}

describe('BulkAdapterDefinitionsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists built-in and tenant definitions for the resolved tenant', async () => {
    mockListDefinitions.mockResolvedValue([
      { adapterKey: 'tenant-custom', isBuiltIn: false },
      { adapterKey: 'bridge-standard', isBuiltIn: true },
    ]);
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-adapter-definitions')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(mockListDefinitions).toHaveBeenCalledWith('tenant-123', { includeBuiltIns: true });
  });

  it('creates a tenant-scoped adapter definition', async () => {
    mockCreateDefinition.mockResolvedValue({
      adapterKey: 'custom-adapter-v1',
      tenantId: 'tenant-123',
      name: 'Custom Adapter',
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-adapter-definitions')
      .set('x-tenant-id', 'tenant-123')
      .send({
        adapterKey: 'custom-adapter-v1',
        name: 'Custom Adapter',
        matchMode: 'EXACT',
        sourceAdapter: 'custom-adapter-v1',
        canonicalFieldMappings: [
          { targetField: 'correlationKey', source: 'item.correlationKey' },
        ],
      });

    expect(res.status).toBe(201);
    expect(mockCreateDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-123',
        adapterKey: 'custom-adapter-v1',
      }),
    );
  });

  it('updates an existing tenant definition', async () => {
    mockUpdateDefinition.mockResolvedValue({ adapterKey: 'custom-adapter-v1', name: 'Updated' });
    const app = buildApp();

    const res = await request(app)
      .put('/api/bulk-adapter-definitions/custom-adapter-v1')
      .set('x-tenant-id', 'tenant-123')
      .send({
        name: 'Updated',
        matchMode: 'EXACT',
        sourceAdapter: 'custom-adapter-v1',
        canonicalFieldMappings: [
          { targetField: 'correlationKey', source: 'item.correlationKey' },
        ],
      });

    expect(res.status).toBe(200);
    expect(mockUpdateDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-123',
        adapterKey: 'custom-adapter-v1',
        name: 'Updated',
      }),
    );
  });

  it('deletes a tenant definition', async () => {
    mockDeleteDefinition.mockResolvedValue(true);
    const app = buildApp();

    const res = await request(app)
      .delete('/api/bulk-adapter-definitions/custom-adapter-v1')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(mockDeleteDefinition).toHaveBeenCalledWith('tenant-123', 'custom-adapter-v1');
  });
});