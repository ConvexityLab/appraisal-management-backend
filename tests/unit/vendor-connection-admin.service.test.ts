import { describe, expect, it, vi } from 'vitest';
import { VendorConnectionAdminService } from '../../src/services/vendor-integrations/VendorConnectionAdminService.js';
import {
  VendorConnectionConflictError,
  VendorConnectionNotFoundError,
  VendorConnectionValidationError,
} from '../../src/services/vendor-integrations/VendorIntegrationErrors.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

function makeDb() {
  return {
    createDocument: vi.fn(),
    getDocument: vi.fn(),
    queryDocuments: vi.fn(),
    upsertDocument: vi.fn(),
  };
}

describe('VendorConnectionAdminService', () => {
  it('creates a valid AIM-Port connection', async () => {
    const db = makeDb();
    db.queryDocuments.mockResolvedValue([]);
    db.createDocument.mockImplementation(async (_container: string, document: VendorConnection) => document);
    const service = new VendorConnectionAdminService(db as any);

    const created = await service.createConnection('tenant-1', {
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
    }, 'user-1');

    expect(created).toMatchObject({
      tenantId: 'tenant-1',
      type: 'vendor-connection',
      vendorType: 'aim-port',
      inboundIdentifier: '501102',
      active: true,
      createdBy: 'user-1',
      updatedBy: 'user-1',
    });
    expect(db.createDocument).toHaveBeenCalledWith('vendor-connections', expect.any(Object));
  });

  it('rejects duplicate active connections for the same vendor type and inbound identifier', async () => {
    const db = makeDb();
    db.queryDocuments.mockResolvedValue([{ id: 'existing-1', tenantId: 'tenant-1', active: true }]);
    const service = new VendorConnectionAdminService(db as any);

    await expect(service.createConnection('tenant-1', {
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
    }, 'user-1')).rejects.toBeInstanceOf(VendorConnectionConflictError);
  });

  it('rejects invalid outbound endpoint URLs', async () => {
    const db = makeDb();
    const service = new VendorConnectionAdminService(db as any);

    await expect(service.createConnection('tenant-1', {
      vendorType: 'aim-port',
      lenderId: 'lender-1',
      lenderName: 'Lender One',
      inboundIdentifier: '501102',
      credentials: {
        inboundApiKeySecretName: 'aim-port-inbound',
        outboundApiKeySecretName: 'aim-port-outbound',
        outboundClientId: '501102',
      },
      outboundEndpointUrl: '/relative-path',
      active: true,
    }, 'user-1')).rejects.toBeInstanceOf(VendorConnectionValidationError);
  });

  it('updates a connection and preserves immutable identity fields', async () => {
    const existing: VendorConnection = {
      id: 'vc-1',
      tenantId: 'tenant-1',
      type: 'vendor-connection',
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const db = makeDb();
    db.getDocument.mockResolvedValue(existing);
    db.queryDocuments.mockResolvedValue([]);
    db.upsertDocument.mockImplementation(async (_container: string, document: VendorConnection) => document);
    const service = new VendorConnectionAdminService(db as any);

    const updated = await service.updateConnection('vc-1', 'tenant-1', {
      lenderName: 'Updated Lender Name',
      credentials: { outboundApiKeySecretName: 'aim-port-outbound-v2' },
    }, 'user-2');

    expect(updated).toMatchObject({
      id: 'vc-1',
      tenantId: 'tenant-1',
      lenderName: 'Updated Lender Name',
      createdBy: 'user-1',
      updatedBy: 'user-2',
    });
    expect(updated.credentials).toMatchObject({
      inboundApiKeySecretName: 'aim-port-inbound',
      outboundApiKeySecretName: 'aim-port-outbound-v2',
      outboundClientId: '501102',
    });
  });

  it('throws not found when deactivating a missing connection', async () => {
    const db = makeDb();
    db.getDocument.mockResolvedValue(null);
    const service = new VendorConnectionAdminService(db as any);

    await expect(service.deactivateConnection('missing', 'tenant-1', 'user-1')).rejects.toBeInstanceOf(VendorConnectionNotFoundError);
  });
});