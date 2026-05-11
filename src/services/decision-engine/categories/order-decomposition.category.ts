/**
 * OrderDecompositionCategory — fifth live Decision Engine category.
 *
 * Phase N of docs/DECISION_ENGINE_RULES_SURFACE.md. The decomposition
 * step runs BEFORE vendor matching: every `ClientOrder` on a newly-
 * created engagement consults `OrderDecompositionService.findRule(...)`
 * to determine which `VendorOrderTemplate[]` get materialized into
 * `VendorOrder` docs.
 *
 * Storage lives in the existing `decomposition-rules` Cosmos container
 * (NOT the generic `decision-rule-packs` container — rules are
 * singletons per (tenantId, clientId?, productType), not immutable
 * versioned packs). See sibling ORDER_DECOMPOSITION_SURVEY.md.
 *
 * Today (N0+N1+N2):
 *   - validateRules: shape check for DecompositionRule (productType +
 *     vendorOrders[] required).
 *   - analytics: stubbed to "pending" (N4 wires the real adapter
 *     once VendorOrder docs carry a decompositionRuleId stamp).
 *   - push / preview / replay: NOT applicable — decomposition is a
 *     synchronous lookup, not an evaluator-driven workflow.
 */

import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsSummary,
	CategoryDefinition,
	CategoryValidationResult,
} from '../category-definition.js';

export const ORDER_DECOMPOSITION_CATEGORY_ID = 'order-decomposition';

interface DecompositionRuleLike {
	id?: unknown;
	tenantId?: unknown;
	productType?: unknown;
	vendorOrders?: unknown;
	clientId?: unknown;
	autoApply?: unknown;
	[k: string]: unknown;
}

export function buildOrderDecompositionCategory(): CategoryDefinition {
	return {
		id: ORDER_DECOMPOSITION_CATEGORY_ID,
		label: 'Order Decomposition',
		description:
			'Rules that translate every ClientOrder into one or more VendorOrders based on productType, clientId, and order context. Runs before vendor matching.',
		icon: 'heroicons-outline:rectangle-group',
		validateRules(rules: unknown[]): CategoryValidationResult {
			const errors: string[] = [];
			const warnings: string[] = [];

			if (!Array.isArray(rules)) {
				errors.push('Decomposition rules must be an array');
				return { errors, warnings };
			}

			for (let i = 0; i < rules.length; i++) {
				const r = rules[i] as DecompositionRuleLike | null | undefined;
				if (!r || typeof r !== 'object') {
					errors.push(`rules[${i}] must be an object`);
					continue;
				}
				if (typeof r.id !== 'string' || !r.id.trim()) {
					errors.push(`rules[${i}].id is required (recommend 'rule-{scope}-{productType}')`);
				}
				if (typeof r.tenantId !== 'string' || !r.tenantId.trim()) {
					errors.push(`rules[${i}].tenantId is required (use '__global__' for platform defaults)`);
				}
				if (typeof r.productType !== 'string' || !r.productType.trim()) {
					errors.push(`rules[${i}].productType is required`);
				}
				if (!Array.isArray(r.vendorOrders) || r.vendorOrders.length === 0) {
					errors.push(`rules[${i}].vendorOrders must be a non-empty array of VendorOrderTemplate`);
				}
				// autoApply is optional; warn when omitted from production-bound rules.
				if (r.autoApply === undefined) {
					warnings.push(
						`rules[${i}] (${String(r.id ?? 'unknown')}): autoApply is undefined — rule will be treated as advisory (human confirmation required).`,
					);
				}
			}

			return { errors, warnings };
		},
		// Phase N analytics — stub. N4 wires the real adapter (counts
		// VendorOrder docs by decompositionRuleId once stamping ships).
		async analytics(input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> {
			if (!input.tenantId) throw new Error('analytics: tenantId is required');
			const days = clampDays(input.days ?? 30);
			const windowDates = buildWindowDates(days);
			return {
				category: ORDER_DECOMPOSITION_CATEGORY_ID,
				windowDays: days,
				windowDates,
				totalDecisions: 0,
				totalEvaluations: 0,
				escalationCount: 0,
				outcomeCounts: { __pending: 1 },
				perRule: [],
				computedAt: new Date().toISOString(),
			};
		},
	};
}

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 30;
	return Math.min(Math.floor(d), 90);
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
