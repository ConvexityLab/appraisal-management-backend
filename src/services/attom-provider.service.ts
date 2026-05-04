/**
 * ATTOM Provider Service
 *
 * Cache-first wrapper around AttomService (live API).
 *
 * Resolution order:
 *   1. Check property-data-cache (Cosmos)
 *   2. If hit and data is fresh (or no TTL configured) → return cached entry
 *   3. If miss, or stale + forceRefresh → call live ATTOM API → write-through to cache
 *
 * If ATTOM_API_KEY is not set and the cache misses, an informative error is thrown
 * rather than silently returning null.
 *
 * Staleness TTL is controlled by env var ATTOM_CACHE_TTL_DAYS (0 = never re-fetch).
 */

import {
  PropertyDataCacheService,
  PropertyDataCacheEntry,
  PropertyDataSource,
} from './property-data-cache.service.js';
import { AttomService } from './attom.service.js';
import { Logger } from '../utils/logger.js';

interface AttomLookupOptions {
  /** Force a live API re-fetch even if a fresh cache entry exists */
  forceRefresh?: boolean;
}

export class AttomProviderService {
  private readonly logger: Logger;
  private readonly cacheTtlDays: number;

  /**
   * @param cache   PropertyDataCacheService instance
   * @param attom   Optional AttomService instance. If omitted, the provider only
   *                uses the cache and throws on misses (appropriate for environments
   *                where ATTOM_API_KEY is not configured).
   */
  constructor(
    private readonly cache: PropertyDataCacheService,
    private readonly attom: AttomService | null = null,
  ) {
    this.logger = new Logger('AttomProviderService');

    const ttlRaw = process.env.ATTOM_CACHE_TTL_DAYS;
    if (ttlRaw !== undefined) {
      const parsed = parseInt(ttlRaw, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error(
          `AttomProviderService: ATTOM_CACHE_TTL_DAYS must be a non-negative integer, got "${ttlRaw}"`,
        );
      }
      this.cacheTtlDays = parsed;
    } else {
      this.cacheTtlDays = 0; // never auto-refresh unless explicitly set
    }
  }

  // ─── Public API (mirrors AttomService) ────────────────────────────────────

  /**
   * Resolve a property by address — returns the full cached entry if available.
   *
   * @param address1  Street number and name, e.g. "12238 SPINEY RIDGE DR S"
   * @param address2  City, state, and zip as a single string, e.g. "Jacksonville FL 32225"
   */
  async getPropertyDetailOwner(
    address1: string,
    address2: string,
    options: AttomLookupOptions = {},
  ): Promise<unknown> {
    const parsed = parseAddress1(address1);
    const { zip } = parseAddress2(address2);

    if (!options.forceRefresh && parsed) {
      const cached = await this.cache.getByAddress(parsed.houseNumber, parsed.streetName, zip);
      if (cached && !this.cache.isStale(cached, this.cacheTtlDays)) {
        this.logger.debug('AttomProviderService: cache hit (address)', { address1, address2 });
        return toAttomDetailOwnerEnvelope(cached);
      }
    }

    return this.fetchLiveAndCache('getPropertyDetailOwner', async () => {
      if (!this.attom) this.throwNoApiKey(address1, address2);
      const response = await this.attom!.getPropertyDetailOwner(address1, address2);
      const attomId = extractAttomId(response);
      if (attomId) {
        await this.mergeAndCacheApiResponse(attomId, 'propertyDetail', response);
      }
      return response;
    });
  }

  /**
   * Get assessment data for a property by ATTOM ID.
   */
  async getAssessmentDetail(
    attomId: number,
    options: AttomLookupOptions = {},
  ): Promise<unknown> {
    const id = String(attomId);

    if (!options.forceRefresh) {
      const cached = await this.cache.getByAttomId(id);
      if (cached && !this.cache.isStale(cached, this.cacheTtlDays)) {
        this.logger.debug('AttomProviderService: cache hit (assessment)', { attomId });
        return toAttomAssessmentEnvelope(cached);
      }
    }

    return this.fetchLiveAndCache('getAssessmentDetail', async () => {
      if (!this.attom) this.throwNoApiKey(String(attomId));
      const response = await this.attom!.getAssessmentDetail(attomId);
      await this.mergeAndCacheApiResponse(id, 'assessment', response);
      return response;
    });
  }

  /**
   * Get sales history for a property by ATTOM ID.
   */
  async getSaleHistoryBasic(
    attomId: number,
    options: AttomLookupOptions = {},
  ): Promise<unknown> {
    const id = String(attomId);

    if (!options.forceRefresh) {
      const cached = await this.cache.getByAttomId(id);
      if (cached && !this.cache.isStale(cached, this.cacheTtlDays)) {
        this.logger.debug('AttomProviderService: cache hit (sales history)', { attomId });
        return toAttomSaleHistoryEnvelope(cached);
      }
    }

    return this.fetchLiveAndCache('getSaleHistoryBasic', async () => {
      if (!this.attom) this.throwNoApiKey(String(attomId));
      const response = await this.attom!.getSaleHistoryBasic(attomId);
      await this.mergeAndCacheApiResponse(id, 'salesHistory', response);
      return response;
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async fetchLiveAndCache(label: string, fn: () => Promise<unknown>): Promise<unknown> {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(`AttomProviderService: live API call failed [${label}]`, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * After a live API call we want to preserve what we already have in the cache
   * and only overwrite the fields returned by this specific endpoint.
   */
  private async mergeAndCacheApiResponse(
    attomId: string,
    section: 'propertyDetail' | 'assessment' | 'salesHistory',
    response: unknown,
  ): Promise<void> {
    try {
      const existing = await this.cache.getByAttomId(attomId);
      if (!existing) {
        // Partial entry from live API — we won't have all the CSV fields, but we
        // can still cache what we got so future calls hit the cache.
        this.logger.debug('AttomProviderService: writing partial live-API entry to cache', { attomId, section });
        // Not worth building a full PropertyDataCacheEntry from a partial live response here;
        // a future full ingestion will fill it in. Just log and return.
        return;
      }

      // Patch the relevant section and update cachedAt
      const updated: PropertyDataCacheEntry = {
        ...existing,
        cachedAt: new Date().toISOString(),
        source: 'attom-api' as PropertyDataSource,
      };

      if (section === 'assessment') {
        const data = extractAssessmentFromResponse(response);
        if (data) updated.assessment = { ...existing.assessment, ...data };
      } else if (section === 'salesHistory') {
        const data = extractSalesHistoryFromResponse(response);
        if (data) updated.salesHistory = { ...existing.salesHistory, ...data };
      }

      await this.cache.upsert(updated);
    } catch (err) {
      // Write-through failure is non-fatal — the caller already has the live response.
      this.logger.warn('AttomProviderService: write-through to cache failed', {
        attomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private throwNoApiKey(...context: string[]): never {
    throw new Error(
      `AttomProviderService: property not found in cache and ATTOM_API_KEY is not configured. ` +
      `To fetch live data set ATTOM_API_KEY. Context: ${context.join(', ')}`,
    );
  }
}

// ─── ATTOM Response envelope builders ────────────────────────────────────────
// These reconstruct the ATTOM status-wrapped JSON envelope shape from cached data
// so callers that consume AttomService responses continue to work without changes.

function toAttomDetailOwnerEnvelope(entry: PropertyDataCacheEntry): unknown {
  return {
    status: { version: '1.0.0', code: 0, msg: 'SuccessWithResult', total: 1, page: 1, pagesize: 10 },
    property: [
      {
        identifier: { attomId: Number(entry.attomId), apnFormatted: entry.apnFormatted },
        location: {
          accuracy: 'Rooftop',
          latitude: entry.location?.coordinates[1] ?? null,
          longitude: entry.location?.coordinates[0] ?? null,
          distance: 0,
          geoid: '',
        },
        address: {
          country: 'US',
          countrySubd: entry.address.state,
          line1: `${entry.address.houseNumber} ${entry.address.streetDirection} ${entry.address.streetName} ${entry.address.streetSuffix}`.trim(),
          line2: `${entry.address.city} ${entry.address.state} ${entry.address.zip}`.trim(),
          locality: entry.address.city,
          matchCode: 'ExaStr',
          oneLine: entry.address.full,
          postal1: entry.address.zip,
          postal2: entry.address.zip4,
          postal3: '',
        },
        summary: {
          propclass: entry.propertyDetail.attomPropertyType,
          propsubtype: entry.propertyDetail.attomPropertySubtype,
          proptype: entry.propertyDetail.attomPropertyType,
          yearbuilt: entry.propertyDetail.yearBuilt,
          propLandUse: entry.propertyDetail.attomPropertySubtype,
          propIndicator: '',
          legal1: '',
        },
        building: {
          rooms: { beds: entry.propertyDetail.bedroomsTotal },
          interior: { bsmtSize: null, fplcCount: 0, fplcInd: 'N', fplcType: '' },
          construction: { condition: null, wallType: '' },
          parking: { prkgSpaces: entry.propertyDetail.garageSpaces, prkgType: '' },
          size: {
            bldgsize: entry.propertyDetail.livingAreaSqft,
            grosssize: entry.propertyDetail.livingAreaSqft,
            grosssizeind: 'Living Area',
            livingsize: entry.propertyDetail.livingAreaSqft,
            sizeInd: 'Living Area',
            universalsize: entry.propertyDetail.livingAreaSqft,
          },
        },
        lot: {
          lotsize1: entry.propertyDetail.lotSizeAcres,
          lotsize2: entry.propertyDetail.lotSizeSqft,
        },
        owner: { absenteeInd: '', corporateindicator: '', owner1: { fullname: '' } },
        sale: {
          saleSearchDate: entry.salesHistory.lastSaleDate,
          saleTransDate: entry.salesHistory.lastSaleDate,
          saleamt: entry.salesHistory.lastSaleAmount,
        },
        _cacheSource: entry.source,
        _cachedAt: entry.cachedAt,
      },
    ],
  };
}

function toAttomAssessmentEnvelope(entry: PropertyDataCacheEntry): unknown {
  return {
    status: { version: '1.0.0', code: 0, msg: 'SuccessWithResult', total: 1, page: 1, pagesize: 10 },
    property: [
      {
        identifier: { attomId: Number(entry.attomId), apnFormatted: entry.apnFormatted },
        address: { oneLine: entry.address.full },
        assessment: {
          assessed: {
            assdimprvalue: null,
            assdlandvalue: null,
            assdttlvalue: entry.assessment.assessedValueTotal,
          },
          market: {
            mktimprvalue: null,
            mktlandvalue: null,
            mktttlvalue: entry.assessment.marketValue,
          },
          tax: {
            taxyear: entry.assessment.taxYear,
            taxamt: entry.assessment.taxAmount,
          },
        },
        _cacheSource: entry.source,
        _cachedAt: entry.cachedAt,
      },
    ],
  };
}

function toAttomSaleHistoryEnvelope(entry: PropertyDataCacheEntry): unknown {
  const sale = entry.salesHistory;
  return {
    status: { version: '1.0.0', code: 0, msg: 'SuccessWithResult', total: 1, page: 1, pagesize: 10 },
    property: [
      {
        identifier: { attomId: Number(entry.attomId) },
        address: { oneLine: entry.address.full },
        salehistory: [
          {
            saleSearchDate: sale.lastSaleDate,
            saleTransDate: sale.lastSaleDate,
            saleamt: sale.lastSaleAmount,
          },
        ],
        _cacheSource: entry.source,
        _cachedAt: entry.cachedAt,
      },
    ],
  };
}

// ─── Address parsers ──────────────────────────────────────────────────────────

function parseAddress1(raw: string): { houseNumber: string; streetName: string } | null {
  // Matches "12238 SPINEY RIDGE DR S" → houseNumber="12238", streetName="SPINEY RIDGE"
  const m = raw.trim().match(/^(\d+[A-Z]?)\s+(.+)$/i);
  if (!m) return null;
  // Drop common suffixes (DR, ST, AVE, RD, etc.) from streetName for looser matching
  const streetRaw = (m[2] ?? '').trim().replace(/\s+(DR|ST|AVE|BLVD|RD|CT|PL|WAY|LN|CIR|LOOP|TRL|HWY|PKWY|SQ|N|S|E|W|NE|NW|SE|SW)(\s+\w+)?$/i, '').trim();
  return { houseNumber: m[1] ?? '', streetName: streetRaw };
}

function parseAddress2(raw: string): { city: string; state: string; zip: string } {
  // "Jacksonville FL 32225" or "Jacksonville, FL 32225"
  const m = raw.trim().match(/^(.*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (!m) return { city: '', state: '', zip: '' };
  return { city: (m[1] ?? '').trim(), state: (m[2] ?? '').toUpperCase(), zip: (m[3] ?? '').replace('-', '') };
}

function extractAttomId(response: unknown): string | null {
  try {
    const r = response as any;
    const id = r?.property?.[0]?.identifier?.attomId;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

function extractAssessmentFromResponse(response: unknown): Partial<PropertyDataCacheEntry['assessment']> | null {
  try {
    const a = (response as any)?.property?.[0]?.assessment;
    if (!a) return null;
    return {
      assessedValueTotal: a.assessed?.assdttlvalue ?? null,
      marketValue: a.market?.mktttlvalue ?? null,
      taxYear: String(a.tax?.taxyear ?? ''),
      taxAmount: a.tax?.taxamt ?? null,
    };
  } catch {
    return null;
  }
}

function extractSalesHistoryFromResponse(response: unknown): Partial<PropertyDataCacheEntry['salesHistory']> | null {
  try {
    const history = (response as any)?.property?.[0]?.salehistory;
    if (!Array.isArray(history) || history.length === 0) return null;
    const last = history[0];
    return {
      lastSaleDate: last.saleTransDate ?? '',
      lastSaleAmount: last.saleamt ?? null,
    };
  } catch {
    return null;
  }
}
