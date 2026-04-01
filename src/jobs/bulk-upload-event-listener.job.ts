/**
 * BulkUploadEventListenerJob
 *
 * Drains the "bulk-upload-events" Azure Storage Queue, which is populated by an
 * Event Grid subscription on axiomdevst/bulk-upload.  When a CSV/XLSX data file
 * is uploaded there, Event Grid fires a BlobCreated notification → Storage Queue
 * message → this job receives it and kicks off a SHARED_STORAGE bulk-ingestion job.
 *
 * Blob path convention (must be honoured by the uploader):
 *   bulk-upload/{tenantId}/{clientId}/{adapterKey}/loans.csv
 *   bulk-upload/{tenantId}/{clientId}/{adapterKey}/appraisal-001.pdf
 *   bulk-upload/{tenantId}/{clientId}/{adapterKey}/appraisal-002.pdf
 *
 * The job:
 *  1. Receives messages from the queue (Azure Storage Queue long-receive pattern)
 *  2. Parses the Event Grid BlobCreated envelope
 *  3. Extracts tenantId / clientId / adapterKey from the blob path
 *  4. Lists all blobs under the same path prefix to collect document file names
 *  5. Downloads and parses the CSV data file → BulkIngestionItemInput[]
 *  6. Submits via BulkIngestionService (SHARED_STORAGE mode)
 *  7. Deletes the queue message on success; leaves it for Event Grid retry on failure
 */

import { QueueClient, QueueReceiveMessageResponse } from '@azure/storage-queue';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';
import { BlobStorageService } from '../services/blob-storage.service.js';
import { BulkIngestionService } from '../services/bulk-ingestion.service.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { BulkIngestionItemInput } from '../types/bulk-ingestion.types.js';

// ── Event Grid schema types ───────────────────────────────────────────────────

interface EventGridBlobCreatedData {
  api: string;
  url: string;
  blobType: string;
  contentType: string;
  clientRequestId?: string;
  requestId?: string;
}

interface EventGridEvent {
  id: string;
  eventType: string;  // 'Microsoft.Storage.BlobCreated'
  subject: string;     // '/blobServices/default/containers/bulk-upload/blobs/{path}'
  data: EventGridBlobCreatedData;
  dataVersion: string;
  metadataVersion: string;
  topic: string;
  eventTime: string;
}

// ── Parsed path segments ──────────────────────────────────────────────────────

interface BulkUploadPath {
  tenantId: string;
  clientId: string;
  adapterKey: string;
  blobName: string;   // full blob name including prefix
  prefix: string;     // everything before the filename — used to list related blobs
  fileName: string;   // just the filename
}

// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_NAME = 'bulk-upload-events';
const BULK_UPLOAD_CONTAINER = 'bulk-upload';
/** How many messages to dequeue per receive call (max 32) */
const RECEIVE_BATCH_SIZE = 10;
/** Visibility timeout — how long the message stays invisible while we process it */
const VISIBILITY_TIMEOUT_SECS = 300; // 5 minutes
/** How long to wait after an empty receive before trying again */
const EMPTY_RECEIVE_PAUSE_MS = 5000;
/** System actor written into the ingestion job's submittedBy field */
const SYSTEM_ACTOR = 'bulk-upload-event-listener';

export class BulkUploadEventListenerJob {
  private readonly logger = new Logger('BulkUploadEventListenerJob');
  private readonly blobStorage: BlobStorageService;
  private readonly ingestionService: BulkIngestionService;
  private queueClient: QueueClient | null = null;
  private running = false;
  private stopRequested = false;

  constructor(dbService: CosmosDbService) {
    this.blobStorage = new BlobStorageService();
    this.ingestionService = new BulkIngestionService(dbService);
    this.queueClient = this.buildQueueClient();
  }

  private buildQueueClient(): QueueClient | null {
    const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!storageAccountName) {
      // Config problem is logged; job simply won't start rather than crashing the server.
      this.logger.error(
        'BulkUploadEventListenerJob: AZURE_STORAGE_ACCOUNT_NAME is not set — job will not start',
      );
      return null;
    }

    const queueUrl = `https://${storageAccountName}.queue.core.windows.net/${QUEUE_NAME}`;
    return new QueueClient(queueUrl, new DefaultAzureCredential());
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('BulkUploadEventListenerJob already running');
      return;
    }

    if (!this.queueClient) {
      this.logger.error('BulkUploadEventListenerJob cannot start — QueueClient not initialised');
      return;
    }

    this.stopRequested = false;
    this.running = true;
    this.logger.info('BulkUploadEventListenerJob started', { queue: QUEUE_NAME });

    // Run the drain loop without blocking the caller
    this.drainLoop().catch((err) => {
      this.logger.error('BulkUploadEventListenerJob drain loop crashed', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.running = false;
    });
  }

  stop(): void {
    this.stopRequested = true;
    this.logger.info('BulkUploadEventListenerJob stop requested');
  }

  // ── Drain loop ──────────────────────────────────────────────────────────────

  private async drainLoop(): Promise<void> {
    while (!this.stopRequested) {
      let received: QueueReceiveMessageResponse;

      try {
        received = await this.queueClient!.receiveMessages({
          numberOfMessages: RECEIVE_BATCH_SIZE,
          visibilityTimeout: VISIBILITY_TIMEOUT_SECS,
        });
      } catch (err) {
        this.logger.error('Error receiving messages from bulk-upload-events queue', {
          error: err instanceof Error ? err.message : String(err),
        });
        await this.pause(EMPTY_RECEIVE_PAUSE_MS);
        continue;
      }

      if (received.receivedMessageItems.length === 0) {
        // Queue was empty — back off before next receive
        await this.pause(EMPTY_RECEIVE_PAUSE_MS);
        continue;
      }

      for (const message of received.receivedMessageItems) {
        if (this.stopRequested) break;

        try {
          await this.processMessage(message.messageText);
          // Delete on success — prevents reprocessing
          await this.queueClient!.deleteMessage(message.messageId, message.popReceipt);
        } catch (err) {
          this.logger.error('Failed to process bulk-upload event message', {
            messageId: message.messageId,
            error: err instanceof Error ? err.message : String(err),
          });
          // Leave message in queue — visibility timeout will expire and
          // Event Grid retry policy will redeliver it (up to 30 attempts).
        }
      }
    }

    this.running = false;
    this.logger.info('BulkUploadEventListenerJob stopped');
  }

  // ── Message processing ──────────────────────────────────────────────────────

  private async processMessage(rawText: string): Promise<void> {
    // Storage Queue messages from Event Grid are base64-encoded.
    // The payload may be a single event object or an array of events depending
    // on the Event Grid delivery schema version — normalise to always be an array.
    const decoded = Buffer.from(rawText, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    const events: EventGridEvent[] = Array.isArray(parsed) ? parsed : [parsed as EventGridEvent];

    for (const event of events) {
      if (event.eventType !== 'Microsoft.Storage.BlobCreated') {
        this.logger.info('Skipping non-BlobCreated event', { eventType: event.eventType });
        continue;
      }

      await this.processBlobCreatedEvent(event);
    }
  }

  private async processBlobCreatedEvent(event: EventGridEvent): Promise<void> {
    // subject example: /blobServices/default/containers/bulk-upload/blobs/tenant1/client1/adapter/loans.csv
    const blobPath = this.extractBlobPathFromSubject(event.subject);
    if (!blobPath) {
      throw new Error(
        `Could not extract blob path from Event Grid subject '${event.subject}'`,
      );
    }

    const parsed = this.parseBulkUploadPath(blobPath);
    if (!parsed) {
      throw new Error(
        `Blob path '${blobPath}' does not match expected convention ` +
        `'{tenantId}/{clientId}/{adapterKey}/{dataFile.csv|xlsx}'. ` +
        `Got ${blobPath.split('/').length} segments.`,
      );
    }

    const bulkUploadStorageAccountName = process.env.BULK_UPLOAD_STORAGE_ACCOUNT_NAME;
    if (!bulkUploadStorageAccountName) {
      throw new Error(
        'BULK_UPLOAD_STORAGE_ACCOUNT_NAME is required for bulk-upload event processing.',
      );
    }

    this.logger.info('Processing bulk-upload blob event', {
      tenantId: parsed.tenantId,
      clientId: parsed.clientId,
      adapterKey: parsed.adapterKey,
      dataFile: parsed.fileName,
      prefix: parsed.prefix,
    });

    // List all blobs under the same prefix — separates data file from documents
    const allBlobNames = await this.blobStorage.listBlobs(BULK_UPLOAD_CONTAINER, parsed.prefix + '/');
    const documentBlobNames = allBlobNames.filter(
      (name) => name !== parsed.blobName && !this.isDataFile(name),
    );

    // Download and parse the CSV data file
    const rawCsv = await this.downloadBlobAsText(BULK_UPLOAD_CONTAINER, parsed.blobName);
    const items = this.parseCsvItems(rawCsv, documentBlobNames);

    if (items.length === 0) {
      throw new Error(
        `CSV file '${parsed.blobName}' parsed to 0 items — check headers and content.`,
      );
    }

    this.logger.info('Submitting SHARED_STORAGE bulk-ingestion job', {
      tenantId: parsed.tenantId,
      clientId: parsed.clientId,
      adapterKey: parsed.adapterKey,
      itemCount: items.length,
      documentCount: documentBlobNames.length,
    });

    await this.ingestionService.submit(
      {
        clientId: parsed.clientId,
        jobName: `bulk-upload:${parsed.prefix}`,
        ingestionMode: 'SHARED_STORAGE',
        dataFileName: parsed.fileName,
        documentFileNames: documentBlobNames.map((b) => b.split('/').pop() ?? b),
        adapterKey: parsed.adapterKey,
        items,
        sharedStorage: {
          storageAccountName: bulkUploadStorageAccountName,
          containerName: BULK_UPLOAD_CONTAINER,
          dataFileBlobName: parsed.blobName,
          documentBlobNames,
          pathPrefix: parsed.prefix,
        },
      },
      parsed.tenantId,
      SYSTEM_ACTOR,
    );

    this.logger.info('Bulk-ingestion job submitted from blob drop', {
      tenantId: parsed.tenantId,
      clientId: parsed.clientId,
      adapterKey: parsed.adapterKey,
      dataFile: parsed.blobName,
      itemCount: items.length,
    });
  }

  // ── Path parsing ────────────────────────────────────────────────────────────

  /**
   * Strips the Event Grid subject prefix to get the bare blob name.
   * Subject: /blobServices/default/containers/bulk-upload/blobs/{blobName}
   */
  private extractBlobPathFromSubject(subject: string): string | null {
    const marker = `/containers/${BULK_UPLOAD_CONTAINER}/blobs/`;
    const idx = subject.indexOf(marker);
    if (idx === -1) return null;
    return subject.slice(idx + marker.length);
  }

  /**
   * Validates and parses bulk-upload path segments.
   * Required: {tenantId}/{clientId}/{adapterKey}/{filename.csv|xlsx}
   */
  private parseBulkUploadPath(blobName: string): BulkUploadPath | null {
    const parts = blobName.split('/');
    if (parts.length < 4) return null;

    const fileName = parts[parts.length - 1]!;
    if (!this.isDataFile(fileName)) return null;

    const tenantId = parts[0]!;
    const clientId = parts[1]!;
    const adapterKey = parts[2]!;

    if (!tenantId || !clientId || !adapterKey || !fileName) return null;

    // prefix is everything except the filename — used for listing sibling blobs
    const prefix = parts.slice(0, -1).join('/');

    return { tenantId, clientId, adapterKey, blobName, prefix, fileName };
  }

  private isDataFile(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith('.csv') || lower.endsWith('.xlsx');
  }

  // ── Blob download ───────────────────────────────────────────────────────────

  private async downloadBlobAsText(containerName: string, blobName: string): Promise<string> {
    const containerClient = (this.blobStorage as any).client
      ?.getContainerClient(containerName);

    if (!containerClient) {
      throw new Error('BlobStorageService client not initialised');
    }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const download = await blockBlobClient.download(0);

    const chunks: Buffer[] = [];
    for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  // ── CSV parsing ─────────────────────────────────────────────────────────────

  /**
   * Parses a CSV string into BulkIngestionItemInput[].
   *
   * Accepted header names (case-insensitive, hyphen/underscore/space interchangeable):
   *   loan_number | loan-number | loanNumber → loanNumber
   *   property_address | property-address    → propertyAddress
   *   document_file_name | document_file     → documentFileName (matched to sibling blobs by name)
   *   external_id | external-id              → externalId
   *
   * If document_file_name column is absent or empty the row inherits no document
   * pre-association (the processor will match documents by loanNumber later).
   */
  private parseCsvItems(
    raw: string,
    availableDocumentBlobNames: string[],
  ): BulkIngestionItemInput[] {
    const lines = raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return [];
    }

    const headers = this.splitCsvRow(lines[0]!).map((h) => this.normalizeHeader(h));
    const items: BulkIngestionItemInput[] = [];

    const docBlobBasenames = new Map(
      availableDocumentBlobNames.map((b) => [
        (b.split('/').pop() ?? b).toLowerCase(),
        b.split('/').pop() ?? b,
      ]),
    );

    for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
      const cols = this.splitCsvRow(lines[rowIndex]!);
      const row: Record<string, string> = {};
      for (let ci = 0; ci < headers.length; ci++) {
        row[headers[ci]!] = (cols[ci] ?? '').trim();
      }

      const rawDocFile = row['documentfilename'] ?? row['documentfile'] ?? '';
      // Resolve document file name against available blobs in the same prefix
      const resolvedDocFile =
        rawDocFile
          ? (docBlobBasenames.get(rawDocFile.toLowerCase()) ?? rawDocFile)
          : undefined;

      const item: BulkIngestionItemInput = {
        rowIndex,
        ...(row['loannumber'] ? { loanNumber: row['loannumber'] } : {}),
        ...(row['propertyaddress'] ? { propertyAddress: row['propertyaddress'] } : {}),
        ...(resolvedDocFile ? { documentFileName: resolvedDocFile } : {}),
        ...(row['externalid'] ? { externalId: row['externalid'] } : {}),
      };

      items.push(item);
    }

    return items;
  }

  private normalizeHeader(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** Splits one CSV row respecting double-quoted fields. */
  private splitCsvRow(line: string): string[] {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
