/**
 * UadComplianceCategory — Decision Engine plugin for the UAD-3.6 / URAR v1.3
 * compliance rule catalogue.
 *
 * Pack shape: UadRuleConfig[] — per-rule overrides keyed to BUILT-IN
 * rule ids (id, enabled, severityOverride?, messageOverride?). Admins
 * disable/re-weight/override messages via the generic Decision Engine
 * rules workspace; predicates themselves remain typed code so field-name
 * typos still surface at compile time.
 *
 * In-process category (no upstream evaluator):
 *   - push / drop  — absent. The UAD compliance controller resolves
 *                    the active pack at read time, so a fresh pack
 *                    takes effect on the next /api/orders/:id/uad-compliance
 *                    request.
 *   - preview      — accepts a CanonicalReportDocument per evaluation
 *                    and returns what the proposed configs would produce.
 *   - getSeed      — the code-side DEFAULT_RULE_CONFIGS (every rule
 *                    enabled, default severity). Admins start from this
 *                    when authoring their first tenant pack.
 *   - replay / analytics — deferred (no decision trace store yet for
 *                    UAD compliance; the report is recomputed on every
 *                    GET, no historical decisions to compare against).
 */

import type {
	CategoryDefinition,
	CategoryPreviewInput,
	CategoryPreviewResult,
	CategoryValidationResult,
} from '../category-definition.js';
import {
	UadComplianceEvaluatorService,
	UAD_COMPLIANCE_RULE_IDS,
	UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
	type UadRuleConfig,
	type UadRuleConfigMap,
} from '../../uad-compliance-evaluator.service.js';
import type { CanonicalReportDocument } from '@l1/shared-types';

export const UAD_COMPLIANCE_CATEGORY_ID = 'uad-compliance';

const VALID_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM']);

export function buildUadComplianceCategory(): CategoryDefinition {
	const evaluator = new UadComplianceEvaluatorService();

	return {
		id: UAD_COMPLIANCE_CATEGORY_ID,
		label: 'UAD-3.6 Compliance',
		description:
			'Per-tenant overrides for the UAD-3.6 / URAR v1.3 compliance rule catalogue. Enable/disable rules, change severity, and customize remediation messages per client. Predicates stay typed code; admins edit configuration, not predicates.',
		icon: 'heroicons-outline:document-check',

		validateRules(rules: unknown[]): CategoryValidationResult {
			const errors: string[] = [];
			const warnings: string[] = [];
			const seen = new Set<string>();
			const knownIds = new Set(UAD_COMPLIANCE_RULE_IDS);

			if (!Array.isArray(rules)) {
				errors.push('rules must be an array of per-rule config objects');
				return { errors, warnings };
			}

			for (let i = 0; i < rules.length; i++) {
				const r = rules[i] as Partial<UadRuleConfig> | null | undefined;
				const where = `rules[${i}]`;
				if (!r || typeof r !== 'object') {
					errors.push(`${where}: must be an object`);
					continue;
				}
				if (typeof r.id !== 'string' || r.id.length === 0) {
					errors.push(`${where}.id: must be a non-empty string`);
					continue;
				}
				if (!knownIds.has(r.id)) {
					errors.push(
						`${where}.id: '${r.id}' is not a known UAD compliance rule (known: ${Array.from(knownIds).join(', ')})`,
					);
					continue;
				}
				if (seen.has(r.id)) {
					errors.push(`${where}.id: duplicate config for '${r.id}'`);
					continue;
				}
				seen.add(r.id);

				if (typeof r.enabled !== 'boolean') {
					errors.push(`${where}.enabled: must be boolean`);
				}
				if (r.severityOverride !== undefined && !VALID_SEVERITIES.has(r.severityOverride)) {
					errors.push(
						`${where}.severityOverride: must be one of CRITICAL/HIGH/MEDIUM (got '${String(r.severityOverride)}')`,
					);
				}
				if (
					r.messageOverride !== undefined &&
					typeof r.messageOverride !== 'string'
				) {
					errors.push(`${where}.messageOverride: must be a string`);
				}
			}

			// Soft warning: admins can technically ship a pack that disables EVERY
			// rule; there's no operational reason for that but it's their call.
			const allDisabled =
				Array.isArray(rules) &&
				rules.length > 0 &&
				rules.every((r) => (r as { enabled?: boolean } | null)?.enabled === false);
			if (allDisabled) {
				warnings.push('All rules disabled — the UAD compliance score will always be 100.');
			}

			return { errors, warnings };
		},

		preview(input: CategoryPreviewInput): Promise<CategoryPreviewResult[]> {
			const configs = (input.rules as UadRuleConfig[] | undefined) ?? [];
			const map = buildConfigMap(configs);

			const results: CategoryPreviewResult[] = input.evaluations.map((ev) => {
				// Workspace passes either { canonical: <doc> } or the doc directly.
				// `canonical: null` is an explicit signal "no extraction yet"; only
				// treat the surrounding `ev` as the doc when the `canonical` key
				// is absent altogether.
				let doc: CanonicalReportDocument | null;
				if ('canonical' in ev) {
					doc = (ev['canonical'] as CanonicalReportDocument | null) ?? null;
				} else {
					doc = (ev as unknown as CanonicalReportDocument) ?? null;
				}
				const report = evaluator.evaluate(input.packId ?? 'preview', doc, map);
				const failedRules = report.rules.filter((r) => !r.passed);
				return {
					// "Eligible" maps to "no CRITICAL blockers"; HIGH/MEDIUM fails
					// don't gate eligibility — the score and rule list carry that nuance.
					eligible: report.blockers.length === 0,
					scoreAdjustment: 0,
					appliedRuleIds: failedRules.map((r) => r.id),
					denyReasons: failedRules
						.filter((r) => r.severity === 'CRITICAL')
						.map((r) => `${r.label}: ${r.message}`),
					extras: {
						overallScore: report.overallScore,
						passCount: report.passCount,
						failCount: report.failCount,
						blockers: report.blockers,
						snapshotAvailable: report.snapshotAvailable,
					},
				};
			});

			return Promise.resolve(results);
		},

		getSeed(): Promise<{ program: Record<string, unknown>; rules: unknown[] }> {
			// The "seed" for an in-process category is the code-default catalogue.
			// FE workspace renders this when the tenant has no pack yet — admins
			// fork from it rather than starting blank.
			return Promise.resolve({
				program: { id: UAD_COMPLIANCE_CATEGORY_ID, label: 'UAD-3.6 Compliance (default)' },
				rules: UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
			});
		},
	};
}

/** Exposed for the controller — turns the persisted pack rules array into the lookup map evaluate() consumes. */
export function buildConfigMap(rules: UadRuleConfig[]): UadRuleConfigMap {
	const map: UadRuleConfigMap = {};
	for (const r of rules) {
		if (r?.id) map[r.id] = r;
	}
	return map;
}
