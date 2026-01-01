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
  UadAppraisalInfo
} from '../types/uad-3.6.js';
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
    
    // Property Category
    propertyDetail.ele('PropertyCurrentUsageType', subject.currentUse);
    propertyDetail.ele('PropertyUsageType', subject.occupancyType);

    // Improvements
    const improvements = property.ele('IMPROVEMENTS');
    const improvement = improvements.ele('IMPROVEMENT');

    // Improvement Feature
    const improvementFeature = improvement.ele('PROPERTY_IMPROVEMENT_FEATURE');
    
    improvementFeature.ele('ImprovementFeatureName', 'Main Dwelling');
    improvementFeature.ele('ImprovementFeatureArea', subject.grossLivingArea);
    improvementFeature.ele('ImprovementFeatureAreaType', 'GrossLivingArea');
    
    // Car Storage
    if (subject.garageCars && subject.garageCars > 0) {
      const carStorage = improvement.ele('CAR_STORAGES').ele('CAR_STORAGE');
      carStorage.ele('CarStorageType', subject.garageType || 'Garage');
      carStorage.ele('CarStorageCount', subject.garageCars);
    }

    // Structure Analyses
    const structureAnalysis = improvement.ele('STRUCTURE_ANALYSES').ele('STRUCTURE_ANALYSIS');
    
    structureAnalysis.ele('StructureAnalysisAverageRoomSize', 
      Math.round(subject.grossLivingArea / subject.totalRooms));
    structureAnalysis.ele('StructureAnalysisBedroomCount', subject.totalBedrooms);
    structureAnalysis.ele('StructureAnalysisBathroomTotalCount', subject.totalBathrooms);
    
    if (subject.halfBathrooms) {
      structureAnalysis.ele('StructureAnalysisHalfBathroomCount', subject.halfBathrooms);
    }
    
    structureAnalysis.ele('StructureAnalysisRoomCount', subject.totalRooms);
    // structureAnalysis.ele('StructureAnalysisStoryCount', subject.stories || 1);

    // Quality and Condition
    structureAnalysis.ele('ConstructionQualityType', subject.qualityRating);
    structureAnalysis.ele('PropertyConditionType', subject.conditionRating);

    // Site
    const site = property.ele('SITE');
    site.ele('SiteAreaSquareFeetCount', subject.siteSizeSquareFeet || 0);
    
    if (subject.siteSizeAcres) {
      site.ele('SiteAreaAcresCount', subject.siteSizeAcres);
    }

    // Site Influences
    const siteInfluences = site.ele('SITE_INFLUENCES');
    subject.view.forEach(viewType => {
      const siteInfluence = siteInfluences.ele('SITE_INFLUENCE');
      siteInfluence.ele('SiteInfluenceType', 'View');
      siteInfluence.ele('SiteInfluenceDescription', viewType);
    });
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
