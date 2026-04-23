/**
 * ATTOM Data Comparable Search Service
 *
 * Queries the attom-data CosmosDB container (partitioned by geohash-5)
 * to find comparable properties within a radius of a subject property.
 *
 * Query strategy:
 *   1. Compute the subject's geohash-5 cell, optionally expanding to its
 *      8 neighbors per the caller's `expansion` strategy.
 *   2. Issue a query targeting those partitions via IN clause.
 *   3. Apply ST_DISTANCE for precise radius filtering.
 *   4. Apply optional attribute filters (property type, bedrooms, sqft, sale date).
 *   5. Return results sorted by sale recency with computed distances.
 *
 * Expansion strategies (see {@link GeohashExpansion}):
 *   - NONE     1 partition queried.
 *   - ADAPTIVE 1 partition queried first; if results < `adaptiveMinResults`,
 *              the 8 neighbor partitions are queried in a second call and
 *              results are merged (deduped by attomId), re-sorted, and capped.
 *   - ALWAYS_9 9 partitions queried in a single call (default; preserves
 *              historical behavior).
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import {
  encodeGeohash,
  getGeohashNeighbors,
  getSearchGeohashes,
  type GeohashExpansion,
} from '../utils/geohash.util.js';
import type { AttomDataDocument, CompSearchParams, CompSearchResult } from '../types/attom-data.types.js';

const CONTAINER = 'attom-data';
const GEOHASH_PRECISION = 5;
const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_EXPANSION: GeohashExpansion = 'ALWAYS_9';

/** Internal query filter inputs that are stable across cell-expansion retries. */
interface QueryFilters {
  longitude: number;
  latitude: number;
  radiusMeters: number;
  propertyType: string | undefined;
  minBedrooms: number | undefined;
  maxBedrooms: number | undefined;
  minSqft: number | undefined;
  maxSqft: number | undefined;
  minSaleDate: string | undefined;
  maxSaleDate: string | undefined;
  maxResults: number;
}

export class AttomDataCompSearchService {
  private readonly logger: Logger;

  constructor(private readonly cosmos: CosmosDbService) {
    this.logger = new Logger('AttomDataCompSearchService');
  }

  /**
   * Search for comparable properties within a radius of a subject property.
   *
   * The query targets between 1 and 9 geohash partitions (controlled by
   * `params.expansion`), then applies ST_DISTANCE for precise circle filtering
   * within those partitions. Results are ordered by most recent sale date first.
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
      expansion = DEFAULT_EXPANSION,
      adaptiveMinResults,
    } = params;

    const filters: QueryFilters = {
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
      maxResults,
    };

    if (expansion === 'NONE') {
      const cells = [encodeGeohash(latitude, longitude, GEOHASH_PRECISION)];
      return this.runQuery(cells, filters, { expansion, expansionTriggered: false });
    }

    if (expansion === 'ALWAYS_9') {
      const cells = getSearchGeohashes(latitude, longitude, GEOHASH_PRECISION);
      return this.runQuery(cells, filters, { expansion, expansionTriggered: false });
    }

    // ADAPTIVE: query the center cell first; expand to neighbors only on under-fill.
    const center = encodeGeohash(latitude, longitude, GEOHASH_PRECISION);
    const threshold = adaptiveMinResults ?? maxResults;
    const centerResults = await this.runQuery([center], filters, {
      expansion,
      expansionTriggered: false,
    });

    if (centerResults.length >= threshold) {
      return centerResults;
    }

    const neighbors = getGeohashNeighbors(latitude, longitude, GEOHASH_PRECISION);
    const neighborResults = await this.runQuery(neighbors, filters, {
      expansion,
      expansionTriggered: true,
    });

    return mergeAndCap(centerResults, neighborResults, maxResults);
  }

  /**
   * Issue a single Cosmos query against the supplied geohash partitions.
   * Caller decides which/how many cells to scan; this method only builds the
   * SQL, parameter list, and emits the audit log line.
   */
  private async runQuery(
    cells: string[],
    filters: QueryFilters,
    audit: { expansion: GeohashExpansion; expansionTriggered: boolean },
  ): Promise<CompSearchResult[]> {
    if (cells.length === 0) {
      throw new Error('runQuery requires at least one geohash cell');
    }

    const cellPlaceholders = cells.map((_, i) => `@gh${i}`).join(', ');
    const whereClauses: string[] = [
      `c.geohash5 IN (${cellPlaceholders})`,
      'ST_DISTANCE(c.location, {"type":"Point","coordinates":[@lon,@lat]}) <= @radius',
    ];
    const parameters: { name: string; value: unknown }[] = [
      ...cells.map((gh, i) => ({ name: `@gh${i}`, value: gh })),
      { name: '@lon', value: filters.longitude },
      { name: '@lat', value: filters.latitude },
      { name: '@radius', value: filters.radiusMeters },
    ];

    if (filters.propertyType) {
      whereClauses.push('c.propertyDetail.attomPropertyType = @propType');
      parameters.push({ name: '@propType', value: filters.propertyType });
    }
    if (filters.minBedrooms != null) {
      whereClauses.push('c.propertyDetail.bedroomsTotal >= @minBed');
      parameters.push({ name: '@minBed', value: filters.minBedrooms });
    }
    if (filters.maxBedrooms != null) {
      whereClauses.push('c.propertyDetail.bedroomsTotal <= @maxBed');
      parameters.push({ name: '@maxBed', value: filters.maxBedrooms });
    }
    if (filters.minSqft != null) {
      whereClauses.push('c.propertyDetail.livingAreaSqft >= @minSqft');
      parameters.push({ name: '@minSqft', value: filters.minSqft });
    }
    if (filters.maxSqft != null) {
      whereClauses.push('c.propertyDetail.livingAreaSqft <= @maxSqft');
      parameters.push({ name: '@maxSqft', value: filters.maxSqft });
    }
    if (filters.minSaleDate) {
      whereClauses.push('c.salesHistory.lastSaleDate >= @minSaleDate');
      parameters.push({ name: '@minSaleDate', value: filters.minSaleDate });
    }
    if (filters.maxSaleDate) {
      whereClauses.push('c.salesHistory.lastSaleDate <= @maxSaleDate');
      parameters.push({ name: '@maxSaleDate', value: filters.maxSaleDate });
    }

    const query = `
      SELECT c, ST_DISTANCE(c.location, {"type":"Point","coordinates":[@lon,@lat]}) AS dist
      FROM c
      WHERE ${whereClauses.join('\n        AND ')}
      ORDER BY c.salesHistory.lastSaleDate DESC
      OFFSET 0 LIMIT @maxResults
    `;
    parameters.push({ name: '@maxResults', value: filters.maxResults });

    this.logger.info('Executing comp search', {
      latitude: filters.latitude,
      longitude: filters.longitude,
      radiusMeters: filters.radiusMeters,
      expansion: audit.expansion,
      expansionTriggered: audit.expansionTriggered,
      cellsQueried: cells,
      cellCount: cells.length,
      filterCount: whereClauses.length,
    });

    const result = await this.cosmos.queryItems<{ c: AttomDataDocument; dist: number }>(
      CONTAINER,
      query,
      parameters,
    );

    if (!result.success || !result.data) {
      this.logger.error('Comp search query failed', {
        latitude: filters.latitude,
        longitude: filters.longitude,
        radiusMeters: filters.radiusMeters,
        expansion: audit.expansion,
        cellsQueried: cells,
        error: result.error,
      });
      return [];
    }

    this.logger.info('Comp search returned results', {
      count: result.data.length,
      expansion: audit.expansion,
      expansionTriggered: audit.expansionTriggered,
    });

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

/**
 * Merge the center-cell and neighbor-cell results into a single list, deduped
 * by `document.attomId`, re-sorted by `lastSaleDate DESC` (matching the SQL
 * ORDER BY), and capped to `maxResults`.
 *
 * Center results take precedence on duplicate keys — they came from the
 * partition that's geographically closest to the subject.
 */
function mergeAndCap(
  centerResults: CompSearchResult[],
  neighborResults: CompSearchResult[],
  maxResults: number,
): CompSearchResult[] {
  const seen = new Set<string>();
  const merged: CompSearchResult[] = [];
  for (const r of [...centerResults, ...neighborResults]) {
    const key = r.document.attomId;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  merged.sort((a, b) => {
    // ISO date strings sort lexicographically. Missing/empty sorts last.
    const ad = a.document.salesHistory?.lastSaleDate ?? '';
    const bd = b.document.salesHistory?.lastSaleDate ?? '';
    if (ad === bd) return 0;
    return ad < bd ? 1 : -1;
  });
  return merged.slice(0, maxResults);
}
