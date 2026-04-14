/**
 * ABAC Policy Tests — Casbin Engine
 *
 * Zero mocking. Zero infrastructure. Loads the REAL policy.csv and model.conf
 * from the repository and exercises the Casbin engine directly.
 *
 * If someone edits policy.csv incorrectly these tests will catch it before
 * anything ships.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CasbinAuthorizationEngine } from '../../src/services/casbin-engine.service.js';
import type { AuthorizationContext } from '../../src/types/authorization.types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function ctx(
  role: string,
  userId: string,
  resourceType: string,
  action: string,
  resourceAttrs: Record<string, unknown> = {}
): AuthorizationContext {
  return {
    user: {
      id: userId,
      role,
      email: `${role}@test.example`,
      teamIds: [],
      departmentIds: [],
      ...resourceAttrs.userExtra as any,
    },
    resource: {
      type: resourceType,
      id: 'new',
      ...resourceAttrs,
    },
    action,
    context: {
      timestamp: new Date(),
      requestId: `test-${Math.random().toString(36).slice(2)}`,
    },
  };
}

// ─── fixture ────────────────────────────────────────────────────────────────

let engine: CasbinAuthorizationEngine;

beforeAll(async () => {
  engine = new CasbinAuthorizationEngine();
  await engine.initialize();
}, 15_000);

// ─── helpers ────────────────────────────────────────────────────────────────

async function allowed(
  role: string,
  resource: string,
  action: string,
  attrs: Record<string, unknown> = {}
): Promise<boolean> {
  const decision = await engine.enforce(ctx(role, `${role}-uid`, resource, action, attrs));
  return decision.allowed;
}

// ─── ADMIN ─────────────────────────────────────────────────────────────────

describe('admin role', () => {
  const resources = [
    'order', 'vendor', 'document', 'qc_review', 'qc_queue', 'revision',
    'escalation', 'analytics', 'user', 'engagement', 'appraiser',
    'inspection', 'client', 'negotiation', 'esignature',
  ];
  const actions = ['read', 'create', 'update', 'delete', 'execute', 'approve', 'reject'];

  for (const resource of resources) {
    for (const action of actions) {
      it(`ALLOW admin → ${resource} → ${action}`, async () => {
        expect(await allowed('admin', resource, action)).toBe(true);
      });
    }
  }
});

// ─── MANAGER ───────────────────────────────────────────────────────────────

describe('manager role', () => {
  it('ALLOW manager → order → read',   async () => expect(await allowed('manager', 'order', 'read')).toBe(true));
  it('ALLOW manager → order → create', async () => expect(await allowed('manager', 'order', 'create')).toBe(true));
  it('ALLOW manager → order → update', async () => expect(await allowed('manager', 'order', 'update')).toBe(true));
  it('DENY  manager → order → delete', async () => expect(await allowed('manager', 'order', 'delete')).toBe(false));

  it('ALLOW manager → vendor → read',   async () => expect(await allowed('manager', 'vendor', 'read')).toBe(true));
  it('ALLOW manager → vendor → update', async () => expect(await allowed('manager', 'vendor', 'update')).toBe(true));
  it('DENY  manager → vendor → create', async () => expect(await allowed('manager', 'vendor', 'create')).toBe(false));
  it('DENY  manager → vendor → delete', async () => expect(await allowed('manager', 'vendor', 'delete')).toBe(false));

  it('ALLOW manager → analytics → read',   async () => expect(await allowed('manager', 'analytics', 'read')).toBe(true));
  it('DENY  manager → analytics → create', async () => expect(await allowed('manager', 'analytics', 'create')).toBe(false));

  it('ALLOW manager → qc_review → read',   async () => expect(await allowed('manager', 'qc_review', 'read')).toBe(true));
  it('DENY  manager → qc_review → create', async () => expect(await allowed('manager', 'qc_review', 'create')).toBe(false));

  it('ALLOW manager → document → read',   async () => expect(await allowed('manager', 'document', 'read')).toBe(true));
  it('ALLOW manager → document → create', async () => expect(await allowed('manager', 'document', 'create')).toBe(true));
  it('ALLOW manager → document → update', async () => expect(await allowed('manager', 'document', 'update')).toBe(true));
  it('DENY  manager → document → delete', async () => expect(await allowed('manager', 'document', 'delete')).toBe(false));

  it('ALLOW manager → engagement → read',    async () => expect(await allowed('manager', 'engagement', 'read')).toBe(true));
  it('ALLOW manager → engagement → execute', async () => expect(await allowed('manager', 'engagement', 'execute')).toBe(true));
  it('DENY  manager → engagement → delete',  async () => expect(await allowed('manager', 'engagement', 'delete')).toBe(false));

  it('ALLOW manager → appraiser → read',   async () => expect(await allowed('manager', 'appraiser', 'read')).toBe(true));
  it('ALLOW manager → appraiser → create', async () => expect(await allowed('manager', 'appraiser', 'create')).toBe(true));
  it('ALLOW manager → appraiser → delete', async () => expect(await allowed('manager', 'appraiser', 'delete')).toBe(true));

  it('ALLOW manager → inspection → read',   async () => expect(await allowed('manager', 'inspection', 'read')).toBe(true));
  it('ALLOW manager → inspection → create', async () => expect(await allowed('manager', 'inspection', 'create')).toBe(true));
  it('DENY  manager → inspection → execute',async () => expect(await allowed('manager', 'inspection', 'execute')).toBe(false));

  it('ALLOW manager → client → read',   async () => expect(await allowed('manager', 'client', 'read')).toBe(true));
  it('ALLOW manager → client → delete', async () => expect(await allowed('manager', 'client', 'delete')).toBe(true));

  it('ALLOW manager → negotiation → read',    async () => expect(await allowed('manager', 'negotiation', 'read')).toBe(true));
  it('ALLOW manager → negotiation → execute', async () => expect(await allowed('manager', 'negotiation', 'execute')).toBe(true));
  it('DENY  manager → negotiation → delete',  async () => expect(await allowed('manager', 'negotiation', 'delete')).toBe(false));

  it('ALLOW manager → esignature → read',   async () => expect(await allowed('manager', 'esignature', 'read')).toBe(true));
  it('ALLOW manager → esignature → delete', async () => expect(await allowed('manager', 'esignature', 'delete')).toBe(true));
});

// ─── QC ANALYST ────────────────────────────────────────────────────────────

describe('qc_analyst role', () => {
  it('ALLOW qc_analyst → order → read',   async () => expect(await allowed('qc_analyst', 'order', 'read')).toBe(true));
  it('DENY  qc_analyst → order → create', async () => expect(await allowed('qc_analyst', 'order', 'create')).toBe(false));
  it('DENY  qc_analyst → order → delete', async () => expect(await allowed('qc_analyst', 'order', 'delete')).toBe(false));

  it('ALLOW qc_analyst → qc_review → read',    async () => expect(await allowed('qc_analyst', 'qc_review', 'read')).toBe(true));
  it('ALLOW qc_analyst → qc_review → create',  async () => expect(await allowed('qc_analyst', 'qc_review', 'create')).toBe(true));
  it('ALLOW qc_analyst → qc_review → update',  async () => expect(await allowed('qc_analyst', 'qc_review', 'update')).toBe(true));
  it('ALLOW qc_analyst → qc_review → execute', async () => expect(await allowed('qc_analyst', 'qc_review', 'execute')).toBe(true));
  it('ALLOW qc_analyst → qc_review → approve', async () => expect(await allowed('qc_analyst', 'qc_review', 'approve')).toBe(true));
  it('ALLOW qc_analyst → qc_review → reject',  async () => expect(await allowed('qc_analyst', 'qc_review', 'reject')).toBe(true));
  it('DENY  qc_analyst → qc_review → delete',  async () => expect(await allowed('qc_analyst', 'qc_review', 'delete')).toBe(false));

  it('ALLOW qc_analyst → qc_queue → read',   async () => expect(await allowed('qc_analyst', 'qc_queue', 'read')).toBe(true));
  it('DENY  qc_analyst → qc_queue → create', async () => expect(await allowed('qc_analyst', 'qc_queue', 'create')).toBe(false));

  it('ALLOW qc_analyst → document → read',   async () => expect(await allowed('qc_analyst', 'document', 'read')).toBe(true));
  it('ALLOW qc_analyst → document → create', async () => expect(await allowed('qc_analyst', 'document', 'create')).toBe(true));
  it('DENY  qc_analyst → document → delete', async () => expect(await allowed('qc_analyst', 'document', 'delete')).toBe(false));

  it('DENY  qc_analyst → vendor → create', async () => expect(await allowed('qc_analyst', 'vendor', 'create')).toBe(false));
  it('DENY  qc_analyst → vendor → delete', async () => expect(await allowed('qc_analyst', 'vendor', 'delete')).toBe(false));

  it('ALLOW qc_analyst → engagement → read',   async () => expect(await allowed('qc_analyst', 'engagement', 'read')).toBe(true));
  it('DENY  qc_analyst → engagement → create', async () => expect(await allowed('qc_analyst', 'engagement', 'create')).toBe(false));

  it('ALLOW qc_analyst → appraiser → read',   async () => expect(await allowed('qc_analyst', 'appraiser', 'read')).toBe(true));
  it('DENY  qc_analyst → appraiser → create', async () => expect(await allowed('qc_analyst', 'appraiser', 'create')).toBe(false));

  it('ALLOW qc_analyst → inspection → read',   async () => expect(await allowed('qc_analyst', 'inspection', 'read')).toBe(true));
  it('DENY  qc_analyst → inspection → create', async () => expect(await allowed('qc_analyst', 'inspection', 'create')).toBe(false));

  it('ALLOW qc_analyst → client → read',   async () => expect(await allowed('qc_analyst', 'client', 'read')).toBe(true));
  it('DENY  qc_analyst → client → create', async () => expect(await allowed('qc_analyst', 'client', 'create')).toBe(false));

  it('ALLOW qc_analyst → negotiation → read',   async () => expect(await allowed('qc_analyst', 'negotiation', 'read')).toBe(true));
  it('DENY  qc_analyst → negotiation → create', async () => expect(await allowed('qc_analyst', 'negotiation', 'create')).toBe(false));

  it('ALLOW qc_analyst → esignature → read',   async () => expect(await allowed('qc_analyst', 'esignature', 'read')).toBe(true));
  it('DENY  qc_analyst → esignature → create', async () => expect(await allowed('qc_analyst', 'esignature', 'create')).toBe(false));

  it('DENY  qc_analyst → analytics → create', async () => expect(await allowed('qc_analyst', 'analytics', 'create')).toBe(false));
  it('DENY  qc_analyst → user → create',      async () => expect(await allowed('qc_analyst', 'user', 'create')).toBe(false));
});

// ─── APPRAISER ─────────────────────────────────────────────────────────────

describe('appraiser role', () => {
  it('ALLOW appraiser → order → read',   async () => expect(await allowed('appraiser', 'order', 'read')).toBe(true));
  it('ALLOW appraiser → order → update', async () => expect(await allowed('appraiser', 'order', 'update')).toBe(true));
  it('DENY  appraiser → order → create', async () => expect(await allowed('appraiser', 'order', 'create')).toBe(false));
  it('DENY  appraiser → order → delete', async () => expect(await allowed('appraiser', 'order', 'delete')).toBe(false));

  // Appraisers have NO vendor access at all
  it('DENY appraiser → vendor → read',   async () => expect(await allowed('appraiser', 'vendor', 'read')).toBe(false));
  it('DENY appraiser → vendor → create', async () => expect(await allowed('appraiser', 'vendor', 'create')).toBe(false));

  // Appraisers have NO analytics, user, or qc_queue access
  it('DENY appraiser → analytics → read', async () => expect(await allowed('appraiser', 'analytics', 'read')).toBe(false));
  it('DENY appraiser → user → read',      async () => expect(await allowed('appraiser', 'user', 'read')).toBe(false));
  it('DENY appraiser → qc_queue → read',  async () => expect(await allowed('appraiser', 'qc_queue', 'read')).toBe(false));

  it('ALLOW appraiser → document → read',   async () => expect(await allowed('appraiser', 'document', 'read')).toBe(true));
  it('ALLOW appraiser → document → create', async () => expect(await allowed('appraiser', 'document', 'create')).toBe(true));
  it('DENY  appraiser → document → delete', async () => expect(await allowed('appraiser', 'document', 'delete')).toBe(false));
  it('DENY  appraiser → document → update', async () => expect(await allowed('appraiser', 'document', 'update')).toBe(false));

  it('ALLOW appraiser → engagement → read',   async () => expect(await allowed('appraiser', 'engagement', 'read')).toBe(true));
  it('DENY  appraiser → engagement → create', async () => expect(await allowed('appraiser', 'engagement', 'create')).toBe(false));
  it('DENY  appraiser → engagement → delete', async () => expect(await allowed('appraiser', 'engagement', 'delete')).toBe(false));

  it('ALLOW appraiser → appraiser → read',   async () => expect(await allowed('appraiser', 'appraiser', 'read')).toBe(true));
  it('DENY  appraiser → appraiser → create', async () => expect(await allowed('appraiser', 'appraiser', 'create')).toBe(false));

  it('ALLOW appraiser → inspection → read',   async () => expect(await allowed('appraiser', 'inspection', 'read')).toBe(true));
  it('ALLOW appraiser → inspection → update', async () => expect(await allowed('appraiser', 'inspection', 'update')).toBe(true));
  it('DENY  appraiser → inspection → create', async () => expect(await allowed('appraiser', 'inspection', 'create')).toBe(false));
  it('DENY  appraiser → inspection → delete', async () => expect(await allowed('appraiser', 'inspection', 'delete')).toBe(false));

  it('ALLOW appraiser → client → read',   async () => expect(await allowed('appraiser', 'client', 'read')).toBe(true));
  it('DENY  appraiser → client → create', async () => expect(await allowed('appraiser', 'client', 'create')).toBe(false));
  it('DENY  appraiser → client → delete', async () => expect(await allowed('appraiser', 'client', 'delete')).toBe(false));

  it('ALLOW appraiser → negotiation → read',   async () => expect(await allowed('appraiser', 'negotiation', 'read')).toBe(true));
  it('ALLOW appraiser → negotiation → create', async () => expect(await allowed('appraiser', 'negotiation', 'create')).toBe(true));
  it('ALLOW appraiser → negotiation → update', async () => expect(await allowed('appraiser', 'negotiation', 'update')).toBe(true));
  it('DENY  appraiser → negotiation → delete', async () => expect(await allowed('appraiser', 'negotiation', 'delete')).toBe(false));
  it('DENY  appraiser → negotiation → execute',async () => expect(await allowed('appraiser', 'negotiation', 'execute')).toBe(false));

  it('ALLOW appraiser → esignature → read',   async () => expect(await allowed('appraiser', 'esignature', 'read')).toBe(true));
  it('ALLOW appraiser → esignature → create', async () => expect(await allowed('appraiser', 'esignature', 'create')).toBe(true));
  it('DENY  appraiser → esignature → delete', async () => expect(await allowed('appraiser', 'esignature', 'delete')).toBe(false));
  it('DENY  appraiser → esignature → update', async () => expect(await allowed('appraiser', 'esignature', 'update')).toBe(false));
});

// ─── PRIVILEGE ESCALATION guards ───────────────────────────────────────────

describe('privilege escalation guards', () => {
  const privilegedActions = ['delete', 'approve', 'reject', 'execute'];
  const privilegedResources = ['user', 'analytics'];

  for (const role of ['appraiser', 'qc_analyst']) {
    for (const resource of privilegedResources) {
      for (const action of privilegedActions) {
        it(`DENY ${role} → ${resource} → ${action}`, async () => {
          expect(await allowed(role, resource, action)).toBe(false);
        });
      }
    }
  }
});

// ─── UNKNOWN ROLE ──────────────────────────────────────────────────────────

describe('unknown / typo role', () => {
  it('DENY unknown_role → order → read', async () => {
    expect(await allowed('unknown_role', 'order', 'read')).toBe(false);
  });
  it('DENY Admin (capital A) → order → read — must be lowercase', async () => {
    // Role mapping normalises to lowercase; raw 'Admin' won't match 'admin:.*' patterns
    expect(await allowed('Admin', 'order', 'read')).toBe(false);
  });
  it('DENY empty string role → any → any', async () => {
    expect(await allowed('', 'order', 'read')).toBe(false);
  });
});
