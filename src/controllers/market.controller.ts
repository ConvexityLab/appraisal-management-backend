/**
 * Market Intelligence controller (Phase 4.1)
 *
 * Routes (mounted at /api/market):
 *   GET /heatmap?zipCodes[]=&metric=       — zip-level aggregated stats for map layer
 *   GET /trends/:zipCode?metric=&months=   — time series for a single market
 *   GET /comparable-activity?lat=&lng=&radiusMiles= — recent sales as GeoJSON FeatureCollection
 *   GET /stats/:zipCode                    — full MarketStats record for a zip
 *
 * Data is sourced from 'market-stats' documents in the 'properties' container.
 * When no stats exist for a requested zip, a synthetic baseline is returned so
 * the map renders without errors — marked with _synthetic: true.
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  MarketStats,
  HeatmapMetric,
  MarketHeatmapEntry,
  MonthlyDataPoint,
  MarketTrendsResponse,
} from '../types/market.types.js';

const CONTAINER = 'properties';

// ─── Helper: normalise an array of values to 0–100 scale ─────────────────────
function normalise(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 50);
  return values.map(v => Math.round(((v - min) / range) * 100));
}

// ─── Helper: pick the scalar for a heatmap metric ────────────────────────────
function metricValue(stats: MarketStats, metric: HeatmapMetric): number {
  switch (metric) {
    case 'median_price': return stats.medianPrice;
    case 'price_psf': return stats.medianPricePerSqft;
    case 'days_on_market': return stats.medianDaysOnMarket;
    case 'investor_activity': return stats.investorSalesShare;
    case 'price_change_pct': {
      const pts = stats.monthlyMedianPrices;
      if (pts.length < 2) return 0;
      const first = pts[0]?.value ?? 0;
      const last = pts[pts.length - 1]?.value ?? 0;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    }
  }
}

export function createMarketRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── GET /heatmap ──────────────────────────────────────────────────────────
  router.get('/heatmap', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const query = req.query as Record<string, string | string[]>;
    const zipCodesRaw = query['zipCodes'] ?? query['zipCodes[]'];
    const zipCodes: string[] = Array.isArray(zipCodesRaw)
      ? zipCodesRaw
      : zipCodesRaw
        ? [zipCodesRaw]
        : [];
    const metric: HeatmapMetric = (query['metric'] as HeatmapMetric) ?? 'median_price';

    if (!zipCodes.length) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one zipCode is required' } }); return; }

    const validMetrics: HeatmapMetric[] = ['median_price', 'price_psf', 'days_on_market', 'investor_activity', 'price_change_pct'];
    if (!validMetrics.includes(metric)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `metric must be one of: ${validMetrics.join(', ')}` } }); return;
    }

    try {
      const container = db.getContainer(CONTAINER);
      const zipParams = zipCodes.map((z, i) => ({ name: `@zip${i}`, value: z }));
      const zipList = zipParams.map(p => p.name).join(', ');

      const { resources } = await container.items.query<MarketStats>({
        query: `SELECT * FROM c WHERE c.type = @type AND c.zipCode IN (${zipList})`,
        parameters: [
          { name: '@type', value: 'market-stats' },
          ...zipParams,
        ],
      }).fetchAll();

      const statsByZip = new Map(resources.map(s => [s.zipCode, s]));
      const rawValues = zipCodes.map(z => {
        const s = statsByZip.get(z);
        return s ? metricValue(s, metric) : 0;
      });
      const normalised = normalise(rawValues);

      const entries: MarketHeatmapEntry[] = zipCodes.map((z, i) => ({
        zipCode: z,
        lat: 0,  // Caller should overlay with zip centroid data they maintain
        lon: 0,
        value: normalised[i] ?? 0,
        rawValue: rawValues[i] ?? 0,
        metric,
      }));

      res.json({ success: true, data: entries, metric });
    } catch (error) {
      logger.error('Failed to get heatmap data', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve heatmap data' } });
    }
  });

  // ─── GET /trends/:zipCode ──────────────────────────────────────────────────
  router.get('/trends/:zipCode', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const zipCode = req.params['zipCode'] as string;
    const metric: HeatmapMetric = (req.query['metric'] as HeatmapMetric) ?? 'median_price';
    const months = Math.min(36, Math.max(1, parseInt(req.query['months'] as string ?? '12', 10)));

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<MarketStats>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.zipCode = @zipCode ORDER BY c.calculatedForMonth DESC OFFSET 0 LIMIT 1',
        parameters: [
          { name: '@type', value: 'market-stats' },
          { name: '@zipCode', value: zipCode },
        ],
      }).fetchAll();

      const stats = resources[0];
      let dataPoints: MonthlyDataPoint[];

      if (!stats) {
        // Return empty synthetic response — no stats ingested yet
        dataPoints = [];
      } else {
        const source: MonthlyDataPoint[] =
          metric === 'median_price' ? stats.monthlyMedianPrices :
          metric === 'price_change_pct' ? stats.monthlyMedianPrices : // pct computed below
          stats.monthlyVolumes;

        dataPoints = source.slice(-months);

        if (metric === 'price_change_pct' && dataPoints.length > 1) {
          // Convert absolute prices to MoM % change
          const base = dataPoints[0]?.value ?? 1;
          dataPoints = dataPoints.map(p => ({
            month: p.month,
            value: Math.round(((p.value - base) / base) * 10000) / 100,
          }));
        }
      }

      const response: MarketTrendsResponse = {
        zipCode,
        metric,
        months,
        dataPoints,
      };
      res.json({ success: true, data: response, _synthetic: !stats });
    } catch (error) {
      logger.error('Failed to get market trends', { error, tenantId, zipCode });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve market trends' } });
    }
  });

  // ─── GET /comparable-activity ──────────────────────────────────────────────
  // Returns recent off-market sold properties near a point as GeoJSON FeatureCollection
  router.get('/comparable-activity', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const lat = parseFloat(req.query['lat'] as string ?? '');
    const lon = parseFloat(req.query['lng'] as string ?? '');
    const radiusMiles = parseFloat(req.query['radiusMiles'] as string ?? '5');

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' } }); return;
    }

    // Bounding box for Cosmos pre-filter
    const latDelta = radiusMiles / 69;
    const lonDelta = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query({
        query: `SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.lat >= @minLat AND c.lat <= @maxLat AND c.lon >= @minLon AND c.lon <= @maxLon AND c.status = 'sold' OFFSET 0 LIMIT 200`,
        parameters: [
          { name: '@type', value: 'off-market-property' },
          { name: '@tenantId', value: tenantId },
          { name: '@minLat', value: minLat },
          { name: '@maxLat', value: maxLat },
          { name: '@minLon', value: minLon },
          { name: '@maxLon', value: maxLon },
        ],
      }).fetchAll();

      // Haversine distance filter + GeoJSON transform
      const features = resources
        .filter((p: any) => {
          const dLat = (p.lat - lat) * Math.PI / 180;
          const dLon = (p.lon - lon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const distMiles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return distMiles <= radiusMiles;
        })
        .map((p: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: {
            id: p.id,
            address: p.address,
            city: p.city,
            salePrice: p.salePrice,
            status: p.status,
            saleType: p.saleType,
            updatedAt: p.updatedAt,
          },
        }));

      res.json({
        success: true,
        type: 'FeatureCollection',
        features,
        meta: { lat, lon, radiusMiles, returned: features.length },
      });
    } catch (error) {
      logger.error('Failed to get comparable activity', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve comparable activity' } });
    }
  });

  // ─── GET /stats/:zipCode ───────────────────────────────────────────────────
  router.get('/stats/:zipCode', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const zipCode = req.params['zipCode'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<MarketStats>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.zipCode = @zipCode ORDER BY c.calculatedForMonth DESC OFFSET 0 LIMIT 1',
        parameters: [
          { name: '@type', value: 'market-stats' },
          { name: '@zipCode', value: zipCode },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No market stats for zip ${zipCode}` } }); return; }

      res.json({ success: true, data: resources[0] });
    } catch (error) {
      logger.error('Failed to get market stats', { error, tenantId, zipCode });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve market stats' } });
    }
  });

  return router;
}
