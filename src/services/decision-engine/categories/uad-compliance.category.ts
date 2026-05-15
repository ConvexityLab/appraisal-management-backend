/**
 * UadComplianceCategory — Decision Engine plugin for the UAD-3.6 / URAR v1.3
 * compliance rule catalogue.
 *
 * Pack shape: an array of UadPackRule = UadRuleConfig | UadCustomRule.
 *
 *   UadRuleConfig (kind 'override' or absent) — per-rule overrides keyed
 *   to BUILT-IN rule ids (id, enabled, severityOverride?, messageOverride?).
 *   Admins use these to disable rules per-client, raise/lower severity,
 *   and customize remediation copy. Predicates stay typed code so
 *   field-name typos surface at compile time.
 *
 *   UadCustomRule (kind 'custom') — admin-authored rule with its own
 *   JSONLogic predicate against the canonical document. Lets tenants
 *   enforce rules outside the federal-spec catalogue (e.g., per-client
 *   "pool description required" checks) without a code change.
 *   Evaluation errors are caught at runtime and surfaced as a failure
 *   with a system-error message so a malformed admin rule never blocks
 *   the compliance call.
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
	MAX_CONDITION_DEPTH,
	conditionDepth,
	partitionPackRules,
	type UadRuleConfig,
	type UadCustomRule,
	type UadPackRule,
} from '../../uad-compliance-evaluator.service.js';
import type { CanonicalReportDocument } from '@l1/shared-types';

export const UAD_COMPLIANCE_CATEGORY_ID = 'uad-compliance';

const VALID_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM']);
const MAX_CUSTOM_ID_LENGTH = 80;
const MAX_LABEL_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 500;

export function buildUadComplianceCategory(): CategoryDefinition {
	const evaluator = new UadComplianceEvaluatorService();

	return {
		id: UAD_COMPLIANCE_CATEGORY_ID,
		label: 'UAD-3.6 Compliance',
		description:
			'Per-tenant overrides + custom rules on top of the UAD-3.6 / URAR v1.3 compliance catalogue. Enable/disable built-ins, change severity, customize remediation messages, and add tenant-specific JSONLogic rules. Predicates for built-ins stay typed code; custom rules use the shared JSONLogic evaluator.',
		icon: 'heroicons-outline:document-check',

		validateRules(rules: unknown[]): CategoryValidationResult {
			const errors: string[] = [];
			const warnings: string[] = [];
			const seenIds = new Set<string>();
			const knownBuiltInIds = new Set(UAD_COMPLIANCE_RULE_IDS);

			if (!Array.isArray(rules)) {
				errors.push('rules must be an array of per-rule config objects');
				return { errors, warnings };
			}

			for (let i = 0; i < rules.length; i++) {
				const raw = rules[i] as Record<string, unknown> | null | undefined;
				const where = `rules[${i}]`;
				if (!raw || typeof raw !== 'object') {
					errors.push(`${where}: must be an object`);
					continue;
				}

				// Discriminate by `kind`. Absence ⇒ override (back-compat with
				// packs persisted before custom rules shipped).
				const kind = (raw['kind'] ?? 'override') as string;
				if (kind !== 'override' && kind !== 'custom') {
					errors.push(`${where}.kind: must be 'override' or 'custom' (got '${kind}')`);
					continue;
				}

				const id = raw['id'];
				if (typeof id !== 'string' || id.length === 0) {
					errors.push(`${where}.id: must be a non-empty string`);
					continue;
				}
				if (id.length > MAX_CUSTOM_ID_LENGTH) {
					errors.push(`${where}.id: must be <= ${MAX_CUSTOM_ID_LENGTH} characters`);
					continue;
				}

				if (seenIds.has(id)) {
					errors.push(`${where}.id: duplicate rule id '${id}' in pack`);
					continue;
				}

				if (kind === 'override') {
					if (!knownBuiltInIds.has(id)) {
						errors.push(
							`${where}.id: '${id}' is not a known UAD compliance rule (known: ${Array.from(knownBuiltInIds).join(', ')})`,
						);
						continue;
					}
					seenIds.add(id);
					validateOverride(raw as Partial<UadRuleConfig>, where, errors);
				} else {
					// kind === 'custom'
					if (knownBuiltInIds.has(id)) {
						errors.push(
							`${where}.id: custom rule id '${id}' collides with a built-in rule id`,
						);
						continue;
					}
					if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
						errors.push(
							`${where}.id: must match /^[a-z0-9][a-z0-9-]*$/i (got '${id}')`,
						);
						continue;
					}
					seenIds.add(id);
					validateCustom(raw as Partial<UadCustomRule>, where, errors);
				}
			}

			// Soft warning: admins can technically ship a pack that disables EVERY
			// built-in rule. With no custom rules either the score would always be
			// 100; with custom rules the warning would mislead, so only warn when
			// every entry is a disabled override.
			const onlyDisabledOverrides =
				Array.isArray(rules) &&
				rules.length > 0 &&
				rules.every((r) => {
					const obj = r as Record<string, unknown> | null;
					if (!obj) return false;
					const kind = (obj['kind'] ?? 'override') as string;
					return kind === 'override' && obj['enabled'] === false;
				});
			if (onlyDisabledOverrides) {
				warnings.push('All built-in rules disabled and no custom rules — the UAD compliance score will always be 100.');
			}

			return { errors, warnings };
		},

		preview(input: CategoryPreviewInput): Promise<CategoryPreviewResult[]> {
			// Workspace passes a mixed UadPackRule[] in `input.rules`; partition
			// here so the evaluator gets the clean (configMap, customRules) pair.
			const { configMap, customRules } = partitionPackRules(
				(input.rules as UadPackRule[]) ?? [],
			);

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
				const report = evaluator.evaluate(
					input.packId ?? 'preview',
					doc,
					configMap,
					customRules,
				);
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

function validateOverride(
	raw: Partial<UadRuleConfig>,
	where: string,
	errors: string[],
): void {
	if (typeof raw.enabled !== 'boolean') {
		errors.push(`${where}.enabled: must be boolean`);
	}
	if (raw.severityOverride !== undefined && !VALID_SEVERITIES.has(raw.severityOverride)) {
		errors.push(
			`${where}.severityOverride: must be one of CRITICAL/HIGH/MEDIUM (got '${String(raw.severityOverride)}')`,
		);
	}
	if (raw.messageOverride !== undefined && typeof raw.messageOverride !== 'string') {
		errors.push(`${where}.messageOverride: must be a string`);
	} else if (typeof raw.messageOverride === 'string' && raw.messageOverride.length > MAX_MESSAGE_LENGTH) {
		errors.push(`${where}.messageOverride: must be <= ${MAX_MESSAGE_LENGTH} characters`);
	}
}

function validateCustom(
	raw: Partial<UadCustomRule>,
	where: string,
	errors: string[],
): void {
	if (typeof raw.enabled !== 'boolean') {
		errors.push(`${where}.enabled: must be boolean`);
	}
	if (typeof raw.label !== 'string' || raw.label.trim().length === 0) {
		errors.push(`${where}.label: must be a non-empty string`);
	} else if (raw.label.length > MAX_LABEL_LENGTH) {
		errors.push(`${where}.label: must be <= ${MAX_LABEL_LENGTH} characters`);
	}
	if (typeof raw.severity !== 'string' || !VALID_SEVERITIES.has(raw.severity)) {
		errors.push(
			`${where}.severity: must be one of CRITICAL/HIGH/MEDIUM (got '${String(raw.severity)}')`,
		);
	}
	if (typeof raw.message !== 'string' || raw.message.trim().length === 0) {
		errors.push(`${where}.message: must be a non-empty string`);
	} else if (raw.message.length > MAX_MESSAGE_LENGTH) {
		errors.push(`${where}.message: must be <= ${MAX_MESSAGE_LENGTH} characters`);
	}
	if (raw.condition === undefined) {
		errors.push(`${where}.condition: required (JSONLogic predicate that returns truthy when the rule fails)`);
	} else {
		// Condition must be plain JSON — reject functions / undefined / NaN /
		// circular structures by round-tripping through JSON.
		try {
			JSON.parse(JSON.stringify(raw.condition));
		} catch (err) {
			errors.push(`${where}.condition: must be JSON-serialisable (${err instanceof Error ? err.message : 'unknown error'})`);
		}
		const depth = conditionDepth(raw.condition);
		if (depth > MAX_CONDITION_DEPTH) {
			errors.push(
				`${where}.condition: nesting depth ${depth} exceeds limit ${MAX_CONDITION_DEPTH}`,
			);
		}
	}
	if (raw.fieldPath !== undefined && typeof raw.fieldPath !== 'string') {
		errors.push(`${where}.fieldPath: must be a string when provided`);
	}
}
