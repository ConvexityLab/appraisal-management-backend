/**
 * AiAutopilotConsumer — Phase 14 v2 (2026-05-11).
 *
 * Long-running Service Bus QUEUE consumer that pulls autopilot-task
 * messages and hands them to `AiAutopilotService.processTask`.  Each
 * message is completed on success, abandoned on transient failure (so
 * the broker can redeliver), or dead-lettered after MaxDeliveries.
 *
 * Started by `api-server.ts` after Cosmos is initialised.  Lifecycle
 * mirrors the existing `OverdueOrderDetectionJob` — start/stop methods,
 * graceful shutdown on SIGTERM.
 *
 * Mock-mode: when no AZURE_SERVICE_BUS_NAMESPACE is set, the consumer
 * does NOT poll a real queue.  Tests drive `processOneTask` directly
 * with a synthetic message envelope.  This keeps the SB SDK out of the
 * test fast-path and avoids needing the emulator locally.
 */

import {
	ServiceBusClient,
	type ServiceBusReceiver,
	type ServiceBusReceivedMessage,
} from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import {
	AiAutopilotService,
	type AutopilotProcessResult,
	type AutopilotTaskMessage,
} from './ai-autopilot.service.js';

const DEFAULT_QUEUE = 'autopilot-tasks';

export class AiAutopilotConsumer {
	private readonly logger = new Logger('AiAutopilotConsumer');
	private readonly cosmos: CosmosDbService;
	private readonly autopilot: AiAutopilotService;
	private client: ServiceBusClient | null = null;
	private receiver: ServiceBusReceiver | null = null;
	private readonly queueName: string;
	private readonly useMock: boolean;
	private isRunning = false;

	constructor(dbService?: CosmosDbService) {
		this.cosmos = dbService ?? new CosmosDbService();
		this.autopilot = new AiAutopilotService(this.cosmos);
		this.queueName = process.env.AI_AUTOPILOT_QUEUE_NAME || DEFAULT_QUEUE;
		const ns = process.env.AZURE_SERVICE_BUS_NAMESPACE;
		const forceMock = process.env.USE_MOCK_SERVICE_BUS === 'true';
		this.useMock = forceMock || !ns || ns === 'local-emulator';
	}

	/**
	 * Begin consuming.  In production this wires the SDK receiver's
	 * subscribe() callback to processOneTask.  In mock mode it logs
	 * a one-liner and returns — tests poke processOneTask directly.
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			this.logger.warn('AiAutopilotConsumer already running');
			return;
		}
		this.isRunning = true;
		if (this.useMock) {
			this.logger.info('AiAutopilotConsumer running in mock mode (no real SB)', {
				queue: this.queueName,
			});
			return;
		}
		const ns = process.env.AZURE_SERVICE_BUS_NAMESPACE;
		if (!ns) throw new Error('AZURE_SERVICE_BUS_NAMESPACE required to consume autopilot tasks.');
		this.client = new ServiceBusClient(ns, new DefaultAzureCredential());
		this.receiver = this.client.createReceiver(this.queueName);
		this.logger.info('AiAutopilotConsumer subscribed', { namespace: ns, queue: this.queueName });
		this.receiver.subscribe({
			processMessage: async (msg) => {
				await this.handleSdkMessage(msg);
			},
			processError: async (args) => {
				this.logger.error('AiAutopilotConsumer receive error', {
					error: args.error instanceof Error ? args.error.message : String(args.error),
					source: args.errorSource,
				});
			},
		});
	}

	async stop(): Promise<void> {
		if (!this.isRunning) return;
		this.isRunning = false;
		try {
			if (this.receiver) await this.receiver.close();
			if (this.client) await this.client.close();
		} catch (err) {
			this.logger.warn('AiAutopilotConsumer close error', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	/**
	 * Public entry point for tests + the in-process fast-path.  Returns
	 * the structured result from AiAutopilotService.  SDK consumers
	 * map the result to complete / abandon / dead-letter.
	 */
	async processOneTask(task: AutopilotTaskMessage): Promise<AutopilotProcessResult> {
		try {
			return await this.autopilot.processTask(task);
		} catch (err) {
			this.logger.error('processOneTask threw unexpectedly', {
				error: err instanceof Error ? err.message : String(err),
				tenantId: task?.tenantId,
				recipeId: task?.recipeId,
			});
			return {
				ok: false,
				status: 'failed',
				reason: err instanceof Error ? err.message : 'unknown-error',
			};
		}
	}

	private async handleSdkMessage(msg: ServiceBusReceivedMessage): Promise<void> {
		if (!this.receiver) return;
		const body = msg.body;
		const task = this.coerceTask(body);
		if (!task) {
			this.logger.warn('Dead-lettering malformed autopilot message', {
				messageId: msg.messageId,
			});
			await this.receiver.deadLetterMessage(msg, {
				deadLetterReason: 'malformed-body',
				deadLetterErrorDescription: 'AiAutopilotConsumer could not coerce message body to AutopilotTaskMessage.',
			});
			return;
		}
		const result = await this.processOneTask(task);
		if (result.ok || result.status === 'awaiting-approval' || result.status === 'cancelled') {
			// Terminal-for-this-delivery — even cancellations are
			// completed (the run row records the reason).
			await this.receiver.completeMessage(msg);
		} else {
			// Transient failure — abandon so the broker can redeliver.
			// MaxDeliveries on the queue eventually DLQs.
			await this.receiver.abandonMessage(msg, {
				reason: result.reason ?? 'process-failed',
			});
		}
	}

	private coerceTask(body: unknown): AutopilotTaskMessage | null {
		if (!body || typeof body !== 'object') return null;
		const b = body as Record<string, unknown>;
		if (typeof b.tenantId !== 'string') return null;
		if (typeof b.recipeId !== 'string') return null;
		if (typeof b.idempotencyKey !== 'string') return null;
		const tb = b.triggeredBy as Record<string, unknown> | undefined;
		if (!tb || typeof tb.kind !== 'string') return null;
		return {
			tenantId: b.tenantId,
			recipeId: b.recipeId,
			idempotencyKey: b.idempotencyKey,
			triggeredBy: {
				kind: tb.kind as AutopilotTaskMessage['triggeredBy']['kind'],
				...(typeof tb.sourceId === 'string' && { sourceId: tb.sourceId }),
				...(typeof tb.parentRunId === 'string' && { parentRunId: tb.parentRunId }),
				...(typeof tb.chainDepth === 'number' && { chainDepth: tb.chainDepth }),
			},
		};
	}
}
