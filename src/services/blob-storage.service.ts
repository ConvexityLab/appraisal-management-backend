import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';

export interface BlobUploadResult {
  url: string;
  blobName: string;
  containerName: string;
  uploadedAt: Date;
}

export interface BlobUploadRequest {
  containerName: string;
  blobName: string;
  data: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

/**
 * Azure Blob Storage service for document management
 * Uses Managed Identity for authentication in Azure environments
 */
export class BlobStorageService {
  private client: BlobServiceClient | null = null;
  private logger = new Logger('BlobStorageService');

  constructor() {
    this.initialize();
  }

  /**
   * Initialize blob service client with Managed Identity
   */
  private initialize(): void {
    try {
      const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING; // Fallback for local dev
      
      if (connectionString) {
        // Local development with connection string
        this.client = BlobServiceClient.fromConnectionString(connectionString);
        this.logger.info('Blob storage initialized with connection string (local dev)');
      } else if (storageAccountName) {
        // Production: Use Managed Identity
        const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
        const credential = new DefaultAzureCredential();
        this.client = new BlobServiceClient(accountUrl, credential);
        this.logger.info('Blob storage initialized with Managed Identity', { accountUrl });
      } else {
        this.logger.warn('⚠️  Azure Storage not configured - set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING');
      }
    } catch (error) {
      this.logger.error('Failed to initialize blob storage', { error });
    }
  }

  /**
   * Upload blob to Azure Storage
   */
  async uploadBlob(request: BlobUploadRequest): Promise<BlobUploadResult> {
    if (!this.client) {
      throw new Error('Blob storage not initialized - set AZURE_STORAGE_ACCOUNT_NAME (Managed Identity) or AZURE_STORAGE_CONNECTION_STRING (local dev)');
    }

    try {
      // Get container client (create if doesn't exist)
      const containerClient = this.client.getContainerClient(request.containerName);
      await containerClient.createIfNotExists({
        access: 'blob' // Public read access for documents
      });

      // Get blob client and upload
      const blockBlobClient = containerClient.getBlockBlobClient(request.blobName);
      await blockBlobClient.upload(request.data, request.data.length, {
        blobHTTPHeaders: {
          blobContentType: request.contentType
        },
        ...(request.metadata && { metadata: request.metadata })
      });

      const url = blockBlobClient.url;

      this.logger.info('Blob uploaded successfully', {
        containerName: request.containerName,
        blobName: request.blobName,
        size: request.data.length
      });

      return {
        url,
        blobName: request.blobName,
        containerName: request.containerName,
        uploadedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to upload blob', { error, blobName: request.blobName });
      throw error;
    }
  }

  /**
   * Alias for uploadBlob - for backward compatibility
   */
  async uploadFile(request: BlobUploadRequest): Promise<BlobUploadResult> {
    return this.uploadBlob(request);
  }

  /**
   * Delete blob from Azure Storage
   */
  async deleteBlob(containerName: string, blobName: string): Promise<void> {
    if (!this.client) {
      throw new Error('Blob storage not initialized');
    }

    try {
      const containerClient = this.client.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();

      this.logger.info('Blob deleted successfully', { containerName, blobName });
    } catch (error) {
      this.logger.error('Failed to delete blob', { error, containerName, blobName });
      throw error;
    }
  }

  /**
   * Get blob URL
   */
  getBlobUrl(containerName: string, blobName: string): string {
    if (!this.client) {
      throw new Error('Blob storage not initialized');
    }

    const containerClient = this.client.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  }

  /**
   * Check if blob exists
   */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const containerClient = this.client.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch (error) {
      this.logger.error('Failed to check blob existence', { error, containerName, blobName });
      return false;
    }
  }
}
