/**
 * Vendor Scorecards Rollup Service
 *
 * Builds a per-vendor view that aggregates every vendor-order scorecard for a
 * vendor across the trailing window. Distinct from VendorPerformanceMetrics
 * (which is the BLENDED vendor-level signal feeding the matcher); this
 * surfaces the raw human-scored data Doug & David want when triaging a
 * vendor's recent performance.
 *
 *   sampleCount        — number of scored orders contributing to the rollup
 *   trailingWindowSize — count cap used (mirrors calculator's 25)
 *   overallAverage     — mean of active scorecards' overallScore (0-5)
 *   categoryAverages   — per-category mean (0-5)
 *   recentScorecards   — newest-first list with order context for the FE
 *
 * Source data: orders.scorecards[] embedded array (the active, non-superseded
 * entry per order). Superseded entries are EXCLUDED from averages but
 * preserved in the per-order history view (GET /api/orders/:id/scorecards).
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { OrderStatus } from '../types/order-status.js';
import type { Order } from '../types/index.js';
import type {
  ScorecardCategoryKey,
  VendorOrderScorecardEntry,
} from '../types/vendor-order.types.js';

const TRAILING_WINDOW_SIZE = 25;

const CATEGORY_KEYS: ScorecardCategoryKey[] = [
  'report',
  'quality',
  'communication',
  'turnTime',
  'professionalism',
];

export interface VendorScorecardRollupItem {
  scorecardId: string;
  orderId: string;
  orderNumber?: string;
  productType?: string;
  reviewedBy: string;
  reviewedAt: string;
  overallScore: number;
  scores: VendorOrderScorecardEntry['scores'];
}

export interface VendorScorecardRollup {
  vendorId: string;
  trailingWindowSize: number;
  sampleCount: number;
  /** Mean of overallScore across active scorecards (0-5, two decimals), or null. */
  overallAverage: number | null;
  /** Mean per category (0-5, two decimals). null when no samples. */
  categoryAverages: Record<ScorecardCategoryKey, number | null>;
  /** Newest-first list of the active scorecards in the window. */
  recentScorecards: VendorScorecardRollupItem[];
}

export class VendorScorecardsRollupService {
  private logger = new Logger('VendorScorecardsRollupService');

  constructor(private dbService: CosmosDbService) {}

  async buildRollup(vendorId: string, tenantId: string): Promise<VendorScorecardRollup> {
    const orders = await this.fetchVendorCompletedOrders(vendorId, tenantId);
    const items: VendorScorecardRollupItem[] = [];

    for (const order of orders) {
      const scorecards = order.scorecards ?? [];
      // Walk backwards for the active (non-superseded) entry.
      let active: VendorOrderScorecardEntry | null = null;
      for (let i = scorecards.length - 1; i >= 0; i--) {
        const entry = scorecards[i];
        if (entry && !entry.supersededBy) {
          active = entry;
          break;
        }
      }
      if (!active) continue;
      items.push({
        scorecardId: active.id,
        orderId: order.id,
        ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
        ...(order.productType ? { productType: String(order.productType) } : {}),
        reviewedBy: active.reviewedBy,
        reviewedAt: active.reviewedAt,
        overallScore: active.overallScore,
        scores: active.scores,
      });
    }

    // Newest-first by reviewedAt, then cap to TRAILING_WINDOW_SIZE.
    items.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
    const windowed = items.slice(0, TRAILING_WINDOW_SIZE);

    if (windowed.length === 0) {
      return {
        vendorId,
        trailingWindowSize: TRAILING_WINDOW_SIZE,
        sampleCount: 0,
        overallAverage: null,
        categoryAverages: emptyCategoryAverages(),
        recentScorecards: [],
      };
    }

    const overallAvg =
      windowed.reduce((s, x) => s + x.overallScore, 0) / windowed.length;

    const categoryAverages = emptyCategoryAverages();
    for (const key of CATEGORY_KEYS) {
      const vals: number[] = [];
      for (const item of windowed) {
        const v = item.scores[key]?.value;
        if (typeof v === 'number') vals.push(v);
      }
      categoryAverages[key] =
        vals.length === 0
          ? null
          : Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 100) / 100;
    }

    return {
      vendorId,
      trailingWindowSize: TRAILING_WINDOW_SIZE,
      sampleCount: windowed.length,
      overallAverage: Math.round(overallAvg * 100) / 100,
      categoryAverages,
      recentScorecards: windowed,
    };
  }

  private async fetchVendorCompletedOrders(
    vendorId: string,
    tenantId: string,
  ): Promise<Order[]> {
    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.assignedVendorId = @vendorId
        AND (c.status = @completed OR c.status = @delivered)
        AND IS_DEFINED(c.scorecards)
      ORDER BY c._ts DESC
    `;
    const result = await this.dbService.queryItems<Order>('orders', query, [
      { name: '@tenantId', value: tenantId },
      { name: '@vendorId', value: vendorId },
      { name: '@completed', value: OrderStatus.COMPLETED },
      { name: '@delivered', value: OrderStatus.DELIVERED },
    ]);
    if (!result.success) {
      this.logger.warn('fetchVendorCompletedOrders failed', { vendorId, tenantId });
      return [];
    }
    // Cap at a generous limit; we'll trim to TRAILING_WINDOW_SIZE after we
    // filter to those with active scorecards.
    return (result.data ?? []).slice(0, 100);
  }
}

function emptyCategoryAverages(): Record<ScorecardCategoryKey, number | null> {
  return {
    report: null,
    quality: null,
    communication: null,
    turnTime: null,
    professionalism: null,
  };
}
