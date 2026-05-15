/**
 * AiAutopilotPublisher — Phase 14 v2 (2026-05-11).
 *
 * Thin wrapper over the Azure Service Bus SDK that sends `autopilot-task`
 * messages to a dedicated QUEUE (not topic).  Queue semantics are
 * preferred here:
 *   - Exactly one consumer pod picks up each message (no fan-out).
 *   - Built-in DLQ when delivery exceeds the configured MaxDeliveries.
 *   - First-in-first-out per session (we don't use sessions today;
 *     idempotencyKey handles dedupe).
 *
 * Mocks the SDK when `AZURE_SERVICE_BUS_NAMESPACE` is unset (local dev) —
 * messages are stashed in `mockOutbox` so tests can assert what would
 * have been published.  Production uses Managed Identity via
 * `DefaultAzureCredential` (per CLAUDE.md rule #1 — no keys).
 */

import {
	ServiceBusClient,
	type ServiceBusSender,
} from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { AutopilotTaskMessage } from './ai-autopilot.service.js';

// Queue name is fixed — declared in
// `infrastructure/modules/service-bus.bicep` as `autopilot-tasks` and
// hardcoded on both ends (publisher + consumer) so no env-name drift.
const QUEUE_NAME = 'autopilot-tasks';

/** Test-visible mock outbox.  Cleared by `_resetForTests()`. */
const mockOutbox: AutopilotTaskMessage[] = [];

export class AiAutopilotPublisher {
	private readonly logger = new Logger('AiAutopilotPublisher');
	private readonly client: ServiceBusClient | null;
	private sender: ServiceBusSender | null = null;
	private readonly queueName: string;
	private readonly useMock: boolean;

	constructor() {
		this.queueName = QUEUE_NAME;
		const ns = process.env.AZURE_SERVICE_BUS_NAMESPACE;
		const forceMock = process.env.USE_MOCK_SERVICE_BUS === 'true';
		this.useMock = forceMock || !ns || ns === 'local-emulator';
		if (this.useMock || !ns) {
			this.client = null;
			this.useMock = true;
			this.logger.info('AiAutopilotPublisher running in mock mode', { queue: this.queueName });
		} else {
			this.client = new ServiceBusClient(ns, new DefaultAzureCredential());
		}
	}

	async publish(task: AutopilotTaskMessage): Promise<void> {
		if (this.useMock) {
			mockOutbox.push(task);
			this.logger.info('Mock autopilot task queued', {
				queue: this.queueName,
				idempotencyKey: task.idempotencyKey,
			});
			return;
		}
		if (!this.client) throw new Error('AiAutopilotPublisher client not initialised.');
		if (!this.sender) {
			this.sender = this.client.createSender(this.queueName);
		}
		await this.sender.sendMessages({
			messageId: uuidv4(),
			contentType: 'application/json',
			body: task,
			applicationProperties: {
				tenantId: task.tenantId,
				recipeId: task.recipeId,
				triggerKind: task.triggeredBy.kind,
			},
			...(task.idempotencyKey && { correlationId: task.idempotencyKey }),
		});
		this.logger.info('Published autopilot task', {
			queue: this.queueName,
			tenantId: task.tenantId,
			recipeId: task.recipeId,
			idempotencyKey: task.idempotencyKey,
		});
	}

	async close(): Promise<void> {
		try {
			if (this.sender) await this.sender.close();
			if (this.client) await this.client.close();
		} catch (err) {
			this.logger.warn('AiAutopilotPublisher close error', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}

/** Test helpers — exported so the sweep job's tests can assert publishes. */
export function _peekAutopilotMockOutbox(): readonly AutopilotTaskMessage[] {
	return mockOutbox;
}

export function _resetAutopilotMockOutbox(): void {
	mockOutbox.length = 0;
}
