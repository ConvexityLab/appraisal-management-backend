/**
 * Seed Module: MOP Criteria
 *
 * Seeds canonical MopCriteriaDefinition documents.
 * These are the platform-wide base rule sets; client overrides (tier='client')
 * are created separately per client setup.
 *
 * Container: mop-criteria (partition key: /clientId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
// Note: relative `'../../data/mop-criteria.js'` traversal trips tsx's
// resolveTsPaths in this specific module; using the @/ tsconfig path alias
// resolves cleanly.
import { ALL_CANONICAL_MOP_CRITERIA } from '@/data/mop-criteria.js';

const CONTAINER = 'mop-criteria';

export const module: SeedModule = {
  name: 'mop-criteria',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const def of ALL_CANONICAL_MOP_CRITERIA) {
      await upsert(ctx, CONTAINER, def, result);
    }

    return result;
  },
};
