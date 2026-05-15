import { describe, it, expect, vi } from 'vitest';
import { module as authorizationCapabilitiesModule } from '../../src/scripts/seed/modules/authorization-capabilities.js';
import type { SeedContext } from '../../src/scripts/seed/seed-types.js';
import {
  materializeAuthorizationCapabilityDocuments,
  AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
} from '../../src/data/platform-capability-matrix.js';

describe('authorization-capabilities seed module', () => {
  it('materializes capabilities into the authorization-policies container', async () => {
    const upsert = vi.fn(async () => ({}));
    const ctx: SeedContext = {
      cosmosClient: {} as any,
      db: {
        container: vi.fn(() => ({
          items: { upsert },
        })),
      } as any,
      tenantId: 'tenant-a',
      clientId: 'client-a',
      subClientId: 'sub-a',
      now: new Date().toISOString(),
      clean: false,
      cleanOnly: false,
      storageAccountName: '',
    };

    const result = await authorizationCapabilitiesModule.run(ctx);

    expect(result.failed).toBe(0);
    expect(result.created).toBe(materializeAuthorizationCapabilityDocuments(AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID).length);
    expect((ctx.db.container as any)).toHaveBeenCalledWith('authorization-policies');
    const firstUpsertedDoc = upsert.mock.calls[0]?.[0];
    expect(firstUpsertedDoc?.type).toBe('authorization-capability');
    expect(firstUpsertedDoc?.tenantId).toBe(AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID);
  });
});
