/**
 * FiringDecisionRecorder — append-only writer + read helpers for the
 * `firing-decisions` Cosmos container.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md. Synthetic id is
 * `${tenantId}__${vendorId}__${runDate}` so re-running the daily evaluator
 * for the same (tenant, vendor) on the same UTC day is idempotent — a
 * 409 Conflict from Cosmos is treated as success (the prior result for
 * that day stays authoritative; operators see a stable analytics surface
 * even when the cron is jiggled).
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type {
	FiringDecisionDocument,
} from '../../../types/firing-decision.types.js';

const FIRING_DECISIONS_CONTAINER = 'firing-decisions';

export class FiringDecisionRecorder {
	private readonly logger = new Logger('FiringDecisionRecorder');

	constructor(private readonly db: CosmosDbService) {}

	static composeId(tenantId: string, vendorId: string, runDate: string): string {
		return `${tenantId}__${vendorId}__${runDate}`;
	}

	/** Best-effort write. 409 (re-run for the same day) is success. */
	async record(decision: FiringDecisionDocument): Promise<void> {
		try {
			await this.db.createDocument(FIRING_DECISIONS_CONTAINER, decision);
		} catch (err: unknown) {
			const code = (err as { code?: number; statusCode?: number })?.code
				?? (err as { code?: number; statusCode?: number })?.statusCode;
			if (code === 409) {
				// Already recorded for this (tenant, vendor, day) — stable
				// analytics depend on this being a no-op.
				return;
			}
			this.logger.error('firing-decision recorder write failed', {
				id: decision.id,
				tenantId: decision.tenantId,
				vendorId: decision.vendorId,
				error: err instanceof Error ? err.message : String(err),
			});
			// Best-effort: don't throw. The cron treats individual write
			// failures as warnings and moves on; the operator-facing
			// dashboards never miss a tick because of one Cosmos hiccup.
		}
	}

	async listRecent(tenantId: string, limit: number): Promise<FiringDecisionDocument[]> {
		const cap = Math.min(Math.max(1, Math.floor(limit)), 500);
		return this.db.queryDocuments<FiringDecisionDocument>(
			FIRING_DECISIONS_CONTAINER,
			`SELECT TOP @limit * FROM c
			 WHERE c.type = 'firing-decision'
			   AND c.tenantId = @tenantId
			 ORDER BY c.evaluatedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@limit', value: cap },
			],
		);
	}

	async listSince(tenantId: string, sinceIso: string): Promise<FiringDecisionDocument[]> {
		return this.db.queryDocuments<FiringDecisionDocument>(
			FIRING_DECISIONS_CONTAINER,
			`SELECT * FROM c
			 WHERE c.type = 'firing-decision'
			   AND c.tenantId = @tenantId
			   AND c.evaluatedAt >= @sinceIso
			 ORDER BY c.evaluatedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@sinceIso', value: sinceIso },
			],
		);
	}
}
