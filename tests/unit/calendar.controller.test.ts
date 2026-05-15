import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryItemsMock,
  loadByVendorOrderIdMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  queryItemsMock: vi.fn(),
  loadByVendorOrderIdMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    queryItems: queryItemsMock,
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrderId: loadByVendorOrderIdMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { calendarRouter } from '../../src/controllers/calendar.controller.js';

function attachTestUser(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  (req as any).user = { tenantId: 'tenant-1' };
  next();
}

function buildApp() {
  const app = express();
  app.use('/api/calendar', attachTestUser, calendarRouter);
  return app;
}

describe('CalendarController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryItemsMock
      .mockResolvedValueOnce({
        success: true,
        data: [{
          id: 'order-1',
          orderNumber: 'ORD-001',
          dueDate: '2026-05-20T00:00:00.000Z',
          status: 'IN_PROGRESS',
          clientName: 'Client One',
        }],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{
          id: 'inspection-1',
          orderId: 'order-1',
          scheduledDate: '2026-05-18T14:00:00.000Z',
          appraiserName: 'Appraiser One',
          status: 'SCHEDULED',
        }],
      });
    loadByVendorOrderIdMock.mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
  });

  it('builds the iCal feed from canonical order-context property addresses', async () => {
    const res = await request(buildApp()).get('/api/calendar/ical?days=30');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(loadByVendorOrderIdMock).toHaveBeenCalledWith('order-1', { includeProperty: true });
    expect(res.text).toContain('LOCATION:123 Canonical Main St\\, Austin\\, TX 78701');
    expect(queryItemsMock).toHaveBeenNthCalledWith(
      1,
      'orders',
      expect.not.stringContaining('propertyAddress'),
      expect.any(Array),
    );
    expect(queryItemsMock).toHaveBeenNthCalledWith(
      2,
      'inspections',
      expect.not.stringContaining('propertyAddress'),
      expect.any(Array),
    );
  });
});
