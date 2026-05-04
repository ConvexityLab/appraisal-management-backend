import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service.js';
import type { InspectionProvider } from './inspection-providers/inspection-provider.interface.js';
import type { CreateInspectionOrderInput, InspectionVendorData, InspectionPdfFileIds, UploadFileInput } from '../types/inspection-vendor.types.js';
import type { VendorOrder } from '../types/vendor-order.types.js';

const ORDERS_BLOB_CONTAINER = 'orders';

export class InspectionVendorService {
  private readonly logger = new Logger('InspectionVendorService');

  constructor(
    private readonly db: CosmosDbService,
    private readonly blob: BlobStorageService,
    private readonly provider: InspectionProvider
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Place order
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Places an inspection order with the vendor and records the vendor's
   * assigned identifiers on the VendorOrder document.
   */
  async placeOrder(
    vendorOrderId: string,
    tenantId: string,
    input: CreateInspectionOrderInput
  ): Promise<InspectionVendorData> {
    this.logger.info('Placing inspection order', { vendorOrderId, provider: this.provider.name });

    const ref = await this.provider.createOrder({ ...input, vendorOrderId, tenantId });

    const inspectionVendorData: InspectionVendorData = {
      externalProvider: this.provider.name,
      externalOrderId: ref.externalOrderId,
      ...(ref.externalCanonicalId ? { externalCanonicalId: ref.externalCanonicalId } : {}),
      ...(ref.externalBatchId ? { externalBatchId: ref.externalBatchId } : {}),
      ...(ref.externalSubmissionId ? { externalSubmissionId: ref.externalSubmissionId } : {}),
      surveyTemplateId: input.surveyTemplateId,
      attachmentFileIds: input.attachmentFileIds ?? [],
      externalCreatedAt: new Date().toISOString(),
      externalStatus: 'Created',
    };

    await this.patchVendorOrder(vendorOrderId, tenantId, { inspectionVendorData });

    this.logger.info('Inspection order placed', {
      vendorOrderId,
      externalOrderId: ref.externalOrderId,
    });

    return inspectionVendorData;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Poll status
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Fetches the latest status from the vendor and updates the VendorOrder.
   * If the order is now complete, also triggers result retrieval.
   * Returns the updated InspectionVendorData.
   */
  async pollOrderStatus(vendorOrderId: string, tenantId: string): Promise<InspectionVendorData> {
    const existing = await this.getInspectionData(vendorOrderId, tenantId);

    if (!existing.externalOrderId) {
      throw new Error(
        `Cannot poll status for order ${vendorOrderId}: no externalOrderId stored. ` +
          'Call placeOrder first.'
      );
    }

    this.logger.info('Polling inspection order status', {
      vendorOrderId,
      externalOrderId: existing.externalOrderId,
    });

    let status;
    try {
      status = await this.provider.getOrder(existing.externalOrderId);
    } catch (err) {
      const failureCount = (existing.pollFailureCount ?? 0) + 1;
      await this.patchVendorOrder(vendorOrderId, tenantId, {
        inspectionVendorData: { ...existing, pollFailureCount: failureCount, lastPolledAt: new Date().toISOString() },
      });
      throw err;
    }

    const updates: Partial<InspectionVendorData> = {
      externalStatus: status.externalStatus,
      ...(status.escalated !== undefined ? { escalated: status.escalated } : {}),
      ...(status.escalationNotes ? { escalationNotes: status.escalationNotes } : {}),
      ...(status.submissionId ? { externalSubmissionId: status.submissionId } : (existing.externalSubmissionId ? { externalSubmissionId: existing.externalSubmissionId } : {})),
      ...(status.externalExpiresAt ? { externalExpiresAt: status.externalExpiresAt } : (existing.externalExpiresAt ? { externalExpiresAt: existing.externalExpiresAt } : {})),
      lastPolledAt: new Date().toISOString(),
      pollFailureCount: 0,
    };

    if (status.pdfFileIds) {
      updates.pdfFileIds = status.pdfFileIds;
    }

    if (status.isComplete && !existing.resultsBlobPath) {
      updates.externalCompletedAt = status.externalCompletedAt ?? new Date().toISOString();
    }

    const updated: InspectionVendorData = { ...existing, ...updates };
    await this.patchVendorOrder(vendorOrderId, tenantId, { inspectionVendorData: updated });

    // Auto-retrieve results on first detection of completion.
    if (status.isComplete && !existing.resultsBlobPath) {
      this.logger.info('Inspection order complete — retrieving results', { vendorOrderId });
      return this.retrieveResults(vendorOrderId, tenantId);
    }

    return updated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Retrieve results
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Downloads submission JSON and PDF reports from the vendor and stores them
   * in blob storage. Updates the VendorOrder with the blob paths.
   *
   * Individual PDF download failures are logged but do not abort the operation —
   * we store whatever is available.
   */
  async retrieveResults(vendorOrderId: string, tenantId: string): Promise<InspectionVendorData> {
    const existing = await this.getInspectionData(vendorOrderId, tenantId);

    if (!existing.externalOrderId) {
      throw new Error(
        `Cannot retrieve results for order ${vendorOrderId}: no externalOrderId stored.`
      );
    }

    const submissionId = existing.externalSubmissionId;
    let resultsBlobPath: string | undefined;

    // ── Submission JSON ──────────────────────────────────────────────────────
    if (submissionId) {
      try {
        const raw = await this.provider.getSubmissionData(submissionId);
        const blobName = `${tenantId}/${vendorOrderId}/inspection-results/submission.json`;
        await this.blob.uploadBlob({
          containerName: ORDERS_BLOB_CONTAINER,
          blobName,
          data: Buffer.from(JSON.stringify(raw), 'utf8'),
          contentType: 'application/json',
          metadata: { vendorOrderId, tenantId, submissionId },
        });
        resultsBlobPath = blobName;
        this.logger.info('Stored inspection submission JSON', { vendorOrderId, blobName });
      } catch (err) {
        this.logger.error('Failed to retrieve submission data', { vendorOrderId, submissionId, err });
      }
    } else {
      this.logger.warn('No submissionId on order — skipping submission JSON download', { vendorOrderId });
    }

    // ── PDF reports ──────────────────────────────────────────────────────────
    const pdfFileIds: InspectionPdfFileIds = existing.pdfFileIds ?? {};
    const reportBlobPaths: NonNullable<InspectionVendorData['reportBlobPaths']> = {
      ...existing.reportBlobPaths,
    };

    const variants: Array<{ key: keyof InspectionPdfFileIds; fileId: string | undefined }> = [
      { key: 'main', fileId: pdfFileIds.main },
      { key: 'survey', fileId: pdfFileIds.survey },
      { key: 'photos', fileId: pdfFileIds.photos },
      { key: 'ordered', fileId: pdfFileIds.ordered },
    ];

    for (const { key, fileId } of variants) {
      if (!fileId) continue;

      try {
        const signedUrl = await this.provider.getFileDownloadUrl(fileId);
        const pdfResponse = await fetch(signedUrl);

        if (!pdfResponse.ok) {
          throw new Error(`HTTP ${pdfResponse.status} downloading ${key} PDF from signed URL`);
        }

        const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
        const blobName = `${tenantId}/${vendorOrderId}/inspection-reports/report-${key}.pdf`;

        await this.blob.uploadBlob({
          containerName: ORDERS_BLOB_CONTAINER,
          blobName,
          data: pdfBytes,
          contentType: 'application/pdf',
          metadata: { vendorOrderId, tenantId, reportVariant: key, fileId },
        });

        reportBlobPaths[key] = blobName;
        this.logger.info('Stored inspection PDF report', { vendorOrderId, variant: key, blobName });
      } catch (err) {
        this.logger.error('Failed to download/store PDF report', { vendorOrderId, variant: key, fileId, err });
      }
    }

    const updated: InspectionVendorData = {
      ...existing,
      ...(resultsBlobPath ? { resultsBlobPath } : {}),
      reportBlobPaths,
    };

    await this.patchVendorOrder(vendorOrderId, tenantId, { inspectionVendorData: updated });

    return updated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Upload attachment
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Uploads a supplementary file to the vendor and records the returned
   * vendor file ID in InspectionVendorData.attachmentFileIds.
   * Returns the vendor-assigned file ID.
   */
  async uploadAttachment(
    vendorOrderId: string,
    tenantId: string,
    file: UploadFileInput
  ): Promise<string> {
    this.logger.info('Uploading inspection attachment', {
      vendorOrderId,
      filename: file.filename,
      mimeType: file.mimeType,
    });

    const externalFileId = await this.provider.uploadFile(file);

    const existing = await this.getInspectionData(vendorOrderId, tenantId);
    const attachmentFileIds = [...(existing.attachmentFileIds ?? []), externalFileId];

    await this.patchVendorOrder(vendorOrderId, tenantId, {
      inspectionVendorData: { ...existing, attachmentFileIds },
    });

    this.logger.info('Attachment uploaded', { vendorOrderId, externalFileId });
    return externalFileId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cancel order
  // ──────────────────────────────────────────────────────────────────────────

  async cancelOrder(vendorOrderId: string, tenantId: string, reason: string): Promise<void> {
    const existing = await this.getInspectionData(vendorOrderId, tenantId);

    if (!existing.externalOrderId) {
      throw new Error(
        `Cannot cancel order ${vendorOrderId}: no externalOrderId stored.`
      );
    }

    await this.provider.cancelOrder(existing.externalOrderId, reason);

    await this.patchVendorOrder(vendorOrderId, tenantId, {
      inspectionVendorData: {
        ...existing,
        externalStatus: 'Cancelled',
      },
    });

    this.logger.info('Inspection order cancelled', { vendorOrderId, reason });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Send message
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sends a message via the vendor platform.
   * Throws if the active provider does not support messaging.
   */
  async sendMessage(vendorOrderId: string, tenantId: string, message: string): Promise<void> {
    if (!this.provider.supportsMessaging) {
      throw new UnsupportedOperationError(
        `The ${this.provider.name} provider does not support sending messages via API.`
      );
    }

    const existing = await this.getInspectionData(vendorOrderId, tenantId);

    if (!existing.externalOrderId) {
      throw new Error(
        `Cannot send message for order ${vendorOrderId}: no externalOrderId stored.`
      );
    }

    await this.provider.sendMessage!(existing.externalOrderId, message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Report download
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates a short-lived read-only SAS URL for a stored inspection PDF.
   * `variant` must be one of: 'main' | 'survey' | 'photos' | 'ordered'.
   * Throws if the variant has not been retrieved yet.
   */
  async getReportSasUrl(
    vendorOrderId: string,
    tenantId: string,
    variant: keyof NonNullable<InspectionVendorData['reportBlobPaths']>
  ): Promise<string> {
    const data = await this.getInspectionData(vendorOrderId, tenantId);

    const blobPath = data.reportBlobPaths?.[variant];
    if (!blobPath) {
      throw new Error(
        `Report variant "${variant}" for order ${vendorOrderId} has not been retrieved yet. ` +
          'Call retrieve-results first.'
      );
    }

    return this.blob.generateReadSasUrl(ORDERS_BLOB_CONTAINER, blobPath, 15);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the InspectionVendorData block from the VendorOrder document.
   * Throws if the order is not found or has no inspectionVendorData.
   */
  async getInspectionData(vendorOrderId: string, tenantId: string): Promise<InspectionVendorData> {
    const result = await this.db.findOrderById(vendorOrderId);

    if (!result.success || !result.data) {
      throw new Error(
        `Order not found: ${vendorOrderId} (tenantId: ${tenantId})`
      );
    }

    const order = result.data as VendorOrder;

    if (!order.inspectionVendorData) {
      throw new Error(
        `Order ${vendorOrderId} has no inspectionVendorData. ` +
          'Call placeOrder before polling or retrieving results.'
      );
    }

    return order.inspectionVendorData;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Merges `updates` into the VendorOrder document.
   * Uses updateItem (cross-partition query + upsert) to avoid having to know the
   * partition key at the call site.
   */
  private async patchVendorOrder(
    vendorOrderId: string,
    tenantId: string,
    updates: Partial<VendorOrder>
  ): Promise<void> {
    const result = await this.db.updateItem<VendorOrder>(
      'orders',
      vendorOrderId,
      { ...updates, updatedAt: new Date() }
    );

    if (!result.success) {
      throw new Error(
        `Failed to update VendorOrder ${vendorOrderId}: ${result.error?.message ?? 'unknown error'}`
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Typed error for unsupported operations
// ──────────────────────────────────────────────────────────────────────────────

export class UnsupportedOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedOperationError';
  }
}
