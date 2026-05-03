import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListDocuments = vi.fn();

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    downloadBlob: vi.fn(),
  })),
}));

vi.mock('../../src/services/document.service.js', () => ({
  DocumentService: vi.fn().mockImplementation(() => ({
    listDocuments: mockListDocuments,
    getDocument: vi.fn(),
    uploadDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    uploadNewVersion: vi.fn(),
    getVersionHistory: vi.fn(),
  })),
}));

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    proxyPipelineStream: vi.fn(),
  })),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({
    getExecutionById: vi.fn(),
  })),
}));

describe('DocumentController list route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'documents-test';
  });

  async function buildApp() {
    const { DocumentController } = await import('../../src/controllers/document.controller.js');
    const controller = new DocumentController({} as any);
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = {
        tenantId: 'tenant-1',
        id: 'user-1',
      };
      next();
    });
    app.use('/api/documents', controller.router);
    return app;
  }

  it('lists draft-scoped documents by entity linkage and maps origin metadata', async () => {
    mockListDocuments.mockResolvedValueOnce({
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
          category: 'ORDER_CONTRACT',
          version: 1,
          uploadedBy: 'user-1',
          uploadedAt: '2026-04-30T10:00:00.000Z',
          updatedAt: '2026-04-30T10:00:00.000Z',
          entityType: 'order-intake-draft',
          entityId: 'draft-123',
          metadata: {
            linkedFromEntityType: 'order-intake-draft',
            linkedFromEntityId: 'draft-123',
          },
        },
      ],
    });

    const app = await buildApp();
    const response = await request(app)
      .get('/api/documents?entityType=order-intake-draft&entityId=draft-123');

    expect(response.status).toBe(200);
    expect(mockListDocuments).toHaveBeenCalledWith('tenant-1', {
      entityType: 'order-intake-draft',
      entityId: 'draft-123',
    });
    expect(response.body.documents).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        entityType: 'order-intake-draft',
        entityId: 'draft-123',
        documentType: 'order-contract',
        fileName: 'Purchase Contract.pdf',
        metadata: expect.objectContaining({
          linkedFromEntityType: 'order-intake-draft',
          linkedFromEntityId: 'draft-123',
        }),
      }),
    ]);
  });

  it('lists reassociated order documents and preserves draft lineage fields in the response', async () => {
    mockListDocuments.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'doc-1',
          tenantId: 'tenant-1',
          orderId: 'order-789',
          name: 'Purchase Contract.pdf',
          blobUrl: 'https://blob/doc-1',
          blobName: 'orders/order-789/doc-1.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          category: 'ORDER_CONTRACT',
          version: 1,
          uploadedBy: 'user-1',
          uploadedAt: '2026-04-30T10:00:00.000Z',
          updatedAt: '2026-04-30T11:00:00.000Z',
          entityType: 'order-intake-draft',
          entityId: 'draft-123',
          orderLinkedAt: '2026-04-30T11:00:00.000Z',
          orderLinkedBy: 'user-2',
          metadata: {
            linkedFromEntityType: 'order-intake-draft',
            linkedFromEntityId: 'draft-123',
            linkedToOrderId: 'order-789',
            linkedToOrderBy: 'user-2',
            linkedToOrderReason: 'order-intake-submit',
          },
        },
      ],
    });

    const app = await buildApp();
    const response = await request(app).get('/api/documents?orderId=order-789');

    expect(response.status).toBe(200);
    expect(mockListDocuments).toHaveBeenCalledWith('tenant-1', {
      orderId: 'order-789',
    });
    expect(response.body.documents).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        orderId: 'order-789',
        entityType: 'order-intake-draft',
        entityId: 'draft-123',
        metadata: expect.objectContaining({
          orderLinkedAt: '2026-04-30T11:00:00.000Z',
          orderLinkedBy: 'user-2',
          linkedToOrderId: 'order-789',
          linkedToOrderReason: 'order-intake-submit',
        }),
      }),
    ]);
  });
});
