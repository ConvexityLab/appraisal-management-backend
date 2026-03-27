/**
 * Smoke-test script: end-to-end render of the URAR v2 (Vision VMC / UAD 3.6) template.
 *
 * Bypasses Cosmos DB entirely — the ReportTemplate is constructed in-memory.
 * Uses real Azure Blob Storage (AZURE_STORAGE_ACCOUNT_NAME + DefaultAzureCredential)
 * to fetch the compiled urar-v2.hbs from the `pdf-report-templates` container,
 * exactly as HtmlRenderStrategy does at runtime.
 *
 * Run from the project root:
 *   npx tsx src/scripts/smoke-render-urar-v2.ts
 *
 * Output: output/urar-v2-smoke-<timestamp>.pdf
 *
 * Requirements:
 *   AZURE_STORAGE_ACCOUNT_NAME  — staging storage account name
 *   (DefaultAzureCredential)    — must have Storage Blob Data Reader role
 *                                  or be authenticated via `az login`
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { BlobStorageService } from '../services/blob-storage.service.js';
import { HtmlRenderStrategy } from '../services/report-engine/strategies/html-render.strategy.js';
import { Urar1004Mapper } from '../services/report-engine/field-mappers/urar-1004.mapper.js';
import type { IFieldMapper } from '../services/report-engine/field-mappers/field-mapper.interface.js';
import type { ReportTemplate } from '../types/final-report.types.js';
import type {
  CanonicalReportDocument,
  CanonicalAddress,
  CanonicalAdjustments,
  ValueType,
} from '../types/canonical-schema.js';
import type { ReportGenerationContext } from '../services/report-engine/strategies/report-strategy.interface.js';

// ── Template (in-memory, matches seeded document) ──────────────────────────

const TEMPLATE: ReportTemplate = {
  id:                  'seed-report-template-urar-1004-v2',
  type:                'pdf-report-template',
  name:                'Uniform Residential Appraisal Report (Form 1004) — v2 Vision VMC',
  formType:            'URAR_1004',
  renderStrategy:      'html-render',
  hbsTemplateName:     'urar-v2.hbs',
  mapperKey:           'urar-1004',
  isActive:            true,
  description:         'Smoke-test fixture',
  sectionConfig: {
    requiresSubjectPhotos: false,
    requiresCompPhotos:    false,
    requiresAerialMap:     false,
    requiresMarketConditionsAddendum: false,
    requiresLocationMap:   false,
    requiresFloorPlan:     false,
  },
};

// ── Canonical document fixture ──────────────────────────────────────────────

const NOW = new Date().toISOString();

// Helper — build a zeroed CanonicalAdjustments with overrides
function adj(overrides: Partial<CanonicalAdjustments> & {
  netAdjustmentTotal: number;
  grossAdjustmentTotal: number;
  adjustedSalePrice: number;
}): CanonicalAdjustments {
  return {
    saleOrFinancingConcessions: 0,
    dateOfSaleTime:             0,
    locationAdj:                0,
    leaseholdFeeSimple:         0,
    site:                       0,
    viewAdj:                    0,
    designAndAppeal:            0,
    qualityOfConstruction:      0,
    actualAge:                  0,
    conditionAdj:               0,
    aboveGradeRoomCount:        0,
    aboveGradeBedroom:          0,
    aboveGradeBathroom:         0,
    grossLivingAreaAdj:         0,
    basementAndFinishedRooms:   0,
    functionalUtility:          0,
    heatingCooling:             0,
    energyEfficiency:           0,
    garageCarport:              0,
    porchPatioPool:             0,
    otherAdj1:                  0,
    otherAdj2:                  0,
    otherAdj3:                  0,
    ...overrides,
  };
}

// Helper — build a CanonicalAddress
function addr(streetAddress: string, city: string, state: string, zipCode: string, county: string): CanonicalAddress {
  return { streetAddress, unit: null, city, state, zipCode, county };
}

const CANONICAL_DOC: CanonicalReportDocument = {
  id:            'smoke-canonical-urar-v2',
  reportId:      'smoke-report-v2-001',
  orderId:       'smoke-order-v2-001',
  reportType:    '1004',
  status:        'FINAL',
  schemaVersion: '3.6',

  metadata: {
    orderId:             'smoke-order-v2-001',
    orderNumber:         'VMC-2025-10847',
    borrowerName:        'Marcus & Elena Whitfield',
    ownerOfPublicRecord: 'Marcus & Elena Whitfield',
    clientName:          'Jane Smith',
    clientCompanyName:   'First Coast Mortgage Corporation',
    clientAddress:       '8800 Baymeadows Rd Suite 300, Jacksonville, FL 32256',
    clientEmail:         'jsmith@firstcoastmortgage.com',
    loanNumber:          'FCM-2025-88214',
    effectiveDate:       '2025-07-22',
    inspectionDate:      '2025-07-20',
    isSubjectPurchase:   false,
    contractPrice:       null,
    contractDate:        null,
    subjectPriorSaleDate1:  '2019-02-15',
    subjectPriorSalePrice1: 324000,
    subjectPriorSaleDate2:  null,
    subjectPriorSalePrice2: null,
  },

  subject: {
    // CanonicalAddress
    address: addr('2847 Laurel Oak Drive', 'Jacksonville', 'FL', '32223', 'Duval'),

    // CanonicalPropertyCore — required fields
    grossLivingArea:   2184,
    totalRooms:        8,
    bedrooms:          4,
    bathrooms:         2.5,  // 2 full + 1 half
    stories:           1,
    lotSizeSqFt:       10454,
    propertyType:      'SFR',
    condition:         'C2',
    quality:           'Q3',
    design:            'Ranch',
    yearBuilt:         2003,
    foundationType:    'Slab',
    exteriorWalls:     'Concrete Block Stucco',
    roofSurface:       'Arch Shingle',
    basement:          'None',
    basementFinishedSqFt: null,
    heating:           'FWA',
    cooling:           'Central',
    fireplaces:        0,
    garageType:        'Attached',
    garageSpaces:      2,
    porchPatioDeck:    'Screened Lanai 300sf',
    pool:              true,
    attic:             'None',
    view:              'Neutral;Res;',
    locationRating:    'Neutral',
    latitude:          30.1365,
    longitude:         -81.6508,

    // CanonicalPropertyCore — optional fields
    effectiveAge:         8,
    windowType:           'Insulated',
    additionalFeatures:   'Pool/Spa, Screened Lanai 300sf, Security System, Irrigation',
    siteShape:            'Rectangular',
    viewDescription:      'Residential neighborhood, mature tree canopy',
    zoningDescription:    'Single Family Residential',
    drivewaySurface:      'Concrete',

    // CanonicalSubject — optional fields
    parcelNumber:       '167254-0000',
    censusTract:        '0128.04',
    mapReference:       'Panel 12031C0220J',
    currentOwner:       'Marcus & Elena Whitfield',
    occupant:           'Owner',
    legalDescription:   'Lot 14, Block 3, Laurel Oak Estates, PB 47, PG 22-24',
    zoning:             'RLD-60',
    zoningCompliance:   'Legal',
    highestAndBestUse:  'Present',
    floodZone:          'X',
    floodMapNumber:     '12031C0220J',
    floodMapDate:       '2021-08-03',
    hpiTrend:           'Increasing',
    taxYear:            2024,
    annualTaxes:        5142,
    siteAreaUnit:       'sf',

    utilities: {
      electricity: 'Public',
      gas:         'None',
      water:       'Public',
      sewer:       'Public',
    },

    neighborhood: {
      locationType:        'Suburban',
      builtUp:             '25-75%',
      growth:              'Stable',
      propertyValues:      'Increasing',
      demandSupply:        'In Balance',
      marketingTime:       '3-6 months',
      predominantOccupancy: 'Owner',
      singleFamilyPriceRange: { low: 380000, high: 620000 },
      predominantAge:      '20-30 years',
      presentLandUse:      { singleFamily: 85, multifamily: 5, commercial: 5, other: 5 },
      boundaryDescription: 'I-295 / St. Johns River / Mandarin Rd / Old St. Augustine Rd',
      neighborhoodDescription:
        'Established suburban residential area with good access to employment, retail, and schools. '
        + 'Mature tree canopy, minimal investor activity.',
      marketConditionsNotes:
        'Moderate seller market, ~3%/yr appreciation, avg 28 DOM.',
    },
  },

  comps: [
    {
      // CanonicalComp identity
      compId:    'comp-smoke-001',
      selected:  true,
      slotIndex: 1,

      // CanonicalAddress
      address: addr('4112 Magnolia Bend Ct', 'Jacksonville', 'FL', '32223', 'Duval'),

      // CanonicalPropertyCore
      grossLivingArea:      2105,
      totalRooms:           8,
      bedrooms:             4,
      bathrooms:            2.5,
      stories:              1,
      lotSizeSqFt:          9800,
      propertyType:         'SFR',
      condition:            'C2',
      quality:              'Q3',
      design:               'Ranch',
      yearBuilt:            2005,
      foundationType:       'Slab',
      exteriorWalls:        'Concrete Block Stucco',
      roofSurface:          'Arch Shingle',
      basement:             'None',
      basementFinishedSqFt: null,
      heating:              'FWA',
      cooling:              'Central',
      fireplaces:           0,
      garageType:           'Attached',
      garageSpaces:         2,
      porchPatioDeck:       'Open Patio',
      pool:                 true,
      attic:                'None',
      view:                 'Neutral;Res;',
      locationRating:       'Neutral',
      latitude:             null,
      longitude:            null,

      // Sale data
      salePrice:         465000,
      saleDate:          '2025-06-10',
      priorSalePrice:    null,
      priorSaleDate:     null,
      listPrice:         469900,
      financingType:     'Conventional',
      saleType:          'ArmLength',
      concessionsAmount: 0,

      // Source
      dataSource:        'mls',
      vendorId:          'smoke-vendor',
      vendorRecordRef:   'MLS#2041877',

      // Proximity
      proximityToSubject:      '0.4 mi N',
      verificationSource:      'MLS #2041877',
      distanceFromSubjectMiles: 0.4,
      proximityScore:          88,

      adjustments: adj({
        site:               2000,
        grossLivingAreaAdj: 7900,
        netAdjustmentTotal:   9900,
        grossAdjustmentTotal: 9900,
        adjustedSalePrice:  474900,
      }),
      mlsData:          null,
      publicRecordData: null,
    },
    {
      compId:    'comp-smoke-002',
      selected:  true,
      slotIndex: 2,

      address: addr('3308 Cypress Hollow Dr', 'Jacksonville', 'FL', '32223', 'Duval'),

      grossLivingArea:      2296,
      totalRooms:           8,
      bedrooms:             4,
      bathrooms:            2.5,
      stories:              1,
      lotSizeSqFt:          11200,
      propertyType:         'SFR',
      condition:            'C2',
      quality:              'Q3',
      design:               'Ranch',
      yearBuilt:            2006,
      foundationType:       'Slab',
      exteriorWalls:        'Concrete Block Stucco',
      roofSurface:          'Arch Shingle',
      basement:             'None',
      basementFinishedSqFt: null,
      heating:              'FWA',
      cooling:              'Central',
      fireplaces:           0,
      garageType:           'Attached',
      garageSpaces:         2,
      porchPatioDeck:       'Screened Lanai 350sf',
      pool:                 false,
      attic:                'None',
      view:                 'Neutral;Res;',
      locationRating:       'Neutral',
      latitude:             null,
      longitude:            null,

      salePrice:         479500,
      saleDate:          '2025-05-22',
      priorSalePrice:    null,
      priorSaleDate:     null,
      listPrice:         485000,
      financingType:     'Conventional',
      saleType:          'ArmLength',
      concessionsAmount: 0,

      dataSource:        'mls',
      vendorId:          'smoke-vendor',
      vendorRecordRef:   'MLS#2038532',

      proximityToSubject:      '0.9 mi SE',
      verificationSource:      'MLS #2038532',
      distanceFromSubjectMiles: 0.9,
      proximityScore:          75,

      adjustments: adj({
        site:               -2000,
        grossLivingAreaAdj: -11200,
        porchPatioPool:      12000,
        netAdjustmentTotal:   -1200,
        grossAdjustmentTotal: 25200,
        adjustedSalePrice:  478300,
      }),
      mlsData:          null,
      publicRecordData: null,
    },
    {
      compId:    'comp-smoke-003',
      selected:  true,
      slotIndex: 3,

      address: addr('1945 River Bluff Ln', 'Jacksonville', 'FL', '32223', 'Duval'),

      grossLivingArea:      2052,
      totalRooms:           7,
      bedrooms:             3,
      bathrooms:            2.0,
      stories:              1,
      lotSizeSqFt:          10100,
      propertyType:         'SFR',
      condition:            'C2',
      quality:              'Q3',
      design:               'Ranch',
      yearBuilt:            2000,
      foundationType:       'Slab',
      exteriorWalls:        'Concrete Block Stucco',
      roofSurface:          'Arch Shingle',
      basement:             'None',
      basementFinishedSqFt: null,
      heating:              'FWA',
      cooling:              'Central',
      fireplaces:           0,
      garageType:           'Attached',
      garageSpaces:         2,
      porchPatioDeck:       'Open Patio',
      pool:                 true,
      attic:                'None',
      view:                 'Neutral;Res;',
      locationRating:       'Neutral',
      latitude:             null,
      longitude:            null,

      salePrice:         451000,
      saleDate:          '2025-04-08',
      priorSalePrice:    415000,
      priorSaleDate:     '2023-12-15',
      listPrice:         459000,
      financingType:     'Cash',
      saleType:          'ArmLength',
      concessionsAmount: 0,

      dataSource:        'mls',
      vendorId:          'smoke-vendor',
      vendorRecordRef:   'MLS#2034215',

      proximityToSubject:      '1.2 mi W',
      verificationSource:      'MLS #2034215',
      distanceFromSubjectMiles: 1.2,
      proximityScore:          68,

      adjustments: adj({
        site:               1000,
        actualAge:          3000,
        aboveGradeRoomCount: 8000,
        grossLivingAreaAdj: 13200,
        netAdjustmentTotal:   25200,
        grossAdjustmentTotal: 25200,
        adjustedSalePrice:  476200,
      }),
      mlsData:          null,
      publicRecordData: null,
    },
  ],

  valuation: {
    estimatedValue:     475000,
    lowerBound:         465000,
    upperBound:         485000,
    confidenceScore:    91,
    effectiveDate:      '2025-07-22',
    reconciliationNotes:
      'Three recent, proximate, arm\'s-length sales support a value in the $474,900–$478,300 range.',
    approachesUsed:     ['sales_comparison', 'cost', 'income'],
    avmProvider:        null,
    avmModelVersion:    null,
    valueType:          'AS_IS',
  },

  reconciliation: {
    salesCompApproachValue: 475000,
    costApproachValue:      505000,
    incomeApproachValue:    457000,
    finalOpinionOfValue:    475000,
    effectiveDate:          '2025-07-22',
    reconciliationNarrative:
      'The Sales Comparison Approach is given primary weight (75%) as it best reflects ' +
      'buyer/seller behavior in this market. Three recent, proximate, arm\'s-length sales ' +
      'support a value in the $474,900–$478,300 range. All three approaches bracket the ' +
      'final opinion, confirming the estimate.',
    exposureTime:  '3-6 months',
    marketingTime: '3-6 months',
    salesCompWeight:    0.75,
    costWeight:         0.10,
    incomeWeight:       0.15,
    confidenceScore:    91,
    approachSpreadPct:  10.5,
    extraordinaryAssumptions: [
      'Pool/spa mechanical equipment assumed in functional working order — not inspected per limited scope.',
      'Roof replacement (2022) represented by owner; no permit verification performed.',
    ],
    hypotheticalConditions: null,
  },

  appraiserInfo: {
    name:                  'Priya L. Venkataraman, MAI, SRA',
    licenseNumber:         'RCert-FL-12948',
    licenseState:          'FL',
    licenseType:           'Certified Residential',
    licenseExpirationDate: '2026-09-30',
    companyName:           'Vision VMC, LLC',
    companyAddress:        '425 Town Plaza Ave., Ponte Vedra, FL 32081',
    phone:                 '(904) 555-0192',
    email:                 'p.venkataraman@visionvmc.com',
    signatureDate:         '2025-07-23',
  },

  costApproach: {
    estimatedLandValue:             68000,
    landValueSource:                'Sales Comparison — 4 land sales within 0.75 mi',
    landValueMethod:                'sales_comparison',
    landValueEvidence:              '$58K–$78K; median $68K',
    replacementCostNew:             341232,
    costFactorSource:               'Marshall & Swift Local Multiplier — Duval County FL',
    softCosts:                      10500,
    entrepreneurialProfit:          16200,
    siteImprovementsCost:           9200,
    depreciationAmount:             36200,
    depreciationType:               'Age-Life',
    physicalDepreciationCurable:    4800,
    physicalDepreciationIncurable:  31400,
    functionalObsolescence:         0,
    externalObsolescence:           0,
    effectiveAge:                   8,
    economicLife:                   55,
    depreciatedCostOfImprovements:  437832,
    indicatedValueByCostApproach:   505000,
    comments:                       null,
  },

  incomeApproach: {
    estimatedMonthlyMarketRent:    2650,
    grossRentMultiplier:           172.6,
    vacancyRate:                   0.05,
    potentialGrossIncome:          33480,
    effectiveGrossIncome:          31806,
    netOperatingIncome:            21200,
    capRate:                       0.046,
    indicatedValueByIncomeApproach: 457000,
    comments:                      null,
    rentComps: [
      {
        address:             '4009 Sundance Ct, Jacksonville 32223',
        monthlyRent:         2495,
        adjustedRent:        2620,
        propertyDescription: '4/2.0, 2,050sf, no pool',
        dataSource:          'MLS Rental Portal',
      },
      {
        address:             '3205 Pecan Grove Ln, Jacksonville 32223',
        monthlyRent:         2695,
        adjustedRent:        2670,
        propertyDescription: '4/2.1, 2,210sf, pool',
        dataSource:          'AppFolio Listings',
      },
      {
        address:             '1880 Bayberry Run, Jacksonville 32223',
        monthlyRent:         2350,
        adjustedRent:        2660,
        propertyDescription: '3/2.0, 1,980sf, no pool',
        dataSource:          'CoStar Residential',
      },
    ],
  },

  // UAD 3.6 value types (multi-value-type block)
  valueTypes:    ['AS_IS', 'PROSPECTIVE_AS_REPAIRED'] satisfies ValueType[],
  effectiveDates: {
    AS_IS:                 '2025-07-22',
    PROSPECTIVE_AS_REPAIRED: '2025-07-22',
  },

  // No photos in smoke test — photo resolver skipped by sectionConfig=false
  photos: [],

  createdAt: NOW,
  updatedAt: NOW,
  createdBy: 'smoke-test',
  updatedBy: 'smoke-test',
};

// ── Wire up the strategy directly ──────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n📄  URAR v2 Smoke Render — Vision VMC / UAD 3.6');
  console.log('═══════════════════════════════════════════════════\n');

  // Build blob service (reads AZURE_STORAGE_ACCOUNT_NAME from env)
  const blobStorage = new BlobStorageService();

  // Build mapper map
  const mappers = new Map<string, IFieldMapper>([
    ['urar-1004', new Urar1004Mapper()],
  ]);

  // Build strategy
  const strategy = new HtmlRenderStrategy(blobStorage, mappers);

  // Build generation context (no sectionOverrides — use template defaults)
  const ctx: ReportGenerationContext = {
    request: {
      templateId:  TEMPLATE.id,
      orderId:     CANONICAL_DOC.metadata.orderId,
      requestedBy: 'smoke-test-script',
    },
    template: TEMPLATE,
    effectiveSectionConfig: TEMPLATE.sectionConfig!,
    canonicalDoc: CANONICAL_DOC,
  };

  console.log(`   Template:  ${TEMPLATE.name}`);
  console.log(`   Order:     ${CANONICAL_DOC.metadata.orderId}`);
  console.log(`   Blob:      ${process.env['AZURE_STORAGE_ACCOUNT_NAME'] ?? '<unset>'} → pdf-report-templates/urar-v2.hbs`);
  console.log('');

  console.log('⏳  Generating PDF via Playwright...');
  const startMs = Date.now();
  const pdfBuffer = await strategy.generate(ctx);
  const elapsedMs = Date.now() - startMs;

  // Write output
  const outDir  = resolve(process.cwd(), 'output');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `urar-v2-smoke-${Date.now()}.pdf`);
  writeFileSync(outFile, pdfBuffer);

  const kb = (pdfBuffer.length / 1024).toFixed(1);
  console.log(`\n✅  Done in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`   PDF size:  ${kb} KB`);
  console.log(`   Output:    ${outFile}`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Smoke render failed:', err);
  process.exit(1);
});
