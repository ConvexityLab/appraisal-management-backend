/**
 * Review Document Extraction Service (Sprint 4 — DOCUMENT_EXTRACTION mode)
 *
 * Orchestrates Axiom-based structured field extraction from appraisal PDFs.
 *
 * Flow:
 *   1. submitDocuments()        — sends each PDF URL to Axiom POST /documents/extract.
 *                                 Returns loanNumber → evaluationId map.
 *   2. mapAxiomResultToTapeItem() — maps Axiom's extractedFields response to a typed
 *                                 Partial<RiskTapeItem>. Field names match 1:1 because
 *                                 the DocumentSchema registered in Axiom's
 *                                 DocumentSchemas container uses our canonical field names.
 *   3. Caller (BulkPortfolioService) runs TapeEvaluationService on the mapped item
 *      and saves the ReviewTapeResult.
 *
 * NOTE: The Axiom /documents/extract endpoint is currently stubbed.
 * The exact request/response contract will be finalised with the Axiom team.
 * Mock mode is active when AXIOM_API_BASE_URL is not configured.
 */

import { Logger } from '../utils/logger.js';
import type { AxiomService } from './axiom.service.js';
import type {
  RiskTapeItem,
  TapeExtractionRequest,
  ReviewTapeExtractionItem,
} from '../types/review-tape.types.js';

export class ReviewDocumentExtractionService {
  private readonly logger = new Logger('ReviewDocumentExtractionService');

  constructor(private readonly axiomService: AxiomService) {}

  // ─── Submission ───────────────────────────────────────────────────────────

  /**
   * Submit a batch of appraisal PDFs to Axiom for structured field extraction.
   *
   * A failed submission for one loan is logged and skipped — it must NOT abort
   * the rest of the batch.  The caller checks which loans have evaluationIds and
   * treats the rest as immediately FAILED.
   *
   * @param docs           Map of loanNumber → Azure Blob SAS URL
   * @param programId      Review program id — Axiom resolves DocumentSchema from this
   * @param jobId          BulkPortfolioJob id threaded through for webhook correlation
   * @param webhookBaseUrl Base URL this server is reachable at (e.g. https://api.l1val.com)
   * @returns              Map of loanNumber → Axiom evaluationId (only for succeeded loans)
   */
  async submitDocuments(
    docs: Map<string, string>,
    programId: string,
    jobId: string,
    webhookBaseUrl: string,
  ): Promise<Map<string, string>> {
    const evaluationIds = new Map<string, string>();
    const webhookUrl = `${webhookBaseUrl}/api/axiom/webhook/extraction`;

    for (const [loanNumber, documentUrl] of docs) {
      const request: TapeExtractionRequest = {
        jobId,
        loanNumber,
        documentUrl,
        programId,
        webhookUrl,
      };

      try {
        const result = await this.axiomService.submitForExtraction(request);

        if (result.success && result.evaluationId) {
          evaluationIds.set(loanNumber, result.evaluationId);
          this.logger.info('Document submitted for extraction', {
            jobId,
            loanNumber,
            evaluationId: result.evaluationId,
          });
        } else {
          this.logger.warn('Axiom extraction submission failed', {
            jobId,
            loanNumber,
            error: result.error ?? 'No evaluationId returned',
          });
        }
      } catch (err) {
        this.logger.error('Exception submitting document for extraction', {
          jobId,
          loanNumber,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return evaluationIds;
  }

  // ─── Field Mapping ────────────────────────────────────────────────────────

  /**
   * Map Axiom's extracted field response to a typed Partial<RiskTapeItem>.
   *
   * Axiom's DocumentSchema is registered with our canonical RiskTapeItem field
   * names so the mapping is 1:1.  We coerce types where necessary — Axiom's
   * PDF text-extraction layer returns some numeric fields as strings.
   * Any field that is missing, null, or uncoercible is omitted and recorded
   * as a data quality issue.
   *
   * @param evaluationId  Axiom evaluationId (for logging only)
   * @param extractedFields  Raw extractedFields from Axiom webhook/poll response
   * @param loanNumber    Loan identifier (written into item.loanNumber)
   * @param rowIndex      Row position in the job (required by RiskTapeItem)
   */
  mapAxiomResultToTapeItem(
    evaluationId: string,
    extractedFields: Partial<RiskTapeItem>,
    loanNumber: string,
    rowIndex: number,
  ): { item: Partial<RiskTapeItem>; dataQualityIssues: string[] } {
    const issues: string[] = [];
    const item: Partial<RiskTapeItem> = { rowIndex, loanNumber };

    // ── Numeric fields — coerce strings emitted by PDF text extraction ────────
    const numericFields: (keyof RiskTapeItem)[] = [
      'loanAmount', 'firstLienBalance', 'secondLienBalance', 'appraisedValue',
      'contractPrice', 'priorPurchasePrice', 'ltv', 'cltv', 'dscr',
      'units', 'yearBuilt', 'gla', 'basementSf', 'lotSize', 'bedrooms',
      'bathsFull', 'bathsHalf', 'priorSale24mPrice', 'appreciation24m',
      'priorSale36mPrice', 'appreciation36m', 'avgDom', 'monthsInventory',
      'numComps', 'compPriceRangeLow', 'compPriceRangeHigh', 'avgPricePerSf',
      'avgDistanceMi', 'maxDistanceMi', 'compsDateRangeMonths',
      'nonMlsCount', 'nonMlsPct', 'avgNetAdjPct', 'avgGrossAdjPct',
      'avmValue', 'avmGapPct',
    ];

    for (const field of numericFields) {
      const raw = extractedFields[field];
      if (raw === null || raw === undefined) continue;
      const coerced =
        typeof raw === 'number'
          ? raw
          : parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
      if (isNaN(coerced)) {
        issues.push(
          `Field '${field}' could not be parsed as a number (raw value: "${raw}")`,
        );
      } else {
        (item as Record<string, unknown>)[field] = coerced;
      }
    }

    // ── Boolean fields ────────────────────────────────────────────────────────
    const booleanFields: (keyof RiskTapeItem)[] = [
      'chainOfTitleRedFlags',
      'cashOutRefi',
      'highRiskGeographyFlag',
      'appraiserGeoCompetency',
    ];

    for (const field of booleanFields) {
      const raw = extractedFields[field];
      if (raw === null || raw === undefined) continue;
      if (typeof raw === 'boolean') {
        (item as Record<string, unknown>)[field] = raw;
      } else {
        const lower = String(raw).toLowerCase().trim();
        (item as Record<string, unknown>)[field] =
          lower === 'yes' || lower === 'true' || lower === '1';
      }
    }

    // ── String fields — pass through as-is ────────────────────────────────────
    const stringFields: (keyof RiskTapeItem)[] = [
      'borrowerName', 'loanPurpose', 'loanType', 'occupancyType',
      'propertyAddress', 'city', 'county', 'state', 'zip', 'censusTract',
      'propertyType', 'conditionRating', 'qualityRating', 'effectiveAge',
      'renovationDate', 'appraisalEffectiveDate', 'appraiserLicense', 'formType',
      'reconciliationNotes', 'priorPurchaseDate', 'priorSale24mDate', 'priorSale36mDate',
      'marketTrend', 'parking', 'ucdpSsrScore', 'collateralRiskRating',
      'highNetGrossFlag', 'unusualAppreciationFlag', 'dscrFlag', 'nonPublicCompsFlag',
      'overallDecision', 'reviewerNotes',
    ];

    for (const field of stringFields) {
      const raw = extractedFields[field];
      if (raw !== null && raw !== undefined && raw !== '') {
        (item as Record<string, unknown>)[field] = String(raw);
      }
    }

    this.logger.debug('Mapped Axiom extraction result to RiskTapeItem', {
      evaluationId,
      loanNumber,
      mappedFieldCount: Object.keys(item).length - 2, // exclude rowIndex + loanNumber
      issueCount: issues.length,
    });

    return { item, dataQualityIssues: issues };
  }

  // ─── Tracking Helpers ─────────────────────────────────────────────────────

  /**
   * Build an initial ReviewTapeExtractionItem for a loan at submission time.
   * Status is PENDING when Axiom accepted the request, FAILED otherwise.
   */
  buildExtractionItem(
    loanNumber: string,
    documentUrl: string,
    axiomEvaluationId?: string,
  ): ReviewTapeExtractionItem {
    const now = new Date().toISOString();
    if (axiomEvaluationId) {
      return {
        loanNumber,
        documentUrl,
        axiomEvaluationId,
        extractionStatus: 'PENDING',
        submittedAt: now,
      };
    }
    return {
      loanNumber,
      documentUrl,
      extractionStatus: 'FAILED',
      submittedAt: now,
      errorMessage: 'Axiom submission failed — no evaluationId returned',
    };
  }
}
