/**
 * Jest global test setup
 * Runs after the test framework is installed in each test file's environment.
 */

// Extend Jest's default timeout for async operations that hit external services
// (unit tests override this with their own shorter timeouts as needed)
// jest.setTimeout(30_000); // already set in jest.config.js via testTimeout
