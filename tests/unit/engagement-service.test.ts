/**
 * EngagementService — Unit Tests
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
 *   9. addVendorOrderToProduct() links, deduplicates, and throws on missing IDs
 *
 * Cosmos DB is fully mocked — no network calls, no credentials required.
 * Run: pnpm test:unit
 */

import { describe, it, expect, vi } from 'vitest';
import { EngagementService } from '../../src/services/engagement.service.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import {
  EngagementStatus,
  EngagementProductStatus,
  EngagementProductType,
  EngagementType,
  EngagementLoanStatus,
} from '../../src/types/engagement.types.js';
import type { Engagement, EngagementLoan } from '../../src/types/engagement.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLoan(overrides: Partial<EngagementLoan> = {}): EngagementLoan {
  return {
    id:           'loan-001',
    loanNumber:   'LN-001',
    borrowerName: 'Test Borrower',
    property: {
      address: '123 Main St',
      state:   'CO',
      zipCode: '80203',
    },
    status:   EngagementLoanStatus.PENDING,
    products: [],
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
    loans: [makeLoan()],
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

function makeDbService(container: ReturnType<typeof makeMockContainer>): CosmosDbService {
  return {
    getEngagementsContainer: vi.fn().mockReturnValue(container),
  } as unknown as CosmosDbService;
}

/** Minimal valid CreateEngagementRequest */
function makeCreateRequest(loanOverride: Record<string, unknown> = {}) {
  return {
    tenantId:  'tenant-001',
    createdBy: 'user-001',
    client: { clientId: 'c-001', clientName: 'Lender' },
    loans: [
      {
        loanNumber:   'LN-001',
        borrowerName: 'Borrower',
        property: { address: '1 Main', state: 'CO', zipCode: '80203' },
        products: [{ productType: EngagementProductType.FULL_APPRAISAL }],
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

    const svc = new EngagementService(makeDbService(container));
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

      const svc = new EngagementService(makeDbService(container));
      await svc.createEngagement(makeCreateRequest({ products: [{ productType: EngagementProductType.DRIVE_BY }] }));
      numbers.push(capturedDoc!.engagementNumber);
    }

    const unique = new Set(numbers);
    expect(unique.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2. createEngagement — structure and loan guard
// ---------------------------------------------------------------------------

describe('createEngagement', () => {
  it('creates engagement with correct loans[] structure', async () => {
    let capturedDoc: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container));
    await svc.createEngagement(makeCreateRequest());

    expect(capturedDoc!.loans).toHaveLength(1);
    expect(capturedDoc!.loans[0]!.loanNumber).toBe('LN-001');
    expect(capturedDoc!.loans[0]!.borrowerName).toBe('Borrower');
    expect(capturedDoc!.loans[0]!.property.address).toBe('1 Main');
    expect(capturedDoc!.loans[0]!.status).toBe(EngagementLoanStatus.PENDING);
    expect(capturedDoc!.loans[0]!.products).toHaveLength(1);
    expect(capturedDoc!.loans[0]!.products[0]!.productType).toBe(EngagementProductType.FULL_APPRAISAL);
  });

  it('sets engagementType=SINGLE when 1 loan', async () => {
    let capturedDoc: Engagement | undefined;
    const container = makeMockContainer(makeEngagement());
    container.items.create = vi.fn().mockImplementation(async (d: Engagement) => {
      capturedDoc = d;
      return { resource: d };
    });

    const svc = new EngagementService(makeDbService(container));
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

    const svc = new EngagementService(makeDbService(container));
    await svc.createEngagement({
      ...makeCreateRequest(),
      loans: [
        { loanNumber: 'LN-001', borrowerName: 'A', property: { address: '1 Main', state: 'CO', zipCode: '80203' }, products: [{ productType: EngagementProductType.FULL_APPRAISAL }] },
        { loanNumber: 'LN-002', borrowerName: 'B', property: { address: '2 Main', state: 'CO', zipCode: '80204' }, products: [{ productType: EngagementProductType.DRIVE_BY }] },
      ],
    });
    expect(capturedDoc!.engagementType).toBe(EngagementType.PORTFOLIO);
    expect(capturedDoc!.loans).toHaveLength(2);
  });

  it('rejects with a clear error when loans is empty', async () => {
    const container = makeMockContainer(makeEngagement());
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.createEngagement({ ...makeCreateRequest(), loans: [] }),
    ).rejects.toThrow(/At least one EngagementLoan is required/);
  });
});

// ---------------------------------------------------------------------------
// 3. changeStatus — engagement-level transition guard
// ---------------------------------------------------------------------------

describe('changeStatus — transition guard', () => {
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
    it(`allows ${from} → ${to}`, async () => {
      const doc = makeEngagement({ status: from });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container));
      await expect(svc.changeStatus('eng-test-001', 'tenant-001', to, 'user-001')).resolves.not.toThrow();
    });
  }

  for (const [from, to] of INVALID_TRANSITIONS) {
    it(`rejects ${from} → ${to} with a clear error`, async () => {
      const doc = makeEngagement({ status: from });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container));
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
    const doc = makeEngagement({ loans: [loan1, loan2] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
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
    const doc = makeEngagement({ loans: [makeLoan()] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    const svc = new EngagementService(makeDbService(container));
    const result = await svc.addLoanToEngagement('eng-test-001', 'tenant-001', {
      loanNumber:   'LN-NEW',
      borrowerName: 'New Borrower',
      property: { address: '99 Oak St', state: 'TX', zipCode: '75001' },
      products: [{ productType: EngagementProductType.AVM }],
    }, 'user-001');

    expect(result.loans).toHaveLength(2);
    expect(result.loans[1]!.loanNumber).toBe('LN-NEW');
    expect(result.loans[1]!.status).toBe(EngagementLoanStatus.PENDING);
    expect(result.engagementType).toBe(EngagementType.PORTFOLIO);
  });

  it('throws when loan count would exceed 1000', async () => {
    const lotsOfLoans = Array.from({ length: 1000 }, (_, i) => makeLoan({ id: `loan-${i}` }));
    const doc = makeEngagement({ loans: lotsOfLoans });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.addLoanToEngagement('eng-test-001', 'tenant-001', {
        loanNumber:   'LN-OVERFLOW',
        borrowerName: 'Overflow',
        property: { address: '1 Main', state: 'CO', zipCode: '80203' },
        products:  [{ productType: EngagementProductType.FULL_APPRAISAL }],
      }, 'user-001'),
    ).rejects.toThrow(/not yet supported/);
  });
});

// ---------------------------------------------------------------------------
// 6. updateLoan
// ---------------------------------------------------------------------------

describe('updateLoan', () => {
  it('patches borrowerName on the matching loan', async () => {
    const doc = makeEngagement({ loans: [makeLoan({ id: 'loan-001' })] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    const svc = new EngagementService(makeDbService(container));
    const result = await svc.updateLoan('eng-test-001', 'tenant-001', 'loan-001', { borrowerName: 'Updated Name' }, 'user');
    expect(result.loans[0]!.borrowerName).toBe('Updated Name');
  });

  it('throws when loan not found', async () => {
    const doc = makeEngagement({ loans: [makeLoan({ id: 'loan-001' })] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.updateLoan('eng-test-001', 'tenant-001', 'loan-nonexistent', {}, 'user'),
    ).rejects.toThrow(/EngagementLoan not found/);
  });
});

// ---------------------------------------------------------------------------
// 7. removeLoan
// ---------------------------------------------------------------------------

describe('removeLoan', () => {
  it('removes a loan that has no linked vendor orders', async () => {
    const loan1 = makeLoan({ id: 'loan-001', products: [{ id: 'p1', productType: EngagementProductType.AVM, status: EngagementProductStatus.PENDING, vendorOrderIds: [] }] });
    const loan2 = makeLoan({ id: 'loan-002', loanNumber: 'LN-002' });
    const doc = makeEngagement({ loans: [loan1, loan2] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });
    const svc = new EngagementService(makeDbService(container));
    const result = await svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user');
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0]!.id).toBe('loan-002');
  });

  it('throws when loan has linked vendor orders', async () => {
    const loanWithOrders = makeLoan({
      id: 'loan-001',
      products: [
        { id: 'p1', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementProductStatus.ASSIGNED, vendorOrderIds: ['ord-123'] },
      ],
    });
    const doc = makeEngagement({ loans: [loanWithOrders] });
    const container = makeMockContainer(doc);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: doc }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.removeLoan('eng-test-001', 'tenant-001', 'loan-001', 'user'),
    ).rejects.toThrow(/Cannot remove loan/);
  });
});

// ---------------------------------------------------------------------------
// 8. changeLoanStatus — loan-level transition guard
// ---------------------------------------------------------------------------

describe('changeLoanStatus', () => {
  const VALID_LOAN_TRANSITIONS: Array<[EngagementLoanStatus, EngagementLoanStatus]> = [
    [EngagementLoanStatus.PENDING,     EngagementLoanStatus.IN_PROGRESS],
    [EngagementLoanStatus.PENDING,     EngagementLoanStatus.CANCELLED],
    [EngagementLoanStatus.IN_PROGRESS, EngagementLoanStatus.QC],
    [EngagementLoanStatus.IN_PROGRESS, EngagementLoanStatus.CANCELLED],
    [EngagementLoanStatus.QC,          EngagementLoanStatus.DELIVERED],
    [EngagementLoanStatus.QC,          EngagementLoanStatus.IN_PROGRESS],
    [EngagementLoanStatus.QC,          EngagementLoanStatus.CANCELLED],
  ];

  const INVALID_LOAN_TRANSITIONS: Array<[EngagementLoanStatus, EngagementLoanStatus]> = [
    [EngagementLoanStatus.PENDING,   EngagementLoanStatus.QC],
    [EngagementLoanStatus.PENDING,   EngagementLoanStatus.DELIVERED],
    [EngagementLoanStatus.DELIVERED, EngagementLoanStatus.PENDING],
    [EngagementLoanStatus.CANCELLED, EngagementLoanStatus.IN_PROGRESS],
  ];

  for (const [from, to] of VALID_LOAN_TRANSITIONS) {
    it(`allows loan ${from} → ${to}`, async () => {
      const doc = makeEngagement({ loans: [makeLoan({ id: 'loan-001', status: from })] });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
      });
      const svc = new EngagementService(makeDbService(container));
      await expect(svc.changeLoanStatus('eng-test-001', 'tenant-001', 'loan-001', to, 'user')).resolves.not.toThrow();
    });
  }

  for (const [from, to] of INVALID_LOAN_TRANSITIONS) {
    it(`rejects loan ${from} → ${to} with a clear error`, async () => {
      const doc = makeEngagement({ loans: [makeLoan({ id: 'loan-001', status: from })] });
      const container = makeMockContainer(doc);
      container.item = vi.fn().mockReturnValue({
        read:    vi.fn().mockResolvedValue({ resource: doc }),
        replace: vi.fn(),
      });
      const svc = new EngagementService(makeDbService(container));
      await expect(svc.changeLoanStatus('eng-test-001', 'tenant-001', 'loan-001', to, 'user')).rejects.toThrow(
        /Invalid loan status transition/,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 9. addVendorOrderToProduct
// ---------------------------------------------------------------------------

describe('addVendorOrderToProduct', () => {
  it('adds vendorOrderId to the matching product within the correct loan', async () => {
    const engagement = makeEngagement({
      loans: [
        makeLoan({
          id: 'loan-001',
          products: [
            { id: 'prod-001', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementProductStatus.PENDING, vendorOrderIds: [] },
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

    const svc = new EngagementService(makeDbService(container));
    const result = await svc.addVendorOrderToProduct('eng-test-001', 'tenant-001', 'loan-001', 'prod-001', 'ord-xyz', 'user');

    expect(result.loans[0]!.products[0]!.vendorOrderIds).toContain('ord-xyz');
    expect(saved!.loans[0]!.products[0]!.vendorOrderIds).toContain('ord-xyz');
  });

  it('is idempotent — does not add the same vendorOrderId twice', async () => {
    const engagement = makeEngagement({
      loans: [
        makeLoan({
          id: 'loan-001',
          products: [
            { id: 'prod-001', productType: EngagementProductType.FULL_APPRAISAL, status: EngagementProductStatus.ASSIGNED, vendorOrderIds: ['ord-xyz'] },
          ],
        }),
      ],
    });

    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn().mockImplementation(async (d: Engagement) => ({ resource: d })),
    });

    const svc = new EngagementService(makeDbService(container));
    const result = await svc.addVendorOrderToProduct('eng-test-001', 'tenant-001', 'loan-001', 'prod-001', 'ord-xyz', 'user');
    expect(result.loans[0]!.products[0]!.vendorOrderIds.filter((id) => id === 'ord-xyz')).toHaveLength(1);
  });

  it('throws a clear error when loanId does not exist', async () => {
    const engagement = makeEngagement({ loans: [makeLoan({ id: 'loan-001', products: [] })] });
    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.addVendorOrderToProduct('eng-test-001', 'tenant-001', 'loan-nonexistent', 'prod-001', 'ord-xyz', 'user'),
    ).rejects.toThrow(/EngagementLoan not found/);
  });

  it('throws a clear error when productId does not exist within the loan', async () => {
    const engagement = makeEngagement({ loans: [makeLoan({ id: 'loan-001', products: [] })] });
    const container = makeMockContainer(engagement);
    container.item = vi.fn().mockReturnValue({
      read:    vi.fn().mockResolvedValue({ resource: engagement }),
      replace: vi.fn(),
    });
    const svc = new EngagementService(makeDbService(container));
    await expect(
      svc.addVendorOrderToProduct('eng-test-001', 'tenant-001', 'loan-001', 'prod-nonexistent', 'ord-xyz', 'user'),
    ).rejects.toThrow(/EngagementProduct not found/);
  });
});
