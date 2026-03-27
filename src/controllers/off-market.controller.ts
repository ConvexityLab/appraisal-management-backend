/**
 * Off-Market Property Controller
 *
 * API for managing non-MLS comparable sales and distressed property data.
 *
 * Routes (mounted at /api/off-market):
 *   GET    /properties           - Search / list off-market properties
 *   GET    /properties/:id       - Get single off-market property
 *   POST   /properties           - Add an off-market property
 *   PUT    /properties/:id       - Update an off-market property
 *   DELETE /properties/:id       - Delete an off-market property
 *   GET    /properties/nearby    - Find off-market comps near a lat/lon
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  OffMarketProperty,
  CreateOffMarketPropertyRequest,
  SearchOffMarketRequest,
  OffMarketPageResult,
  OffMarketSaleType,
  OffMarketPropertyStatus,
} from '../types/off-market.types.js';

const CONTAINER = 'properties';
const DOC_TYPE = 'off-market-property' as const;

// Haversine distance (miles) for in-query proximity filtering
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class OffMarketController {
  private readonly db: CosmosDbService;
  private readonly logger: Logger;

  constructor(db: CosmosDbService) {
    this.db = db;
    this.logger = new Logger('OffMarketController');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/off-market/properties?zipCode=&city=&status=&saleType=&page=&limit=
  // ─────────────────────────────────────────────────────────────────────────
  listProperties = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const query = req.query as Partial<{
      zipCode: string; city: string; status: string; saleType: string;
      dataSource: string; fromDate: string; toDate: string; page: string; limit: string;
    }>;

    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));
    const offset = (page - 1) * limit;

    try {
      const conditions: string[] = [
        'c.tenantId = @tid',
        `c.type = '${DOC_TYPE}'`,
      ];
      const parameters: { name: string; value: string }[] = [{ name: '@tid', value: tenantId }];

      if (query.zipCode) { conditions.push('c.zipCode = @zip'); parameters.push({ name: '@zip', value: query.zipCode }); }
      if (query.city) { conditions.push('CONTAINS(LOWER(c.city), @city)'); parameters.push({ name: '@city', value: query.city.toLowerCase() }); }
      if (query.status) { conditions.push('c.status = @status'); parameters.push({ name: '@status', value: query.status }); }
      if (query.saleType) { conditions.push('c.saleType = @saleType'); parameters.push({ name: '@saleType', value: query.saleType }); }
      if (query.dataSource) { conditions.push('c.dataSource = @dataSource'); parameters.push({ name: '@dataSource', value: query.dataSource }); }
      if (query.fromDate) { conditions.push('c.createdAt >= @fromDate'); parameters.push({ name: '@fromDate', value: query.fromDate }); }
      if (query.toDate) { conditions.push('c.createdAt <= @toDate'); parameters.push({ name: '@toDate', value: query.toDate }); }

      const where = conditions.join(' AND ');

      const container = this.db.getContainer(CONTAINER);
      const countResult = await container.items.query<{ count: number }>({
        query: `SELECT VALUE COUNT(1) FROM c WHERE ${where}`,
        parameters,
      }).fetchAll();
      const countRow = countResult.resources[0] as { count: number } | undefined;
      const total: number = countRow?.count ?? 0;

      const { resources } = await container.items.query<OffMarketProperty>({
        query: `SELECT * FROM c WHERE ${where} ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${limit}`,
        parameters,
      }).fetchAll();

      const result: OffMarketPageResult = { data: resources, total, page, limit, hasMore: offset + resources.length < total };
      res.json({ success: true, ...result });
    } catch (error) {
      this.logger.error('Failed to list off-market properties', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve off-market properties' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/off-market/properties/nearby?lat=&lon=&radius=&status=&saleType=&limit=
  // ─────────────────────────────────────────────────────────────────────────
  nearbyProperties = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const lat = parseFloat(req.query['lat'] as string ?? '');
    const lon = parseFloat(req.query['lon'] as string ?? '');
    const radiusMiles = parseFloat(req.query['radius'] as string ?? '1.0');
    const limit = Math.min(100, parseInt(req.query['limit'] as string ?? '25', 10));

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lat and lon query params are required' } });
      return;
    }

    try {
      // Cosmos DB doesn't support geospatial queries on this container; pull a bounding-box
      // set and filter in Node. Box = ±radiusMiles / 69 degrees latitude.
      const degreeBuffer = (radiusMiles + 1) / 69; // 1 mile padding

      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<OffMarketProperty>({
        query: `SELECT * FROM c
                WHERE c.tenantId = @tid
                  AND c.type = '${DOC_TYPE}'
                  AND IS_DEFINED(c.latitude)
                  AND c.latitude BETWEEN @latMin AND @latMax
                  AND c.longitude BETWEEN @lonMin AND @lonMax`,
        parameters: [
          { name: '@tid', value: tenantId },
          { name: '@latMin', value: lat - degreeBuffer },
          { name: '@latMax', value: lat + degreeBuffer },
          { name: '@lonMin', value: lon - degreeBuffer * 1.5 },
          { name: '@lonMax', value: lon + degreeBuffer * 1.5 },
        ],
      }).fetchAll();

      const nearby = resources
        .filter(p => p.latitude !== undefined && p.longitude !== undefined &&
          haversine(lat, lon, p.latitude!, p.longitude!) <= radiusMiles)
        .slice(0, limit);

      res.json({ success: true, data: nearby, total: nearby.length });
    } catch (error) {
      this.logger.error('Failed to find nearby off-market properties', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to find nearby properties' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/off-market/properties/:id
  // ─────────────────────────────────────────────────────────────────────────
  getProperty = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const id = req.params['id'] as string;
    try {
      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<OffMarketProperty>({
        query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid AND c.type = '${DOC_TYPE}'`,
        parameters: [{ name: '@id', value: id }, { name: '@tid', value: tenantId }],
      }).fetchAll();
      const doc = resources[0] ?? null;
      if (!doc) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Off-market property not found: ${id}` } }); return; }
      res.json({ success: true, data: doc });
    } catch (error) {
      this.logger.error('Failed to get off-market property', { error, id, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve property' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/off-market/properties
  // ─────────────────────────────────────────────────────────────────────────
  createProperty = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const addedBy = req.user?.id;
    if (!tenantId || !addedBy) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const body = req.body as Partial<CreateOffMarketPropertyRequest>;

    if (!body.address) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'address is required' } }); return; }
    if (!body.city) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'city is required' } }); return; }
    if (!body.state) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'state is required' } }); return; }
    if (!body.zipCode) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'zipCode is required' } }); return; }
    if (!body.saleType) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'saleType is required' } }); return; }
    if (!body.status) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status is required' } }); return; }

    try {
      const now = new Date().toISOString();
      const doc: OffMarketProperty = {
        id: uuidv4(),
        tenantId,
        type: DOC_TYPE,
        address: body.address,
        city: body.city,
        state: body.state,
        zipCode: body.zipCode,
        propertyType: body.propertyType ?? 'Residential',
        saleType: body.saleType as OffMarketSaleType,
        status: body.status as OffMarketPropertyStatus,
        dataSource: body.dataSource ?? 'manual',
        addedBy,
        createdAt: now,
        updatedAt: now,
        ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
        ...(body.squareFootage !== undefined ? { squareFootage: body.squareFootage } : {}),
        ...(body.bedrooms !== undefined ? { bedrooms: body.bedrooms } : {}),
        ...(body.bathrooms !== undefined ? { bathrooms: body.bathrooms } : {}),
        ...(body.yearBuilt !== undefined ? { yearBuilt: body.yearBuilt } : {}),
        ...(body.lotSize !== undefined ? { lotSize: body.lotSize } : {}),
        ...(body.listPrice !== undefined ? { listPrice: body.listPrice } : {}),
        ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
        ...(body.listDate !== undefined ? { listDate: body.listDate } : {}),
        ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
        ...(body.loanAmount !== undefined ? { loanAmount: body.loanAmount } : {}),
        ...(body.arrearsAmount !== undefined ? { arrearsAmount: body.arrearsAmount } : {}),
        ...(body.foreclosureStage !== undefined ? { foreclosureStage: body.foreclosureStage } : {}),
        ...(body.lenderName !== undefined ? { lenderName: body.lenderName } : {}),
        ...(body.caseNumber !== undefined ? { caseNumber: body.caseNumber } : {}),
        ...(body.sourceRecordId !== undefined ? { sourceRecordId: body.sourceRecordId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      };

      await this.db.createDocument(CONTAINER, doc);
      this.logger.info('Off-market property created', { id: doc.id, address: doc.address, tenantId });
      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      this.logger.error('Failed to create off-market property', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create off-market property' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PUT /api/off-market/properties/:id
  // ─────────────────────────────────────────────────────────────────────────
  updateProperty = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const id = req.params['id'] as string;
    const body = req.body as Partial<CreateOffMarketPropertyRequest>;

    try {
      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<OffMarketProperty>({
        query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid AND c.type = '${DOC_TYPE}'`,
        parameters: [{ name: '@id', value: id }, { name: '@tid', value: tenantId }],
      }).fetchAll();
      const existing = resources[0] ?? null;
      if (!existing) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Off-market property not found: ${id}` } }); return; }

      const updated: OffMarketProperty = {
        ...existing,
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.state !== undefined ? { state: body.state } : {}),
        ...(body.zipCode !== undefined ? { zipCode: body.zipCode } : {}),
        ...(body.propertyType !== undefined ? { propertyType: body.propertyType } : {}),
        ...(body.saleType !== undefined ? { saleType: body.saleType as OffMarketSaleType } : {}),
        ...(body.status !== undefined ? { status: body.status as OffMarketPropertyStatus } : {}),
        ...(body.dataSource !== undefined ? { dataSource: body.dataSource } : {}),
        ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
        ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
        ...(body.squareFootage !== undefined ? { squareFootage: body.squareFootage } : {}),
        ...(body.bedrooms !== undefined ? { bedrooms: body.bedrooms } : {}),
        ...(body.bathrooms !== undefined ? { bathrooms: body.bathrooms } : {}),
        ...(body.yearBuilt !== undefined ? { yearBuilt: body.yearBuilt } : {}),
        ...(body.lotSize !== undefined ? { lotSize: body.lotSize } : {}),
        ...(body.listPrice !== undefined ? { listPrice: body.listPrice } : {}),
        ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
        ...(body.listDate !== undefined ? { listDate: body.listDate } : {}),
        ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
        ...(body.loanAmount !== undefined ? { loanAmount: body.loanAmount } : {}),
        ...(body.arrearsAmount !== undefined ? { arrearsAmount: body.arrearsAmount } : {}),
        ...(body.foreclosureStage !== undefined ? { foreclosureStage: body.foreclosureStage } : {}),
        ...(body.lenderName !== undefined ? { lenderName: body.lenderName } : {}),
        ...(body.caseNumber !== undefined ? { caseNumber: body.caseNumber } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date().toISOString(),
      };

      await this.db.upsertDocument(CONTAINER, updated);
      this.logger.info('Off-market property updated', { id, tenantId });
      res.json({ success: true, data: updated });
    } catch (error) {
      this.logger.error('Failed to update off-market property', { error, id, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update property' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/off-market/properties/:id
  // ─────────────────────────────────────────────────────────────────────────
  deleteProperty = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }); return; }

    const id = req.params['id'] as string;
    try {
      await this.db.deleteDocument(CONTAINER, id, tenantId);
      this.logger.info('Off-market property deleted', { id, tenantId });
      res.json({ success: true, message: `Off-market property ${id} deleted` });
    } catch (error) {
      this.logger.error('Failed to delete off-market property', { error, id, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete property' } });
    }
  };
}

export function createOffMarketRouter(db: CosmosDbService): Router {
  const router = Router();
  const controller = new OffMarketController(db);

  router.get('/properties/nearby', controller.nearbyProperties);
  router.get('/properties', controller.listProperties);
  router.get('/properties/:id', controller.getProperty);
  router.post('/properties', controller.createProperty);
  router.put('/properties/:id', controller.updateProperty);
  router.delete('/properties/:id', controller.deleteProperty);

  return router;
}
