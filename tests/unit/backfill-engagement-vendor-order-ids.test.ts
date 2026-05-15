/**
 * Unit tests for the pure logic in backfill-engagement-vendor-order-ids.
 *
 * Covers reconcile() and applyReconciliation() — the I/O-free core. The
 * Cosmos plumbing in the script's `main()` is intentionally not unit-tested
 * here; it's exercised by manual dry-run on a real container.
 */

import { describe, it, expect } from 'vitest';
import {
  reconcile,
  applyReconciliation,
  type EngagementShape,
} from '../../src/scripts/backfill-engagement-vendor-order-ids.js';

function makeEngagement(overrides: Partial<EngagementShape> = {}): EngagementShape {
  return {
    id: 'eng-1',
    tenantId: 'tenant-1',
    loans: [
      {
        id: 'loan-1',
        clientOrders: [{ id: 'co-1', vendorOrderIds: [] }],
      },
    ],
    ...overrides,
  };
}

describe('reconcile', () => {
  it('returns no changes when embedded array matches orders container', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: ['vo-1', 'vo-2'] }] },
      ],
    });
    const vendorOrders = [
      { id: 'vo-1', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
      { id: 'vo-2', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toEqual([]);
    expect(result.orphaned).toEqual([]);
  });

  it('detects orders container has linkages missing from embedded array (added)', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] },
      ],
    });
    const vendorOrders = [
      { id: 'vo-new', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      loanId: 'loan-1',
      clientOrderId: 'co-1',
      added: ['vo-new'],
      removed: [],
      next: ['vo-new'],
    });
  });

  it('detects embedded array has ghost linkages no longer in orders container (removed)', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: ['ghost-1', 'ghost-2'] }] },
      ],
    });
    const vendorOrders: { id: string; engagementPropertyId?: string; clientOrderId?: string }[] = [];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.removed.sort()).toEqual(['ghost-1', 'ghost-2']);
    expect(result.changes[0]!.added).toEqual([]);
    expect(result.changes[0]!.next).toEqual([]);
  });

  it('detects mixed adds and removes on the same clientOrder', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: ['ghost', 'shared'] }] },
      ],
    });
    const vendorOrders = [
      { id: 'shared', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
      { id: 'fresh', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.added).toEqual(['fresh']);
    expect(result.changes[0]!.removed).toEqual(['ghost']);
    expect(result.changes[0]!.next.sort()).toEqual(['fresh', 'shared']);
  });

  it('flags vendor orders with missing engagementPropertyId as orphans', () => {
    const eng = makeEngagement();
    const vendorOrders = [
      { id: 'vo-1', engagementPropertyId: undefined, clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toEqual([]);
    expect(result.orphaned).toHaveLength(1);
    expect(result.orphaned[0]!.id).toBe('vo-1');
  });

  it('flags vendor orders pointing to a loanId not in the engagement as orphans', () => {
    const eng = makeEngagement({
      loans: [{ id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] }],
    });
    const vendorOrders = [
      { id: 'vo-stranded', engagementPropertyId: 'loan-NEVER-EXISTED', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toEqual([]);
    expect(result.orphaned.map((o) => o.id)).toEqual(['vo-stranded']);
  });

  it('flags vendor orders pointing to a clientOrderId not in the matched loan as orphans', () => {
    const eng = makeEngagement({
      loans: [{ id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] }],
    });
    const vendorOrders = [
      { id: 'vo-stranded', engagementPropertyId: 'loan-1', clientOrderId: 'co-NEVER-EXISTED' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toEqual([]);
    expect(result.orphaned.map((o) => o.id)).toEqual(['vo-stranded']);
  });

  it('handles legacy engagement docs that use `properties` instead of `loans`', () => {
    const eng: EngagementShape = {
      id: 'eng-legacy',
      tenantId: 'tenant-1',
      properties: [
        { id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] },
      ],
    };
    const vendorOrders = [
      { id: 'vo-1', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.added).toEqual(['vo-1']);
  });

  it('correctly groups vendor orders across multiple loans and clientOrders', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [
          { id: 'co-1a', vendorOrderIds: [] },
          { id: 'co-1b', vendorOrderIds: [] },
        ] },
        { id: 'loan-2', clientOrders: [
          { id: 'co-2a', vendorOrderIds: [] },
        ] },
      ],
    });
    const vendorOrders = [
      { id: 'vo-A', engagementPropertyId: 'loan-1', clientOrderId: 'co-1a' },
      { id: 'vo-B', engagementPropertyId: 'loan-1', clientOrderId: 'co-1b' },
      { id: 'vo-C', engagementPropertyId: 'loan-2', clientOrderId: 'co-2a' },
      { id: 'vo-D', engagementPropertyId: 'loan-2', clientOrderId: 'co-2a' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes).toHaveLength(3);
    const byKey = new Map(result.changes.map((c) => [`${c.loanId}::${c.clientOrderId}`, c]));
    expect(byKey.get('loan-1::co-1a')!.next).toEqual(['vo-A']);
    expect(byKey.get('loan-1::co-1b')!.next).toEqual(['vo-B']);
    expect(byKey.get('loan-2::co-2a')!.next).toEqual(['vo-C', 'vo-D']);
  });

  it('produces deterministic next arrays (sorted) for stable output', () => {
    const eng = makeEngagement({
      loans: [{ id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] }],
    });
    const vendorOrders = [
      { id: 'vo-c', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
      { id: 'vo-a', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
      { id: 'vo-b', engagementPropertyId: 'loan-1', clientOrderId: 'co-1' },
    ];
    const result = reconcile(eng, vendorOrders);
    expect(result.changes[0]!.next).toEqual(['vo-a', 'vo-b', 'vo-c']);
  });
});

describe('applyReconciliation', () => {
  it('returns the same engagement reference when there are no changes', () => {
    const eng = makeEngagement();
    const result = applyReconciliation(eng, { changes: [], orphaned: [] });
    expect(result).toBe(eng);
  });

  it('writes new vendorOrderIds onto the matching clientOrder, preserving siblings', () => {
    const eng = makeEngagement({
      loans: [
        { id: 'loan-1', clientOrders: [
          { id: 'co-1', vendorOrderIds: [] },
          { id: 'co-2', vendorOrderIds: ['untouched'] },
        ] },
      ],
    });
    const result = applyReconciliation(eng, {
      changes: [
        { loanId: 'loan-1', clientOrderId: 'co-1', added: ['vo-1'], removed: [], next: ['vo-1'] },
      ],
      orphaned: [],
    });
    expect(result.loans![0]!.clientOrders[0]!.vendorOrderIds).toEqual(['vo-1']);
    expect(result.loans![0]!.clientOrders[1]!.vendorOrderIds).toEqual(['untouched']);
  });

  it('does not mutate the input engagement', () => {
    const eng = makeEngagement({
      loans: [{ id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] }],
    });
    const inputSnapshot = JSON.parse(JSON.stringify(eng));
    applyReconciliation(eng, {
      changes: [
        { loanId: 'loan-1', clientOrderId: 'co-1', added: ['vo-1'], removed: [], next: ['vo-1'] },
      ],
      orphaned: [],
    });
    expect(eng).toEqual(inputSnapshot);
  });

  it('preserves the legacy `properties` field name when present', () => {
    const eng: EngagementShape = {
      id: 'eng-legacy',
      tenantId: 'tenant-1',
      properties: [{ id: 'loan-1', clientOrders: [{ id: 'co-1', vendorOrderIds: [] }] }],
    };
    const result = applyReconciliation(eng, {
      changes: [
        { loanId: 'loan-1', clientOrderId: 'co-1', added: ['vo-1'], removed: [], next: ['vo-1'] },
      ],
      orphaned: [],
    });
    expect(result.properties![0]!.clientOrders[0]!.vendorOrderIds).toEqual(['vo-1']);
    expect(result.loans).toBeUndefined();
  });
});
