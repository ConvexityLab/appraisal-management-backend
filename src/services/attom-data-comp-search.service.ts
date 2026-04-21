/**
 * ATTOM Data Comparable Search Service
 *
 * Queries the attom-data CosmosDB container (partitioned by geohash-5)
 * to find comparable properties within a radius of a subject property.
 *
 * Query strategy:
 *   1. Compute the subject's geohash-5 + 8 neighboring cells (9 total)
 *   2. Issue a single query targeting those 9 partitions via IN clause
 *   3. Apply ST_DISTANCE for precise radius filtering
 *   4. Apply optional attribute filters (property type, bedrooms, sqft, sale date)
 *   5. Return results sorted by sale recency with computed distances
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { getSearchGeohashes } from '../utils/geohash.util.js';
import type { AttomDataDocument, CompSearchParams, CompSearchResult } from '../types/attom-data.types.js';

const CONTAINER = 'attom-data';
const GEOHASH_PRECISION = 5;
const DEFAULT_MAX_RESULTS = 50;

export class AttomDataCompSearchService {
  private readonly logger: Logger;

  constructor(private readonly cosmos: CosmosDbService) {
    this.logger = new Logger('AttomDataCompSearchService');
  }

  /**
   * Search for comparable properties within a radius of a subject property.
   *
   * The query targets at most 9 geohash partitions (center + 8 neighbors),
   * then applies ST_DISTANCE for precise circle filtering within those partitions.
   * Results are ordered by most recent sale date first.
   */
  async searchComps(params: CompSearchParams): Promise<CompSearchResult[]> {
    const {
      longitude,
      latitude,
      radiusMeters,
      propertyType,
      minBedrooms,
      maxBedrooms,
      minSqft,
      maxSqft,
      minSaleDate,
      maxSaleDate,
      maxResults = DEFAULT_MAX_RESULTS,
    } = params;

    const geohashes = getSearchGeohashes(latitude, longitude, GEOHASH_PRECISION);

    // Build dynamic WHERE clauses and parameters
    const whereClauses: string[] = [
      'c.geohash5 IN (@gh0, @gh1, @gh2, @gh3, @gh4, @gh5, @gh6, @gh7, @gh8)',
      'ST_DISTANCE(c.location, {"type":"Point","coordinates":[@lon,@lat]}) <= @radius',
    ];
    const parameters: { name: string; value: unknown }[] = [
      ...geohashes.map((gh, i) => ({ name: `@gh${i}`, value: gh })),
      { name: '@lon', value: longitude },
      { name: '@lat', value: latitude },
      { name: '@radius', value: radiusMeters },
    ];

    if (propertyType) {
      whereClauses.push('c.propertyDetail.attomPropertyType = @propType');
      parameters.push({ name: '@propType', value: propertyType });
    }
    if (minBedrooms != null) {
      whereClauses.push('c.propertyDetail.bedroomsTotal >= @minBed');
      parameters.push({ name: '@minBed', value: minBedrooms });
    }
    if (maxBedrooms != null) {
      whereClauses.push('c.propertyDetail.bedroomsTotal <= @maxBed');
      parameters.push({ name: '@maxBed', value: maxBedrooms });
    }
    if (minSqft != null) {
      whereClauses.push('c.propertyDetail.livingAreaSqft >= @minSqft');
      parameters.push({ name: '@minSqft', value: minSqft });
    }
    if (maxSqft != null) {
      whereClauses.push('c.propertyDetail.livingAreaSqft <= @maxSqft');
      parameters.push({ name: '@maxSqft', value: maxSqft });
    }
    if (minSaleDate) {
      whereClauses.push('c.salesHistory.lastSaleDate >= @minSaleDate');
      parameters.push({ name: '@minSaleDate', value: minSaleDate });
    }
    if (maxSaleDate) {
      whereClauses.push('c.salesHistory.lastSaleDate <= @maxSaleDate');
      parameters.push({ name: '@maxSaleDate', value: maxSaleDate });
    }

    const query = `
      SELECT c, ST_DISTANCE(c.location, {"type":"Point","coordinates":[@lon,@lat]}) AS dist
      FROM c
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY c.salesHistory.lastSaleDate DESC
      OFFSET 0 LIMIT @maxResults
    `;
    parameters.push({ name: '@maxResults', value: maxResults });

    this.logger.info('Executing comp search', {
      latitude,
      longitude,
      radiusMeters,
      geohashCount: geohashes.length,
      filterCount: whereClauses.length,
    });

    const result = await this.cosmos.queryItems<{ c: AttomDataDocument; dist: number }>(
      CONTAINER,
      query,
      parameters,
    );

    if (!result.success || !result.data) {
      this.logger.error('Comp search query failed', {
        latitude,
        longitude,
        radiusMeters,
        error: result.error,
      });
      return [];
    }

    this.logger.info('Comp search returned results', { count: result.data.length });

    return result.data.map((r) => ({
      document: r.c,
      distanceMeters: r.dist,
    }));
  }

  /**
   * Point-read a specific property by attomId.
   *
   * If geohash5 is provided, this is a true point-read (O(1) RU).
   * If only attomId is provided, falls back to cross-partition query (~5-15 RU).
   */
  async getByAttomId(attomId: string, geohash5?: string): Promise<AttomDataDocument | null> {
    const result = await this.cosmos.getItem<AttomDataDocument>(CONTAINER, attomId, geohash5);
    return result.success && result.data ? result.data : null;
  }
}
