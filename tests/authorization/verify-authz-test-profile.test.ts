import { describe, expect, it } from 'vitest';

import {
  getTokenEmail,
  getTokenObjectId,
  resolveConfiguredIdentity,
  resolveStagingSeedUser,
  validateProfileResponse,
} from '../../scripts/live-fire/verify-authz-test-profile.ts';

describe('verify-authz-test-profile', () => {
  it('extracts the email and oid claims from a decoded JWT payload', () => {
    const claims = {
      preferred_username: 'hiro@loneanalytics.com',
      oid: '3cb04a10-b6f3-4fd1-8997-798507299d73',
    };

    expect(getTokenEmail(claims)).toBe('hiro@loneanalytics.com');
    expect(getTokenObjectId(claims)).toBe('3cb04a10-b6f3-4fd1-8997-798507299d73');
  });

  it('matches configured seeded identities case-insensitively', () => {
    const identity = resolveConfiguredIdentity('staging', 'HIRO@LONEANALYTICS.COM', {
      staging: [
        { upn: 'hiro@loneanalytics.com', role: 'Admin', clientId: 'vision', subClientId: 'platform' },
      ],
    });

    expect(identity.role).toBe('Admin');
  });

  it('rejects tokens for users that are not configured in the target environment', () => {
    expect(() =>
      resolveConfiguredIdentity('staging', 'unknown@example.com', {
        staging: [
          { upn: 'hiro@loneanalytics.com', role: 'Admin', clientId: 'vision', subClientId: 'platform' },
        ],
      }),
    ).toThrow(/not listed/i);
  });

  it('requires the staging token subject to match the checked-in seed user list', () => {
    const seeded = resolveStagingSeedUser(
      'hiro@loneanalytics.com',
      '3cb04a10-b6f3-4fd1-8997-798507299d73',
    );

    expect(seeded.name).toBe('Hiro');
  });

  it('fails when the profile endpoint payload does not match the authenticated user', () => {
    expect(() =>
      validateProfileResponse(
        {
          user: { id: 'wrong-oid', email: 'hiro@loneanalytics.com', role: 'admin', isTestUser: false },
          interpretation: { can_view_all: true },
        },
        'hiro@loneanalytics.com',
        '3cb04a10-b6f3-4fd1-8997-798507299d73',
        'admin',
      ),
    ).toThrow(/user.id mismatch/i);
  });

  it('accepts a matching seeded-admin profile response', () => {
    expect(() =>
      validateProfileResponse(
        {
          user: {
            id: '3cb04a10-b6f3-4fd1-8997-798507299d73',
            email: 'hiro@loneanalytics.com',
            role: 'admin',
            isTestUser: false,
          },
          interpretation: { can_view_all: true },
        },
        'hiro@loneanalytics.com',
        '3cb04a10-b6f3-4fd1-8997-798507299d73',
        'admin',
      ),
    ).not.toThrow();
  });

  it('fails when the profile endpoint role does not match the expected seeded role', () => {
    expect(() =>
      validateProfileResponse(
        {
          user: {
            id: '3cb04a10-b6f3-4fd1-8997-798507299d73',
            email: 'hiro@loneanalytics.com',
            role: 'manager',
            isTestUser: false,
          },
          interpretation: { can_view_all: true },
        },
        'hiro@loneanalytics.com',
        '3cb04a10-b6f3-4fd1-8997-798507299d73',
        'admin',
      ),
    ).toThrow(/user.role mismatch/i);
  });
});