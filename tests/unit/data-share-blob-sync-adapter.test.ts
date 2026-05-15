import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataShareBlobSyncAdapter } from '../../src/services/vendor-integrations/DataShareBlobSyncAdapter.js';
import { parseBlobPathTokens } from '../../src/services/vendor-integrations/BlobSyncAdapter.js';
import type { BlobSyncMessage, BlobSyncAdapterContext } from '../../src/services/vendor-integrations/BlobSyncAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConnection(overrides?: Partial<VendorConnection>): VendorConnection {
  return {
    id: 'conn-001',
    tenantId: 'tenant-abc',
    vendorType: 'test-client',
    lenderId: 'lender-001',
    lenderName: 'Test Lender',
    inboundIdentifier: 'test-client',
    credentials: {},
    outboundEndpointUrl: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    blobConfig: {
      storageAccountName: 'teststorage',
      receivedContainerName: 'test-received',
      blobPathPattern: '{year}/{month}/{day}/{subClientRef}/{filename}',
      taskType: 'underwriting-review',
      acceptedExtensions: ['.pdf'],
      maxRetries: 3,
    },
    ...overrides,
  };
}

function makeSyncMessage(overrides?: Partial<BlobSyncMessage>): BlobSyncMessage {
  return {
    vendorType: 'test-client',
    messageId: 'msg-001',
    flavor: 'data-share-sync',
    syncRunId: 'sync-run-abc',
    syncEndTime: '2026-05-12T10:01:00Z',
    syncStatus: 'Succeeded',
    ...overrides,
  };
}

function makeContext(blobOverrides?: Record<string, unknown>): BlobSyncAdapterContext {
  const upsertMock = vi.fn().mockResolvedValue({ success: true, data: {} });
  const queryMock = vi.fn().mockResolvedValue({ success: true, data: [] });

  return {
    blobClient: {
      listBlobsSince: vi.fn().mockImplementation(async function* () {
        yield {
          name: '2026/05/12/ELN-001/appraisal.pdf',
          eTag: '"etag-001"',
          contentLength: 1024,
          lastModified: new Date('2026-05-12T09:00:00Z'),
        };
      }),
      getBlobInfo: vi.fn(),
      ...blobOverrides,
    } as unknown as BlobSyncAdapterContext['blobClient'],
    db: {
      queryItems: queryMock,
      upsertItem: upsertMock,
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    } as unknown as BlobSyncAdapterContext['db'],
    outboxService: {
      persistBlobSyncEvents: vi.fn().mockResolvedValue([]),
    } as unknown as BlobSyncAdapterContext['outboxService'],
  };
}

// ─── parseBlobPathTokens ──────────────────────────────────────────────────────

describe('parseBlobPathTokens', () => {
  it('extracts all tokens from a matching path', () => {
    const tokens = parseBlobPathTokens(
      '2026/05/12/ELN-001/appraisal.pdf',
      '{year}/{month}/{day}/{subClientRef}/{filename}',
    );
    expect(tokens).toEqual({
      year: '2026',
      month: '05',
      day: '12',
      subClientRef: 'ELN-001',
      filename: 'appraisal.pdf',
    });
  });

  it('returns null when path does not match pattern', () => {
    const tokens = parseBlobPathTokens(
      'bad/path',
      '{year}/{month}/{day}/{subClientRef}/{filename}',
    );
    expect(tokens).toBeNull();
  });

  it('handles a pattern with fixed literal segment', () => {
    const tokens = parseBlobPathTokens(
      'submissions/2026/05/12/report.pdf',
      'submissions/{year}/{month}/{day}/{filename}',
    );
    expect(tokens).toEqual({ year: '2026', month: '05', day: '12', filename: 'report.pdf' });
  });
});

// ─── DataShareBlobSyncAdapter ─────────────────────────────────────────────────

describe('DataShareBlobSyncAdapter', () => {
  let adapter: DataShareBlobSyncAdapter;

  beforeEach(() => {
    adapter = new DataShareBlobSyncAdapter();
  });

  describe('canHandle', () => {
    it('returns true for data-share-sync flavor with blobConfig', () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      expect(adapter.canHandle(msg, conn)).toBe(true);
    });

    it('returns false when connection has no blobConfig', () => {
      const conn = makeConnection({ blobConfig: undefined });
      const msg = makeSyncMessage();
      expect(adapter.canHandle(msg, conn)).toBe(false);
    });

    it('returns false for blob-created flavor', () => {
      const conn = makeConnection();
      const msg = makeSyncMessage({ flavor: 'blob-created' });
      expect(adapter.canHandle(msg, conn)).toBe(false);
    });
  });

  describe('processSync', () => {
    it('skips non-succeeded sync events and returns zero counts', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage({ syncStatus: 'Failed' });
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result).toEqual({ blobsEnumerated: 0, jobsCreated: 0, jobsSkipped: 0, jobsRequeued: 0 });
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('throws if syncRunId or syncEndTime is missing', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage({ syncRunId: undefined });
      const ctx = makeContext();

      await expect(adapter.processSync(msg, conn, ctx)).rejects.toThrow(
        /missing syncRunId or syncEndTime/,
      );
    });

    it('throws if connection has no blobConfig', async () => {
      const conn = makeConnection({ blobConfig: undefined });
      const msg = makeSyncMessage();
      const ctx = makeContext();

      await expect(adapter.processSync(msg, conn, ctx)).rejects.toThrow(/no blobConfig/);
    });

    it('processes a new blob: creates intake job, emits event, advances cursor', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      const ctx = makeContext();

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.blobsEnumerated).toBe(1);
      expect(result.jobsCreated).toBe(1);
      expect(result.jobsSkipped).toBe(0);

      // Should have persisted one event
      expect(ctx.outboxService.persistBlobSyncEvents).toHaveBeenCalledOnce();
      const [calledConn, events] = (ctx.outboxService.persistBlobSyncEvents as ReturnType<typeof vi.fn>).mock.calls[0] as [VendorConnection, unknown[]];
      expect(calledConn.id).toBe('conn-001');
      expect(events).toHaveLength(1);
      const event = events[0] as Record<string, unknown>;
      expect(event['eventType']).toBe('vendor.file.received');
      expect(event['subClientId']).toBe('ELN-001');
      expect(event['taskType']).toBe('underwriting-review');
      expect(event['tenantId']).toBe('tenant-abc');
      expect(event['clientId']).toBe('test-client');
    });

    it('skips blobs with non-accepted extensions', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      const ctx = makeContext({
        listBlobsSince: vi.fn().mockImplementation(async function* () {
          yield {
            name: '2026/05/12/ELN-001/data.csv',
            eTag: '"etag-002"',
            lastModified: new Date('2026-05-12T09:00:00Z'),
          };
        }),
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.blobsEnumerated).toBe(1);
      expect(result.jobsCreated).toBe(0);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('skips blobs that do not match the path pattern', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      const ctx = makeContext({
        listBlobsSince: vi.fn().mockImplementation(async function* () {
          yield {
            name: 'unrecognized-path.pdf',
            eTag: '"etag-003"',
            lastModified: new Date('2026-05-12T09:00:00Z'),
          };
        }),
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsCreated).toBe(0);
      expect(ctx.outboxService.persistBlobSyncEvents).not.toHaveBeenCalled();
    });

    it('skips already-queued blobs (idempotent re-delivery)', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      // Simulate existing job in 'queued' status
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

    it('re-queues a failed blob that is within retry limit', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage();
      // Simulate existing job in 'failed' status with retryCount < maxRetries
      let queryCallCount = 0;
      const ctx = makeContext();
      (ctx.db.queryItems as ReturnType<typeof vi.fn>).mockImplementation(() => {
        queryCallCount++;
        if (queryCallCount === 1) {
          // First call: cursor query — return empty (no cursor)
          return Promise.resolve({ success: true, data: [] });
        }
        if (queryCallCount === 2) {
          // Second call: intake job check — return failed job
          return Promise.resolve({
            success: true,
            data: [{ id: 'existing', status: 'failed', retryCount: 1, tenantId: 'tenant-abc', type: 'blob-intake-job' }],
          });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result.jobsRequeued).toBe(1);
      expect(ctx.outboxService.persistBlobSyncEvents).toHaveBeenCalledOnce();
    });

    it('is idempotent when the same syncRunId is replayed', async () => {
      const conn = makeConnection();
      const msg = makeSyncMessage({ syncRunId: 'sync-run-xyz' });
      const ctx = makeContext();
      // Cursor already shows this syncRunId was processed
      (ctx.db.queryItems as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [{ id: 'cursor:conn-001', lastSyncRunId: 'sync-run-xyz', lastSyncCompletedAt: '2026-05-12T10:01:00Z' }],
      });

      const result = await adapter.processSync(msg, conn, ctx);

      expect(result).toEqual({ blobsEnumerated: 0, jobsCreated: 0, jobsSkipped: 0, jobsRequeued: 0 });
      expect(ctx.blobClient.listBlobsSince).not.toHaveBeenCalled();
    });
  });
});
