/**
 * AutopilotRecipeRepository — Phase 14 v2 (2026-05-11).
 *
 * CRUD layer over the `ai-autopilot-recipes` Cosmos container.  Recipes
 * are tenant-scoped (partition key `/tenantId`).  Sponsored by a real
 * human user — the recipe's `sponsorUserId` is the audit attribution
 * target for every run it spawns.
 *
 * Storage: shares the single Cosmos container `ai-autopilot` with
 * `AutopilotRunRepository`.  Both partition by `/tenantId` and
 * discriminate by `entityType` (`autopilot-recipe` here,
 * `autopilot-run` for fires).  Decision rationale (per the "no schema
 * bloat — investigate existing storage first" rule):
 *
 *   Surveyed: ai-audit-events (append-only, wrong fit), ai-conversations
 *   (per-conversation, not per-recipe), ai-feature-flags (key/value
 *   config — volume mismatch with runs), ai-telemetry-events (30d TTL,
 *   wrong fit for 180d runs).  None of the existing AI containers fit
 *   both recipes AND runs cleanly.  Single new container, two
 *   entityTypes, per-doc TTL on runs.
 *
 * Provisioning: this code reads `AI_AUTOPILOT_CONTAINER` (default
 * `ai-autopilot`) and assumes the container EXISTS.  If it doesn't,
 * every CRUD call returns a clean error — we never create infrastructure
 * in code (per CLAUDE.md rule #3).  Bicep declares the container in
 * `infrastructure/modules/cosmos-ai-assistant-containers.bicep`.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { ApiResponse } from '../types/index.js';
import type { AutopilotRecipe } from '../types/autopilot-recipe.types.js';

const DEFAULT_CONTAINER = 'ai-autopilot';

function containerName(): string {
	return process.env.AI_AUTOPILOT_CONTAINER || DEFAULT_CONTAINER;
}

export interface CreateRecipeInput
	extends Omit<
		AutopilotRecipe,
		'id' | 'entityType' | 'createdAt' | 'updatedAt' | 'fireCount' | 'status'
	> {
	status?: AutopilotRecipe['status'];
}

export class AutopilotRecipeRepository {
	private readonly logger = new Logger('AutopilotRecipeRepository');

	constructor(private readonly cosmos: CosmosDbService) {}

	async create(input: CreateRecipeInput): Promise<ApiResponse<AutopilotRecipe>> {
		if (!input?.tenantId || !input?.sponsorUserId || !input?.createdBy) {
			return {
				success: false,
				error: {
					code: 'INVALID_RECIPE',
					message: 'Recipe requires tenantId, sponsorUserId, and createdBy.',
					timestamp: new Date(),
				},
			};
		}
		const now = new Date().toISOString();
		const doc: AutopilotRecipe = {
			id: uuidv4(),
			entityType: 'autopilot-recipe',
			fireCount: 0,
			status: input.status ?? 'active',
			createdAt: now,
			updatedAt: now,
			...input,
		};
		return this.cosmos.createItem<AutopilotRecipe>(containerName(), doc);
	}

	async getById(
		tenantId: string,
		recipeId: string,
	): Promise<ApiResponse<AutopilotRecipe | null>> {
		const result = await this.cosmos.queryItems<AutopilotRecipe>(
			containerName(),
			'SELECT TOP 1 * FROM c WHERE c.tenantId = @tenantId AND c.id = @id',
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@id', value: recipeId },
			],
		);
		if (!result.success) return { success: false, error: result.error! };
		return { success: true, data: result.data?.[0] ?? null };
	}

	async listForTenant(
		tenantId: string,
		statuses?: AutopilotRecipe['status'][],
	): Promise<ApiResponse<AutopilotRecipe[]>> {
		const params: { name: string; value: unknown }[] = [
			{ name: '@tenantId', value: tenantId },
		];
		let q = 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.entityType = "autopilot-recipe"';
		if (statuses && statuses.length > 0) {
			const placeholders = statuses.map((_, i) => `@s${i}`).join(', ');
			q += ` AND c.status IN (${placeholders})`;
			statuses.forEach((s, i) => params.push({ name: `@s${i}`, value: s }));
		}
		q += ' ORDER BY c.createdAt DESC';
		return this.cosmos.queryItems<AutopilotRecipe>(containerName(), q, params);
	}

	/**
	 * Sweep helper for the cron timer — every active recipe across every
	 * tenant.  Used by AiAutopilotSweep to enumerate fires per cycle.
	 */
	async listAllActiveCronRecipes(): Promise<ApiResponse<AutopilotRecipe[]>> {
		return this.cosmos.queryItems<AutopilotRecipe>(
			containerName(),
			`SELECT * FROM c
			 WHERE c.entityType = "autopilot-recipe"
			   AND c.status = "active"
			   AND c.trigger.kind = "cron"
			   AND IS_DEFINED(c.trigger.cron)`,
			[],
		);
	}

	async update(
		tenantId: string,
		recipeId: string,
		patch: Partial<AutopilotRecipe>,
	): Promise<ApiResponse<AutopilotRecipe>> {
		const current = await this.getById(tenantId, recipeId);
		if (!current.success) return { success: false, error: current.error! };
		if (!current.data) {
			return {
				success: false,
				error: {
					code: 'NOT_FOUND',
					message: `Recipe ${recipeId} not found in tenant ${tenantId}.`,
					timestamp: new Date(),
				},
			};
		}
		const merged: AutopilotRecipe = {
			...current.data,
			...patch,
			id: current.data.id,
			tenantId: current.data.tenantId,
			entityType: 'autopilot-recipe',
			updatedAt: new Date().toISOString(),
		};
		return this.cosmos.upsertItem<AutopilotRecipe>(containerName(), merged);
	}

	async recordFire(
		tenantId: string,
		recipeId: string,
		success: boolean,
		failureReason?: string,
	): Promise<void> {
		try {
			const current = await this.getById(tenantId, recipeId);
			if (!current.success || !current.data) return;
			const now = new Date().toISOString();
			const patch: Partial<AutopilotRecipe> = {
				fireCount: (current.data.fireCount ?? 0) + 1,
			};
			if (success) {
				patch.lastFireAt = now;
			} else {
				patch.lastFailureAt = now;
				patch.lastFailureReason = failureReason ?? 'unknown';
			}
			await this.update(tenantId, recipeId, patch);
		} catch (err) {
			// Telemetry-only — recipe fire-count drift is acceptable.
			this.logger.warn('Failed to record recipe fire', {
				tenantId,
				recipeId,
				success,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
