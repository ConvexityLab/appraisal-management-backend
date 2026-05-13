/**
 * Tests for VendorScorecardsRollupService.buildRollup:
 *   - per-category averages
 *   - active vs. superseded entry selection
 *   - window cap (TRAILING_WINDOW_SIZE = 25)
 *   - authorizationFilter is appended to the Cosmos query
 */

import { describe, it, expect } from 'vitest';
import { VendorScorecardsRollupService } from '../vendor-scorecards-rollup.service';
import { OrderStatus } from '../../types/order-status';

function makeScorecard(
  id: string,
  reviewedAt: string,
  values: { report: number; quality: number; communication: number; turnTime: number; professionalism: number },
  supersededBy?: string,
) {
  return {
    id,
    reviewedAt,
    reviewedBy: 'reviewer-1',
    overallScore:
      Math.round(
        ((values.report + values.quality + values.communication + values.turnTime + values.professionalism) /
          5) *
          100,
      ) / 100,
    scores: {
      report: { value: values.report },
      quality: { value: values.quality },
      communication: { value: values.communication },
      turnTime: { value: values.turnTime },
      professionalism: { value: values.professionalism },
    },
    ...(supersededBy ? { supersededBy } : {}),
  };
}

function makeDb(orders: Array<{ id: string; scorecards: any[] }>) {
  const capture: { query?: string; params?: any[] } = {};
  const db = {
    async queryItems(_container: string, query: string, params: any[]) {
      capture.query = query;
      capture.params = params;
      return {
        success: true,
        data: orders.map((o) => ({
          id: o.id,
          status: OrderStatus.DELIVERED,
          tenantId: 't-1',
          orderNumber: `ORD-${o.id}`,
          productType: 'FULL_APPRAISAL',
          scorecards: o.scorecards,
        })),
      };
    },
  } as never;
  return { db, capture };
}

describe('VendorScorecardsRollupService.buildRollup', () => {
  it('returns empty rollup when there are no scored orders', async () => {
    const { db } = makeDb([]);
    const svc = new VendorScorecardsRollupService(db);
    const rollup = await svc.buildRollup('v-1', 't-1');
    expect(rollup.sampleCount).toBe(0);
    expect(rollup.overallAverage).toBeNull();
    expect(rollup.categoryAverages.report).toBeNull();
    expect(rollup.recentScorecards).toEqual([]);
  });

  it('computes per-category averages over active (non-superseded) entries', async () => {
    const { db } = makeDb([
      {
        id: 'o-1',
        scorecards: [
          // older entry that was superseded — should be IGNORED
          makeScorecard(
            'sc-old',
            '2026-01-01T00:00:00Z',
            { report: 1, quality: 1, communication: 1, turnTime: 1, professionalism: 1 },
            'sc-new',
          ),
          makeScorecard('sc-new', '2026-04-01T00:00:00Z', {
            report: 5,
            quality: 4,
            communication: 5,
            turnTime: 4,
            professionalism: 5,
          }),
        ],
      },
      {
        id: 'o-2',
        scorecards: [
          makeScorecard('sc-2', '2026-04-15T00:00:00Z', {
            report: 3,
            quality: 4,
            communication: 3,
            turnTime: 4,
            professionalism: 3,
          }),
        ],
      },
    ]);
    const svc = new VendorScorecardsRollupService(db);
    const rollup = await svc.buildRollup('v-1', 't-1');
    expect(rollup.sampleCount).toBe(2);
    // Report avg = (5 + 3) / 2 = 4
    expect(rollup.categoryAverages.report).toBe(4);
    // Quality avg = (4 + 4) / 2 = 4
    expect(rollup.categoryAverages.quality).toBe(4);
    // Newest first
    expect(rollup.recentScorecards[0]?.scorecardId).toBe('sc-2');
    expect(rollup.recentScorecards[1]?.scorecardId).toBe('sc-new');
  });

  it('caps the window at TRAILING_WINDOW_SIZE (25) most-recent scored orders', async () => {
    const orders = Array.from({ length: 40 }, (_, i) => {
      const reviewedAt = new Date(2026, 0, i + 1).toISOString(); // ascending
      return {
        id: `o-${i}`,
        scorecards: [
          makeScorecard(`sc-${i}`, reviewedAt, {
            report: 5,
            quality: 5,
            communication: 5,
            turnTime: 5,
            professionalism: 5,
          }),
        ],
      };
    });
    const { db } = makeDb(orders);
    const svc = new VendorScorecardsRollupService(db);
    const rollup = await svc.buildRollup('v-1', 't-1');
    expect(rollup.trailingWindowSize).toBe(25);
    expect(rollup.sampleCount).toBe(25);
    expect(rollup.recentScorecards).toHaveLength(25);
  });

  it('appends authorizationFilter SQL to the query and its parameters', async () => {
    const { db, capture } = makeDb([]);
    const svc = new VendorScorecardsRollupService(db);
    await svc.buildRollup('v-1', 't-1', {
      sql: 'c.accessControl.assignedUserIds CONTAINS @callerId',
      parameters: [{ name: '@callerId', value: 'user-7' }],
    });
    expect(capture.query).toMatch(/c\.accessControl\.assignedUserIds CONTAINS @callerId/);
    const paramNames = (capture.params ?? []).map((p: any) => p.name);
    expect(paramNames).toContain('@callerId');
    expect(paramNames).toContain('@tenantId');
    expect(paramNames).toContain('@vendorId');
  });

  it('does not include superseded scorecards even when they are newer', async () => {
    // Reviewer typed a wrong score (newer), then SUPERSEDED IT THEMSELVES with
    // an earlier entry — that's actually impossible in practice (BE only links
    // forward), but the rollup should still treat supersededBy=set as inactive.
    const { db } = makeDb([
      {
        id: 'o-1',
        scorecards: [
          makeScorecard('sc-a', '2026-03-01T00:00:00Z', {
            report: 4,
            quality: 4,
            communication: 4,
            turnTime: 4,
            professionalism: 4,
          }),
          makeScorecard(
            'sc-b',
            '2026-04-01T00:00:00Z',
            { report: 1, quality: 1, communication: 1, turnTime: 1, professionalism: 1 },
            'sc-c', // marked as superseded
          ),
        ],
      },
    ]);
    const svc = new VendorScorecardsRollupService(db);
    const rollup = await svc.buildRollup('v-1', 't-1');
    // sc-b is superseded; sc-a is active. Only sc-a should appear.
    expect(rollup.sampleCount).toBe(1);
    expect(rollup.recentScorecards[0]?.scorecardId).toBe('sc-a');
  });
});
