/**
 * Phase 17b token-meter (2026-05-11) — BE rollup + controller unit tests.
 *
 * Covers:
 *   - AiAuditService.sumTenantSpend: SUM query, empty result, missing
 *     tenantId guard.
 *   - ai-cost.controller GET /snapshot: env-driven limits, exhausted /
 *     warning flag thresholds, missing auth refusal.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AiAuditService } from '../../src/services/ai-audit.service.js';
import { createAiCostRouter } from '../../src/controllers/ai-cost.controller.js';

interface FakeCosmosArgs {
	rowCount?: number;
	totalTokens?: number;
	totalCostUsd?: number;
	empty?: boolean;
}

function fakeCosmos(args: FakeCosmosArgs = {}) {
	const totalTokens = args.totalTokens ?? 0;
	const totalCostUsd = args.totalCostUsd ?? 0;
	const rowCount = args.rowCount ?? 0;
	return {
		queryItems: vi.fn(async () => {
			if (args.empty) return { success: true, data: [] };
			return {
				success: true,
				data: [{ totalTokens, totalCostUsd, rowCount }],
			};
		}),
	};
}

describe('AiAuditService.sumTenantSpend', () => {
	it('sums totalTokens + costUsd across rows in window', async () => {
		const cosmos = fakeCosmos({ totalTokens: 12_345, totalCostUsd: 1.23, rowCount: 7 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new AiAuditService(cosmos as any);
		const r = await service.sumTenantSpend('t1', '2026-05-01', '2026-05-11');
		expect(r.success).toBe(true);
		expect(r.data).toEqual({ totalTokens: 12_345, totalCostUsd: 1.23, rowCount: 7 });
		expect(cosmos.queryItems).toHaveBeenCalledOnce();
	});

	it('returns zeros when there are no rows in window', async () => {
		const cosmos = fakeCosmos({ empty: true });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new AiAuditService(cosmos as any);
		const r = await service.sumTenantSpend('t1', '2026-05-01', '2026-05-11');
		expect(r.success).toBe(true);
		expect(r.data).toEqual({ totalTokens: 0, totalCostUsd: 0, rowCount: 0 });
	});

	it('refuses with MISSING_TENANT when tenantId is empty', async () => {
		const cosmos = fakeCosmos();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new AiAuditService(cosmos as any);
		const r = await service.sumTenantSpend('', '2026-05-01', '2026-05-11');
		expect(r.success).toBe(false);
		expect((r as { error: { code: string } }).error.code).toBe('MISSING_TENANT');
	});
});

describe('GET /api/ai/cost/snapshot', () => {
	const ORIGINAL_ENV = { ...process.env };
	let app: express.Express;

	beforeEach(() => {
		// Reset env vars so each test gets a clean slate.
		delete process.env.AI_COST_HARD_LIMIT_USD;
		delete process.env.AI_COST_WARN_THRESHOLD_USD;
		delete process.env.AI_COST_PERIOD_DAYS;
	});
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	function mountWith(cosmos: ReturnType<typeof fakeCosmos>, tenantId?: string) {
		app = express();
		app.use((req, _res, next) => {
			if (tenantId) {
				(req as unknown as { user: { tenantId: string; id: string } }).user = {
					tenantId,
					id: 'u1',
				};
			}
			next();
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app.use('/api/ai/cost', createAiCostRouter(cosmos as any));
	}

	it('returns the snapshot with currentSpendUsd from cosmos sum', async () => {
		const cosmos = fakeCosmos({ totalTokens: 100_000, totalCostUsd: 0.75, rowCount: 12 });
		process.env.AI_COST_HARD_LIMIT_USD = '5';
		process.env.AI_COST_WARN_THRESHOLD_USD = '3';
		mountWith(cosmos, 't1');

		const res = await request(app).get('/api/ai/cost/snapshot');
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.currentSpendUsd).toBe(0.75);
		expect(res.body.data.totalTokens).toBe(100_000);
		expect(res.body.data.hardLimitUsd).toBe(5);
		expect(res.body.data.warnThresholdUsd).toBe(3);
		expect(res.body.data.exhausted).toBe(false);
		expect(res.body.data.warning).toBe(false);
	});

	it('sets exhausted=true when spend >= hardLimit', async () => {
		const cosmos = fakeCosmos({ totalCostUsd: 5.5 });
		process.env.AI_COST_HARD_LIMIT_USD = '5';
		mountWith(cosmos, 't1');

		const res = await request(app).get('/api/ai/cost/snapshot');
		expect(res.status).toBe(200);
		expect(res.body.data.exhausted).toBe(true);
	});

	it('sets warning=true when spend >= warnThreshold but < hardLimit', async () => {
		const cosmos = fakeCosmos({ totalCostUsd: 3.5 });
		process.env.AI_COST_HARD_LIMIT_USD = '5';
		process.env.AI_COST_WARN_THRESHOLD_USD = '3';
		mountWith(cosmos, 't1');

		const res = await request(app).get('/api/ai/cost/snapshot');
		expect(res.body.data.warning).toBe(true);
		expect(res.body.data.exhausted).toBe(false);
	});

	it('omits hardLimit/warnThreshold when env vars are unset', async () => {
		const cosmos = fakeCosmos({ totalCostUsd: 1 });
		mountWith(cosmos, 't1');

		const res = await request(app).get('/api/ai/cost/snapshot');
		expect(res.body.data.hardLimitUsd).toBeUndefined();
		expect(res.body.data.warnThresholdUsd).toBeUndefined();
		expect(res.body.data.exhausted).toBe(false);
		expect(res.body.data.warning).toBe(false);
	});

	it('refuses with 401 when there is no authenticated tenant', async () => {
		const cosmos = fakeCosmos();
		mountWith(cosmos);

		const res = await request(app).get('/api/ai/cost/snapshot');
		expect(res.status).toBe(401);
	});

	it('honours periodDays query param when bounded', async () => {
		const cosmos = fakeCosmos({ totalCostUsd: 2 });
		mountWith(cosmos, 't1');

		const res = await request(app).get('/api/ai/cost/snapshot?periodDays=7');
		expect(res.status).toBe(200);
		expect(res.body.data.periodDays).toBe(7);
	});
});
