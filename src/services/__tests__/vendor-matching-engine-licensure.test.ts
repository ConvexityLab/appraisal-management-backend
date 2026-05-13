/**
 * Tests the licensure HARD_GATE branch on VendorMatchingEngine.scoreVendor.
 *
 * The engine's full scoring path needs a CosmosDbService and rules provider,
 * so we drive scoreVendor via a thin sub-class that bypasses I/O paths and
 * supplies deterministic stubs. This keeps the test focused on the licensure
 * decision branch, not the rest of the scoring pipeline.
 */

import { describe, it, expect, vi } from 'vitest';
import { VendorMatchingEngine } from '../vendor-matching-engine.service';
import type { VendorMatchingCriteriaProfile } from '../../types/vendor-marketplace.types';

const CRITERIA_LIC_HARD_GATE: VendorMatchingCriteriaProfile['criteria'] = {
  performance: { enabled: true, weight: 0.30, mode: 'SCORED' },
  availability: { enabled: true, weight: 0.25, mode: 'SCORED' },
  proximity: { enabled: true, weight: 0.20, mode: 'SCORED', primaryRadiusMiles: 50 },
  experience: { enabled: true, weight: 0.15, mode: 'SCORED' },
  cost: { enabled: true, weight: 0.10, mode: 'SCORED' },
  licensure: { enabled: true, weight: 0, mode: 'HARD_GATE' },
};

const CRITERIA_LIC_OFF: VendorMatchingCriteriaProfile['criteria'] = {
  ...CRITERIA_LIC_HARD_GATE,
  licensure: { enabled: false, weight: 0, mode: 'HARD_GATE' },
};

class TestableEngine extends VendorMatchingEngine {
  constructor() {
    super(/* rulesProvider */ {
      evaluateForVendors: vi.fn().mockResolvedValue([]),
    } as never);
  }
  // Expose the private scorer for direct test access.
  public scoreOne(...args: Parameters<TestableEngine['callScoreVendor']>) {
    return this.callScoreVendor(...args);
  }
  private callScoreVendor(
    vendor: any,
    request: any,
    propertyCoords: any,
    distance: number | null,
    ruleResult: any,
    criteria?: VendorMatchingCriteriaProfile['criteria'],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).scoreVendor(vendor, request, propertyCoords, distance, ruleResult, criteria);
  }
}

describe('VendorMatchingEngine licensure HARD_GATE', () => {
  function baseRequest() {
    return {
      orderId: 'o-1',
      tenantId: 't-1',
      propertyAddress: '123 Main St, Phoenix AZ 85001',
      propertyType: 'SFR' as never,
      dueDate: new Date('2026-06-01'),
      urgency: 'STANDARD' as const,
      productId: 'FULL_APPRAISAL',
    };
  }

  function vendorWithoutAZ() {
    return {
      id: 'v-1',
      name: 'Some Vendor',
      licensedStates: ['CA', 'TX'],
      capabilities: [],
      typicalFees: { SFR: 500 },
      staffType: 'external',
      performance: { overallScore: 80, tier: 'GOLD' },
    };
  }

  function vendorWithAZ() {
    return {
      ...vendorWithoutAZ(),
      licensedStates: ['CA', 'TX', 'AZ'],
    };
  }

  it('returns 0 score with a licensure denial reason when HARD_GATE + vendor not licensed in property state', async () => {
    const engine = new TestableEngine();
    // Stub the perf / availability helpers so the path doesn't hit Cosmos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorPerformance').mockResolvedValue({ overallScore: 80, tier: 'GOLD' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorAvailability').mockResolvedValue({
      currentLoad: 1,
      maxCapacity: 5,
      availableSlots: 4,
      isAcceptingOrders: true,
    });

    const result = await engine.scoreOne(
      vendorWithoutAZ(),
      baseRequest(),
      null,
      10,
      undefined,
      CRITERIA_LIC_HARD_GATE,
    );

    expect(result.matchScore).toBe(0);
    expect(result.matchReasons.join(' ').toLowerCase()).toMatch(/licen/);
  });

  it('does NOT gate when licensure is disabled, even for the same out-of-state vendor', async () => {
    const engine = new TestableEngine();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorPerformance').mockResolvedValue({ overallScore: 80, tier: 'GOLD' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorAvailability').mockResolvedValue({
      currentLoad: 1,
      maxCapacity: 5,
      availableSlots: 4,
      isAcceptingOrders: true,
    });
    const result = await engine.scoreOne(
      vendorWithoutAZ(),
      baseRequest(),
      null,
      10,
      undefined,
      CRITERIA_LIC_OFF,
    );
    expect(result.matchScore).toBeGreaterThan(0);
  });

  it('lets a licensed vendor through the gate', async () => {
    const engine = new TestableEngine();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorPerformance').mockResolvedValue({ overallScore: 80, tier: 'GOLD' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'getVendorAvailability').mockResolvedValue({
      currentLoad: 1,
      maxCapacity: 5,
      availableSlots: 4,
      isAcceptingOrders: true,
    });
    const result = await engine.scoreOne(
      vendorWithAZ(),
      baseRequest(),
      null,
      10,
      undefined,
      CRITERIA_LIC_HARD_GATE,
    );
    expect(result.matchScore).toBeGreaterThan(0);
  });
});
