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
import { CanonicalReportDocument } from '../../../types/canonical-schema';

/** Container in Azure Blob where Handlebars templates (.hbs) are stored. */
const PDF_TEMPLATES_CONTAINER = 'pdf-report-templates';

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

    // 4. Compile + render HTML
    const compiledTemplate = Handlebars.compile(hbsSource);
    const html = compiledTemplate(contextWithPhotos);

    // 5. Render to PDF via Playwright
    const pdfBuffer = await this._renderToPdf(html);
    return pdfBuffer;
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
