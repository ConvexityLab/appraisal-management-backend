import { Router, type Request, type Response } from 'express';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { VendorOutboxDocument } from '../types/vendor-integration.types.js';
import { vendorEventTraceService } from '../services/VendorEventTraceService.js';

const logger = new Logger('VendorOutboxMonitorController');
const VENDOR_EVENT_OUTBOX_CONTAINER = 'vendor-event-outbox';
const REVISIONS_CONTAINER = 'revisions';
const MAX_ACKNOWLEDGEMENT_NOTE_LENGTH = 500;

export function createVendorOutboxMonitorRouter(dbService: Pick<CosmosDbService, 'queryItems' | 'updateItem'>): Router {
  const router = Router();

  router.get('/summary', async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId ?? 'unknown';
    const nowIso = new Date().toISOString();

    try {
      const [pending, processing, failed, completed, deadLetter, oldestReady] = await Promise.all([
        countByStatus(dbService, tenantId, 'PENDING'),
        countByStatus(dbService, tenantId, 'PROCESSING'),
        countByStatus(dbService, tenantId, 'FAILED'),
        countByStatus(dbService, tenantId, 'COMPLETED'),
        countByStatus(dbService, tenantId, 'DEAD_LETTER'),
        dbService.queryItems<{ id: string; availableAt: string; vendorType: string; eventType: string }>(
          VENDOR_EVENT_OUTBOX_CONTAINER,
          [
            'SELECT TOP 1 c.id, c.availableAt, c.vendorType, c.eventType FROM c',
            'WHERE c.type = @type',
            'AND c.tenantId = @tenantId',
            'AND ARRAY_CONTAINS(@statuses, c.status)',
            'AND c.availableAt <= @now',
            'ORDER BY c.availableAt ASC',
          ].join(' '),
          [
            { name: '@type', value: 'vendor-event-outbox' },
            { name: '@tenantId', value: tenantId },
            { name: '@statuses', value: ['PENDING', 'FAILED'] },
            { name: '@now', value: nowIso },
          ],
        ),
      ]);

      const oldest = oldestReady.data?.[0];
      const oldestReadyAgeMinutes = oldest
        ? Math.max(0, Math.floor((Date.now() - Date.parse(oldest.availableAt)) / 60_000))
        : null;

      return res.status(200).json({
        success: true,
        data: {
          tenantId,
          statusCounts: {
            PENDING: pending,
            PROCESSING: processing,
            FAILED: failed,
            COMPLETED: completed,
            DEAD_LETTER: deadLetter,
          },
          readyBacklogCount: pending + failed,
          oldestReadyItem: oldest ?? null,
          oldestReadyAgeMinutes,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to compute vendor outbox summary', { tenantId, error: message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  router.get('/backlog', async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId ?? 'unknown';
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
    const nowIso = new Date().toISOString();

    try {
      const result = await dbService.queryItems<VendorOutboxListItem>(
        VENDOR_EVENT_OUTBOX_CONTAINER,
        [
          'SELECT TOP ' + limit,
          'c.id, c.status, c.vendorType, c.eventType, c.vendorOrderId, c.ourOrderId, c.availableAt, c.receivedAt, c.attemptCount, c.lastError,',
          'c.deadLetterAcknowledgedAt, c.deadLetterAcknowledgedBy, c.deadLetterAcknowledgeNote',
          'FROM c',
          'WHERE c.type = @type',
          'AND c.tenantId = @tenantId',
          'AND ARRAY_CONTAINS(@statuses, c.status)',
          'AND c.availableAt <= @now',
          'ORDER BY c.availableAt ASC',
        ].join(' '),
        [
          { name: '@type', value: 'vendor-event-outbox' },
          { name: '@tenantId', value: tenantId },
          { name: '@statuses', value: ['PENDING', 'FAILED'] },
          { name: '@now', value: nowIso },
        ],
      );

      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to query vendor outbox backlog');
      }

      const enrichedItems = await enrichWithRevisionLinks(dbService, result.data ?? []);

      return res.status(200).json({
        success: true,
        data: enrichedItems,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to query vendor outbox backlog', { tenantId, error: message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  router.get('/dead-letter', async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId ?? 'unknown';
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query['limit'] ?? '50'), 10) || 50));
    const includeAcknowledged = String(req.query['includeAcknowledged'] ?? 'false').toLowerCase() === 'true';

    try {
      const queryParts = [
        'SELECT TOP ' + limit,
        'c.id, c.status, c.vendorType, c.eventType, c.vendorOrderId, c.ourOrderId, c.availableAt, c.receivedAt, c.attemptCount, c.lastError,',
        'c.deadLetterAcknowledgedAt, c.deadLetterAcknowledgedBy, c.deadLetterAcknowledgeNote',
        'FROM c',
        'WHERE c.type = @type',
        'AND c.tenantId = @tenantId',
        'AND c.status = @status',
      ];

      if (!includeAcknowledged) {
        queryParts.push('AND NOT IS_DEFINED(c.deadLetterAcknowledgedAt)');
      }

      queryParts.push('ORDER BY c.availableAt DESC');

      const result = await dbService.queryItems<VendorOutboxListItem>(
        VENDOR_EVENT_OUTBOX_CONTAINER,
        queryParts.join(' '),
        [
          { name: '@type', value: 'vendor-event-outbox' },
          { name: '@tenantId', value: tenantId },
          { name: '@status', value: 'DEAD_LETTER' },
        ],
      );

      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to query vendor outbox dead-letter items');
      }

      const enrichedItems = await enrichWithRevisionLinks(dbService, result.data ?? []);

      return res.status(200).json({
        success: true,
        data: enrichedItems,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to query vendor outbox dead-letter items', { tenantId, error: message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  router.post('/:id/requeue', async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId ?? 'unknown';
    const operatorId = resolveOperatorId(req);

    try {
      const item = await loadOutboxItem(dbService, req.params.id ?? '', tenantId);
      if (!item) {
        return res.status(404).json({ success: false, error: { message: 'Vendor outbox item not found' } });
      }

      if (item.status !== 'FAILED' && item.status !== 'DEAD_LETTER') {
        return res.status(409).json({
          success: false,
          error: { message: `Only FAILED or DEAD_LETTER items can be requeued. Current status: ${item.status}` },
        });
      }

      const nowIso = new Date().toISOString();
      const requeueUpdates = {
        status: 'PENDING',
        availableAt: nowIso,
        claimedAt: undefined,
        claimedBy: undefined,
        lastError: undefined,
        deadLetterAcknowledgedAt: undefined,
        deadLetterAcknowledgedBy: undefined,
        deadLetterAcknowledgeNote: undefined,
        metadata: {
          ...item.metadata,
          lastOperatorAction: 'requeue',
          lastOperatorActionAt: nowIso,
          lastOperatorActionBy: operatorId,
        } as VendorOutboxDocument['metadata'] & Record<string, unknown>,
      } as unknown as Partial<VendorOutboxDocument>;

      const updateResult = await dbService.updateItem<VendorOutboxDocument>(
        VENDOR_EVENT_OUTBOX_CONTAINER,
        item.id,
        requeueUpdates,
        tenantId,
      );

      if (!updateResult.success || !updateResult.data) {
        throw new Error(updateResult.error?.message ?? `Failed to requeue outbox item ${item.id}`);
      }

      return res.status(200).json({
        success: true,
        data: updateResult.data,
        message: `Vendor outbox item ${item.id} requeued by ${operatorId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to requeue vendor outbox item', { tenantId, operatorId, itemId: req.params.id, error: message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  router.post('/:id/acknowledge', async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId ?? 'unknown';
    const operatorId = resolveOperatorId(req);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : undefined;

    if (note && note.length > MAX_ACKNOWLEDGEMENT_NOTE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Acknowledgement note must be ${MAX_ACKNOWLEDGEMENT_NOTE_LENGTH} characters or fewer. Received ${note.length}.`,
        },
      });
    }

    try {
      const item = await loadOutboxItem(dbService, req.params.id ?? '', tenantId);
      if (!item) {
        return res.status(404).json({ success: false, error: { message: 'Vendor outbox item not found' } });
      }

      if (item.status !== 'DEAD_LETTER') {
        return res.status(409).json({
          success: false,
          error: { message: `Only DEAD_LETTER items can be acknowledged. Current status: ${item.status}` },
        });
      }

      const nowIso = new Date().toISOString();
      const updateResult = await dbService.updateItem<VendorOutboxDocument>(
        VENDOR_EVENT_OUTBOX_CONTAINER,
        item.id,
        {
          deadLetterAcknowledgedAt: nowIso,
          deadLetterAcknowledgedBy: operatorId,
          deadLetterAcknowledgeNote: note || undefined,
          metadata: {
            ...item.metadata,
            lastOperatorAction: 'acknowledge',
            lastOperatorActionAt: nowIso,
            lastOperatorActionBy: operatorId,
          } as VendorOutboxDocument['metadata'] & Record<string, unknown>,
        },
        tenantId,
      );

      if (!updateResult.success || !updateResult.data) {
        throw new Error(updateResult.error?.message ?? `Failed to acknowledge outbox item ${item.id}`);
      }

      return res.status(200).json({
        success: true,
        data: updateResult.data,
        message: `Vendor outbox item ${item.id} acknowledged by ${operatorId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to acknowledge vendor outbox item', { tenantId, operatorId, itemId: req.params.id, error: message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  /**
   * GET /trace?vendorOrderId=<id>&hours=24
   * GET /trace?correlationId=<id>&hours=24
   *
   * Queries Log Analytics for end-to-end vendor integration traces.
   * Returns timeline grouped by correlationId.
   */
  router.get('/trace', async (req: Request, res: Response) => {
    const { vendorOrderId, correlationId, hours: hoursStr } = req.query as Record<string, string | undefined>;
    const hours = hoursStr ? Math.min(Math.max(Number(hoursStr), 1), 168) : 24;

    if (!vendorOrderId && !correlationId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Provide either vendorOrderId or correlationId query parameter.' },
      });
    }

    try {
      const timelines = vendorOrderId
        ? await vendorEventTraceService.queryByVendorOrderId(vendorOrderId, hours)
        : await vendorEventTraceService.queryByCorrelationId(correlationId!, hours);

      return res.json({ success: true, data: timelines });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Vendor trace query failed', { message });
      return res.status(500).json({ success: false, error: { message } });
    }
  });

  return router;
}

type VendorOutboxListItem = Pick<
  VendorOutboxDocument,
  | 'id'
  | 'status'
  | 'vendorType'
  | 'eventType'
  | 'vendorOrderId'
  | 'ourOrderId'
  | 'availableAt'
  | 'receivedAt'
  | 'attemptCount'
  | 'lastError'
  | 'deadLetterAcknowledgedAt'
  | 'deadLetterAcknowledgedBy'
  | 'deadLetterAcknowledgeNote'
> & {
  relatedRevisionId?: string;
};

async function enrichWithRevisionLinks(
  dbService: Pick<CosmosDbService, 'queryItems'>,
  items: VendorOutboxListItem[],
): Promise<VendorOutboxListItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.eventType !== 'vendor.revision.requested') {
        return item;
      }

      const revisionId = await findRelatedRevisionId(dbService, item.id);
      return {
        ...item,
        ...(revisionId ? { relatedRevisionId: revisionId } : {}),
      };
    }),
  );
}

async function findRelatedRevisionId(
  dbService: Pick<CosmosDbService, 'queryItems'>,
  vendorEventId: string,
): Promise<string | null> {
  const result = await dbService.queryItems<{ id: string }>(
    REVISIONS_CONTAINER,
    [
      'SELECT TOP 1 c.id FROM c',
      'WHERE c.id = @id OR c.metadata.vendorIntegration.vendorEventId = @vendorEventId',
      'ORDER BY c.createdAt DESC',
    ].join(' '),
    [
      { name: '@id', value: `vendor-revision:${vendorEventId}` },
      { name: '@vendorEventId', value: vendorEventId },
    ],
  );

  if (!result.success) {
    throw new Error(result.error?.message ?? `Failed to resolve related revision for ${vendorEventId}`);
  }

  return result.data?.[0]?.id ?? null;
}

async function loadOutboxItem(
  dbService: Pick<CosmosDbService, 'queryItems'>,
  id: string,
  tenantId: string,
): Promise<VendorOutboxDocument | null> {
  const result = await dbService.queryItems<VendorOutboxDocument>(
    VENDOR_EVENT_OUTBOX_CONTAINER,
    [
      'SELECT TOP 1 * FROM c',
      'WHERE c.type = @type',
      'AND c.tenantId = @tenantId',
      'AND c.id = @id',
    ].join(' '),
    [
      { name: '@type', value: 'vendor-event-outbox' },
      { name: '@tenantId', value: tenantId },
      { name: '@id', value: id },
    ],
  );

  if (!result.success) {
    throw new Error(result.error?.message ?? `Failed to load vendor outbox item ${id}`);
  }

  return result.data?.[0] ?? null;
}

function resolveOperatorId(req: Request): string {
  const user = (req as any).user ?? {};
  return String(user.id ?? user.userId ?? user.email ?? user.name ?? 'unknown-operator');
}

async function countByStatus(
  dbService: Pick<CosmosDbService, 'queryItems'>,
  tenantId: string,
  status: string,
): Promise<number> {
  const result = await dbService.queryItems<number>(
    VENDOR_EVENT_OUTBOX_CONTAINER,
    [
      'SELECT VALUE COUNT(1) FROM c',
      'WHERE c.type = @type',
      'AND c.tenantId = @tenantId',
      'AND c.status = @status',
    ].join(' '),
    [
      { name: '@type', value: 'vendor-event-outbox' },
      { name: '@tenantId', value: tenantId },
      { name: '@status', value: status },
    ],
  );

  if (!result.success) {
    throw new Error(result.error?.message ?? `Failed to count vendor outbox status ${status}`);
  }

  return Number(result.data?.[0] ?? 0);
}