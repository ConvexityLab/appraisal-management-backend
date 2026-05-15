/**
 * AutopilotSponsorIdentity — Phase 14 v2 delegated identity (2026-05-11).
 *
 * Resolves the sponsoring human's identity at fire time, NOT at recipe
 * scheduling time.  Implements the delegated-identity model from
 * AI-UNIVERSAL-SURFACE-PLAN.md §4 Phase 14:
 *
 *   "The autopilot acts AS the human who scheduled/initiated it.
 *    Scopes follow the user's CURRENT scope set at fire time — if their
 *    permissions change, the autopilot's effective permissions follow.
 *    If the sponsor user is offboarded, all of their autopilot tasks
 *    die with them."
 *
 * This service does NOT mint a JWT — v2 MVP runs autopilot dispatches
 * inside the BE process where the dispatcher trusts the in-process
 * `{ tenantId, userId, role }` context.  When/if we promote autopilot
 * to call back to itself over HTTP (or push beyond the trust boundary),
 * a JWT minter (EntraId On-Behalf-Of flow) drops in as a sibling
 * method here.
 *
 * Failure modes the caller MUST handle:
 *   - `sponsor-missing` — user record gone (deletion, tenant migration).
 *     Recipe should be transitioned to 'sponsor-missing' status so it
 *     stops firing until re-sponsored.
 *   - `sponsor-inactive` — `isActive: false` on the profile.  Same
 *     handling as missing.
 *   - `tenant-mismatch` — recipe.tenantId !== sponsor.tenantId.  Should
 *     never happen in production but guards against cross-tenant
 *     scope leakage if a recipe is somehow imported wrong.
 */

import { Logger } from '../utils/logger.js';
import { UserProfileService } from './user-profile.service.js';
import type { UserProfile, Role } from '../types/authorization.types.js';

export interface SponsorIdentityOk {
	ok: true;
	tenantId: string;
	userId: string;
	role: Role;
	isInternal?: boolean;
}

export interface SponsorIdentityFail {
	ok: false;
	reason: 'sponsor-missing' | 'sponsor-inactive' | 'tenant-mismatch';
	message: string;
}

export type SponsorIdentityResult = SponsorIdentityOk | SponsorIdentityFail;

export class AutopilotSponsorIdentity {
	private readonly logger = new Logger('AutopilotSponsorIdentity');
	private readonly profiles: UserProfileService;

	constructor(profiles?: UserProfileService) {
		this.profiles = profiles ?? new UserProfileService();
	}

	/**
	 * Look up the sponsoring user.  Returns an OK envelope with the
	 * scope-bearing fields the dispatcher needs, or a typed failure
	 * envelope the caller maps to a recipe status update.
	 */
	async resolve(tenantId: string, sponsorUserId: string): Promise<SponsorIdentityResult> {
		if (!tenantId || !sponsorUserId) {
			return {
				ok: false,
				reason: 'sponsor-missing',
				message: 'tenantId and sponsorUserId are both required.',
			};
		}
		// Lookup is dual-key: recipe.sponsorUserId may have been stored as
		// either the doc id (email-derived) or the Azure AD oid, depending
		// on whether the recipe was created via REST API (oid from JWT)
		// or migrated/admin-seeded (doc id).  Try both.  Real bug surfaced
		// by live-fire: AAD users that haven't been email-synced into the
		// users container would silently flip the recipe to sponsor-missing
		// on the first sweep, with no obvious remediation path.
		let profile: UserProfile | null = null;
		try {
			profile = await this.profiles.getUserProfile(sponsorUserId, tenantId);
		} catch (err) {
			this.logger.warn('Sponsor lookup (by doc id) failed', {
				tenantId,
				sponsorUserId,
				error: err instanceof Error ? err.message : String(err),
			});
		}
		if (!profile) {
			try {
				profile = await this.profiles.getUserProfileByAzureId(sponsorUserId, tenantId);
			} catch (err) {
				this.logger.warn('Sponsor lookup (by AAD oid) failed', {
					tenantId,
					sponsorUserId,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
		if (!profile) {
			return {
				ok: false,
				reason: 'sponsor-missing',
				message: `Sponsor user ${sponsorUserId} not found in tenant ${tenantId} (tried both doc id and AAD oid keys).`,
			};
		}
		if (profile.tenantId !== tenantId) {
			return {
				ok: false,
				reason: 'tenant-mismatch',
				message: `Sponsor user ${sponsorUserId} belongs to a different tenant (${profile.tenantId}) than the recipe (${tenantId}).`,
			};
		}
		if (!profile.isActive) {
			return {
				ok: false,
				reason: 'sponsor-inactive',
				message: `Sponsor user ${sponsorUserId} has isActive=false. Recipe should pause until re-sponsored.`,
			};
		}
		return {
			ok: true,
			tenantId: profile.tenantId,
			userId: sponsorUserId,
			role: profile.role,
			...(profile.isInternal !== undefined && { isInternal: profile.isInternal }),
		};
	}
}
