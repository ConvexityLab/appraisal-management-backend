/**
 * Review Report Generation Service
 * Generates standardized review reports (Form 2000, 2010, 1004D, etc.)
 */

import { Logger } from '../utils/logger.js';
import { TemplateService } from './template.service.js';
import {
  ReviewReport,
  ReviewReportType,
  ReviewReportSection,
  AppraisalReview,
  ComparableAnalysis,
  GenerateReviewReportRequest
} from '../types/review.types.js';
import { TemplateFormat } from '../types/template.types.js';

export class ReviewReportService {
  private logger: Logger;
  private templateService: TemplateService;

  constructor() {
    this.logger = new Logger();
    this.templateService = new TemplateService();
  }

  /**
   * Generate a review report
   */
  async generateReport(
    review: AppraisalReview,
    request: GenerateReviewReportRequest,
    comparableAnalysis?: ComparableAnalysis
  ): Promise<ReviewReport> {
    this.logger.info('Generating review report', { 
      reviewId: review.id,
      reportType: request.reportType 
    });

    // Build report sections based on type
    const sections = await this.buildReportSections(
      review,
      request,
      comparableAnalysis
    );

    // Generate content based on report type
    const content = await this.generateReportContent(
      review,
      request.reportType,
      sections,
      comparableAnalysis
    );

    const report: ReviewReport = {
      id: this.generateReportId(),
      tenantId: review.tenantId,
      reviewId: review.id,
      reportType: request.reportType,
      formType: this.getFormNumber(request.reportType),
      content,
      sections,
      preparedBy: review.assignedTo || review.createdBy,
      preparedDate: new Date(),
      reviewDate: review.completedAt || new Date(),
      status: request.certify ? 'FINAL' : 'DRAFT',
      version: '1.0',
      certificationStatement: this.getCertificationStatement(request.reportType),
      certifiedBy: request.certify ? review.assignedTo || review.createdBy : '',
      certifiedAt: request.certify ? new Date() : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Generate PDF if requested
    if (request.reportType !== ReviewReportType.LETTER_REVIEW) {
      const pdfBuffer = await this.generatePDF(report, review, comparableAnalysis);
      report.pdfUrl = `reports/${report.id}.pdf`; // Would upload to storage
    }

    return report;
  }

  /**
   * Build report sections based on type and content
   */
  private async buildReportSections(
    review: AppraisalReview,
    request: GenerateReviewReportRequest,
    comparableAnalysis?: ComparableAnalysis
  ): Promise<ReviewReportSection[]> {
    const sections: ReviewReportSection[] = [];
    let order = 1;

    // Executive Summary (all report types)
    sections.push({
      id: `section-${order}`,
      title: 'Executive Summary',
      order: order++,
      content: this.buildExecutiveSummary(review)
    });

    // Subject Property Information
    sections.push({
      id: `section-${order}`,
      title: 'Subject Property Information',
      order: order++,
      content: this.buildSubjectPropertySection(review)
    });

    // Review Scope and Purpose
    sections.push({
      id: `section-${order}`,
      title: 'Scope of Review',
      order: order++,
      content: this.buildScopeSection(review)
    });

    // Findings and Analysis
    if (request.includeFindingsDetail && review.findings.length > 0) {
      sections.push({
        id: `section-${order}`,
        title: 'Findings and Analysis',
        order: order++,
        content: this.buildFindingsSection(review),
        subsections: this.buildFindingsSubsections(review)
      });
    }

    // Comparable Sales Analysis
    if (request.includeComparableAnalysis && comparableAnalysis) {
      sections.push({
        id: `section-${order}`,
        title: 'Comparable Sales Analysis',
        order: order++,
        content: this.buildComparableAnalysisSection(comparableAnalysis)
      });
    }

    // Value Conclusion
    sections.push({
      id: `section-${order}`,
      title: 'Value Conclusion',
      order: order++,
      content: this.buildValueConclusionSection(review)
    });

    // Recommendations
    sections.push({
      id: `section-${order}`,
      title: 'Recommendations',
      order: order++,
      content: this.buildRecommendationsSection(review)
    });

    // Certification
    if (request.certify) {
      sections.push({
        id: `section-${order}`,
        title: 'Certification',
        order: order++,
        content: this.getCertificationStatement(request.reportType)
      });
    }

    return sections;
  }

  /**
   * Generate report content in HTML format
   */
  private async generateReportContent(
    review: AppraisalReview,
    reportType: ReviewReportType,
    sections: ReviewReportSection[],
    comparableAnalysis?: ComparableAnalysis
  ): Promise<string> {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>${this.getReportTitle(reportType)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; }
    h1 { font-size: 18pt; font-weight: bold; margin-top: 20px; border-bottom: 2px solid #000; }
    h2 { font-size: 14pt; font-weight: bold; margin-top: 15px; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .header { text-align: center; margin-bottom: 30px; }
    .section { margin-bottom: 20px; }
    .finding { margin: 10px 0; padding: 10px; background-color: #f9f9f9; border-left: 4px solid #ccc; }
    .finding.critical { border-left-color: #d32f2f; }
    .finding.major { border-left-color: #ff9800; }
    .finding.minor { border-left-color: #ffc107; }
    .signature-block { margin-top: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.getReportTitle(reportType)}</h1>
    <p><strong>Form ${this.getFormNumber(reportType)}</strong></p>
    <p>Review Date: ${new Date().toLocaleDateString()}</p>
  </div>
`;

    // Add each section
    for (const section of sections) {
      html += `
  <div class="section">
    <h2>${section.title}</h2>
    ${section.content}
    
    ${section.subsections ? section.subsections.map(sub => `
      <h3>${sub.title}</h3>
      ${sub.content}
    `).join('') : ''}
  </div>
`;
    }

    html += `
</body>
</html>
`;

    return html;
  }

  /**
   * Build executive summary
   */
  private buildExecutiveSummary(review: AppraisalReview): string {
    return `
<p><strong>Review Type:</strong> ${review.reviewType}</p>
<p><strong>Original Value Opinion:</strong> $${review.originalValue.toLocaleString()}</p>
${review.reviewedValue ? `<p><strong>Reviewed Value:</strong> $${review.reviewedValue.toLocaleString()}</p>` : ''}
${review.valueAdjustment ? `<p><strong>Value Adjustment:</strong> $${review.valueAdjustment.toLocaleString()} (${((review.valueAdjustment / review.originalValue) * 100).toFixed(2)}%)</p>` : ''}
<p><strong>Review Outcome:</strong> ${review.outcome || 'Pending'}</p>
<p><strong>Number of Findings:</strong> ${review.findings.length} (${review.findings.filter(f => f.severity === 'CRITICAL').length} critical, ${review.findings.filter(f => f.severity === 'MAJOR').length} major)</p>
    `;
  }

  /**
   * Build subject property section
   */
  private buildSubjectPropertySection(review: AppraisalReview): string {
    return `
<table>
  <tr>
    <th>Property Address</th>
    <td colspan="3">[Property Address from Order]</td>
  </tr>
  <tr>
    <th>Order ID</th>
    <td>${review.orderId}</td>
    <th>Review ID</th>
    <td>${review.id}</td>
  </tr>
  <tr>
    <th>Review Requested By</th>
    <td>${review.requestedBy}</td>
    <th>Review Date</th>
    <td>${review.requestedAt.toLocaleDateString()}</td>
  </tr>
</table>
    `;
  }

  /**
   * Build scope section
   */
  private buildScopeSection(review: AppraisalReview): string {
    const scopeText = this.getScopeOfWorkText(review.reviewType);
    
    return `
<p><strong>Review Type:</strong> ${review.reviewType}</p>
<p><strong>Purpose of Review:</strong> ${review.requestReason}</p>
<p><strong>Scope of Work:</strong></p>
<p>${scopeText}</p>
    `;
  }

  /**
   * Build findings section
   */
  private buildFindingsSection(review: AppraisalReview): string {
    if (review.findings.length === 0) {
      return '<p>No significant findings identified during the review process.</p>';
    }

    let html = '<p>The following findings were identified during the review:</p>';
    
    const criticalFindings = review.findings.filter(f => f.severity === 'CRITICAL');
    const majorFindings = review.findings.filter(f => f.severity === 'MAJOR');
    const minorFindings = review.findings.filter(f => f.severity === 'MINOR');

    if (criticalFindings.length > 0) {
      html += '<h3>Critical Findings</h3>';
      criticalFindings.forEach(finding => {
        html += `
<div class="finding critical">
  <p><strong>${finding.category}</strong></p>
  <p>${finding.description}</p>
  ${finding.location ? `<p><em>Location: ${finding.location}</em></p>` : ''}
  <p><strong>Recommendation:</strong> ${finding.recommendation}</p>
</div>
        `;
      });
    }

    if (majorFindings.length > 0) {
      html += '<h3>Major Findings</h3>';
      majorFindings.forEach(finding => {
        html += `
<div class="finding major">
  <p><strong>${finding.category}</strong></p>
  <p>${finding.description}</p>
  <p><strong>Recommendation:</strong> ${finding.recommendation}</p>
</div>
        `;
      });
    }

    if (minorFindings.length > 0) {
      html += '<h3>Minor Findings</h3>';
      minorFindings.forEach(finding => {
        html += `
<div class="finding minor">
  <p><strong>${finding.category}:</strong> ${finding.description}</p>
</div>
        `;
      });
    }

    return html;
  }

  /**
   * Build findings subsections by category
   */
  private buildFindingsSubsections(review: AppraisalReview): ReviewReportSection[] {
    const categories = new Set(review.findings.map(f => f.category));
    const subsections: ReviewReportSection[] = [];
    let order = 1;

    categories.forEach(category => {
      const categoryFindings = review.findings.filter(f => f.category === category);
      const content = categoryFindings.map(f => `
<p><strong>${f.severity}:</strong> ${f.description}</p>
<p><em>Recommendation:</em> ${f.recommendation}</p>
      `).join('<hr/>');

      subsections.push({
        id: `subsection-${order}`,
        title: category.replace(/_/g, ' '),
        order: order++,
        content
      });
    });

    return subsections;
  }

  /**
   * Build comparable analysis section
   */
  private buildComparableAnalysisSection(analysis: ComparableAnalysis): string {
    let html = `
<p><strong>Summary:</strong> ${analysis.summary.overallAssessment}</p>
<p><strong>Comparables Reviewed:</strong> ${analysis.summary.totalComparablesReviewed}</p>
<p><strong>Comparables Verified:</strong> ${analysis.summary.comparablesVerified}</p>
<p><strong>Selection Quality:</strong> ${analysis.summary.selectionQuality}</p>

<h3>Individual Comparable Analysis</h3>
<table>
  <thead>
    <tr>
      <th>Comp #</th>
      <th>Address</th>
      <th>Sale Price</th>
      <th>Adjustments</th>
      <th>Adjusted Value</th>
      <th>Status</th>
      <th>Score</th>
    </tr>
  </thead>
  <tbody>
    `;

    analysis.comparables.forEach(comp => {
      html += `
    <tr>
      <td>${comp.compNumber}</td>
      <td>${comp.address}</td>
      <td>$${comp.salePrice.toLocaleString()}</td>
      <td>$${comp.totalAdjustment.toLocaleString()} (${comp.totalAdjustmentPercent.toFixed(1)}%)</td>
      <td>$${comp.adjustedValue.toLocaleString()}</td>
      <td>${comp.verificationStatus}</td>
      <td>${comp.appropriatenessScore}</td>
    </tr>
      `;
    });

    html += `
  </tbody>
</table>

${analysis.summary.adjustmentConcerns.length > 0 ? `
<h3>Adjustment Concerns</h3>
<ul>
  ${analysis.summary.adjustmentConcerns.map(concern => `<li>${concern}</li>`).join('')}
</ul>
` : ''}

${analysis.summary.selectionIssues.length > 0 ? `
<h3>Selection Issues</h3>
<ul>
  ${analysis.summary.selectionIssues.map(issue => `<li>${issue}</li>`).join('')}
</ul>
` : ''}

${analysis.summary.valueIndicationRange ? `
<p><strong>Value Indication Range:</strong> $${analysis.summary.valueIndicationRange.low.toLocaleString()} - $${analysis.summary.valueIndicationRange.high.toLocaleString()}</p>
` : ''}
    `;

    return html;
  }

  /**
   * Build value conclusion section
   */
  private buildValueConclusionSection(review: AppraisalReview): string {
    let html = `
<p><strong>Original Value Opinion:</strong> $${review.originalValue.toLocaleString()}</p>
    `;

    if (review.reviewedValue) {
      html += `
<p><strong>Reviewer's Value Conclusion:</strong> $${review.reviewedValue.toLocaleString()}</p>
<p><strong>Value Adjustment:</strong> $${review.valueAdjustment?.toLocaleString()} (${((review.valueAdjustment || 0) / review.originalValue * 100).toFixed(2)}%)</p>
      `;

      if (review.valueAdjustmentReason) {
        html += `<p><strong>Reason for Adjustment:</strong> ${review.valueAdjustmentReason}</p>`;
      }
    } else {
      html += `<p>The reviewer found the original value opinion to be reasonable and well-supported.</p>`;
    }

    return html;
  }

  /**
   * Build recommendations section
   */
  private buildRecommendationsSection(review: AppraisalReview): string {
    const recommendations: string[] = [];

    // Based on findings
    const criticalFindings = review.findings.filter(f => f.severity === 'CRITICAL');
    const majorFindings = review.findings.filter(f => f.severity === 'MAJOR');

    if (criticalFindings.length > 0) {
      recommendations.push('A revised appraisal is recommended to address critical findings.');
    } else if (majorFindings.length > 0) {
      recommendations.push('Corrections should be made to address major findings.');
    }

    // Based on outcome
    switch (review.outcome) {
      case 'APPROVED':
        recommendations.push('The appraisal is approved for intended use.');
        break;
      case 'APPROVED_WITH_CONDITIONS':
        recommendations.push('The appraisal is approved subject to minor corrections noted in findings.');
        break;
      case 'REQUIRES_REVISION':
        recommendations.push('The appraisal requires revision to address identified issues.');
        break;
      case 'REQUIRES_FIELD_WORK':
        recommendations.push('Additional field work is required to verify property characteristics and condition.');
        break;
      case 'REJECTED':
        recommendations.push('The appraisal is rejected. A new appraisal by a different appraiser is recommended.');
        break;
    }

    if (recommendations.length === 0) {
      recommendations.push('Review in progress - recommendations pending completion.');
    }

    return '<ul>' + recommendations.map(r => `<li>${r}</li>`).join('') + '</ul>';
  }

  /**
   * Generate PDF from report
   */
  private async generatePDF(
    report: ReviewReport,
    review: AppraisalReview,
    comparableAnalysis?: ComparableAnalysis
  ): Promise<Buffer> {
    // Use template service to render HTML to PDF
    const result = await this.templateService.renderAsPdf(
      report.content,
      {
        id: report.id,
        name: this.getReportTitle(report.reportType),
        styles: {
          pageSize: 'LETTER',
          margins: { top: 72, bottom: 72, left: 72, right: 72 }
        }
      } as any,
      {}
    );

    return result;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getFormNumber(reportType: ReviewReportType): string {
    const formMap: Record<ReviewReportType, string> = {
      [ReviewReportType.FORM_2000]: '2000',
      [ReviewReportType.FORM_2010]: '2010',
      [ReviewReportType.FORM_1004D]: '1004D',
      [ReviewReportType.FORM_2075]: '2075',
      [ReviewReportType.NARRATIVE_REVIEW]: 'N/A',
      [ReviewReportType.LETTER_REVIEW]: 'N/A'
    };

    return formMap[reportType] || 'N/A';
  }

  private getReportTitle(reportType: ReviewReportType): string {
    const titleMap: Record<ReviewReportType, string> = {
      [ReviewReportType.FORM_2000]: 'Appraisal Review - General Purpose',
      [ReviewReportType.FORM_2010]: 'Appraisal Review - Residential',
      [ReviewReportType.FORM_1004D]: 'Appraisal Update and/or Completion Report',
      [ReviewReportType.FORM_2075]: 'Desktop Underwriter Property Inspection Report',
      [ReviewReportType.NARRATIVE_REVIEW]: 'Narrative Appraisal Review',
      [ReviewReportType.LETTER_REVIEW]: 'Appraisal Review Letter'
    };

    return titleMap[reportType] || 'Appraisal Review Report';
  }

  private getScopeOfWorkText(reviewType: string): string {
    const scopeMap: Record<string, string> = {
      DESK_REVIEW: 'This review was conducted as a desk review, examining the appraisal report and supporting documentation without a field inspection of the subject property.',
      FIELD_REVIEW: 'This review included both a desk review of the appraisal report and a field inspection of the subject property to verify property characteristics and condition.',
      TECHNICAL_REVIEW: 'This technical review focused on the methodology, analysis, and technical aspects of the appraisal, including comparable selection, adjustments, and value conclusion.',
      COMPLIANCE_REVIEW: 'This review focused on compliance with USPAP standards, client requirements, and applicable regulations.',
      QUALITY_CONTROL: 'This quality control review was performed to ensure adherence to company standards and industry best practices.'
    };

    return scopeMap[reviewType] || 'This review was conducted in accordance with applicable standards and client requirements.';
  }

  private getCertificationStatement(reportType: ReviewReportType): string {
    return `
<div class="signature-block">
  <p>I certify that, to the best of my knowledge and belief:</p>
  <ul>
    <li>The statements of fact contained in this review are true and correct.</li>
    <li>The reported analyses, opinions, and conclusions are limited only by the reported assumptions and limiting conditions.</li>
    <li>I have no present or prospective interest in the property that is the subject of this review.</li>
    <li>I have no bias with respect to the property that is the subject of this review or to the parties involved.</li>
    <li>My engagement in this assignment was not contingent upon developing or reporting predetermined results.</li>
    <li>My compensation is not contingent on the value conclusion or any predetermined finding.</li>
    <li>The review was performed in accordance with USPAP Standards.</li>
  </ul>
  
  <p style="margin-top: 30px;">
    Signature: _________________________________<br/>
    Date: _________________________________<br/>
    Reviewer Name: _________________________________<br/>
    State Certification: _________________________________
  </p>
</div>
    `;
  }

  private generateReportId(): string {
    return `REPORT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
