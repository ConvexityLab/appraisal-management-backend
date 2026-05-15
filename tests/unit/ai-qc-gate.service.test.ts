import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  publishMock,
  subscribeMock,
  unsubscribeMock,
  getConfigMock,
  performQCAnalysisMock,
  loadByVendorOrderIdMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  publishMock: vi.fn(),
  subscribeMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  getConfigMock: vi.fn(),
  performQCAnalysisMock: vi.fn(),
  loadByVendorOrderIdMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: publishMock,
  })),
}));

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: subscribeMock,
    unsubscribe: unsubscribeMock,
  })),
}));

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: getConfigMock,
  })),
}));

vi.mock('../../src/services/universal-ai.service.js', () => ({
  UniversalAIService: vi.fn().mockImplementation(() => ({
    performQCAnalysis: performQCAnalysisMock,
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrderId: loadByVendorOrderIdMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { AIQCGateService } from '../../src/services/ai-qc-gate.service.js';
import { EventCategory, EventPriority } from '../../src/types/events.js';

function makeSubmittedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    type: 'order.status.changed',
    timestamp: new Date(),
    source: 'unit-test',
    version: '1.0',
    category: EventCategory.ORDER,
    data: {
      orderId: 'order-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      previousStatus: 'DRAFT',
      newStatus: 'SUBMITTED',
      changedBy: 'unit-test',
      priority: EventPriority.NORMAL,
      ...overrides,
    },
  } as const;
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    orderNumber: 'ORD-001',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      streetAddress: '999 Legacy Main St',
      city: 'Legacy City',
      state: 'TX',
      zipCode: '73301',
    },
    propertyDetails: {
      fullAddress: '999 Legacy Main St, Legacy City, TX, 73301',
    },
    estimatedValue: 500000,
    ...overrides,
  };
}

function makeDbStub(order = makeOrder()) {
  return {
    getItem: vi.fn().mockResolvedValue({ data: order }),
  };
}

describe('AIQCGateService canonical property context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishMock.mockResolvedValue(undefined);
    subscribeMock.mockResolvedValue(undefined);
    unsubscribeMock.mockResolvedValue(undefined);
    getConfigMock.mockResolvedValue({
      aiQcEnabled: true,
      aiQcPassThreshold: 90,
      aiQcFlagThreshold: 70,
    });
    performQCAnalysisMock.mockResolvedValue({
      overallScore: 95,
      passFailStatus: 'pass',
      findings: [],
    });
    loadByVendorOrderIdMock.mockResolvedValue({
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

  it('builds fallback QC report text from canonical property context first', async () => {
    const service = new AIQCGateService(makeDbStub() as any);

    await (service as any).onOrderStatusChanged(makeSubmittedEvent());

    expect(loadByVendorOrderIdMock).toHaveBeenCalledWith('order-1', { includeProperty: true });
    expect(performQCAnalysisMock).toHaveBeenCalledWith(expect.objectContaining({
      reportText: expect.stringContaining('123 Canonical Main St, Austin, TX, 78701'),
    }));
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'qc.ai.scored',
      data: expect.objectContaining({
        orderId: 'order-1',
        decision: 'auto_pass',
      }),
    }));
  });

  it('falls back to the embedded order address when canonical property lookup fails', async () => {
    loadByVendorOrderIdMock.mockRejectedValueOnce(new Error('canonical lookup failed'));
    const service = new AIQCGateService(makeDbStub() as any);

    await (service as any).onOrderStatusChanged(makeSubmittedEvent());

    expect(performQCAnalysisMock).toHaveBeenCalledWith(expect.objectContaining({
      reportText: expect.stringContaining('999 Legacy Main St, Legacy City, TX, 73301'),
    }));
  });
});