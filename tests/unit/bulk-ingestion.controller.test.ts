import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockSubmit,
  mockListFailures,
  mockExportFailures,
  mockRetryItem,
  mockRetryFailedItems,
  mockPauseJob,
  mockResumeJob,
  mockCancelJob,
} = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockListFailures: vi.fn(),
  mockExportFailures: vi.fn(),
  mockRetryItem: vi.fn(),
  mockRetryFailedItems: vi.fn(),
  mockPauseJob: vi.fn(),
  mockResumeJob: vi.fn(),
  mockCancelJob: vi.fn(),
}));

vi.mock('../../src/services/bulk-ingestion.service.js', () => ({
  BulkIngestionService: vi.fn().mockImplementation(() => ({
    submit: mockSubmit,
    listFailures: mockListFailures,
    exportFailures: mockExportFailures,
    retryItem: mockRetryItem,
    retryFailedItems: mockRetryFailedItems,
    pauseJob: mockPauseJob,
    resumeJob: mockResumeJob,
    cancelJob: mockCancelJob,
  })),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    uploadBlob: vi.fn(),
  })),
}));

import { createBulkIngestionRouter } from '../../src/controllers/bulk-ingestion.controller.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bulk-ingestion', createBulkIngestionRouter({} as any));
  return app;
}

describe('BulkIngestionController retry routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when multipart dataFile is not CSV/XLSX', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/submit')
      .set('x-tenant-id', 'tenant-123')
      .field('clientId', 'client-1')
      .field('adapterKey', 'bridge-standard')
      .field('analysisType', 'QUICK_REVIEW')
      .field('items', JSON.stringify([{ rowIndex: 1, loanNumber: 'LN-1' }]))
      .attach('dataFile', Buffer.from('hello'), {
        filename: 'tape.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('dataFile');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('returns 400 when multipart document is not PDF', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/submit')
      .set('x-tenant-id', 'tenant-123')
      .field('clientId', 'client-1')
      .field('adapterKey', 'bridge-standard')
      .field('analysisType', 'QUICK_REVIEW')
      .field('items', JSON.stringify([{ rowIndex: 1, loanNumber: 'LN-1', documentFileName: 'bad.txt' }]))
      .attach('dataFile', Buffer.from('a,b\n1,2'), {
        filename: 'tape.csv',
        contentType: 'text/csv',
      })
      .attach('documents', Buffer.from('not-pdf'), {
        filename: 'bad.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('document');
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('forwards explicit engagement granularity on JSON submit', async () => {
    mockSubmit.mockResolvedValue({
      id: 'job-1',
      totalItems: 1,
      engagementGranularity: 'PER_LOAN',
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/submit')
      .set('x-tenant-id', 'tenant-123')
      .send({
        clientId: 'client-1',
        adapterKey: 'bridge-standard',
        analysisType: 'AVM',
        ingestionMode: 'SHARED_STORAGE',
        engagementGranularity: 'PER_LOAN',
        dataFileName: 'tape.csv',
        documentFileNames: [],
        items: [{ rowIndex: 1, loanNumber: 'LN-1' }],
        sharedStorage: {
          storageAccountName: 'acct',
          containerName: 'bulk-upload',
          dataFileBlobName: 'tenant/client/adapter/AVM/tape.csv',
          documentBlobNames: [],
        },
      });

    expect(res.status).toBe(202);
    // Auth refactor added a 4th arg (submitterEmail) to submit(). Tests
    // that don't set the email header pass `undefined` for that slot.
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        engagementGranularity: 'PER_LOAN',
      }),
      'tenant-123',
      'unknown',
      undefined,
    );
  });

  it('accepts TAPE_CONVERSION submit without files or sharedStorage', async () => {
    mockSubmit.mockResolvedValue({
      id: 'job-tape-1',
      totalItems: 1,
      ingestionMode: 'TAPE_CONVERSION',
    });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/submit')
      .set('x-tenant-id', 'tenant-123')
      .send({
        clientId: 'client-1',
        adapterKey: 'tape-conversion-v1',
        analysisType: 'FRAUD',
        ingestionMode: 'TAPE_CONVERSION',
        items: [
          {
            rowIndex: 1,
            loanNumber: 'LN-100',
            propertyAddress: '123 Main St',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
          },
        ],
      });

    expect(res.status).toBe(202);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestionMode: 'TAPE_CONVERSION',
        dataFileName: expect.stringMatching(/^tape-conversion-.*\.json$/),
        documentFileNames: [],
      }),
      'tenant-123',
      'unknown',
      undefined,
    );
  });

  it('returns 202 and forwards tenant/user context for item retry', async () => {
    mockRetryItem.mockResolvedValue({ id: 'job-1', status: 'PENDING', failedItems: 0 });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/items/item-7/retry')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(202);
    expect(res.body.message).toBe("Retry request accepted for item 'item-7'");
    expect(mockRetryItem).toHaveBeenCalledWith('job-1', 'item-7', 'tenant-123', 'unknown');
  });

  it('returns CSV failure export for a job', async () => {
    mockExportFailures.mockResolvedValue({
      fileName: 'bulk-ingestion-failures-job-1.csv',
      contentType: 'text/csv; charset=utf-8',
      content: 'jobId,itemId\njob-1,item-1',
    });
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures/export')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.header['content-disposition']).toContain('attachment; filename="bulk-ingestion-failures-job-1.csv"');
    expect(res.text).toContain('jobId,itemId');
    expect(mockExportFailures).toHaveBeenCalledWith('job-1', 'tenant-123', 'csv');
  });

  it('returns XLSX failure export for a job', async () => {
    mockExportFailures.mockResolvedValue({
      fileName: 'bulk-ingestion-failures-job-1.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from('PK-sample-binary'),
    });
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures/export?format=xlsx')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.header['content-disposition']).toContain('attachment; filename="bulk-ingestion-failures-job-1.xlsx"');
    expect(mockExportFailures).toHaveBeenCalledWith('job-1', 'tenant-123', 'xlsx');
  });

  it('returns JSON failures list for a job with query filters', async () => {
    mockListFailures.mockResolvedValue({
      jobId: 'job-1',
      total: 1,
      limit: 25,
      prevCursor: null,
      nextCursor: null,
      hasMore: false,
      sort: 'rowIndex_asc',
      filters: { stage: 'artifact-resolution', retryable: true },
      items: [
        {
          jobId: 'job-1',
          itemId: 'item-1',
          rowIndex: 1,
          itemStatus: 'FAILED',
          failureStage: 'artifact-resolution',
          failureCode: 'DOCUMENT_BLOB_NOT_FOUND',
          failureMessage: 'missing document',
          retryable: true,
          occurredAt: '2026-01-01T00:00:00.000Z',
          loanNumber: 'LN-001',
          externalId: 'EXT-001',
          documentFileName: 'doc1.pdf',
        },
      ],
    });
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures?stage=artifact-resolution&retryable=true&sort=rowIndex_asc&cursor=next-token&limit=25')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].failureCode).toBe('DOCUMENT_BLOB_NOT_FOUND');
    expect(mockListFailures).toHaveBeenCalledWith('job-1', 'tenant-123', {
      stage: 'artifact-resolution',
      retryable: true,
      sort: 'rowIndex_asc',
      cursor: 'next-token',
      limit: 25,
    });
  });

  it('returns 400 for invalid failures list sort value', async () => {
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures?sort=bad_sort')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(400);
    expect(mockListFailures).not.toHaveBeenCalled();
  });

  it('returns 404 when failures list job is not found', async () => {
    mockListFailures.mockRejectedValueOnce(new Error('Bulk ingestion job not found'));
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-missing/failures')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Bulk ingestion job not found');
  });

  it('returns 500 when failures list throws unexpected error', async () => {
    mockListFailures.mockRejectedValueOnce(new Error('boom'));
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list bulk ingestion failures');
  });

  it('returns 400 when failures list cursor is invalid', async () => {
    mockListFailures.mockRejectedValueOnce(new Error('Invalid cursor for bulk ingestion failures listing'));
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures?cursor=invalid-token')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid cursor');
  });

  it('returns 400 for unsupported failures export format', async () => {
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures/export?format=pdf')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(mockExportFailures).not.toHaveBeenCalled();
  });

  it('returns 404 when failures export job is not found', async () => {
    mockExportFailures.mockRejectedValueOnce(new Error('Bulk ingestion job not found'));
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-missing/failures/export')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Bulk ingestion job not found');
  });

  it('returns 500 when failures export throws unexpected error', async () => {
    mockExportFailures.mockRejectedValueOnce(new Error('boom'));
    const app = buildApp();

    const res = await request(app)
      .get('/api/bulk-ingestion/job-1/failures/export')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to export bulk ingestion failures');
  });

  it('returns 404 when retry item target is missing', async () => {
    mockRetryItem.mockRejectedValue(new Error('Bulk ingestion item not found'));
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/items/item-missing/retry')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('returns 409 when item retry is blocked by status or retry policy', async () => {
    mockRetryItem.mockRejectedValue(new Error('Retry for source lookup stage is disabled by policy'));
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/items/item-7/retry')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('disabled by policy');
  });

  it('returns 500 when retry item fails unexpectedly', async () => {
    mockRetryItem.mockRejectedValue(new Error('unexpected failure'));
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/items/item-7/retry')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to retry item');
  });

  it('returns 202 for retry-failed and forwards tenant/user context', async () => {
    mockRetryFailedItems.mockResolvedValue({ id: 'job-1', status: 'PENDING', failedItems: 1 });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/retry-failed')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(202);
    expect(res.body.message).toBe('Retry request accepted for failed items');
    expect(mockRetryFailedItems).toHaveBeenCalledWith('job-1', 'tenant-123', 'unknown');
  });

  it('returns 202 for pause and forwards tenant/user context', async () => {
    mockPauseJob.mockResolvedValue({ id: 'job-1', status: 'PAUSED' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/pause')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(202);
    expect(res.body.message).toBe('Pause request accepted for bulk ingestion job');
    expect(mockPauseJob).toHaveBeenCalledWith('job-1', 'tenant-123', 'unknown');
  });

  it('returns 409 when pause is invalid for current state', async () => {
    mockPauseJob.mockRejectedValue(new Error("Cannot pause job from status 'COMPLETED'. Allowed from: PENDING, PROCESSING"));
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/pause')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Cannot pause');
  });

  it('returns 202 for resume and forwards tenant/user context', async () => {
    mockResumeJob.mockResolvedValue({ id: 'job-1', status: 'PROCESSING' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/resume')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(202);
    expect(res.body.message).toBe('Resume request accepted for bulk ingestion job');
    expect(mockResumeJob).toHaveBeenCalledWith('job-1', 'tenant-123', 'unknown');
  });

  it('returns 202 for cancel and forwards tenant/user context', async () => {
    mockCancelJob.mockResolvedValue({ id: 'job-1', status: 'CANCELLED' });
    const app = buildApp();

    const res = await request(app)
      .post('/api/bulk-ingestion/job-1/cancel')
      .set('x-tenant-id', 'tenant-123');

    expect(res.status).toBe(202);
    expect(res.body.message).toBe('Cancel request accepted for bulk ingestion job');
    expect(mockCancelJob).toHaveBeenCalledWith('job-1', 'tenant-123', 'unknown');
  });
});
