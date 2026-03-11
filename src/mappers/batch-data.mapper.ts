/**
 * BatchData Vendor Mapper
 *
 * Maps the legacy "BatchData" vendor property shape (as stored in existing
 * Cosmos `reporting` documents) into the canonical schema.
 *
 * This is the FIRST mapper — reverse-engineered from:
 *   - src/functions/data/ReportData.js  (SelectedCompData template)
 *   - src/functions/src/createOrder.js  (document assembly)
 *   - src/functions/utils/selectComps.js (enrichment)
 *   - Actual Cosmos documents written by the above pipeline
 *
 * BatchData raw shape:
 *   property.address.{ street, city, state, zip, latitude, longitude }
 *   property.building.{ yearBuilt, bedroomCount, calculatedBathroomCount,
 *     livingAreaSquareFeet, basementSquareFeet, heatSource, airConditioningSource,
 *     garageParkingSpaceCount, garage, pool, porch, patio }
 *   property.sale.lastSale.{ price, saleDate }
 *   property.listing.{ status, soldPrice, soldDate, daysOnMarket }
 *   property.lot.{ lotSizeSquareFeet }
 *   property.ids.{ apn }
 *   property.general.{ propertyTypeCategory }
 *   property.valuation.{ estimatedValue, priceRangeMin, priceRangeMax, confidenceScore }
 *   property.images.{ imageUrls }
 *   property.distanceToSubejct  (typo preserved from vendor)
 *   property.selectedCompFlag
 *   property.comp_level
 *   property.compAnalysis.{ dataValues, adjustments }
 *
 * @see src/types/canonical-schema.ts for target types.
 */

import {
  SCHEMA_VERSION,
  type CanonicalAddress,
  type CanonicalAdjustments,
  type CanonicalComp,
  type CanonicalSubject,
  type CanonicalValuation,
  type CanonicalReportDocument,
  type MlsExtension,
  type VendorMapper,
} from '../types/canonical-schema.js';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: safe accessors (vendor data is untyped)
// ═══════════════════════════════════════════════════════════════════════════════

type RawObj = Record<string, unknown>;

function str(val: unknown, fallback = ''): string {
  if (val == null) return fallback;
  return String(val);
}

function num(val: unknown, fallback = 0): number {
  if (val == null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(val: unknown): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(val: unknown): string | null {
  if (val == null || val === '') return null;
  return String(val);
}

function bool(val: unknown): boolean {
  if (val == null) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() !== 'none' && val !== '' && val !== '0';
  return Boolean(val);
}

function obj(val: unknown): RawObj {
  return (val != null && typeof val === 'object' && !Array.isArray(val))
    ? val as RawObj
    : {};
}

function arr(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapAddress(raw: RawObj): CanonicalAddress {
  // BatchData uses address.{ street, city, state, zip }
  // Top-level doc may also have streetAddress, city, state, zip directly
  const addrBlock = obj(raw['address']);

  return {
    streetAddress: str(addrBlock['street'] ?? addrBlock['streetAddress'] ?? raw['streetAddress'] ?? raw['street'] ?? ''),
    unit: strOrNull(addrBlock['unit'] ?? addrBlock['unitNumber']),
    city: str(addrBlock['city'] ?? raw['city'] ?? ''),
    state: str(addrBlock['state'] ?? raw['state'] ?? ''),
    zipCode: str(addrBlock['zip'] ?? addrBlock['zipCode'] ?? raw['zip'] ?? raw['zipCode'] ?? ''),
    county: str(addrBlock['county'] ?? raw['county'] ?? ''),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY CORE MAPPING (shared between subject + comp)
// ═══════════════════════════════════════════════════════════════════════════════

interface CoreFields {
  address: CanonicalAddress;
  grossLivingArea: number;
  totalRooms: number;
  bedrooms: number;
  bathrooms: number;
  stories: number;
  lotSizeSqFt: number;
  propertyType: string;
  condition: string;
  quality: string;
  design: string;
  yearBuilt: number;
  foundationType: string;
  exteriorWalls: string;
  roofSurface: string;
  basement: string;
  basementFinishedSqFt: number | null;
  heating: string;
  cooling: string;
  fireplaces: number;
  garageType: string;
  garageSpaces: number;
  porchPatioDeck: string;
  pool: boolean;
  attic: string;
  view: string;
  locationRating: string;
  latitude: number | null;
  longitude: number | null;
}

function mapPropertyCore(raw: RawObj): CoreFields {
  const building = obj(raw['building']);
  const lot = obj(raw['lot']);
  const general = obj(raw['general']);
  const addrBlock = obj(raw['address']);

  // BatchData: building.livingAreaSquareFeet
  // compAnalysis.dataValues: livingArea
  const gla = num(
    building['livingAreaSquareFeet']
    ?? building['livingArea']
    ?? raw['livingAreaSquareFeet']
    ?? raw['livingArea']
    ?? raw['grossLivingArea']
  );

  const basementSqFt = num(
    building['basementSquareFeet']
    ?? building['basementArea']
    ?? raw['basementArea']
    ?? 0
  );

  // Pool: BatchData uses string "InGround"/"AboveGround"/"None"/null; also boolean in some shapes
  const poolRaw = building['pool'] ?? raw['pool'];
  const hasPool = bool(poolRaw);

  const porchParts = [
    str(building['porch'] ?? raw['porch'] ?? ''),
    str(building['patio'] ?? raw['patio'] ?? ''),
  ].filter(Boolean);

  const garageDesc = str(building['garage'] ?? raw['garage'] ?? '');
  const garageSpaces = num(building['garageParkingSpaceCount'] ?? raw['garageSpaces'] ?? 0);

  return {
    address: mapAddress(raw),
    grossLivingArea: gla,
    totalRooms: num(building['totalRoomCount'] ?? building['totalRooms'] ?? raw['totalRooms'] ?? 0),
    bedrooms: num(building['bedroomCount'] ?? building['bed'] ?? raw['bedroomCount'] ?? raw['bed'] ?? raw['bedrooms'] ?? 0),
    bathrooms: num(building['calculatedBathroomCount'] ?? building['bath'] ?? raw['bathroomCount'] ?? raw['bath'] ?? raw['bathrooms'] ?? 0),
    stories: num(building['stories'] ?? building['numberOfStories'] ?? raw['stories'] ?? 1),
    lotSizeSqFt: num(lot['lotSizeSquareFeet'] ?? raw['lotSizeSquareFeet'] ?? raw['lotSizeSqFt'] ?? 0),
    propertyType: str(general['propertyTypeCategory'] ?? general['propertyTypeDetail'] ?? raw['propertyType'] ?? 'SFR'),
    condition: str(building['condition'] ?? raw['condition'] ?? ''),
    quality: str(building['quality'] ?? raw['quality'] ?? ''),
    design: str(building['design'] ?? building['buildingStyle'] ?? raw['design'] ?? ''),
    yearBuilt: num(building['yearBuilt'] ?? raw['yearBuilt'] ?? 0),
    foundationType: str(building['foundationType'] ?? raw['foundationType'] ?? ''),
    exteriorWalls: str(building['exteriorWalls'] ?? building['constructionType'] ?? raw['exteriorWalls'] ?? ''),
    roofSurface: str(building['roofSurface'] ?? building['roofType'] ?? raw['roofSurface'] ?? ''),
    basement: basementSqFt > 0 ? 'Full' : 'None',
    basementFinishedSqFt: numOrNull(building['basementFinishedArea'] ?? building['basementFinishedSqFt']),
    heating: str(building['heatSource'] ?? building['heating'] ?? raw['heating'] ?? ''),
    cooling: str(building['airConditioningSource'] ?? building['ac'] ?? raw['cooling'] ?? ''),
    fireplaces: num(building['fireplaces'] ?? building['fireplaceCount'] ?? 0),
    garageType: garageDesc.includes('Attached') ? 'Attached'
      : garageDesc.includes('Detached') ? 'Detached'
      : garageDesc.includes('Carport') ? 'Carport'
      : garageSpaces > 0 ? 'Attached' : 'None',
    garageSpaces,
    porchPatioDeck: porchParts.join(', ') || 'None',
    pool: hasPool,
    attic: str(building['atticType'] ?? raw['attic'] ?? 'None'),
    view: str(building['view'] ?? raw['view'] ?? ''),
    locationRating: str(building['locationRating'] ?? raw['locationRating'] ?? 'Neutral'),
    latitude: numOrNull(addrBlock['latitude'] ?? raw['latitude']),
    longitude: numOrNull(addrBlock['longitude'] ?? raw['longitude']),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapBatchDataToSubject(raw: RawObj): CanonicalSubject {
  const core = mapPropertyCore(raw);
  const ids = obj(raw['ids']);

  return {
    ...core,
    parcelNumber: strOrNull(ids['apn'] ?? raw['fipsCodePlusApn'] ?? raw['parcelNumber']),
    censusTract: strOrNull(raw['censusTract']),
    mapReference: strOrNull(raw['mapReference']),
    currentOwner: strOrNull(raw['currentOwner']),
    occupant: null,
    legalDescription: strOrNull(obj(raw['legal'])['legalDescription'] ?? raw['legalDescription']),
    zoning: strOrNull(raw['zoning']),
    zoningCompliance: null,
    highestAndBestUse: null,
    floodZone: strOrNull(raw['floodZone']),
    floodMapNumber: strOrNull(raw['floodMapNumber']),
    floodMapDate: null,
    utilities: null,
    neighborhood: null,
    contractInfo: null,
    hpiTrend: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUSTMENTS MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapAdjustments(raw: RawObj | null | undefined): CanonicalAdjustments | null {
  if (!raw) return null;

  // Legacy adjustments from ReportData.js:
  //   yearBuiltAdj, bedAdj, bathAdj, livingAreaAdj, basementAreaAdj,
  //   heatingAdj, acAdj, garageAdj, poolAdj, porchAdj, patioAdj, totalAdj
  const netTotal = num(raw['totalAdj']);
  const salePrice = num(raw['__salePrice__']); // injected by caller

  return {
    saleOrFinancingConcessions: 0,
    dateOfSaleTime: 0,
    locationAdj: 0,
    leaseholdFeeSimple: 0,
    site: 0,
    viewAdj: 0,
    designAndAppeal: 0,
    qualityOfConstruction: 0,
    actualAge: num(raw['yearBuiltAdj']),
    conditionAdj: 0,
    aboveGradeRoomCount: 0,
    aboveGradeBedroom: num(raw['bedAdj']),
    aboveGradeBathroom: num(raw['bathAdj']),
    grossLivingAreaAdj: num(raw['livingAreaAdj']),
    basementAndFinishedRooms: num(raw['basementAreaAdj']),
    functionalUtility: 0,
    heatingCooling: num(raw['heatingAdj']) + num(raw['acAdj']),
    energyEfficiency: 0,
    garageCarport: num(raw['garageAdj']),
    porchPatioPool: num(raw['poolAdj']) + num(raw['porchAdj']) + num(raw['patioAdj']),
    otherAdj1: 0,
    otherAdj2: 0,
    otherAdj3: 0,
    netAdjustmentTotal: netTotal,
    grossAdjustmentTotal: [
      num(raw['yearBuiltAdj']), num(raw['bedAdj']), num(raw['bathAdj']),
      num(raw['livingAreaAdj']), num(raw['basementAreaAdj']),
      num(raw['heatingAdj']), num(raw['acAdj']),
      num(raw['garageAdj']), num(raw['poolAdj']),
      num(raw['porchAdj']), num(raw['patioAdj']),
    ].reduce((sum, v) => sum + Math.abs(v), 0),
    adjustedSalePrice: salePrice + netTotal,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMP MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse the legacy selectedCompFlag into { selected, slotIndex }.
 *
 *   "S1" → { selected: true, slotIndex: 1, dataSource: 'avm' }
 *   "L2" → { selected: true, slotIndex: 5, dataSource: 'avm' }  (L starts at slot 4)
 *   "Subject" → skipped (not a comp)
 *   "" / undefined → { selected: false, slotIndex: null }
 */
function parseCompFlag(flag: unknown): { selected: boolean; slotIndex: number | null } {
  const f = str(flag).trim();
  if (!f || f === 'Subject') return { selected: false, slotIndex: null };
  const soldMatch = f.match(/^S(\d+)$/i);
  if (soldMatch) return { selected: true, slotIndex: parseInt(soldMatch[1]!, 10) };
  const listMatch = f.match(/^L(\d+)$/i);
  if (listMatch) return { selected: true, slotIndex: 3 + parseInt(listMatch[1]!, 10) };
  return { selected: false, slotIndex: null };
}

function mapBatchDataToComp(raw: RawObj, index: number): CanonicalComp | null {
  // Skip the subject record if it snuck into compsData
  if (str(raw['selectedCompFlag']) === 'Subject') return null;

  const core = mapPropertyCore(raw);
  const sale = obj(raw['sale']);
  const lastSale = obj(sale['lastSale']);
  const listing = obj(raw['listing']);
  const compAnalysis = obj(raw['compAnalysis']);
  const adjustmentsRaw = obj(compAnalysis['adjustments']);
  const dataValues = obj(compAnalysis['dataValues']);
  const valuation = obj(raw['valuation']);

  // Prefer listing.soldPrice over sale.lastSale.price (listing is enrichment, sale is raw)
  const salePrice = numOrNull(listing['soldPrice'] ?? lastSale['price'] ?? dataValues['lastSalePrice']);
  const saleDate = strOrNull(listing['soldDate'] ?? lastSale['saleDate'] ?? dataValues['lastSaleDate']);

  const { selected, slotIndex } = parseCompFlag(raw['selectedCompFlag']);

  // Inject salePrice so adjustments mapper can compute adjustedSalePrice
  if (salePrice != null) {
    (adjustmentsRaw as Record<string, unknown>)['__salePrice__'] = salePrice;
  }

  // Build MLS extension if listing data exists
  const mlsData: MlsExtension | null = listing['status'] ? {
    mlsNumber: str(listing['mlsNumber'] ?? ''),
    listDate: strOrNull(listing['listDate']),
    soldDate: strOrNull(listing['soldDate']),
    daysOnMarket: numOrNull(listing['daysOnMarket']),
    listingStatus: str(listing['status']),
    listingAgent: strOrNull(listing['listingAgent']),
    sellingAgent: strOrNull(listing['sellingAgent']),
    photos: arr(obj(raw['images'])['imageUrls']).map(u => str(u)),
    propertyDescription: null,
    hoaFee: null,
    hoaFrequency: null,
    schoolDistrict: null,
    interiorFeatures: [],
    exteriorFeatures: [],
    heating: strOrNull(core.heating || null),
    cooling: strOrNull(core.cooling || null),
  } : null;

  return {
    ...core,
    compId: str(raw['propertyRecordId'] ?? raw['id'] ?? `comp-${index}`),
    salePrice,
    saleDate,
    priorSalePrice: numOrNull(obj(sale['priorSale'])?.['price']),
    priorSaleDate: strOrNull(obj(sale['priorSale'])?.['saleDate']),
    listPrice: numOrNull(listing['listPrice'] ?? dataValues['listPrice']),
    financingType: null,
    saleType: null,
    concessionsAmount: null,
    dataSource: 'avm',
    vendorId: 'batch_data',
    vendorRecordRef: strOrNull(raw['propertyRecordId']),
    distanceFromSubjectMiles: num(raw['distanceToSubejct'] ?? raw['distanceToSubject'] ?? raw['distanceMiles'] ?? 0),
    proximityScore: numOrNull(raw['comp_level']),
    selected,
    slotIndex,
    adjustments: selected ? mapAdjustments(adjustmentsRaw) : null,
    mlsData,
    publicRecordData: null,
  };
}

function mapBatchDataToComps(compsRaw: unknown[]): CanonicalComp[] {
  return compsRaw
    .map((item, i) => mapBatchDataToComp(obj(item), i))
    .filter((c): c is CanonicalComp => c !== null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALUATION MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

function mapValuation(raw: RawObj | null | undefined): CanonicalValuation | null {
  if (!raw) return null;
  const estimated = numOrNull(raw['estimatedValue']);
  if (estimated == null) return null;

  return {
    estimatedValue: estimated,
    lowerBound: num(raw['lowerBound'] ?? raw['priceRangeMin'] ?? 0),
    upperBound: num(raw['upperBound'] ?? raw['priceRangeMax'] ?? 0),
    confidenceScore: numOrNull(raw['confidenceScore']),
    effectiveDate: str(raw['valuationEstimateDate'] ?? raw['asOfDate'] ?? new Date().toISOString()),
    reconciliationNotes: strOrNull(raw['reconciliationNotes']),
    approachesUsed: ['sales_comparison'],
    avmProvider: 'batch_data',
    avmModelVersion: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL REPORT DOCUMENT MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps a complete legacy reporting document (as stored in Cosmos today)
 * into a CanonicalReportDocument.
 *
 * @param legacyDoc - The raw document from the `reporting` container.
 * @returns A canonical report document ready for upsert.
 */
export function mapBatchDataReport(legacyDoc: RawObj): CanonicalReportDocument {
  const propertyData = obj(legacyDoc['propertyData']);
  const compsData = arr(legacyDoc['compsData']);
  const valuationEstimate = obj(legacyDoc['valuationEstimate']);

  const subject = mapBatchDataToSubject(propertyData);
  const comps = mapBatchDataToComps(compsData);
  const valuation = mapValuation(
    Object.keys(valuationEstimate).length > 0 ? valuationEstimate : null,
  );

  return {
    id: str(legacyDoc['id'] ?? legacyDoc['reportRecordId']),
    reportId: str(legacyDoc['reportRecordId'] ?? legacyDoc['id']),
    orderId: str(legacyDoc['orderRecordId'] ?? legacyDoc['orderId']),
    reportType: str(legacyDoc['productType'] ?? '1004'),
    status: str(legacyDoc['status'] ?? 'draft'),
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      orderId: str(legacyDoc['orderRecordId'] ?? legacyDoc['orderId']),
      orderNumber: str(legacyDoc['orderNumber'] ?? '') || null,
      borrowerName: str(legacyDoc['borrowerName'] ?? '') || null,
      ownerOfPublicRecord: str(legacyDoc['ownerOfRecord'] ?? '') || null,
      clientName: str(legacyDoc['clientName'] ?? '') || null,
      clientCompanyName: str(legacyDoc['clientCompanyName'] ?? '') || null,
      clientAddress: null,
      clientEmail: null,
      loanNumber: str(legacyDoc['loanNumber'] ?? '') || null,
      effectiveDate: str(legacyDoc['effectiveDate'] ?? '') || null,
      inspectionDate: str(legacyDoc['inspectionDate'] ?? '') || null,
      isSubjectPurchase: false,
      contractPrice: null,
      contractDate: null,
      subjectPriorSaleDate1: null,
      subjectPriorSalePrice1: null,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
    },
    subject,
    comps,
    valuation,
    createdAt: str(legacyDoc['createdAt'] ?? legacyDoc['dateCreated'] ?? new Date().toISOString()),
    updatedAt: str(legacyDoc['updatedAt'] ?? new Date().toISOString()),
    createdBy: str(legacyDoc['createdBy'] ?? 'system'),
    updatedBy: str(legacyDoc['updatedBy'] ?? 'system'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR MAPPER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The BatchData VendorMapper implementation.
 *
 * Usage:
 *   import { batchDataMapper } from '../mappers/batch-data.mapper.js';
 *   const subject = batchDataMapper.mapToSubject(rawPropertyData);
 *   const comps = batchDataMapper.mapToComps(rawCompsArray);
 */
export const batchDataMapper: VendorMapper = {
  vendorId: 'batch_data',
  mapToSubject: (raw) => mapBatchDataToSubject(raw),
  mapToComps: (raw) => mapBatchDataToComps(arr(raw['comps'] ?? raw['compsData'] ?? raw)),
};
