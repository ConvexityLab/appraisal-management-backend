/**
 * AuthorizationMiddleware — startup guard tests
 *
 * Verifies that the constructor throws a FATAL error when
 * ENFORCE_AUTHORIZATION=off (or false) is combined with NODE_ENV=production,
 * and that it does NOT throw in dev/audit/enforce modes.
 *
 * No HTTP server or Cosmos DB needed — the guard fires in the constructor.
 */

import { describe, it, expect, afterEach } from 'vitest';

// Set minimum env vars required by other constructors called transitively
// (CosmosDbService checks for COSMOS_ENDPOINT, Logger may check NODE_ENV).
process.env.COSMOS_ENDPOINT = 'https://test.documents.azure.com:443/';
process.env.COSMOS_DATABASE_NAME = 'test-db';
process.env.ALLOW_TEST_TOKENS = 'true';

// Import AFTER env vars are set
import { AuthorizationMiddleware } from '../../src/middleware/authorization.middleware.js';

describe('AuthorizationMiddleware — startup guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnforceAuth = process.env.ENFORCE_AUTHORIZATION;

  afterEach(() => {
    // Restore original env state after each test
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalEnforceAuth === undefined) {
      delete process.env.ENFORCE_AUTHORIZATION;
    } else {
      process.env.ENFORCE_AUTHORIZATION = originalEnforceAuth;
    }
  });

  it('throws FATAL when NODE_ENV=production and ENFORCE_AUTHORIZATION=off', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENFORCE_AUTHORIZATION = 'off';

    expect(() => new AuthorizationMiddleware()).toThrow(/FATAL/);
  });

  it('throws FATAL when NODE_ENV=production and ENFORCE_AUTHORIZATION=false', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENFORCE_AUTHORIZATION = 'false';

    expect(() => new AuthorizationMiddleware()).toThrow(/FATAL/);
  });

  it('does NOT throw when NODE_ENV=development and ENFORCE_AUTHORIZATION=off', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENFORCE_AUTHORIZATION = 'off';

    expect(() => new AuthorizationMiddleware()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV=production and ENFORCE_AUTHORIZATION=enforce', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENFORCE_AUTHORIZATION = 'enforce';

    expect(() => new AuthorizationMiddleware()).not.toThrow();
  });

  it('does NOT throw when NODE_ENV=production and ENFORCE_AUTHORIZATION=audit', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENFORCE_AUTHORIZATION = 'audit';

    expect(() => new AuthorizationMiddleware()).not.toThrow();
  });

  it('does NOT throw when ENFORCE_AUTHORIZATION is unset (defaults to enforce)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENFORCE_AUTHORIZATION;

    expect(() => new AuthorizationMiddleware()).not.toThrow();
  });
});
