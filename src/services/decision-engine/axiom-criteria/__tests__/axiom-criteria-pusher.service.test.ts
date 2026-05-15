/**
 * Unit tests for AxiomCriteriaPusher.
 *
 * Phase L3 of docs/DECISION_ENGINE_RULES_SURFACE.md. Covers the
 * fail-open semantics + criteria serialization. Skips full live wire
 * tests (those are live-fire against a real Axiom endpoint).
 */

import axios, { type AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiomCriteriaPusher } from '../axiom-criteria-pusher.service.js';
import type { RulePackDocument } from '../../../../types/decision-rule-pack.types.js';

function makePack(rules: unknown[]): RulePackDocument<unknown> {
	return {
		id: 'pack-1',
		type: 'decision-rule-pack',
		category: 'axiom-criteria',
		tenantId: 'tenant-1',
		packId: 'criteria-set-A',
		version: 3,
		parentVersion: 2,
		status: 'active',
		rules,
		metadata: { name: 'Test pack' },
		createdAt: '2026-05-11T00:00:00Z',
		createdBy: 'gcolclough',
	};
}

describe('AxiomCriteriaPusher (disabled / no base URL)', () => {
	const originalEnv = process.env['AXIOM_API_BASE_URL'];
	beforeEach(() => {
		delete process.env['AXIOM_API_BASE_URL'];
	});

	it('returns null when AXIOM_API_BASE_URL is unset', async () => {
		const pusher = new AxiomCriteriaPusher();
		const result = await pusher.push(makePack([{
			name: 'criterion-1', salience: 5, conditions: {},
			actions: [{ type: 'evaluate-criterion', data: { title: 't', description: 'd' } }],
		}]));
		expect(result).toBeNull();

		if (originalEnv) process.env['AXIOM_API_BASE_URL'] = originalEnv;
	});
});

describe('AxiomCriteriaPusher (live, mocked transport)', () => {
	it('POSTs the serialized criteria and returns the assigned program key', async () => {
		const post = vi.fn().mockResolvedValue({
			data: { programId: 'prog-axiom-42', programVersion: '7' },
		});
		const fake = { post } as unknown as AxiosInstance;
		const pusher = new AxiomCriteriaPusher({ baseUrl: 'https://axiom.test', clientForTest: fake });
		const result = await pusher.push(makePack([
			{
				name: 'C-001', salience: 10, conditions: {},
				actions: [{ type: 'evaluate-criterion', data: {
					title: 'Comparable Quality', description: 'Comps must be suitable substitutes',
					expectedAnswer: 'pass', rubric: 'C1-C3 OK',
				} }],
			},
			{
				// invalid — no description, dropped
				name: 'C-002', salience: 5, conditions: {},
				actions: [{ type: 'evaluate-criterion', data: { title: 'No desc' } }],
			},
		]));
		expect(result).toEqual({ programId: 'prog-axiom-42', programVersion: '7' });
		expect(post).toHaveBeenCalledOnce();
		const [, body] = post.mock.calls[0]!;
		expect(body).toMatchObject({
			amsPackId: 'pack-1',
			tenantId: 'tenant-1',
			criteria: [{
				id: 'C-001',
				title: 'Comparable Quality',
				description: 'Comps must be suitable substitutes',
				expectedAnswer: 'pass',
				rubric: 'C1-C3 OK',
				weight: 10,
			}],
		});
	});

	it('returns null when serialized criteria array is empty', async () => {
		const post = vi.fn();
		const fake = { post } as unknown as AxiosInstance;
		const pusher = new AxiomCriteriaPusher({ baseUrl: 'https://axiom.test', clientForTest: fake });
		const result = await pusher.push(makePack([
			{ name: 'broken', actions: [{ type: 'evaluate-criterion', data: { title: 'no desc' } }] },
		]));
		expect(result).toBeNull();
		expect(post).not.toHaveBeenCalled();
	});

	it('returns null when Axiom responds 404 (endpoint not yet shipped)', async () => {
		const err = Object.assign(new Error('Request failed with status code 404'), {
			response: { status: 404 },
		});
		const post = vi.fn().mockRejectedValue(err);
		const fake = { post } as unknown as AxiosInstance;
		const pusher = new AxiomCriteriaPusher({ baseUrl: 'https://axiom.test', clientForTest: fake });
		const result = await pusher.push(makePack([{
			name: 'C-001', salience: 5, conditions: {},
			actions: [{ type: 'evaluate-criterion', data: { title: 't', description: 'd' } }],
		}]));
		expect(result).toBeNull();
	});

	it('returns null on 2xx that omits programId/programVersion', async () => {
		const post = vi.fn().mockResolvedValue({ data: { unexpected: true } });
		const fake = { post } as unknown as AxiosInstance;
		const pusher = new AxiomCriteriaPusher({ baseUrl: 'https://axiom.test', clientForTest: fake });
		const result = await pusher.push(makePack([{
			name: 'C-001', salience: 5, conditions: {},
			actions: [{ type: 'evaluate-criterion', data: { title: 't', description: 'd' } }],
		}]));
		expect(result).toBeNull();
	});

	it('never throws — generic network failure swallowed', async () => {
		const post = vi.fn().mockRejectedValue(new Error('network down'));
		const fake = { post } as unknown as AxiosInstance;
		const pusher = new AxiomCriteriaPusher({ baseUrl: 'https://axiom.test', clientForTest: fake });
		await expect(pusher.push(makePack([{
			name: 'C-001', salience: 5, conditions: {},
			actions: [{ type: 'evaluate-criterion', data: { title: 't', description: 'd' } }],
		}]))).resolves.toBeNull();
	});
});

// Suppress lint about unused import.
void axios;
