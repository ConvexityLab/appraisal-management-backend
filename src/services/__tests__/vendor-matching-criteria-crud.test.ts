/**
 * Tests for VendorMatchingCriteriaService CRUD-N behaviour:
 *   - createProfile auto-bumps version per (scope, phase) tuple
 *   - prior active version is deactivated (active=false) on new version create
 *   - validateProfilePayload catches missing scope ids + bad weights
 *   - listProfiles activeOnly filter is wired to the right SQL
 */

import { describe, it, expect, vi } from 'vitest';
import {
  VendorMatchingCriteriaService,
  CriteriaProfileError,
  DEFAULT_BASE_PROFILE,
} from '../vendor-matching-criteria.service';

const VALID_CRITERIA = DEFAULT_BASE_PROFILE.criteria;

function makeAuditService() {
  return { log: vi.fn().mockResolvedValue(undefined) } as never;
}

function makeDb(opts: {
  initial?: any[];
} = {}) {
  let docs: any[] = [...(opts.initial ?? [])];
  const calls: { create: any[]; upsert: any[]; query: string[] } = {
    create: [],
    upsert: [],
    query: [],
  };
  const db = {
    async createItem(_container: string, doc: any) {
      calls.create.push(doc);
      docs.push(doc);
      return { success: true, data: doc };
    },
    async upsertItem(_container: string, doc: any) {
      calls.upsert.push(doc);
      docs = docs.map((d) => (d.id === doc.id ? doc : d));
      return { success: true, data: doc };
    },
    async queryItems<T>(_container: string, query: string, _params: any[]) {
      calls.query.push(query);
      // Resolver/list filter — return the seeded docs that match `active = true`
      // when the query asks for it; everything otherwise.
      const wantActive = query.includes('active = true');
      const matching = wantActive ? docs.filter((d) => d.active) : docs;
      return { success: true, data: matching as T[] };
    },
  } as never;
  return { db, calls, getDocs: () => docs };
}

describe('VendorMatchingCriteriaService.createProfile', () => {
  it('starts at version 1 when no prior profile exists for the (scope, phase) pair', async () => {
    const { db, calls } = makeDb();
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    const created = await svc.createProfile(
      't-1',
      { scope: { kind: 'BASE' }, phase: 'ANY', criteria: VALID_CRITERIA },
      'user-1',
    );
    expect(created.version).toBe(1);
    expect(created.active).toBe(true);
    expect(created.tenantId).toBe('t-1');
    expect(calls.create).toHaveLength(1);
    expect(calls.upsert).toHaveLength(0); // no prior to deactivate
  });

  it('bumps version and deactivates the prior when one exists', async () => {
    const prior = {
      id: 'mcp-t-1-existing',
      tenantId: 't-1',
      type: 'vendor-matching-criteria-profile',
      scope: { kind: 'BASE' },
      phase: 'ANY',
      version: 7,
      active: true,
      criteria: VALID_CRITERIA,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'older',
    };
    const { db, calls } = makeDb({ initial: [prior] });
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    const created = await svc.createProfile(
      't-1',
      { scope: { kind: 'BASE' }, phase: 'ANY', criteria: VALID_CRITERIA },
      'user-1',
    );
    expect(created.version).toBe(8); // bumped from 7
    expect(calls.upsert).toHaveLength(1);
    expect(calls.upsert[0].id).toBe('mcp-t-1-existing');
    expect(calls.upsert[0].active).toBe(false);
  });

  it('rejects CLIENT scope without a clientId', async () => {
    const { db } = makeDb();
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    await expect(
      svc.createProfile(
        't-1',
        { scope: { kind: 'CLIENT' }, phase: 'ANY', criteria: VALID_CRITERIA },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(CriteriaProfileError);
  });

  it('rejects criteria weight outside 0..1', async () => {
    const { db } = makeDb();
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    const bad = {
      ...VALID_CRITERIA,
      performance: { enabled: true, weight: 1.5, mode: 'SCORED' as const },
    };
    await expect(
      svc.createProfile(
        't-1',
        { scope: { kind: 'BASE' }, phase: 'ANY', criteria: bad },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(CriteriaProfileError);
  });

  it('rejects CLIENT_PRODUCT scope without both clientId AND productType', async () => {
    const { db } = makeDb();
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    await expect(
      svc.createProfile(
        't-1',
        {
          scope: { kind: 'CLIENT_PRODUCT', clientId: 'c-1' },
          phase: 'ANY',
          criteria: VALID_CRITERIA,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(CriteriaProfileError);
  });
});

describe('VendorMatchingCriteriaService.listProfiles', () => {
  it('threads activeOnly=true through to a SQL filter on c.active', async () => {
    const { db, calls } = makeDb({
      initial: [
        {
          id: 'a',
          tenantId: 't-1',
          type: 'vendor-matching-criteria-profile',
          active: true,
          scope: { kind: 'BASE' },
          phase: 'ANY',
          version: 1,
          criteria: VALID_CRITERIA,
          createdAt: '',
          createdBy: '',
        },
        {
          id: 'b',
          tenantId: 't-1',
          type: 'vendor-matching-criteria-profile',
          active: false,
          scope: { kind: 'BASE' },
          phase: 'ANY',
          version: 0,
          criteria: VALID_CRITERIA,
          createdAt: '',
          createdBy: '',
        },
      ],
    });
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    const result = await svc.listProfiles('t-1', { activeOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
    expect(calls.query[0]).toMatch(/c\.active = true/);
  });

  it('returns every version (active + superseded) when activeOnly is false', async () => {
    const { db } = makeDb({
      initial: [
        { id: 'a', tenantId: 't-1', type: 'vendor-matching-criteria-profile', active: true,
          scope: { kind: 'BASE' }, phase: 'ANY', version: 2, criteria: VALID_CRITERIA, createdAt: '', createdBy: '' },
        { id: 'b', tenantId: 't-1', type: 'vendor-matching-criteria-profile', active: false,
          scope: { kind: 'BASE' }, phase: 'ANY', version: 1, criteria: VALID_CRITERIA, createdAt: '', createdBy: '' },
      ],
    });
    const svc = new VendorMatchingCriteriaService(db, makeAuditService());
    const result = await svc.listProfiles('t-1', { activeOnly: false });
    expect(result).toHaveLength(2);
  });
});
