import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service';
import { BlobStorageService } from './blob-storage.service';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { DocumentMetadata, DocumentListQuery, DocumentUpdateRequest } from '../types/document.types';
import { ApiResponse } from '../types/index';
import { EventCategory } from '../types/events.js';
import { buildManualDraftSourceIdentity, extendIntakeSourceIdentity } from '../types/intake-source.types.js';

export class DocumentService {
  /** Cosmos container for document metadata */
  private readonly containerName = 'documents';
  /** Azure Blob Storage container for document files */
  private readonly blobContainerName: string;
  private container: Container;
  private readonly publisher: ServiceBusEventPublisher;

  constructor(
    private readonly cosmosService: CosmosDbService,
    private readonly blobService: BlobStorageService
  ) {
    const blobContainer = process.env.STORAGE_CONTAINER_DOCUMENTS;
    if (!blobContainer) {
      throw new Error('STORAGE_CONTAINER_DOCUMENTS env var is required — set it to the Azure Blob container name for documents (e.g. "appraisal-documents")');
    }
    this.blobContainerName = blobContainer;
    this.container = this.cosmosService.getContainer(this.containerName);
    this.publisher = new ServiceBusEventPublisher();
  }

  /**
   * Upload a document file and store metadata
   */
  async uploadDocument(
    orderId: string | undefined,
    tenantId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    userId: string,
    category?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    entityType?: string,
    entityId?: string
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      // Generate unique blob name — use orderId for order docs, entityType/entityId for entity docs
      const extension = file.originalname.split('.').pop();
      const blobPrefix = orderId || `${entityType}/${entityId}`;
      const blobName = `${blobPrefix}/${uuidv4()}.${extension}`;

      // Compute SHA-256 content hash for dedup & integrity verification
      const contentHash = createHash('sha256').update(file.buffer).digest('hex');

      // Upload to blob storage
      const uploadResult = await this.blobService.uploadBlob({
        containerName: this.blobContainerName,
        blobName,
        data: file.buffer,
        contentType: file.mimetype,
        metadata: {
          ...(orderId && { orderId }),
          ...(entityType && { entityType }),
          ...(entityId && { entityId }),
          tenantId,
          originalName: file.originalname,
          uploadedBy: userId,
          contentHash
        }
      });

      // Create document metadata
      const documentId = uuidv4();
      const document: DocumentMetadata = {
        id: documentId,
        tenantId,
        ...(orderId && { orderId }),
        name: file.originalname,
        blobUrl: uploadResult.url,
        blobName: uploadResult.blobName,
        fileSize: file.size,
        mimeType: file.mimetype,
        contentHash,
        ...(category && { category }),
        ...(category && { documentType: category.toUpperCase().replace(/-/g, '_') }),
        ...(tags && { tags }),
        version: 1,
        isLatestVersion: true,
        uploadedBy: userId,
        uploadedAt: new Date(),
        ...(metadata && { metadata }),
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
        ...(entityType === 'order-intake-draft' && entityId
          ? {
              sourceIdentity: buildManualDraftSourceIdentity({
                intakeDraftId: entityId,
                ...(orderId ? { orderId } : {}),
                documentId,
              }),
            }
          : {})
      };

      // Save to Cosmos DB
      await this.container.items.create(document);

      // Notify interested services (e.g. AxiomDocumentProcessingService) that a new document is available.
      await this.publisher.publish({
        id: uuidv4(),
        type: 'document.uploaded' as const,
        timestamp: new Date(),
        source: 'document-service',
        version: '1.0',
        correlationId: document.id,
        category: EventCategory.DOCUMENT,
        data: {
          documentId: document.id,
          ...(document.orderId && { orderId: document.orderId }),
          tenantId: document.tenantId,
          ...(document.clientId && { clientId: document.clientId }),
          ...(document.category && { category: document.category }),
          ...(document.documentType && { documentType: document.documentType }),
          blobName: document.blobName,
          mimeType: document.mimeType,
          uploadedBy: document.uploadedBy,
        },
      });

      return {
        success: true,
        data: document
      };
    } catch (error) {
      console.error('Error uploading document:', error);
      return {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Failed to upload document',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * List documents with optional filtering
   */
  async listDocuments(
    tenantId: string,
    query?: DocumentListQuery
  ): Promise<ApiResponse<DocumentMetadata[]>> {
    try {
      const limit = query?.limit || 50;
      const offset = query?.offset || 0;

      // Build query
      let sqlQuery = `SELECT * FROM c WHERE c.tenantId = @tenantId`;
      const parameters: { name: string; value: unknown }[] = [
        { name: '@tenantId', value: tenantId }
      ];

      if (query?.orderId) {
        sqlQuery += ` AND c.orderId = @orderId`;
        parameters.push({ name: '@orderId', value: query.orderId });
      }

      if (query?.category) {
        sqlQuery += ` AND c.category = @category`;
        parameters.push({ name: '@category', value: query.category });
      }

      if (query?.entityType) {
        sqlQuery += ` AND c.entityType = @entityType`;
        parameters.push({ name: '@entityType', value: query.entityType });
      }

      if (query?.entityId) {
        sqlQuery += ` AND c.entityId = @entityId`;
        parameters.push({ name: '@entityId', value: query.entityId });
      }

      sqlQuery += ` ORDER BY c.uploadedAt DESC OFFSET @offset LIMIT @limit`;
      parameters.push({ name: '@offset', value: offset });
      parameters.push({ name: '@limit', value: limit });

      // Execute query
      const response = await this.cosmosService.queryItems<DocumentMetadata>(
        this.containerName,
        sqlQuery,
        parameters
      );

      if (!response.success) {
        return response;
      }

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      console.error('Error listing documents:', error);
      return {
        success: false,
        error: {
          code: 'LIST_ERROR',
          message: error instanceof Error ? error.message : 'Failed to list documents',
          timestamp: new Date()
        }
      };
    }
  }

  async associateEntityDocumentsToOrder(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    orderId: string;
    linkedBy: string;
    linkReason?: string;
  }): Promise<ApiResponse<DocumentMetadata[]>> {
    try {
      const response = await this.cosmosService.queryItems<DocumentMetadata>(
        this.containerName,
        'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.entityType = @entityType AND c.entityId = @entityId ORDER BY c.uploadedAt DESC',
        [
          { name: '@tenantId', value: params.tenantId },
          { name: '@entityType', value: params.entityType },
          { name: '@entityId', value: params.entityId },
        ],
      );

      if (!response.success) {
        return {
          success: false,
          ...(response.error ? { error: response.error } : {}),
        };
      }

      const documents = response.data ?? [];
      if (documents.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      const now = new Date();
      const updatedDocuments: DocumentMetadata[] = [];

      for (const document of documents) {
        if (document.orderId === params.orderId) {
          updatedDocuments.push(document);
          continue;
        }

        const updatedDocument: DocumentMetadata = {
          ...document,
          orderId: params.orderId,
          updatedAt: now,
          orderLinkedAt: now,
          orderLinkedBy: params.linkedBy,
          ...(document.sourceIdentity || document.entityType === 'order-intake-draft' || params.entityType === 'order-intake-draft'
            ? {
                sourceIdentity:
                  extendIntakeSourceIdentity(document.sourceIdentity, {
                    orderId: params.orderId,
                    documentId: document.id,
                  }) ?? buildManualDraftSourceIdentity({
                    intakeDraftId: document.entityId ?? params.entityId,
                    orderId: params.orderId,
                    documentId: document.id,
                  }),
              }
            : {}),
          metadata: {
            ...(document.metadata ?? {}),
            linkedFromEntityType: document.entityType ?? params.entityType,
            linkedFromEntityId: document.entityId ?? params.entityId,
            linkedToOrderId: params.orderId,
            linkedToOrderAt: now.toISOString(),
            linkedToOrderBy: params.linkedBy,
            ...(params.linkReason ? { linkedToOrderReason: params.linkReason } : {}),
          },
        };

        await this.container.item(document.id, params.tenantId).replace(updatedDocument);
        updatedDocuments.push(updatedDocument);
      }

      return {
        success: true,
        data: updatedDocuments,
      };
    } catch (error) {
      console.error('Error associating entity documents to order:', error);
      return {
        success: false,
        error: {
          code: 'DOCUMENT_ORDER_ASSOCIATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to associate entity documents to order',
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(
    id: string,
    tenantId: string
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      const query = 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId';
      const parameters = [
        { name: '@id', value: id },
        { name: '@tenantId', value: tenantId }
      ];

      const response = await this.cosmosService.queryItems<DocumentMetadata>(
        this.containerName,
        query,
        parameters
      );

      if (!response.success || !response.data || response.data.length === 0) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date()
          }
        };
      }

      const document = response.data[0];
      if (!document) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date()
          }
        };
      }

      return {
        success: true,
        data: document
      };
    } catch (error) {
      console.error('Error getting document:', error);
      return {
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get document',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update document metadata (not the file itself)
   */
  async updateDocument(
    id: string,
    tenantId: string,
    updates: DocumentUpdateRequest
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      // Get existing document
      const getResponse = await this.getDocument(id, tenantId);
      if (!getResponse.success || !getResponse.data) {
        return getResponse;
      }

      const document = getResponse.data;

      // Update fields
      const updatedDocument: DocumentMetadata = {
        ...document,
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
        ...(updates.metadata !== undefined && { metadata: updates.metadata }),
        updatedAt: new Date()
      };

      // Save to Cosmos DB
      await this.container.item(id, tenantId).replace(updatedDocument);

      return {
        success: true,
        data: updatedDocument
      };
    } catch (error) {
      console.error('Error updating document:', error);
      return {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update document',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Delete a document (both metadata and blob)
   */
  async deleteDocument(
    id: string,
    tenantId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Get document to find blob name
      const getResponse = await this.getDocument(id, tenantId);
      if (!getResponse.success || !getResponse.data) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date()
          }
        };
      }

      const document = getResponse.data;

      // Delete from blob storage
      await this.blobService.deleteBlob(this.blobContainerName, document.blobName);

      // Delete from Cosmos DB
      await this.container.item(id, tenantId).delete();

      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting document:', error);
      return {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete document',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get document download URL (the blob URL is already public, but this validates access)
   */
  async getDocumentDownloadUrl(
    id: string,
    tenantId: string
  ): Promise<ApiResponse<{ url: string; name: string; mimeType: string }>> {
    try {
      const getResponse = await this.getDocument(id, tenantId);
      if (!getResponse.success || !getResponse.data) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
            timestamp: new Date()
          }
        };
      }

      const document = getResponse.data;

      return {
        success: true,
        data: {
          url: document.blobUrl,
          name: document.name,
          mimeType: document.mimeType
        }
      };
    } catch (error) {
      console.error('Error getting download URL:', error);
      return {
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get download URL',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Upload a new version of an existing document.
   * Creates a new document record with incremented version, links to the previous version,
   * and marks the old version as no longer latest.
   */
  async uploadNewVersion(
    existingDocumentId: string,
    tenantId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    userId: string
  ): Promise<ApiResponse<DocumentMetadata>> {
    try {
      // 1. Fetch existing document
      const existingResult = await this.getDocument(existingDocumentId, tenantId);
      if (!existingResult.success || !existingResult.data) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Cannot create new version: document '${existingDocumentId}' not found`,
            timestamp: new Date()
          }
        };
      }

      const existing = existingResult.data;

      // 2. Upload new blob
      const extension = file.originalname.split('.').pop();
      const blobPrefix = existing.orderId || `${existing.entityType}/${existing.entityId}`;
      const blobName = `${blobPrefix}/${uuidv4()}.${extension}`;
      const contentHash = createHash('sha256').update(file.buffer).digest('hex');

      const uploadResult = await this.blobService.uploadBlob({
        containerName: this.blobContainerName,
        blobName,
        data: file.buffer,
        contentType: file.mimetype,
        metadata: {
          ...(existing.orderId && { orderId: existing.orderId }),
          ...(existing.entityType && { entityType: existing.entityType }),
          ...(existing.entityId && { entityId: existing.entityId }),
          tenantId,
          originalName: file.originalname,
          uploadedBy: userId,
          contentHash,
          previousVersionId: existingDocumentId
        }
      });

      // 3. Create new version document
      const newVersion: DocumentMetadata = {
        id: uuidv4(),
        tenantId,
        ...(existing.orderId && { orderId: existing.orderId }),
        name: file.originalname,
        blobUrl: uploadResult.url,
        blobName: uploadResult.blobName,
        fileSize: file.size,
        mimeType: file.mimetype,
        contentHash,
        ...(existing.category && { category: existing.category }),
        ...(existing.tags && { tags: existing.tags }),
        version: (existing.version || 1) + 1,
        previousVersionId: existingDocumentId,
        isLatestVersion: true,
        uploadedBy: userId,
        uploadedAt: new Date(),
        ...(existing.metadata && { metadata: existing.metadata }),
        ...(existing.entityType && { entityType: existing.entityType }),
        ...(existing.entityId && { entityId: existing.entityId })
      };

      // 4. Mark old version as not latest
      const { resource: oldDoc } = await this.container.item(existingDocumentId, tenantId).read();
      if (oldDoc) {
        await this.container.item(existingDocumentId, tenantId).replace(
          { ...oldDoc, isLatestVersion: false, updatedAt: new Date() }
        );
      }

      // 5. Save new version to Cosmos DB
      await this.container.items.create(newVersion);

      return {
        success: true,
        data: newVersion
      };
    } catch (error) {
      console.error('Error uploading new version:', error);
      return {
        success: false,
        error: {
          code: 'VERSION_UPLOAD_ERROR',
          message: error instanceof Error ? error.message : 'Failed to upload new version',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get the version history chain for a document.
   * Walks the previousVersionId chain from the given document back to version 1,
   * and also finds any newer versions that reference this document.
   */
  async getVersionHistory(
    documentId: string,
    tenantId: string
  ): Promise<ApiResponse<DocumentMetadata[]>> {
    try {
      // Strategy: find all documents in the same version chain.
      // First get the target document, then find the root (version 1) and all descendants.
      const targetResult = await this.getDocument(documentId, tenantId);
      if (!targetResult.success || !targetResult.data) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Document '${documentId}' not found`,
            timestamp: new Date()
          }
        };
      }

      // Walk backwards to find root document ID
      let rootId = documentId;
      let current = targetResult.data;
      const visited = new Set<string>([documentId]);

      while (current.previousVersionId) {
        if (visited.has(current.previousVersionId)) break; // safety: avoid cycles
        visited.add(current.previousVersionId);
        const prevResult = await this.getDocument(current.previousVersionId, tenantId);
        if (!prevResult.success || !prevResult.data) break;
        current = prevResult.data;
        rootId = current.id;
      }

      // Now query all documents that have previousVersionId pointing to any doc in the chain,
      // or that ARE the root doc. Simpler: query all docs with same orderId/category and walk.
      // Most reliable: get all docs in the chain by querying previousVersionId references.
      const chain: DocumentMetadata[] = [current]; // start with root
      let currentId = rootId;
      const chainVisited = new Set<string>([rootId]);

      // Walk forward through the chain
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const nextQuery = 'SELECT * FROM c WHERE c.previousVersionId = @prevId AND c.tenantId = @tenantId';
        const nextResult = await this.cosmosService.queryItems<DocumentMetadata>(
          this.containerName,
          nextQuery,
          [
            { name: '@prevId', value: currentId },
            { name: '@tenantId', value: tenantId }
          ]
        );

        if (!nextResult.success || !nextResult.data || nextResult.data.length === 0) break;

        const nextDoc = nextResult.data[0];
        if (!nextDoc || chainVisited.has(nextDoc.id)) break;
        chainVisited.add(nextDoc.id);
        chain.push(nextDoc);
        currentId = nextDoc.id;
      }

      // Sort by version ascending
      chain.sort((a, b) => (a.version || 1) - (b.version || 1));

      return {
        success: true,
        data: chain
      };
    } catch (error) {
      console.error('Error getting version history:', error);
      return {
        success: false,
        error: {
          code: 'VERSION_HISTORY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get version history',
          timestamp: new Date()
        }
      };
    }
  }
}
