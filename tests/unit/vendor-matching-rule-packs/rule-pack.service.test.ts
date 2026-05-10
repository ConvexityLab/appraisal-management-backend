/**
 * Unit tests for VendorMatchingRulePackService — AMS-side storage for
 * per-tenant rule packs (Phase 3 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.4).
 *
 * Phase 3 design (Option E):
 *   - AMS owns storage; MOP caches compiled reasoners.
 *   - Immutable + versioned: writes create a new version, never mutate.
 *   - Append-only audit log on every CRUD.
 *   - Service emits a new-version event the orchestrator/proxy will use to
 *     push to MOP.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VendorMatchingRulePackService } from '../../../src/services/vendor-matching-rule-pack.service.js';
import type {
  RulePackDocument,
  VendorMatchingRuleDef,
} from '../../../src/types/vendor-matching-rule-pack.types.js';

// ── In-memory CosmosDb mock — enough surface for the service ─────────────────

class FakeContainer {
  store = new Map<string, any>();

  async create(item: any) {
    if (this.store.has(item.id)) {
      const e: any = new Error('Conflict');
      e.code = 409;
      throw e;
    }
    this.store.set(item.id, item);
    return item;
  }
  async upsert(item: any) {
    this.store.set(item.id, item);
    return item;
  }
  async get(id: string) {
    return this.store.get(id) ?? null;
  }
  async query(predicate: (doc: any) => boolean) {
    return [...this.store.values()].filter(predicate);
  }
}

function makeFakeDb() {
  const containers: Record<string, FakeContainer> = {
    'decision-rule-packs': new FakeContainer(),
    'decision-rule-audit': new FakeContainer(),
  };
  return {
    _containers: containers,
    createDocument: vi.fn(async (cn: string, doc: any) =>
      containers[cn]!.create(doc),
    ),
    upsertDocument: vi.fn(async (cn: string, doc: any) =>
      containers[cn]!.upsert(doc),
    ),
    getItem: vi.fn(async <T>(cn: string, id: string) => {
      const v = await containers[cn]!.get(id);
      return v ? ({ success: true, data: v as T } as any) : ({ success: false } as any);
    }),
    /**
     * Mock for CosmosDbService.queryDocuments. Parses the few SQL fragments
     * the service produces. Naive — only supports the WHERE shapes the rule-
     * pack service uses, but that's exactly what we want to test.
     */
    queryDocuments: vi.fn(async <T>(cn: string, _query: string, parameters: { name: string; value: any }[]) => {
      const params: Record<string, any> = {};
      for (const p of parameters) params[p.name] = p.value;
      const tenantId = params['@tenantId'];
      const category = params['@category'];
      const packId = params['@packId'];
      const docs = await containers[cn]!.query(d =>
        d.tenantId === tenantId
        && d.packId === packId
        && (category === undefined || d.category === category)
      );
      // Mirror the service's ORDER BY clauses.
      if (cn === 'decision-rule-packs') {
        docs.sort((a: any, b: any) => b.version - a.version);
      } else if (cn === 'decision-rule-audit') {
        docs.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      }
      return docs as T[];
    }),
  };
}

function makeRule(name: string): VendorMatchingRuleDef {
  return {
    name,
    pattern_id: 'vendor_evaluation',
    salience: 100,
    conditions: { '==': [{ var: 'vendor_id' }, name] },
    actions: [
      {
        type: 'assert',
        fact_id: 'vendor_score_adjustment',
        source: name,
        data: { rule_id: name, points: 5, reason: 'test' },
      },
    ],
  };
}

const TENANT = 't-acme';
const PACK = 'default';

let db: ReturnType<typeof makeFakeDb>;
let service: VendorMatchingRulePackService;

beforeEach(() => {
  db = makeFakeDb();
  service = new VendorMatchingRulePackService(db as any);
});

describe('VendorMatchingRulePackService — versioning', () => {
  it('first create returns version 1, parentVersion null, status=active', async () => {
    const pack = await service.createVersion({
      tenantId: TENANT,
      packId: PACK,
      rules: [makeRule('R1')],
      createdBy: 'alice',
    });

    expect(pack.version).toBe(1);
    expect(pack.parentVersion).toBeNull();
    expect(pack.status).toBe('active');
    expect(pack.id).toBe(`${TENANT}__vendor-matching__${PACK}__v1`);
    expect(pack.tenantId).toBe(TENANT);
    expect(pack.rules).toHaveLength(1);
  });

  it('second create returns version 2 with parentVersion=1; v1 transitions to inactive', async () => {
    const v1 = await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1')],
      createdBy: 'alice',
    });
    const v2 = await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1'), makeRule('R2')],
      createdBy: 'bob',
    });

    expect(v2.version).toBe(2);
    expect(v2.parentVersion).toBe(1);
    expect(v2.status).toBe('active');

    // v1 was demoted, not deleted.
    const v1After = await service.getVersion(TENANT, PACK, 1);
    expect(v1After).not.toBeNull();
    expect(v1After!.status).toBe('inactive');
    expect(v1.version).toBe(1);  // original return value unchanged
  });

  it('listVersions returns all versions for a (tenantId, packId), newest first', async () => {
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [makeRule('R1')], createdBy: 'a' });
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [makeRule('R2')], createdBy: 'a' });
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [makeRule('R3')], createdBy: 'a' });

    const versions = await service.listVersions(TENANT, PACK);
    expect(versions.map(v => v.version)).toEqual([3, 2, 1]);
  });

  it('getActive returns the highest-numbered active version', async () => {
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [makeRule('R1')], createdBy: 'a' });
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [makeRule('R2')], createdBy: 'a' });

    const active = await service.getActive(TENANT, PACK);
    expect(active).not.toBeNull();
    expect(active!.version).toBe(2);
    expect(active!.status).toBe('active');
  });

  it('getActive returns null when no pack exists for the tenant', async () => {
    const active = await service.getActive(TENANT, PACK);
    expect(active).toBeNull();
  });

  it('isolates packs per tenant', async () => {
    await service.createVersion({ tenantId: 'tA', packId: PACK, rules: [makeRule('R1')], createdBy: 'a' });
    await service.createVersion({ tenantId: 'tB', packId: PACK, rules: [makeRule('R2')], createdBy: 'a' });

    const a = await service.getActive('tA', PACK);
    const b = await service.getActive('tB', PACK);
    expect(a!.rules[0]!.name).toBe('R1');
    expect(b!.rules[0]!.name).toBe('R2');
  });

  it('isolates packs per packId within a tenant', async () => {
    await service.createVersion({ tenantId: TENANT, packId: 'default',  rules: [makeRule('D1')], createdBy: 'a' });
    await service.createVersion({ tenantId: TENANT, packId: 'va-loans', rules: [makeRule('V1')], createdBy: 'a' });

    const def = await service.getActive(TENANT, 'default');
    const va  = await service.getActive(TENANT, 'va-loans');
    expect(def!.rules[0]!.name).toBe('D1');
    expect(va!.rules[0]!.name).toBe('V1');
  });
});

describe('VendorMatchingRulePackService — rule validation', () => {
  it('rejects packs with duplicate rule names', async () => {
    await expect(service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('SameName'), makeRule('SameName')],
      createdBy: 'a',
    })).rejects.toThrow(/duplicate/i);
  });

  it('rejects empty rules array', async () => {
    await expect(service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [],
      createdBy: 'a',
    })).rejects.toThrow(/empty|at least one/i);
  });

  it('rejects rule with missing required field (name)', async () => {
    const bad = { ...makeRule('X'), name: '' } as any;
    await expect(service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [bad],
      createdBy: 'a',
    })).rejects.toThrow(/name/i);
  });
});

describe('VendorMatchingRulePackService — audit log', () => {
  it('writes an audit row on first create with action=create, fromVersion=null', async () => {
    await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1')],
      createdBy: 'alice',
      reason: 'initial seed',
    });

    const audit = await service.listAudit(TENANT, PACK);
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('create');
    expect(audit[0]!.fromVersion).toBeNull();
    expect(audit[0]!.toVersion).toBe(1);
    expect(audit[0]!.actor).toBe('alice');
    expect(audit[0]!.reason).toBe('initial seed');
  });

  it('writes an audit row on update with action=update + a diff against parent', async () => {
    await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1'), makeRule('R2')],
      createdBy: 'alice',
    });
    await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1'), makeRule('R3')],   // R2 removed, R3 added
      createdBy: 'bob',
    });

    const audit = await service.listAudit(TENANT, PACK);
    expect(audit).toHaveLength(2);

    const update = audit.find(a => a.toVersion === 2)!;
    expect(update.action).toBe('update');
    expect(update.fromVersion).toBe(1);
    expect(update.diff).toEqual({
      added: ['R3'],
      removed: ['R2'],
      modified: [],
    });
  });

  it('detects modified rules in the diff (same name, different conditions)', async () => {
    const r1v1 = makeRule('R1');
    const r1v2 = { ...makeRule('R1'), salience: 999 };
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [r1v1], createdBy: 'a' });
    await service.createVersion({ tenantId: TENANT, packId: PACK, rules: [r1v2], createdBy: 'a' });

    const audit = await service.listAudit(TENANT, PACK);
    const update = audit.find(a => a.toVersion === 2)!;
    expect(update.diff).toEqual({
      added: [],
      removed: [],
      modified: ['R1'],
    });
  });
});

describe('VendorMatchingRulePackService — onNewActivePack hook', () => {
  it('invokes the hook with the new pack on every successful create', async () => {
    const hook = vi.fn(async () => {});
    service.onNewActivePack(hook);

    const v1 = await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1')],
      createdBy: 'alice',
    });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(v1);
  });

  it('hook failure does NOT roll back the create (push is best-effort; AMS storage is the source of truth)', async () => {
    service.onNewActivePack(async () => { throw new Error('MOP unreachable'); });

    const pack = await service.createVersion({
      tenantId: TENANT, packId: PACK,
      rules: [makeRule('R1')],
      createdBy: 'alice',
    });

    expect(pack.version).toBe(1);
    const stored = await service.getActive(TENANT, PACK);
    expect(stored).not.toBeNull();
    expect(stored!.version).toBe(1);
  });
});
