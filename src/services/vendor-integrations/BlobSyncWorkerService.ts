/**
 * BlobSyncWorkerService
 *
 * Subscribes (streaming push, no poll loop) to the shared 'blob-sync-events'
 * Service Bus queue and routes each message to the appropriate BlobSyncAdapter
 * implementation based on the vendorType property stamped by the Event Grid
 * subscription's advanced filter.
 *
 * Adding a new blob-drop client requires:
 *   1. A VendorConnection document in Cosmos with a populated blobConfig
 *   2. An Event Grid subscription that stamps vendorType = '<client-id>' and
 *      routes to the blob-sync-events queue
 *   Zero application code changes.
 *
 * Message lifecycle:
 *   - completeMessage() on success (remove from queue)
 *   - abandonMessage() on transient error (Service Bus retries with backoff)
 *   - deadLetterMessage() on permanent configuration errors (prevents infinite loops)
 */

import { ServiceBusClient, type ServiceBusReceivedMessage } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../../utils/logger.js';
import { CosmosDbService } from '../cosmos-db.service.js';
import { VendorConnectionService } from './VendorConnectionService.js';
import { VendorEventOutboxService } from './VendorEventOutboxService.js';
import { VendorBlobStorageClient } from './VendorBlobStorageClient.js';
import { DataShareBlobSyncAdapter } from './DataShareBlobSyncAdapter.js';
import { BlobCreatedBlobSyncAdapter } from './BlobCreatedBlobSyncAdapter.js';
import type { BlobSyncAdapter, BlobSyncAdapterContext, BlobSyncMessage } from './BlobSyncAdapter.js';
import { VendorConnectionConfigurationError } from './VendorIntegrationErrors.js';

const DEFAULT_QUEUE_NAME = 'blob-sync-events';

export class BlobSyncWorkerService {
  private readonly logger = new Logger('BlobSyncWorkerService');

  private readonly adapters: BlobSyncAdapter[];
  private readonly connectionService: VendorConnectionService;
  private readonly outboxService: VendorEventOutboxService;
  private readonly blobClient: VendorBlobStorageClient;
  private readonly db: CosmosDbService;
  private readonly queueName: string;

  private sbClient: ServiceBusClient | null = null;
  private isStarted = false;

  constructor(options?: {
    adapters?: BlobSyncAdapter[];
    connectionService?: VendorConnectionService;
    outboxService?: VendorEventOutboxService;
    blobClient?: VendorBlobStorageClient;
    db?: CosmosDbService;
  }) {
    this.adapters = options?.adapters ?? [
      new DataShareBlobSyncAdapter(),
      new BlobCreatedBlobSyncAdapter(),
    ];
    this.connectionService = options?.connectionService ?? new VendorConnectionService();
    this.outboxService = options?.outboxService ?? new VendorEventOutboxService();
    this.blobClient = options?.blobClient ?? new VendorBlobStorageClient();
    this.db = options?.db ?? new CosmosDbService();

    const queueName = process.env['BLOB_SYNC_SERVICE_BUS_QUEUE'];
    if (!queueName || !queueName.trim()) {
      throw new Error(
        'BLOB_SYNC_SERVICE_BUS_QUEUE environment variable is required for blob-sync intake. ' +
        `Set it to the Service Bus queue name (typically "${DEFAULT_QUEUE_NAME}").`,
      );
    }
    this.queueName = queueName.trim();
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('BlobSyncWorkerService already started');
      return;
    }

    const serviceBusNamespace = process.env['AZURE_SERVICE_BUS_NAMESPACE'];
    if (!serviceBusNamespace || !serviceBusNamespace.trim()) {
      throw new Error(
        'AZURE_SERVICE_BUS_NAMESPACE environment variable is required for BlobSyncWorkerService.',
      );
    }

    const fullyQualifiedNamespace = serviceBusNamespace.includes('.')
      ? serviceBusNamespace
      : `${serviceBusNamespace}.servicebus.windows.net`;

    this.sbClient = new ServiceBusClient(fullyQualifiedNamespace, new DefaultAzureCredential());
    const receiver = this.sbClient.createReceiver(this.queueName);

    receiver.subscribe({
      processMessage: async (sbMessage: ServiceBusReceivedMessage) => {
        await this.handleMessage(sbMessage, receiver);
      },
      processError: async (args) => {
        this.logger.error('BlobSyncWorkerService Service Bus error', {
          errorSource: args.errorSource,
          error: args.error instanceof Error ? args.error.message : String(args.error),
          entityPath: args.entityPath,
        });
        // SDK will automatically reconnect; no action needed.
      },
    });

    this.isStarted = true;
    this.logger.info('BlobSyncWorkerService started', {
      namespace: fullyQualifiedNamespace,
      queue: this.queueName,
      adapterFlavors: this.adapters.map(a => a.supportedFlavor),
    });
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    if (this.sbClient) {
      await this.sbClient.close();
      this.sbClient = null;
    }
    this.logger.info('BlobSyncWorkerService stopped');
  }

  // ─── Message handling ──────────────────────────────────────────────────────

  private async handleMessage(
    sbMessage: ServiceBusReceivedMessage,
    receiver: import('@azure/service-bus').ServiceBusReceiver,
  ): Promise<void> {
    let message: BlobSyncMessage;

    // ── Deserialize ──────────────────────────────────────────────────────────
    try {
      message = this.deserializeMessage(sbMessage);
    } catch (err) {
      this.logger.error('BlobSyncWorkerService: failed to deserialize message — dead-lettering', {
        messageId: sbMessage.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      await receiver.deadLetterMessage(sbMessage, {
        deadLetterReason: 'DeserializationFailure',
        deadLetterErrorDescription: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // ── Resolve VendorConnection ─────────────────────────────────────────────
    let connection;
    try {
      connection = await this.connectionService.getActiveConnectionByInboundIdentifier(
        message.vendorType,
        message.vendorType,
      );
    } catch (err) {
      if (err instanceof VendorConnectionConfigurationError) {
        // No connection configured — dead-letter; cannot process without config.
        this.logger.error('BlobSyncWorkerService: no VendorConnection for vendorType — dead-lettering', {
          vendorType: message.vendorType,
          messageId: message.messageId,
          error: err.message,
        });
        await receiver.deadLetterMessage(sbMessage, {
          deadLetterReason: 'NoVendorConnection',
          deadLetterErrorDescription: err.message,
        });
        return;
      }
      // Transient DB failure — abandon for retry
      this.logger.warn('BlobSyncWorkerService: transient error resolving connection — abandoning', {
        vendorType: message.vendorType,
        messageId: message.messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      await receiver.abandonMessage(sbMessage);
      return;
    }

    // Verify the connection has blobConfig
    if (!connection.blobConfig) {
      this.logger.error('BlobSyncWorkerService: VendorConnection has no blobConfig — dead-lettering', {
        vendorType: message.vendorType,
        connectionId: connection.id,
        messageId: message.messageId,
      });
      await receiver.deadLetterMessage(sbMessage, {
        deadLetterReason: 'NoBlobConfig',
        deadLetterErrorDescription:
          `VendorConnection ${connection.id} for vendorType=${message.vendorType} ` +
          'has no blobConfig. Add blobConfig to the connection document.',
      });
      return;
    }

    // ── Select adapter ───────────────────────────────────────────────────────
    const adapter = this.adapters.find(a => a.canHandle(message, connection));
    if (!adapter) {
      this.logger.error('BlobSyncWorkerService: no adapter for message flavor — dead-lettering', {
        flavor: message.flavor,
        vendorType: message.vendorType,
        messageId: message.messageId,
      });
      await receiver.deadLetterMessage(sbMessage, {
        deadLetterReason: 'NoAdapter',
        deadLetterErrorDescription:
          `No BlobSyncAdapter registered for flavor=${message.flavor} / vendorType=${message.vendorType}`,
      });
      return;
    }

    // ── Process ──────────────────────────────────────────────────────────────
    const context: BlobSyncAdapterContext = {
      blobClient: this.blobClient,
      db: this.db,
      outboxService: this.outboxService,
    };

    try {
      const result = await adapter.processSync(message, connection, context);
      await receiver.completeMessage(sbMessage);

      this.logger.info('BlobSyncWorkerService: message processed', {
        vendorType: message.vendorType,
        flavor: message.flavor,
        messageId: message.messageId,
        connectionId: connection.id,
        ...result,
      });
    } catch (err) {
      this.logger.error('BlobSyncWorkerService: adapter processSync failed — abandoning for retry', {
        vendorType: message.vendorType,
        flavor: message.flavor,
        messageId: message.messageId,
        connectionId: connection.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await receiver.abandonMessage(sbMessage);
    }
  }

  // ─── Deserialization ────────────────────────────────────────────────────────

  private deserializeMessage(sbMessage: ServiceBusReceivedMessage): BlobSyncMessage {
    // vendorType is stamped as a custom application property by the Event Grid
    // subscription advanced filter — it is the authoritative routing key.
    const vendorType =
      (sbMessage.applicationProperties?.['vendorType'] as string | undefined) ??
      (sbMessage.applicationProperties?.['vendortype'] as string | undefined);

    if (!vendorType) {
      throw new Error(
        'Service Bus message is missing required vendorType application property. ' +
        'Ensure the Event Grid subscription advanced filter stamps this property.',
      );
    }

    const rawBody = sbMessage.body as Record<string, unknown>;

    // Detect flavor from event type (Event Grid wraps the body differently for
    // Data Share vs Storage events).
    const eventType = rawBody['eventType'] as string | undefined;
    const flavor = detectFlavor(eventType, rawBody);

    if (flavor === 'data-share-sync') {
      const data = (rawBody['data'] as Record<string, unknown>) ?? rawBody;
      const syncRunId = data['synchronizationId'] as string | undefined;
      const syncEndTime = data['endTime'] as string | undefined;
      const syncStatus = data['status'] as string | undefined;
      return {
        vendorType,
        messageId: String(sbMessage.messageId ?? ''),
        flavor: 'data-share-sync',
        ...(syncRunId !== undefined ? { syncRunId } : {}),
        ...(syncEndTime !== undefined ? { syncEndTime } : {}),
        ...(syncStatus !== undefined ? { syncStatus } : {}),
      };
    }

    // blob-created
    const data = (rawBody['data'] as Record<string, unknown>) ?? rawBody;
    const blobUrl = data['url'] as string | undefined;
    const eTag = data['eTag'] as string | undefined;
    const contentLengthBytes = data['contentLength'] as number | undefined;
    return {
      vendorType,
      messageId: String(sbMessage.messageId ?? ''),
      flavor: 'blob-created',
      ...(blobUrl !== undefined ? { blobUrl } : {}),
      ...(eTag !== undefined ? { eTag } : {}),
      ...(contentLengthBytes !== undefined ? { contentLengthBytes } : {}),
    };
  }
}

function detectFlavor(
  eventType: string | undefined,
  _body: Record<string, unknown>,
): 'data-share-sync' | 'blob-created' {
  if (
    eventType === 'Microsoft.DataShare.ShareSubscriptionSynchronizationCompleted' ||
    eventType?.toLowerCase().includes('datashare')
  ) {
    return 'data-share-sync';
  }
  return 'blob-created';
}
