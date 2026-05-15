/**
 * AutopilotRunRepository — Phase 14 v2 (2026-05-11).
 *
 * Persistence + idempotency for `AutopilotRun` rows.  Each run row is the
 * canonical state machine for one fire: queued → running → succeeded /
 * failed / awaiting-approval / cancelled / timed-out / budget-exhausted.
 *
 * Why Cosmos and not in-memory: when the consumer pod restarts mid-run
 * or a duplicate Service Bus delivery lands, we need durable de-dupe by
 * `idempotencyKey`.  In-memory tracking would lose state on every deploy.
 *
 * Container: shares `ai-autopilot` with `AutopilotRecipeRepository`.
 * Both entities partition by `/tenantId` and discriminate by
 * `entityType` (`autopilot-run` here, `autopilot-recipe` for recipes).
 * Run documents carry their own `ttl: 15552000` (180 days) — the
 * container default TTL is -1 so recipes stay forever; per-doc TTL
 * on runs gives Cosmos automatic cleanup without affecting recipes.
 *
 * Same "operator provisions the container" rule applies — we never call
 * `createIfNotExists` on infrastructure (per CLAUDE.md rule #3).
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { ApiResponse } from '../types/index.js';
import type { AutopilotRun } from '../types/autopilot-recipe.types.js';

const DEFAULT_CONTAINER = 'ai-autopilot';

/**
 * Matches the `COSMOS_CONTAINER_<NAME>` env naming convention already in
 * use elsewhere (orders / properties / vendors).  Shared with the recipe
 * repository — same container, different `entityType`.
 */
function containerName(): string {
	return process.env.COSMOS_CONTAINER_AI_AUTOPILOT || DEFAULT_CONTAINER;
}

/**
 * Per-document TTL (180 days = 15,552,000 s).  Runs auto-cleanup at this
 * window; the canonical long-term record lives in `ai-audit-events`.
 * Set on the document itself so it overrides the container default,
 * which is -1 (recipes stay forever).
 */
const RUN_TTL_SECONDS = 15_552_000;

export interface CreateRunInput
	extends Omit<AutopilotRun, 'id' | 'entityType' | 'startedAt' | 'status'> {
	status?: AutopilotRun['status'];
}

export class AutopilotRunRepository {
	private readonly logger = new Logger('AutopilotRunRepository');

	constructor(private readonly cosmos: CosmosDbService) {}

	async create(input: CreateRunInput): Promise<ApiResponse<AutopilotRun>> {
		const now = new Date().toISOString();
		const doc: AutopilotRun & { ttl: number } = {
			id: uuidv4(),
			entityType: 'autopilot-run',
			status: input.status ?? 'queued',
			startedAt: now,
			...input,
			// Per-doc TTL — Cosmos auto-deletes after 180 days.  Container
			// default TTL is -1 so recipes (the other entityType in this
			// container) stay forever.  Per-doc `ttl` wins.
			ttl: RUN_TTL_SECONDS,
		};
		return this.cosmos.createItem<AutopilotRun>(containerName(), doc);
	}

	async getById(
		tenantId: string,
		runId: string,
	): Promise<ApiResponse<AutopilotRun | null>> {
		const r = await this.cosmos.queryItems<AutopilotRun>(
			containerName(),
			'SELECT TOP 1 * FROM c WHERE c.tenantId = @tenantId AND c.id = @id',
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@id', value: runId },
			],
		);
		if (!r.success) return { success: false, error: r.error! };
		return { success: true, data: r.data?.[0] ?? null };
	}

	/**
	 * Idempotency probe — has a run with this idempotencyKey already been
	 * processed for this tenant?  Returns the existing run row if so.
	 *
	 * Used by AutopilotService at message receipt to short-circuit
	 * duplicate Service Bus deliveries.  The key is supplied in the SB
	 * envelope by the producer (cron sweeper, webhook handler, AI chain)
	 * and uniquely identifies the logical trigger.
	 */
	async findByIdempotencyKey(
		tenantId: string,
		idempotencyKey: string,
	): Promise<ApiResponse<AutopilotRun | null>> {
		const r = await this.cosmos.queryItems<AutopilotRun>(
			containerName(),
			`SELECT TOP 1 * FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.entityType = "autopilot-run"
			   AND c.triggeredBy.idempotencyKey = @key`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@key', value: idempotencyKey },
			],
		);
		if (!r.success) return { success: false, error: r.error! };
		return { success: true, data: r.data?.[0] ?? null };
	}

	async listAwaitingApproval(
		tenantId: string,
		limit: number = 100,
	): Promise<ApiResponse<AutopilotRun[]>> {
		return this.cosmos.queryItems<AutopilotRun>(
			containerName(),
			`SELECT TOP ${Math.max(1, Math.min(limit, 500))} * FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.entityType = "autopilot-run"
			   AND c.status = "awaiting-approval"
			 ORDER BY c.startedAt DESC`,
			[{ name: '@tenantId', value: tenantId }],
		);
	}

	async listRecent(
		tenantId: string,
		limit: number = 50,
	): Promise<ApiResponse<AutopilotRun[]>> {
		return this.cosmos.queryItems<AutopilotRun>(
			containerName(),
			`SELECT TOP ${Math.max(1, Math.min(limit, 500))} * FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.entityType = "autopilot-run"
			 ORDER BY c.startedAt DESC`,
			[{ name: '@tenantId', value: tenantId }],
		);
	}

	async update(
		tenantId: string,
		runId: string,
		patch: Partial<AutopilotRun>,
	): Promise<ApiResponse<AutopilotRun>> {
		const current = await this.getById(tenantId, runId);
		if (!current.success) return { success: false, error: current.error! };
		if (!current.data) {
			return {
				success: false,
				error: {
					code: 'NOT_FOUND',
					message: `Run ${runId} not found in tenant ${tenantId}.`,
					timestamp: new Date(),
				},
			};
		}
		const merged: AutopilotRun = {
			...current.data,
			...patch,
			id: current.data.id,
			tenantId: current.data.tenantId,
			entityType: 'autopilot-run',
		};
		return this.cosmos.upsertItem<AutopilotRun>(containerName(), merged);
	}

	/** Convenience: mark a run terminal (success/failure/cancel). */
	async finalize(
		tenantId: string,
		runId: string,
		terminal: AutopilotRun['status'],
		extras: Partial<Pick<AutopilotRun, 'error' | 'metrics'>> = {},
	): Promise<void> {
		try {
			await this.update(tenantId, runId, {
				status: terminal,
				completedAt: new Date().toISOString(),
				...extras,
			});
		} catch (err) {
			this.logger.warn('Failed to finalize run', {
				tenantId,
				runId,
				terminal,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
