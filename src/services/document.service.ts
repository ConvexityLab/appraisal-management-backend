import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service';
import { BlobStorageService } from './blob-storage.service';
import { DocumentMetadata, DocumentListQuery, DocumentUpdateRequest } from '../types/document.types';
import { ApiResponse } from '../types/index';

export class DocumentService {
  /** Cosmos container for document metadata */
  private readonly containerName = 'documents';
  /** Azure Blob Storage container for document files */
  private readonly blobContainerName: string;
  private container: Container;

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
      const document: DocumentMetadata = {
        id: uuidv4(),
        tenantId,
        ...(orderId && { orderId }),
        name: file.originalname,
        blobUrl: uploadResult.url,
        blobName: uploadResult.blobName,
        fileSize: file.size,
        mimeType: file.mimetype,
        contentHash,
        ...(category && { category }),
        ...(tags && { tags }),
        version: 1,
        uploadedBy: userId,
        uploadedAt: new Date(),
        ...(metadata && { metadata }),
        ...(entityType && { entityType }),
        ...(entityId && { entityId })
      };

      // Save to Cosmos DB
      await this.container.items.create(document);

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
}
