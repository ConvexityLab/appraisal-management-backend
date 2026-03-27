import { CanonicalReportDocument } from '../../types/canonical-schema';

export interface MopAppraisalFactPayload {
  program: string;
  net_adjustment_pct: number;
  gross_adjustment_pct: number;
  property_condition: string;
  zoning: string;
  has_effective_date: boolean;
  has_license_number: boolean;
}

export class MopMapperService {
  /**
   * Transforms a CanonicalReportDocument into a flat JSON dictionary
   * of facts required by the MOP rules engine.
   */
  public mapAppraisalToMopFacts(appraisal: CanonicalReportDocument): MopAppraisalFactPayload {
    const subject = appraisal.subject;
    const comps = appraisal.comps || [];

    // Calculate max adjustments
    let maxNetAdjPct = 0;
    let maxGrossAdjPct = 0;

    comps.forEach(comp => {
      const netPct = comp.adjustments?.netAdjustmentPct ?? 0;
      const grossPct = comp.adjustments?.grossAdjustmentPct ?? 0;
      if (netPct > maxNetAdjPct) {
        maxNetAdjPct = netPct;
      }
      if (grossPct > maxGrossAdjPct) {
        maxGrossAdjPct = grossPct;
      }
    });

    const hasEffectiveDate = !!appraisal.metadata?.effectiveDate;
    const hasLicenseNumber = !!appraisal.appraiserInfo?.licenseNumber;

    return {
      program: 'appraisal-compliance',
      net_adjustment_pct: maxNetAdjPct,
      gross_adjustment_pct: maxGrossAdjPct,
      property_condition: subject?.condition || 'Unknown',
      zoning: subject?.zoning || 'Unknown',
      has_effective_date: hasEffectiveDate,
      has_license_number: hasLicenseNumber
    };
  }
}
