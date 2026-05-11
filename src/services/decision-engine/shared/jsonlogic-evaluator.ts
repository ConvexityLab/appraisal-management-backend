/**
 * Minimal JSONLogic evaluator — pure-TS, no deps.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md needs an in-process
 * evaluator for firing rules (and any future in-process category). The full
 * jsonlogic-js spec is overkill for our use; this implementation covers
 * the operators the visual condition builder ever produces, plus the small
 * superset operators that operators sometimes hand-author into raw JSON.
 *
 * Supported operators (matches RuleConditionBuilder + raw JSON usage):
 *   - {"var": "name"}                                    → fact lookup
 *   - {"var": ["name", default]}                         → fact lookup with default
 *   - {"==": [a, b]} / "!=" / "<" / "<=" / ">" / ">="    → comparisons
 *   - {"in": [needle, haystackArray]}                   → membership
 *   - {"not in": [needle, haystackArray]}               → negated membership
 *   - {"and": [a, b, ...]} / {"or": [a, b, ...]}        → boolean combinators
 *   - {"!": expr} / {"not": expr}                       → negation
 *   - {"if": [cond, then, else]}                        → ternary
 *
 * Behaviour intentionally mirrors jsonlogic-js for the operators we
 * implement: `null` and `undefined` are loosely-equal; comparisons
 * coerce to numbers when possible; `in` works against strings + arrays.
 *
 * Returns `unknown` to give callers latitude over how they consume the
 * result. The firing evaluator coerces to boolean for condition checks.
 */

export type Facts = Record<string, unknown>;
export type LogicNode = unknown;

const COMPARATORS = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function evaluate(node: LogicNode, facts: Facts): unknown {
	if (node === null || typeof node !== 'object') return node;
	if (Array.isArray(node)) return node.map(n => evaluate(n, facts));

	const keys = Object.keys(node as Record<string, unknown>);
	if (keys.length !== 1) {
		// Empty object {} = literal true (no conditions to evaluate).
		if (keys.length === 0) return true;
		throw new Error(`JSONLogic node must have exactly one operator key; got ${keys.length}: ${keys.join(', ')}`);
	}
	const op = keys[0]!;
	const args = (node as Record<string, unknown>)[op];

	if (op === 'var') {
		return readVar(args, facts);
	}
	if (op === 'and') {
		const list = asArray(args, op);
		let last: unknown = true;
		for (const item of list) {
			last = evaluate(item, facts);
			if (!truthy(last)) return last;
		}
		return last;
	}
	if (op === 'or') {
		const list = asArray(args, op);
		let last: unknown = false;
		for (const item of list) {
			last = evaluate(item, facts);
			if (truthy(last)) return last;
		}
		return last;
	}
	if (op === '!' || op === 'not') {
		return !truthy(evaluate(args, facts));
	}
	if (op === 'if') {
		const list = asArray(args, op);
		// Variadic if: pairs of (cond, then) followed by optional final else.
		for (let i = 0; i + 1 < list.length; i += 2) {
			if (truthy(evaluate(list[i], facts))) return evaluate(list[i + 1], facts);
		}
		if (list.length % 2 === 1) return evaluate(list[list.length - 1], facts);
		return null;
	}
	if (op === 'in') {
		const list = asArray(args, op);
		const needle = evaluate(list[0], facts);
		const haystack = evaluate(list[1], facts);
		return containsIn(haystack, needle);
	}
	if (op === 'not in') {
		const list = asArray(args, op);
		const needle = evaluate(list[0], facts);
		const haystack = evaluate(list[1], facts);
		return !containsIn(haystack, needle);
	}
	if (COMPARATORS.has(op)) {
		const list = asArray(args, op);
		const lhs = evaluate(list[0], facts);
		const rhs = evaluate(list[1], facts);
		return applyComparator(op, lhs, rhs);
	}

	throw new Error(`Unsupported JSONLogic operator: ${op}`);
}

function readVar(arg: unknown, facts: Facts): unknown {
	let path: string;
	let defaultValue: unknown = null;
	if (typeof arg === 'string') {
		path = arg;
	} else if (Array.isArray(arg)) {
		path = String(arg[0] ?? '');
		defaultValue = arg.length > 1 ? arg[1] : null;
	} else if (arg === '' || arg === null || arg === undefined) {
		return facts;
	} else {
		path = String(arg);
	}
	if (path === '') return facts;

	const parts = path.split('.');
	let cur: unknown = facts;
	for (const p of parts) {
		if (cur === null || cur === undefined) return defaultValue;
		if (typeof cur !== 'object') return defaultValue;
		cur = (cur as Record<string, unknown>)[p];
	}
	return cur === undefined ? defaultValue : cur;
}

function asArray(arg: unknown, op: string): unknown[] {
	if (!Array.isArray(arg)) {
		throw new Error(`JSONLogic operator "${op}" expects an array of operands; got ${typeof arg}`);
	}
	return arg;
}

function truthy(v: unknown): boolean {
	if (v === null || v === undefined) return false;
	if (typeof v === 'boolean') return v;
	if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
	if (typeof v === 'string') return v.length > 0;
	if (Array.isArray(v)) return v.length > 0;
	return true;
}

function containsIn(haystack: unknown, needle: unknown): boolean {
	if (haystack === null || haystack === undefined) return false;
	if (typeof haystack === 'string') return haystack.includes(String(needle));
	if (Array.isArray(haystack)) return haystack.some(item => looseEqual(item, needle));
	return false;
}

function applyComparator(op: string, a: unknown, b: unknown): boolean {
	if (op === '==') return looseEqual(a, b);
	if (op === '!=') return !looseEqual(a, b);
	const an = toNumberOrNaN(a);
	const bn = toNumberOrNaN(b);
	if (Number.isNaN(an) || Number.isNaN(bn)) {
		// String compare for non-numeric operands so '"abc" < "abd"' works.
		const sa = String(a);
		const sb = String(b);
		if (op === '<')  return sa <  sb;
		if (op === '<=') return sa <= sb;
		if (op === '>')  return sa >  sb;
		if (op === '>=') return sa >= sb;
	}
	if (op === '<')  return an <  bn;
	if (op === '<=') return an <= bn;
	if (op === '>')  return an >  bn;
	if (op === '>=') return an >= bn;
	return false;
}

function looseEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || a === undefined) return b === null || b === undefined;
	if (b === null || b === undefined) return false;
	// Number-coerce when one side is a numeric string + the other a number.
	const an = toNumberOrNaN(a);
	const bn = toNumberOrNaN(b);
	if (!Number.isNaN(an) && !Number.isNaN(bn)) return an === bn;
	return String(a) === String(b);
}

function toNumberOrNaN(v: unknown): number {
	if (typeof v === 'number') return v;
	if (typeof v === 'string' && v.trim() !== '') return Number(v);
	if (typeof v === 'boolean') return v ? 1 : 0;
	// Match jsonlogic-js: null/undefined coerce to 0 in arithmetic + comparison
	// contexts so missing facts don't accidentally dump every comparison into
	// the lexicographic-string fallback.
	if (v === null || v === undefined) return 0;
	return Number.NaN;
}
