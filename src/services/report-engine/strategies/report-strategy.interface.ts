/**
 * IReportStrategy — common interface every render strategy must implement.
 */

import { FinalReportGenerationRequest, ReportSectionConfig, ReportTemplate } from '../../../types/final-report.types';
import { CanonicalReportDocument } from '@l1/shared-types';
import type { EffectiveReportConfig } from '@l1/shared-types';

export interface ReportGenerationContext {
  request: FinalReportGenerationRequest;
  template: ReportTemplate;
  effectiveSectionConfig: ReportSectionConfig;
  canonicalDoc: CanonicalReportDocument;
  /**
   * Merged report config (R-20). Present whenever the caller supplies one;
   * strategies use it for section suppression (R-19) and partial selection (R-18).
   */
  effectiveConfig?: EffectiveReportConfig;
}

export interface IReportStrategy {
  /** Produces a complete, byte-perfect PDF buffer ready for Blob storage upload. */
  generate(ctx: ReportGenerationContext): Promise<Buffer>;
}
