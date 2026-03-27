/**
 * Investor Activity Tracking controller (Phase 3.1)
 *
 * Routes (mounted at /api/investors):
 *   POST /search                    — search investors by market, strategy, price band
 *   GET  /:id                       — investor profile + recent transactions
 *   GET  /market/:zipCode           — top investors active in a zip
 *   POST /                          — create investor profile (manual / admin)
 *   PUT  /:id                       — update investor profile
 *   POST /:id/transactions          — record a transaction (acquisition or sale)
 *   GET  /:id/transactions          — list transactions for an investor
 *
 * Cosmos container: uses existing 'properties' container with type discriminator 'investor-profile'
 * and 'investor-transaction'. No new infra required until dedicated containers are provisioned.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  InvestorProfile,
  InvestorTransaction,
  InvestorSearchRequest,
  CreateInvestorTransactionRequest,
} from '../types/investor.types.js';

const CONTAINER = 'properties';

export function createInvestorRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── POST /search ──────────────────────────────────────────────────────────
  router.post('/search', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    try {
      const body = req.body as InvestorSearchRequest;
      const page = Math.max(1, body.page ?? 1);
      const limit = Math.min(100, Math.max(1, body.limit ?? 20));
      const offset = (page - 1) * limit;

      const where = [
        'c.type = @type',
        'c.tenantId = @tenantId',
        ...(body.market !== undefined ? ['ARRAY_CONTAINS(c.primaryMarkets, @market)'] : []),
        ...(body.strategy !== undefined ? ['ARRAY_CONTAINS(c.strategies, @strategy)'] : []),
        ...(body.entityType !== undefined ? ['c.entityType = @entityType'] : []),
        ...(body.minPurchasePrice !== undefined ? ['c.avgPurchasePrice >= @minPurchasePrice'] : []),
        ...(body.maxPurchasePrice !== undefined ? ['c.avgPurchasePrice <= @maxPurchasePrice'] : []),
        ...(body.activeWithinDays !== undefined ? ['c.lastSeenAt >= @activeAfter'] : []),
      ].join(' AND ');

      const now = new Date();
      type Param = { name: string; value: string | number | boolean | null };
      const parameters: Param[] = [
        { name: '@type', value: 'investor-profile' },
        { name: '@tenantId', value: tenantId },
        ...(body.market !== undefined ? [{ name: '@market', value: body.market }] : []),
        ...(body.strategy !== undefined ? [{ name: '@strategy', value: body.strategy }] : []),
        ...(body.entityType !== undefined ? [{ name: '@entityType', value: body.entityType }] : []),
        ...(body.minPurchasePrice !== undefined ? [{ name: '@minPurchasePrice', value: body.minPurchasePrice }] : []),
        ...(body.maxPurchasePrice !== undefined ? [{ name: '@maxPurchasePrice', value: body.maxPurchasePrice }] : []),
        ...(body.activeWithinDays !== undefined ? [{
          name: '@activeAfter',
          value: new Date(now.getTime() - body.activeWithinDays * 86400000).toISOString(),
        }] : []),
      ];

      const container = db.getContainer(CONTAINER);
      const countResult = await container.items.query({
        query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`,
        parameters,
      }).fetchAll();
      const countRow = countResult.resources[0] as number | undefined;
      const total: number = countRow ?? 0;

      const { resources } = await container.items.query<InvestorProfile>({
        query: `SELECT * FROM c WHERE ${where} ORDER BY c.lastSeenAt DESC OFFSET ${offset} LIMIT ${limit}`,
        parameters,
      }).fetchAll();

      res.json({ success: true, data: resources, total, page, limit, hasMore: offset + resources.length < total });
    } catch (error) {
      logger.error('Failed to search investors', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Search failed' } });
    }
  });

  // ─── GET /market/:zipCode ─── top investors in a zip ─────────────────────
  router.get('/market/:zipCode', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const zipCode = req.params['zipCode'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestorProfile>({
        query: `SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND ARRAY_CONTAINS(c.activeZipCodes, @zip) ORDER BY c.acquisitionCount DESC OFFSET 0 LIMIT 25`,
        parameters: [
          { name: '@type', value: 'investor-profile' },
          { name: '@tenantId', value: tenantId },
          { name: '@zip', value: zipCode },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources, zipCode });
    } catch (error) {
      logger.error('Failed to get market investors', { error, tenantId, zipCode });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve market data' } });
    }
  });

  // ─── GET /:id ──────────────────────────────────────────────────────────────
  router.get('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources: profiles } = await container.items.query<InvestorProfile>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'investor-profile' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
        ],
      }).fetchAll();

      if (!profiles[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Investor ${id} not found` } }); return; }

      // Fetch recent transactions (last 20)
      const { resources: transactions } = await container.items.query<InvestorTransaction>({
        query: `SELECT * FROM c WHERE c.type = @txType AND c.tenantId = @tenantId AND c.investorId = @investorId ORDER BY c.acquisitionDate DESC OFFSET 0 LIMIT 20`,
        parameters: [
          { name: '@txType', value: 'investor-transaction' },
          { name: '@tenantId', value: tenantId },
          { name: '@investorId', value: id },
        ],
      }).fetchAll();

      res.json({ success: true, data: profiles[0], transactions });
    } catch (error) {
      logger.error('Failed to get investor', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve investor' } });
    }
  });

  // ─── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as Partial<InvestorProfile>;
    if (!body.entityName) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'entityName is required' } }); return; }
    if (!body.entityType) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'entityType is required' } }); return; }

    const now = new Date().toISOString();
    const profile: InvestorProfile = {
      id: uuidv4(),
      tenantId,
      type: 'investor-profile',
      entityName: body.entityName as string,
      entityType: body.entityType,
      primaryMarkets: body.primaryMarkets ?? [],
      acquisitionCount: 0,
      avgPurchasePrice: 0,
      avgHoldDays: 0,
      strategies: body.strategies ?? [],
      activeZipCodes: [],
      totalVolumeDealt: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const container = db.getContainer(CONTAINER);
      await container.items.create(profile);
      res.status(201).json({ success: true, data: profile });
    } catch (error) {
      logger.error('Failed to create investor profile', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create investor profile' } });
    }
  });

  // ─── PUT /:id ──────────────────────────────────────────────────────────────
  router.put('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestorProfile>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'investor-profile' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Investor ${id} not found` } }); return; }

      const body = req.body as Partial<InvestorProfile>;
      const updated: InvestorProfile = {
        ...resources[0],
        ...(body.entityName !== undefined ? { entityName: body.entityName } : {}),
        ...(body.entityType !== undefined ? { entityType: body.entityType } : {}),
        ...(body.primaryMarkets !== undefined ? { primaryMarkets: body.primaryMarkets } : {}),
        ...(body.strategies !== undefined ? { strategies: body.strategies } : {}),
        updatedAt: new Date().toISOString(),
      };

      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update investor', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update investor' } });
    }
  });

  // ─── POST /:id/transactions ────────────────────────────────────────────────
  router.post('/:id/transactions', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const investorId = req.params['id'] as string;
    const body = req.body as CreateInvestorTransactionRequest;

    if (!body.address) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'address is required' } }); return; }
    if (!body.zipCode) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'zipCode is required' } }); return; }
    if (!body.acquisitionPrice) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'acquisitionPrice is required' } }); return; }
    if (!body.acquisitionDate) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'acquisitionDate is required' } }); return; }
    if (!body.dataSource) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'dataSource is required' } }); return; }

    const holdDays = body.saleDate
      ? Math.floor((new Date(body.saleDate).getTime() - new Date(body.acquisitionDate).getTime()) / 86400000)
      : undefined;

    const now = new Date().toISOString();
    const tx: InvestorTransaction = {
      id: uuidv4(),
      tenantId,
      type: 'investor-transaction',
      investorId,
      address: body.address as string,
      city: body.city as string,
      state: body.state as string,
      zipCode: body.zipCode as string,
      acquisitionPrice: body.acquisitionPrice,
      acquisitionDate: body.acquisitionDate as string,
      dataSource: body.dataSource,
      ...(body.lat !== undefined ? { lat: body.lat } : {}),
      ...(body.lon !== undefined ? { lon: body.lon } : {}),
      ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
      ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
      ...(holdDays !== undefined ? { holdDays } : {}),
      ...(body.strategy !== undefined ? { strategy: body.strategy } : {}),
      ...(body.mlsNumber !== undefined ? { mlsNumber: body.mlsNumber } : {}),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const container = db.getContainer(CONTAINER);

      // Verify investor exists in this tenant
      const { resources: profiles } = await container.items.query<InvestorProfile>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'investor-profile' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: investorId },
        ],
      }).fetchAll();
      if (!profiles[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Investor ${investorId} not found` } }); return; }

      await container.items.create(tx);

      // Roll up stats on the investor profile
      const profile = profiles[0];
      const newAcqCount = profile.acquisitionCount + 1;
      const newTotal = profile.totalVolumeDealt + body.acquisitionPrice;
      const newAvg = newTotal / newAcqCount;
      const zipCodes = profile.activeZipCodes.includes(body.zipCode)
        ? profile.activeZipCodes
        : [...profile.activeZipCodes, body.zipCode].slice(-20); // keep last 20 unique

      const updatedProfile: InvestorProfile = {
        ...profile,
        acquisitionCount: newAcqCount,
        totalVolumeDealt: newTotal,
        avgPurchasePrice: Math.round(newAvg),
        activeZipCodes: zipCodes,
        lastSeenAt: body.acquisitionDate,
        ...(holdDays !== undefined ? { avgHoldDays: Math.round((profile.avgHoldDays * (newAcqCount - 1) + holdDays) / newAcqCount) } : {}),
        updatedAt: now,
      };
      await container.items.upsert(updatedProfile);

      res.status(201).json({ success: true, data: tx });
    } catch (error) {
      logger.error('Failed to record investor transaction', { error, tenantId, investorId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record transaction' } });
    }
  });

  // ─── GET /:id/transactions ─────────────────────────────────────────────────
  router.get('/:id/transactions', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const investorId = req.params['id'] as string;
    const page = Math.max(1, parseInt(req.query['page'] as string ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string ?? '20', 10)));
    const offset = (page - 1) * limit;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestorTransaction>({
        query: `SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.investorId = @investorId ORDER BY c.acquisitionDate DESC OFFSET ${offset} LIMIT ${limit}`,
        parameters: [
          { name: '@type', value: 'investor-transaction' },
          { name: '@tenantId', value: tenantId },
          { name: '@investorId', value: investorId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources, page, limit });
    } catch (error) {
      logger.error('Failed to get investor transactions', { error, tenantId, investorId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve transactions' } });
    }
  });

  return router;
}
