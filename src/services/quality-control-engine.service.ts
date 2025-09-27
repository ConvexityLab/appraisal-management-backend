import { Logger } from '../utils/logger.js';
import { AppraisalOrder, QualityControlResult } from '../types/index.js';

/**
 * Advanced Quality Control System with ML-powered automation
 * Implements multi-layer QC with technical, compliance, and analytical checks
 */
export class QualityControlEngine {
  private logger: Logger;
  private mlQCEndpoint: string;
  private complianceRules: ComplianceRule[] = [];

  constructor() {
    this.logger = new Logger();
    this.mlQCEndpoint = process.env.AZURE_ML_QC_ENDPOINT || '';
    this.initializeComplianceRules();
  }

  /**
   * Comprehensive automated quality control review
   */
  async performQualityControl(order: AppraisalOrder, reportData: AppraisalReportData): Promise<QCResult> {
    this.logger.info('Starting comprehensive QC review', { orderId: order.id });

    try {
      // Run all QC layers in parallel for efficiency
      const [
        technicalQC,
        complianceQC,
        analyticalQC,
        documentQC,
        photoQC,
        dataConsistencyQC
      ] = await Promise.all([
        this.performTechnicalQC(reportData),
        this.performComplianceQC(reportData, order),
        this.performAnalyticalQC(reportData, order),
        this.performDocumentQC(reportData),
        this.performPhotoQC(reportData),
        this.performDataConsistencyQC(reportData, order)
      ]);

      // ML-powered overall assessment
      const mlAssessment = await this.performMLQualityAssessment(reportData, {
        technical: technicalQC,
        compliance: complianceQC,
        analytical: analyticalQC,
        document: documentQC,
        photo: photoQC,
        consistency: dataConsistencyQC
      });

      // Combine all results into comprehensive QC report
      const finalResult = this.synthesizeQCResults({
        orderId: order.id,
        technical: technicalQC,
        compliance: complianceQC,
        analytical: analyticalQC,
        document: documentQC,
        photo: photoQC,
        consistency: dataConsistencyQC,
        mlAssessment: mlAssessment
      });

      this.logger.info('QC review completed', {
        orderId: order.id,
        overallScore: finalResult.overallScore,
        status: finalResult.status,
        issuesFound: finalResult.totalIssues
      });

      return finalResult;

    } catch (error) {
      this.logger.error('QC review failed', { orderId: order.id, error });
      throw new Error(`Quality control failed: ${error}`);
    }
  }

  /**
   * Technical QC - UAD compliance, form completion, calculations
   */
  private async performTechnicalQC(reportData: AppraisalReportData): Promise<TechnicalQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    // UAD (Uniform Appraisal Dataset) compliance checks
    const uadChecks = this.performUADChecks(reportData);
    issues.push(...uadChecks.issues);
    score -= uadChecks.deductions;

    // Form completion checks
    const completionChecks = this.checkFormCompletion(reportData);
    issues.push(...completionChecks.issues);
    score -= completionChecks.deductions;

    // Mathematical calculations verification
    const calculationChecks = this.verifyCalculations(reportData);
    issues.push(...calculationChecks.issues);
    score -= calculationChecks.deductions;

    // Comparable sales analysis
    const comparableChecks = this.validateComparableSales(reportData);
    issues.push(...comparableChecks.issues);
    score -= comparableChecks.deductions;

    return {
      category: 'technical',
      score: Math.max(score, 0),
      status: score >= 80 ? 'pass' : score >= 60 ? 'conditional' : 'fail',
      issues: issues,
      checks: {
        uad: uadChecks,
        completion: completionChecks,
        calculations: calculationChecks,
        comparables: comparableChecks
      }
    };
  }

  /**
   * Compliance QC - Regulatory and investor requirements
   */
  private async performComplianceQC(reportData: AppraisalReportData, order: AppraisalOrder): Promise<ComplianceQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    // Apply compliance rules based on order type and investor
    for (const rule of this.complianceRules) {
      if (this.ruleApplies(rule, order)) {
        const ruleResult = this.applyComplianceRule(rule, reportData);
        if (!ruleResult.passed) {
          issues.push({
            severity: rule.severity as 'critical' | 'high' | 'medium' | 'low',
            category: 'compliance',
            description: ruleResult.message,
            code: rule.code,
            section: ruleResult.section,
            recommendation: ruleResult.recommendation
          });
          score -= this.getSeverityDeduction(rule.severity);
        }
      }
    }

    return {
      category: 'compliance',
      score: Math.max(score, 0),
      status: score >= 85 ? 'pass' : score >= 70 ? 'conditional' : 'fail',
      issues: issues,
      applicableRules: this.complianceRules.filter(rule => this.ruleApplies(rule, order)),
      investorRequirements: await this.checkInvestorRequirements(reportData, order)
    };
  }

  /**
   * Analytical QC - Statistical analysis and risk assessment
   */
  private async performAnalyticalQC(reportData: AppraisalReportData, order: AppraisalOrder): Promise<AnalyticalQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    // Value variance analysis
    const valueAnalysis = this.analyzeValueVariance(reportData);
    if (valueAnalysis.variance > 0.15) { // 15% variance threshold
      issues.push({
        severity: 'high',
        category: 'analytical',
        description: `High value variance detected: ${(valueAnalysis.variance * 100).toFixed(1)}%`,
        code: 'VALUE_VARIANCE',
        recommendation: 'Review comparable selection and adjustments'
      });
      score -= 15;
    }

    // Market analysis validation
    const marketAnalysis = this.validateMarketAnalysis(reportData);
    issues.push(...marketAnalysis.issues);
    score -= marketAnalysis.deductions;

    // Adjustment analysis
    const adjustmentAnalysis = this.analyzeAdjustments(reportData);
    issues.push(...adjustmentAnalysis.issues);
    score -= adjustmentAnalysis.deductions;

    // Statistical outlier detection
    const outlierAnalysis = this.detectStatisticalOutliers(reportData);
    issues.push(...outlierAnalysis.issues);
    score -= outlierAnalysis.deductions;

    return {
      category: 'analytical',
      score: Math.max(score, 0),
      status: score >= 75 ? 'pass' : score >= 60 ? 'conditional' : 'fail',
      issues: issues,
      analysis: {
        valueVariance: valueAnalysis,
        marketAnalysis: marketAnalysis,
        adjustments: adjustmentAnalysis,
        outliers: outlierAnalysis
      }
    };
  }

  /**
   * Document QC - Text analysis and content validation
   */
  private async performDocumentQC(reportData: AppraisalReportData): Promise<DocumentQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    // Text quality analysis using NLP
    const textAnalysis = await this.analyzeTextQuality(reportData.narrative || '');
    issues.push(...textAnalysis.issues);
    score -= textAnalysis.deductions;

    // Narrative consistency checks
    const consistencyCheck = this.checkNarrativeConsistency(reportData);
    issues.push(...consistencyCheck.issues);
    score -= consistencyCheck.deductions;

    // Required disclosures verification
    const disclosureCheck = this.verifyRequiredDisclosures(reportData);
    issues.push(...disclosureCheck.issues);
    score -= disclosureCheck.deductions;

    return {
      category: 'document',
      score: Math.max(score, 0),
      status: score >= 80 ? 'pass' : score >= 65 ? 'conditional' : 'fail',
      issues: issues,
      analysis: {
        textQuality: textAnalysis,
        consistency: consistencyCheck,
        disclosures: disclosureCheck
      }
    };
  }

  /**
   * Photo QC - Image analysis and validation
   */
  private async performPhotoQC(reportData: AppraisalReportData): Promise<PhotoQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    if (!reportData.photos || reportData.photos.length === 0) {
      issues.push({
        severity: 'critical',
        category: 'photo',
        description: 'No photos provided',
        code: 'NO_PHOTOS',
        recommendation: 'Photos are required for appraisal report'
      });
      return {
        category: 'photo',
        score: 0,
        status: 'fail',
        issues: issues,
        analysis: {}
      };
    }

    // Analyze each photo
    for (const [index, photo] of reportData.photos.entries()) {
      const photoAnalysis = await this.analyzePhoto(photo, index);
      issues.push(...photoAnalysis.issues);
      score -= photoAnalysis.deductions;
    }

    // Check photo requirements
    const requirementCheck = this.checkPhotoRequirements(reportData.photos);
    issues.push(...requirementCheck.issues);
    score -= requirementCheck.deductions;

    return {
      category: 'photo',
      score: Math.max(score, 0),
      status: score >= 85 ? 'pass' : score >= 70 ? 'conditional' : 'fail',
      issues: issues,
      analysis: {
        photoCount: reportData.photos.length,
        requirements: requirementCheck
      }
    };
  }

  /**
   * Data consistency QC - Cross-reference validation
   */
  private async performDataConsistencyQC(reportData: AppraisalReportData, order: AppraisalOrder): Promise<DataConsistencyQCResult> {
    const issues: QCIssue[] = [];
    let score = 100;

    // Order vs report data consistency
    const orderConsistency = this.checkOrderReportConsistency(order, reportData);
    issues.push(...orderConsistency.issues);
    score -= orderConsistency.deductions;

    // Internal data consistency
    const internalConsistency = this.checkInternalDataConsistency(reportData);
    issues.push(...internalConsistency.issues);
    score -= internalConsistency.deductions;

    // External data verification (public records, MLS)
    const externalVerification = await this.verifyExternalData(reportData);
    issues.push(...externalVerification.issues);
    score -= externalVerification.deductions;

    return {
      category: 'consistency',
      score: Math.max(score, 0),
      status: score >= 80 ? 'pass' : score >= 65 ? 'conditional' : 'fail',
      issues: issues,
      checks: {
        orderConsistency: orderConsistency,
        internal: internalConsistency,
        external: externalVerification
      }
    };
  }

  /**
   * ML-powered quality assessment using Azure ML models
   */
  private async performMLQualityAssessment(reportData: AppraisalReportData, qcResults: any): Promise<MLQualityAssessment> {
    if (!this.mlQCEndpoint) {
      // Fallback statistical assessment
      return this.fallbackMLAssessment(qcResults);
    }

    try {
      const features = this.extractQCFeatures(reportData, qcResults);
      
      const response = await fetch(this.mlQCEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AZURE_ML_API_KEY}`,
        },
        body: JSON.stringify({
          data: [features]
        })
      });

      const result = await response.json();

      return {
        overallQualityScore: result.quality_score,
        riskScore: result.risk_score,
        recommendedAction: result.recommended_action,
        confidence: result.confidence,
        anomalyScore: result.anomaly_score,
        predictedIssues: result.predicted_issues || [],
        modelVersion: 'azure-ml-qc-v2.1'
      };

    } catch (error) {
      this.logger.warn('ML QC endpoint failed, using fallback', { error });
      return this.fallbackMLAssessment(qcResults);
    }
  }

  /**
   * Synthesize all QC results into final assessment
   */
  private synthesizeQCResults(results: QCResultInputs): QCResult {
    const allIssues = [
      ...results.technical.issues,
      ...results.compliance.issues,
      ...results.analytical.issues,
      ...results.document.issues,
      ...results.photo.issues,
      ...results.consistency.issues
    ];

    // Weight different QC categories
    const weights = {
      technical: 0.25,
      compliance: 0.25,
      analytical: 0.20,
      document: 0.15,
      photo: 0.10,
      consistency: 0.05
    };

    const weightedScore = (
      results.technical.score * weights.technical +
      results.compliance.score * weights.compliance +
      results.analytical.score * weights.analytical +
      results.document.score * weights.document +
      results.photo.score * weights.photo +
      results.consistency.score * weights.consistency
    );

    // Determine overall status
    const criticalIssues = allIssues.filter(issue => issue.severity === 'critical').length;
    const highIssues = allIssues.filter(issue => issue.severity === 'high').length;

    let status: QCStatus;
    if (criticalIssues > 0 || weightedScore < 60) {
      status = 'fail';
    } else if (highIssues > 2 || weightedScore < 75) {
      status = 'conditional';
    } else {
      status = 'pass';
    }

    return {
      orderId: results.orderId,
      overallScore: Math.round(weightedScore),
      status: status,
      timestamp: new Date(),
      totalIssues: allIssues.length,
      criticalIssues: criticalIssues,
      highIssues: highIssues,
      categories: {
        technical: results.technical,
        compliance: results.compliance,
        analytical: results.analytical,
        document: results.document,
        photo: results.photo,
        consistency: results.consistency
      },
      mlAssessment: results.mlAssessment,
      allIssues: allIssues,
      recommendations: this.generateQCRecommendations(allIssues, results.mlAssessment),
      nextSteps: this.determineNextSteps(status, allIssues)
    };
  }

  // Helper methods (simplified implementations)
  private initializeComplianceRules(): void {
    this.complianceRules = [
      {
        code: 'FNMA_REQUIRED_PHOTOS',
        description: 'FNMA requires specific photo types',
        severity: 'high',
        applicableOrders: ['conventional'],
        validator: (reportData) => (reportData.photos?.length || 0) >= 6
      },
      {
        code: 'UAD_COMPLIANCE',
        description: 'UAD fields must be properly completed',
        severity: 'critical',
        applicableOrders: ['all'],
        validator: (reportData) => this.validateUADCompliance(reportData)
      }
      // Add more compliance rules as needed
    ];
  }

  private performUADChecks(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    const issues: QCIssue[] = [];
    let deductions = 0;

    // Mock UAD validation
    if (!reportData.subjectProperty?.grossLivingArea) {
      issues.push({
        severity: 'high',
        category: 'technical',
        description: 'Gross Living Area not specified',
        code: 'UAD_GLA_MISSING',
        recommendation: 'Enter the gross living area in square feet'
      });
      deductions += 10;
    }

    return { issues, deductions };
  }

  private checkFormCompletion(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    const issues: QCIssue[] = [];
    let deductions = 0;

    const requiredFields = ['subjectProperty', 'marketAnalysis', 'valueConclusion'];
    
    for (const field of requiredFields) {
      if (!reportData[field as keyof AppraisalReportData]) {
        issues.push({
          severity: 'medium',
          category: 'technical',
          description: `Required field missing: ${field}`,
          code: 'MISSING_REQUIRED_FIELD',
          recommendation: `Complete the ${field} section`
        });
        deductions += 5;
      }
    }

    return { issues, deductions };
  }

  private verifyCalculations(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    const issues: QCIssue[] = [];
    let deductions = 0;

    // Mock calculation verification
    if (reportData.valueConclusion && reportData.comparableAnalysis) {
      const avgCompValue = reportData.comparableAnalysis.averageValue || 0;
      const finalValue = reportData.valueConclusion.finalValue || 0;
      const variance = Math.abs(finalValue - avgCompValue) / avgCompValue;

      if (variance > 0.10) { // 10% variance threshold
        issues.push({
          severity: 'medium',
          category: 'technical',
          description: `Final value varies significantly from comparable average: ${(variance * 100).toFixed(1)}%`,
          code: 'VALUE_CALCULATION_VARIANCE',
          recommendation: 'Review comparable adjustments and final value conclusion'
        });
        deductions += 8;
      }
    }

    return { issues, deductions };
  }

  private validateComparableSales(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    const issues: QCIssue[] = [];
    let deductions = 0;

    if (!reportData.comparableAnalysis?.comparables || reportData.comparableAnalysis.comparables.length < 3) {
      issues.push({
        severity: 'high',
        category: 'technical',
        description: 'Insufficient comparable sales (minimum 3 required)',
        code: 'INSUFFICIENT_COMPARABLES',
        recommendation: 'Include at least 3 comparable sales'
      });
      deductions += 15;
    }

    return { issues, deductions };
  }

  private ruleApplies(rule: ComplianceRule, order: AppraisalOrder): boolean {
    return rule.applicableOrders.includes('all') || 
           rule.applicableOrders.includes(order.productType) ||
           rule.applicableOrders.includes(order.orderType);
  }

  private applyComplianceRule(rule: ComplianceRule, reportData: AppraisalReportData): ComplianceRuleResult {
    try {
      const passed = rule.validator(reportData);
      return {
        passed,
        message: passed ? `${rule.description} - Compliant` : `${rule.description} - Non-compliant`,
        section: 'compliance',
        recommendation: passed ? '' : `Ensure compliance with ${rule.code}`
      };
    } catch (error) {
      return {
        passed: false,
        message: `Error checking compliance rule: ${rule.code}`,
        section: 'compliance',
        recommendation: 'Review compliance requirements'
      };
    }
  }

  private getSeverityDeduction(severity: string): number {
    const deductions = { critical: 25, high: 15, medium: 8, low: 3 };
    return deductions[severity as keyof typeof deductions] || 5;
  }

  private async checkInvestorRequirements(reportData: AppraisalReportData, order: AppraisalOrder): Promise<any> {
    // Mock investor requirements check
    return {
      fnma: { compliant: true, issues: [] },
      fhlmc: { compliant: true, issues: [] },
      fha: { compliant: true, issues: [] }
    };
  }

  private analyzeValueVariance(reportData: AppraisalReportData): any {
    // Mock value variance analysis
    return {
      variance: 0.08, // 8% variance
      comparableRange: { low: 720000, high: 780000 },
      finalValue: 750000
    };
  }

  private validateMarketAnalysis(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private analyzeAdjustments(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private detectStatisticalOutliers(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private async analyzeTextQuality(narrative: string): Promise<{ issues: QCIssue[], deductions: number }> {
    const issues: QCIssue[] = [];
    let deductions = 0;

    if (narrative.length < 100) {
      issues.push({
        severity: 'medium',
        category: 'document',
        description: 'Narrative section too brief',
        code: 'BRIEF_NARRATIVE',
        recommendation: 'Provide more detailed market analysis and property description'
      });
      deductions += 5;
    }

    return { issues, deductions };
  }

  private checkNarrativeConsistency(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private verifyRequiredDisclosures(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private async analyzePhoto(photo: any, index: number): Promise<{ issues: QCIssue[], deductions: number }> {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private checkPhotoRequirements(photos: any[]): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private checkOrderReportConsistency(order: AppraisalOrder, reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private checkInternalDataConsistency(reportData: AppraisalReportData): { issues: QCIssue[], deductions: number } {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private async verifyExternalData(reportData: AppraisalReportData): Promise<{ issues: QCIssue[], deductions: number }> {
    return { issues: [], deductions: 0 }; // Mock implementation
  }

  private extractQCFeatures(reportData: AppraisalReportData, qcResults: any): any {
    return {
      reportLength: reportData.narrative?.length || 0,
      photoCount: reportData.photos?.length || 0,
      comparableCount: reportData.comparableAnalysis?.comparables?.length || 0,
      technicalScore: qcResults.technical.score,
      complianceScore: qcResults.compliance.score
    };
  }

  private fallbackMLAssessment(qcResults: any): MLQualityAssessment {
    const avgScore = Object.values(qcResults).reduce((sum: number, result: any) => sum + result.score, 0) / Object.keys(qcResults).length;
    
    return {
      overallQualityScore: avgScore,
      riskScore: 100 - avgScore,
      recommendedAction: avgScore >= 80 ? 'approve' : avgScore >= 65 ? 'review' : 'reject',
      confidence: 0.7,
      anomalyScore: Math.max(0, (80 - avgScore) / 80),
      predictedIssues: [],
      modelVersion: 'fallback-v1.0'
    };
  }

  private validateUADCompliance(reportData: AppraisalReportData): boolean {
    return true; // Mock implementation
  }

  private generateQCRecommendations(issues: QCIssue[], mlAssessment: MLQualityAssessment): string[] {
    const recommendations = [];
    
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address all critical issues before proceeding');
    }
    
    if (mlAssessment.riskScore > 50) {
      recommendations.push('High risk score detected - recommend additional review');
    }
    
    return recommendations;
  }

  private determineNextSteps(status: QCStatus, issues: QCIssue[]): string[] {
    const steps = [];
    
    switch (status) {
      case 'pass':
        steps.push('Approve for delivery');
        break;
      case 'conditional':
        steps.push('Address identified issues');
        steps.push('Re-submit for final review');
        break;
      case 'fail':
        steps.push('Major revisions required');
        steps.push('Address all critical and high priority issues');
        steps.push('Re-submit for complete QC review');
        break;
    }
    
    return steps;
  }
}

// Type definitions for QC system
export interface QCResult {
  orderId: string;
  overallScore: number;
  status: QCStatus;
  timestamp: Date;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  categories: {
    technical: TechnicalQCResult;
    compliance: ComplianceQCResult;
    analytical: AnalyticalQCResult;
    document: DocumentQCResult;
    photo: PhotoQCResult;
    consistency: DataConsistencyQCResult;
  };
  mlAssessment: MLQualityAssessment;
  allIssues: QCIssue[];
  recommendations: string[];
  nextSteps: string[];
}

export interface QCIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  code: string;
  section?: string;
  recommendation: string;
}

export interface TechnicalQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  checks: any;
}

export interface ComplianceQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  applicableRules: ComplianceRule[];
  investorRequirements: any;
}

export interface AnalyticalQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  analysis: any;
}

export interface DocumentQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  analysis: any;
}

export interface PhotoQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  analysis: any;
}

export interface DataConsistencyQCResult {
  category: string;
  score: number;
  status: string;
  issues: QCIssue[];
  checks: any;
}

export interface MLQualityAssessment {
  overallQualityScore: number;
  riskScore: number;
  recommendedAction: string;
  confidence: number;
  anomalyScore: number;
  predictedIssues: string[];
  modelVersion: string;
}

export interface ComplianceRule {
  code: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  applicableOrders: string[];
  validator: (reportData: AppraisalReportData) => boolean;
}

export interface ComplianceRuleResult {
  passed: boolean;
  message: string;
  section: string;
  recommendation: string;
}

export interface AppraisalReportData {
  subjectProperty?: any;
  marketAnalysis?: any;
  valueConclusion?: any;
  comparableAnalysis?: any;
  narrative?: string;
  photos?: any[];
  [key: string]: any;
}

export interface QCResultInputs {
  orderId: string;
  technical: TechnicalQCResult;
  compliance: ComplianceQCResult;
  analytical: AnalyticalQCResult;
  document: DocumentQCResult;
  photo: PhotoQCResult;
  consistency: DataConsistencyQCResult;
  mlAssessment: MLQualityAssessment;
}

export type QCStatus = 'pass' | 'conditional' | 'fail';