/**
 * AI Feature Flags Controller
 *
 *   GET   /api/settings/flags                  — effective flags for current user
 *                                                 (tenant defaults merged with user override)
 *   PATCH /api/settings/flags/tenant           — upsert tenant-wide flags (admin only)
 *   PATCH /api/settings/flags/user             — upsert current user's override
 *   PATCH /api/settings/flags/user/:userId     — upsert another user's override (admin only)
 *
 * The frontend calls GET on sign-in and merges the response with its
 * build-time env defaults.  The merge order (least to most specific):
 *   env defaults ← response.tenant ← response.user.
 */

import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiFlagsService, type AiFlagsPayload } from '../services/ai-flags.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiFlagsController');

function callerIsAdmin(req: UnifiedAuthRequest): boolean {
	const roles = Array.isArray(req.user?.role) ? req.user?.role : [req.user?.role];
	return (roles ?? []).some((r) => typeof r === 'string' && r.toLowerCase() === 'admin');
}

export function createAiFlagsRouter(cosmos: CosmosDbService): Router {
	const router = Router();
	const service = new AiFlagsService(cosmos);

	/** GET /api/settings/flags */
	router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.id || !user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Missing auth context.' });
		}
		const result = await service.fetchForUser(user.tenantId, user.id);
		if (!result.success) {
			logger.error('fetchForUser failed', { error: result.error });
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.json({ success: true, data: result.data });
	});

	/** PATCH /api/settings/flags/tenant — admin only */
	router.patch(
		'/tenant',
		body('enabled').optional().isBoolean(),
		body('tools').optional().isObject(),
		body('tools.messaging').optional().isBoolean(),
		body('tools.negotiation').optional().isBoolean(),
		body('tools.navigation').optional().isBoolean(),
		body('axiomAgent').optional().isBoolean(),
		// A13 — negotiation rule values
		body('negotiation').optional().isObject(),
		body('negotiation.maxFeeDelta').optional().isFloat({ min: 0, max: 1 }),
		body('negotiation.maxSlaSlipBusinessDays').optional().isInt({ min: 0, max: 60 }),
		body('negotiation.roundHeadroom').optional().isInt({ min: 0, max: 10 }),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			if (!callerIsAdmin(req)) {
				return res.status(403).json({ success: false, error: 'Tenant flag updates require admin.' });
			}
			const user = req.user!;
			const result = await service.upsertTenantFlags(
				user.tenantId!,
				user.id,
				req.body as AiFlagsPayload,
			);
			if (!result.success) {
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.json({ success: true, data: result.data });
		},
	);

	/** PATCH /api/settings/flags/user — current user's override */
	router.patch(
		'/user',
		body('enabled').optional().isBoolean(),
		body('tools').optional().isObject(),
		body('tools.messaging').optional().isBoolean(),
		body('tools.negotiation').optional().isBoolean(),
		body('tools.navigation').optional().isBoolean(),
		body('axiomAgent').optional().isBoolean(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({ success: false, error: 'Missing auth context.' });
			}
			const result = await service.upsertUserFlags(
				user.tenantId,
				user.id,
				user.id,
				req.body as AiFlagsPayload,
			);
			if (!result.success) {
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.json({ success: true, data: result.data });
		},
	);

	/** PATCH /api/settings/flags/user/:userId — admin only */
	router.patch(
		'/user/:userId',
		body('enabled').optional().isBoolean(),
		body('tools').optional().isObject(),
		body('axiomAgent').optional().isBoolean(),
		async (req: UnifiedAuthRequest, res: Response) => {
			if (!callerIsAdmin(req)) {
				return res
					.status(403)
					.json({ success: false, error: 'Per-user flag updates for other users require admin.' });
			}
			const user = req.user!;
			const target = req.params.userId;
			if (!target) {
				return res.status(400).json({ success: false, error: 'Missing :userId' });
			}
			const result = await service.upsertUserFlags(
				user.tenantId!,
				target,
				user.id,
				req.body as AiFlagsPayload,
			);
			if (!result.success) {
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.json({ success: true, data: result.data });
		},
	);

	return router;
}
