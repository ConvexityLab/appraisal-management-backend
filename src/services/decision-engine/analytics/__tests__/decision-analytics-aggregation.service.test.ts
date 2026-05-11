/**
 * Unit tests for DecisionAnalyticsAggregationService.
 *
 * Phase E.preagg of docs/DECISION_ENGINE_RULES_SURFACE.md. Covers id
 * composition + read-stale semantics. Cosmos I/O is mocked at the
 * service interface boundary.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	DecisionAnalyticsAggregationService,
	composeSnapshotId,
	type AnalyticsSnapshotDoc,
} from '../decision-analytics-aggregation.service.js';
import type { CosmosDbService } from '../../../cosmos-db.service.js';
import type { CategoryAnalyticsSummary } from '../../category-definition.js';

function makeSummary(overrides: Partial<CategoryAnalyticsSummary> = {}): CategoryAnalyticsSummary {
	return {
		category: 'vendor-matching',
		windowDays: 30,
		windowDates: [],
		totalDecisions: 10,
		totalEvaluations: 50,
		escalationCount: 1,
		outcomeCounts: { ASSIGNED: 9 },
		perRule: [],
		computedAt: new Date().toISOString(),
		...overrides,
	};
}

describe('composeSnapshotId', () => {
	it('combines all four parts with double-underscores', () => {
		expect(composeSnapshotId('t1', 'vendor-matching', 30, '2026-05-11'))
			.toBe('t1__vendor-matching__30d__2026-05-11');
	});
});

describe('DecisionAnalyticsAggregationService', () => {
	function mockDb(overrides: Partial<CosmosDbService> = {}): CosmosDbService {
		return {
			upsertDocument: vi.fn().mockResolvedValue(undefined),
			queryDocuments: vi.fn().mockResolvedValue([]),
			...overrides,
		} as unknown as CosmosDbService;
	}

	it('writeSnapshot upserts a doc keyed by composed id', async () => {
		const upsert = vi.fn().mockResolvedValue(undefined);
		const svc = new DecisionAnalyticsAggregationService(mockDb({
			upsertDocument: upsert,
		} as Partial<CosmosDbService>));
		const summary = makeSummary();
		await svc.writeSnapshot('t1', 'vendor-matching', 30, summary);
		expect(upsert).toHaveBeenCalledOnce();
		const [container, doc] = upsert.mock.calls[0]!;
		expect(container).toBe('decision-rule-analytics');
		expect(doc).toMatchObject({
			type: 'decision-analytics-snapshot',
			tenantId: 't1',
			category: 'vendor-matching',
			days: 30,
			summary,
		});
		expect((doc as AnalyticsSnapshotDoc).id).toMatch(/^t1__vendor-matching__30d__\d{4}-\d{2}-\d{2}$/);
	});

	it('readLatestSnapshot returns the fresh summary when computedAt is within maxAge', async () => {
		const fresh = makeSummary({ computedAt: new Date(Date.now() - 60_000).toISOString() });
		const query = vi.fn().mockResolvedValue([{
			id: 'irrelevant',
			type: 'decision-analytics-snapshot',
			tenantId: 't1',
			category: 'vendor-matching',
			days: 30,
			computedAt: fresh.computedAt,
			computedDate: fresh.computedAt.slice(0, 10),
			summary: fresh,
		}]);
		const svc = new DecisionAnalyticsAggregationService(mockDb({
			queryDocuments: query,
		} as Partial<CosmosDbService>));
		const result = await svc.readLatestSnapshot('t1', 'vendor-matching', 30);
		expect(result).toBe(fresh);
	});

	it('readLatestSnapshot returns null when row is older than maxAgeMs', async () => {
		const stale = makeSummary({ computedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() });
		const query = vi.fn().mockResolvedValue([{
			id: 'irrelevant',
			type: 'decision-analytics-snapshot',
			tenantId: 't1',
			category: 'vendor-matching',
			days: 30,
			computedAt: stale.computedAt,
			computedDate: stale.computedAt.slice(0, 10),
			summary: stale,
		}]);
		const svc = new DecisionAnalyticsAggregationService(mockDb({
			queryDocuments: query,
		} as Partial<CosmosDbService>));
		const result = await svc.readLatestSnapshot('t1', 'vendor-matching', 30);
		expect(result).toBeNull();
	});

	it('readLatestSnapshot returns null when no row exists', async () => {
		const query = vi.fn().mockResolvedValue([]);
		const svc = new DecisionAnalyticsAggregationService(mockDb({
			queryDocuments: query,
		} as Partial<CosmosDbService>));
		const result = await svc.readLatestSnapshot('t1', 'vendor-matching', 30);
		expect(result).toBeNull();
	});
});
