/**
 * Tests for the pure transforms in the
 * migrate-vendor-matching-rule-packs.ts script (Phase A.4 of
 * DECISION_ENGINE_RULES_SURFACE.md).
 *
 * The migration is idempotent only if the transforms are deterministic — same
 * source doc → same target id every time. Cover that, plus the field
 * preservation contract.
 */

import { describe, expect, it } from 'vitest';
import {
  transformPack,
  transformAudit,
} from '../../src/scripts/migrate-vendor-matching-rule-packs.js';

describe('transformPack', () => {
  it('rewrites id to include category and stamps category + new type', () => {
    const out = transformPack({
      id: 't1__default__v3',
      type: 'vendor-matching-rule-pack',
      tenantId: 't1',
      packId: 'default',
      version: 3,
      parentVersion: 2,
      status: 'active',
      rules: [{ name: 'rule-a' }],
      metadata: { name: 'Test pack' },
      createdAt: '2026-05-09T00:00:00.000Z',
      createdBy: 'tester',
    });

    expect(out.id).toBe('t1__vendor-matching__default__v3');
    expect(out.type).toBe('decision-rule-pack');
    expect(out.category).toBe('vendor-matching');
    expect(out.tenantId).toBe('t1');
    expect(out.packId).toBe('default');
    expect(out.version).toBe(3);
    expect(out.parentVersion).toBe(2);
    expect(out.status).toBe('active');
    expect(out.rules).toEqual([{ name: 'rule-a' }]);
    expect(out.metadata).toEqual({ name: 'Test pack' });
    expect(out.createdAt).toBe('2026-05-09T00:00:00.000Z');
    expect(out.createdBy).toBe('tester');
  });

  it('is deterministic — same input always yields same id (idempotent re-runs)', () => {
    const src = {
      id: 't1__default__v1',
      type: 'vendor-matching-rule-pack' as const,
      tenantId: 't1',
      packId: 'default',
      version: 1,
      parentVersion: null,
      status: 'active' as const,
      rules: [{ name: 'r' }],
      createdAt: '2026-05-09T00:00:00.000Z',
      createdBy: 'tester',
    };
    expect(transformPack(src).id).toBe(transformPack(src).id);
  });

  it('defaults metadata to {} when source lacks it', () => {
    const out = transformPack({
      id: 't1__default__v1',
      type: 'vendor-matching-rule-pack',
      tenantId: 't1',
      packId: 'default',
      version: 1,
      parentVersion: null,
      status: 'active',
      rules: [{ name: 'r' }],
      createdAt: '2026-05-09T00:00:00.000Z',
      createdBy: 'tester',
    });
    expect(out.metadata).toEqual({});
  });
});

describe('transformAudit', () => {
  it('preserves the uuid id and stamps category + new type', () => {
    const out = transformAudit({
      id: 'ca5d69bb-1e71-4317-8039-7d57929067f8',
      type: 'vendor-matching-rule-audit',
      tenantId: 't1',
      packId: 'default',
      fromVersion: 1,
      toVersion: 2,
      action: 'update',
      diff: { added: ['x'], removed: ['y'], modified: ['z'] },
      actor: 'tester',
      reason: 'fix',
      timestamp: '2026-05-09T00:00:00.000Z',
    });

    expect(out.id).toBe('ca5d69bb-1e71-4317-8039-7d57929067f8');
    expect(out.type).toBe('decision-rule-audit');
    expect(out.category).toBe('vendor-matching');
    expect(out.tenantId).toBe('t1');
    expect(out.packId).toBe('default');
    expect(out.fromVersion).toBe(1);
    expect(out.toVersion).toBe(2);
    expect(out.action).toBe('update');
    expect(out.diff).toEqual({ added: ['x'], removed: ['y'], modified: ['z'] });
    expect(out.actor).toBe('tester');
    expect(out.reason).toBe('fix');
    expect(out.timestamp).toBe('2026-05-09T00:00:00.000Z');
  });

  it('omits diff and reason when not present (exactOptionalPropertyTypes safe)', () => {
    const out = transformAudit({
      id: 'uuid-1',
      type: 'vendor-matching-rule-audit',
      tenantId: 't1',
      packId: 'default',
      fromVersion: null,
      toVersion: 1,
      action: 'create',
      actor: 'tester',
      timestamp: '2026-05-09T00:00:00.000Z',
    });
    expect('diff' in out).toBe(false);
    expect('reason' in out).toBe(false);
  });
});
