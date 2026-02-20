/**
 * Azure Service Bus Event Publisher
 * Handles publishing events to Azure Service Bus topics for decoupled messaging
 */

import { ServiceBusClient, ServiceBusSender, ServiceBusMessage } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { AppEvent, EventPublisher } from '../types/events.js';
import { Logger } from '../utils/logger.js';

export class ServiceBusEventPublisher implements EventPublisher {
  private client: ServiceBusClient;
  private senders: Map<string, ServiceBusSender> = new Map();
  private readonly serviceBusNamespace: string;
  private readonly topicName: string;
  private readonly logger: Logger;

  constructor(serviceBusNamespace?: string, topicName: string = 'appraisal-events') {
    this.topicName = topicName;
    this.logger = new Logger('ServiceBusEventPublisher');

    const resolvedNamespace = serviceBusNamespace || process.env.AZURE_SERVICE_BUS_NAMESPACE;

    if (!resolvedNamespace || resolvedNamespace === 'local-emulator') {
      // Only use mock when there truly is no namespace configured
      this.serviceBusNamespace = 'local-emulator';
      this.logger.info('No AZURE_SERVICE_BUS_NAMESPACE configured — using mock Service Bus');
      this.client = this.createMockClient();
    } else {
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

  async publish(event: AppEvent): Promise<void> {
    try {
      const sender = await this.getSender(this.topicName);
      
      const message: ServiceBusMessage = {
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
      };

      await sender.sendMessages(message);
      this.logger.info(`Published event: ${event.type}`, { eventId: event.id });
    } catch (error) {
      this.logger.error('Failed to publish event', { error, eventId: event.id, eventType: event.type });
      throw error;
    }
  }

  async publishBatch(events: AppEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const sender = await this.getSender(this.topicName);
      
      const messages: ServiceBusMessage[] = events.map(event => ({
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