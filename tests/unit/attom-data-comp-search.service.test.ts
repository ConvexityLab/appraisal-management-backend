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

  describe('expansion strategies', () => {
    const baseParams: CompSearchParams = {
      latitude: 30.3322,
      longitude: -81.6557,
      radiusMeters: 1609,
    };

    const docResult = (attomId: string, lastSaleDate: string) => ({
      c: {
        id: attomId,
        type: 'attom-data',
        attomId,
        salesHistory: { lastSaleDate },
      },
      dist: 100,
    });

    it('NONE: queries exactly 1 cell in a single call', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, expansion: 'NONE' });

      expect(mockQueryItems).toHaveBeenCalledTimes(1);
      const [, query, parameters] = mockQueryItems.mock.calls[0];
      const ghParams = parameters.filter((p: any) => p.name.startsWith('@gh'));
      expect(ghParams).toHaveLength(1);
      expect(query).toContain('c.geohash5 IN (@gh0)');
    });

    it('ALWAYS_9: queries exactly 9 cells in a single call (explicit opt-in)', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps({ ...baseParams, expansion: 'ALWAYS_9' });

      expect(mockQueryItems).toHaveBeenCalledTimes(1);
      const [, , parameters] = mockQueryItems.mock.calls[0];
      const ghParams = parameters.filter((p: any) => p.name.startsWith('@gh'));
      expect(ghParams).toHaveLength(9);
    });

    it('default expansion is ALWAYS_9 (back-compat)', async () => {
      mockQueryItems.mockResolvedValue({ success: true, data: [] });

      await service.searchComps(baseParams);

      expect(mockQueryItems).toHaveBeenCalledTimes(1);
      const [, , parameters] = mockQueryItems.mock.calls[0];
      const ghParams = parameters.filter((p: any) => p.name.startsWith('@gh'));
      expect(ghParams).toHaveLength(9);
    });

    it('ADAPTIVE: short-circuits when center cell meets the threshold', async () => {
      mockQueryItems.mockResolvedValueOnce({
        success: true,
        data: [docResult('a', '2025-01-01'), docResult('b', '2024-06-01')],
      });

      const results = await service.searchComps({
        ...baseParams,
        expansion: 'ADAPTIVE',
        adaptiveMinResults: 2,
      });

      // Only the center query runs.
      expect(mockQueryItems).toHaveBeenCalledTimes(1);
      const [, , parameters] = mockQueryItems.mock.calls[0];
      const ghParams = parameters.filter((p: any) => p.name.startsWith('@gh'));
      expect(ghParams).toHaveLength(1);
      expect(results).toHaveLength(2);
    });

    it('ADAPTIVE: expands to neighbor cells when center under-fills', async () => {
      mockQueryItems
        .mockResolvedValueOnce({ success: true, data: [docResult('a', '2025-01-01')] })
        .mockResolvedValueOnce({
          success: true,
          data: [docResult('b', '2025-06-01'), docResult('c', '2024-01-01')],
        });

      const results = await service.searchComps({
        ...baseParams,
        expansion: 'ADAPTIVE',
        adaptiveMinResults: 5,
        maxResults: 10,
      });

      // Two calls: center (1 cell) then neighbors (8 cells).
      expect(mockQueryItems).toHaveBeenCalledTimes(2);
      const centerParams = mockQueryItems.mock.calls[0][2];
      const neighborParams = mockQueryItems.mock.calls[1][2];
      expect(centerParams.filter((p: any) => p.name.startsWith('@gh'))).toHaveLength(1);
      expect(neighborParams.filter((p: any) => p.name.startsWith('@gh'))).toHaveLength(8);

      // Merged + sorted by lastSaleDate DESC.
      expect(results.map((r) => r.document.attomId)).toEqual(['b', 'a', 'c']);
    });

    it('ADAPTIVE: dedupes by attomId when neighbor query returns the center doc', async () => {
      mockQueryItems
        .mockResolvedValueOnce({ success: true, data: [docResult('a', '2025-01-01')] })
        .mockResolvedValueOnce({
          success: true,
          data: [
            docResult('a', '1999-01-01'), // duplicate id, stale lastSaleDate — must drop
            docResult('b', '2024-06-01'),
          ],
        });

      const results = await service.searchComps({
        ...baseParams,
        expansion: 'ADAPTIVE',
        adaptiveMinResults: 5,
        maxResults: 10,
      });

      expect(mockQueryItems).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      // Center copy of 'a' wins (its lastSaleDate is preserved in sort).
      expect(results.map((r) => r.document.attomId)).toEqual(['a', 'b']);
      const aResult = results.find((r) => r.document.attomId === 'a')!;
      expect(aResult.document.salesHistory.lastSaleDate).toBe('2025-01-01');
    });

    it('ADAPTIVE: caps merged results to maxResults', async () => {
      mockQueryItems
        .mockResolvedValueOnce({ success: true, data: [docResult('a', '2025-01-01')] })
        .mockResolvedValueOnce({
          success: true,
          data: [
            docResult('b', '2024-12-01'),
            docResult('c', '2024-11-01'),
            docResult('d', '2024-10-01'),
          ],
        });

      const results = await service.searchComps({
        ...baseParams,
        expansion: 'ADAPTIVE',
        adaptiveMinResults: 99,
        maxResults: 2,
      });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.document.attomId)).toEqual(['a', 'b']);
    });

    it('ADAPTIVE: defaults adaptiveMinResults to maxResults', async () => {
      // Center returns 4, maxResults is 5 → should expand because 4 < 5.
      mockQueryItems
        .mockResolvedValueOnce({
          success: true,
          data: [
            docResult('a', '2025-01-01'),
            docResult('b', '2024-12-01'),
            docResult('c', '2024-11-01'),
            docResult('d', '2024-10-01'),
          ],
        })
        .mockResolvedValueOnce({ success: true, data: [] });

      await service.searchComps({
        ...baseParams,
        expansion: 'ADAPTIVE',
        maxResults: 5,
      });

      expect(mockQueryItems).toHaveBeenCalledTimes(2);
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
