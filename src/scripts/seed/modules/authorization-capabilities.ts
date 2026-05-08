import type { SeedContext, SeedModule, SeedModuleResult } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
import {
  materializeAuthorizationCapabilityDocuments,
  AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
} from '../../../data/platform-capability-matrix.js';

const CONTAINER = 'authorization-policies';

export const module: SeedModule = {
  name: 'authorization-capabilities',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, '/tenantId', 'seed-capability-');
    }

    const capabilityDocs = materializeAuthorizationCapabilityDocuments(
      AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
      'system:seed',
    );

    for (const capability of capabilityDocs) {
      await upsert(ctx, CONTAINER, capability as unknown as Record<string, unknown>, result);
    }

    return result;
  },
};
