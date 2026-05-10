import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioAnalyticsService } from '../src/services/portfolio-analytics.service.js';

describe('PortfolioAnalyticsService canonical joins', () => {
  let runOrdersQueryMock: ReturnType<typeof vi.fn>;
  let queryDocumentsMock: ReturnType<typeof vi.fn>;
  let service: PortfolioAnalyticsService;

  beforeEach(() => {
    runOrdersQueryMock = vi.fn().mockResolvedValue([
      {
        id: 'order-1',
        status: 'completed',
        productType: 'AMC',
        createdAt: '2026-05-01T00:00:00.000Z',
        clientOrderId: 'co-1',
        propertyId: 'prop-1',
      },
      {
        id: 'order-2',
        status: 'pending',
        productType: 'BPO',
        createdAt: '2026-05-02T00:00:00.000Z',
        clientOrderId: 'co-2',
        propertyId: 'prop-2',
      },
    ]);

    queryDocumentsMock = vi.fn().mockImplementation((containerName: string) => {
      if (containerName === 'client-orders') {
        return Promise.resolve([
          {
            id: 'co-1',
            propertyId: 'prop-1',
            propertyAddress: { streetAddress: '123 Canonical Main St', city: 'Austin', state: 'TX', zipCode: '78701' },
            loanInformation: { loanAmount: 500000 },
          },
          {
            id: 'co-2',
            propertyId: 'prop-2',
            propertyAddress: { streetAddress: '789 Legacy Ave', city: 'Miami', state: 'FL', zipCode: '33101' },
            loanInformation: { loanAmount: 250000 },
          },
        ]);
      }

      if (containerName === 'property-records') {
        return Promise.resolve([
          { id: 'prop-1', address: { street: '123 Canonical Main St', city: 'Austin', state: 'TX', zip: '78701' } },
          { id: 'prop-2', address: { street: '789 Legacy Ave', city: 'Miami', state: 'FL', zip: '33101' } },
        ]);
      }

      return Promise.resolve([]);
    });

    service = new PortfolioAnalyticsService({
      initialize: vi.fn().mockResolvedValue(undefined),
      runOrdersQuery: runOrdersQueryMock,
      queryDocuments: queryDocumentsMock,
    } as any);
  });

  it('calculates volume metrics from client-order loan data after canonical region filtering', async () => {
    const metrics = await (service as any).calculateVolumeMetrics({ region: 'TX' });

    expect(metrics.totalOrders).toBe(1);
    expect(metrics.totalValue).toBe(500000);
    expect(metrics.averageValue).toBe(500000);
    expect(metrics.ordersByType).toEqual({ AMC: 1 });
  });

  it('calculates geographic metrics from canonical property state instead of embedded vendor-order address', async () => {
    const metrics = await (service as any).calculateGeographicMetrics({ region: 'TX' });

    expect(metrics.coverage.states).toBe(1);
    expect(metrics.performance.topStates).toEqual(['TX']);
    expect(metrics.coverage.concentration.TX).toBe(1);
  });

  it('calculates valuation trends from client-order loan data instead of embedded vendor-order loan information', async () => {
    const metrics = await (service as any).analyzeValuationTrends({ region: 'TX' });

    expect(metrics.average).toBe(500000);
  });
});