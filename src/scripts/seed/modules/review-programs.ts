/**
 * Seed Module: Review Programs
 *
 * Seeds versioned ReviewProgram documents using the authoritative static
 * definitions in src/data/review-programs.ts.
 *
 * Container: review-programs (partition /clientId)
 *
 * NOTE: mop-criteria seed must run before this module so the rulesetRefs
 * declared on each ReviewProgram resolve to existing documents.
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
// `'../../data/review-programs.js'` trips tsx resolveTsPaths from this
// nested seed module; @/ alias resolves cleanly.
import { VISION_APPRAISAL_V1_PROGRAM } from '@/data/review-programs.js';

const CONTAINER = 'review-programs';

export const module: SeedModule = {
  name: 'review-programs',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    // Stamp tenantId from seed context so platform-default programs are
    // queryable per-tenant without duplicating the document in Cosmos.
    const programs = [
      { ...VISION_APPRAISAL_V1_PROGRAM, tenantId: ctx.tenantId },
    ];

    for (const prog of programs) {
      await upsert(ctx, CONTAINER, prog, result);
    }

    return result;
  },
};
