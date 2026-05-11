/**
 * AI Cost Snapshot Controller — Phase 17b token-meter (2026-05-11).
 *
 * GET /api/ai/cost/snapshot
 *   Returns the per-tenant LLM spend snapshot used by:
 *     - the FE useAiToolLoop cost guard (refuses new prompts at hard limit)
 *     - the AiCostBudgetBanner UI (warn at threshold, error at hard limit)
 *
 * Spend is summed from the existing `ai-audit-events` Cosmos container —
 * no new container.  Rows with a populated `usage` field count toward the
 * total.  Limits + thresholds come from env (App Config push) per tenant:
 *
 *   AI_COST_HARD_LIMIT_USD       — refuse new prompts past this number
 *   AI_COST_WARN_THRESHOLD_USD   — yellow banner past this number
 *   AI_COST_PERIOD_DAYS          — rolling window for the sum (default 30)
 *
 * Per-tenant overrides will land via the FlagsService snapshot when the
 * Phase 0.1 backend flags endpoint ships.  Today, env-only.
 */

import { Router, Response } from 'express';
import { query, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiAuditService } from '../services/ai-audit.service.js';
import { AiFlagsService } from '../services/ai-flags.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiCostController');

export interface AiCostSnapshot {
	tenantId: string;
	periodDays: number;
	periodStart: string;
	periodEnd: string;
	currentSpendUsd: number;
	totalTokens: number;
	rowCount: number;
	/** Configured per-tenant ceiling.  `undefined` means no enforcement. */
	hardLimitUsd?: number;
	/** Configured warn threshold (banner turns yellow).  Optional. */
	warnThresholdUsd?: number;
	/** True if currentSpendUsd >= hardLimitUsd (FE short-circuits new prompts). */
	exhausted: boolean;
	/** True if currentSpendUsd >= warnThresholdUsd. */
	warning: boolean;
}

function parseUsdEnv(name: string): number | undefined {
	const raw = process.env[name];
	if (typeof raw !== 'string') return undefined;
	const n = Number(raw);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function createAiCostRouter(cosmos: CosmosDbService): Router {
	const router = Router();
	const service = new AiAuditService(cosmos);
	const flagsService = new AiFlagsService(cosmos);

	router.get(
		'/snapshot',
		query('periodDays').optional().isInt({ min: 1, max: 365 }).toInt(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.tenantId) {
				return res
					.status(401)
					.json({ success: false, error: 'Cost snapshot requires an authenticated tenant.' });
			}

			// Phase 14 canary onboarding (2026-05-11): tenant-flags doc
			// can override env-driven cost ceilings.  Lookup is best-effort
			// — if Cosmos is unreachable we fall back to env values.
			let tenantBudget: { hardLimitUsd?: number; warnThresholdUsd?: number; periodDays?: number } | undefined;
			try {
				const flags = await flagsService.fetchForUser(user.tenantId, user.id ?? '');
				if (flags.success && flags.data?.tenant?.costBudget) {
					tenantBudget = flags.data.tenant.costBudget;
				}
			} catch {
				// fall through to env
			}

			const periodDays =
				typeof req.query.periodDays === 'number'
					? req.query.periodDays
					: tenantBudget?.periodDays ?? Number(process.env.AI_COST_PERIOD_DAYS ?? 30);

			const periodEnd = new Date();
			const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

			const result = await service.sumTenantSpend(
				user.tenantId,
				periodStart.toISOString(),
				periodEnd.toISOString(),
			);
			if (!result.success || !result.data) {
				logger.warn('Cost snapshot rollup failed', { error: result.error });
				return res.status(500).json({ success: false, error: result.error });
			}

			const hardLimitUsd = tenantBudget?.hardLimitUsd ?? parseUsdEnv('AI_COST_HARD_LIMIT_USD');
			const warnThresholdUsd =
				tenantBudget?.warnThresholdUsd ?? parseUsdEnv('AI_COST_WARN_THRESHOLD_USD');
			const currentSpendUsd = result.data.totalCostUsd;

			const snapshot: AiCostSnapshot = {
				tenantId: user.tenantId,
				periodDays,
				periodStart: periodStart.toISOString(),
				periodEnd: periodEnd.toISOString(),
				currentSpendUsd,
				totalTokens: result.data.totalTokens,
				rowCount: result.data.rowCount,
				exhausted: typeof hardLimitUsd === 'number' && currentSpendUsd >= hardLimitUsd,
				warning: typeof warnThresholdUsd === 'number' && currentSpendUsd >= warnThresholdUsd,
				...(hardLimitUsd !== undefined && { hardLimitUsd }),
				...(warnThresholdUsd !== undefined && { warnThresholdUsd }),
			};

			return res.json({ success: true, data: snapshot, schemaVersion: 'v1' });
		},
	);

	return router;
}
