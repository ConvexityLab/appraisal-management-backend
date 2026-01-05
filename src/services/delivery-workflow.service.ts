/**
 * Delivery Workflow Service
 * Manages document uploads, delivery packages, and revision workflows
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index.js';
import {
  OrderDocument,
  DocumentType,
  DocumentStatus,
  DeliveryPackage,
  RevisionRequest
} from '../types/order-progress.types.js';

export class DeliveryWorkflowService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
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

      // TODO: Send notification to deliveredTo recipients

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

      await this.dbService.updateItem('deliveryPackages', packageId, deliveryPackage, tenantId);

      return {
        success: true,
        data: deliveryPackage
      };
    } catch (error) {
      this.logger.error('Error acknowledging delivery package', { packageId, error });
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

      // TODO: Send notification to assigned vendor

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
}




