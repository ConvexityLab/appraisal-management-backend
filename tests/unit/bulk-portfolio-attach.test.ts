/**
 * BulkPortfolioService.attachDocumentsToJob() — unit tests
 *
 * Coverage:
 *   1. Happy path — file whose stem matches a CREATED row's loan number
 *   2. Unmatched filename → status 'no-order', never counted as a failure
 *   3. Case-insensitive stem matching (mirrors backend lowercase comparison)
 *   4. Mixed batch — some matched, some unmatched
 *   5. Job not found → throws
 *   6. Wrong job type (TAPE_EVALUATION) → throws
 *   7. DocumentService.uploadDocument() failure → status 'error', counted as failed
 *   8. FAILED / non-CREATED rows are excluded from the loan→order map
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkPortfolioService } from '../../src/services/bulk-portfolio.service.js';
import type { BulkPortfolioJob, BulkPortfolioItem } from '../../src/types/bulk-portfolio.types.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';

// ─── Module mocks ─────────────────────────────────────────────────────────────
// vi.mock() is hoisted above all imports, so we must use vi.hoisted() to create
// the mock fn reference BEFORE the factory closure executes — otherwise the
// closure captures `undefined` and the spy in beforeEach is a different object.

const { mockUploadDocument } = vi.hoisted(() => ({
  mockUploadDocument: vi.fn(),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/document.service.js', () => ({
  DocumentService: vi.fn().mockImplementation(() => ({
    uploadDocument: mockUploadDocument,
  })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<BulkPortfolioItem> = {}): BulkPortfolioItem {
  return {
    rowIndex: 0,
    analysisType: 'AVM',
    propertyAddress: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    borrowerFirstName: 'Jane',
    borrowerLastName: 'Smith',
    loanNumber: 'LN-001',
    orderId: 'order-001',
    status: 'CREATED',
    ...overrides,
  };
}

function makeJob(overrides: Partial<BulkPortfolioJob> = {}): BulkPortfolioJob {
  return {
    id: 'job-001',
    tenantId: 'tenant-001',
    clientId: 'client-001',
    fileName: 'batch.xlsx',
    status: 'COMPLETED',
    submittedAt: '2026-01-01T00:00:00.000Z',
    submittedBy: 'user-001',
    totalRows: 1,
    successCount: 1,
    failCount: 0,
    skippedCount: 0,
    items: [makeItem()],
    ...overrides,
  };
}

/**
 * Minimal CosmosDbService double: exposes only what `getJob()` needs
 * (getBulkPortfolioJobsContainer → items.query().fetchAll()).
 */
function makeDbService(initialJobs: BulkPortfolioJob[]): CosmosDbService {
  const store = [...initialJobs];
  const container = {
    items: {
      query: () => ({
        fetchAll: async () => ({ resources: [...store] }),
      }),
      upsert: async (job: BulkPortfolioJob) => {
        const idx = store.findIndex((j) => j.id === job.id);
        if (idx >= 0) store[idx] = job; else store.push(job);
        return { resource: job };
      },
    },
  };
  return {
    getBulkPortfolioJobsContainer: () => container,
  } as unknown as CosmosDbService;
}

function makeFile(
  loanNumber: string,
  ext = 'pdf',
): { buffer: Buffer; originalname: string; mimetype: string; size: number } {
  return {
    buffer: Buffer.from(`pdf-content-${loanNumber}`),
    originalname: `${loanNumber}.${ext}`,
    mimetype: 'application/pdf',
    size: 100,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BulkPortfolioService.attachDocumentsToJob()', () => {
  function makeService(jobs: BulkPortfolioJob[]) {
    return new BulkPortfolioService(makeDbService(jobs));
  }

  beforeEach(() => {
    process.env.AXIOM_API_BASE_URL = 'https://axiom.example';
    process.env.AXIOM_AUTH_AUDIENCE = 'api://3bc96929-593c-4f35-8997-e341a7e09a69';
    mockUploadDocument.mockReset();
    mockUploadDocument.mockResolvedValue({ success: true, data: { id: 'doc-001' } });
  });

  // ── 1. Happy path ────────────────────────────────────────────────────────────

  it('uploads a file whose stem matches a CREATED row loan number', async () => {
    const service = makeService([makeJob()]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('LN-001')],
      'user-001',
    );

    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.noOrder).toBe(0);
    expect(result.results[0]).toMatchObject({
      filename: 'LN-001.pdf',
      loanNumber: 'LN-001',
      orderId: 'order-001',
      status: 'uploaded',
    });
    expect(mockUploadDocument).toHaveBeenCalledOnce();
    expect(mockUploadDocument).toHaveBeenCalledWith(
      'order-001',
      'tenant-001',
      expect.objectContaining({ originalname: 'LN-001.pdf' }),
      'user-001',
      'appraisal-report',
      ['bulk-upload', 'scenario-bc'],
      expect.objectContaining({ source: 'bulk-attach', jobId: 'job-001' }),
    );
  });

  // ── 2. Unmatched filename ────────────────────────────────────────────────────

  it('records no-order (not failure) for a stem with no matching loan number', async () => {
    const service = makeService([makeJob()]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('UNKNOWN-LOAN')],
      'user-001',
    );

    expect(result.uploaded).toBe(0);
    expect(result.noOrder).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0]).toMatchObject({
      filename: 'UNKNOWN-LOAN.pdf',
      loanNumber: 'UNKNOWN-LOAN',
      orderId: null,
      status: 'no-order',
    });
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });

  // ── 3. Case-insensitive matching ─────────────────────────────────────────────

  it('matches stems to loan numbers case-insensitively (lowercase stem vs uppercase loan)', async () => {
    const service = makeService([makeJob({ items: [makeItem({ loanNumber: 'LN-001' })] })]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('ln-001')],   // lowercase stem, loan stored as uppercase
      'user-001',
    );

    expect(result.uploaded).toBe(1);
    expect(result.noOrder).toBe(0);
  });

  it('matches stems to loan numbers case-insensitively (uppercase stem vs lowercase loan)', async () => {
    const service = makeService([makeJob({ items: [makeItem({ loanNumber: 'ln-001' })] })]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('LN-001')],
      'user-001',
    );

    expect(result.uploaded).toBe(1);
    expect(result.noOrder).toBe(0);
  });

  // ── 4. Mixed batch ───────────────────────────────────────────────────────────

  it('correctly counts matched, unmatched, and total across a mixed file batch', async () => {
    const job = makeJob({
      items: [
        makeItem({ rowIndex: 0, loanNumber: 'LN-001', orderId: 'order-001' }),
        makeItem({ rowIndex: 1, loanNumber: 'LN-002', orderId: 'order-002' }),
      ],
      totalRows: 2,
      successCount: 2,
    });
    const service = makeService([job]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('LN-001'), makeFile('LN-002'), makeFile('LN-999')],
      'user-001',
    );

    expect(result.uploaded).toBe(2);
    expect(result.noOrder).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(3);
    expect(mockUploadDocument).toHaveBeenCalledTimes(2);
  });

  // ── 5. Job not found ─────────────────────────────────────────────────────────

  it('throws when the job is not found', async () => {
    const service = makeService([]);

    await expect(
      service.attachDocumentsToJob('missing-job', 'tenant-001', [makeFile('LN-001')], 'user-001'),
    ).rejects.toThrow('missing-job');
  });

  // ── 6. Wrong job type ────────────────────────────────────────────────────────

  it('throws when the job is a TAPE_EVALUATION job (not ORDER_CREATION)', async () => {
    const tapeJob = makeJob({ processingMode: 'TAPE_EVALUATION' });
    const service = makeService([tapeJob]);

    await expect(
      service.attachDocumentsToJob('job-001', 'tenant-001', [makeFile('LN-001')], 'user-001'),
    ).rejects.toThrow('ORDER_CREATION');
  });

  // ── 7. DocumentService failure ───────────────────────────────────────────────

  it('records error status when uploadDocument returns success: false', async () => {
    mockUploadDocument.mockResolvedValue({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Blob quota exceeded', timestamp: new Date() },
    });
    const service = makeService([makeJob()]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('LN-001')],
      'user-001',
    );

    expect(result.uploaded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: 'error',
      error: 'Blob quota exceeded',
    });
  });

  // ── 8. Non-CREATED rows excluded from loan→order map ────────────────────────

  it('treats FAILED rows as unmatched because they have no orderId in the map', async () => {
    const job = makeJob({
      items: [
        makeItem({ loanNumber: 'LN-FAILED', orderId: undefined, status: 'FAILED' }),
      ],
    });
    const service = makeService([job]);

    const result = await service.attachDocumentsToJob(
      'job-001', 'tenant-001',
      [makeFile('LN-FAILED')],
      'user-001',
    );

    // FAILED rows never go into the loan→order map, so the file has no matching order
    expect(result.noOrder).toBe(1);
    expect(result.uploaded).toBe(0);
    expect(mockUploadDocument).not.toHaveBeenCalled();
  });
});
