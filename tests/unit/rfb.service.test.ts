import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMatchProviders } = vi.hoisted(() => ({
  mockMatchProviders: vi.fn(),
}));

vi.mock('../../src/services/matching-engine.service.js', () => ({
  matchProviders: mockMatchProviders,
}));

import { RfbService } from '../../src/services/rfb.service.js';

function buildService(productDefaultFee = 450) {
  let storedRfb: any | null = null;

  const rfbContainer = {
    items: {
      create: vi.fn(async (doc: any) => {
        storedRfb = { ...doc };
        return { resource: storedRfb };
      }),
    },
    item: vi.fn((_id: string, _orderId: string) => ({
      read: vi.fn(async () => ({ resource: storedRfb })),
      replace: vi.fn(async (doc: any) => {
        storedRfb = { ...doc };
        return { resource: storedRfb };
      }),
    })),
  };

  const productsContainer = {
    items: {
      query: vi.fn(() => ({
        fetchAll: vi.fn(async () => ({
          resources: [
            {
              id: 'product-1',
              tenantId: 'tenant-1',
              defaultFee: productDefaultFee,
            },
          ],
        })),
      })),
    },
  };

  const dbService = {
    getRfbRequestsContainer: vi.fn(() => rfbContainer),
    getProductsContainer: vi.fn(() => productsContainer),
  } as any;

  return {
    service: new RfbService(dbService),
    getStoredRfb: () => storedRfb,
  };
}

describe('RfbService auto-award thresholds', () => {
  beforeEach(() => {
    mockMatchProviders.mockReset();
    mockMatchProviders.mockReturnValue([
      {
        providerId: 'provider-1',
        providerName: 'Vendor One',
        providerType: 'AMC',
        score: 95,
        matchedCriteria: 4,
        totalCriteria: 4,
        snapshot: {},
      },
      {
        providerId: 'provider-2',
        providerName: 'Vendor Two',
        providerType: 'AMC',
        score: 72,
        matchedCriteria: 3,
        totalCriteria: 4,
        snapshot: {},
      },
    ]);
  });

  it('persists the configured auto-award threshold on the draft RFB', async () => {
    const { service, getStoredRfb } = buildService();

    await service.createRfb({
      request: {
        orderId: 'order-1',
        productId: 'product-1',
        criteriaSetIds: ['criteria-1'],
        deadlineAt: '2026-04-30T12:00:00.000Z',
        autoAward: true,
        autoAwardThreshold: {
          maxFeeMultiplier: 1.15,
          minVendorScore: 80,
        },
      },
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      providers: [],
      criteriaSets: [],
    });

    expect(getStoredRfb()).toEqual(
      expect.objectContaining({
        autoAward: true,
        autoAwardThreshold: {
          maxFeeMultiplier: 1.15,
          minVendorScore: 80,
        },
      }),
    );
  });

  it('auto-awards the first bid when it meets the configured fee and score thresholds', async () => {
    const { service, getStoredRfb } = buildService(450);

    const created = await service.createRfb({
      request: {
        orderId: 'order-1',
        productId: 'product-1',
        criteriaSetIds: ['criteria-1'],
        deadlineAt: '2026-04-30T12:00:00.000Z',
        autoAward: true,
        autoAwardThreshold: {
          maxFeeMultiplier: 1.15,
          minVendorScore: 80,
        },
      },
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      providers: [],
      criteriaSets: [],
    });

    await service.broadcastRfb(created.id, 'order-1', 'tenant-1');

    const awarded = await service.submitBid(
      created.id,
      'order-1',
      {
        providerId: 'provider-1',
        providerName: 'Vendor One',
        providerType: 'AMC',
        proposedFee: 500,
        proposedTurnaroundDays: 3,
      },
      'tenant-1',
    );

    expect(awarded.status).toBe('AWARDED');
    expect(awarded.awardedBidId).toBeDefined();
    expect(awarded.bids[0]?.status).toBe('ACCEPTED');
    expect(getStoredRfb()?.status).toBe('AWARDED');
  });

  it('keeps the RFB open when the first bid misses the minimum vendor score threshold', async () => {
    const { service, getStoredRfb } = buildService(450);

    const created = await service.createRfb({
      request: {
        orderId: 'order-1',
        productId: 'product-1',
        criteriaSetIds: ['criteria-1'],
        deadlineAt: '2026-04-30T12:00:00.000Z',
        autoAward: true,
        autoAwardThreshold: {
          maxFeeMultiplier: 1.15,
          minVendorScore: 80,
        },
      },
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      providers: [],
      criteriaSets: [],
    });

    await service.broadcastRfb(created.id, 'order-1', 'tenant-1');

    const updated = await service.submitBid(
      created.id,
      'order-1',
      {
        providerId: 'provider-2',
        providerName: 'Vendor Two',
        providerType: 'AMC',
        proposedFee: 500,
        proposedTurnaroundDays: 3,
      },
      'tenant-1',
    );

    expect(updated.status).toBe('BIDS_RECEIVED');
    expect(updated.awardedBidId).toBeUndefined();
    expect(updated.bids[0]?.status).toBe('PENDING');
    expect(getStoredRfb()?.status).toBe('BIDS_RECEIVED');
  });
});
