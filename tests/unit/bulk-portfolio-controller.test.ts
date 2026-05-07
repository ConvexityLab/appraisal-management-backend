import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockSubmit } = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
}));

vi.mock('../../src/services/bulk-portfolio.service.js', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({
    submit: mockSubmit,
  })),
}));

import { createBulkPortfolioRouter } from '../../src/controllers/bulk-portfolio.controller.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bulk-portfolios', createBulkPortfolioRouter({} as any));
  return app;
}

describe('BulkPortfolioController submit validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when PER_LOAN granularity is combined with an existing engagementId', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-portfolios/submit')
      .set('x-tenant-id', 'tenant-123')
      .send({
        clientId: 'client-1',
        fileName: 'bulk.csv',
        engagementId: 'eng-001',
        engagementGranularity: 'PER_LOAN',
        items: [
          {
            rowIndex: 1,
            analysisType: 'AVM',
            propertyAddress: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
            borrowerFirstName: 'Jane',
            borrowerLastName: 'Smith',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.errors)).toContain('PER_LOAN');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('forwards engagementGranularity on ORDER_CREATION submit', async () => {
    mockSubmit.mockResolvedValue({
      id: 'job-1',
      successCount: 1,
      failCount: 0,
      skippedCount: 0,
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-portfolios/submit')
      .set('x-tenant-id', 'tenant-123')
      .send({
        clientId: 'client-1',
        fileName: 'bulk.csv',
        engagementGranularity: 'PER_BATCH',
        items: [
          {
            rowIndex: 1,
            analysisType: 'AVM',
            propertyAddress: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
            borrowerFirstName: 'Jane',
            borrowerLastName: 'Smith',
          },
        ],
      });

    expect(res.status).toBe(201);
    // Auth refactor added a 4th arg (submitterEmail) to submit().
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        engagementGranularity: 'PER_BATCH',
      }),
      'unknown',
      'tenant-123',
      undefined,
    );
  });
});
