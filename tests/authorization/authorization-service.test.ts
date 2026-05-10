import { describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../../src/services/authorization.service.js';
import type { AuthorizationContext, UserProfile } from '../../src/types/authorization.types.js';

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user-1@example.test',
    name: 'User One',
    tenantId: 'tenant-a',
    role: 'admin',
    portalDomain: 'platform',
    boundEntityIds: [],
    accessScope: {
      teamIds: [],
      departmentIds: [],
      managedClientIds: [],
      managedVendorIds: [],
      managedUserIds: [],
      regionIds: [],
      statesCovered: [],
      canViewAllOrders: false,
      canViewAllVendors: false,
      canOverrideQC: false,
    },
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('AuthorizationService', () => {
  it('throws when a stored user profile is missing required portalDomain', async () => {
    const dbService = {
      queryDocuments: vi.fn().mockResolvedValue([
        {
          ...makeUserProfile({ portalDomain: undefined as never }),
          portalDomain: undefined,
        },
      ]),
    };
    const service = new AuthorizationService({} as any, dbService as any);

    await expect(service.getUserProfile('user-1', 'tenant-a')).rejects.toThrow(
      /missing required field 'portalDomain'/,
    );
  });

  it('rethrows backing-store failures instead of masking them as a missing profile', async () => {
    const dbService = {
      queryDocuments: vi.fn().mockRejectedValue(new Error('cosmos unavailable')),
    };
    const service = new AuthorizationService({} as any, dbService as any);

    await expect(service.getUserProfile('user-1', 'tenant-a')).rejects.toThrow('cosmos unavailable');
  });

  it('writes authorization audit entries with the real tenant id', async () => {
    const dbService = {
      upsertDocument: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AuthorizationService({} as any, dbService as any);
    const context: AuthorizationContext = {
      user: {
        id: 'user-1',
        tenantId: 'tenant-a',
        role: 'admin',
        portalDomain: 'platform',
        boundEntityIds: [],
        email: 'user-1@example.test',
        teamIds: [],
        departmentIds: [],
      },
      resource: {
        type: 'order',
        id: 'order-123',
      },
      action: 'read',
      context: {
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
        requestId: 'req-1',
      },
    };

    await (service as any).logAuthorizationDecision(context, { allowed: true, reason: 'ok' });

    expect(dbService.upsertDocument).toHaveBeenCalledTimes(1);
    expect(dbService.upsertDocument).toHaveBeenCalledWith(
      'audit-trail',
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-1',
        resourceType: 'order',
        resourceId: 'order-123',
        action: 'read',
        decision: 'allow',
      }),
    );
  });
});