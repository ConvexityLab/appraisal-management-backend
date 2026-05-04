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
import type { InvestmentStrategy } from '../types/investor.types.js';

const CONTAINER = 'properties';

type UiProformaStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type UiLoanType = 'DSCR' | 'BRIDGE' | 'HARD_MONEY' | 'CONVENTIONAL' | 'PORTFOLIO';

interface UiProforma {
  id: string;
  name: string;
  propertyAddress: string;
  propertyType: string;
  status: UiProformaStatus;
  income: {
    grossRentalIncome: number;
    vacancyRatePct: number;
    otherIncome: number;
  };
  expenses: {
    propertyTaxes: number;
    insurance: number;
    propertyManagementPct: number;
    maintenanceReservePct: number;
    utilities: number;
    hoa: number;
    otherExpenses: number;
  };
  financing: {
    purchasePrice: number;
    rehabBudget: number;
    afterRepairValue: number;
    downPaymentPct: number;
    loanType: UiLoanType;
    interestRatePct: number;
    amortizationYears: number;
    closingCostsPct: number;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

function mapStrategyToLoanType(strategy: InvestmentStrategy): UiLoanType {
  switch (strategy) {
    case 'brrrr':
      return 'DSCR';
    case 'fix_and_flip':
      return 'BRIDGE';
    case 'wholesale':
      return 'HARD_MONEY';
    case 'development':
      return 'CONVENTIONAL';
    case 'buy_and_hold':
    default:
      return 'PORTFOLIO';
  }
}

function mapInvestmentProformaToUiProforma(source: InvestmentProforma): UiProforma {
  const purchasePrice = Number(source.purchasePrice ?? 0);
  const closingCosts = Number(source.closingCosts ?? 0);
  const rehabBudget = Number(source.rehabBudget ?? 0);
  const monthlyRent = Number(source.monthlyRent ?? 0);
  const vacancyRate = Number(source.vacancyRate ?? 0);
  const managementFeeRate = Number(source.managementFeeRate ?? 0);
  const annualExpenses = Number(source.annualExpenses ?? 0);
  const downPayment = Number(source.downPayment ?? 0);
  const loanTermMonths = Number(source.loanTermMonths ?? 0);
  const afterRepairValue = Number(source.arvEstimate ?? (purchasePrice + rehabBudget));

  return {
    id: source.id,
    name: source.scenarioName,
    propertyAddress: source.propertyId,
    propertyType: source.strategy,
    status: 'DRAFT',
    income: {
      grossRentalIncome: monthlyRent * 12,
      vacancyRatePct: vacancyRate,
      otherIncome: 0,
    },
    expenses: {
      propertyTaxes: 0,
      insurance: 0,
      propertyManagementPct: managementFeeRate,
      maintenanceReservePct: 0,
      utilities: 0,
      hoa: 0,
      otherExpenses: annualExpenses,
    },
    financing: {
      purchasePrice,
      rehabBudget,
      afterRepairValue,
      downPaymentPct: purchasePrice > 0 ? (downPayment / purchasePrice) * 100 : 0,
      loanType: mapStrategyToLoanType(source.strategy),
      interestRatePct: Number(source.interestRate ?? 0),
      amortizationYears: loanTermMonths > 0 ? loanTermMonths / 12 : 30,
      closingCostsPct: purchasePrice > 0 ? (closingCosts / purchasePrice) * 100 : 0,
    },
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    createdBy: source.addedBy,
  };
}

export function createProformaRouter(db: CosmosDbService): Router {
  const router = Router();
  const logger = new Logger();

  // ─── GET / ────────────────────────────────────────────────────────────────
  // UI compatibility list endpoint (returns shape expected by frontend Proforma page)
  router.get('/', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'No tenant context' } });
      return;
    }

    const pageRaw = Number(req.query['page'] ?? 1);
    const pageSizeRaw = Number(req.query['pageSize'] ?? 50);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50;

    try {
      const container = db.getContainer(CONTAINER);
      const { resources } = await container.items.query<InvestmentProforma>({
        query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId ORDER BY c.updatedAt DESC',
        parameters: [
          { name: '@type', value: 'investment-proforma' },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();

      const proformas = resources.map(mapInvestmentProformaToUiProforma);
      const start = (page - 1) * pageSize;
      const paged = proformas.slice(start, start + pageSize);

      res.json({
        proformas: paged,
        total: proformas.length,
        page,
        pageSize,
      });
    } catch (error) {
      logger.error('Failed to list proformas (UI compatibility endpoint)', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve proformas' } });
    }
  });

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
