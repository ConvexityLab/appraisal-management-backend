import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchAllMock,
  initializeMock,
  loadByVendorOrderIdMock,
  getPropertyAddressMock,
} = vi.hoisted(() => {
  process.env.AZURE_COSMOS_ENDPOINT = 'https://example.documents.azure.com:443/';

  return {
    fetchAllMock: vi.fn(),
    initializeMock: vi.fn().mockResolvedValue(undefined),
    loadByVendorOrderIdMock: vi.fn(),
    getPropertyAddressMock: vi.fn(),
  };
});

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(),
}));

vi.mock('@azure/cosmos', () => ({
  CosmosClient: vi.fn().mockImplementation(() => ({
    database: vi.fn().mockReturnValue({
      container: vi.fn().mockReturnValue({
        items: {
          query: vi.fn().mockReturnValue({
            fetchAll: fetchAllMock,
          }),
        },
      }),
    }),
  })),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    initialize: initializeMock,
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrderId: loadByVendorOrderIdMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { qcResultsRouter } from '../../src/controllers/qc-results.controller.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/qc/results', qcResultsRouter);
  return app;
}

describe('QC results property address resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMock.mockResolvedValue(undefined);
    loadByVendorOrderIdMock.mockResolvedValue({
      vendorOrder: { id: 'order-1' },
      clientOrder: null,
      property: {},
    });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    });
  });

  it('returns canonical property text for the merged order results endpoint', async () => {
    fetchAllMock.mockResolvedValue({
      resources: [{
        id: 'qc-1',
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        checklistId: 'checklist-1',
        checklistName: 'Checklist',
        checklistVersion: '1',
        propertyAddress: 'Legacy QC Address',
        categoriesResults: [],
        criticalIssues: [],
      }],
    });

    const res = await request(buildApp()).get('/api/qc/results/order/order-1');

    expect(res.status).toBe(200);
    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(loadByVendorOrderIdMock).toHaveBeenCalledWith('order-1', { includeProperty: true });
    expect(res.body.data).toEqual(expect.objectContaining({
      orderId: 'order-1',
      propertyAddress: '123 Canonical Main St, Austin, TX, 78701',
    }));
  });

  it('falls back to the stored QC address for the legacy endpoint when canonical loading fails', async () => {
    fetchAllMock.mockResolvedValue({
      resources: [{
        id: 'qc-1',
        orderId: 'order-1',
        orderNumber: 'ORD-001',
        checklistId: 'checklist-1',
        checklistName: 'Checklist',
        checklistVersion: '1',
        propertyAddress: 'Legacy QC Address',
        categoriesResults: [],
        criticalIssues: [],
      }],
    });
    loadByVendorOrderIdMock.mockRejectedValueOnce(new Error('missing canonical context'));

    const res = await request(buildApp()).get('/api/qc/results/order-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      orderId: 'order-1',
      propertyAddress: 'Legacy QC Address',
    }));
  });
});