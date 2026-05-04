import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentService } from '../../src/services/document.service.js';
import type { DocumentMetadata } from '../../src/types/document.types.js';

describe('DocumentService.associateEntityDocumentsToOrder', () => {
  beforeEach(() => {
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents-test';
    vi.useRealTimers();
  });

  it('links draft-scoped documents to an order while preserving their origin entity linkage', async () => {
    const replace = vi.fn().mockResolvedValue(undefined);
    const queryItems = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'doc-1',
          tenantId: 'tenant-1',
          name: 'Purchase Contract.pdf',
          blobUrl: 'https://blob/doc-1',
          blobName: 'order-intake-draft/draft-123/doc-1.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          category: 'order-contract',
          documentType: 'ORDER_CONTRACT',
          version: 1,
          isLatestVersion: true,
          uploadedBy: 'user-1',
          uploadedAt: new Date('2026-04-30T10:00:00.000Z'),
          entityType: 'order-intake-draft',
          entityId: 'draft-123',
        } satisfies DocumentMetadata,
      ],
    });

    const cosmosService = {
      getContainer: vi.fn().mockReturnValue({
        item: vi.fn().mockReturnValue({ replace }),
      }),
      queryItems,
    };

    const blobService = {
      uploadBlob: vi.fn(),
      deleteBlob: vi.fn(),
    };

    const service = new DocumentService(cosmosService as any, blobService as any);
    const result = await service.associateEntityDocumentsToOrder({
      tenantId: 'tenant-1',
      entityType: 'order-intake-draft',
      entityId: 'draft-123',
      orderId: 'order-789',
      linkedBy: 'user-2',
      linkReason: 'order-intake-submit',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc-1',
        orderId: 'order-789',
        entityType: 'order-intake-draft',
        entityId: 'draft-123',
        orderLinkedBy: 'user-2',
        metadata: expect.objectContaining({
          linkedFromEntityType: 'order-intake-draft',
          linkedFromEntityId: 'draft-123',
          linkedToOrderId: 'order-789',
          linkedToOrderBy: 'user-2',
          linkedToOrderReason: 'order-intake-submit',
        }),
      }),
    );
  });

  it('returns an empty success result when no matching entity-scoped documents exist', async () => {
    const cosmosService = {
      getContainer: vi.fn().mockReturnValue({
        item: vi.fn(),
      }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };

    const service = new DocumentService(cosmosService as any, { uploadBlob: vi.fn(), deleteBlob: vi.fn() } as any);
    const result = await service.associateEntityDocumentsToOrder({
      tenantId: 'tenant-1',
      entityType: 'order-intake-draft',
      entityId: 'draft-empty',
      orderId: 'order-789',
      linkedBy: 'user-2',
    });

    expect(result).toEqual({
      success: true,
      data: [],
    });
  });
});
