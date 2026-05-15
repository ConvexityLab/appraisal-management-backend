import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

const mockDocumentService = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  uploadNewVersion: vi.fn(),
  getVersionHistory: vi.fn(),
  uploadDocument: vi.fn(),
}));

const mockAxiomService = vi.hoisted(() => ({
  proxyPipelineStream: vi.fn(),
  getEvaluationById: vi.fn(),
}));

const mockAxiomExecutionService = vi.hoisted(() => ({
  getExecutionById: vi.fn(),
  getExecutionByAxiomJobId: vi.fn(),
}));

vi.hoisted(() => {
  process.env.STORAGE_CONTAINER_DOCUMENTS = 'test-documents';
});

vi.mock('../src/services/blob-storage.service', () => ({
  BlobStorageService: class BlobStorageService {
    async downloadBlob() {
      return {
        readableStream: undefined,
        contentType: 'application/pdf',
        contentLength: 0,
      };
    }
  },
}));

vi.mock('../src/services/document.service', () => ({
  DocumentService: class DocumentService {
    async listDocuments(...args: unknown[]) {
      return mockDocumentService.listDocuments(...args);
    }
    async getDocument(...args: unknown[]) {
      return mockDocumentService.getDocument(...args);
    }
    async updateDocument(...args: unknown[]) {
      return mockDocumentService.updateDocument(...args);
    }
    async deleteDocument(...args: unknown[]) {
      return mockDocumentService.deleteDocument(...args);
    }
    async uploadNewVersion(...args: unknown[]) {
      return mockDocumentService.uploadNewVersion(...args);
    }
    async getVersionHistory(...args: unknown[]) {
      return mockDocumentService.getVersionHistory(...args);
    }
    async uploadDocument(...args: unknown[]) {
      return mockDocumentService.uploadDocument(...args);
    }
  },
}));

vi.mock('../src/services/axiom.service', () => ({
  AxiomService: class AxiomService {
    async proxyPipelineStream(...args: unknown[]) {
      return mockAxiomService.proxyPipelineStream(...args);
    }
    async getEvaluationById(...args: unknown[]) {
      return mockAxiomService.getEvaluationById(...args);
    }
  },
}));

vi.mock('../src/services/axiom-execution.service', () => ({
  AxiomExecutionService: class AxiomExecutionService {
    async getExecutionById(...args: unknown[]) {
      return mockAxiomExecutionService.getExecutionById(...args);
    }
    async getExecutionByAxiomJobId(...args: unknown[]) {
      return mockAxiomExecutionService.getExecutionByAxiomJobId(...args);
    }
  },
}));

import { DocumentController } from '../src/controllers/document.controller';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware';

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    tenantId: 'tenant-a',
    name: 'report.pdf',
    blobName: 'order-1/report.pdf',
    blobUrl: 'https://example.invalid/report.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    uploadedBy: 'user-1',
    uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exec-1',
    tenantId: 'tenant-a',
    orderId: 'order-1',
    documentIds: ['doc-1'],
    axiomJobId: 'job-1',
    ...overrides,
  };
}

function resetDocumentServiceMocks() {
  mockDocumentService.listDocuments.mockReset();
  mockDocumentService.getDocument.mockReset();
  mockDocumentService.updateDocument.mockReset();
  mockDocumentService.deleteDocument.mockReset();
  mockDocumentService.uploadNewVersion.mockReset();
  mockDocumentService.getVersionHistory.mockReset();
  mockDocumentService.uploadDocument.mockReset();

  mockDocumentService.listDocuments.mockResolvedValue({ success: true, data: [makeDocument()] });
  mockDocumentService.getDocument.mockResolvedValue({ success: true, data: makeDocument() });
  mockDocumentService.updateDocument.mockResolvedValue({ success: true, data: makeDocument() });
  mockDocumentService.deleteDocument.mockResolvedValue({ success: true });
  mockDocumentService.uploadNewVersion.mockResolvedValue({ success: true, data: makeDocument({ id: 'doc-2' }) });
  mockDocumentService.getVersionHistory.mockResolvedValue({ success: true, data: [makeDocument()] });
  mockDocumentService.uploadDocument.mockResolvedValue({ success: true, data: makeDocument() });

  mockAxiomService.proxyPipelineStream.mockReset();
  mockAxiomService.proxyPipelineStream.mockImplementation(async (_jobId: unknown, _req: unknown, res: Response) => {
    res.status(200).end();
  });
  mockAxiomService.getEvaluationById.mockReset();
  mockAxiomService.getEvaluationById.mockResolvedValue(null);

  mockAxiomExecutionService.getExecutionById.mockReset();
  mockAxiomExecutionService.getExecutionById.mockResolvedValue({ success: true, data: makeExecution() });
  mockAxiomExecutionService.getExecutionByAxiomJobId.mockReset();
  mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
}

function makeAuthzStub(overrides?: {
  authorize?: () => any;
  authorizeQuery?: () => any;
  authorizeResource?: () => any;
}) {
  return {
    loadUserProfile: () => async (req: any, _res: Response, next: NextFunction) => {
      req.userProfile = {
        id: req.user.id,
        email: req.user.email,
        role: 'manager',
        tenantId: req.user.tenantId,
      };
      next();
    },
    authorize:
      overrides?.authorize ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
    authorizeQuery:
      overrides?.authorizeQuery ??
      (() => async (req: any, _res: Response, next: NextFunction) => {
        req.authorizationFilter = {
          sql: 'c.orderId = @orderId',
          parameters: [{ name: '@orderId', value: 'order-1' }],
        };
        next();
      }),
    authorizeResource:
      overrides?.authorizeResource ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
  } satisfies Partial<AuthorizationMiddleware>;
}

function makeApp(authzMiddleware?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      name: 'User One',
    };
    next();
  });

  const controller = new DocumentController({
    getDocument: vi.fn(),
    findOrderById: vi.fn().mockResolvedValue({ success: false, data: null }),
    queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
  } as any, authzMiddleware as AuthorizationMiddleware | undefined);
  app.use('/api/documents', controller.router);
  return app;
}

describe('DocumentController authorization', () => {
  beforeEach(() => {
    resetDocumentServiceMocks();
  });

  it('passes authorizationFilter into document list queries', async () => {
    const app = makeApp(makeAuthzStub());

    const res = await request(app).get('/api/documents').query({ orderId: 'order-1' });

    expect(res.status).toBe(200);
    expect(mockDocumentService.listDocuments).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ orderId: 'order-1' }),
      expect.objectContaining({ sql: 'c.orderId = @orderId' }),
    );
  });

  it('blocks document reads when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app).get('/api/documents/doc-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockDocumentService.getDocument).not.toHaveBeenCalled();
  });

  it('blocks document updates when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app)
      .put('/api/documents/doc-1')
      .send({ name: 'updated.pdf' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockDocumentService.updateDocument).not.toHaveBeenCalled();
  });

  it('blocks document deletes when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app).delete('/api/documents/doc-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockDocumentService.deleteDocument).not.toHaveBeenCalled();
  });

  it('blocks document streams when authorizeResource denies parent order access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app).get('/api/documents/stream/exec-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockAxiomService.proxyPipelineStream).not.toHaveBeenCalled();
  });

  it('resolves raw axiom job IDs before streaming document executions', async () => {
    mockAxiomExecutionService.getExecutionById.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValueOnce({
      success: true,
      data: makeExecution({ id: 'exec-2', axiomJobId: 'job-raw' }),
    });

    const app = makeApp(makeAuthzStub());
    const res = await request(app).get('/api/documents/stream/job-raw');

    expect(res.status).toBe(200);
    expect(mockAxiomExecutionService.getExecutionById).toHaveBeenCalledWith('job-raw');
    expect(mockAxiomExecutionService.getExecutionByAxiomJobId).toHaveBeenCalledWith('job-raw');
    expect(mockAxiomService.proxyPipelineStream).toHaveBeenCalledWith('job-raw', expect.anything(), expect.anything());
  });

  it('returns 404 when a document execution cannot be resolved for streaming', async () => {
    mockAxiomExecutionService.getExecutionById.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });

    const app = makeApp(makeAuthzStub());
    const res = await request(app).get('/api/documents/stream/missing-exec');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXECUTION_NOT_FOUND');
    expect(mockAxiomService.proxyPipelineStream).not.toHaveBeenCalled();
  });

  it('falls back to evaluation records when a document stream is opened with an evaluation ID', async () => {
    mockAxiomExecutionService.getExecutionById.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomService.getEvaluationById.mockResolvedValueOnce({
      evaluationId: 'eval-1',
      orderId: 'order-1',
      tenantId: 'tenant-a',
      pipelineJobId: 'job-from-eval',
      documentType: 'appraisal',
      status: 'pending',
      criteria: [],
      overallRiskScore: 0,
      timestamp: new Date().toISOString(),
      _metadata: { documentId: 'doc-1' },
    });

    const app = makeApp(makeAuthzStub());
    const res = await request(app).get('/api/documents/stream/eval-1');

    expect(res.status).toBe(200);
    expect(mockAxiomService.proxyPipelineStream).toHaveBeenCalledWith('job-from-eval', expect.anything(), expect.anything());
  });

  it('falls back to order-linked pipeline IDs when no execution record exists', async () => {
    mockAxiomExecutionService.getExecutionById.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });
    mockAxiomExecutionService.getExecutionByAxiomJobId.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND' } });

    const app = express();
    app.use(express.json());
    app.use((req: any, _res: Response, next: NextFunction) => {
      req.user = {
        id: 'user-1',
        tenantId: 'tenant-a',
        email: 'u@example.com',
        name: 'User One',
      };
      next();
    });

    const controller = new DocumentController({
      getDocument: vi.fn(),
      findOrderById: vi.fn().mockResolvedValue({ success: true, data: { id: 'order-1', tenantId: 'tenant-a', axiomPipelineJobId: 'job-from-order' } }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
    } as any, makeAuthzStub() as AuthorizationMiddleware);
    app.use('/api/documents', controller.router);

    const res = await request(app).get('/api/documents/stream/order-1');

    expect(res.status).toBe(200);
    expect(mockAxiomService.proxyPipelineStream).toHaveBeenCalledWith('job-from-order', expect.anything(), expect.anything());
  });
});
