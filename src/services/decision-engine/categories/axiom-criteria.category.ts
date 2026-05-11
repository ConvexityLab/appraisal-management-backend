/**
 * AxiomCriteriaCategory — fourth live Decision Engine category.
 *
 * Phase H (storage + custom editor) shipped. Phase L0 (survey) + L1 (stub
 * analytics) ship in this revision; full Axiom integration (push +
 * faithful analytics) is L2-L5 — see
 * `services/decision-engine/axiom-criteria/AXIOM_INTEGRATION_SURVEY.md`.
 *
 * MVP wiring today:
 *   - validateRules: shared Prio-style validator (criterion fields live
 *     in actions[0].data; see Phase H AxiomCriteriaEditor).
 *   - analytics: L1 stub that returns a "pending" summary so the FE
 *     renders an inline "integration pending" panel instead of 501.
 *   - push / preview / replay: NOT yet wired — needs the Axiom-side
 *     "register criteria set" endpoint (Phase L2).
 */

import type { CategoryDefinition } from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';
import { AxiomCriteriaResultsReader } from '../axiom-criteria/axiom-criteria-results-reader.service.js';

export const AXIOM_CRITERIA_CATEGORY_ID = 'axiom-criteria';

export function buildAxiomCriteriaCategory(): CategoryDefinition {
	const reader = new AxiomCriteriaResultsReader();
	return {
		id: AXIOM_CRITERIA_CATEGORY_ID,
		label: 'Axiom Criteria',
		description:
			"CRUD over Axiom's document evaluation criteria. Custom criteria-shaped editor (text + expected answer + rubric) lands as Phase H polish.",
		icon: 'heroicons-outline:beaker',
		validateRules: validatePrioRulePack,
		analytics: async (input) => reader.summary(input),
		// push / preview / replay deferred — see AXIOM_INTEGRATION_SURVEY.md
	};
}
