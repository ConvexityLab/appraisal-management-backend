import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getItemMock,
  findMatchingVendorsMock,
  loadByVendorOrderMock,
  getPropertyAddressMock,
  getLoanInformationMock,
} = vi.hoisted(() => ({
  getItemMock: vi.fn(),
  findMatchingVendorsMock: vi.fn(),
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
  getLoanInformationMock: vi.fn(),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    getItem: getItemMock,
  })),
}));

vi.mock('../../src/services/vendor-matching-engine.service.js', () => ({
  VendorMatchingEngine: vi.fn().mockImplementation(() => ({
    findMatchingVendors: findMatchingVendorsMock,
  })),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
  })),
}));

vi.mock('../../src/services/vendor-notification-bridge.service.js', () => ({
  loadVendorAndOrderContext: vi.fn(),
  publishVendorBidSent: vi.fn(),
  publishVendorBidAccepted: vi.fn(),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
  getLoanInformation: getLoanInformationMock,
}));

import { createAutoAssignmentRouter } from '../../src/controllers/auto-assignment.controller.js';

function attachTestUser(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  (req as any).user = { tenantId: 'tenant-1' };
  next();
}

function buildApp(orchestrator?: { triggerVendorAssignment: ReturnType<typeof vi.fn> }) {
  const app = express();
  app.use(express.json());
  app.use('/api/auto-assignment', attachTestUser, createAutoAssignmentRouter(orchestrator as any));
  return app;
}

describe('AutoAssignmentController canonical order context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getItemMock.mockResolvedValue({
      data: {
        id: 'order-1',
        orderNumber: 'ORD-001',
        tenantId: 'tenant-1',
        engagementId: 'eng-1',
        productType: 'FULL_APPRAISAL',
        priority: 'STANDARD',
        dueDate: '2026-05-20T00:00:00.000Z',
        clientId: 'client-1',
        propertyAddress: {
          streetAddress: 'Legacy Address',
          city: 'Legacy City',
          state: 'CA',
          zipCode: '90001',
        },
        loanAmount: 100000,
      },
    });
    loadByVendorOrderMock.mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
    getLoanInformationMock.mockReturnValue({ loanAmount: 450000 });
    findMatchingVendorsMock.mockResolvedValue([]);
  });

  it('uses canonical property address when building vendor suggestion requests', async () => {
    const res = await request(buildApp()).get('/api/auto-assignment/suggest?orderId=order-1');

    expect(res.status).toBe(200);
    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(findMatchingVendorsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
      }),
      10,
    );
  });

  it('uses canonical property and loan accessors when manually triggering vendor assignment', async () => {
    const triggerVendorAssignment = vi.fn().mockResolvedValue(undefined);

    const res = await request(buildApp({ triggerVendorAssignment }))
      .post('/api/auto-assignment/orders/order-1/trigger-vendor');

    expect(res.status).toBe(200);
    expect(triggerVendorAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
        propertyState: 'TX',
        loanAmount: 450000,
      }),
    );
  });
});
