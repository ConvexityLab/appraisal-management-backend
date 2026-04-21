import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttomDataCompSearchService } from '../../src/services/attom-data-comp-search.service.js';
import type { CompSearchParams } from '../../src/types/attom-data.types.js';

// Mock CosmosDbService
const mockQueryItems = vi.fn();
const mockGetItem = vi.fn();

const mockCosmos = {
  queryItems: mockQueryItems,
  getItem: mockGetItem,
} as any;

describe('AttomDataCompSearchService', () => {
  let service: AttomDataCompSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttomDataCompSearchService(mockCosmos);
  });

  describe('searchComps', () => {
    const baseParams: CompSearchParams = {
      latitude: 30.3322,
      longitude: -81.6557,
      radiusMeters: 1609, // ~1 mile
    };

    it('should query with 9 geohash partitions', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps(baseParams);

      expect(mockQueryItems).toHaveBeenCalledTimes(1);
      const [containerName, query, parameters] = mockQueryItems.mock.calls[0];
      expect(containerName).toBe('attom-data');
      expect(query).toContain('c.geohash5 IN');
      // Should have 9 geohash params + lon + lat + radius + maxResults = 13
      const ghParams = parameters.filter((p: any) => p.name.startsWith('@gh'));
      expect(ghParams).toHaveLength(9);
    });

    it('should include ST_DISTANCE in the query', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps(baseParams);

      const [, query] = mockQueryItems.mock.calls[0];
      expect(query).toContain('ST_DISTANCE');
      expect(query).toContain('@radius');
    });

    it('should add property type filter when specified', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, propertyType: 'SFR' });

      const [, query, parameters] = mockQueryItems.mock.calls[0];
      expect(query).toContain('c.propertyDetail.attomPropertyType = @propType');
      expect(parameters).toContainEqual({ name: '@propType', value: 'SFR' });
    });

    it('should add bedroom range filters when specified', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, minBedrooms: 2, maxBedrooms: 4 });

      const [, query, parameters] = mockQueryItems.mock.calls[0];
      expect(query).toContain('c.propertyDetail.bedroomsTotal >= @minBed');
      expect(query).toContain('c.propertyDetail.bedroomsTotal <= @maxBed');
      expect(parameters).toContainEqual({ name: '@minBed', value: 2 });
      expect(parameters).toContainEqual({ name: '@maxBed', value: 4 });
    });

    it('should add sqft range filters when specified', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, minSqft: 1000, maxSqft: 2000 });

      const [, query, parameters] = mockQueryItems.mock.calls[0];
      expect(query).toContain('c.propertyDetail.livingAreaSqft >= @minSqft');
      expect(query).toContain('c.propertyDetail.livingAreaSqft <= @maxSqft');
      expect(parameters).toContainEqual({ name: '@minSqft', value: 1000 });
      expect(parameters).toContainEqual({ name: '@maxSqft', value: 2000 });
    });

    it('should add sale date filters when specified', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({
        ...baseParams,
        minSaleDate: '2024-01-01',
        maxSaleDate: '2025-12-31',
      });

      const [, query, parameters] = mockQueryItems.mock.calls[0];
      expect(query).toContain('c.salesHistory.lastSaleDate >= @minSaleDate');
      expect(query).toContain('c.salesHistory.lastSaleDate <= @maxSaleDate');
      expect(parameters).toContainEqual({ name: '@minSaleDate', value: '2024-01-01' });
      expect(parameters).toContainEqual({ name: '@maxSaleDate', value: '2025-12-31' });
    });

    it('should order by lastSaleDate DESC', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps(baseParams);

      const [, query] = mockQueryItems.mock.calls[0];
      expect(query).toContain('ORDER BY c.salesHistory.lastSaleDate DESC');
    });

    it('should respect maxResults parameter', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, maxResults: 25 });

      const [, , parameters] = mockQueryItems.mock.calls[0];
      expect(parameters).toContainEqual({ name: '@maxResults', value: 25 });
    });

    it('should default maxResults to 50', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps(baseParams);

      const [, , parameters] = mockQueryItems.mock.calls[0];
      expect(parameters).toContainEqual({ name: '@maxResults', value: 50 });
    });

    it('should map results to CompSearchResult format', async () => {
      const mockDoc = { id: '123', type: 'attom-data', attomId: '123' };
      mockQueryItems.mockResolvedValue({
        success: true,
        data: [{ c: mockDoc, dist: 500.5 }],
      });

      const results = await service.searchComps(baseParams);

      expect(results).toHaveLength(1);
      expect(results[0].document).toBe(mockDoc);
      expect(results[0].distanceMeters).toBe(500.5);
    });

    it('should return empty array on query failure', async () => {
      mockQueryItems.mockResolvedValue({ success: false, error: 'fail' });

      const results = await service.searchComps(baseParams);

      expect(results).toEqual([]);
    });
  });

  describe('getByAttomId', () => {
    it('should call getItem with partition key when geohash5 is provided', async () => {
      mockGetItem.mockResolvedValue({ success: true, data: { id: '123' } });

      const result = await service.getByAttomId('123', 'djnhw');

      expect(mockGetItem).toHaveBeenCalledWith('attom-data', '123', 'djnhw');
      expect(result).toEqual({ id: '123' });
    });

    it('should call getItem without partition key for cross-partition query', async () => {
      mockGetItem.mockResolvedValue({ success: true, data: { id: '123' } });

      await service.getByAttomId('123');

      expect(mockGetItem).toHaveBeenCalledWith('attom-data', '123', undefined);
    });

    it('should return null when item is not found', async () => {
      mockGetItem.mockResolvedValue({ success: false, error: 'not found' });

      const result = await service.getByAttomId('999');

      expect(result).toBeNull();
    });
  });
});
