/**
 * AI Audit Controller
 *
 * POST /api/ai/audit       — write one audit row (called by every
 *                            write/external-sideEffect AI tool + intent
 *                            via the frontend `emitAiAudit` helper).
 * GET  /api/ai/audit        — query audit rows for the current tenant.
 *                            Supports ?userId=&kind=&entityId=&dateFrom=
 *                            &dateTo=&limit=.
 * DELETE /api/ai/audit/user/:userId — right-to-delete; wipes every row
 *                            for the named user in the current tenant.
 *                            Admin scope required (check in controller).
 *
 * Tenant + user identity come from `req.user` (UnifiedAuthMiddleware).
 * The frontend is NEVER trusted to stamp its own tenantId/userId; the
 * controller overwrites whatever the client supplied.
 */

import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiAuditService } from '../services/ai-audit.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiAuditController');

export function createAiAuditRouter(cosmos: CosmosDbService): Router {
	const router = Router();
	const service = new AiAuditService(cosmos);

	/** POST /api/ai/audit */
	router.post(
		'/',
		body('timestamp').optional().isString(),
		body('kind').isIn(['tool', 'intent']).withMessage('kind must be "tool" or "intent"'),
		body('name').isString().isLength({ min: 1 }).withMessage('name is required'),
		body('scopes').isArray(),
		body('sideEffect')
			.isIn(['read', 'write', 'external'])
			.withMessage('sideEffect must be "read" | "write" | "external"'),
		body('success').isBoolean(),
		body('surface').optional().isString(),
		body('conversationId').optional().isString(),
		body('description').optional().isString(),
		body('errorMessage').optional().isString(),
		body('entityId').optional().isString(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({
					success: false,
					error: 'Audit writes require an authenticated tenant + user.',
				});
			}
			const result = await service.write(user.tenantId, user.id, req.body);
			if (!result.success) {
				logger.error('AI audit write failed', { error: result.error });
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.status(201).json({ success: true, data: result.data, schemaVersion: 'v1' });
		},
	);

	/** GET /api/ai/audit */
	router.get(
		'/',
		query('userId').optional().isString(),
		query('kind').optional().isIn(['tool', 'intent']),
		query('entityId').optional().isString(),
		query('dateFrom').optional().isISO8601(),
		query('dateTo').optional().isISO8601(),
		query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.tenantId) {
				return res
					.status(401)
					.json({ success: false, error: 'Audit query requires an authenticated tenant.' });
			}
			// Build query options conditionally so optional fields are
			// omitted rather than set to `undefined` (required by
			// exactOptionalPropertyTypes).
			const opts: Parameters<typeof service.query>[0] = { tenantId: user.tenantId };
			if (typeof req.query.userId === 'string') opts.userId = req.query.userId;
			if (req.query.kind === 'tool' || req.query.kind === 'intent') opts.kind = req.query.kind;
			if (typeof req.query.entityId === 'string') opts.entityId = req.query.entityId;
			if (typeof req.query.dateFrom === 'string') opts.dateFrom = req.query.dateFrom;
			if (typeof req.query.dateTo === 'string') opts.dateTo = req.query.dateTo;
			if (typeof req.query.limit === 'number') opts.limit = req.query.limit;
			const result = await service.query(opts);
			if (!result.success) {
				logger.error('AI audit query failed', { error: result.error });
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.json({
				success: true,
				data: result.data ?? [],
				totalCount: (result.data ?? []).length,
				schemaVersion: 'v1',
			});
		},
	);

	/**
	 * DELETE /api/ai/audit/user/:userId — wipe audit rows for one user
	 * in the current tenant.  Only admins can call this; the caller's
	 * auth role is checked on the route.
	 */
	router.delete('/user/:userId', async (req: UnifiedAuthRequest, res: Response) => {
		const caller = req.user;
		if (!caller?.tenantId) {
			return res.status(401).json({ success: false, error: 'Missing tenant context.' });
		}
		const roles = Array.isArray(caller.role) ? caller.role : [caller.role];
		const isAdmin = roles.some((r) => typeof r === 'string' && r.toLowerCase() === 'admin');
		if (!isAdmin) {
			return res.status(403).json({
				success: false,
				error: 'AI audit deletion requires an admin role.',
			});
		}
		const targetUserId = req.params.userId;
		if (!targetUserId) {
			return res.status(400).json({ success: false, error: 'Missing :userId' });
		}
		const result = await service.deleteForUser(caller.tenantId, targetUserId);
		if (!result.success) {
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.json({ success: true, data: result.data });
	});

	return router;
}
