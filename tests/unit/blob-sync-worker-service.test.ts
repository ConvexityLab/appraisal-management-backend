import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlobSyncWorkerService } from '../../src/services/vendor-integrations/BlobSyncWorkerService.js';
import { VendorConnectionConfigurationError } from '../../src/services/vendor-integrations/VendorIntegrationErrors.js';
import type { BlobSyncAdapter } from '../../src/services/vendor-integrations/BlobSyncAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fake ServiceBusReceivedMessage with a stubbed receiver. */
function makeMessageAndReceiver(
  body: Record<string, unknown>,
  applicationProperties: Record<string, unknown> = { vendorType: 'test-vendor' },
) {
  const sbMessage = {
    body,
    applicationProperties,
    messageId: 'sb-msg-001',
  };
  const receiver = {
    deadLetterMessage: vi.fn().mockResolvedValue(undefined),
    abandonMessage: vi.fn().mockResolvedValue(undefined),
    completeMessage: vi.fn().mockResolvedValue(undefined),
  };
  return { sbMessage, receiver };
}

function makeActiveConnection(overrides?: Partial<VendorConnection>): VendorConnection {
  return {
    id: 'conn-001',
    tenantId: 'tenant-abc',
    vendorType: 'test-vendor',
    lenderId: 'lender-001',
    lenderName: 'Test Lender',
    inboundIdentifier: 'test-vendor',
    credentials: {},
    outboundEndpointUrl: '',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    blobConfig: {
      storageAccountName: 'teststorage',
      receivedContainerName: 's3-drop',
      blobPathPattern: '{year}/{month}/{subClientRef}/{filename}',
      taskType: 'appraisal-doc',
      acceptedExtensions: ['.pdf'],
      maxRetries: 3,
    },
    ...overrides,
  };
}

/** Construct a BlobSyncWorkerService with injected test doubles. */
function makeSvc(options?: {
  adapterOverride?: Partial<BlobSyncAdapter>;
  connectionResult?: VendorConnection | 'config-error' | 'transient-error';
}): BlobSyncWorkerService {
  const connSvc = {
    getActiveConnectionByInboundIdentifier: vi.fn(),
  };

  if (options?.connectionResult === 'config-error') {
    connSvc.getActiveConnectionByInboundIdentifier.mockRejectedValue(
      new VendorConnectionConfigurationError('test-vendor', 'no connection'),
    );
  } else if (options?.connectionResult === 'transient-error') {
    connSvc.getActiveConnectionByInboundIdentifier.mockRejectedValue(
      new Error('DB unavailable'),
    );
  } else {
    connSvc.getActiveConnectionByInboundIdentifier.mockResolvedValue(
      options?.connectionResult ?? makeActiveConnection(),
    );
  }

  const defaultAdapter: BlobSyncAdapter = {
    supportedFlavor: 'blob-created',
    canHandle: vi.fn().mockReturnValue(true),
    processSync: vi.fn().mockResolvedValue({
      blobsEnumerated: 1,
      jobsCreated: 1,
      jobsSkipped: 0,
      jobsRequeued: 0,
    }),
    ...options?.adapterOverride,
  };

  return new BlobSyncWorkerService({
    adapters: [defaultAdapter],
    connectionService: connSvc as unknown as import('../../src/services/vendor-integrations/VendorConnectionService.js').VendorConnectionService,
    outboxService: {
      persistBlobSyncEvents: vi.fn().mockResolvedValue([]),
    } as unknown as import('../../src/services/vendor-integrations/VendorEventOutboxService.js').VendorEventOutboxService,
    blobClient: {} as unknown as import('../../src/services/vendor-integrations/VendorBlobStorageClient.js').VendorBlobStorageClient,
    db: {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    } as unknown as import('../../src/services/CosmosDbService.js').CosmosDbService,
  });
}

type PrivateSvc = {
  handleMessage: (
    sbMessage: unknown,
    receiver: unknown,
  ) => Promise<void>;
};

// ─── BlobSyncWorkerService ────────────────────────────────────────────────────

describe('BlobSyncWorkerService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, BLOB_SYNC_SERVICE_BUS_QUEUE: 'blob-sync-events' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('throws if BLOB_SYNC_SERVICE_BUS_QUEUE is not set', () => {
      delete process.env['BLOB_SYNC_SERVICE_BUS_QUEUE'];
      expect(() => new BlobSyncWorkerService()).toThrow(/BLOB_SYNC_SERVICE_BUS_QUEUE/);
    });

    it('constructs without error when env var is present', () => {
      expect(() => makeSvc()).not.toThrow();
    });
  });

  describe('handleMessage', () => {
    it('completes message when adapter succeeds', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: {
          url: 'https://teststorage.blob.core.windows.net/s3-drop/2026/05/CLT-001/doc.pdf',
          eTag: '"abc"',
        },
      });

      const svc = makeSvc();
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.completeMessage).toHaveBeenCalledOnce();
      expect(receiver.abandonMessage).not.toHaveBeenCalled();
      expect(receiver.deadLetterMessage).not.toHaveBeenCalled();
    });

    it('abandons message when adapter throws a transient error', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.DataShare.ShareSubscriptionSynchronizationCompleted',
        data: { synchronizationId: 'run-001', endTime: '2026-05-12T10:00:00Z', status: 'Succeeded' },
      });

      const svc = makeSvc({
        adapterOverride: {
          processSync: vi.fn().mockRejectedValue(new Error('Storage temporarily unavailable')),
        },
      });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.abandonMessage).toHaveBeenCalledOnce();
      expect(receiver.completeMessage).not.toHaveBeenCalled();
      expect(receiver.deadLetterMessage).not.toHaveBeenCalled();
    });

    it('dead-letters message when vendorType is missing from applicationProperties', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver(
        { eventType: 'Microsoft.Storage.BlobCreated' },
        {}, // no vendorType
      );

      const svc = makeSvc();
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.deadLetterMessage).toHaveBeenCalledOnce();
      expect(receiver.completeMessage).not.toHaveBeenCalled();
    });

    it('dead-letters when vendorType resolves to a config error (no connection)', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: { url: 'https://s.blob.core.windows.net/c/p.pdf', eTag: '"x"' },
      });

      const svc = makeSvc({ connectionResult: 'config-error' });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.deadLetterMessage).toHaveBeenCalledOnce();
      expect(receiver.completeMessage).not.toHaveBeenCalled();
    });

    it('abandons when connection lookup throws a transient error', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: { url: 'https://s.blob.core.windows.net/c/p.pdf', eTag: '"x"' },
      });

      const svc = makeSvc({ connectionResult: 'transient-error' });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.abandonMessage).toHaveBeenCalledOnce();
      expect(receiver.deadLetterMessage).not.toHaveBeenCalled();
    });

    it('dead-letters if connection has no blobConfig', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: { url: 'https://s.blob.core.windows.net/c/p.pdf', eTag: '"x"' },
      });

      const svc = makeSvc({ connectionResult: makeActiveConnection({ blobConfig: undefined }) });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.deadLetterMessage).toHaveBeenCalledOnce();
      expect(receiver.completeMessage).not.toHaveBeenCalled();
    });

    it('dead-letters if no adapter can handle the message', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: { url: 'https://s.blob.core.windows.net/c/p.pdf', eTag: '"x"' },
      });

      const svc = makeSvc({
        adapterOverride: { canHandle: vi.fn().mockReturnValue(false) },
      });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect(receiver.deadLetterMessage).toHaveBeenCalledOnce();
    });
  });

  describe('flavor detection via deserializeMessage', () => {
    it('assigns data-share-sync flavor for DataShare event type', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.DataShare.ShareSubscriptionSynchronizationCompleted',
        data: { synchronizationId: 'run-001', endTime: '2026-05-12T10:00:00Z', status: 'Succeeded' },
      });

      let capturedMessage: unknown;
      const svc = makeSvc({
        adapterOverride: {
          canHandle: vi.fn().mockImplementation((msg) => {
            capturedMessage = msg;
            return true;
          }),
        },
      });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect((capturedMessage as { flavor?: string })?.flavor).toBe('data-share-sync');
    });

    it('assigns blob-created flavor for BlobCreated event type', async () => {
      const { sbMessage, receiver } = makeMessageAndReceiver({
        eventType: 'Microsoft.Storage.BlobCreated',
        data: { url: 'https://s.blob.core.windows.net/c/p.pdf', eTag: '"x"' },
      });

      let capturedMessage: unknown;
      const svc = makeSvc({
        adapterOverride: {
          canHandle: vi.fn().mockImplementation((msg) => {
            capturedMessage = msg;
            return true;
          }),
        },
      });
      await (svc as unknown as PrivateSvc).handleMessage(sbMessage, receiver);

      expect((capturedMessage as { flavor?: string })?.flavor).toBe('blob-created');
    });
  });
});
