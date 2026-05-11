import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVendorIntegrationRouter } from '../../src/controllers/vendor-integration.controller.js';
import { VendorConnectionConfigurationError } from '../../src/services/vendor-integrations/VendorIntegrationErrors.js';

interface FakeService {
  processInbound: ReturnType<typeof vi.fn>;
}

function makeApp(service: FakeService) {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use('/api/v1/integrations', createVendorIntegrationRouter(service as any));
  return app;
}

const aimPortBody = {
  OrderRequest: {
    login: { client_id: '501102', api_key: 'secret', order_id: 'AP-1001' },
    order: {
      order_id: 'AP-1001',
      order_type: 'residential',
      address: '123 Main',
      city: 'Dallas',
      state: 'TX',
      zip_code: '75001',
      property_type: 'sfr',
      borrower: { name: 'Jane' },
      reports: [{ id: 49079, name: '1004' }],
    },
  },
};

const classValuationBody = {
  accountId: 'cv-acct-1',
  event: 'order.completed',
  occurredAt: '2026-05-04T00:00:00.000Z',
  data: { externalOrderId: 'CV-1', files: [] },
};

const aimPortAck = { client_id: '501102', success: 'true', order_id: 'AP-1001', fee: 0 };
const classValuationAck = { received: true };

const originalEnvironment = process.env.ENVIRONMENT;

afterEach(() => {
  if (originalEnvironment === undefined) {
    delete process.env.ENVIRONMENT;
    return;
  }
  process.env.ENVIRONMENT = originalEnvironment;
});

describe('vendor-integration.controller', () => {
  it('routes /aim-port/inbound to the AimPort adapter and returns its ack', async () => {
    const service: FakeService = {
      processInbound: vi.fn().mockResolvedValue({
        adapter: { vendorType: 'aim-port' },
        connection: { id: 'vc-aim' },
        domainEvents: [{ id: 'evt-1' }],
        ack: { statusCode: 200, body: aimPortAck },
      }),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(aimPortAck);
    expect(res.headers['x-vendor-type']).toBe('aim-port');
    expect(service.processInbound).toHaveBeenCalledWith(
      aimPortBody,
      expect.any(Object),
      undefined,
      'aim-port',
    );
  });

  it('routes /class-valuation/inbound to the ClassValuation adapter', async () => {
    const service: FakeService = {
      processInbound: vi.fn().mockResolvedValue({
        adapter: { vendorType: 'class-valuation' },
        connection: { id: 'vc-cv' },
        domainEvents: [{ id: 'evt-2' }],
        ack: { statusCode: 202, body: classValuationAck },
      }),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('x-class-valuation-account-id', 'cv-acct-1')
      .send(classValuationBody);

    expect(res.status).toBe(202);
    expect(res.body).toEqual(classValuationAck);
    expect(service.processInbound).toHaveBeenCalledWith(
      classValuationBody,
      expect.any(Object),
      undefined,
      'class-valuation',
    );
  });

  it('returns 400 when the body shape does not match the URL vendor type', async () => {
    const service: FakeService = {
      processInbound: vi.fn().mockRejectedValue(
        new Error('Body shape does not match expected vendor type aim-port'),
      ),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .send(classValuationBody);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'VENDOR_INTEGRATION_INBOUND_FAILED' },
    });
  });

  it('returns 401 when the adapter rejects authentication', async () => {
    const service: FakeService = {
      processInbound: vi.fn().mockRejectedValue(
        new Error('AIM-Port api_key authentication failed for client_id=501102'),
      ),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(401);
  });

  it('returns 503 when the connection configuration is missing', async () => {
    const service: FakeService = {
      processInbound: vi.fn().mockRejectedValue(
        new VendorConnectionConfigurationError(
          'No active vendor connection is configured for vendorType=aim-port inboundIdentifier=999. Create or activate a vendor connection before enabling this inbound integration.',
        ),
      ),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('VENDOR_INTEGRATION_CONFIGURATION_ERROR');
  });

  it('returns 404 for the legacy /inbound URL (route deleted)', async () => {
    const service: FakeService = { processInbound: vi.fn() };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(404);
    expect(service.processInbound).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown vendor in the URL', async () => {
    const service: FakeService = { processInbound: vi.fn() };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/wat/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(404);
    expect(service.processInbound).not.toHaveBeenCalled();
  });

  it('rejects direct AIM-Port ingress outside dev when APIM forwarding header is missing', async () => {
    process.env.ENVIRONMENT = 'staging';
    const service: FakeService = {
      processInbound: vi.fn(),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .send(aimPortBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'VENDOR_INTEGRATION_EDGE_ENFORCEMENT_FAILED',
        message: 'AIM-Port inbound requests must be routed through APIM.',
      },
    });
    expect(service.processInbound).not.toHaveBeenCalled();
  });

  it('accepts AIM-Port ingress outside dev when APIM forwarding header is present', async () => {
    process.env.ENVIRONMENT = 'staging';
    const service: FakeService = {
      processInbound: vi.fn().mockResolvedValue({
        adapter: { vendorType: 'aim-port' },
        connection: { id: 'vc-aim' },
        domainEvents: [{ id: 'evt-1' }],
        ack: { statusCode: 200, body: aimPortAck },
      }),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/aim-port/inbound')
      .set('x-apim-forwarded', 'true')
      .send(aimPortBody);

    expect(res.status).toBe(200);
    expect(service.processInbound).toHaveBeenCalledOnce();
  });

  it('does not require APIM forwarding header for Class Valuation ingress yet', async () => {
    process.env.ENVIRONMENT = 'staging';
    const service: FakeService = {
      processInbound: vi.fn().mockResolvedValue({
        adapter: { vendorType: 'class-valuation' },
        connection: { id: 'vc-cv' },
        domainEvents: [{ id: 'evt-2' }],
        ack: { statusCode: 202, body: classValuationAck },
      }),
    };

    const res = await request(makeApp(service))
      .post('/api/v1/integrations/class-valuation/inbound')
      .set('x-class-valuation-account-id', 'cv-acct-1')
      .send(classValuationBody);

    expect(res.status).toBe(202);
    expect(service.processInbound).toHaveBeenCalledOnce();
  });
});
