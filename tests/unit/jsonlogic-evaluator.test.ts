/**
 * Tests for the minimal JSONLogic evaluator backing Phase G of
 * DECISION_ENGINE_RULES_SURFACE.md (and any future in-process category).
 *
 * Coverage focus: the operators the visual condition builder produces
 * (the 80% case) plus the boolean / membership operators operators sometimes
 * hand-author into raw JSON. Edge cases (null/undefined, type-coerced
 * comparisons) are pinned because firing-rules evaluations run on metric
 * bundles where missing fields are common.
 */

import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/services/decision-engine/shared/jsonlogic-evaluator.js';

describe('jsonlogic-evaluator — var', () => {
	it('reads top-level fields', () => {
		expect(evaluate({ var: 'x' }, { x: 42 })).toBe(42);
	});

	it('reads nested fields via dot path', () => {
		expect(evaluate({ var: 'a.b.c' }, { a: { b: { c: 'deep' } } })).toBe('deep');
	});

	it('returns default when path is missing (array form)', () => {
		expect(evaluate({ var: ['missing', 'fallback'] }, {})).toBe('fallback');
	});

	it('returns null when missing without default', () => {
		expect(evaluate({ var: 'missing' }, {})).toBeNull();
	});
});

describe('jsonlogic-evaluator — comparisons', () => {
	it('==/!= use loose equality with type coercion', () => {
		expect(evaluate({ '==': [1, '1'] }, {})).toBe(true);
		expect(evaluate({ '!=': [1, '2'] }, {})).toBe(true);
	});

	it('numeric comparisons coerce strings', () => {
		expect(evaluate({ '<': ['10', 20] }, {})).toBe(true);
		expect(evaluate({ '>=': [{ var: 'score' }, 80] }, { score: 80 })).toBe(true);
	});

	it('string comparisons fall back to lexicographic when non-numeric', () => {
		expect(evaluate({ '<': ['abc', 'abd'] }, {})).toBe(true);
		expect(evaluate({ '>=': ['xyz', 'abc'] }, {})).toBe(true);
	});

	it('handles null/undefined gracefully', () => {
		expect(evaluate({ '==': [null, undefined] }, {})).toBe(true);
		expect(evaluate({ '<': [{ var: 'missing' }, 5] }, {})).toBe(true); // null coerces to 0
	});
});

describe('jsonlogic-evaluator — and / or / not', () => {
	it('and short-circuits on first falsy', () => {
		expect(evaluate({ and: [{ '==': [1, 1] }, { '==': [1, 2] }, { '==': [1, 1] }] }, {})).toBe(false);
	});

	it('or returns first truthy value', () => {
		expect(evaluate({ or: [{ '==': [1, 2] }, { '==': [1, 1] }] }, {})).toBe(true);
	});

	it('! and not negate', () => {
		expect(evaluate({ '!': { '==': [1, 1] } }, {})).toBe(false);
		expect(evaluate({ not: { '==': [1, 2] } }, {})).toBe(true);
	});
});

describe('jsonlogic-evaluator — in / not in', () => {
	it('checks array membership', () => {
		expect(evaluate({ in: ['CA', { var: 'states' }] }, { states: ['CA', 'NV'] })).toBe(true);
		expect(evaluate({ in: ['TX', { var: 'states' }] }, { states: ['CA', 'NV'] })).toBe(false);
	});

	it('checks string substring', () => {
		expect(evaluate({ in: ['hello', 'hello world'] }, {})).toBe(true);
	});

	it('not in negates', () => {
		expect(evaluate({ 'not in': ['TX', { var: 'states' }] }, { states: ['CA', 'NV'] })).toBe(true);
	});
});

describe('jsonlogic-evaluator — if', () => {
	it('returns then-branch when cond is truthy', () => {
		expect(evaluate({ if: [{ '==': [1, 1] }, 'yes', 'no'] }, {})).toBe('yes');
	});

	it('returns else-branch when cond is falsy', () => {
		expect(evaluate({ if: [{ '==': [1, 2] }, 'yes', 'no'] }, {})).toBe('no');
	});

	it('returns null when no else and cond is falsy', () => {
		expect(evaluate({ if: [{ '==': [1, 2] }, 'yes'] }, {})).toBeNull();
	});
});

describe('jsonlogic-evaluator — invariants', () => {
	it('empty object is truthy (no-conditions sentinel)', () => {
		expect(evaluate({}, {})).toBe(true);
	});

	it('throws on unknown operator', () => {
		expect(() => evaluate({ frobnicate: [1, 2] }, {})).toThrow(/Unsupported JSONLogic operator/);
	});

	it('throws on multi-key node', () => {
		expect(() => evaluate({ '==': [1, 1], 'and': [] }, {})).toThrow(/exactly one operator key/);
	});
});
