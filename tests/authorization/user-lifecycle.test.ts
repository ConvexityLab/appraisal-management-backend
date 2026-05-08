import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationMiddleware, type AuthorizedRequest } from '../../src/middleware/authorization.middleware.js';
import type { Role, UserProfile } from '../../src/types/authorization.types.js';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  AUTO_PROVISION_USERS: process.env.AUTO_PROVISION_USERS,
  DEFAULT_USER_ROLE: process.env.DEFAULT_USER_ROLE,
  BYPASS_TEST_TOKEN_PROFILE_CHECK: process.env.BYPASS_TEST_TOKEN_PROFILE_CHECK,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'user-1@example.test',
    name: overrides.name ?? 'User One',
    azureAdObjectId: overrides.azureAdObjectId ?? overrides.id ?? 'user-1',
    tenantId: overrides.tenantId ?? 'tenant-a',
    role: overrides.role ?? 'appraiser',
    portalDomain: overrides.portalDomain ?? 'platform',
    boundEntityIds: overrides.boundEntityIds ?? [],
    accessScope: overrides.accessScope ?? { teamIds: [], departmentIds: [] },
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01'),
    ...(overrides.clientId ? { clientId: overrides.clientId } : {}),
    ...(overrides.subClientId ? { subClientId: overrides.subClientId } : {}),
    ...(overrides.isInternal !== undefined ? { isInternal: overrides.isInternal } : {}),
  };
}

function createResponse() {
  const response: Record<string, unknown> = {};
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response as any;
}

function createHarness(initialProfiles: UserProfile[] = [], mappings: Array<{ groupObjectId: string; role: Role; priority: number }> = []) {
  const profileStore = new Map(initialProfiles.map((profile) => [profile.id, { ...profile }]));
  const usersUpserts: unknown[] = [];
  const auditUpserts: unknown[] = [];

  const usersContainer = {
    items: {
      upsert: vi.fn(async (document: UserProfile & { updatedAt?: string }) => {
        usersUpserts.push(document);
        profileStore.set(document.id, {
          ...document,
          createdAt: document.createdAt instanceof Date ? document.createdAt : new Date(document.createdAt),
          updatedAt: document.updatedAt instanceof Date ? document.updatedAt : new Date(document.updatedAt ?? document.createdAt),
        } as UserProfile);
        return { resource: document };
      }),
      query: vi.fn(({ parameters }: { parameters?: Array<{ name: string; value: unknown }> }) => ({
        fetchAll: async () => {
          const userId = parameters?.find((entry) => entry.name === '@userId')?.value as string | undefined;
          const tenantId = parameters?.find((entry) => entry.name === '@tenantId')?.value as string | undefined;
          const profile = userId ? profileStore.get(userId) : undefined;
          if (profile && profile.tenantId === tenantId) {
            return { resources: [{ ...profile }] };
          }
          return { resources: [] };
        },
      })),
    },
  };

  const policyContainer = {
    items: {
      query: vi.fn(() => ({
        fetchAll: async () => ({
          resources: mappings.map((mapping, index) => ({
            id: `mapping-${index + 1}`,
            type: 'entra-group-role-mapping' as const,
            tenantId: 'tenant-a',
            description: `mapping ${index + 1}`,
            ...mapping,
          })),
        }),
      })),
    },
  };

  const dbService = {
    getContainer: vi.fn((name: string) => {
      if (name === 'users') {
        return usersContainer;
      }
      if (name === 'authorization-policies') {
        return policyContainer;
      }
      throw new Error(`Unexpected container: ${name}`);
    }),
    upsertDocument: vi.fn(async (_containerName: string, document: unknown) => {
      auditUpserts.push(document);
      return { resource: document };
    }),
  };

  const authzService = {
    getUserProfile: vi.fn(async (userId: string) => profileStore.get(userId) ?? null),
  };

  return {
    middleware: new AuthorizationMiddleware(authzService as any, dbService as any),
    authzService,
    profileStore,
    usersUpserts,
    auditUpserts,
  };
}

describe('AuthorizationMiddleware user lifecycle', () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('auto-provisions a missing user profile and loads it on the next request', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTO_PROVISION_USERS = 'true';
    process.env.DEFAULT_USER_ROLE = 'manager';
    delete process.env.BYPASS_TEST_TOKEN_PROFILE_CHECK;

    const harness = createHarness();
    const middleware = harness.middleware.loadUserProfile();

    const firstReq = {
      user: { id: 'fresh-user', email: 'fresh@example.test', tenantId: 'tenant-a' },
    } as AuthorizedRequest;
    const firstRes = createResponse();
    const firstNext = vi.fn();

    await middleware(firstReq, firstRes, firstNext);

    expect(firstNext).toHaveBeenCalledOnce();
    expect(firstReq.userProfile).toMatchObject({
      id: 'fresh-user',
      tenantId: 'tenant-a',
      role: 'manager',
      email: 'fresh@example.test',
    });
    expect(harness.usersUpserts).toHaveLength(1);
    expect(harness.auditUpserts).toHaveLength(1);
    expect(harness.auditUpserts[0]).toMatchObject({
      type: 'user-auto-provisioned',
      userId: 'fresh-user',
      tenantId: 'tenant-a',
      email: 'fresh@example.test',
      role: 'manager',
      source: 'authorization-middleware',
    });

    const secondReq = {
      user: { id: 'fresh-user', email: 'fresh@example.test', tenantId: 'tenant-a' },
    } as AuthorizedRequest;
    const secondRes = createResponse();
    const secondNext = vi.fn();

    await middleware(secondReq, secondRes, secondNext);

    expect(secondNext).toHaveBeenCalledOnce();
    expect(secondReq.userProfile?.role).toBe('manager');
    expect(harness.authzService.getUserProfile).toHaveBeenCalledTimes(2);
    expect(harness.usersUpserts).toHaveLength(1);
  });

  it('does not auto-provision a bypassed test-token request', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTO_PROVISION_USERS = 'true';
    process.env.DEFAULT_USER_ROLE = 'manager';
    process.env.BYPASS_TEST_TOKEN_PROFILE_CHECK = 'true';

    const harness = createHarness();
    const middleware = harness.middleware.loadUserProfile();
    const req = {
      user: { id: 'test-token-user', tenantId: 'tenant-a', isTestToken: true },
    } as AuthorizedRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userProfile?.role).toBe('admin');
    expect(harness.authzService.getUserProfile).not.toHaveBeenCalled();
    expect(harness.usersUpserts).toHaveLength(0);
    expect(harness.auditUpserts).toHaveLength(0);
  });

  it('syncs Entra group mappings onto the stored app role during profile load', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.AUTO_PROVISION_USERS;
    delete process.env.DEFAULT_USER_ROLE;
    delete process.env.BYPASS_TEST_TOKEN_PROFILE_CHECK;

    const harness = createHarness(
      [makeProfile({ id: 'mapped-user', tenantId: 'tenant-a', role: 'appraiser' })],
      [
        { groupObjectId: 'group-low', role: 'reviewer', priority: 10 },
        { groupObjectId: 'group-high', role: 'manager', priority: 200 },
      ],
    );
    const middleware = harness.middleware.loadUserProfile();
    const req = {
      user: {
        id: 'mapped-user',
        email: 'mapped-user@example.test',
        tenantId: 'tenant-a',
        groups: ['group-low', 'group-high'],
      },
    } as AuthorizedRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.userProfile?.role).toBe('manager');
    expect(harness.profileStore.get('mapped-user')?.role).toBe('manager');
    expect(harness.auditUpserts).toHaveLength(1);
    expect(harness.usersUpserts).toHaveLength(1);
  });
});