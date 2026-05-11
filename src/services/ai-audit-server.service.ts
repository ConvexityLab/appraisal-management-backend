/**
 * AI Audit Server Emitter — Phase 14 v1 (2026-05-10).
 *
 * Thin wrapper around `AiAuditService.write()` that lets BE services
 * emit audit rows WITHOUT going through HTTP.  Today's audit pipeline
 * was FE-only (`emitAiAudit` → POST /api/ai/audit); when autonomous
 * flows (Service Bus consumer, cron sweepers, webhook ingress) start
 * running on the BE without a human user typing prompts, we need a
 * service-side path that:
 *
 *   1. Doesn't make HTTP calls to itself (wasteful + auth dance)
 *   2. Stamps `source` so /ai-audit can filter by origin
 *   3. Carries `triggeredBy` for the delegated-identity model
 *      (every autopilot run has a sponsoring human user; this field
 *      attributes the run back to them)
 *
 * Per AI-UNIVERSAL-SURFACE-PLAN.md §4 Phase 14.
 *
 * Usage pattern:
 *
 *   const emitter = new AiAuditServerEmitter(cosmos);
 *   await emitter.emit({
 *     tenantId,
 *     userId: sponsorUserId,                  // delegated identity
 *     name: 'evaluateVendorMatching',
 *     kind: 'tool',
 *     sideEffect: 'read',
 *     scopes: ['order:read', 'vendor:read'],
 *     success: true,
 *     description: 'Autopilot ran vendor-matching evaluation',
 *     source: 'autopilot',
 *     triggeredBy: {
 *       kind: 'cron',
 *       recipeId: 'stuck-order-triage',
 *       sponsorUserId,
 *     },
 *   });
 */

import { Logger } from '../utils/logger.js';
import { AiAuditService, type AiAuditDoc, type AiAuditWriteInput } from './ai-audit.service.js';
import type { CosmosDbService } from './cosmos-db.service.js';

export interface AiAuditServerEmitInput extends AiAuditWriteInput {
	tenantId: string;
	userId: string;
	source: NonNullable<AiAuditDoc['source']>;
	triggeredBy?: AiAuditDoc['triggeredBy'];
}

export class AiAuditServerEmitter {
	private readonly logger = new Logger('AiAuditServerEmitter');
	private readonly service: AiAuditService;

	constructor(cosmos: CosmosDbService) {
		this.service = new AiAuditService(cosmos);
	}

	/**
	 * Emit one audit row.  Fail-safe: errors are logged but never thrown
	 * — an unaudited write shouldn't crash a domain flow.  The /ai-audit
	 * page surfaces missing rows under "low coverage" KPIs when Phase 15
	 * ships, so silent drops still get noticed.
	 */
	async emit(input: AiAuditServerEmitInput): Promise<void> {
		const { tenantId, userId, ...row } = input;
		try {
			const result = await this.service.write(tenantId, userId, {
				...row,
				timestamp: row.timestamp ?? new Date().toISOString(),
			});
			if (!result.success) {
				this.logger.warn('Failed to persist server-side audit row', {
					tenantId,
					userId,
					name: row.name,
					source: row.source,
					error: result.error,
				});
			}
		} catch (err) {
			this.logger.warn('Exception in server-side audit emit', {
				tenantId,
				userId,
				name: row.name,
				source: row.source,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
