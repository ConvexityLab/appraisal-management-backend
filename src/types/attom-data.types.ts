/**
 * Types for the attom-data CosmosDB container.
 *
 * This container stores ATTOM property records partitioned by geohash-5
 * for efficient spatial comparable-property search.
 *
 * Partition key: /geohash5 (geohash precision-5 of the property's lat/lon)
 * Document id:   attomId   (enables cross-partition point-read by ATTOM ID)
 */

import type {
  GeoJsonPoint,
  PropertyCacheAddress,
  PropertyCacheDetail,
  PropertyCacheAssessment,
  PropertyCacheSalesHistory,
  PropertyCacheMlsData,
} from '../services/property-data-cache.service.js';
import type { GeohashExpansion } from '../utils/geohash.util.js';

/**
 * Document stored in the attom-data container.
 *
 * Key difference from PropertyDataCacheEntry:
 * - Partition key is `geohash5` (not `attomId`)
 * - `location` is non-nullable (rows without valid lat/lon are skipped at ingestion)
 * - Type discriminator is `'attom-data'`
 */
export interface AttomDataDocument {
  /** Cosmos document id — same as attomId for uniqueness */
  id: string;
  type: 'attom-data';
  /** Partition key — geohash precision 5 (~4.9km × 4.9km cell) */
  geohash5: string;
  /** ATTOM property identifier (stored as string) */
  attomId: string;
  apnFormatted: string;
  /** ISO timestamp when this entry was ingested */
  ingestedAt: string;
  /** ISO timestamp from the source data (DBUPDATEDATE or DBCREATEDATE) */
  sourcedAt: string;

  address: PropertyCacheAddress;
  /** GeoJSON Point [longitude, latitude] for ST_DISTANCE queries */
  location: GeoJsonPoint;
  propertyDetail: PropertyCacheDetail;
  assessment: PropertyCacheAssessment;
  salesHistory: PropertyCacheSalesHistory;
  mlsData: PropertyCacheMlsData;

  /** Full raw CSV row preserved for debugging / future field extraction */
  rawData: Record<string, string>;
}

/** Parameters for a comparable property search. */
export interface CompSearchParams {
  /** Subject property longitude */
  longitude: number;
  /** Subject property latitude */
  latitude: number;
  /** Search radius in meters (1 mile ≈ 1609.34m) */
  radiusMeters: number;
  /** Filter by ATTOM property type (e.g. 'SFR') */
  propertyType?: string;
  /** Minimum bedrooms */
  minBedrooms?: number;
  /** Maximum bedrooms */
  maxBedrooms?: number;
  /** Minimum living area sqft */
  minSqft?: number;
  /** Maximum living area sqft */
  maxSqft?: number;
  /** Minimum last sale date (ISO string, e.g. '2023-01-01') */
  minSaleDate?: string;
  /** Maximum last sale date (ISO string) */
  maxSaleDate?: string;
  /** Maximum results to return (default 50) */
  maxResults?: number;
  /**
   * Geohash cell expansion strategy. Defaults to `'ALWAYS_9'` to preserve
   * the historical behavior of always querying the subject cell + 8 neighbors.
   *
   * - `NONE`     Query only the subject cell (1 partition).
   * - `ADAPTIVE` Query the subject cell first; expand to 8 neighbors only when
   *              the first query returns fewer than {@link adaptiveMinResults}
   *              records. Best RU/coverage trade-off for mixed urban/rural data.
   * - `ALWAYS_9` Query the subject cell + 8 neighbors in a single call.
   */
  expansion?: GeohashExpansion;
  /**
   * Threshold used by `ADAPTIVE` expansion: if the first (1-cell) query
   * returns fewer than this many records, the search expands to the 8
   * neighbor cells. Defaults to {@link maxResults}. Ignored unless
   * `expansion === 'ADAPTIVE'`.
   */
  adaptiveMinResults?: number;
}

/** A comp search result with distance from subject. */
export interface CompSearchResult {
  document: AttomDataDocument;
  distanceMeters: number;
}
