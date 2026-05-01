/**
 * CompCollectionListenerJob
 *
 * Subscribes to `client-order.created` on the `appraisal-events` Service Bus
 * topic via the `comp-collection` subscription, and runs
 * `OrderCompCollectionService.runForOrder()` for each event.
 *
 * In mock mode (USE_MOCK_SERVICE_BUS=true or no AZURE_SERVICE_BUS_NAMESPACE),
 * the existing in-memory event bus routes publish→subscribe in-process — so
 * locally and in tests this works without any Service Bus infra.
 *
 * In real Azure mode, the `comp-collection` subscription on the
 * `appraisal-events` topic must exist (Bicep), or the subscriber will close
 * its receiver and log a `MessagingEntityNotFoundError` — see
 * ServiceBusEventSubscriber.startListening().
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { ServiceBusEventSubscriber } from '../services/service-bus-subscriber.js';
import { OrderCompCollectionService } from '../services/order-comp-collection.service.js';
import { PropertyRecordService } from '../services/property-record.service.js';
import { AttomDataCompSearchService } from '../services/attom-data-comp-search.service.js';
import type { ClientOrderCreatedEvent, EventHandler } from '../types/events.js';

const TOPIC_NAME = 'appraisal-events';
const SUBSCRIPTION_NAME = 'comp-collection';
const EVENT_TYPE = 'client-order.created';

export class CompCollectionListenerJob {
  private readonly logger = new Logger('CompCollectionListenerJob');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly service: OrderCompCollectionService;
  private started = false;

  constructor(
    dbService: CosmosDbService,
    /** Optional injected subscriber/service for tests. */
    deps?: {
      subscriber?: ServiceBusEventSubscriber;
      service?: OrderCompCollectionService;
    },
  ) {
    this.subscriber =
      deps?.subscriber ??
      new ServiceBusEventSubscriber(undefined, TOPIC_NAME, SUBSCRIPTION_NAME);
    const propertyRecords = new PropertyRecordService(dbService);
    this.service =
      deps?.service ??
      new OrderCompCollectionService(
        dbService,
        propertyRecords,
        new AttomDataCompSearchService(dbService),
      );
  }

  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('CompCollectionListenerJob already started');
      return;
    }

    const handler: EventHandler<ClientOrderCreatedEvent> = {
      handle: async (event) => {
        const { clientOrderId, tenantId } = event.data;
        try {
          // Comp-selection (formerly Phase 2) now runs INLINE inside
          // OrderCompCollectionService when the product config names a
          // selectionStrategy and the registry is wired in api-server
          // bootstrap. The listener no longer chains a separate selection
          // call — keeps the at-least-once retry boundary tight to a
          // single transactional unit per event.
          const result = await this.service.runForOrder(event);
          this.logger.info('Comp-collection run finished', {
            clientOrderId,
            tenantId,
            result,
          });
        } catch (err) {
          // Re-throw so the subscriber abandons the message and Service Bus
          // can retry / DLQ per its delivery-count config.
          this.logger.error('Comp-collection run failed', {
            clientOrderId,
            tenantId,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      },
    };

    await this.subscriber.subscribe<ClientOrderCreatedEvent>(EVENT_TYPE, handler);
    this.started = true;
    this.logger.info('CompCollectionListenerJob subscribed', {
      topic: TOPIC_NAME,
      subscription: SUBSCRIPTION_NAME,
      eventType: EVENT_TYPE,
    });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.subscriber.unsubscribe(EVENT_TYPE);
    this.started = false;
  }
}
