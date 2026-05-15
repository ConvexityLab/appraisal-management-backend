/**
 * Phase 17.6 (2026-05-11) — BE rate-limit middleware integration test.
 *
 * Unit tests cover the pure consumeAiRateSlot function.  This test
 * mounts createAiRateLimitMiddleware on an actual Express app + exercises
 * it through HTTP requests to verify:
 *   - First N requests get 200
 *   - The (N+1)th request returns 429 + Retry-After header
 *   - Missing auth context falls through (the auth middleware refuses
 *     the request before this can; the limiter mustn't block it)
 *   - The 429 response body carries family + limit + windowMs + retryInMs
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
	createAiRateLimitMiddleware,
	setAiRateBudget,
	_resetAiRateLimitForTests,
} from '../../src/middleware/ai-rate-limit.middleware.js';

function mountWith(user?: { tenantId: string; id: string }) {
	const app = express();
	app.use((req, _res, next) => {
		if (user) {
			(req as unknown as { user: typeof user }).user = user;
		}
		next();
	});
	app.use('/api/ai', createAiRateLimitMiddleware('native'));
	app.get('/api/ai/ping', (_req, res) => {
		res.json({ ok: true });
	});
	return app;
}

describe('createAiRateLimitMiddleware mounted on /api/ai', () => {
	beforeEach(() => {
		_resetAiRateLimitForTests();
		setAiRateBudget('native', { limit: 3, windowMs: 60_000 });
	});
	afterEach(() => {
		_resetAiRateLimitForTests();
	});

	it('admits the first N requests, then 429s the (N+1)th', async () => {
		const app = mountWith({ tenantId: 't1', id: 'u1' });
		for (let i = 0; i < 3; i += 1) {
			const ok = await request(app).get('/api/ai/ping');
			expect(ok.status).toBe(200);
		}
		const refused = await request(app).get('/api/ai/ping');
		expect(refused.status).toBe(429);
		expect(refused.body.family).toBe('native');
		expect(refused.body.limit).toBe(3);
		expect(refused.body.windowMs).toBe(60_000);
		expect(refused.body.retryInMs).toBeGreaterThan(0);
		expect(refused.headers['retry-after']).toBeDefined();
	});

	it('per-user isolation — exhausting one user does not affect another', async () => {
		const u1 = mountWith({ tenantId: 't1', id: 'u1' });
		for (let i = 0; i < 3; i += 1) {
			await request(u1).get('/api/ai/ping');
		}
		expect((await request(u1).get('/api/ai/ping')).status).toBe(429);

		const u2 = mountWith({ tenantId: 't1', id: 'u2' });
		expect((await request(u2).get('/api/ai/ping')).status).toBe(200);
	});

	it('falls through when there is no authenticated user context', async () => {
		// The real flow has UnifiedAuth running first; if for some reason
		// the limiter sees no user it must call next() and let auth refuse.
		const app = mountWith(undefined);
		// Hit it 10 times — none should be 429.
		for (let i = 0; i < 10; i += 1) {
			const r = await request(app).get('/api/ai/ping');
			expect(r.status).toBe(200);
		}
	});
});
