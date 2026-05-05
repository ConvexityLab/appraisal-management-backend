import { Appraiser, AppraiserSpecialty } from '../../types/appraiser.types.js';
import { LegacyManagementOrder, OrderType } from '../../types/order-management.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('CompetencyVerificationService');

export interface CompetencyResult {
  isEligible: boolean;
  missingCompetencies: string[];
}

export class CompetencyVerificationService {
  /**
   * Evaluates if a given appraiser possesses the correct licensing and specialized
   * competencies to legally and accurately fulfill the given LegacyManagementOrder.
   */
  public evaluateVendorCompetency(appraiser: Appraiser, order: LegacyManagementOrder): CompetencyResult {
    logger.info(`Evaluating competency: Appraiser ${appraiser.id} vs Order ${order.id}`);
    
    const missing: string[] = [];

    // 1. FHA Loan Checks
    if (order.clientInformation?.loanType === 'FHA') {
      const isFhaApproved = appraiser.specialties.includes('fha');
      if (!isFhaApproved) {
        missing.push('FHA_CERTIFICATION_REQUIRED');
      }
    }

    // 2. VA Loan Checks
    if (order.clientInformation?.loanType === 'VA') {
      const isVaApproved = appraiser.specialties.includes('va');
      if (!isVaApproved) {
        missing.push('VA_CERTIFICATION_REQUIRED');
      }
    }

    // 3. Property Type Requirements
    const isCommercial = order.propertyDetails?.propertyType === 'COMMERCIAL';
    const isMultiFamily = order.propertyDetails?.propertyType === 'MULTI_FAMILY';
    const isLand = order.propertyDetails?.propertyType === 'LAND';

    if (isCommercial) {
      if (!appraiser.specialties.includes('commercial')) {
        missing.push('COMMERCIAL_EXPERIENCE_REQUIRED');
      }
      
      const hasGeneralLicense = appraiser.licenses.some(l => 
        l.type === 'certified_general' && l.status === 'active'
      );
      if (!hasGeneralLicense) {
        missing.push('CERTIFIED_GENERAL_LICENSE_REQUIRED');
      }
    }

    if (isMultiFamily && !appraiser.specialties.includes('multi_family')) {
        missing.push('MULTI_FAMILY_EXPERIENCE_REQUIRED');
    }

    if (isLand && !appraiser.specialties.includes('land')) {
        missing.push('LAND_EXPERIENCE_REQUIRED');
    }

    // 4. Complex Property / Jumbo Value Checks
    const estimatedValue = order.propertyDetails?.estimatedValue || 0;
    const isComplex = order.tags?.includes('COMPLEX_PROPERTY') || estimatedValue > 1000000;

    if (isComplex) {
      const isCertified = appraiser.licenses.some(l => 
        (l.type === 'certified_residential' || l.type === 'certified_general') && 
        l.status === 'active'
      );

      if (!isCertified) {
        missing.push('CERTIFIED_APPRAISER_REQUIRED_FOR_COMPLEX_OR_HIGH_VALUE');
      }

      if (estimatedValue > 2000000 && !appraiser.specialties.includes('luxury')) {
        missing.push('LUXURY_EXPERIENCE_REQUIRED');
      }
    }

    // 5. BPO Specific (Often requires broker license, but for MVP we just verify any active license)
    if (order.orderType === OrderType.BPO) {
      const hasActiveLicense = appraiser.licenses.some(l => l.status === 'active');
      if (!hasActiveLicense) {
        missing.push('ACTIVE_LICENSE_REQUIRED_FOR_BPO');
      }
    }

    return {
      isEligible: missing.length === 0,
      missingCompetencies: missing
    };
  }

  /**
   * Filters a batch of appraisers, returning only the fully eligible subset
   */
  public filterEligibleVendors(appraisers: Appraiser[], order: LegacyManagementOrder): Appraiser[] {
    return appraisers.filter(appraiser => {
      const result = this.evaluateVendorCompetency(appraiser, order);
      if (!result.isEligible) {
        logger.debug(`Vendor ${appraiser.id} excluded: ${result.missingCompetencies.join(', ')}`);
      }
      return result.isEligible;
    });
  }
}
