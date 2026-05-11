/**
 * AI Feature Flags Service
 *
 * Per-tenant runtime overrides for the frontend AiAssistantFlags.
 * Document layout in `ai-feature-flags`:
 *   - id = tenantId              → tenant-wide defaults
 *   - id = `${tenantId}:${userId}` → per-user override (takes precedence)
 *
 * The effective flags returned by `get()` merge: frontend env defaults
 * (shipped with the build) ← tenant document ← user document.  The
 * service itself only returns what's in Cosmos; callers combine with
 * the build-time defaults.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { ApiResponse } from '../types/index.js';

const CONTAINER_NAME = 'ai-feature-flags';

/** Matches the shape of `AiAssistantFlags` in the frontend. */
export interface AiFlagsPayload {
	enabled?: boolean;
	tools?: {
		messaging?: boolean;
		negotiation?: boolean;
		navigation?: boolean;
		composites?: boolean;
		mopVendorMatching?: boolean;
		axiomTools?: boolean;
		autonomous?: boolean;
	};
	axiomAgent?: boolean;
	/**
	 * Phase 8 / A13 — negotiation rule values that used to be module
	 * constants in the frontend's `aiNegotiationGuardrails.ts`.  Now
	 * tenant-configurable so product can move the numbers without a
	 * code deploy.  Absence of any field falls back to the frontend's
	 * build-time defaults.
	 */
	negotiation?: {
		/** Max relative deviation from baseline fee (0.15 = ±15%). */
		maxFeeDelta?: number;
		/** Max business days past SLA the agent may propose. */
		maxSlaSlipBusinessDays?: number;
		/** Final-round headroom — refuses at `maxRounds - roundHeadroom`. */
		roundHeadroom?: number;
	};
	/**
	 * Phase 14 v2 canary-tenant flip lever (2026-05-11).  Default OFF
	 * per tenant; only the canary cohort gets `autopilot.enabled = true`
	 * until pentest + soak time produce green data.
	 */
	autopilot?: {
		enabled?: boolean;
		/** Per-tenant chain-depth cap.  Defaults to env default if omitted. */
		maxChainDepth?: number;
	};
	/**
	 * Phase 17b token-meter (2026-05-11) — per-tenant cost ceilings.
	 * Override the env-driven AI_COST_HARD_LIMIT_USD /
	 * AI_COST_WARN_THRESHOLD_USD on a tenant-specific basis.
	 */
	costBudget?: {
		hardLimitUsd?: number;
		warnThresholdUsd?: number;
		periodDays?: number;
	};
}

interface AiFlagsDoc extends AiFlagsPayload {
	id: string;
	entityType: 'ai-feature-flags';
	tenantId: string;
	userId?: string; // omitted for tenant-wide docs
	updatedAt: string;
	updatedBy: string;
}

export class AiFlagsService {
	private readonly logger = new Logger('AiFlagsService');

	constructor(private readonly cosmos: CosmosDbService) {}

	/**
	 * Fetch both the tenant-wide and the per-user document and return
	 * them to the controller.  The CONTROLLER is responsible for merge
	 * order so the wire shape stays explicit; this method just hydrates.
	 */
	async fetchForUser(
		tenantId: string,
		userId: string,
	): Promise<ApiResponse<{ tenant: AiFlagsPayload | null; user: AiFlagsPayload | null }>> {
		if (!tenantId || !userId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'fetchForUser requires tenantId + userId.',
					timestamp: new Date(),
				},
			};
		}
		const query = `SELECT * FROM c WHERE c.tenantId = @tenantId AND (c.id = @tenantId OR c.id = @userDocId)`;
		const result = await this.cosmos.queryItems<AiFlagsDoc>(CONTAINER_NAME, query, [
			{ name: '@tenantId', value: tenantId },
			{ name: '@userDocId', value: `${tenantId}:${userId}` },
		]);
		if (!result.success && this.isFlagsStoreUnavailable(result.error)) {
			this.logger.warn('AI flags container unavailable; returning empty runtime overrides', {
				tenantId,
				userId,
				error: result.error,
			});
			return { success: true, data: { tenant: null, user: null } };
		}
		if (!result.success) {
			return result.error
				? { success: false, error: result.error }
				: {
						success: false,
						error: {
							code: 'QUERY_FAILED',
							message: 'Flags query failed.',
							timestamp: new Date(),
						},
					};
		}

		let tenant: AiFlagsPayload | null = null;
		let user: AiFlagsPayload | null = null;
		for (const doc of result.data ?? []) {
			if (doc.id === tenantId) tenant = stripMeta(doc);
			else if (doc.id === `${tenantId}:${userId}`) user = stripMeta(doc);
		}
		return { success: true, data: { tenant, user } };
	}

	/**
	 * Upsert the tenant-wide document.  Requires admin scope — enforced
	 * at the controller.
	 */
	async upsertTenantFlags(
		tenantId: string,
		actorUserId: string,
		patch: AiFlagsPayload,
	): Promise<ApiResponse<AiFlagsPayload>> {
		if (!tenantId || !actorUserId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'upsertTenantFlags requires tenantId + actorUserId.',
					timestamp: new Date(),
				},
			};
		}
		const doc: AiFlagsDoc = {
			id: tenantId,
			entityType: 'ai-feature-flags',
			tenantId,
			...patch,
			updatedAt: new Date().toISOString(),
			updatedBy: actorUserId,
		};
		const result = await this.cosmos.upsertItem<AiFlagsDoc>(CONTAINER_NAME, doc);
		if (!result.success) {
			return result.error
				? { success: false, error: result.error }
				: {
						success: false,
						error: {
							code: 'UPSERT_FAILED',
							message: 'Tenant flag upsert failed.',
							timestamp: new Date(),
						},
					};
		}
		return { success: true, data: stripMeta(result.data as AiFlagsDoc) };
	}

	/**
	 * Upsert a per-user override.  Staff / user can manage their own
	 * overrides; the controller enforces `actorUserId === targetUserId`
	 * unless the caller is admin.
	 */
	async upsertUserFlags(
		tenantId: string,
		targetUserId: string,
		actorUserId: string,
		patch: AiFlagsPayload,
	): Promise<ApiResponse<AiFlagsPayload>> {
		if (!tenantId || !targetUserId || !actorUserId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'upsertUserFlags requires tenantId + targetUserId + actorUserId.',
					timestamp: new Date(),
				},
			};
		}
		const doc: AiFlagsDoc = {
			id: `${tenantId}:${targetUserId}`,
			entityType: 'ai-feature-flags',
			tenantId,
			userId: targetUserId,
			...patch,
			updatedAt: new Date().toISOString(),
			updatedBy: actorUserId,
		};
		const result = await this.cosmos.upsertItem<AiFlagsDoc>(CONTAINER_NAME, doc);
		if (!result.success) {
			return result.error
				? { success: false, error: result.error }
				: {
						success: false,
						error: {
							code: 'UPSERT_FAILED',
							message: 'User flag upsert failed.',
							timestamp: new Date(),
						},
					};
		}
		return { success: true, data: stripMeta(result.data as AiFlagsDoc) };
	}

	private isFlagsStoreUnavailable(error: ApiResponse<never>['error'] | undefined): boolean {
		const details = (error as { details?: Record<string, unknown> } | undefined)?.details;
		const statusCode = Number(details?.['statusCode']);
		const cosmosCode = details?.['cosmosCode'];
		const errorCode = error?.code;
		const message = error?.message ?? '';
		const containerName = details?.['containerName'];

		const containerMatches =
			containerName === CONTAINER_NAME ||
			(typeof message === 'string' && message.toLowerCase().includes(CONTAINER_NAME));

		if (!containerMatches) {
			return false;
		}

		return (
			statusCode === 404 ||
			cosmosCode === 'NotFound' ||
			errorCode === 'NOT_FOUND' ||
			(typeof message === 'string' && /not\s*found|does not exist/i.test(message))
		);
	}
}

function stripMeta(doc: AiFlagsDoc): AiFlagsPayload {
	const out: AiFlagsPayload = {};
	if (typeof doc.enabled === 'boolean') out.enabled = doc.enabled;
	if (doc.tools && typeof doc.tools === 'object') out.tools = doc.tools;
	if (typeof doc.axiomAgent === 'boolean') out.axiomAgent = doc.axiomAgent;
	if (doc.negotiation && typeof doc.negotiation === 'object') out.negotiation = doc.negotiation;
	if (doc.autopilot && typeof doc.autopilot === 'object') out.autopilot = doc.autopilot;
	if (doc.costBudget && typeof doc.costBudget === 'object') out.costBudget = doc.costBudget;
	return out;
}
