import { describe, expect, it } from 'vitest';

import {
  resolveExpectedUsersCount,
  validateUsersCount,
} from '../../scripts/live-fire/verify-users-container-count.ts';

describe('verify-users-container-count', () => {
  it('accepts a users document count that meets the configured minimum', () => {
    expect(() => validateUsersCount(3, 3, 'staging')).not.toThrow();
  });

  it('rejects a users container count below the configured minimum', () => {
    expect(() => validateUsersCount(2, 3, 'prod')).toThrow(/expected at least 3 document/i);
  });

  it('resolves the expected seeded-user minimum from environment identities', () => {
    expect(
      resolveExpectedUsersCount('staging', {
        staging: [
          { upn: 'one@example.com', role: 'Admin', clientId: 'vision', subClientId: 'platform' },
          { upn: 'two@example.com', role: 'Admin', clientId: 'vision', subClientId: 'platform' },
          { upn: 'three@example.com', role: 'Admin', clientId: 'vision', subClientId: 'platform' },
        ],
      }),
    ).toBe(3);
  });

  it('rejects environments without configured seeded users', () => {
    expect(() => resolveExpectedUsersCount('staging', { prod: [] })).toThrow(/No seeded user identities/i);
  });
});