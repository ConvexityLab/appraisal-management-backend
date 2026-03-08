/**
 * Construction Loan Service — Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionLoanService } from '../services/construction-loan.service.js';
import type { CreateConstructionLoanInput } from '../services/construction-loan.service.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell before running jest: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-${testRunId}`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db: CosmosDbService;
let svc: ConstructionLoanService;

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT);
  await db.initialize();
  svc = new ConstructionLoanService(db);
}, 30_000);

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try { await db.deleteDocument(doc.container, doc.id, doc.partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// --- Helpers -----------------------------------------------------------------

function makeInput(overrides: Partial<CreateConstructionLoanInput> = {}): CreateConstructionLoanInput {
  return {
    tenantId:               TEST_TENANT,
    loanNumber:             `CL-${testRunId}`,
    loanType:               'FIX_FLIP',
    loanAmount:             350_000,
    interestRate:           0.115,
    maturityDate:           '2027-03-01',
    interestReserveAmount:  25_000,
    propertyAddress:        { street: '123 Elm St', city: 'Austin', state: 'TX', zipCode: '78701', county: 'Travis' },
    propertyType:           'Single Family Residential',
    borrowerId:             'borrower-1',
    borrowerName:           'Jane Borrower',
    expectedCompletionDate: '2026-12-01',
    retainagePercent:       10,
    createdBy:              'test-runner',
    ...overrides,
  };
}

// --- Create & Read ------------------------------------------------------------

describe('ConstructionLoanService — create & read', () => {
  it('creates a loan in UNDERWRITING status with all running totals at zero', async () => {
    const loan = await svc.createLoan(makeInput());
    track('construction-loans', loan.id, loan.tenantId);

    expect(loan.status).toBe('UNDERWRITING');
    expect(loan.tenantId).toBe(TEST_TENANT);
    expect(loan.loanType).toBe('FIX_FLIP');
    expect(loan.totalDrawsApproved).toBe(0);
    expect(loan.totalDrawsDisbursed).toBe(0);
    expect(loan.percentComplete).toBe(0);
    expect(loan.retainageHeld).toBe(0);
    expect(loan.retainageReleased).toBe(0);
    expect(loan.interestReserveDrawn).toBe(0);
    expect(loan.milestones).toEqual([]);
  });

  it('reads back a created loan by ID', async () => {
    const created = await svc.createLoan(makeInput({ loanNumber: `CL-READ-${testRunId}` }));
    track('construction-loans', created.id, created.tenantId);

    const fetched = await svc.getLoanById(created.id, TEST_TENANT);
    expect(fetched.id).toBe(created.id);
    expect(fetched.loanNumber).toBe(created.loanNumber);
    expect(fetched.tenantId).toBe(TEST_TENANT);
  });

  it('throws a clear error when the loan does not exist', async () => {
    await expect(svc.getLoanById(`nonexistent-${testRunId}`, TEST_TENANT))
      .rejects.toThrow(/not found/i);
  });
});

// --- Input validation (throws before DB) -------------------------------------

describe('ConstructionLoanService — input validation', () => {
  it('throws when loanId is empty', async () => {
    await expect(svc.getLoanById('', TEST_TENANT)).rejects.toThrow(/loanId/i);
  });

  it('throws when tenantId is empty', async () => {
    await expect(svc.getLoanById('some-id', '')).rejects.toThrow(/tenantId/i);
  });
});

// --- Status transitions -------------------------------------------------------

describe('ConstructionLoanService — updateLoanStatus', () => {
  it('advances status along a valid transition and persists it', async () => {
    const loan = await svc.createLoan(makeInput({ loanNumber: `CL-STATUS-${testRunId}` }));
    track('construction-loans', loan.id, loan.tenantId);

    const updated = await svc.updateLoanStatus(loan.id, TEST_TENANT, 'APPROVED', 'test-runner');
    expect(updated.status).toBe('APPROVED');

    const persisted = await svc.getLoanById(loan.id, TEST_TENANT);
    expect(persisted.status).toBe('APPROVED');
  });

  it('throws for an invalid transition and leaves the doc unchanged in Cosmos', async () => {
    const loan = await svc.createLoan(makeInput({ loanNumber: `CL-BADTRANS-${testRunId}` }));
    track('construction-loans', loan.id, loan.tenantId);

    await expect(svc.updateLoanStatus(loan.id, TEST_TENANT, 'COMPLETED', 'test-runner'))
      .rejects.toThrow(/invalid transition/i);

    const unchanged = await svc.getLoanById(loan.id, TEST_TENANT);
    expect(unchanged.status).toBe('UNDERWRITING');
  });

  it('allows the full UNDERWRITING ? APPROVED ? ACTIVE ? IN_DEFAULT lifecycle', async () => {
    const loan = await svc.createLoan(makeInput({ loanNumber: `CL-LIFECYCLE-${testRunId}` }));
    track('construction-loans', loan.id, loan.tenantId);

    await svc.updateLoanStatus(loan.id, TEST_TENANT, 'APPROVED', 'test-runner');
    await svc.updateLoanStatus(loan.id, TEST_TENANT, 'ACTIVE', 'test-runner');
    const defaulted = await svc.updateLoanStatus(loan.id, TEST_TENANT, 'IN_DEFAULT', 'test-runner');

    expect(defaulted.status).toBe('IN_DEFAULT');
    const persisted = await svc.getLoanById(loan.id, TEST_TENANT);
    expect(persisted.status).toBe('IN_DEFAULT');
  });
});

// --- listLoans ----------------------------------------------------------------

describe('ConstructionLoanService — listLoans', () => {
  it('returns all loans for the tenant and supports status filter', async () => {
    const a = await svc.createLoan(makeInput({ loanNumber: `CL-LIST-A-${testRunId}` }));
    const b = await svc.createLoan(makeInput({ loanNumber: `CL-LIST-B-${testRunId}` }));
    track('construction-loans', a.id, a.tenantId);
    track('construction-loans', b.id, b.tenantId);

    const all = await svc.listLoans(TEST_TENANT);
    expect(all.map(l => l.id)).toContain(a.id);
    expect(all.map(l => l.id)).toContain(b.id);

    const filtered = await svc.listLoans(TEST_TENANT, { status: 'UNDERWRITING' });
    expect(filtered.every(l => l.status === 'UNDERWRITING')).toBe(true);
    expect(filtered.map(l => l.id)).toContain(a.id);
  });

  it('returns empty array when no loans exist for the tenant', async () => {
    const result = await svc.listLoans(`no-loans-tenant-${testRunId}`);
    expect(result).toEqual([]);
  });
});