/**
 * Integration test: AIM-Port inbound OrderRequest through the vendor-integration
 * controller → VendorIntegrationService → VendorOrderReferenceService →
 * EngagementService.createEngagement → ClientOrderService.addVendorOrders.
 *
 * Verifies the complete engagement-primacy pipeline is wired correctly from
 * the HTTP edge all the way to VendorOrder creation and ACK generation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockGetConnection,
  mockResolveSecret,
  mockQueryItems,
  mockCreateItem,
  mockUpsertItem,
  mockCreateEngagement,
  mockPlaceClientOrder,
  mockPersistInboundEvents,
} = vi.hoisted(() => ({
  mockGetConnection: vi.fn(),
  mockResolveSecret: vi.fn(),
  mockQueryItems: vi.fn(),
  mockCreateItem: vi.fn(),
  mockUpsertItem: vi.fn(),
  mockCreateEngagement: vi.fn(),
  mockPlaceClientOrder: vi.fn(),
  mockPersistInboundEvents: vi.fn(),
}));

vi.mock('../../src/services/vendor-integrations/VendorConnectionService.js', () => ({
  VendorConnectionService: vi.fn().mockImplementation(() => ({
    getActiveConnectionByInboundIdentifier: mockGetConnection,
    resolveSecret: mockResolveSecret,
  })),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    queryItems: mockQueryItems,
    createItem: mockCreateItem,
    upsertItem: mockUpsertItem,
  })),
}));

vi.mock('../../src/services/property-record.service.js', () => ({
  PropertyRecordService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/engagement.service.js', () => ({
  EngagementService: vi.fn().mockImplementation(() => ({
    createEngagement: mockCreateEngagement,
  })),
}));

vi.mock('../../src/services/client-order.service.js', () => ({
  ClientOrderService: vi.fn().mockImplementation(() => ({
    placeClientOrder: mockPlaceClientOrder,
  })),
}));

vi.mock('../../src/services/vendor-integrations/VendorEventOutboxService.js', () => ({
  VendorEventOutboxService: vi.fn().mockImplementation(() => ({
    persistInboundEvents: mockPersistInboundEvents,
  })),
}));

// OrderDecompositionService is created internally by VendorOrderReferenceService.
// Mock it to return no rules (→ 1-to-1 fallback) so tests don't hit getContainer.
vi.mock('../../src/services/order-decomposition.service.js', () => ({
  OrderDecompositionService: vi.fn().mockImplementation(() => ({
    compose: vi.fn().mockResolvedValue([]),
  })),
}));

import { createVendorIntegrationRouter } from '../../src/controllers/vendor-integration.controller.js';

// ── fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID = '501102';
const API_KEY = 'test-api-secret';
const VENDOR_ORDER_ID = 'AP-7777';

const mockConnection = {
  id: 'vc-test-1',
  tenantId: 'tenant-aim',
  vendorType: 'aim-port' as const,
  lenderId: 'lender-abc',
  lenderName: 'ABC Mortgage',
  inboundIdentifier: CLIENT_ID,
  credentials: {
    inboundApiKeySecretName: 'aim-port-inbound-key',
    outboundApiKeySecretName: 'aim-port-outbound-key',
    outboundClientId: CLIENT_ID,
  },
  outboundEndpointUrl: 'https://aim-port.example.com',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockEngagement = {
  id: 'eng-001',
  tenantId: 'tenant-aim',
  status: 'active',
  properties: [
    {
      id: 'eprop-001',
      property: { address: '456 Oak Ave', city: 'Austin', state: 'TX', zipCode: '78701' },
      clientOrders: [
        { id: 'co-001', productType: 'FULL_APPRAISAL', status: 'pending' },
      ],
    },
  ],
} as any;

const mockVendorOrder = {
  id: 'vo-999',
  orderNumber: 'VND-20260510-TEST01',
  engagementId: 'eng-001',
  engagementPropertyId: 'eprop-001',
  engagementClientOrderId: 'co-001',
  tenantId: 'tenant-aim',
  status: 'pending',
} as any;

/** Minimal AIM-Port OrderRequest body */
const aimPortOrderRequest = {
  OrderRequest: {
    login: {
      client_id: CLIENT_ID,
      api_key: API_KEY,
      order_id: VENDOR_ORDER_ID,
    },
    order: {
      order_id: VENDOR_ORDER_ID,
      order_type: 'residential',
      address: '456 Oak Ave',
      city: 'Austin',
      state: 'TX',
      zip_code: '78701',
      county: 'Travis',
      property_type: 'sfr',
      due_date: '2026-06-15',
      disclosed_fee: '650.00',
      rush: false,
      loan_number: 'LN-20260510',
      loan_amount: 485000,
      loan_type: 'Conventional',
      loan_purpose: 'Purchase',
      occupancy: 'Owner Occupied',
      borrower: {
        name: 'John Smith',
        email: 'jsmith@email.com',
        phone: '512-555-0100',
      },
      reports: [
        { id: 49079, name: '1004 Single-family Appraisal' },
      ],
    },
  },
};

// ── test setup ────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // APIM enforcement is skipped in dev (ENVIRONMENT not set → defaults to 'dev')
  app.use('/api/vendor-integrations', createVendorIntegrationRouter());
  return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AIM-Port inbound pipeline — full controller integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Connection lookup: authorize via inboundIdentifier = client_id
    mockGetConnection.mockResolvedValue(mockConnection);
    // Secret lookup for HMAC / API-key auth
    mockResolveSecret.mockResolvedValue(API_KEY);

    // No pre-existing VendorOrder for this vendor order id
    mockQueryItems.mockResolvedValue({ success: true, data: [] });

    // Outbox persistence — just needs to not throw
    mockPersistInboundEvents.mockResolvedValue([]);

    // Engagement + VendorOrder creation
    mockCreateEngagement.mockResolvedValue(mockEngagement);
    mockPlaceClientOrder.mockResolvedValue({
      clientOrder: { id: 'co-001', tenantId: 'tenant-aim' },
      vendorOrders: [mockVendorOrder],
    });
  });

  it('returns 200 ACK with the new VendorOrder id stamped as order_id', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/vendor-integrations/aim-port/inbound')
      .set('Content-Type', 'application/json')
      .send(aimPortOrderRequest);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      client_id: CLIENT_ID,
      success: 'true',
      order_id: mockVendorOrder.id,
      fee: 650,
    });
  });

  it('stamps X-Vendor-Type and X-Vendor-Connection-Id response headers', async () => {
    const res = await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(res.headers['x-vendor-type']).toBe('aim-port');
    expect(res.headers['x-vendor-connection-id']).toBe(mockConnection.id);
    expect(res.headers['x-normalized-event-count']).toBe('1');
  });

  it('calls EngagementService.createEngagement with property-anchored payload', async () => {
    await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(mockCreateEngagement).toHaveBeenCalledOnce();
    const [createArgs] = mockCreateEngagement.mock.calls[0]!;

    expect(createArgs.tenantId).toBe('tenant-aim');
    expect(createArgs.client.clientId).toBe('lender-abc');

    // Property is the anchor — address fields must be present
    const prop = createArgs.properties[0];
    expect(prop.property.address).toBe('456 Oak Ave');
    expect(prop.property.city).toBe('Austin');
    expect(prop.property.state).toBe('TX');
    expect(prop.property.zipCode).toBe('78701');

    // Loan number goes into loanReferences — NOT as a top-level property
    expect(prop.loanReferences?.[0]?.loanNumber).toBe('LN-20260510');
    expect(prop.loanReferences?.[0]?.loanAmount).toBe(485000);
  });

  it('calls ClientOrderService.placeClientOrder linked to the engagement hierarchy', async () => {
    await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(mockPlaceClientOrder).toHaveBeenCalledOnce();
    const [input, specs] = mockPlaceClientOrder.mock.calls[0]!;

    // Must reference the client order id from the created engagement
    expect(input.clientOrderId).toBe('co-001');
    expect(input.tenantId).toBe('tenant-aim');
    expect(input.engagementId).toBe('eng-001');
    expect(input.engagementPropertyId).toBe('eprop-001');

    // Product type derived from the AIM-Port report (1004 → FULL_APPRAISAL)
    expect(specs[0].vendorWorkType).toBe('FULL_APPRAISAL');

    // Vendor integration metadata must be stamped for idempotency queries
    expect(input.metadata?.vendorIntegration?.vendorOrderId).toBe(VENDOR_ORDER_ID);
    expect(input.metadata?.vendorIntegration?.connectionId).toBe('vc-test-1');
    expect(input.metadata?.vendorIntegration?.vendorType).toBe('aim-port');
  });

  it('returns existing VendorOrder without re-creating engagement when order already exists', async () => {
    // Pre-existing VendorOrder already linked to engagement hierarchy
    mockQueryItems.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'vo-existing-42',
          orderNumber: 'VND-EXISTING',
          engagementId: 'eng-existing',
          engagementPropertyId: 'eprop-existing',
          engagementClientOrderId: 'co-existing',
        },
      ],
    });

    const res = await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(res.status).toBe(200);
    expect(res.body.order_id).toBe('vo-existing-42');
    expect(res.body.success).toBe('true');

    // Must NOT create a duplicate engagement or vendor order
    expect(mockCreateEngagement).not.toHaveBeenCalled();
    expect(mockPlaceClientOrder).not.toHaveBeenCalled();
  });

  it('re-creates engagement when existing order lacks engagement ancestry (orphan migration)', async () => {
    // Legacy orphan: has an order id but no engagementId — should be treated as new
    mockQueryItems.mockResolvedValue({
      success: true,
      data: [{ id: 'vo-orphan-1', orderNumber: undefined /* no engagementId */ }],
    });

    const res = await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(res.status).toBe(200);
    expect(res.body.order_id).toBe(mockVendorOrder.id);

    // Full pipeline must run for orphan orders
    expect(mockCreateEngagement).toHaveBeenCalledOnce();
    expect(mockPlaceClientOrder).toHaveBeenCalledOnce();
  });

  it('returns 404 when no active vendor connection is found for client_id', async () => {
    mockGetConnection.mockRejectedValue(new Error('No active vendor connection not found for identifier'));

    const res = await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when API key authentication fails', async () => {
    mockResolveSecret.mockResolvedValue('wrong-api-key');

    const res = await request(buildApp())
      .post('/api/vendor-integrations/aim-port/inbound')
      .send(aimPortOrderRequest);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when APIM header is absent in non-dev environment', async () => {
    const originalEnv = process.env.ENVIRONMENT;
    process.env.ENVIRONMENT = 'production';

    try {
      const res = await request(buildApp())
        .post('/api/vendor-integrations/aim-port/inbound')
        // deliberately omit x-apim-forwarded
        .send(aimPortOrderRequest);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('VENDOR_INTEGRATION_EDGE_ENFORCEMENT_FAILED');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.ENVIRONMENT;
      } else {
        process.env.ENVIRONMENT = originalEnv;
      }
    }
  });

  it('passes when APIM header is present in non-dev environment', async () => {
    const originalEnv = process.env.ENVIRONMENT;
    process.env.ENVIRONMENT = 'production';

    try {
      const res = await request(buildApp())
        .post('/api/vendor-integrations/aim-port/inbound')
        .set('x-apim-forwarded', 'true')
        .send(aimPortOrderRequest);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe('true');
      expect(res.body.order_id).toBe(mockVendorOrder.id);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.ENVIRONMENT;
      } else {
        process.env.ENVIRONMENT = originalEnv;
      }
    }
  });
});
