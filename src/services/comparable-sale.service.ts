/**
 * Comparable Sale Service — Phase R1.4
 *
 * Manages PropertyComparableSale documents in the `comparable-sales` container.
 * Partition key: /zipCode
 *
 * Responsibilities:
 *   - Ingest MLS or public-records comp data into the platform's persistent
 *     comparable-sale database (idempotent on mlsNumber + source)
 *   - Search by property, by geography (radius), or by filter criteria
 *   - Track which report documents selected a comp, for auditing
 *
 * The comparable-sale database replaces direct MLS API calls as the primary
 * comp source. See Phase R4 for the MLS fall-through strategy.
 *
 * Cosmos container: `comparable-sales`  (partition key: /zipCode)
 *
 * This service does NOT create the Cosmos container.
 * The container MUST be provisioned via Bicep before this service runs.
 *
 * @see PROPERTY_DATA_REFACTOR_PLAN.md — Phase R1.4
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { PropertyRecordService } from './property-record.service.js';
import { PropertyRecordType } from '../types/property-record.types.js';
import type {
  PropertyComparableSale,
  ComparableSaleSearchFilters,
  CreateComparableSaleFromMlsInput,
} from '../types/comparable-sale.types.js';
import type { MlsListing } from '../types/mls-data.types.js';

// ─── Container name constant ──────────────────────────────────────────────────

export const COMPARABLE_SALES_CONTAINER = 'comparable-sales';

// ─── Haversine distance (pure, exported for testing) ─────────────────────────

const EARTH_RADIUS_MILES = 3_958.8;

/**
 * Returns the great-circle distance in miles between two lat/lng points.
 */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Approximate lat/lng bounding box for a center point + radius in miles.
 * Used as a Cosmos pre-filter before exact haversine distance filtering.
 */
function latLngBoundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const latDelta = radiusMiles / EARTH_RADIUS_MILES * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
}

// ─── ComparableSaleService ────────────────────────────────────────────────────

export class ComparableSaleService {
  private readonly logger = new Logger('ComparableSaleService');

  constructor(
    private readonly cosmosService: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateId(mlsNumber?: string, source?: string): string {
    if (mlsNumber && source) {
      // Deterministic ID when MLS number is known — enables upsert idempotency
      const hash = `${source}:${mlsNumber}`.replace(/\W/g, '-').toLowerCase();
      return `comp-${hash}`;
    }
    return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ─── ingestFromMls ──────────────────────────────────────────────────────────

  /**
   * Ingests an MLS listing into the platform's persistent comparable-sale
   * database. Idempotent: if a record with the same mlsNumber + source already
   * exists, it is updated (for ACTIVE/PENDING status changes) rather than
   * duplicated. SOLD records are never modified after initial ingestion.
   *
   * Resolves the `propertyId` FK via `PropertyRecordService.resolveOrCreate()`.
   *
   * @throws if tenantId is empty
   * @throws if listing lacks both a street address and a valid saleDate
   */
  async ingestFromMls(
    listing: MlsListing,
    tenantId: string,
    ingestedBy: string = 'SYSTEM'
  ): Promise<PropertyComparableSale> {
    if (!tenantId) {
      throw new Error('ComparableSaleService.ingestFromMls: tenantId is required');
    }
    if (!listing.address) {
      throw new Error('ComparableSaleService.ingestFromMls: listing.address is required');
    }

    // ── Dedup: check if this MLS record already exists ─────────────────────
    const existingId = this.generateId(listing.listingId ?? listing.id, listing.source);
    const existing = await this.cosmosService.getDocument<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      existingId,
      listing.zipCode
    );

    if (existing) {
      // SOLD records are immutable — never modify once closed
      if (existing.status === 'SOLD') {
        this.logger.info('ingestFromMls: SOLD record already exists, skipping update', {
          id: existingId,
          mlsNumber: listing.listingId ?? listing.id,
          source: listing.source,
        });
        return existing;
      }

      // ACTIVE/PENDING: update status and price only
      const updated: PropertyComparableSale = {
        ...existing,
        salePrice: listing.salePrice,
        listPrice: listing.salePrice,
        updatedAt: new Date().toISOString(),
        rawProviderData: listing,
      };
      const result = await this.cosmosService.upsertDocument<PropertyComparableSale>(
        COMPARABLE_SALES_CONTAINER,
        updated
      );
      this.logger.info('ingestFromMls: updated existing comp', {
        id: existingId,
        tenantId,
        source: listing.source,
      });
      return result;
    }

    // ── Resolve propertyId from address ───────────────────────────────────
    const resolution = await this.propertyRecordService.resolveOrCreate({
      address: {
        street: listing.address,
        city: listing.city,
        state: listing.state,
        zip: listing.zipCode,
        latitude: listing.latitude,
        longitude: listing.longitude,
      },
      tenantId,
      createdBy: ingestedBy,
      propertyType: PropertyRecordType.SINGLE_FAMILY,
      building: {
        gla: listing.squareFootage,
        yearBuilt: listing.yearBuilt,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
      },
    });

    // ── Build the new comp record ─────────────────────────────────────────
    const now = new Date().toISOString();
    const comp: PropertyComparableSale = {
      id: existingId,
      tenantId,
      propertyId: resolution.propertyId,
      propertyIdResolvedBy: resolution.method,

      mlsNumber: listing.listingId ?? listing.id,
      source: listing.source,
      status: 'SOLD',   // MlsListing is a completed sale record

      streetAddress: listing.address,
      city: listing.city,
      state: listing.state,
      zipCode: listing.zipCode,
      latitude: listing.latitude,
      longitude: listing.longitude,

      salePrice: listing.salePrice,
      saleDate: listing.saleDate,
      listPrice: listing.salePrice,

      glaAtSale: listing.squareFootage,
      bedroomsAtSale: listing.bedrooms,
      bathroomsAtSale: listing.bathrooms,
      yearBuilt: listing.yearBuilt,
      ...(listing.lotSize !== undefined && { lotSizeSqFt: listing.lotSize }),
      propertyType: listing.propertyType,

      usedInReportIds: [],
      rawProviderData: listing,

      ingestedAt: now,
      updatedAt: now,
      ingestedBy,
    };

    const created = await this.cosmosService.createDocument<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      comp
    );

    this.logger.info('ingestFromMls: created new comp', {
      id: created.id,
      tenantId,
      propertyId: resolution.propertyId,
      isNewProperty: resolution.isNew,
      source: listing.source,
    });

    return created;
  }

  // ─── findByPropertyId ────────────────────────────────────────────────────────

  /**
   * Returns all comparable sales recorded for a given PropertyRecord.
   *
   * Cross-partition query (comparable-sales is partitioned by /zipCode).
   */
  async findByPropertyId(
    propertyId: string,
    tenantId: string
  ): Promise<PropertyComparableSale[]> {
    if (!propertyId) {
      throw new Error('ComparableSaleService.findByPropertyId: propertyId is required');
    }
    if (!tenantId) {
      throw new Error('ComparableSaleService.findByPropertyId: tenantId is required');
    }

    return this.cosmosService.queryDocuments<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.propertyId = @propertyId ORDER BY c.saleDate DESC',
      [
        { name: '@tenantId',   value: tenantId },
        { name: '@propertyId', value: propertyId },
      ]
    );
  }

  // ─── findByRadius ────────────────────────────────────────────────────────────

  /**
   * Finds comparable sales within a geographic radius.
   *
   * Strategy:
   *   1. Compute a lat/lng bounding box and emit a Cosmos range query (fast,
   *      leverages the latitude/longitude index if configured).
   *   2. Apply the exact haversine circle filter client-side.
   *   3. Apply optional date, price, GLA, bedroom, type filters.
   *   4. Sort by ascending distance from center.
   *   5. Return up to `limit` results (default 50).
   *
   * Records without lat/lng are excluded (cannot compute distance).
   *
   * @throws if lat/lng are missing or radiusMiles <= 0
   */
  async findByRadius(
    filters: ComparableSaleSearchFilters,
    tenantId: string
  ): Promise<PropertyComparableSale[]> {
    if (filters.latitude == null || filters.longitude == null) {
      throw new Error(
        'ComparableSaleService.findByRadius: latitude and longitude are required'
      );
    }
    if (!filters.radiusMiles || filters.radiusMiles <= 0) {
      throw new Error(
        `ComparableSaleService.findByRadius: radiusMiles must be > 0, got ${filters.radiusMiles}`
      );
    }
    if (!tenantId) {
      throw new Error('ComparableSaleService.findByRadius: tenantId is required');
    }

    const box = latLngBoundingBox(filters.latitude, filters.longitude, filters.radiusMiles);

    // Build optional filter clauses
    const params: { name: string; value: unknown }[] = [
      { name: '@tenantId', value: tenantId },
      { name: '@latMin',   value: box.latMin },
      { name: '@latMax',   value: box.latMax },
      { name: '@lngMin',   value: box.lngMin },
      { name: '@lngMax',   value: box.lngMax },
    ];

    let query =
      'SELECT * FROM c ' +
      'WHERE c.tenantId = @tenantId ' +
      'AND c.latitude BETWEEN @latMin AND @latMax ' +
      'AND c.longitude BETWEEN @lngMin AND @lngMax';

    if (filters.saleDateMin) {
      query += ' AND c.saleDate >= @saleDateMin';
      params.push({ name: '@saleDateMin', value: filters.saleDateMin });
    }
    if (filters.saleDateMax) {
      query += ' AND c.saleDate <= @saleDateMax';
      params.push({ name: '@saleDateMax', value: filters.saleDateMax });
    }
    if (filters.salePriceMin != null) {
      query += ' AND c.salePrice >= @salePriceMin';
      params.push({ name: '@salePriceMin', value: filters.salePriceMin });
    }
    if (filters.salePriceMax != null) {
      query += ' AND c.salePrice <= @salePriceMax';
      params.push({ name: '@salePriceMax', value: filters.salePriceMax });
    }
    if (filters.glaMin != null) {
      query += ' AND c.glaAtSale >= @glaMin';
      params.push({ name: '@glaMin', value: filters.glaMin });
    }
    if (filters.glaMax != null) {
      query += ' AND c.glaAtSale <= @glaMax';
      params.push({ name: '@glaMax', value: filters.glaMax });
    }
    if (filters.bedroomsMin != null) {
      query += ' AND c.bedroomsAtSale >= @bedroomsMin';
      params.push({ name: '@bedroomsMin', value: filters.bedroomsMin });
    }

    const candidates = await this.cosmosService.queryDocuments<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      query,
      params
    );

    // ── Exact distance filter + optional property-type filter ──────────────
    const limit = filters.limit ?? 50;
    const center = { lat: filters.latitude, lng: filters.longitude };

    interface Ranked { comp: PropertyComparableSale; distMiles: number }
    const ranked: Ranked[] = [];

    for (const comp of candidates) {
      if (comp.latitude == null || comp.longitude == null) {
        continue;
      }

      const dist = haversineDistanceMiles(
        center.lat,
        center.lng,
        comp.latitude,
        comp.longitude
      );

      if (dist > filters.radiusMiles) {
        continue;
      }

      // Optional property type filter
      if (
        filters.propertyType &&
        filters.propertyType.length > 0 &&
        comp.propertyType &&
        !filters.propertyType.includes(comp.propertyType)
      ) {
        continue;
      }

      // Optional status filter
      if (filters.status && filters.status.length > 0 && !filters.status.includes(comp.status)) {
        continue;
      }

      // Optional transaction type filter
      if (
        filters.transactionType &&
        filters.transactionType.length > 0 &&
        comp.transactionType &&
        !filters.transactionType.includes(comp.transactionType)
      ) {
        continue;
      }

      ranked.push({ comp, distMiles: dist });
    }

    // Sort by distance ascending, then apply limit
    ranked.sort((a, b) => a.distMiles - b.distMiles);
    return ranked.slice(0, limit).map((r) => r.comp);
  }

  // ─── getById ────────────────────────────────────────────────────────────────

  /**
   * Retrieves a single comparable sale by ID.
   * Partition key is zipCode — must be provided for efficient lookup.
   *
   * Returns null if not found.
   */
  async getById(id: string, zipCode: string): Promise<PropertyComparableSale | null> {
    if (!id) {
      throw new Error('ComparableSaleService.getById: id is required');
    }
    if (!zipCode) {
      throw new Error('ComparableSaleService.getById: zipCode is required');
    }

    return this.cosmosService.getDocument<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      id,
      zipCode
    );
  }

  // ─── markUsedInReport ────────────────────────────────────────────────────────

  /**
   * Records that a report selected this comp. Appends `reportId` to
   * `usedInReportIds[]` if not already present. Idempotent.
   *
   * @throws if the comp is not found
   */
  async markUsedInReport(id: string, zipCode: string, reportId: string): Promise<void> {
    if (!id || !zipCode || !reportId) {
      throw new Error(
        'ComparableSaleService.markUsedInReport: id, zipCode, and reportId are all required'
      );
    }

    const comp = await this.getById(id, zipCode);
    if (!comp) {
      throw new Error(
        `ComparableSaleService.markUsedInReport: comp "${id}" not found for zipCode "${zipCode}"`
      );
    }

    const existing = comp.usedInReportIds ?? [];
    if (existing.includes(reportId)) {
      return; // already recorded — idempotent
    }

    const updated: PropertyComparableSale = {
      ...comp,
      usedInReportIds: [...existing, reportId],
      updatedAt: new Date().toISOString(),
    };

    await this.cosmosService.upsertDocument<PropertyComparableSale>(
      COMPARABLE_SALES_CONTAINER,
      updated
    );

    this.logger.info('markUsedInReport: updated comp usage', {
      id,
      reportId,
      totalUsages: updated.usedInReportIds!.length,
    });
  }
}
