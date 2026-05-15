/**
 * Seed Module: Reports
 *
 * Seeds the `reporting` Cosmos container with canonical-shaped CanonicalReportDocument
 * objects. These documents conform to SCHEMA_VERSION '1.0.0' and use URAR/UAD 3.6
 * aligned field names.
 *
 * Creates 3 report documents:
 *   - seed-report-001: Completed full 1004, Dallas TX, 6 selected comps (3 sold + 3 list)
 *   - seed-report-003: In-progress full 1004, Dallas TX, 3 sold comps selected + 12 candidates
 *   - seed-report-009: Completed full 1004, Fort Worth TX, 6 selected comps; backs
 *                      legacy seed-order-009 so that FinalReportPanel preview works
 *                      without requiring a manual workspace save first.
 *
 * Reports 001 and 003 provide a realistic candidate pool so the comp-workspace swap
 * UI has unassigned comps to work with.
 */

import {
  SCHEMA_VERSION,
  type CanonicalReportDocument,
  type CanonicalSubject,
  type CanonicalComp,
  type CanonicalAdjustments,
  type CanonicalNeighborhood,
  type CanonicalUtilities,
  type MlsExtension,
} from '@l1/shared-types';

import {
  type SeedModule,
  type SeedContext,
  type SeedModuleResult,
  upsert,
  cleanContainer,
  daysAgo,
} from '../seed-types.js';

import { REPORT_IDS, ORDER_IDS } from '../seed-ids.js';

// Legacy order ID for seed-order-009 (pre-SEED-VO migration format, protected by
// cleanup-orphan-orders.ts). New-format equivalent is ORDER_IDS.SUBMITTED_009.
const LEGACY_ORDER_009_ID = 'seed-order-009';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED DIMENSIONS
// ═══════════════════════════════════════════════════════════════════════════════

const DALLAS_NEIGHBORHOOD: CanonicalNeighborhood = {
  locationType: 'Urban',
  builtUp: 'Over 75%',
  growth: 'Stable',
  propertyValues: 'Increasing',
  demandSupply: 'Shortage',
  marketingTime: 'Under 3 months',
  predominantOccupancy: 'Owner',
  singleFamilyPriceRange: { low: 280000, high: 680000 },
  predominantAge: '10-30 years',
  presentLandUse: { singleFamily: 70, multifamily: 15, commercial: 10, other: 5 },
  boundaryDescription: 'Lowest Greenville to Abrams Rd, Ross Ave to Mockingbird Ln',
  neighborhoodDescription: 'Established urban neighborhood with mix of original construction and renovated homes.',
  marketConditionsNotes: 'Rising values, low DOM. Multiple-offer situations common on updated properties.',
};

const DALLAS_UTILITIES: CanonicalUtilities = {
  electricity: 'Public',
  gas: 'Public',
  water: 'Public',
  sewer: 'Public',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT PROPERTY
// ═══════════════════════════════════════════════════════════════════════════════

const SUBJECT_4521: CanonicalSubject = {
  address: {
    streetAddress: '4521 Mockingbird Ln',
    unit: null,
    city: 'Dallas',
    state: 'TX',
    zipCode: '75205',
    county: 'Dallas',
  },
  grossLivingArea: 2150,
  totalRooms: 7,
  bedrooms: 3,
  bathrooms: 2,
  stories: 1,
  lotSizeSqFt: 7200,
  propertyType: 'SFR',
  condition: 'C3',
  quality: 'Q3',
  design: 'Ranch',
  yearBuilt: 1985,
  foundationType: 'Slab',
  exteriorWalls: 'Brick',
  roofSurface: 'Composition Shingle',
  basement: 'None',
  basementFinishedSqFt: null,
  heating: 'FWA',
  cooling: 'Central',
  fireplaces: 1,
  garageType: 'Attached',
  garageSpaces: 2,
  porchPatioDeck: 'Covered Patio',
  pool: false,
  attic: 'None',
  view: 'Residential',
  locationRating: 'Neutral',
  latitude: 32.8357,
  longitude: -96.7872,
  parcelNumber: '00-1234-5678-0000',
  censusTract: '0112.01',
  mapReference: 'Dallas Co Map 45-B',
  currentOwner: 'James & Karen Mitchell',
  occupant: 'Owner',
  legalDescription: 'LOT 12, BLK 4, MEADOWBROOK EST, DALLAS CO TX',
  zoning: 'SF-D',
  zoningCompliance: 'Legal',
  highestAndBestUse: 'Present',
  floodZone: 'X',
  floodMapNumber: '48113C0297J',
  floodMapDate: '2010-09-15',
  utilities: DALLAS_UTILITIES,
  neighborhood: DALLAS_NEIGHBORHOOD,
  contractInfo: null,
  hpiTrend: 'Increasing',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUSTMENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function makeAdjustments(
  salePrice: number,
  overrides: Partial<Omit<CanonicalAdjustments, 'netAdjustmentTotal' | 'grossAdjustmentTotal' | 'adjustedSalePrice'>>,
): CanonicalAdjustments {
  const base: Omit<CanonicalAdjustments, 'netAdjustmentTotal' | 'grossAdjustmentTotal' | 'adjustedSalePrice'> = {
    saleOrFinancingConcessions: 0,
    dateOfSaleTime: 0,
    locationAdj: 0,
    leaseholdFeeSimple: 0,
    site: 0,
    viewAdj: 0,
    designAndAppeal: 0,
    qualityOfConstruction: 0,
    actualAge: 0,
    conditionAdj: 0,
    aboveGradeRoomCount: 0,
    aboveGradeBedroom: 0,
    aboveGradeBathroom: 0,
    grossLivingAreaAdj: 0,
    basementAndFinishedRooms: 0,
    functionalUtility: 0,
    heatingCooling: 0,
    energyEfficiency: 0,
    garageCarport: 0,
    porchPatioPool: 0,
    otherAdj1: 0,
    otherAdj2: 0,
    otherAdj3: 0,
    ...overrides,
  };

  const adjFields: (keyof typeof base)[] = [
    'saleOrFinancingConcessions', 'dateOfSaleTime', 'locationAdj', 'leaseholdFeeSimple',
    'site', 'viewAdj', 'designAndAppeal', 'qualityOfConstruction', 'actualAge',
    'conditionAdj', 'aboveGradeRoomCount', 'aboveGradeBedroom', 'aboveGradeBathroom',
    'grossLivingAreaAdj', 'basementAndFinishedRooms', 'functionalUtility', 'heatingCooling',
    'energyEfficiency', 'garageCarport', 'porchPatioPool', 'otherAdj1', 'otherAdj2', 'otherAdj3',
  ];

  const net = adjFields.reduce((s, k) => s + (Number(base[k]) || 0), 0);
  const gross = adjFields.reduce((s, k) => s + Math.abs(Number(base[k]) || 0), 0);

  return { ...base, netAdjustmentTotal: net, grossAdjustmentTotal: gross, adjustedSalePrice: salePrice + net } as CanonicalAdjustments;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MLS EXTENSION FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

function makeMls(overrides: Partial<MlsExtension> & { mlsNumber: string; listingStatus: string }): MlsExtension {
  return {
    listDate: null,
    soldDate: null,
    daysOnMarket: null,
    listingAgent: null,
    sellingAgent: null,
    photos: [],
    propertyDescription: null,
    hoaFee: null,
    hoaFrequency: null,
    schoolDistrict: 'Dallas ISD',
    interiorFeatures: [],
    exteriorFeatures: [],
    heating: 'FWA',
    cooling: 'Central',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMP POOL — 18 Dallas-area comps
// All share the same base characteristics near subject; overrides differentiate them.
// ═══════════════════════════════════════════════════════════════════════════════

function baseComp(
  id: string,
  street: string,
  gla: number,
  bed: number,
  bath: number,
  salePrice: number,
  saleDate: string,
  dom: number,
  distMi: number,
  selected: boolean,
  slotIndex: number | null,
  adjOverrides: Parameters<typeof makeAdjustments>[1] = {},
): CanonicalComp {
  return {
    compId: id,
    address: { streetAddress: street, unit: null, city: 'Dallas', state: 'TX', zipCode: '75205', county: 'Dallas' },
    grossLivingArea: gla,
    totalRooms: bed + 3,
    bedrooms: bed,
    bathrooms: bath,
    stories: 1,
    lotSizeSqFt: 6800,
    propertyType: 'SFR',
    condition: 'C3',
    quality: 'Q3',
    design: 'Ranch',
    yearBuilt: 1983,
    foundationType: 'Slab',
    exteriorWalls: 'Brick',
    roofSurface: 'Composition Shingle',
    basement: 'None',
    basementFinishedSqFt: null,
    heating: 'FWA',
    cooling: 'Central',
    fireplaces: 1,
    garageType: 'Attached',
    garageSpaces: 2,
    porchPatioDeck: 'Covered Patio',
    pool: false,
    attic: 'None',
    view: 'Residential',
    locationRating: 'Neutral',
    latitude: 32.835 + (Math.random() * 0.01 - 0.005),
    longitude: -96.787 + (Math.random() * 0.01 - 0.005),
    salePrice,
    saleDate,
    priorSalePrice: null,
    priorSaleDate: null,
    listPrice: salePrice + 5000,
    financingType: 'Conventional',
    saleType: 'ArmLength',
    concessionsAmount: null,
    dataSource: 'avm',
    vendorId: 'batch_data',
    vendorRecordRef: `seed-raw-${id}`,
    distanceFromSubjectMiles: distMi,
    proximityScore: Math.round((1 - distMi / 2) * 100),
    selected,
    slotIndex,
    adjustments: selected ? makeAdjustments(salePrice, {
      grossLivingAreaAdj: (2150 - gla) * 65, // $65/sqft GLA adjustment
      aboveGradeBedroom: (3 - bed) * 5000,
      aboveGradeBathroom: (2 - bath) * 3000,
      ...adjOverrides,
    }) : null,
    mlsData: makeMls({
      mlsNumber: `NTREIS-${id.replace('seed-comp-', '')}`,
      listingStatus: 'Sold',
      soldDate: saleDate,
      daysOnMarket: dom,
    }),
    publicRecordData: null,
  };
}

// ─── 6 selected comps (slots 1-3 sold + 4-6 list) ────────────────────────────
const SELECTED_COMPS: CanonicalComp[] = [
  baseComp('seed-comp-s1', '4408 Swiss Ave',    2080, 3, 2, 425000, daysAgo(45),  12, 0.3, true, 1),
  baseComp('seed-comp-s2', '4619 Gaston Ave',   2210, 3, 2, 455000, daysAgo(62),  8,  0.5, true, 2),
  baseComp('seed-comp-s3', '4735 Reiger Ave',   2000, 3, 2, 415000, daysAgo(30),  18, 0.4, true, 3),
  baseComp('seed-comp-l4', '4521 Belleview Ave', 2300, 4, 2, 470000, daysAgo(15), 22, 0.6, true, 4, { aboveGradeBedroom: -5000 }),
  baseComp('seed-comp-l5', '4812 Lindsley Ave', 2100, 3, 2, 440000, daysAgo(20),  9,  0.7, true, 5),
  baseComp('seed-comp-l6', '4233 Rawlins St',   1980, 3, 2, 410000, daysAgo(28), 31, 0.8, true, 6),
];

// ─── 12 candidate comps (unassigned — available for swap) ─────────────────────
const CANDIDATE_COMPS: CanonicalComp[] = [
  baseComp('seed-comp-c01', '4101 Abrams Rd',       2050, 3, 2, 418000, daysAgo(90),  25, 0.9,  false, null),
  baseComp('seed-comp-c02', '4330 Peak St',          2180, 3, 3, 460000, daysAgo(75),  10, 1.1,  false, null),
  baseComp('seed-comp-c03', '4650 Greenville Ave',   2250, 4, 2, 472000, daysAgo(55),  7,  1.2,  false, null),
  baseComp('seed-comp-c04', '4765 Victor St',        1950, 3, 2, 405000, daysAgo(40),  14, 0.8,  false, null),
  baseComp('seed-comp-c05', '4890 Capitol Ave',      2320, 4, 3, 490000, daysAgo(85),  31, 1.4,  false, null),
  baseComp('seed-comp-c06', '4020 Live Oak St',      2100, 3, 2, 432000, daysAgo(50),  11, 0.6,  false, null),
  baseComp('seed-comp-c07', '4190 Bryan Pkwy',       2000, 3, 2, 421000, daysAgo(35),  19, 1.0,  false, null),
  baseComp('seed-comp-c08', '4445 Haskell Ave',      2175, 3, 2, 448000, daysAgo(60),  6,  0.7,  false, null),
  baseComp('seed-comp-c09', '4560 Lindsley Ave',     1900, 3, 1.5, 395000, daysAgo(95), 42, 1.3,  false, null),
  baseComp('seed-comp-c10', '4680 Santa Fe Trail',   2280, 4, 2, 465000, daysAgo(70),  8,  1.1,  false, null),
  baseComp('seed-comp-c11', '4750 Belmont Ave',      2050, 3, 2, 428000, daysAgo(25),  15, 0.9,  false, null),
  baseComp('seed-comp-c12', '4900 Goliad Ave',       2130, 3, 2, 435000, daysAgo(110), 33, 1.5,  false, null),
];

const ALL_COMPS: CanonicalComp[] = [...SELECTED_COMPS, ...CANDIDATE_COMPS];

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildReport001(now: string): CanonicalReportDocument {
  return {
    id: REPORT_IDS.FULL_1004_ORDER_001,
    reportId: REPORT_IDS.FULL_1004_ORDER_001,
    orderId: ORDER_IDS.COMPLETED_001,
    reportType: '1004',
    status: 'completed',
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: 'ORD-2024-001',
      borrowerName: 'James & Sarah Williams',
      ownerOfPublicRecord: 'James & Sarah Williams',
      clientName: 'First National Bank',
      clientCompanyName: 'First National Bank',
      clientAddress: '100 Main St, Dallas, TX 75201',
      clientEmail: 'appraisals@firstnational.example',
      loanNumber: 'LN-2024-88421',
      effectiveDate: daysAgo(30),
      inspectionDate: daysAgo(32),
      isSubjectPurchase: false,
      contractPrice: null,
      contractDate: null,
      subjectPriorSaleDate1: daysAgo(365 * 4),
      subjectPriorSalePrice1: 385000,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
      appraisalGrade: 'B',
    },
    subject: SUBJECT_4521,
    comps: ALL_COMPS,
    valuation: {
      estimatedValue: 437000,
      lowerBound: 415000,
      upperBound: 460000,
      confidenceScore: 87,
      effectiveDate: daysAgo(30),
      reconciliationNotes:
        'Value reconciled from 6 comparables. Sales comparison approach given full weight. ' +
        'Adjusted value range $415k-$460k; point estimate $437k reflects superior comp grid.',
      approachesUsed: ['sales_comparison'],
      avmProvider: 'batch_data',
      avmModelVersion: null,
    },
    createdAt: daysAgo(45),
    updatedAt: daysAgo(30),
    createdBy: 'seed',
    updatedBy: 'seed',
  };
}

function buildReport003(now: string): CanonicalReportDocument {
  // In-progress: only slots 1-3 selected; slots 4-6 are null; 12 candidates available
  const inProgressComps: CanonicalComp[] = [
    ...SELECTED_COMPS.slice(0, 3),                       // S1, S2, S3 selected
    ...SELECTED_COMPS.slice(3).map(c => ({               // L4, L5, L6 → candidates
      ...c,
      selected: false,
      slotIndex: null,
      adjustments: null,
    })),
    ...CANDIDATE_COMPS,
  ];

  return {
    id: REPORT_IDS.FULL_1004_ORDER_003,
    reportId: REPORT_IDS.FULL_1004_ORDER_003,
    orderId: ORDER_IDS.IN_PROGRESS_003,
    reportType: '1004',
    status: 'in_progress',
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: 'ORD-2024-003',
      borrowerName: 'Robert & Lisa Chen',
      ownerOfPublicRecord: 'Robert & Lisa Chen',
      clientName: 'Heritage Mortgage',
      clientCompanyName: 'Heritage Mortgage',
      clientAddress: '200 Commerce St, Dallas, TX 75202',
      clientEmail: 'orders@heritagemortgage.example',
      loanNumber: 'LN-2024-91035',
      effectiveDate: null,
      inspectionDate: daysAgo(5),
      isSubjectPurchase: true,
      contractPrice: 430000,
      contractDate: daysAgo(10),
      subjectPriorSaleDate1: daysAgo(365 * 6),
      subjectPriorSalePrice1: 310000,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
      appraisalGrade: 'C',
    },
    subject: {
      ...SUBJECT_4521,
      address: {
        streetAddress: '3812 Swiss Ave',
        unit: null,
        city: 'Dallas',
        state: 'TX',
        zipCode: '75204',
        county: 'Dallas',
      },
      grossLivingArea: 1980,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 1979,
      parcelNumber: '00-9876-5432-0000',
      currentOwner: 'Robert & Lisa Chen',
      contractInfo: {
        contractPrice: 430000,
        contractDate: daysAgo(10),
        propertyRightsAppraised: 'Fee Simple',
        financingConcessions: null,
        isPropertySeller: false,
      },
      latitude: 32.8201,
      longitude: -96.7904,
    },
    comps: inProgressComps,
    valuation: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    createdBy: 'seed',
    updatedBy: 'seed',
  };
}

// ─── Fort Worth TX subject and comps for seed-order-009 ──────────────────────

const SUBJECT_1500_COMMERCE: CanonicalSubject = {
  address: {
    streetAddress: '1500 Commerce St',
    unit: null,
    city: 'Fort Worth',
    state: 'TX',
    zipCode: '76102',
    county: 'Tarrant',
  },
  grossLivingArea: 1920,
  totalRooms: 6,
  bedrooms: 3,
  bathrooms: 2,
  stories: 1,
  lotSizeSqFt: 6500,
  propertyType: 'SFR',
  condition: 'C3',
  quality: 'Q3',
  design: 'Traditional',
  yearBuilt: 1988,
  foundationType: 'Slab',
  exteriorWalls: 'Brick',
  roofSurface: 'Composition Shingle',
  basement: 'None',
  basementFinishedSqFt: null,
  heating: 'FWA',
  cooling: 'Central',
  fireplaces: 1,
  garageType: 'Attached',
  garageSpaces: 2,
  porchPatioDeck: 'Covered Porch',
  pool: false,
  attic: 'None',
  view: 'Residential',
  locationRating: 'Neutral',
  latitude: 32.7555,
  longitude: -97.3308,
  parcelNumber: '01-2345-6789-0000',
  censusTract: '1029.00',
  mapReference: 'Tarrant Co Map 32-C',
  currentOwner: 'David & Maria Hernandez',
  occupant: 'Owner',
  legalDescription: 'LOT 8, BLK 2, RIVERSIDE HEIGHTS, TARRANT CO TX',
  zoning: 'A-5',
  zoningCompliance: 'Legal',
  highestAndBestUse: 'Present',
  floodZone: 'X',
  floodMapNumber: '48439C0215K',
  floodMapDate: '2014-04-18',
  utilities: DALLAS_UTILITIES,
  neighborhood: {
    locationType: 'Suburban',
    builtUp: '75%',
    growth: 'Stable',
    propertyValues: 'Stable',
    demandSupply: 'In Balance',
    marketingTime: '3-6 months',
    predominantOccupancy: 'Owner',
    singleFamilyPriceRange: { low: 260000, high: 520000 },
    predominantAge: '25-40 years',
    presentLandUse: { singleFamily: 65, multifamily: 20, commercial: 12, other: 3 },
    boundaryDescription: 'Trinity River to I-30, Main St to Henderson St',
    neighborhoodDescription: 'Established suburban neighborhood near downtown Fort Worth with steady owner-occupied demand.',
    marketConditionsNotes: 'Stable values, typical DOM 45-90 days. Market supported by proximity to employment centers.',
  },
  contractInfo: null,
  hpiTrend: 'Stable',
};

function baseFwComp(
  id: string,
  street: string,
  gla: number,
  bed: number,
  bath: number,
  salePrice: number,
  saleDate: string,
  dom: number,
  distMi: number,
  selected: boolean,
  slotIndex: number | null,
  adjOverrides: Parameters<typeof makeAdjustments>[1] = {},
): CanonicalComp {
  return {
    compId: id,
    address: { streetAddress: street, unit: null, city: 'Fort Worth', state: 'TX', zipCode: '76102', county: 'Tarrant' },
    grossLivingArea: gla,
    totalRooms: bed + 3,
    bedrooms: bed,
    bathrooms: bath,
    stories: 1,
    lotSizeSqFt: 6200,
    propertyType: 'SFR',
    condition: 'C3',
    quality: 'Q3',
    design: 'Traditional',
    yearBuilt: 1986,
    foundationType: 'Slab',
    exteriorWalls: 'Brick',
    roofSurface: 'Composition Shingle',
    basement: 'None',
    basementFinishedSqFt: null,
    heating: 'FWA',
    cooling: 'Central',
    fireplaces: 1,
    garageType: 'Attached',
    garageSpaces: 2,
    porchPatioDeck: 'Covered Porch',
    pool: false,
    attic: 'None',
    view: 'Residential',
    locationRating: 'Neutral',
    latitude: 32.755 + (Math.random() * 0.01 - 0.005),
    longitude: -97.330 + (Math.random() * 0.01 - 0.005),
    salePrice,
    saleDate,
    priorSalePrice: null,
    priorSaleDate: null,
    listPrice: salePrice + 3000,
    financingType: 'Conventional',
    saleType: 'ArmLength',
    concessionsAmount: null,
    dataSource: 'avm',
    vendorId: 'batch_data',
    vendorRecordRef: `seed-raw-${id}`,
    distanceFromSubjectMiles: distMi,
    proximityScore: Math.round((1 - distMi / 2) * 100),
    selected,
    slotIndex,
    adjustments: selected ? makeAdjustments(salePrice, {
      grossLivingAreaAdj: (1920 - gla) * 60, // $60/sqft GLA adjustment
      aboveGradeBedroom: (3 - bed) * 5000,
      aboveGradeBathroom: (2 - bath) * 2500,
      ...adjOverrides,
    }) : null,
    mlsData: makeMls({
      mlsNumber: `NTREIS-FW-${id.replace('seed-comp-fw-', '')}`,
      listingStatus: 'Sold',
      soldDate: saleDate,
      daysOnMarket: dom,
    }),
    publicRecordData: null,
  };
}

const FW_COMPS_009: CanonicalComp[] = [
  baseFwComp('seed-comp-fw-s1', '1418 Summit Ave',       1880, 3, 2, 395000, daysAgo(38),  14, 0.3, true, 1),
  baseFwComp('seed-comp-fw-s2', '1632 Weatherford St',   2010, 3, 2, 420000, daysAgo(55),   9, 0.5, true, 2),
  baseFwComp('seed-comp-fw-s3', '1345 Pennsylvania Ave', 1850, 3, 2, 385000, daysAgo(27),  21, 0.4, true, 3),
  baseFwComp('seed-comp-fw-c1', '1710 Hemphill St',      2050, 4, 2, 435000, daysAgo(12),  30, 0.6, true, 4, { aboveGradeBedroom: -5000 }),
  baseFwComp('seed-comp-fw-c2', '1225 8th Ave',          1960, 3, 2, 410000, daysAgo(19),   7, 0.7, true, 5),
  baseFwComp('seed-comp-fw-c3', '1580 Alston Ave',       1790, 3, 2, 375000, daysAgo(33),  25, 0.8, true, 6),
  baseFwComp('seed-comp-fw-u1', '1455 College Ave',      1930, 3, 2, 402000, daysAgo(80),  17, 0.9, false, null),
  baseFwComp('seed-comp-fw-u2', '1320 Fairmount Ave',    2080, 3, 3, 445000, daysAgo(65),  11, 1.1, false, null),
  baseFwComp('seed-comp-fw-u3', '1640 Rogers Ave',       1860, 3, 2, 388000, daysAgo(48),  22, 1.0, false, null),
];

function buildReport009(_now: string): CanonicalReportDocument {
  return {
    id: REPORT_IDS.FULL_1004_ORDER_009,
    reportId: REPORT_IDS.FULL_1004_ORDER_009,
    orderId: LEGACY_ORDER_009_ID,
    reportType: '1004',
    status: 'completed',
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      orderId: LEGACY_ORDER_009_ID,
      orderNumber: 'SEED-2026-00109',
      borrowerName: 'David & Maria Hernandez',
      ownerOfPublicRecord: 'David & Maria Hernandez',
      clientName: 'Clearpath AMC',
      clientCompanyName: 'Clearpath AMC',
      clientAddress: '500 Commerce St Ste 400, Fort Worth, TX 76102',
      clientEmail: 'orders@clearpathamc.example',
      loanNumber: 'LN-2026-00109',
      effectiveDate: daysAgo(10),
      inspectionDate: daysAgo(12),
      isSubjectPurchase: false,
      contractPrice: null,
      contractDate: null,
      subjectPriorSaleDate1: daysAgo(365 * 5),
      subjectPriorSalePrice1: 310000,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
      appraisalGrade: 'B',
    },
    subject: SUBJECT_1500_COMMERCE,
    comps: FW_COMPS_009,
    valuation: {
      estimatedValue: 405000,
      lowerBound: 385000,
      upperBound: 425000,
      confidenceScore: 84,
      effectiveDate: daysAgo(10),
      reconciliationNotes:
        'Value reconciled from 6 comparables in the Fort Worth Riverside Heights / Near Southside ' +
        'submarket. Sales comparison approach given full weight. Adjusted value range $385k–$425k; ' +
        'point estimate $405k reflects market conditions and comp grid quality.',
      approachesUsed: ['sales_comparison'],
      avmProvider: 'batch_data',
      avmModelVersion: null,
    },
    createdAt: daysAgo(15),
    updatedAt: daysAgo(10),
    createdBy: 'seed',
    updatedBy: 'seed',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export const module: SeedModule = {
  name: 'reports',
  containers: ['reporting'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, 'reporting', '/orderId');
    }

    const docs: CanonicalReportDocument[] = [
      buildReport001(ctx.now),
      buildReport003(ctx.now),
      buildReport009(ctx.now),
    ];

    for (const doc of docs) {
      await upsert(ctx, 'reporting', doc as unknown as Record<string, unknown>, result);
    }

    console.log(`\n  Reports seeded: ${result.created} created, ${result.failed} failed`);
    return result;
  },
};
