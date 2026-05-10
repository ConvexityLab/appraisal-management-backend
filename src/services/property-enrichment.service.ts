/**
 * Property Enrichment Service
 *
 * Fetches subject-property data from the configured PropertyDataProvider
 * and merges it into the platform's PropertyRecord for the order address.
 *
 * Responsibilities:
 *   1. Resolve (or create) the PropertyRecord for the order address.
 *   2. Call the configured PropertyDataProvider for core + public-record + flood data.
 *   3. If a result is returned:
 *      - Apply enriched data to the PropertyRecord via createVersion()
 *        (preserves full audit trail; no silent overwrites).
 *      - Emit immutable tax/AVM observations for time-series facts instead of
 *        storing those histories as root truth on PropertyRecord.
 *   4. Persist the raw enrichment result in the `property-enrichments` container
 *      for traceability and debugging.
 *   5. Return a typed EnrichmentResult.
 *
 * This service is intentionally stateless and dependency-injected:
 *   - In tests: pass a mock PropertyDataProvider via the constructor.
 *   - In production: omit the provider argument; the factory is used.
 *
 * Cosmos container: `property-enrichments`  (partition key: /tenantId)
 *
 * @see src/services/property-data-providers/factory.ts
 * @see PROPERTY_DATA_REFACTOR_PLAN.md
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { PropertyRecordService } from './property-record.service.js';
import { PropertyRecordType } from '../types/property-record.types.js';
import type { PropertyRecord } from '../types/property-record.types.js';
import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../types/property-data.types.js';
import { createPropertyDataProvider } from './property-data-providers/factory.js';
import { BridgeInteractiveService } from './bridge-interactive.service.js';
import { PropertyObservationService } from './property-observation.service.js';
import { materializePropertyRecordHistory } from './property-record-history-materializer.service.js';
import type { PropertyObservationNormalizedFacts } from '../types/property-observation.types.js';
import type { PropertyObservationSourceSystem } from '../types/property-observation.types.js';

// ─── Container name constant ──────────────────────────────────────────────────

export const PROPERTY_ENRICHMENTS_CONTAINER = 'property-enrichments';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * How long enrichment data is considered fresh before we call Bridge again.
 * Controlled by ENRICHMENT_CACHE_TTL_DAYS env var; defaults to 30 days.
 * Set to 0 to disable caching and always call the provider.
 */
const CACHE_TTL_DAYS = (() => {
  const raw = process.env.ENRICHMENT_CACHE_TTL_DAYS;
  if (raw === undefined) return 30;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(
      `ENRICHMENT_CACHE_TTL_DAYS must be a non-negative integer, got: "${raw}"`,
    );
  }
  return parsed;
})();

export type EnrichmentStatus =
  | 'enriched'       // Provider returned data; PropertyRecord updated
  | 'cached'         // PropertyRecord already fresh; Bridge not called
  | 'provider_miss'  // Provider responded but found no record for this address
  | 'no_provider';   // NullPropertyDataProvider — no data source configured

export interface PropertyEnrichmentRecord {
  id: string;
  type: 'property-enrichment';
  orderId: string;
  /** Present when the record was created via enrichEngagement(). Indexed for engagement-level queries. */
  engagementId?: string;
  tenantId: string;
  propertyId: string;
  status: EnrichmentStatus;
  /** The raw data returned by the provider, null on miss/no-provider. */
  dataResult: PropertyDataResult | null;
  createdAt: string;
}

export interface EnrichmentResult {
  enrichmentId: string;
  propertyId: string;
  status: EnrichmentStatus;
}

/**
 * Minimal geocoding port used by `PropertyEnrichmentService` to populate
 * `PropertyRecord.address.latitude/longitude` for newly resolved subjects.
 *
 * Decoupled from any specific provider so the enrichment service can be
 * unit-tested without pulling in `AddressService` (which carries a
 * provider-credentials matrix and an HTTP cache). Production wiring lives
 * at the composition root — see `AddressServiceGeocoder`.
 *
 * Contract:
 *   - Resolve to `{ latitude, longitude }` when geocoding succeeded.
 *   - Resolve to `null` when the provider responded but found no result
 *     (no-match for the address). NOT for transient failures.
 *   - Reject when the provider call itself failed (network, auth, etc.).
 *     The caller logs the failure and continues; it is NOT swallowed.
 */
export interface Geocoder {
  geocode(address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  }): Promise<{ latitude: number; longitude: number } | null>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PropertyEnrichmentService {
  private readonly logger: Logger;
  private readonly provider: PropertyDataProvider;
  private readonly geocoder: Geocoder;
  private readonly bridge: BridgeInteractiveService;
  private readonly observationService: PropertyObservationService;

  constructor(
    private readonly cosmosService: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService,
    /**
     * Optional: inject a specific provider (used in tests and for explicit
     * provider selection). When omitted, createPropertyDataProvider() is called.
     */
    provider?: PropertyDataProvider,
    /**
     * Geocoder used to populate `PropertyRecord.address.latitude/longitude`
     * when the resolved subject record lacks coordinates. REQUIRED — the
     * service refuses to start without one. Production composition root
     * passes `AddressServiceGeocoder`; tests pass a stub.
     *
     * No silent fallback: if you don't want geocoding to run, inject a
     * geocoder that always returns `null` (and own that decision in your
     * wiring code, not here).
     */
    geocoder?: Geocoder,
    /**
     * Optional: inject a BridgeInteractiveService instance (used in tests).
     * When omitted, a default instance is created automatically.
     */
    bridgeService?: BridgeInteractiveService,
  ) {
    this.logger = new Logger('PropertyEnrichmentService');
    this.provider = provider ?? createPropertyDataProvider(cosmosService);
    this.observationService = new PropertyObservationService(cosmosService);
    if (!geocoder) {
      throw new Error(
        'PropertyEnrichmentService: geocoder is required. Pass an implementation of `Geocoder` (e.g. `AddressServiceGeocoder`) to the constructor.',
      );
    }
    this.geocoder = geocoder;
    this.bridge = bridgeService ?? new BridgeInteractiveService();
  }

  /**
   * Main entry point — called when an order is created.
   *
   * @param orderId   The order being enriched (stored on the enrichment record).
   * @param tenantId  Tenant scope for all Cosmos operations.
   * @param address   The subject property address from the order.
   */
  async enrichOrder(
    orderId: string,
    tenantId: string,
    address: { street: string; city: string; state: string; zipCode: string },
    meta?: { engagementId?: string; sourceArtifactId?: string },
  ): Promise<EnrichmentResult> {
    if (!orderId) {
      throw new Error('PropertyEnrichmentService.enrichOrder: orderId is required');
    }
    if (!tenantId) {
      throw new Error('PropertyEnrichmentService.enrichOrder: tenantId is required');
    }
    if (!address.street || !address.city || !address.state || !address.zipCode) {
      throw new Error(
        `PropertyEnrichmentService.enrichOrder: address.street, city, state, and zipCode are all required. ` +
        `Received: ${JSON.stringify(address)}`,
      );
    }

    this.logger.info('PropertyEnrichmentService.enrichOrder: starting', {
      orderId,
      tenantId,
      address: `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`,
    });

    // ── Step 1: Resolve or create the PropertyRecord ────────────────────────
    const resolution = await this.propertyRecordService.resolveOrCreate({
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zipCode,
      },
      tenantId,
      createdBy: 'SYSTEM:property-enrichment',
      propertyType: PropertyRecordType.SINGLE_FAMILY,
    });

    this.logger.info('PropertyEnrichmentService: PropertyRecord resolved', {
      orderId,
      propertyId: resolution.propertyId,
      isNew: resolution.isNew,
      method: resolution.method,
    });

    // ── Step 2: Fetch the full canonical PropertyRecord once for cache
    //            checks and enrichment-time patching decisions, then overlay
    //            immutable observation-backed history so this staging read
    //            does not bypass the active Phase 6 materialization path.
    const existingRecord = await this.propertyRecordService.getById(
      resolution.propertyId,
      tenantId,
    );
    const existingObservations = await this.observationService.listByPropertyId(
      resolution.propertyId,
      tenantId,
    );
    const materializedRecord = materializePropertyRecordHistory(existingRecord, existingObservations);

    // ── Step 2.5: Geocode the address when the record lacks coordinates.
    // Coordinates are required by downstream comp-collection (it skips with
    // NO_COORDINATES otherwise). The provider call below returns parcel /
    // tax / building data but NOT lat/lng, so geocoding is a separate
    // explicit step here. We re-fetch the record after a successful patch so
    // the rest of this method sees the updated address.
    let workingRecord = materializedRecord;
    if (workingRecord.address.latitude == null || workingRecord.address.longitude == null) {
      let geo: { latitude: number; longitude: number } | null = null;
      try {
        geo = await this.geocoder.geocode({
          street: address.street,
          city: address.city,
          state: address.state,
          zip: address.zipCode,
        });
      } catch (err) {
        // No silent swallow: surface the failure so an operator can see why
        // the subject ended up without coordinates. Continue without coords —
        // the order is the source of truth and must still be placed.
        this.logger.warn('PropertyEnrichmentService: geocoder threw — continuing without coordinates', {
          orderId,
          tenantId,
          propertyId: resolution.propertyId,
          address: `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      if (geo === null) {
        this.logger.warn('PropertyEnrichmentService: geocoder returned no result', {
          orderId,
          tenantId,
          propertyId: resolution.propertyId,
          address: `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`,
        });
      } else {
        const patchedAddress = {
          ...workingRecord.address,
          latitude: geo.latitude,
          longitude: geo.longitude,
          isNormalized: true,
          geocodedAt: new Date().toISOString(),
        };
        const patched = await this.propertyRecordService.createVersion(
          resolution.propertyId,
          tenantId,
          { address: patchedAddress },
          'Geocoded subject coordinates at enrichment time',
          'PUBLIC_RECORDS_API',
          'SYSTEM:property-enrichment',
          'geocoder',
          meta?.sourceArtifactId,
        );
        // createVersion returns the updated record; fall back to a synthesised
        // copy if the implementation returns void in some test stubs.
        workingRecord = (patched as PropertyRecord) ?? {
          ...workingRecord,
          address: patchedAddress,
        };
      }
    }

    // ── Step 3: Cache check — skip Bridge if data is still fresh ───────────
    //
    // We only skip the provider call when:
    //   - This is NOT a brand-new PropertyRecord (isNew=false), AND
    //   - lastVerifiedAt exists and is within CACHE_TTL_DAYS
    //
    // When CACHE_TTL_DAYS=0 the isFreshEnough check always returns false,
    // effectively disabling caching.
    if (!resolution.isNew && this.isFreshEnough(workingRecord.lastVerifiedAt)) {
      this.logger.info('PropertyEnrichmentService: PropertyRecord is fresh — skipping Bridge call', {
        orderId,
        propertyId: resolution.propertyId,
        lastVerifiedAt: workingRecord.lastVerifiedAt,
        cacheTtlDays: CACHE_TTL_DAYS,
      });

      const cachedRecord: PropertyEnrichmentRecord = {
        id: `enrich-${orderId}-${Date.now()}`,
        type: 'property-enrichment',
        orderId,
        ...(meta?.engagementId != null && { engagementId: meta.engagementId }),
        tenantId,
        propertyId: resolution.propertyId,
        status: 'cached',
        dataResult: null,
        createdAt: new Date().toISOString(),
      };
      await this.cosmosService.createDocument<PropertyEnrichmentRecord>(
        PROPERTY_ENRICHMENTS_CONTAINER,
        cachedRecord,
      );

      // ── Step 8 (cached path): Fetch Zestimate AVM — non-fatal ────────────
      await this.fetchAndPatchAvm(resolution.propertyId, tenantId, address, orderId);

      return {
        enrichmentId: cachedRecord.id,
        propertyId: resolution.propertyId,
        status: 'cached',
      };
    }

    // ── Step 4: Call the data provider ─────────────────────────────────────
    const lookupParams: PropertyDataLookupParams = {
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
    };

    const dataResult = await this.provider.lookupByAddress(lookupParams);

    let status: EnrichmentStatus;

    if (dataResult === null) {
      // Provider is configured but found no record for this address.
      // NullPropertyDataProvider.lookupByAddress() also returns null and logs a
      // warning internally — we cannot distinguish the two cases from the return
      // value alone, so we use 'provider_miss' for both.
      status = 'provider_miss';
      this.logger.info('PropertyEnrichmentService: provider returned no record', {
        orderId,
        address: lookupParams,
      });
    } else {
      status = 'enriched';

      // ── Step 5: Merge enriched data into PropertyRecord ─────────────────
      const buildingChanges = this.buildBuildingChanges(dataResult);
      const topLevelChanges = this.buildTopLevelChanges(dataResult);
      const hasChanges =
        Object.keys(buildingChanges).length > 0 ||
        Object.keys(topLevelChanges).length > 0;

      if (hasChanges) {
        // Build the changes object imperatively to avoid the exactOptionalPropertyTypes
        // inference problem with conditional object spreads ( `...(cond ? { x } : {})` ).
        const versionChanges: Partial<
          Omit<PropertyRecord, 'id' | 'tenantId' | 'recordVersion' | 'versionHistory' | 'createdAt' | 'createdBy'>
        > = Object.assign({}, topLevelChanges);

        if (Object.keys(buildingChanges).length > 0) {
          // createVersion merges changes.building with existing.building at runtime
          // ( `{ ...existing.building, ...changes.building }` ), so partial is safe here.
          // The cast bridges the declared full-type expectation with our partial input.
          versionChanges.building = buildingChanges as PropertyRecord['building'];
        }
        versionChanges.dataSource = 'PUBLIC_RECORDS_API';
        versionChanges.lastVerifiedAt = dataResult.fetchedAt;
        versionChanges.lastVerifiedSource = dataResult.source;

        await this.propertyRecordService.createVersion(
          resolution.propertyId,
          tenantId,
          versionChanges,
          resolution.isNew
            ? 'Initial public-records data applied at order creation'
            : 'Public-records refresh at order creation',
          'PUBLIC_RECORDS_API',
          'SYSTEM:property-enrichment',
          dataResult.source,
          meta?.sourceArtifactId,
        );

        await this.observationService.createObservation({
          tenantId,
          propertyId: resolution.propertyId,
          observationType: 'public-record-import',
          sourceSystem: this.mapPublicRecordObservationSourceSystem(dataResult.source),
          observedAt: dataResult.fetchedAt,
          orderId,
          ...(meta?.engagementId ? { engagementId: meta.engagementId } : {}),
          ...(meta?.sourceArtifactId
            ? {
                sourceArtifactRef: {
                  kind: 'other' as const,
                  id: meta.sourceArtifactId,
                },
              }
            : {}),
          sourceRecordId: orderId,
          sourceProvider: dataResult.source,
          normalizedFacts: this.buildObservationNormalizedFacts(dataResult),
          rawPayload: dataResult as unknown as Record<string, unknown>,
          createdBy: 'SYSTEM:property-enrichment',
        });
      }

      await this.observationService.createObservation({
        tenantId,
        propertyId: resolution.propertyId,
        observationType: 'provider-enrichment',
        sourceSystem: 'property-enrichment-service',
        observedAt: dataResult.fetchedAt,
        orderId,
        ...(meta?.engagementId ? { engagementId: meta.engagementId } : {}),
        ...(meta?.sourceArtifactId
          ? {
              sourceArtifactRef: {
                kind: 'other' as const,
                id: meta.sourceArtifactId,
              },
            }
          : {}),
        sourceRecordId: orderId,
        sourceProvider: dataResult.source,
        normalizedFacts: this.buildObservationNormalizedFacts(dataResult),
        rawPayload: dataResult as unknown as Record<string, unknown>,
        createdBy: 'SYSTEM:property-enrichment',
      });
    }

    // ── Step 7: Persist the enrichment record for audit ────────────────────
    const enrichmentRecord: PropertyEnrichmentRecord = {
      id: `enrich-${orderId}-${Date.now()}`,
      type: 'property-enrichment',
      orderId,
      ...(meta?.engagementId != null && { engagementId: meta.engagementId }),
      tenantId,
      propertyId: resolution.propertyId,
      status,
      dataResult: dataResult ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.cosmosService.createDocument<PropertyEnrichmentRecord>(
      PROPERTY_ENRICHMENTS_CONTAINER,
      enrichmentRecord,
    );

    this.logger.info('PropertyEnrichmentService.enrichOrder: complete', {
      orderId,
      propertyId: resolution.propertyId,
      status,
      provider: dataResult?.source ?? 'none',
    });

    // ── Step 8: Fetch Zestimate AVM — non-fatal ──────────────────────────────
    await this.fetchAndPatchAvm(resolution.propertyId, tenantId, address, orderId);

    return {
      enrichmentId: enrichmentRecord.id,
      propertyId: resolution.propertyId,
      status,
    };
  }

  /**
   * Fetches a Zestimate from Bridge Interactive and patches `avm` onto the
   * PropertyRecord via createVersion(). Non-fatal — logs a warning and returns
   * without throwing if the API call fails or returns no numeric value.
   */
  private async fetchAndPatchAvm(
    propertyId: string,
    tenantId: string,
    address: { street: string; city: string; state: string; zipCode: string },
    orderId: string,
  ): Promise<void> {
    try {
      const result = await this.bridge.getZestimateByStructuredAddress({
        streetAddress: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.zipCode,
      });

      // Bridge response shape is untyped — probe known envelope variants.
      const bundle = result?.bundle?.[0] ?? result?.value?.[0] ?? result;
      const value: unknown = bundle?.zestimate ?? bundle?.value;
      if (value == null || typeof value !== 'number') {
        this.logger.warn('PropertyEnrichmentService: Zestimate returned no numeric value', {
          orderId,
          propertyId,
        });
        return;
      }

      const fetchedAt = new Date().toISOString();

      await this.observationService.createObservation({
        tenantId,
        propertyId,
        observationType: 'avm-update',
        sourceSystem: 'bridge-interactive',
        observedAt: fetchedAt,
        orderId,
        sourceProvider: 'Bridge Interactive',
        normalizedFacts: {
          avm: {
            value,
            fetchedAt,
            source: 'bridge-zestimate',
          },
        },
        rawPayload: result as unknown as Record<string, unknown>,
        createdBy: 'SYSTEM:property-enrichment',
      });

      this.logger.info('PropertyEnrichmentService: AVM recorded as immutable observation', {
        orderId,
        propertyId,
        avmValue: value,
      });
    } catch (err) {
      this.logger.warn(
        'PropertyEnrichmentService: Zestimate fetch failed — continuing without AVM',
        {
          orderId,
          propertyId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  private buildObservationNormalizedFacts(
    dataResult: PropertyDataResult,
  ): PropertyObservationNormalizedFacts {
    const buildingPatch = this.buildBuildingChanges(dataResult);
    const propertyPatch = this.buildTopLevelChanges(dataResult);

    const facts: PropertyObservationNormalizedFacts = {};

    if (Object.keys(buildingPatch).length > 0) {
      facts.buildingPatch = buildingPatch;
    }
    if (Object.keys(propertyPatch).length > 0) {
      facts.propertyPatch = propertyPatch as Record<string, unknown>;
    }
    if (dataResult.publicRecord?.taxAssessedValue != null) {
      facts.taxAssessment = {
        taxYear: dataResult.publicRecord.taxYear ?? new Date(dataResult.fetchedAt).getUTCFullYear(),
        totalAssessedValue: dataResult.publicRecord.taxAssessedValue,
        ...(dataResult.publicRecord.annualTaxAmount != null
          ? { annualTaxAmount: dataResult.publicRecord.annualTaxAmount }
          : {}),
        assessedAt: dataResult.fetchedAt,
      };
    }

    return facts;
  }

  private mapPublicRecordObservationSourceSystem(source: string): PropertyObservationSourceSystem {
    const normalized = source.trim().toLowerCase();
    if (normalized.includes('attom')) {
      return normalized.includes('cache') || normalized.includes('cosmos')
        ? 'attom-cache'
        : 'attom-api';
    }

    return 'public-records-import';
  }

  /**
   * Retrieves the most recent enrichment record for the given order.
   * Returns null if no enrichment has run yet.
   */
  async getLatestEnrichment(
    orderId: string,
    tenantId: string,
  ): Promise<PropertyEnrichmentRecord | null> {
    if (!tenantId) {
      throw new Error(
        `PropertyEnrichmentService.getLatestEnrichment: tenantId is required. orderId=${orderId}`,
      );
    }

    const query = `
      SELECT * FROM c
      WHERE c.orderId = @orderId
        AND c.tenantId = @tenantId
        AND c.type = 'property-enrichment'
      ORDER BY c.createdAt DESC
      OFFSET 0 LIMIT 1
    `;

    const results = await this.cosmosService.queryDocuments<PropertyEnrichmentRecord>(
      PROPERTY_ENRICHMENTS_CONTAINER,
      query,
      [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    return results.length > 0 ? (results[0] ?? null) : null;
  }

  /**
   * Retrieves all enrichment records for a given engagement, ordered newest-first.
   * Returns an empty array when no records exist.
   */
  async getEnrichmentsByEngagement(
    engagementId: string,
    tenantId: string,
  ): Promise<PropertyEnrichmentRecord[]> {
    if (!engagementId) {
      throw new Error(
        'PropertyEnrichmentService.getEnrichmentsByEngagement: engagementId is required',
      );
    }
    if (!tenantId) {
      throw new Error(
        `PropertyEnrichmentService.getEnrichmentsByEngagement: tenantId is required. engagementId=${engagementId}`,
      );
    }

    const query = `
      SELECT * FROM c
      WHERE c.engagementId = @engagementId
        AND c.tenantId = @tenantId
        AND c.type = 'property-enrichment'
      ORDER BY c.createdAt DESC
    `;

    return this.cosmosService.queryDocuments<PropertyEnrichmentRecord>(
      PROPERTY_ENRICHMENTS_CONTAINER,
      query,
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
  }

  /**
   * Fires enrichment for a single loan within an engagement.
   *
   * Stores a `PropertyEnrichmentRecord` keyed by `loanId` as the entity reference
   * (the loanId is the finest-grained property-owning entity in an engagement).
   * `getLatestEnrichment(loanId, tenantId)` retrieves engagement enrichments.
   *
   * @param engagementId  Parent engagement — used for log context only.
   * @param loanId        The loan whose collateral is being enriched.
   * @param tenantId      Tenant scope for all Cosmos operations.
   * @param address       The subject property address from the loan.
   */
  async enrichEngagement(
    engagementId: string,
    loanId: string,
    tenantId: string,
    address: { street: string; city: string; state: string; zipCode: string },
    // resolvedPropertyId is accepted for API compatibility but not yet used;
    // enrichOrder performs its own resolveOrCreate call.
    _resolvedPropertyId?: string,
  ): Promise<EnrichmentResult> {
    if (!engagementId) {
      throw new Error('PropertyEnrichmentService.enrichEngagement: engagementId is required');
    }
    if (!loanId) {
      throw new Error('PropertyEnrichmentService.enrichEngagement: loanId is required');
    }
    this.logger.info('PropertyEnrichmentService.enrichEngagement: starting', {
      engagementId,
      loanId,
      tenantId,
      address: `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`,
    });
    // Delegate to enrichOrder using loanId as the entity reference.
    // Pass engagementId in meta so the persisted record is queryable by engagement.
    return this.enrichOrder(loanId, tenantId, address, { engagementId });
  }

  // ─── Private field mappers ───────────────────────────────────────────────────

  /**
   * Returns only the fields that belong in PropertyRecord.building.
   * Omits any field whose value is null/undefined in the enrichment result.
   */
  private buildBuildingChanges(
    dataResult: PropertyDataResult,
  ): Partial<PropertyRecord['building']> {
    const c = dataResult.core;
    if (!c) return {};

    const changes: Partial<PropertyRecord['building']> = {};

    if (c.grossLivingArea != null) changes.gla = c.grossLivingArea;
    if (c.yearBuilt != null) changes.yearBuilt = c.yearBuilt;
    if (c.bedrooms != null) changes.bedrooms = c.bedrooms;

    if (c.bathsFull != null || c.bathsHalf != null) {
      const full = c.bathsFull ?? 0;
      const half = c.bathsHalf ?? 0;
      changes.fullBathrooms = full;
      changes.halfBathrooms = half;
      changes.bathrooms = full + half * 0.5;
    }

    if (c.stories != null) changes.stories = c.stories;
    if (c.effectiveAge != null) changes.effectiveYearBuilt = new Date().getFullYear() - c.effectiveAge;

    return changes;
  }

  /**
   * Returns fields that belong at the top level of PropertyRecord
   * (address, zoning, flood, ownership, legal).
   *
   * Note: address.county is intentionally NOT written here to avoid
   * replacing the entire CanonicalAddress struct. County enrichment is
   * stored in the raw dataResult for lookup.
   */
  private buildTopLevelChanges(
    dataResult: PropertyDataResult,
  ): Partial<Omit<PropertyRecord, 'building' | 'id' | 'tenantId' | 'recordVersion' | 'versionHistory' | 'createdAt' | 'createdBy' | 'updatedAt'>> {
    const changes: ReturnType<PropertyEnrichmentService['buildTopLevelChanges']> = {};

    const c = dataResult.core;
    if (c?.parcelNumber != null) changes.apn = c.parcelNumber;
    if (c?.lotSizeSqFt != null) changes.lotSizeSqFt = c.lotSizeSqFt;

    const pr = dataResult.publicRecord;
    if (pr?.zoning != null) changes.zoning = pr.zoning;
    if (pr?.legalDescription != null) changes.legalDescription = pr.legalDescription;
    if (pr?.ownerName != null) changes.currentOwner = pr.ownerName;

    const fl = dataResult.flood;
    if (fl?.femaFloodZone != null) changes.floodZone = fl.femaFloodZone;
    if (fl?.femaMapNumber != null) changes.floodMapNumber = fl.femaMapNumber;
    if (fl?.femaMapDate != null) changes.floodMapDate = fl.femaMapDate;

    // Photos: providers that supply them (e.g. local-attom) do so as a
    // complete array. Only overwrite when the provider returned a non-empty
    // list — an empty array means "no photos this run" and shouldn't blow
    // away photos from a previous enrichment.
    if (dataResult.photos && dataResult.photos.length > 0) {
      changes.photos = dataResult.photos;
    }

    return changes;
  }

  /**
   * Determines whether the property record is fresh enough to skip a Bridge call.
   * Returns false when lastVerifiedAt is absent, or CACHE_TTL_DAYS is 0.
   */
  private isFreshEnough(lastVerifiedAt?: string): boolean {
    if (!lastVerifiedAt || CACHE_TTL_DAYS === 0) return false;
    const ageMs = Date.now() - new Date(lastVerifiedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays < CACHE_TTL_DAYS;
  }

}
