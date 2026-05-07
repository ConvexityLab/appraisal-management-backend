/**
 * Parity tests: PolicyEvaluatorService vs CasbinAuthorizationEngine
 *
 * Verifies that `PolicyEvaluatorService.buildQueryFilter()` driven by the
 * default seed rules (`buildDefaultPolicies`) produces functionally equivalent
 * Cosmos SQL fragments to the original `CasbinAuthorizationEngine.buildQueryFilter()`.
 *
 * "Functionally equivalent" means:
 *   - Both return `{sql:'1=1'}` for unconditional allow.
 *   - Both return `{sql:'1=0'}` for deny-all cases.
 *   - Both include the same field paths and parameter values (parameter *names*
 *     may differ between the two implementations).
 *
 * KNOWN INTENTIONAL DIVERGENCES (documented, not tested):
 *   1. `accessScope.canViewAllOrders` / `canViewAllVendors` were pre-role
 *      checks in Casbin; they are not modelled in the seed rules.
 *   2. Casbin checked `role === 'qc_analyst'`; the Role union uses `'analyst'`.
 *   3. Casbin whitespace in multi-line SQL strings is not preserved by the
 *      evaluator — comparison is semantic, not textual.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CasbinAuthorizationEngine } from '../../src/services/casbin-engine.service';
import { PolicyEvaluatorService } from '../../src/services/policy-evaluator.service';
import { buildDefaultPolicies, filterRules } from '../../src/data/default-policy-rules';
import type { UserProfile, QueryFilter, AccessScope } from '../../src/types/authorization.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'parity-test-tenant';
const ALL_RULES = buildDefaultPolicies(TENANT);

/** Build a minimal UserProfile for a given role + accessScope. */
function makeProfile(
  role: UserProfile['role'],
  accessScope: Partial<AccessScope> = {},
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: 'user-parity-1',
    email: 'parity@test.local',
    name: 'Parity User',
    tenantId: TENANT,
    role,
    portalDomain: 'platform',
    boundEntityIds: [],
    isInternal: false,
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
      ...accessScope,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Build a mock CosmosDbService that feeds seed rules for any query. */
function makeMockDb() {
  const mockContainer = {
    items: {
      query: (query: { query: string; parameters: Array<{ name: string; value: any }> }) => ({
        fetchAll: async () => {
          const params = query.parameters;
          const role = params.find(p => p.name === '@role')?.value as string;
          const resourceType = params.find(p => p.name === '@resourceType')?.value as string;
          return { resources: filterRules(ALL_RULES, role, resourceType) };
        },
      }),
    },
  };

  return {
    getContainer: vi.fn(() => mockContainer),
  } as any;
}

// ─── Helper: run both engines, return pair ────────────────────────────────────

async function runBoth(
  profile: UserProfile,
  resourceType: string,
  action: string = 'read',
): Promise<{ casbin: QueryFilter; evaluator: QueryFilter }> {
  const casbinEngine = new CasbinAuthorizationEngine();
  const casbinResult = await casbinEngine.buildQueryFilter(
    profile.id,
    profile.role,
    profile.accessScope,
    resourceType,
    action,
  );

  const evaluator = new PolicyEvaluatorService(makeMockDb());
  const evaluatorResult = await evaluator.buildQueryFilter(
    profile.id,
    profile,
    resourceType,
    action,
  );

  return { casbin: casbinResult, evaluator: evaluatorResult };
}

/** Assert that a QueryFilter contains the given parameter value somewhere. */
function hasParamValue(filter: QueryFilter, value: any): boolean {
  return filter.parameters.some(p =>
    JSON.stringify(p.value) === JSON.stringify(value),
  );
}

/** Normalise SQL for comparison (collapse whitespace). */
function normSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEvaluatorService parity with CasbinAuthorizationEngine', () => {
  // ── Admin ──────────────────────────────────────────────────────────────────

  describe('admin', () => {
    it('order → both return 1=1', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('admin'), 'order');
      expect(casbin.sql).toBe('1=1');
      expect(evaluator.sql).toBe('1=1');
    });

    it('vendor → both return 1=1', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('admin'), 'vendor');
      expect(casbin.sql).toBe('1=1');
      expect(evaluator.sql).toBe('1=1');
    });

    it('qc_review → both return 1=1', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('admin'), 'qc_review');
      expect(casbin.sql).toBe('1=1');
      expect(evaluator.sql).toBe('1=1');
    });

    it('policy (new resource) → evaluator returns 1=1 (admin rule seeded)', async () => {
      const evaluator = new PolicyEvaluatorService(makeMockDb());
      const result = await evaluator.buildQueryFilter('user-1', makeProfile('admin'), 'policy', 'read');
      expect(result.sql).toBe('1=1');
    });
  });

  // ── Manager: order ─────────────────────────────────────────────────────────

  describe('manager + order', () => {
    it('empty accessScope → both return 1=0', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('manager'), 'order');
      expect(normSql(casbin.sql)).toBe('1=0');
      expect(normSql(evaluator.sql)).toBe('1=0');
    });

    it('teamIds only → both filter by teamId', async () => {
      const profile = makeProfile('manager', { teamIds: ['team-a'] });
      const { casbin, evaluator } = await runBoth(profile, 'order');

      // Both non-deny
      expect(casbin.sql).not.toBe('1=0');
      expect(evaluator.sql).not.toBe('1=0');

      // Both include the team-a value in parameters
      expect(hasParamValue(casbin, ['team-a'])).toBe(true);
      expect(hasParamValue(evaluator, ['team-a'])).toBe(true);

      // Both reference the teamId field
      expect(casbin.sql).toContain('accessControl.teamId');
      expect(evaluator.sql).toContain('accessControl.teamId');
    });

    it('managedClientIds only → both filter by clientId', async () => {
      const profile = makeProfile('manager', { managedClientIds: ['client-1'] });
      const { casbin, evaluator } = await runBoth(profile, 'order');

      expect(casbin.sql).not.toBe('1=0');
      expect(evaluator.sql).not.toBe('1=0');
      expect(hasParamValue(casbin, ['client-1'])).toBe(true);
      expect(hasParamValue(evaluator, ['client-1'])).toBe(true);
      expect(casbin.sql).toContain('accessControl.clientId');
      expect(evaluator.sql).toContain('accessControl.clientId');
    });

    it('departmentIds only → both filter by departmentId', async () => {
      const profile = makeProfile('manager', { departmentIds: ['dept-1'] });
      const { casbin, evaluator } = await runBoth(profile, 'order');

      expect(hasParamValue(casbin, ['dept-1'])).toBe(true);
      expect(hasParamValue(evaluator, ['dept-1'])).toBe(true);
      expect(casbin.sql).toContain('accessControl.departmentId');
      expect(evaluator.sql).toContain('accessControl.departmentId');
    });

    it('all three arrays filled → both produce OR filter covering all three conditions', async () => {
      const profile = makeProfile('manager', {
        teamIds: ['t1'],
        managedClientIds: ['c1'],
        departmentIds: ['d1'],
      });
      const { casbin, evaluator } = await runBoth(profile, 'order');

      // Both must contain all three field paths
      for (const sql of [casbin.sql, evaluator.sql]) {
        expect(sql).toContain('accessControl.teamId');
        expect(sql).toContain('accessControl.clientId');
        expect(sql).toContain('accessControl.departmentId');
      }

      // Both must include all three values
      for (const filter of [casbin, evaluator]) {
        expect(hasParamValue(filter, ['t1'])).toBe(true);
        expect(hasParamValue(filter, ['c1'])).toBe(true);
        expect(hasParamValue(filter, ['d1'])).toBe(true);
      }
    });
  });

  // ── Manager: vendor ─────────────────────────────────────────────────────────

  describe('manager + vendor', () => {
    it('empty managedVendorIds → both return 1=0', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('manager'), 'vendor');
      expect(normSql(casbin.sql)).toBe('1=0');
      expect(normSql(evaluator.sql)).toBe('1=0');
    });

    it('managedVendorIds filled → both filter vendor id', async () => {
      const profile = makeProfile('manager', { managedVendorIds: ['vendor-99'] });
      const { casbin, evaluator } = await runBoth(profile, 'vendor');

      expect(casbin.sql).not.toBe('1=0');
      expect(evaluator.sql).not.toBe('1=0');

      // Casbin checks `c.id IN (@vendorIds)` so the field path is just `id`
      expect(casbin.sql).toContain('IN');
      expect(evaluator.sql).toContain('IN');

      expect(hasParamValue(casbin, ['vendor-99'])).toBe(true);
      expect(hasParamValue(evaluator, ['vendor-99'])).toBe(true);
    });
  });

  // ── Manager: qc_review ─────────────────────────────────────────────────────

  describe('manager + qc_review', () => {
    it('teamIds filled → both filter by teamId', async () => {
      const profile = makeProfile('manager', { teamIds: ['team-qc'] });
      const { casbin, evaluator } = await runBoth(profile, 'qc_review');

      expect(casbin.sql).toContain('accessControl.teamId');
      expect(evaluator.sql).toContain('accessControl.teamId');
      expect(hasParamValue(casbin, ['team-qc'])).toBe(true);
      expect(hasParamValue(evaluator, ['team-qc'])).toBe(true);
    });
  });

  // ── Analyst (was qc_analyst) ────────────────────────────────────────────────

  describe('analyst', () => {
    const ASSIGNED_RESOURCES = ['order', 'qc_review', 'revision', 'escalation'] as const;

    for (const rt of ASSIGNED_RESOURCES) {
      it(`${rt} → both filter by ARRAY_CONTAINS(assignedUserIds)`, async () => {
        const profile = makeProfile('analyst');
        const { casbin, evaluator } = await runBoth(profile, rt);

        // Casbin checks role === 'qc_analyst' which is NOT in the Role union.
        // The casbin engine will fall to the default deny because none of its
        // role checks match 'analyst'.  We assert evaluator gives the correct
        // result (assigned-user filter) and document the Casbin divergence.
        expect(evaluator.sql).toContain('ARRAY_CONTAINS');
        expect(evaluator.sql).toContain('assignedUserIds');
        expect(hasParamValue(evaluator, profile.id)).toBe(true);

        // Casbin: 'analyst' is not handled → falls to deny-all
        // This IS the intentional divergence — seed data fixes the type mismatch.
        expect(normSql(casbin.sql)).toBe('1=0'); // documents the Casbin bug
      });
    }

    it('qc_queue → evaluator returns 1=1 (always readable)', async () => {
      const profile = makeProfile('analyst');
      const { evaluator } = await runBoth(profile, 'qc_queue');
      expect(normSql(evaluator.sql)).toBe('1=1');
    });

    it('qc_queue → Casbin also returns 1=1 (qc_analyst check)', async () => {
      // Casbin's 'qc_analyst' check obviously won't match 'analyst' either,
      // but for qc_queue the code falls to default deny. Document it.
      const casbinEngine = new CasbinAuthorizationEngine();
      const result = await casbinEngine.buildQueryFilter('u1', 'qc_analyst', { teamIds: [] }, 'qc_queue', 'read');
      expect(normSql(result.sql)).toBe('1=1');
    });
  });

  // ── Appraiser ───────────────────────────────────────────────────────────────

  describe('appraiser', () => {
    const APPRAISER_RESOURCES = ['order', 'revision', 'qc_review', 'escalation'] as const;

    for (const rt of APPRAISER_RESOURCES) {
      it(`${rt} → both return ownerId OR assignedUserIds filter`, async () => {
        const profile = makeProfile('appraiser');
        const { casbin, evaluator } = await runBoth(profile, rt);

        // Both: non-deny
        expect(normSql(casbin.sql)).not.toBe('1=0');
        expect(normSql(evaluator.sql)).not.toBe('1=0');

        // Both: contain the field paths
        for (const filter of [casbin, evaluator]) {
          expect(filter.sql).toContain('accessControl.ownerId');
          expect(filter.sql).toContain('assignedUserIds');
          expect(hasParamValue(filter, profile.id)).toBe(true);
        }
      });
    }

    it('appraiser + analytics (unsupported resource) → both return 1=0', async () => {
      const { casbin, evaluator } = await runBoth(makeProfile('appraiser'), 'analytics');
      expect(normSql(casbin.sql)).toBe('1=0');
      expect(normSql(evaluator.sql)).toBe('1=0');
    });
  });

  // ── Unknown / unsupported roles ─────────────────────────────────────────────

  describe('unrecognised roles', () => {
    it('supervisor + order (no seed rules) → evaluator returns 1=0', async () => {
      const evaluator = new PolicyEvaluatorService(makeMockDb());
      const result = await evaluator.buildQueryFilter(
        'u1',
        makeProfile('supervisor' as any),
        'order',
        'read',
      );
      expect(normSql(result.sql)).toBe('1=0');
    });

    it('reviewer + order (no seed rules) → evaluator returns 1=0', async () => {
      const evaluator = new PolicyEvaluatorService(makeMockDb());
      const result = await evaluator.buildQueryFilter(
        'u1',
        makeProfile('reviewer'),
        'order',
        'read',
      );
      expect(normSql(result.sql)).toBe('1=0');
    });
  });

  // ── Action filtering ────────────────────────────────────────────────────────

  describe('action filtering', () => {
    it('admin + execute action → evaluator returns 1=1 (execute is in admin rule)', async () => {
      const evaluator = new PolicyEvaluatorService(makeMockDb());
      const result = await evaluator.buildQueryFilter('u1', makeProfile('admin'), 'order', 'execute');
      expect(normSql(result.sql)).toBe('1=1');
    });

    it('analyst + delete action → evaluator returns 1=0 (delete not in analyst rules)', async () => {
      const evaluator = new PolicyEvaluatorService(makeMockDb());
      const result = await evaluator.buildQueryFilter('u1', makeProfile('analyst'), 'order', 'delete');
      expect(normSql(result.sql)).toBe('1=0');
    });
  });
});
