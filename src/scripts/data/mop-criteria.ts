/**
 * Canonical MOP Criteria Definitions
 *
 * Platform-wide base rule sets seeded into the `mop-criteria` Cosmos container
 * (tier = 'canonical', clientId = null).  Client-tier overrides are created
 * separately per-client during onboarding and are not seeded here.
 *
 * Currently empty — no canonical rule sets have been authored yet.
 * Add MopCriteriaDefinition objects to ALL_CANONICAL_MOP_CRITERIA when
 * platform-wide base rules are ready to ship.
 */

import type { MopCriteriaDefinition } from '../../types/mop-criteria.types.js';

export const ALL_CANONICAL_MOP_CRITERIA: MopCriteriaDefinition[] = [];
