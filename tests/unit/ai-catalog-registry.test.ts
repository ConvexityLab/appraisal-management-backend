import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	_resetAiCatalogForTests,
	findAiRoute,
	getAiCatalog,
	registerAiRoute,
} from '../../src/utils/ai-catalog-registry.js';

describe('ai-catalog-registry', () => {
	beforeEach(() => _resetAiCatalogForTests());
	afterEach(() => _resetAiCatalogForTests());

	it('registers an entry and recalls it by (method, path)', () => {
		registerAiRoute({
			id: 'list-foo',
			method: 'GET',
			path: '/api/foo',
			summary: 'List foos',
			category: 'orders',
			scopes: ['order:read'],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		const e = findAiRoute('GET', '/api/foo');
		expect(e).toMatchObject({ id: 'list-foo', method: 'GET', path: '/api/foo' });
	});

	it('lists entries in stable category+id order', () => {
		registerAiRoute({
			id: 'b-second',
			method: 'GET',
			path: '/api/b',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		registerAiRoute({
			id: 'a-first',
			method: 'GET',
			path: '/api/a',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		registerAiRoute({
			id: 'z-vendor',
			method: 'GET',
			path: '/api/v',
			summary: '',
			category: 'vendors',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		const list = getAiCatalog();
		expect(list.map((e) => e.id)).toEqual(['a-first', 'b-second', 'z-vendor']);
	});

	it('filters by exposure tier', () => {
		registerAiRoute({
			id: 'public-tool',
			method: 'GET',
			path: '/api/pub',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		registerAiRoute({
			id: 'admin-only',
			method: 'GET',
			path: '/api/admin/x',
			summary: '',
			category: 'ops',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'admin',
		});
		registerAiRoute({
			id: 'never-exposed',
			method: 'GET',
			path: '/api/nope',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'never',
		});

		expect(getAiCatalog({ exposure: 'tool' }).map((e) => e.id)).toEqual(['public-tool']);
		expect(getAiCatalog({ exposure: 'admin' }).map((e) => e.id)).toEqual(['admin-only']);
		expect(getAiCatalog({ exposure: ['tool', 'admin'] }).map((e) => e.id).sort()).toEqual([
			'admin-only',
			'public-tool',
		]);
	});

	it('filters by category', () => {
		registerAiRoute({
			id: 'ord-a',
			method: 'GET',
			path: '/api/o/a',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		registerAiRoute({
			id: 'eng-a',
			method: 'GET',
			path: '/api/e/a',
			summary: '',
			category: 'engagements',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		expect(getAiCatalog({ category: 'engagements' }).map((e) => e.id)).toEqual(['eng-a']);
	});

	it('throws on duplicate id under different (method, path)', () => {
		registerAiRoute({
			id: 'dup',
			method: 'GET',
			path: '/api/x',
			summary: '',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		expect(() =>
			registerAiRoute({
				id: 'dup',
				method: 'GET',
				path: '/api/y',
				summary: '',
				category: 'orders',
				scopes: [],
				sideEffect: 'read',
				aiExposure: 'tool',
			}),
		).toThrow(/duplicate id/);
	});

	it('idempotent on re-register of same (id, method, path) — overwrites metadata', () => {
		registerAiRoute({
			id: 'idem',
			method: 'GET',
			path: '/api/i',
			summary: 'first',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		registerAiRoute({
			id: 'idem',
			method: 'GET',
			path: '/api/i',
			summary: 'second',
			category: 'orders',
			scopes: [],
			sideEffect: 'read',
			aiExposure: 'tool',
		});
		expect(findAiRoute('GET', '/api/i')?.summary).toBe('second');
		expect(getAiCatalog().length).toBe(1);
	});

	it('returns undefined for findAiRoute on unknown (method, path)', () => {
		expect(findAiRoute('GET', '/api/does-not-exist')).toBeUndefined();
	});
});
