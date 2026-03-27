/**
 * Dead Letter Queue Monitor Service
 *
 * Provides read, reprocess, and discard operations for DLQ messages across
 * all managed Service Bus subscriptions on the appraisal-events topic.
 *
 * DLQ path format: <topic>/subscriptions/<subscription>/$deadletterqueue
 *
 * Connection: Managed Identity (DefaultAzureCredential) when
 * AZURE_SERVICE_BUS_NAMESPACE is set; mock fallback for local dev.
 */

import {
  ServiceBusClient,
  ServiceBusAdministrationClient,
  ServiceBusReceivedMessage,
  ServiceBusMessage,
} from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';

const TOPIC = 'appraisal-events';
const MANAGED_SUBSCRIPTIONS = [
  'notification-service',
  'auto-assignment-service',
  'auto-delivery-service',
  'audit-event-sink',
  'ai-qc-gate-service',
  'engagement-lifecycle-service',
  'engagement-letter-autosend-service',
  'axiom-auto-trigger-service',
  'vendor-performance-updater-service',
  'ucdp-ead-auto-submit-service',
];

export interface DLQMessageSummary {
  messageId: string;
  sequenceNumber: string;
  subscription: string;
  subject: string | undefined;
  deadLetterReason: string | undefined;
  deadLetterErrorDescription: string | undefined;
  enqueuedAt: Date | undefined;
  body: unknown;
}

export interface DLQSubscriptionStats {
  subscription: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
}

export interface DLQStats {
  topic: string;
  subscriptions: DLQSubscriptionStats[];
  totalDeadLetterMessages: number;
  retrievedAt: string;
}

export class DeadLetterQueueMonitorService {
  private readonly client: ServiceBusClient;
  private readonly adminClient: ServiceBusAdministrationClient | null;
  private readonly namespace: string;
  private readonly isMock: boolean;
  private readonly logger: Logger;

  constructor(serviceBusNamespace?: string) {
    this.logger = new Logger('DeadLetterQueueMonitorService');

    const resolvedNamespace = serviceBusNamespace || process.env.AZURE_SERVICE_BUS_NAMESPACE;

    if (!resolvedNamespace || resolvedNamespace === 'local-emulator') {
      this.namespace = 'local-emulator';
      this.isMock = true;
      this.logger.info('No AZURE_SERVICE_BUS_NAMESPACE configured — DLQ monitor in mock mode');
      this.client = {} as ServiceBusClient;
      this.adminClient = null;
    } else {
      this.namespace = `https://${resolvedNamespace}`;
      this.isMock = false;
      const credential = new DefaultAzureCredential();
      this.client = new ServiceBusClient(resolvedNamespace, credential);
      this.adminClient = new ServiceBusAdministrationClient(resolvedNamespace, credential);
      this.logger.info('DLQ monitor using Managed Identity', { namespace: resolvedNamespace });
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns active and dead-letter message counts for all managed subscriptions.
   */
  async getDeadLetterStats(): Promise<DLQStats> {
    if (this.isMock) {
      return this.mockStats();
    }

    if (!this.adminClient) {
      throw new Error('Service Bus administration client not initialised');
    }

    const stats: DLQSubscriptionStats[] = await Promise.all(
      MANAGED_SUBSCRIPTIONS.map(async (sub) => {
        const props = await this.adminClient!.getSubscriptionRuntimeProperties(TOPIC, sub);
        return {
          subscription: sub,
          activeMessageCount: props.activeMessageCount,
          deadLetterMessageCount: props.deadLetterMessageCount,
        };
      }),
    );

    return {
      topic: TOPIC,
      subscriptions: stats,
      totalDeadLetterMessages: stats.reduce((sum, s) => sum + s.deadLetterMessageCount, 0),
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Peeks (does NOT consume) up to maxMessages DLQ messages.
   * When subscription is omitted all managed subscriptions are queried.
   */
  async getDeadLetterMessages(
    subscription?: string,
    maxMessages = 50,
  ): Promise<DLQMessageSummary[]> {
    if (this.isMock) {
      return this.mockMessages(subscription);
    }

    const targets = subscription ? [subscription] : MANAGED_SUBSCRIPTIONS;

    const results: DLQMessageSummary[] = [];

    for (const sub of targets) {
      const dlqPath = `${TOPIC}/subscriptions/${sub}/$deadletterqueue`;
      const receiver = this.client.createReceiver(dlqPath, { receiveMode: 'peekLock' });

      try {
        const messages = await receiver.peekMessages(maxMessages);
        for (const msg of messages) {
          results.push(this.toSummary(msg, sub));
        }
      } finally {
        await receiver.close();
      }
    }

    return results;
  }

  /**
   * Receives and reprocesses a single DLQ message by forwarding it back onto
   * the main topic so it can be handled by all live subscriptions again.
   * The message is identified by matching messageId during receive.
   */
  async reprocessMessage(messageId: string, subscription: string): Promise<void> {
    if (!messageId) throw new Error('messageId is required');
    if (!subscription) throw new Error('subscription is required');
    if (this.isMock) {
      this.logger.info('Mock: reprocess message', { messageId, subscription });
      return;
    }

    const dlqPath = `${TOPIC}/subscriptions/${subscription}/$deadletterqueue`;
    const receiver = this.client.createReceiver(dlqPath, { receiveMode: 'peekLock' });
    const sender = this.client.createSender(TOPIC);

    try {
      // Receive a batch and find the target message.
      const messages = await receiver.receiveMessages(25, { maxWaitTimeInMs: 5000 });
      const target = messages.find((m) => m.messageId === messageId);

      if (!target) {
        // Abandon the others so they remain in DLQ.
        await Promise.all(messages.filter((m) => m.messageId !== messageId).map((m) => receiver.abandonMessage(m)));
        throw new Error(`Message ${messageId} not found in DLQ subscription '${subscription}'`);
      }

      // Abandon non-target messages first.
      await Promise.all(messages.filter((m) => m.messageId !== messageId).map((m) => receiver.abandonMessage(m)));

      const requeued: ServiceBusMessage = {
        body: target.body,
        applicationProperties: {
          ...(target.applicationProperties ?? {}),
          dlqReprocessedAt: new Date().toISOString(),
          dlqOriginalSubscription: subscription,
        },
        ...(target.messageId !== undefined ? { messageId: target.messageId } : {}),
        ...(target.subject !== undefined ? { subject: target.subject } : {}),
      };

      await sender.sendMessages(requeued);
      await receiver.completeMessage(target);

      this.logger.info('DLQ message reprocessed', { messageId, subscription });
    } finally {
      await receiver.close();
      await sender.close();
    }
  }

  /**
   * Permanently discards a DLQ message (completes it without requeuing).
   */
  async discardMessage(messageId: string, subscription: string): Promise<void> {
    if (!messageId) throw new Error('messageId is required');
    if (!subscription) throw new Error('subscription is required');
    if (this.isMock) {
      this.logger.info('Mock: discard message', { messageId, subscription });
      return;
    }

    const dlqPath = `${TOPIC}/subscriptions/${subscription}/$deadletterqueue`;
    const receiver = this.client.createReceiver(dlqPath, { receiveMode: 'peekLock' });

    try {
      const messages = await receiver.receiveMessages(25, { maxWaitTimeInMs: 5000 });
      const target = messages.find((m) => m.messageId === messageId);

      if (!target) {
        await Promise.all(messages.map((m) => receiver.abandonMessage(m)));
        throw new Error(`Message ${messageId} not found in DLQ subscription '${subscription}'`);
      }

      await Promise.all(messages.filter((m) => m.messageId !== messageId).map((m) => receiver.abandonMessage(m)));
      await receiver.completeMessage(target);

      this.logger.info('DLQ message discarded', { messageId, subscription });
    } finally {
      await receiver.close();
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toSummary(msg: ServiceBusReceivedMessage, subscription: string): DLQMessageSummary {
    return {
      messageId: String(msg.messageId ?? ''),
      sequenceNumber: String(msg.sequenceNumber ?? ''),
      subscription,
      subject: msg.subject,
      deadLetterReason: msg.deadLetterReason,
      deadLetterErrorDescription: msg.deadLetterErrorDescription,
      enqueuedAt: msg.enqueuedTimeUtc,
      body: msg.body,
    };
  }

  private mockStats(): DLQStats {
    return {
      topic: TOPIC,
      subscriptions: MANAGED_SUBSCRIPTIONS.map((sub) => ({
        subscription: sub,
        activeMessageCount: 0,
        deadLetterMessageCount: 0,
      })),
      totalDeadLetterMessages: 0,
      retrievedAt: new Date().toISOString(),
    };
  }

  private mockMessages(subscription?: string): DLQMessageSummary[] {
    const targets = subscription ? [subscription] : MANAGED_SUBSCRIPTIONS;
    return targets.map((sub) => ({
      messageId: `mock-dlq-${sub}-001`,
      sequenceNumber: '1',
      subscription: sub,
      subject: 'order.vendor.assigned',
      deadLetterReason: 'MaxDeliveryCountExceeded',
      deadLetterErrorDescription: 'Mock dead-letter message for local development',
      enqueuedAt: new Date(),
      body: { orderId: 'mock-order-001' },
    }));
  }
}
