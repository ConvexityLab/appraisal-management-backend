/**
 * Investment Proforma controller — ROI, Cap Rate, Cash-on-Cash (Phase 3.5)
 *
 * Routes (mounted at /api/proforma):
 *   POST /calculate            — stateless calculation, no DB write
 *   POST /                     — save proforma to a property/deal
 *   GET  /:propertyId          — list saved proformas for a property
 *   PUT  /:id                  — update assumptions + recalculate
 *   DELETE /:id                — delete saved proforma
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { calculateProforma } from '../services/proforma-calculator.service.js';
import type {
  InvestmentProforma,
  ProformaCalculateRequest,
  SaveProformaRequest,
} from '../types/proforma.types.js';

const CONTAINER = 'properties';

export function createProformaRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── POST /calculate ───────────────────────────────────────────────────────
  router.post('/calculate', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as ProformaCalculateRequest;
    if (!body.strategy) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'strategy is required' } }); return; }
    if (!body.purchasePrice) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'purchasePrice is required' } }); return; }
    if (body.closingCosts === undefined || body.closingCosts === null) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'closingCosts is required' } }); return; }
    if (body.rehabBudget === undefined || body.rehabBudget === null) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'rehabBudget is required' } }); return; }

    try {
      const result = calculateProforma(body);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Proforma calculation failed', { error });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Calculation failed' } });
    }
  });

  // ─── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const body = req.body as SaveProformaRequest;
    if (!body.propertyId) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }); return; }
    if (!body.scenarioName) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'scenarioName is required' } }); return; }
    if (!body.inputs) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'inputs is required' } }); return; }

    try {
      const calculated = calculateProforma(body.inputs);
      const now = new Date().toISOString();
      const proforma: InvestmentProforma = {
        id: uuidv4(),
        tenantId,
        type: 'investment-proforma',
        propertyId: body.propertyId as string,
        scenarioName: body.scenarioName as string,
        strategy: body.inputs.strategy,
        purchasePrice: body.inputs.purchasePrice,
        closingCosts: body.inputs.closingCosts,
        rehabBudget: body.inputs.rehabBudget,
        ...calculated,
        addedBy: userId,
        createdAt: now,
        updatedAt: now,
        ...(body.dealId !== undefined ? { dealId: body.dealId } : {}),
        ...(body.inputs.loanAmount !== undefined ? { loanAmount: body.inputs.loanAmount } : {}),
        ...(body.inputs.interestRate !== undefined ? { interestRate: body.inputs.interestRate } : {}),
        ...(body.inputs.loanTermMonths !== undefined ? { loanTermMonths: body.inputs.loanTermMonths } : {}),
        ...(body.inputs.downPayment !== undefined ? { downPayment: body.inputs.downPayment } : {}),
        ...(body.inputs.monthlyRent !== undefined ? { monthlyRent: body.inputs.monthlyRent } : {}),
        ...(body.inputs.vacancyRate !== undefined ? { vacancyRate: body.inputs.vacancyRate } : {}),
        ...(body.inputs.managementFeeRate !== undefined ? { managementFeeRate: body.inputs.managementFeeRate } : {}),
        ...(body.inputs.annualExpenses !== undefined ? { annualExpenses: body.inputs.annualExpenses } : {}),
        ...(body.inputs.arvEstimate !== undefined ? { arvEstimate: body.inputs.arvEstimate } : {}),
        ...(body.inputs.holdMonths !== undefined ? { holdMonths: body.inputs.holdMonths } : {}),
      };

      const container = db.getContainer(CONTAINER);
      await container.items.create(proforma);
      res.status(201).json({ success: true, data: proforma });
    } catch (error) {
      logger.error('Failed to save proforma', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save proforma' } });
    }
  });

  // ─── GET /:propertyId ──────────────────────────────────────────────────────
  router.get('/:propertyId', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const propertyId = req.params['propertyId'] as string;
    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestmentProforma>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.propertyId = @propertyId ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: 'investment-proforma' },
          { name: '@tenantId', value: tenantId },
          { name: '@propertyId', value: propertyId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to list proformas', { error, tenantId, propertyId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve proformas' } });
    }
  });

  // ─── PUT /:id ──────────────────────────────────────────────────────────────
  router.put('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    const body = req.body as { inputs: ProformaCalculateRequest; scenarioName?: string };

    if (!body.inputs) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'inputs is required' } }); return; }

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestmentProforma>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId AND c.id = @id',
        parameters: [
          { name: '@type', value: 'investment-proforma' },
          { name: '@tenantId', value: tenantId },
          { name: '@id', value: id },
        ],
      }).fetchAll();

      if (!resources[0]) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Proforma ${id} not found` } }); return; }

      const calculated = calculateProforma(body.inputs);
      const updated: InvestmentProforma = {
        ...resources[0],
        strategy: body.inputs.strategy,
        purchasePrice: body.inputs.purchasePrice,
        closingCosts: body.inputs.closingCosts,
        rehabBudget: body.inputs.rehabBudget,
        ...calculated,
        ...(body.scenarioName !== undefined ? { scenarioName: body.scenarioName } : {}),
        ...(body.inputs.loanAmount !== undefined ? { loanAmount: body.inputs.loanAmount } : {}),
        ...(body.inputs.interestRate !== undefined ? { interestRate: body.inputs.interestRate } : {}),
        ...(body.inputs.loanTermMonths !== undefined ? { loanTermMonths: body.inputs.loanTermMonths } : {}),
        ...(body.inputs.downPayment !== undefined ? { downPayment: body.inputs.downPayment } : {}),
        ...(body.inputs.monthlyRent !== undefined ? { monthlyRent: body.inputs.monthlyRent } : {}),
        ...(body.inputs.vacancyRate !== undefined ? { vacancyRate: body.inputs.vacancyRate } : {}),
        ...(body.inputs.managementFeeRate !== undefined ? { managementFeeRate: body.inputs.managementFeeRate } : {}),
        ...(body.inputs.annualExpenses !== undefined ? { annualExpenses: body.inputs.annualExpenses } : {}),
        ...(body.inputs.arvEstimate !== undefined ? { arvEstimate: body.inputs.arvEstimate } : {}),
        ...(body.inputs.holdMonths !== undefined ? { holdMonths: body.inputs.holdMonths } : {}),
        updatedAt: new Date().toISOString(),
      };

      await container.items.upsert(updated);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update proforma', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update proforma' } });
    }
  });

  // ─── DELETE /:id ───────────────────────────────────────────────────────────
  router.delete('/:id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } }); return; }

    const id = req.params['id'] as string;
    try {
      await db.deleteDocument(CONTAINER, id, tenantId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete proforma', { error, tenantId, id });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete proforma' } });
    }
  });

  return router;
}
