/**
 * AutopilotRecipe types — Phase 14 v1 (2026-05-10).
 *
 * Data model only.  Phase 14 v2 wires up the Service Bus consumer and
 * Azure Function timer that actually fire these recipes.  This file
 * exists so:
 *
 *   (a) Other services can already type-check against the shape that
 *       v2 will consume (no big-bang rewrite when v2 ships).
 *   (b) An admin UI can be built ahead of v2 to manage recipes
 *       (create / edit / sponsor / pause).
 *   (c) The AI catalog can expose recipe-management endpoints in
 *       Phase 14 v2 without retro-fitting types.
 *
 * Per AI-UNIVERSAL-SURFACE-PLAN.md §4 Phase 14 — autonomous runtime
 * with delegated-identity model: every recipe has a sponsoring human
 * user; the autopilot run uses the sponsor's tenantId + userId at
 * fire time, NOT a tenant-wide service identity.  If the sponsor is
 * offboarded, the recipe pauses.
 */

export type AutopilotTriggerKind =
	| 'cron'
	| 'webhook'
	| 'user-rule'
	| 'queue-message'
	| 'ai-chain';

/**
 * Effective autonomy at the recipe level — overrides the per-intent
 * default from AiIntent.autonomy.  Recipes can be MORE restrictive
 * than the intent (e.g. always queue this CREATE_ORDER for approval
 * even if the intent's default is auto-execute) but cannot be LESS
 * restrictive (a recipe cannot auto-execute SEND_EMAIL when the
 * intent declares 'admin').
 */
export type AutopilotPolicyMode = 'always' | 'approve' | 'admin' | 'never';

export interface AutopilotPolicy {
	mode: AutopilotPolicyMode;
	/**
	 * When 'approve' or 'admin': how many minutes the proposal sits in
	 * the queue before auto-cancelling.  Default 1440 (24h).
	 */
	approvalTimeoutMinutes?: number;
	/**
	 * Hard cost ceilings the runtime enforces per fire.  Going over
	 * cancels the run + emits a high-severity audit row.
	 */
	budget?: {
		tokens?: number;
		wallSeconds?: number;
		costUsd?: number;
	};
}

export interface AutopilotTrigger {
	kind: AutopilotTriggerKind;
	/** For 'cron': standard cron expression in UTC. */
	cron?: string;
	/** For 'webhook': which webhook source triggers this. */
	webhookSource?: string;
	/** For 'queue-message': the queue name. */
	queueName?: string;
	/** Whether THIS run can spawn child runs via the ai-chain mechanism. */
	chainable?: boolean;
}

/**
 * The thing the autopilot run will actually do.  Either:
 *   - a `prompt` (natural language) → parse-intent → intent dispatch
 *   - OR a pre-resolved `intent` + `actionPayload` → direct intent dispatch
 *     (used by AI-chain triggers where a prior run already classified)
 */
export interface AutopilotRequest {
	prompt?: string;
	intent?: string;
	actionPayload?: Record<string, unknown>;
	/**
	 * Optional entity context the autopilot pre-populates before parsing.
	 * Mirrors the structured-context block FE prompts carry.
	 */
	context?: {
		entityType?: string;
		entityId?: string;
		page?: string;
	};
}

export interface AutopilotRecipe {
	id: string;
	/** Cosmos partition key. */
	tenantId: string;
	entityType: 'autopilot-recipe';
	/** Human-readable name shown in the admin UI. */
	name: string;
	/** Long-form description of what the recipe does. */
	description?: string;
	/**
	 * Delegated identity: the human who scheduled / sponsors this recipe.
	 * Required.  Every autopilot run uses this user's scopes at fire time.
	 * If the sponsor is offboarded (auth lookup fails), the recipe pauses
	 * and notifies tenant admins to re-sponsor.
	 */
	sponsorUserId: string;
	/** Default policy if no specific intent's policy applies. */
	policy: AutopilotPolicy;
	trigger: AutopilotTrigger;
	request: AutopilotRequest;
	/** Operational state — set by admin UI or runtime. */
	status: 'active' | 'paused' | 'sponsor-missing' | 'budget-exhausted' | 'archived';
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	/** How many times this recipe has fired (for telemetry / debugging). */
	fireCount?: number;
	/** Timestamp of the most recent successful fire. */
	lastFireAt?: string;
	/** Timestamp of the most recent failed fire. */
	lastFailureAt?: string;
	lastFailureReason?: string;
}

/**
 * A single autopilot RUN — the persistent record of one fire.  Created
 * when the trigger lands; updated as the run progresses; finalized on
 * success / failure / cancellation.  Used by the /ai-audit page to
 * stitch autonomous activity into a coherent timeline.
 */
export interface AutopilotRun {
	id: string;
	tenantId: string;
	entityType: 'autopilot-run';
	recipeId: string;
	/** The sponsor user at fire time (snapshot — not a live join). */
	sponsorUserId: string;
	/** What kicked off this run. */
	triggeredBy: {
		kind: AutopilotTriggerKind;
		sourceId?: string;
		parentRunId?: string;
		idempotencyKey?: string;
	};
	status: 'queued' | 'running' | 'awaiting-approval' | 'succeeded' | 'failed' | 'cancelled' | 'timed-out' | 'budget-exhausted';
	startedAt: string;
	completedAt?: string;
	/** Set when the run wants human approval. */
	pendingApproval?: {
		intent: string;
		actionPayload: Record<string, unknown>;
		proposedAt: string;
		approverPolicy: AutopilotPolicyMode;
		approvedByUserId?: string;
		approvedAt?: string;
		rejectedByUserId?: string;
		rejectedAt?: string;
		rejectionReason?: string;
	};
	error?: {
		message: string;
		code?: string;
	};
	/** Token / wall / cost metrics — populated as the run progresses. */
	metrics?: {
		tokensIn?: number;
		tokensOut?: number;
		wallSeconds?: number;
		costUsd?: number;
	};
}
