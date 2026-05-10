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
