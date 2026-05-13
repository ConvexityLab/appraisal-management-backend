/**
 * VendorOrderScorecardSuggester — heuristic suggestion tests.
 *
 * Stubs CosmosDbService.findOrderById so we can verify the score derivation
 * for representative order shapes without spinning up Cosmos.
 */

import { describe, it, expect } from 'vitest';
import { VendorOrderScorecardSuggester } from '../vendor-order-scorecard-suggester.service';

function makeDb(order: any) {
  return {
    async findOrderById() {
      return { success: true, data: order };
    },
  } as never;
}

function dayShift(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const now = new Date('2026-05-12T12:00:00Z');

describe('VendorOrderScorecardSuggester.suggestForOrder', () => {
  it('returns 5/5/5 for an on-time order with no revisions and no QC findings', async () => {
    const dueDate = dayShift(now, -1); // due yesterday
    const deliveredDate = dayShift(now, -2); // delivered before due
    const svc = new VendorOrderScorecardSuggester(
      makeDb({
        id: 'o-1',
        status: 'DELIVERED',
        dueDate: dueDate.toISOString(),
        deliveredDate: deliveredDate.toISOString(),
        revisionCount: 0,
        qcFindings: [],
      }),
    );
    const s = await svc.suggestForOrder('o-1');
    expect(s.turnTime).toBe(5);
    expect(s.communication).toBe(5);
    expect(s.quality).toBe(5);
    expect(s.report).toBe(5);
    expect(s.professionalism).toBeUndefined(); // no automatable signal
  });

  it('drops turnTime to 1 when severely late', async () => {
    const dueDate = dayShift(now, -30);
    const deliveredDate = now;
    const svc = new VendorOrderScorecardSuggester(
      makeDb({
        id: 'o-2',
        dueDate: dueDate.toISOString(),
        deliveredDate: deliveredDate.toISOString(),
        revisionCount: 0,
        qcFindings: [],
      }),
    );
    const s = await svc.suggestForOrder('o-2');
    expect(s.turnTime).toBe(1);
  });

  it('drops communication when revisionCount climbs', async () => {
    const dueDate = dayShift(now, 5);
    const svc = new VendorOrderScorecardSuggester(
      makeDb({
        id: 'o-3',
        dueDate: dueDate.toISOString(),
        deliveredDate: dueDate.toISOString(),
        revisionCount: 5,
        qcFindings: [],
      }),
    );
    const s = await svc.suggestForOrder('o-3');
    expect(s.communication).toBe(2);
  });

  it('zero-floors quality/report on a CRITICAL finding', async () => {
    const dueDate = dayShift(now, 5);
    const svc = new VendorOrderScorecardSuggester(
      makeDb({
        id: 'o-4',
        dueDate: dueDate.toISOString(),
        deliveredDate: dueDate.toISOString(),
        revisionCount: 0,
        qcFindings: [{ severity: 'CRITICAL' }],
      }),
    );
    const s = await svc.suggestForOrder('o-4');
    expect(s.quality).toBe(1);
    expect(s.report).toBe(1);
  });

  it('scales quality with MAJOR-finding count', async () => {
    const dueDate = dayShift(now, 5);
    const svc = new VendorOrderScorecardSuggester(
      makeDb({
        id: 'o-5',
        dueDate: dueDate.toISOString(),
        deliveredDate: dueDate.toISOString(),
        revisionCount: 0,
        qcFindings: [
          { severity: 'MAJOR' },
          { severity: 'MAJOR' },
          { severity: 'MAJOR' },
          { severity: 'MAJOR' },
        ],
      }),
    );
    const s = await svc.suggestForOrder('o-5');
    expect(s.quality).toBe(2);
  });

  it('returns {} when the order is not found', async () => {
    const svc = new VendorOrderScorecardSuggester({
      async findOrderById() {
        return { success: true, data: null };
      },
    } as never);
    const s = await svc.suggestForOrder('missing');
    expect(s).toEqual({});
  });
});
