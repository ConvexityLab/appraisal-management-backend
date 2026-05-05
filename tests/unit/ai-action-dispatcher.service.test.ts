import { describe, expect, it, vi } from 'vitest';
import { AiActionDispatcherService } from '../../src/services/ai-action-dispatcher.service.js';

const context = { tenantId: 'tenant-123', userId: 'user-123' };

function createDispatcher(overrides?: {
  orderService?: {
    createOrder?: ReturnType<typeof vi.fn>;
    assignOrderToVendor?: ReturnType<typeof vi.fn>;
  };
  engagementService?: {
    createEngagement?: ReturnType<typeof vi.fn>;
  };
  autoAssignmentOrchestrator?: {
    triggerVendorAssignment?: ReturnType<typeof vi.fn>;
  };
  dbService?: {
    findOrderById?: ReturnType<typeof vi.fn>;
  };
}) {
  const dbService = {
    findOrderById: overrides?.dbService?.findOrderById ?? vi.fn(),
  } as any;

  const dispatcher = new AiActionDispatcherService(dbService, {
    orderService: {
      createOrder: overrides?.orderService?.createOrder ?? vi.fn(),
      assignOrderToVendor: overrides?.orderService?.assignOrderToVendor ?? vi.fn(),
    } as any,
    engagementService: {
      createEngagement: overrides?.engagementService?.createEngagement ?? vi.fn(),
    } as any,
    autoAssignmentOrchestrator: {
      triggerVendorAssignment: overrides?.autoAssignmentOrchestrator?.triggerVendorAssignment ?? vi.fn(),
    } as any,
  });

  return {
    dispatcher,
    dbService,
  };
}

describe('AiActionDispatcherService', () => {
  it('creates orders through OrderManagementService.createOrder()', async () => {
    const createOrder = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'order-1', orderNumber: 'ORD-1', status: 'NEW' },
    });
    const { dispatcher } = createDispatcher({ orderService: { createOrder } });

    const result = await dispatcher.handleCreateOrder({
      clientId: 'client-1',
      // Slice 8g: engagement-primacy guard requires engagementId in the AI
      // payload. The model is contracted to call CREATE_ENGAGEMENT first
      // (or look up an existing engagement) and pass its id here.
      engagementId: 'eng-1',
      propertyAddress: { streetAddress: '123 Main', city: 'Dallas', state: 'TX', zipCode: '75001' },
      orderType: 'PURCHASE',
      productType: 'FULL_APPRAISAL',
      dueDate: '2030-01-01T00:00:00.000Z',
    }, context);

    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-123',
      createdBy: 'user-123',
      clientId: 'client-1',
      engagementId: 'eng-1',
    }));
    expect(result.data).toEqual({ orderId: 'order-1', orderNumber: 'ORD-1', status: 'NEW' });
  });

  it('creates engagements through EngagementService.createEngagement()', async () => {
    const createEngagement = vi.fn().mockResolvedValue({
      id: 'eng-1',
      engagementNumber: 'ENG-1',
      engagementType: 'SINGLE',
      // Engagement.loans renamed to Engagement.properties; client orders moved
      // from products[] to clientOrders[].
      properties: [{ id: 'loan-1' }],
    });
    const { dispatcher } = createDispatcher({ engagementService: { createEngagement } });

    const result = await dispatcher.handleCreateEngagement({
      client: { clientId: 'client-1', clientName: 'Client' },
      properties: [{ loanNumber: 'LN-1', property: { address: '123 Main', city: 'Dallas', state: 'TX', zipCode: '75001' }, clientOrders: [{ productType: 'FULL_APPRAISAL' }] }],
    }, context);

    expect(createEngagement).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-123',
      createdBy: 'user-123',
    }));
    expect(result.data).toEqual({ engagementId: 'eng-1', engagementNumber: 'ENG-1', engagementType: 'SINGLE', loanCount: 1 });
  });

  it('triggers auto-assignment for each requested order', async () => {
    const findOrderById = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'order-1',
          tenantId: 'tenant-123',
          orderNumber: 'ORD-1',
          engagementId: 'eng-1',
          productType: 'FULL_APPRAISAL',
          propertyAddress: { streetAddress: '123 Main', city: 'Dallas', state: 'TX', zipCode: '75001' },
          clientId: 'client-1',
          loanInformation: { loanAmount: 450000 },
          priority: 'STANDARD',
          dueDate: '2030-01-01T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({ success: true, data: null });
    const triggerVendorAssignment = vi.fn().mockResolvedValue(undefined);
    const { dispatcher } = createDispatcher({
      dbService: { findOrderById },
      autoAssignmentOrchestrator: { triggerVendorAssignment },
    });

    const result = await dispatcher.handleTriggerAutoAssignment({ orderIds: ['order-1', 'missing-order'] }, context);

    expect(triggerVendorAssignment).toHaveBeenCalledTimes(1);
    expect(triggerVendorAssignment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1', tenantId: 'tenant-123' }));
    expect(result.data).toEqual(expect.objectContaining({ successCount: 1, failureCount: 1 }));
  });

  it('assigns a specific vendor through OrderManagementService.assignOrderToVendor()', async () => {
    const assignOrderToVendor = vi.fn()
      .mockResolvedValueOnce({ success: true, data: { status: 'ASSIGNED', assignedVendorId: 'vendor-1' } })
      .mockResolvedValueOnce({ success: false, error: { message: 'Cannot assign vendor to order in COMPLETED status' } });
    const { dispatcher } = createDispatcher({ orderService: { assignOrderToVendor } });

    const result = await dispatcher.handleAssignVendor({
      orderIds: ['order-1', 'order-2'],
      vendorId: 'vendor-1',
    }, context);

    expect(assignOrderToVendor).toHaveBeenNthCalledWith(1, 'order-1', 'vendor-1', 'user-123');
    expect(assignOrderToVendor).toHaveBeenNthCalledWith(2, 'order-2', 'vendor-1', 'user-123');
    expect(result.data).toEqual(expect.objectContaining({ vendorId: 'vendor-1', successCount: 1, failureCount: 1 }));
  });
});