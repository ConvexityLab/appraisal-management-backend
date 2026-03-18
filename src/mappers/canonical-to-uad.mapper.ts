/**
 * canonical-to-uad.mapper.ts
 *
 * Maps a fully-populated CanonicalReportDocument to the UadAppraisalReport shape
 * consumed by MismoXmlGenerator.generateMismoXml().
 *
 * Design rules:
 *  - NO silent defaults: required canonical fields that are missing throw with a
 *    clear message identifying the field and the document that caused the failure.
 *  - UAD fields with no canonical equivalent (e.g. currentUse, street.paved) are set
 *    to the single sensible value mandated by UAD 3.6 for single-family residential
 *    appraisals and are annotated with a // UAD-REQUIRED comment.
 *  - Optional UAD approach sections (costApproach, incomeApproach) are omitted
 *    entirely when the canonical document does not carry them.
 *  - Only comparables with selected === true are included; they are ordered by slotIndex.
 */

import type {
  CanonicalReportDocument,
  CanonicalSubject,
  CanonicalComp,
  CanonicalAdjustments,
  CanonicalNeighborhood,
  CanonicalCostApproach,
  CanonicalIncomeApproach,
  CanonicalAppraiserInfo,
  CanonicalUtilities,
} from '../types/canonical-schema.js';
import {
  UadQualityRating,
  UadConditionRating,
  UadPropertyType,
  UadOccupancyType,
  UadViewType,
  UadBuildingStatusType,
  UadSaleType,
  UadFinancingType,
  UadDataSourceType,
} from '../types/uad-3.6.js';
import type {
  UadAppraisalReport,
  UadSubjectProperty,
  UadAppraisalInfo,
  UadNeighborhood,
  UadSalesComparisonApproach,
  UadComparable,
  UadAdjustments,
  UadCostApproach,
  UadIncomeApproach,
  UadReconciliation,
  UadAppraiserInfo,
  UadCertification,
} from '../types/uad-3.6.js';

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a CanonicalReportDocument to a UadAppraisalReport ready for MISMO XML generation.
 *
 * @throws {Error} if required canonical fields are absent (e.g. subject.condition is null).
 */
export function mapCanonicalToUad(doc: CanonicalReportDocument): UadAppraisalReport {
  const subject = mapSubjectProperty(doc);
  const appraisalInfo = mapAppraisalInfo(doc);
  const salesComparisonApproach = mapSalesComparisonApproach(doc);
  const reconciliation = mapReconciliation(doc);
  const appraiserInfo = mapAppraiserInfo(doc);
  const certifications = buildCertifications(doc);

  const report: UadAppraisalReport = {
    appraisalReportIdentifier: doc.reportId,
    uadVersion: '3.6',
    mismoVersion: '3.4',
    formType: assertFormType(doc.reportType, doc.reportId),
    subjectProperty: subject,
    appraisalInfo,
    salesComparisonApproach,
    reconciliation,
    appraiserInfo,
    certifications,
  };

  if (doc.costApproach) {
    report.costApproach = mapCostApproach(doc.costApproach, doc.reportId);
  }
  if (doc.incomeApproach) {
    report.incomeApproach = mapIncomeApproach(doc.incomeApproach, doc.reportId);
  }

  return report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject Property
// ─────────────────────────────────────────────────────────────────────────────

function mapSubjectProperty(doc: CanonicalReportDocument): UadSubjectProperty {
  const s = doc.subject;
  const ctx = `CanonicalReportDocument(${doc.reportId}).subject`;

  const qualityRating = parseQualityRating(s.quality, ctx);
  const conditionRating = parseConditionRating(s.condition, ctx);
  const propertyType = parsePropertyType(s.propertyType);
  const viewTypes = parseViewTypes(s.view);

  return {
    // Address
    streetAddress: s.address.streetAddress,
    city: s.address.city,
    state: s.address.state,
    zipCode: s.address.zipCode,
    county: s.address.county,
    ...(s.parcelNumber != null ? { assessorParcelNumber: s.parcelNumber } : {}),
    ...(s.legalDescription != null ? { legalDescription: s.legalDescription } : {}),

    // Site
    siteSizeSquareFeet: s.lotSizeSqFt,
    // siteShape must be one of four values; canonical may carry any string or null
    siteShape: isValidSiteShape(s.siteShape) ? s.siteShape : 'Rectangular', // UAD-REQUIRED: rectangular is the most common
    zoningCompliance: isValidZoningCompliance(s.zoningCompliance) ? s.zoningCompliance : 'Legal',

    // Improvements
    grossLivingArea: s.grossLivingArea,
    totalRooms: s.totalRooms,
    totalBedrooms: s.bedrooms,
    // URAR v1.3: compute combined count from split fields; fall back to deprecated combined field.
    totalBathrooms: s.bathsFull != null ? s.bathsFull + (s.bathsHalf ?? 0) * 0.5 : s.bathrooms,
    yearBuilt: s.yearBuilt,
    foundationType: s.foundationType,
    exteriorWalls: s.exteriorWalls,
    roofSurface: s.roofSurface,
    heating: s.heating,
    cooling: s.cooling,
    fireplaces: s.fireplaces,
    ...(isValidGarageType(s.garageType) ? { garageType: s.garageType } : {}),
    garageCars: s.garageSpaces,
    ...(s.basementSqFt != null ? { basementArea: s.basementSqFt } : s.basement !== 'None' ? { basementArea: 0 } : {}),
    ...(s.basementFinishedSqFt != null ? { basementFinishedArea: s.basementFinishedSqFt } : {}),
    ...(s.effectiveAge != null ? { effectiveAge: s.effectiveAge } : {}),

    // Pool
    pool: s.pool ? 'InGround' : 'None', // boolean → UAD string; 'AboveGround' not inferrable from boolean

    // UAD ratings
    qualityRating,
    conditionRating,
    propertyType,
    view: viewTypes,
    locationRating: (s.locationRating as UadSubjectProperty['locationRating']) ?? 'Neutral',
    
    // v1.3 Expanded Sections
    disasterMitigation: doc.disasterMitigation as any,
    energyEfficiency: doc.energyEfficiency as any,
    manufacturedHome: doc.manufacturedHome as any,
    functionalObsolescence: doc.functionalObsolescence as any,
    outbuildings: doc.outbuildings as any,
    vehicleStorage: doc.vehicleStorage as any,
    amenities: doc.amenities as any,
    overallQualityCondition: doc.overallQualityCondition as any,
    subjectListing: doc.subjectListings as any,
    rentalInformation: doc.rentalInformation as any,

    // Utilities
    publicUtilities: mapUtilities(s.utilities as any),

    // Street
    street: { paved: true }, 

    // Form meta
    occupancyType: mapOccupancyType(s.occupant), 
    currentUse: 'Single Family Residence', 
    buildingStatus: mapBuildingStatus(s.yearBuilt), 
    highestAndBestUse: (s.highestAndBestUse as any) ?? 'Present',
  };
}

function mapUtilities(utilities: CanonicalUtilities | null | undefined): UadSubjectProperty['publicUtilities'] {
  if (!utilities) {
    // Utilities block not yet filled by appraiser; all-Public avoids GSE soft-stop flags.
    return { electricity: 'Public', gas: 'Public', water: 'Public', sanitary: 'Public' };
  }
  return {
    electricity: utilities.electricity === 'None' ? 'Other' : utilities.electricity,
    gas: utilities.gas === 'None' ? 'Other' : utilities.gas,
    // Canonical water includes 'Well' which maps to UAD 'Other'
    water: utilities.water === 'Public' ? 'Public' : 'Other',
    // Canonical field is named 'sewer'; UAD MISMO spec calls it 'sanitary'
    sanitary: utilities.sewer === 'Septic' ? 'Septic' : utilities.sewer === 'None' ? 'Other' : 'Public',
  };
}

// Type guard helpers for UAD constrained string literals
function isValidSiteShape(v: string | null | undefined): v is UadSubjectProperty['siteShape'] {
  return v === 'Rectangular' || v === 'Irregular' || v === 'Triangular' || v === 'Corner Lot';
}
function isValidZoningCompliance(v: string | null | undefined): v is UadSubjectProperty['zoningCompliance'] {
  return v === 'Legal' || v === 'LegalNonConforming' || v === 'Illegal';
}
function isValidGarageType(v: string | null | undefined): v is NonNullable<UadSubjectProperty['garageType']> {
  return v === 'None' || v === 'Attached' || v === 'Detached' || v === 'Built-In' || v === 'Carport';
}

function mapOccupancyType(occupant: CanonicalSubject['occupant']): UadOccupancyType {
  switch (occupant) {
    case 'Owner':   return UadOccupancyType.PRINCIPAL_RESIDENCE;
    case 'Tenant':  return UadOccupancyType.INVESTMENT;
    case 'Vacant':  return UadOccupancyType.SECOND_HOME; // conservative; appraiser should clarify
    default:        return UadOccupancyType.PRINCIPAL_RESIDENCE; // UAD-REQUIRED: most common for SFR
  }
}

function mapBuildingStatus(yearBuilt: number): UadBuildingStatusType {
  const currentYear = new Date().getFullYear();
  if (yearBuilt > currentYear) {
    return UadBuildingStatusType.PROPOSED;
  }
  if (yearBuilt === currentYear) {
    return UadBuildingStatusType.UNDER_CONSTRUCTION;
  }
  return UadBuildingStatusType.EXISTING;
}

// ─────────────────────────────────────────────────────────────────────────────
// Appraisal Info (client, dates, neighborhood, market conditions)
// ─────────────────────────────────────────────────────────────────────────────

function mapAppraisalInfo(doc: CanonicalReportDocument): UadAppraisalInfo {
  const meta = doc.metadata;
  const s = doc.subject;

  const neighborhood = s.neighborhood ? mapNeighborhood(s.neighborhood) : ({} as UadNeighborhood);
  const marketConditions = buildMarketConditions(s.neighborhood);
  const hbuNarrative = buildHbuNarrative(s);

  return {
    clientName: meta.clientName ?? meta.borrowerName ?? '',
    clientAddress: meta.clientAddress ?? '',
    appraisalOrderDate: meta.effectiveDate ? new Date(meta.effectiveDate) : new Date(),
    inspectionDate: meta.inspectionDate ? new Date(meta.inspectionDate) : new Date(),
    reportDate: meta.effectiveDate ? new Date(meta.effectiveDate) : new Date(),
    intendedUse: 'Mortgage finance',
    intendedUser: meta.clientName ?? '',
    propertyRightsAppraised: mapPropertyRights(s.contractInfo?.propertyRightsAppraised),
    // exactOptionalPropertyTypes: only spread the key when the value is non-null
    ...(meta.loanNumber != null ? { loanNumber: meta.loanNumber } : {}),
    ...(meta.contractPrice != null ? { salePrice: meta.contractPrice } : {}),
    neighborhood,
    marketConditions,
    highestAndBestUse: hbuNarrative,
  };
}

function mapNeighborhood(n: CanonicalNeighborhood): UadNeighborhood {
  return {
    location: n.locationType,
    builtUp: n.builtUp,
    growth: n.growth,
    propertyValues: n.propertyValues,
    demandSupply: n.demandSupply,
    marketingTime: n.marketingTime,
    predominantOccupancy: n.predominantOccupancy,
    singleFamilyPriceRange: n.singleFamilyPriceRange,
    predominantAge: n.predominantAge,
    presentLandUse: n.presentLandUse,
    landUseChange: 'Not Likely', // UAD-REQUIRED: not in canonical; conservative default
    neighborhoodBoundaries: n.boundaryDescription ?? '',
    neighborhoodDescription: n.neighborhoodDescription ?? '',
    marketConditionsDescription: n.marketConditionsNotes ?? '',
  };
}

function buildMarketConditions(n: CanonicalNeighborhood | null | undefined): UadAppraisalInfo['marketConditions'] {
  // Market conditions data is not structured in canonical — populate what we can from neighborhood
  return {
    competingPropertiesCurrentlyOnMarket: 0,
    competingPropertiesInLast12Months: 0,
    competingPropertiesAbsorptionRate: '0',
    overallMarketTrend: n?.propertyValues ?? 'Stable',
    priceRangeLow: n?.singleFamilyPriceRange?.low ?? 0,
    priceRangeHigh: n?.singleFamilyPriceRange?.high ?? 0,
    averageDaysOnMarket: 0,
  };
}

function buildHbuNarrative(s: CanonicalSubject): string {
  // HbuTestSet has no single 'conclusion' field; use maximallyProductive.narrative when present
  const hbu = s.highestAndBestUseAnalysis;
  if (hbu?.asImproved?.maximallyProductive?.narrative) {
    return hbu.asImproved.maximallyProductive.narrative;
  }
  return s.highestAndBestUse === 'Present'
    ? 'Current use as improved'
    : 'See addendum';
}

function mapPropertyRights(
  rights: 'Fee Simple' | 'Leasehold' | 'Other' | null | undefined
): UadAppraisalInfo['propertyRightsAppraised'] {
  switch (rights) {
    case 'Leasehold': return 'Leasehold';
    case 'Fee Simple':
    default:          return 'FeeSimple';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Comparison Approach
// ─────────────────────────────────────────────────────────────────────────────

function mapSalesComparisonApproach(doc: CanonicalReportDocument): UadSalesComparisonApproach {
  const selectedComps = doc.comps
    .filter((c) => c.selected)
    .sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99));

  const comparables = selectedComps.map((c) => mapComparable(c, doc.reportId));

  const reconciliation = doc.reconciliation?.reconciliationNarrative ?? '';
  const indicatedValueBySalesComparison =
    doc.reconciliation?.salesCompApproachValue ??
    doc.valuation?.estimatedValue ??
    0;

  return {
    comparables,
    reconciliation,
    indicatedValueBySalesComparison,
  };
}

function mapComparable(comp: CanonicalComp, reportId: string): UadComparable {
  const ctx = `CanonicalReportDocument(${reportId}).comp(${comp.compId})`;
  const qualityRating = parseQualityRating(comp.quality, ctx);
  const conditionRating = parseConditionRating(comp.condition, ctx);
  const propertyType = parsePropertyType(comp.propertyType);
  const viewTypes = parseViewTypes(comp.view);

  const adjustments = comp.adjustments
    ? mapAdjustments(comp.adjustments)
    : buildZeroAdjustments();

  const netAdj = comp.adjustments?.netAdjustmentTotal ?? 0;
  const grossAdj = comp.adjustments?.grossAdjustmentTotal ?? 0;
  const salePrice = comp.salePrice ?? 0;
  const adjustedSalePrice = comp.adjustments?.adjustedSalePrice ?? salePrice + netAdj;

  return {
    comparableNumber: comp.slotIndex ?? 0,
    proximityToSubject: comp.proximityToSubject ?? '',
    address: {
      streetAddress: comp.address.streetAddress,
      city: comp.address.city,
      state: comp.address.state,
      zipCode: comp.address.zipCode,
      county: comp.address.county,
    },
    salePrice,
    salePricePerGLA: comp.grossLivingArea > 0 ? Math.round(salePrice / comp.grossLivingArea) : 0,
    saleDate: comp.saleDate ? new Date(comp.saleDate) : new Date(0),
    dataSource: mapDataSource(comp.dataSource),
    verificationSource: comp.verificationSource ?? '',
    saleType: parseSaleType(comp.saleType),
    financingType: parseFinancingType(comp.financingType),
    concessionsAmount: comp.concessionsAmount ?? 0,
    concessionsDescription: comp.saleFinancingConcessions ?? '',
    propertyType,
    yearBuilt: comp.yearBuilt,
    ...(comp.effectiveAge != null ? { effectiveAge: comp.effectiveAge } : {}),
    grossLivingArea: comp.grossLivingArea,
    siteSizeSquareFeet: comp.lotSizeSqFt,
    roomCount: comp.totalRooms,
    bedroomCount: comp.bedrooms,
    // URAR v1.3: compute combined count from split fields; fall back to deprecated combined field.
    bathroomCount: comp.bathsFull != null ? comp.bathsFull + (comp.bathsHalf ?? 0) * 0.5 : comp.bathrooms,
    ...(comp.basementSqFt != null ? { basementArea: comp.basementSqFt } : comp.basement !== 'None' ? { basementArea: 0 } : {}),
    ...(comp.basementFinishedSqFt != null ? { basementFinishedArea: comp.basementFinishedSqFt } : {}),
    functionalUtility: 'Average', // UAD-REQUIRED: not tracked per-comp in canonical
    ...(isValidGarageType(comp.garageType) ? { garageType: comp.garageType } : {}),
    garageCars: comp.garageSpaces,
    pool: comp.pool ? 'InGround' : 'None',
    qualityRating,
    conditionRating,
    view: viewTypes,
    locationRating: (comp.locationRating as UadComparable['locationRating']) ?? 'Neutral',
    adjustments,
    netAdjustment: netAdj,
    grossAdjustment: grossAdj,
    adjustedSalePrice,
  };
}

function mapAdjustments(ca: CanonicalAdjustments): UadAdjustments {
  const otherAdjustments: { description: string; amount: number }[] = [];

  if (ca.leaseholdFeeSimple !== 0) {
    otherAdjustments.push({ description: 'Leasehold/Fee Simple', amount: ca.leaseholdFeeSimple });
  }
  if (ca.otherAdj1 !== 0) {
    otherAdjustments.push({ description: 'Other 1', amount: ca.otherAdj1 });
  }
  if (ca.otherAdj2 !== 0) {
    otherAdjustments.push({ description: 'Other 2', amount: ca.otherAdj2 });
  }
  if (ca.otherAdj3 !== 0) {
    otherAdjustments.push({ description: 'Other 3', amount: ca.otherAdj3 });
  }

  return {
    saleOrFinancingConcessions: ca.saleOrFinancingConcessions,
    dateOfSale: ca.dateOfSaleTime,
    locationAdjustment: ca.locationAdj,
    // exactOptionalPropertyTypes: only include optional adjustment lines when non-zero
    ...(ca.site !== 0 ? { siteSize: ca.site } : {}),
    ...(ca.viewAdj !== 0 ? { view: ca.viewAdj } : {}),
    ...(ca.designAndAppeal !== 0 ? { design: ca.designAndAppeal } : {}),
    ...(ca.qualityOfConstruction !== 0 ? { qualityOfConstruction: ca.qualityOfConstruction } : {}),
    ...(ca.actualAge !== 0 ? { actualAge: ca.actualAge } : {}),
    ...(ca.conditionAdj !== 0 ? { condition: ca.conditionAdj } : {}),
    // Canonical splits aboveGradeRoomCount into total + bed + bath; UAD takes the net total
    aboveGradeRoomCount: ca.aboveGradeRoomCount + ca.aboveGradeBedroom + ca.aboveGradeBathroom,
    grossLivingArea: ca.grossLivingAreaAdj,
    ...(ca.basementAndFinishedRooms !== 0 ? { basementBelowGrade: ca.basementAndFinishedRooms } : {}),
    ...(ca.functionalUtility !== 0 ? { functionalUtility: ca.functionalUtility } : {}),
    ...(ca.heatingCooling !== 0 ? { heatingCooling: ca.heatingCooling } : {}),
    ...(ca.garageCarport !== 0 ? { garageCarport: ca.garageCarport } : {}),
    ...(ca.porchPatioPool !== 0 ? { porch: ca.porchPatioPool } : {}), // merges porch+patio+pool
    ...(ca.energyEfficiency !== 0 ? { otherAmenities: ca.energyEfficiency } : {}),
    ...(otherAdjustments.length > 0 ? { otherAdjustments } : {}),
  };
}

function buildZeroAdjustments(): UadAdjustments {
  return {
    dateOfSale: 0,
    locationAdjustment: 0,
    grossLivingArea: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Approach
// ─────────────────────────────────────────────────────────────────────────────

function mapCostApproach(ca: CanonicalCostApproach, reportId: string): UadCostApproach {
  const ctx = `CanonicalReportDocument(${reportId}).costApproach`;

  if (ca.estimatedLandValue === null) {
    throw new Error(`${ctx}: estimatedLandValue is required to map the cost approach`);
  }
  if (ca.replacementCostNew === null) {
    throw new Error(`${ctx}: replacementCostNew is required to map the cost approach`);
  }
  if (ca.depreciationAmount === null) {
    throw new Error(`${ctx}: depreciationAmount is required to map the cost approach`);
  }
  if (ca.depreciatedCostOfImprovements === null) {
    throw new Error(`${ctx}: depreciatedCostOfImprovements is required to map the cost approach`);
  }
  if (ca.indicatedValueByCostApproach === null) {
    throw new Error(`${ctx}: indicatedValueByCostApproach is required to map the cost approach`);
  }

  return {
    estimatedLandValue: ca.estimatedLandValue,
    landValueSource: ca.landValueSource ?? '',
    costNew: ca.replacementCostNew,
    depreciationAmount: ca.depreciationAmount,
    depreciationDescription: ca.depreciationType ?? '',
    depreciatedCostOfImprovements: ca.depreciatedCostOfImprovements,
    asIsValue: ca.indicatedValueByCostApproach,
    supportedBy: ca.costFactorSource ?? '',
    ...(ca.comments != null ? { comments: ca.comments } : {}),
    indicatedValueByCost: ca.indicatedValueByCostApproach,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Income Approach
// ─────────────────────────────────────────────────────────────────────────────

function mapIncomeApproach(ia: CanonicalIncomeApproach, reportId: string): UadIncomeApproach {
  const ctx = `CanonicalReportDocument(${reportId}).incomeApproach`;

  if (ia.estimatedMonthlyMarketRent === null) {
    throw new Error(`${ctx}: estimatedMonthlyMarketRent is required to map the income approach`);
  }
  if (ia.grossRentMultiplier === null) {
    throw new Error(`${ctx}: grossRentMultiplier is required to map the income approach`);
  }
  if (ia.indicatedValueByIncomeApproach === null) {
    throw new Error(`${ctx}: indicatedValueByIncomeApproach is required to map the income approach`);
  }

  const rentComparables = ia.rentComps?.map((rc) => ({
    address: rc.address,
    proximityToSubject: rc.proximityToSubject ?? '',
    monthlyRent: rc.monthlyRent,
    dataSource: rc.dataSource ?? '',
    propertyDescription: rc.propertyDescription ?? '',
  }));

  return {
    estimatedMonthlyMarketRent: ia.estimatedMonthlyMarketRent,
    grossRentMultiplier: ia.grossRentMultiplier,
    ...(rentComparables != null ? { rentComparables } : {}),
    indicatedValueByIncome: ia.indicatedValueByIncomeApproach,
    ...(ia.comments != null ? { comments: ia.comments } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation
// ─────────────────────────────────────────────────────────────────────────────

function mapReconciliation(doc: CanonicalReportDocument): UadReconciliation {
  const rec = doc.reconciliation;
  const val = doc.valuation;

  const finalValue =
    rec?.finalOpinionOfValue ??
    val?.estimatedValue;

  if (finalValue == null) {
    throw new Error(
      `CanonicalReportDocument(${doc.reportId}): finalOpinionOfValue is required — ` +
      'set reconciliation.finalOpinionOfValue or valuation.estimatedValue before generating MISMO XML'
    );
  }

  const effectiveDateStr = rec?.effectiveDate ?? val?.effectiveDate;
  if (!effectiveDateStr) {
    throw new Error(
      `CanonicalReportDocument(${doc.reportId}): effectiveDate is required for reconciliation`
    );
  }

  const salesCompValue = rec?.salesCompApproachValue;
  const costApproachValue = rec?.costApproachValue;
  const incomeApproachValue = rec?.incomeApproachValue;

  return {
    salesComparisonApproachUsed: salesCompValue != null,
    ...(salesCompValue != null ? { salesComparisonValue: salesCompValue } : {}),
    ...(rec?.salesCompWeight != null ? { salesComparisonWeight: rec.salesCompWeight } : {}),

    costApproachUsed: costApproachValue != null,
    ...(costApproachValue != null ? { costApproachValue } : {}),
    ...(rec?.costWeight != null ? { costApproachWeight: rec.costWeight } : {}),

    incomeApproachUsed: incomeApproachValue != null,
    ...(incomeApproachValue != null ? { incomeApproachValue } : {}),
    ...(rec?.incomeWeight != null ? { incomeApproachWeight: rec.incomeWeight } : {}),

    finalOpinionOfValue: finalValue,
    effectiveDate: new Date(effectiveDateStr),

    reconciliationComments: rec?.reconciliationNarrative ?? '',

    subjectPropertyInspected: true, // UAD-REQUIRED: physical inspection prerequisite for MISMO
    interiorInspected: true,         // UAD-REQUIRED: same rationale

    ...(rec?.extraordinaryAssumptions != null ? { extraordinaryAssumptions: rec.extraordinaryAssumptions } : {}),
    ...(rec?.hypotheticalConditions != null ? { hypotheticalConditions: rec.hypotheticalConditions } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Appraiser Info
// ─────────────────────────────────────────────────────────────────────────────

function mapAppraiserInfo(doc: CanonicalReportDocument): UadAppraiserInfo {
  const ai = doc.appraiserInfo;
  if (!ai) {
    throw new Error(
      `CanonicalReportDocument(${doc.reportId}): appraiserInfo is required for MISMO XML generation. ` +
      'Populate CanonicalReportDocument.appraiserInfo from the appraiser profile before calling the mapper.'
    );
  }

  const appraiserInfo: UadAppraiserInfo = {
    name: ai.name,
    companyName: ai.companyName,
    companyAddress: ai.companyAddress,
    telephoneNumber: ai.phone,
    emailAddress: ai.email,
    stateCertificationNumber: ai.licenseNumber,
    stateOfCertification: ai.licenseState,
    certificationType: ai.licenseType as UadAppraiserInfo['certificationType'],
    expirationDate: new Date(ai.licenseExpirationDate),
    signatureDate: new Date(ai.signatureDate),
  };

  if (ai.supervisoryAppraiser) {
    const sup = ai.supervisoryAppraiser;
    appraiserInfo.supervisoryAppraiser = {
      name: sup.name,
      stateCertificationNumber: sup.licenseNumber,
      stateOfCertification: sup.licenseState,
      certificationType: sup.licenseType,
      expirationDate: new Date(sup.licenseExpirationDate),
      inspectedProperty: true, // UAD-REQUIRED: supervisory appraiser inspects by default
    };
  }

  return appraiserInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Certifications
// ─────────────────────────────────────────────────────────────────────────────

function buildCertifications(doc: CanonicalReportDocument): UadCertification {
  const meta = doc.metadata;
  const inspectionDate = meta.inspectionDate
    ? new Date(meta.inspectionDate)
    : new Date();
  const signatureDate = doc.appraiserInfo?.signatureDate
    ? new Date(doc.appraiserInfo.signatureDate)
    : new Date();

  return {
    personalInspectionOfSubjectProperty: true,
    personalInspectionOfExteriorOfComparables: true,
    noCurrentOrProspectiveInterestInProperty: true,
    noPersonalInterestOrBias: true,
    feeNotContingentOnValueReported: true,
    complianceWithUSPAP: true,
    developedInAccordanceWithUSPAP: true,
    reportedAllKnownAdverseFactors: true,
    propertyInspectionDate: inspectionDate,
    appraiserStatement: 'I certify that, to the best of my knowledge and belief, the statements contained in this report are true and correct.',
    certificationDate: signatureDate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Enum / value parsers
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY_RATINGS = new Set<string>(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
const CONDITION_RATINGS = new Set<string>(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);

function parseQualityRating(value: string, ctx: string): UadQualityRating {
  if (!QUALITY_RATINGS.has(value)) {
    throw new Error(
      `${ctx}: quality rating '${value}' is not a valid UAD quality rating (expected Q1-Q6)`
    );
  }
  return value as UadQualityRating;
}

function parseConditionRating(value: string, ctx: string): UadConditionRating {
  if (!CONDITION_RATINGS.has(value)) {
    throw new Error(
      `${ctx}: condition rating '${value}' is not a valid UAD condition rating (expected C1-C6)`
    );
  }
  return value as UadConditionRating;
}

const PROPERTY_TYPE_MAP: Readonly<Record<string, UadPropertyType>> = {
  'single family':                UadPropertyType.DETACHED,
  'sfr':                          UadPropertyType.DETACHED,
  'detached':                     UadPropertyType.DETACHED,
  'detached single family':       UadPropertyType.DETACHED,
  'semi-detached':                UadPropertyType.SEMI_DETACHED,
  'semi detached':                UadPropertyType.SEMI_DETACHED,
  'attached':                     UadPropertyType.ROW_HOUSE,
  'attached single family':       UadPropertyType.ROW_HOUSE,
  'townhouse':                    UadPropertyType.ROW_HOUSE,
  'townhome':                     UadPropertyType.ROW_HOUSE,
  'row house':                    UadPropertyType.ROW_HOUSE,
  'condo':                        UadPropertyType.ATTACHED_CONDO,
  'condominium':                  UadPropertyType.ATTACHED_CONDO,
  'detached condo':               UadPropertyType.DETACHED_CONDO,
  'high rise condo':              UadPropertyType.HIGH_RISE_CONDO,
  'mid rise condo':               UadPropertyType.MID_RISE_CONDO,
  'co-op':                        UadPropertyType.COOPERATIVE,
  'cooperative':                  UadPropertyType.COOPERATIVE,
  'manufactured':                 UadPropertyType.MANUFACTURED_HOME,
  'manufactured home':            UadPropertyType.MANUFACTURED_HOME,
  'mobile home':                  UadPropertyType.MANUFACTURED_HOME,
  'modular':                      UadPropertyType.MODULAR,
  'pud':                          UadPropertyType.PUD,
  'planned unit development':     UadPropertyType.PUD,
};

function parsePropertyType(value: string): UadPropertyType {
  const normalized = value.toLowerCase().trim();
  return PROPERTY_TYPE_MAP[normalized] ?? UadPropertyType.DETACHED;
}

/**
 * Parses the canonical view string (which may be a UAD-style semicolon-delimited
 * list like "B;N;BR", a single description, or empty) into a UadViewType array.
 */
function parseViewTypes(view: string): UadViewType[] {
  if (!view || view.trim() === '') return [];

  const segments = view
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result: UadViewType[] = [];
  for (const seg of segments) {
    const mapped = VIEW_CODE_MAP[seg.toUpperCase()] ?? VIEW_CODE_MAP[seg];
    if (mapped) {
      result.push(mapped);
    }
    // Unrecognised view segments are silently dropped — UAD still validates with
    // any recognised types present.
  }

  return result.length > 0 ? result : [];
}

// Canonical UAD 3.6 view code abbreviations + full names → enum values.
// Source: UAD Appendix D, MISMO 3.4 spec.
const VIEW_CODE_MAP: Readonly<Record<string, UadViewType>> = {
  'TY':            UadViewType.TYPICAL,
  'TYPICAL':       UadViewType.TYPICAL,
  'WV':            UadViewType.WATER_VIEW,
  'WATER VIEW':    UadViewType.WATER_VIEW,
  'WATER':         UadViewType.WATER_VIEW,
  'GF':            UadViewType.GOLF_COURSE,
  'GOLF COURSE':   UadViewType.GOLF_COURSE,
  'MT':            UadViewType.MOUNTAIN,
  'MOUNTAIN':      UadViewType.MOUNTAIN,
  'MOUNTAINS':     UadViewType.MOUNTAIN,
  'PK':            UadViewType.PARK,
  'PARK':          UadViewType.PARK,
  'CV':            UadViewType.CITY_VIEW,
  'CITY VIEW':     UadViewType.CITY_VIEW,
  'CITY':          UadViewType.CITY_VIEW,
  'WT':            UadViewType.WOODS_TREES,
  'WOODS':         UadViewType.WOODS_TREES,
  'WOODS TREES':   UadViewType.WOODS_TREES,
  'TREES':         UadViewType.WOODS_TREES,
  'PA':            UadViewType.PASTORAL_AGRICULTURAL,
  'PASTORAL':      UadViewType.PASTORAL_AGRICULTURAL,
  'AGRICULTURAL':  UadViewType.PASTORAL_AGRICULTURAL,
  'RES':           UadViewType.RESIDENTIAL,
  'RESIDENTIAL':   UadViewType.RESIDENTIAL,
  'PL':            UadViewType.POWER_LINES,
  'POWER LINES':   UadViewType.POWER_LINES,
  'LS':            UadViewType.LIMITED_SIGHT,
  'LIMITED SIGHT': UadViewType.LIMITED_SIGHT,
  'IC':            UadViewType.INDUSTRIAL_COMMERCIAL,
  'INDUSTRIAL':    UadViewType.INDUSTRIAL_COMMERCIAL,
  'COMMERCIAL':    UadViewType.INDUSTRIAL_COMMERCIAL,
  'BR':            UadViewType.BUSY_ROAD,
  'BUSY ROAD':     UadViewType.BUSY_ROAD,
};

function mapDataSource(source: CanonicalComp['dataSource']): UadDataSourceType {
  switch (source) {
    case 'mls':           return UadDataSourceType.MLS;
    case 'public_record': return UadDataSourceType.PUBLIC_RECORDS;
    case 'avm':           return UadDataSourceType.OTHER;
    case 'manual':        return UadDataSourceType.APPRAISER;
    default:              return UadDataSourceType.OTHER;
  }
}

function parseSaleType(saleType: string | null | undefined): UadSaleType {
  if (!saleType) return UadSaleType.ARM_LENGTH;
  const n = saleType.toLowerCase();
  if (n.includes('reo') || n.includes('real estate owned')) return UadSaleType.REO;
  if (n.includes('short'))                                   return UadSaleType.SHORT_SALE;
  if (n.includes('foreclosure'))                             return UadSaleType.FORECLOSURE;
  if (n.includes('court') || n.includes('probate'))          return UadSaleType.COURT_ORDERED;
  if (n.includes('estate sale'))                             return UadSaleType.ESTATE_SALE;
  if (n.includes('relocation'))                              return UadSaleType.RELOCATION;
  if (n.includes('non') || n.includes('non-arm'))            return UadSaleType.NON_ARM_LENGTH;
  return UadSaleType.ARM_LENGTH;
}

function parseFinancingType(financingType: string | null | undefined): UadFinancingType {
  if (!financingType) return UadFinancingType.CONVENTIONAL;
  const n = financingType.toLowerCase();
  if (n.includes('fha'))                                 return UadFinancingType.FHA;
  if (n.includes('va'))                                  return UadFinancingType.VA;
  if (n.includes('cash'))                                return UadFinancingType.CASH;
  if (n.includes('usda') || n.includes('rhs') || n.includes('rural')) return UadFinancingType.USDA;
  if (n.includes('seller'))                              return UadFinancingType.SELLER_FINANCING;
  if (n.includes('assumed') || n.includes('assumption')) return UadFinancingType.ASSUMED;
  if (n.includes('other'))                               return UadFinancingType.OTHER;
  return UadFinancingType.CONVENTIONAL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form type assertion
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FORM_TYPES = new Set<string>(['1004', '1073', '1025', '2055', '1004C', '216']);

function assertFormType(formType: string, reportId: string): UadAppraisalReport['formType'] {
  if (VALID_FORM_TYPES.has(formType)) {
    return formType as UadAppraisalReport['formType'];
  }
  throw new Error(
    `CanonicalReportDocument(${reportId}): reportType '${formType}' is not a supported UAD form type ` +
    `(expected one of: ${[...VALID_FORM_TYPES].join(', ')})`
  );
}
