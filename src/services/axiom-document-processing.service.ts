/**
 * Axiom Document Processing Service
 *
 * Subscribes to document.uploaded events and, when the tenant's
 * axiomAutoTrigger config flag is true, submits the document to the Axiom
 * pdf-schema-extraction pipeline.
 *
 * Axiom resolves the correct extraction schema from its Cosmos registry
 * using the combination of clientId + tenantId + documentType — no schema
 * is embedded in this service.
 *
 * Results arrive via the Axiom webhook (POST /api/axiom/webhook) with
 * correlationType = 'DOCUMENT'. The axiom.controller.ts handler then stamps
 * extractedData and extractionStatus = 'COMPLETED' on the document record.
 *
 * Service Bus subscription: 'axiom-document-processing-service'
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { AxiomService } from './axiom.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import type { BaseEvent, EventHandler, DocumentUploadedEvent } from '../types/events.js';
import type { DocumentMetadata } from '../types/document.types.js';

export class AxiomDocumentProcessingService {
  private readonly logger = new Logger('AxiomDocumentProcessingService');
  private readonly dbService: CosmosDbService;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly axiomService: AxiomService;
  private readonly blobService: BlobStorageService;
  private isStarted = false;
  public isRunning = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'axiom-document-processing-service',
    );
    this.tenantConfigService = new TenantAutomationConfigService();
    this.axiomService = new AxiomService(this.dbService);
    this.blobService = new BlobStorageService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AxiomDocumentProcessingService already started');
      return;
    }

    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 30_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.subscriber.subscribe<DocumentUploadedEvent>(
          'document.uploaded',
          this.makeHandler('document.uploaded', this.onDocumentUploaded.bind(this)),
        );
        this.isStarted = true;
        this.isRunning = true;
        this.logger.info('AxiomDocumentProcessingService started');
        return;
      } catch (err) {
        const isLastAttempt = attempt === MAX_ATTEMPTS;
        if (isLastAttempt) {
          this.isRunning = false;
          this.logger.error(
            `AxiomDocumentProcessingService failed to start after ${MAX_ATTEMPTS} attempts — document auto-extraction disabled`,
            { error: (err as Error).message },
          );
          return;
        }
        this.logger.warn(
          `AxiomDocumentProcessingService start attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${RETRY_DELAY_MS / 1000}s`,
          { error: (err as Error).message },
        );
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('document.uploaded').catch(() => {});
    this.isStarted = false;
    this.isRunning = false;
    this.logger.info('AxiomDocumentProcessingService stopped');
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  private async onDocumentUploaded(event: DocumentUploadedEvent): Promise<void> {
    const { documentId, orderId, tenantId, mimeType, blobName, documentType, category } = event.data;

    // Only process PDFs — other formats are not supported by the extraction pipeline.
    if (mimeType !== 'application/pdf') {
      this.logger.debug('AxiomDocumentProcessing: skipping non-PDF document', { documentId, mimeType });
      return;
    }

    // Check per-tenant auto-trigger flag.
    const config = await this.tenantConfigService.getConfig(tenantId);
    if (!config.axiomAutoTrigger) {
      this.logger.debug('AxiomDocumentProcessing: axiomAutoTrigger disabled for tenant', { tenantId, documentId });
      return;
    }

    // Idempotency: skip if extraction has already been initiated for this document.
    const docResult = await this.dbService.getItem<DocumentMetadata>('documents', documentId);
    if (!docResult.success || !docResult.data) {
      this.logger.warn('AxiomDocumentProcessing: document not found in Cosmos', { documentId });
      return;
    }
    const doc = docResult.data;
    if (doc.extractionStatus) {
      this.logger.info('AxiomDocumentProcessing: document already has extractionStatus — skipping', {
        documentId,
        extractionStatus: doc.extractionStatus,
      });
      return;
    }

    // Resolve clientId from the associated order (required by Axiom for schema lookup).
    let clientId: string | undefined;
    if (orderId) {
      const orderResult = await this.dbService.findOrderById(orderId);
      if (orderResult.success && orderResult.data) {
        clientId = (orderResult.data as unknown as { clientId?: string }).clientId;
      }
    }
    if (!clientId) {
      this.logger.warn(
        'AxiomDocumentProcessing: cannot determine clientId — no orderId on document or order not found. Skipping.',
        { documentId, orderId },
      );
      return;
    }

    // Generate a time-limited SAS URL so Axiom (external) can download the blob.
    const blobContainerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!blobContainerName) {
      throw new Error(
        'STORAGE_CONTAINER_DOCUMENTS is required for Axiom document processing — configure it in environment settings',
      );
    }
    const sasUrl = await this.blobService.generateReadSasUrl(blobContainerName, blobName);

    // Stamp AXIOM_PENDING before submit so concurrent re-deliveries of the same
    // event see the status and skip (races are unlikely but possible).
    await this.dbService.updateItem<DocumentMetadata>(
      'documents',
      documentId,
      { extractionStatus: 'AXIOM_PENDING' },
    );

    // Submit to 'pdf-schema-extraction' pipeline.
    // Axiom resolves the schema from its DocumentTypeRegistry automatically using
    // clientId + tenantId + documentType — no inline schema needed here.
    const resolvedDocumentType = documentType ?? (category ? category.toUpperCase().replace(/-/g, '_') : undefined);
    if (!resolvedDocumentType) {
      this.logger.error('AxiomDocumentProcessing: document has no documentType or category — cannot submit', {
        documentId,
        tenantId,
      });
      await this.dbService.updateItem<DocumentMetadata>('documents', documentId, { extractionStatus: 'AXIOM_FAILED' });
      return;
    }

    const programId = process.env['AXIOM_PROGRAM_ID'];
    const programVersion = process.env['AXIOM_PROGRAM_VERSION'];
    if (!programId) throw new Error('AXIOM_PROGRAM_ID is required for document schema extraction but is not set.');
    if (!programVersion) throw new Error('AXIOM_PROGRAM_VERSION is required for document schema extraction but is not set.');

    const submitResult = await this.axiomService.submitDocumentForSchemaExtraction({
      documentId,
      ...(orderId && { orderId }),
      blobSasUrl: sasUrl,
      fileName: doc.name,
      documentType: resolvedDocumentType,
      tenantId,
      clientId,
      programId,
      programVersion,
    });

    if (!submitResult) {
      this.logger.error('AxiomDocumentProcessing: submitDocumentForSchemaExtraction returned null', { documentId });
      await this.dbService.updateItem<DocumentMetadata>('documents', documentId, { extractionStatus: 'AXIOM_FAILED' });
      return;
    }

    // Stamp the pipeline job ID — the webhook handler will stamp COMPLETED + extractedData.
    await this.dbService.updateItem<DocumentMetadata>('documents', documentId, {
      axiomPipelineJobId: submitResult.pipelineJobId,
    });

    this.logger.info('AxiomDocumentProcessing: document submitted for schema extraction', {
      documentId,
      pipelineJobId: submitResult.pipelineJobId,
      documentType: resolvedDocumentType,
      tenantId,
      clientId,
    });
  }

  // ── Handler wrapper ────────────────────────────────────────────────────────

  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    const logger = this.logger;
    return {
      async handle(event: T): Promise<void> {
        try {
          await fn(event);
        } catch (err) {
          logger.error(`Unhandled error in ${eventType} handler`, {
            error: (err as Error).message,
          });
          // Re-throw so the Service Bus SDK can abandon and retry the message.
          throw err;
        }
      },
    };
  }
}
