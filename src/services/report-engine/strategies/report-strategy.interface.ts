/**
 * IReportStrategy — common interface every render strategy must implement.
 */

import { FinalReportGenerationRequest, ReportSectionConfig, ReportTemplate } from '../../../types/final-report.types';
import { CanonicalReportDocument } from '../../../types/canonical-schema';

export interface ReportGenerationContext {
  request: FinalReportGenerationRequest;
  template: ReportTemplate;
  effectiveSectionConfig: ReportSectionConfig;
  canonicalDoc: CanonicalReportDocument;
}

export interface IReportStrategy {
  /** Produces a complete, byte-perfect PDF buffer ready for Blob storage upload. */
  generate(ctx: ReportGenerationContext): Promise<Buffer>;
}
