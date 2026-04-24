import { describe, expect, it } from 'vitest';
import { AimPortAdapter } from '../../src/services/vendor-integrations/AimPortAdapter.js';
import type { VendorConnection } from '../../src/types/vendor-integration.types.js';

const connection: VendorConnection = {
  id: 'vc-1',
  tenantId: 'tenant-1',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
  lenderName: 'Lender One',
  inboundIdentifier: 'client-123',
  credentials: {
    inboundApiKeySecretName: 'inbound-secret',
    outboundApiKeySecretName: 'outbound-secret',
    outboundClientId: 'client-123',
  },
  outboundEndpointUrl: 'https://vendor.example.com',
  active: true,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
};

describe('AimPortAdapter', () => {
  it('recognizes inbound OrderRequest payloads and uses a real internal order reference when provided', async () => {
    const adapter = new AimPortAdapter();
    const body = {
      OrderRequest: {
        login: {
          client_id: '501102',
          api_key: 'secret-key',
        },
        order: {
          order_id: 'AP-1001',
          order_type: 'residential',
          address: '123 Main St',
          city: 'Dallas',
          state: 'TX',
          zip_code: '75001',
          property_type: 'sfr',
          borrower: {
            name: 'Jane Borrower',
          },
          reports: [{ id: 49079, name: '1004 Single-family Appraisal' }],
          rush: true,
          disclosed_fee: '550.00',
        },
        files: [
          {
            file_id: 'file-1',
            content: 'YmFzZTY0',
            filename: 'contract.pdf',
            category: 'salescontract',
          },
        ],
      },
    };

    await expect(adapter.authenticateInbound(body, {}, {
      ...connection,
      inboundIdentifier: '501102',
    }, {
      resolveSecret: async () => 'secret-key',
    })).resolves.toBeUndefined();

    const result = await adapter.handleInbound(body, {}, {
      ...connection,
      inboundIdentifier: '501102',
      credentials: {
        ...connection.credentials,
        outboundClientId: '501102',
      },
    }, {
      resolveSecret: async () => 'secret-key',
      createOrGetOrderReference: async () => ({
        orderId: 'order-123',
        orderNumber: 'VND-20260423-ABC123',
        existed: false,
      }),
    });

    expect(result.domainEvents).toHaveLength(1);
    expect(result.domainEvents[0]?.eventType).toBe('vendor.order.received');
    expect(result.domainEvents[0]?.vendorOrderId).toBe('AP-1001');
    expect(result.domainEvents[0]?.ourOrderId).toBe('order-123');
    expect(result.ack.statusCode).toBe(200);
    expect(result.ack.body).toMatchObject({
      client_id: '501102',
      success: 'true',
      order_id: 'order-123',
      fee: 550,
    });
  });

  it('builds outbound OrderFilesRequest payloads for completed reports', async () => {
    const adapter = new AimPortAdapter();
    const call = await adapter.buildOutboundCall({
      id: 'evt-1',
      eventType: 'vendor.order.completed',
      vendorType: 'aim-port',
      vendorOrderId: 'AP-1001',
      ourOrderId: 'order-1',
      lenderId: 'lender-1',
      tenantId: 'tenant-1',
      occurredAt: '2026-04-23T00:00:00.000Z',
      payload: {
        files: [
          {
            fileId: 'final-1',
            filename: 'report.pdf',
            category: 'appraisal',
            content: 'YmFzZTY0',
          },
        ],
      },
    }, {
      ...connection,
      credentials: {
        ...connection.credentials,
        outboundClientId: '501102',
      },
    }, {
      resolveSecret: async () => 'outbound-key',
    });

    expect(call).not.toBeNull();
    expect(call?.body).toMatchObject({
      OrderFilesRequest: {
        login: {
          client_id: '501102',
          api_key: 'outbound-key',
          order_id: 'AP-1001',
        },
      },
    });
  });

  it('maps OrderScheduledRequest into the normalized scheduling payload', async () => {
    const adapter = new AimPortAdapter();
    const result = await adapter.handleInbound(
      {
        OrderScheduledRequest: {
          login: {
            client_id: 'client-123',
            api_key: 'secret',
            order_id: 'AP-1001',
          },
          order: {
            inspection_date: '2026-04-25',
            appraiser_id: 'appraiser-42',
            scheduled_start_time: '09:00',
            scheduled_end_time: '11:00',
            scheduled_timezone: 'America/Chicago',
            requested_by: 'client',
            inspection_notes: 'Morning appointment only',
            appointment_type: 'property_inspection',
            property_access: {
              type: 'scheduled_access',
              name: 'Jane Borrower',
              cell_phone: '555-0100',
              email: 'jane@example.com',
              access_instructions: 'Gate code 1234',
              requires_escort: false,
              pet_warning: 'Dog in yard',
              parking_instructions: 'Street parking only',
              special_requirements: ['Call on arrival'],
            },
          },
        },
      },
      {},
      {
        ...connection,
        inboundIdentifier: 'client-123',
      },
      { resolveSecret: async () => 'secret' },
    );

    expect(result.domainEvents).toHaveLength(1);
    expect(result.domainEvents[0]).toMatchObject({
      eventType: 'vendor.order.scheduled',
      payload: {
        inspectionDate: '2026-04-25',
        appraiserId: 'appraiser-42',
        requestedBy: 'client',
        scheduledSlot: {
          date: '2026-04-25',
          startTime: '09:00',
          endTime: '11:00',
          timezone: 'America/Chicago',
        },
        propertyAccess: {
          contactName: 'Jane Borrower',
          contactPhone: '555-0100',
          accessInstructions: 'Gate code 1234',
          requiresEscort: false,
        },
      },
    });
  });

  it('rejects OrderScheduledRequest payloads that omit required scheduling fields', async () => {
    const adapter = new AimPortAdapter();
    await expect(
      adapter.handleInbound(
        {
          OrderScheduledRequest: {
            login: {
              client_id: 'client-123',
              api_key: 'secret',
              order_id: 'AP-1001',
            },
            order: {
              inspection_date: '2026-04-25',
            },
          },
        },
        {},
        {
          ...connection,
          inboundIdentifier: 'client-123',
        },
        { resolveSecret: async () => 'secret' },
      ),
    ).rejects.toThrow(/missing required scheduling fields/i);
  });
});
