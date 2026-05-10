import { describe, expect, it, vi } from 'vitest';
import { OrderController } from '../../src/controllers/order.controller.js';
import { OrderStatus } from '../../src/types/order-status.js';
import type { UnifiedAuthRequest } from '../../src/middleware/unified-auth.middleware.js';

function createResponseMock() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return {
    json,
    status,
  };
}

describe('OrderController.createOrder', () => {
  it('attaches a VendorOrder to the parent ClientOrder via addVendorOrders + reassociates intake draft documents', async () => {
    // Phase B step 4: controller now calls ClientOrderService.addVendorOrders
    // against an existing ClientOrder. Test injects a stub clientOrderService
    // and asserts the new contract.
    const addVendorOrders = vi.fn().mockResolvedValue([
      {
        id: 'order-789',
        orderNumber: 'ORD-789',
        status: OrderStatus.NEW,
        engagementId: 'eng-test-001',
      },
    ]);

    const controller = new OrderController({} as never);
    (controller as unknown as { clientOrderService: { addVendorOrders: typeof addVendorOrders } })
      .clientOrderService = { addVendorOrders };

    const associateEntityDocumentsToOrder = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'doc-1',
          name: 'Purchase Contract.pdf',
          entityType: 'order-intake-draft',
          entityId: 'draft-123',
        },
      ],
    });
    const logDocumentReassociatedToOrder = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn().mockResolvedValue(undefined);

    (controller as never as { _documentService: unknown })._documentService = {
      associateEntityDocumentsToOrder,
    };
    (controller as never as { duplicateDetection: unknown }).duplicateDetection = {
      checkForDuplicates: vi.fn().mockResolvedValue({ hasPotentialDuplicates: false, matches: [] }),
    };
    (controller as never as { auditService: unknown }).auditService = {
      logDocumentReassociatedToOrder,
      log,
    };
    (controller as never as { eventService: unknown }).eventService = {
      publishOrderCreated: vi.fn().mockResolvedValue(undefined),
    };
    (controller as never as { publisher: unknown }).publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const req = {
      body: {
        intakeDraftId: 'draft-123',
        engagementId: 'eng-test-001',
        clientOrderId: 'co-test-001',
        priority: 'RUSH',
        productType: 'FULL_APPRAISAL',
        propertyAddress: {
          streetAddress: '123 Main St',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
        },
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
      },
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await controller.createOrder(req, res as never);

    expect(addVendorOrders).toHaveBeenCalledWith(
      'co-test-001',
      'tenant-1',
      [expect.objectContaining({ vendorWorkType: 'FULL_APPRAISAL' })],
      expect.objectContaining({
        priority: 'RUSH',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        status: OrderStatus.NEW,
        metadata: expect.objectContaining({
          sourceIdentity: expect.objectContaining({
            sourceKind: 'manual-draft',
            intakeDraftId: 'draft-123',
          }),
        }),
      }),
    );
    expect(associateEntityDocumentsToOrder).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      entityType: 'order-intake-draft',
      entityId: 'draft-123',
      orderId: 'order-789',
      linkedBy: 'user-1',
      linkReason: 'order-intake-submit',
    });
    expect(logDocumentReassociatedToOrder).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        email: 'user@example.com',
      },
      {
        documentId: 'doc-1',
        documentName: 'Purchase Contract.pdf',
        orderId: 'order-789',
        entityType: 'order-intake-draft',
        entityId: 'draft-123',
      },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORDER_CREATED',
        resource: { type: 'order', id: 'order-789' },
      }),
    );
  });
});

describe('OrderController.getOrderPropertyRecord', () => {
  it('returns the observation-materialized canonical property from OrderContextLoader', async () => {
    const controller = new OrderController({} as never);
    const loadByVendorOrderId = vi.fn().mockResolvedValue({
      vendorOrder: {
        id: 'order-1',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
      },
      clientOrder: null,
      property: {
        id: 'prop-1',
        tenantId: 'tenant-1',
        address: { street: '55 Canonical Avenue', city: 'Canonical City', state: 'TX', zip: '75002' },
        propertyType: 'single_family_residential',
        building: { gla: 2100, yearBuilt: 2005, bedrooms: 4, bathrooms: 3 },
        taxAssessments: [{ taxYear: 2025, totalAssessedValue: 430000, assessedAt: '2026-05-11T00:00:00.000Z' }],
        permits: [{ permitNumber: 'P-1', type: 'REMODEL', description: 'Kitchen', isMaterialChange: true }],
        avm: { value: 455000, fetchedAt: '2026-05-12T00:00:00.000Z', source: 'bridge-zestimate' },
        recordVersion: 1,
        versionHistory: [],
        dataSource: 'MANUAL_ENTRY',
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
        createdBy: 'user-1',
      },
    });

    (controller as unknown as { contextLoader: { loadByVendorOrderId: typeof loadByVendorOrderId } }).contextLoader = {
      loadByVendorOrderId,
    };

    const req = {
      params: { orderId: 'order-1' },
      user: { tenantId: 'tenant-1' },
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await controller.getOrderPropertyRecord(req, res as never);

    expect(loadByVendorOrderId).toHaveBeenCalledWith('order-1', { includeProperty: true });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'prop-1',
        avm: expect.objectContaining({ value: 455000 }),
        taxAssessments: [expect.objectContaining({ taxYear: 2025 })],
        permits: [expect.objectContaining({ permitNumber: 'P-1' })],
      }),
    );
  });

  it('returns 404 when OrderContextLoader cannot resolve the vendor order', async () => {
    const controller = new OrderController({} as never);
    const loadByVendorOrderId = vi.fn().mockRejectedValue(
      new Error("OrderContextLoader: VendorOrder 'missing-order' not found (no data)"),
    );

    (controller as unknown as { contextLoader: { loadByVendorOrderId: typeof loadByVendorOrderId } }).contextLoader = {
      loadByVendorOrderId,
    };

    const req = {
      params: { orderId: 'missing-order' },
      user: { tenantId: 'tenant-1' },
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await controller.getOrderPropertyRecord(req, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect((res.status as any).mock.results.at(-1)?.value.json).toHaveBeenCalledWith({ error: 'Order not found' });
  });
});

describe('OrderController canonical order-context readers', () => {
  it('publishes engagement.order.created with canonical property and loan values', async () => {
    const addVendorOrders = vi.fn().mockResolvedValue([
      {
        id: 'order-789',
        orderNumber: 'ORD-789',
        status: OrderStatus.NEW,
        engagementId: 'eng-test-001',
        tenantId: 'tenant-1',
        productType: 'FULL_APPRAISAL',
        clientId: 'client-1',
        priority: 'RUSH',
        dueDate: '2026-05-20T00:00:00.000Z',
        propertyAddress: {
          streetAddress: 'Legacy Main St',
          city: 'Legacy City',
          state: 'CA',
          zipCode: '90001',
        },
        loanInformation: { loanAmount: 100000 },
      },
    ]);

    const controller = new OrderController({} as never);
    (controller as any).clientOrderService = { addVendorOrders };
    (controller as any)._documentService = { associateEntityDocumentsToOrder: vi.fn().mockResolvedValue({ success: true, data: [] }) };
    (controller as any).duplicateDetection = { checkForDuplicates: vi.fn().mockResolvedValue({ hasPotentialDuplicates: false, matches: [] }) };
    (controller as any).auditService = {
      logDocumentReassociatedToOrder: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue(undefined),
    };
    (controller as any).eventService = { publishOrderCreated: vi.fn().mockResolvedValue(undefined) };
    const publish = vi.fn().mockResolvedValue(undefined);
    (controller as any).publisher = { publish };
    (controller as any).contextLoader = {
      loadByVendorOrder: vi.fn().mockResolvedValue({
        vendorOrder: { id: 'order-789' },
        clientOrder: { loanInformation: { loanAmount: 450000 } },
        property: {},
      }),
    };

    const orderContextModule = await import('../../src/services/order-context-loader.service.js');
    const getPropertyAddressSpy = vi.spyOn(orderContextModule, 'getPropertyAddress').mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    } as any);
    const getLoanInformationSpy = vi.spyOn(orderContextModule, 'getLoanInformation').mockReturnValue({ loanAmount: 450000 } as any);

    const req = {
      body: {
        engagementId: 'eng-test-001',
        clientOrderId: 'co-test-001',
        priority: 'RUSH',
        productType: 'FULL_APPRAISAL',
        propertyAddress: {
          streetAddress: '123 Main St',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
        },
      },
      user: { id: 'user-1', email: 'user@example.com', tenantId: 'tenant-1' },
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await controller.createOrder(req, res as never);

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'engagement.order.created',
      data: expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
        propertyState: 'TX',
        loanAmount: 450000,
      }),
    }));

    getPropertyAddressSpy.mockRestore();
    getLoanInformationSpy.mockRestore();
  });

  it('uses canonical property address when routing submitted orders to the QC queue', async () => {
    const controller = new OrderController({} as never);
    (controller as any).dbService = {
      findOrderById: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          status: OrderStatus.IN_PROGRESS,
          tenantId: 'tenant-1',
          orderNumber: 'ORD-001',
          priority: 'STANDARD',
          clientId: 'client-1',
        },
      }),
      updateOrder: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'order-1',
          status: OrderStatus.SUBMITTED,
          tenantId: 'tenant-1',
          orderNumber: 'ORD-001',
          propertyAddress: {
            streetAddress: 'Legacy Main St',
            city: 'Legacy City',
            state: 'CA',
            zipCode: '90001',
          },
          clientId: 'client-1',
        },
      }),
    };
    (controller as any).eventService = { publishOrderStatusChanged: vi.fn().mockResolvedValue(undefined) };
    (controller as any).publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    (controller as any).auditService = { log: vi.fn().mockResolvedValue(undefined) };
    (controller as any).qcQueueService = { addToQueue: vi.fn().mockResolvedValue({ id: 'queue-1' }), updateQueueItem: vi.fn().mockResolvedValue(undefined) };
    (controller as any).slaService = { startSLATracking: vi.fn().mockResolvedValue(undefined) };
    (controller as any).axiomService = { isEnabled: vi.fn().mockReturnValue(false) };
    (controller as any).contextLoader = {
      loadByVendorOrder: vi.fn().mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} }),
    };

    const orderContextModule = await import('../../src/services/order-context-loader.service.js');
    const getPropertyAddressSpy = vi.spyOn(orderContextModule, 'getPropertyAddress').mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    } as any);

    const req = {
      params: { orderId: 'order-1' },
      body: { status: OrderStatus.SUBMITTED },
      user: { id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com' },
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await (controller as any).updateOrderStatus(req, res as never);

    expect((controller as any).qcQueueService.addToQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
      }),
    );

    getPropertyAddressSpy.mockRestore();
  });

  it('applies canonical property filtering in searchOrders', async () => {
    const controller = new OrderController({} as never);
    (controller as any).dbService = {
      buildOrdersQuerySpec: vi.fn().mockImplementation((query: string, parameters: any[]) => ({ query, parameters })),
      queryDocuments: vi.fn().mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: OrderStatus.NEW,
          priority: 'STANDARD',
          clientId: 'client-1',
          specialInstructions: 'Handle carefully',
          propertyAddress: {
            streetAddress: 'Legacy Main St',
            city: 'Legacy City',
            state: 'CA',
            zipCode: '90001',
          },
        },
      ]),
    };
    (controller as any).contextLoader = {
      loadByVendorOrder: vi.fn().mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} }),
    };

    const orderContextModule = await import('../../src/services/order-context-loader.service.js');
    const getPropertyAddressSpy = vi.spyOn(orderContextModule, 'getPropertyAddress').mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    } as any);

    const req = {
      body: {
        textQuery: 'Austin',
        propertyAddress: { city: 'Austin', state: 'TX' },
        limit: 50,
        offset: 0,
      },
      authorizationFilter: undefined,
    } as UnifiedAuthRequest;
    const res = createResponseMock();

    await (controller as any).searchOrders(req, res as never);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      total: 1,
      orders: [expect.objectContaining({ id: 'order-1' })],
    }));

    getPropertyAddressSpy.mockRestore();
  });
});
