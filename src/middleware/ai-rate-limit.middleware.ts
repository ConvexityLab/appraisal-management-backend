/**
 * AI rate-limit middleware — Phase 17.6 (2026-05-11).
 *
 * Server-side counterpart to the FE friendly-first-stop limiter at
 * `l1-valuation-platform-ui/src/utils/aiRateLimit.ts`.  Backend is the
 * authoritative security boundary; the FE limit is hint-quality only.
 *
 * Per-user + per-family sliding window in process memory.  No Cosmos
 * persistence — limits reset on pod restart, which is acceptable
 * because windows are minute-scale.  Phase 18-candidate: promote to a
 * Redis-backed counter when traffic justifies cross-pod consistency.
 *
 * Mount once per family on the relevant /api/ai/* routes:
 *
 *   router.use('/parse-intent', createAiRateLimitMiddleware('native'));
 *   router.use('/execute',      createAiRateLimitMiddleware('native'));
 *
 * Per-tool-family choice is deliberate over per-route — many `native`
 * tools share the same parse-intent gateway, so limiting per-route
 * would let one expensive tool burn the whole budget alone.  Family-
 * level matches how the FE thinks about cost.
 */

import type { NextFunction, Request, Response } from 'express';
import type { UnifiedAuthRequest } from './unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiRateLimitMiddleware');

export type AiRateLimitFamily =
	| 'native'
	| 'axiom'
	| 'mop'
	| 'composite'
	| 'autonomous';

interface FamilyBudget {
	limit: number;
	windowMs: number;
}

const DEFAULT_BUDGETS: Record<AiRateLimitFamily, FamilyBudget> = {
	native: { limit: 200, windowMs: 60_000 },
	axiom: { limit: 20, windowMs: 60_000 },
	mop: { limit: 100, windowMs: 60_000 },
	composite: { limit: 20, windowMs: 60_000 },
	autonomous: { limit: 40, windowMs: 60_000 },
};

interface SlidingWindowState {
	timestamps: number[];
}

const state: Record<string, SlidingWindowState> = Object.create(null);

function keyFor(
	tenantId: string,
	userId: string,
	family: AiRateLimitFamily,
): string {
	return `${tenantId}::${userId}::${family}`;
}

export interface RateLimitDecision {
	ok: boolean;
	retryInMs?: number;
	limit: number;
	windowMs: number;
	family: AiRateLimitFamily;
}

/**
 * Pure check — exported so unit tests can drive it without Express.
 */
export function consumeAiRateSlot(opts: {
	tenantId: string;
	userId: string;
	family: AiRateLimitFamily;
	now?: number;
}): RateLimitDecision {
	const now = opts.now ?? Date.now();
	const budget = DEFAULT_BUDGETS[opts.family];
	const k = keyFor(opts.tenantId, opts.userId, opts.family);
	const cur = state[k] ?? { timestamps: [] };
	cur.timestamps = cur.timestamps.filter((t) => now - t < budget.windowMs);

	if (cur.timestamps.length >= budget.limit) {
		const oldest = cur.timestamps[0] ?? now;
		const retryInMs = Math.max(0, budget.windowMs - (now - oldest));
		state[k] = cur;
		return {
			ok: false,
			retryInMs,
			limit: budget.limit,
			windowMs: budget.windowMs,
			family: opts.family,
		};
	}
	cur.timestamps.push(now);
	state[k] = cur;
	return {
		ok: true,
		limit: budget.limit,
		windowMs: budget.windowMs,
		family: opts.family,
	};
}

/** Override a family's budget — for the FlagsService snapshot. */
export function setAiRateBudget(family: AiRateLimitFamily, budget: FamilyBudget): void {
	DEFAULT_BUDGETS[family] = budget;
}

/**
 * Express middleware factory.  Mount per family on the relevant
 * /api/ai/* routes.  Returns 429 with a Retry-After header on refusal.
 */
export function createAiRateLimitMiddleware(family: AiRateLimitFamily) {
	return (req: Request, res: Response, next: NextFunction): void => {
		const u = (req as UnifiedAuthRequest).user;
		// Without auth context we can't key the limiter; let the auth
		// middleware (which runs first on /api/ai/* mounts) reject.
		if (!u?.tenantId || !u?.id) {
			next();
			return;
		}
		const decision = consumeAiRateSlot({
			tenantId: u.tenantId,
			userId: u.id,
			family,
		});
		if (!decision.ok) {
			res.setHeader(
				'Retry-After',
				String(Math.ceil((decision.retryInMs ?? decision.windowMs) / 1000)),
			);
			logger.warn('AI rate limit refusal', {
				tenantId: u.tenantId,
				userId: u.id,
				family,
				limit: decision.limit,
				windowMs: decision.windowMs,
				retryInMs: decision.retryInMs,
			});
			res.status(429).json({
				success: false,
				error: `AI rate limit hit for family "${family}" (${decision.limit}/${decision.windowMs}ms). Retry in ~${Math.ceil((decision.retryInMs ?? 0) / 1000)}s.`,
				family,
				limit: decision.limit,
				windowMs: decision.windowMs,
				retryInMs: decision.retryInMs,
			});
			return;
		}
		next();
	};
}

/** Test-only: clear every counter. */
export function _resetAiRateLimitForTests(): void {
	for (const k of Object.keys(state)) {
		delete state[k];
	}
}
