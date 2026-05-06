/**
 * Bridge Interactive Property Data Provider
 *
 * Adapts BridgeInteractiveService to the generic PropertyDataProvider interface
 * for subject property enrichment (core characteristics + public records + flood).
 *
 * Data sources used:
 *   MLS OData  → core building characteristics (GLA, beds, baths, yearBuilt, etc.)
 *   Public Data parcels API   → APN, county, lat/lng
 *   Public Data assessments API → assessed value, tax, owner, legal desc, zoning
 *   Public Data transactions API → deed transfer date/amount
 *
 * Field mappings (Bridge OData → PropertyDataCore):
 *   LivingArea          → grossLivingArea
 *   BedroomsTotal       → bedrooms
 *   BathroomsTotalDecimal → bathsFull + bathsHalf (halves derived)
 *   YearBuilt           → yearBuilt
 *   LotSizeArea         → lotSizeSqFt (acres → sqft conversion when needed)
 *   PropertyType        → propertyType
 *   StoriesTotal        → stories
 *   CountyOrParish      → county
 *   GarageSpaces / GarageType → garage
 *   UnparsedAddress+City+StateOrProvince+PostalCode → address confirmation
 *
 * Field mappings (Bridge public parcels → core / publicRecord):
 *   parcel.parcelNumber → parcelNumber
 *   parcel.latitude/longitude → lat/lng
 *   parcel.zoning → zoning
 *   parcel.landUseCode → landUseCode
 *   assessment.taxAssessedValue / .year / .annualTaxAmount
 *   assessment.ownerName
 *   assessment.legalDescription
 *   transaction.recordingDate / .amount → deedTransferDate / deedTransferAmount
 *   parcel.floodZone / .floodMapNumber / .floodMapDate → flood
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
  PropertyDataCore,
  PropertyDataPublicRecord,
  PropertyDataFlood,
} from '../../types/property-data.types.js';
import { BridgeInteractiveService } from '../bridge-interactive.service.js';
import { Logger } from '../../utils/logger.js';

export class BridgePropertyDataProvider implements PropertyDataProvider {
  private readonly bridge: BridgeInteractiveService;
  private readonly logger: Logger;

  constructor() {
    this.bridge = new BridgeInteractiveService();
    this.logger = new Logger('BridgePropertyDataProvider');
  }

  async lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    const fullAddress = `${params.street}, ${params.city}, ${params.state} ${params.zipCode}`;

    this.logger.info('BridgePropertyDataProvider.lookupByAddress', { address: fullAddress });

    // Fire MLS and public-records lookups in parallel; neither blocks the other.
    const [mlsProperties, parcels] = await Promise.all([
      this.bridge.searchByAddress({ address: fullAddress }).catch(err => {
        this.logger.warn('Bridge MLS address lookup failed (non-fatal)', {
          address: fullAddress,
          error: (err as Error).message,
        });
        return [] as unknown[];
      }),
      this.bridge.searchParcels({ address: fullAddress }).catch(err => {
        this.logger.warn('Bridge parcels lookup failed (non-fatal)', {
          address: fullAddress,
          error: (err as Error).message,
        });
        return null;
      }),
    ]);

    const mlsList = Array.isArray(mlsProperties)
      ? (mlsProperties as Record<string, unknown>[])
      : this.extractList(mlsProperties);
    const mlsRecord = mlsList[0] as Record<string, unknown> | undefined;

    // parcels response has a `results` or `value` wrapper in Bridge public API
    const parcelList: Record<string, unknown>[] = this.extractList(parcels);
    const parcel = parcelList[0];

    // If neither source found anything, return null (provider miss, not error)
    if (!mlsRecord && !parcel) {
      this.logger.info('BridgePropertyDataProvider: no match found', { address: fullAddress });
      return null;
    }

    // Fetch assessments and transactions for the parcel, if we have one
    let assessment: Record<string, unknown> | undefined;
    let transaction: Record<string, unknown> | undefined;

    if (parcel) {
      const parcelId = parcel['id'] as string | undefined ?? parcel['parcelId'] as string | undefined;
      if (parcelId) {
        const [assessments, transactions] = await Promise.all([
          this.bridge.getParcelAssessments(parcelId).catch(err => {
            this.logger.warn('Bridge parcel assessments failed (non-fatal)', {
              parcelId,
              error: (err as Error).message,
            });
            return null;
          }),
          this.bridge.getParcelTransactions(parcelId).catch(err => {
            this.logger.warn('Bridge parcel transactions failed (non-fatal)', {
              parcelId,
              error: (err as Error).message,
            });
            return null;
          }),
        ]);

        const assessmentList = this.extractList(assessments);
        // Most recent assessment first
        assessment = assessmentList.sort((a, b) =>
          ((b['year'] as number) ?? 0) - ((a['year'] as number) ?? 0)
        )[0];

        const transactionList = this.extractList(transactions);
        // Most recent transaction first
        transaction = transactionList.sort((a, b) =>
          new Date((b['recordingDate'] as string) ?? 0).getTime() -
          new Date((a['recordingDate'] as string) ?? 0).getTime()
        )[0];
      }
    }

    const core = this.buildCore(mlsRecord, parcel);
    const publicRecord = this.buildPublicRecord(parcel, assessment, transaction);
    const flood = this.buildFlood(parcel);

    return {
      source: 'Bridge Interactive',
      fetchedAt: new Date().toISOString(),
      core,
      publicRecord,
      flood,
      rawProviderData: { mls: mlsRecord, parcel, assessment, transaction },
    };
  }

  // ─── Internal mappers ────────────────────────────────────────────────────────

  private buildCore(
    mls: Record<string, unknown> | undefined,
    parcel: Record<string, unknown> | undefined,
  ): PropertyDataCore {
    const core: PropertyDataCore = {};

    if (mls) {
      const gla = mls['LivingArea'] as number | undefined;
      if (gla != null) core.grossLivingArea = gla;

      const beds = mls['BedroomsTotal'] as number | undefined;
      if (beds != null) core.bedrooms = beds;

      // Bridge returns decimal baths (e.g. 2.5); split into full + half
      const bathsDecimal = mls['BathroomsTotalDecimal'] as number | undefined;
      if (bathsDecimal != null) {
        core.bathsFull = Math.floor(bathsDecimal);
        core.bathsHalf = Math.round((bathsDecimal - Math.floor(bathsDecimal)) * 2);
      }

      const yearBuilt = mls['YearBuilt'] as number | undefined;
      if (yearBuilt != null) core.yearBuilt = yearBuilt;

      const lotSize = mls['LotSizeArea'] as number | undefined;
      const lotUnits = (mls['LotSizeUnits'] as string | undefined)?.toLowerCase();
      if (lotSize != null) {
        // Bridge may return acres; convert to sqft
        core.lotSizeSqFt = lotUnits === 'acres' ? Math.round(lotSize * 43_560) : lotSize;
      }

      const propType = mls['PropertyType'] as string | undefined;
      if (propType) core.propertyType = propType;

      const stories = mls['StoriesTotal'] as number | undefined;
      if (stories != null) core.stories = stories;

      const county = mls['CountyOrParish'] as string | undefined;
      if (county) core.county = county;

      const garageSpaces = mls['GarageSpaces'] as number | undefined;
      const garageType = mls['GarageType'] as string | undefined;
      if (garageSpaces != null || garageType) {
        core.garage = garageType
          ? `${garageSpaces ?? ''}-car ${garageType}`.trim()
          : `${garageSpaces ?? 0}-car`;
      }
    }

    if (parcel) {
      // Bridge public API uses `apn` (not `parcelNumber`)
      const apn = parcel['apn'] as string | undefined ?? parcel['parcelNumber'] as string | undefined;
      if (apn) core.parcelNumber = apn;

      // Coordinates are returned as a [longitude, latitude] GeoJSON array.
      // Some parcels return [0,0] when coordinates are unavailable.
      const coords = parcel['coordinates'] as number[] | undefined;
      const lat = coords?.[1];  // GeoJSON: [lng, lat]
      const lng = coords?.[0];
      if (lat != null && lat !== 0) core.latitude  = lat;
      if (lng != null && lng !== 0) core.longitude = lng;

      // Parcel may supply lot size if MLS didn't
      if (core.lotSizeSqFt == null) {
        const lotSqft = parcel['lotSizeSquareFeet'] as number | undefined;
        if (lotSqft != null) core.lotSizeSqFt = lotSqft;
      }

      if (!core.county) {
        const county = parcel['county'] as string | undefined;
        if (county) core.county = county;
      }

      // Bridge public API stores building characteristics in parcel.building[] and
      // parcel.areas[]. Use these as fallbacks when the MLS record did not supply
      // them (e.g. condo or non-active listing not in the MLS OData feed).
      const buildingArr = parcel['building'] as Record<string, unknown>[] | undefined;
      const buildingRow = Array.isArray(buildingArr) ? buildingArr[0] : undefined;

      if (buildingRow) {
        if (core.grossLivingArea == null) {
          // Bridge public API: GLA lives in parcel.areas[], not directly on building.
          // Fall back to the first "Heated Building Area" (or "Effective Building Area")
          // from the areas array, which is the closest equivalent to appraiser GLA.
          const areasArr = parcel['areas'] as Array<{ areaSquareFeet?: number; type?: string }> | undefined;
          if (Array.isArray(areasArr)) {
            const heated = areasArr.find(a =>
              typeof a.type === 'string' &&
              (a.type.toLowerCase().includes('heated') || a.type.toLowerCase().includes('effective building'))
            );
            const sqft = heated?.areaSquareFeet;
            if (sqft != null && sqft > 0) core.grossLivingArea = sqft;
          }
        }

        if (core.yearBuilt == null) {
          const yr = buildingRow['yearBuilt'] as number | undefined;
          if (yr != null && yr > 0) core.yearBuilt = yr;
        }

        if (core.bedrooms == null) {
          const beds = buildingRow['bedrooms'] as number | undefined;
          if (beds != null) core.bedrooms = beds;
        }

        if (core.bathsFull == null && core.bathsHalf == null) {
          const full = buildingRow['fullBaths'] as number | undefined;
          const half = buildingRow['halfBaths'] as number | undefined;
          if (full != null) core.bathsFull = full;
          if (half != null) core.bathsHalf = half;
        }

        if (core.stories == null) {
          const stories = buildingRow['totalStories'] as number | undefined;
          if (stories != null) core.stories = stories;
        }
      }
    }

    return core;
  }

  private buildPublicRecord(
    parcel: Record<string, unknown> | undefined,
    assessment: Record<string, unknown> | undefined,
    transaction: Record<string, unknown> | undefined,
  ): PropertyDataPublicRecord {
    const rec: PropertyDataPublicRecord = {};

    if (parcel) {
      // Bridge public API uses `zoningCode`, not `zoning`
      const zoning = parcel['zoningCode'] as string | undefined ?? parcel['zoning'] as string | undefined;
      if (zoning) rec.zoning = zoning;

      // Bridge public API uses `landUseCode`; `landUse` / `landUseGeneral` as fallbacks
      const luc = parcel['landUseCode'] as string | undefined
        ?? parcel['landUse'] as string | undefined
        ?? parcel['landUseGeneral'] as string | undefined;
      if (luc) rec.landUseCode = luc;

      // Legal description lives in parcel.legal.lotDescription
      const legalObj = parcel['legal'] as Record<string, unknown> | undefined;
      const lotDesc = legalObj?.['lotDescription'] as string | undefined;
      if (lotDesc) rec.legalDescription = lotDesc;
    }

    if (assessment) {
      // Bridge public API uses `totalValue` for the assessed value.
      // `assessedValue` / `taxAssessedValue` are kept as fallbacks for resilience.
      const assessed = assessment['totalValue'] as number | undefined
        ?? assessment['assessedValue'] as number | undefined
        ?? assessment['taxAssessedValue'] as number | undefined;
      if (assessed != null) rec.taxAssessedValue = assessed;

      const year = assessment['year'] as number | undefined ?? assessment['taxYear'] as number | undefined;
      if (year != null) rec.taxYear = year;

      // Bridge public API: `taxAmount` (annualTaxAmount is a dev-side guess)
      const tax = assessment['taxAmount'] as number | undefined ?? assessment['annualTaxAmount'] as number | undefined;
      if (tax != null) rec.annualTaxAmount = tax;

      // ownerName is not returned in Bridge public assessment records (no change needed;
      // the field will simply remain unset, which is the correct behaviour).
    }

    if (transaction) {
      const recDate = transaction['recordingDate'] as string | undefined;
      if (recDate) rec.deedTransferDate = recDate.slice(0, 10); // ensure ISO YYYY-MM-DD

      // Bridge public API uses `salesPrice`; `amount` / `saleAmount` as fallbacks
      const amount = transaction['salesPrice'] as number | undefined
        ?? transaction['amount'] as number | undefined
        ?? transaction['saleAmount'] as number | undefined;
      if (amount != null) rec.deedTransferAmount = amount;
    }

    return rec;
  }

  private buildFlood(parcel: Record<string, unknown> | undefined): PropertyDataFlood {
    const flood: PropertyDataFlood = {};
    if (!parcel) return flood;

    const zone = parcel['floodZone'] as string | undefined ?? parcel['femaFloodZone'] as string | undefined;
    if (zone) flood.femaFloodZone = zone;

    const mapNum = parcel['floodMapNumber'] as string | undefined ?? parcel['femaMapNumber'] as string | undefined;
    if (mapNum) flood.femaMapNumber = mapNum;

    const mapDate = parcel['floodMapDate'] as string | undefined ?? parcel['femaMapDate'] as string | undefined;
    if (mapDate) flood.femaMapDate = mapDate.slice(0, 10);

    return flood;
  }

  /** Normalizes Bridge API list payload shapes:
   *  - MLS OData        wraps in `value[]`
   *  - Public Data API  wraps in `bundle[]`
   *  - Some endpoints return bare arrays
   */
  private extractList(response: unknown): Record<string, unknown>[] {
    if (!response || typeof response !== 'object') return [];
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj['bundle']))  return obj['bundle']  as Record<string, unknown>[];
    if (Array.isArray(obj['value']))   return obj['value']   as Record<string, unknown>[];
    if (Array.isArray(obj['results'])) return obj['results'] as Record<string, unknown>[];
    if (Array.isArray(response))       return response       as Record<string, unknown>[];
    return [];
  }
}
