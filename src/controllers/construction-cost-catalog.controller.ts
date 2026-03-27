/**
 * Construction Cost Catalog Controller
 *
 * Routes (all protected by unifiedAuth):
 *   GET  /search          → search(?q=&division=&sectionCode=&page=&pageSize=)
 *   GET  /:id             → getById(?division=)
 */

import { Router, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionCostCatalogService } from '../services/construction-cost-catalog.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { CsiDivision } from '../types/construction-cost-catalog.types.js';

const VALID_DIVISIONS: CsiDivision[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '13', '21', '22', '23', '26',
];

const logger = new Logger('ConstructionCostCatalogController');

export class ConstructionCostCatalogController {
  public router: Router;
  private readonly service: ConstructionCostCatalogService;

  constructor(dbService: CosmosDbService) {
    this.service = new ConstructionCostCatalogService(dbService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // GET /search must come before GET /:id to avoid /:id = "search" match
    this.router.get(
      '/search',
      [
        query('q').optional().isString().trim(),
        query('division').optional().isIn(VALID_DIVISIONS).withMessage('Invalid CSI division'),
        query('sectionCode').optional().isString().trim(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
      ],
      this.search.bind(this)
    );

    this.router.get(
      '/:id',
      [
        param('id').notEmpty(),
        query('division').isIn(VALID_DIVISIONS).withMessage('division query param is required and must be a valid CSI division'),
      ],
      this.getById.bind(this)
    );
  }

  public async search(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const q           = typeof req.query['q']           === 'string' ? req.query['q']           : undefined;
      const division    = typeof req.query['division']    === 'string' ? req.query['division'] as CsiDivision : undefined;
      const sectionCode = typeof req.query['sectionCode'] === 'string' ? req.query['sectionCode'] : undefined;
      const page        = typeof req.query['page']        === 'number' ? req.query['page']        as number   : undefined;
      const pageSize    = typeof req.query['pageSize']    === 'number' ? req.query['pageSize']    as number   : undefined;

      const result = await this.service.search({
        ...(q           !== undefined && { q }),
        ...(division    !== undefined && { division }),
        ...(sectionCode !== undefined && { sectionCode }),
        ...(page        !== undefined && { page }),
        ...(pageSize    !== undefined && { pageSize }),
      });
      res.json(result);
    } catch (error) {
      logger.error('catalog search failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const { id } = req.params as { id: string };
      const division = req.query['division'] as CsiDivision;
      const item = await this.service.getById(id, division);
      res.json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found')) {
        res.status(404).json({ error: 'CATALOG_ITEM_NOT_FOUND', message: msg });
        return;
      }
      logger.error('catalog getById failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
