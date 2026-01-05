/**
 * Azure Service Bus Event Subscriber
 * Handles subscribing to events from Azure Service Bus subscriptions
 */

import { ServiceBusClient, ServiceBusReceiver, ServiceBusReceivedMessage } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { AppEvent, BaseEvent, EventHandler, EventSubscriber } from '../types/events.js';
import { Logger } from '../utils/logger.js';

export class ServiceBusEventSubscriber implements EventSubscriber {
  private client: ServiceBusClient;
  private receivers: Map<string, ServiceBusReceiver> = new Map();
  private handlers: Map<string, EventHandler[]> = new Map();
  private readonly serviceBusNamespace: string;
  private readonly topicName: string;
  private readonly subscriptionName: string;
  private readonly logger: Logger;
  private isListening: boolean = false;

  constructor(
    serviceBusNamespace?: string,
    topicName: string = 'appraisal-events',
    subscriptionName: string = 'notification-service'
  ) {
    this.serviceBusNamespace = serviceBusNamespace || process.env.AZURE_SERVICE_BUS_NAMESPACE || (() => {
      if (process.env.NODE_ENV === 'development') {
        return 'local-emulator';
      }
      throw new Error('AZURE_SERVICE_BUS_NAMESPACE environment variable is required (e.g., myservicebus.servicebus.windows.net)');
    })();
    this.topicName = topicName;
    this.subscriptionName = subscriptionName;
    this.logger = new Logger('ServiceBusEventSubscriber');

    // For local development, we'll use a mock client
    if (this.serviceBusNamespace === 'local-emulator') {
      this.logger.info('Using local emulator mode for Service Bus');
      this.client = this.createMockClient();
    } else {
      // Use managed identity in production
      const credential = new DefaultAzureCredential();
      this.client = new ServiceBusClient(this.serviceBusNamespace, credential);
      this.logger.info('Using Managed Identity for Service Bus authentication');
    }
  }

  private createMockClient(): any {
    const mockReceiver = {
      subscribe: (handlers: any) => {
        this.logger.info('Mock Service Bus: Started subscription');
        // Simulate receiving messages periodically in local mode
        if (process.env.NODE_ENV === 'development') {
          this.simulateEvents();
        }
        return {
          close: async () => {
            this.logger.info('Mock Service Bus subscription closed');
          }
        };
      },
      close: async () => {
        this.logger.info('Mock Service Bus receiver closed');
      }
    };

    return {
      createReceiver: (topicName: string, subscriptionName: string) => {
        this.logger.info(`Mock Service Bus: Creating receiver for topic ${topicName}, subscription ${subscriptionName}`);
        return mockReceiver;
      },
      close: async () => {
        this.logger.info('Mock Service Bus client closed');
      }
    };
  }

  private simulateEvents(): void {
    // Simulate some test events for local development
    setTimeout(async () => {
      const mockEvent: AppEvent = {
        id: 'mock-' + Date.now(),
        type: 'system.alert',
        timestamp: new Date(),
        source: 'mock-service',
        version: '1.0',
        category: 'system' as any,
        data: {
          alertType: 'test',
          severity: 'info' as any,
          message: 'Mock event for local testing',
          source: 'local-emulator',
          priority: 'normal' as any,
          requiresAction: false
        }
      } as any;

      await this.processEvent(mockEvent);
    }, 5000);
  }

  private async getReceiver(subscriptionKey: string): Promise<ServiceBusReceiver> {
    if (!this.receivers.has(subscriptionKey)) {
      const receiver = this.client.createReceiver(this.topicName, this.subscriptionName);
      this.receivers.set(subscriptionKey, receiver);
    }
    return this.receivers.get(subscriptionKey)!;
  }

  async subscribe<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<void> {
    try {
      // Add handler to the list
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, []);
      }
      this.handlers.get(eventType)!.push(handler as EventHandler);

      this.logger.info(`Subscribed to event type: ${eventType}`);

      // Start listening if not already listening
      if (!this.isListening) {
        await this.startListening();
      }
    } catch (error) {
      this.logger.error('Failed to subscribe to event', { error, eventType });
      throw error;
    }
  }

  async unsubscribe(eventType: string): Promise<void> {
    try {
      this.handlers.delete(eventType);
      this.logger.info(`Unsubscribed from event type: ${eventType}`);
    } catch (error) {
      this.logger.error('Failed to unsubscribe from event', { error, eventType });
      throw error;
    }
  }

  private async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      const receiver = await this.getReceiver('default');
      this.isListening = true;

      receiver.subscribe({
        processMessage: async (message: ServiceBusReceivedMessage) => {
          await this.handleMessage(message);
        },
        processError: async (args: any) => {
          this.logger.error('Service Bus message processing error', { 
            error: args.error,
            source: args.errorSource,
            entityPath: args.entityPath
          });
        }
      });

      this.logger.info('Started listening for Service Bus messages');
    } catch (error) {
      this.logger.error('Failed to start listening', { error });
      this.isListening = false;
      throw error;
    }
  }

  private async handleMessage(message: ServiceBusReceivedMessage): Promise<void> {
    try {
      const event: AppEvent = JSON.parse(message.body as string);
      await this.processEvent(event);
    } catch (error) {
      this.logger.error('Failed to process message', { 
        error,
        messageId: message.messageId,
        subject: message.subject
      });
      throw error;
    }
  }

  private async processEvent(event: AppEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    
    if (handlers.length === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.type}`);
      return;
    }

    this.logger.info(`Processing event: ${event.type}`, { eventId: event.id });

    // Process all handlers concurrently
    const handlerPromises = handlers.map(async (handler) => {
      try {
        await handler.handle(event);
      } catch (error) {
        this.logger.error('Event handler failed', { 
          error,
          eventType: event.type,
          eventId: event.id,
          handlerName: handler.constructor.name
        });
        // Don't rethrow - we want other handlers to still process
      }
    });

    await Promise.allSettled(handlerPromises);
  }

  async close(): Promise<void> {
    try {
      this.isListening = false;

      // Close all receivers
      for (const [key, receiver] of this.receivers) {
        await receiver.close();
        this.logger.info(`Closed receiver: ${key}`);
      }
      this.receivers.clear();

      // Close the client
      await this.client.close();
      this.logger.info('Service Bus subscriber closed');
    } catch (error) {
      this.logger.error('Error closing Service Bus subscriber', { error });
      throw error;
    }
  }

  // Helper method to get subscription status
  getSubscriptionStatus(): { eventType: string; handlerCount: number }[] {
    return Array.from(this.handlers.entries()).map(([eventType, handlers]) => ({
      eventType,
      handlerCount: handlers.length
    }));
  }
}