/**
 * AI Catalog Controller
 *
 * GET /api/ai/catalog  — returns the AI-exposable endpoint registry as
 *                       a flat JSON array.  The frontend AI assistant
 *                       fetches this at app boot and merges it with
 *                       its hand-curated TS catalog (TS wins on
 *                       (path, method) collision so the high-value
 *                       endpoints can keep richer descriptions).
 *
 * GET /api/ai/catalog?exposure=tool  — filter by exposure tier.
 *                                       'tool' = visible to all signed-in.
 *                                       'admin' = admin-only.
 *                                       Omit to get every entry.
 *
 * Phase 10-full of AI-UNIVERSAL-SURFACE-PLAN.md (2026-05-10).  Backed
 * by the in-memory registry at src/utils/ai-catalog-registry.ts;
 * controllers register their entries at module-load time.
 *
 * No write surface — controllers register via the in-process API,
 * not via HTTP.  The frontend is a read-only consumer.
 */

import { Router, type Response } from 'express';
import { query, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';
import {
	getAiCatalog,
	type AiCatalogCategory,
	type AiCatalogExposure,
} from '../utils/ai-catalog-registry.js';

const logger = new Logger('AiCatalogController');

const VALID_EXPOSURES: AiCatalogExposure[] = ['tool', 'admin', 'never'];

export function createAiCatalogRouter(): Router {
	const router = Router();

	/** GET /api/ai/catalog */
	router.get(
		'/',
		query('exposure').optional().isIn(VALID_EXPOSURES),
		query('category').optional().isString(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.tenantId) {
				return res
					.status(401)
					.json({ success: false, error: 'Catalog query requires an authenticated tenant.' });
			}

			const exposureParam = req.query.exposure as AiCatalogExposure | undefined;
			const categoryParam = req.query.category as AiCatalogCategory | undefined;

			// Filter by exposure with the user's role in mind: non-admins
			// never see 'admin'-tier entries.  Non-admins requesting
			// exposure=admin get an empty list (don't 403 — the catalog
			// is non-sensitive metadata about route existence).
			const roleStr = Array.isArray(user.role) ? user.role[0] : user.role;
			const isAdmin =
				typeof roleStr === 'string' && roleStr.toLowerCase() === 'admin';
			const allowedExposures: AiCatalogExposure[] = isAdmin
				? ['tool', 'admin']
				: ['tool'];
			const exposureFilter = exposureParam
				? allowedExposures.includes(exposureParam)
					? [exposureParam]
					: []
				: allowedExposures;

			if (exposureFilter.length === 0) {
				return res.json({
					success: true,
					data: [],
					totalCount: 0,
					schemaVersion: 'v1',
				});
			}

			const opts: Parameters<typeof getAiCatalog>[0] = { exposure: exposureFilter };
			if (categoryParam) opts.category = categoryParam;
			const list = getAiCatalog(opts);

			logger.info('AI catalog query', {
				tenantId: user.tenantId,
				userId: user.id,
				isAdmin,
				exposureFilter,
				category: categoryParam,
				resultCount: list.length,
			});

			return res.json({
				success: true,
				data: list,
				totalCount: list.length,
				schemaVersion: 'v1',
			});
		},
	);

	return router;
}
