/**
 * AI Audit Service
 *
 * Persists attributable records of every AI-initiated tool / intent
 * execution to the `ai-audit-events` Cosmos container.  Pairs with the
 * frontend `emitAiAudit` helper in the AI Assistant codebase.
 *
 * Design rules (aligned with engagement-audit / audit-event-sink):
 *  - Tenant-scoped via partition key `/tenantId`.
 *  - Never silently drops a write on failure — returns a typed
 *    `ApiResponse<T>` so the controller surfaces a clear error.
 *  - Append-only; no updates.  Every mutation is a fresh row.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { ApiResponse } from '../types/index.js';

const CONTAINER_NAME = 'ai-audit-events';

export type AiAuditKind = 'tool' | 'intent';
export type AiAuditSideEffect = 'read' | 'write' | 'external';

/** Shape as stored in Cosmos.  Mirrors frontend `AiAuditRow` in
 *  `src/utils/aiAudit.ts` of the l1-valuation-platform-ui repo. */
export interface AiAuditDoc {
	id: string;
	entityType: 'ai-audit-event';
	/** Partition key. */
	tenantId: string;
	/** Who performed the action (req.user.id). */
	userId: string;
	/** ISO-8601 instant the client thought it happened. */
	timestamp: string;
	/** ISO-8601 instant the server persisted it.  Useful for clock-skew checks. */
	savedAt: string;
	/** UI surface that originated the call. */
	surface?: string;
	/** Conversation id for cross-reference with ai-conversations. */
	conversationId?: string;
	kind: AiAuditKind;
	/** Tool / intent name. */
	name: string;
	/** Scopes the entry required. */
	scopes: string[];
	sideEffect: AiAuditSideEffect;
	/** Human-readable description (from `intent.describe(payload)`). */
	description?: string;
	success: boolean;
	errorMessage?: string;
	/** Cross-link entity id (order / invoice / etc.). */
	entityId?: string;
	/**
	 * Origin of the audit row.  Phase 14 v1 (2026-05-10):
	 *   - 'fe'            : emitted by the frontend useAiToolLoop / intent registry
	 *   - 'be-dispatcher' : emitted by AiActionDispatcherService on a server-side
	 *                       /api/ai/execute call
	 *   - 'autopilot'     : emitted by the autonomous-runtime consumer
	 *                       (Service Bus / cron / webhook)
	 *   - 'be-service'    : emitted by another BE service directly
	 */
	source?: 'fe' | 'be-dispatcher' | 'autopilot' | 'be-service';
	/**
	 * When `source === 'autopilot'`, identifies what triggered the run.
	 * Delegated-identity model (Phase 14): every autopilot run has a
	 * sponsoring human user — scopes follow the sponsor, audit
	 * attribution carries the sponsor's userId.
	 */
	triggeredBy?: {
		kind: 'cron' | 'webhook' | 'user-rule' | 'ai-chain' | 'queue';
		recipeId?: string;
		sponsorUserId?: string;
		parentRunId?: string;
	};
}

export interface AiAuditWriteInput {
	timestamp: string;
	surface?: string;
	conversationId?: string;
	kind: AiAuditKind;
	name: string;
	scopes: string[];
	sideEffect: AiAuditSideEffect;
	description?: string;
	success: boolean;
	errorMessage?: string;
	entityId?: string;
	/** Phase 14 v1: origin of this audit row. */
	source?: AiAuditDoc['source'];
	triggeredBy?: AiAuditDoc['triggeredBy'];
}

export interface AiAuditQueryOptions {
	tenantId: string;
	userId?: string;
	kind?: AiAuditKind;
	entityId?: string;
	dateFrom?: string;
	dateTo?: string;
	limit?: number;
}

export class AiAuditService {
	private readonly logger = new Logger('AiAuditService');

	constructor(private readonly cosmos: CosmosDbService) {}

	/**
	 * Persist one audit row.  Caller supplies `tenantId` + `userId` from
	 * the authenticated request (we do not trust the client).  Returns
	 * the stored document on success.
	 */
	async write(
		tenantId: string,
		userId: string,
		input: AiAuditWriteInput,
	): Promise<ApiResponse<AiAuditDoc>> {
		if (!tenantId || !userId) {
			return {
				success: false,
				error: {
					code: 'MISSING_AUTH_CONTEXT',
					message: 'AI audit write requires resolved tenantId + userId from the authenticated request.',
					timestamp: new Date(),
				},
			};
		}
		if (!input?.name || !input?.kind || !input?.sideEffect) {
			return {
				success: false,
				error: {
					code: 'INVALID_AUDIT_ROW',
					message: 'AI audit row requires name, kind, and sideEffect.',
					timestamp: new Date(),
				},
			};
		}

		const now = new Date().toISOString();
		// exactOptionalPropertyTypes requires us to omit undefined fields
		// rather than set them to `undefined`.  Build the doc
		// conditionally so optional fields only appear when supplied.
		const doc: AiAuditDoc = {
			id: uuidv4(),
			entityType: 'ai-audit-event',
			tenantId,
			userId,
			timestamp: input.timestamp ?? now,
			savedAt: now,
			kind: input.kind,
			name: input.name,
			scopes: Array.isArray(input.scopes) ? input.scopes : [],
			sideEffect: input.sideEffect,
			success: Boolean(input.success),
			...(input.surface !== undefined && { surface: input.surface }),
			...(input.conversationId !== undefined && { conversationId: input.conversationId }),
			...(input.description !== undefined && { description: input.description }),
			...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
			...(input.entityId !== undefined && { entityId: input.entityId }),
			...(input.source !== undefined && { source: input.source }),
			...(input.triggeredBy !== undefined && { triggeredBy: input.triggeredBy }),
		};

		return this.cosmos.createItem<AiAuditDoc>(CONTAINER_NAME, doc);
	}

	/** Paginated query scoped to a single tenant. */
	async query(opts: AiAuditQueryOptions): Promise<ApiResponse<AiAuditDoc[]>> {
		if (!opts?.tenantId) {
			return {
				success: false,
				error: {
					code: 'MISSING_TENANT',
					message: 'AI audit query requires tenantId (from the authenticated request).',
					timestamp: new Date(),
				},
			};
		}

		const conditions: string[] = ['c.tenantId = @tenantId'];
		const parameters: { name: string; value: unknown }[] = [
			{ name: '@tenantId', value: opts.tenantId },
		];

		if (opts.userId) {
			conditions.push('c.userId = @userId');
			parameters.push({ name: '@userId', value: opts.userId });
		}
		if (opts.kind) {
			conditions.push('c.kind = @kind');
			parameters.push({ name: '@kind', value: opts.kind });
		}
		if (opts.entityId) {
			conditions.push('c.entityId = @entityId');
			parameters.push({ name: '@entityId', value: opts.entityId });
		}
		if (opts.dateFrom) {
			conditions.push('c.timestamp >= @dateFrom');
			parameters.push({ name: '@dateFrom', value: opts.dateFrom });
		}
		if (opts.dateTo) {
			conditions.push('c.timestamp <= @dateTo');
			parameters.push({ name: '@dateTo', value: opts.dateTo });
		}

		const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
		const query = `SELECT TOP ${limit} * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.timestamp DESC`;

		return this.cosmos.queryItems<AiAuditDoc>(CONTAINER_NAME, query, parameters);
	}

	/**
	 * Delete every audit row for one user (right-to-delete).  Invoked
	 * from the existing account-closure pipeline.  This is a hot path
	 * policy-wise — log every call.
	 */
	async deleteForUser(tenantId: string, userId: string): Promise<ApiResponse<{ deleted: number }>> {
		if (!tenantId || !userId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'AI audit deleteForUser requires tenantId + userId.',
					timestamp: new Date(),
				},
			};
		}
		this.logger.warn('AI audit deletion requested', { tenantId, userId });

		const listResult = await this.cosmos.queryItems<AiAuditDoc>(
			CONTAINER_NAME,
			'SELECT c.id, c.tenantId FROM c WHERE c.tenantId = @tenantId AND c.userId = @userId',
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@userId', value: userId },
			],
		);
		if (!listResult.success || !listResult.data) {
			return listResult.error
				? { success: false, error: listResult.error }
				: {
						success: false,
						error: {
							code: 'QUERY_FAILED',
							message: 'Failed to list audit rows for deletion.',
							timestamp: new Date(),
						},
					};
		}

		let deleted = 0;
		for (const row of listResult.data) {
			const result = await this.cosmos.deleteItem(CONTAINER_NAME, row.id, row.tenantId);
			if (result.success) deleted += 1;
		}
		this.logger.info('AI audit deletion complete', { tenantId, userId, deleted });
		return { success: true, data: { deleted } };
	}
}
