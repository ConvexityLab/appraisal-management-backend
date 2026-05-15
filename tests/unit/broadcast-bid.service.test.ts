import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventPriority } from '../../src/types/events.js';

const { publishMock } = vi.hoisted(() => ({
  publishMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: publishMock,
  })),
}));

import { BroadcastBidService } from '../../src/services/broadcast-bid.service.js';

describe('BroadcastBidService persistence thinning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits persisted propertyAddress from broadcast vendor-bid invitations', async () => {
    const createItemMock = vi.fn().mockResolvedValue({ success: true });
    const service = new BroadcastBidService({
      createItem: createItemMock,
      getContainer: vi.fn(),
    } as any);

    const result = await service.startRound(
      {
        id: 'order-1',
        orderNumber: 'ORD-001',
        clientId: 'client-1',
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
        productType: 'FULL_APPRAISAL',
        dueDate: '2026-05-15T00:00:00.000Z',
        priority: 'STANDARD',
      },
      [{ vendorId: 'vendor-1', vendorName: 'Vendor One', score: 99 }],
      1,
      1,
      4,
      'tenant-1',
      EventPriority.NORMAL,
    );

    expect(result.bidIds).toHaveLength(1);
    expect(createItemMock).toHaveBeenCalledWith(
      'vendor-bids',
      expect.not.objectContaining({ propertyAddress: expect.anything() }),
    );
  });
});