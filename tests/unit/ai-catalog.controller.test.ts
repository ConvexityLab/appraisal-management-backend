/**
 * Phase 17.6 / C6 (2026-05-11) — catalog scope filter test.
 *
 * Verifies that the /api/ai/catalog response is filtered by the
 * caller's effective scopes:
 *   - non-admin reviewer only sees entries that require read-only scopes
 *   - admin sees the same entries plus admin-tier entries
 *   - catalog scope filtering closes the enumeration vector
 */

import { describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAiCatalogRouter } from '../../src/controllers/ai-catalog.controller.js';
import { registerAiRoute, _resetAiCatalogForTests } from '../../src/utils/ai-catalog-registry.js';

beforeAll(() => {
	_resetAiCatalogForTests();
	registerAiRoute({
		id: 'read-only-orders',
		method: 'GET',
		path: '/api/orders',
		summary: 'List orders.',
		category: 'orders',
		scopes: ['order:read'],
		sideEffect: 'read',
		audit: 'never',
		aiExposure: 'tool',
	});
	registerAiRoute({
		id: 'admin-only-vendor-config',
		method: 'POST',
		path: '/api/vendors/:vendorId/config',
		summary: 'Update vendor config.',
		category: 'vendors',
		scopes: ['vendor:write'],
		sideEffect: 'write',
		audit: 'always',
		aiExposure: 'tool',
	});
	registerAiRoute({
		id: 'comms-send',
		method: 'POST',
		path: '/api/comms/send',
		summary: 'Send a message.',
		category: 'communications',
		scopes: ['comms:send'],
		sideEffect: 'external',
		audit: 'always',
		aiExposure: 'tool',
	});
});

function mountWith(user: { tenantId: string; id: string; role: string | string[] } | undefined) {
	const app = express();
	app.use((req, _res, next) => {
		if (user) {
			(req as unknown as { user: typeof user }).user = user;
		}
		next();
	});
	app.use('/api/ai/catalog', createAiCatalogRouter());
	return app;
}

describe('GET /api/ai/catalog scope filter (C6)', () => {
	it('reviewer only sees read-scoped entries', async () => {
		const app = mountWith({ tenantId: 't1', id: 'u1', role: 'reviewer' });
		const res = await request(app).get('/api/ai/catalog');
		expect(res.status).toBe(200);
		const ids = (res.body.data as Array<{ id: string }>).map((e) => e.id);
		expect(ids).toContain('read-only-orders');
		expect(ids).not.toContain('admin-only-vendor-config');
		expect(ids).not.toContain('comms-send');
	});

	it('appraiser sees order:read + vendor:read + document:read entries only', async () => {
		const app = mountWith({ tenantId: 't1', id: 'u1', role: 'appraiser' });
		const res = await request(app).get('/api/ai/catalog');
		const ids = (res.body.data as Array<{ id: string }>).map((e) => e.id);
		expect(ids).toContain('read-only-orders');
		expect(ids).not.toContain('admin-only-vendor-config');
	});

	it('admin sees every tool-tier entry', async () => {
		const app = mountWith({ tenantId: 't1', id: 'u1', role: 'admin' });
		const res = await request(app).get('/api/ai/catalog');
		const ids = (res.body.data as Array<{ id: string }>).map((e) => e.id);
		expect(ids).toContain('read-only-orders');
		expect(ids).toContain('admin-only-vendor-config');
		expect(ids).toContain('comms-send');
	});

	it('admin in a role array is still admin (C4 regression check)', async () => {
		const app = mountWith({ tenantId: 't1', id: 'u1', role: ['analyst', 'admin'] });
		const res = await request(app).get('/api/ai/catalog');
		const ids = (res.body.data as Array<{ id: string }>).map((e) => e.id);
		expect(ids).toContain('admin-only-vendor-config');
	});

	it('refuses without authenticated tenant', async () => {
		const app = mountWith(undefined);
		const res = await request(app).get('/api/ai/catalog');
		expect(res.status).toBe(401);
	});
});
