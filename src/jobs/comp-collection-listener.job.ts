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
import {
  ComparableSelectionService,
  COMP_SELECTION_PRODUCT_TYPES,
} from '../services/comparable-selection.service.js';
import { PropertyDataCacheService } from '../services/property-data-cache.service.js';
import type { ClientOrderCreatedEvent, EventHandler } from '../types/events.js';

const TOPIC_NAME = 'appraisal-events';
const SUBSCRIPTION_NAME = 'comp-collection';
const EVENT_TYPE = 'client-order.created';

export class CompCollectionListenerJob {
  private readonly logger = new Logger('CompCollectionListenerJob');
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly service: OrderCompCollectionService;
  private readonly compSelection: ComparableSelectionService;
  private started = false;

  constructor(
    dbService: CosmosDbService,
    /** Optional injected subscriber/service for tests. */
    deps?: {
      subscriber?: ServiceBusEventSubscriber;
      service?: OrderCompCollectionService;
      compSelection?: ComparableSelectionService;
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
    this.compSelection =
      deps?.compSelection ??
      new ComparableSelectionService(
        dbService,
        propertyRecords,
        new PropertyDataCacheService(dbService),
      );
  }

  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('CompCollectionListenerJob already started');
      return;
    }

    const handler: EventHandler<ClientOrderCreatedEvent> = {
      handle: async (event) => {
        const { clientOrderId, tenantId, productType, propertyId } = event.data;
        try {
          const result = await this.service.runForOrder(event);
          this.logger.info('Comp-collection run finished', {
            clientOrderId,
            tenantId,
            result,
          });

          // Phase 2 chain: when Phase 1 (comp-collection) actually wrote a
          // populated order-comparables doc AND the product type is one we
          // rank for, run comparable-selection inline. Failures re-throw so
          // Service Bus retries the whole event (Phase 1 will re-run; the
          // service already documents at-least-once semantics).
          if (
            result.status === 'COLLECTED' &&
            propertyId &&
            COMP_SELECTION_PRODUCT_TYPES.has(productType)
          ) {
            try {
              await this.compSelection.selectForOrder(
                clientOrderId,
                tenantId,
                productType,
                propertyId,
              );
              this.logger.info('Comp-selection (Phase 2) finished', {
                clientOrderId,
                tenantId,
              });
            } catch (selectErr) {
              this.logger.error('Comp-selection (Phase 2) failed', {
                clientOrderId,
                tenantId,
                error: selectErr instanceof Error ? selectErr.message : String(selectErr),
              });
              throw selectErr;
            }
          }
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
