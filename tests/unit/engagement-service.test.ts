/**
 * EngagementService â€” Unit Tests
 *
 * Covers all service business logic for the multi-loan engagement model:
 *   1. engagementNumber format (no in-memory counter)
 *   2. createEngagement() validates loans[], enforces 1000-loan guard
 *   3. changeStatus() enforces ALLOWED_TRANSITIONS guard
 *   4. getLoans() returns loans array
 *   5. addLoanToEngagement() adds a loan + 1000-loan guard
 *   6. updateLoan() patches scalar fields
 *   7. removeLoan() throws when linked vendor orders exist
 *   8. changeLoanStatus() enforces ALLOWED_LOAN_TRANSITIONS
 *   9. addVendorOrderToClientOrder() links, deduplicates, and throws on missing IDs
 *
 * Cosmos DB is fully mocked â€” no network calls, no credentials required.
 * Run: pnpm test:unit
 */

import { describe, it, expect, vi } from 'vitest';
import { EngagementService } from '../../src/services/engagement.service.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import type { PropertyRecordService } from '../../src/services/property-record.service.js';
import {
  EngagementStatus,
  EngagementClientOrderStatus,
  EngagementProductType,
  EngagementType,
  EngagementPropertyStatus,
} from '../../src/types/engagement.types.js';
import type { Engagement, EngagementProperty } from '../../src/types/engagement.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoan(overrides: Partial<EngagementProperty> = {}): EngagementProperty {
  return {
    id:           'loan-001',
    loanNumber:   'LN-001',
    borrowerName: 'Test Borrower',
    property: {
      address: '123 Main St',
      state:   'CO',
      zipCode: '80203',
    },
    status:   EngagementPropertyStatus.PENDING,
    clientOrders: [],
    ...overrides,
  };
}

function makeEngagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id:                    'eng-test-001',
    engagementNumber:      'ENG-2026-TESTXX',
    tenantId:              'tenant-001',
    status:                EngagementStatus.RECEIVED,
    engagementType:        EngagementType.SINGLE,
    loansStoredExternally: false,
    priority:              'ROUTINE',
    receivedAt:            new Date().toISOString(),
    client: {
      clientId:   'client-001',
      clientName: 'Test Lender',
    },
    properties: [makeLoan()],
    createdAt: new Date().toISOString(),
    createdBy: 'test',
    ...overrides,
  };
}

function makeMockContainer(storedDoc: Engagement) {
  return {
    items: {
      create: vi.fn().mockResolvedValue({ resource: storedDoc }),
      query:  vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [storedDoc] }),
      }),
    },
    item: vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: storedDoc }),
      replace: vi.fn().mockImplementation(async (doc: Engagement) => ({ resource: doc })),
    }),
  };
}

/**
 * `onQueryItems` lets a test stub `dbService.queryItems(containerName, query, params)`.
 * Used by the VendorOrder-query-based read paths (removeLoan guard, getDocuments,
 * getCommunications) which now consult the `orders` container instead of the embedded
 * `EngagementClientOrder.vendorOrderIds` array.
 *
 * Default behavior (no callback): returns `{ success: true, data: [] }` — i.e. the
 * engagement has no linked vendor orders. Tests that need linked orders provide a
 * callback that returns rows for the right (containerName, params) combination.
 */
function makeDbService(
  container: ReturnType<typeof makeMockContainer>,
  onQueryItems?: (containerName: string, query: string, params?: { name: string; value: unknown }[]) => unknown[],
): CosmosDbService {
  return {
    getEngagementsContainer: vi.fn().mockReturnValue(container),
    queryItems: vi.fn().mockImplementation(async (containerName: string, query: string, params?: { name: string; value: unknown }[]) => {
      const data = onQueryItems ? onQueryItems(containerName, query, params) : [];
      return { success: true, data };
    }),
  } as unknown as CosmosDbService;
}

function makePropertyRecordService(): PropertyRecordService {
  return {
    resolveOrCreate: vi.fn().mockResolvedValue({
      propertyId: 'prop-test-001',
      isNew:      false,
      method:     'ADDRESS_NORM' as const,
    }),
  } as unknown as PropertyRecordService;
}

/** Minimal valid CreateEngagementRequest */
function makeCreateRequest(loanOverride: Record<string, unknown> = {}) {
  return {
    tenantId:  'tenant-001',
    createdBy: 'user-001',
    client: { clientId: 'c-001', clientName: 'Lender' },
    properties: [
      {
        loanNumber:   'LN-001',
        borrowerName: 'Borrower',
        property: { address: '1 Main', state: 'CO', zipCode: '80203' },
        clientOrders: [{ productType: EngagementProductType.FULL_APPRAISAL }],
        ...loanOverride,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. engagementNumber format
// ---------------------------------------------------------------------------

describe('generateEngagementNumber', () => {
  it('produces the ENG-YYYY-XXXXXXXX pattern (no sequential counter)', async () => {
    const doc = makeEngagement();
    const container = makeMockContainer(doc);

    let capturedDoc: Engagement | undefined;
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest());

    const num = capturedDoc!.engagementNumber;
    expect(num).toMatch(/^ENG-\d{4}-[A-Z0-9]{8}$/);
    expect(num).not.toMatch(/^ENG-\d{4}-\d{6}$/);
  });

  it('produces distinct numbers on back-to-back calls (no shared counter)', async () => {
    const numbers: string[] = [];

    for (let i = 0; i < 5; i++) {
      let capturedDoc: Engagement | undefined;
      const container = makeMockContainer(makeEngagement());
      container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
        capturedDoc = d;
        return { resource: d };
      });

      const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
      await svc.createEngagement(makeCreateRequest({ clientOrders: [{ productType: EngagementProductType.DRIVE_BY }] }));
      numbers.push(capturedDoc!.engagementNumber);
    }

    const unique = new Set(numbers);
    expect(unique.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2. createEngagement â€” structure and loan guard
// ---------------------------------------------------------------------------

describe('createEngagement', () => {
  it('creates engagement with correct loans[] structure', async () => {
    let capturedDoc: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest());

    expect(capturedDoc!.properties).toHaveLength(1);
    expect(capturedDoc!.properties[0]!.loanNumber).toBe('LN-001');
    expect(capturedDoc!.properties[0]!.borrowerName).toBe('Borrower');
    expect(capturedDoc!.properties[0]!.property.address).toBe('1 Main');
    expect(capturedDoc!.properties[0]!.status).toBe(EngagementPropertyStatus.PENDING);
    expect(capturedDoc!.properties[0]!.clientOrders).toHaveLength(1);
    expect(capturedDoc!.properties[0]!.clientOrders[0]!.productType).toBe(EngagementProductType.FULL_APPRAISAL);
  });

  it('sets engagementType=SINGLE when 1 loan', async () => {
    let capturedDoc: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest());
    expect(capturedDoc!.engagementType).toBe(EngagementType.SINGLE);
  });

  it('sets engagementType=PORTFOLIO when 2+ loans', async () => {
    let capturedDoc: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await svc.createEngagement({
      ...makeCreateRequest(),
      properties: [
        { loanNumber: 'LN-001', borrowerName: 'A', property: { address: '1 Main', state: 'CO', zipCode: '80203' }, clientOrders: [{ productType: EngagementProductType.FULL_APPRAISAL }] },
        { loanNumber: 'LN-002', borrowerName: 'B', property: { address: '2 Main', state: 'CO', zipCode: '80204' }, clientOrders: [{ productType: EngagementProductType.DRIVE_BY }] },
      ],
    });
    expect(capturedDoc!.engagementType).toBe(EngagementType.PORTFOLIO);
    expect(capturedDoc!.properties).toHaveLength(2);
  });

  it('rejects with a clear error when loans is empty', async () => {
    const container = makeMockContainer(makeEngagement());
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await expect(
      svc.createEngagement({ ...makeCreateRequest(), properties: [] }),
    ).rejects.toThrow(/At least one EngagementProperty is required/);
  });
});

// ---------------------------------------------------------------------------
// 2.5. createEngagement — slice 8d: loanReferences[] population
// ---------------------------------------------------------------------------

describe('createEngagement — loanReferences[] (slice 8d)', () => {
  function captureDoc() {
    let captured: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      captured = d;
      return { resource: d };
    });
    return {
      container,
      get doc() { return captured!; },
    };
  }

  it('back-fills loanReferences[0] from legacy top-level loanNumber/loanType/fhaCase', async () => {
    const cap = captureDoc();
    const svc = new EngagementService(makeDbService(cap.container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest({
      loanNumber: 'LN-001',
      loanType: 'Conventional',
      fhaCase: undefined,
    }));

    const property = cap.doc.properties[0]!;
    expect(property.loanReferences).toBeDefined();
    expect(property.loanReferences).toHaveLength(1);
    expect(property.loanReferences![0]!.loanNumber).toBe('LN-001');
    expect(property.loanReferences![0]!.loanType).toBe('Conventional');
    expect(property.loanReferences![0]!.lienPosition).toBe('First');
  });

  it('keeps top-level loanNumber/loanType/fhaCase in sync with loanReferences[0]', async () => {
    const cap = captureDoc();
    const svc = new EngagementService(makeDbService(cap.container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest({
      loanNumber: 'LN-100',
      loanType: 'FHA',
      fhaCase: 'FHA-CASE-99',
    }));

    const property = cap.doc.properties[0]!;
    // Both forms present and matching
    expect(property.loanNumber).toBe('LN-100');
    expect(property.loanType).toBe('FHA');
    expect(property.fhaCase).toBe('FHA-CASE-99');
    expect(property.loanReferences![0]!.loanNumber).toBe('LN-100');
    expect(property.loanReferences![0]!.loanType).toBe('FHA');
    expect(property.loanReferences![0]!.fhaCase).toBe('FHA-CASE-99');
  });

  it('accepts caller-supplied loanReferences[] with multiple liens (first + HELOC)', async () => {
    const cap = captureDoc();
    const svc = new EngagementService(makeDbService(cap.container), makePropertyRecordService());

    // Caller hands us a property carrying a first lien + HELOC. Service
    // preserves the array verbatim and uses [0] for the legacy-field sync.
    const reqWithMultipleLiens = {
      ...makeCreateRequest(),
      properties: [
        {
          loanNumber: 'IGNORED-FROM-LEGACY-FIELD', // overridden by loanReferences
          borrowerName: 'Multi-lien Borrower',
          property: { address: '1 Multilien', state: 'CO', zipCode: '80203' },
          clientOrders: [{ productType: EngagementProductType.FULL_APPRAISAL }],
          loanReferences: [
            { loanNumber: 'LN-FIRST-001', loanAmount: 400000, loanType: 'Conventional', lienPosition: 'First' as const },
            { loanNumber: 'HELOC-001', loanAmount: 75000, loanType: 'HELOC', lienPosition: 'HELOC' as const },
          ],
        } as any,
      ],
    };
    await svc.createEngagement(reqWithMultipleLiens);

    const property = cap.doc.properties[0]!;
    expect(property.loanReferences).toHaveLength(2);
    expect(property.loanReferences![0]!.loanNumber).toBe('LN-FIRST-001');
    expect(property.loanReferences![0]!.lienPosition).toBe('First');
    expect(property.loanReferences![1]!.loanNumber).toBe('HELOC-001');
    expect(property.loanReferences![1]!.lienPosition).toBe('HELOC');

    // Top-level legacy fields reflect the PRIMARY (first entry).
    expect(property.loanNumber).toBe('LN-FIRST-001');
    expect(property.loanType).toBe('Conventional');
  });

  it('does not emit fhaCase on loanReferences[0] when not supplied (omit, not undefined)', async () => {
    const cap = captureDoc();
    const svc = new EngagementService(makeDbService(cap.container), makePropertyRecordService());
    await svc.createEngagement(makeCreateRequest({ loanNumber: 'LN-1', loanType: 'Conv' }));

    const ref = cap.doc.properties[0]!.loanReferences![0]!;
    expect(ref).not.toHaveProperty('fhaCase');
  });
});

// ---------------------------------------------------------------------------
// 3. changeStatus â€” engagement-level transition guard
// ---------------------------------------------------------------------------

describe('changeStatus â€” transition guard', () => {
  const VALID_TRANSITIONS: Array<[EngagementStatus, EngagementStatus]> = [
    [EngagementStatus.RECEIVED,    EngagementStatus.ACCEPTED],
    [EngagementStatus.RECEIVED,    EngagementStatus.CANCELLED],
    [EngagementStatus.RECEIVED,    EngagementStatus.ON_HOLD],
    [EngagementStatus.ACCEPTED,    EngagementStatus.IN_PROGRESS],
    [EngagementStatus.ACCEPTED,    EngagementStatus.CANCELLED],
    [EngagementStatus.IN_PROGRESS, EngagementStatus.QC],
    [EngagementStatus.IN_PROGRESS, EngagementStatus.REVISION],
    [EngagementStatus.QC,          EngagementStatus.DELIVERED],
    [EngagementStatus.QC,          EngagementStatus.REVISION],
    [EngagementStatus.REVISION,    EngagementStatus.IN_PROGRESS],
    [EngagementStatus.DELIVERED,   EngagementStatus.REVISION],
    [EngagementStatus.ON_HOLD,     EngagementStatus.IN_PROGRESS],
  ];

  const INVALID_TRANSITIONS: Array<[EngagementStatus, EngagementStatus]> = [
    [EngagementStatus.RECEIVED,    EngagementStatus.QC],
    [EngagementStatus.RECEIVED,    EngagementStatus.DELIVERED],
    [EngagementStatus.RECEIVED,    EngagementStatus.IN_PROGRESS],
    [EngagementStatus.DELIVERED,   EngagementStatus.RECEIVED],
    [EngagementStatus.DELIVERED,   EngagementStatus.ACCEPTED],
    [EngagementStatus.CANCELLED,   EngagementStatus.RECEIVED],
    [EngagementStatus.CANCELLED,   EngagementStatus.IN_PROGRESS],
    [EngagementStatus.QC,          EngagementStatus.ACCEPTED],
  ];

  for (const [from, to] of VALID_TRANSITIONS) {
    it(`allows ${from} â†’ ${to}`, async () => {
      const doc = makeEngagement({ status: from });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
      await expect(svc.changeStatus('eng-test-001', 'tenant-001', to, 'user-001')).resolves.not.toThrow();
    });
  }

  for (const [from, to] of INVALID_TRANSITIONS) {
    it(`rejects ${from} â†’ ${to} with a clear error`, async () => {
      const doc = makeEngagement({ status: from });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
      await expect(svc.changeStatus('eng-test-001', 'tenant-001', to, 'user-001')).rejects.toThrow(
        /Invalid status transition/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 4. getLoans
// ---------------------------------------------------------------------------

describe('getLoans', () => {
  it('returns the loans array from the engagement', async () => {
    const loan1 = makeLoan({ id: 'loan-001', loanNumber: 'LN-001' });
    const loan2 = makeLoan({ id: 'loan-002', loanNumber: 'LN-002' });
    const doc = makeEngagement({ properties: [loan1, loan2] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.getLoans('eng-test-001', 'tenant-001');
    expect(result).toHaveLength(2);
    expect(result[0]!.loanNumber).toBe('LN-001');
    expect(result[1]!.loanNumber).toBe('LN-002');
  });
});

// ---------------------------------------------------------------------------
// 5. addLoanToEngagement
// ---------------------------------------------------------------------------

describe('addLoanToEngagement', () => {
  it('appends a new loan and returns updated engagement', async () => {
    const doc = makeEngagement({ properties: [makeLoan()] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.addLoanToEngagement('eng-test-001', 'tenant-001', {
      loanNumber:   'LN-NEW',
      borrowerName: 'New Borrower',
      property: { address: '99 Oak St', state: 'TX', zipCode: '75001' },
      clientOrders: [{ productType: EngagementProductType.AVM }],
    }, 'user-001');

    expect(result.properties).toHaveLength(2);
    expect(result.properties[1]!.loanNumber).toBe('LN-NEW');
    expect(result.properties[1]!.status).toBe(EngagementPropertyStatus.PENDING);
    expect(result.engagementType).toBe(EngagementType.PORTFOLIO);
  });

  it('throws when loan count would exceed 1000', async () => {
    const lotsOfLoans = Array.from({ length: 1000 }, (_, i) => makeLoan({ id: `loan-${i}` }));
    const doc = makeEngagement({ properties: lotsOfLoans });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await expect(
      svc.addLoanToEngagement('eng-test-001', 'tenant-001', {
        loanNumber:   'LN-OVERFLOW',
        borrowerName: 'Overflow',
        property: { address: '1 Main', state: 'CO', zipCode: '80203' },
        clientOrders:  [{ productType: EngagementProductType.FULL_APPRAISAL }],
      }, 'user-001'),
    ).rejects.toThrow(/not yet supported/);
  });
});

// ---------------------------------------------------------------------------
// 6. updateLoan
// ---------------------------------------------------------------------------

describe('updateLoan', () => {
  it('patches borrowerName on the matching loan', async () => {
    const doc = makeEngagement({ properties: [makeLoan({ id: 'loan-001' })] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.updateLoan('eng-test-001', 'tenant-001', 'loan-001', { borrowerName: 'Updated Name' }, 'user');
    expect(result.properties[0]!.borrowerName).toBe('Updated Name');
  });

  it('throws when loan not found', async () => {
    const doc = makeEngagement({ properties: [makeLoan({ id: 'loan-001' })] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await expect(
      svc.updateLoan('eng-test-001', 'tenant-001', 'loan-nonexistent', {}, 'user'),
    ).rejects.toThrow(/EngagementProperty not found/);
  });
});

// ---------------------------------------------------------------------------
// 7. removeLoan
// ---------------------------------------------------------------------------

describe('removeLoan', () => {
  it('removes a loan that has no linked vendor orders', async () => {
    const loan1 = makeLoan({ id: 'loan-001', clientOrders: [{ id: 'p1', productType: EngagementProductType.AVM, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] }] });
    const loan2 = makeLoan({ id: 'loan-002', loanNumber: 'LN-002' });
    const doc = makeEngagement({ properties: [loan1, loan2] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    // No vendor orders in the orders container for this loan.
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user');
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]!.id).toBe('loan-002');
  });

  it('throws when loan has linked vendor orders (queried from the orders container)', async () => {
    const loanWithOrders = makeLoan({
      id: 'loan-001',
      clientOrders: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: [] },
      ],
    });
    const doc = makeEngagement({ properties: [loanWithOrders] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const dbService = makeDbService(container, (containerName, _q, params) => {
      if (containerName !== 'orders') return [];
      const loanIdParam = params?.find((p) => p.name === '@loanId')?.value;
      return loanIdParam === 'loan-001' ? [{ id: 'vo-1' }] : [];
    });
    const svc = new EngagementService(dbService, makePropertyRecordService());
    await expect(
      svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user'),
    ).rejects.toThrow(/Cannot remove loan/);
  });

  // Drift case A: VendorOrder docs say there ARE linked orders, but the embedded
  // EngagementClientOrder.vendorOrderIds array is stale/empty (e.g. partial-failure on
  // placeClientOrder, legacy data). The guard MUST trust the orders container, not the
  // embedded array — otherwise dangerous deletes go through.
  it('blocks removal when VendorOrder query returns rows even if embedded array is empty (drift)', async () => {
    const loan = makeLoan({
      id: 'loan-001',
      clientOrders: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: [] },
      ],
    });
    const doc = makeEngagement({ properties: [loan] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const dbService = makeDbService(container, (containerName) =>
      containerName === 'orders' ? [{ id: 'vo-orphaned-by-drift' }] : [],
    );
    const svc = new EngagementService(dbService, makePropertyRecordService());
    await expect(
      svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user'),
    ).rejects.toThrow(/Cannot remove loan/);
  });

  // Drift case B: the embedded array claims there are linked orders, but the orders
  // container has none for this loan (e.g. they were deleted/cancelled in another flow,
  // or the embedded array was never cleaned up). The orders container is the source of
  // truth — removal should be permitted.
  it('permits removal when embedded array shows linkage but orders container has none (drift)', async () => {
    const loan = makeLoan({
      id: 'loan-001',
      clientOrders: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: ['ghost-vo-1', 'ghost-vo-2'] },
      ],
    });
    const doc = makeEngagement({ properties: [loan, makeLoan({ id: 'loan-002', loanNumber: 'LN-002' })] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    // No orders for this loan in the orders container — the embedded array is stale.
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user');
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]!.id).toBe('loan-002');
  });
});

// ---------------------------------------------------------------------------
// 7b. getDocuments / getCommunications — order-id collection from VendorOrders
// ---------------------------------------------------------------------------
//
// These methods aggregate sub-resources (documents / communications) from all
// vendor orders linked to the engagement. The order-id collection step now goes
// through getVendorOrders() (which queries the orders container by engagementId)
// rather than walking the embedded EngagementClientOrder.vendorOrderIds arrays.
// These tests prove the source of truth shifted by exercising drift cases.

describe('getDocuments — order-id source', () => {
  it('queries the orders container, not the embedded vendorOrderIds, when collecting linked-doc IDs (drift)', async () => {
    // Embedded array is empty; VendorOrder query returns one. The doc query that
    // follows MUST include vo-1 in its IN-clause params.
    const loan = makeLoan({
      id: 'loan-001',
      clientOrders: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: [] },
      ],
    });
    const doc = makeEngagement({ properties: [loan] });
    const container = makeMockContainer(doc);

    let orderDocsQueryParams: { name: string; value: unknown }[] | undefined;
    const dbService = makeDbService(container, (containerName, _query, params) => {
      if (containerName === 'orders') {
        return [{ id: 'vo-1' }];
      }
      if (containerName === 'documents') {
        // Capture the second documents query (the linked-orders one) — it includes @oid* params.
        if (params?.some((p) => p.name.startsWith('@oid'))) {
          orderDocsQueryParams = params;
          return [{ id: 'doc-from-vo-1' }];
        }
        return [{ id: 'doc-engagement-level' }];
      }
      return [];
    });
    const svc = new EngagementService(dbService, makePropertyRecordService());
    const result = await svc.getDocuments<{ id: string }>('eng-test-001', 'tenant-001');
    expect(result.map((d) => d.id)).toEqual(expect.arrayContaining(['doc-engagement-level', 'doc-from-vo-1']));
    expect(orderDocsQueryParams).toBeDefined();
    expect(orderDocsQueryParams!.find((p) => p.name === '@oid0')?.value).toBe('vo-1');
  });
});

describe('getCommunications — order-id source', () => {
  it('queries the orders container, not the embedded vendorOrderIds, when collecting linked-comm IDs (drift)', async () => {
    const loan = makeLoan({
      id: 'loan-001',
      clientOrders: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: [] },
      ],
    });
    const doc = makeEngagement({ properties: [loan] });
    const container = makeMockContainer(doc);

    let commsQueryParams: { name: string; value: unknown }[] | undefined;
    const dbService = makeDbService(container, (containerName, _query, params) => {
      if (containerName === 'orders') return [{ id: 'vo-7' }];
      if (containerName === 'communications') {
        commsQueryParams = params;
        return [];
      }
      return [];
    });
    const svc = new EngagementService(dbService, makePropertyRecordService());
    await svc.getCommunications('eng-test-001', 'tenant-001');
    expect(commsQueryParams).toBeDefined();
    // The IN-clause should reference vo-7 from the orders container, NOT the
    // empty embedded array on the engagement doc.
    expect(commsQueryParams!.find((p) => p.name === '@oid0')?.value).toBe('vo-7');
  });
});

// ---------------------------------------------------------------------------
// 8. changeLoanStatus â€” loan-level transition guard
// ---------------------------------------------------------------------------

describe('changeLoanStatus', () => {
  const VALID_LOAN_TRANSITIONS: Array<[EngagementPropertyStatus, EngagementPropertyStatus]> = [
    [EngagementPropertyStatus.PENDING,     EngagementPropertyStatus.IN_PROGRESS],
    [EngagementPropertyStatus.PENDING,     EngagementPropertyStatus.CANCELLED],
    [EngagementPropertyStatus.IN_PROGRESS, EngagementPropertyStatus.QC],
    [EngagementPropertyStatus.IN_PROGRESS, EngagementPropertyStatus.CANCELLED],
    [EngagementPropertyStatus.QC,          EngagementPropertyStatus.DELIVERED],
    [EngagementPropertyStatus.QC,          EngagementPropertyStatus.IN_PROGRESS],
    [EngagementPropertyStatus.QC,          EngagementPropertyStatus.CANCELLED],
  ];

  const INVALID_LOAN_TRANSITIONS: Array<[EngagementPropertyStatus, EngagementPropertyStatus]> = [
    [EngagementPropertyStatus.PENDING,   EngagementPropertyStatus.QC],
    [EngagementPropertyStatus.PENDING,   EngagementPropertyStatus.DELIVERED],
    [EngagementPropertyStatus.DELIVERED, EngagementPropertyStatus.PENDING],
    [EngagementPropertyStatus.CANCELLED, EngagementPropertyStatus.IN_PROGRESS],
  ];

  for (const [from, to] of VALID_LOAN_TRANSITIONS) {
    it(`allows loan ${from} â†’ ${to}`, async () => {
      const doc = makeEngagement({ properties: [makeLoan({ id: 'loan-001', status: from })] });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
      await expect(svc.changeLoanStatus('eng-test-001', 'tenant-001', 'loan-001', to, 'user')).resolves.not.toThrow();
    });
  }

  for (const [from, to] of INVALID_LOAN_TRANSITIONS) {
    it(`rejects loan ${from} â†’ ${to} with a clear error`, async () => {
      const doc = makeEngagement({ properties: [makeLoan({ id: 'loan-001', status: from })] });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn(),
      });
      const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
      await expect(svc.changeLoanStatus('eng-test-001', 'tenant-001', 'loan-001', to, 'user')).rejects.toThrow(
        /Invalid loan status transition/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 9. addVendorOrderToClientOrder
// ---------------------------------------------------------------------------

describe('addVendorOrderToClientOrder', () => {
  it('adds vendorOrderId to the matching product within the correct loan', async () => {
    const engagement = makeEngagement({
      properties: [
        makeLoan({
          id: 'loan-001',
          clientOrders: [
            { id: 'prod-001', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
          ],
        }),
      ],
    });

    let saved: Engagement | undefined;
    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => { saved = d; return { resource: d }; }),
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.addVendorOrderToClientOrder('eng-test-001', 'tenant-001', 'loan-001', 'prod-001', 'ord-xyz', 'user');

    expect(result.properties[0]!.clientOrders[0]!.vendorOrderIds).toContain('ord-xyz');
    expect(saved!.properties[0]!.clientOrders[0]!.vendorOrderIds).toContain('ord-xyz');
  });

  it('is idempotent â€” does not add the same vendorOrderId twice', async () => {
    const engagement = makeEngagement({
      properties: [
        makeLoan({
          id: 'loan-001',
          clientOrders: [
            { id: 'prod-001', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementClientOrderStatus.ASSIGNED, vendorOrderIds: ['ord-xyz'] },
          ],
        }),
      ],
    });

    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });

    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    const result = await svc.addVendorOrderToClientOrder('eng-test-001', 'tenant-001', 'loan-001', 'prod-001', 'ord-xyz', 'user');
    expect(result.properties[0]!.clientOrders[0]!.vendorOrderIds.filter((id) => id === 'ord-xyz')).toHaveLength(1);
  });

  it('throws a clear error when loanId does not exist', async () => {
    const engagement = makeEngagement({ properties: [makeLoan({ id: 'loan-001', clientOrders: [] })] });
    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await expect(
      svc.addVendorOrderToClientOrder('eng-test-001', 'tenant-001', 'loan-nonexistent', 'prod-001', 'ord-xyz', 'user'),
    ).rejects.toThrow(/EngagementProperty not found/);
  });

  it('throws a clear error when productId does not exist within the loan', async () => {
    const engagement = makeEngagement({ properties: [makeLoan({ id: 'loan-001', clientOrders: [] })] });
    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container), makePropertyRecordService());
    await expect(
      svc.addVendorOrderToClientOrder('eng-test-001', 'tenant-001', 'loan-001', 'prod-nonexistent', 'ord-xyz', 'user'),
    ).rejects.toThrow(/EngagementClientOrder not found/);
  });
});

// ---------------------------------------------------------------------------
// 10. Property enrichment wiring
// ---------------------------------------------------------------------------

describe('createEngagement â€” enrichment wiring', () => {
  function makeEnrichmentService() {
    return {
      enrichEngagement: vi.fn().mockResolvedValue({
        enrichmentId: 'enrich-loan-001-123',
        propertyId:   'prop-test-001',
        status:       'enriched',
      }),
    };
  }

  it('calls enrichEngagement once per loan after creating the engagement', async () => {
    const storedEng = makeEngagement({
      properties: [
        makeLoan({ id: 'loan-a', property: { address: '1 Main St', city: 'Denver', state: 'CO', zipCode: '80203' } }),
      ],
    });
    const container = makeMockContainer(storedEng);
    const enrichSvc = makeEnrichmentService();

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrichSvc as any,
    );
    await svc.createEngagement({
      tenantId:  'tenant-001',
      createdBy: 'user-001',
      client:    { clientId: 'c-001', clientName: 'Lender' },
      properties: [{
        loanNumber:   'LN-A',
        borrowerName: 'Borrower',
        property:     { address: '1 Main St', city: 'Denver', state: 'CO', zipCode: '80203' },
        clientOrders: [{ productType: EngagementProductType.FULL_APPRAISAL }],
      }],
    });

    // Give fire-and-forget time to settle
    await vi.waitFor(() => expect(enrichSvc.enrichEngagement).toHaveBeenCalled());
    expect(enrichSvc.enrichEngagement).toHaveBeenCalledOnce();
  });

  it('calls enrichEngagement once per loan in a multi-loan engagement', async () => {
    const storedEng = makeEngagement({
      engagementType: EngagementType.PORTFOLIO,
      properties: [
        makeLoan({ id: 'loan-a', property: { address: '1 A St', city: 'Denver', state: 'CO', zipCode: '80201' } }),
        makeLoan({ id: 'loan-b', property: { address: '2 B Ave', city: 'Boulder', state: 'CO', zipCode: '80302' } }),
      ],
    });
    const container  = makeMockContainer(storedEng);
    const enrichSvc  = makeEnrichmentService();

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrichSvc as any,
    );
    await svc.createEngagement({
      tenantId:  'tenant-001',
      createdBy: 'user-001',
      client:    { clientId: 'c-001', clientName: 'Lender' },
      properties: [
        { loanNumber: 'LN-A', borrowerName: 'A', property: { address: '1 A St', city: 'Denver', state: 'CO', zipCode: '80201' }, clientOrders: [{ productType: EngagementProductType.FULL_APPRAISAL }] },
        { loanNumber: 'LN-B', borrowerName: 'B', property: { address: '2 B Ave', city: 'Boulder', state: 'CO', zipCode: '80302' }, clientOrders: [{ productType: EngagementProductType.DRIVE_BY }] },
      ],
    });

    await vi.waitFor(() => expect(enrichSvc.enrichEngagement).toHaveBeenCalledTimes(2));
  });

  it('does not throw when enrichEngagement rejects (non-fatal)', async () => {
    const storedEng = makeEngagement();
    const container = makeMockContainer(storedEng);
    const enrichSvc = {
      enrichEngagement: vi.fn().mockRejectedValue(new Error('provider down')),
    };

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrichSvc as any,
    );
    await expect(
      svc.createEngagement(makeCreateRequest()),
    ).resolves.not.toThrow();
  });
});


// ---------------------------------------------------------------------------
// 11. createEngagement -> ClientOrderService bridge (Option B pipeline)
// ---------------------------------------------------------------------------

describe('createEngagement - ClientOrderService bridge', () => {
  function makeEnrichmentService(propertyId = 'prop-test-001') {
    return {
      enrichEngagement: vi.fn().mockResolvedValue({
        enrichmentId: 'enrich-x',
        propertyId,
        status: 'enriched',
      }),
    };
  }

  function makeClientOrderService() {
    return {
      placeClientOrder: vi.fn(async (input: any) => ({
        clientOrder: { id: input.clientOrderId ?? 'co-auto', tenantId: input.tenantId },
        vendorOrders: [],
      })),
    };
  }

  it('places a standalone ClientOrder per embedded EngagementClientOrder, reusing the embedded id', async () => {
    const storedEng = makeEngagement({
      properties: [
        makeLoan({
          id: 'loan-a',
          propertyId: 'prop-test-001',
          property: { address: '1 Main St', city: 'Denver', state: 'CO', zipCode: '80203' },
          clientOrders: [
            { id: 'co-embed-1', productType: EngagementProductType.BPO, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
            { id: 'co-embed-2', productType: EngagementProductType.AVM, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
          ],
        }),
      ],
    });
    const container = makeMockContainer(storedEng);
    const enrich = makeEnrichmentService();
    const cos = makeClientOrderService();

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrich as any,
      cos as any,
    );

    await svc.createEngagement({
      tenantId: 'tenant-001',
      createdBy: 'user-001',
      client: { clientId: 'c-001', clientName: 'Lender' },
      properties: [{
        loanNumber: 'LN-A',
        borrowerName: 'B',
        property: { address: '1 Main St', city: 'Denver', state: 'CO', zipCode: '80203' },
        clientOrders: [
          { productType: EngagementProductType.BPO },
          { productType: EngagementProductType.AVM },
        ],
      }],
    });

    await vi.waitFor(() => expect(cos.placeClientOrder).toHaveBeenCalledTimes(2));

    // Both calls reuse the embedded ids from the persisted engagement.
    const calls = cos.placeClientOrder.mock.calls.map((c: any[]) => c[0]);
    expect(calls[0].clientOrderId).toBe('co-embed-1');
    expect(calls[1].clientOrderId).toBe('co-embed-2');
    // Ancestry fields are propagated correctly. The engagementId is the
    // freshly-generated id assigned by createEngagement; we only assert it
    // is a non-empty string and identical for sibling client orders.
    expect(typeof calls[0].engagementId).toBe('string');
    expect(calls[0].engagementId.length).toBeGreaterThan(0);
    expect(calls[1].engagementId).toBe(calls[0].engagementId);
    expect(calls[0].engagementPropertyId).toBe('loan-a');
    expect(calls[0].clientId).toBe('c-001');
    expect(calls[0].tenantId).toBe('tenant-001');
    expect(calls[0].propertyId).toBe('prop-test-001');
    expect(calls[0].productType).toBe(EngagementProductType.BPO);
  });

  it('awaits enrichment BEFORE invoking placeClientOrder so the listener gets a record with lat/lng', async () => {
    const storedEng = makeEngagement({
      properties: [makeLoan({
        id: 'loan-a',
        propertyId: 'prop-test-001',
        clientOrders: [
          { id: 'co-embed-1', productType: EngagementProductType.BPO, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
        ],
      })],
    });
    const container = makeMockContainer(storedEng);
    const order: string[] = [];
    const enrich = {
      enrichEngagement: vi.fn(async () => {
        order.push('enrich-start');
        await new Promise((r) => setTimeout(r, 10));
        order.push('enrich-end');
        return { enrichmentId: 'e', propertyId: 'prop-test-001', status: 'enriched' };
      }),
    };
    const cos = {
      placeClientOrder: vi.fn(async () => {
        order.push('place');
        return { clientOrder: { id: 'co-x', tenantId: 't' }, vendorOrders: [] };
      }),
    };

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrich as any,
      cos as any,
    );

    await svc.createEngagement(makeCreateRequest());
    await vi.waitFor(() => expect(cos.placeClientOrder).toHaveBeenCalled());

    expect(order).toEqual(['enrich-start', 'enrich-end', 'place']);
  });

  it('still places ClientOrders when enrichment fails (so client-orders is populated; listener will write SKIPPED order-comparables)', async () => {
    const storedEng = makeEngagement({
      properties: [makeLoan({
        id: 'loan-a',
        propertyId: 'prop-test-001',
        clientOrders: [
          { id: 'co-embed-1', productType: EngagementProductType.BPO, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
        ],
      })],
    });
    const container = makeMockContainer(storedEng);
    const enrich = {
      enrichEngagement: vi.fn().mockRejectedValue(new Error('attom down')),
    };
    const cos = makeClientOrderService();

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrich as any,
      cos as any,
    );

    await svc.createEngagement(makeCreateRequest());
    await vi.waitFor(() => expect(cos.placeClientOrder).toHaveBeenCalled());
    expect(cos.placeClientOrder).toHaveBeenCalledTimes(1);
  });

  it('isolates failures: one placeClientOrder rejection does not abort siblings', async () => {
    const storedEng = makeEngagement({
      properties: [
        makeLoan({
          id: 'loan-a',
          propertyId: 'prop-test-001',
          clientOrders: [
            { id: 'co-1', productType: EngagementProductType.BPO, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
            { id: 'co-2', productType: EngagementProductType.AVM, status: EngagementClientOrderStatus.PENDING, vendorOrderIds: [] },
          ],
        }),
      ],
    });
    const container = makeMockContainer(storedEng);
    const enrich = makeEnrichmentService();
    const cos = {
      placeClientOrder: vi.fn(async (input: any) => {
        if (input.clientOrderId === 'co-1') throw new Error('cosmos 409');
        return { clientOrder: { id: input.clientOrderId, tenantId: input.tenantId }, vendorOrders: [] };
      }),
    };

    const svc = new EngagementService(
      makeDbService(container),
      makePropertyRecordService(),
      enrich as any,
      cos as any,
    );

    await svc.createEngagement({
      tenantId: 'tenant-001',
      createdBy: 'user-001',
      client: { clientId: 'c-001', clientName: 'Lender' },
      properties: [{
        loanNumber: 'LN-A',
        borrowerName: 'B',
        property: { address: '1 Main St', city: 'Denver', state: 'CO', zipCode: '80203' },
        clientOrders: [
          { productType: EngagementProductType.BPO },
          { productType: EngagementProductType.AVM },
        ],
      }],
    });

    await vi.waitFor(() => expect(cos.placeClientOrder).toHaveBeenCalledTimes(2));
  });
});