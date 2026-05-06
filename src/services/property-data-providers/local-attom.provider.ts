/**
 * Local ATTOM Property Data Provider (Cosmos-backed)
 *
 * Resolves subject property data from the `attom-data` Cosmos DB container,
 * which is bulk-populated from ATTOM CSV exports by
 * `src/scripts/ingest-attom-csv-attom-data-container.ts`.
 *
 * This provider is designed to run *before* the live API providers
 * (Bridge Interactive, ATTOM Data Solutions API). When the Cosmos cache
 * already has the subject, we avoid both the latency and the per-call cost
 * of a live API hit.
 *
 * Lookup strategy (mirrors `PropertyRecordService.findByNormalizedAddress`):
 *   1. Single Cosmos query for the candidate set, scoped by indexed
 *      `address.state` + `address.zip`, sorted newest-first by `sourcedAt`.
 *   2. Client-side compare using normalized fields:
 *        - Preferred:  normalized APN  ↔  normalized `apnFormatted`
 *        - Fallback:   normalized street + city  ↔  reconstructed street + city
 *
 * Returns:
 *   - `PropertyDataResult` on a match.
 *   - `null` when no candidate matches (chain provider falls through).
 *   - throws on Cosmos errors (chain provider logs and continues).
 *
 * Note: the source CSV does not carry FEMA flood data, so `flood` is left
 * undefined on results from this provider — no silent fabrication.
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
  PropertyDataCore,
  PropertyDataPublicRecord,
} from '../../types/property-data.types.js';
import type { AttomDataDocument } from '../../types/attom-data.types.js';
import { CosmosDbService } from '../cosmos-db.service.js';
import { normalizeStreetForMatch, zip5 } from '../property-record.service.js';
import { extractAttomPhotos } from '../../mappers/attom-photos.js';
import { Logger } from '../../utils/logger.js';

const ATTOM_DATA_CONTAINER = 'attom-data';

/**
 * Strips non-alphanumerics and uppercases. Used to compare APNs that may
 * appear with or without dashes/spaces and in different cases across
 * data sources.
 */
function normalizeApn(apn: string): string {
  return apn.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Uppercase + trim a city for case-insensitive comparison. */
function normalizeCity(city: string): string {
  return city.trim().toUpperCase();
}

/**
 * Reconstructs a single street string from an `AttomDataDocument.address`'s
 * separate components. The CSV ingestion stores the street as discrete
 * fields (houseNumber / streetDirection / streetName / streetSuffix /
 * streetPostDirection); we collapse them to a single string so it can be
 * passed through `normalizeStreetForMatch` and compared to `params.street`.
 *
 * Unit prefix/value (apt/suite numbers) are intentionally excluded — the
 * subject address may or may not include unit information depending on the
 * caller, and `normalizeStreetForMatch` strips '#' anyway.
 */
function reconstructStreet(addr: AttomDataDocument['address']): string {
  return [
    addr.houseNumber,
    addr.streetDirection,
    addr.streetName,
    addr.streetSuffix,
    addr.streetPostDirection,
  ]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(' ');
}

export class LocalAttomPropertyDataProvider implements PropertyDataProvider {
  private readonly cosmos: CosmosDbService;
  private readonly logger: Logger;

  constructor(cosmos?: CosmosDbService) {
    this.cosmos = cosmos ?? new CosmosDbService();
    this.logger = new Logger('LocalAttomPropertyDataProvider');
  }

  async lookupByAddress(
    params: PropertyDataLookupParams,
  ): Promise<PropertyDataResult | null> {
    const state = (params.state ?? '').trim().toUpperCase();
    const zip = zip5(params.zipCode ?? '');

    if (!state || !zip) {
      this.logger.info(
        'LocalAttomPropertyDataProvider: skipping — state and zip are required for lookup',
        { state, zip },
      );
      return null;
    }

    this.logger.info('LocalAttomPropertyDataProvider.lookupByAddress', {
      address: `${params.street}, ${params.city}, ${state} ${zip}`,
      hasApn: Boolean(params.apn),
    });

    // ── Step 1: Pull candidate set scoped by state + zip ────────────────────
    // No ORDER BY: the ingest script upserts by attomId so there is at most
    // one document per physical property. Adding ORDER BY c.sourcedAt DESC
    // forces a cross-partition merge-sort over the full state/zip result set
    // (6+ MB for dense zips), inflating query time from ~300ms to 4300ms+
    // and causing intermittent Cosmos throttle/timeout errors that caused
    // the chained provider to silently fall through to Bridge Interactive.
    const candidates = await this.cosmos.queryDocuments<AttomDataDocument>(
      ATTOM_DATA_CONTAINER,
      "SELECT * FROM c WHERE c.type = 'attom-data' AND c.address.state = @state AND c.address.zip = @zip",
      [
        { name: '@state', value: state },
        { name: '@zip', value: zip },
      ],
    );

    if (candidates.length === 0) {
      this.logger.info('LocalAttomPropertyDataProvider: no candidates for state/zip', {
        state,
        zip,
      });
      return null;
    }

    // ── Step 2a: APN match (preferred when supplied) ────────────────────────
    if (params.apn && params.apn.trim()) {
      const normalizedApn = normalizeApn(params.apn);
      if (normalizedApn) {
        for (const candidate of candidates) {
          if (normalizeApn(candidate.apnFormatted ?? '') === normalizedApn) {
            this.logger.info('LocalAttomPropertyDataProvider: matched by APN', {
              apn: params.apn,
              attomId: candidate.attomId,
              sourcedAt: candidate.sourcedAt,
            });
            return this.mapDocumentToResult(candidate);
          }
        }
        // APN supplied but didn't match any candidate — fall through to
        // address match rather than treating as a hard miss, since CSV
        // and order data may simply use different APN formats.
        this.logger.info(
          'LocalAttomPropertyDataProvider: APN supplied but no match; trying address',
          { apn: params.apn },
        );
      }
    }

    // ── Step 2b: Address match ───────────────────────────────────────────────
    const inStreet = normalizeStreetForMatch(params.street ?? '');
    const inCity = normalizeCity(params.city ?? '');

    if (!inStreet || !inCity) {
      this.logger.info(
        'LocalAttomPropertyDataProvider: skipping address match — street and city are required',
      );
      return null;
    }

    for (const candidate of candidates) {
      const candStreet = normalizeStreetForMatch(reconstructStreet(candidate.address));
      const candCity = normalizeCity(candidate.address.city ?? '');

      if (candStreet === inStreet && candCity === inCity) {
        this.logger.info('LocalAttomPropertyDataProvider: matched by address', {
          attomId: candidate.attomId,
          sourcedAt: candidate.sourcedAt,
        });
        return this.mapDocumentToResult(candidate);
      }
    }

    this.logger.info('LocalAttomPropertyDataProvider: no candidate matched', {
      candidatesConsidered: candidates.length,
    });
    return null;
  }

  // ─── Internal mappers ────────────────────────────────────────────────────────

  /**
   * Maps an `AttomDataDocument` to the canonical `PropertyDataResult` shape
   * used by all property data providers. Field selection mirrors
   * `AttomPropertyDataProvider` so consumers see consistent data regardless
   * of whether the hit came from the live API or the Cosmos cache.
   */
  private mapDocumentToResult(doc: AttomDataDocument): PropertyDataResult {
    return {
      source: 'ATTOM Data Solutions (Cosmos cache)',
      fetchedAt: new Date().toISOString(),
      core: this.buildCore(doc),
      publicRecord: this.buildPublicRecord(doc),
      // No FEMA flood data is present in the ATTOM CSV → leave `flood`
      // undefined rather than fabricating empty fields.
      // Photos are derived from the raw PHOTOSCOUNT/PHOTOKEY/PHOTOURLPREFIX
      // CSV columns via the shared extractor (kept in sync with the
      // attom-to-property-record mapper used by comp-collection).
      photos: extractAttomPhotos(doc),
      rawProviderData: { attomDataDocument: doc },
    };
  }

  private buildCore(doc: AttomDataDocument): PropertyDataCore {
    const core: PropertyDataCore = {};
    const detail = doc.propertyDetail;
    const addr = doc.address;

    if (detail.livingAreaSqft != null) core.grossLivingArea = detail.livingAreaSqft;
    if (detail.bedroomsTotal != null) core.bedrooms = detail.bedroomsTotal;
    if (detail.bathroomsFull != null) core.bathsFull = detail.bathroomsFull;
    if (detail.bathroomsHalf != null) core.bathsHalf = detail.bathroomsHalf;
    if (detail.yearBuilt != null) core.yearBuilt = detail.yearBuilt;

    // lotSizeSqft is preferred; fall back to acres × 43,560 (mirrors
    // AttomPropertyDataProvider's lotSize2 vs lotSize1 handling).
    if (detail.lotSizeSqft != null && detail.lotSizeSqft > 0) {
      core.lotSizeSqFt = detail.lotSizeSqft;
    } else if (detail.lotSizeAcres != null && detail.lotSizeAcres > 0) {
      core.lotSizeSqFt = Math.round(detail.lotSizeAcres * 43_560);
    }

    if (detail.attomPropertyType) core.propertyType = detail.attomPropertyType;

    // stories arrives as a string in the cache schema (e.g. "1", "1.5").
    if (detail.stories) {
      const stories = Number(detail.stories);
      if (!Number.isNaN(stories)) core.stories = stories;
    }

    if (detail.garageSpaces != null) {
      core.garage = `${detail.garageSpaces}-car`;
    }

    if (doc.apnFormatted) core.parcelNumber = doc.apnFormatted;
    if (addr.county) core.county = addr.county;

    // GeoJSON `coordinates` is [longitude, latitude] (NOT [lat, lon]).
    const coords = doc.location?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const [lon, lat] = coords;
      if (typeof lat === 'number' && !Number.isNaN(lat) && lat !== 0) core.latitude = lat;
      if (typeof lon === 'number' && !Number.isNaN(lon) && lon !== 0) core.longitude = lon;
    }

    return core;
  }

  private buildPublicRecord(doc: AttomDataDocument): PropertyDataPublicRecord {
    const rec: PropertyDataPublicRecord = {};
    const asmt = doc.assessment;
    const sales = doc.salesHistory;

    if (asmt.assessedValueTotal != null) rec.taxAssessedValue = asmt.assessedValueTotal;

    // taxYear is stored as a string in the cache schema; coerce safely.
    if (asmt.taxYear) {
      const year = Number(asmt.taxYear);
      if (!Number.isNaN(year)) rec.taxYear = year;
    }

    if (asmt.taxAmount != null) rec.annualTaxAmount = asmt.taxAmount;

    if (sales.lastSaleDate) rec.deedTransferDate = sales.lastSaleDate;
    if (sales.lastSaleAmount != null) rec.deedTransferAmount = sales.lastSaleAmount;

    return rec;
  }
}
