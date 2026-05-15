/**
 * Tests for DecisionRulePackService — the generic, category-parameterized
 * rule-pack store introduced in Phase A of DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Covers the core invariants the surface depends on:
 *   - createVersion writes a v1 doc with the synthetic id including category
 *   - second create demotes the prior 'active' version + bumps version + writes
 *     a `update` audit row with a name-level diff
 *   - getActive / listVersions / listAudit are scoped by (category, tenant, packId)
 *   - validateRules rejects empty arrays + duplicate rule names + rules missing
 *     a `name`
 *   - hooks are dispatched per-category (vendor-matching hook only fires for
 *     vendor-matching writes, not for some-other-category writes)
 *   - hook failures are swallowed (storage write succeeds even when push fails)
 */

import { describe, expect, it, vi } from 'vitest';
import { DecisionRulePackService } from '../../src/services/decision-rule-pack.service.js';
import type {
  RulePackAuditEntry,
  RulePackDocument,
} from '../../src/types/decision-rule-pack.types.js';

type AnyDoc = RulePackDocument<unknown> | RulePackAuditEntry;

function makeFakeDb() {
  const containers: Record<string, AnyDoc[]> = {
    'decision-rule-packs': [],
    'decision-rule-audit': [],
  };

  return {
    containers,
    createDocument: vi.fn(async (cn: string, doc: AnyDoc) => {
      const list = containers[cn] ?? [];
      if (list.find(d => d.id === doc.id)) {
        const e: any = new Error('Conflict');
        e.code = 409;
        throw e;
      }
      list.push(doc);
      containers[cn] = list;
    }),
    upsertDocument: vi.fn(async (cn: string, doc: AnyDoc) => {
      const list = containers[cn] ?? [];
      const idx = list.findIndex(d => d.id === doc.id);
      if (idx >= 0) list[idx] = doc;
      else list.push(doc);
      containers[cn] = list;
    }),
    getItem: vi.fn(async <T>(cn: string, id: string, _pk: string) => {
      const found = containers[cn]?.find(d => d.id === id);
      return found
        ? { success: true, data: found as unknown as T }
        : { success: false, data: null };
    }),
    queryDocuments: vi.fn(async <T>(
      cn: string,
      query: string,
      params: { name: string; value: any }[],
    ) => {
      const p: Record<string, any> = {};
      for (const pa of params) p[pa.name] = pa.value;
      let docs = containers[cn] ?? [];

      if (cn === 'decision-rule-packs') {
        docs = docs.filter(d => {
          const r = d as RulePackDocument<unknown>;
          return r.type === 'decision-rule-pack'
            && r.tenantId === p['@tenantId']
            && r.category === p['@category']
            && r.packId === p['@packId'];
        });
        // ORDER BY version DESC
        docs = [...docs].sort((a, b) => {
          const av = (a as RulePackDocument<unknown>).version;
          const bv = (b as RulePackDocument<unknown>).version;
          return bv - av;
        });
      }
      if (cn === 'decision-rule-audit') {
        docs = docs.filter(d => {
          const r = d as RulePackAuditEntry;
          return r.type === 'decision-rule-audit'
            && r.tenantId === p['@tenantId']
            && r.category === p['@category']
            && r.packId === p['@packId'];
        });
        // ORDER BY timestamp DESC
        docs = [...docs].sort((a, b) => {
          const at = (a as RulePackAuditEntry).timestamp;
          const bt = (b as RulePackAuditEntry).timestamp;
          return bt.localeCompare(at);
        });
      }
      // suppress unused-var
      void query;
      return docs as T[];
    }),
  };
}

function rule(name: string, extra?: Record<string, unknown>) {
  return { name, salience: 100, pattern_id: 'p', conditions: {}, actions: [{ type: 'assert', fact_id: 'x', source: 'y', data: {} }], ...extra };
}

describe('DecisionRulePackService.createVersion', () => {
  it('writes a v1 document with the synthetic id including category', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);

    const pack = await svc.createVersion({
      category: 'vendor-matching',
      tenantId: 't1',
      packId: 'default',
      rules: [rule('rule-a')],
      createdBy: 'tester',
    });

    expect(pack.id).toBe('t1__vendor-matching__default__v1');
    expect(pack.type).toBe('decision-rule-pack');
    expect(pack.category).toBe('vendor-matching');
    expect(pack.version).toBe(1);
    expect(pack.parentVersion).toBeNull();
    expect(pack.status).toBe('active');
    expect(db.containers['decision-rule-packs']).toHaveLength(1);
  });

  it('writes a create audit row with no diff on v1', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await svc.createVersion({
      category: 'vendor-matching',
      tenantId: 't1',
      packId: 'default',
      rules: [rule('rule-a')],
      createdBy: 'tester',
      reason: 'first',
    });
    const audits = db.containers['decision-rule-audit'] as RulePackAuditEntry[];
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe('create');
    expect(audits[0]!.fromVersion).toBeNull();
    expect(audits[0]!.toVersion).toBe(1);
    expect(audits[0]!.diff).toBeUndefined();
    expect(audits[0]!.reason).toBe('first');
  });

  it('demotes the prior active version on a follow-up create + writes update audit with name-level diff', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [rule('keep'), rule('drop'), rule('change', { salience: 100 })],
      createdBy: 'tester',
    });
    const v2 = await svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [rule('keep'), rule('change', { salience: 200 }), rule('add')],
      createdBy: 'tester',
    });

    expect(v2.version).toBe(2);
    expect(v2.parentVersion).toBe(1);
    expect(v2.status).toBe('active');

    const packs = db.containers['decision-rule-packs'] as RulePackDocument<unknown>[];
    const v1 = packs.find(p => p.version === 1)!;
    expect(v1.status).toBe('inactive');

    const audits = db.containers['decision-rule-audit'] as RulePackAuditEntry[];
    const update = audits.find(a => a.action === 'update')!;
    expect(update.diff).toEqual({ added: ['add'], removed: ['drop'], modified: ['change'] });
  });

  it('rejects empty rules array', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await expect(svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [], createdBy: 'tester',
    })).rejects.toThrow(/at least one rule/);
  });

  it('rejects duplicate rule names within a pack', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await expect(svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [rule('dup'), rule('dup')],
      createdBy: 'tester',
    })).rejects.toThrow(/Duplicate rule name/);
  });

  it('rejects rules with missing or non-string name', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await expect(svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [{ salience: 100 } as unknown as Record<string, unknown>],
      createdBy: 'tester',
    })).rejects.toThrow(/name is required/);
  });

  it('rejects empty category / tenantId / packId', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await expect(svc.createVersion({
      category: '', tenantId: 't1', packId: 'default',
      rules: [rule('a')], createdBy: 'tester',
    })).rejects.toThrow(/category is required/);
    await expect(svc.createVersion({
      category: 'vendor-matching', tenantId: '', packId: 'default',
      rules: [rule('a')], createdBy: 'tester',
    })).rejects.toThrow(/tenantId is required/);
    await expect(svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: '',
      rules: [rule('a')], createdBy: 'tester',
    })).rejects.toThrow(/packId is required/);
  });
});

describe('DecisionRulePackService — query scoping', () => {
  it('listVersions/getActive scope by (category, tenant, packId) and ignore other tenants/categories', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);

    await svc.createVersion({ category: 'vendor-matching', tenantId: 't1', packId: 'default', rules: [rule('a')], createdBy: 'x' });
    await svc.createVersion({ category: 'vendor-matching', tenantId: 't2', packId: 'default', rules: [rule('a')], createdBy: 'x' });
    await svc.createVersion({ category: 'review-program',  tenantId: 't1', packId: 'default', rules: [rule('a')], createdBy: 'x' });

    const t1vm = await svc.listVersions('vendor-matching', 't1', 'default');
    expect(t1vm).toHaveLength(1);
    expect(t1vm[0]!.tenantId).toBe('t1');
    expect(t1vm[0]!.category).toBe('vendor-matching');

    const t1active = await svc.getActive('vendor-matching', 't1', 'default');
    expect(t1active?.tenantId).toBe('t1');
    expect(t1active?.category).toBe('vendor-matching');
  });

  it('getVersion does a point read on the synthetic id', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    await svc.createVersion({ category: 'vendor-matching', tenantId: 't1', packId: 'default', rules: [rule('a')], createdBy: 'x' });

    const v1 = await svc.getVersion('vendor-matching', 't1', 'default', 1);
    expect(v1?.id).toBe('t1__vendor-matching__default__v1');

    const missing = await svc.getVersion('vendor-matching', 't1', 'default', 99);
    expect(missing).toBeNull();
  });
});

describe('DecisionRulePackService.onNewActivePack', () => {
  it('dispatches the hook to the registered category only', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);

    const vmHook = vi.fn(async () => {});
    const rpHook = vi.fn(async () => {});
    svc.onNewActivePack('vendor-matching', vmHook);
    svc.onNewActivePack('review-program', rpHook);

    await svc.createVersion({ category: 'vendor-matching', tenantId: 't1', packId: 'default', rules: [rule('a')], createdBy: 'x' });
    expect(vmHook).toHaveBeenCalledTimes(1);
    expect(rpHook).toHaveBeenCalledTimes(0);

    await svc.createVersion({ category: 'review-program', tenantId: 't1', packId: 'default', rules: [rule('a')], createdBy: 'x' });
    expect(vmHook).toHaveBeenCalledTimes(1);
    expect(rpHook).toHaveBeenCalledTimes(1);
  });

  it('swallows hook failures so the storage write succeeds', async () => {
    const db = makeFakeDb();
    const svc = new DecisionRulePackService(db as any);
    svc.onNewActivePack('vendor-matching', async () => { throw new Error('push exploded'); });

    const pack = await svc.createVersion({
      category: 'vendor-matching', tenantId: 't1', packId: 'default',
      rules: [rule('a')], createdBy: 'x',
    });
    expect(pack.version).toBe(1);
    expect(db.containers['decision-rule-packs']).toHaveLength(1);
    expect(db.containers['decision-rule-audit']).toHaveLength(1);
  });
});
