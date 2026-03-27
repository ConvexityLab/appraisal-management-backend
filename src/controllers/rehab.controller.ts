/**
 * Rehab Records controller — Before/After Photos + Rehab Cost Data (Phase 3.4)
 *
 * Routes (mounted at /api/rehab):
 *   POST /                          — create rehab record
 *   GET  /:propertyId               — get rehab record for a property
 *   PUT  /:propertyId               — update rehab line items + costs
 *   DELETE /:propertyId             — delete rehab record
 *   POST /:propertyId/before-photos — upload before photos (metadata; blob upload is client-direct)
 *   POST /:propertyId/after-photos  — upload after photos (metadata)
 *   DELETE /:propertyId/photos/:photoId — remove a photo record
 *
 * Photo storage: Azure Blob Storage container 'rehab-photos' (provisioned via infra Bicep).
 * This controller stores photo METADATA only in Cosmos (PhotoRecord without signed URL).
 * Signed URLs are generated on GET via Azure Blob SAS tokens.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  RehabRecord,
  RehabLineItem,
  PhotoRecord,
  CreateRehabRecordRequest,
  UpdateRehabRecordRequest,
} from '../types/rehab.types.js';

const CONTAINER = 'properties';

export function createRehabRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as CreateRehabRecordRequest;
    if (!body.propertyId) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }); return; }
    if (!body.address) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'address is required' } }); return; }
    if (!body.acquisitionPrice) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'acquisitionPrice is required' } }); return; }
    if (!body.acquisitionDate) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'acquisitionDate is required' } }); return; }
    if (!body.rehabBudget) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'rehabBudget is required' } }); return; }

    const now = new Date().toISOString();
    const lineItems: RehabLineItem[] = (body.rehabLineItems ?? []).map(li => ({ ...li, id: uuidv4() }));

    const record: RehabRecord = {
      id: uuidv4(),
      tenantId,
      type: 'rehab-record',
      propertyId: body.propertyId as string,
      address: body.address as string,
      city: body.city as string,
      state: body.state as string,
      zipCode: body.zipCode as string,
      acquisitionPrice: body.acquisitionPrice,
      acquisitionDate: body.acquisitionDate as string,
      rehabBudget: body.rehabBudget,
      beforePhotos: [],
      afterPhotos: [],
      rehabLineItems: lineItems,
      addedBy: userId,
      createdAt: now,
      updatedAt: now,
      ...(body.strategy !== undefined ? { strategy: body.strategy } : {}),
      ...(body.rehabActual !== undefined ? { rehabActual: body.rehabActual } : {}),
      ...(body.rehabStartDate !== undefined ? { rehabStartDate: body.rehabStartDate } : {}),
      ...(body.rehabCompletedDate !== undefined ? { rehabCompletedDate: body.rehabCompletedDate } : {}),
      ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
      ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    };

    try {
      const container = db.getContainer(CONTAINER);
      await container.items.create(record);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      logger.error('Failed to create rehab record', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rehab record' } });
    }
  });

  // ─── GET /:propertyId ──────────────────────────────────────────────────────
  router.get('/:propertyId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const propertyId = req.params['propertyId'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<RehabRecord>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId',
        parameters: [
          { name: '@type', value: 'rehab-record' },
          { name: '@tenantId', value: tenantId },
          { name: '@propertyId', value: propertyId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No rehab record found for property ${propertyId}` } }); return; }

      // Note: returning stored photo records without signed URLs.
      // Caller should use Azure Blob SAS endpoint to get signed URLs.
      res.json({ success: true, data: resources[0] });
    } catch (error) {
      logger.error('Failed to get rehab record', { error, tenantId, propertyId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve rehab record' } });
    }
  });

  // ─── PUT /:propertyId ──────────────────────────────────────────────────────
  router.put('/:propertyId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const propertyId = req.params['propertyId'] as string;
    const body = req.body as UpdateRehabRecordRequest;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<RehabRecord>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId',
        parameters: [
          { name: '@type', value: 'rehab-record' },
          { name: '@tenantId', value: tenantId },
          { name: '@propertyId', value: propertyId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No rehab record found for property ${propertyId}` } }); return; }

      const updated: RehabRecord = {
        ...resources[0],
        ...(body.rehabActual !== undefined ? { rehabActual: body.rehabActual } : {}),
        ...(body.rehabStartDate !== undefined ? { rehabStartDate: body.rehabStartDate } : {}),
        ...(body.rehabCompletedDate !== undefined ? { rehabCompletedDate: body.rehabCompletedDate } : {}),
        ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
        ...(body.saleDate !== undefined ? { saleDate: body.saleDate } : {}),
        ...(body.rehabLineItems !== undefined ? { rehabLineItems: body.rehabLineItems } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update rehab record', { error, tenantId, propertyId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rehab record' } });
    }
  });

  // ─── DELETE /:propertyId ───────────────────────────────────────────────────
  router.delete('/:propertyId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const propertyId = req.params['propertyId'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<RehabRecord>({
        query: 'SELECT c.id FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId',
        parameters: [
          { name: '@type', value: 'rehab-record' },
          { name: '@tenantId', value: tenantId },
          { name: '@propertyId', value: propertyId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No rehab record found for property ${propertyId}` } }); return; }

      await db.deleteDocument(CONTAINER, resources[0].id, tenantId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete rehab record', { error, tenantId, propertyId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rehab record' } });
    }
  });

  // ─── POST /:propertyId/before-photos ──────────────────────────────────────
  router.post('/:propertyId/before-photos', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    await handlePhotoUpload(req, res, 'before', db, logger);
  });

  // ─── POST /:propertyId/after-photos ───────────────────────────────────────────
  router.post('/:propertyId/after-photos', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    await handlePhotoUpload(req, res, 'after', db, logger);
  });

  // ─── DELETE /:propertyId/photos/:photoId ──────────────────────────────────
  router.delete('/:propertyId/photos/:photoId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const propertyId = req.params['propertyId'] as string;
    const photoId = req.params['photoId'] as string;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<RehabRecord>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId',
        parameters: [
          { name: '@type', value: 'rehab-record' },
          { name: '@tenantId', value: tenantId },
          { name: '@propertyId', value: propertyId },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No rehab record found for property ${propertyId}` } }); return; }

      const record = resources[0];
      const updated: RehabRecord = {
        ...record,
        beforePhotos: record.beforePhotos.filter(p => p.id !== photoId),
        afterPhotos: record.afterPhotos.filter(p => p.id !== photoId),
        updatedAt: new Date().toISOString(),
      };
      await container.items.upsert(updated);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete photo', { error, tenantId, propertyId, photoId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete photo' } });
    }
  });

  return router;
}

async function handlePhotoUpload(
  req: UnifiedAuthRequest,
  res: Response,
  phase: 'before' | 'after',
  db: CosmosDbService,
  logger: Logger,
): Promise<void> {
  const tenantId = req.user?.tenantId;
  const userId = req.user?.id;
  if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

  const propertyId = req.params['propertyId'] as string;
  const body = req.body as { blobName: string; caption?: string; takenAt?: string };

  if (!body.blobName) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'blobName is required' } }); return; }

  const now = new Date().toISOString();
  const photo: PhotoRecord = {
    id: uuidv4(),
    blobName: body.blobName as string,
    uploadedBy: userId,
    uploadedAt: now,
    ...(body.caption !== undefined ? { caption: body.caption } : {}),
    ...(body.takenAt !== undefined ? { takenAt: body.takenAt } : {}),
  };

  try {
    const container = db.getContainer(CONTAINER);
    const { resources } = await container.items.query<RehabRecord>({
      query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId',
      parameters: [
        { name: '@type', value: 'rehab-record' },
        { name: '@tenantId', value: tenantId },
        { name: '@propertyId', value: propertyId },
      ],
    }).fetchAll();

    if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No rehab record found for property ${propertyId}` } }); return; }

    const record = resources[0];
    const updated: RehabRecord = {
      ...record,
      beforePhotos: phase === 'before' ? [...record.beforePhotos, photo] : record.beforePhotos,
      afterPhotos: phase === 'after' ? [...record.afterPhotos, photo] : record.afterPhotos,
      updatedAt: now,
    };
    await container.items.upsert(updated);
    res.status(201).json({ success: true, data: photo });
  } catch (error) {
    logger.error('Failed to add photo', { error, tenantId, propertyId });
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add photo' } });
  }
}
