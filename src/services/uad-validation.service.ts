/**
 * UAD 3.6 Validation Service
 * 
 * Validates appraisal data against Fannie Mae/Freddie Mac UAD 3.6 specification
 * Ensures compliance before submission to UCDP/EAD
 */

import {
  UadAppraisalReport,
  UadValidationResult,
  UadValidationError,
  UadQualityRating,
  UadConditionRating,
  UadPropertyType,
  UadOccupancyType,
  UadComparable,
  UadAdjustments,
  CanonicalReportDocument,
  CanonicalDisasterMitigationItem,
  CanonicalEnergyFeature,
  CanonicalFunctionalObsolescenceItem,
  CanonicalVehicleStorage,
  CanonicalOutbuilding,
  CanonicalPropertyAmenity,
  CanonicalAnalyzedPropertyNotUsed,
  CanonicalPriorTransfer,
  CanonicalRevisionEntry,
  CanonicalReconsiderationOfValue,
  CanonicalAssignmentConditions,
  CanonicalOverallQualityCondition
} from '@l1/shared-types';
import { Logger } from '../utils/logger.js';

export class UadValidationService {
  private logger: Logger;
  
  constructor() {
    this.logger = new Logger();
  }

  /**
   * Comprehensive UAD 3.6 validation
   */
  async validateAppraisalReport(report: UadAppraisalReport): Promise<UadValidationResult> {
    const errors: UadValidationError[] = [];
    const warnings: UadValidationError[] = [];

    // Required Version Check
    if (report.uadVersion !== '3.6') {
      errors.push({
        fieldPath: 'uadVersion',
        errorCode: 'UAD_VERSION_INVALID',
        errorMessage: `UAD version must be 3.6, received: ${report.uadVersion}`,
        severity: 'ERROR',
        uadRule: 'UAD-001'
      });
    }

    if (report.mismoVersion !== '3.4') {
      errors.push({
        fieldPath: 'mismoVersion',
        errorCode: 'MISMO_VERSION_INVALID',
        errorMessage: `MISMO version must be 3.4, received: ${report.mismoVersion}`,
        severity: 'ERROR',
        uadRule: 'UAD-002'
      });
    }

    // Subject Property Validation
    errors.push(...this.validateSubjectProperty(report.subjectProperty));
    
    // Appraisal Info Validation
    errors.push(...this.validateAppraisalInfo(report.appraisalInfo));
    
    // Comparables Validation (if using Sales Comparison Approach)
    if (report.salesComparisonApproach) {
      errors.push(...this.validateSalesComparisonApproach(report.salesComparisonApproach));
    }
    
    // Reconciliation Validation
    errors.push(...this.validateReconciliation(report.reconciliation));
    
    // Appraiser Information Validation
    errors.push(...this.validateAppraiserInfo(report.appraiserInfo));
    
    // Certification Validation
    errors.push(...this.validateCertification(report.certifications));
    
    // Form Type Validation
    if (!['1004', '1073', '1025', '2055', '1004C', '216'].includes(report.formType)) {
      errors.push({
        fieldPath: 'formType',
        errorCode: 'FORM_TYPE_INVALID',
        errorMessage: `Invalid form type: ${report.formType}`,
        severity: 'ERROR',
        uadRule: 'UAD-003'
      });
    }

    // Separate errors from warnings
    const actualErrors = errors.filter(e => e.severity === 'ERROR');
    const actualWarnings = errors.filter(e => e.severity === 'WARNING');

    return {
      isValid: actualErrors.length === 0,
      errors: actualErrors,
      warnings: actualWarnings,
      validatedAt: new Date(),
      uadVersion: '3.6'
    };
  }

  /**
   * Validate Subject Property fields
   */
  private validateSubjectProperty(property: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Required Fields
    const requiredFields = [
      'streetAddress', 'city', 'state', 'zipCode', 'county',
      'propertyType', 'occupancyType', 'yearBuilt',
      'grossLivingArea', 'totalRooms', 'totalBedrooms', 'totalBathrooms',
      'qualityRating', 'conditionRating'
    ];

    requiredFields.forEach(field => {
      if (!property[field]) {
        errors.push({
          fieldPath: `subjectProperty.${field}`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Required field '${field}' is missing`,
          severity: 'ERROR',
          uadRule: 'UAD-100'
        });
      }
    });

    // State Code Validation (must be 2 letters)
    if (property.state && !/^[A-Z]{2}$/.test(property.state)) {
      errors.push({
        fieldPath: 'subjectProperty.state',
        errorCode: 'STATE_CODE_INVALID',
        errorMessage: `State must be a valid 2-letter code, received: ${property.state}`,
        severity: 'ERROR',
        uadRule: 'UAD-101'
      });
    }

    // Zip Code Validation
    if (property.zipCode && !/^\d{5}(-\d{4})?$/.test(property.zipCode)) {
      errors.push({
        fieldPath: 'subjectProperty.zipCode',
        errorCode: 'ZIP_CODE_INVALID',
        errorMessage: `Zip code must be 5 or 9 digits, received: ${property.zipCode}`,
        severity: 'ERROR',
        uadRule: 'UAD-102'
      });
    }

    // Quality Rating Validation
    if (property.qualityRating && !Object.values(UadQualityRating).includes(property.qualityRating)) {
      errors.push({
        fieldPath: 'subjectProperty.qualityRating',
        errorCode: 'QUALITY_RATING_INVALID',
        errorMessage: `Quality rating must be Q1-Q6, received: ${property.qualityRating}`,
        severity: 'ERROR',
        uadRule: 'UAD-103'
      });
    }

    // Condition Rating Validation
    if (property.conditionRating && !Object.values(UadConditionRating).includes(property.conditionRating)) {
      errors.push({
        fieldPath: 'subjectProperty.conditionRating',
        errorCode: 'CONDITION_RATING_INVALID',
        errorMessage: `Condition rating must be C1-C6, received: ${property.conditionRating}`,
        severity: 'ERROR',
        uadRule: 'UAD-104'
      });
    }

    // Year Built Validation
    const currentYear = new Date().getFullYear();
    if (property.yearBuilt && (property.yearBuilt < 1600 || property.yearBuilt > currentYear + 1)) {
      errors.push({
        fieldPath: 'subjectProperty.yearBuilt',
        errorCode: 'YEAR_BUILT_INVALID',
        errorMessage: `Year built must be between 1600 and ${currentYear + 1}, received: ${property.yearBuilt}`,
        severity: 'ERROR',
        uadRule: 'UAD-105'
      });
    }

    // Gross Living Area Validation
    if (property.grossLivingArea && (property.grossLivingArea < 100 || property.grossLivingArea > 50000)) {
      errors.push({
        fieldPath: 'subjectProperty.grossLivingArea',
        errorCode: 'GLA_OUT_OF_RANGE',
        errorMessage: `Gross living area seems unusual: ${property.grossLivingArea} sq ft`,
        severity: 'WARNING',
        uadRule: 'UAD-106'
      });
    }

    // Total Rooms vs Bedrooms/Bathrooms
    if (property.totalRooms && property.totalBedrooms && property.totalBathrooms) {
      const minRooms = property.totalBedrooms + Math.ceil(property.totalBathrooms);
      if (property.totalRooms < minRooms) {
        errors.push({
          fieldPath: 'subjectProperty.totalRooms',
          errorCode: 'ROOM_COUNT_INCONSISTENT',
          errorMessage: `Total rooms (${property.totalRooms}) cannot be less than bedrooms + bathrooms (${minRooms})`,
          severity: 'ERROR',
          uadRule: 'UAD-107'
        });
      }
    }

    // Basement Finished Area vs Total Basement
    if (property.basementFinishedArea && property.basementArea) {
      if (property.basementFinishedArea > property.basementArea) {
        errors.push({
          fieldPath: 'subjectProperty.basementFinishedArea',
          errorCode: 'BASEMENT_AREA_INVALID',
          errorMessage: `Finished basement area (${property.basementFinishedArea}) cannot exceed total basement area (${property.basementArea})`,
          severity: 'ERROR',
          uadRule: 'UAD-108'
        });
      }
    }

    // v1.3 Expanded Sections Validation
    if (property.disasterMitigation && !Array.isArray(property.disasterMitigation.items)) {
      errors.push({
        fieldPath: 'subjectProperty.disasterMitigation.items',
        errorCode: 'INVALID_FORMAT',
        errorMessage: 'Disaster mitigation items must be an array',
        severity: 'ERROR',
        uadRule: 'UAD-109'
      });
    }

    if (property.rentalInformation && property.rentalInformation.rentSchedule && !Array.isArray(property.rentalInformation.rentSchedule)) {
      errors.push({
        fieldPath: 'subjectProperty.rentalInformation.rentSchedule',
        errorCode: 'INVALID_FORMAT',
        errorMessage: 'Rent schedule must be an array of units',
        severity: 'ERROR',
        uadRule: 'UAD-201'
      });
    }

    if (property.revisionHistory && !Array.isArray(property.revisionHistory)) {
      errors.push({
        fieldPath: 'subjectProperty.revisionHistory',
        errorCode: 'INVALID_FORMAT',
        errorMessage: 'Revision history must be an array of entries',
        severity: 'ERROR',
        uadRule: 'UAD-202'
      });
    }

    if (property.manufacturedHome) {
      if (!property.manufacturedHome.make) {
        errors.push({
          fieldPath: 'subjectProperty.manufacturedHome.make',
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: 'Manufactured home make is required',
          severity: 'ERROR',
          uadRule: 'UAD-110'
        });
      }
    }

    if (property.vehicleStorage && !Array.isArray(property.vehicleStorage)) {
      errors.push({
        fieldPath: 'subjectProperty.vehicleStorage',
        errorCode: 'INVALID_FORMAT',
        errorMessage: 'Vehicle storage must be an array',
        severity: 'ERROR',
        uadRule: 'UAD-111'
      });
    }

    return errors;
  }

  /**
   * Validate Appraisal Information
   */
  private validateAppraisalInfo(appraisalInfo: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Required Fields
    if (!appraisalInfo.clientName) {
      errors.push({
        fieldPath: 'appraisalInfo.clientName',
        errorCode: 'CLIENT_NAME_REQUIRED',
        errorMessage: 'Client name is required',
        severity: 'ERROR',
        uadRule: 'UAD-200'
      });
    }

    if (!appraisalInfo.inspectionDate) {
      errors.push({
        fieldPath: 'appraisalInfo.inspectionDate',
        errorCode: 'INSPECTION_DATE_REQUIRED',
        errorMessage: 'Inspection date is required',
        severity: 'ERROR',
        uadRule: 'UAD-201'
      });
    }

    if (!appraisalInfo.reportDate) {
      errors.push({
        fieldPath: 'appraisalInfo.reportDate',
        errorCode: 'REPORT_DATE_REQUIRED',
        errorMessage: 'Report date is required',
        severity: 'ERROR',
        uadRule: 'UAD-202'
      });
    }

    // Date Logic Validation
    if (appraisalInfo.inspectionDate && appraisalInfo.reportDate) {
      const inspectionDate = new Date(appraisalInfo.inspectionDate);
      const reportDate = new Date(appraisalInfo.reportDate);
      
      if (reportDate < inspectionDate) {
        errors.push({
          fieldPath: 'appraisalInfo.reportDate',
          errorCode: 'REPORT_DATE_BEFORE_INSPECTION',
          errorMessage: 'Report date cannot be before inspection date',
          severity: 'ERROR',
          uadRule: 'UAD-203'
        });
      }
    }

    // Intended Use and User
    if (!appraisalInfo.intendedUse) {
      errors.push({
        fieldPath: 'appraisalInfo.intendedUse',
        errorCode: 'INTENDED_USE_REQUIRED',
        errorMessage: 'Intended use is required',
        severity: 'ERROR',
        uadRule: 'UAD-204'
      });
    }

    if (!appraisalInfo.intendedUser) {
      errors.push({
        fieldPath: 'appraisalInfo.intendedUser',
        errorCode: 'INTENDED_USER_REQUIRED',
        errorMessage: 'Intended user is required',
        severity: 'ERROR',
        uadRule: 'UAD-205'
      });
    }

    // Neighborhood Validation
    if (!appraisalInfo.neighborhood?.neighborhoodDescription) {
      errors.push({
        fieldPath: 'appraisalInfo.neighborhood.neighborhoodDescription',
        errorCode: 'NEIGHBORHOOD_DESCRIPTION_REQUIRED',
        errorMessage: 'Neighborhood description is required',
        severity: 'ERROR',
        uadRule: 'UAD-206'
      });
    }

    return errors;
  }

  /**
   * Validate Sales Comparison Approach
   */
  private validateSalesComparisonApproach(approach: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Must have at least 3 comparables
    if (!approach.comparables || approach.comparables.length < 3) {
      errors.push({
        fieldPath: 'salesComparisonApproach.comparables',
        errorCode: 'INSUFFICIENT_COMPARABLES',
        errorMessage: 'At least 3 comparables are required for Sales Comparison Approach',
        severity: 'ERROR',
        uadRule: 'UAD-300'
      });
      return errors; // Cannot validate further without comparables
    }

    // Validate each comparable
    approach.comparables.forEach((comp: UadComparable, index: number) => {
      errors.push(...this.validateComparable(comp, index + 1));
    });

    // Indicated Value must be present
    if (!approach.indicatedValueBySalesComparison || approach.indicatedValueBySalesComparison <= 0) {
      errors.push({
        fieldPath: 'salesComparisonApproach.indicatedValueBySalesComparison',
        errorCode: 'INDICATED_VALUE_REQUIRED',
        errorMessage: 'Indicated value by sales comparison must be present and positive',
        severity: 'ERROR',
        uadRule: 'UAD-301'
      });
    }

    return errors;
  }

  /**
   * Validate Individual Comparable
   */
  private validateComparable(comp: UadComparable, compNumber: number): UadValidationError[] {
    const errors: UadValidationError[] = [];
    const prefix = `salesComparisonApproach.comparables[${compNumber - 1}]`;

    // Required Fields
    const requiredFields = [
      'salePrice', 'saleDate', 'dataSource', 'grossLivingArea',
      'qualityRating', 'conditionRating', 'adjustedSalePrice'
    ];

    requiredFields.forEach(field => {
      if (!comp[field as keyof UadComparable]) {
        errors.push({
          fieldPath: `${prefix}.${field}`,
          errorCode: 'COMP_REQUIRED_FIELD_MISSING',
          errorMessage: `Comparable ${compNumber}: Required field '${field}' is missing`,
          severity: 'ERROR',
          uadRule: `UAD-${400 + compNumber}`
        });
      }
    });

    // Sale Price Validation
    if (comp.salePrice && comp.salePrice <= 0) {
      errors.push({
        fieldPath: `${prefix}.salePrice`,
        errorCode: 'COMP_SALE_PRICE_INVALID',
        errorMessage: `Comparable ${compNumber}: Sale price must be positive`,
        severity: 'ERROR',
        uadRule: `UAD-${410 + compNumber}`
      });
    }

    // Sale Date Validation (must be within last 12 months for most reports)
    if (comp.saleDate) {
      const saleDate = new Date(comp.saleDate);
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      if (saleDate < twelveMonthsAgo) {
        errors.push({
          fieldPath: `${prefix}.saleDate`,
          errorCode: 'COMP_SALE_DATE_OLD',
          errorMessage: `Comparable ${compNumber}: Sale date is older than 12 months`,
          severity: 'WARNING',
          uadRule: `UAD-${420 + compNumber}`
        });
      }

      if (saleDate > new Date()) {
        errors.push({
          fieldPath: `${prefix}.saleDate`,
          errorCode: 'COMP_SALE_DATE_FUTURE',
          errorMessage: `Comparable ${compNumber}: Sale date cannot be in the future`,
          severity: 'ERROR',
          uadRule: `UAD-${425 + compNumber}`
        });
      }
    }

    // Gross Living Area Comparison (should be within reasonable range of subject)
    // This is a soft check - warning only
    
    // Adjustments Validation
    if (comp.adjustments) {
      errors.push(...this.validateAdjustments(comp.adjustments, compNumber));
    }

    // Net vs Gross Adjustments
    if (comp.netAdjustment !== undefined && comp.grossAdjustment !== undefined) {
      if (Math.abs(comp.netAdjustment) > comp.grossAdjustment) {
        errors.push({
          fieldPath: `${prefix}.netAdjustment`,
          errorCode: 'ADJUSTMENTS_INCONSISTENT',
          errorMessage: `Comparable ${compNumber}: Net adjustment cannot exceed gross adjustment in absolute value`,
          severity: 'ERROR',
          uadRule: `UAD-${430 + compNumber}`
        });
      }
    }

    // Adjusted Sale Price Calculation
    if (comp.salePrice && comp.netAdjustment !== undefined && comp.adjustedSalePrice) {
      const calculatedAdjusted = comp.salePrice + comp.netAdjustment;
      const difference = Math.abs(calculatedAdjusted - comp.adjustedSalePrice);
      
      if (difference > 1) { // Allow $1 rounding difference
        errors.push({
          fieldPath: `${prefix}.adjustedSalePrice`,
          errorCode: 'ADJUSTED_PRICE_CALCULATION_ERROR',
          errorMessage: `Comparable ${compNumber}: Adjusted sale price calculation error. Expected ${calculatedAdjusted}, got ${comp.adjustedSalePrice}`,
          severity: 'ERROR',
          uadRule: `UAD-${440 + compNumber}`
        });
      }
    }

    // Gross Adjustment Percentage (warning if > 25%)
    if (comp.salePrice && comp.grossAdjustment) {
      const grossAdjustmentPercent = (comp.grossAdjustment / comp.salePrice) * 100;
      if (grossAdjustmentPercent > 25) {
        errors.push({
          fieldPath: `${prefix}.grossAdjustment`,
          errorCode: 'GROSS_ADJUSTMENT_HIGH',
          errorMessage: `Comparable ${compNumber}: Gross adjustment is ${grossAdjustmentPercent.toFixed(1)}% (>25% may require explanation)`,
          severity: 'WARNING',
          uadRule: `UAD-${450 + compNumber}`
        });
      }
    }

    return errors;
  }

  /**
   * Validate Adjustments
   */
  private validateAdjustments(adjustments: UadAdjustments, compNumber: number): UadValidationError[] {
    const errors: UadValidationError[] = [];
    const prefix = `salesComparisonApproach.comparables[${compNumber - 1}].adjustments`;

    // GLA adjustment is required
    if (adjustments.grossLivingArea === undefined) {
      errors.push({
        fieldPath: `${prefix}.grossLivingArea`,
        errorCode: 'GLA_ADJUSTMENT_REQUIRED',
        errorMessage: `Comparable ${compNumber}: Gross living area adjustment is required`,
        severity: 'ERROR',
        uadRule: `UAD-${500 + compNumber}`
      });
    }

    // Location adjustment is required
    if (adjustments.locationAdjustment === undefined) {
      errors.push({
        fieldPath: `${prefix}.locationAdjustment`,
        errorCode: 'LOCATION_ADJUSTMENT_REQUIRED',
        errorMessage: `Comparable ${compNumber}: Location adjustment is required (use 0 if no adjustment needed)`,
        severity: 'ERROR',
        uadRule: `UAD-${505 + compNumber}`
      });
    }

    // Date of sale adjustment is required
    if (adjustments.dateOfSale === undefined) {
      errors.push({
        fieldPath: `${prefix}.dateOfSale`,
        errorCode: 'DATE_ADJUSTMENT_REQUIRED',
        errorMessage: `Comparable ${compNumber}: Date of sale adjustment is required (use 0 if no adjustment needed)`,
        severity: 'ERROR',
        uadRule: `UAD-${510 + compNumber}`
      });
    }

    return errors;
  }

  /**
   * Validate Reconciliation
   */
  private validateReconciliation(reconciliation: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Final Opinion of Value is required
    if (!reconciliation.finalOpinionOfValue || reconciliation.finalOpinionOfValue <= 0) {
      errors.push({
        fieldPath: 'reconciliation.finalOpinionOfValue',
        errorCode: 'FINAL_VALUE_REQUIRED',
        errorMessage: 'Final opinion of value is required and must be positive',
        severity: 'ERROR',
        uadRule: 'UAD-600'
      });
    }

    // Effective Date is required
    if (!reconciliation.effectiveDate) {
      errors.push({
        fieldPath: 'reconciliation.effectiveDate',
        errorCode: 'EFFECTIVE_DATE_REQUIRED',
        errorMessage: 'Effective date of appraisal is required',
        severity: 'ERROR',
        uadRule: 'UAD-601'
      });
    }

    // At least one approach must be used
    if (!reconciliation.salesComparisonApproachUsed && 
        !reconciliation.costApproachUsed && 
        !reconciliation.incomeApproachUsed) {
      errors.push({
        fieldPath: 'reconciliation',
        errorCode: 'NO_APPROACH_USED',
        errorMessage: 'At least one valuation approach must be used',
        severity: 'ERROR',
        uadRule: 'UAD-602'
      });
    }

    // Subject property inspection flags
    if (reconciliation.subjectPropertyInspected === undefined) {
      errors.push({
        fieldPath: 'reconciliation.subjectPropertyInspected',
        errorCode: 'INSPECTION_FLAG_REQUIRED',
        errorMessage: 'Subject property inspection flag is required',
        severity: 'ERROR',
        uadRule: 'UAD-603'
      });
    }

    if (reconciliation.interiorInspected === undefined) {
      errors.push({
        fieldPath: 'reconciliation.interiorInspected',
        errorCode: 'INTERIOR_INSPECTION_FLAG_REQUIRED',
        errorMessage: 'Interior inspection flag is required',
        severity: 'ERROR',
        uadRule: 'UAD-604'
      });
    }

    return errors;
  }

  /**
   * Validate Appraiser Information
   */
  private validateAppraiserInfo(appraiserInfo: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Required Fields
    const requiredFields = [
      'name', 'companyName', 'telephoneNumber',
      'stateCertificationNumber', 'stateOfCertification',
      'certificationType', 'expirationDate'
    ];

    requiredFields.forEach(field => {
      if (!appraiserInfo[field]) {
        errors.push({
          fieldPath: `appraiserInfo.${field}`,
          errorCode: 'APPRAISER_FIELD_REQUIRED',
          errorMessage: `Appraiser ${field} is required`,
          severity: 'ERROR',
          uadRule: 'UAD-700'
        });
      }
    });

    // License Expiration Check
    if (appraiserInfo.expirationDate) {
      const expirationDate = new Date(appraiserInfo.expirationDate);
      const today = new Date();
      
      if (expirationDate < today) {
        errors.push({
          fieldPath: 'appraiserInfo.expirationDate',
          errorCode: 'LICENSE_EXPIRED',
          errorMessage: 'Appraiser license has expired',
          severity: 'ERROR',
          uadRule: 'UAD-701'
        });
      }
      
      // Warning if expiring within 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      if (expirationDate < thirtyDaysFromNow && expirationDate >= today) {
        errors.push({
          fieldPath: 'appraiserInfo.expirationDate',
          errorCode: 'LICENSE_EXPIRING_SOON',
          errorMessage: 'Appraiser license expires within 30 days',
          severity: 'WARNING',
          uadRule: 'UAD-702'
        });
      }
    }

    // Email Validation
    if (appraiserInfo.emailAddress) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(appraiserInfo.emailAddress)) {
        errors.push({
          fieldPath: 'appraiserInfo.emailAddress',
          errorCode: 'EMAIL_INVALID',
          errorMessage: 'Invalid email address format',
          severity: 'ERROR',
          uadRule: 'UAD-703'
        });
      }
    }

    // Phone Number Validation (10 digits)
    if (appraiserInfo.telephoneNumber) {
      const phoneDigits = appraiserInfo.telephoneNumber.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        errors.push({
          fieldPath: 'appraiserInfo.telephoneNumber',
          errorCode: 'PHONE_INVALID',
          errorMessage: 'Phone number must contain 10 digits',
          severity: 'WARNING',
          uadRule: 'UAD-704'
        });
      }
    }

    return errors;
  }

  /**
   * Validate Certification
   */
  private validateCertification(certification: any): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Required certifications (per USPAP)
    const requiredCertifications = [
      'personalInspectionOfSubjectProperty',
      'noCurrentOrProspectiveInterestInProperty',
      'noPersonalInterestOrBias',
      'feeNotContingentOnValueReported',
      'complianceWithUSPAP',
      'developedInAccordanceWithUSPAP'
    ];

    requiredCertifications.forEach(cert => {
      if (certification[cert] !== true) {
        errors.push({
          fieldPath: `certifications.${cert}`,
          errorCode: 'REQUIRED_CERTIFICATION_MISSING',
          errorMessage: `Required certification '${cert}' must be true`,
          severity: 'ERROR',
          uadRule: 'UAD-800'
        });
      }
    });

    // Property Inspection Date
    if (!certification.propertyInspectionDate) {
      errors.push({
        fieldPath: 'certifications.propertyInspectionDate',
        errorCode: 'INSPECTION_DATE_REQUIRED',
        errorMessage: 'Property inspection date is required in certification',
        severity: 'ERROR',
        uadRule: 'UAD-801'
      });
    }

    // Certification Date
    if (!certification.certificationDate) {
      errors.push({
        fieldPath: 'certifications.certificationDate',
        errorCode: 'CERTIFICATION_DATE_REQUIRED',
        errorMessage: 'Certification date is required',
        severity: 'ERROR',
        uadRule: 'UAD-802'
      });
    }

    return errors;
  }

  // =========================================================================
  // URAR v1.3 CANONICAL SECTION VALIDATION (UAD-900+)
  // =========================================================================

  /**
   * Validates the URAR v1.3 extended sections in a CanonicalReportDocument.
   * Returns an array of UAD validation errors; an empty array means no issues.
   */
  // ── UAD-100/200/500: Core canonical validation ────────────────────────────
  // These checks mirror the UAD 001-800 rules but operate directly on the
  // CanonicalReportDocument so they can be gated at finalization without
  // constructing a full UadAppraisalReport.

  private validateCanonicalCore(doc: CanonicalReportDocument): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // ── Subject Property (UAD-100) ───────────────────────────────────────────
    // Only run subject checks when `doc.subject` is present; an absent subject
    // section means the appraiser hasn't started it yet — handled by the
    // section-completion gate before we reach validateCanonicalSections.
    const subject = doc.subject;
    if (subject) {
      const addr = subject?.address;

    if (!addr?.streetAddress) {
      errors.push({ fieldPath: 'subject.address.streetAddress', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject street address is required", severity: 'ERROR', uadRule: 'UAD-100' });
    }
    if (!addr?.city) {
      errors.push({ fieldPath: 'subject.address.city', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject city is required", severity: 'ERROR', uadRule: 'UAD-100' });
    }
    if (!addr?.state) {
      errors.push({ fieldPath: 'subject.address.state', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject state is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else if (!/^[A-Z]{2}$/.test(addr.state)) {
      errors.push({ fieldPath: 'subject.address.state', errorCode: 'STATE_CODE_INVALID', errorMessage: `Subject state must be a 2-letter code, received: ${addr.state}`, severity: 'ERROR', uadRule: 'UAD-101' });
    }
    if (!addr?.zipCode) {
      errors.push({ fieldPath: 'subject.address.zipCode', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject zip code is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else if (!/^\d{5}(-\d{4})?$/.test(addr.zipCode)) {
      errors.push({ fieldPath: 'subject.address.zipCode', errorCode: 'ZIP_CODE_INVALID', errorMessage: `Subject zip code must be 5 or 9 digits, received: ${addr.zipCode}`, severity: 'ERROR', uadRule: 'UAD-102' });
    }
    if (!subject?.propertyType) {
      errors.push({ fieldPath: 'subject.propertyType', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject property type is required", severity: 'ERROR', uadRule: 'UAD-100' });
    }
    if (!subject?.condition) {
      errors.push({ fieldPath: 'subject.condition', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject condition rating (C1-C6) is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else if (!/^C[1-6]$/.test(subject.condition)) {
      errors.push({ fieldPath: 'subject.condition', errorCode: 'CONDITION_RATING_INVALID', errorMessage: `Subject condition rating must be C1-C6, received: ${subject.condition}`, severity: 'ERROR', uadRule: 'UAD-104' });
    }
    if (!subject?.quality) {
      errors.push({ fieldPath: 'subject.quality', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject quality rating (Q1-Q6) is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else if (!/^Q[1-6]$/.test(subject.quality)) {
      errors.push({ fieldPath: 'subject.quality', errorCode: 'QUALITY_RATING_INVALID', errorMessage: `Subject quality rating must be Q1-Q6, received: ${subject.quality}`, severity: 'ERROR', uadRule: 'UAD-103' });
    }
    if (!subject?.yearBuilt) {
      errors.push({ fieldPath: 'subject.yearBuilt', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject year built is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else {
      const currentYear = new Date().getFullYear();
      if (subject.yearBuilt < 1600 || subject.yearBuilt > currentYear + 1) {
        errors.push({ fieldPath: 'subject.yearBuilt', errorCode: 'YEAR_BUILT_INVALID', errorMessage: `Subject year built ${subject.yearBuilt} is out of range (1600–${currentYear + 1})`, severity: 'ERROR', uadRule: 'UAD-105' });
      }
    }
    if (!subject?.grossLivingArea) {
      errors.push({ fieldPath: 'subject.grossLivingArea', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Subject gross living area is required", severity: 'ERROR', uadRule: 'UAD-100' });
    } else if (subject.grossLivingArea < 100 || subject.grossLivingArea > 50000) {
      errors.push({ fieldPath: 'subject.grossLivingArea', errorCode: 'GLA_OUT_OF_RANGE', errorMessage: `Subject GLA ${subject.grossLivingArea} sf is outside expected range (100–50000)`, severity: 'WARNING', uadRule: 'UAD-106' });
    }
    } // end if (subject)

    // ── Comparables (UAD-200) ────────────────────────────────────────────────
    // Only validate when comps section has been started (undefined = not yet touched)
    if (doc.comps !== undefined) {
      const selectedComps = (doc.comps ?? []).filter(c => c.selected);
      if (selectedComps.length === 0) {
        errors.push({ fieldPath: 'comps', errorCode: 'NO_COMPARABLES', errorMessage: "At least one comparable sale is required", severity: 'ERROR', uadRule: 'UAD-200' });
      }
      selectedComps.forEach((comp, i) => {
        if (!comp.salePrice) {
          errors.push({ fieldPath: `comps[${i}].salePrice`, errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: `Comp ${i + 1}: sale price is required`, severity: 'ERROR', uadRule: 'UAD-201' });
        }
        if (!comp.saleDate) {
          errors.push({ fieldPath: `comps[${i}].saleDate`, errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: `Comp ${i + 1}: sale date is required`, severity: 'ERROR', uadRule: 'UAD-202' });
        }
        if (!comp.grossLivingArea) {
          errors.push({ fieldPath: `comps[${i}].grossLivingArea`, errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: `Comp ${i + 1}: gross living area is required`, severity: 'ERROR', uadRule: 'UAD-203' });
        }
        if (!comp.address?.streetAddress) {
          errors.push({ fieldPath: `comps[${i}].address.streetAddress`, errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: `Comp ${i + 1}: address is required`, severity: 'ERROR', uadRule: 'UAD-204' });
        }
      });
    }

    // ── Reconciliation / Valuation (UAD-500) ─────────────────────────────────
    // Only validate when valuation section has been explicitly set
    if (doc.valuation !== undefined) {
      if (!doc.valuation) {
        errors.push({ fieldPath: 'valuation', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Valuation (reconciliation) is required to finalize", severity: 'ERROR', uadRule: 'UAD-500' });
      } else {
        if (!doc.valuation.estimatedValue || doc.valuation.estimatedValue <= 0) {
          errors.push({ fieldPath: 'valuation.estimatedValue', errorCode: 'VALUE_INVALID', errorMessage: `Estimated value must be a positive number, received: ${doc.valuation.estimatedValue}`, severity: 'ERROR', uadRule: 'UAD-501' });
        }
        if (!doc.valuation.effectiveDate) {
          errors.push({ fieldPath: 'valuation.effectiveDate', errorCode: 'REQUIRED_FIELD_MISSING', errorMessage: "Effective date of value is required", severity: 'ERROR', uadRule: 'UAD-502' });
        }
      }
    }

    return errors;
  }

  validateCanonicalSections(doc: CanonicalReportDocument): UadValidationError[] {
    const errors: UadValidationError[] = [];

    // Core UAD-100/200/500 content checks on the canonical subject, comps, and valuation
    errors.push(...this.validateCanonicalCore(doc));

    if (doc.disasterMitigation) {
      errors.push(...this.validateDisasterMitigation(doc.disasterMitigation.items));
    }
    if (doc.energyEfficiency) {
      errors.push(...this.validateEnergyEfficiency(doc.energyEfficiency.features));
    }
    if (doc.functionalObsolescence) {
      errors.push(...this.validateFunctionalObsolescence(doc.functionalObsolescence));
    }
    if (doc.vehicleStorage) {
      errors.push(...this.validateVehicleStorage(doc.vehicleStorage));
    }
    if (doc.outbuildings) {
      errors.push(...this.validateOutbuildings(doc.outbuildings));
    }
    if (doc.amenities) {
      errors.push(...this.validateAmenities(doc.amenities));
    }
    if (doc.overallQualityCondition) {
      errors.push(...this.validateOverallQualityCondition(doc.overallQualityCondition));
    }
    if (doc.analyzedPropertiesNotUsed) {
      errors.push(...this.validateAnalyzedPropertiesNotUsed(doc.analyzedPropertiesNotUsed));
    }
    if (doc.priorTransfers) {
      errors.push(...this.validatePriorTransfers(doc.priorTransfers));
    }
    if (doc.revisionHistory) {
      errors.push(...this.validateRevisionHistory(doc.revisionHistory));
    }
    if (doc.reconsiderationOfValue) {
      errors.push(...this.validateReconsiderationOfValue(doc.reconsiderationOfValue));
    }
    if (doc.assignmentConditions) {
      errors.push(...this.validateAssignmentConditions(doc.assignmentConditions));
    }

    return errors;
  }

  // ── UAD-900: Disaster Mitigation ────────────────────────────────────────────

  private readonly VALID_DISASTER_CATEGORIES = new Set([
    'Flood', 'Wildfire', 'Wind', 'Earthquake', 'Hail', 'Tornado', 'Hurricane', 'Other'
  ]);

  private validateDisasterMitigation(items: CanonicalDisasterMitigationItem[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.disasterCategory) {
        errors.push({
          fieldPath: `disasterMitigation.items[${i}].disasterCategory`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Disaster mitigation item [${i}]: disasterCategory is required`,
          severity: 'ERROR',
          uadRule: 'UAD-901'
        });
      } else if (!this.VALID_DISASTER_CATEGORIES.has(item.disasterCategory)) {
        errors.push({
          fieldPath: `disasterMitigation.items[${i}].disasterCategory`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Disaster mitigation item [${i}]: disasterCategory "${item.disasterCategory}" is not a recognised value`,
          severity: 'ERROR',
          uadRule: 'UAD-902'
        });
      }
      if (!item.mitigationFeature) {
        errors.push({
          fieldPath: `disasterMitigation.items[${i}].mitigationFeature`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Disaster mitigation item [${i}]: mitigationFeature is required`,
          severity: 'ERROR',
          uadRule: 'UAD-903'
        });
      }
    });
    return errors;
  }

  // ── UAD-910: Energy Efficiency ───────────────────────────────────────────────

  private readonly VALID_IMPACT_VALUES = new Set(['Beneficial', 'Neutral', 'Adverse']);
  private readonly VALID_BUILDING_CERTIFICATIONS = new Set([
    'LEED', 'Energy Star', 'HERS', 'Green Globes', 'NGBS', 'Passive House', 'ZERH', 'Other'
  ]);

  private validateEnergyEfficiency(features: CanonicalEnergyFeature[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    features.forEach((feat, i) => {
      if (!feat.feature) {
        errors.push({
          fieldPath: `energyEfficiency.features[${i}].feature`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Energy efficiency feature [${i}]: feature name is required`,
          severity: 'ERROR',
          uadRule: 'UAD-911'
        });
      }
      if (feat.impact && !this.VALID_IMPACT_VALUES.has(feat.impact)) {
        errors.push({
          fieldPath: `energyEfficiency.features[${i}].impact`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Energy efficiency feature [${i}]: impact "${feat.impact}" must be Beneficial, Neutral, or Adverse`,
          severity: 'ERROR',
          uadRule: 'UAD-912'
        });
      }
    });
    return errors;
  }

  // ── UAD-920: Functional Obsolescence ────────────────────────────────────────

  private validateFunctionalObsolescence(items: CanonicalFunctionalObsolescenceItem[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.feature) {
        errors.push({
          fieldPath: `functionalObsolescence[${i}].feature`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Functional obsolescence item [${i}]: feature is required`,
          severity: 'ERROR',
          uadRule: 'UAD-921'
        });
      }
    });
    return errors;
  }

  // ── UAD-930: Vehicle Storage ─────────────────────────────────────────────────

  private readonly VALID_VEHICLE_STORAGE_TYPES = new Set([
    'Attached Garage', 'Detached Garage', 'Built-In Garage', 'Carport', 'None'
  ]);

  private validateVehicleStorage(items: CanonicalVehicleStorage[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.type) {
        errors.push({
          fieldPath: `vehicleStorage[${i}].type`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Vehicle storage item [${i}]: type is required`,
          severity: 'ERROR',
          uadRule: 'UAD-931'
        });
      } else if (!this.VALID_VEHICLE_STORAGE_TYPES.has(item.type)) {
        errors.push({
          fieldPath: `vehicleStorage[${i}].type`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Vehicle storage item [${i}]: type "${item.type}" must be one of: ${[...this.VALID_VEHICLE_STORAGE_TYPES].join(', ')}`,
          severity: 'ERROR',
          uadRule: 'UAD-932'
        });
      }
      if (item.spaces !== null && item.spaces !== undefined && item.spaces < 0) {
        errors.push({
          fieldPath: `vehicleStorage[${i}].spaces`,
          errorCode: 'VALUE_OUT_OF_RANGE',
          errorMessage: `Vehicle storage item [${i}]: spaces cannot be negative, received ${item.spaces}`,
          severity: 'ERROR',
          uadRule: 'UAD-933'
        });
      }
    });
    return errors;
  }

  // ── UAD-940: Outbuildings ────────────────────────────────────────────────────

  private validateOutbuildings(items: CanonicalOutbuilding[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.type) {
        errors.push({
          fieldPath: `outbuildings[${i}].type`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Outbuilding item [${i}]: type is required`,
          severity: 'ERROR',
          uadRule: 'UAD-941'
        });
      }
      if (item.gba !== null && item.gba !== undefined && item.gba <= 0) {
        errors.push({
          fieldPath: `outbuildings[${i}].gba`,
          errorCode: 'VALUE_OUT_OF_RANGE',
          errorMessage: `Outbuilding item [${i}]: gba must be greater than 0, received ${item.gba}`,
          severity: 'ERROR',
          uadRule: 'UAD-942'
        });
      }
    });
    return errors;
  }

  // ── UAD-950: Amenities ───────────────────────────────────────────────────────

  private readonly VALID_AMENITY_CATEGORIES = new Set([
    'Outdoor Accessories', 'Outdoor Living', 'Water Features', 'Whole Home', 'Miscellaneous'
  ]);

  private validateAmenities(items: CanonicalPropertyAmenity[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.category) {
        errors.push({
          fieldPath: `amenities[${i}].category`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Amenity item [${i}]: category is required`,
          severity: 'ERROR',
          uadRule: 'UAD-951'
        });
      } else if (!this.VALID_AMENITY_CATEGORIES.has(item.category)) {
        errors.push({
          fieldPath: `amenities[${i}].category`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Amenity item [${i}]: category "${item.category}" must be one of: ${[...this.VALID_AMENITY_CATEGORIES].join(', ')}`,
          severity: 'ERROR',
          uadRule: 'UAD-952'
        });
      }
      if (!item.feature) {
        errors.push({
          fieldPath: `amenities[${i}].feature`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Amenity item [${i}]: feature is required`,
          severity: 'ERROR',
          uadRule: 'UAD-953'
        });
      }
      if (item.impact && !this.VALID_IMPACT_VALUES.has(item.impact)) {
        errors.push({
          fieldPath: `amenities[${i}].impact`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Amenity item [${i}]: impact "${item.impact}" must be Beneficial, Neutral, or Adverse`,
          severity: 'ERROR',
          uadRule: 'UAD-954'
        });
      }
    });
    return errors;
  }

  // ── UAD-960: Overall Quality & Condition ────────────────────────────────────

  private readonly VALID_QUALITY_RATINGS = new Set(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  private readonly VALID_CONDITION_RATINGS = new Set(['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);

  private validateOverallQualityCondition(data: CanonicalOverallQualityCondition): UadValidationError[] {
    const errors: UadValidationError[] = [];
    if (data.overallQuality && !this.VALID_QUALITY_RATINGS.has(data.overallQuality)) {
      errors.push({
        fieldPath: 'overallQualityCondition.overallQuality',
        errorCode: 'ENUM_VALUE_INVALID',
        errorMessage: `Overall quality rating "${data.overallQuality}" must be Q1-Q6`,
        severity: 'ERROR',
        uadRule: 'UAD-961'
      });
    }
    if (data.overallCondition && !this.VALID_CONDITION_RATINGS.has(data.overallCondition)) {
      errors.push({
        fieldPath: 'overallQualityCondition.overallCondition',
        errorCode: 'ENUM_VALUE_INVALID',
        errorMessage: `Overall condition rating "${data.overallCondition}" must be C1-C6`,
        severity: 'ERROR',
        uadRule: 'UAD-962'
      });
    }
    [...data.exteriorFeatures, ...data.interiorFeatures].forEach((feat, i) => {
      if (feat.quality && !this.VALID_QUALITY_RATINGS.has(feat.quality)) {
        errors.push({
          fieldPath: `overallQualityCondition.features[${i}].quality`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Feature "${feat.feature}" quality rating "${feat.quality}" must be Q1-Q6`,
          severity: 'ERROR',
          uadRule: 'UAD-963'
        });
      }
      if (feat.condition && !this.VALID_CONDITION_RATINGS.has(feat.condition)) {
        errors.push({
          fieldPath: `overallQualityCondition.features[${i}].condition`,
          errorCode: 'ENUM_VALUE_INVALID',
          errorMessage: `Feature "${feat.feature}" condition rating "${feat.condition}" must be C1-C6`,
          severity: 'ERROR',
          uadRule: 'UAD-964'
        });
      }
    });
    return errors;
  }

  // ── UAD-970: Analyzed Properties Not Used ───────────────────────────────────

  private validateAnalyzedPropertiesNotUsed(items: CanonicalAnalyzedPropertyNotUsed[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.address) {
        errors.push({
          fieldPath: `analyzedPropertiesNotUsed[${i}].address`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Analyzed property not used [${i}]: address is required`,
          severity: 'ERROR',
          uadRule: 'UAD-971'
        });
      }
      if (!item.reasonNotUsed) {
        errors.push({
          fieldPath: `analyzedPropertiesNotUsed[${i}].reasonNotUsed`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Analyzed property not used [${i}]: reasonNotUsed is required`,
          severity: 'ERROR',
          uadRule: 'UAD-972'
        });
      }
    });
    return errors;
  }

  // ── UAD-980: Prior Transfers ─────────────────────────────────────────────────

  private validatePriorTransfers(items: CanonicalPriorTransfer[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (item.salePrice !== null && item.salePrice !== undefined && item.salePrice <= 0) {
        errors.push({
          fieldPath: `priorTransfers[${i}].salePrice`,
          errorCode: 'VALUE_OUT_OF_RANGE',
          errorMessage: `Prior transfer [${i}]: salePrice must be greater than 0, received ${item.salePrice}`,
          severity: 'ERROR',
          uadRule: 'UAD-981'
        });
      }
      if (item.transactionDate && isNaN(Date.parse(item.transactionDate))) {
        errors.push({
          fieldPath: `priorTransfers[${i}].transactionDate`,
          errorCode: 'DATE_INVALID',
          errorMessage: `Prior transfer [${i}]: transactionDate "${item.transactionDate}" is not a valid date`,
          severity: 'ERROR',
          uadRule: 'UAD-982'
        });
      }
    });
    return errors;
  }

  // ── UAD-990: Revision History ────────────────────────────────────────────────

  private validateRevisionHistory(items: CanonicalRevisionEntry[]): UadValidationError[] {
    const errors: UadValidationError[] = [];
    items.forEach((item, i) => {
      if (!item.revisionDate) {
        errors.push({
          fieldPath: `revisionHistory[${i}].revisionDate`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Revision history entry [${i}]: revisionDate is required`,
          severity: 'ERROR',
          uadRule: 'UAD-991'
        });
      } else if (isNaN(Date.parse(item.revisionDate))) {
        errors.push({
          fieldPath: `revisionHistory[${i}].revisionDate`,
          errorCode: 'DATE_INVALID',
          errorMessage: `Revision history entry [${i}]: revisionDate "${item.revisionDate}" is not a valid date`,
          severity: 'ERROR',
          uadRule: 'UAD-992'
        });
      }
      if (!item.description) {
        errors.push({
          fieldPath: `revisionHistory[${i}].description`,
          errorCode: 'REQUIRED_FIELD_MISSING',
          errorMessage: `Revision history entry [${i}]: description is required`,
          severity: 'ERROR',
          uadRule: 'UAD-993'
        });
      }
    });
    return errors;
  }

  // ── UAD-994: Reconsideration of Value ───────────────────────────────────────

  private validateReconsiderationOfValue(data: CanonicalReconsiderationOfValue): UadValidationError[] {
    const errors: UadValidationError[] = [];
    if (!data.type) {
      errors.push({
        fieldPath: 'reconsiderationOfValue.type',
        errorCode: 'REQUIRED_FIELD_MISSING',
        errorMessage: 'Reconsideration of value: type is required',
        severity: 'ERROR',
        uadRule: 'UAD-995'
      });
    }
    if (!data.date) {
      errors.push({
        fieldPath: 'reconsiderationOfValue.date',
        errorCode: 'REQUIRED_FIELD_MISSING',
        errorMessage: 'Reconsideration of value: date is required',
        severity: 'ERROR',
        uadRule: 'UAD-996'
      });
    } else if (isNaN(Date.parse(data.date))) {
      errors.push({
        fieldPath: 'reconsiderationOfValue.date',
        errorCode: 'DATE_INVALID',
        errorMessage: `Reconsideration of value: date "${data.date}" is not a valid date`,
        severity: 'ERROR',
        uadRule: 'UAD-997'
      });
    }
    if (!data.result) {
      errors.push({
        fieldPath: 'reconsiderationOfValue.result',
        errorCode: 'REQUIRED_FIELD_MISSING',
        errorMessage: 'Reconsideration of value: result is required',
        severity: 'ERROR',
        uadRule: 'UAD-998'
      });
    }
    return errors;
  }

  // ── UAD-999: Assignment Conditions ──────────────────────────────────────────

  private validateAssignmentConditions(data: CanonicalAssignmentConditions): UadValidationError[] {
    const errors: UadValidationError[] = [];
    if (!data.intendedUse) {
      errors.push({
        fieldPath: 'assignmentConditions.intendedUse',
        errorCode: 'REQUIRED_FIELD_MISSING',
        errorMessage: 'Assignment conditions: intendedUse is required',
        severity: 'ERROR',
        uadRule: 'UAD-999'
      });
    }
    if (!data.marketValueDefinition) {
      errors.push({
        fieldPath: 'assignmentConditions.marketValueDefinition',
        errorCode: 'RECOMMENDED_FIELD_MISSING',
        errorMessage: 'Assignment conditions: marketValueDefinition is recommended for USPAP compliance',
        severity: 'WARNING',
        uadRule: 'UAD-999W'
      });
    }
    return errors;
  }

  /**
   * Quick validation - checks only critical UAD requirements
   */
  async quickValidate(report: UadAppraisalReport): Promise<boolean> {
    const result = await this.validateAppraisalReport(report);
    return result.isValid;
  }

  /**
   * Get validation summary
   */
  getValidationSummary(result: UadValidationResult): string {
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    
    if (result.isValid) {
      return `✓ UAD 3.6 Validation Passed (${warningCount} warnings)`;
    } else {
      return `✗ UAD 3.6 Validation Failed (${errorCount} errors, ${warningCount} warnings)`;
    }
  }
}

export default UadValidationService;
