import { Logger } from '../../utils/logger.js';
import type { VendorDomainEvent } from '../../types/vendor-integration.types.js';
import { VendorConnectionService } from './VendorConnectionService.js';
import type { VendorAdapter } from './VendorAdapter.js';
import { AimPortAdapter } from './AimPortAdapter.js';
import { ClassValuationWebhookAdapter } from './ClassValuationWebhookAdapter.js';
import { AimPortClient } from './AimPortClient.js';

/**
 * Transport-aware outbound dispatcher.
 *
 * Current implementation performs direct synchronous dispatch for AIM-Port.
 *
 * TODOs for the next increment:
 *  - move dispatch to BullMQ / Service Bus backed durable queue
 *  - exponential backoff + dead-letter policy per connection
 *  - response auditing / replay tooling
 *  - support webhook and polling-based vendor transports
 */
export class VendorOutboundDispatcher {
  private readonly logger = new Logger('VendorOutboundDispatcher');
  private readonly adapters: Map<string, VendorAdapter>;
  private readonly connectionService: VendorConnectionService;
  private readonly aimPortClient: AimPortClient;

  constructor(connectionService?: VendorConnectionService) {
    this.connectionService = connectionService ?? new VendorConnectionService();
    this.aimPortClient = new AimPortClient();
    const aimPortAdapter = new AimPortAdapter();
    const classValuationAdapter = new ClassValuationWebhookAdapter();
    this.adapters = new Map<string, VendorAdapter>([
      [aimPortAdapter.vendorType, aimPortAdapter],
      [classValuationAdapter.vendorType, classValuationAdapter],
    ]);
  }

  async dispatch(event: VendorDomainEvent, connectionIdOrIdentifier: string): Promise<void> {
    const adapter = this.adapters.get(event.vendorType);
    if (!adapter) {
      throw new Error(`No outbound adapter registered for vendorType=${event.vendorType}`);
    }

    const connection = await this.connectionService.getActiveConnectionByInboundIdentifier(
      connectionIdOrIdentifier,
      event.vendorType,
    );

    const call = await adapter.buildOutboundCall(event, connection, {
      resolveSecret: (secretName) => this.connectionService.resolveSecret(secretName),
    });

    if (!call) {
      this.logger.info('No outbound call generated for vendor event', {
        eventType: event.eventType,
        vendorType: event.vendorType,
        vendorOrderId: event.vendorOrderId,
      });
      return;
    }

    const response = await this.aimPortClient.send(call);
    if (!response.ok) {
      throw new Error(
        `Outbound vendor call failed for eventType=${event.eventType} vendorOrderId=${event.vendorOrderId}. ` +
        `HTTP ${response.status}. Body: ${response.rawText}`,
      );
    }
  }
}
