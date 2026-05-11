/**
 * ReviewProgramResultsReader — adapter that reads existing review-program
 * decision data from the platform's already-deployed stores and projects
 * it into the shape Decision Engine analytics + (eventually) replay
 * consume.
 *
 * Phase F polish of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * No new container is provisioned. Source of truth:
 *   - `bulk-portfolio-jobs` (Cosmos, partitioned by `/tenantId`) — job-level
 *     records with reviewProgramId / reviewProgramVersion / submittedAt.
 *     Small jobs (≤ 500 rows) embed `items: ReviewTapeResult[]` inline;
 *     large jobs spill results to:
 *   - `review-results` (Cosmos, partitioned by `/jobId`) — per-loan
 *     ReviewTapeResult documents. Each carries `autoFlagResults[]` (rules
 *     that fired) + `computedDecision` (Accept/Conditional/Reject).
 *
 * The reader walks both shapes transparently so callers don't care which
 * job size produced the data.
 *
 * Why not a new container? Two existing containers already capture every
 * piece of the data this surface needs (rule fires, outcomes, timing).
 * Adding a new container would duplicate writes + fragment query paths.
 * Adapter pattern lets the Decision Engine surface light up against the
 * existing data immediately.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type {
	BulkPortfolioJob,
} from '../../../types/bulk-portfolio.types.js';
import type {
	ReviewTapeResult,
} from '../../../types/review-tape.types.js';

const JOBS_CONTAINER = 'bulk-portfolio-jobs';
const RESULTS_CONTAINER = 'review-results';
/** Hard caps so a single analytics call doesn't try to load thousands of jobs. */
const MAX_JOBS_PER_QUERY = 200;
const MAX_RESULTS_PER_JOB = 5_000;

/**
 * Per-result shape the analytics aggregator consumes. Carries enough metadata
 * for daily bucketing + flag attribution + outcome counting.
 */
export interface NormalizedReviewDecision {
	/** Trace id — orderless deterministic id derived from job + loan for dedup. */
	id: string;
	tenantId: string;
	jobId: string;
	jobSubmittedAt: string;
	reviewProgramId?: string;
	reviewProgramVersion?: string;
	loanNumber?: string;
	/** ISO timestamp the result was evaluated. Falls back to job.submittedAt. */
	evaluatedAt: string;
	overallRiskScore?: number;
	computedDecision?: string;
	/** Optional reviewer override (UI shows the override when present). */
	overrideDecision?: string;
	/** Fired flag ids — what we map to "rule ids" in analytics. */
	firedFlagIds: string[];
	/** Optional Axiom AI overlay (when the job ran AI extraction/evaluation). */
	axiomDecision?: string;
}

export class ReviewProgramResultsReader {
	private readonly logger = new Logger('ReviewProgramResultsReader');

	constructor(private readonly db: CosmosDbService) {}

	/**
	 * Pull every review program decision for a tenant inside the given window.
	 * Walks bulk-portfolio-jobs first (tenantId-partitioned), then expands each
	 * job's results either from the embedded items[] or from the review-results
	 * spillover container.
	 */
	async listSince(tenantId: string, sinceIso: string): Promise<NormalizedReviewDecision[]> {
		const jobs = await this.db.queryDocuments<BulkPortfolioJob>(
			JOBS_CONTAINER,
			`SELECT TOP @limit * FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.submittedAt >= @sinceIso
			   AND (c.processingMode = 'TAPE_EVALUATION' OR c.processingMode = 'DOCUMENT_EXTRACTION' OR NOT IS_DEFINED(c.processingMode))
			 ORDER BY c.submittedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@sinceIso', value: sinceIso },
				{ name: '@limit', value: MAX_JOBS_PER_QUERY },
			],
		);

		const out: NormalizedReviewDecision[] = [];
		for (const job of jobs) {
			out.push(...await this.normalizeJobResults(job));
		}
		this.logger.info('review-program results loaded', {
			tenantId,
			sinceIso,
			jobsScanned: jobs.length,
			decisionsLoaded: out.length,
		});
		return out;
	}

	private async normalizeJobResults(job: BulkPortfolioJob): Promise<NormalizedReviewDecision[]> {
		// Small jobs embed results inline; large jobs spill to review-results.
		const inline = collectInlineResults(job.items);
		const overflow = inline.length === 0 ? await this.loadResultsForJob(job.id) : [];
		const all = inline.length > 0 ? inline : overflow;

		return all.map(r => this.normalizeOne(job, r));
	}

	private async loadResultsForJob(jobId: string): Promise<ReviewTapeResult[]> {
		// jobId is the partition key — partition-scoped query.
		return this.db.queryDocuments<ReviewTapeResult>(
			RESULTS_CONTAINER,
			`SELECT TOP @limit * FROM c WHERE c.jobId = @jobId`,
			[
				{ name: '@jobId', value: jobId },
				{ name: '@limit', value: MAX_RESULTS_PER_JOB },
			],
		);
	}

	private normalizeOne(job: BulkPortfolioJob, r: ReviewTapeResult): NormalizedReviewDecision {
		const firedFlagIds: string[] = [];
		for (const f of r.autoFlagResults ?? []) {
			if (f?.isFired && typeof f.id === 'string') firedFlagIds.push(f.id);
		}
		for (const f of r.manualFlagResults ?? []) {
			if (f?.isFired && typeof f.id === 'string') firedFlagIds.push(f.id);
		}

		return {
			id: `${job.id}__${r.loanNumber ?? r.rowIndex ?? 'unknown'}`,
			tenantId: job.tenantId,
			jobId: job.id,
			jobSubmittedAt: job.submittedAt,
			...(job.reviewProgramId ? { reviewProgramId: job.reviewProgramId } : {}),
			...(job.reviewProgramVersion ? { reviewProgramVersion: job.reviewProgramVersion } : {}),
			...(r.loanNumber ? { loanNumber: r.loanNumber } : {}),
			evaluatedAt: r.evaluatedAt ?? job.submittedAt,
			...(typeof r.overallRiskScore === 'number' ? { overallRiskScore: r.overallRiskScore } : {}),
			...(r.computedDecision ? { computedDecision: r.computedDecision } : {}),
			...(r.overrideDecision ? { overrideDecision: r.overrideDecision } : {}),
			firedFlagIds,
			...(r.axiomDecision ? { axiomDecision: r.axiomDecision } : {}),
		};
	}
}

/** Distinguish inline ReviewTapeResult[] from BulkPortfolioItem[]. */
function collectInlineResults(items: BulkPortfolioJob['items']): ReviewTapeResult[] {
	if (!Array.isArray(items)) return [];
	const out: ReviewTapeResult[] = [];
	for (const item of items) {
		if (item && typeof item === 'object' && 'autoFlagResults' in item) {
			out.push(item as ReviewTapeResult);
		}
	}
	return out;
}
