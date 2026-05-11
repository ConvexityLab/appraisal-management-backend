/**
 * ReviewProgramOrchestrator — Phase K of
 * docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Subscribes to `engagement.order.created` and runs a review-program
 * evaluation against the freshly-created order using the existing
 * `TapeEvaluationService` (no new evaluator). Persists the result into
 * the existing `review-results` container with the new
 * `triggerSource: 'order-created'` field. Operators see review-program
 * traces on every order creation, not only on bulk-portfolio uploads.
 *
 * No new container, no new evaluator — adapter that wires existing
 * platform pieces together.
 *
 * Configuration (per-tenant on `ClientAutomationConfig`):
 *   - reviewProgramOnOrderCreated: bool — master switch.
 *   - reviewProgramIdForOrders: string  — default program; engagement-level
 *                                          override takes precedence.
 *
 * Honors the Decision Engine kill switch for `review-program` category —
 * killed tenants skip with one log line, no decision recorded.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import { ServiceBusEventSubscriber } from '../../service-bus-subscriber.js';
import { ServiceBusEventPublisher } from '../../service-bus-publisher.js';
import { TapeEvaluationService } from '../../tape-evaluation.service.js';
import { TenantAutomationConfigService } from '../../tenant-automation-config.service.js';
import type { DecisionEngineKillSwitchService } from '../kill-switch/kill-switch.service.js';
import type { EngagementOrderCreatedEvent, BaseEvent, EventHandler } from '../../../types/events.js';
import { EventCategory, EventPriority } from '../../../types/events.js';
import type { ReviewProgram, ReviewTapeResult, RiskTapeItem } from '../../../types/review-tape.types.js';

const REVIEW_PROGRAMS_CONTAINER = 'review-programs';
const REVIEW_RESULTS_CONTAINER = 'review-results';
const SUBSCRIPTION_NAME = 'review-program-orchestrator';
const CATEGORY_ID = 'review-program';

export class ReviewProgramOrchestrator {
	private readonly logger = new Logger('ReviewProgramOrchestrator');
	private readonly publisher: ServiceBusEventPublisher;
	private readonly subscriber: ServiceBusEventSubscriber;
	private readonly tapeEvaluation: TapeEvaluationService;
	private readonly tenantConfig: TenantAutomationConfigService;
	private isStarted = false;

	constructor(
		private readonly dbService: CosmosDbService,
		private readonly killSwitches: DecisionEngineKillSwitchService | null = null,
	) {
		this.publisher = new ServiceBusEventPublisher();
		this.subscriber = new ServiceBusEventSubscriber(
			undefined,
			'appraisal-events',
			SUBSCRIPTION_NAME,
		);
		this.tapeEvaluation = new TapeEvaluationService();
		this.tenantConfig = new TenantAutomationConfigService(dbService);
	}

	async start(): Promise<void> {
		if (this.isStarted) {
			this.logger.warn('ReviewProgramOrchestrator already started');
			return;
		}
		await this.subscriber.subscribe<EngagementOrderCreatedEvent>(
			'engagement.order.created',
			this.makeHandler('engagement.order.created', this.onEngagementOrderCreated.bind(this)),
		);
		this.isStarted = true;
		this.logger.info('ReviewProgramOrchestrator started — subscribed to engagement.order.created');
	}

	async stop(): Promise<void> {
		if (!this.isStarted) return;
		await this.subscriber.unsubscribe('engagement.order.created');
		this.isStarted = false;
	}

	/**
	 * Public entry point also used by integration tests + the
	 * `triggerReviewProgramForOrder` admin endpoint (Phase K2).
	 */
	async runForOrder(args: {
		tenantId: string;
		orderId: string;
		clientId: string;
		engagementId?: string;
		propertyAddress: string;
		productType: string;
		dueDate: string;
		initiatedAt?: string;
	}): Promise<{ recorded: boolean; resultId?: string; skippedReason?: string }> {
		const { tenantId, orderId, clientId, engagementId } = args;

		// 1. Kill switch
		if (this.killSwitches && await this.killSwitches.isKilled(tenantId, CATEGORY_ID)) {
			this.logger.info('ReviewProgramOrchestrator skipping — kill switch ON', { tenantId, orderId });
			return { recorded: false, skippedReason: 'kill-switch-active' };
		}

		// 2. Tenant config
		const tenantCfg = await this.tenantConfig.getConfig(clientId);
		if (!tenantCfg.reviewProgramOnOrderCreated) {
			return { recorded: false, skippedReason: 'review-program-on-order-created-disabled' };
		}

		// 3. Pick the review program — engagement override beats tenant default.
		const programId = await this.resolveReviewProgramId(engagementId, tenantCfg.reviewProgramIdForOrders);
		if (!programId) {
			this.logger.warn('ReviewProgramOrchestrator: no programId configured', {
				tenantId, orderId, engagementId,
				hint: 'Set ClientAutomationConfig.reviewProgramIdForOrders or engagement.reviewProgramId',
			});
			return { recorded: false, skippedReason: 'no-program-configured' };
		}

		let program: ReviewProgram;
		try {
			program = await this.loadReviewProgram(programId);
		} catch (err) {
			this.logger.error('ReviewProgramOrchestrator: program load failed', {
				tenantId, orderId, programId, error: err instanceof Error ? err.message : String(err),
			});
			return { recorded: false, skippedReason: 'program-load-failed' };
		}

		// 4. Build the fact bundle. We use the order context we have on the
		// event; richer projection (loan / borrower / property characteristics)
		// comes from the engagement document when present.
		const tapeItem = await this.projectOrderToTapeItem(args, engagementId);

		// 5. Evaluate
		const [result] = this.tapeEvaluation.evaluate([tapeItem], program);
		if (!result) {
			return { recorded: false, skippedReason: 'evaluator-returned-empty' };
		}

		// 6. Persist. jobId on the synthetic doc = orderId (review-results is
		// partitioned by /jobId; using orderId keeps order-scoped queries
		// partition-local).
		const recorded: ReviewTapeResult & { id: string; jobId: string; type: string } = {
			...result,
			id: `review-result-${orderId}-${result.programId}-${Date.now()}`,
			jobId: orderId,
			type: 'review-result',
			triggerSource: 'order-created',
			tenantId,
			orderId,
		} as ReviewTapeResult & { id: string; jobId: string; type: string };

		await this.dbService.upsertDocument(REVIEW_RESULTS_CONTAINER, recorded);

		// 7. Publish review-program.decision.completed so downstream consumers
		//    (review-dispatch, notifications, etc.) can route based on outcome.
		try {
			await this.publisher.publish({
				id: uuidv4(),
				type: 'review-program.decision.completed',
				timestamp: new Date(),
				source: 'review-program-orchestrator',
				version: '1.0',
				category: EventCategory.ORDER,
				priority: EventPriority.NORMAL,
				data: {
					tenantId,
					orderId,
					...(engagementId ? { engagementId } : {}),
					programId,
					programVersion: program.version,
					computedDecision: result.computedDecision,
					overallRiskScore: result.overallRiskScore,
					triggerSource: 'order-created',
				},
			} as never);
		} catch (err) {
			// Publishing is best-effort — the decision is persisted regardless.
			this.logger.warn('review-program.decision.completed publish failed (decision recorded anyway)', {
				orderId, error: err instanceof Error ? err.message : String(err),
			});
		}

		this.logger.info('ReviewProgramOrchestrator decision recorded', {
			tenantId, orderId, programId, decision: result.computedDecision, score: result.overallRiskScore,
		});

		return { recorded: true, resultId: recorded.id };
	}

	// ── Internals ──────────────────────────────────────────────────────────

	private makeHandler<E extends BaseEvent>(
		eventType: string,
		fn: (event: E) => Promise<void>,
	): EventHandler<E> {
		return {
			handle: async (event: E) => {
				try {
					await fn(event);
				} catch (err) {
					this.logger.error(`ReviewProgramOrchestrator handler for ${eventType} failed`, {
						eventId: event.id,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			},
		};
	}

	private async onEngagementOrderCreated(event: EngagementOrderCreatedEvent): Promise<void> {
		const d = event.data;
		await this.runForOrder({
			tenantId: d.tenantId,
			orderId: d.orderId,
			clientId: (d as { clientId?: string }).clientId ?? d.tenantId,
			...(d.engagementId ? { engagementId: d.engagementId } : {}),
			propertyAddress: d.propertyAddress,
			productType: d.productType,
			dueDate: typeof d.dueDate === 'string' ? d.dueDate : new Date(d.dueDate).toISOString(),
		});
	}

	private async resolveReviewProgramId(
		engagementId: string | undefined,
		tenantDefault: string | undefined,
	): Promise<string | null> {
		if (engagementId) {
			try {
				const engagement = await this.dbService.getItem<{ reviewProgramId?: string }>(
					'engagements',
					engagementId,
					engagementId,
				);
				if (engagement?.success && engagement.data?.reviewProgramId) {
					return engagement.data.reviewProgramId;
				}
			} catch {
				// fall through to tenant default
			}
		}
		return tenantDefault ?? null;
	}

	private async loadReviewProgram(programId: string): Promise<ReviewProgram> {
		const docs = await this.dbService.queryDocuments<ReviewProgram>(
			REVIEW_PROGRAMS_CONTAINER,
			'SELECT * FROM c WHERE c.id = @id',
			[{ name: '@id', value: programId }],
		);
		const program = docs[0];
		if (!program) {
			throw new Error(
				`Review program '${programId}' not found in review-programs container.`,
			);
		}
		return program;
	}

	/**
	 * Project the order's available context into a RiskTapeItem fact bundle.
	 * MVP: uses whatever is on the event + the engagement when present. The
	 * 73 RiskTapeItem fields are mostly tape-specific (LTV, appraised value,
	 * comps, etc.) and aren't populated yet for raw orders — TapeEvaluation
	 * gracefully handles missing fields by skipping flags that reference them.
	 *
	 * Phase K polish v2 will enrich this projection via the canonical
	 * property record + loan metadata once the order has them.
	 */
	private async projectOrderToTapeItem(
		args: {
			orderId: string;
			propertyAddress: string;
			productType: string;
		},
		engagementId: string | undefined,
	): Promise<RiskTapeItem> {
		const base: RiskTapeItem = {
			rowIndex: 0,
			propertyAddress: args.propertyAddress,
			loanType: args.productType, // legacy mapping; refined in v2
		};

		if (!engagementId) return base;

		try {
			interface EngLoanShape {
				id?: string;
				loanNumber?: string;
				loanAmount?: number;
				appraisedValue?: number;
				clientOrders?: Array<{ id?: string; vendorOrderIds?: string[] }>;
			}
			interface EngShape {
				loans?: EngLoanShape[];
				properties?: EngLoanShape[];
			}
			const eng = await this.dbService.getItem<EngShape>('engagements', engagementId, engagementId);
			if (!eng?.success || !eng.data) return base;
			const candidates = (eng.data.loans ?? eng.data.properties ?? []) as EngLoanShape[];
			const matched = candidates.find((l: EngLoanShape) =>
				(l.clientOrders ?? []).some((co) => (co.vendorOrderIds ?? []).includes(args.orderId)),
			);
			const loan = matched ?? candidates[0];
			if (loan) {
				if (loan.loanNumber) base.loanNumber = loan.loanNumber;
				if (typeof loan.loanAmount === 'number') base.loanAmount = loan.loanAmount;
				if (typeof loan.appraisedValue === 'number') base.appraisedValue = loan.appraisedValue;
			}
		} catch {
			// Best-effort — base item still evaluates.
		}
		return base;
	}
}
