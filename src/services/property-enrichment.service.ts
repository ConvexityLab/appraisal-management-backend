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
 *      - Append the latest tax assessment to the record's assessment time series.
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
import type { PropertyRecord, TaxAssessmentRecord } from '../types/property-record.types.js';
import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../types/property-data.types.js';
import { createPropertyDataProvider } from './property-data-providers/factory.js';

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

// ─── Service ──────────────────────────────────────────────────────────────────

export class PropertyEnrichmentService {
  private readonly logger: Logger;
  private readonly provider: PropertyDataProvider;

  constructor(
    private readonly cosmosService: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService,
    /**
     * Optional: inject a specific provider (used in tests and for explicit
     * provider selection). When omitted, createPropertyDataProvider() is called.
     */
    provider?: PropertyDataProvider,
  ) {
    this.logger = new Logger('PropertyEnrichmentService');
    this.provider = provider ?? createPropertyDataProvider();
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
    meta?: { engagementId?: string },
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

    // ── Step 2: Fetch the full PropertyRecord once (used for cache check and
    //            tax-assessment dedup — avoids a second Cosmos read later).
    const existingRecord = await this.propertyRecordService.getById(
      resolution.propertyId,
      tenantId,
    );

    // ── Step 3: Cache check — skip Bridge if data is still fresh ───────────
    //
    // We only skip the provider call when:
    //   - This is NOT a brand-new PropertyRecord (isNew=false), AND
    //   - lastVerifiedAt exists and is within CACHE_TTL_DAYS
    //
    // When CACHE_TTL_DAYS=0 the isFreshEnough check always returns false,
    // effectively disabling caching.
    if (!resolution.isNew && this.isFreshEnough(existingRecord.lastVerifiedAt)) {
      this.logger.info('PropertyEnrichmentService: PropertyRecord is fresh — skipping Bridge call', {
        orderId,
        propertyId: resolution.propertyId,
        lastVerifiedAt: existingRecord.lastVerifiedAt,
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

        await this.propertyRecordService.createVersion(
          resolution.propertyId,
          tenantId,
          versionChanges,
          resolution.isNew
            ? 'Initial public-records data applied at order creation'
            : 'Public-records refresh at order creation',
          'PUBLIC_RECORDS_API',
          'SYSTEM:property-enrichment',
        );
      }

      // ── Step 6: Append tax assessment if present ─────────────────────────
      // Pass the pre-fetched record to avoid a second getById Cosmos read.
      if (dataResult.publicRecord?.taxAssessedValue != null) {
        await this.appendTaxAssessmentIfNew(
          resolution.propertyId,
          tenantId,
          dataResult,
          existingRecord,
        );
      }
    }

    // ── Step 5: Persist the enrichment record for audit ────────────────────
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

    return {
      enrichmentId: enrichmentRecord.id,
      propertyId: resolution.propertyId,
      status,
    };
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

  /**
   * Appends a tax assessment to the PropertyRecord only when one for the same
   * tax year doesn't already exist (prevents duplicates on repeated enrichment runs).
   *
   * Receives the already-fetched PropertyRecord to avoid a second Cosmos read.
   */
  private async appendTaxAssessmentIfNew(
    propertyId: string,
    tenantId: string,
    dataResult: PropertyDataResult,
    existingRecord: PropertyRecord,
  ): Promise<void> {
    const pr = dataResult.publicRecord;
    if (!pr || pr.taxAssessedValue == null) return;

    const taxYear = pr.taxYear ?? new Date().getFullYear();

    const existing = existingRecord;

    // Skip if we already have an assessment for this year from this (or any) source
    const alreadyHaveYear = existing.taxAssessments.some(a => a.taxYear === taxYear);
    if (alreadyHaveYear) {
      this.logger.info('PropertyEnrichmentService: tax assessment already exists for year, skipping', {
        propertyId,
        taxYear,
      });
      return;
    }

    const assessment: TaxAssessmentRecord = {
      taxYear,
      totalAssessedValue: pr.taxAssessedValue,
      ...(pr.annualTaxAmount != null ? { annualTaxAmount: pr.annualTaxAmount } : {}),
      assessedAt: dataResult.fetchedAt,
    };

    const updatedAssessments = [...existing.taxAssessments, assessment];

    // Use createVersion to add the assessment — this maintains the audit trail.
    await this.propertyRecordService.createVersion(
      propertyId,
      tenantId,
      { taxAssessments: updatedAssessments },
      `Tax assessment appended for year ${taxYear}`,
      'PUBLIC_RECORDS_API',
      'SYSTEM:property-enrichment',
    );
  }
}
