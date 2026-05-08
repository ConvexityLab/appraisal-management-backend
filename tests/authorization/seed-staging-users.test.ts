import { describe, expect, it } from 'vitest';

import {
  STAGING_TENANT_ID,
  STAGING_USERS,
  USERS_CONTAINER,
  VALID_STAGING_USER_ROLES,
  buildUserProfileDocument,
  validateStagingUsers,
} from '../../scripts/live-fire/seed-staging-users.ts';

describe('seed-staging-users', () => {
  it('builds user-profile documents that match the middleware lookup contract', () => {
    const user = STAGING_USERS[0]!;
    const document = buildUserProfileDocument(user) as Record<string, unknown>;

    expect(USERS_CONTAINER).toBe('users');
    expect(document).toMatchObject({
      id: user.oid,
      azureAdObjectId: user.oid,
      email: user.email,
      name: user.name,
      tenantId: STAGING_TENANT_ID,
      organizationId: STAGING_TENANT_ID,
      role: user.role,
      isActive: true,
    });
  });

  it('validates the checked-in staging seed definitions', () => {
    expect(() => validateStagingUsers(STAGING_USERS)).not.toThrow();
  });

  it('rejects duplicate identities and unsupported roles before any live Cosmos writes', () => {
    expect(() => validateStagingUsers([
      { oid: 'oid-1', email: 'dup@example.test', name: 'User One', role: VALID_STAGING_USER_ROLES[0] },
      { oid: 'oid-1', email: 'other@example.test', name: 'User Two', role: VALID_STAGING_USER_ROLES[1] },
    ])).toThrow(/Duplicate staging user oid/);

    expect(() => validateStagingUsers([
      { oid: 'oid-1', email: 'dup@example.test', name: 'User One', role: 'not-a-real-role' },
    ])).toThrow(/unsupported role/i);
  });
});