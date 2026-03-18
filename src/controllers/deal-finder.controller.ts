/**
 * Auto Deal Finder controller (Phase 3.2)
 *
 * Routes (mounted at /api/deal-finder):
 *   POST /buy-boxes                    — create buy-box
 *   GET  /buy-boxes                    — list buy-boxes for tenant
 *   PUT  /buy-boxes/:id                — update buy-box
 *   DELETE /buy-boxes/:id              — delete buy-box
 *   POST /run                          — run deal finder, returns DealFinderRun + matches
 *   GET  /results/:runId               — paginated results for a run
 *
 * Scoring algorithm:
 *   priceToBudget (25 pts): (1 - listPrice / maxPurchasePrice) * 25, clamped 0–25
 *   arvSpread (25 pts): if targetArv set, (1 - listPrice / targetArv) * 25
 *   daysOnMarket (25 pts): inverse sigmoid — 0 DOM = 0 pts (fresh), 90+ DOM = 25 pts (motivated seller)
 *   cocReturn (25 pts): requires monthlyRent estimate — deferred (returns 0 when not available)
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  BuyBox,
  DealMatch,
  DealFinderRun,
  CreateBuyBoxRequest,
  RunDealFinderRequest,
} from '../types/deal-finder.types.js';
import type { OffMarketProperty } from '../types/off-market.types.js';

const CONTAINER = 'properties';

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function scorePriceToBudget(listPrice: number, maxBudget: number): number {
  if (listPrice >= maxBudget) return 0;
  return Math.min(25, Math.max(0, (1 - listPrice / maxBudget) * 25));
}

function scoreArvSpread(listPrice: number, targetArv: number | undefined): number {
  if (!targetArv || targetArv <= listPrice) return 0;
  return Math.min(25, Math.max(0, (1 - listPrice / targetArv) * 25));
}

function scoreDaysOnMarket(daysOnMarket: number | undefined): number {
  if (daysOnMarket === undefined) return 0;
  // Motivated seller signal increases with DOM — sigmoid-like curve
  const d = Math.max(0, daysOnMarket);
  return Math.min(25, (d / 90) * 25);
}

function computeDealScore(
  listPrice: number,
  buyBox: BuyBox,
  daysOnMarket?: number,
): { score: number; breakdown: DealMatch['scoreBreakdown'] } {
  const priceToBudget = scorePriceToBudget(listPrice, buyBox.maxPurchasePrice);
  const arvSpread = scoreArvSpread(listPrice, buyBox.targetArv);
  const domScore = scoreDaysOnMarket(daysOnMarket);
  const score = Math.round(priceToBudget + arvSpread + domScore);
  return {
    score,
    breakdown: {
      priceToBudget: Math.round(priceToBudget),
      ...(buyBox.targetArv !== undefined ? { arvSpread: Math.round(arvSpread) } : {}),
      ...(daysOnMarket !== undefined ? { daysOnMarket: Math.round(domScore) } : {}),
    },
  };
}

export function createDealFinderRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── POST /buy-boxes ───────────────────────────────────────────────────────
  router.post('/buy-boxes', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as CreateBuyBoxRequest;
    if (!body.name) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } }); return; }
    if (!body.markets?.length) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'markets is required' } }); return; }
    if (!body.maxPurchasePrice) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'maxPurchasePrice is required' } }); return; }

    const now = new Date().toISOString();
    const buyBox: BuyBox = {
      id: uuidv4(),
      tenantId,
      investorId: body.investorId as string,
      type: 'buy-box',
      name: body.name as string,
      markets: body.markets,
      propertyTypes: body.propertyTypes ?? [],
      maxPurchasePrice: body.maxPurchasePrice,
      strategies: body.strategies ?? [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...(body.minBeds !== undefined ? { minBeds: body.minBeds } : {}),
      ...(body.maxBeds !== undefined ? { maxBeds: body.maxBeds } : {}),
      ...(body.minSqft !== undefined ? { minSqft: body.minSqft } : {}),
      ...(body.maxSqft !== undefined ? { maxSqft: body.maxSqft } : {}),
      ...(body.targetArv !== undefined ? { targetArv: body.targetArv } : {}),
      ...(body.maxRehabBudget !== undefined ? { maxRehabBudget: body.maxRehabBudget } : {}),
      ...(body.minCocReturn !== undefined ? { minCocReturn: body.minCocReturn } : {}),
    };

    try {
      const container = db.getContainer(CONTAINER);
      await container.items.create(buyBox);
      res.status(201).json({ success: true, data: buyBox });
    } catch (error) {
      logger.error('Failed to create buy-box', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create buy-box' } });
    }
  });

  // ─── GET /buy-boxes ────────────────────────────────────────────────────────
  router.get('/buy-boxes', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<BuyBox>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: 'buy-box' },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();
      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to list buy-boxes', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list buy-boxes' } });
    }
  });

  // ─── PUT /buy-boxes/:id ────────────────────────────────────────────────────
  router.put('/buy-boxes/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<BuyBox>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'buy-box' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Buy-box ${id} not found` } }); return; }

      const body = req.body as Partial<BuyBox>;
      const updated: BuyBox = {
        ...resources[0],
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.markets !== undefined ? { markets: body.markets } : {}),
        ...(body.propertyTypes !== undefined ? { propertyTypes: body.propertyTypes } : {}),
        ...(body.minBeds !== undefined ? { minBeds: body.minBeds } : {}),
        ...(body.maxBeds !== undefined ? { maxBeds: body.maxBeds } : {}),
        ...(body.minSqft !== undefined ? { minSqft: body.minSqft } : {}),
        ...(body.maxSqft !== undefined ? { maxSqft: body.maxSqft } : {}),
        ...(body.maxPurchasePrice !== undefined ? { maxPurchasePrice: body.maxPurchasePrice } : {}),
        ...(body.targetArv !== undefined ? { targetArv: body.targetArv } : {}),
        ...(body.maxRehabBudget !== undefined ? { maxRehabBudget: body.maxRehabBudget } : {}),
        ...(body.strategies !== undefined ? { strategies: body.strategies } : {}),
        ...(body.minCocReturn !== undefined ? { minCocReturn: body.minCocReturn } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update buy-box', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update buy-box' } });
    }
  });

  // ─── DELETE /buy-boxes/:id ─────────────────────────────────────────────────
  router.delete('/buy-boxes/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      await db.deleteDocument(CONTAINER, id, tenantId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete buy-box', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete buy-box' } });
    }
  });

  // ─── POST /run ─────────────────────────────────────────────────────────────
  router.post('/run', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as RunDealFinderRequest;
    if (!body.buyBoxId) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'buyBoxId is required' } }); return; }

    const limit = Math.min(200, Math.max(1, body.limit ?? 50));
    const now = new Date().toISOString();
    const runId = uuidv4();

    try {
      const container = db.getContainer(CONTAINER);

      // Load buy-box
      const { resources: boxes } = await container.items.query<BuyBox>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'buy-box' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: body.buyBoxId },
        ],
      }).fetchAll();
      if (!boxes[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Buy-box ${body.buyBoxId} not found` } }); return; }

      const buyBox = boxes[0];

      // Search off-market properties matching buy-box markets and price
      const sources = body.sources ?? ['off_market'];
      const matches: DealMatch[] = [];

      if (sources.includes('off_market')) {
        // Build market filter: match any zip in buyBox.markets
        const zipParams = buyBox.markets.map((z, i) => ({ name: `@zip${i}`, value: z }));
        const zipList = zipParams.map(p => p.name).join(', ');
        const { resources: offMarket } = await container.items.query<OffMarketProperty>({
          query: `SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.zipCode IN (${zipList}) AND c.status IN ('active', 'pending') OFFSET 0 LIMIT 500`,
          parameters: [
            { name: '@type', value: 'off-market-property' },
            { name: '@tenantId', value: tenantId },
            ...zipParams,
          ],
        }).fetchAll();

        for (const prop of offMarket) {
          // Price filter
          if (!prop.salePrice || prop.salePrice > buyBox.maxPurchasePrice) continue;

          const { score, breakdown } = computeDealScore(prop.salePrice, buyBox, undefined);
          if (score <= 0) continue;

          const match: DealMatch = {
            id: uuidv4(),
            tenantId,
            buyBoxId: buyBox.id,
            runId,
            type: 'deal-match',
            source: 'off_market',
            sourceId: prop.id,
            address: prop.address,
            city: prop.city,
            state: prop.state,
            zipCode: prop.zipCode,
            listPrice: prop.salePrice,
            score,
            scoreBreakdown: breakdown,
            createdAt: now,
            ...(prop.latitude !== undefined ? { lat: prop.latitude } : {}),
            ...(prop.longitude !== undefined ? { lon: prop.longitude } : {}),
          };
          matches.push(match);
        }
      }

      // Sort by score descending, limit
      matches.sort((a, b) => b.score - a.score);
      const topMatches = matches.slice(0, limit);

      // Persist run record + top matches
      const run: DealFinderRun = {
        id: runId,
        tenantId,
        buyBoxId: buyBox.id,
        type: 'deal-finder-run',
        status: 'completed',
        matchCount: topMatches.length,
        startedAt: now,
        completedAt: new Date().toISOString(),
      };
      await container.items.create(run);
      for (const m of topMatches) {
        await container.items.create(m);
      }

      res.status(201).json({ success: true, data: { run, matches: topMatches } });
    } catch (error) {
      logger.error('Failed to run deal finder', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Deal finder run failed' } });
    }
  });

  // ─── GET /results/:runId ───────────────────────────────────────────────────
  router.get('/results/:runId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const runId = req.params['runId'] as string;
    const page = Math.max(1, parseInt(req.query['page'] as string ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string ?? '20', 10)));
    const offset = (page - 1) * limit;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<DealMatch>({
        query: `SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.runId = @runId ORDER BY c.score DESC OFFSET ${offset} LIMIT ${limit}`,
        parameters: [
          { name: '@type', value: 'deal-match' },
          { name: '@tenantId', value: tenantId },
          { name: '@runId', value: runId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources, page, limit });
    } catch (error) {
      logger.error('Failed to get deal finder results', { error, tenantId, runId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve results' } });
    }
  });

  return router;
}
