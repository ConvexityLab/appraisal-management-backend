/**
 * Construction Finance Module — Contractor Controller
 *
 * Routes (all protected by unifiedAuth):
 *   GET  /              → listContractors   (?riskTier=)
 *   GET  /:contractorId → getContractorById
 *   POST /              → createContractor
 *   PUT  /:contractorId → updateContractor
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ContractorService } from '../services/contractor.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { ContractorProfile } from '../types/construction-loan.types.js';

const VALID_RISK_TIERS: ContractorProfile['riskTier'][] = [
  'APPROVED', 'CONDITIONAL', 'WATCH', 'DISQUALIFIED',
];

const logger = new Logger('ConstructionContractorController');

export class ConstructionContractorController {
  public router: Router;
  private readonly contractorService: ContractorService;

  constructor(private readonly dbService: CosmosDbService) {
    this.contractorService = new ContractorService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get(
      '/',
      [
        query('riskTier').optional().isIn(VALID_RISK_TIERS).withMessage('Invalid riskTier filter'),
      ],
      this.listContractors.bind(this)
    );

    this.router.post(
      '/',
      [
        body('name').notEmpty().withMessage('name is required'),
        body('role').notEmpty().withMessage('role is required'),
        body('licenseNumber').notEmpty().withMessage('licenseNumber is required'),
        body('licenseState').notEmpty().withMessage('licenseState is required'),
        body('licenseExpiry').isISO8601().withMessage('licenseExpiry must be a valid ISO date'),
        body('insuranceCertExpiry').isISO8601().withMessage('insuranceCertExpiry must be a valid ISO date'),
      ],
      this.createContractor.bind(this)
    );

    this.router.get(
      '/:contractorId',
      [param('contractorId').notEmpty()],
      this.getContractorById.bind(this)
    );

    this.router.put(
      '/:contractorId',
      [param('contractorId').notEmpty()],
      this.updateContractor.bind(this)
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  public async listContractors(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const riskTierParam = typeof req.query['riskTier'] === 'string' ? req.query['riskTier'] : undefined;

      const contractors = await this.contractorService.listContractors(tenantId, {
        ...(riskTierParam && { riskTier: riskTierParam as ContractorProfile['riskTier'] }),
      });

      res.json({ contractors, count: contractors.length });
    } catch (error) {
      logger.error('listContractors failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getContractorById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { contractorId } = req.params as { contractorId: string };

      const contractor = await this.contractorService.getContractorById(contractorId, tenantId);
      res.json(contractor);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'CONTRACTOR_NOT_FOUND', message: msg });
        return;
      }
      logger.error('getContractorById failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async createContractor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const contractor = await this.contractorService.createContractor({
        ...req.body,
        tenantId,
        createdBy,
      });

      res.status(201).json(contractor);
    } catch (error) {
      logger.error('createContractor failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateContractor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { contractorId } = req.params as { contractorId: string };
      const updatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';

      const contractor = await this.contractorService.updateContractor(
        contractorId,
        tenantId,
        req.body,
        updatedBy
      );

      res.json(contractor);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'CONTRACTOR_NOT_FOUND', message: msg });
        return;
      }
      logger.error('updateContractor failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tid =
      req.user?.tenantId ??
      (req.headers['x-tenant-id'] as string | undefined);
    if (!tid) {
      throw new Error(
        'tenant ID is required but was not found in the auth token or x-tenant-id header'
      );
    }
    return tid;
  }
}
