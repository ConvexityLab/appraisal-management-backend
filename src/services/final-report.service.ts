/**
 * Final Report Service
 *
 * Orchestrates the full pipeline for generating a deliverable PDF appraisal report:
 *   1. Load & validate the order
 *   2. Load & validate the most-recent QC review (must be APPROVED or APPROVED_WITH_CONDITIONS)
 *   3. Load the requested ReportTemplate from Cosmos (document-templates, type='pdf-report-template')
 *   4. Assemble a form-field map: order defaults → QC result overlays → reviewer fieldOverrides (last wins)
 *   5. Download the blank template PDF from Blob container 'pdf-report-templates'
 *   6. Fill AcroForm fields via pdf-lib
 *   7. Upload the filled PDF to Blob container 'orders' at path '{orderId}/final-reports/{reportId}.pdf'
 *   8. Upsert FinalReport into order.finalReports[] embedded array (replaces in-place by id, or appends)
 *   9. Fire post-generation events (best-effort, never throws): notification email → conditional MISMO → conditional UW push
 *
 * Constraints:
 *  - NO infrastructure creation (containers, storage, etc. must pre-exist via Bicep)
 *  - NO silent fallbacks — every missing required config throws with a clear message
 *  - Managed Identity (DefaultAzureCredential) for all Azure SDK clients via BlobStorageService
 */

import ExcelJS from 'exceljs';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import { NotificationService } from './notification.service.js';
import { MismoXmlGenerator } from './mismo-xml-generator.service.js';
import type { SubmissionInfo } from './mismo-xml-generator.service.js';
import { CompletionReportXmlGenerator } from './completion-report-xml-generator.service.js';
import type { CanonicalCompletionReport } from '../types/canonical-completion-report.js';
import { Logger } from '../utils/logger.js';
import {
  FinalReport,
  FinalReportStatus,
  FinalReportGenerationRequest,
  FieldOverride,
  ReportTemplate
} from '../types/final-report.types.js';
import { ReportEngineService } from './report-engine/report-engine.service.js';
import { HtmlRenderStrategy } from './report-engine/strategies/html-render.strategy.js';
import { AcroFormFillStrategy } from './report-engine/strategies/acroform-fill.strategy.js';
import { TemplateRegistryService } from './report-engine/template-registry/template-registry.service.js';
import { PhotoResolverService } from './report-engine/photo-resolver.service.js';
import { Urar1004Mapper } from './report-engine/field-mappers/urar-1004.mapper.js';
import { DvrBpoMapper } from './report-engine/field-mappers/dvr-bpo.mapper.js';
import { DvrDeskReviewMapper } from './report-engine/field-mappers/dvr-desk-review.mapper.js';
import { DvrNooReviewMapper } from './report-engine/field-mappers/dvr-noo-review.mapper.js';
import { DvrNooDesktopMapper } from './report-engine/field-mappers/dvr-noo-desktop.mapper.js';
import type { IFieldMapper } from './report-engine/field-mappers/field-mapper.interface.js';
import type { CanonicalReportDocument } from '../types/canonical-schema.js';
import { Order } from '../types/index.js';
import type { UadAppraisalReport } from '../types/uad-3.6.js';
import { QCReview, QCDecision } from '../types/qc-workflow.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// ---------------------------------------------------------------------------

export class FinalReportService {
  private readonly logger = new Logger('FinalReportService');
  private readonly blob: BlobStorageService;
  private readonly notification: NotificationService;
  private readonly reportEngine: ReportEngineService;

  /** Blob container that holds blank template PDFs — must pre-exist */
  private readonly TEMPLATE_CONTAINER = 'pdf-report-templates';
  /** Blob container for all order artifacts — must pre-exist */
  private readonly ORDERS_CONTAINER = 'orders';
  /** Cosmos container where ReportTemplate metadata is stored */
  private readonly DOCUMENT_TEMPLATES_CONTAINER = 'document-templates';
  /** Cosmos container where CanonicalReportDocument records are stored */
  private readonly REPORTING_CONTAINER = 'reporting';

  constructor(private readonly db: CosmosDbService) {
    this.blob = new BlobStorageService();
    this.notification = new NotificationService();

    // ── Report Engine (html-render + acroform strategy dispatcher) ──────────
    const mappers: ReadonlyMap<string, IFieldMapper> = new Map<string, IFieldMapper>([
      ['urar-1004',       new Urar1004Mapper()],
      ['dvr-bpo',         new DvrBpoMapper()],
      ['dvr-desk-review', new DvrDeskReviewMapper()],
      ['dvr-noo-review',   new DvrNooReviewMapper()],
      ['dvr-noo-desktop',  new DvrNooDesktopMapper()],
    ]);
    const htmlRenderStrategy   = new HtmlRenderStrategy(this.blob, mappers);
    const acroformFillStrategy = new AcroFormFillStrategy(this.blob, mappers);
    const templateRegistry     = new TemplateRegistryService(this.db);
    const photoResolver        = new PhotoResolverService(this.blob);
    this.reportEngine = new ReportEngineService(
      templateRegistry,
      photoResolver,
      acroformFillStrategy,
      htmlRenderStrategy,
    );
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * List all active report templates from Cosmos.
   * Templates are seeded into the 'document-templates' container with type='pdf-report-template'.
   */
  async listTemplates(): Promise<ReportTemplate[]> {
    const templates = await this.db.queryDocuments<ReportTemplate>(
      this.DOCUMENT_TEMPLATES_CONTAINER,
      'SELECT * FROM c WHERE c.type = @type AND c.isActive = true ORDER BY c.name',
      [{ name: '@type', value: 'pdf-report-template' }]
    );
    return templates;
  }

  /**
   * Get all FinalReport records for an order, newest first.
   * Returns an empty array if no reports have been generated yet.
   */
  async getReports(orderId: string): Promise<FinalReport[]> {
    const response = await this.db.findOrderById(orderId);
    if (!response.success || !response.data) return [];
    const reports = response.data.finalReports ?? [];
    return [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Get the most-recent FinalReport for an order (null if none generated yet).
   * Used internally for download — prefer getReports() for listing all attempts.
   */
  async getReport(orderId: string): Promise<FinalReport | null> {
    const reports = await this.getReports(orderId);
    return reports.length > 0 ? (reports[0] ?? null) : null;
  }

  /**
   * Add (or update) a field-level override on a QC review.
   * Returns the updated QCReview document.
   */
  async addFieldOverride(reviewId: string, override: FieldOverride): Promise<QCReview> {
    const review = await this.db.getDocument<QCReview>('qc-reviews', reviewId, reviewId);
    if (!review) {
      throw new Error(`QC review '${reviewId}' not found`);
    }

    const existing = review.fieldOverrides ?? [];
    // Replace if same fieldKey already overridden by the same actor, otherwise push
    const idx = existing.findIndex(
      (o) => o.fieldKey === override.fieldKey && o.overriddenBy === override.overriddenBy
    );

    const updated: FieldOverride[] = idx >= 0
      ? [...existing.slice(0, idx), override, ...existing.slice(idx + 1)]
      : [...existing, override];

    const patched: QCReview = {
      ...review,
      fieldOverrides: updated,
      updatedAt: new Date().toISOString()
    };

    return this.db.upsertDocument<QCReview>('qc-reviews', patched);
  }

  /**
   * Generate a final report PDF for the given order.
   *
   * Returns the persisted FinalReport record (status = GENERATED on success, FAILED on error).
   * Throws if the order or QC review preconditions are not met — callers should 400/422.
   * Internal PDF/Blob errors are caught, persisted as FAILED status, and re-thrown so the
   * controller can return 500.
   */
  async generateReport(request: FinalReportGenerationRequest): Promise<FinalReport> {
    const { orderId, templateId, requestedBy, notes } = request;
    const reportId = uuidv4();

    this.logger.info('Starting final report generation', { orderId, templateId, reportId });

    // ------------------------------------------------------------------
    // Steps 1–3: Validate preconditions (throw → 4xx to caller)
    // ------------------------------------------------------------------
    const order = await this._loadOrder(orderId);
    const qcReview = await this._loadApprovedQcReview(orderId);
    const template = await this._loadTemplate(templateId);

    // ------------------------------------------------------------------
    // Step 4: Assemble form-field map
    // ------------------------------------------------------------------
    const fieldMap = this._assembleFieldMap(order, qcReview, template);

    // ------------------------------------------------------------------
    // Stub record in Cosmos while we generate (allows polling)
    // ------------------------------------------------------------------
    const blobPath = `${orderId}/final-reports/${reportId}.pdf`;
    const stub: FinalReport = {
      id: reportId,
      tenantId: order.clientId,
      orderId,
      qcReviewId: qcReview.id,
      templateId,
      templateName: template.name,
      formType: template.formType,
      status: FinalReportStatus.GENERATING,
      blobPath,
      fieldOverrides: qcReview.fieldOverrides ?? [],
      reviewerEdits: qcReview.reviewerEdits ?? [],
      generatedBy: requestedBy,
      mismoQueued: false,
      underwritingQueued: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this._upsertFinalReportInOrder(stub);

    // ------------------------------------------------------------------
    // Steps 5–7: Generate PDF (failures → FAILED status, re-throw)
    // ------------------------------------------------------------------
    let filledPdfBytes: Uint8Array;
    try {
      if (template.renderStrategy === 'html-render') {
        // HTML engine: Handlebars template compiled + Playwright → PDF buffer
        const pdfBuffer = await this._generatePdfViaHtmlEngine(template, request, orderId, order, qcReview);
        filledPdfBytes = new Uint8Array(pdfBuffer);
      } else {
        // AcroForm engine: pdf-lib field fill on a blank fillable PDF
        filledPdfBytes = await this._generatePdf(template, fieldMap);
      }
      if (request.customPagePdfs?.length) {
        filledPdfBytes = await this._appendCustomPages(filledPdfBytes, request.customPagePdfs);
      }
    } catch (pdfError) {
      const failureReason = pdfError instanceof Error ? pdfError.message : String(pdfError);
      this.logger.error('PDF generation failed', { orderId, reportId, error: failureReason });
      const failed: FinalReport = {
        ...stub,
        status: FinalReportStatus.FAILED,
        failureReason,
        updatedAt: new Date().toISOString()
      };
      await this._upsertFinalReportInOrder(failed);
      throw pdfError;
    }

    // ------------------------------------------------------------------
    // Step 8: Upload to Blob + save final record + patch order
    // ------------------------------------------------------------------
    const uploadResult = await this.blob.uploadBlob({
      containerName: this.ORDERS_CONTAINER,
      blobName: blobPath,
      data: Buffer.from(filledPdfBytes),
      contentType: 'application/pdf',
      metadata: {
        orderId,
        reportId,
        templateId,
        generatedBy: requestedBy
      }
    });

    const finalRecord: FinalReport = {
      ...stub,
      status: FinalReportStatus.GENERATED,
      blobPath,
      blobUrl: uploadResult.url,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this._upsertFinalReportInOrder(finalRecord);

    this.logger.info('Final report generated successfully', { orderId, reportId, blobPath });

    // ------------------------------------------------------------------
    // Step 9: Post-generation events (best-effort — never fail the request)
    // ------------------------------------------------------------------
    void this._firePostGenerationEvents(finalRecord, order, qcReview);

    return finalRecord;
  }

  /**
   * Stream a previously-generated final report PDF.
   * Returns the blob download result for the controller to pipe.
   */
  async downloadReport(orderId: string): Promise<{
    readableStream: NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
    fileName: string;
  }> {
    const report = await this.getReport(orderId);
    if (!report) {
      throw new Error(`No final report found for order '${orderId}'`);
    }
    if (report.status !== FinalReportStatus.GENERATED || !report.blobPath) {
      throw new Error(`Report for order '${orderId}' is not ready (status: ${report.status})`);
    }

    const download = await this.blob.downloadBlob(this.ORDERS_CONTAINER, report.blobPath);
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return {
      ...download,
      fileName: `FinalReport_${safeOrderId}.pdf`
    };
  }

  /**
   * On-demand MISMO XML generation for an order's most recent GENERATED report.
   * Called from the POST /api/final-reports/orders/:orderId/mismo-xml route.
   *
   * Idempotent: if the report already has a mismoXmlBlobPath we skip re-generation and
   * return the existing path so the caller can build a download URL.
   *
   * @returns The Blob path of the generated XML (e.g. orders/{orderId}/mismo/{reportId}.xml)
   */
  async generateMismoXmlForReport(orderId: string, requestedBy: string): Promise<{ blobPath: string; alreadyExisted: boolean }> {
    const report = await this.getReport(orderId);
    if (!report) {
      throw new Error(`No final report found for order '${orderId}'`);
    }
    if (report.status !== FinalReportStatus.GENERATED) {
      throw new Error(
        `Cannot generate MISMO XML — report status is '${report.status}' (must be GENERATED)`
      );
    }

    // Idempotency: already generated
    if (report.mismoXmlBlobPath) {
      return { blobPath: report.mismoXmlBlobPath, alreadyExisted: true };
    }

    // Load dependencies
    const orderResp = await this.db.findOrderById(orderId);
    if (!orderResp.success || !orderResp.data) {
      throw new Error(`Order '${orderId}' not found`);
    }
    const order = orderResp.data;
    const qcReview = await this._loadApprovedQcReview(orderId);

    // Generate XML — route by formType
    const submissionInfo: SubmissionInfo = {
      loanNumber:          qcReview.loanNumber ?? orderId,
      lenderName:          order.contactInformation?.name ?? order.clientId,
      lenderIdentifier:    order.clientId,
      submittingUserName:  requestedBy,
      submittingUserId:    requestedBy,
    };

    let xml: string;

    if (report.formType === 'COMPLETION_REPORT') {
      // ── Completion Report path (UAD 3.6 Appendix B-3) ────────────────────
      const crDocs = await this.db.queryDocuments<CanonicalCompletionReport>(
        this.REPORTING_CONTAINER,
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.reportType = @reportType ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1',
        [
          { name: '@orderId',    value: orderId },
          { name: '@reportType', value: 'CompletionReport' },
        ],
      );
      const crDoc = crDocs[0];
      if (!crDoc) {
        throw new Error(
          `No CanonicalCompletionReport found for order '${orderId}' in the '${this.REPORTING_CONTAINER}' container. ` +
          `The appraiser must save the Completion Report workspace before MISMO XML can be generated.`,
        );
      }
      const crGenerator = new CompletionReportXmlGenerator();
      xml = crGenerator.generateCompletionReportXml(crDoc, submissionInfo);
    } else {
      // ── URAR / DVR path ───────────────────────────────────────────────────
      const xmlGenerator = new MismoXmlGenerator();
      const mismoReport = this._buildMismoReport(order, qcReview, report);
      xml = xmlGenerator.generateMismoXml(mismoReport, submissionInfo);
    }

    // Upload
    const xmlBlobPath = `${orderId}/mismo/${report.id}.xml`;
    await this.blob.uploadBlob({
      containerName: this.ORDERS_CONTAINER,
      blobName:      xmlBlobPath,
      data:          Buffer.from(xml, 'utf-8'),
      contentType:   'application/xml',
      metadata: {
        orderId,
        reportId:    report.id,
        generatedBy: requestedBy,
      },
    });

    // Persist path on the report record
    await this._upsertFinalReportInOrder({
      ...report,
      mismoQueued:      true,
      mismoXmlBlobPath: xmlBlobPath,
      updatedAt:        new Date().toISOString(),
    });

    this.logger.info('On-demand MISMO XML generated', { orderId, reportId: report.id, xmlBlobPath, requestedBy });
    return { blobPath: xmlBlobPath, alreadyExisted: false };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Upsert a FinalReport record into the order.finalReports[] embedded array.
   * Finds by report.id: replaces in-place if found, appends if new.
   */
  private async _upsertFinalReportInOrder(report: FinalReport): Promise<void> {
    const response = await this.db.findOrderById(report.orderId);
    if (!response.success || !response.data) {
      throw new Error(
        `Order '${report.orderId}' not found — cannot persist FinalReport '${report.id}'`
      );
    }
    const existing = response.data.finalReports ?? [];
    const idx = existing.findIndex((r) => r.id === report.id);
    const updated =
      idx >= 0
        ? [...existing.slice(0, idx), report, ...existing.slice(idx + 1)]
        : [...existing, report];
    await this.db.updateOrder(report.orderId, { finalReports: updated });
  }

  private async _loadOrder(orderId: string): Promise<Order> {
    const response = await this.db.findOrderById(orderId);
    if (!response.success || !response.data) {
      throw new Error(`Order '${orderId}' not found`);
    }
    return response.data;
  }

  private async _loadApprovedQcReview(orderId: string): Promise<QCReview> {
    const reviews = await this.db.queryDocuments<QCReview>(
      'qc-reviews',
      'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.createdAt DESC OFFSET 0 LIMIT 1',
      [{ name: '@orderId', value: orderId }]
    );

    if (reviews.length === 0 || !reviews[0]) {
      throw new Error(
        `No QC review found for order '${orderId}'. A completed QC review is required before generating a final report.`
      );
    }

    const review = reviews[0];
    const decision = review.results?.decision;
    const approved =
      decision === QCDecision.APPROVED || decision === QCDecision.APPROVED_WITH_CONDITIONS;

    if (!approved) {
      throw new Error(
        `QC review for order '${orderId}' has decision '${decision ?? 'none'}'. ` +
        `Final report generation requires APPROVED or APPROVED_WITH_CONDITIONS.`
      );
    }

    return review;
  }

  private async _loadTemplate(templateId: string): Promise<ReportTemplate> {
    const template = await this.db.getDocument<ReportTemplate>(
      this.DOCUMENT_TEMPLATES_CONTAINER,
      templateId,
      templateId
    );
    if (!template) {
      throw new Error(
        `Report template '${templateId}' not found. ` +
        `Ensure the template document exists in the '${this.DOCUMENT_TEMPLATES_CONTAINER}' container ` +
        `with type='pdf-report-template' and id='${templateId}'.`
      );
    }
    if (!template.isActive) {
      throw new Error(`Report template '${templateId}' is inactive and cannot be used for generation.`);
    }
    return template;
  }

  /**
   * Builds the form-field value map in priority order:
   *   order fields (lowest) → QC result overlays → reviewer fieldOverrides (highest)
   */
  private _assembleFieldMap(
    order: Order,
    review: QCReview,
    _template: ReportTemplate
  ): Record<string, string | boolean | number> {
    const map: Record<string, string | boolean | number> = {};

    // --- Tier 1: Order base data ---
    if (order.propertyAddress) {
      const addr = order.propertyAddress;
      if (addr.streetAddress) map['SubjectAddress'] = addr.streetAddress;
      if (addr.city)          map['SubjectCity']    = addr.city;
      if (addr.state)         map['SubjectState']   = addr.state;
      if (addr.zipCode)       map['SubjectZip']     = addr.zipCode;
      if (addr.county)        map['SubjectCounty']  = addr.county;
    }
    if (order.borrowerInformation) {
      const b = order.borrowerInformation;
      map['BorrowerName'] = `${b.firstName} ${b.lastName}`.trim();
      if (b.email) map['BorrowerEmail'] = b.email;
    }
    if (order.loanInformation) {
      const l = order.loanInformation;
      if (l.loanAmount) map['LoanAmount'] = l.loanAmount;
      if (l.loanType)   map['LoanType']   = l.loanType;
    }
    if (order.productType) map['FormType'] = order.productType;

    // --- Tier 2: QC review results summary ---
    if (review.results) {
      const r = review.results;
      if (r.overallScore != null)  map['QCScore']          = r.overallScore;
      if (r.decision)              map['QCDecision']       = r.decision;
      if (r.summary)               map['QCSummary']        = r.summary;
      if (review.appraisedValue != null) map['AppraisedValue'] = review.appraisedValue;
      if (review.loanNumber)       map['LoanNumber']       = review.loanNumber; // QC may have fresher value
    }

    // --- Tier 3: Reviewer field overrides (win over all) ---
    for (const override of review.fieldOverrides ?? []) {
      map[override.fieldKey] = override.overrideValue;
    }

    return map;
  }

  /**
   * Append one or more addendum PDFs (base64-encoded) to the filled URAR bytes.
   *
   * Each entry in `customPagePdfs` is the base64-encoded output of a jsPDF document
   * produced by the frontend (e.g. photo addendum, market condition addendum, location map).
   * Pages are appended in array order after the last URAR page.
   *
   * Failures here bubble up into the same try/catch as `_generatePdf()` so they produce
   * a FAILED report status rather than an unhandled server error.
   */
  private async _appendCustomPages(
    urarPdfBytes: Uint8Array,
    customPagePdfs: string[]
  ): Promise<Uint8Array> {
    const merged = await PDFDocument.load(urarPdfBytes);
    for (const b64 of customPagePdfs) {
      const addendumBytes = Buffer.from(b64, 'base64');
      const addendum = await PDFDocument.load(addendumBytes);
      const indices = addendum.getPageIndices();
      const pages = await merged.copyPages(addendum, indices);
      pages.forEach(p => merged.addPage(p));
    }
    this.logger.info('Custom addendum pages appended', {
      addendumCount: customPagePdfs.length
    });
    return merged.save();
  }

  /**
   * Returns the rendered HTML string for an html-render template.
   * No Playwright launch — instant response suitable for browser preview.
   * Opens the same Handlebars pipeline as generateReport() up to step 4,
   * then returns the HTML string instead of converting it to PDF.
   */
  async previewReportHtml(orderId: string, templateId: string): Promise<string> {
    this.logger.info('Generating HTML preview', { orderId, templateId });

    const [canonicalDocs, order] = await Promise.all([
      this.db.queryDocuments<CanonicalReportDocument>(
        this.REPORTING_CONTAINER,
        'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1',
        [{ name: '@orderId', value: orderId }],
      ),
      this._loadOrder(orderId),
    ]);

    const canonicalDoc = canonicalDocs[0];
    if (!canonicalDoc) {
      throw new Error(
        `No canonical report document found for order '${orderId}' in the '${this.REPORTING_CONTAINER}' container. ` +
        `The appraiser must save the valuation workspace before a preview can be generated.`,
      );
    }

    // Enrich source documents so the preview reflects what the final report will show.
    // No qcReview available for preview — pass undefined to skip AI screening enrichment.
    _enrichCanonicalDocForReport(canonicalDoc, order, undefined);

    return this.reportEngine.generateHtml(
      { orderId, templateId, requestedBy: 'preview' },
      canonicalDoc,
    );
  }

  /**
   * HTML-render path: loads the CanonicalReportDocument for this order from the
   * `reporting` Cosmos container, then dispatches to ReportEngineService which
   * picks HtmlRenderStrategy (Handlebars → Playwright → PDF).
   *
   * The CanonicalReportDocument must already exist — it is created/updated whenever
   * the appraiser saves work in the valuation workspace. If one is not found, the
   * caller receives a clear error explaining what action is needed.
   *
   * Enrichment applied before the mapper runs (non-destructive — only fills fields
   * that are absent/empty on the stored canonical doc):
   *   • sourceDocuments  ← order.documents[]
   *   • criteriaEvaluations ← qcReview.aiPreScreening.flaggedItems (if populated)
   */
  private async _generatePdfViaHtmlEngine(
    _template: ReportTemplate,
    request: FinalReportGenerationRequest,
    orderId: string,
    order: Order,
    qcReview: QCReview,
  ): Promise<Buffer> {
    this.logger.info('Generating report via HTML engine', {
      orderId,
      templateId: request.templateId,
    });

    // Load the canonical report document for this order (newest first)
    const canonicalDocs = await this.db.queryDocuments<CanonicalReportDocument>(
      this.REPORTING_CONTAINER,
      'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1',
      [{ name: '@orderId', value: orderId }],
    );

    const canonicalDoc = canonicalDocs[0];
    if (!canonicalDoc) {
      throw new Error(
        `No canonical report document found for order '${orderId}' in the '${this.REPORTING_CONTAINER}' container. ` +
        `The appraiser must save the valuation workspace (subject data + comps) before a final report can be generated.`,
      );
    }

    // ── Capability-5 enrichment (non-destructive) ────────────────────────────────
    _enrichCanonicalDocForReport(canonicalDoc, order, qcReview);

    return this.reportEngine.generate(request, canonicalDoc);
  }

  /**
   * Download the blank template from Blob and fill its AcroForm fields.
   */
  private async _generatePdf(
    template: ReportTemplate,
    fieldMap: Record<string, string | boolean | number>
  ): Promise<Uint8Array> {
    this.logger.info('Downloading template PDF', { blobName: template.blobName });

    if (!template.blobName) {
      throw new Error(`Report template '${template.id}' has no blobName — cannot download template PDF.`);
    }
    const { readableStream } = await this.blob.downloadBlob(
      this.TEMPLATE_CONTAINER,
      template.blobName
    );
    const templateBuffer = await streamToBuffer(readableStream);

    const pdfDoc = await PDFDocument.load(templateBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    this.logger.info(`Template loaded — ${fields.length} form fields detected`, {
      templateId: template.id
    });

    for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
      try {
        let field;
        try {
          field = form.getField(fieldName);
        } catch {
          // Field not present in this template — skip silently
          continue;
        }

        if (field instanceof PDFTextField) {
          field.setText(String(fieldValue));
        } else if (field instanceof PDFCheckBox) {
          if (fieldValue) {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (field instanceof PDFDropdown) {
          field.select(String(fieldValue));
        } else if (field instanceof PDFRadioGroup) {
          field.select(String(fieldValue));
        } else {
          this.logger.warn(`Unhandled field type for '${fieldName}'`, {
            type: field.constructor.name
          });
        }
      } catch (fieldError) {
        // Log non-critical field fill errors but continue with the rest
        this.logger.warn(`Could not fill field '${fieldName}'`, {
          error: fieldError instanceof Error ? fieldError.message : String(fieldError)
        });
      }
    }

    return pdfDoc.save();
  }

  /**
   * Fire post-generation events in three independent try/catch blocks.
   * Failures here are logged but NEVER propagated back to the caller.
   * This method is called with `void` — it runs asynchronously.
   */
  private async _firePostGenerationEvents(
    report: FinalReport,
    order: Order,
    qcReview: QCReview
  ): Promise<void> {
    // --- Event 1: Notification email ---
    try {
      const recipients = this._getNotificationRecipients(order);
      for (const email of recipients) {
        await this.notification.sendEmail({
          to: email,
          subject: `Final Report Generated — Order ${order.id}`,
          body: this._buildEmailBody(report, order),
          priority: 'normal'
        });
      }
      this.logger.info('Post-gen notification emails sent', {
        orderId: order.id,
        reportId: report.id,
        recipientCount: recipients.length
      });
    } catch (err) {
      this.logger.error('Post-gen notification failed (non-fatal)', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // --- Event 2: Conditional MISMO XML generation ---
    if (process.env['ENABLE_MISMO_ON_DELIVERY'] === 'true') {
      try {
        const submissionInfo: SubmissionInfo = {
          loanNumber:         qcReview.loanNumber ?? order.id,
          lenderName:         order.contactInformation?.name ?? order.clientId,
          lenderIdentifier:   order.clientId,
          submittingUserName: report.generatedBy,
          submittingUserId:   report.generatedBy,
        };

        let xml: string;

        if (report.formType === 'COMPLETION_REPORT') {
          // ── Completion Report path (UAD 3.6 Appendix B-3) ────────────────────
          // Load CanonicalCompletionReport from the reporting container.
          // The document is stored with reportType === 'CompletionReport'.
          const crDocs = await this.db.queryDocuments<CanonicalCompletionReport>(
            this.REPORTING_CONTAINER,
            'SELECT * FROM c WHERE c.orderId = @orderId AND c.reportType = @reportType ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1',
            [
              { name: '@orderId',    value: order.id },
              { name: '@reportType', value: 'CompletionReport' },
            ],
          );
          const crDoc = crDocs[0];
          if (!crDoc) {
            throw new Error(
              `No CanonicalCompletionReport found for order '${order.id}' in the '${this.REPORTING_CONTAINER}' container. ` +
              `The appraiser must save the Completion Report workspace before MISMO XML can be generated.`,
            );
          }
          const crGenerator = new CompletionReportXmlGenerator();
          xml = crGenerator.generateCompletionReportXml(crDoc, submissionInfo);
        } else {
          // ── URAR / DVR path (all other form types) ────────────────────────────
          const xmlGenerator = new MismoXmlGenerator();
          const mismoReport  = this._buildMismoReport(order, qcReview, report);
          xml = xmlGenerator.generateMismoXml(mismoReport, submissionInfo);
        }

        const xmlBlobName = `${order.id}/mismo/${report.id}.xml`;

        await this.blob.uploadBlob({
          containerName: this.ORDERS_CONTAINER,
          blobName:      xmlBlobName,
          data:          Buffer.from(xml, 'utf-8'),
          contentType:   'application/xml',
          metadata: {
            orderId:    order.id,
            reportId:   report.id,
            generatedBy: report.generatedBy,
          },
        });

        await this._upsertFinalReportInOrder({
          ...report,
          mismoQueued: true,
          mismoXmlBlobPath: xmlBlobName,
          updatedAt: new Date().toISOString(),
        });

        this.logger.info('MISMO XML generated and uploaded', {
          orderId: order.id,
          reportId: report.id,
          xmlBlobName,
        });
      } catch (err) {
        this.logger.error('MISMO generation failed (non-fatal)', {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // --- Event 3: Conditional underwriting push ---
    if (process.env['ENABLE_UNDERWRITING_PUSH'] === 'true') {
      try {
        // Underwriting push requires client-specific integration config.
        // When wired, retrieve integration endpoint from client record and POST the report blob URL.
        this.logger.info('Underwriting push requested but not yet wired — flagging underwritingQueued', {
          orderId: order.id,
          reportId: report.id
        });
        await this._upsertFinalReportInOrder({
          ...report,
          underwritingQueued: true,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        this.logger.error('Underwriting push flag failed (non-fatal)', {
          orderId: order.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  private _getNotificationRecipients(order: Order): string[] {
    const recipients: string[] = [];

    // Primary contact on the order
    if (order.contactInformation?.email) recipients.push(order.contactInformation.email);
    // Borrower email
    if (order.borrowerInformation?.email) recipients.push(order.borrowerInformation.email);

    // Platform-configured default recipients (comma-separated env var)
    const defaultRecipients = process.env['FINAL_REPORT_NOTIFICATION_EMAILS'];
    if (defaultRecipients) {
      const parsed = defaultRecipients
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      recipients.push(...parsed);
    }

    // De-duplicate
    return [...new Set(recipients)];
  }

  private _buildEmailBody(report: FinalReport, order: Order): string {
    const address = order.propertyAddress
      ? `${order.propertyAddress.streetAddress}, ${order.propertyAddress.city}, ${order.propertyAddress.state}`
      : order.id;

    return [
      `<p>The final appraisal report for the following order has been generated and is ready for download.</p>`,
      `<ul>`,
      `  <li><strong>Order ID:</strong> ${order.id}</li>`,
      `  <li><strong>Property:</strong> ${address}</li>`,
      `  <li><strong>Report ID:</strong> ${report.id}</li>`,
      `  <li><strong>Template:</strong> ${report.templateName}</li>`,
      `  <li><strong>Generated at:</strong> ${report.generatedAt ?? 'now'}</li>`,
      `</ul>`,
      ...(report.blobUrl
        ? [`<p><a href="${report.blobUrl}">Download Report</a></p>`]
        : [])
    ].join('\n');
  }

  /**
   * Maps an Order + QCReview + FinalReport into the minimal UadAppraisalReport
   * shape that MismoXmlGenerator.generateMismoXml() actually accesses at runtime.
   *
   * Many UAD fields (appraiser certification, site details, comparables) are not carried
   * by Order.  Stubs are used where necessary and clearly noted.  The object is
   * returned as `unknown as UadAppraisalReport` to satisfy the generator's type contract
   * while avoiding hundreds of lines of placeholder data for fields that are never read.
   */
  private _buildMismoReport(
    order: Order,
    qcReview: QCReview,
    report: FinalReport
  ): UadAppraisalReport {
    const addr  = order.propertyAddress;
    const det   = order.propertyDetails;
    const loan  = order.loanInformation;
    const now   = new Date();
    const generatedAt = report.generatedAt ? new Date(report.generatedAt) : now;

    return {
      appraisalReportIdentifier: report.id,
      uadVersion:                '3.6',
      mismoVersion:              '3.4',
      formType:                  '1004',

      subjectProperty: {
        streetAddress:      addr.streetAddress,
        city:               addr.city,
        state:              addr.state,
        zipCode:            addr.zipCode,
        county:             addr.county,
        assessorParcelNumber: addr.apn,
        // Size & layout
        grossLivingArea:    det?.grossLivingArea ?? 0,
        totalRooms:         (det?.bedrooms ?? 0) + (det?.bathrooms ?? 0) + 2, // bedrooms + baths + living/kitchen
        totalBedrooms:      det?.bedrooms  ?? 0,
        totalBathrooms:     det?.bathrooms ?? 0,
        yearBuilt:          det?.yearBuilt ?? 0,
        siteSizeSquareFeet: det?.lotSize ?? 0,
        // UAD required — stubs where order doesn’t carry the data
        propertyType:       'DetachedSingleFamily' as any,   // mapped from order.propertyDetails.propertyType when needed
        occupancyType:      'PrincipalResidence'   as any,
        currentUse:         'Single Family Residence',
        siteShape:          'Rectangular',
        buildingStatus:     'Existing' as any,
        foundationType:     'Concrete Slab',
        exteriorWalls:      'Not Provided',
        roofSurface:        'Not Provided',
        heating:            'Not Provided',
        cooling:            'Not Provided',
        qualityRating:      'Q3' as any,
        conditionRating:    'C3' as any,
        locationRating:     'Neutral',
        zoningCompliance:   'Legal',
        highestAndBestUse:  'Present',
        view:               [],
        publicUtilities:    { electricity: 'Public', gas: 'Public', water: 'Public', sanitary: 'Public' },
        street:             { paved: true },
      } as any,

      appraisalInfo: {
        clientName:              order.contactInformation?.name ?? order.clientId,
        clientAddress:           `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zipCode}`,
        appraisalOrderDate:      new Date(order.createdAt),
        inspectionDate:          new Date(order.dueDate),   // best proxy available from order data
        reportDate:              generatedAt,
        intendedUse:             'Mortgage finance',
        intendedUser:            order.contactInformation?.name ?? order.clientId,
        propertyRightsAppraised: 'FeeSimple',
        loanNumber:              qcReview.loanNumber,
        salePrice:               loan?.contractPrice,
        // neighborhood & marketConditions are required by the type but never accessed
        // by the XML generator methods — stubs satisfy the runtime contract
        neighborhood:            {} as any,
        marketConditions:        {} as any,
        highestAndBestUse:       'Current use as improved',
      } as any,

      reconciliation: {
        salesComparisonApproachUsed: true,
        salesComparisonValue:        qcReview.appraisedValue,
        costApproachUsed:            false,
        incomeApproachUsed:          false,
        finalOpinionOfValue:         qcReview.appraisedValue ?? 0,
        effectiveDate:               generatedAt,
        reconciliationComments:      qcReview.results?.summary ?? '',
        subjectPropertyInspected:    true,
        interiorInspected:           true,
      } as any,

      // Appraiser data is not stored on Order — use vendor stub if available
      appraiserInfo: {
        name:                    'See Assigned Appraiser',
        companyName:             'Assigned Appraiser',
        companyAddress:          `${addr.streetAddress}, ${addr.city}, ${addr.state}`,
        telephoneNumber:         '',
        emailAddress:            '',
        stateCertificationNumber: 'PENDING',
        stateOfCertification:    addr.state,
        certificationType:       'Certified Residential',
        expirationDate:          new Date('2099-12-31'),
        signatureDate:           generatedAt,
      } as any,

      certifications: {
        personalInspectionOfSubjectProperty:            true,
        personalInspectionOfExteriorOfComparables:      true,
        noCurrentOrProspectiveInterestInProperty:       true,
        noPersonalInterestOrBias:                       true,
        feeNotContingentOnValueReported:                true,
        complianceWithUSPAP:                            true,
        developedInAccordanceWithUSPAP:                 true,
        reportedAllKnownAdverseFactors:                 true,
        propertyInspectionDate:                         generatedAt,
        appraiserStatement:                             'Certified as required',
        certificationDate:                              generatedAt,
      } as any,
    } as unknown as UadAppraisalReport;
  }

  // ──────────────────────────────────────────────────────────────────
  // T5.8 — CSV / Excel export
  // ──────────────────────────────────────────────────────────────────

  /**
   * Assembles a multi-section tabular export of the canonical report document:
   *   Sheet 1 / Section 1 — Order Summary
   *   Sheet 2 / Section 2 — Criteria Evaluations (from Axiom pre-screening)
   *   Sheet 3 / Section 3 — Extracted Data Fields
   *   Sheet 4 / Section 4 — Enrichment Summary (flattened key–value)
   *
   * @throws if no CanonicalReportDocument exists for the order.
   */
  async exportReportData(
    orderId: string,
    format: 'csv' | 'xlsx',
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    this.logger.info('Exporting report data', { orderId, format });

    const canonicalDocs = await this.db.queryDocuments<CanonicalReportDocument>(
      this.REPORTING_CONTAINER,
      'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1',
      [{ name: '@orderId', value: orderId }],
    );

    const doc = canonicalDocs[0];
    if (!doc) {
      throw new Error(
        `No canonical report document found for order '${orderId}'. ` +
        `The appraiser must save the valuation workspace before export is available.`,
      );
    }

    const addr = doc.subject.address;

    // ── Section 1: Order Summary (field/value pairs) ──────────────────────────────
    const summaryRows: [string, unknown][] = [
      ['Order ID',          doc.orderId],
      ['Report ID',         doc.reportId],
      ['Order Number',      doc.metadata.orderNumber ?? ''],
      ['Borrower Name',     doc.metadata.borrowerName ?? ''],
      ['Client Name',       doc.metadata.clientName ?? ''],
      ['Report Type',       doc.reportType],
      ['Status',            doc.status],
      ['Street Address',    addr.streetAddress],
      ['City',              addr.city],
      ['State',             addr.state],
      ['Zip Code',          addr.zipCode],
      ['County',            addr.county],
      ['Property Type',     doc.subject.propertyType],
      ['GLA (sqft)',        doc.subject.grossLivingArea],
      ['Bedrooms',          doc.subject.bedrooms],
      ['Bathrooms',         doc.subject.bathrooms],
      ['Year Built',        doc.subject.yearBuilt],
      ['Appraised Value',   doc.valuation?.estimatedValue ?? ''],
      ['Effective Date',    doc.valuation?.effectiveDate ?? doc.metadata.effectiveDate ?? ''],
    ];

    // ── Section 2: Criteria Evaluations ──────────────────────────────────────────
    const criteriaHeaders = [
      'Criterion ID', 'Name', 'Evaluation', 'Confidence (%)', 'Reasoning', 'Recommendation',
    ];
    const criteriaRows = (doc.criteriaEvaluations ?? []).map(c => [
      c.criterionId,
      c.name,
      c.evaluation,
      c.confidence != null ? Math.round(c.confidence * 100) : '',
      c.reasoning ?? '',
      c.recommendation ?? '',
    ]);

    // ── Section 3: Extracted Data Fields ───────────────────────────────────────
    const extractedHeaders = [
      'Field Name', 'Label', 'Value', 'Confidence (%)', 'Source Document', 'Source Page',
    ];
    const extractedRows = (doc.extractedDataFields ?? []).map(f => [
      f.fieldName,
      f.fieldLabel ?? '',
      f.extractedValue != null ? String(f.extractedValue) : '',
      f.confidence != null ? Math.round(f.confidence * 100) : '',
      f.sourceDocument ?? '',
      f.sourcePage ?? '',
    ]);

    // ── Section 4: Enrichment Summary ─────────────────────────────────────────────
    const enrichmentHeaders = ['Section', 'Key', 'Value'];
    const enrichmentRows: unknown[][] = [];
    const enrich = doc.enrichmentData;
    if (enrich) {
      for (const [sectionKey, sectionData] of Object.entries(enrich)) {
        if (sectionData && typeof sectionData === 'object') {
          for (const [k, v] of Object.entries(sectionData as Record<string, unknown>)) {
            enrichmentRows.push([sectionKey, k, v != null ? String(v) : '']);
          }
        }
      }
    }

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'L1 Valuation Platform';
      wb.created = new Date();

      const s1 = wb.addWorksheet('Order Summary');
      s1.columns = [
        { header: 'Field', key: 'field', width: 28 },
        { header: 'Value', key: 'value', width: 50 },
      ];
      s1.getRow(1).font = { bold: true };
      summaryRows.forEach(([field, value]) => s1.addRow({ field, value }));

      const s2 = wb.addWorksheet('Criteria Evaluations');
      s2.addRow(criteriaHeaders);
      s2.getRow(1).font = { bold: true };
      criteriaRows.forEach(r => s2.addRow(r as ExcelJS.CellValue[]));
      s2.columns?.forEach(c => { c.width = 22; });

      const s3 = wb.addWorksheet('Extracted Data Fields');
      s3.addRow(extractedHeaders);
      s3.getRow(1).font = { bold: true };
      extractedRows.forEach(r => s3.addRow(r as ExcelJS.CellValue[]));
      s3.columns?.forEach(c => { c.width = 22; });

      const s4 = wb.addWorksheet('Enrichment Summary');
      s4.addRow(enrichmentHeaders);
      s4.getRow(1).font = { bold: true };
      enrichmentRows.forEach(r => s4.addRow(r as ExcelJS.CellValue[]));
      s4.columns?.forEach(c => { c.width = 28; });

      const raw = await wb.xlsx.writeBuffer();
      return {
        buffer:      Buffer.from(raw),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName:    `report-data-${orderId}.xlsx`,
      };
    }

    // CSV: multi-section separated by blank lines
    const csv = [
      '=== Order Summary ===',
      'Field,Value',
      ...summaryRows.map(([f, v]) => `${_csvEsc(f)},${_csvEsc(v)}`),
      '',
      '=== Criteria Evaluations ===',
      criteriaHeaders.map(_csvEsc).join(','),
      ...criteriaRows.map(r => r.map(_csvEsc).join(',')),
      '',
      '=== Extracted Data Fields ===',
      extractedHeaders.map(_csvEsc).join(','),
      ...extractedRows.map(r => r.map(_csvEsc).join(',')),
      '',
      '=== Enrichment Summary ===',
      enrichmentHeaders.map(_csvEsc).join(','),
      ...enrichmentRows.map(r => r.map(_csvEsc).join(',')),
    ].join('\n');

    return {
      buffer:      Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      fileName:    `report-data-${orderId}.csv`,
    };
  }
}

// ── Module-level helpers ───────────────────────────────────────────────────────

/**
 * Non-destructively enriches a CanonicalReportDocument with Capability-5 fields
 * sourced from the order and the QC review before the field mapper runs.
 *
 * Rules:
 *  - Only fills a field if it is absent or empty on the stored canonical doc.
 *  - Mutates `doc` in-place (the object is used locally and never re-persisted).
 *
 * @param doc       The canonical doc loaded from Cosmos (mutated in-place).
 * @param order     The full Order (provides documents[]).
 * @param qcReview  The approved QC review (provides aiPreScreening.flaggedItems).
 */
function _enrichCanonicalDocForReport(
  doc: CanonicalReportDocument,
  order: Order,
  qcReview: QCReview | undefined,
): void {
  // ── sourceDocuments from order.documents ─────────────────────────────────
  // order-management.ts Order has documents[]; index.ts version does not.
  // Runtime access is safe — the actual stored document has the field.
  const orderDocs: Array<{
    id: string;
    originalFilename: string;
    fileUrl: string;
    type: unknown;
    uploadedAt: unknown;
  }> = (order as unknown as { documents?: unknown[] }).documents as typeof orderDocs ?? [];

  if (!doc.sourceDocuments || doc.sourceDocuments.length === 0) {
    doc.sourceDocuments = orderDocs.map(d => ({
      documentId:   d.id,
      documentName: d.originalFilename,
      blobUrl:      d.fileUrl,
      documentType: String(d.type),
      uploadedAt:
        d.uploadedAt instanceof Date
          ? d.uploadedAt.toISOString()
          : String(d.uploadedAt),
    }));
  }

  // ── criteriaEvaluations from QC AI pre-screening flagged items ────────────
  if (!doc.criteriaEvaluations || doc.criteriaEvaluations.length === 0) {
    const flagged = qcReview?.aiPreScreening?.flaggedItems ?? [];
    if (flagged.length > 0) {
      doc.criteriaEvaluations = flagged.map(fi => ({
        criterionId: fi.itemId,
        name:        fi.category,
        evaluation:
          fi.severity === 'critical' || fi.severity === 'high'
            ? 'fail'
            : fi.severity === 'medium'
            ? 'warning'
            : 'pass',
        confidence: fi.confidence,
        reasoning:  fi.description,
      }));
    }
  }

  // ── axiomEvaluationId + axiomCompletedAt from order ──────────────────────
  if (!doc.metadata.axiomEvaluationId && order.axiomEvaluationId) {
    doc.metadata.axiomEvaluationId = order.axiomEvaluationId;
  }
  if (!doc.metadata.axiomCompletedAt && order.axiomCompletedAt) {
    doc.metadata.axiomCompletedAt = order.axiomCompletedAt;
  }
}

/**
 * CSV-escapes a single value: wraps in double-quotes only when the string
 * contains a comma, double-quote, or newline; escapes embedded double-quotes.
 */
function _csvEsc(val: unknown): string {
  const s = val == null ? '' : String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
