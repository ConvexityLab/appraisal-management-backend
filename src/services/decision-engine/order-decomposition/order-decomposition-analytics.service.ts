/**
 * OrderDecompositionAnalyticsService — Phase N4.
 *
 * Reads VendorOrder docs stamped with `decompositionRuleId` (Phase N4
 * additive field) and aggregates per-rule fire counts + daily histograms.
 * No new container; rides on the existing `orders` container which already
 * carries every VendorOrder created.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsRule,
	CategoryAnalyticsSummary,
} from '../category-definition.js';

const CATEGORY_ID = 'order-decomposition';
const ORDERS_CONTAINER = 'orders';
const MAX_WINDOW_DAYS = 90;

interface StampedVendorOrder {
	id: string;
	tenantId: string;
	type?: string;
	decompositionRuleId?: string;
	vendorWorkType?: string;
	createdAt?: string;
	status?: string;
}

export class OrderDecompositionAnalyticsService {
	private readonly logger = new Logger('OrderDecompositionAnalyticsService');

	constructor(private readonly db: CosmosDbService) {}

	async summary(input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> {
		if (!input.tenantId) throw new Error('analytics: tenantId is required');
		const days = clampDays(input.days ?? 30);
		const windowDates = buildWindowDates(days);
		const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

		const orders = await this.db.queryDocuments<StampedVendorOrder>(
			ORDERS_CONTAINER,
			`SELECT TOP 5000 c.id, c.tenantId, c.type, c.decompositionRuleId, c.vendorWorkType,
			        c.createdAt, c.status
			 FROM c
			 WHERE c.tenantId = @tenantId
			   AND IS_DEFINED(c.decompositionRuleId)
			   AND c.createdAt >= @sinceIso
			 ORDER BY c.createdAt DESC`,
			[
				{ name: '@tenantId', value: input.tenantId },
				{ name: '@sinceIso', value: sinceIso },
			],
		);

		// Aggregate per rule + day. workType outcomes feed outcomeCounts.
		const fireByRule = new Map<string, { fireCount: number; daily: number[] }>();
		const workTypeCounts: Record<string, number> = {};
		const orderIdSet = new Set<string>();
		let escalationCount = 0;

		for (const o of orders) {
			if (!o.decompositionRuleId) continue;
			const day = (o.createdAt ?? '').slice(0, 10);
			const dayIdx = windowDates.indexOf(day);
			let bucket = fireByRule.get(o.decompositionRuleId);
			if (!bucket) {
				bucket = { fireCount: 0, daily: new Array(days).fill(0) };
				fireByRule.set(o.decompositionRuleId, bucket);
			}
			bucket.fireCount += 1;
			if (dayIdx >= 0) bucket.daily[dayIdx]! += 1;
			if (o.vendorWorkType) {
				workTypeCounts[o.vendorWorkType] = (workTypeCounts[o.vendorWorkType] ?? 0) + 1;
			}
			orderIdSet.add(o.id);
			if (o.status === 'cancelled' || o.status === 'CANCELLED') escalationCount += 1;
		}

		const perRule: CategoryAnalyticsRule[] = Array.from(fireByRule.entries())
			.map(([ruleId, b]) => ({
				ruleId,
				fireCount: b.fireCount,
				fireRatePercent:
					orders.length > 0 ? Math.round((b.fireCount / orders.length) * 1000) / 10 : 0,
				denialContributionCount: 0,
				scoreAdjustmentSum: 0,
				daily: b.daily,
			}))
			.sort((a, b) => b.fireCount - a.fireCount);

		this.logger.info('order-decomposition analytics summary', {
			tenantId: input.tenantId,
			days,
			vendorOrdersScanned: orders.length,
			ruleCount: perRule.length,
		});

		return {
			category: CATEGORY_ID,
			windowDays: days,
			windowDates,
			totalDecisions: orderIdSet.size,
			totalEvaluations: orders.length,
			escalationCount,
			outcomeCounts: workTypeCounts,
			perRule,
			computedAt: new Date().toISOString(),
		};
	}
}

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 30;
	return Math.min(Math.floor(d), MAX_WINDOW_DAYS);
}

function buildWindowDates(days: number): string[] {
	const out: string[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setUTCDate(now.getUTCDate() - i);
		out.push(d.toISOString().slice(0, 10));
	}
	return out;
}
