/**
 * VendorBlobStorageClient
 *
 * Thin, Managed-Identity-authenticated wrapper around @azure/storage-blob.
 * All access uses DefaultAzureCredential — no connection strings, no keys.
 *
 * Clients are lazily created and cached per storage account name so the
 * process does not open more connections than necessary when serving multiple
 * blob-drop clients whose files land in different storage accounts.
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../../utils/logger.js';

export interface BlobItemInfo {
  /** Blob name (full path within the container) */
  name: string;
  eTag: string;
  contentLength?: number;
  lastModified: Date;
}

export class VendorBlobStorageClient {
  private readonly logger = new Logger('VendorBlobStorageClient');
  private readonly serviceClients = new Map<string, BlobServiceClient>();
  private readonly credential = new DefaultAzureCredential();

  // ─── BlobServiceClient cache ─────────────────────────────────────────────

  private getServiceClient(storageAccountName: string): BlobServiceClient {
    const existing = this.serviceClients.get(storageAccountName);
    if (existing) return existing;

    const url = `https://${storageAccountName}.blob.core.windows.net`;
    this.logger.info('Creating BlobServiceClient', { storageAccountName, url });
    const client = new BlobServiceClient(url, this.credential);
    this.serviceClients.set(storageAccountName, client);
    return client;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  getContainerClient(storageAccountName: string, containerName: string): ContainerClient {
    return this.getServiceClient(storageAccountName).getContainerClient(containerName);
  }

  /**
   * Async generator that yields all blobs in a container whose lastModified
   * timestamp is strictly after `sinceDate`. Pass `null` to enumerate all blobs.
   *
   * Uses flat listing (no virtual directory hierarchy) — the full blob path
   * including any "/" separators is the blob name.
   */
  async *listBlobsSince(
    storageAccountName: string,
    containerName: string,
    sinceDate: Date | null,
  ): AsyncGenerator<BlobItemInfo> {
    const container = this.getContainerClient(storageAccountName, containerName);

    for await (const blob of container.listBlobsFlat()) {
      const lastModified = blob.properties.lastModified;
      if (!lastModified) continue;
      if (sinceDate !== null && lastModified <= sinceDate) continue;

      yield {
        name: blob.name,
        eTag: blob.properties.etag ?? '',
        ...(blob.properties.contentLength !== undefined ? { contentLength: blob.properties.contentLength } : {}),
        lastModified,
      };
    }
  }

  /**
   * Fetches metadata for a single blob by its full path.
   * Returns null if the blob does not exist.
   */
  async getBlobInfo(
    storageAccountName: string,
    containerName: string,
    blobPath: string,
  ): Promise<BlobItemInfo | null> {
    const container = this.getContainerClient(storageAccountName, containerName);
    const blobClient = container.getBlobClient(blobPath);

    try {
      const props = await blobClient.getProperties();
      return {
        name: blobPath,
        eTag: props.etag ?? '',
        ...(props.contentLength !== undefined ? { contentLength: props.contentLength } : {}),
        lastModified: props.lastModified ?? new Date(),
      };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return null;
      throw err;
    }
  }
}
