/**
 * MISMO XML Generator for UAD 3.6
 * 
 * Generates MISMO 3.4 compliant XML for submission to:
 * - Fannie Mae UCDP (Uniform Collateral Data Portal)
 * - Freddie Mac EAD (Electronic Appraisal Delivery)
 */

import { create } from 'xmlbuilder2';
import {
  UadAppraisalReport,
  UadSubjectProperty,
  UadComparable,
  UadAppraisalInfo,
  UadNeighborhood,
  UadMarketConditions,
  UadSubjectListing
} from '@l1/shared-types';
import { Logger } from '../utils/logger.js';

export class MismoXmlGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Generate MISMO 3.4 XML from UAD Appraisal Report
   */
  generateMismoXml(report: UadAppraisalReport, submissionInfo: SubmissionInfo): string {
    this.logger.info('Generating MISMO XML for appraisal submission');

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('MESSAGE', {
        'xmlns': 'http://www.mismo.org/residential/2009/schemas',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.mismo.org/residential/2009/schemas MISMO_3_4.xsd',
        'MISMOVersionID': '3.4'
      });

    // About Versions
    const aboutVersions = root.ele('ABOUT_VERSIONS');
    aboutVersions.ele('ABOUT_VERSION', {
      'CreatedDatetime': new Date().toISOString(),
      'DataVersionIdentifier': '1',
      'DataVersionName': 'UAD 3.6'
    });

    // Deal Sets
    const dealSets = root.ele('DEAL_SETS');
    const dealSet = dealSets.ele('DEAL_SET');
    const deals = dealSet.ele('DEALS');
    const deal = deals.ele('DEAL');

    // Add Collateral (Subject Property)
    this.addCollateral(deal, report);

    // Add Loans
    this.addLoans(deal, report, submissionInfo);

    // Add Parties (Appraiser, Client, etc.)
    this.addParties(deal, report, submissionInfo);

    // Add Services (Appraisal)
    this.addServices(deal, report);

    // Generate and return XML string
    const xml = root.end({ prettyPrint: true, indent: '  ' });
    
    this.logger.info('MISMO XML generation complete');
    return xml;
  }

  /**
   * Add Collateral (Subject Property) section
   */
  private addCollateral(deal: any, report: UadAppraisalReport): void {
    const collaterals = deal.ele('COLLATERALS');
    const collateral = collaterals.ele('COLLATERAL');
    
    const subject = report.subjectProperty;

    // Subject Property Identifier
    collateral.ele('SubjectPropertyIdentifier', subject.assessorParcelNumber || 'SUBJECT');

    // Property
    const properties = collateral.ele('PROPERTIES');
    const property = properties.ele('PROPERTY');

    // Address
    this.addAddress(property, {
      streetAddress: subject.streetAddress,
      city: subject.city,
      state: subject.state,
      zipCode: subject.zipCode,
      county: subject.county
    });

    // Property Detail
    const propertyDetail = property.ele('PROPERTY_DETAIL');
    
    propertyDetail.ele('PropertyStructureBuiltYear', subject.yearBuilt);
    propertyDetail.ele('PropertyEstimatedValueAmount', report.reconciliation.finalOpinionOfValue);
    propertyDetail.ele('PropertyExistingCleanEnergyLienIndicator', 'false');
    propertyDetail.ele('PropertyInProjectIndicator', 'false');
    propertyDetail.ele('PropertyMixedUsageIndicator', 'false');
    propertyDetail.ele('PropertyCurrentUsageType', subject.currentUse);
    propertyDetail.ele('PropertyUsageType', subject.occupancyType);
    propertyDetail.ele('PropertyBuildingStatusType', subject.buildingStatus);
    propertyDetail.ele('PropertyRightsAppraisedType', report.appraisalInfo.propertyRightsAppraised);

    if (subject.legalDescription) {
      propertyDetail.ele('PropertyLegalDescription', subject.legalDescription);
    }
    if (subject.taxYear != null) {
      propertyDetail.ele('PropertyTaxYear', subject.taxYear);
    }
    if (subject.realEstateTaxes != null) {
      propertyDetail.ele('PropertyTaxAmount', subject.realEstateTaxes);
    }

    // Improvements
    const improvements = property.ele('IMPROVEMENTS');
    const improvement = improvements.ele('IMPROVEMENT');

    // Main dwelling improvement feature (above-grade GLA)
    const improvementFeature = improvement.ele('PROPERTY_IMPROVEMENT_FEATURE');
    improvementFeature.ele('ImprovementFeatureName', 'Main Dwelling');
    improvementFeature.ele('ImprovementFeatureArea', subject.grossLivingArea);
    improvementFeature.ele('ImprovementFeatureAreaType', 'GrossLivingArea');

    // Construction details — foundation, walls, roof, HVAC, fireplaces
    const constructionDetail = improvement.ele('IMPROVEMENT_CONSTRUCTION_DETAIL');
    constructionDetail.ele('ImprovementFoundationType', subject.foundationType);
    constructionDetail.ele('ImprovementExteriorWallsType', subject.exteriorWalls);
    constructionDetail.ele('ImprovementRoofSurfaceType', subject.roofSurface);
    constructionDetail.ele('ImprovementHeatingSystemType', subject.heating);
    constructionDetail.ele('ImprovementCoolingSystemType', subject.cooling);
    if (subject.fireplaces != null) {
      constructionDetail.ele('ImprovementFireplaceCount', subject.fireplaces);
    }

    // Basement
    if (subject.basementArea != null) {
      const basementFeature = improvement.ele('PROPERTY_IMPROVEMENT_FEATURE');
      basementFeature.ele('ImprovementFeatureName', 'Basement');
      basementFeature.ele('ImprovementFeatureArea', subject.basementArea);
      basementFeature.ele('ImprovementFeatureAreaType', 'BasementArea');
      if (subject.basementFinishedArea != null) {
        basementFeature.ele('ImprovementFeatureFinishedArea', subject.basementFinishedArea);
      }
    }

    // Attic
    if (subject.atticType && subject.atticType !== 'None') {
      const atticFeature = improvement.ele('PROPERTY_IMPROVEMENT_FEATURE');
      atticFeature.ele('ImprovementFeatureName', 'Attic');
      atticFeature.ele('ImprovementFeatureType', subject.atticType);
    }

    // Pool
    if (subject.pool && subject.pool !== 'None') {
      const poolFeature = improvement.ele('PROPERTY_IMPROVEMENT_FEATURE');
      poolFeature.ele('ImprovementFeatureName', 'Pool');
      poolFeature.ele('ImprovementFeatureType', subject.pool);
    }

    // Car Storage
    if (subject.garageCars && subject.garageCars > 0) {
      const carStorage = improvement.ele('CAR_STORAGES').ele('CAR_STORAGE');
      carStorage.ele('CarStorageType', subject.garageType || 'Garage');
      carStorage.ele('CarStorageCount', subject.garageCars);
    }

    // Structure Analysis
    const structureAnalysis = improvement.ele('STRUCTURE_ANALYSES').ele('STRUCTURE_ANALYSIS');
    structureAnalysis.ele('StructureAnalysisAverageRoomSize',
      Math.round(subject.grossLivingArea / subject.totalRooms));
    structureAnalysis.ele('StructureAnalysisBedroomCount', subject.totalBedrooms);
    structureAnalysis.ele('StructureAnalysisBathroomTotalCount', subject.totalBathrooms);
    if (subject.halfBathrooms) {
      structureAnalysis.ele('StructureAnalysisHalfBathroomCount', subject.halfBathrooms);
    }
    structureAnalysis.ele('StructureAnalysisRoomCount', subject.totalRooms);
    if (subject.effectiveAge != null) {
      structureAnalysis.ele('StructureAnalysisEffectiveAge', subject.effectiveAge);
    }
    structureAnalysis.ele('ConstructionQualityType', subject.qualityRating);
    structureAnalysis.ele('PropertyConditionType', subject.conditionRating);

    // Utilities
    const utilities = property.ele('UTILITIES');
    utilities.ele('UtilityElectricityType', subject.publicUtilities.electricity);
    utilities.ele('UtilityGasType', subject.publicUtilities.gas);
    utilities.ele('UtilityWaterType', subject.publicUtilities.water);
    utilities.ele('UtilitySanitarySewerType', subject.publicUtilities.sanitary);

    // Site
    const site = property.ele('SITE');
    site.ele('SiteAreaSquareFeetCount', subject.siteSizeSquareFeet || 0);
    if (subject.siteSizeAcres) {
      site.ele('SiteAreaAcresCount', subject.siteSizeAcres);
    }
    site.ele('SiteShapeType', subject.siteShape);
    site.ele('PropertyLocationRatingType', subject.locationRating);

    // Street / off-site improvements
    if (subject.street) {
      const streetNode = site.ele('SITE_IMPROVEMENTS').ele('SITE_IMPROVEMENT');
      streetNode.ele('SiteImprovementType', 'Street');
      streetNode.ele('SiteImprovementPavedIndicator', subject.street.paved ? 'true' : 'false');
      if (subject.street.surfaceType) {
        streetNode.ele('SiteImprovementSurfaceType', subject.street.surfaceType);
      }
    }

    // Zoning
    if (subject.zoningCompliance) {
      const zoning = site.ele('ZONING');
      if (subject.zoningClassification) {
        zoning.ele('ZoningClassificationType', subject.zoningClassification);
      }
      zoning.ele('ZoningComplianceType', subject.zoningCompliance);
      zoning.ele('PropertyHighestBestUseCurrentIndicator',
        subject.highestAndBestUse === 'Present' ? 'true' : 'false');
    }

    // FEMA Flood Zone
    if (subject.femaFloodZone) {
      const floodZone = site.ele('FLOOD_ZONE_DETAIL');
      floodZone.ele('FloodZoneIdentifier', subject.femaFloodZone);
      if (subject.femaMapNumber) {
        floodZone.ele('FloodZoneMapIdentifier', subject.femaMapNumber);
      }
      if (subject.femaMapDate) {
        floodZone.ele('FloodZoneMapDate', this.formatDate(subject.femaMapDate));
      }
    }

    // Site Influences (view)
    if (subject.view.length > 0) {
      const siteInfluences = site.ele('SITE_INFLUENCES');
      subject.view.forEach(viewType => {
        const siteInfluence = siteInfluences.ele('SITE_INFLUENCE');
        siteInfluence.ele('SiteInfluenceType', 'View');
        siteInfluence.ele('SiteInfluenceDescription', viewType);
      });
    }

    // Neighborhood
    this.addNeighborhood(property, report.appraisalInfo);

    // UAD v1.3 / 3.6 Expanded Sections
    this.addV13Extensions(property, subject);
  }

  private addV13Extensions(property: any, subject: any): void {
    if (subject.disasterMitigation) {
      const disasterNode = property.ele('DISASTER_MITIGATIONS');
      if (subject.disasterMitigation.communityPrograms) {
        disasterNode.ele('CommunityPrograms', subject.disasterMitigation.communityPrograms);
      }
      subject.disasterMitigation.items.forEach((item: any) => {
        const itemNode = disasterNode.ele('DISASTER_MITIGATION');
        itemNode.ele('DisasterCategory', item.disasterCategory);
        if (item.detail) itemNode.ele('MitigationDetail', item.detail);
      });
    }

    if (subject.energyEfficiency) {
      const energyNode = property.ele('ENERGY_EFFICIENCIES');
      if (subject.energyEfficiency.features?.length > 0) {
        subject.energyEfficiency.features.forEach((item: any) => {
          const itemNode = energyNode.ele('ENERGY_EFFICIENCY');
          itemNode.ele('EnergyFeatureCategory', item.category);
        });
      }
    }

    if (subject.manufacturedHome) {
      const mfgNode = property.ele('MANUFACTURED_HOME');
      mfgNode.ele('ManufacturedHomeMakeText', subject.manufacturedHome.manufacturer);
      mfgNode.ele('ManufacturedHomeModelIdentifier', subject.manufacturedHome.model);
      mfgNode.ele('ManufacturedHomeYearBuilt', subject.manufacturedHome.yearManufactured);
    }

    if (subject.vehicleStorage && Array.isArray(subject.vehicleStorage)) {
      const storageNodes = property.ele('VEHICLE_STORAGES');
      subject.vehicleStorage.forEach((vs: any) => {
        const vsNode = storageNodes.ele('VEHICLE_STORAGE');
        vsNode.ele('VehicleStorageType', vs.type);
        vsNode.ele('VehicleStorageCapacity', vs.spaces);
      });
    }

    if (subject.rentalInformation) {
      const rentalNode = property.ele('RENTAL_INFORMATION');
      if (subject.rentalInformation.rentalAnalysisCommentary) {
         rentalNode.ele('RentalAnalysisCommentary', subject.rentalInformation.rentalAnalysisCommentary);
      }
      if (subject.rentalInformation.rentSchedule && Array.isArray(subject.rentalInformation.rentSchedule)) {
        const scheduleNode = rentalNode.ele('RENT_SCHEDULES');
        subject.rentalInformation.rentSchedule.forEach((rs: any) => {
          const unitNode = scheduleNode.ele('RENT_SCHEDULE');
          unitNode.ele('UnitIdentifier', rs.unitIdentifier || '');
          if (rs.monthlyRent !== undefined && rs.monthlyRent !== null) {
            unitNode.ele('MonthlyRentAmount', rs.monthlyRent);
          }
          if (rs.occupancy) {
            unitNode.ele('UnitOccupancyType', rs.occupancy);
          }
        });
      }
    }

    if (subject.revisionHistory && Array.isArray(subject.revisionHistory)) {
      const revsNode = property.ele('REVISION_HISTORIES');
      subject.revisionHistory.forEach((rev: any) => {
        const revNode = revsNode.ele('REVISION_HISTORY');
        revNode.ele('RevisionDate', rev.revisionDate || '');
        revNode.ele('RevisionSection', rev.urarSection || '');
        revNode.ele('RevisionDescription', rev.description || '');
      });
    }

    if (subject.reconsiderationOfValue) {
      const rovNode = property.ele('RECONSIDERATION_OF_VALUE');
      rovNode.ele('ReconsiderationType', subject.reconsiderationOfValue.type || '');
      rovNode.ele('ReconsiderationDate', subject.reconsiderationOfValue.date || '');
      rovNode.ele('ReconsiderationResult', subject.reconsiderationOfValue.result || '');
      rovNode.ele('ReconsiderationCommentary', subject.reconsiderationOfValue.commentary || '');
    }

    if (subject.subjectListings && subject.subjectListings.length > 0) {
      const listingsNode = property.ele('SUBJECT_LISTINGS');
      subject.subjectListings.forEach((sl: UadSubjectListing) => {
        const listingNode = listingsNode.ele('SUBJECT_LISTING');
        if (sl.dataSource)                       listingNode.ele('SubjectListingDataSource', sl.dataSource);
        if (sl.listingStatus)                    listingNode.ele('SubjectListingStatusType', sl.listingStatus);
        if (sl.listingType)                      listingNode.ele('SubjectListingType', sl.listingType);
        if (sl.listingId)                        listingNode.ele('SubjectListingIdentifier', sl.listingId);
        if (sl.startDate)                        listingNode.ele('SubjectListingStartDate', sl.startDate);
        if (sl.endDate)                          listingNode.ele('SubjectListingEndDate', sl.endDate);
        if (sl.daysOnMarket != null)             listingNode.ele('SubjectListingDaysOnMarketCount', String(sl.daysOnMarket));
        if (sl.startingListPrice != null)        listingNode.ele('SubjectListingStartingPriceAmount', String(sl.startingListPrice));
        if (sl.currentOrFinalListPrice != null)  listingNode.ele('SubjectListingCurrentPriceAmount', String(sl.currentOrFinalListPrice));
      });
    }

    if (subject.functionalObsolescence && Array.isArray(subject.functionalObsolescence) && subject.functionalObsolescence.length > 0) {
      const foNode = property.ele('FUNCTIONAL_OBSOLESCENCES');
      subject.functionalObsolescence.forEach((fo: any) => {
        const foItem = foNode.ele('FUNCTIONAL_OBSOLESCENCE');
        if (fo.feature)      foItem.ele('FunctionalObsolescenceFeature', fo.feature);
        if (fo.description)  foItem.ele('FunctionalObsolescenceDescription', fo.description);
        if (fo.curable != null) foItem.ele('FunctionalObsolescenceCurableIndicator', fo.curable ? 'true' : 'false');
        if (fo.impact)       foItem.ele('FunctionalObsolescenceImpact', fo.impact);
        if (fo.comment)      foItem.ele('FunctionalObsolescenceComment', fo.comment);
      });
    }

    if (subject.outbuildings && Array.isArray(subject.outbuildings) && subject.outbuildings.length > 0) {
      const obNode = property.ele('OUTBUILDINGS');
      subject.outbuildings.forEach((ob: any) => {
        const obItem = obNode.ele('OUTBUILDING');
        if (ob.type)                obItem.ele('OutbuildingType', ob.type);
        if (ob.gba != null)         obItem.ele('OutbuildingGrossArea', ob.gba);
        if (ob.finishedArea != null) obItem.ele('OutbuildingFinishedArea', ob.finishedArea);
        if (ob.yearBuilt != null)   obItem.ele('OutbuildingYearBuilt', ob.yearBuilt);
        if (ob.quality)             obItem.ele('OutbuildingQualityType', ob.quality);
        if (ob.condition)           obItem.ele('OutbuildingConditionType', ob.condition);
        if (ob.comment)             obItem.ele('OutbuildingComment', ob.comment);
      });
    }

    if (subject.amenities && Array.isArray(subject.amenities) && subject.amenities.length > 0) {
      const amNode = property.ele('PROPERTY_AMENITIES');
      subject.amenities.forEach((am: any) => {
        const amItem = amNode.ele('PROPERTY_AMENITY');
        if (am.category)  amItem.ele('AmenityCategory', am.category);
        if (am.feature)   amItem.ele('AmenityFeature', am.feature);
        if (am.detail)    amItem.ele('AmenityDetail', am.detail);
        if (am.impact)    amItem.ele('AmenityImpact', am.impact);
        if (am.comment)   amItem.ele('AmenityComment', am.comment);
      });
    }

    if (subject.overallQualityCondition) {
      const qcNode = property.ele('OVERALL_QUALITY_CONDITION');
      const oqc = subject.overallQualityCondition;
      if (oqc.overallQuality)    qcNode.ele('OverallQualityRating', oqc.overallQuality);
      if (oqc.overallCondition)  qcNode.ele('OverallConditionRating', oqc.overallCondition);
      if (oqc.reconciliationNarrative) qcNode.ele('QualityConditionNarrative', oqc.reconciliationNarrative);
      if (oqc.exteriorFeatures?.length > 0) {
        const extNode = qcNode.ele('EXTERIOR_FEATURE_RATINGS');
        oqc.exteriorFeatures.forEach((ef: any) => {
          const efItem = extNode.ele('FEATURE_RATING');
          efItem.ele('FeatureName', ef.feature);
          if (ef.quality)    efItem.ele('FeatureQualityRating', ef.quality);
          if (ef.condition)  efItem.ele('FeatureConditionRating', ef.condition);
        });
      }
      if (oqc.interiorFeatures?.length > 0) {
        const intNode = qcNode.ele('INTERIOR_FEATURE_RATINGS');
        oqc.interiorFeatures.forEach((inf: any) => {
          const infItem = intNode.ele('FEATURE_RATING');
          infItem.ele('FeatureName', inf.feature);
          if (inf.quality)    infItem.ele('FeatureQualityRating', inf.quality);
          if (inf.condition)  infItem.ele('FeatureConditionRating', inf.condition);
        });
      }
    }
  }

  /**
   * Add Neighborhood section
   */
  private addNeighborhood(property: any, appraisalInfo: UadAppraisalInfo): void {
    const n = appraisalInfo.neighborhood;
    const mc = appraisalInfo.marketConditions;
    const neighborhood = property.ele('NEIGHBORHOOD');

    neighborhood.ele('NeighborhoodLocationType', n.location);
    neighborhood.ele('NeighborhoodBuiltUpType', n.builtUp);
    neighborhood.ele('NeighborhoodGrowthRateType', n.growth);
    neighborhood.ele('NeighborhoodPropertyValueTrendType', n.propertyValues);
    neighborhood.ele('NeighborhoodDemandSupplyType', n.demandSupply);
    neighborhood.ele('NeighborhoodMarketingTimeType', n.marketingTime);
    neighborhood.ele('NeighborhoodPredominantOccupancyType', n.predominantOccupancy);
    neighborhood.ele('NeighborhoodLandUseChangeType', n.landUseChange);

    if (n.neighborhoodBoundaries) {
      neighborhood.ele('NeighborhoodBoundariesDescription', n.neighborhoodBoundaries);
    }
    neighborhood.ele('NeighborhoodDescription', n.neighborhoodDescription);
    neighborhood.ele('NeighborhoodMarketConditionsDescription', n.marketConditionsDescription);

    // Price range and predominant age
    neighborhood.ele('NeighborhoodSingleFamilyPriceRangeLowAmount', n.singleFamilyPriceRange.low);
    neighborhood.ele('NeighborhoodSingleFamilyPriceRangeHighAmount', n.singleFamilyPriceRange.high);
    neighborhood.ele('NeighborhoodPredominantAgeDescription', n.predominantAge);

    // Present land use percentages
    const landUse = neighborhood.ele('NEIGHBORHOOD_LAND_USES');
    landUse.ele('NeighborhoodLandUseSingleFamilyPercent', n.presentLandUse.singleFamily);
    landUse.ele('NeighborhoodLandUseMultifamilyPercent', n.presentLandUse.multifamily);
    landUse.ele('NeighborhoodLandUseCommercialPercent', n.presentLandUse.commercial);
    landUse.ele('NeighborhoodLandUseOtherPercent', n.presentLandUse.other);

    // Market conditions
    const marketCond = neighborhood.ele('NEIGHBORHOOD_MARKET_CONDITIONS');
    marketCond.ele('NeighborhoodMarketConditionsCompetingPropertiesCurrentCount',
      mc.competingPropertiesCurrentlyOnMarket);
    marketCond.ele('NeighborhoodMarketConditionsCompetingPropertiesPriorYearCount',
      mc.competingPropertiesInLast12Months);
    marketCond.ele('NeighborhoodMarketConditionsAbsorptionRateDescription',
      mc.competingPropertiesAbsorptionRate);
    marketCond.ele('NeighborhoodMarketConditionsOverallTrendType', mc.overallMarketTrend);
    marketCond.ele('NeighborhoodMarketConditionsPriceRangeLowAmount', mc.priceRangeLow);
    marketCond.ele('NeighborhoodMarketConditionsPriceRangeHighAmount', mc.priceRangeHigh);
    marketCond.ele('NeighborhoodMarketConditionsAverageDaysOnMarketCount', mc.averageDaysOnMarket);
    if (mc.additionalComments) {
      marketCond.ele('NeighborhoodMarketConditionsAdditionalComments', mc.additionalComments);
    }
  }

  /**
   * Add Loans section
   */
  private addLoans(deal: any, report: UadAppraisalReport, submissionInfo: SubmissionInfo): void {
    const loans = deal.ele('LOANS');
    const loan = loans.ele('LOAN');

    // Loan Identifiers
    const loanIdentifiers = loan.ele('LOAN_IDENTIFIERS');
    loanIdentifiers.ele('LoanIdentifier', submissionInfo.loanNumber);
    loanIdentifiers.ele('LoanIdentifierType', 'LenderLoanNumber');

    // Loan Detail
    const loanDetail = loan.ele('LOAN_DETAIL');
    
    if (report.appraisalInfo.salePrice) {
      loanDetail.ele('BaseLoanAmount', report.appraisalInfo.salePrice);
    }
    
    // Loan Purpose
    const loanPurposeType = report.appraisalInfo.propertyRightsAppraised === 'FeeSimple' 
      ? 'Purchase' 
      : 'Refinance';
    loanDetail.ele('LoanPurposeType', loanPurposeType);

    // Appraisal
    const appraisals = loan.ele('VALUATIONS').ele('VALUATION').ele('APPRAISALS');
    const appraisal = appraisals.ele('APPRAISAL');

    // Appraisal Identifiers
    const appraisalIdentifiers = appraisal.ele('APPRAISAL_IDENTIFIERS');
    appraisalIdentifiers.ele('AppraisalIdentifier', report.appraisalReportIdentifier);
    appraisalIdentifiers.ele('AppraisalIdentifierType', 'AppraisalReportNumber');

    // Appraisal Forms
    const appraisalForms = appraisal.ele('APPRAISAL_FORMS');
    const appraisalForm = appraisalForms.ele('APPRAISAL_FORM');
    
    appraisalForm.ele('AppraisalFormVersionIdentifier', 'UAD3.6');
    appraisalForm.ele('AppraisalFormType', `URAR${report.formType}`); // e.g., URAR1004
    appraisalForm.ele('AppraisalFormIdentifier', report.formType);

    // Property Valuation
    const propertyValuation = appraisal.ele('PROPERTY_VALUATION');
    
    propertyValuation.ele('PropertyAppraisalEffectiveDate', 
      this.formatDate(report.reconciliation.effectiveDate));
    propertyValuation.ele('PropertyAppraisalAmount', 
      report.reconciliation.finalOpinionOfValue);
    
    // Add Approaches to Value
    this.addApproachesToValue(propertyValuation, report);

    // Property Inspection
    propertyValuation.ele('PropertyInspectionDate', 
      this.formatDate(report.appraisalInfo.inspectionDate));
    propertyValuation.ele('PropertyInspectionType', 
      report.reconciliation.interiorInspected ? 'Interior' : 'Exterior');
  }

  /**
   * Add Approaches to Value
   */
  private addApproachesToValue(propertyValuation: any, report: UadAppraisalReport): void {
    // Sales Comparison Approach
    if (report.salesComparisonApproach && report.reconciliation.salesComparisonApproachUsed) {
      const salesComparison = propertyValuation.ele('APPROACHES_TO_VALUE')
        .ele('SALES_COMPARISON_APPROACH');

      salesComparison.ele('SalesComparisonApproachIndicatedValue', 
        report.salesComparisonApproach.indicatedValueBySalesComparison);

      // Comparables
      const comparableSales = salesComparison.ele('COMPARABLE_SALES');
      
      report.salesComparisonApproach.comparables.forEach((comp, index) => {
        const comparableSale = comparableSales.ele('COMPARABLE_SALE');
        this.addComparable(comparableSale, comp, index + 1);
      });
    }

    // Cost Approach
    if (report.costApproach && report.reconciliation.costApproachUsed) {
      const costApproach = propertyValuation.ele('APPROACHES_TO_VALUE')
        .ele('COST_APPROACH');

      costApproach.ele('CostApproachIndicatedValue', 
        report.costApproach.indicatedValueByCost);
      costApproach.ele('EstimatedLandValue', 
        report.costApproach.estimatedLandValue);
      costApproach.ele('ReproductionCostNewAmount', 
        report.costApproach.costNew);
      costApproach.ele('DepreciationAmount', 
        report.costApproach.depreciationAmount);
    }

    // Income Approach
    if (report.incomeApproach && report.reconciliation.incomeApproachUsed) {
      const incomeApproach = propertyValuation.ele('APPROACHES_TO_VALUE')
        .ele('INCOME_APPROACH');

      incomeApproach.ele('IncomeApproachIndicatedValue', 
        report.incomeApproach.indicatedValueByIncome);
      incomeApproach.ele('GrossRentMultiplierValue', 
        report.incomeApproach.grossRentMultiplier);
      incomeApproach.ele('ProjectedGrossMonthlyRentalIncomeAmount', 
        report.incomeApproach.estimatedMonthlyMarketRent);
    }
  }

  /**
   * Add Comparable Sale
   */
  private addComparable(comparableSale: any, comp: UadComparable, compNumber: number): void {
    // Comparable Identifier
    comparableSale.ele('ComparableSaleIdentifier', `Comp${compNumber}`);

    // Address
    this.addAddress(comparableSale, {
      streetAddress: comp.address.streetAddress,
      city: comp.address.city,
      state: comp.address.state,
      zipCode: comp.address.zipCode,
      county: comp.address.county
    });

    // Sale Information
    comparableSale.ele('ComparableSaleDate', this.formatDate(comp.saleDate));
    comparableSale.ele('ComparableSalePrice', comp.salePrice);
    comparableSale.ele('ComparableSaleProximityDescription', comp.proximityToSubject);
    
    // Data Source
    comparableSale.ele('ComparableSaleDataSourceType', comp.dataSource);
    comparableSale.ele('ComparableSaleVerificationSourceDescription', comp.verificationSource);

    // Property Characteristics
    const comparableProperty = comparableSale.ele('COMPARABLE_PROPERTY');
    
    comparableProperty.ele('PropertyGrossLivingAreaSquareFeetCount', comp.grossLivingArea);
    comparableProperty.ele('PropertyStructureBuiltYear', comp.yearBuilt);
    comparableProperty.ele('PropertyBedroomCount', comp.bedroomCount);
    comparableProperty.ele('PropertyBathroomTotalCount', comp.bathroomCount);
    comparableProperty.ele('PropertyQualityType', comp.qualityRating);
    comparableProperty.ele('PropertyConditionType', comp.conditionRating);

    if (comp.siteSizeSquareFeet) {
      comparableProperty.ele('PropertySiteSquareFeetCount', comp.siteSizeSquareFeet);
    }

    // Adjustments
    this.addComparableAdjustments(comparableSale, comp);

    // Adjusted Sale Price
    comparableSale.ele('AdjustedComparableSalePrice', comp.adjustedSalePrice);
    comparableSale.ele('NetAdjustmentAmount', comp.netAdjustment);
    comparableSale.ele('GrossAdjustmentAmount', comp.grossAdjustment);
  }

  /**
   * Add Comparable Adjustments
   */
  private addComparableAdjustments(comparableSale: any, comp: UadComparable): void {
    const adjustments = comparableSale.ele('COMPARABLE_ADJUSTMENTS');

    const adjMapping = [
      { name: 'SaleOrFinancingConcessions', value: comp.adjustments.saleOrFinancingConcessions },
      { name: 'DateOfSaleTime', value: comp.adjustments.dateOfSale },
      { name: 'Location', value: comp.adjustments.locationAdjustment },
      { name: 'SiteView', value: comp.adjustments.view },
      { name: 'Design', value: comp.adjustments.design },
      { name: 'QualityOfConstruction', value: comp.adjustments.qualityOfConstruction },
      { name: 'ActualAge', value: comp.adjustments.actualAge },
      { name: 'Condition', value: comp.adjustments.condition },
      { name: 'AboveGradeRoomCount', value: comp.adjustments.aboveGradeRoomCount },
      { name: 'GrossLivingArea', value: comp.adjustments.grossLivingArea },
      { name: 'BasementFinishedRoomsArea', value: comp.adjustments.basementBelowGrade },
      { name: 'FunctionalUtility', value: comp.adjustments.functionalUtility },
      { name: 'HeatingCooling', value: comp.adjustments.heatingCooling },
      { name: 'GarageCarport', value: comp.adjustments.garageCarport },
      { name: 'PorchPatioDecksqft', value: comp.adjustments.porch },
      { name: 'Pool', value: comp.adjustments.pool }
    ];

    adjMapping.forEach(adj => {
      if (adj.value !== undefined && adj.value !== null) {
        const adjustment = adjustments.ele('COMPARABLE_ADJUSTMENT');
        adjustment.ele('ComparableAdjustmentType', adj.name);
        adjustment.ele('ComparableAdjustmentAmount', adj.value);
      }
    });

    // Other adjustments
    if (comp.adjustments.otherAdjustments) {
      comp.adjustments.otherAdjustments.forEach(other => {
        const adjustment = adjustments.ele('COMPARABLE_ADJUSTMENT');
        adjustment.ele('ComparableAdjustmentType', 'Other');
        adjustment.ele('ComparableAdjustmentDescription', other.description);
        adjustment.ele('ComparableAdjustmentAmount', other.amount);
      });
    }
  }

  /**
   * Add Parties (Appraiser, Client, etc.)
   */
  private addParties(deal: any, report: UadAppraisalReport, submissionInfo: SubmissionInfo): void {
    const parties = deal.ele('PARTIES');

    // Appraiser
    const appraiserParty = parties.ele('PARTY');
    appraiserParty.ele('INDIVIDUAL').ele('NAME').ele('FullName', report.appraiserInfo.name);
    
    const appraiserRoles = appraiserParty.ele('ROLES');
    const appraiserRole = appraiserRoles.ele('ROLE');
    appraiserRole.ele('RoleType', 'Appraiser');
    
    const licenses = appraiserRole.ele('LICENSES');
    const license = licenses.ele('LICENSE');
    license.ele('LicenseIdentifier', report.appraiserInfo.stateCertificationNumber);
    license.ele('LicenseIssuingAuthorityName', report.appraiserInfo.stateOfCertification);
    license.ele('LicenseExpirationDate', this.formatDate(report.appraiserInfo.expirationDate));

    // Client/Lender
    const clientParty = parties.ele('PARTY');
    clientParty.ele('LEGAL_ENTITY').ele('FullName', report.appraisalInfo.clientName);
    
    const clientRoles = clientParty.ele('ROLES');
    const clientRole = clientRoles.ele('ROLE');
    clientRole.ele('RoleType', 'Lender');
  }

  /**
   * Add Services (Appraisal Service)
   */
  private addServices(deal: any, report: UadAppraisalReport): void {
    const services = deal.ele('SERVICES');
    const service = services.ele('SERVICE');

    service.ele('ServiceType', 'Appraisal');
    service.ele('ServiceOrderedDate', this.formatDate(report.appraisalInfo.appraisalOrderDate));
    service.ele('ServiceCompletedDate', this.formatDate(report.appraisalInfo.reportDate));
  }

  /**
   * Add Address helper
   */
  private addAddress(parent: any, address: any): void {
    const addressNode = parent.ele('ADDRESS');
    
    addressNode.ele('AddressLineText', address.streetAddress);
    addressNode.ele('CityName', address.city);
    addressNode.ele('StateCode', address.state);
    addressNode.ele('PostalCode', address.zipCode);
    
    if (address.county) {
      addressNode.ele('CountyName', address.county);
    }
  }

  /**
   * Format date for MISMO (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate XML for submission preview (validation without actual submission)
   */
  generatePreviewXml(report: UadAppraisalReport): string {
    const submissionInfo: SubmissionInfo = {
      loanNumber: 'PREVIEW',
      lenderName: 'Preview Mode',
      lenderIdentifier: 'PREVIEW',
      submittingUserName: 'System',
      submittingUserId: 'system'
    };

    return this.generateMismoXml(report, submissionInfo);
  }
}

export interface SubmissionInfo {
  loanNumber: string;
  lenderName: string;
  lenderIdentifier: string;
  submittingUserName: string;
  submittingUserId: string;
}

export default MismoXmlGenerator;
