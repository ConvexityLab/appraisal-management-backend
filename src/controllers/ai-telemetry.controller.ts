/**
 * AI Telemetry Controller
 *
 *   POST /api/telemetry/ai   — append N telemetry events to the
 *                              `ai-telemetry-events` container.  Accepts
 *                              batches of up to 100 events per request.
 *
 * Unlike `ai-audit-events`, telemetry is best-effort observability —
 * short retention (30-day Cosmos TTL) + non-blocking writes on the
 * frontend.  The backend still refuses mismatched tenant / malformed
 * events so dashboards can trust the column set.
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const CONTAINER_NAME = 'ai-telemetry-events';
const MAX_BATCH = 100;

const logger = new Logger('AiTelemetryController');

interface AiTelemetryEvent {
	eventType: string;
	timestamp: string;
	conversationId?: string;
	toolName?: string;
	intentName?: string;
	latencyMs?: number;
	success?: boolean;
	errorCode?: string;
	pageType?: string;
	data?: Record<string, unknown>;
}

interface AiTelemetryDoc extends AiTelemetryEvent {
	id: string;
	entityType: 'ai-telemetry-event';
	tenantId: string;
	userId: string;
	receivedAt: string;
}

export function createAiTelemetryRouter(cosmos: CosmosDbService): Router {
	const router = Router();

	/** POST /api/telemetry/ai — batch ingest */
	router.post(
		'/',
		body('events').isArray({ min: 1, max: MAX_BATCH }),
		body('events.*.eventType').isString().isLength({ min: 1, max: 100 }),
		body('events.*.timestamp').isISO8601(),
		async (req: UnifiedAuthRequest, res: Response) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ success: false, errors: errors.array() });
			}
			const user = req.user;
			if (!user?.id || !user?.tenantId) {
				return res.status(401).json({ success: false, error: 'Missing auth context.' });
			}

			const events: AiTelemetryEvent[] = req.body.events;
			const receivedAt = new Date().toISOString();
			const writeErrors: { index: number; error: unknown }[] = [];

			// Best-effort batch: attempt each write; collect failures.  We
			// do NOT abort on the first failure so one bad row doesn't
			// poison an otherwise-valid batch.
			await Promise.all(
				events.map(async (evt, index) => {
					// Build doc conditionally — exactOptionalPropertyTypes
					// forbids explicit undefined for declared-optional fields.
					const doc: AiTelemetryDoc = {
						id: uuidv4(),
						entityType: 'ai-telemetry-event',
						tenantId: user.tenantId!,
						userId: user.id,
						eventType: evt.eventType,
						timestamp: evt.timestamp,
						receivedAt,
						...(typeof evt.conversationId === 'string' && { conversationId: evt.conversationId }),
						...(typeof evt.toolName === 'string' && { toolName: evt.toolName }),
						...(typeof evt.intentName === 'string' && { intentName: evt.intentName }),
						...(typeof evt.latencyMs === 'number' && { latencyMs: evt.latencyMs }),
						...(typeof evt.success === 'boolean' && { success: evt.success }),
						...(typeof evt.errorCode === 'string' && { errorCode: evt.errorCode }),
						...(typeof evt.pageType === 'string' && { pageType: evt.pageType }),
						...(evt.data && typeof evt.data === 'object' && { data: evt.data }),
					};
					const result = await cosmos.createItem<AiTelemetryDoc>(CONTAINER_NAME, doc);
					if (!result.success) {
						writeErrors.push({ index, error: result.error });
					}
				}),
			);

			if (writeErrors.length > 0) {
				logger.warn('AI telemetry batch partial failure', {
					tenantId: user.tenantId,
					userId: user.id,
					total: events.length,
					failed: writeErrors.length,
				});
			}
			return res.status(202).json({
				success: true,
				accepted: events.length - writeErrors.length,
				failed: writeErrors.length,
				errors: writeErrors.length > 0 ? writeErrors : undefined,
			});
		},
	);

	return router;
}
