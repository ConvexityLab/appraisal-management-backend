import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findOrderByIdMock,
  getContainerMock,
  loadByVendorOrderMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  findOrderByIdMock: vi.fn(),
  getContainerMock: vi.fn(),
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    findOrderById: findOrderByIdMock,
    getContainer: getContainerMock,
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { createPortalRouter } from '../../src/controllers/portal.controller.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';

function attachTestUser(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  (req as any).user = { id: 'user-1', tenantId: 'tenant-1' };
  next();
}

function buildApp() {
  const app = express();
  app.use(express.json());
  const db = new (CosmosDbService as any)();
  app.use('/api/portal', attachTestUser, createPortalRouter(db));
  return app;
}

describe('PortalController order status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrderByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: 'order-1',
        tenantId: 'tenant-1',
        status: 'Completed',
        orderType: 'Full',
        propertyAddress: {
          streetAddress: 'Legacy Address',
          city: 'Legacy City',
          state: 'TX',
          zipCode: '73301',
          county: 'Travis',
        },
        effectiveDueDate: '2026-05-12',
        submittedAt: '2026-05-01T00:00:00.000Z',
        completedAt: '2026-05-09T00:00:00.000Z',
        deliveredAt: '2026-05-10T00:00:00.000Z',
        borrowerName: 'Alice Appleton',
        loanNumber: 'LN-001',
      },
    });
    loadByVendorOrderMock.mockResolvedValue({
      vendorOrder: { id: 'order-1' },
      clientOrder: null,
      property: {},
    });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
  });

  it('returns portal-safe order fields with canonical property address resolution', async () => {
    const res = await request(buildApp()).get('/api/portal/orders/order-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({
      id: 'order-1',
      status: 'Completed',
      borrowerName: 'Alice Appleton',
      loanNumber: 'LN-001',
      propertyAddress: {
        streetAddress: '123 Canonical Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        county: 'Travis',
      },
    }));
    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
  });
});
