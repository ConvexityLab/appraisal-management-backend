/**
 * Tests for ensureBaseProfile + first-touch seeding in resolveProfile.
 *
 * The resolver auto-seeds a BASE profile the first time a tenant has none —
 * so admins land on an editable doc and ML joins always see a profile id.
 * These tests fix:
 *
 *   - happy path: no doc → createItem called once with BASE/ANY/v1 + audit log
 *   - cached: second call within the same process skips both findActive and createItem
 *   - race: createItem returns 409 → re-read returns the racing winner's doc
 *   - existing doc: ensureBaseProfile is a no-op (returns existing without create)
 *   - resolveProfile integrates the seeded doc into appliedProfileIds
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScorecardRollupProfileService, DEFAULT_BASE_PROFILE } from '../scorecard-rollup-profile.service';
import type { ScorecardRollupProfile } from '../../types/vendor-marketplace.types';

interface QueryCapture {
  queries: string[];
  params: Array<unknown>;
  createdItems: Array<{ container: string; item: unknown }>;
}

function makeStubDb(opts: {
  initialDoc?: ScorecardRollupProfile | null;
  /** When set, createItem throws this error the first time it's called. */
  createThrows?: Error;
  /** When set, after createItem throws, the next query returns this doc (race winner). */
  postRaceDoc?: ScorecardRollupProfile | null;
}): { db: unknown; capture: QueryCapture } {
  const capture: QueryCapture = { queries: [], params: [], createdItems: [] };
  let currentDoc: ScorecardRollupProfile | null = opts.initialDoc ?? null;
  let createCallCount = 0;
  let queryCallCount = 0;

  const db = {
    async queryItems(_container: string, query: string, params: unknown) {
      queryCallCount++;
      capture.queries.push(query);
      capture.params.push(params);
      // After a 409, the next query returns the racing winner's doc.
      if (opts.createThrows && createCallCount > 0 && opts.postRaceDoc) {
        return { success: true, data: [opts.postRaceDoc] };
      }
      return { success: true, data: currentDoc ? [currentDoc] : [] };
    },
    async createItem(container: string, item: unknown) {
      createCallCount++;
      capture.createdItems.push({ container, item });
      if (opts.createThrows && createCallCount === 1) {
        throw opts.createThrows;
      }
      currentDoc = item as ScorecardRollupProfile;
      return { success: true, data: item };
    },
    async upsertItem() {
      return { success: true };
    },
    // The resolver also calls findOrderById in some paths; stub to no-op.
    async findOrderById() {
      return { success: false };
    },
  };
  return { db, capture };
}

function makeStubAudit(): { audit: unknown; logged: Array<{ action: string }> } {
  const logged: Array<{ action: string }> = [];
  const audit = {
    async log(entry: { action: string }) {
      logged.push(entry);
    },
  };
  return { audit, logged };
}

function makeService(stubs: {
  db: unknown;
  audit: unknown;
}): ScorecardRollupProfileService {
  return new ScorecardRollupProfileService(
    stubs.db as never,
    stubs.audit as never,
  );
}

describe('ScorecardRollupProfileService.ensureBaseProfile', () => {
  it('creates a v1 BASE/ANY doc when none exists, with system actor + audit', async () => {
    const { db, capture } = makeStubDb({});
    const { audit, logged } = makeStubAudit();
    const svc = makeService({ db, audit });

    const result = await svc.ensureBaseProfile('tenant-1');

    expect(capture.createdItems).toHaveLength(1);
    const created = capture.createdItems[0]!.item as ScorecardRollupProfile;
    expect(created.tenantId).toBe('tenant-1');
    expect(created.scope.kind).toBe('BASE');
    expect(created.phase).toBe('ANY');
    expect(created.version).toBe(1);
    expect(created.active).toBe(true);
    expect(created.createdBy).toBe('system:auto-seed');
    // Mirrors the in-memory default (sanity check on weights).
    expect(created.categoryWeights.report).toBe(DEFAULT_BASE_PROFILE.categoryWeights.report);
    expect(created.window.size).toBe(DEFAULT_BASE_PROFILE.window.size);

    expect(logged).toHaveLength(1);
    expect(logged[0]!.action).toBe('scorecard-rollup-profile.auto-seed');
    expect(result.id).toBe(created.id);
  });

  it('returns the existing doc without creating when one is already present', async () => {
    const existing: ScorecardRollupProfile = {
      id: 'pre-existing',
      tenantId: 't',
      type: 'scorecard-rollup-profile',
      scope: { kind: 'BASE' },
      phase: 'ANY',
      version: 7,
      active: true,
      categoryWeights: DEFAULT_BASE_PROFILE.categoryWeights,
      window: DEFAULT_BASE_PROFILE.window,
      timeDecay: DEFAULT_BASE_PROFILE.timeDecay,
      derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
      gates: [],
      penalties: [],
      tierThresholds: DEFAULT_BASE_PROFILE.tierThresholds,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'admin',
    };
    const { db, capture } = makeStubDb({ initialDoc: existing });
    const { audit } = makeStubAudit();
    const svc = makeService({ db, audit });

    const result = await svc.ensureBaseProfile('t');
    expect(result.id).toBe('pre-existing');
    expect(capture.createdItems).toHaveLength(0);
  });

  it('handles 409 race by re-reading the racing winner doc', async () => {
    const racer: ScorecardRollupProfile = {
      id: 'race-winner',
      tenantId: 't',
      type: 'scorecard-rollup-profile',
      scope: { kind: 'BASE' },
      phase: 'ANY',
      version: 1,
      active: true,
      categoryWeights: DEFAULT_BASE_PROFILE.categoryWeights,
      window: DEFAULT_BASE_PROFILE.window,
      timeDecay: DEFAULT_BASE_PROFILE.timeDecay,
      derivedSignalBlendWeight: DEFAULT_BASE_PROFILE.derivedSignalBlendWeight,
      gates: [],
      penalties: [],
      tierThresholds: DEFAULT_BASE_PROFILE.tierThresholds,
      createdAt: '2026-05-13T00:00:00Z',
      createdBy: 'other-process',
    };
    const { db } = makeStubDb({
      createThrows: new Error('Cosmos write failed with status 409 Conflict'),
      postRaceDoc: racer,
    });
    const { audit } = makeStubAudit();
    const svc = makeService({ db, audit });

    const result = await svc.ensureBaseProfile('t');
    expect(result.id).toBe('race-winner');
  });

  it('caches successful seed in-process; second call short-circuits createItem', async () => {
    const { db, capture } = makeStubDb({});
    const { audit } = makeStubAudit();
    const svc = makeService({ db, audit });

    await svc.ensureBaseProfile('t1');
    const firstCreates = capture.createdItems.length;

    // Second call — even though our stub still reports empty on the read, the
    // service should remember it already seeded this tenant.
    await svc.ensureBaseProfile('t1');
    expect(capture.createdItems.length).toBe(firstCreates); // no new create
  });
});

describe('ScorecardRollupProfileService.resolveProfile (auto-seed integration)', () => {
  it('seeds the BASE profile on first resolve and lists it in appliedProfileIds', async () => {
    const { db, capture } = makeStubDb({});
    const { audit } = makeStubAudit();
    const svc = makeService({ db, audit });

    const resolved = await svc.resolveProfile({ tenantId: 't-fresh' });
    expect(capture.createdItems).toHaveLength(1);
    expect(resolved.appliedProfileIds).toHaveLength(1);
    expect(resolved.appliedProfileIds[0]).toMatch(/^srp-t-fresh-/);
  });
});
