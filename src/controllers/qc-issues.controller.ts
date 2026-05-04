/**
 * QC Issues Controller
 *
 * Exposes endpoints for the qc-issues container.  Issues are auto-generated
 * by QCIssueRecorderService when Axiom criteria fail/warn, and can be
 * resolved/dismissed by a QC analyst.
 *
 * Endpoints:
 *   GET    /api/orders/:orderId/qc-issues   — list issues for an order
 *   PATCH  /api/qc-issues/:id               — resolve or dismiss an issue
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

const logger = new Logger('QCIssuesController');

// Stored in aiInsights container (partition key /orderId) — shared with Axiom evaluations.
// Filtered by c.type = 'qc-issue' to distinguish from evaluation records.
const QC_ISSUES_CONTAINER = 'aiInsights';

export function createQCIssuesOrderScopedRouter(dbService: CosmosDbService): Router {
  const router = Router();

  router.get('/:orderId/qc-issues', async (req: Request, res: Response) => {
    const orderId = req.params['orderId'] as string;
    const tenantId = (req as any).user?.tenantId;

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TENANT_ID_REQUIRED',
          message: 'Authenticated tenantId is required to retrieve QC issues.',
        },
      });
    }

    try {
      const container = dbService.getContainer(QC_ISSUES_CONTAINER);
      const { resources } = await container.items.query({
        query: "SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId AND c.type = 'qc-issue' ORDER BY c.createdAt DESC",
        parameters: [
          { name: '@orderId', value: orderId },
          { name: '@tenantId', value: tenantId ?? 'unknown' },
        ],
      }).fetchAll();

      return res.status(200).json({ success: true, data: resources });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to list qc-issues', { orderId, tenantId, error: msg });
      return res.status(500).json({
        success: false,
        error: {
          code: 'QC_ISSUES_LIST_FAILED',
          message: `Failed to retrieve QC issues for order '${orderId}': ${msg}`,
        },
      });
    }
  });

  return router;
}

export function createQCIssuesRouter(dbService: CosmosDbService): Router {
  const router = Router();

  router.patch('/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] as string;
    const user = (req as any).user;
    const userName = user?.displayName ?? user?.email ?? user?.id ?? 'unknown';

    const { status, resolutionNote, orderId: bodyOrderId } = req.body as {
      status?: 'RESOLVED' | 'DISMISSED';
      resolutionNote?: string;
      orderId?: string;
    };

    if (status !== 'RESOLVED' && status !== 'DISMISSED') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'status must be RESOLVED or DISMISSED' },
      });
    }

    try {
      const container = dbService.getContainer(QC_ISSUES_CONTAINER);

      // Find the issue first — partition key is /orderId which the client may not know.
      // Query by id across partitions (small cost, acceptable for individual update).
      let orderId = bodyOrderId;
      if (!orderId) {
        const { resources } = await container.items.query({
          query: 'SELECT TOP 1 c.orderId FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: id }],
        }).fetchAll();
        orderId = resources[0]?.orderId;
      }

      if (!orderId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `QC issue ${id} not found` },
        });
      }

      const { resource } = await container.item(id, orderId).read();
      if (!resource) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `QC issue ${id} not found for order ${orderId}` },
        });
      }

      const updated = {
        ...resource,
        status,
        resolutionNote: resolutionNote ?? resource.resolutionNote,
        resolvedBy: userName,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await container.item(id, orderId).replace(updated);
      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to update qc-issue', { id, error: msg });
      return res.status(500).json({ success: false, error: { message: msg } });
    }
  });

  return router;
}
