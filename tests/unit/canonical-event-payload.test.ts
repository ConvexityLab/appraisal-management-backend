import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPayloadFromOrder,
  buildCanonicalPayloadFromSnapshot,
} from '../../src/integrations/outbound/canonical-event-payload.js';
import type { AppraisalOrder } from '../../src/types/index.js';

function makeOrder(overrides: Partial<AppraisalOrder>): AppraisalOrder {
  return {
    id: 'order-1',
    clientId: 'client-1',
    tenantId: 'tenant-1',
    orderNumber: 'ORD-1',
    propertyAddress: { streetAddress: '', city: '', state: '', zipCode: '', county: '' } as any,
    propertyDetails: { propertyType: '', occupancy: '', features: [] } as any,
    loanInformation: { loanAmount: 0, loanType: '', loanPurpose: '' } as any,
    borrowerInformation: { firstName: '', lastName: '' } as any,
    contactInformation: {} as any,
    orderType: 'STANDARD' as any,
    productType: 'FNMA-1004' as any,
    dueDate: new Date(),
    rushOrder: false,
    status: 'PENDING' as any,
    priority: 'NORMAL' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'tester',
    tags: [],
    metadata: {},
    ...overrides,
  } as AppraisalOrder;
}

describe('buildCanonicalPayloadFromOrder', () => {
  it('returns null for null/undefined order', () => {
    expect(buildCanonicalPayloadFromOrder(null)).toBeNull();
    expect(buildCanonicalPayloadFromOrder(undefined)).toBeNull();
  });

  it('emits eventCanonicalVersion 1.0 + populated branches', () => {
    const out = buildCanonicalPayloadFromOrder(
      makeOrder({
        propertyAddress: {
          streetAddress: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          county: 'Sangamon',
        } as any,
        loanInformation: {
          loanAmount: 320000,
          loanType: 'Conventional',
          loanPurpose: 'Purchase',
          ltv: 80,
        } as any,
      }),
    );
    expect(out?.eventCanonicalVersion).toBe('1.0');
    expect(out?.subject?.address?.streetAddress).toBe('123 Main St');
    expect(out?.loan?.baseLoanAmount).toBe(320000);
    expect(out?.ratios?.loanToValueRatioPercent).toBe(80);
  });

  it('attaches snapshotId when supplied', () => {
    const out = buildCanonicalPayloadFromOrder(
      makeOrder({
        propertyAddress: { streetAddress: '1 X St', city: 'Y', state: 'IL', zipCode: '62701', county: 'Z' } as any,
      }),
      'snapshot-123',
    );
    expect(out?.snapshotId).toBe('snapshot-123');
  });

  it('omits subject/loan/ratios when not present', () => {
    const out = buildCanonicalPayloadFromOrder(
      makeOrder({
        propertyAddress: { streetAddress: '1 X St', city: 'Y', state: 'IL', zipCode: '62701', county: 'Z' } as any,
        loanInformation: { loanAmount: 0, loanType: '', loanPurpose: '' } as any,
      }),
    );
    expect(out?.subject).toBeDefined();
    expect(out?.loan?.baseLoanAmount).toBe(0); // baseLoanAmount=0 still emits loan
    expect(out?.ratios).toBeUndefined();
  });
});

describe('buildCanonicalPayloadFromSnapshot', () => {
  it('returns null for null/empty input', () => {
    expect(buildCanonicalPayloadFromSnapshot(null)).toBeNull();
    expect(buildCanonicalPayloadFromSnapshot({})).toBeNull();
  });

  it('returns null when only snapshotId would be present', () => {
    // Snapshot was rebuilt before any canonical branches were populated.
    // Without a snapshotId either, there's nothing useful to publish.
    expect(buildCanonicalPayloadFromSnapshot({}, undefined)).toBeNull();
  });

  it('emits a snapshotId-only payload when caller supplies one', () => {
    // Empty canonical fragment but a snapshotId — useful when the consumer
    // can fetch the full snapshot from the snapshotId reference.
    const out = buildCanonicalPayloadFromSnapshot({}, 'snap-1');
    expect(out).toEqual({ eventCanonicalVersion: '1.0', snapshotId: 'snap-1' });
  });

  it('passes through subject + loan + ratios from snapshot canonical', () => {
    const out = buildCanonicalPayloadFromSnapshot(
      {
        subject: {
          address: {
            streetAddress: '17 David Dr',
            unit: null,
            city: 'Johnston',
            state: 'RI',
            zipCode: '02919',
            county: 'Providence',
          },
        } as any,
        loan: {
          baseLoanAmount: 500000,
          loanPurposeType: 'Refinance',
          mortgageType: 'Conventional',
          lienPriorityType: null,
          firstLienBalance: null,
          secondLienBalance: null,
          totalLienBalance: null,
          refinanceCashOutDeterminationType: null,
          refinanceCashOutAmount: null,
          isCashOutRefinance: null,
          occupancyType: null,
          interestRatePercent: null,
          loanTermMonths: null,
          loanNumber: null,
        },
      },
      'snap-2',
    );
    expect(out?.subject?.address?.city).toBe('Johnston');
    expect(out?.loan?.loanPurposeType).toBe('Refinance');
    expect(out?.snapshotId).toBe('snap-2');
  });

  it('does not emit branches that are absent in canonical', () => {
    const out = buildCanonicalPayloadFromSnapshot(
      {
        subject: { address: { streetAddress: '1 X St', unit: null, city: 'Y', state: 'IL', zipCode: '62701', county: 'Z' } } as any,
      },
      undefined,
    );
    expect(out?.subject).toBeDefined();
    expect(out?.loan).toBeUndefined();
    expect(out?.ratios).toBeUndefined();
  });
});
