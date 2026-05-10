import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventPriority } from '../../src/types/events.js';

const {
  publishMock,
  addToQueueMock,
  loadByVendorOrderMock,
  getPropertyAddressMock,
  getDueDateMock,
} = vi.hoisted(() => ({
  publishMock: vi.fn().mockResolvedValue(undefined),
  addToQueueMock: vi.fn().mockResolvedValue({ id: 'qc-review-1' }),
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
  getDueDateMock: vi.fn(),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: publishMock,
    publishBatch: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    startListening: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/vendor-matching-engine.service.js', () => ({
  VendorMatchingEngine: vi.fn().mockImplementation(() => ({
    findMatchingVendors: vi.fn(),
    findMatchingVendorsAndDenied: vi.fn(),
  })),
}));

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    analyzeVendorBid: vi.fn(),
  })),
}));

vi.mock('../../src/services/qc-review-queue.service.js', () => ({
  QCReviewQueueService: vi.fn().mockImplementation(() => ({
    addToQueue: addToQueueMock,
    assignReview: vi.fn(),
    getAllAnalystWorkloads: vi.fn(),
  })),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockResolvedValue({
      autoAssignmentEnabled: true,
      bidMode: 'sequential',
      broadcastCount: 5,
      axiomAutoTrigger: false,
      aiQcEnabled: false,
      maxVendorAttempts: 5,
      escalationRecipients: [],
      supervisoryReviewForAllOrders: false,
      supervisoryReviewValueThreshold: 0,
      defaultSupervisorId: null,
      preferredVendorIds: [],
    }),
  })),
}));

vi.mock('../../src/services/supervisory-review.service.js', () => ({
  SupervisoryReviewService: vi.fn().mockImplementation(() => ({
    requestSupervision: vi.fn(),
  })),
}));

vi.mock('../../src/services/assignment-trace-recorder.service.js', () => ({
  AssignmentTraceRecorder: vi.fn().mockImplementation(() => ({
    record: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
  getLoanInformation: vi.fn(),
  getDueDate: getDueDateMock,
}));

import { AutoAssignmentOrchestratorService } from '../../src/services/auto-assignment-orchestrator.service.js';

describe('AutoAssignmentOrchestratorService canonical property access', () => {
  const createDb = () => ({
    createItem: vi.fn().mockResolvedValue({ success: true }),
    updateItem: vi.fn().mockResolvedValue({ success: true }),
    getItem: vi.fn().mockResolvedValue({ data: null }),
    findOrderById: vi.fn().mockResolvedValue({ data: null }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    loadByVendorOrderMock.mockResolvedValue({
      vendorOrder: { id: 'order-1' },
      clientOrder: { orderType: 'FULL_APPRAISAL' },
      property: {},
    });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
    getDueDateMock.mockReturnValue('2026-05-15T00:00:00.000Z');
    addToQueueMock.mockResolvedValue({ id: 'qc-review-1' });
  });

  it('uses canonical property accessors when building vendor bid invitations', async () => {
    const db = createDb();
    const orchestrator = new AutoAssignmentOrchestratorService(db as any);

    await (orchestrator as any).sendBidToVendor(
      {
        id: 'order-1',
        orderNumber: 'ORD-001',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        priority: 'STANDARD',
        dueDate: '2026-05-20T00:00:00.000Z',
        productType: 'FULL_APPRAISAL',
        orderType: 'FULL_APPRAISAL',
        propertyAddress: 'Legacy Address',
        propertyDetails: { fullAddress: 'Legacy Full Address' },
      },
      {
        status: 'PENDING_BID',
        rankedVendors: [{ vendorId: 'vendor-1', vendorName: 'Vendor One', score: 99 }],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: '2026-05-10T00:00:00.000Z',
      },
      'tenant-1',
      EventPriority.NORMAL,
    );

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(db.createItem).toHaveBeenCalledWith(
      'vendor-bids',
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
        dueDate: '2026-05-15T00:00:00.000Z',
      }),
    );
  });

  it('uses canonical property accessors when creating QC queue entries', async () => {
    const db = createDb();
    const orchestrator = new AutoAssignmentOrchestratorService(db as any);

    await (orchestrator as any).initiateReviewAssignment(
      {
        id: 'order-1',
        orderNumber: 'ORD-001',
        tenantId: 'tenant-1',
        assignedVendorId: 'vendor-1',
        assignedVendorName: 'Vendor One',
        priority: 'STANDARD',
        clientId: 'client-1',
        clientName: 'Client One',
        appraisalId: 'appraisal-1',
        propertyAddress: 'Legacy Address',
        propertyDetails: { fullAddress: 'Legacy Full Address' },
      },
      'tenant-1',
      EventPriority.NORMAL,
    );

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(addToQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
      }),
    );
  });
});
