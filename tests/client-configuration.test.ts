/**
 * Client Configuration Service — Tests (Phase 1.3)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientConfigurationService } from '../src/services/client-configuration.service';

function createMockDbService() {
  const store: Record<string, any> = {};
  const mockContainer = {
    items: {
      query: vi.fn().mockImplementation(({ query, parameters }: any) => ({
        fetchAll: vi.fn().mockImplementation(async () => {
          let results = Object.values(store);
          for (const p of parameters ?? []) {
            if (p.name === '@cid') results = results.filter((i: any) => i.clientId === p.value);
            if (p.name === '@tid') results = results.filter((i: any) => i.tenantId === p.value);
            if (p.name === '@pt') results = results.filter((i: any) => i.productType === p.value);
          }
          if (query.includes('isActive = true')) {
            results = results.filter((i: any) => i.isActive === true);
          }
          if (query.includes("type = 'product'")) {
            results = results.filter((i: any) => i.type === 'product');
          }
          if (query.includes("type = 'client-config'")) {
            results = results.filter((i: any) => i.type === 'client-config');
          }
          return { resources: results };
        }),
      })),
      upsert: vi.fn().mockImplementation(async (item: any) => {
        store[item.id] = item;
        return { resource: item };
      }),
    },
  };
  return {
    ordersContainer: mockContainer,
    _store: store,
    _mockContainer: mockContainer,
  } as any;
}

describe('ClientConfigurationService', () => {
  let service: ClientConfigurationService;
  let dbService: ReturnType<typeof createMockDbService>;

  beforeEach(() => {
    dbService = createMockDbService();
    service = new ClientConfigurationService(dbService);
  });

  describe('upsertConfiguration', () => {
    it('should create a new client configuration', async () => {
      const config = await service.upsertConfiguration({
        clientId: 'client-1',
        tenantId: 'tenant-1',
        configName: 'Standard Config',
        isActive: true,
        feeSchedule: {
          productFees: {
            STANDARD: { baseFee: 600 },
          },
        },
      });
      expect(config.id).toMatch(/^ccfg-/);
      expect(config.clientId).toBe('client-1');
      expect(config.isActive).toBe(true);
      expect(config.feeSchedule!.productFees.STANDARD.baseFee).toBe(600);
    });
  });

  describe('getActiveConfig', () => {
    it('should return null when no config exists', async () => {
      const config = await service.getActiveConfig('client-99', 'tenant-1');
      expect(config).toBeNull();
    });

    it('should return active config for a client', async () => {
      await service.upsertConfiguration({
        clientId: 'client-1',
        tenantId: 'tenant-1',
        configName: 'Default',
        isActive: true,
      });
      const config = await service.getActiveConfig('client-1', 'tenant-1');
      expect(config).toBeDefined();
      expect(config!.configName).toBe('Default');
    });
  });

  describe('resolveOrderConfig', () => {
    it('should return product defaults when no client config exists', async () => {
      // Seed a product
      dbService._store['prod-1'] = {
        id: 'prod-1',
        type: 'product',
        tenantId: 'tenant-1',
        productType: 'STANDARD',
        defaultFee: 500,
        rushFeeMultiplier: 1.5,
        turnTimeDays: 10,
        rushTurnTimeDays: 5,
        isActive: true,
      };

      const resolved = await service.resolveOrderConfig('client-1', 'tenant-1', 'STANDARD');
      expect(resolved.baseFee).toBe(500);
      expect(resolved.turnTimeDays).toBe(10);
      expect(resolved.deliveryFormat).toBe('PDF');
    });

    it('should layer client fee overrides', async () => {
      // Seed product
      dbService._store['prod-1'] = {
        id: 'prod-1',
        type: 'product',
        tenantId: 'tenant-1',
        productType: 'STANDARD',
        defaultFee: 500,
        rushFeeMultiplier: 1.5,
        turnTimeDays: 10,
        isActive: true,
      };

      // Seed client config
      await service.upsertConfiguration({
        clientId: 'client-1',
        tenantId: 'tenant-1',
        configName: 'Premium Client',
        isActive: true,
        feeSchedule: {
          productFees: {
            STANDARD: { baseFee: 450, rushFeeMultiplier: 1.25 },
          },
        },
        slaConfig: {
          productTurnTimes: {
            STANDARD: { standardDays: 7, rushDays: 3 },
          },
        },
        deliveryConfig: {
          preferredFormat: 'PDF_AND_XML',
          requireGSESubmission: true,
        },
      });

      const resolved = await service.resolveOrderConfig('client-1', 'tenant-1', 'STANDARD');
      expect(resolved.baseFee).toBe(450);
      expect(resolved.rushFeeMultiplier).toBe(1.25);
      expect(resolved.turnTimeDays).toBe(7);
      expect(resolved.rushTurnTimeDays).toBe(3);
      expect(resolved.deliveryFormat).toBe('PDF_AND_XML');
      expect(resolved.requireGSESubmission).toBe(true);
    });

    it('should use default base fee when product-specific not present', async () => {
      dbService._store['prod-1'] = {
        id: 'prod-1',
        type: 'product',
        tenantId: 'tenant-1',
        productType: 'DESKTOP',
        defaultFee: 300,
        turnTimeDays: 5,
        isActive: true,
      };

      await service.upsertConfiguration({
        clientId: 'client-2',
        tenantId: 'tenant-1',
        configName: 'Basic Config',
        isActive: true,
        feeSchedule: {
          productFees: {},
          defaultBaseFee: 275,
        },
      });

      const resolved = await service.resolveOrderConfig('client-2', 'tenant-1', 'DESKTOP');
      expect(resolved.baseFee).toBe(275);
    });
  });
});
