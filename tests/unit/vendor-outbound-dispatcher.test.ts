import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

// ── Module mocks (must be hoisted above imports) ──────────────────────────────

const { sendMock, buildOutboundCallMock, getConnectionByIdMock, resolveSecretMock } =
  vi.hoisted(() => ({
    sendMock: vi.fn(),
    buildOutboundCallMock: vi.fn(),
    getConnectionByIdMock: vi.fn(),
    resolveSecretMock: vi.fn(),
  }));

vi.mock('../../src/services/vendor-integrations/VendorHttpClient.js', () => ({
  VendorHttpClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
}));

vi.mock('../../src/services/vendor-integrations/AimPortAdapter.js', () => ({
  AimPortAdapter: vi.fn().mockImplementation(() => ({
    vendorType: 'aim-port',
    buildOutboundCall: buildOutboundCallMock,
  })),
}));

vi.mock('../../src/services/vendor-integrations/ClassValuationWebhookAdapter.js', () => ({
  ClassValuationWebhookAdapter: vi.fn().mockImplementation(() => ({
    vendorType: 'class-valuation',
    buildOutboundCall: vi.fn(),
  })),
}));

vi.mock('../../src/services/vendor-integrations/VendorConnectionService.js', () => ({
  VendorConnectionService: vi.fn().mockImplementation(() => ({
    getConnectionById: getConnectionByIdMock,
    resolveSecret: resolveSecretMock,
  })),
}));

vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import AFTER mocks are registered.
import { VendorOutboundDispatcher } from '../../src/services/vendor-integrations/VendorOutboundDispatcher.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<VendorDomainEvent> = {}): VendorDomainEvent {
  return {
    eventType: 'ORDER_RECEIVED',
    vendorType: 'aim-port',
    vendorOrderId: 'vord-001',
    vendorId: 'vendor-1',
    tenantId: 'tenant-1',
    ...overrides,
  } as VendorDomainEvent;
}

const STUB_CALL = {
  url: 'https://aim-port.local/orders',
  method: 'POST' as const,
  headers: { 'Content-Type': 'application/json' },
  body: { test: true },
};

const OK_RESPONSE = { ok: true, status: 200, body: null, rawText: '' };
const FAIL_RESPONSE = { ok: false, status: 500, body: null, rawText: 'Internal server error' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VendorOutboundDispatcher.dispatch()', () => {
  let dispatcher: VendorOutboundDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    // Fast timer to avoid real delays in retry tests.
    vi.useFakeTimers();
    getConnectionByIdMock.mockResolvedValue({ id: 'conn-1', vendorType: 'aim-port' });
    buildOutboundCallMock.mockResolvedValue(STUB_CALL);
    dispatcher = new VendorOutboundDispatcher();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on the first attempt without retrying', async () => {
    sendMock.mockResolvedValue(OK_RESPONSE);

    const dispatchPromise = dispatcher.dispatch(makeEvent(), 'conn-1');
    // Tick all timers to completion (no real delay expected on success).
    await vi.runAllTimersAsync();
    await dispatchPromise;

    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on the second attempt', async () => {
    sendMock
      .mockResolvedValueOnce(FAIL_RESPONSE)  // attempt 1 fails
      .mockResolvedValue(OK_RESPONSE);        // attempt 2 succeeds

    const dispatchPromise = dispatcher.dispatch(makeEvent(), 'conn-1');
    await vi.runAllTimersAsync();
    await dispatchPromise;

    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a thrown network error and succeeds on the third attempt', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))  // attempt 1 throws
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))     // attempt 2 throws
      .mockResolvedValue(OK_RESPONSE);                    // attempt 3 succeeds

    const dispatchPromise = dispatcher.dispatch(makeEvent(), 'conn-1');
    await vi.runAllTimersAsync();
    await dispatchPromise;

    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('dead-letters and rethrows after all 3 attempts fail', async () => {
    const fatal = new Error('Permanent failure');
    sendMock.mockRejectedValue(fatal);

    // Use Promise.all so the rejection handler is registered before the timer
    // advances and avoids a PromiseRejectionHandledWarning.
    await Promise.all([
      expect(dispatcher.dispatch(makeEvent(), 'conn-1')).rejects.toThrow('Permanent failure'),
      vi.runAllTimersAsync(),
    ]);

    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('dead-letters and rethrows when all 3 HTTP responses are non-ok', async () => {
    sendMock.mockResolvedValue(FAIL_RESPONSE);

    await Promise.all([
      expect(dispatcher.dispatch(makeEvent(), 'conn-1')).rejects.toThrow(/HTTP 500/),
      vi.runAllTimersAsync(),
    ]);

    expect(sendMock).toHaveBeenCalledTimes(3);
  });

  it('skips dispatch and returns without calling send when adapter returns no call', async () => {
    buildOutboundCallMock.mockResolvedValue(null);
    sendMock.mockResolvedValue(OK_RESPONSE);

    const dispatchPromise = dispatcher.dispatch(makeEvent(), 'conn-1');
    await vi.runAllTimersAsync();
    await dispatchPromise;

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws immediately when no adapter is registered for the vendorType', async () => {
    await expect(
      dispatcher.dispatch(makeEvent({ vendorType: 'unknown-vendor' as any }), 'conn-1'),
    ).rejects.toThrow(/No outbound adapter registered for vendorType=unknown-vendor/);

    expect(sendMock).not.toHaveBeenCalled();
  });
});
