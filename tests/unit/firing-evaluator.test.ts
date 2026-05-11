/**
 * Tests for the in-process firing-rules evaluator (Phase G of
 * DECISION_ENGINE_RULES_SURFACE.md).
 *
 * Pins the invariants the FiringRulesEvaluatorJob + Sandbox replay rely on:
 *   - rules with no matching conditions don't fire
 *   - matched rules contribute their actions to the result
 *   - outcome roll-up is fire > probation > notify_only > no_action
 *   - terminalActionFired flag flips iff a fire/probation action fires
 *   - rule order respects salience (lowest first)
 *   - malformed rule conditions skip gracefully (don't crash the pack)
 */

import { describe, expect, it } from 'vitest';
import { evaluateFiringRules } from '../../src/services/decision-engine/firing/firing-evaluator.service.js';
import type { VendorMatchingRuleDef } from '../../src/types/vendor-matching-rule-pack.types.js';

function rule(name: string, opts: {
	conditions?: Record<string, unknown>;
	factId?: string;
	data?: Record<string, unknown>;
	salience?: number;
}): VendorMatchingRuleDef {
	return {
		name,
		pattern_id: 'firing_evaluation',
		salience: opts.salience ?? 100,
		conditions: opts.conditions ?? {},
		actions: [{
			type: 'assert',
			fact_id: opts.factId ?? 'notify_supervisor',
			source: name,
			data: opts.data ?? { rule_id: name },
		}],
	};
}

describe('evaluateFiringRules', () => {
	it('no rules → no_action / no fires', () => {
		const result = evaluateFiringRules([], { vendor_performance_score: 50 });
		expect(result.firedRuleIds).toEqual([]);
		expect(result.actionsFired).toEqual([]);
		expect(result.outcome).toBe('no_action');
		expect(result.terminalActionFired).toBe(false);
	});

	it('rule with empty conditions fires (matches everything)', () => {
		const result = evaluateFiringRules(
			[rule('Always_Notify', { factId: 'notify_supervisor' })],
			{ vendor_performance_score: 50 },
		);
		expect(result.firedRuleIds).toEqual(['Always_Notify']);
		expect(result.outcome).toBe('notify_only');
		expect(result.terminalActionFired).toBe(false);
	});

	it('rule with non-matching conditions does not fire', () => {
		const result = evaluateFiringRules(
			[rule('Low_Performer', {
				conditions: { '<': [{ var: 'vendor_performance_score' }, 60] },
				factId: 'vendor_probation',
				data: { rule_id: 'Low_Performer', reason: 'Score below 60' },
			})],
			{ vendor_performance_score: 75 },
		);
		expect(result.firedRuleIds).toEqual([]);
		expect(result.outcome).toBe('no_action');
	});

	it('terminal action sets terminalActionFired + escalates outcome', () => {
		const result = evaluateFiringRules(
			[
				rule('Notify', { factId: 'notify_supervisor' }),
				rule('Probation_Bad_Score', {
					conditions: { '<': [{ var: 'vendor_performance_score' }, 60] },
					factId: 'vendor_probation',
					data: { reason: 'low score' },
				}),
			],
			{ vendor_performance_score: 50 },
		);
		expect(result.firedRuleIds).toContain('Probation_Bad_Score');
		expect(result.terminalActionFired).toBe(true);
		expect(result.outcome).toBe('probation');
	});

	it('outcome priority: fire > probation > notify > no_action', () => {
		const result = evaluateFiringRules(
			[
				rule('Notify',    { factId: 'notify_supervisor' }),
				rule('Probation', { factId: 'vendor_probation', data: { reason: 'bad' } }),
				rule('Fire',      { factId: 'vendor_fire', data: { reason: 'worst' } }),
			],
			{},
		);
		expect(result.outcome).toBe('fire');
	});

	it('rules evaluate in salience order (lowest first)', () => {
		const result = evaluateFiringRules(
			[
				rule('B', { salience: 200, factId: 'notify_supervisor' }),
				rule('A', { salience: 100, factId: 'notify_supervisor' }),
				rule('C', { salience: 300, factId: 'notify_supervisor' }),
			],
			{},
		);
		expect(result.firedRuleIds).toEqual(['A', 'B', 'C']);
	});

	it('malformed conditions skip the rule but don\'t throw', () => {
		const result = evaluateFiringRules(
			[
				rule('Bad', { conditions: { unknownOp: [1, 2] }, factId: 'notify_supervisor' }),
				rule('Good', { factId: 'notify_supervisor' }),
			],
			{},
		);
		// Bad rule skipped silently; Good still fires.
		expect(result.firedRuleIds).toEqual(['Good']);
	});

	it('unknown fact_id is normalised to "unknown" type but still tracked', () => {
		const result = evaluateFiringRules(
			[rule('Wat', { factId: 'completely_made_up' })],
			{},
		);
		expect(result.actionsFired[0]!.type).toBe('unknown');
		expect(result.terminalActionFired).toBe(false);
	});
});
