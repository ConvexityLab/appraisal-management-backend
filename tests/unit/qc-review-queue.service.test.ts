import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  initializeMock,
  getContainerMock,
  createDocumentMock,
  loadByVendorOrderIdMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  getContainerMock: vi.fn(),
  createDocumentMock: vi.fn(),
  loadByVendorOrderIdMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/cosmos-db.service', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    initialize: initializeMock,
    getContainer: getContainerMock,
    createDocument: createDocumentMock,
    queryItems: vi.fn().mockResolvedValue({ data: [] }),
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrderId: loadByVendorOrderIdMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { QCReviewQueueService } from '../../src/services/qc-review-queue.service.js';

describe('QCReviewQueueService searchQueue canonical property resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMock.mockResolvedValue(undefined);
    createDocumentMock.mockImplementation(async (_container: string, document: unknown) => document);
    getContainerMock.mockReturnValue({
      items: {
        readAll: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({
            resources: [{
              id: 'qc-1',
              orderId: 'order-1',
              orderNumber: 'ORD-001',
              priorityLevel: 'HIGH',
              status: 'PENDING',
              propertyAddress: 'Legacy QC Address',
              createdAt: '2026-05-10T00:00:00.000Z',
              updatedAt: '2026-05-10T00:00:00.000Z',
              sla: { dueDate: '2026-05-11T00:00:00.000Z', breached: false },
            }],
          }),
        }),
      },
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

  it('returns canonical property text when canonical order context is available', async () => {
    const service = new QCReviewQueueService();

    const queueItems = await service.searchQueue({});

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(loadByVendorOrderIdMock).toHaveBeenCalledWith('order-1', { includeProperty: true });
    expect(queueItems).toHaveLength(1);
    expect(queueItems[0]?.propertyAddress).toBe('123 Canonical Main St, Austin, TX, 78701');
  });

  it('falls back to the stored QC review property text when canonical loading fails', async () => {
    loadByVendorOrderIdMock.mockRejectedValueOnce(new Error('canonical lookup failed'));
    const service = new QCReviewQueueService();

    const queueItems = await service.searchQueue({});

    expect(queueItems[0]?.propertyAddress).toBe('Legacy QC Address');
  });

  it('omits persisted propertyAddress when queueing without an explicit compatibility address', async () => {
    const service = new QCReviewQueueService();

    const queueItem = await service.addToQueue({
      orderId: 'order-1',
      orderNumber: 'ORD-001',
      appraisalId: 'APR-001',
      appraisedValue: 500000,
      orderPriority: 'STANDARD',
      clientId: 'client-1',
      clientName: 'Client One',
      vendorId: 'vendor-1',
      vendorName: 'Vendor One',
      submittedAt: new Date('2026-05-10T00:00:00.000Z'),
    });

    expect(queueItem.propertyAddress).toBe('N/A');
    expect(createDocumentMock).toHaveBeenCalledWith(
      'qc-reviews',
      expect.not.objectContaining({ propertyAddress: expect.anything() }),
    );
  });
});