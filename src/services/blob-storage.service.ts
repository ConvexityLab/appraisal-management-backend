import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential, AzureCliCredential } from '@azure/identity';
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
  private validatedContainers: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize blob service client with Managed Identity
   */
  private initialize(): void {
    try {
      const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
      
      if (!storageAccountName) {
        throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required');
      }

      const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
      const credential = new DefaultAzureCredential();
      this.client = new BlobServiceClient(accountUrl, credential);
      this.logger.info('Blob storage initialized with DefaultAzureCredential', { accountUrl });
    } catch (error) {
      this.logger.error('Failed to initialize blob storage', { error });
      throw error;
    }
  }

  /**
   * Upload blob to Azure Storage
   */
  async uploadBlob(request: BlobUploadRequest): Promise<BlobUploadResult> {
    if (!this.client) {
      throw new Error('Blob storage not initialized - set AZURE_STORAGE_ACCOUNT_NAME');
    }

    try {
      this.logger.info('Starting blob upload', {
        container: request.containerName,
        blobName: request.blobName,
        dataLength: request.data.length,
        contentType: request.contentType,
        hasMetadata: !!request.metadata
      });
      
      // Skip container existence check - containers are provisioned via Bicep
      // Just get the container client directly
      const containerClient = this.client.getContainerClient(request.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(request.blobName);
      
      this.logger.info('Calling blockBlobClient.upload()...');
      
      await blockBlobClient.upload(request.data, request.data.length, {
        blobHTTPHeaders: {
          blobContentType: request.contentType
        },
        ...(request.metadata && { metadata: request.metadata })
      });
      
      this.logger.info('Upload call completed successfully');

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
    } catch (error: any) {
      // Log the full error details before transforming
      this.logger.error('Blob upload error - RAW ERROR DETAILS', {
        blobName: request.blobName,
        container: request.containerName,
        errorType: error?.constructor?.name,
        statusCode: error?.statusCode,
        code: error?.code,
        message: error?.message,
        details: error?.details,
        response: error?.response,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      if (error?.statusCode === 403 || error?.code === 'AuthorizationPermissionMismatch') {
        const account = process.env.AZURE_STORAGE_ACCOUNT_NAME || '<unset>';
        throw new Error(`Blob upload forbidden for container '${request.containerName}' on account '${account}'. RBAC role assignments can take up to 5 minutes to propagate. Wait a few minutes and retry.`);
      }

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
   * Ensure target container exists; never creates infra. Throws with clear guidance if missing.
   */
  private async ensureContainerExists(containerName: string): Promise<ContainerClient> {
    if (!this.client) {
      throw new Error('Blob storage not initialized');
    }

    if (this.validatedContainers.has(containerName)) {
      return this.client.getContainerClient(containerName);
    }

    const containerClient = this.client.getContainerClient(containerName);
    const exists = await containerClient.exists();
    if (!exists) {
      throw new Error(`Storage container '${containerName}' is missing. Provision it via infra (Bicep deployment) and retry.`);
    }

    this.validatedContainers.add(containerName);
    return containerClient;
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
   * Download blob as a readable stream (for proxying downloads via Managed Identity)
   */
  async downloadBlob(containerName: string, blobName: string): Promise<{
    readableStream: NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
  }> {
    if (!this.client) {
      throw new Error('Blob storage not initialized - set AZURE_STORAGE_ACCOUNT_NAME');
    }

    const containerClient = this.client.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const downloadResponse = await blockBlobClient.download(0);

    if (!downloadResponse.readableStreamBody) {
      throw new Error(`Blob '${blobName}' returned no stream body`);
    }

    return {
      readableStream: downloadResponse.readableStreamBody,
      contentType: downloadResponse.contentType || 'application/octet-stream',
      contentLength: downloadResponse.contentLength || 0
    };
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
