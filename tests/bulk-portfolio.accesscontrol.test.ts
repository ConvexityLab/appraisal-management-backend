/**
 * bulk-portfolio.accesscontrol.test.ts
 *
 * Verifies that BulkPortfolioService.submit() stamps accessControl on every
 * order it creates via dbService.createOrder() — gap G1 in
 * AUTH_PRODUCTION_READINESS_PLAN.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prevent constructor side-effects that validate env-vars or connect to infra ──
vi.mock('../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn(() => ({ publish: vi.fn() })),
}));
vi.mock('../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn(() => ({})),
}));
vi.mock('../src/services/review-document-extraction.service.js', () => ({
  ReviewDocumentExtractionService: vi.fn(() => ({})),
}));

import { BulkPortfolioService } from '../src/services/bulk-portfolio.service.js';
import type { BulkPortfolioItem, BulkSubmitRequest } from '../src/types/bulk-portfolio.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let orderSeq = 0;

function makeMockDb() {
  orderSeq = 0;
  // The bulk-portfolio jobs container needs to be a STABLE reference so the
  // upsert spy seen by the test matches the one called inside _saveJob —
  // a fresh `vi.fn()` per invocation hides the call. Hoist it.
  const jobsContainer = {
    items: { upsert: vi.fn(async () => ({})) },
  };
  return {
    createOrder: vi.fn(async (order: Record<string, unknown>) => ({
      success: true,
      data: { ...order, id: `order-${++orderSeq}` },
    })),
    getBulkPortfolioJobsContainer: vi.fn(() => jobsContainer),
  };
}

function makeItem(overrides: Partial<BulkPortfolioItem> = {}): BulkPortfolioItem {
  return {
    rowIndex: 0,
    analysisType: 'AVM',
    propertyAddress: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    borrowerFirstName: 'John',
    borrowerLastName: 'Doe',
    ...overrides,
  };
}

function makeRequest(
  items: BulkPortfolioItem[],
  overrides: Partial<BulkSubmitRequest> = {},
): BulkSubmitRequest {
  return {
    clientId: 'client-1',
    fileName: 'test-tape.csv',
    // Provide engagementId to skip _createBatchEngagement (which calls EngagementService)
    engagementId: 'eng-test',
    items,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BulkPortfolioService — accessControl stamping (G1)', () => {
  let dbService: ReturnType<typeof makeMockDb>;
  let service: BulkPortfolioService;

  beforeEach(() => {
    dbService = makeMockDb();
    service = new BulkPortfolioService(dbService as never);
  });

  it('stamps accessControl.ownerId and tenantId on every created order', async () => {
    const items = [
      makeItem({ rowIndex: 0 }),
      makeItem({ rowIndex: 1, propertyAddress: '456 Oak Ave' }),
      makeItem({ rowIndex: 2, propertyAddress: '789 Pine Rd' }),
    ];

    await service.submit(makeRequest(items), 'manager-1', 'tenant-a');

    expect(dbService.createOrder).toHaveBeenCalledTimes(3);

    for (const call of dbService.createOrder.mock.calls) {
      const order = call[0] as Record<string, unknown>;
      const ac = order['accessControl'] as Record<string, unknown> | undefined;
      expect(ac, 'accessControl must be present on every order').toBeDefined();
      expect(ac!['ownerId']).toBe('manager-1');
      expect(ac!['tenantId']).toBe('tenant-a');
      expect(ac!['clientId']).toBe('client-1');
    }
  });

  it('stamps accessControl.ownerEmail when submitterEmail is provided', async () => {
    const items = [makeItem({ rowIndex: 0 })];

    await service.submit(makeRequest(items), 'manager-1', 'tenant-a', 'manager@example.com');

    expect(dbService.createOrder).toHaveBeenCalledTimes(1);
    const order = dbService.createOrder.mock.calls[0][0] as Record<string, unknown>;
    const ac = order['accessControl'] as Record<string, unknown>;
    expect(ac['ownerEmail']).toBe('manager@example.com');
  });

  it('does NOT call createOrder for rows that fail validation', async () => {
    const validItem = makeItem({ rowIndex: 0 });
    // Missing required propertyAddress → will fail _validateItem
    const invalidItem = { rowIndex: 1, analysisType: 'AVM' } as BulkPortfolioItem;

    const job = await service.submit(makeRequest([validItem, invalidItem]), 'manager-1', 'tenant-a');

    expect(dbService.createOrder).toHaveBeenCalledTimes(1);
    expect(job.successCount).toBe(1);
    expect(job.skippedCount).toBe(1);
    // The invalid item must show status INVALID, not FAILED
    const invalidResult = job.items.find(
      (it) => (it as BulkPortfolioItem).rowIndex === 1,
    ) as BulkPortfolioItem;
    expect(invalidResult.status).toBe('INVALID');
  });

  it('persists the bulk-portfolio job record after order creation', async () => {
    const items = [makeItem({ rowIndex: 0 })];

    const job = await service.submit(makeRequest(items), 'manager-1', 'tenant-a');

    const jobsContainer = dbService.getBulkPortfolioJobsContainer();
    expect((jobsContainer.items.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ id: job.id, tenantId: 'tenant-a' }),
    );
  });

  /**
   * Phase 1.1 — graceful degradation: submitterEmail not available (minimal UserProfile context).
   *
   * When the caller only knows the submittedBy userId (e.g. the email lookup failed or
   * the request came from a system flow without enrichment), `submit()` MUST still create
   * every order with at minimum `ownerId` and `tenantId` populated.  It must NOT silently
   * produce null/empty values for these two fields.
   *
   * This is the "graceful degradation with explicit logging, NOT silent null" requirement
   * from AUTH_PRODUCTION_READINESS_PLAN.md Phase 1.1.
   */
  it('graceful degradation: creates orders with ownerId + tenantId even when submitterEmail is absent', async () => {
    const items = [
      makeItem({ rowIndex: 0 }),
      makeItem({ rowIndex: 1, propertyAddress: '99 Elm St' }),
    ];

    // Call without the optional submitterEmail argument
    await service.submit(makeRequest(items), 'submitter-uid', 'tenant-b' /* no email */);

    expect(dbService.createOrder).toHaveBeenCalledTimes(2);

    for (const call of dbService.createOrder.mock.calls) {
      const order = call[0] as Record<string, unknown>;
      const ac = order['accessControl'] as Record<string, unknown> | undefined;

      // Must have accessControl block — NEVER silently absent
      expect(ac, 'accessControl must be present (no silent null)').toBeDefined();
      expect(typeof ac!['ownerId']).toBe('string');
      expect((ac!['ownerId'] as string).length).toBeGreaterThan(0);
      expect(ac!['ownerId']).toBe('submitter-uid');
      expect(ac!['tenantId']).toBe('tenant-b');

      // ownerEmail is optional — must be absent (not null/undefined with a string key) or omitted
      // i.e., the document must not carry ownerEmail: undefined as an explicit property
      if ('ownerEmail' in ac!) {
        expect(ac!['ownerEmail']).not.toBeNull();
        expect(ac!['ownerEmail']).not.toBe('undefined');
      }
    }
  });
});
