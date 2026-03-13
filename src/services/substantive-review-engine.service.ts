/**
 * Substantive Review Engine — Phase 2 Aggregate Service
 *
 * Orchestrates all 12 Phase 2 review services against an appraisal report,
 * running them in parallel and producing a unified result that can feed
 * into the QualityControlEngine.
 */

import { Logger } from '../utils/logger.js';
import { AppraisalReportData } from './quality-control-engine.service.js';

// Phase 2 service imports
import { BiasScreeningService, type BiasScreeningInput, type BiasScreeningReport } from './bias-screening.service.js';
import { ScopeLockValidationService, type ScopeLockInput, type ScopeLockReport } from './scope-lock-validation.service.js';
import { ContractReviewService, type ContractReviewInput, type ContractReviewReport } from './contract-review.service.js';
import { MarketAnalyticsService, type MarketAnalyticsInput, type MarketAnalyticsReport } from './market-analytics.service.js';
import { ZoningSiteReviewService, type ZoningSiteReviewInput, type ZoningSiteReport } from './zoning-site-review.service.js';
import { ImprovementsReviewService, type ImprovementsReviewInput, type ImprovementsReport } from './improvements-review.service.js';
import { CostApproachReviewService, type CostApproachReviewInput, type CostReviewReport } from './cost-approach-review.service.js';
import { IncomeApproachReviewService, type IncomeApproachReviewInput, type IncomeReviewReport } from './income-approach-review.service.js';
import { ReconciliationReviewService, type ReconciliationReviewInput, type ReconciliationReport } from './reconciliation-review.service.js';
import { MathIntegrityService, type MathIntegrityInput, type MathIntegrityReport } from './math-integrity.service.js';
import { EnhancedFraudDetectionService, type EnhancedFraudInput, type EnhancedFraudReport } from './enhanced-fraud-detection.service.js';
import { ReportComplianceService, type ReportComplianceInput, type ReportComplianceReport } from './report-compliance.service.js';

// ── Public types ────────────────────────────────────────────────────────

export type ReviewType =
  | 'bias-screening'
  | 'scope-lock'
  | 'contract-review'
  | 'market-analytics'
  | 'zoning-site'
  | 'improvements'
  | 'cost-approach'
  | 'income-approach'
  | 'reconciliation'
  | 'math-integrity'
  | 'enhanced-fraud'
  | 'report-compliance';

export interface SingleReviewResult {
  reviewType: ReviewType;
  status: 'pass' | 'fail' | 'warnings' | 'not-applicable' | 'error';
  report: ServiceReport | null;
  errorMessage?: string;
}

/** Union of all Phase 2 report types — they share the same shape */
export type ServiceReport =
  | BiasScreeningReport
  | ScopeLockReport
  | ContractReviewReport
  | MarketAnalyticsReport
  | ZoningSiteReport
  | ImprovementsReport
  | CostReviewReport
  | IncomeReviewReport
  | ReconciliationReport
  | MathIntegrityReport
  | EnhancedFraudReport
  | ReportComplianceReport;

export interface SubstantiveReviewResult {
  orderId: string;
  timestamp: Date;
  overallScore: number;
  overallStatus: 'pass' | 'fail' | 'warnings';
  totalChecks: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  reviews: SingleReviewResult[];
}

// ── Service class ───────────────────────────────────────────────────────

export class SubstantiveReviewEngine {
  private readonly logger: Logger;

  // Lazy-initialised service instances
  private readonly biasScreening = new BiasScreeningService();
  private readonly scopeLock = new ScopeLockValidationService();
  private readonly contractReview = new ContractReviewService();
  private readonly marketAnalytics = new MarketAnalyticsService();
  private readonly zoningSite = new ZoningSiteReviewService();
  private readonly improvements = new ImprovementsReviewService();
  private readonly costApproach = new CostApproachReviewService();
  private readonly incomeApproach = new IncomeApproachReviewService();
  private readonly reconciliation = new ReconciliationReviewService();
  private readonly mathIntegrity = new MathIntegrityService();
  private readonly enhancedFraud = new EnhancedFraudDetectionService();
  private readonly reportCompliance = new ReportComplianceService();

  constructor() {
    this.logger = new Logger();
  }

  // ── Main entry point ────────────────────────────────────────────────

  /**
   * Run all 12 Phase 2 review services in parallel and return a unified result.
   */
  async performFullReview(
    orderId: string,
    reportData: AppraisalReportData
  ): Promise<SubstantiveReviewResult> {
    this.logger.info('Starting substantive review', { orderId });

    const reviews = await Promise.all([
      this.runSafe('bias-screening', () =>
        this.biasScreening.performScreening(orderId, this.mapBiasInput(reportData))),
      this.runSafe('scope-lock', () =>
        this.scopeLock.performValidation(orderId, this.mapScopeLockInput(reportData))),
      this.runSafe('contract-review', () =>
        this.contractReview.performReview(orderId, this.mapContractInput(reportData))),
      this.runSafe('market-analytics', () =>
        this.marketAnalytics.performValidation(orderId, this.mapMarketInput(reportData))),
      this.runSafe('zoning-site', () =>
        this.zoningSite.performReview(orderId, this.mapZoningSiteInput(reportData))),
      this.runSafe('improvements', () =>
        this.improvements.performReview(orderId, this.mapImprovementsInput(reportData))),
      this.runSafe('cost-approach', () =>
        this.costApproach.performReview(orderId, this.mapCostApproachInput(reportData))),
      this.runSafe('income-approach', () =>
        this.incomeApproach.performReview(orderId, this.mapIncomeApproachInput(reportData))),
      this.runSafe('reconciliation', () =>
        this.reconciliation.performReview(orderId, this.mapReconciliationInput(reportData))),
      this.runSafe('math-integrity', () =>
        this.mathIntegrity.performValidation(orderId, this.mapMathIntegrityInput(reportData))),
      this.runSafe('enhanced-fraud', () =>
        this.enhancedFraud.performReview(orderId, this.mapEnhancedFraudInput(reportData))),
      this.runSafe('report-compliance', () =>
        this.reportCompliance.performReview(orderId, this.mapReportComplianceInput(reportData))),
    ]);

    const result = this.synthesize(orderId, reviews);

    this.logger.info('Substantive review completed', {
      orderId,
      overallScore: result.overallScore,
      overallStatus: result.overallStatus,
      totalIssues: result.totalIssues,
    });

    return result;
  }

  /**
   * Run a single named review service.
   */
  async performSingleReview(
    orderId: string,
    reviewType: ReviewType,
    reportData: AppraisalReportData
  ): Promise<SingleReviewResult> {
    return this.dispatchSingle(orderId, reviewType, reportData);
  }

  // ── Dispatch ────────────────────────────────────────────────────────

  private async dispatchSingle(
    orderId: string,
    reviewType: ReviewType,
    reportData: AppraisalReportData
  ): Promise<SingleReviewResult> {
    switch (reviewType) {
      case 'bias-screening':
        return this.runSafe(reviewType, () =>
          this.biasScreening.performScreening(orderId, this.mapBiasInput(reportData)));
      case 'scope-lock':
        return this.runSafe(reviewType, () =>
          this.scopeLock.performValidation(orderId, this.mapScopeLockInput(reportData)));
      case 'contract-review':
        return this.runSafe(reviewType, () =>
          this.contractReview.performReview(orderId, this.mapContractInput(reportData)));
      case 'market-analytics':
        return this.runSafe(reviewType, () =>
          this.marketAnalytics.performValidation(orderId, this.mapMarketInput(reportData)));
      case 'zoning-site':
        return this.runSafe(reviewType, () =>
          this.zoningSite.performReview(orderId, this.mapZoningSiteInput(reportData)));
      case 'improvements':
        return this.runSafe(reviewType, () =>
          this.improvements.performReview(orderId, this.mapImprovementsInput(reportData)));
      case 'cost-approach':
        return this.runSafe(reviewType, () =>
          this.costApproach.performReview(orderId, this.mapCostApproachInput(reportData)));
      case 'income-approach':
        return this.runSafe(reviewType, () =>
          this.incomeApproach.performReview(orderId, this.mapIncomeApproachInput(reportData)));
      case 'reconciliation':
        return this.runSafe(reviewType, () =>
          this.reconciliation.performReview(orderId, this.mapReconciliationInput(reportData)));
      case 'math-integrity':
        return this.runSafe(reviewType, () =>
          this.mathIntegrity.performValidation(orderId, this.mapMathIntegrityInput(reportData)));
      case 'enhanced-fraud':
        return this.runSafe(reviewType, () =>
          this.enhancedFraud.performReview(orderId, this.mapEnhancedFraudInput(reportData)));
      case 'report-compliance':
        return this.runSafe(reviewType, () =>
          this.reportCompliance.performReview(orderId, this.mapReportComplianceInput(reportData)));
      default: {
        const _exhaustive: never = reviewType;
        throw new Error(`Unknown review type: ${_exhaustive}`);
      }
    }
  }

  // ── Safe runner ─────────────────────────────────────────────────────

  private async runSafe(
    reviewType: ReviewType,
    fn: () => ServiceReport
  ): Promise<SingleReviewResult> {
    try {
      const report = fn();
      return {
        reviewType,
        status: report.overallStatus,
        report,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Substantive review "${reviewType}" failed`, { reviewType, error: message });
      return {
        reviewType,
        status: 'error',
        report: null,
        errorMessage: message,
      };
    }
  }

  // ── Synthesis ───────────────────────────────────────────────────────

  private synthesize(orderId: string, reviews: SingleReviewResult[]): SubstantiveReviewResult {
    let totalChecks = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;

    for (const r of reviews) {
      if (r.report) {
        totalChecks += r.report.checks.length;
        criticalIssues += r.report.criticalIssues;
        highIssues += r.report.highIssues;
        mediumIssues += r.report.mediumIssues;
        lowIssues += r.report.lowIssues;
      }
    }

    const totalIssues = criticalIssues + highIssues + mediumIssues + lowIssues;

    // Score: start at 100, deduct per severity
    const rawScore = 100
      - criticalIssues * 15
      - highIssues * 8
      - mediumIssues * 3
      - lowIssues * 1;
    const overallScore = Math.max(0, Math.min(100, rawScore));

    // Status from score + critical issues
    let overallStatus: 'pass' | 'fail' | 'warnings';
    if (criticalIssues > 0 || overallScore < 60) {
      overallStatus = 'fail';
    } else if (highIssues > 2 || overallScore < 75) {
      overallStatus = 'warnings';
    } else {
      overallStatus = 'pass';
    }

    return {
      orderId,
      timestamp: new Date(),
      overallScore,
      overallStatus,
      totalChecks,
      totalIssues,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      reviews,
    };
  }

  // ── Input mappers ─────────────────────────────────────────────────
  // Each mapper extracts fields from the loosely-typed AppraisalReportData
  // into the strongly-typed Input interface required by its service.

  private mapBiasInput(rd: AppraisalReportData): BiasScreeningInput {
    return {
      ...(rd.narrative !== undefined && { narrative: rd.narrative }),
      ...(rd.neighborhoodDescription !== undefined && { neighborhoodDescription: rd.neighborhoodDescription }),
      ...(rd.marketConditionsCommentary !== undefined && { marketConditionsCommentary: rd.marketConditionsCommentary }),
      ...(rd.conditionQualityCommentary !== undefined && { conditionQualityCommentary: rd.conditionQualityCommentary }),
      ...(rd.subjectProperty !== undefined && { subjectProperty: rd.subjectProperty }),
      ...((rd.comparableAnalysis?.comparables ?? rd.comparables) !== undefined && { comparables: rd.comparableAnalysis?.comparables ?? rd.comparables }),
      ...(rd.engagement !== undefined && { engagement: rd.engagement }),
      ...(rd.reportStated !== undefined && { reportStated: rd.reportStated }),
    };
  }

  private mapScopeLockInput(rd: AppraisalReportData): ScopeLockInput {
    return {
      engagementScope: rd.engagementScope ?? {},
      reportScope: rd.reportScope ?? {},
      scopeChanges: rd.scopeChanges,
    };
  }

  private mapContractInput(rd: AppraisalReportData): ContractReviewInput {
    return {
      contract: rd.contract,
      concessions: rd.concessions,
      personalProperty: rd.personalProperty,
      financingTerms: rd.financingTerms,
      armLengthIndicators: rd.armLengthIndicators,
      appraisedValue: rd.valueConclusion?.finalValue ?? rd.appraisedValue,
      indicatedValueByApproach: rd.indicatedValueByApproach,
      compConcessions: rd.compConcessions,
    };
  }

  private mapMarketInput(rd: AppraisalReportData): MarketAnalyticsInput {
    return {
      statedConditions: rd.statedConditions ?? rd.marketAnalysis?.statedConditions,
      marketMetrics: rd.marketMetrics ?? rd.marketAnalysis?.metrics,
      comps: rd.comparableAnalysis?.comparables ?? rd.comps ?? [],
      subject: rd.subjectProperty ?? { zipCode: '', city: '' },
    };
  }

  private mapZoningSiteInput(rd: AppraisalReportData): ZoningSiteReviewInput {
    return {
      site: rd.site ?? rd.subjectProperty?.site ?? {},
      zoning: rd.zoning ?? rd.subjectProperty?.zoning ?? {},
      flood: rd.flood ?? rd.subjectProperty?.flood ?? {},
      hbu: rd.hbu ?? rd.subjectProperty?.hbu ?? {},
      utilities: rd.utilities ?? rd.subjectProperty?.utilities ?? {},
    };
  }

  private mapImprovementsInput(rd: AppraisalReportData): ImprovementsReviewInput {
    return {
      subject: rd.improvements ?? rd.subjectProperty?.improvements ?? {
        grossLivingArea: 0, totalRooms: 0, bedrooms: 0, bathrooms: 0,
        stories: 0, condition: '', quality: '', yearBuilt: 0,
      },
      comps: rd.comparableAnalysis?.comparables ?? rd.comps,
    };
  }

  private mapCostApproachInput(rd: AppraisalReportData): CostApproachReviewInput {
    const narrativeText: string | undefined = rd.costNarrative ?? rd.narrative;
    return {
      costApproach: rd.costApproach,
      property: rd.property ?? {
        actualAge: rd.subjectProperty?.actualAge ?? 0,
        condition: rd.subjectProperty?.condition ?? '',
        quality: rd.subjectProperty?.quality ?? '',
        yearBuilt: rd.subjectProperty?.yearBuilt ?? 0,
      },
      ...(narrativeText !== undefined && { narrative: { costApproachComments: narrativeText } }),
    };
  }

  private mapIncomeApproachInput(rd: AppraisalReportData): IncomeApproachReviewInput {
    return {
      incomeApproach: rd.incomeApproach,
      narrative: rd.incomeNarrative,
    };
  }

  private mapReconciliationInput(rd: AppraisalReportData): ReconciliationReviewInput {
    return {
      reconciliation: rd.reconciliation ?? {
        finalOpinionOfValue: rd.valueConclusion?.finalValue ?? 0,
      },
      approachesUsed: rd.approachesUsed ?? ['Sales Comparison'],
    };
  }

  private mapMathIntegrityInput(rd: AppraisalReportData): MathIntegrityInput {
    return {
      subject: rd.mathSubject ?? rd.subjectProperty ?? { grossLivingArea: 0 },
      comps: rd.mathComps ?? rd.comparableAnalysis?.comparables ?? [],
      costApproach: rd.mathCostApproach ?? rd.costApproach,
      incomeApproach: rd.mathIncomeApproach ?? rd.incomeApproach,
      reconciliation: rd.mathReconciliation ?? rd.reconciliation,
    };
  }

  private mapEnhancedFraudInput(rd: AppraisalReportData): EnhancedFraudInput {
    return {
      appraisedValue: rd.valueConclusion?.finalValue ?? rd.appraisedValue ?? 0,
      appraisalDate: rd.appraisalDate ?? new Date().toISOString(),
      subject: rd.subjectSaleHistory ?? rd.subjectProperty ?? {},
      comps: rd.fraudComps ?? rd.comparableAnalysis?.comparables ?? [],
      appraiserLicenseNumber: rd.appraiserLicenseNumber,
    };
  }

  private mapReportComplianceInput(rd: AppraisalReportData): ReportComplianceInput {
    return {
      appraiser: rd.appraiser ?? {
        name: '', licenseNumber: '', licenseState: '', licenseType: '',
        licenseExpirationDate: '', signatureDate: '',
      },
      report: rd.reportMetadata ?? {
        reportType: '', propertyType: '', propertyState: '',
        effectiveDate: '', reportDate: '',
      },
      addenda: rd.addenda ?? {
        hasSubjectPhotos: false, hasCompPhotos: false, hasStreetMap: false,
        hasFloodMap: false, hasFloorPlan: false, hasMarketConditionsAddendum: false,
      },
      certification: rd.certification ?? {},
    };
  }
}
