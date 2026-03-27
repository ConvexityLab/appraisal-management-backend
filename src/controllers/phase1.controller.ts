/**
 * Phase 1 Controllers
 *
 * Router factories for all Phase 1 services. Each function returns an Express
 * Router that can be mounted in api-server.ts.
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { EngagementLetterService } from '../services/engagement-letter.service.js';
import { MISMOXMLValidationService } from '../services/mismo-xml-validator.service.js';
import { UCDPEADSubmissionService } from '../services/ucdp-ead-submission.service.js';
import { PostDeliveryService } from '../services/post-delivery.service.js';
import { ClientConfigurationService } from '../services/client-configuration.service.js';
import { InspectionEnhancementService } from '../services/inspection-enhancement.service.js';
import { BillingEnhancementService } from '../services/billing-enhancement.service.js';
import { WIPBoardService } from '../services/wip-board.service.js';
import { FieldReviewTriggerService } from '../services/field-review-trigger.service.js';
import { ArchivingRetentionService } from '../services/archiving-retention.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Phase1Controllers');

// ── Helper ───────────────────────────────────────────────────────────────────

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tenantId = req.user?.tenantId
    ?? (req.headers['x-tenant-id'] as string | undefined);
  if (!tenantId) {
    throw new Error('Missing tenantId — provide via auth token or x-tenant-id header');
  }
  return tenantId;
}

function resolveUserId(req: UnifiedAuthRequest): string {
  return req.user?.id ?? 'system';
}

// ── Engagement Letter Routes ─────────────────────────────────────────────────

export function createEngagementLetterRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new EngagementLetterService(dbService);

  /** POST /  — Generate engagement letter for an order */
  router.post('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const { orderId, productType, clientId, vendorId, templateId } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }
      const result = await service.generateEngagementLetter({
        orderId,
        tenantId,
        productType: productType ?? 'STANDARD',
        clientId,
        vendorId,
        templateId,
      });
      res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to generate engagement letter', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /templates — List available templates for the tenant */
  router.get('/templates', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const productType = req.query.productType as string | undefined;
      const templates = await service.getTemplates(tenantId, productType);
      res.json(templates);
    } catch (error) {
      logger.error('Failed to list engagement letter templates', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /:letterId/send — Send letter for signature */
  router.post('/:letterId/send', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const result = await service.sendForSignature(req.params.letterId!, tenantId);
      res.json(result);
    } catch (error) {
      logger.error('Failed to send letter', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /order/:orderId — Get all letters for an order */
  router.get('/order/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const letters = await service.getLettersForOrder(req.params.orderId!, tenantId);
      res.json(letters);
    } catch (error) {
      logger.error('Failed to get letters', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── MISMO Validation Routes ──────────────────────────────────────────────────

export function createMISMOValidationRouter(): Router {
  const router = Router();
  const service = new MISMOXMLValidationService();

  /** POST /validate — Validate MISMO XML */
  router.post('/validate', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const { xmlContent, orderId } = req.body;
      if (!xmlContent) {
        res.status(400).json({ error: 'xmlContent is required' });
        return;
      }
      const result = await service.validate({ xmlContent, orderId });
      res.json(result);
    } catch (error) {
      logger.error('MISMO validation failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── UCDP/EAD Submission Routes ───────────────────────────────────────────────

export function createSubmissionRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new UCDPEADSubmissionService(dbService);

  /** POST / — Submit to UCDP or EAD */
  router.post('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const { orderId, portal, xmlContent, loanNumber, lenderId } = req.body;
      if (!orderId || !portal || !xmlContent) {
        res.status(400).json({ error: 'orderId, portal, and xmlContent are required' });
        return;
      }
      const result = await service.submit({
        orderId,
        tenantId,
        portal,
        xmlContent,
        loanNumber,
        lenderId,
      });
      res.status(201).json(result);
    } catch (error) {
      logger.error('GSE submission failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /:submissionId — Check submission status */
  router.get('/:submissionId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const result = await service.checkSubmissionStatus(req.params.submissionId!, tenantId);
      res.json(result);
    } catch (error) {
      logger.error('Submission status check failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /order/:orderId — Get submissions for an order */
  router.get('/order/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const submissions = await service.getSubmissionsForOrder(req.params.orderId!, tenantId);
      res.json(submissions);
    } catch (error) {
      logger.error('Failed to get submissions', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Post-Delivery Task Routes ────────────────────────────────────────────────

export function createPostDeliveryRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new PostDeliveryService(dbService);

  /** POST /generate/:orderId — Generate standard post-delivery tasks */
  router.post('/generate/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const { appraisalEffectiveDate } = req.body;
      const tasks = await service.generateDeliveryTasks(req.params.orderId!, tenantId, appraisalEffectiveDate);
      res.status(201).json(tasks);
    } catch (error) {
      logger.error('Failed to generate post-delivery tasks', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST / — Create single post-delivery task */
  router.post('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const task = await service.createTask({ ...req.body, tenantId });
      res.status(201).json(task);
    } catch (error) {
      logger.error('Failed to create post-delivery task', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /order/:orderId — Get tasks for an order */
  router.get('/order/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const tasks = await service.getTasksForOrder(req.params.orderId!, tenantId);
      res.json(tasks);
    } catch (error) {
      logger.error('Failed to get post-delivery tasks', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /overdue — Get overdue tasks */
  router.get('/overdue', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const tasks = await service.getOverdueTasks(tenantId);
      res.json(tasks);
    } catch (error) {
      logger.error('Failed to get overdue tasks', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /:taskId/complete — Complete a task */
  router.put('/:taskId/complete', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const task = await service.completeTask(req.params.taskId!, tenantId, userId, req.body.notes);
      res.json(task);
    } catch (error) {
      logger.error('Failed to complete task', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /recertification/:orderId — Check 1004D status */
  router.get('/recertification/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const result = await service.checkRecertificationStatus(req.params.orderId!, tenantId);
      res.json(result ?? { message: 'No recertification tracking for this order' });
    } catch (error) {
      logger.error('Recertification check failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Client Configuration Routes ──────────────────────────────────────────────

export function createClientConfigRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new ClientConfigurationService(dbService);

  /** GET /:clientId — Get active configuration for a client */
  router.get('/:clientId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const config = await service.getActiveConfig(req.params.clientId!, tenantId);
      if (!config) {
        res.status(404).json({ error: 'No active configuration found for this client' });
        return;
      }
      res.json(config);
    } catch (error) {
      logger.error('Failed to get client config', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /:clientId/history — Get configuration history */
  router.get('/:clientId/history', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const configs = await service.getConfigHistory(req.params.clientId!, tenantId);
      res.json(configs);
    } catch (error) {
      logger.error('Failed to get config history', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST / — Create/update client configuration */
  router.post('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const config = await service.upsertConfiguration({
        ...req.body,
        tenantId,
        createdBy: userId,
      });
      res.status(201).json(config);
    } catch (error) {
      logger.error('Failed to upsert client config', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /:clientId/resolve/:productType — Resolve effective order config */
  router.get('/:clientId/resolve/:productType', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const resolved = await service.resolveOrderConfig(req.params.clientId!, tenantId, req.params.productType!);
      res.json(resolved);
    } catch (error) {
      logger.error('Failed to resolve order config', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Inspection Enhancement Routes ────────────────────────────────────────────

export function createInspectionEnhancementRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new InspectionEnhancementService(dbService);

  /** POST /contact-attempt — Record a borrower contact attempt */
  router.post('/contact-attempt', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const attempt = await service.recordContactAttempt({
        ...req.body,
        tenantId,
        attemptedBy: userId,
        attemptedAt: new Date().toISOString(),
      });
      res.status(201).json(attempt);
    } catch (error) {
      logger.error('Failed to record contact attempt', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /contact-log/:inspectionId — Get contact log for an inspection */
  router.get('/contact-log/:inspectionId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const log = await service.getContactLog(req.params.inspectionId!, tenantId);
      res.json(log);
    } catch (error) {
      logger.error('Failed to get contact log', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /sla-check/:orderId — Check SLA compliance for an order */
  router.get('/sla-check/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const { assignedAt } = req.query;
      if (!assignedAt || typeof assignedAt !== 'string') {
        res.status(400).json({ error: 'assignedAt query parameter is required (ISO date)' });
        return;
      }
      const status = await service.checkSLACompliance(req.params.orderId!, tenantId, assignedAt);
      res.json(status);
    } catch (error) {
      logger.error('SLA check failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /violations — Get all SLA violations for tenant */
  router.get('/violations', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const violations = await service.getViolations(tenantId);
      res.json(violations);
    } catch (error) {
      logger.error('Failed to get violations', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /access-constraints — Upsert property access constraints for an inspection */
  router.put('/access-constraints', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const constraints = await service.upsertAccessConstraints({ ...req.body, tenantId });
      res.json(constraints);
    } catch (error) {
      logger.error('Failed to upsert access constraints', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /access-constraints/:orderId/:inspectionId — Get access constraints */
  router.get('/access-constraints/:orderId/:inspectionId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const constraints = await service.getAccessConstraints(req.params.orderId!, req.params.inspectionId!, tenantId);
      if (!constraints) {
        res.status(404).json({ error: 'No access constraints found' });
        return;
      }
      res.json(constraints);
    } catch (error) {
      logger.error('Failed to get access constraints', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Billing Enhancement Routes ───────────────────────────────────────────────

export function createBillingEnhancementRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new BillingEnhancementService(dbService);

  /** GET /aging — Generate A/R aging report */
  router.get('/aging', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const report = await service.generateAgingReport(tenantId);
      res.json(report);
    } catch (error) {
      logger.error('Aging report failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /batch-invoice — Create invoices for multiple orders */
  router.post('/batch-invoice', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const result = await service.batchCreateInvoices({
        ...req.body,
        tenantId,
        createdBy: userId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Batch invoicing failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /1099/:year — Generate 1099 report */
  router.get('/1099/:year', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const year = parseInt(req.params.year!, 10);
      if (isNaN(year)) {
        res.status(400).json({ error: 'Valid year is required' });
        return;
      }
      const report = await service.generate1099Report(tenantId, year);
      res.json(report);
    } catch (error) {
      logger.error('1099 report failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /refund — Request a refund */
  router.post('/refund', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const refund = await service.requestRefund({
        ...req.body,
        tenantId,
        requestedBy: userId,
      });
      res.status(201).json(refund);
    } catch (error) {
      logger.error('Refund request failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /refund/:refundId — Process (approve/deny) a refund */
  router.put('/refund/:refundId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const { approve, notes } = req.body;
      if (typeof approve !== 'boolean') {
        res.status(400).json({ error: 'approve (boolean) is required' });
        return;
      }
      const refund = await service.processRefund(req.params.refundId!, tenantId, approve, userId, notes);
      res.json(refund);
    } catch (error) {
      logger.error('Refund processing failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /refunds/pending — Get pending refunds */
  router.get('/refunds/pending', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const refunds = await service.getPendingRefunds(tenantId);
      res.json(refunds);
    } catch (error) {
      logger.error('Failed to get pending refunds', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /invoices — List all invoices, optional ?status= filter */
  router.get('/invoices', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const status = req.query.status as string | undefined;
      const invoices = await service.getInvoices(tenantId, status);
      res.json(invoices);
    } catch (error) {
      logger.error('Failed to list invoices', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /invoices/:invoiceId — Get single invoice */
  router.get('/invoices/:invoiceId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const invoice = await service.getInvoice(req.params.invoiceId!, tenantId);
      if (!invoice) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }
      res.json(invoice);
    } catch (error) {
      logger.error('Failed to get invoice', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /invoices/:invoiceId/payments — Record a payment */
  router.post('/invoices/:invoiceId/payments', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const { amount, method, reference } = req.body;
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ error: 'amount must be a positive number' });
        return;
      }
      if (!method) {
        res.status(400).json({ error: 'method is required' });
        return;
      }
      const invoice = await service.recordPayment(
        req.params.invoiceId!,
        tenantId,
        amount,
        method,
        reference ?? '',
        userId,
      );
      res.json(invoice);
    } catch (error) {
      logger.error('Failed to record payment', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── WIP Board Routes ─────────────────────────────────────────────────────────

export function createWIPBoardRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new WIPBoardService(dbService);

  /** GET / — Get full WIP board */
  router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const filters: any = {};
      if (req.query.vendorId) filters.vendorId = req.query.vendorId;
      if (req.query.clientId) filters.clientId = req.query.clientId;
      if (req.query.productType) filters.productType = req.query.productType;
      if (req.query.isRush === 'true') filters.isRush = true;
      if (req.query.search) filters.searchTerm = req.query.search;
      if (req.query.categories) filters.categories = (req.query.categories as string).split(',');

      const board = await service.getBoard(tenantId, filters);
      res.json(board);
    } catch (error) {
      logger.error('WIP board failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /column/:category — Get orders for a specific column */
  router.get('/column/:category', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const category = req.params.category as any;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const filters: any = {};
      if (req.query.vendorId) filters.vendorId = req.query.vendorId;
      if (req.query.clientId) filters.clientId = req.query.clientId;

      const orders = await service.getColumnOrders(tenantId, category, filters, limit, offset);
      res.json(orders);
    } catch (error) {
      logger.error('Column orders failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Field/Desk Review Trigger Routes ─────────────────────────────────────────

export function createFieldReviewTriggerRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new FieldReviewTriggerService(dbService);

  /** POST /rules — Create a trigger rule */
  router.post('/rules', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const rule = await service.createRule({ ...req.body, tenantId });
      res.status(201).json(rule);
    } catch (error) {
      logger.error('Failed to create trigger rule', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /rules/:ruleId — Update a trigger rule */
  router.put('/rules/:ruleId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const rule = await service.updateRule(req.params.ruleId!, tenantId, req.body);
      res.json(rule);
    } catch (error) {
      logger.error('Failed to update trigger rule', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /rules — List trigger rules */
  router.get('/rules', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const activeOnly = req.query.activeOnly !== 'false';
      const rules = await service.getRules(tenantId, activeOnly);
      res.json(rules);
    } catch (error) {
      logger.error('Failed to list trigger rules', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /rules/:ruleId — Get a single trigger rule */
  router.get('/rules/:ruleId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const rule = await service.getRule(req.params.ruleId!, tenantId);
      if (!rule) {
        res.status(404).json({ error: 'Rule not found' });
        return;
      }
      res.json(rule);
    } catch (error) {
      logger.error('Failed to get trigger rule', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** DELETE /rules/:ruleId — Delete a trigger rule */
  router.delete('/rules/:ruleId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      await service.deleteRule(req.params.ruleId!, tenantId);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete trigger rule', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /evaluate — Evaluate an order against trigger rules */
  router.post('/evaluate', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const result = await service.evaluate({ ...req.body, tenantId });
      res.json(result);
    } catch (error) {
      logger.error('Trigger evaluation failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}

// ── Archiving & Retention Routes ─────────────────────────────────────────────

export function createArchivingRetentionRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new ArchivingRetentionService(dbService);

  /** POST /policies — Create a retention policy */
  router.post('/policies', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const policy = await service.createPolicy({ ...req.body, tenantId });
      res.status(201).json(policy);
    } catch (error) {
      logger.error('Failed to create retention policy', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /policies/:policyId — Update a retention policy */
  router.put('/policies/:policyId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const policy = await service.updatePolicy(req.params.policyId!, tenantId, req.body);
      res.json(policy);
    } catch (error) {
      logger.error('Failed to update retention policy', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /policies — List retention policies */
  router.get('/policies', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const activeOnly = req.query.activeOnly !== 'false';
      const policies = await service.getPolicies(tenantId, activeOnly);
      res.json(policies);
    } catch (error) {
      logger.error('Failed to list retention policies', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /policies/:policyId — Get one retention policy */
  router.get('/policies/:policyId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const policy = await service.getPolicy(req.params.policyId!, tenantId);
      if (!policy) {
        res.status(404).json({ error: 'Policy not found' });
        return;
      }
      res.json(policy);
    } catch (error) {
      logger.error('Failed to get retention policy', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** DELETE /policies/:policyId — Delete a retention policy */
  router.delete('/policies/:policyId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      await service.deletePolicy(req.params.policyId!, tenantId);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete retention policy', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /archive — Archive an order */
  router.post('/archive', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const userId = resolveUserId(req);
      const record = await service.archiveOrder(
        req.body.orderId,
        tenantId,
        req.body.deliveredAt,
        userId,
        { clientId: req.body.clientId, productType: req.body.productType },
      );
      res.status(201).json(record);
    } catch (error) {
      logger.error('Failed to archive order', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /archive/:orderId — Get archive record for an order */
  router.get('/archive/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const record = await service.getArchiveRecord(req.params.orderId!, tenantId);
      if (!record) {
        res.status(404).json({ error: 'Archive record not found' });
        return;
      }
      res.json(record);
    } catch (error) {
      logger.error('Failed to get archive record', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** POST /scan-purge — Scan for purge-eligible archived orders */
  router.post('/scan-purge', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const eligible = await service.scanForPurgeEligible(tenantId);
      res.json({ count: eligible.length, records: eligible });
    } catch (error) {
      logger.error('Purge scan failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** PUT /legal-hold/:orderId — Set or release legal hold */
  router.put('/legal-hold/:orderId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const { hold, reason } = req.body;
      if (typeof hold !== 'boolean') {
        res.status(400).json({ error: 'hold (boolean) is required' });
        return;
      }
      const record = await service.setLegalHold(req.params.orderId!, tenantId, hold, reason);
      res.json(record);
    } catch (error) {
      logger.error('Legal hold update failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  /** GET /summary — Get retention summary for tenant */
  router.get('/summary', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const summary = await service.getRetentionSummary(tenantId);
      res.json(summary);
    } catch (error) {
      logger.error('Retention summary failed', { error });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
    }
  });

  return router;
}