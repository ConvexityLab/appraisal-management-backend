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
  UadAdjustments
} from '../types/uad-3.6.js';
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
