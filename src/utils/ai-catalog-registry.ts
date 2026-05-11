/**
 * AI Catalog Registry — module-level registry of AI-exposable HTTP routes.
 *
 * Phase 10-full of AI-UNIVERSAL-SURFACE-PLAN.md (2026-05-10).  The
 * frontend's hand-curated TS catalog (Phase 10-light) covered ~25
 * endpoints; this registry lets the BE be the source of truth for the
 * full AI-exposable surface (target: 300+).  Controllers opt in by
 * calling `registerAiRoute(entry)` at module-load time.
 *
 * Design choices (vs. a full zod-to-openapi migration):
 *   - Default-deny: routes NOT registered are invisible to the AI.
 *     Adding a route doesn't accidentally expose it.
 *   - Centralized: every entry passes through this module so the
 *     `/api/ai/catalog` endpoint, lint checks, and CI artifact gates
 *     can audit the AI surface in one place.
 *   - Lightweight: no Zod migration required.  Controllers add a
 *     single `registerAiRoute({...})` call alongside their existing
 *     `router.METHOD()` registration.
 *   - Schema-as-hint: pathParams / queryParams / body carry JSON-Schema-
 *     shaped descriptors that the LLM uses to construct calls.  The
 *     authoritative validation still lives on each route (the
 *     controller's existing zod / express-validator code).  Drift
 *     between catalog hint and runtime validator surfaces as a 4xx on
 *     the live call — the AI's `callEndpoint` tool reports the real
 *     backend error to the user.
 *
 * The FE merges this BE catalog with its hand-curated TS catalog at
 * boot.  Hand-curated entries WIN on (path, method) collision so we
 * can keep richer descriptions / examples on the high-value paths.
 */

export type AiCatalogMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AiCatalogCategory =
	| 'orders'
	| 'engagements'
	| 'vendors'
	| 'clients'
	| 'documents'
	| 'properties'
	| 'qc'
	| 'review-programs'
	| 'criteria'
	| 'axiom'
	| 'decision-engine'
	| 'communications'
	| 'auto-assignment'
	| 'analytics'
	| 'ops'
	| 'mop';

export type AiCatalogSideEffect = 'read' | 'write' | 'external';

export type AiCatalogAudit = 'always' | 'on-write' | 'never';

/**
 * Exposure tier:
 *   - 'tool'  : visible to all signed-in users (subject to per-route scopes)
 *   - 'admin' : visible only to admin role
 *   - 'never' : NOT exposed.  Default for unregistered routes.  Registered
 *               routes can opt out by setting this explicitly (useful when
 *               a controller author wants to record metadata for an
 *               endpoint that should NEVER be AI-callable — e.g.
 *               auth-token endpoints).
 */
export type AiCatalogExposure = 'tool' | 'admin' | 'never';

export interface AiCatalogParamSchema {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object';
	required?: boolean;
	description?: string;
	enumValues?: readonly string[];
	itemType?: 'string' | 'number' | 'boolean';
}

export interface AiCatalogBodyHint {
	description?: string;
	example?: unknown;
}

export interface AiCatalogEntry {
	/** Stable identifier; lowercase-kebab.  Used in audit + telemetry. */
	id: string;
	method: AiCatalogMethod;
	/** Path template with `:param` placeholders. */
	path: string;
	/** One-line summary.  Surfaces in discoverEndpoints results. */
	summary: string;
	category: AiCatalogCategory;
	scopes: string[];
	sideEffect: AiCatalogSideEffect;
	audit?: AiCatalogAudit;
	aiExposure: AiCatalogExposure;
	pathParams?: Record<string, AiCatalogParamSchema>;
	queryParams?: Record<string, AiCatalogParamSchema>;
	body?: AiCatalogBodyHint;
	/** Frontend pages this endpoint is featured on (so the AI can offer to navigate). */
	uiPages?: string[];
	/** Search keywords beyond title+summary. */
	keywords?: string[];
}

// In-memory registry.  Keyed by `<METHOD> <path>` (the same uniqueness
// the Express router enforces).  Re-registering the same key overwrites
// — this lets tests register stub entries without leaking between cases.
const entries = new Map<string, AiCatalogEntry>();

/** Build the registry key the same way the FE merger does. */
function keyOf(method: AiCatalogMethod, path: string): string {
	return `${method} ${path}`;
}

/**
 * Register an AI-exposable route at module-load time.
 *
 * Throws when an entry with the same id is already registered under a
 * different (method, path) — this catches accidental duplicate ids
 * across controllers.  Re-registering the same (id, method, path)
 * triple is allowed (idempotent).
 */
export function registerAiRoute(entry: AiCatalogEntry): void {
	const key = keyOf(entry.method, entry.path);
	const existingById = Array.from(entries.values()).find((e) => e.id === entry.id);
	if (existingById && (existingById.method !== entry.method || existingById.path !== entry.path)) {
		throw new Error(
			`AI catalog: duplicate id "${entry.id}" — already registered for ${existingById.method} ${existingById.path}, ` +
				`attempted to re-register for ${entry.method} ${entry.path}.`,
		);
	}
	entries.set(key, entry);
}

/** Read snapshot of the registry.  Returns a copied array. */
export function getAiCatalog(filter?: {
	exposure?: AiCatalogExposure | AiCatalogExposure[];
	category?: AiCatalogCategory;
}): AiCatalogEntry[] {
	let list = Array.from(entries.values());
	if (filter?.exposure) {
		const set = new Set(Array.isArray(filter.exposure) ? filter.exposure : [filter.exposure]);
		list = list.filter((e) => set.has(e.aiExposure));
	}
	if (filter?.category) {
		list = list.filter((e) => e.category === filter.category);
	}
	// Sort by category then id for stable consumer ordering.
	list.sort((a, b) =>
		a.category === b.category ? a.id.localeCompare(b.id) : a.category.localeCompare(b.category),
	);
	return list;
}

/** Find one entry by (method, path).  Used by callEndpoint validators. */
export function findAiRoute(method: AiCatalogMethod, path: string): AiCatalogEntry | undefined {
	return entries.get(keyOf(method, path));
}

/** Test-only: clear the registry between cases.  No-op in production. */
export function _resetAiCatalogForTests(): void {
	entries.clear();
}
