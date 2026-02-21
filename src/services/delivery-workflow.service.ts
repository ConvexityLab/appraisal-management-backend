/**
 * Delivery Workflow Service
 * Manages document uploads, delivery packages, and revision workflows
 */

import crypto from 'node:crypto';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { BlobStorageService } from './blob-storage.service';
import { WebPubSubService } from './web-pubsub.service';
import { ApiResponse } from '../types/index.js';
import { EventPriority, EventCategory } from '../types/events.js';
import {
  OrderDocument,
  DocumentType,
  DocumentStatus,
  DeliveryPackage,
  RevisionRequest
} from '../types/order-progress.types.js';
import type { DocumentMetadata } from '../types/document.types.js';

/** Manifest entry stored alongside each delivery package */
export interface PackageManifestEntry {
  documentId: string;
  fileName: string;
  category: string;
  fileSize: number;
  mimeType: string;
  blobName: string;
  blobContainer: string;
  version: number;
}

/** Single entry in a package's status‑change audit trail */
export interface PackageStatusHistoryEntry {
  status: string;
  changedBy: string;
  changedAt: Date;
  notes?: string;
}

/** Single entry in the order‑level delivery timeline */
export interface DeliveryTimelineEntry {
  id: string;
  timestamp: Date;
  event: string;
  actor: string;
  details?: Record<string, any>;
}

export class DeliveryWorkflowService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private blobService: BlobStorageService;
  private webPubSubService: WebPubSubService | null = null;

  constructor(dbService?: CosmosDbService, blobService?: BlobStorageService) {
    this.logger = new Logger();
    this.dbService = dbService || new CosmosDbService();
    this.blobService = blobService || new BlobStorageService();
    try {
      this.webPubSubService = new WebPubSubService({ enableLocalEmulation: true });
    } catch {
      this.logger.warn('WebPubSubService unavailable — delivery notifications disabled');
    }
  }

  // ── Notification helper ──────────────────────────────────────

  /**
   * Best-effort broadcast of a delivery lifecycle notification.
   * Logs a warning and continues if WebPubSub is unavailable.
   */
  private async broadcastDeliveryEvent(
    orderId: string,
    eventType: string,
    title: string,
    message: string,
    priority: EventPriority = EventPriority.NORMAL,
    extra?: Record<string, any>,
  ): Promise<void> {
    if (!this.webPubSubService) return;
    try {
      await this.webPubSubService.broadcastNotification({
        id: `delivery-${orderId}-${eventType}-${Date.now()}`,
        title,
        message,
        priority,
        category: EventCategory.ORDER,
        targets: [],
        data: { eventType, orderId, timestamp: new Date().toISOString(), ...extra },
      });
    } catch (err) {
      this.logger.warn('Failed to broadcast delivery event via WebPubSub', {
        orderId,
        eventType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Upload document for order
   */
  async uploadDocument(
    orderId: string,
    tenantId: string,
    uploadedBy: string,
    uploadedByRole: 'VENDOR' | 'AMC' | 'CLIENT' | 'SYSTEM',
    documentData: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      documentType: DocumentType;
      blobUrl: string;
      blobContainer: string;
      blobPath: string;
      isDraft?: boolean;
      isFinal?: boolean;
      description?: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<OrderDocument>> {
    try {
      this.logger.info('Uploading document for order', { orderId, fileName: documentData.fileName });

      // Get existing documents to determine version
      const existingDocsResponse = await this.dbService.queryItems(
        'documents',
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.documentType = @type AND c.isLatestVersion = true',
        [
          { name: '@orderId', value: orderId },
          { name: '@type', value: documentData.documentType }
        ]
      ) as ApiResponse<any[]>;

      const existingDocs = existingDocsResponse.data || [];
      const version = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

      // Mark previous version as not latest
      if (existingDocs.length > 0) {
        const prevDoc = existingDocs[0];
        prevDoc.isLatestVersion = false;
        prevDoc.updatedAt = new Date();
        await this.dbService.updateItem('documents', prevDoc.id, prevDoc, tenantId);
      }

      const document: OrderDocument = {
        id: `doc-${orderId}-${Date.now()}`,
        orderId,
        tenantId,
        fileName: documentData.fileName,
        fileSize: documentData.fileSize,
        mimeType: documentData.mimeType,
        documentType: documentData.documentType,
        blobUrl: documentData.blobUrl,
        blobContainer: documentData.blobContainer,
        blobPath: documentData.blobPath,
        version,
        isLatestVersion: true,
        previousVersionId: existingDocs.length > 0 ? existingDocs[0].id : undefined,
        status: 'UPLOADED',
        isDraft: documentData.isDraft || false,
        isFinal: documentData.isFinal || false,
        uploadedBy,
        uploadedByRole,
        uploadedAt: new Date(),
        description: documentData.description || '',
        tags: documentData.tags || [],
        isClientVisible: documentData.isFinal || false,
        isVendorVisible: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.dbService.createItem('documents', document);

      // Update order status if final document
      if (documentData.isFinal) {
        await this.updateOrderStatusOnFinalSubmission(orderId, tenantId);
      }

      return {
        success: true,
        data: document
      };
    } catch (error) {
      this.logger.error('Error uploading document', { orderId, error });
      throw error;
    }
  }

  /**
   * Update order status when final document is submitted
   */
  private async updateOrderStatusOnFinalSubmission(orderId: string, tenantId: string): Promise<void> {
    try {
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;

      if (order && order.status === 'IN_PROGRESS') {
        order.status = 'FINAL_SUBMITTED';
        order.updatedAt = new Date();
        await this.dbService.updateItem('orders', orderId, order, tenantId);
      }
    } catch (error) {
      this.logger.error('Error updating order status on final submission', { orderId, error });
    }
  }

  /**
   * Get documents for order
   */
  async getOrderDocuments(
    orderId: string,
    tenantId: string,
    filters?: {
      documentType?: DocumentType;
      status?: DocumentStatus;
      latestOnly?: boolean;
    }
  ): Promise<ApiResponse<OrderDocument[]>> {
    try {
      let query = 'SELECT * FROM c WHERE c.orderId = @orderId';
      const parameters: any[] = [{ name: '@orderId', value: orderId }];

      if (filters?.documentType) {
        query += ' AND c.documentType = @type';
        parameters.push({ name: '@type', value: filters.documentType });
      }

      if (filters?.status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: filters.status });
      }

      if (filters?.latestOnly) {
        query += ' AND c.isLatestVersion = true';
      }

      query += ' ORDER BY c.uploadedAt DESC';

      const response = await this.dbService.queryItems(
        'documents',
        query,
        parameters
      ) as ApiResponse<any[]>;

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      this.logger.error('Error getting order documents', { orderId, error });
      throw error;
    }
  }

  /**
   * Review document
   */
  async reviewDocument(
    documentId: string,
    tenantId: string,
    reviewedBy: string,
    status: DocumentStatus,
    reviewNotes?: string
  ): Promise<ApiResponse<OrderDocument>> {
    try {
      this.logger.info('Reviewing document', { documentId, status });

      const response = await this.dbService.getItem('documents', documentId, tenantId) as ApiResponse<any>;
      const document = response.data;

      if (!document) {
        return {
          success: false,
          data: null as any,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found', timestamp: new Date() }
        };
      }

      document.status = status;
      document.reviewedBy = reviewedBy;
      document.reviewedAt = new Date();
      document.reviewNotes = reviewNotes;
      document.updatedAt = new Date();

      if (status === 'APPROVED') {
        document.isClientVisible = true;
      }

      await this.dbService.updateItem('documents', documentId, document, tenantId);

      // If revision required, create revision request
      if (status === 'REVISION_REQUIRED' && reviewNotes) {
        await this.createRevisionRequest(document, reviewedBy, reviewNotes, tenantId);
      }

      return {
        success: true,
        data: document
      };
    } catch (error) {
      this.logger.error('Error reviewing document', { documentId, error });
      throw error;
    }
  }

  /**
   * Create delivery package
   */
  async createDeliveryPackage(
    orderId: string,
    tenantId: string,
    packageType: 'DRAFT' | 'FINAL' | 'REVISION' | 'ADDENDUM',
    documentIds: string[],
    deliveredTo: string[],
    submissionNotes?: string
  ): Promise<ApiResponse<DeliveryPackage>> {
    try {
      this.logger.info('Creating delivery package', { orderId, packageType });

      // Get existing packages to determine version
      const existingPackagesResponse = await this.dbService.queryItems(
        'deliveryPackages',
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.packageType = @type ORDER BY c.version DESC',
        [
          { name: '@orderId', value: orderId },
          { name: '@type', value: packageType }
        ]
      ) as ApiResponse<any[]>;

      const existingPackages = existingPackagesResponse.data || [];
      const version = existingPackages.length > 0 ? existingPackages[0].version + 1 : 1;

      const deliveryPackage: DeliveryPackage = {
        id: `pkg-${orderId}-${packageType}-${Date.now()}`,
        orderId,
        tenantId,
        packageType,
        version,
        documentIds,
        status: 'READY',
        deliveredTo,
        deliveredAt: new Date(),
        deliveryMethod: 'PORTAL',
        submissionNotes: submissionNotes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // ── Build manifest from document metadata ────────────────
      const blobContainer = process.env.STORAGE_CONTAINER_DOCUMENTS;
      if (!blobContainer) {
        throw new Error('STORAGE_CONTAINER_DOCUMENTS env var is required for delivery package assembly');
      }

      const manifest: PackageManifestEntry[] = [];
      for (const docId of documentIds) {
        const docResponse = await this.dbService.queryItems<DocumentMetadata>(
          'documents',
          'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
          [
            { name: '@id', value: docId },
            { name: '@tenantId', value: tenantId },
          ],
        );
        const doc = docResponse.data?.[0];
        if (doc) {
          manifest.push({
            documentId: doc.id,
            fileName: doc.name,
            category: doc.category || 'other',
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            blobName: doc.blobName,
            blobContainer,
            version: doc.version ?? 1,
          });
        } else {
          this.logger.warn('Document not found when assembling package manifest — skipping', { docId, orderId });
        }
      }

      (deliveryPackage as any).manifest = manifest;

      // Record initial status in audit trail
      (deliveryPackage as any).statusHistory = [
        { status: 'READY', changedBy: 'system', changedAt: new Date(), notes: 'Package created' },
      ] as PackageStatusHistoryEntry[];

      // Generate client acknowledgement token (best-effort — skip if secret not configured)
      try {
        const { token, expiresAt } = this.generateClientAcknowledgementToken(deliveryPackage.id);
        (deliveryPackage as any).clientAckToken = token;
        (deliveryPackage as any).clientAckExpiresAt = expiresAt;
      } catch {
        this.logger.warn('CLIENT_ACK_SECRET not set — skipping client acknowledgement token generation');
      }

      await this.dbService.createItem('deliveryPackages', deliveryPackage);

      // Update order status
      if (packageType === 'FINAL') {
        const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
        const order = orderResponse.data;
        
        if (order) {
          order.status = 'FINAL_UNDER_REVIEW';
          order.updatedAt = new Date();
          await this.dbService.updateItem('orders', orderId, order, tenantId);
        }
      }

      // Notify stakeholders of new delivery package
      this.broadcastDeliveryEvent(
        orderId,
        'delivery.package.created',
        'Delivery Package Created',
        `A ${packageType} delivery package (v${version}) with ${documentIds.length} document(s) is ready for review`,
        EventPriority.HIGH,
        { packageId: deliveryPackage.id, packageType, version, documentCount: documentIds.length },
      ).catch(() => { /* best-effort */ });

      return {
        success: true,
        data: deliveryPackage
      };
    } catch (error) {
      this.logger.error('Error creating delivery package', { orderId, error });
      throw error;
    }
  }

  /**
   * Acknowledge delivery package
   */
  async acknowledgeDeliveryPackage(
    packageId: string,
    tenantId: string,
    acknowledgedBy: string
  ): Promise<ApiResponse<DeliveryPackage>> {
    try {
      this.logger.info('Acknowledging delivery package', { packageId });

      const response = await this.dbService.getItem('deliveryPackages', packageId, tenantId) as ApiResponse<any>;
      const deliveryPackage = response.data;

      if (!deliveryPackage) {
        return {
          success: false,
          data: null as any,
          error: { code: 'PACKAGE_NOT_FOUND', message: 'Delivery package not found', timestamp: new Date() }
        };
      }

      deliveryPackage.status = 'ACKNOWLEDGED';
      deliveryPackage.acknowledgedBy = deliveryPackage.acknowledgedBy || [];
      deliveryPackage.acknowledgedBy.push(acknowledgedBy);
      deliveryPackage.acknowledgedAt = new Date();
      deliveryPackage.updatedAt = new Date();

      // Record status change in audit trail
      const history: PackageStatusHistoryEntry[] = (deliveryPackage as any).statusHistory || [];
      history.push({ status: 'ACKNOWLEDGED', changedBy: acknowledgedBy, changedAt: new Date() });
      (deliveryPackage as any).statusHistory = history;

      await this.dbService.updateItem('deliveryPackages', packageId, deliveryPackage, tenantId);

      // Notify stakeholders of acknowledgement
      this.broadcastDeliveryEvent(
        deliveryPackage.orderId,
        'delivery.package.acknowledged',
        'Delivery Package Acknowledged',
        `Delivery package v${deliveryPackage.version} has been acknowledged by ${acknowledgedBy}`,
        EventPriority.NORMAL,
        { packageId, acknowledgedBy },
      ).catch(() => { /* best-effort */ });

      return {
        success: true,
        data: deliveryPackage
      };
    } catch (error) {
      this.logger.error('Error acknowledging delivery package', { packageId, error });
      throw error;
    }
  }

  // ── Client Acknowledgement ──────────────────────────────────

  /** Secret used to sign client acknowledgement tokens */
  private get ackSecret(): string {
    const secret = process.env.CLIENT_ACK_SECRET;
    if (!secret) {
      throw new Error('CLIENT_ACK_SECRET environment variable is required for client acknowledgement URLs');
    }
    return secret;
  }

  /**
   * Generate a time-limited signed URL that a client can use to acknowledge
   * delivery of a package without logging in.
   *
   * Token format: `<hex-hmac>.<expiry-ms>`
   * HMAC payload: `<packageId>:<expiresAt>`
   */
  generateClientAcknowledgementToken(
    packageId: string,
    expiresInMs: number = 7 * 24 * 60 * 60 * 1000, // default 7 days
  ): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + expiresInMs);
    const payload = `${packageId}:${expiresAt.getTime()}`;
    const hmac = crypto.createHmac('sha256', this.ackSecret).update(payload).digest('hex');
    return {
      token: `${hmac}.${expiresAt.getTime()}`,
      expiresAt,
    };
  }

  /**
   * Validate a client acknowledgement token.
   * Returns true if the token is valid and not expired for the given packageId.
   */
  validateClientAcknowledgementToken(packageId: string, token: string): boolean {
    try {
      const [hmac, expiryStr] = token.split('.');
      if (!hmac || !expiryStr) return false;
      const expiresAt = Number(expiryStr);
      if (Date.now() > expiresAt) return false;

      const payload = `${packageId}:${expiresAt}`;
      const expected = crypto.createHmac('sha256', this.ackSecret).update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Client-facing acknowledgement of a delivery package using a signed token.
   * Records who acknowledged, optional feedback, and transitions status.
   */
  async clientAcknowledgeDeliveryPackage(
    packageId: string,
    tenantId: string,
    token: string,
    clientName: string,
    feedback?: string,
  ): Promise<ApiResponse<DeliveryPackage>> {
    try {
      if (!this.validateClientAcknowledgementToken(packageId, token)) {
        return {
          success: false,
          data: null as any,
          error: { code: 'INVALID_TOKEN', message: 'Acknowledgement token is invalid or expired', timestamp: new Date() },
        };
      }

      const response = await this.dbService.getItem('deliveryPackages', packageId, tenantId) as ApiResponse<any>;
      const deliveryPackage = response.data;

      if (!deliveryPackage) {
        return {
          success: false,
          data: null as any,
          error: { code: 'PACKAGE_NOT_FOUND', message: 'Delivery package not found', timestamp: new Date() },
        };
      }

      // Prevent double-acknowledge
      if (deliveryPackage.status === 'ACKNOWLEDGED' || deliveryPackage.status === 'COMPLETED') {
        return { success: true, data: deliveryPackage };
      }

      deliveryPackage.status = 'ACKNOWLEDGED';
      deliveryPackage.acknowledgedBy = deliveryPackage.acknowledgedBy || [];
      deliveryPackage.acknowledgedBy.push(clientName);
      deliveryPackage.acknowledgedAt = new Date();
      deliveryPackage.updatedAt = new Date();
      (deliveryPackage as any).clientFeedback = feedback || null;

      const history: PackageStatusHistoryEntry[] = (deliveryPackage as any).statusHistory || [];
      history.push({
        status: 'ACKNOWLEDGED',
        changedBy: clientName,
        changedAt: new Date(),
        notes: feedback ? `Client feedback: ${feedback}` : 'Client acknowledged via signed link',
      });
      (deliveryPackage as any).statusHistory = history;

      await this.dbService.updateItem('deliveryPackages', packageId, deliveryPackage, tenantId);

      // Notify stakeholders
      this.broadcastDeliveryEvent(
        deliveryPackage.orderId,
        'delivery.package.client_acknowledged',
        'Client Acknowledged Delivery',
        `Client "${clientName}" acknowledged delivery package v${deliveryPackage.version}`,
        EventPriority.HIGH,
        { packageId, clientName, hasFeedback: !!feedback },
      ).catch(() => { /* best-effort */ });

      return { success: true, data: deliveryPackage };
    } catch (error) {
      this.logger.error('Error in client acknowledgement', { packageId, error });
      throw error;
    }
  }

  /**
   * Create revision request
   */
  async createRevisionRequest(
    document: OrderDocument,
    requestedBy: string,
    description: string,
    tenantId: string,
    requestData?: {
      requestedByRole?: 'AMC' | 'CLIENT' | 'UNDERWRITER' | 'SYSTEM';
      requestType?: 'TECHNICAL' | 'COMPLIANCE' | 'QUALITY' | 'CONTENT' | 'OTHER';
      issueCategory?: string;
      specificPages?: number[];
      severity?: 'CRITICAL' | 'MAJOR' | 'MINOR';
      dueDate?: Date;
    }
  ): Promise<ApiResponse<RevisionRequest>> {
    try {
      this.logger.info('Creating revision request', { documentId: document.id });

      const orderResponse = await this.dbService.getItem('orders', document.orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;

      const dueDate = requestData?.dueDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days default

      const revisionRequest: RevisionRequest = {
        id: `revision-${document.orderId}-${Date.now()}`,
        orderId: document.orderId,
        tenantId,
        requestedBy,
        requestedByRole: requestData?.requestedByRole || 'AMC',
        requestType: requestData?.requestType || 'QUALITY',
        documentId: document.id,
        issueCategory: requestData?.issueCategory || 'General',
        description,
        specificPages: requestData?.specificPages || [],
        severity: requestData?.severity || 'MAJOR',
        status: 'OPEN',
        assignedTo: order?.assignedVendorId || '',
        dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.dbService.createItem('revisionRequests', revisionRequest);

      // Update order status
      if (order) {
        order.status = 'REVISIONS_REQUESTED';
        order.updatedAt = new Date();
        await this.dbService.updateItem('orders', document.orderId, order, tenantId);
      }

      // Notify vendor of revision request
      this.broadcastDeliveryEvent(
        document.orderId,
        'delivery.revision.requested',
        'Revision Requested',
        `A ${revisionRequest.severity} revision has been requested: ${description.slice(0, 100)}`,
        revisionRequest.severity === 'CRITICAL' ? EventPriority.CRITICAL : EventPriority.HIGH,
        { revisionId: revisionRequest.id, severity: revisionRequest.severity, assignedTo: revisionRequest.assignedTo },
      ).catch(() => { /* best-effort */ });

      return {
        success: true,
        data: revisionRequest
      };
    } catch (error) {
      this.logger.error('Error creating revision request', { error });
      throw error;
    }
  }

  /**
   * Resolve revision request
   */
  async resolveRevisionRequest(
    revisionId: string,
    tenantId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<ApiResponse<RevisionRequest>> {
    try {
      this.logger.info('Resolving revision request', { revisionId });

      const response = await this.dbService.getItem('revisionRequests', revisionId, tenantId) as ApiResponse<any>;
      const revision = response.data;

      if (!revision) {
        return {
          success: false,
          data: null as any,
          error: { code: 'REVISION_NOT_FOUND', message: 'Revision request not found', timestamp: new Date() }
        };
      }

      const resolvedAt = new Date();
      const createdAt = new Date(revision.createdAt);
      const actualResolutionTime = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // hours

      revision.status = 'RESOLVED';
      revision.resolvedAt = resolvedAt;
      revision.resolvedBy = resolvedBy;
      revision.resolutionNotes = resolutionNotes;
      revision.actualResolutionTime = actualResolutionTime;
      revision.updatedAt = new Date();

      await this.dbService.updateItem('revisionRequests', revisionId, revision, tenantId);

      // Check if all revisions are resolved
      const openRevisionsResponse = await this.dbService.queryItems(
        'revisionRequests',
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.status = @status',
        [
          { name: '@orderId', value: revision.orderId },
          { name: '@status', value: 'OPEN' }
        ]
      ) as ApiResponse<any[]>;

      const openRevisions = openRevisionsResponse.data || [];

      // If no more open revisions, update order status
      if (openRevisions.length === 0) {
        const orderResponse = await this.dbService.getItem('orders', revision.orderId, tenantId) as ApiResponse<any>;
        const order = orderResponse.data;
        
        if (order) {
          order.status = 'IN_PROGRESS';
          order.updatedAt = new Date();
          await this.dbService.updateItem('orders', revision.orderId, order, tenantId);
        }
      }

      return {
        success: true,
        data: revision
      };
    } catch (error) {
      this.logger.error('Error resolving revision request', { revisionId, error });
      throw error;
    }
  }

  /**
   * Get revision requests for order
   */
  async getOrderRevisionRequests(
    orderId: string,
    tenantId: string,
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACKNOWLEDGED' | 'DISPUTED'
  ): Promise<ApiResponse<RevisionRequest[]>> {
    try {
      let query = 'SELECT * FROM c WHERE c.orderId = @orderId';
      const parameters: any[] = [{ name: '@orderId', value: orderId }];

      if (status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: status });
      }

      query += ' ORDER BY c.createdAt DESC';

      const response = await this.dbService.queryItems(
        'revisionRequests',
        query,
        parameters
      ) as ApiResponse<any[]>;

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      this.logger.error('Error getting order revision requests', { orderId, error });
      throw error;
    }
  }

  /**
   * Get delivery packages for order
   */
  async getOrderDeliveryPackages(
    orderId: string,
    tenantId: string
  ): Promise<ApiResponse<DeliveryPackage[]>> {
    try {
      const response = await this.dbService.queryItems(
        'deliveryPackages',
        'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.createdAt DESC',
        [{ name: '@orderId', value: orderId }]
      ) as ApiResponse<any[]>;

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      this.logger.error('Error getting order delivery packages', { orderId, error });
      throw error;
    }
  }

  /**
   * Get a single delivery package for download / inspection.
   * Returns the package record including manifest.
   */
  async getDeliveryPackage(
    packageId: string,
    tenantId: string,
  ): Promise<ApiResponse<DeliveryPackage & { manifest?: PackageManifestEntry[] }>> {
    try {
      const response = await this.dbService.getItem('deliveryPackages', packageId, tenantId) as ApiResponse<any>;

      if (!response.data) {
        return {
          success: false,
          data: null as any,
          error: { code: 'PACKAGE_NOT_FOUND', message: 'Delivery package not found', timestamp: new Date() },
        };
      }

      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error('Error getting delivery package', { packageId, error });
      throw error;
    }
  }

  /**
   * Stream documents for a delivery package (used by ZIP download endpoint).
   *
   * Yields `{ fileName, stream, contentType, contentLength }` for each
   * manifest entry. Callers pipe these into an archiver or ZIP stream.
   */
  async *streamPackageDocuments(
    manifest: PackageManifestEntry[],
  ): AsyncGenerator<{
    fileName: string;
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
  }> {
    for (const entry of manifest) {
      try {
        const download = await this.blobService.downloadBlob(entry.blobContainer, entry.blobName);
        yield {
          fileName: entry.fileName,
          stream: download.readableStream,
          contentType: download.contentType,
          contentLength: download.contentLength,
        };
      } catch (err) {
        this.logger.error('Failed to download blob for package entry — skipping', {
          documentId: entry.documentId,
          blobName: entry.blobName,
          error: err,
        });
        // Continue with remaining documents — partial package is better than none
      }
    }
  }

  /**
   * Complete order delivery
   */
  async completeOrderDelivery(
    orderId: string,
    tenantId: string,
    completedBy: string
  ): Promise<ApiResponse<any>> {
    try {
      this.logger.info('Completing order delivery', { orderId });

      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;

      if (!order) {
        return {
          success: false,
          data: null,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found', timestamp: new Date() }
        };
      }

      order.status = 'COMPLETED';
      order.completedAt = new Date();
      order.completedBy = completedBy;
      order.updatedAt = new Date();

      await this.dbService.updateItem('orders', orderId, order, tenantId);

      // Mark all READY / ACKNOWLEDGED packages as COMPLETED and record timeline
      const pkgResponse = await this.getOrderDeliveryPackages(orderId, tenantId);
      const packages = pkgResponse.data || [];
      for (const pkg of packages) {
        if (pkg.status === 'READY' || pkg.status === 'ACKNOWLEDGED') {
          (pkg as any).status = 'COMPLETED';
          (pkg as any).updatedAt = new Date();
          const history: PackageStatusHistoryEntry[] = (pkg as any).statusHistory || [];
          history.push({ status: 'COMPLETED', changedBy: completedBy, changedAt: new Date(), notes: 'Order delivery completed' });
          (pkg as any).statusHistory = history;
          await this.dbService.updateItem('deliveryPackages', pkg.id, pkg, tenantId);
        }
      }

      // Notify all stakeholders that delivery is completed
      this.broadcastDeliveryEvent(
        orderId,
        'delivery.order.completed',
        'Order Delivery Completed',
        `Order ${orderId} delivery has been completed by ${completedBy}`,
        EventPriority.HIGH,
        { completedBy, completedAt: order.completedAt, packageCount: packages.length },
      ).catch(() => { /* best-effort */ });

      return {
        success: true,
        data: {
          orderId,
          status: 'COMPLETED',
          completedAt: order.completedAt
        }
      };
    } catch (error) {
      this.logger.error('Error completing order delivery', { orderId, error });
      throw error;
    }
  }

  /**
   * Build an order-level delivery timeline by aggregating events from
   * packages, revisions, and the order record itself.
   */
  async getOrderDeliveryTimeline(
    orderId: string,
    tenantId: string,
  ): Promise<ApiResponse<DeliveryTimelineEntry[]>> {
    try {
      const timeline: DeliveryTimelineEntry[] = [];

      // 1) Package status changes
      const pkgResponse = await this.getOrderDeliveryPackages(orderId, tenantId);
      for (const pkg of (pkgResponse.data || [])) {
        const history: PackageStatusHistoryEntry[] = (pkg as any).statusHistory || [];
        for (const entry of history) {
          timeline.push({
            id: `pkg-${pkg.id}-${entry.status}`,
            timestamp: new Date(entry.changedAt),
            event: `Package v${pkg.version} → ${entry.status}`,
            actor: entry.changedBy,
            details: { packageId: pkg.id, packageType: pkg.packageType, notes: entry.notes },
          });
        }
        // Also add a "created" event from the package itself (in case statusHistory is empty on old records)
        if (history.length === 0) {
          timeline.push({
            id: `pkg-${pkg.id}-created`,
            timestamp: new Date(pkg.createdAt),
            event: `Package v${pkg.version} created (${pkg.packageType})`,
            actor: 'system',
            details: { packageId: pkg.id, documentCount: pkg.documentIds?.length ?? 0 },
          });
        }
      }

      // 2) Revision request events
      const revResponse = await this.getOrderRevisionRequests(orderId, tenantId);
      for (const rev of (revResponse.data || [])) {
        timeline.push({
          id: `rev-${rev.id}-created`,
          timestamp: new Date(rev.createdAt),
          event: `Revision requested (${rev.severity})`,
          actor: rev.requestedBy,
          details: { revisionId: rev.id, issueCategory: rev.issueCategory, description: rev.description },
        });
        if (rev.resolvedAt) {
          timeline.push({
            id: `rev-${rev.id}-resolved`,
            timestamp: new Date(rev.resolvedAt),
            event: 'Revision resolved',
            actor: rev.resolvedBy || 'unknown',
            details: { revisionId: rev.id, resolutionNotes: rev.resolutionNotes },
          });
        }
      }

      // 3) Order-level events (completion)
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;
      if (order?.completedAt) {
        timeline.push({
          id: `order-${orderId}-completed`,
          timestamp: new Date(order.completedAt),
          event: 'Order delivery completed',
          actor: order.completedBy || 'system',
        });
      }

      // Sort newest-first
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { success: true, data: timeline };
    } catch (error) {
      this.logger.error('Error building delivery timeline', { orderId, error });
      throw error;
    }
  }
}




