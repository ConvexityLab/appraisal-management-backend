/**
 * AI Conversation Controller
 *
 *   GET    /api/ai/conversations             — list current user's conversations
 *   GET    /api/ai/conversations/:id         — fetch one
 *   PUT    /api/ai/conversations/:id         — upsert (the frontend sends
 *                                                the whole doc; server
 *                                                overwrites tenantId/userId
 *                                                from auth).
 *   DELETE /api/ai/conversations/:id         — delete one
 *   DELETE /api/ai/conversations              — wipe ALL for the current user
 *                                                (powers "Forget history" UI
 *                                                + account-closure flow)
 *
 * Tenant + user always come from `req.user` — never trusted from the body.
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AiConversationService, type AiMessage } from '../services/ai-conversation.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiConversationController');

export function createAiConversationRouter(cosmos: CosmosDbService): Router {
	const router = Router();
	const service = new AiConversationService(cosmos);

	/** GET /api/ai/conversations */
	router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.id || !user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Missing auth context.' });
		}
		const result = await service.listForUser(user.tenantId, user.id);
		if (!result.success) {
			logger.error('listForUser failed', { error: result.error });
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.json({
			success: true,
			data: result.data ?? [],
			totalCount: (result.data ?? []).length,
		});
	});

	/** GET /api/ai/conversations/:id */
	router.get(
		'/:id',
		param('id').isString().isLength({ min: 1 }),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({ success: false, error: 'Missing auth context.' });
			}
			const conversationId = req.params.id ?? '';
			if (!conversationId) {
				return res.status(400).json({ success: false, error: 'Missing :id' });
			}
			const result = await service.getOne(user.tenantId, user.id, conversationId);
			if (!result.success) {
				return res.status(500).json({ success: false, error: result.error });
			}
			if (!result.data) {
				return res.status(404).json({ success: false, error: 'Conversation not found.' });
			}
			return res.json({ success: true, data: result.data });
		},
	);

	/** PUT /api/ai/conversations/:id — upsert */
	router.put(
		'/:id',
		param('id').isString().isLength({ min: 1 }),
		body('messages').isArray(),
		body('createdAt').optional().isInt(),
		body('pageType').optional().isString(),
		body('orderId').optional(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({ success: false, error: 'Missing auth context.' });
			}

			const {
				messages,
				createdAt,
				pageType,
				orderId,
			}: {
				messages: AiMessage[];
				createdAt?: number;
				pageType?: string;
				orderId?: string | null;
			} = req.body;

			const conversationId = req.params.id ?? '';
			if (!conversationId) {
				return res.status(400).json({ success: false, error: 'Missing :id' });
			}
			const upsertInput: Parameters<typeof service.upsert>[2] = {
				id: conversationId,
				messages,
				orderId: orderId ?? null,
			};
			if (typeof createdAt === 'number') upsertInput.createdAt = createdAt;
			if (typeof pageType === 'string') upsertInput.pageType = pageType;
			const result = await service.upsert(user.tenantId, user.id, upsertInput);
			if (!result.success) {
				return res.status(500).json({ success: false, error: result.error });
			}
			return res.status(200).json({ success: true, data: result.data });
		},
	);

	/** DELETE /api/ai/conversations/:id */
	router.delete(
		'/:id',
		param('id').isString().isLength({ min: 1 }),
		async (req: UnifiedAuthRequest, res: Response) => {
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({ success: false, error: 'Missing auth context.' });
			}
			const conversationId = req.params.id ?? '';
			if (!conversationId) {
				return res.status(400).json({ success: false, error: 'Missing :id' });
			}
			const result = await service.deleteOne(user.tenantId, user.id, conversationId);
			if (!result.success) {
				const status = result.error?.code === 'NOT_FOUND' ? 404 : 500;
				return res.status(status).json({ success: false, error: result.error });
			}
			return res.json({ success: true });
		},
	);

	/** DELETE /api/ai/conversations — wipe ALL for current user */
	router.delete('/', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.id || !user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Missing auth context.' });
		}
		const result = await service.deleteAllForUser(user.tenantId, user.id);
		if (!result.success) {
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.json({ success: true, data: result.data });
	});

	return router;
}
