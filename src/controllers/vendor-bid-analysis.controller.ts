import express, { Request, Response, Router } from 'express';
import { param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { stripConfidentialFieldsDeep } from '../utils/confidential-fields.js';

export function createVendorBidAnalysisRouter(dbService: CosmosDbService): Router {
  const router = express.Router();

  router.get(
    '/analyze/vendor-bid/:orderId',
    [param('orderId').notEmpty().withMessage('orderId is required')],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { orderId } = req.params as { orderId: string };
      const authReq = req as UnifiedAuthRequest;
      const callerTenantId = authReq.user?.tenantId;

      try {
        const orderResponse = await dbService.findOrderById(orderId);
        const order = orderResponse.data;

        if (!orderResponse.success || !order) {
          return res.status(404).json({
            success: false,
            error: `Order '${orderId}' was not found.`,
          });
        }

        if (callerTenantId && order.tenantId && order.tenantId !== callerTenantId) {
          return res.status(404).json({
            success: false,
            error: `Order '${orderId}' was not found.`,
          });
        }

        const analysis = (order as unknown as Record<string, unknown>)['vendorBidAnalysis'];
        if (!analysis || typeof analysis !== 'object') {
          return res.status(404).json({
            success: false,
            error: `Order '${orderId}' does not have cached vendor-bid analysis.`,
          });
        }

        // Phase C defense-in-depth: rankedCandidates etc. is opaque
        // (Record<string, unknown>) — strip any trustedVendor /
        // confidentialClassifications keys anywhere in the tree when caller
        // lacks confidential:read.
        const safeAnalysis = stripConfidentialFieldsDeep(analysis, authReq.user);
        return res.json({
          success: true,
          data: {
            orderId,
            analysis: safeAnalysis,
          },
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load cached vendor-bid analysis.',
        });
      }
    },
  );

  return router;
}