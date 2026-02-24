/**
 * Bulk Portfolio Service
 *
 * Accepts a pre-validated list of BulkPortfolioItems, creates one
 * AppraisalOrder per valid row via CosmosDbService, and persists a
 * BulkPortfolioJob record for history / audit.
 *
 * Design constraints:
 *  - Calls dbService.createOrder() directly — does NOT route through HTTP.
 *  - A single row failure never aborts the batch; it is recorded as FAILED.
 *  - No infrastructure creation — bulk-portfolio-jobs container must exist.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { TapeEvaluationService } from './tape-evaluation.service.js';
import { AxiomService } from './axiom.service.js';
import { ReviewDocumentExtractionService } from './review-document-extraction.service.js';
import {
  ANALYSIS_TYPE_TO_PRODUCT_TYPE,
  BulkAnalysisType,
  BulkJobStatus,
  BulkPortfolioItem,
  BulkPortfolioJob,
  BulkSubmitRequest,
} from '../types/bulk-portfolio.types.js';
import type {
  RiskTapeItem,
  ReviewTapeResult,
  ReviewTapeJobSummary,
  ReviewProgram,
  ReviewTapeExtractionItem,
  TapeExtractionWebhookPayload,
  ReviewDecision,
} from '../types/review-tape.types.js';
import { OrderStatus } from '../types/order-status.js';
import { OrderType, Priority } from '../types/index.js';

/** Analysis types that require an existing appraisal to review */
const REVIEW_TYPES: Set<BulkAnalysisType> = new Set([
  'FRAUD',
  'ANALYSIS_1033',
  'QUICK_REVIEW',
  'ROV',
]);

/** Standard turn times (calendar days) by analysis type */
const DEFAULT_TURN_TIME_DAYS: Record<BulkAnalysisType, number> = {
  AVM: 1,
  FRAUD: 3,
  ANALYSIS_1033: 5,
  QUICK_REVIEW: 2,
  DVR: 3,
  ROV: 3,
};

export class BulkPortfolioService {
  private readonly logger: Logger;
  private _tapeEvaluationService: TapeEvaluationService | null = null;
  private _axiomService: AxiomService | null = null;
  private _extractionService: ReviewDocumentExtractionService | null = null;

  constructor(private readonly dbService: CosmosDbService) {
    this.logger = new Logger();
  }

  private get tapeEvaluationService(): TapeEvaluationService {
    if (!this._tapeEvaluationService) {
      this._tapeEvaluationService = new TapeEvaluationService();
    }
    return this._tapeEvaluationService;
  }

  private get axiomService(): AxiomService {
    if (!this._axiomService) {
      this._axiomService = new AxiomService(this.dbService);
    }
    return this._axiomService;
  }

  private get extractionService(): ReviewDocumentExtractionService {
    if (!this._extractionService) {
      this._extractionService = new ReviewDocumentExtractionService(this.axiomService);
    }
    return this._extractionService;
  }

  // ─── submit ────────────────────────────────────────────────────────────────

  /**
   * Validate + create orders for each item in the batch, then persist the job.
   *
   * @param request   Validated payload from the controller
   * @param submittedBy  Authenticated user id
   * @param tenantId  Resolved tenant id
   */
  async submit(
    request: BulkSubmitRequest,
    submittedBy: string,
    tenantId: string,
  ): Promise<BulkPortfolioJob> {
    const jobId = `bulk-job-${uuidv4()}`;
    const now = new Date().toISOString();

    this.logger.info('Starting bulk portfolio submission', {
      jobId,
      clientId: request.clientId,
      rowCount: request.items.length,
      processingMode: request.processingMode ?? 'ORDER_CREATION',
    });

    // ── TAPE EVALUATION PATH ──────────────────────────────────────────────────
    if (request.processingMode === 'TAPE_EVALUATION') {
      return this._submitTapeEvaluation(request, jobId, now, submittedBy, tenantId);
    }

    // ── DOCUMENT EXTRACTION PATH ──────────────────────────────────────────────
    if (request.processingMode === 'DOCUMENT_EXTRACTION') {
      return this._submitDocumentExtraction(request, jobId, now, submittedBy, tenantId);
    }

    // ── ORDER CREATION PATH (default) ─────────────────────────────────────────
    // request.items is guaranteed to be BulkPortfolioItem[] here because the
    // TAPE_EVALUATION branch returned early above.
    const orderItems = request.items as BulkPortfolioItem[];
    const results: BulkPortfolioItem[] = [];
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const item of orderItems) {
      // Row-level validation
      const errors = this._validateItem(item);
      if (errors.length > 0) {
        results.push({ ...item, status: 'INVALID', validationErrors: errors });
        skippedCount++;
        continue;
      }

      // Build AppraisalOrder shape
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + DEFAULT_TURN_TIME_DAYS[item.analysisType]);

      const orderPayload = {
        tenantId,
        clientId: request.clientId,
        orderNumber: this._generateOrderNumber(item),
        type: 'order' as const,
        orderType: this._inferOrderType(item),
        productType: ANALYSIS_TYPE_TO_PRODUCT_TYPE[item.analysisType],
        status: OrderStatus.NEW,
        priority: (item.priority === 'RUSH' ? Priority.RUSH : Priority.NORMAL) as Priority,
        dueDate,
        rushOrder: item.priority === 'RUSH',
        tags: ['bulk-portfolio'],
        metadata: this._buildMetadata(item),
        specialInstructions: item.notes,
        propertyAddress: {
          streetAddress: item.propertyAddress,
          city: item.city,
          state: item.state,
          zipCode: item.zipCode,
          county: item.county ?? '',
          apn: item.apn,
        },
        propertyDetails: {
          propertyType: (item.propertyType as any) ?? 'single_family_residential',
          occupancy: 'owner_occupied' as any,
          yearBuilt: item.yearBuilt,
          grossLivingArea: item.gla,
          lotSize: item.lotSize,
          bedrooms: item.bedrooms,
          bathrooms: item.bathrooms,
          features: [],
        },
        borrowerInformation: {
          firstName: item.borrowerFirstName,
          lastName: item.borrowerLastName,
          email: item.borrowerEmail,
          phone: item.borrowerPhone,
        },
        loanInformation: {
          loanAmount: item.loanAmount ?? 0,
          loanType: (item.loanType as any) ?? 'conventional',
          loanPurpose: (item.loanPurpose as any) ?? 'refinance',
          contractPrice: undefined,
        },
        contactInformation: {
          name: `${item.borrowerFirstName} ${item.borrowerLastName}`,
          role: 'borrower' as any,
          preferredMethod: 'email' as any,
        },
        createdBy: submittedBy,
      };

      try {
        const result = await this.dbService.createOrder(orderPayload as any);

        if (result.success && result.data) {
          results.push({
            ...item,
            status: 'CREATED',
            orderId: result.data.id,
            orderNumber: (result.data as any).orderNumber,
          });
          successCount++;
        } else {
          const msg = result.error?.message ?? 'Order creation failed';
          this.logger.warn('Failed to create order for bulk row', {
            rowIndex: item.rowIndex,
            error: msg,
          });
          results.push({ ...item, status: 'FAILED', errorMessage: msg });
          failCount++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error('Exception creating order for bulk row', {
          rowIndex: item.rowIndex,
          error: msg,
        });
        results.push({ ...item, status: 'FAILED', errorMessage: msg });
        failCount++;
      }
    }

    const finalStatus: BulkJobStatus =
      failCount === 0 && skippedCount === 0
        ? 'COMPLETED'
        : successCount === 0
          ? 'FAILED'
          : 'PARTIAL';

    const job: BulkPortfolioJob = {
      id: jobId,
      tenantId,
      clientId: request.clientId,
      ...(request.jobName !== undefined ? { jobName: request.jobName } : {}),
      fileName: request.fileName,
      status: finalStatus,
      submittedAt: now,
      submittedBy,
      completedAt: new Date().toISOString(),
      totalRows: request.items.length,
      successCount,
      failCount,
      skippedCount,
      items: results,
    };

    await this._saveJob(job);

    this.logger.info('Bulk portfolio submission complete', {
      jobId,
      successCount,
      failCount,
      skippedCount,
      status: finalStatus,
    });

    return job;
  }

  // ─── _submitTapeEvaluation ────────────────────────────────────────────────

  /**
   * Tape evaluation path — does NOT create AppraisalOrders.
   * Loads the ReviewProgram from Cosmos, evaluates all rows via
   * TapeEvaluationService, and persists a BulkPortfolioJob containing
   * ReviewTapeResult[] items plus a ReviewTapeJobSummary.
   */
  private async _submitTapeEvaluation(
    request: BulkSubmitRequest,
    jobId: string,
    now: string,
    submittedBy: string,
    tenantId: string,
  ): Promise<BulkPortfolioJob> {
    if (!request.reviewProgramId) {
      throw new Error(
        'reviewProgramId is required when processingMode is TAPE_EVALUATION',
      );
    }

    // ── Load the review program from Cosmos ────────────────────────────────
    const program = await this._loadReviewProgram(request.reviewProgramId);

    // ── Evaluate every tape row ─────────────────────────────────────────────
    const tapeItems = request.items as RiskTapeItem[];
    const results: ReviewTapeResult[] = this.tapeEvaluationService.evaluate(
      tapeItems,
      program,
    );

    // ── Compute portfolio-level summary ────────────────────────────────────
    const summary = this._computeTapeJobSummary(results);

    const job: BulkPortfolioJob = {
      id: jobId,
      tenantId,
      clientId: request.clientId,
      ...(request.jobName !== undefined ? { jobName: request.jobName } : {}),
      fileName: request.fileName,
      status: 'COMPLETED',
      processingMode: 'TAPE_EVALUATION',
      reviewProgramId: program.id,
      reviewProgramVersion: program.version,
      submittedAt: now,
      submittedBy,
      completedAt: new Date().toISOString(),
      totalRows: tapeItems.length,
      successCount: results.length,
      failCount: 0,
      skippedCount: 0,
      reviewSummary: summary,
      items: results,
    };

    await this._saveJob(job);

    this.logger.info('Tape evaluation complete', {
      jobId,
      programId: program.id,
      totalLoans: summary.totalLoans,
      accept: summary.acceptCount,
      conditional: summary.conditionalCount,
      reject: summary.rejectCount,
      avgRiskScore: summary.avgRiskScore,
    });

    return job;
  }

  // ─── _submitDocumentExtraction ────────────────────────────────────────────

  /**
   * Document extraction path — submits each loan's PDF to Axiom for structured
   * 73-field extraction.  Returns immediately with status PROCESSING; results
   * arrive asynchronously via webhook (production) or Cosmos polling (mock/dev).
   *
   * Requires request.reviewProgramId (Axiom needs it to resolve the DocumentSchema)
   * and request.documentUrls (loanNumber → Azure Blob SAS URL map).
   */
  private async _submitDocumentExtraction(
    request: BulkSubmitRequest,
    jobId: string,
    now: string,
    submittedBy: string,
    tenantId: string,
  ): Promise<BulkPortfolioJob> {
    if (!request.reviewProgramId) {
      throw new Error(
        'reviewProgramId is required when processingMode is DOCUMENT_EXTRACTION',
      );
    }
    if (!request.documentUrls || Object.keys(request.documentUrls).length === 0) {
      throw new Error(
        'documentUrls is required when processingMode is DOCUMENT_EXTRACTION — ' +
          'provide a map of loanNumber → Azure Blob SAS URL',
      );
    }

    const webhookBaseUrl = process.env.API_BASE_URL;
    if (!webhookBaseUrl) {
      throw new Error(
        'API_BASE_URL environment variable is required for DOCUMENT_EXTRACTION mode — ' +
          'Axiom needs this to POST extraction results back to this server',
      );
    }

    const docMap = new Map(Object.entries(request.documentUrls));

    // ── Submit all documents to Axiom ─────────────────────────────────────
    const evaluationIds = await this.extractionService.submitDocuments(
      docMap,
      request.reviewProgramId,
      jobId,
      webhookBaseUrl,
    );

    // ── Build per-loan extraction tracking items ───────────────────────────
    const extractionItems: ReviewTapeExtractionItem[] = [];
    let failCount = 0;

    for (const [loanNumber, documentUrl] of docMap) {
      const evalId = evaluationIds.get(loanNumber);
      const item = this.extractionService.buildExtractionItem(loanNumber, documentUrl, evalId);
      extractionItems.push(item);
      if (!evalId) failCount++;
    }

    const job: BulkPortfolioJob = {
      id: jobId,
      tenantId,
      clientId: request.clientId,
      ...(request.jobName !== undefined ? { jobName: request.jobName } : {}),
      fileName: request.fileName,
      status: failCount === docMap.size ? 'FAILED' : 'PROCESSING',
      processingMode: 'DOCUMENT_EXTRACTION',
      reviewProgramId: request.reviewProgramId,
      submittedAt: now,
      submittedBy,
      totalRows: docMap.size,
      successCount: 0,          // updated as extractions complete
      failCount,
      skippedCount: 0,
      extractionItems,
      extractedCount: 0,
      extractionFailCount: failCount,
      items: [],                // populated by processExtractionCompletion()
    };

    await this._saveJob(job);

    this.logger.info('Document extraction job submitted', {
      jobId,
      totalDocs: docMap.size,
      submittedToAxiom: evaluationIds.size,
      immediateFailures: failCount,
    });

    return job;
  }

  // ─── processExtractionCompletion ─────────────────────────────────────────

  /**
   * Called when Axiom posts a TAPE_EXTRACTION webhook.
   *
   * Maps the extracted fields to a RiskTapeItem, runs tape evaluation against
   * the job's ReviewProgram, and updates the BulkPortfolioJob in Cosmos.
   * If all loans are now in a terminal state (EVALUATED or FAILED) the job
   * status is set to COMPLETED (or PARTIAL / FAILED).
   */
  async processExtractionCompletion(payload: TapeExtractionWebhookPayload): Promise<void> {
    const { jobId, loanNumber, evaluationId, status, extractedFields, extractionConfidence, error } =
      payload;

    this.logger.info('Processing extraction completion webhook', { jobId, loanNumber, evaluationId, status });

    // ── Load job ────────────────────────────────────────────────────────────
    const jobResult = await this.dbService.queryItems<BulkPortfolioJob>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.id = @id',
      [{ name: '@id', value: jobId }],
    );

    const job = jobResult.success && jobResult.data?.[0];
    if (!job) {
      this.logger.error('Job not found for extraction webhook', { jobId });
      return;
    }

    // ── Find extraction item for this loan ─────────────────────────────────
    const items = job.extractionItems ?? [];
    const itemIdx = items.findIndex((i) => i.axiomEvaluationId === evaluationId || i.loanNumber === loanNumber);

    if (itemIdx === -1) {
      this.logger.warn('Extraction item not found in job', { jobId, loanNumber, evaluationId });
      return;
    }

    const extractionItem = { ...items[itemIdx]! };

    if (status === 'failed' || !extractedFields) {
      extractionItem.extractionStatus = 'FAILED';
      extractionItem.errorMessage = error ?? 'Axiom extraction failed';
      extractionItem.extractedAt = payload.timestamp;
      items[itemIdx] = extractionItem;
      await this._saveJobWithExtractionItems(job, items);
      return;
    }

    // ── Map extracted fields → RiskTapeItem ───────────────────────────────
    const rowIndex = itemIdx;
    const { item: mappedItem, dataQualityIssues } = this.extractionService.mapAxiomResultToTapeItem(
      evaluationId,
      extractedFields,
      loanNumber,
      rowIndex,
    );

    extractionItem.extractionStatus = 'EXTRACTED';
    extractionItem.extractedAt = payload.timestamp;
    if (extractionConfidence !== undefined) {
      extractionItem.extractionConfidence = extractionConfidence;
    }
    extractionItem.dataQualityIssues = dataQualityIssues;

    // ── Run tape evaluation ────────────────────────────────────────────────
    let result: ReviewTapeResult;
    try {
      const program = await this._loadReviewProgram(job.reviewProgramId!);
      const [evaluated] = this.tapeEvaluationService.evaluate([mappedItem as RiskTapeItem], program);

      result = {
        ...evaluated!,
        axiomEvaluationId: evaluationId,
        ...(extractionConfidence !== undefined
          ? { axiomExtractionConfidence: extractionConfidence }
          : {}),
        dataQualityIssues: [...(evaluated!.dataQualityIssues ?? []), ...dataQualityIssues],
      };

      extractionItem.extractionStatus = 'EVALUATED';
      extractionItem.evaluatedAt = new Date().toISOString();
      extractionItem.result = result;
    } catch (evalErr) {
      extractionItem.extractionStatus = 'FAILED';
      extractionItem.errorMessage =
        `Tape evaluation failed: ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`;
      items[itemIdx] = extractionItem;
      await this._saveJobWithExtractionItems(job, items);
      return;
    }

    items[itemIdx] = extractionItem;

    // ── Check if all loans are in terminal states ──────────────────────────
    const terminalCount = items.filter(
      (i) => i.extractionStatus === 'EVALUATED' || i.extractionStatus === 'FAILED',
    ).length;
    const allDone = terminalCount === items.length;

    const evaluatedResults = items
      .filter((i) => i.result !== undefined)
      .map((i) => i.result as ReviewTapeResult);

    const updatedJob: BulkPortfolioJob = {
      ...job,
      extractionItems: items,
      extractedCount: items.filter((i) => i.extractionStatus === 'EVALUATED').length,
      extractionFailCount: items.filter((i) => i.extractionStatus === 'FAILED').length,
      successCount: evaluatedResults.length,
      failCount: items.filter((i) => i.extractionStatus === 'FAILED').length,
      items: evaluatedResults,
    };

    if (allDone) {
      const reviewSummary = this._computeTapeJobSummary(evaluatedResults);
      const failedCount = items.filter((i) => i.extractionStatus === 'FAILED').length;
      updatedJob.status =
        failedCount === 0 ? 'COMPLETED' : evaluatedResults.length > 0 ? 'PARTIAL' : 'FAILED';
      updatedJob.completedAt = new Date().toISOString();
      updatedJob.reviewSummary = reviewSummary;

      this.logger.info('Document extraction job completed', {
        jobId,
        evaluated: evaluatedResults.length,
        failed: failedCount,
        status: updatedJob.status,
      });
    }

    await this._saveJob(updatedJob);
  }

  // ─── checkExtractionProgress ─────────────────────────────────────────────

  /**
   * Poll Axiom's aiInsights Cosmos cache for pending extraction results.
   * Used in mock/dev mode where there is no inbound webhook.
   *
   * Iterates all PENDING/PROCESSING extraction items in the job, checks whether
   * Axiom has stored a completed ExtractionRecord, and calls
   * processExtractionCompletion() for each one that has finished.
   *
   * Returns the latest job state from Cosmos after processing.
   */
  // ─── patchReviewResult ────────────────────────────────────────────────────

  /**
   * Update reviewer notes and/or override decision on a single tape result.
   *
   * The job is read, the matching item updated in-place, and the whole job
   * written back to Cosmos (same upsert pattern used everywhere else).
   * Throws if the job is not found, not a tape-evaluation job, or the loan
   * number is not present in the results.
   */
  async patchReviewResult(
    jobId: string,
    loanNumber: string,
    patch: {
      reviewerNotes?: string;
      overrideDecision?: ReviewDecision | null;
      overrideReason?: string;
    },
    tenantId: string,
    patchedBy: string,
  ): Promise<ReviewTapeResult> {
    const job = await this.getJob(jobId, tenantId);
    if (!job) {
      throw new Error(`Job '${jobId}' not found`);
    }
    if (job.processingMode !== 'TAPE_EVALUATION') {
      throw new Error(
        `Job '${jobId}' is not a tape evaluation job (processingMode: ${job.processingMode ?? 'ORDER_CREATION'})`,
      );
    }

    const results = job.items as ReviewTapeResult[];
    const idx = results.findIndex((r) => r.loanNumber === loanNumber);
    if (idx === -1) {
      throw new Error(`Loan '${loanNumber}' not found in job '${jobId}'`);
    }

    const now = new Date().toISOString();
    const updated: ReviewTapeResult = { ...results[idx]! };

    if (patch.reviewerNotes !== undefined) {
      (updated as any).reviewerNotes = patch.reviewerNotes;
    }
    if (patch.overrideDecision !== undefined) {
      if (patch.overrideDecision === null) {
        // Clearing the override
        delete (updated as any).overrideDecision;
        delete (updated as any).overrideReason;
        delete (updated as any).overriddenAt;
        delete (updated as any).overriddenBy;
      } else {
        (updated as any).overrideDecision = patch.overrideDecision;
        (updated as any).overrideReason = patch.overrideReason ?? '';
        (updated as any).overriddenAt = now;
        (updated as any).overriddenBy = patchedBy;
      }
    }

    results[idx] = updated;
    await this._saveJob({ ...job, items: results });

    this.logger.info('Review result patched', {
      jobId,
      loanNumber,
      patchedBy,
      hasOverride: patch.overrideDecision != null,
    });

    return updated;
  }

  async checkExtractionProgress(jobId: string): Promise<BulkPortfolioJob> {
    const jobResult = await this.dbService.queryItems<BulkPortfolioJob>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.id = @id',
      [{ name: '@id', value: jobId }],
    );

    const job = jobResult.success && jobResult.data?.[0];
    if (!job) {
      throw new Error(`Job '${jobId}' not found`);
    }

    if (job.status !== 'PROCESSING') {
      return job; // nothing to do
    }

    const pending = (job.extractionItems ?? []).filter(
      (i) => i.extractionStatus === 'PENDING' || i.extractionStatus === 'PROCESSING',
    );

    if (pending.length === 0) {
      return job;
    }

    for (const item of pending) {
      if (!item.axiomEvaluationId) continue;

      const record = await this.axiomService.getExtractionRecord(item.axiomEvaluationId);
      if (!record || record.status !== 'completed') continue;

      const webhookPayload: TapeExtractionWebhookPayload = {
        evaluationId: record.evaluationId,
        jobId,
        loanNumber: item.loanNumber,
        status: 'completed',
        timestamp: record.timestamp,
        ...(record.extractedFields !== undefined
          ? { extractedFields: record.extractedFields }
          : {}),
        ...(record.extractionConfidence !== undefined
          ? { extractionConfidence: record.extractionConfidence }
          : {}),
      };

      // processExtractionCompletion re-loads the job each call,
      // so sequential awaiting is correct (each call sees the latest state).
      await this.processExtractionCompletion(webhookPayload);
    }

    // Return the freshly saved job state
    const refreshed = await this.dbService.queryItems<BulkPortfolioJob>(
      'bulk-portfolio-jobs',
      'SELECT * FROM c WHERE c.id = @id',
      [{ name: '@id', value: jobId }],
    );
    return (refreshed.success && refreshed.data?.[0]) || job;
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  /** Upsert job with updated extractionItems without touching other job fields. */
  private async _saveJobWithExtractionItems(
    job: BulkPortfolioJob,
    items: ReviewTapeExtractionItem[],
  ): Promise<void> {
    await this._saveJob({ ...job, extractionItems: items });
  }

  /** Fetch a ReviewProgram document from the review-programs Cosmos container. */
  private async _loadReviewProgram(programId: string): Promise<ReviewProgram> {
    const container = this.dbService.getReviewProgramsContainer();
    const { resources } = await container.items
      .query<ReviewProgram>({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: programId }],
      })
      .fetchAll();

    const program = resources[0];
    if (!program) {
      throw new Error(
        `Review program '${programId}' not found. ` +
          'Ensure the program has been seeded to the review-programs container.',
      );
    }
    return program;
  }

  /** Aggregate ReviewTapeResult[] into a ReviewTapeJobSummary. */
  private _computeTapeJobSummary(results: ReviewTapeResult[]): ReviewTapeJobSummary {
    const flagBreakdown: Record<string, number> = {};
    let scoreSum = 0;
    let maxScore = 0;
    let acceptCount = 0;
    let conditionalCount = 0;
    let rejectCount = 0;

    for (const r of results) {
      scoreSum += r.overallRiskScore;
      if (r.overallRiskScore > maxScore) maxScore = r.overallRiskScore;

      if (r.computedDecision === 'Accept') acceptCount++;
      else if (r.computedDecision === 'Conditional') conditionalCount++;
      else rejectCount++;

      for (const flag of r.autoFlagResults) {
        if (flag.isFired) {
          flagBreakdown[flag.id] = (flagBreakdown[flag.id] ?? 0) + 1;
        }
      }
      for (const flag of r.manualFlagResults) {
        if (flag.isFired) {
          flagBreakdown[flag.id] = (flagBreakdown[flag.id] ?? 0) + 1;
        }
      }
    }

    const totalLoans = results.length;
    return {
      totalLoans,
      acceptCount,
      conditionalCount,
      rejectCount,
      avgRiskScore: totalLoans > 0 ? Math.round((scoreSum / totalLoans) * 10) / 10 : 0,
      maxRiskScore: maxScore,
      flagBreakdown,
    };
  }

  // ─── getJobs ───────────────────────────────────────────────────────────────

  async getJobs(tenantId: string, clientId?: string): Promise<BulkPortfolioJob[]> {
    try {
      const container = this.dbService.getBulkPortfolioJobsContainer();
      let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId';
      const params: { name: string; value: string }[] = [
        { name: '@tenantId', value: tenantId },
      ];

      if (clientId) {
        query += ' AND c.clientId = @clientId';
        params.push({ name: '@clientId', value: clientId });
      }

      query += ' ORDER BY c.submittedAt DESC OFFSET 0 LIMIT 50';

      const { resources } = await container.items
        .query<BulkPortfolioJob>({ query, parameters: params })
        .fetchAll();

      return resources;
    } catch (err) {
      this.logger.error('Failed to fetch bulk portfolio jobs', { error: err });
      return [];
    }
  }

  // ─── getJob ────────────────────────────────────────────────────────────────

  async getJob(jobId: string, tenantId: string): Promise<BulkPortfolioJob | null> {
    try {
      const container = this.dbService.getBulkPortfolioJobsContainer();
      const { resources } = await container.items
        .query<BulkPortfolioJob>({
          query: 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
          parameters: [
            { name: '@id', value: jobId },
            { name: '@tenantId', value: tenantId },
          ],
        })
        .fetchAll();

      return resources[0] ?? null;
    } catch (err) {
      this.logger.error('Failed to fetch bulk portfolio job', { jobId, error: err });
      return null;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Row-level validation — returns array of human-readable error strings */
  private _validateItem(item: BulkPortfolioItem): string[] {
    const errors: string[] = [];

    if (!item.propertyAddress?.trim()) errors.push('Property address is required');
    if (!item.city?.trim()) errors.push('City is required');
    if (!item.state || item.state.length !== 2) errors.push('State must be a 2-letter code');
    if (!item.zipCode || !/^\d{5}(-\d{4})?$/.test(item.zipCode))
      errors.push('ZIP code must be 5 digits');
    if (!item.borrowerFirstName?.trim()) errors.push('Borrower first name is required');
    if (!item.borrowerLastName?.trim()) errors.push('Borrower last name is required');

    if (REVIEW_TYPES.has(item.analysisType)) {
      if (!item.existingAppraisedValue || item.existingAppraisedValue <= 0)
        errors.push('Existing appraised value required for review-type orders');
      if (!item.existingAppraisalDate)
        errors.push('Existing appraisal effective date required for review-type orders');
    }

    if (item.analysisType === 'ANALYSIS_1033') {
      if (!item.appraiserLicense?.trim())
        errors.push('Appraiser license number required for 1033 Field Review');
      if (!item.appraiserLicenseState || item.appraiserLicenseState.length !== 2)
        errors.push('Appraiser license state (2-letter) required for 1033 Field Review');
    }

    return errors;
  }

  /** Infer OrderType from analysis type / loan purpose field */
  private _inferOrderType(item: BulkPortfolioItem): OrderType {
    const purpose = item.loanPurpose?.toUpperCase();
    if (purpose === 'PURCHASE') return OrderType.PURCHASE;
    if (purpose === 'REFINANCE' || purpose === 'CASH_OUT') return OrderType.REFINANCE;
    if (purpose === 'HELOC' || purpose === 'EQUITY_LINE') return OrderType.EQUITY_LINE;
    return OrderType.REFINANCE; // safe default for review-type bulk orders
  }

  /** Build metadata object with all extra UAD / review fields */
  private _buildMetadata(item: BulkPortfolioItem): Record<string, unknown> {
    return {
      bulkPortfolio: true,
      analysisType: item.analysisType,
      // Existing appraisal review fields
      ...(item.existingAppraisalDate && {
        existingAppraisalDate: item.existingAppraisalDate,
      }),
      ...(item.existingAppraisedValue != null && {
        existingAppraisedValue: item.existingAppraisedValue,
      }),
      ...(item.appraiserName && { appraiserName: item.appraiserName }),
      ...(item.appraiserLicense && { appraiserLicense: item.appraiserLicense }),
      ...(item.appraiserLicenseState && {
        appraiserLicenseState: item.appraiserLicenseState,
      }),
      // UAD fields
      ...(item.appraisalFormType && { appraisalFormType: item.appraisalFormType }),
      ...(item.conditionRating && { conditionRating: item.conditionRating }),
      ...(item.qualityRating && { qualityRating: item.qualityRating }),
      ...(item.cuRiskScore != null && { cuRiskScore: item.cuRiskScore }),
      ...(item.loanNumber && { loanNumber: item.loanNumber }),
    };
  }

  /** Generate a short human-readable order number for the row */
  private _generateOrderNumber(item: BulkPortfolioItem): string {
    const prefix = item.analysisType.slice(0, 3).toUpperCase();
    const zip = item.zipCode.slice(0, 5);
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${zip}-${rand}`;
  }

  /** Persist the job to the bulk-portfolio-jobs Cosmos container */
  private async _saveJob(job: BulkPortfolioJob): Promise<void> {
    try {
      const container = this.dbService.getBulkPortfolioJobsContainer();
      await container.items.upsert(job);
    } catch (err) {
      // Log but don't re-throw — orders are already created; losing the job record
      // should not fail the response to the caller.
      this.logger.error('Failed to persist bulk portfolio job record', {
        jobId: job.id,
        error: err,
      });
    }
  }
}
