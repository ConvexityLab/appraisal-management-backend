/**
 * ATTOM Data Solutions Property Data Provider
 *
 * Adapts AttomService to the generic PropertyDataProvider interface
 * for subject property enrichment (core characteristics + public records + flood).
 *
 * Data sources used:
 *   /property/detailowner       → building characteristics + owner + flood zone
 *   /assessment/detail          → assessed value, tax year, tax amount, legal description
 *   /saleshistory/basichistory  → deed transfer date + amount
 *
 * Field mappings (ATTOM JSON → PropertyDataCore):
 *   building.size.universalSize         → grossLivingArea
 *   building.rooms.beds                 → bedrooms
 *   building.rooms.bathsFull            → bathsFull
 *   building.rooms.bathsHalf            → bathsHalf
 *   building.summary.yearBuilt          → yearBuilt
 *   lot.lotSize2                        → lotSizeSqFt (sq ft)
 *   lot.lotSize1 × 43,560               → lotSizeSqFt (acres → sq ft fallback)
 *   building.summary.propType           → propertyType
 *   building.summary.stories            → stories
 *   building.parking.prkgType/prkgSize  → garage
 *   identifier.apn                      → parcelNumber
 *   address.county                      → county
 *   address.latitude / longitude        → latitude / longitude (strings → number)
 *
 * Field mappings (ATTOM JSON → PropertyDataPublicRecord):
 *   owner.owner1.firstName + lastName   → ownerName
 *   lot.zoningCodeLocal                 → zoning
 *   summary.propLandUse                 → landUseCode
 *   assessment.assessed.assdTtlValue    → taxAssessedValue
 *   assessment.tax.taxYear              → taxYear
 *   assessment.tax.taxAmt               → annualTaxAmount
 *   lot.legalDescription1               → legalDescription
 *   salehistory[0].saleTransDate        → deedTransferDate (most-recent sale)
 *   salehistory[0].amount.saleamt       → deedTransferAmount
 *
 * Field mappings (ATTOM JSON → PropertyDataFlood):
 *   lot.floodZone                       → femaFloodZone
 *   lot.floodMapNumber                  → femaMapNumber
 *   lot.floodMapDate                    → femaMapDate (normalised to YYYY-MM-DD)
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
  PropertyDataCore,
  PropertyDataPublicRecord,
  PropertyDataFlood,
} from '../../types/property-data.types.js';
import { AttomService } from '../attom.service.js';
import { Logger } from '../../utils/logger.js';

// ─── Narrow ATTOM response types ─────────────────────────────────────────────
// (ATTOM returns loosely-typed JSON; we cast via helper rather than trust any)

type AttomRecord = Record<string, unknown>;
type AttomEnvelope = { status: AttomRecord; property?: AttomRecord[] };

export class AttomPropertyDataProvider implements PropertyDataProvider {
  private readonly attom: AttomService;
  private readonly logger: Logger;

  constructor() {
    this.attom = new AttomService();
    this.logger = new Logger('AttomPropertyDataProvider');
  }

  async lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    const address1 = params.street;
    const address2 = `${params.city} ${params.state} ${params.zipCode}`;

    this.logger.info('AttomPropertyDataProvider.lookupByAddress', {
      address: `${address1}, ${address2}`,
    });

    // ── Step 1: Primary lookup — property detail + owner ──────────────────────
    const detailEnvelope = await this.attom
      .getPropertyDetailOwner(address1, address2)
      .catch(err => {
        this.logger.warn('ATTOM /property/detailowner failed (non-fatal)', {
          address: `${address1}, ${address2}`,
          error: (err as Error).message,
        });
        return null;
      });

    const detailProperty = this.firstProperty(detailEnvelope);

    if (!detailProperty) {
      this.logger.info('AttomPropertyDataProvider: no match found', {
        address: `${address1}, ${address2}`,
      });
      return null;
    }

    // ATTOM's stable property identifier — required for follow-up calls.
    const identifier = detailProperty['identifier'] as AttomRecord | undefined;
    const attomId = identifier?.['attomId'] as number | undefined;

    // ── Step 2: Assessment + sale history in parallel ─────────────────────────
    let assessmentProperty: AttomRecord | undefined;
    let saleHistoryProperty: AttomRecord | undefined;

    if (attomId != null) {
      const [assessmentEnvelope, saleHistoryEnvelope] = await Promise.all([
        this.attom.getAssessmentDetail(attomId).catch(err => {
          this.logger.warn('ATTOM /assessment/detail failed (non-fatal)', {
            attomId,
            error: (err as Error).message,
          });
          return null;
        }),
        this.attom.getSaleHistoryBasic(attomId).catch(err => {
          this.logger.warn('ATTOM /saleshistory/basichistory failed (non-fatal)', {
            attomId,
            error: (err as Error).message,
          });
          return null;
        }),
      ]);

      assessmentProperty = this.firstProperty(assessmentEnvelope);
      saleHistoryProperty = this.firstProperty(saleHistoryEnvelope);
    } else {
      this.logger.warn(
        'AttomPropertyDataProvider: attomId missing from detailowner response; ' +
        'assessment and sale history will be skipped.',
        { address: `${address1}, ${address2}` },
      );
    }

    const core = this.buildCore(detailProperty);
    const publicRecord = this.buildPublicRecord(
      detailProperty,
      assessmentProperty,
      saleHistoryProperty,
    );
    const flood = this.buildFlood(detailProperty);

    return {
      source: 'ATTOM Data Solutions',
      fetchedAt: new Date().toISOString(),
      core,
      publicRecord,
      flood,
      rawProviderData: {
        detail: detailProperty,
        assessment: assessmentProperty,
        saleHistory: saleHistoryProperty,
      },
    };
  }

  // ─── Internal mappers ────────────────────────────────────────────────────────

  private buildCore(prop: AttomRecord): PropertyDataCore {
    const core: PropertyDataCore = {};

    const building = prop['building'] as AttomRecord | undefined;
    const lot = prop['lot'] as AttomRecord | undefined;
    const address = prop['address'] as AttomRecord | undefined;
    const identifier = prop['identifier'] as AttomRecord | undefined;

    if (building) {
      const size = building['size'] as AttomRecord | undefined;
      // ATTOM provides multiple size variants; prefer universalSize (county-standard GLA).
      const gla = (size?.['universalSize'] ?? size?.['livingSize'] ?? size?.['bldgSize']) as
        | number
        | undefined;
      if (gla != null) core.grossLivingArea = gla;

      const rooms = building['rooms'] as AttomRecord | undefined;
      if (rooms) {
        const beds = rooms['beds'] as number | undefined;
        if (beds != null) core.bedrooms = beds;

        const bathsFull = rooms['bathsFull'] as number | undefined;
        if (bathsFull != null) core.bathsFull = bathsFull;

        const bathsHalf = rooms['bathsHalf'] as number | undefined;
        if (bathsHalf != null) core.bathsHalf = bathsHalf;

        // ATTOM sometimes returns bathsTotal instead of the split values.
        // Derive full/half from bathsTotal only when the individual fields are absent.
        if (core.bathsFull == null) {
          const bathsTotal = rooms['bathsTotal'] as number | undefined;
          if (bathsTotal != null) {
            core.bathsFull = Math.floor(bathsTotal);
            core.bathsHalf ??= Math.round((bathsTotal - Math.floor(bathsTotal)) * 2);
          }
        }

        const roomsTotal = rooms['roomsTotal'] as number | undefined;
        if (roomsTotal != null) core.totalRooms = roomsTotal;
      }

      const summary = building['summary'] as AttomRecord | undefined;
      if (summary) {
        const yearBuilt = summary['yearBuilt'] as number | undefined;
        if (yearBuilt != null) core.yearBuilt = yearBuilt;

        const propType = summary['propType'] ?? summary['propClass'];
        if (propType != null) core.propertyType = String(propType);

        // stories may be returned as "1" (string) or 1 (number)
        const storiesRaw = summary['stories'];
        if (storiesRaw != null) {
          const stories = Number(storiesRaw);
          if (!Number.isNaN(stories)) core.stories = stories;
        }
      }

      const parking = building['parking'] as AttomRecord | undefined;
      if (parking) {
        const prkgType = parking['prkgType'] as string | undefined;
        const prkgSize = parking['prkgSize'] as string | number | undefined;
        if (prkgType || prkgSize != null) {
          core.garage = prkgType
            ? `${prkgSize ?? ''}-car ${prkgType}`.trim()
            : `${prkgSize ?? 0}-car`;
        }
      }

      const interior = building['interior'] as AttomRecord | undefined;
      if (interior) {
        const bsmtType = interior['bsmtType'] as string | undefined;
        const bsmtSize = interior['bsmtSize'] as number | undefined;
        if (bsmtType && bsmtType !== '') {
          core.basement = bsmtSize ? `${bsmtType} (${bsmtSize} sq ft)` : bsmtType;
        }
      }
    }

    if (lot) {
      // lotSize2 = sq ft; lotSize1 = acres (use as fallback with conversion)
      const lotSqft = lot['lotSize2'] as number | undefined;
      const lotAcres = lot['lotSize1'] as number | undefined;
      if (lotSqft != null && lotSqft > 0) {
        core.lotSizeSqFt = lotSqft;
      } else if (lotAcres != null && lotAcres > 0) {
        core.lotSizeSqFt = Math.round(lotAcres * 43_560);
      }
    }

    if (identifier) {
      const apn = identifier['apn'] as string | undefined;
      if (apn) core.parcelNumber = apn;
    }

    if (address) {
      const county = address['county'] as string | undefined;
      if (county) core.county = county;

      // ATTOM returns coordinates as strings (not numbers)
      const latStr = address['latitude'] as string | number | undefined;
      const lngStr = address['longitude'] as string | number | undefined;
      const lat = latStr != null ? parseFloat(String(latStr)) : NaN;
      const lng = lngStr != null ? parseFloat(String(lngStr)) : NaN;
      if (!Number.isNaN(lat) && lat !== 0) core.latitude = lat;
      if (!Number.isNaN(lng) && lng !== 0) core.longitude = lng;
    }

    return core;
  }

  private buildPublicRecord(
    detail: AttomRecord | undefined,
    assessment: AttomRecord | undefined,
    saleHistory: AttomRecord | undefined,
  ): PropertyDataPublicRecord {
    const rec: PropertyDataPublicRecord = {};

    if (detail) {
      // Owner name from detailowner response
      const owner = detail['owner'] as AttomRecord | undefined;
      const owner1 = owner?.['owner1'] as AttomRecord | undefined;
      if (owner1) {
        const fullName = owner1['fullName'] as string | undefined;
        const firstName = owner1['firstName'] as string | undefined;
        const lastName = owner1['lastName'] as string | undefined;
        const name = fullName ?? [firstName, lastName].filter(Boolean).join(' ');
        if (name) rec.ownerName = name;
      }

      // Zoning and land use from the detail response's lot + summary blocks
      const lot = detail['lot'] as AttomRecord | undefined;
      const zoning = (lot?.['zoningCodeLocal'] ?? lot?.['zoningCode']) as string | undefined;
      if (zoning) rec.zoning = zoning;

      const summary = detail['summary'] as AttomRecord | undefined;
      const landUse = summary?.['propLandUse'] as string | undefined;
      if (landUse) rec.landUseCode = landUse;
    }

    if (assessment) {
      const asmtBlock = assessment['assessment'] as AttomRecord | undefined;

      if (asmtBlock) {
        const assessed = asmtBlock['assessed'] as AttomRecord | undefined;
        const tax = asmtBlock['tax'] as AttomRecord | undefined;

        const assdVal = assessed?.['assdTtlValue'] as number | undefined;
        if (assdVal != null) rec.taxAssessedValue = assdVal;

        const taxYear = tax?.['taxYear'] as number | undefined;
        if (taxYear != null) rec.taxYear = taxYear;

        const taxAmt = tax?.['taxAmt'] as number | undefined;
        if (taxAmt != null) rec.annualTaxAmount = taxAmt;
      }

      // Legal description lives on the assessment property's lot block
      const lot = assessment['lot'] as AttomRecord | undefined;
      const legalDesc = (lot?.['legalDescription1'] ?? lot?.['legalDescription']) as
        | string
        | undefined;
      if (legalDesc) rec.legalDescription = legalDesc;

      // Zoning backfill: use assessment response if not set by detail response
      if (!rec.zoning) {
        const zoning = (lot?.['zoningCodeLocal'] ?? lot?.['zoningCode']) as string | undefined;
        if (zoning) rec.zoning = zoning;
      }
    }

    if (saleHistory) {
      // salehistory is an array; ATTOM default sort is CalendarDate Desc (most-recent first)
      const history = saleHistory['salehistory'] as AttomRecord[] | undefined;
      const latest = Array.isArray(history) ? history[0] : undefined;

      if (latest) {
        // saleTransDate is ISO YYYY-MM-DD; recordingDate is an alternative field
        const rawDate = (latest['saleTransDate'] ?? latest['recordingDate']) as
          | string
          | undefined;
        if (rawDate) rec.deedTransferDate = this.normaliseDate(rawDate);

        const amount = latest['amount'] as AttomRecord | undefined;
        const saleAmt = amount?.['saleamt'] as number | undefined;
        if (saleAmt != null) rec.deedTransferAmount = saleAmt;
      }
    }

    return rec;
  }

  private buildFlood(prop: AttomRecord): PropertyDataFlood {
    const flood: PropertyDataFlood = {};
    const lot = prop['lot'] as AttomRecord | undefined;
    if (!lot) return flood;

    const zone = lot['floodZone'] as string | undefined;
    if (zone) flood.femaFloodZone = zone;

    const mapNum = (lot['floodMapNumber'] ?? lot['femaMapNumber']) as string | undefined;
    if (mapNum) flood.femaMapNumber = mapNum;

    const mapDate = (lot['floodMapDate'] ?? lot['femaMapDate']) as string | undefined;
    if (mapDate) flood.femaMapDate = this.normaliseDate(mapDate);

    return flood;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Extracts the first property record from an ATTOM API response envelope.
   * Returns undefined when the envelope is null/empty or carries no property records.
   */
  private firstProperty(envelope: unknown): AttomRecord | undefined {
    if (!envelope || typeof envelope !== 'object') return undefined;
    const env = envelope as AttomEnvelope;
    const list = env.property;
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list[0];
  }

  /**
   * Normalises an ATTOM date string to ISO YYYY-MM-DD.
   *
   * ATTOM returns dates in several formats depending on the endpoint:
   *   "2021-06-15"   — already ISO; slice to 10 chars
   *   "06/15/2021"   — MM/DD/YYYY; rearrange
   *   "20210615"     — YYYYMMDD compact; insert hyphens
   */
  private normaliseDate(raw: string): string {
    const s = raw.trim();

    // Already ISO or longer ISO timestamp
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // MM/DD/YYYY
    const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;

    // YYYYMMDD (8-digit compact)
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

    // Unknown format — return as-is
    return s;
  }
}
