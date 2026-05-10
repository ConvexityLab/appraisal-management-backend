import { Request, Response, Router } from 'express';
import { PropertyRecordService } from '../services/property-record.service.js';
import { listPropertyRecords } from '../services/property-record-listing.service.js';
import { Logger } from '../utils/logger.js';

type AuthenticatedRequestLike = Request & {
  user?: {
    id?: string;
    tenantId?: string;
  };
};

function resolveTenantId(req: Request): string {
  const authenticatedTenantId = (req as AuthenticatedRequestLike).user?.tenantId;
  const headerTenantId = req.headers['x-tenant-id'];

  if (typeof authenticatedTenantId === 'string' && authenticatedTenantId.trim()) {
    return authenticatedTenantId;
  }

  if (typeof headerTenantId === 'string' && headerTenantId.trim()) {
    return headerTenantId;
  }

  return 'default-tenant';
}

function resolveActorId(req: Request): string {
  const authenticatedUserId = (req as AuthenticatedRequestLike).user?.id;
  const headerUserId = req.headers['x-user-id'];

  if (typeof authenticatedUserId === 'string' && authenticatedUserId.trim()) {
    return authenticatedUserId;
  }

  if (typeof headerUserId === 'string' && headerUserId.trim()) {
    return headerUserId;
  }

  return 'system';
}

export function createPropertyRecordRouter(propertyRecordService: PropertyRecordService): Router {
  const router = Router();
  const logger = new Logger('PropertyRecordController');

  /**
   * GET /api/v1/property-records
   * Lists canonical PropertyRecords from the property-records container.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const listInput = {
        tenantId,
        ...(typeof req.query.q === 'string' ? { q: req.query.q } : {}),
        ...(typeof req.query.city === 'string' ? { city: req.query.city } : {}),
        ...(typeof req.query.state === 'string' ? { state: req.query.state } : {}),
        ...(typeof req.query.propertyType === 'string' ? { propertyType: req.query.propertyType } : {}),
        ...(typeof req.query.limit === 'string' ? { limit: Number.parseInt(req.query.limit, 10) } : {}),
        ...(typeof req.query.offset === 'string' ? { offset: Number.parseInt(req.query.offset, 10) } : {}),
        ...(typeof req.query.sortBy === 'string' ? { sortBy: req.query.sortBy as 'updatedAt' | 'createdAt' | 'address.street' | 'apn' | 'recordVersion' } : {}),
        ...(typeof req.query.sortOrder === 'string' ? { sortOrder: req.query.sortOrder as 'asc' | 'desc' } : {}),
      };
      const result = await listPropertyRecords(
        (propertyRecordService as any).cosmosService,
        listInput,
      );

      return res.status(200).json({
        data: result.items,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.items.length < result.total,
        },
      });
    } catch (error) {
      logger.error('Failed to list property records', { error });
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/properties/:propertyId/events
   * Returns the event stream (version history) for a property.
   * Can optionally filter to returning events that modified specific fields.
   */
  router.get('/:propertyId/events', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const history = await propertyRecordService.getVersionHistory(propertyId, tenantId);

      // Optional field filtering via ?fields=building.bedrooms,building.gla
      const fieldsQuery = req.query.fields as string;
      let filteredHistory = history;

      if (fieldsQuery) {
        const fieldsToFind = fieldsQuery.split(',').map(f => f.trim());
        filteredHistory = history.filter(entry => 
          entry.changedFields.some(changed => fieldsToFind.includes(changed))
        );
      }

      // Format as event stream
      const events = filteredHistory.map(entry => ({
        version: entry.version,
        timestamp: entry.createdAt,
        actor: entry.createdBy,
        actionType: entry.reason,
        source: entry.source,
        sourceProvider: entry.sourceProvider,
        sourceArtifactId: entry.sourceArtifactId,
        changedFields: entry.changedFields,
        previousValues: entry.previousValues,
        newValues: entry.newValues || {}, // Fallback for old versions without newValues
      })).reverse(); // Reverse chronological order for UI feed

      return res.status(200).json({ success: true, events });
    } catch (error) {
      logger.error('Failed to retrieve property event stream', { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/v1/property-records/:propertyId
   * GET /api/properties/:propertyId
   * Returns the canonical property record.
   */
  router.get('/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const record = await propertyRecordService.getById(propertyId, tenantId);
      return res.status(200).json(record);
    } catch (error) {
      logger.error(`Failed to retrieve property record ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found') || msg.includes('Not Found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * PATCH /api/v1/property-records/:propertyId
   * PATCH /api/properties/:propertyId
   * Updates fields on the canonical property record.
   */
  router.patch('/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);
      const actor = resolveActorId(req);

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      // This uses createVersion which saves a new record version in Cosmos.
      const updated = await propertyRecordService.createVersion(
        propertyId,
        tenantId,
        req.body,
        'manual_update',
        'MANUAL_CORRECTION',
        actor,
        'api'
      );

      return res.status(200).json(updated);
    } catch (error) {
      logger.error(`Failed to patch property record ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  return router;
}
