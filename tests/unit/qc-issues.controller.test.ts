import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createQCIssuesOrderScopedRouter } from '../../src/controllers/qc-issues.controller.js';

function buildApp(options?: {
  tenantId?: string;
  fetchAllImpl?: () => Promise<{ resources: unknown[] }>;
}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      tenantId: options?.tenantId,
    };
    next();
  });

  const fetchAll = vi.fn().mockImplementation(async () => {
    if (options?.fetchAllImpl) {
      return options.fetchAllImpl();
    }
    return { resources: [] };
  });

  const dbService = {
    getContainer: vi.fn().mockReturnValue({
      items: {
        query: vi.fn().mockReturnValue({ fetchAll }),
      },
    }),
  };

  app.use('/api/orders', createQCIssuesOrderScopedRouter(dbService as any));

  return { app, dbService };
}

describe('QCIssuesController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects retrieval when tenant identity is missing', async () => {
    const { app } = buildApp({ tenantId: undefined });

    const response = await request(app).get('/api/orders/order-1/qc-issues');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'TENANT_ID_REQUIRED',
        message: 'Authenticated tenantId is required to retrieve QC issues.',
      },
    });
  });

  it('surfaces container failures instead of returning an empty success payload', async () => {
    const { app } = buildApp({
      tenantId: 'tenant-1',
      fetchAllImpl: async () => {
        throw new Error('container offline');
      },
    });

    const response = await request(app).get('/api/orders/order-1/qc-issues');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'QC_ISSUES_LIST_FAILED',
        message: "Failed to retrieve QC issues for order 'order-1': container offline",
      },
    });
  });
});