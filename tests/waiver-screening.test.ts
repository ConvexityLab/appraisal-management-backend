/**
 * Tests for Waiver Screening Service (Phase 1.13)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WaiverScreeningService,
  type WaiverScreeningRequest,
  type ClientWaiverConfig,
} from '../src/services/waiver-screening.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ClientWaiverConfig> = {}): ClientWaiverConfig {
  return {
    clientId: 'client-1',
    enabledPrograms: ['PIW', 'DESKTOP_ELIGIBLE', 'HYBRID_ELIGIBLE'],
    maxLtvForWaiver: 80,
    maxLoanAmountForWaiver: 1_000_000,
    eligibleLoanTypes: ['conventional', 'jumbo'],
    eligiblePropertyTypes: ['single_family_residential', 'condominium'],
    eligibleOccupancyTypes: ['owner_occupied', 'second_home'],
    minAvmConfidence: 70,
    excludedStates: ['NY', 'CA'],
    ...overrides,
  };
}

function makeMockDb(config: ClientWaiverConfig | null = null) {
  return {
    ordersContainer: {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({
            resources: config ? [config] : [],
          }),
        }),
      },
    },
  } as any;
}

const baseRequest: WaiverScreeningRequest = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  ltv: 75,
  loanPurpose: 'purchase',
  loanType: 'conventional',
  propertyType: 'single_family_residential',
  occupancyType: 'owner_occupied',
  loanAmount: 400_000,
  state: 'TX',
  avmConfidence: 85,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WaiverScreeningService', () => {
  describe('screenOrder', () => {
    it('returns screened=false when no client config exists', async () => {
      const service = new WaiverScreeningService(makeMockDb(null));

      const result = await service.screenOrder(baseRequest);
      expect(result.screened).toBe(false);
      expect(result.recommendedAction).toBe('PROCEED_FULL');
      expect(result.configSource).toBe('none');
      expect(result.recommendationReason).toContain('No waiver configuration found');
    });

    it('screens all enabled programs and finds eligible ones', async () => {
      const config = makeConfig();
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder(baseRequest);
      expect(result.screened).toBe(true);
      expect(result.eligiblePrograms.length).toBe(3);
      expect(result.eligiblePrograms.filter(p => p.eligible).length).toBe(3);
      expect(result.recommendedAction).toBe('CONSIDER_WAIVER'); // PIW takes precedence
    });

    it('rejects when LTV exceeds max', async () => {
      const config = makeConfig({ maxLtvForWaiver: 70 });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, ltv: 75 });
      expect(result.screened).toBe(true);
      // All programs should fail the LTV check
      expect(result.eligiblePrograms.every(p => !p.eligible)).toBe(true);
      expect(result.recommendedAction).toBe('PROCEED_FULL');
    });

    it('rejects when loan amount exceeds max', async () => {
      const config = makeConfig({ maxLoanAmountForWaiver: 300_000 });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, loanAmount: 400_000 });
      expect(result.eligiblePrograms.every(p => !p.eligible)).toBe(true);
    });

    it('rejects ineligible property type', async () => {
      const config = makeConfig();
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, propertyType: 'commercial' });
      expect(result.eligiblePrograms.every(p => !p.eligible)).toBe(true);
    });

    it('rejects excluded state', async () => {
      const config = makeConfig({ excludedStates: ['TX'] });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder(baseRequest);
      expect(result.eligiblePrograms.every(p => !p.eligible)).toBe(true);
    });

    it('rejects ineligible loan type', async () => {
      const config = makeConfig();
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, loanType: 'fha' });
      expect(result.eligiblePrograms.every(p => !p.eligible)).toBe(true);
    });

    it('rejects PIW for cash-out refinance', async () => {
      const config = makeConfig({ enabledPrograms: ['PIW'] });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, loanPurpose: 'cash_out_refinance' });
      expect(result.eligiblePrograms[0].eligible).toBe(false);
      expect(result.eligiblePrograms[0].reason).toContain('Cash-out refinance');
    });

    it('rejects desktop for construction loans', async () => {
      const config = makeConfig({ enabledPrograms: ['DESKTOP_ELIGIBLE'] });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, loanPurpose: 'construction' });
      expect(result.eligiblePrograms[0].eligible).toBe(false);
      expect(result.eligiblePrograms[0].reason).toContain('Construction');
    });

    it('flags low AVM confidence for PIW', async () => {
      const config = makeConfig({ enabledPrograms: ['PIW'], minAvmConfidence: 80 });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, avmConfidence: 60 });
      expect(result.eligiblePrograms[0].eligible).toBe(false);
      expect(result.eligiblePrograms[0].reason).toContain('AVM confidence');
    });

    it('adds conditions when AVM confidence is missing', async () => {
      const config = makeConfig({ enabledPrograms: ['PIW'] });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, avmConfidence: undefined });
      expect(result.eligiblePrograms[0].eligible).toBe(true);
      expect(result.eligiblePrograms[0].conditions).toBeDefined();
      expect(result.eligiblePrograms[0].conditions!.some(c => c.includes('AVM'))).toBe(true);
    });

    it('includes estimated savings for eligible programs', async () => {
      const config = makeConfig({ enabledPrograms: ['PIW'] });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder(baseRequest);
      expect(result.eligiblePrograms[0].estimatedSavings).toBeGreaterThan(0);
    });

    it('recommends desktop when PIW ineligible but desktop eligible', async () => {
      // PIW fails on AVM, desktop doesn't need it
      const config = makeConfig({
        enabledPrograms: ['PIW', 'DESKTOP_ELIGIBLE'],
        minAvmConfidence: 90,
      });
      const service = new WaiverScreeningService(makeMockDb(config));

      const result = await service.screenOrder({ ...baseRequest, avmConfidence: 60 });
      expect(result.recommendedAction).toBe('CONSIDER_DESKTOP');
    });

    it('does not throw on DB error (advisory only)', async () => {
      const db = {
        ordersContainer: {
          items: {
            query: vi.fn().mockReturnValue({
              fetchAll: vi.fn().mockRejectedValue(new Error('Cosmos error')),
            }),
          },
        },
      } as any;
      const service = new WaiverScreeningService(db);

      const result = await service.screenOrder(baseRequest);
      expect(result.screened).toBe(false);
      expect(result.recommendedAction).toBe('PROCEED_FULL');
    });
  });
});
