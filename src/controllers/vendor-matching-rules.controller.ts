/**
 * Vendor Matching Rules Controller
 *
 * REST CRUD for configurable vendor matching rules.
 * Mounted at /api/vendor-matching-rules by the API server.
 *
 * Routes:
 *   GET    /                 — list all rules for tenant
 *   POST   /                 — create a rule
 *   GET    /:id              — get a single rule
 *   PUT    /:id              — update a rule
 *   DELETE /:id              — delete a rule
 *   POST   /evaluate         — evaluate rules against a test context (dry-run)
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  VendorMatchingRulesService,
  CreateVendorMatchingRuleInput,
  UpdateVendorMatchingRuleInput,
  RuleEvaluationContext,
} from '../services/vendor-matching-rules.service.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

export class VendorMatchingRulesController {
  public readonly router: Router;
  private readonly rulesService: VendorMatchingRulesService;

  constructor(dbService: CosmosDbService) {
    this.router = Router();
    this.rulesService = new VendorMatchingRulesService(dbService);
    this.initRoutes();
  }

  private initRoutes(): void {
    this.router.get('/',          this.listRules.bind(this));
    this.router.post('/',         this.createRule.bind(this));
    this.router.get('/:id',       this.getRule.bind(this));
    this.router.put('/:id',       this.updateRule.bind(this));
    this.router.delete('/:id',    this.deleteRule.bind(this));
    this.router.post('/evaluate', this.evaluateRules.bind(this));
  }

  private async listRules(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const activeOnly = req.query['activeOnly'] === 'true';
      const rules = await this.rulesService.listRules(tenantId, activeOnly);
      res.json({ success: true, data: rules, count: rules.length });
    } catch (err) {
      console.error('VendorMatchingRules listRules error:', err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  private async createRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id ?? 'unknown';
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const body = req.body as Partial<CreateVendorMatchingRuleInput>;
      if (!body.name || !body.ruleType || !body.action) {
        res.status(400).json({
          success: false,
          error: 'name, ruleType, and action are required',
        });
        return;
      }

      const input: CreateVendorMatchingRuleInput = {
        tenantId,
        name: body.name,
        description: body.description ?? '',
        isActive: body.isActive ?? true,
        priority: body.priority ?? 50,
        ruleType: body.ruleType,
        action: body.action,
        ...(body.vendorId ? { vendorId: body.vendorId } : {}),
        ...(body.productTypes ? { productTypes: body.productTypes } : {}),
        ...(body.states ? { states: body.states } : {}),
        ...(body.requiredLicenseType ? { requiredLicenseType: body.requiredLicenseType } : {}),
        ...(body.requiredCapability ? { requiredCapability: body.requiredCapability } : {}),
        ...(body.minPerformanceScore != null ? { minPerformanceScore: body.minPerformanceScore } : {}),
        ...(body.maxOrderValueUsd != null ? { maxOrderValueUsd: body.maxOrderValueUsd } : {}),
        ...(body.maxDistanceMiles != null ? { maxDistanceMiles: body.maxDistanceMiles } : {}),
        ...(body.adjustmentPoints != null ? { adjustmentPoints: body.adjustmentPoints } : {}),
        createdBy: userId,
      };

      const rule = await this.rulesService.createRule(input);
      res.status(201).json({ success: true, data: rule });
    } catch (err) {
      console.error('VendorMatchingRules createRule error:', err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  private async getRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const id = req.params['id']!;
      const rule = await this.rulesService.getRule(id, tenantId);
      if (!rule) { res.status(404).json({ success: false, error: `Rule ${id} not found` }); return; }
      res.json({ success: true, data: rule });
    } catch (err) {
      console.error('VendorMatchingRules getRule error:', err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  private async updateRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const id = req.params['id']!;
      const updates = req.body as UpdateVendorMatchingRuleInput;
      const rule = await this.rulesService.updateRule(id, tenantId, updates);
      res.json({ success: true, data: rule });
    } catch (err) {
      console.error('VendorMatchingRules updateRule error:', err);
      const status = (err as Error).message.includes('not found') ? 404 : 500;
      res.status(status).json({ success: false, error: (err as Error).message });
    }
  }

  private async deleteRule(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const id = req.params['id']!;
      await this.rulesService.deleteRule(id, tenantId);
      res.json({ success: true, message: `Rule ${id} deleted` });
    } catch (err) {
      console.error('VendorMatchingRules deleteRule error:', err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }

  /**
   * POST /evaluate
   * Evaluate rules against a test vendor-order context (dry-run for UI preview).
   * Body: { vendorId, vendorCapabilities?, vendorLicenseType?, vendorPerformanceScore?,
   *         vendorStates?, vendorDistance?, productType?, propertyState?, orderValueUsd? }
   */
  private async evaluateRules(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }

      const body = req.body as Record<string, unknown>;

      const ctx: RuleEvaluationContext = {
        vendor: {
          id: (body['vendorId'] as string | undefined) ?? '',
          ...(body['vendorCapabilities'] !== undefined ? { capabilities: body['vendorCapabilities'] as string[] } : {}),
          ...(body['vendorLicenseType'] !== undefined ? { licenseType: body['vendorLicenseType'] as string } : {}),
          ...(body['vendorPerformanceScore'] !== undefined ? { performanceScore: body['vendorPerformanceScore'] as number } : {}),
          ...(body['vendorStates'] !== undefined ? { states: body['vendorStates'] as string[] } : {}),
          ...(body['vendorDistance'] !== undefined ? { distance: body['vendorDistance'] as number | null } : {}),
        },
        order: {
          ...(body['productType'] !== undefined ? { productType: body['productType'] as string } : {}),
          ...(body['propertyState'] !== undefined ? { propertyState: body['propertyState'] as string } : {}),
          ...(body['orderValueUsd'] !== undefined ? { orderValueUsd: body['orderValueUsd'] as number } : {}),
        },
      };

      const result = await this.rulesService.evaluateRules(tenantId, ctx);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('VendorMatchingRules evaluateRules error:', err);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  }
}
