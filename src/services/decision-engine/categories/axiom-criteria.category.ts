/**
 * AxiomCriteriaCategory — fourth live Decision Engine category.
 *
 * Phase H (storage + custom editor) shipped. Phase L0 (survey) + L1 (stub
 * analytics) shipped earlier. This revision lands L3 (push) + L4 (full
 * results reader); only L2 (the Axiom-side `POST /api/criteria-sets`
 * endpoint) and L5 (replay against proposed criteria) remain pending —
 * both gated on Axiom-team work in the sibling repo. See
 * `services/decision-engine/axiom-criteria/AXIOM_INTEGRATION_SURVEY.md`.
 *
 * MVP wiring today:
 *   - validateRules: shared Prio-style validator (criterion fields live
 *     in actions[0].data; see Phase H AxiomCriteriaEditor).
 *   - analytics: L4 reader — queries axiom-executions tenant+window,
 *     aggregates per-criterion fire counts from execution.results.criteria.
 *     Falls back to L1 "pending" stub when no Cosmos handle is supplied.
 *   - push:      L3 best-effort pusher — POSTs the pack to Axiom's
 *                `/api/criteria-sets` endpoint. Fails open (logs warning)
 *                when endpoint is unconfigured or 404 (Axiom-side L2 not
 *                yet shipped).
 *   - preview / replay: still deferred — both need Axiom-side support
 *     for stateless criteria evaluation. Tracked in the integration survey.
 */

import type { CategoryDefinition } from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';
import { AxiomCriteriaResultsReader } from '../axiom-criteria/axiom-criteria-results-reader.service.js';
import { AxiomCriteriaPusher } from '../axiom-criteria/axiom-criteria-pusher.service.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type { RulePackDocument } from '../../../types/decision-rule-pack.types.js';

export const AXIOM_CRITERIA_CATEGORY_ID = 'axiom-criteria';

export function buildAxiomCriteriaCategory(opts: { db?: CosmosDbService } = {}): CategoryDefinition {
	const reader = new AxiomCriteriaResultsReader(opts.db ?? null);
	const pusher = new AxiomCriteriaPusher();

	return {
		id: AXIOM_CRITERIA_CATEGORY_ID,
		label: 'Axiom Criteria',
		description:
			"CRUD over Axiom's document evaluation criteria. Custom criteria-shaped editor (text + expected answer + rubric) lands as Phase H polish.",
		icon: 'heroicons-outline:beaker',
		validateRules: validatePrioRulePack,
		analytics: async (input) => reader.summary(input),
		push: async (pack: RulePackDocument<unknown>) => {
			// Best-effort — pusher itself logs + swallows errors. Pack remains
			// AMS-authoritative regardless of Axiom registration outcome.
			await pusher.push(pack);
		},
		// preview / replay still deferred — see AXIOM_INTEGRATION_SURVEY.md
	};
}
