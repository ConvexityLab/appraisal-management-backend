/**
 * DecisionEngineKillSwitchService — per-tenant on/off toggle for any
 * Decision Engine category.
 *
 * Phase I (kill-switch BE wiring) of
 * docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Storage: REUSES the existing `client-configs` Cosmos container
 * (partition `/clientId`). One document per tenant with
 *   entityType = 'decision-engine-kill-switches'
 * The container already holds tenant-scoped operational toggles
 * (`autoAssignmentEnabled`, `aiQcEnabled`, `axiomAutoTrigger`, etc.) so
 * Decision Engine kill switches sit naturally beside them — no new
 * container provisioned.
 *
 * In-process LRU cache: the evaluator paths consult the flag on every
 * decision. A small in-memory cache (60s TTL) keeps that lookup off
 * Cosmos's hot path. Writes invalidate.
 *
 * Failure semantics: any read error is treated as "not killed" (fail-open).
 * The kill switch is a safety lever — the absence of state must not
 * prevent normal evaluation. Operators see kill-switch errors in logs.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';

const CONTAINER = 'client-configs';
const ENTITY_TYPE = 'decision-engine-kill-switches';
const CACHE_TTL_MS = 60 * 1000;

export interface KillSwitchDoc {
	id: string;
	clientId: string;             // == tenantId in the Decision Engine surface
	entityType: typeof ENTITY_TYPE;
	flags: Record<string, boolean>; // categoryId → killed?
	updatedAt: string;
	updatedBy: string;
}

interface CacheEntry {
	flags: Record<string, boolean>;
	expiresAt: number;
}

export class DecisionEngineKillSwitchService {
	private readonly logger = new Logger('DecisionEngineKillSwitchService');
	private readonly cache = new Map<string, CacheEntry>();

	constructor(private readonly db: CosmosDbService) {}

	/**
	 * Fast hot-path check: is this (tenant, category) currently killed?
	 * Fails OPEN — any read error returns false (don't accidentally block
	 * traffic on a kill-switch fetch hiccup). 60s in-process cache.
	 */
	async isKilled(tenantId: string, categoryId: string): Promise<boolean> {
		const flags = await this.getFlagsCached(tenantId);
		return Boolean(flags[categoryId]);
	}

	/** Load all kill-switch flags for a tenant. Used by the GET endpoint + ops UI. */
	async getFlags(tenantId: string): Promise<Record<string, boolean>> {
		return this.getFlagsCached(tenantId);
	}

	/**
	 * Set a single category's kill switch on or off. Upserts the per-tenant
	 * doc. Invalidates the cache so the next isKilled() call sees the new state
	 * within ~50ms (Cosmos write + cache refresh).
	 */
	async setFlag(
		tenantId: string,
		categoryId: string,
		enabled: boolean,
		updatedBy: string,
	): Promise<Record<string, boolean>> {
		if (!tenantId) throw new Error('tenantId is required');
		if (!categoryId) throw new Error('categoryId is required');
		if (!updatedBy) throw new Error('updatedBy is required');

		const existing = await this.fetchDoc(tenantId);
		const next: KillSwitchDoc = {
			id: existing?.id ?? `decision-engine-kill-switches-${tenantId}`,
			clientId: tenantId,
			entityType: ENTITY_TYPE,
			flags: { ...(existing?.flags ?? {}), [categoryId]: enabled },
			updatedAt: new Date().toISOString(),
			updatedBy,
		};

		await this.db.upsertDocument(CONTAINER, next);
		this.cache.delete(tenantId);

		this.logger.info('decision-engine kill switch updated', {
			tenantId,
			categoryId,
			enabled,
			updatedBy,
		});
		return next.flags;
	}

	// ── Internals ──────────────────────────────────────────────────────────

	private async getFlagsCached(tenantId: string): Promise<Record<string, boolean>> {
		const now = Date.now();
		const hit = this.cache.get(tenantId);
		if (hit && hit.expiresAt > now) return hit.flags;

		try {
			const doc = await this.fetchDoc(tenantId);
			const flags = doc?.flags ?? {};
			this.cache.set(tenantId, { flags, expiresAt: now + CACHE_TTL_MS });
			return flags;
		} catch (err) {
			// Fail open. Cache the empty result briefly so we don't hammer Cosmos
			// while the underlying error persists.
			this.logger.warn('kill-switch read failed; failing OPEN', {
				tenantId,
				error: err instanceof Error ? err.message : String(err),
			});
			this.cache.set(tenantId, { flags: {}, expiresAt: now + 5_000 });
			return {};
		}
	}

	private async fetchDoc(tenantId: string): Promise<KillSwitchDoc | null> {
		const docs = await this.db.queryDocuments<KillSwitchDoc>(
			CONTAINER,
			`SELECT TOP 1 * FROM c
			 WHERE c.clientId = @clientId
			   AND c.entityType = @entityType`,
			[
				{ name: '@clientId', value: tenantId },
				{ name: '@entityType', value: ENTITY_TYPE },
			],
		);
		return docs[0] ?? null;
	}
}
