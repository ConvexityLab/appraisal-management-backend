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
  it('reassociates intake draft documents to the created order and writes audit provenance', async () => {
    const createOrder = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'order-789',
        orderNumber: 'ORD-789',
        status: OrderStatus.NEW,
      },
    });

    const controller = new OrderController({ createOrder } as any);
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

    (controller as any)._documentService = {
      associateEntityDocumentsToOrder,
    };
    (controller as any).duplicateDetection = {
      checkForDuplicates: vi.fn().mockResolvedValue({ hasPotentialDuplicates: false, matches: [] }),
    };
    (controller as any).auditService = {
      logDocumentReassociatedToOrder,
      log,
    };
    (controller as any).eventService = {
      publishOrderCreated: vi.fn().mockResolvedValue(undefined),
    };
    (controller as any).publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const req = {
      body: {
        intakeDraftId: 'draft-123',
        // Slice 8g engagement-primacy: every order must reference an Engagement.
        engagementId: 'eng-test-001',
        priority: 'RUSH',
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

    await controller.createOrder(req, res as any);

    expect(createOrder).toHaveBeenCalledWith(
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
    expect(createOrder.mock.calls[0]?.[0]).not.toHaveProperty('intakeDraftId');
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
    expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-789' }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'order.created',
        resource: { type: 'order', id: 'order-789' },
      }),
    );
  });
});
