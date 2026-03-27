/**
 * Mock LOS Provider
 *
 * Returns realistic simulated responses for local development and testing.
 * This is the default provider when no real LOS credentials are configured.
 *
 * All returned loan data is deterministic given a loan number — the same
 * loanNumber always produces the same loan record, so tests are stable.
 */

import {
  LosProvider,
  LosLoan,
  LosImportRequest,
  LosImportResult,
  LosPushRequest,
  LosPushResult,
} from './los-provider.interface.js';

export class MockLosProvider implements LosProvider {
  readonly name = 'Mock LOS (simulated)';

  /** In-memory store so pushOrder + getLoan round-trips work in tests. */
  private readonly pushed = new Map<string, LosPushRequest>();

  isAvailable(): boolean {
    return true; // always available
  }

  async importOrder(request: LosImportRequest): Promise<LosImportResult> {
    await this.delay(200);

    const loan = this.buildMockLoan(request.loanNumber);
    const orderId = `mock-los-${request.tenantId}-${request.loanNumber}-${Date.now()}`;

    console.log(`🧪 [MOCK LOS] importOrder loanNumber=${request.loanNumber} → orderId=${orderId}`);

    return { orderId, loan, created: true };
  }

  async pushOrder(request: LosPushRequest): Promise<LosPushResult> {
    await this.delay(150);

    this.pushed.set(request.loanNumber, request);
    const confirmationId = `mock-los-confirm-${Date.now()}`;

    console.log(`🧪 [MOCK LOS] pushOrder loanNumber=${request.loanNumber} status=${request.statusCode} → ${confirmationId}`);

    return {
      success: true,
      losConfirmationId: confirmationId,
      message: `Mock LOS updated loan ${request.loanNumber} to status ${request.statusCode}`,
    };
  }

  async getLoan(loanNumber: string, _tenantId: string): Promise<LosLoan | null> {
    await this.delay(100);

    // Simulate "not found" for known sentinel values used in tests
    if (loanNumber === 'NOTFOUND') return null;

    console.log(`🧪 [MOCK LOS] getLoan loanNumber=${loanNumber}`);
    return this.buildMockLoan(loanNumber);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private buildMockLoan(loanNumber: string): LosLoan {
    // Hash loan number to a deterministic suffix so each loan looks distinct
    const seed = loanNumber.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const zip  = String(10000 + (seed % 89999)).padStart(5, '0');
    const amt  = 250000 + (seed % 500000);

    return {
      loanNumber,
      borrowerName: `Test Borrower ${seed % 100}`,
      ...(seed % 3 === 0 ? { coBorrowerName: `Co-Borrower ${seed % 50}` } : {}),
      loanAmountCents: amt * 100,
      loanPurpose: seed % 2 === 0 ? 'Purchase' : 'Refinance',
      propertyAddress: `${100 + (seed % 900)} Main St`,
      propertyCity: 'Springfield',
      propertyState: 'IL',
      propertyZip: zip,
      losStatus: 'Processing',
      lenderName: 'Mock Mortgage Co.',
      loanOfficerName: `Loan Officer ${seed % 10}`,
      loanOfficerEmail: `lo${seed % 10}@mockmortgage.example`,
      loanOfficerPhone: `555-${String(1000 + (seed % 9000))}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
