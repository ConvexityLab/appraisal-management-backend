import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createVendorConnectionAdminRouter } from '../../src/controllers/vendor-connection.controller.js';
import {
  VendorConnectionConflictError,
  VendorConnectionNotFoundError,
  VendorConnectionValidationError,
} from '../../src/services/vendor-integrations/VendorIntegrationErrors.js';

function createTestApp(service: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { tenantId: 'tenant-1', id: 'user-1' };
    next();
  });
  app.use('/api/vendor-integrations/connections', createVendorConnectionAdminRouter(service as any));
  return app;
}

describe('vendor-connection.controller', () => {
  it('creates a connection', async () => {
    const service = {
      listConnections: vi.fn(),
      getConnection: vi.fn(),
      createConnection: vi.fn().mockResolvedValue({ id: 'vc-1', tenantId: 'tenant-1' }),
      updateConnection: vi.fn(),
      deactivateConnection: vi.fn(),
    };

    const res = await request(createTestApp(service))
      .post('/api/vendor-integrations/connections')
      .send({
        vendorType: 'aim-port',
        lenderId: 'lender-1',
        lenderName: 'Lender One',
        inboundIdentifier: '501102',
        credentials: {
          inboundApiKeySecretName: 'aim-port-inbound',
          outboundApiKeySecretName: 'aim-port-outbound',
          outboundClientId: '501102',
        },
        outboundEndpointUrl: 'https://vendor.example.com/inbound',
        active: true,
      });

    expect(res.status).toBe(201);
    expect(service.createConnection).toHaveBeenCalledWith('tenant-1', expect.any(Object), 'user-1');
  });

  it('lists connections with query filters', async () => {
    const service = {
      listConnections: vi.fn().mockResolvedValue([{ id: 'vc-1' }]),
      getConnection: vi.fn(),
      createConnection: vi.fn(),
      updateConnection: vi.fn(),
      deactivateConnection: vi.fn(),
    };

    const res = await request(createTestApp(service))
      .get('/api/vendor-integrations/connections')
      .query({ vendorType: 'aim-port', activeOnly: 'true' });

    expect(res.status).toBe(200);
    expect(service.listConnections).toHaveBeenCalledWith('tenant-1', { vendorType: 'aim-port', activeOnly: true });
  });

  it('returns 400 for validation errors', async () => {
    const service = {
      listConnections: vi.fn(),
      getConnection: vi.fn(),
      createConnection: vi.fn().mockRejectedValue(new VendorConnectionValidationError('bad payload')),
      updateConnection: vi.fn(),
      deactivateConnection: vi.fn(),
    };

    const res = await request(createTestApp(service))
      .post('/api/vendor-integrations/connections')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 for duplicate active connections', async () => {
    const service = {
      listConnections: vi.fn(),
      getConnection: vi.fn(),
      createConnection: vi.fn().mockRejectedValue(new VendorConnectionConflictError('duplicate')),
      updateConnection: vi.fn(),
      deactivateConnection: vi.fn(),
    };

    const res = await request(createTestApp(service))
      .post('/api/vendor-integrations/connections')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for missing records on update', async () => {
    const service = {
      listConnections: vi.fn(),
      getConnection: vi.fn(),
      createConnection: vi.fn(),
      updateConnection: vi.fn().mockRejectedValue(new VendorConnectionNotFoundError('missing')),
      deactivateConnection: vi.fn(),
    };

    const res = await request(createTestApp(service))
      .put('/api/vendor-integrations/connections/vc-missing')
      .send({ lenderName: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deactivates a connection', async () => {
    const service = {
      listConnections: vi.fn(),
      getConnection: vi.fn(),
      createConnection: vi.fn(),
      updateConnection: vi.fn(),
      deactivateConnection: vi.fn().mockResolvedValue({ id: 'vc-1', active: false }),
    };

    const res = await request(createTestApp(service))
      .delete('/api/vendor-integrations/connections/vc-1');

    expect(res.status).toBe(200);
    expect(service.deactivateConnection).toHaveBeenCalledWith('vc-1', 'tenant-1', 'user-1');
  });
});