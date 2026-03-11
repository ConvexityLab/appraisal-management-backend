/**
 * AcroFormFillStrategy
 *
 * Fills a fillable PDF (AcroForm) template using pdf-lib.
 *
 * Flow:
 *  1. Download blank template PDF from Blob storage (pdf-report-templates container)
 *  2. Resolve the IFieldMapper for this template's mapperKey
 *  3. Build the field→value map from the canonical document
 *  4. Fill every matching AcroForm field
 *  5. Return the flat (non-editable) PDF bytes
 *
 * Deliberately does NOT flatten PDFs — downstream FinalReportService appends
 * custom addenda pages before flattening the final document.
 */

import { PDFDocument } from 'pdf-lib';
import { IReportStrategy, ReportGenerationContext } from './report-strategy.interface';
import { BlobStorageService } from '../../blob-storage.service';
import { IFieldMapper } from '../field-mappers/field-mapper.interface';

/** Container name in Azure Blob where blank fillable PDF templates live. */
const PDF_TEMPLATES_CONTAINER = 'pdf-report-templates';

export class AcroFormFillStrategy implements IReportStrategy {
  /**
   * @param blobStorage  - Injected BlobStorageService (must be configured)
   * @param mappers      - Map of mapperKey → IFieldMapper; resolved at construction time
   */
  constructor(
    private readonly blobStorage: BlobStorageService,
    private readonly mappers: ReadonlyMap<string, IFieldMapper>,
  ) {}

  async generate(ctx: ReportGenerationContext): Promise<Buffer> {
    const { template, canonicalDoc } = ctx;

    if (!template.blobName) {
      throw new Error(
        `Template "${template.id}" (mapperKey: "${template.mapperKey}") has renderStrategy ` +
        `"acroform" but no blobName is set. Set blobName to the fillable PDF filename in ` +
        `the "${PDF_TEMPLATES_CONTAINER}" container.`,
      );
    }

    const mapper = this.mappers.get(template.mapperKey);
    if (!mapper) {
      throw new Error(
        `No IFieldMapper registered for mapperKey "${template.mapperKey}". ` +
        `Register it in the AcroFormFillStrategy mappers Map.`,
      );
    }

    // 1. Fetch the blank template PDF
    const { readableStream } = await this.blobStorage.downloadBlob(
      PDF_TEMPLATES_CONTAINER,
      template.blobName,
    );
    const templateBytes = await AcroFormFillStrategy._streamToBuffer(readableStream);

    // 2. Build field map
    const fieldMap = mapper.mapToFieldMap(canonicalDoc);

    // 3. Load, fill, return
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    for (const [fieldName, rawValue] of Object.entries(fieldMap)) {
      const value = rawValue == null ? '' : String(rawValue);
      try {
        const field = form.getField(fieldName);
        if (field.constructor.name === 'PDFCheckBox') {
          const cb = form.getCheckBox(fieldName);
          value === 'true' ? cb.check() : cb.uncheck();
        } else {
          form.getTextField(fieldName).setText(value);
        }
      } catch {
        // Field not found in this PDF version — skip rather than crash.
        // The PDF inspector script should be run against any new PDF to keep mapper in sync.
      }
    }

    const filledBytes = await pdfDoc.save();
    return Buffer.from(filledBytes);
  }

  private static _streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
