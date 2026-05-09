import { describe, expect, it } from 'vitest';
import { VendorMatchingEngine } from '../../src/services/vendor-matching-engine.service.js';
import type {
  VendorAvailability,
  VendorPerformanceMetrics,
} from '../../src/types/vendor-marketplace.types.js';

const engine = new VendorMatchingEngine();

// Type-bypass helpers — the scoring methods are private (correctly so) but pure;
// testing them directly gives precise band-edge coverage without needing to mock
// the DB-touching methods (getVendorPerformance, getVendorAvailability).
const e = engine as any;

function makePerformance(overrides: Partial<VendorPerformanceMetrics> = {}): VendorPerformanceMetrics {
  return {
    id: 'perf-1',
    vendorId: 'v1',
    tenantId: 't1',
    qualityScore: 80,
    revisionRate: 0.05,
    complianceScore: 90,
    accuracyScore: 85,
    avgTurnaroundTime: 7,
    onTimeDeliveryRate: 0.95,
    acceptanceSpeed: 2,
    completionRate: 0.98,
    cancellationRate: 0.02,
    communicationScore: 85,
    totalOrdersCompleted: 100,
    ordersInProgress: 5,
    ordersLast30Days: 20,
    ordersLast90Days: 60,
    certifications: [],
    coverageAreas: [],
    propertyTypes: [],
    propertyTypeExpertise: {},
    avgFeeQuoted: 500,
    feeAcceptanceRate: 0.85,
    overallScore: 80,
    tier: 'GOLD',
    lastUpdated: '2026-05-08',
    calculatedAt: '2026-05-08',
    dataPointsCount: 100,
    ...overrides,
  } as VendorPerformanceMetrics;
}

function makeAvailability(overrides: Partial<VendorAvailability> = {}): VendorAvailability {
  return {
    id: 'avail-1',
    vendorId: 'v1',
    currentLoad: 0,
    maxCapacity: 10,
    availableSlots: 10,
    isAcceptingOrders: true,
    availability: [],
    blackoutDates: [],
    serviceAreas: [],
    currentStatus: 'AVAILABLE',
    statusUpdatedAt: '2026-05-08',
    autoAcceptEnabled: false,
    ...overrides,
  } as VendorAvailability;
}

describe('VendorMatchingEngine.calculatePerformanceScore', () => {
  it('returns 0 for null performance', () => {
    expect(e.calculatePerformanceScore(null)).toBe(0);
  });

  it('returns overallScore directly', () => {
    expect(e.calculatePerformanceScore(makePerformance({ overallScore: 0 }))).toBe(0);
    expect(e.calculatePerformanceScore(makePerformance({ overallScore: 50 }))).toBe(50);
    expect(e.calculatePerformanceScore(makePerformance({ overallScore: 100 }))).toBe(100);
  });

  it('returns 0 when overallScore is undefined', () => {
    const perf = makePerformance();
    delete (perf as any).overallScore;
    expect(e.calculatePerformanceScore(perf)).toBe(0);
  });
});

describe('VendorMatchingEngine.calculateAvailabilityScore', () => {
  it('returns 0 for null availability', () => {
    expect(e.calculateAvailabilityScore(null)).toBe(0);
  });

  it('returns 0 when isAcceptingOrders is false', () => {
    expect(e.calculateAvailabilityScore(makeAvailability({ isAcceptingOrders: false }))).toBe(0);
  });

  describe('blackout dates', () => {
    it('returns 0 when dueDate falls within a blackout range (inclusive of start)', () => {
      const avail = makeAvailability({
        availableSlots: 10,
        blackoutDates: [{ startDate: '2026-06-01', endDate: '2026-06-10', reason: 'PTO' } as any],
      });
      expect(e.calculateAvailabilityScore(avail, new Date('2026-06-01'))).toBe(0);
    });

    it('returns 0 when dueDate falls within a blackout range (inclusive of end)', () => {
      const avail = makeAvailability({
        availableSlots: 10,
        blackoutDates: [{ startDate: '2026-06-01', endDate: '2026-06-10', reason: 'PTO' } as any],
      });
      expect(e.calculateAvailabilityScore(avail, new Date('2026-06-10'))).toBe(0);
    });

    it('does not zero when dueDate is outside the blackout range', () => {
      const avail = makeAvailability({
        availableSlots: 10,
        blackoutDates: [{ startDate: '2026-06-01', endDate: '2026-06-10', reason: 'PTO' } as any],
      });
      expect(e.calculateAvailabilityScore(avail, new Date('2026-06-11'))).toBe(100);
    });

    it('ignores malformed blackout entries', () => {
      const avail = makeAvailability({
        availableSlots: 10,
        blackoutDates: [{ reason: 'malformed' } as any],
      });
      expect(e.calculateAvailabilityScore(avail, new Date('2026-06-01'))).toBe(100);
    });
  });

  describe('capacity bands', () => {
    it('returns 100 when availableSlots >= 5 (edge: =5)', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 5, currentLoad: 5, maxCapacity: 10 }))).toBe(100);
    });

    it('returns 100 when availableSlots > 5', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 10, currentLoad: 0, maxCapacity: 10 }))).toBe(100);
    });

    it('returns 85 when availableSlots = 4', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 4, currentLoad: 6, maxCapacity: 10 }))).toBe(85);
    });

    it('returns 85 when availableSlots = 3 (edge)', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 3, currentLoad: 7, maxCapacity: 10 }))).toBe(85);
    });

    it('returns 70 when availableSlots = 2', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 2, currentLoad: 8, maxCapacity: 10 }))).toBe(70);
    });

    it('returns 70 when availableSlots = 1 (edge)', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 1, currentLoad: 9, maxCapacity: 10 }))).toBe(70);
    });

    it('returns 50 when at capacity but utilization < 0.9 (edge below)', () => {
      // availableSlots=0, currentLoad=8, maxCapacity=10 → utilization=0.8 < 0.9
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 0, currentLoad: 8, maxCapacity: 10 }))).toBe(50);
    });

    it('returns 0 when utilization equals 0.9 (edge: strict <)', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 0, currentLoad: 9, maxCapacity: 10 }))).toBe(0);
    });

    it('returns 0 when fully utilized', () => {
      expect(e.calculateAvailabilityScore(makeAvailability({ availableSlots: 0, currentLoad: 10, maxCapacity: 10 }))).toBe(0);
    });
  });
});

describe('VendorMatchingEngine.calculateProximityScore', () => {
  describe('no property coordinates (state-only fallback)', () => {
    it('returns 70 when no coords but propertyState matches a serviceArea state', async () => {
      const vendor = { serviceAreas: [{ state: 'FL' }, { state: 'GA' }] };
      const result = await e.calculateProximityScore(vendor, null, 'FL');
      expect(result).toEqual({ score: 70, distance: null });
    });

    it('returns 40 when no coords and no state match', async () => {
      const vendor = { serviceAreas: [{ state: 'CA' }] };
      const result = await e.calculateProximityScore(vendor, null, 'FL');
      expect(result).toEqual({ score: 40, distance: null });
    });

    it('returns 40 when no coords, no propertyState, and no serviceAreas', async () => {
      const vendor = {};
      const result = await e.calculateProximityScore(vendor, null);
      expect(result).toEqual({ score: 40, distance: null });
    });
  });

  describe('vendor location missing', () => {
    it('returns 50 when property has coords but vendor has none', async () => {
      const vendor = {};
      const result = await e.calculateProximityScore(vendor, { latitude: 40, longitude: -74 });
      expect(result).toEqual({ score: 50, distance: null });
    });

    it('reads businessLocation as fallback for location', async () => {
      const vendor = { businessLocation: { latitude: 40, longitude: -74 } };
      const result = await e.calculateProximityScore(vendor, { latitude: 40, longitude: -74 });
      expect(result.score).toBe(100); // same point → 0 miles → local band
      expect(result.distance).toBe(0);
    });
  });

  describe('distance bands (vendor and property both at NYC)', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };

    it('returns 100 for distance = 0 (same coords)', async () => {
      const vendor = { location: nyc };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBe(0);
      expect(result.score).toBe(100);
    });

    // Edge points: pick latitudes that produce known mile offsets at the equator (1° lat ≈ 69 miles)
    it('returns 100 inside local band (≤ 25 miles)', async () => {
      // ~10 miles north
      const vendor = { location: { latitude: 40.7128 + 10 / 69, longitude: -74.006 } };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThanOrEqual(25);
      expect(result.score).toBe(100);
    });

    it('returns 80 in regional band (25 < d ≤ 75 miles)', async () => {
      // ~50 miles north
      const vendor = { location: { latitude: 40.7128 + 50 / 69, longitude: -74.006 } };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBeGreaterThan(25);
      expect(result.distance).toBeLessThanOrEqual(75);
      expect(result.score).toBe(80);
    });

    it('returns 60 in extended band (75 < d ≤ 150 miles)', async () => {
      const vendor = { location: { latitude: 40.7128 + 100 / 69, longitude: -74.006 } };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBeGreaterThan(75);
      expect(result.distance).toBeLessThanOrEqual(150);
      expect(result.score).toBe(60);
    });

    it('returns 40 in remote band (150 < d ≤ 300 miles)', async () => {
      const vendor = { location: { latitude: 40.7128 + 200 / 69, longitude: -74.006 } };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBeGreaterThan(150);
      expect(result.distance).toBeLessThanOrEqual(300);
      expect(result.score).toBe(40);
    });

    it('returns 0 beyond remote band (> 300 miles)', async () => {
      // NYC to LA ≈ 2450 miles
      const vendor = { location: { latitude: 34.0522, longitude: -118.2437 } };
      const result = await e.calculateProximityScore(vendor, nyc);
      expect(result.distance).toBeGreaterThan(300);
      expect(result.score).toBe(0);
    });
  });

  describe('precomputedDistance (T3 hoist)', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };

    it('uses precomputed distance instead of recomputing when supplied as a number', async () => {
      // Vendor coords would yield ~0 miles, but we override with 200 → remote band
      const vendor = { location: nyc };
      const result = await e.calculateProximityScore(vendor, nyc, undefined, 200);
      expect(result.distance).toBe(200);
      expect(result.score).toBe(40);
    });

    it('returns score=50 when precomputedDistance is null (vendor lacks coords)', async () => {
      const vendor = { /* no location */ };
      const result = await e.calculateProximityScore(vendor, nyc, undefined, null);
      expect(result).toEqual({ score: 50, distance: null });
    });

    it('falls back to inline computation when precomputedDistance is undefined', async () => {
      const vendor = { location: nyc };
      const result = await e.calculateProximityScore(vendor, nyc, undefined, undefined);
      expect(result.distance).toBe(0);
      expect(result.score).toBe(100);
    });

    it('still applies preferred-state bonus on precomputed distance', async () => {
      const vendor = {
        location: nyc,
        geographicCoverage: { preferred: { states: ['NY'] } },
      };
      const result = await e.calculateProximityScore(vendor, nyc, 'NY', 100); // band 60
      expect(result.score).toBe(70); // 60 + 10
    });

    it('ignores precomputedDistance when propertyCoords is null (state fallback wins)', async () => {
      const vendor = { serviceAreas: [{ state: 'FL' }] };
      const result = await e.calculateProximityScore(vendor, null, 'FL', 100);
      expect(result).toEqual({ score: 70, distance: null });
    });
  });

  describe('preferred state bonus', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };

    it('adds +10 when vendor has the property state in preferred coverage', async () => {
      const vendor = {
        location: { latitude: 40.7128 + 100 / 69, longitude: -74.006 }, // ~100mi → 60
        geographicCoverage: { preferred: { states: ['NY'] } },
      };
      const result = await e.calculateProximityScore(vendor, nyc, 'NY');
      expect(result.score).toBe(70); // 60 + 10
    });

    it('caps at 100 when bonus would exceed 100', async () => {
      const vendor = {
        location: nyc, // 0 miles → 100
        geographicCoverage: { preferred: { states: ['NY'] } },
      };
      const result = await e.calculateProximityScore(vendor, nyc, 'NY');
      expect(result.score).toBe(100); // 100 + 10 capped
    });

    it('does not add bonus when state is not preferred', async () => {
      const vendor = {
        location: { latitude: 40.7128 + 100 / 69, longitude: -74.006 },
        geographicCoverage: { preferred: { states: ['CA'] } },
      };
      const result = await e.calculateProximityScore(vendor, nyc, 'NY');
      expect(result.score).toBe(60); // no bonus
    });
  });
});

describe('VendorMatchingEngine.calculateExperienceScore', () => {
  it('returns base 50 with no specs, no expertise, no grade', () => {
    const result = e.calculateExperienceScore({}, 'sfr', null);
    expect(result).toBe(50);
  });

  it('adds +30 when specializations include propertyType', () => {
    const result = e.calculateExperienceScore({ specializations: ['sfr', 'condo'] }, 'sfr', null);
    expect(result).toBe(80);
  });

  describe('property type expertise bands', () => {
    it('adds +0 when ordersForType < 5 (edge: =4)', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 4 } }));
      expect(result).toBe(50);
    });

    it('adds +10 when ordersForType >= 5 (edge: =5)', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 5 } }));
      expect(result).toBe(60);
    });

    it('adds +10 when ordersForType = 19', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 19 } }));
      expect(result).toBe(60);
    });

    it('adds +15 when ordersForType >= 20 (edge: =20)', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 20 } }));
      expect(result).toBe(65);
    });

    it('adds +15 when ordersForType = 49', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 49 } }));
      expect(result).toBe(65);
    });

    it('adds +20 when ordersForType >= 50 (edge: =50)', () => {
      const result = e.calculateExperienceScore({}, 'sfr', makePerformance({ propertyTypeExpertise: { sfr: 50 } }));
      expect(result).toBe(70);
    });
  });

  describe('product grade bonus', () => {
    it('adds +0 for trainee', () => {
      const v = { productGrades: [{ productId: 'p1', grade: 'trainee' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(50);
    });

    it('adds +5 for proficient', () => {
      const v = { productGrades: [{ productId: 'p1', grade: 'proficient' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(55);
    });

    it('adds +10 for expert', () => {
      const v = { productGrades: [{ productId: 'p1', grade: 'expert' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(60);
    });

    it('adds +15 for lead', () => {
      const v = { productGrades: [{ productId: 'p1', grade: 'lead' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(65);
    });

    it('adds 0 for unknown grade', () => {
      const v = { productGrades: [{ productId: 'p1', grade: 'unknown-grade' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(50);
    });

    it('does not add grade bonus when productId differs', () => {
      const v = { productGrades: [{ productId: 'other', grade: 'lead' }] };
      expect(e.calculateExperienceScore(v, 'sfr', null, 'p1')).toBe(50);
    });

    it('caps total at 100', () => {
      const v = {
        specializations: ['sfr'],                                  // +30 → 80
        productGrades: [{ productId: 'p1', grade: 'lead' }],       // +15 → 95
      };
      const perf = makePerformance({ propertyTypeExpertise: { sfr: 50 } }); // +20 → 115 → cap 100
      expect(e.calculateExperienceScore(v, 'sfr', perf, 'p1')).toBe(100);
    });
  });
});

describe('VendorMatchingEngine.calculateCostScore', () => {
  it('returns 75 (neutral) when vendor has no fee data', () => {
    expect(e.calculateCostScore({})).toBe(75);
  });

  it('returns 0 (hard gate) when typicalFee exceeds maxFee', () => {
    expect(e.calculateCostScore({ averageFee: 600 }, undefined, 500)).toBe(0);
  });

  it('does not zero when typicalFee equals maxFee', () => {
    // typicalFee=500, maxFee=500: ratio is checked next; no budget → returns 75
    expect(e.calculateCostScore({ averageFee: 500 }, undefined, 500)).toBe(75);
  });

  describe('budget ratio bands', () => {
    it('returns 100 when ratio = 0.8 (edge)', () => {
      expect(e.calculateCostScore({ averageFee: 80 }, 100)).toBe(100);
    });

    it('returns 100 when well under budget', () => {
      expect(e.calculateCostScore({ averageFee: 50 }, 100)).toBe(100);
    });

    it('returns 85 when ratio = 1.0 (edge)', () => {
      expect(e.calculateCostScore({ averageFee: 100 }, 100)).toBe(85);
    });

    it('returns 70 when ratio = 1.1 (edge)', () => {
      expect(e.calculateCostScore({ averageFee: 110 }, 100)).toBe(70);
    });

    it('returns 50 when ratio = 1.2 (edge)', () => {
      expect(e.calculateCostScore({ averageFee: 120 }, 100)).toBe(50);
    });

    it('returns 25 when ratio > 1.2', () => {
      expect(e.calculateCostScore({ averageFee: 150 }, 100)).toBe(25);
    });
  });

  it('reads typicalFee field as fallback for averageFee', () => {
    expect(e.calculateCostScore({ typicalFee: 80 }, 100)).toBe(100);
  });

  it('returns 75 when no budget specified (and no maxFee gate hit)', () => {
    expect(e.calculateCostScore({ averageFee: 200 })).toBe(75);
  });
});

describe('VendorMatchingEngine.applyScoreAdjustment (T5)', () => {
  it('returns base score unchanged when adjustment is 0', () => {
    expect(e.applyScoreAdjustment(75, 0)).toBe(75);
  });

  it('adds positive adjustment (boost)', () => {
    expect(e.applyScoreAdjustment(60, 15)).toBe(75);
  });

  it('subtracts when adjustment is negative (reduce)', () => {
    expect(e.applyScoreAdjustment(60, -20)).toBe(40);
  });

  it('clamps to 100 when boost would exceed', () => {
    expect(e.applyScoreAdjustment(95, 20)).toBe(100);
  });

  it('clamps to 100 at exact boundary', () => {
    expect(e.applyScoreAdjustment(100, 0)).toBe(100);
    expect(e.applyScoreAdjustment(95, 5)).toBe(100);
  });

  it('clamps to 0 when reduce would go below', () => {
    expect(e.applyScoreAdjustment(10, -50)).toBe(0);
  });

  it('clamps to 0 at exact boundary', () => {
    expect(e.applyScoreAdjustment(0, 0)).toBe(0);
    expect(e.applyScoreAdjustment(5, -5)).toBe(0);
  });

  it('handles base score already out of range (defensive)', () => {
    // Should not happen in practice (weighted sum of [0,100] factors with weights summing to 1
    // is bounded to [0,100]), but the clamp handles it gracefully.
    expect(e.applyScoreAdjustment(150, 0)).toBe(100);
    expect(e.applyScoreAdjustment(-10, 0)).toBe(0);
  });
});

describe('VendorMatchingEngine.calculateDistance (Haversine)', () => {
  it('returns 0 for identical coordinates', () => {
    expect(e.calculateDistance(40, -74, 40, -74)).toBe(0);
  });

  it('is symmetric', () => {
    const ab = e.calculateDistance(40, -74, 34, -118);
    const ba = e.calculateDistance(34, -118, 40, -74);
    expect(ab).toBe(ba);
  });

  it('approximates NYC → LA at ~2451 miles (within 1%)', () => {
    const distance = e.calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(2425);
    expect(distance).toBeLessThan(2475);
  });

  it('rounds to 1 decimal place', () => {
    const distance = e.calculateDistance(40.7128, -74.006, 40.8, -74.1);
    expect(Math.round(distance * 10) / 10).toBe(distance);
  });
});

describe('VendorMatchingEngine — internal-staff availability synthesis (Phase 1.5.5)', () => {
  // The synthesis logic lives inline in scoreVendor (lines 258-271). It is not
  // separately extractable, so we exercise the same shape that would be created
  // and verify availability scoring against it.

  it('synthesized availability with 5 free slots scores 100', () => {
    const synthesized = {
      currentLoad: 0,
      maxCapacity: 5,
      availableSlots: 5,
      isAcceptingOrders: true,
    } as any;
    expect(e.calculateAvailabilityScore(synthesized)).toBe(100);
  });

  it('synthesized availability at capacity scores 0', () => {
    const synthesized = {
      currentLoad: 5,
      maxCapacity: 5,
      availableSlots: 0,
      isAcceptingOrders: false,
    } as any;
    expect(e.calculateAvailabilityScore(synthesized)).toBe(0);
  });
});
