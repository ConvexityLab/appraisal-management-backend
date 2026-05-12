/**
 * ReportEngineService
 *
 * Dispatcher: resolves the correct render strategy + field mapper for a given
 * template, assembles the CanonicalReportDocument, and returns a generated
 * PDF buffer.
 *
 * Phase 8 — does NOT call createIfNotExists on any Azure resource.
 */

import { ReportTemplate, FinalReportGenerationRequest, ReportSectionConfig } from '../../types/final-report.types';
import { CanonicalReportDocument } from '@l1/shared-types';
import type { EffectiveReportConfig } from '@l1/shared-types';
import { IReportStrategy, ReportGenerationContext } from './strategies/report-strategy.interface';
import { AcroFormFillStrategy } from './strategies/acroform-fill.strategy';
import { HtmlRenderStrategy } from './strategies/html-render.strategy';
import { TemplateRegistryService } from './template-registry/template-registry.service';
import { PhotoResolverService } from './photo-resolver.service';

export class ReportEngineService {
  constructor(
    private readonly templateRegistry: TemplateRegistryService,
    private readonly photoResolver: PhotoResolverService,
    private readonly acroformStrategy: AcroFormFillStrategy,
    private readonly htmlRenderStrategy: HtmlRenderStrategy,
  ) {}

  /**
   * Generates a PDF buffer for the given request and canonical document.
   *
   * @param request        - Generation request (templateId, overrides, etc.)
   * @param canonicalDoc   - Pre-assembled canonical report document for this order
   * @param effectiveConfig - Optional merged report config (R-20); used by strategies
   *                          for section-visibility gating and field suppression.
   * @returns              - Raw PDF bytes
   */
  async generate(
    request: FinalReportGenerationRequest,
    canonicalDoc: CanonicalReportDocument,
    effectiveConfig?: EffectiveReportConfig,
  ): Promise<Buffer> {
    const template = await this.templateRegistry.getTemplate(request.templateId);

    // Merge per-generation overrides onto the template's default sectionConfig
    const effectiveSectionConfig: ReportSectionConfig = {
      ...template.sectionConfig,
      ...(request.sectionOverrides ?? {}),
    };

    // Resolve photos if any section needs them
    let docWithPhotos = canonicalDoc;
    if (
      effectiveSectionConfig.requiresSubjectPhotos ||
      effectiveSectionConfig.requiresCompPhotos ||
      effectiveSectionConfig.requiresAerialMap
    ) {
      const photos = await this.photoResolver.resolveForOrder(
        canonicalDoc.metadata.orderId,
        effectiveSectionConfig,
      );
      docWithPhotos = { ...canonicalDoc, photos };
    }

    const ctx: ReportGenerationContext = {
      request,
      template,
      effectiveSectionConfig,
      canonicalDoc: docWithPhotos,
      ...(effectiveConfig !== undefined ? { effectiveConfig } : {}),
    };

    const strategy = this._pickStrategy(template);
    return strategy.generate(ctx);
  }

  /**
   * Renders the Handlebars template to an HTML string without launching Playwright.
   * Only valid for html-render templates — throws for acroform templates.
   *
   * @param effectiveConfig - Optional merged report config (R-20); controls section visibility in HBS.
   */
  async generateHtml(
    request: FinalReportGenerationRequest,
    canonicalDoc: CanonicalReportDocument,
    effectiveConfig?: EffectiveReportConfig,
  ): Promise<string> {
    const template = await this.templateRegistry.getTemplate(request.templateId);

    if (template.renderStrategy !== 'html-render') {
      throw new Error(
        `HTML preview is only available for html-render templates. ` +
        `Template "${template.id}" uses strategy "${template.renderStrategy}".`,
      );
    }

    const effectiveSectionConfig: ReportSectionConfig = {
      ...template.sectionConfig,
      ...(request.sectionOverrides ?? {}),
    };

    let docWithPhotos = canonicalDoc;
    if (
      effectiveSectionConfig.requiresSubjectPhotos ||
      effectiveSectionConfig.requiresCompPhotos ||
      effectiveSectionConfig.requiresAerialMap
    ) {
      const photos = await this.photoResolver.resolveForOrder(
        canonicalDoc.metadata.orderId,
        effectiveSectionConfig,
      );
      docWithPhotos = { ...canonicalDoc, photos };
    }

    const ctx: ReportGenerationContext = {
      request,
      template,
      effectiveSectionConfig,
      canonicalDoc: docWithPhotos,
      ...(effectiveConfig !== undefined ? { effectiveConfig } : {}),
    };

    return this.htmlRenderStrategy.renderHtml(ctx);
  }

  private _pickStrategy(template: ReportTemplate): IReportStrategy {
    switch (template.renderStrategy) {
      case 'acroform':
        return this.acroformStrategy;
      case 'html-render':
        return this.htmlRenderStrategy;
      default:
        // Exhaustive check — if a new strategy type is added without updating this
        // switch, we surface a loud error at runtime rather than silently falling back.
        throw new Error(
          `Unknown renderStrategy "${(template as { renderStrategy: string }).renderStrategy}" ` +
          `on template "${template.id}". Add a case to ReportEngineService._pickStrategy().`,
        );
    }
  }
}
