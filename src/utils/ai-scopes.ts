/**
 * BE-side role → AI scope mapping.
 *
 * Mirrors the FE's `src/@auth/aiScopes.ts`.  When a BE-side caller
 * needs to know what AI scopes a user can hold (e.g. for filtering
 * the AI catalog response to only the endpoints the user could
 * actually call), it consults this module.
 *
 * Keep in sync with the FE.  CI gate (Phase 18-candidate): a contract
 * test that asserts the two mappings produce identical scope sets for
 * each role string.
 *
 * Per Phase 17.6 / C6 (2026-05-11): the /api/ai/catalog endpoint
 * filters its response to only entries the caller has every required
 * scope for.  Closes the enumeration vector where a low-privilege user
 * could enumerate the full AI surface by reading the catalog.
 */

export type AiScope =
	| 'order:read'
	| 'order:write'
	| 'vendor:read'
	| 'vendor:write'
	| 'comms:compose'
	| 'comms:send'
	| 'negotiation:propose'
	| 'negotiation:accept'
	| 'document:read'
	| 'audit:read';

const ALL_SCOPES: AiScope[] = [
	'order:read',
	'order:write',
	'vendor:read',
	'vendor:write',
	'comms:compose',
	'comms:send',
	'negotiation:propose',
	'negotiation:accept',
	'document:read',
	'audit:read',
];

interface UserLike {
	role?: string | string[] | null;
}

export function normaliseRoles(
	role: string | string[] | null | undefined,
): string[] {
	if (!role) return [];
	const list = Array.isArray(role) ? role : [role];
	return list.map((r) => r.toLowerCase()).filter((r) => r.length > 0);
}

export function getScopesForRole(role: string): AiScope[] {
	switch (role.toLowerCase()) {
		case 'admin':
			return [...ALL_SCOPES];
		case 'manager':
			return [
				'order:read',
				'order:write',
				'vendor:read',
				'vendor:write',
				'comms:compose',
				'comms:send',
				'negotiation:propose',
				'document:read',
				'audit:read',
			];
		case 'supervisor':
			return [
				'order:read',
				'order:write',
				'vendor:read',
				'vendor:write',
				'comms:compose',
				'negotiation:propose',
				'document:read',
				'audit:read',
			];
		case 'analyst':
			return [
				'order:read',
				'order:write',
				'vendor:read',
				'vendor:write',
				'comms:compose',
				'document:read',
				'audit:read',
			];
		case 'appraiser':
			return ['order:read', 'vendor:read', 'document:read'];
		case 'reviewer':
			return ['order:read', 'document:read'];
		default:
			return [];
	}
}

export function getScopesForUser(user: UserLike | null | undefined): AiScope[] {
	const roles = normaliseRoles(user?.role);
	const union = new Set<AiScope>();
	for (const r of roles) for (const s of getScopesForRole(r)) union.add(s);
	return Array.from(union);
}

/** True iff the user holds every scope in `required`. */
export function userHasAllScopes(
	user: UserLike | null | undefined,
	required: ReadonlyArray<string>,
): boolean {
	if (!required || required.length === 0) return true;
	const held = new Set(getScopesForUser(user));
	for (const scope of required) {
		if (!held.has(scope as AiScope)) return false;
	}
	return true;
}
