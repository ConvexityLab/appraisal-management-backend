/**
 * DecisionOverrideService — cross-category operator override surface.
 *
 * Phase M.1 of docs/DECISION_ENGINE_RULES_SURFACE.md. Lets operators
 * change the disposition of any Decision Engine decision after the fact.
 * Persists override fields on the trace doc, writes an audit row, and
 * publishes a `decision.overridden` event so downstream consumers
 * (re-routing, notifications) can react.
 *
 * Each category supplies its own container + lookup logic via a small
 * registry; adding a new category just means adding a new entry here.
 * No new container is provisioned — overrides are additive fields on the
 * existing trace docs.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import { ServiceBusEventPublisher } from '../../service-bus-publisher.js';
import { EventCategory, EventPriority } from '../../../types/events.js';

export interface DecisionOverrideRequest {
	category: string;
	tenantId: string;
	decisionId: string;
	overrideOutcome: string;
	reason: string;
	overriddenBy: string;
	overrideData?: Record<string, unknown>;
}

export interface DecisionOverrideResult {
	category: string;
	decisionId: string;
	previousOutcome: string | null;
	overrideOutcome: string;
	overriddenAt: string;
}

interface CategoryAdapter {
	container: string;
	/** Partition key value to use when reading/upserting. */
	partitionKey: (doc: { tenantId?: string; orderId?: string; jobId?: string }, decisionId: string) => string;
	/** Cosmos query to find the doc by id when partition key isn't known. */
	findById: (decisionId: string) => { query: string; params: Array<{ name: string; value: string }> };
	/** Read the current outcome off the trace shape. */
	readOutcome: (doc: Record<string, unknown>) => string | null;
}

const ADAPTERS: Record<string, CategoryAdapter> = {
	'vendor-matching': {
		container: 'assignment-traces',
		partitionKey: (doc) => doc.tenantId ?? '',
		findById: (id) => ({
			query: 'SELECT * FROM c WHERE c.type = \'assignment-trace\' AND c.id = @id',
			params: [{ name: '@id', value: id }],
		}),
		readOutcome: (doc) => (doc['outcome'] as string | undefined) ?? null,
	},
	'firing-rules': {
		container: 'firing-decisions',
		partitionKey: (doc) => doc.tenantId ?? '',
		findById: (id) => ({
			query: 'SELECT * FROM c WHERE c.type = \'firing-decision\' AND c.id = @id',
			params: [{ name: '@id', value: id }],
		}),
		readOutcome: (doc) => (doc['outcome'] as string | undefined) ?? null,
	},
	'review-program': {
		container: 'review-results',
		// jobId for bulk-portfolio rows; orderId-as-jobId for order-created rows.
		partitionKey: (doc) => (doc.jobId ?? doc.orderId ?? '') as string,
		findById: (id) => ({
			query: 'SELECT * FROM c WHERE c.id = @id',
			params: [{ name: '@id', value: id }],
		}),
		readOutcome: (doc) => (doc['computedDecision'] as string | undefined)
			?? (doc['overrideDecision'] as string | undefined)
			?? null,
	},
};

export class DecisionOverrideService {
	private readonly logger = new Logger('DecisionOverrideService');
	private readonly publisher: ServiceBusEventPublisher;

	constructor(private readonly db: CosmosDbService) {
		this.publisher = new ServiceBusEventPublisher();
	}

	supportsCategory(category: string): boolean {
		return Boolean(ADAPTERS[category]);
	}

	async override(input: DecisionOverrideRequest): Promise<DecisionOverrideResult> {
		this.validate(input);
		const adapter = ADAPTERS[input.category];
		if (!adapter) {
			throw new Error(
				`Override not supported for category '${input.category}'. ` +
				`Supported: ${Object.keys(ADAPTERS).join(', ')}.`,
			);
		}

		// 1. Load the existing trace doc
		const { query, params } = adapter.findById(input.decisionId);
		const docs = await this.db.queryDocuments<Record<string, unknown>>(adapter.container, query, params);
		const trace = docs[0];
		if (!trace) {
			throw new Error(
				`Decision '${input.decisionId}' not found in ${adapter.container}.`,
			);
		}

		// 2. Tenant ownership guard — never let one tenant override another tenant's decision.
		const traceTenantId = trace['tenantId'] as string | undefined;
		if (traceTenantId && traceTenantId !== input.tenantId) {
			throw new Error(
				`Decision '${input.decisionId}' belongs to a different tenant — override refused.`,
			);
		}

		// 3. Stamp override fields. Use the field names that match the doc's
		// existing convention (ReviewTapeResult uses overrideDecision; others
		// use overrideOutcome) — preserve both for forward compat.
		const now = new Date().toISOString();
		const previousOutcome = adapter.readOutcome(trace);

		const updated = {
			...trace,
			overrideOutcome: input.overrideOutcome,
			// Mirror to ReviewTapeResult's existing field name for review-program.
			...(input.category === 'review-program' ? { overrideDecision: input.overrideOutcome } : {}),
			overrideReason: input.reason,
			overriddenBy: input.overriddenBy,
			overriddenAt: now,
			...(input.overrideData ? { overrideData: input.overrideData } : {}),
		};

		await this.db.upsertDocument(adapter.container, updated);

		// 4. Audit row. Reuse the existing decision-rule-audit container so
		// every audit feed already shows it without extra wiring.
		await this.db.createDocument('decision-rule-audit', {
			id: uuidv4(),
			type: 'decision-rule-audit',
			category: input.category,
			tenantId: input.tenantId,
			packId: (trace['packId'] as string | undefined) ?? null,
			fromVersion: null,
			toVersion: null,
			action: 'override',
			actor: input.overriddenBy,
			reason: input.reason,
			timestamp: now,
			decisionId: input.decisionId,
			previousOutcome,
			overrideOutcome: input.overrideOutcome,
		} as never);

		// 5. Publish event for downstream re-routing.
		try {
			await this.publisher.publish({
				id: uuidv4(),
				type: 'decision.overridden',
				timestamp: new Date(),
				source: 'decision-override-service',
				version: '1.0',
				category: EventCategory.ORDER,
				priority: EventPriority.NORMAL,
				data: {
					tenantId: input.tenantId,
					decisionCategory: input.category,
					decisionId: input.decisionId,
					previousOutcome,
					overrideOutcome: input.overrideOutcome,
					reason: input.reason,
					overriddenBy: input.overriddenBy,
					overrideData: input.overrideData ?? {},
					subjectOrderId: (trace['orderId'] as string | undefined) ?? null,
					subjectVendorId: (trace['vendorId'] as string | undefined) ?? null,
				},
			} as never);
		} catch (err) {
			// Decision is already persisted; publish is best-effort.
			this.logger.warn('decision.overridden publish failed (override recorded anyway)', {
				decisionId: input.decisionId,
				error: err instanceof Error ? err.message : String(err),
			});
		}

		this.logger.info('decision overridden', {
			category: input.category,
			decisionId: input.decisionId,
			previousOutcome,
			overrideOutcome: input.overrideOutcome,
			overriddenBy: input.overriddenBy,
		});

		return {
			category: input.category,
			decisionId: input.decisionId,
			previousOutcome,
			overrideOutcome: input.overrideOutcome,
			overriddenAt: now,
		};
	}

	private validate(input: DecisionOverrideRequest): void {
		if (!input.tenantId) throw new Error('tenantId is required');
		if (!input.decisionId) throw new Error('decisionId is required');
		if (!input.overrideOutcome || typeof input.overrideOutcome !== 'string') {
			throw new Error('overrideOutcome is required and must be a non-empty string');
		}
		if (!input.reason || typeof input.reason !== 'string' || input.reason.trim().length < 4) {
			throw new Error('reason is required (minimum 4 characters)');
		}
		if (!input.overriddenBy) throw new Error('overriddenBy is required');
	}
}
