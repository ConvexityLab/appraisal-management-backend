import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { BulkAdapterDefinitionService } from '../services/bulk-adapter-definition.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';

const logger = new Logger('BulkAdapterDefinitionsController');

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tenantId = (req.headers['x-tenant-id'] as string | undefined) ?? req.user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID is required but missing from auth token and x-tenant-id header');
  }
  return tenantId;
}

function resolveUpdatedBy(req: UnifiedAuthRequest): string {
  return req.user?.id ?? req.user?.email ?? 'unknown';
}

const definitionValidators = [
  body('name').isString().notEmpty().withMessage('name is required'),
  body('description').optional().isString(),
  body('matchMode').isIn(['EXACT', 'PREFIX']).withMessage('matchMode must be EXACT or PREFIX'),
  body('sourceAdapter').isString().notEmpty().withMessage('sourceAdapter is required'),
  body('canonicalFieldMappings').isArray({ min: 1 }).withMessage('canonicalFieldMappings must contain at least one entry'),
  body('canonicalFieldMappings.*.targetField').isString().notEmpty(),
  body('canonicalFieldMappings.*.source').isString().notEmpty(),
  body('requiredFields').optional().isArray(),
  body('requiredFields.*.source').optional().isString().notEmpty(),
  body('requiredFields.*.code').optional().isString().notEmpty(),
  body('requiredFields.*.messageTemplate').optional().isString().notEmpty(),
  body('requiredAnyOf').optional().isArray(),
  body('requiredAnyOf.*.sources').optional().isArray({ min: 1 }),
  body('requiredAnyOf.*.code').optional().isString().notEmpty(),
  body('requiredAnyOf.*.messageTemplate').optional().isString().notEmpty(),
  body('documentRequirement').optional().isObject(),
  body('documentRequirement.required').optional().isBoolean(),
  body('documentRequirement.code').optional().isString().notEmpty(),
  body('documentRequirement.messageTemplate').optional().isString().notEmpty(),
  body('staticCanonicalData').optional().isObject(),
  body('notes').optional().isArray(),
  body('notes.*').optional().isString(),
];

export function createBulkAdapterDefinitionsRouter(dbService: CosmosDbService) {
  const router = express.Router();
  const service = new BulkAdapterDefinitionService(dbService);

  router.get(
    '/',
    query('includeBuiltIns').optional().isBoolean().withMessage('includeBuiltIns must be true or false'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const includeBuiltIns = req.query.includeBuiltIns !== 'false';
        const data = await service.listDefinitions(tenantId, { includeBuiltIns });
        return res.json({ success: true, data });
      } catch (error) {
        logger.error('Failed to list bulk adapter definitions', {
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to list bulk adapter definitions' });
      }
    },
  );

  router.get('/:adapterKey', param('adapterKey').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const adapterKey = req.params.adapterKey as string;

    try {
      const tenantId = resolveTenantId(req);
      const definition = await service.getDefinition(tenantId, adapterKey);
      if (!definition) {
        return res.status(404).json({ success: false, error: `Bulk adapter definition '${adapterKey}' not found` });
      }
      return res.json({ success: true, data: definition });
    } catch (error) {
      logger.error('Failed to load bulk adapter definition', {
        error: error instanceof Error ? error.message : String(error),
        adapterKey,
      });
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to load bulk adapter definition' });
    }
  });

  router.post('/', definitionValidators, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const created = await service.createDefinition({
        tenantId,
        adapterKey: req.body.adapterKey,
        name: req.body.name,
        description: req.body.description,
        matchMode: req.body.matchMode,
        sourceAdapter: req.body.sourceAdapter,
        documentRequirement: req.body.documentRequirement,
        requiredFields: req.body.requiredFields,
        requiredAnyOf: req.body.requiredAnyOf,
        canonicalFieldMappings: req.body.canonicalFieldMappings,
        staticCanonicalData: req.body.staticCanonicalData,
        notes: req.body.notes,
      });

      return res.status(201).json({
        success: true,
        data: created,
        meta: { updatedBy: resolveUpdatedBy(req) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create bulk adapter definition';
      logger.error('Failed to create bulk adapter definition', { error: message });
      if (message.includes('already exists')) {
        return res.status(409).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.put('/:adapterKey', param('adapterKey').isString().notEmpty(), ...definitionValidators, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const adapterKey = req.params.adapterKey as string;
      const updated = await service.updateDefinition({
        tenantId,
        adapterKey,
        name: req.body.name,
        description: req.body.description,
        matchMode: req.body.matchMode,
        sourceAdapter: req.body.sourceAdapter,
        documentRequirement: req.body.documentRequirement,
        requiredFields: req.body.requiredFields,
        requiredAnyOf: req.body.requiredAnyOf,
        canonicalFieldMappings: req.body.canonicalFieldMappings,
        staticCanonicalData: req.body.staticCanonicalData,
        notes: req.body.notes,
      });

      return res.json({
        success: true,
        data: updated,
        meta: { updatedBy: resolveUpdatedBy(req) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update bulk adapter definition';
      logger.error('Failed to update bulk adapter definition', {
        error: message,
        adapterKey: req.params.adapterKey as string,
      });
      if (message.includes('was not found')) {
        return res.status(404).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: message });
    }
  });

  router.delete('/:adapterKey', param('adapterKey').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const adapterKey = req.params.adapterKey as string;
      const deleted = await service.deleteDefinition(tenantId, adapterKey);
      if (!deleted) {
        return res.status(404).json({ success: false, error: `Bulk adapter definition '${adapterKey}' not found` });
      }
      return res.json({ success: true, deleted: true });
    } catch (error) {
      logger.error('Failed to delete bulk adapter definition', {
        error: error instanceof Error ? error.message : String(error),
        adapterKey: req.params.adapterKey,
      });
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete bulk adapter definition' });
    }
  });

  return router;
}