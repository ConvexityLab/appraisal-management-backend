import { describe, expect, it, vi } from 'vitest';
import { VendorIntegrationService } from '../../src/services/vendor-integrations/VendorIntegrationService.js';
import type { VendorAdapter } from '../../src/services/vendor-integrations/VendorAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

function makeAdapter(vendorType: string, opts: { canHandle?: boolean } = {}): VendorAdapter {
  return {
    vendorType: vendorType as any,
    inboundTransport: 'sync-post',
    outboundTransport: 'sync-post',
    canHandleInbound: vi.fn().mockReturnValue(opts.canHandle ?? true),
    identifyInboundConnection: vi.fn().mockReturnValue('conn-id'),
    authenticateInbound: vi.fn().mockResolvedValue(undefined),
    handleInbound: vi.fn().mockResolvedValue({
      domainEvents: [],
      ack: { statusCode: 200, body: { ok: true } },
    }),
    buildOutboundCall: vi.fn().mockResolvedValue(null),
  };
}

const fakeConnection: VendorConnection = {
  id: 'vc-1',
  tenantId: 'tenant-1',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
  lenderName: 'Lender',
  inboundIdentifier: 'conn-id',
  credentials: {},
  outboundEndpointUrl: 'https://example.com',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const stubConnectionService = {
  getActiveConnectionByInboundIdentifier: vi.fn().mockResolvedValue(fakeConnection),
  resolveSecret: vi.fn().mockResolvedValue('secret'),
} as any;

const stubOrderRefService = {
  createOrGetOrderReference: vi.fn().mockResolvedValue({
    orderId: 'order-1',
    orderNumber: 'VND-1',
    existed: false,
  }),
} as any;

const stubOutboxService = {
  persistInboundEvents: vi.fn().mockResolvedValue(undefined),
} as any;

describe('VendorIntegrationService.processInbound', () => {
  it('selects the adapter matching expectedVendorType (URL drives dispatch)', async () => {
    const aimPort = makeAdapter('aim-port');
    const classValuation = makeAdapter('class-valuation');

    const service = new VendorIntegrationService(
      stubConnectionService,
      [aimPort, classValuation],
      stubOrderRefService,
      stubOutboxService,
    );

    const result = await service.processInbound({}, {}, undefined, 'aim-port');

    expect(result.adapter.vendorType).toBe('aim-port');
    expect(aimPort.handleInbound).toHaveBeenCalled();
    expect(classValuation.handleInbound).not.toHaveBeenCalled();
  });

  it('throws when no adapter is registered for the expected vendor type', async () => {
    const aimPort = makeAdapter('aim-port');

    const service = new VendorIntegrationService(
      stubConnectionService,
      [aimPort],
      stubOrderRefService,
      stubOutboxService,
    );

    await expect(
      service.processInbound({}, {}, undefined, 'mercury' as any),
    ).rejects.toThrow(/No adapter registered/);
  });

  it('throws when canHandleInbound returns false (body/URL mismatch)', async () => {
    const aimPort = makeAdapter('aim-port', { canHandle: false });

    const service = new VendorIntegrationService(
      stubConnectionService,
      [aimPort],
      stubOrderRefService,
      stubOutboxService,
    );

    await expect(
      service.processInbound({}, {}, undefined, 'aim-port'),
    ).rejects.toThrow(/does not match/);
    expect(aimPort.handleInbound).not.toHaveBeenCalled();
  });
});
