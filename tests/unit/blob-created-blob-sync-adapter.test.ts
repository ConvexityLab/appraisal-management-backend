import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlobCreatedBlobSyncAdapter } from '../../src/services/vendor-integrations/BlobCreatedBlobSyncAdapter.js';
import type { BlobSyncMessage, BlobSyncAdapterContext } from '../../src/services/vendor-integrations/BlobSyncAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConnection(overrides?: Partial<VendorConnection>): VendorConnection {
  return {
    id: 'conn-002',
    tenantId: 'tenant-abc',
    vendorType: 'blob-client',
    lenderId: 'lender-001',
    lenderName: 'Test Lender',
    inboundIdentifier: 'blob-client',
    credentials: {},
    outboundEndpointUrl: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    blobConfig: {
      storageAccountName: 'clientstorage',
      receivedContainerName: 'drop-zone',
      blobPathPattern: '{year}/{month}/{subClientRef}/{filename}',
      taskType: 'title-search',
      acceptedExtensions: ['.pdf', '.xml'],
      maxRetries: 2,
    },
    ...overrides,
  };
}

function makeBlobCreatedMessage(
  blobUrl: string = 'https://clientstorage.blob.core.windows.net/drop-zone/2026/05/CLT-007/closing.pdf',
  overrides?: Partial<BlobSyncMessage>,
): BlobSyncMessage {
  return {
    vendorType: 'blob-client',
    messageId: 'msg-bc-001',
    flavor: 'blob-created',
    blobUrl,
    eTag: '"etag-abc"',
    ...overrides,
  };
}

function makeContext(blobOverrides?: Record<string, unknown>): BlobSyncAdapterContext {
  return {
    blobClient: {
      listBlobsSince: vi.fn(),
      getBlobInfo: vi.fn().mockResolvedValue({
        name: '2026/05/CLT-007/closing.pdf',
        eTag: '"etag-abc"',
        contentLength: 2048,
        lastModified: new Date('2026-05-10T08:00:00Z'),
      }),
      ...blobOverrides,
    } as unknown as BlobSyncAdapterContext['blobClient'],
    db: {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    } as unknown as BlobSyncAdapterContext['db'],
    outboxService: {
      persistBlobSyncEvents: vi.fn().mockResolvedValue([]),
    } as unknown as BlobSyncAdapterContext['outboxService'],
  };
}

// ─── BlobCreatedBlobSyncAdapter ───────────────────────────────────────────────

describe('BlobCreatedBlobSyncAdapter', () => {
  let adapter: BlobCreatedBlobSyncAdapter;

  beforeEach(() => {
    adapter = new BlobCreatedBlobSyncAdapter();
  });

  describe('canHandle', () => {
    it('returns true for blob-created flavor with blobConfig', () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage();
      expect(adapter.canHandle(msg, conn)).toBe(true);
    });

    it('returns false when connection has no blobConfig', () => {
      const conn = makeConnection({ blobConfig: undefined });
      const msg = makeBlobCreatedMessage();
      expect(adapter.canHandle(msg, conn)).toBe(false);
    });

    it('returns false for data-share-sync flavor', () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(undefined, { flavor: 'data-share-sync' });
      expect(adapter.canHandle(msg, conn)).toBe(false);
    });
  });

  describe('processSync', () => {
    it('happy path: event for matching blob emits a vendor.file.received event', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage();
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.blobsEnumerated).toBe(1);
      expect(result.jobsCreated).toBe(1);
      expect(result.jobsSkipped).toBe(0);

      expect(ctx.outboxService.persistBlobSyncEvents).toHaveBeenCalledOnce();
      const [, events] = (ctx.outboxService.persistBlobSyncEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [VendorConnection, unknown[]];
      const event = events[0] as Record<string, unknown>;
      expect(event['eventType']).toBe('vendor.file.received');
      expect(event['subClientId']).toBe('CLT-007');
      expect(event['taskType']).toBe('title-search');
    });

    it('skips blob when container does not match blobConfig.receivedContainerName', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(
        'https://clientstorage.blob.core.windows.net/wrong-container/2026/05/CLT-007/closing.pdf',
      );
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.blobsEnumerated).toBe(1);
      expect(result.jobsCreated).toBe(0);
      expect(result.jobsSkipped).toBe(1);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('skips blob when extension is not in acceptedExtensions', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(
        'https://clientstorage.blob.core.windows.net/drop-zone/2026/05/CLT-007/data.csv',
      );
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsCreated).toBe(0);
      expect(result.jobsSkipped).toBe(1);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('skips blob when path does not match blobPathPattern', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(
        'https://clientstorage.blob.core.windows.net/drop-zone/unstructured-file.pdf',
      );
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsCreated).toBe(0);
      expect(result.jobsSkipped).toBe(1);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('fetches eTag from storage when missing from message', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(undefined, { eTag: undefined });
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(ctx.blobClient.getBlobInfo).toHaveBeenCalledOnce();
      expect(result.jobsCreated).toBe(1);
    });

    it('skips blob that disappeared (getBlobInfo returns null when eTag missing)', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(undefined, { eTag: undefined });
      const ctx = makeContext({
        getBlobInfo: vi.fn().mockResolvedValue(null),
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsCreated).toBe(0);
      expect(result.jobsSkipped).toBe(1);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('is idempotent: skips already-queued blob on duplicate message', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage();
      const ctx = makeContext();
      (ctx.db.queryItems as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [{ id: 'existing', status: 'queued', retryCount: 0 }],
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsSkipped).toBe(1);
      expect(result.jobsCreated).toBe(0);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('throws if blobUrl is missing', async () => {
      const conn = makeConnection();
      const msg = makeBlobCreatedMessage(undefined, { blobUrl: undefined });
      const ctx = makeContext();

      await expect(adapter.processSync(msg, conn, ctx)).rejects.toThrow(/missing blobUrl/);
    });

    it('throws if connection has no blobConfig', async () => {
      const conn = makeConnection({ blobConfig: undefined });
      const msg = makeBlobCreatedMessage();
      const ctx = makeContext();

      await expect(adapter.processSync(msg, conn, ctx)).rejects.toThrow(/no blobConfig/);
    });
  });
});
