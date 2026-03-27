/**
 * Construction Finance Module — Draw Inspection Service
 *
 * Manages DrawInspectionReport documents in the `draws` Cosmos container.
 * Partition key: /constructionLoanId
 *
 * Responsibilities:
 *   - Scheduling draw inspections (creates report, updates the linked DrawRequest)
 *   - Inspector report submission with per-line findings and photos
 *   - Lender accept / dispute workflow
 *
 * When an inspection is scheduled, the linked DrawRequest is advanced to
 * INSPECTION_ORDERED and stamped with the inspection ID.  When the inspector
 * submits their report, the DrawRequest is advanced to INSPECTION_COMPLETE so
 * the draw review workflow can proceed.
 *
 * This service does NOT create Cosmos infrastructure — all containers must be
 * provisioned via Bicep before this service runs.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  DrawInspectionReport,
  DrawInspectionType,
  DrawRequest,
} from '../types/draw-request.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'draws';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ScheduleInspectionInput {
  drawRequestId: string;
  constructionLoanId: string;
  tenantId: string;
  inspectionType: DrawInspectionType;
  /** Vendor ID from the existing vendor management system — DRAW_INSPECTOR tag required. */
  inspectorId: string;
  inspectorName: string;
  inspectorLicense?: string;
  /** ISO date string for the scheduled inspection visit / desktop review. */
  scheduledDate: string;
}

export interface SubmitInspectionReportInput {
  /** Inspector-certified overall project completion percentage (0–100). */
  overallPercentComplete: number;
  /** Overall percent from the previous accepted report (0 for the first). */
  previousOverallPercent: number;
  lineItemFindings: DrawInspectionReport['lineItemFindings'];
  photos?: DrawInspectionReport['photos'];
  concerns: string[];
  recommendations: string[];
  recommendedDrawAmount?: number;
  /** ISO date string of when the inspection was physically or remotely completed. */
  completedDate: string;
}

// ─── DrawInspectionService ────────────────────────────────────────────────────

export class DrawInspectionService {
  private readonly logger = new Logger('DrawInspectionService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateInspectionId(): string {
    return `inspection-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ── scheduleInspection ───────────────────────────────────────────────────────

  /**
   * Creates a DrawInspectionReport in SCHEDULED status and advances the linked
   * DrawRequest from SUBMITTED → INSPECTION_ORDERED.
   *
   * @throws if drawRequestId, constructionLoanId, or tenantId is empty
   * @throws if the linked DrawRequest is not in SUBMITTED status
   */
  async scheduleInspection(input: ScheduleInspectionInput): Promise<DrawInspectionReport> {
    const { drawRequestId, constructionLoanId, tenantId } = input;

    if (!drawRequestId) {
      throw new Error('DrawInspectionService.scheduleInspection: drawRequestId is required');
    }
    if (!constructionLoanId) {
      throw new Error('DrawInspectionService.scheduleInspection: constructionLoanId is required');
    }
    if (!tenantId) {
      throw new Error('DrawInspectionService.scheduleInspection: tenantId is required');
    }
    if (!input.scheduledDate) {
      throw new Error('DrawInspectionService.scheduleInspection: scheduledDate is required');
    }
    if (!input.inspectorId) {
      throw new Error('DrawInspectionService.scheduleInspection: inspectorId is required');
    }
    if (!input.inspectorName) {
      throw new Error('DrawInspectionService.scheduleInspection: inspectorName is required');
    }

    // Validate the linked draw exists and is in the correct state
    const draw = await this.cosmosService.getDocument<DrawRequest>(
      CONTAINER,
      drawRequestId,
      constructionLoanId
    );

    if (!draw) {
      throw new Error(
        `DrawInspectionService.scheduleInspection: draw "${drawRequestId}" not found ` +
        `for loan "${constructionLoanId}"`
      );
    }

    if (draw.status !== 'SUBMITTED') {
      throw new Error(
        `DrawInspectionService.scheduleInspection: draw "${drawRequestId}" must be in SUBMITTED ` +
        `status to schedule an inspection; current status: ${draw.status}`
      );
    }

    const now = new Date().toISOString();
    const inspectionId = this.generateInspectionId();

    const report: DrawInspectionReport = {
      id: inspectionId,
      drawRequestId,
      constructionLoanId,
      tenantId,
      inspectionType: input.inspectionType,
      inspectorId: input.inspectorId,
      inspectorName: input.inspectorName,
      ...(input.inspectorLicense !== undefined && { inspectorLicense: input.inspectorLicense }),
      scheduledDate: input.scheduledDate,
      overallPercentComplete: 0,
      previousOverallPercent: 0,
      percentCompleteThisDraw: 0,
      lineItemFindings: [],
      photos: [],
      concerns: [],
      recommendations: [],
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.cosmosService.createDocument<DrawInspectionReport>(CONTAINER, report);

    // Advance the DrawRequest to INSPECTION_ORDERED and stamp the inspection ID
    const updatedDraw: DrawRequest = {
      ...draw,
      status: 'INSPECTION_ORDERED',
      inspectionId,
      inspectionType: input.inspectionType,
      updatedAt: now,
    };
    await this.cosmosService.upsertDocument<DrawRequest>(CONTAINER, updatedDraw);

    this.logger.info('DrawInspection scheduled', {
      inspectionId,
      drawRequestId,
      constructionLoanId,
      tenantId,
      inspectionType: input.inspectionType,
    });

    return created;
  }

  // ── getInspectionById ────────────────────────────────────────────────────────

  /**
   * Retrieves a DrawInspectionReport by its ID.
   * The partition key for the draws container is /constructionLoanId.
   *
   * @throws if inspectionId or constructionLoanId is empty
   * @throws if the report is not found
   */
  async getInspectionById(
    inspectionId: string,
    constructionLoanId: string
  ): Promise<DrawInspectionReport> {
    if (!inspectionId) {
      throw new Error('DrawInspectionService.getInspectionById: inspectionId is required');
    }
    if (!constructionLoanId) {
      throw new Error('DrawInspectionService.getInspectionById: constructionLoanId is required');
    }

    const report = await this.cosmosService.getDocument<DrawInspectionReport>(
      CONTAINER,
      inspectionId,
      constructionLoanId
    );

    if (!report) {
      throw new Error(
        `DrawInspectionService.getInspectionById: inspection "${inspectionId}" not found ` +
        `for loan "${constructionLoanId}"`
      );
    }

    return report;
  }

  // ── listInspectionsByDraw ─────────────────────────────────────────────────────

  /**
   * Returns all inspection reports for a given draw, ordered by creation date ascending.
   */
  async listInspectionsByDraw(
    drawRequestId: string,
    constructionLoanId: string
  ): Promise<DrawInspectionReport[]> {
    if (!drawRequestId) {
      throw new Error('DrawInspectionService.listInspectionsByDraw: drawRequestId is required');
    }
    if (!constructionLoanId) {
      throw new Error('DrawInspectionService.listInspectionsByDraw: constructionLoanId is required');
    }

    const query =
      'SELECT * FROM c WHERE c.drawRequestId = @drawRequestId ' +
      'AND c.constructionLoanId = @constructionLoanId ' +
      'AND IS_DEFINED(c.inspectionType) ' +
      'ORDER BY c.createdAt ASC';
    const parameters = [
      { name: '@drawRequestId', value: drawRequestId },
      { name: '@constructionLoanId', value: constructionLoanId },
    ];

    return this.cosmosService.queryDocuments<DrawInspectionReport>(CONTAINER, query, parameters);
  }

  // ── listInspectionQueue ──────────────────────────────────────────────────────

  /**
   * Returns all DrawInspectionReport documents for a tenant, ordered by
   * scheduledDate descending. Supports optional status filtering and pagination.
   *
   * This is a cross-partition query — the draws container is keyed by
   * /constructionLoanId so all partitions are scanned.
   */
  async listInspectionQueue(
    tenantId: string,
    opts: { status?: string; page?: number; pageSize?: number } = {}
  ): Promise<{ items: DrawInspectionReport[]; total: number; page: number; pageSize: number }> {
    if (!tenantId) {
      throw new Error('DrawInspectionService.listInspectionQueue: tenantId is required');
    }

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
    const offset = (page - 1) * pageSize;

    // Distinguishes inspection reports from draw requests via inspectionType presence
    const baseWhere =
      'c.tenantId = @tenantId AND IS_DEFINED(c.inspectionType) AND IS_DEFINED(c.scheduledDate)';

    const parameters: { name: string; value: string }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    let whereClause = baseWhere;
    if (opts.status) {
      whereClause += ' AND c.status = @status';
      parameters.push({ name: '@status', value: opts.status });
    }

    const countSql = `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`;
    const countResult = await this.cosmosService.queryDocuments<number>(CONTAINER, countSql, parameters);
    const total = countResult[0] ?? 0;

    const dataSql =
      `SELECT * FROM c WHERE ${whereClause} ` +
      `ORDER BY c.scheduledDate DESC ` +
      `OFFSET ${offset} LIMIT ${pageSize}`;
    const items = await this.cosmosService.queryDocuments<DrawInspectionReport>(CONTAINER, dataSql, parameters);

    return { items, total, page, pageSize };
  }

  // ── submitInspectionReport ────────────────────────────────────────────────────

  /**
   * Records the inspector's findings on a SCHEDULED or IN_PROGRESS inspection.
   * Advances the inspection to SUBMITTED and the linked DrawRequest to INSPECTION_COMPLETE.
   *
   * @throws if the inspection is not in SCHEDULED or IN_PROGRESS status
   */
  async submitInspectionReport(
    inspectionId: string,
    constructionLoanId: string,
    input: SubmitInspectionReportInput
  ): Promise<DrawInspectionReport> {
    const report = await this.getInspectionById(inspectionId, constructionLoanId);

    if (report.status !== 'SCHEDULED' && report.status !== 'IN_PROGRESS') {
      throw new Error(
        `DrawInspectionService.submitInspectionReport: inspection "${inspectionId}" must be in ` +
        `SCHEDULED or IN_PROGRESS status to submit a report; current status: ${report.status}`
      );
    }

    const percentCompleteThisDraw =
      input.overallPercentComplete - input.previousOverallPercent;

    const now = new Date().toISOString();
    const updated: DrawInspectionReport = {
      ...report,
      overallPercentComplete: input.overallPercentComplete,
      previousOverallPercent: input.previousOverallPercent,
      percentCompleteThisDraw,
      lineItemFindings: input.lineItemFindings,
      photos: input.photos ?? [],
      concerns: input.concerns,
      recommendations: input.recommendations,
      ...(input.recommendedDrawAmount !== undefined && {
        recommendedDrawAmount: input.recommendedDrawAmount,
      }),
      completedDate: input.completedDate,
      submittedAt: now,
      status: 'SUBMITTED',
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<DrawInspectionReport>(CONTAINER, updated);

    // Advance the linked DrawRequest to INSPECTION_COMPLETE
    const draw = await this.cosmosService.getDocument<DrawRequest>(
      CONTAINER,
      report.drawRequestId,
      constructionLoanId
    );
    if (draw) {
      const updatedDraw: DrawRequest = {
        ...draw,
        status: 'INSPECTION_COMPLETE',
        updatedAt: now,
      };
      await this.cosmosService.upsertDocument<DrawRequest>(CONTAINER, updatedDraw);
    }

    this.logger.info('DrawInspection report submitted', {
      inspectionId,
      constructionLoanId,
      overallPercentComplete: input.overallPercentComplete,
    });

    return saved;
  }

  // ── acceptInspection ──────────────────────────────────────────────────────────

  /**
   * Lender accepts the submitted inspection report — advances status to ACCEPTED.
   *
   * @throws if inspection is not in SUBMITTED status
   */
  async acceptInspection(
    inspectionId: string,
    constructionLoanId: string,
    acceptedBy: string
  ): Promise<DrawInspectionReport> {
    if (!acceptedBy) {
      throw new Error('DrawInspectionService.acceptInspection: acceptedBy is required');
    }

    const report = await this.getInspectionById(inspectionId, constructionLoanId);

    if (report.status !== 'SUBMITTED') {
      throw new Error(
        `DrawInspectionService.acceptInspection: inspection "${inspectionId}" must be in SUBMITTED ` +
        `status to accept; current status: ${report.status}`
      );
    }

    const now = new Date().toISOString();
    const updated: DrawInspectionReport = {
      ...report,
      status: 'ACCEPTED',
      acceptedAt: now,
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<DrawInspectionReport>(CONTAINER, updated);

    this.logger.info('DrawInspection accepted', { inspectionId, constructionLoanId, acceptedBy });

    return saved;
  }

  // ── disputeInspection ─────────────────────────────────────────────────────────

  /**
   * Lender disputes the inspection findings — advances status to DISPUTED.
   * May be called on SUBMITTED or ACCEPTED reports.
   *
   * @throws if inspection is not in SUBMITTED or ACCEPTED status
   * @throws if reason is empty
   */
  async disputeInspection(
    inspectionId: string,
    constructionLoanId: string,
    reason: string
  ): Promise<DrawInspectionReport> {
    if (!reason) {
      throw new Error('DrawInspectionService.disputeInspection: reason is required');
    }

    const report = await this.getInspectionById(inspectionId, constructionLoanId);

    if (report.status !== 'SUBMITTED' && report.status !== 'ACCEPTED') {
      throw new Error(
        `DrawInspectionService.disputeInspection: inspection "${inspectionId}" must be in SUBMITTED ` +
        `or ACCEPTED status to dispute; current status: ${report.status}`
      );
    }

    const now = new Date().toISOString();
    // Append dispute reason to concerns for transparency
    const updated: DrawInspectionReport = {
      ...report,
      status: 'DISPUTED',
      concerns: [...report.concerns, `[DISPUTED] ${reason}`],
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<DrawInspectionReport>(CONTAINER, updated);

    this.logger.info('DrawInspection disputed', { inspectionId, constructionLoanId, reason });

    return saved;
  }
}
