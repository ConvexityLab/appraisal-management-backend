/**
 * Property Data Cache Service
 *
 * Persistent, provider-agnostic cache for third-party property data.
 * All external property data (ATTOM, Bridge, etc.) flows through here:
 *   - Always read-from-cache first
 *   - Write-through on every live API response
 *   - Pre-populated via the ATTOM CSV ingestion script
 *
 * CosmosDB container: property-data-cache
 * Partition key: /attomId  (string — the ATTOM integer ID stored as string)
 *
 * Geospatial: documents store a GeoJSON Point at /location for ST_DISTANCE queries.
 * IMPORTANT: GeoJSON order is [longitude, latitude] — NOT [lat, lon].
 */

import { SqlQuerySpec } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PropertyDataSource = 'attom-csv-import' | 'attom-api' | 'bridge-api' | 'manual';

export interface PropertyCacheAddress {
  full: string;
  houseNumber: string;
  streetDirection: string;
  streetName: string;
  streetSuffix: string;
  streetPostDirection: string;
  unitPrefix: string;
  unitValue: string;
  city: string;
  state: string;
  zip: string;
  zip4: string;
  county: string;
}

export interface PropertyCacheAssessment {
  taxYear: string;
  assessedValueTotal: number | null;
  marketValue: number | null;
  marketValueDate: string;
  taxAmount: number | null;
}

export interface PropertyCacheSalesHistory {
  lastSaleDate: string;
  lastSaleAmount: number | null;
}

export interface PropertyCacheDetail {
  attomPropertyType: string;
  attomPropertySubtype: string;
  mlsPropertyType: string;
  mlsPropertySubtype: string;
  yearBuilt: number | null;
  livingAreaSqft: number | null;
  lotSizeAcres: number | null;
  lotSizeSqft: number | null;
  bedroomsTotal: number | null;
  bathroomsFull: number | null;
  bathroomsHalf: number | null;
  stories: string;
  garageSpaces: number | null;
  poolPrivate: boolean;
}

export interface PropertyCacheMlsData {
  mlsListingId: string;
  mlsRecordId: string;
  mlsNumber: string;
  mlsSource: string;
  listingStatus: string;
  currentStatus: string;
  listingDate: string;
  latestListingPrice: number | null;
  previousListingPrice: number | null;
  soldDate: string;
  soldPrice: number | null;
  daysOnMarket: number | null;
  pendingDate: string;
  originalListingDate: string;
  originalListingPrice: number | null;
}

/** GeoJSON Point — [longitude, latitude] */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface PropertyDataCacheEntry {
  /** Cosmos document id — same as attomId for point-read efficiency */
  id: string;
  type: 'property-data-cache';
  /** Partition key */
  attomId: string;
  apnFormatted: string;
  source: PropertyDataSource;
  /** ISO timestamp when this entry was written to cache */
  cachedAt: string;
  /** ISO timestamp of the source data's own update time (e.g. DBUPDATEDATE from CSV) */
  sourcedAt: string;
  address: PropertyCacheAddress;
  /** GeoJSON Point stored as [longitude, latitude] for ST_DISTANCE queries */
  location: GeoJsonPoint | null;
  propertyDetail: PropertyCacheDetail;
  assessment: PropertyCacheAssessment;
  salesHistory: PropertyCacheSalesHistory;
  mlsData: PropertyCacheMlsData;
  /** Full raw data row from the source (all provider fields) */
  rawData: Record<string, string>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const CONTAINER = 'property-data-cache';

export class PropertyDataCacheService {
  private readonly logger: Logger;

  constructor(private readonly cosmos: CosmosDbService) {
    this.logger = new Logger('PropertyDataCacheService');
  }

  /**
   * Look up a cached property by ATTOM ID (point-read — fastest path).
   */
  async getByAttomId(attomId: string): Promise<PropertyDataCacheEntry | null> {
    const result = await this.cosmos.getItem<PropertyDataCacheEntry>(
      CONTAINER,
      attomId,  // id === attomId
      attomId,  // partition key === attomId
    );
    if (!result.success || !result.data) return null;
    return result.data;
  }

  /**
   * Look up a cached property by normalised address fields.
   * Uses the composite index: /address/zip, /address/houseNumber, /address/streetName.
   *
   * Returns the first match (addresses should be unique within a zip).
   */
  async getByAddress(
    houseNumber: string,
    streetName: string,
    zip: string,
  ): Promise<PropertyDataCacheEntry | null> {
    const normalizedStreet = streetName.trim().toUpperCase();
    const normalizedHouse = houseNumber.trim();
    const normalizedZip = zip.trim();

    const query: SqlQuerySpec = {
      query: `SELECT * FROM c
              WHERE c.address.zip = @zip
                AND c.address.houseNumber = @houseNumber
                AND UPPER(c.address.streetName) = @streetName
              OFFSET 0 LIMIT 1`,
      parameters: [
        { name: '@zip', value: normalizedZip },
        { name: '@houseNumber', value: normalizedHouse },
        { name: '@streetName', value: normalizedStreet },
      ],
    };

    const result = await this.cosmos.queryItems<PropertyDataCacheEntry>(
      CONTAINER,
      query.query,
      query.parameters,
    );

    if (!result.success || !result.data || result.data.length === 0) return null;
    return result.data[0] ?? null;
  }

  /**
   * Look up by APN within a state.
   */
  async getByApn(
    apnFormatted: string,
    state: string,
  ): Promise<PropertyDataCacheEntry | null> {
    const result = await this.cosmos.queryItems<PropertyDataCacheEntry>(
      CONTAINER,
      `SELECT * FROM c WHERE c.apnFormatted = @apn AND c.address.state = @state OFFSET 0 LIMIT 1`,
      [
        { name: '@apn', value: apnFormatted.trim().toUpperCase() },
        { name: '@state', value: state.trim().toUpperCase() },
      ],
    );
    if (!result.success || !result.data || result.data.length === 0) return null;
    return result.data[0] ?? null;
  }

  /**
   * Geospatial radius search — returns all cached properties within radiusMeters
   * of the given point, up to maxResults.
   *
   * Uses the Cosmos DB spatial index on /location.
   * This is a cross-partition query; pair with a state filter for better RU efficiency.
   *
   * @param longitude  WGS-84 longitude (e.g. -81.65 for Jacksonville)
   * @param latitude   WGS-84 latitude  (e.g.  30.33 for Jacksonville)
   * @param radiusMeters  Search radius in metres (1 mile ≈ 1609m)
   * @param stateFilter   Optional 2-letter state code to reduce cross-partition fan-out
   * @param maxResults    Maximum results to return (default 200)
   */
  async searchByRadius(
    longitude: number,
    latitude: number,
    radiusMeters: number,
    stateFilter?: string,
    maxResults = 200,
  ): Promise<PropertyDataCacheEntry[]> {
    const stateClause = stateFilter
      ? `AND c.address.state = @state`
      : '';

    const parameters: { name: string; value: unknown }[] = [
      { name: '@lon', value: longitude },
      { name: '@lat', value: latitude },
      { name: '@radius', value: radiusMeters },
      { name: '@limit', value: maxResults },
    ];
    if (stateFilter) {
      parameters.push({ name: '@state', value: stateFilter.toUpperCase() });
    }

    const result = await this.cosmos.queryItems<PropertyDataCacheEntry>(
      CONTAINER,
      `SELECT TOP @limit *
       FROM c
       WHERE ST_DISTANCE(c.location, {"type": "Point", "coordinates": [@lon, @lat]}) <= @radius
       ${stateClause}`,
      parameters,
    );

    if (!result.success || !result.data) {
      this.logger.error('Geo radius search failed', { longitude, latitude, radiusMeters });
      return [];
    }
    return result.data;
  }

  /**
   * Write (or overwrite) a single property entry.
   * Called by the ingestion script and by the provider service after a live API fetch.
   */
  async upsert(entry: PropertyDataCacheEntry): Promise<void> {
    const result = await this.cosmos.upsertItem<PropertyDataCacheEntry>(CONTAINER, entry);
    if (!result.success) {
      throw new Error(
        `PropertyDataCacheService: failed to upsert attomId=${entry.attomId}: ${result.error?.message ?? 'unknown error'}`,
      );
    }
  }

  /**
   * Bulk upsert a batch of entries.
   * Used by the ingestion script — batches improve throughput vs. individual upserts.
   *
   * Fires individual upserts concurrently in the batch. Cosmos SDK v4 does not expose
   * a public partition-spanning bulk API without splitting by partition key, and since
   * each entry has a unique attomId partition key, the direct route is concurrent upserts.
   * Batches are kept small (≤100) to avoid overwhelming the RU budget.
   */
  async upsertBatch(entries: PropertyDataCacheEntry[]): Promise<{ succeeded: number; failed: number }> {
    if (entries.length === 0) return { succeeded: 0, failed: 0 };

    const results = await Promise.allSettled(
      entries.map((entry) => this.upsert(entry)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      const firstFailure = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      this.logger.warn(`PropertyDataCacheService: ${failed}/${entries.length} upserts failed in batch`, {
        firstError: firstFailure?.reason instanceof Error ? firstFailure.reason.message : String(firstFailure?.reason),
      });
    }

    return { succeeded, failed };
  }

  /**
   * Determine whether a cached entry should be considered stale.
   *
   * @param entry    The cached entry to check
   * @param ttlDays  Maximum age in days before considered stale. If undefined or 0, never stale.
   */
  isStale(entry: PropertyDataCacheEntry, ttlDays: number | undefined): boolean {
    if (!ttlDays || ttlDays <= 0) return false;
    const ageMs = Date.now() - new Date(entry.cachedAt).getTime();
    return ageMs > ttlDays * 24 * 60 * 60 * 1000;
  }
}
