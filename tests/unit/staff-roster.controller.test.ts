import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadByVendorOrderMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { StaffRosterController } from '../../src/controllers/staff-roster.controller.js';

function buildApp(dbService: { queryDocuments: ReturnType<typeof vi.fn> }) {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', new StaffRosterController(dbService as any).router);
  return app;
}

describe('StaffRosterController vendor active orders', () => {
  const queryDocumentsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryDocumentsMock.mockResolvedValue([
      {
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        productType: 'Appraisal',
        propertyAddress: {
          streetAddress: 'Legacy Address',
          city: 'Legacy City',
          state: 'TX',
          zipCode: '73301',
        },
        propertyId: 'prop-1',
        clientOrderId: 'co-1',
        tenantId: 'tenant-1',
        dueDate: '2026-05-20T00:00:00.000Z',
        assignedAt: '2026-05-10T00:00:00.000Z',
        clientId: 'client-1',
        fee: 650,
      },
    ]);
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
    });
  });

  it('returns canonical property text when joined order context is available', async () => {
    const res = await request(buildApp({ queryDocuments: queryDocumentsMock })).get('/api/staff/roster/vendor-1/orders');

    expect(res.status).toBe(200);
    expect(queryDocumentsMock).toHaveBeenCalledWith(
      'orders',
      expect.stringContaining('c.propertyId, c.clientOrderId, c.tenantId'),
      expect.any(Array),
    );
    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'order-1',
        propertyId: 'prop-1',
        clientOrderId: 'co-1',
        tenantId: 'tenant-1',
      }),
      { includeProperty: true },
    );
    expect(res.body).toEqual({
      vendorId: 'vendor-1',
      count: 1,
      orders: [expect.objectContaining({
        id: 'order-1',
        orderNumber: 'ORD-001',
        propertyAddress: '123 Canonical Main St, Austin, TX, 78701',
      })],
    });
  });

  it('falls back to the embedded order address when canonical resolution fails', async () => {
    loadByVendorOrderMock.mockRejectedValueOnce(new Error('canonical load failed'));

    const res = await request(buildApp({ queryDocuments: queryDocumentsMock })).get('/api/staff/roster/vendor-1/orders');

    expect(res.status).toBe(200);
    expect(res.body.orders[0].propertyAddress).toBe('Legacy Address, Legacy City, TX, 73301');
  });
});