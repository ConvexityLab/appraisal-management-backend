/**
 * Access Graph Controller
 * 
 * HTTP endpoints for managing access relationships
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { AccessGraphService } from '../services/access-graph.service.js';
import { AuthorizedRequest } from '../middleware/authorization.middleware.js';

export const createAccessGraphRouter = (): Router => {
  const router = Router();
  const logger = new Logger();
  const graphService = new AccessGraphService();

  /**
   * POST /api/access-graph/grant
   * Grant access relationship (admin only)
   */
  router.post('/grant', async (req: AuthorizedRequest, res: Response) => {
    try {
      const grantRequest = {
        ...req.body,
        grantedBy: req.userProfile?.id || 'system',
        grantedByName: req.userProfile?.name,
        tenantId: req.userProfile?.tenantId || 'default'
      };

      const relationship = await graphService.grantAccess(grantRequest);

      res.json({
        success: true,
        data: relationship,
        message: 'Access granted'
      });
    } catch (error) {
      logger.error('Failed to grant access', { error });
      res.status(500).json({
        error: 'Failed to grant access',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * DELETE /api/access-graph/revoke
   * Revoke access relationship (admin only)
   */
  router.delete('/revoke', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { entityType, entityId, objectType, objectId } = req.body;
      const tenantId = req.userProfile?.tenantId || 'default';

      const success = await graphService.revokeAccess(
        entityType,
        entityId,
        objectType,
        objectId,
        tenantId
      );

      res.json({
        success,
        message: success ? 'Access revoked' : 'Relationship not found'
      });
    } catch (error) {
      logger.error('Failed to revoke access', { error });
      res.status(500).json({
        error: 'Failed to revoke access',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/access-graph/entity/:entityType/:entityId
   * Get all relationships for an entity
   */
  router.get('/entity/:entityType/:entityId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const tenantId = req.userProfile?.tenantId || 'default';

      if (!entityType || !entityId) {
        return res.status(400).json({ error: 'Missing entityType or entityId' });
      }

      const relationships = await graphService.getEntityRelationships(
        entityType,
        entityId,
        tenantId
      );

      return res.json({
        success: true,
        data: relationships,
        count: relationships.length
      });
    } catch (error) {
      logger.error('Failed to get entity relationships', { error });
      return res.status(500).json({
        error: 'Failed to get entity relationships',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/access-graph/object/:objectType/:objectId
   * Get all relationships for an object
   */
  router.get('/object/:objectType/:objectId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { objectType, objectId } = req.params;
      const tenantId = req.userProfile?.tenantId || 'default';

      if (!objectType || !objectId) {
        return res.status(400).json({ error: 'Missing objectType or objectId' });
      }

      const relationships = await graphService.getObjectRelationships(
        objectType,
        objectId,
        tenantId
      );

      return res.json({
        success: true,
        data: relationships,
        count: relationships.length
      });
    } catch (error) {
      logger.error('Failed to get object relationships', { error });
      return res.status(500).json({
        error: 'Failed to get object relationships',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/access-graph/paths
   * Find access paths between entity and object
   */
  router.get('/paths', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const { entityType, entityId, objectType, objectId } = req.query;
      const tenantId = req.userProfile?.tenantId || 'default';

      if (!entityType || !entityId || !objectType || !objectId) {
        return res.status(400).json({
          error: 'entityType, entityId, objectType, and objectId are required',
          code: 'INVALID_REQUEST'
        });
      }

      const paths = await graphService.findAccessPaths(
        entityType as string,
        entityId as string,
        objectType as string,
        objectId as string,
        tenantId
      );

      res.json({
        success: true,
        data: paths,
        count: paths.length
      });
    } catch (error) {
      logger.error('Failed to find access paths', { error });
      res.status(500).json({
        error: 'Failed to find access paths',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/access-graph/graph
   * Build access graph for visualization (admin only)
   */
  router.get('/graph', async (req: AuthorizedRequest, res: Response) => {
    try {
      const tenantId = req.userProfile?.tenantId || 'default';
      const { entityType, entityId, objectType, objectId } = req.query;

      const filters: any = {};
      if (entityType) filters.entityType = entityType as string;
      if (entityId) filters.entityId = entityId as string;
      if (objectType) filters.objectType = objectType as string;
      if (objectId) filters.objectId = objectId as string;

      const graph = await graphService.buildAccessGraph(tenantId, filters);

      res.json({
        success: true,
        data: graph,
        stats: {
          entities: graph.entities.length,
          relationships: graph.relationships.length
        }
      });
    } catch (error) {
      logger.error('Failed to build access graph', { error });
      res.status(500).json({
        error: 'Failed to build access graph',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * PUT /api/access-graph/update-actions
   * Update actions for a relationship (admin only)
   */
  router.put('/update-actions', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const { entityType, entityId, objectType, objectId, actions } = req.body;
      const tenantId = req.userProfile?.tenantId || 'default';

      if (!Array.isArray(actions)) {
        return res.status(400).json({
          error: 'actions must be an array',
          code: 'INVALID_REQUEST'
        });
      }

      const relationship = await graphService.updateActions(
        entityType,
        entityId,
        objectType,
        objectId,
        actions,
        tenantId
      );

      if (!relationship) {
        return res.status(404).json({
          error: 'Relationship not found',
          code: 'RELATIONSHIP_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: relationship,
        message: 'Actions updated'
      });
    } catch (error) {
      logger.error('Failed to update actions', { error });
      res.status(500).json({
        error: 'Failed to update actions',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/access-graph/cleanup
   * Clean up expired relationships (admin only)
   */
  router.post('/cleanup', async (req: AuthorizedRequest, res: Response) => {
    try {
      const tenantId = req.userProfile?.tenantId || 'default';

      const deletedCount = await graphService.cleanupExpired(tenantId);

      res.json({
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} expired relationship(s)`
      });
    } catch (error) {
      logger.error('Failed to cleanup expired relationships', { error });
      res.status(500).json({
        error: 'Failed to cleanup expired relationships',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  return router;
};
