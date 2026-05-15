/**
 * HtmlRenderStrategy
 *
 * Compiles a Handlebars template + renders it to PDF via Playwright headless Chromium.
 *
 * Flow:
 *  1. Download the .hbs template blob from the `pdf-report-templates` container
 *  2. Resolve the IFieldMapper for this template's mapperKey
 *  3. Build the Handlebars context from the canonical document
 *  4. Compile and render the HTML string
 *  5. Embed Base64-encoded photos as data URIs in the context
 *  6. Launch Playwright Chromium, navigate to the rendered HTML, print to PDF
 *  7. Return the PDF buffer
 *
 * Playwright is run in a one-shot mode: browser is launched and closed for each
 * generation. For volume generation a browser pool should be introduced (Phase 8f).
 */

import Handlebars from 'handlebars';
import { chromium } from 'playwright';
import { IReportStrategy, ReportGenerationContext } from './report-strategy.interface';
import { BlobStorageService } from '../../blob-storage.service';
import { IFieldMapper } from '../field-mappers/field-mapper.interface';
import { CanonicalReportDocument } from '@l1/shared-types';
import type { EffectiveReportConfig } from '@l1/shared-types';

/** Container in Azure Blob where Handlebars templates (.hbs) are stored. */
const PDF_TEMPLATES_CONTAINER = 'pdf-report-templates';

// ── Handlebars helpers ────────────────────────────────────────────────────────
// Register once at module load — safe because Handlebars.registerHelper is
// idempotent (re-registering under the same name replaces the previous entry).
Handlebars.registerHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
Handlebars.registerHelper('sub', (a: unknown, b: unknown) => Number(a) - Number(b));
Handlebars.registerHelper('eq',  (a: unknown, b: unknown) => a === b);

/**
 * `{{section_visible effectiveConfig "section_key"}}` — R-18
 *
 * Returns `true` when the named section is visible per the merged config.
 * Defaults to `true` when `effectiveConfig` is absent (graceful degradation).
 *
 * Usage in templates:
 *   {{#if (section_visible effectiveConfig "cost_approach")}}
 *     {{> cost_approach_partial}}
 *   {{/if}}
 */
Handlebars.registerHelper(
  'section_visible',
  (config: EffectiveReportConfig | null | undefined, sectionKey: string): boolean => {
    if (!config?.sections) return true;
    const section = config.sections.find((s) => s.key === sectionKey);
    return section?.visible ?? true;
  },
);

/**
 * `{{citeHtml ref}}` — renders an inline citation for html-render templates.
 *
 * If the reference carries a blobUrl the citation becomes a hyperlink that
 * opens to the specific page (fragment #page=N).  Otherwise it renders as a
 * plain styled span so the template degrades gracefully.
 *
 * Example output (with URL):
 *   <a href="https://…blob…#page=4" target="_blank" class="citation-link">[source: Appraisal Report.pdf, p.4]</a>
 */
Handlebars.registerHelper('citeHtml', (ref: {
  documentName?: string;
  page?:         number;
  blobUrl?:      string;
}) => {
  if (!ref) return '';
  const label =
    `[source: ${ref.documentName ?? 'document'}` +
    (ref.page != null ? `, p.${ref.page}` : '') +
    ']';
  if (ref.blobUrl) {
    const href = ref.page != null ? `${ref.blobUrl}#page=${ref.page}` : ref.blobUrl;
    return new Handlebars.SafeString(
      `<a href="${href}" target="_blank" class="citation-link">${label}</a>`,
    );
  }
  return new Handlebars.SafeString(`<span class="citation-ref">${label}</span>`);
});

/**
 * `{{footnoteSup index}}` — renders a superscript footnote marker.
 *
 * Example output:  <sup class="footnote-sup">[3]</sup>
 */
Handlebars.registerHelper('footnoteSup', (index: unknown) => {
  return new Handlebars.SafeString(`<sup class="footnote-sup">[${index}]</sup>`);
});

/** Minimal Playwright PDF print options. Override per template via sectionConfig if needed. */
const DEFAULT_PDF_OPTIONS = {
  format: 'Letter' as const,
  margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
  printBackground: true,
};

export class HtmlRenderStrategy implements IReportStrategy {
  constructor(
    private readonly blobStorage: BlobStorageService,
    private readonly mappers: ReadonlyMap<string, IFieldMapper>,
  ) {}

  async generate(ctx: ReportGenerationContext): Promise<Buffer> {
    const html = await this.renderHtml(ctx);
    const pdfBuffer = await this._renderToPdf(html);
    return pdfBuffer;
  }

  /**
   * Renders the Handlebars template to an HTML string WITHOUT launching Playwright.
   * Use for instant browser previews — the caller can open the HTML in a new tab.
   */
  async renderHtml(ctx: ReportGenerationContext): Promise<string> {
    const { template, canonicalDoc } = ctx;

    if (!template.hbsTemplateName) {
      throw new Error(
        `Template "${template.id}" (mapperKey: "${template.mapperKey}") has renderStrategy ` +
        `"html-render" but no hbsTemplateName is set. Set hbsTemplateName to the .hbs ` +
        `filename in the "${PDF_TEMPLATES_CONTAINER}" container.`,
      );
    }

    const mapper = this.mappers.get(template.mapperKey);
    if (!mapper) {
      throw new Error(
        `No IFieldMapper registered for mapperKey "${template.mapperKey}". ` +
        `Register it in the HtmlRenderStrategy mappers Map.`,
      );
    }

    // 1. Fetch Handlebars template source
    const { readableStream } = await this.blobStorage.downloadBlob(
      PDF_TEMPLATES_CONTAINER,
      template.hbsTemplateName,
    );
    const hbsSource = await HtmlRenderStrategy._streamToString(readableStream);

    // 2. Build template context
    const templateContext = mapper.mapToFieldMap(canonicalDoc);

    // 3. Resolve photos → embed as data URIs in context
    const contextWithPhotos = await this._embedPhotos(templateContext, canonicalDoc);

    // 4. Inject effectiveConfig so templates can call {{section_visible}} (R-18)
    //    and register client-branded Handlebars partials from templateBlocks (R-21).
    await this._registerTemplateBlockPartials(ctx.effectiveConfig?.templateBlocks ?? {});

    const finalContext: Record<string, unknown> = {
      ...contextWithPhotos,
      effectiveConfig: ctx.effectiveConfig ?? null,
      // `branding` is a top-level shortcut so templates can write {{branding.logoUrl}}
      // without needing to navigate through effectiveConfig.
      branding: ctx.effectiveConfig?.reportBranding ?? null,
    };

    // 5. Compile + render HTML
    const compiledTemplate = Handlebars.compile(hbsSource);
    return compiledTemplate(finalContext);
  }

  /**
   * Downloads each blob listed in `templateBlocks` and registers it as a
   * Handlebars partial under the block key (R-21).
   *
   * Blob naming convention: `{clientId}/partials/{blockKey}.hbs`
   * The blob name stored in `templateBlocks` is the full path relative to the
   * `pdf-report-templates` container.
   *
   * Registering is idempotent — re-registering replaces the previous partial.
   * Only called when `templateBlocks` is non-empty, so the fast path (no
   * overrides) incurs zero Blob round-trips.
   */
  private async _registerTemplateBlockPartials(
    templateBlocks: Record<string, string>,
  ): Promise<void> {
    const entries = Object.entries(templateBlocks);
    if (entries.length === 0) return;

    await Promise.all(
      entries.map(async ([blockKey, blobName]) => {
        try {
          const { readableStream } = await this.blobStorage.downloadBlob(
            PDF_TEMPLATES_CONTAINER,
            blobName,
          );
          const source = await HtmlRenderStrategy._streamToString(readableStream);
          Handlebars.registerPartial(blockKey, source);
        } catch (err) {
          // A missing branded partial is non-fatal: the base template's
          // fallback {{else}} block (or inlined content) will render instead.
          // Log and continue — do not abort report generation.
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.warn(
            `[HtmlRenderStrategy] Could not load partial "${blockKey}" from blob ` +
            `"${blobName}": ${message}. Falling back to base template content.`,
          );
        }
      }),
    );
  }

  private async _embedPhotos(
    context: Record<string, unknown>,
    doc: CanonicalReportDocument,
  ): Promise<Record<string, unknown>> {
    if (!doc.photos?.length) return context;

    // Fetch every photo blob and convert to base64 data URI
    const photoDataMap: Record<string, string> = {};
    await Promise.all(
      doc.photos.map(async (photo) => {
        try {
          const parts = photo.blobPath.split('/');
          const containerName = parts[0] ?? 'orders';
          const blobName = parts.slice(1).join('/');
          const { readableStream } = await this.blobStorage.downloadBlob(
            containerName,
            blobName,
          );
          const buf = await HtmlRenderStrategy._streamToBuffer(readableStream);
          const b64 = buf.toString('base64');
          photoDataMap[photo.blobPath] = `data:image/jpeg;base64,${b64}`;
        } catch {
          // Photo unavailable — leave slot empty; template must handle null gracefully.
          photoDataMap[photo.blobPath] = '';
        }
      }),
    );

    // Patch blobPath references in context with resolved data URIs
    return JSON.parse(
      JSON.stringify(context, (_k, v) => {
        if (typeof v === 'object' && v !== null && 'blobPath' in v && typeof v.blobPath === 'string') {
          return { ...v, dataUri: photoDataMap[v.blobPath] ?? '' };
        }
        return v;
      }),
    ) as Record<string, unknown>;
  }

  private async _renderToPdf(html: string): Promise<Buffer> {
    // In containerised deployments (alpine), point Playwright at the system Chromium binary.
    const executablePath = process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH']
      ?? (process.env['NODE_ENV'] === 'production' ? '/usr/bin/chromium-browser' : undefined);

    const browser = await chromium.launch({
      ...(executablePath !== undefined ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdfBytes = await page.pdf(DEFAULT_PDF_OPTIONS);
      return Buffer.from(pdfBytes);
    } finally {
      await browser.close();
    }
  }

  private static _streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer | string) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }

  private static _streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer | string) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
