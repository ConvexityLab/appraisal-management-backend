import type { IncomingHttpHeaders } from 'http';
import { Logger } from '../../utils/logger.js';
import type { VendorAdapter } from './VendorAdapter.js';
import { AimPortAdapter } from './AimPortAdapter.js';
import { ClassValuationWebhookAdapter } from './ClassValuationWebhookAdapter.js';
import { VendorConnectionService } from './VendorConnectionService.js';
import { VendorEventOutboxService } from './VendorEventOutboxService.js';
import { VendorOrderReferenceService } from './VendorOrderReferenceService.js';
import type { AdapterInboundResult, VendorConnection, VendorDomainEvent, VendorType } from '../../types/vendor-integration.types.js';
import type { VendorAssignmentTrigger } from './VendorOrderReferenceService.js';

export interface VendorInboundProcessingResult extends AdapterInboundResult {
  connection: VendorConnection;
  adapter: VendorAdapter;
}

/**
 * Central dispatch point for all external vendor/API partner inbound traffic.
 *
 * Current responsibilities:
 *  - identify which adapter can parse the payload
 *  - resolve tenant/lender/vendor connection from the payload identifier
 *  - authenticate the inbound request using adapter-specific rules
 *  - normalize the request into `VendorDomainEvent[]`
 *
 * Remaining TODOs:
 *  - durable outbox persistence of normalized events
 *  - dead-lettering of malformed vendor payloads
 *  - per-connection idempotency/replay tracking
 *  - outbound event queue orchestration
 */
export class VendorIntegrationService {
  private readonly logger = new Logger('VendorIntegrationService');
  private readonly adapters: VendorAdapter[];
  private readonly connectionService: VendorConnectionService;
  private readonly orderReferenceService: VendorOrderReferenceService;
  private readonly outboxService: VendorEventOutboxService;

  constructor(
    connectionService?: VendorConnectionService,
    adapters?: VendorAdapter[],
    orderReferenceService?: VendorOrderReferenceService,
    outboxService?: VendorEventOutboxService,
    /** Lazy getter for the auto-assignment orchestrator — threaded into VendorOrderReferenceService. */
    orchestratorRef?: () => VendorAssignmentTrigger | undefined,
  ) {
    this.connectionService = connectionService ?? new VendorConnectionService();
    this.orderReferenceService =
      orderReferenceService ?? new VendorOrderReferenceService(undefined, undefined, undefined, orchestratorRef);
    this.outboxService = outboxService ?? new VendorEventOutboxService();
    this.adapters = adapters ?? [new AimPortAdapter(), new ClassValuationWebhookAdapter()];
  }

  async processInbound(
    body: unknown,
    headers: IncomingHttpHeaders,
    rawBody: Buffer | undefined,
    expectedVendorType: VendorType,
  ): Promise<VendorInboundProcessingResult> {
    const adapter = this.adapters.find((candidate) => candidate.vendorType === expectedVendorType);
    if (!adapter) {
      throw new Error(`No adapter registered for vendor type ${expectedVendorType}`);
    }

    if (!adapter.canHandleInbound(body, headers)) {
      throw new Error(`Body shape does not match expected vendor type ${expectedVendorType}`);
    }

    const inboundIdentifier = adapter.identifyInboundConnection(body, headers);
    if (!inboundIdentifier) {
      throw new Error(`Adapter ${adapter.vendorType} could not resolve inbound connection identifier`);
    }

    const connection = await this.connectionService.getActiveConnectionByInboundIdentifier(
      inboundIdentifier,
      adapter.vendorType,
    );

    const inboundContext = {
      resolveSecret: (secretName: string) => this.connectionService.resolveSecret(secretName),
      createOrGetOrderReference: (resolvedConnection: VendorConnection, event: VendorDomainEvent) =>
        this.orderReferenceService.createOrGetOrderReference(resolvedConnection, event),
      ...(rawBody ? { rawBody } : {}),
    };

    await adapter.authenticateInbound(body, headers, connection, inboundContext);

    const result = await adapter.handleInbound(body, headers, connection, inboundContext);

    this.logNormalizedEvents(connection, adapter.vendorType, result.domainEvents);
    await this.outboxService.persistInboundEvents(connection, adapter, result.domainEvents);

    return {
      ...result,
      connection,
      adapter,
    };
  }

  private logNormalizedEvents(
    connection: VendorConnection,
    vendorType: string,
    events: VendorDomainEvent[],
  ): void {
    this.logger.info('Normalized inbound vendor events', {
      vendorType,
      connectionId: connection.id,
      lenderId: connection.lenderId,
      tenantId: connection.tenantId,
      eventCount: events.length,
      eventTypes: events.map((event) => event.eventType),
    });
  }
}
