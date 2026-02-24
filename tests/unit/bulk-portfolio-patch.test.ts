/**
 * BulkPortfolioService — patchReviewResult() unit tests
 *
 * Coverage:
 *   1. Happy-path mutations (reviewerNotes, overrideDecision, clearing an override)
 *   2. Persistence — the patched result is written back to the job store
 *   3. overrideReason validation — required when overrideDecision is non-null
 *   4. Error cases — job not found, wrong processing mode, loan not found
 */

import { describe, it, expect } from 'vitest';
import { BulkPortfolioService } from '../../src/services/bulk-portfolio.service.js';
import type { BulkPortfolioJob } from '../../src/types/bulk-portfolio.types.js';
import type { ReviewTapeResult } from '../../src/types/review-tape.types.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<ReviewTapeResult> = {}): ReviewTapeResult {
  return {
    rowIndex: 0,
    loanNumber: 'LN-001',
    loanAmount: 200_000,
    appraisedValue: 250_000,
    firstLienBalance: 200_000,
    overallRiskScore: 0,
    computedDecision: 'Accept',
    autoFlagResults: [],
    manualFlagResults: [],
    dataQualityIssues: [],
    evaluatedAt: '2026-01-01T00:00:00.000Z',
    programId: 'vision-appraisal-v1.0',
    programVersion: '1.0',
    ...overrides,
  };
}

function makeJob(overrides: Partial<BulkPortfolioJob> = {}): BulkPortfolioJob {
  return {
    id: 'job-001',
    tenantId: 'tenant-001',
    clientId: 'client-001',
    fileName: 'tape.xlsx',
    status: 'COMPLETED',
    processingMode: 'TAPE_EVALUATION',
    submittedAt: '2026-01-01T00:00:00.000Z',
    submittedBy: 'user-001',
    totalRows: 1,
    successCount: 1,
    failCount: 0,
    skippedCount: 0,
    items: [makeResult()],
    ...overrides,
  };
}

/**
 * Returns a minimal CosmosDbService double backed by an in-memory job store.
 * The store array is mutated by upsert() so callers can inspect saved state.
 */
function makeDbService(initialJobs: BulkPortfolioJob[]): {
  db: CosmosDbService;
  store: BulkPortfolioJob[];
} {
  const store: BulkPortfolioJob[] = [...initialJobs];

  const container = {
    items: {
      query: () => ({
        fetchAll: async () => ({ resources: [...store] }),
      }),
      upsert: async (job: BulkPortfolioJob) => {
        const idx = store.findIndex(j => j.id === job.id);
        if (idx >= 0) {
          store[idx] = job;
        } else {
          store.push(job);
        }
        return { resource: job };
      },
    },
  };

  const db = {
    getBulkPortfolioJobsContainer: () => container,
  } as unknown as CosmosDbService;

  return { db, store };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BulkPortfolioService.patchReviewResult()', () => {
  function makeService(jobs: BulkPortfolioJob[]) {
    const { db, store } = makeDbService(jobs);
    return { service: new BulkPortfolioService(db), store };
  }

  // ── 1. Happy-path mutations ────────────────────────────────────────────────

  it('sets reviewerNotes on the returned result', async () => {
    const { service } = makeService([makeJob()]);
    const result = await service.patchReviewResult(
      'job-001', 'LN-001',
      { reviewerNotes: 'Looks acceptable' },
      'tenant-001', 'reviewer-1',
    );
    expect(result.reviewerNotes).toBe('Looks acceptable');
  });

  it('sets overrideDecision, overrideReason, overriddenAt, overriddenBy', async () => {
    const { service } = makeService([makeJob()]);
    const before = new Date();

    const result = await service.patchReviewResult(
      'job-001', 'LN-001',
      { overrideDecision: 'Accept', overrideReason: 'Manually reviewed — risk is acceptable' },
      'tenant-001', 'reviewer-1',
    );

    const after = new Date();
    expect(result.overrideDecision).toBe('Accept');
    expect(result.overrideReason).toBe('Manually reviewed — risk is acceptable');
    expect(result.overriddenBy).toBe('reviewer-1');
    expect(new Date(result.overriddenAt!).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(new Date(result.overriddenAt!).getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('clears all override fields when overrideDecision is null', async () => {
    const jobWithOverride = makeJob({
      items: [makeResult({
        overrideDecision: 'Reject',
        overrideReason: 'High fraud risk',
        overriddenAt: '2026-01-01T00:00:00.000Z',
        overriddenBy: 'reviewer-0',
      })],
    });
    const { service } = makeService([jobWithOverride]);

    const result = await service.patchReviewResult(
      'job-001', 'LN-001',
      { overrideDecision: null },
      'tenant-001', 'reviewer-1',
    );

    expect(result.overrideDecision).toBeUndefined();
    expect(result.overrideReason).toBeUndefined();
    expect(result.overriddenAt).toBeUndefined();
    expect(result.overriddenBy).toBeUndefined();
  });

  it('leaves computedDecision unchanged when only reviewerNotes is patched', async () => {
    const { service } = makeService([makeJob()]);
    const result = await service.patchReviewResult(
      'job-001', 'LN-001',
      { reviewerNotes: 'Nothing changed' },
      'tenant-001', 'reviewer-1',
    );
    expect(result.computedDecision).toBe('Accept');
    expect(result.overrideDecision).toBeUndefined();
  });

  // ── 2. Persistence ──────────────────────────────────────────────────────────

  it('writes the patched result back to the in-memory store', async () => {
    const { service, store } = makeService([makeJob()]);
    await service.patchReviewResult(
      'job-001', 'LN-001',
      { overrideDecision: 'Reject', overrideReason: 'Confirmed fraud indicators' },
      'tenant-001', 'reviewer-1',
    );
    const saved = (store[0]!.items as ReviewTapeResult[])[0]!;
    expect(saved.overrideDecision).toBe('Reject');
    expect(saved.overrideReason).toBe('Confirmed fraud indicators');
  });

  // ── 3. overrideReason validation ────────────────────────────────────────────

  it('throws when overrideDecision is set but overrideReason is absent', async () => {
    const { service } = makeService([makeJob()]);
    await expect(
      service.patchReviewResult(
        'job-001', 'LN-001',
        { overrideDecision: 'Accept' },
        'tenant-001', 'reviewer-1',
      ),
    ).rejects.toThrow('overrideReason is required');
  });

  it('throws when overrideDecision is set but overrideReason is whitespace-only', async () => {
    const { service } = makeService([makeJob()]);
    await expect(
      service.patchReviewResult(
        'job-001', 'LN-001',
        { overrideDecision: 'Accept', overrideReason: '   ' },
        'tenant-001', 'reviewer-1',
      ),
    ).rejects.toThrow('overrideReason is required');
  });

  it('does NOT require overrideReason when clearing the override (overrideDecision: null)', async () => {
    const jobWithOverride = makeJob({
      items: [makeResult({ overrideDecision: 'Reject', overrideReason: 'Old', overriddenAt: '2026-01-01T00:00:00.000Z', overriddenBy: 'u' })],
    });
    const { service } = makeService([jobWithOverride]);
    await expect(
      service.patchReviewResult('job-001', 'LN-001', { overrideDecision: null }, 'tenant-001', 'reviewer-1'),
    ).resolves.not.toThrow();
  });

  // ── 4. Error cases ──────────────────────────────────────────────────────────

  it('throws when the job is not found', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchReviewResult('missing-job', 'LN-001', { reviewerNotes: 'x' }, 'tenant-001', 'reviewer-1'),
    ).rejects.toThrow("Job 'missing-job' not found");
  });

  it('throws when the job is not a tape evaluation job', async () => {
    const orderJob = makeJob({ processingMode: 'ORDER_CREATION' });
    const { service } = makeService([orderJob]);
    await expect(
      service.patchReviewResult('job-001', 'LN-001', { reviewerNotes: 'x' }, 'tenant-001', 'reviewer-1'),
    ).rejects.toThrow('not a tape evaluation job');
  });

  it('throws when the loan number is not present in the job', async () => {
    const { service } = makeService([makeJob()]);
    await expect(
      service.patchReviewResult('job-001', 'WRONG-LOAN', { reviewerNotes: 'x' }, 'tenant-001', 'reviewer-1'),
    ).rejects.toThrow("Loan 'WRONG-LOAN' not found");
  });
});
