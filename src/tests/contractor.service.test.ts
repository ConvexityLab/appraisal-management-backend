/**
 * Contractor Service � Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ContractorService } from '../services/contractor.service.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-con-${testRunId}`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db:  CosmosDbService;
let svc: ContractorService;

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT);
  await db.initialize();
  svc = new ContractorService(db);
}, 30_000);

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try { await db.deleteDocument(doc.container, doc.id, doc.partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// --- createContractor ---------------------------------------------------------

describe('ContractorService � createContractor', () => {
  it('persists a contractor with PENDING verification status and APPROVED risk tier', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Acme Builders',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `LIC-${testRunId}`,
      licenseState: 'CA',
      licenseExpiry: '2026-12-31',
      insuranceCertExpiry: '2026-12-31',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    expect(contractor.tenantId).toBe(TEST_TENANT);
    expect(contractor.name).toBe('Acme Builders');
    expect(contractor.licenseVerificationStatus).toBe('PENDING');
    expect(contractor.riskTier).toBe('APPROVED');

    // Round-trip read
    const readBack = await svc.getContractorById(contractor.id, TEST_TENANT);
    expect(readBack.id).toBe(contractor.id);
    expect(readBack.licenseVerificationStatus).toBe('PENDING');
  });

  it('throws when tenantId is empty', async () => {
    await expect(
      svc.createContractor({
        tenantId: '',
        name: 'Bad Contractor',
        role: 'GENERAL_CONTRACTOR',
        licenseNumber: 'X',
        licenseState: 'CA',
        licenseExpiry: '2026-01-01',
        insuranceCertExpiry: '2026-01-01',
        createdBy: 'test-runner',
      }),
    ).rejects.toThrow(/tenantId/i);
  });
});

// --- getContractorById --------------------------------------------------------

describe('ContractorService � getContractorById', () => {
  it('throws a clear error when contractor does not exist', async () => {
    await expect(svc.getContractorById(`nonexistent-${testRunId}`, TEST_TENANT))
      .rejects.toThrow(/not found/i);
  });

  it('throws when contractorId is empty', async () => {
    await expect(svc.getContractorById('', TEST_TENANT)).rejects.toThrow(/contractorId/i);
  });
});

// --- updateContractor ---------------------------------------------------------

describe('ContractorService � updateContractor', () => {
  it('applies a partial update and preserves untouched fields', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Original Name',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `LIC-UPD-${testRunId}`,
      licenseState: 'TX',
      licenseExpiry: '2025-06-30',
      insuranceCertExpiry: '2025-12-31',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const updated = await svc.updateContractor(
      contractor.id,
      TEST_TENANT,
      { name: 'Updated Name', licenseExpiry: '2027-01-01' },
      'test-runner',
    );

    expect(updated.name).toBe('Updated Name');
    expect(updated.licenseExpiry).toBe('2027-01-01');
    // Untouched fields
    expect(updated.licenseState).toBe('TX');
    expect(updated.licenseVerificationStatus).toBe('PENDING');

    // Verify persisted
    const readBack = await svc.getContractorById(contractor.id, TEST_TENANT);
    expect(readBack.name).toBe('Updated Name');
    expect(readBack.licenseExpiry).toBe('2027-01-01');
    expect(readBack.licenseState).toBe('TX');
  });

  it('throws when contractor does not exist', async () => {
    await expect(
      svc.updateContractor(`nonexistent-${testRunId}`, TEST_TENANT, { name: 'Ghost' }, 'test-runner'),
    ).rejects.toThrow(/not found/i);
  });
});

// --- listContractors ----------------------------------------------------------

describe('ContractorService � listContractors', () => {
  it('returns all contractors for a tenant', async () => {
    const tenantId = `${TEST_TENANT}-list`;
    const [c1, c2] = await Promise.all([
      svc.createContractor({ tenantId, name: 'Builder A', role: 'GENERAL_CONTRACTOR', licenseNumber: `LA-${testRunId}`, licenseState: 'CA', licenseExpiry: '2026-01-01', insuranceCertExpiry: '2026-01-01', createdBy: 'test-runner' }),
      svc.createContractor({ tenantId, name: 'Builder B', role: 'GENERAL_CONTRACTOR', licenseNumber: `LB-${testRunId}`, licenseState: 'CA', licenseExpiry: '2026-01-01', insuranceCertExpiry: '2026-01-01', createdBy: 'test-runner' }),
    ]);
    track('contractors', c1.id, c1.tenantId);
    track('contractors', c2.id, c2.tenantId);

    const all = await svc.listContractors(tenantId);
    const ids = all.map(c => c.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);
  });

  it('filters by riskTier when provided', async () => {
    const tenantId = `${TEST_TENANT}-filter`;
    const contractor = await svc.createContractor({
      tenantId, name: 'Filtered Builder', role: 'GENERAL_CONTRACTOR', licenseNumber: `LC-${testRunId}`,
      licenseState: 'FL', licenseExpiry: '2026-01-01', insuranceCertExpiry: '2026-01-01', createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const approved = await svc.listContractors(tenantId, { riskTier: 'APPROVED' });
    expect(approved.some(c => c.id === contractor.id)).toBe(true);

    const watchlist = await svc.listContractors(tenantId, { riskTier: 'WATCH' });
    expect(watchlist.some(c => c.id === contractor.id)).toBe(false);
  });

  it('returns an empty array for a tenant with no contractors', async () => {
    const result = await svc.listContractors(`no-contractors-${testRunId}`);
    expect(result).toEqual([]);
  });
});

// --- recordManualVerification -------------------------------------------------

describe('ContractorService � recordManualVerification', () => {
  it('sets MANUAL_VERIFIED status with verifier and timestamp, persisted to Cosmos', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Verify Me',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `LV-${testRunId}`,
      licenseState: 'NY',
      licenseExpiry: '2027-01-01',
      insuranceCertExpiry: '2027-01-01',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const verified = await svc.recordManualVerification(contractor.id, TEST_TENANT, 'senior-underwriter');

    expect(verified.licenseVerificationStatus).toBe('MANUAL_VERIFIED');
    expect(verified.licenseVerifiedBy).toBe('senior-underwriter');
    expect(verified.licenseVerifiedAt).toBeDefined();

    // Verify persisted
    const readBack = await svc.getContractorById(contractor.id, TEST_TENANT);
    expect(readBack.licenseVerificationStatus).toBe('MANUAL_VERIFIED');
    expect(readBack.licenseVerifiedBy).toBe('senior-underwriter');
  });

  it('throws when contractor does not exist', async () => {
    await expect(
      svc.recordManualVerification(`nonexistent-${testRunId}`, TEST_TENANT, 'verifier'),
    ).rejects.toThrow(/not found/i);
  });
});

// --- verifyLicenseManual ------------------------------------------------------

describe('ContractorService — verifyLicenseManual', () => {
  it('sets MANUAL_VERIFIED status and stores the doc URL', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'DocVerify GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `DV-${testRunId}`,
      licenseState: 'OR',
      licenseExpiry: '2027-06-01',
      insuranceCertExpiry: '2027-01-01',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const docUrl = 'https://storage.example.com/licenses/dv-license.pdf';
    const updated = await svc.verifyLicenseManual(
      contractor.id,
      TEST_TENANT,
      docUrl,
      'compliance-officer'
    );

    expect(updated.licenseVerificationStatus).toBe('MANUAL_VERIFIED');
    expect(updated.manualVerificationDocUrl).toBe(docUrl);
    expect(updated.licenseVerifiedBy).toBe('compliance-officer');
    expect(updated.licenseVerifiedAt).toBeDefined();

    // Confirm persisted
    const readBack = await svc.getContractorById(contractor.id, TEST_TENANT);
    expect(readBack.manualVerificationDocUrl).toBe(docUrl);
    expect(readBack.licenseVerificationStatus).toBe('MANUAL_VERIFIED');
  });

  it('rejects when docUrl is empty', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'DocVerify Empty',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `DVE-${testRunId}`,
      licenseState: 'OR',
      licenseExpiry: '2027-06-01',
      insuranceCertExpiry: '2027-01-01',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    await expect(
      svc.verifyLicenseManual(contractor.id, TEST_TENANT, '', 'officer')
    ).rejects.toThrow(/docUrl/i);
  });

  it('rejects when verifiedBy is empty', async () => {
    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'DocVerify NoUser',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `DVN-${testRunId}`,
      licenseState: 'OR',
      licenseExpiry: '2027-06-01',
      insuranceCertExpiry: '2027-01-01',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    await expect(
      svc.verifyLicenseManual(contractor.id, TEST_TENANT, 'https://example.com/doc.pdf', '')
    ).rejects.toThrow(/verifiedBy/i);
  });
});

// --- verifyLicenseApi ---------------------------------------------------------

describe('ContractorService — verifyLicenseApi', () => {
  it('sets API_VERIFIED when license is valid and not expired', async () => {
    const futurExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'API Verify GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `AV-${testRunId}`,   // non-empty → stub returns verified=true
      licenseState: 'WA',
      licenseExpiry: futurExpiry,          // future → stub returns verified=true
      insuranceCertExpiry: futurExpiry,
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const updated = await svc.verifyLicenseApi(contractor.id, TEST_TENANT);

    expect(updated.licenseVerificationStatus).toBe('API_VERIFIED');
    expect(updated.apiVerificationAt).toBeDefined();
    expect(updated.apiVerificationSource).toMatch(/stub/i);
  });

  it('sets FAILED when license is expired (stub returns verified=false)', async () => {
    const pastExpiry = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const contractor = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Expired API GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `EXP-${testRunId}`,
      licenseState: 'WA',
      licenseExpiry: pastExpiry,           // expired → stub returns verified=false
      insuranceCertExpiry: '2027-01-01',
      createdBy: 'test-runner',
    });
    track('contractors', contractor.id, contractor.tenantId);

    const updated = await svc.verifyLicenseApi(contractor.id, TEST_TENANT);

    // Stub returns verified=false for expired licenses → status should be FAILED
    expect(['API_NOT_FOUND', 'FAILED']).toContain(updated.licenseVerificationStatus);
  });
});

// --- getContractorProjects ----------------------------------------------------

describe('ContractorService — getContractorProjects', () => {
  const GC_ID_PROJ = `gc-proj-${testRunId}`;
  const LOAN_PROJ_A = `loan-gc-proj-a-${testRunId}`;
  const LOAN_PROJ_B = `loan-gc-proj-b-${testRunId}`;

  const futureMat = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const futureComp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function makeLoanDoc(id: string, gcId: string, status: string) {
    return {
      id,
      tenantId: TEST_TENANT,
      loanNumber: `LN-${id.slice(-4)}`,
      loanType: 'FIX_AND_FLIP',
      status,
      loanAmount: 100_000,
      interestRate: 0.12,
      maturityDate: futureMat,
      interestReserveAmount: 10_000,
      interestReserveDrawn: 0,
      propertyAddress: { street: '1 Test St', city: 'Portland', state: 'OR', zipCode: '97201', county: 'Multnomah' },
      propertyType: 'Single Family Residential',
      borrowerId: 'borrower-001',
      borrowerName: 'Test Borrower',
      generalContractorId: gcId,
      budgetId: `budget-${id}-v1`,
      totalDrawsApproved: 0,
      totalDrawsDisbursed: 0,
      percentComplete: 0,
      retainagePercent: 10,
      retainageHeld: 0,
      retainageReleased: 0,
      milestones: [],
      expectedCompletionDate: futureComp,
      createdBy: 'test-runner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  beforeAll(async () => {
    // Create two loans assigned to GC_ID_PROJ: one ACTIVE, one APPROVED
    const loanA = makeLoanDoc(LOAN_PROJ_A, GC_ID_PROJ, 'ACTIVE');
    const loanB = makeLoanDoc(LOAN_PROJ_B, GC_ID_PROJ, 'APPROVED');
    await Promise.all([
      db.createDocument('construction-loans', loanA),
      db.createDocument('construction-loans', loanB),
    ]);
    track('construction-loans', LOAN_PROJ_A, TEST_TENANT);
    track('construction-loans', LOAN_PROJ_B, TEST_TENANT);
  });

  it('returns ACTIVE and APPROVED loans assigned to the contractor', async () => {
    const projects = await svc.getContractorProjects(GC_ID_PROJ, TEST_TENANT);
    const ids = projects.map(p => p.id);
    expect(ids).toContain(LOAN_PROJ_A);
    expect(ids).toContain(LOAN_PROJ_B);
  });

  it('does not return COMPLETED loans', async () => {
    const LOAN_COMPLETED = `loan-gc-done-${testRunId}`;
    const loanDone = makeLoanDoc(LOAN_COMPLETED, GC_ID_PROJ, 'COMPLETED');
    await db.createDocument('construction-loans', loanDone);
    track('construction-loans', LOAN_COMPLETED, TEST_TENANT);

    const projects = await svc.getContractorProjects(GC_ID_PROJ, TEST_TENANT);
    const ids = projects.map(p => p.id);
    expect(ids).not.toContain(LOAN_COMPLETED);
  });

  it('returns empty array for a contractor with no loans', async () => {
    const results = await svc.getContractorProjects(`no-loans-gc-${testRunId}`, TEST_TENANT);
    expect(results).toEqual([]);
  });

  it('throws when contractorId is empty', async () => {
    await expect(svc.getContractorProjects('', TEST_TENANT)).rejects.toThrow(/contractorId/i);
  });
});

// --- addContractorToLoan ------------------------------------------------------

describe('ContractorService — addContractorToLoan', () => {
  const LOAN_ATTACH = `loan-attach-${testRunId}`;
  const futureMat   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const futureComp  = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  beforeAll(async () => {
    const loan = {
      id: LOAN_ATTACH,
      tenantId: TEST_TENANT,
      loanNumber: `LN-ATTACH`,
      loanType: 'REHAB',
      status: 'ACTIVE',
      loanAmount: 150_000,
      interestRate: 0.115,
      maturityDate: futureMat,
      interestReserveAmount: 15_000,
      interestReserveDrawn: 0,
      propertyAddress: { street: '2 Main St', city: 'Seattle', state: 'WA', zipCode: '98101', county: 'King' },
      propertyType: 'Single Family Residential',
      borrowerId: 'borrower-002',
      borrowerName: 'Attach Test Borrower',
      budgetId: `budget-${LOAN_ATTACH}-v1`,
      totalDrawsApproved: 0,
      totalDrawsDisbursed: 0,
      percentComplete: 0,
      retainagePercent: 10,
      retainageHeld: 0,
      retainageReleased: 0,
      milestones: [],
      expectedCompletionDate: futureComp,
      createdBy: 'test-runner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.createDocument('construction-loans', loan);
    track('construction-loans', LOAN_ATTACH, TEST_TENANT);
  });

  it('links an approved contractor to a loan and persists generalContractorId', async () => {
    const gc = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Link GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `LGC-${testRunId}`,
      licenseState: 'WA',
      licenseExpiry: futureComp,
      insuranceCertExpiry: futureComp,
      createdBy: 'test-runner',
    });
    track('contractors', gc.id, gc.tenantId);

    const updatedLoan = await svc.addContractorToLoan(LOAN_ATTACH, gc.id, TEST_TENANT);

    expect(updatedLoan.generalContractorId).toBe(gc.id);

    // Confirm persisted
    const readBack = await db.getDocument<{ generalContractorId?: string }>(
      'construction-loans', LOAN_ATTACH, TEST_TENANT
    );
    expect(readBack?.generalContractorId).toBe(gc.id);
  });

  it('throws when contractor is DISQUALIFIED', async () => {
    const gc = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Disqualified GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `DQG-${testRunId}`,
      licenseState: 'WA',
      licenseExpiry: futureComp,
      insuranceCertExpiry: futureComp,
      createdBy: 'test-runner',
    });
    track('contractors', gc.id, gc.tenantId);
    // Manually set to DISQUALIFIED
    await db.upsertDocument('contractors', { ...gc, riskTier: 'DISQUALIFIED' });

    await expect(
      svc.addContractorToLoan(LOAN_ATTACH, gc.id, TEST_TENANT)
    ).rejects.toThrow(/DISQUALIFIED/i);
  });

  it('throws when loan does not exist', async () => {
    const gc = await svc.createContractor({
      tenantId: TEST_TENANT,
      name: 'Ghost Loan GC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: `GLG-${testRunId}`,
      licenseState: 'WA',
      licenseExpiry: futureComp,
      insuranceCertExpiry: futureComp,
      createdBy: 'test-runner',
    });
    track('contractors', gc.id, gc.tenantId);

    await expect(
      svc.addContractorToLoan(`nonexistent-loan-${testRunId}`, gc.id, TEST_TENANT)
    ).rejects.toThrow(/not found/i);
  });

  it('throws when loanId is empty', async () => {
    await expect(
      svc.addContractorToLoan('', 'any-gc', TEST_TENANT)
    ).rejects.toThrow(/loanId/i);
  });
});