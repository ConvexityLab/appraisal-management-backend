/**
 * Azure Service Bus Event Publisher
 * Handles publishing events to Azure Service Bus topics for decoupled messaging
 */

import { ServiceBusClient, ServiceBusSender, ServiceBusMessage } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { AppEvent, EventPublisher } from '../types/events.js';
import { Logger } from '../utils/logger.js';
import { inMemoryEventBus } from './in-memory-event-bus.js';

export class ServiceBusEventPublisher implements EventPublisher {
  private client: ServiceBusClient;
  private senders: Map<string, ServiceBusSender> = new Map();
  private readonly serviceBusNamespace: string;
  private readonly topicName: string;
  private readonly logger: Logger;
  private readonly useMockBus: boolean;

  constructor(serviceBusNamespace?: string, topicName: string = 'appraisal-events') {
    this.topicName = topicName;
    this.logger = new Logger('ServiceBusEventPublisher');

    const resolvedNamespace = serviceBusNamespace || process.env.AZURE_SERVICE_BUS_NAMESPACE;
    const forceMock = process.env.USE_MOCK_SERVICE_BUS === 'true';
    this.useMockBus = forceMock || !resolvedNamespace || resolvedNamespace === 'local-emulator';

    // E-01: Refuse to boot in production with a mock Service Bus. A silent fallback
    // to the in-memory mock causes events to be dropped and audit/dashboards to
    // silently go blank, which is the exact failure mode we must never ship.
    if (this.useMockBus && process.env.NODE_ENV === 'production') {
      const reason = forceMock
        ? 'USE_MOCK_SERVICE_BUS=true is set'
        : !resolvedNamespace
          ? 'AZURE_SERVICE_BUS_NAMESPACE is not set'
          : `AZURE_SERVICE_BUS_NAMESPACE is set to the sentinel "local-emulator"`;
      throw new Error(
        `ServiceBusEventPublisher refuses to start in production with mock bus enabled. ` +
        `Reason: ${reason}. Configure a real Azure Service Bus namespace via ` +
        `AZURE_SERVICE_BUS_NAMESPACE (fully-qualified, e.g. my-ns.servicebus.windows.net) ` +
        `and ensure USE_MOCK_SERVICE_BUS is unset or false.`,
      );
    }

    if (this.useMockBus) {
      // Only use mock when there truly is no namespace configured
      this.serviceBusNamespace = 'local-emulator';
      this.logger.info(
        forceMock
          ? 'USE_MOCK_SERVICE_BUS=true — using in-memory mock Service Bus'
          : 'No AZURE_SERVICE_BUS_NAMESPACE configured — using in-memory mock Service Bus',
      );
      this.client = this.createMockClient();
    } else {
      if (!resolvedNamespace) {
        throw new Error('AZURE_SERVICE_BUS_NAMESPACE is required when USE_MOCK_SERVICE_BUS is not enabled');
      }
      this.serviceBusNamespace = resolvedNamespace;
      const credential = new DefaultAzureCredential();
      this.client = new ServiceBusClient(this.serviceBusNamespace, credential);
      this.logger.info('Using Managed Identity for Service Bus authentication', { namespace: this.serviceBusNamespace });
    }
  }

  private createMockClient(): any {
    const mockSender = {
      sendMessages: async (messages: ServiceBusMessage | ServiceBusMessage[]) => {
        const messageArray = Array.isArray(messages) ? messages : [messages];
        this.logger.info(`Mock Service Bus: Publishing ${messageArray.length} messages`);
        messageArray.forEach((msg, index) => {
          this.logger.info(`Mock Message ${index + 1}:`, {
            subject: msg.subject,
            body: typeof msg.body === 'string' ? msg.body.substring(0, 100) + '...' : 'Binary data',
            applicationProperties: msg.applicationProperties
          });
        });
      },
      close: async () => {
        this.logger.info('Mock Service Bus sender closed');
      }
    };

    return {
      createSender: (topicName: string) => {
        this.logger.info(`Mock Service Bus: Creating sender for topic ${topicName}`);
        return mockSender;
      },
      close: async () => {
        this.logger.info('Mock Service Bus client closed');
      }
    };
  }

  private async getSender(topicName: string): Promise<ServiceBusSender> {
    if (!this.senders.has(topicName)) {
      const sender = this.client.createSender(topicName);
      this.senders.set(topicName, sender);
    }
    return this.senders.get(topicName)!;
  }

  /**
   * O-02: Pull the current request's correlationId from AsyncLocalStorage so
   * publishers never have to thread it through manually. Returns the event
   * with correlationId set (if not already present).
   */
  private withCorrelationId(event: AppEvent): AppEvent {
    if (event.correlationId) return event;
    const als = (global as any).asyncLocalStorage as
      | { getStore(): Map<string, string> | undefined }
      | undefined;
    const id = als?.getStore()?.get('correlationId');
    if (!id) return event;
    return { ...event, correlationId: id } as AppEvent;
  }

  private dispatchMockAsync(event: AppEvent): void {
    setImmediate(() => {
      void inMemoryEventBus.publish(event).then(
        () => {
          this.logger.info(`Published event (mock bus): ${event.type}`, { eventId: event.id });
        },
        (error) => {
          this.logger.error('Mock bus handler failed', {
            error,
            eventId: event.id,
            eventType: event.type,
          });
        },
      );
    });
  }

  async publish(event: AppEvent): Promise<void> {
    const enriched = this.withCorrelationId(event);
    try {
      if (this.useMockBus) {
        this.dispatchMockAsync(enriched);
        return;
      }

      const sender = await this.getSender(this.topicName);

      const message: ServiceBusMessage = {
        subject: enriched.type,
        body: JSON.stringify(enriched),
        applicationProperties: {
          eventType: enriched.type,
          category: (enriched as any).category,
          priority: (enriched as any).data?.priority || 'normal',
          source: enriched.source,
          correlationId: enriched.correlationId || ''
        },
        messageId: enriched.id,
        ...(enriched.correlationId && { correlationId: enriched.correlationId })
      };

      await sender.sendMessages(message);
      this.logger.info(`Published event: ${enriched.type}`, { eventId: enriched.id, correlationId: enriched.correlationId });
    } catch (error) {
      this.logger.error('Failed to publish event', { error, eventId: enriched.id, eventType: enriched.type });
      throw error;
    }
  }

  async publishBatch(events: AppEvent[]): Promise<void> {
    if (events.length === 0) return;
    const enrichedEvents = events.map((e) => this.withCorrelationId(e));

    try {
      if (this.useMockBus) {
        for (const event of enrichedEvents) {
          this.dispatchMockAsync(event);
        }
        this.logger.info(`Queued batch of ${enrichedEvents.length} events (mock bus)`);
        return;
      }

      const sender = await this.getSender(this.topicName);

      const messages: ServiceBusMessage[] = enrichedEvents.map(event => ({
        subject: event.type,
        body: JSON.stringify(event),
        applicationProperties: {
          eventType: event.type,
          category: (event as any).category,
          priority: (event as any).data?.priority || 'normal',
          source: event.source,
          correlationId: event.correlationId || ''
        },
        messageId: event.id,
        ...(event.correlationId && { correlationId: event.correlationId })
      }));

      await sender.sendMessages(messages);
      this.logger.info(`Published batch of ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to publish event batch', { error, eventCount: events.length });
      throw error;
    }
  }

  /**
   * E-02: Exercise the Service Bus connection at boot.
   * Creates a sender for the configured topic. In production this forces AAD
   * token acquisition and fails fast if the namespace or managed-identity RBAC
   * is misconfigured. Topic non-existence only surfaces on the first real send;
   * we do not publish a health-ping here to keep the audit stream clean.
   */
  async verifyConnectivity(): Promise<void> {
    if (this.useMockBus) {
      this.logger.info('verifyConnectivity: mock bus in use — skipping real Service Bus probe');
      return;
    }
    try {
      await this.getSender(this.topicName);
      this.logger.info('verifyConnectivity: Service Bus sender initialised', {
        namespace: this.serviceBusNamespace,
        topic: this.topicName,
      });
    } catch (error) {
      this.logger.error('verifyConnectivity: failed to initialise Service Bus sender', {
        namespace: this.serviceBusNamespace,
        topic: this.topicName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      // Close all senders
      for (const [topicName, sender] of this.senders) {
        await sender.close();
        this.logger.info(`Closed sender for topic: ${topicName}`);
      }
      this.senders.clear();

      // Close the client
      await this.client.close();
      this.logger.info('Service Bus client closed');
    } catch (error) {
      this.logger.error('Error closing Service Bus connections', { error });
      throw error;
    }
  }
}