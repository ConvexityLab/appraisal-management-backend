import { describe, expect, it, vi } from 'vitest';
import { VendorOrderReferenceService } from '../../src/services/vendor-integrations/VendorOrderReferenceService.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

/** Mock OrderDecompositionService that returns no rule (1-to-1 fallback path). */
const noRuleDecompositionService = { compose: vi.fn().mockResolvedValue([]) } as any;

const connection: VendorConnection = {
  id: 'vc-aim-1',
  tenantId: 'tenant-1',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
  lenderName: 'Sample Lender',
  inboundIdentifier: '501102',
  credentials: {
    inboundApiKeySecretName: 'aim-inbound',
    outboundApiKeySecretName: 'aim-outbound',
    outboundClientId: '501102',
  },
  outboundEndpointUrl: 'https://vendor.example.com/api',
  active: true,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
};

const event: VendorDomainEvent = {
  id: 'evt-1',
  eventType: 'vendor.order.received',
  vendorType: 'aim-port',
  vendorOrderId: 'AP-1001',
  ourOrderId: null,
  lenderId: 'lender-1',
  tenantId: 'tenant-1',
  occurredAt: '2026-04-23T00:00:00.000Z',
  payload: {
    orderType: 'residential',
    address: '123 Main St',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75001',
    loanNumber: 'LN-1',
    disclosedFee: 550,
    loanAmount: 500000,
    propertyType: 'sfr',
    borrower: {
      name: 'Jane Borrower',
      email: 'jane@example.com',
      phone: '555-111-2222',
    },
    products: [{ id: 49079, name: '1004 Single-family Appraisal' }],
    dueDate: '2026-05-01T00:00:00.000Z',
    rush: false,
    files: [],
  },
};

function makeEngagementResult() {
  return {
    id: 'eng-1',
    properties: [
      {
        id: 'prop-1',
        clientOrders: [{ id: 'co-1', productType: 'FULL_APPRAISAL', status: 'PLACED', vendorOrderIds: [] }],
      },
    ],
  };
}

describe('VendorOrderReferenceService', () => {
  it('returns an existing order reference when the vendor order was already created', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'vo-existing',
            orderNumber: 'VND-EXISTING',
            engagementId: 'eng-existing',
            engagementClientOrderId: 'co-existing',
          },
        ],
      }),
    };
    const engagementService = { createEngagement: vi.fn() } as any;
    const clientOrderService = { placeClientOrder: vi.fn() } as any;

    const service = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
    const result = await service.createOrGetOrderReference(connection, event);

    expect(result).toEqual({
      orderId: 'vo-existing',
      orderNumber: 'VND-EXISTING',
      existed: true,
    });
    expect(engagementService.createEngagement).not.toHaveBeenCalled();
    expect(clientOrderService.placeClientOrder).not.toHaveBeenCalled();
  });

  it('creates an engagement + vendor order through the proper pipeline when the vendor order is first seen', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };
    const engagementService = {
      createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
    } as any;
    const clientOrderService = {
      placeClientOrder: vi.fn().mockResolvedValue({
        clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
        vendorOrders: [{ id: 'vo-new', orderNumber: 'VND-NEW-1' }],
      }),
    } as any;

    const service = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
    const result = await service.createOrGetOrderReference(connection, event);

    expect(result).toEqual({
      orderId: 'vo-new',
      orderNumber: 'VND-NEW-1',
      existed: false,
    });

    // Engagement was created property-first (not loan-first)
    expect(engagementService.createEngagement).toHaveBeenCalledTimes(1);
    const engagementArg = engagementService.createEngagement.mock.calls[0][0];
    expect(engagementArg.tenantId).toBe('tenant-1');
    expect(engagementArg.client.clientId).toBe('lender-1');
    expect(engagementArg.properties).toHaveLength(1);
    expect(engagementArg.properties[0].property.address).toBe('123 Main St');
    expect(engagementArg.properties[0].property.city).toBe('Dallas');
    // Loan number is metadata, not a primary key
    expect(engagementArg.properties[0].loanReferences[0].loanNumber).toBe('LN-1');

    // VendorOrder placed through ClientOrderService.placeClientOrder (atomically with ClientOrder)
    expect(clientOrderService.placeClientOrder).toHaveBeenCalledTimes(1);
    const [input, specs] = clientOrderService.placeClientOrder.mock.calls[0];
    expect(input.clientOrderId).toBe('co-1');
    expect(input.tenantId).toBe('tenant-1');
    expect(input.engagementId).toBe('eng-1');
    expect(input.engagementPropertyId).toBe('prop-1');
    expect(input.metadata.vendorIntegration.vendorOrderId).toBe('AP-1001');
    expect(specs[0].vendorWorkType).toBe('FULL_APPRAISAL');
  });

  it('treats an existing vendor order missing engagement ancestry as new (migration guard)', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'vo-orphan',
            orderNumber: 'VND-ORPHAN',
            // no engagementId / engagementClientOrderId — legacy orphan
          },
        ],
      }),
    };
    const engagementService = {
      createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
    } as any;
    const clientOrderService = {
      placeClientOrder: vi.fn().mockResolvedValue({
        clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
        vendorOrders: [{ id: 'vo-new-2', orderNumber: 'VND-NEW-2' }],
      }),
    } as any;

    const service = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
    const result = await service.createOrGetOrderReference(connection, event);

    // Should NOT return the orphan; should create a fresh set
    expect(result.existed).toBe(false);
    expect(engagementService.createEngagement).toHaveBeenCalledTimes(1);
  });

  it('throws when queryItems fails', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: false, error: { message: 'Cosmos error' } }),
    };
    const service = new VendorOrderReferenceService(db as any, {} as any, {} as any, undefined, noRuleDecompositionService);

    await expect(service.createOrGetOrderReference(connection, event)).rejects.toThrow('Cosmos error');
  });

  it('throws when dueDate is missing', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };
    const badEvent: VendorDomainEvent = {
      ...event,
      payload: { ...(event.payload as any), dueDate: '' },
    };
    const service = new VendorOrderReferenceService(db as any, {} as any, {} as any, undefined, noRuleDecompositionService);

    await expect(service.createOrGetOrderReference(connection, badEvent)).rejects.toThrow(
      'payload.dueDate is required',
    );
  });

  it('calls triggerVendorAssignment for the created VendorOrder when an orchestrator ref is provided', async () => {
    const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
    const engagementService = {
      createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
    } as any;
    const clientOrderService = {
      placeClientOrder: vi.fn().mockResolvedValue({
        clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
        vendorOrders: [{ id: 'vo-new', orderNumber: 'VND-NEW-1', productType: 'FULL_APPRAISAL' }],
      }),
    } as any;

    const triggerVendorAssignment = vi.fn().mockResolvedValue(undefined);
    const orchestratorRef = () => ({ triggerVendorAssignment });

    const service = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, orchestratorRef, noRuleDecompositionService);
    await service.createOrGetOrderReference(connection, event);

    // Should fire for the single VendorOrder
    expect(triggerVendorAssignment).toHaveBeenCalledTimes(1);
    expect(triggerVendorAssignment).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'vo-new',
      tenantId: 'tenant-1',
      engagementId: 'eng-1',
      productType: 'FULL_APPRAISAL',
      propertyState: 'TX',
      clientId: 'lender-1',
      priority: 'STANDARD',
    }));
  });

  it('creates one VendorOrderSpec per product for multi-product inbound orders', async () => {
    const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
    const engagementService = {
      createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
    } as any;
    const clientOrderService = {
      placeClientOrder: vi.fn().mockResolvedValue({
        clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
        vendorOrders: [
          { id: 'vo-1', orderNumber: 'VND-1', productType: 'FULL_APPRAISAL' },
          { id: 'vo-2', orderNumber: 'VND-2', productType: 'DESKTOP_APPRAISAL' },
        ],
      }),
    } as any;
    const triggerVendorAssignment = vi.fn().mockResolvedValue(undefined);

    const multiProductEvent: VendorDomainEvent = {
      ...event,
      payload: {
        ...(event.payload as any),
        products: [
          { id: 49079, name: '1004 Single-family Appraisal' },
          { id: 2055,  name: 'Desktop Appraisal' },
        ],
      },
    };

    const service = new VendorOrderReferenceService(
      db as any,
      engagementService,
      clientOrderService,
      () => ({ triggerVendorAssignment }),
      noRuleDecompositionService,
    );
    await service.createOrGetOrderReference(connection, multiProductEvent);

    // placeClientOrder should receive two specs
    const [, specs] = clientOrderService.placeClientOrder.mock.calls[0];
    expect(specs).toHaveLength(2);
    expect(specs[0].vendorWorkType).toBe('FULL_APPRAISAL');
    expect(specs[1].vendorWorkType).toBe('DESKTOP_APPRAISAL');  // 2055 id but name contains 'Desktop' → DESKTOP_APPRAISAL wins

    // triggerVendorAssignment should fire once per VendorOrder
    expect(triggerVendorAssignment).toHaveBeenCalledTimes(2);
    expect(triggerVendorAssignment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'vo-1' }));
    expect(triggerVendorAssignment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'vo-2' }));
  });

  it('does not call triggerVendorAssignment (and logs warning) when no orchestratorRef provided', async () => {
    const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
    const engagementService = {
      createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
    } as any;
    const clientOrderService = {
      placeClientOrder: vi.fn().mockResolvedValue({
        clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
        vendorOrders: [{ id: 'vo-new', orderNumber: 'VND-NEW-1' }],
      }),
    } as any;

    // No orchestratorRef — should succeed without throwing
    const service = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
    const result = await service.createOrGetOrderReference(connection, event);

    expect(result.existed).toBe(false);
    expect(result.orderId).toBe('vo-new');
  });

  describe('AIM-Port product ID → ProductType mapping', () => {
    const makeSingleProductEvent = (productId: number, productName: string): VendorDomainEvent => ({
      ...event,
      payload: {
        ...(event.payload as any),
        products: [{ id: productId, name: productName }],
      },
    });

    const mappingCases: Array<[number, string, string]> = [
      // Previously broken — no keyword matched the old heuristics
      [48869, 'Multi-Family 2-4 Unit 1025/72 - FHA',           'FULL_APPRAISAL'],
      [48982, 'Multi-Family 2-4 Unit 1025/72 - FHA + Operating Income', 'FULL_APPRAISAL'],
      [49099, 'Multi-Family 2-4 Unit 1025/72 + Operating Income', 'FULL_APPRAISAL'],
      [48909, '2000/1032 - One-Unit Residential Field Review',   'FIELD_REVIEW'],
      [48910, '2000A/1072 - 2-4 Unit Residential Field Review', 'FIELD_REVIEW'],
      [48912, 'URAR Appraisal Desk Review - DRF',               'DESK_REVIEW'],
      [48899, '1004D/442 - Recertification of Value',           'DESKTOP_APPRAISAL'],
      [48900, '1004D/442 - Update / Completion Certificate',    'DESKTOP_APPRAISAL'],
      // Condo products
      [48935, 'Condo 1073/465',                                 'CONDO_APPRAISAL'],
      [48930, 'Condo 1073/465 - FHA',                           'CONDO_APPRAISAL'],
      [49052, 'Condo 1073/465 + Operating Income Stmt (216)',   'CONDO_APPRAISAL'],
      // Standard SFR full appraisals
      [48952, 'SFR 1004/70',                                    'FULL_APPRAISAL'],
      [49081, 'SFR 1004/70 - FHA',                              'FULL_APPRAISAL'],
      [48873, 'Land Appraisal',                                 'FULL_APPRAISAL'],
      [48915, 'Manufactured Home 1004C/70B',                    'FULL_APPRAISAL'],
    ];

    it.each(mappingCases)(
      'maps product id=%i (%s) → %s',
      async (productId, productName, expectedProductType) => {
        const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
        const engagementService = {
          createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
        } as any;
        const clientOrderService = {
          placeClientOrder: vi.fn().mockResolvedValue({
            clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
            vendorOrders: [{ id: 'vo-mapped', orderNumber: 'VND-MAPPED' }],
          }),
        } as any;

        const svc = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
        await svc.createOrGetOrderReference(connection, makeSingleProductEvent(productId, productName));

        const [, specs] = clientOrderService.placeClientOrder.mock.calls[0];
        expect(specs[0].vendorWorkType).toBe(expectedProductType);
      },
    );

    it('throws for an unknown numeric ID with no matching keyword', async () => {
      const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
      const engagementService = {
        createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
      } as any;
      const clientOrderService = { placeClientOrder: vi.fn() } as any;

      const svc = new VendorOrderReferenceService(db as any, engagementService, clientOrderService, undefined, noRuleDecompositionService);
      const unknownEvent = makeSingleProductEvent(99999, 'Completely Unknown Report Type XYZ');

      await expect(
        svc.createOrGetOrderReference(connection, unknownEvent),
      ).rejects.toThrow('Unable to map vendor product to internal productType');
    });
  });

  describe('OrderDecompositionService integration', () => {
    it('uses templates from decomposition rule when a rule is found for the product type', async () => {
      const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
      const engagementService = {
        createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
      } as any;
      const clientOrderService = {
        placeClientOrder: vi.fn().mockResolvedValue({
          clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
          vendorOrders: [
            { id: 'vo-desk', orderNumber: 'VND-DESK', productType: 'DESK_REVIEW' },
            { id: 'vo-field', orderNumber: 'VND-FIELD', productType: 'FIELD_REVIEW' },
          ],
        }),
      } as any;

      // Rule decomposes FULL_APPRAISAL into DESK_REVIEW + FIELD_REVIEW
      const decompositionService = {
        compose: vi.fn().mockResolvedValue([
          { vendorWorkType: 'DESK_REVIEW', templateKey: 'desk' },
          { vendorWorkType: 'FIELD_REVIEW', templateKey: 'field' },
        ]),
      } as any;

      const svc = new VendorOrderReferenceService(
        db as any, engagementService, clientOrderService, undefined, decompositionService,
      );
      await svc.createOrGetOrderReference(connection, event);

      // compose() was called with the correct scope
      expect(decompositionService.compose).toHaveBeenCalledWith(
        'tenant-1', 'lender-1', 'FULL_APPRAISAL',
      );

      // placeClientOrder received the rule-driven templates instead of 1-to-1
      const [, specs] = clientOrderService.placeClientOrder.mock.calls[0];
      expect(specs).toHaveLength(2);
      expect(specs[0].vendorWorkType).toBe('DESK_REVIEW');
      expect(specs[1].vendorWorkType).toBe('FIELD_REVIEW');
    });

    it('falls back to 1-to-1 spec when no decomposition rule exists for the product type', async () => {
      const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
      const engagementService = {
        createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
      } as any;
      const clientOrderService = {
        placeClientOrder: vi.fn().mockResolvedValue({
          clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
          vendorOrders: [{ id: 'vo-1', orderNumber: 'VND-1', productType: 'FULL_APPRAISAL' }],
        }),
      } as any;

      // No rule found → returns []
      const decompositionService = { compose: vi.fn().mockResolvedValue([]) } as any;

      const svc = new VendorOrderReferenceService(
        db as any, engagementService, clientOrderService, undefined, decompositionService,
      );
      await svc.createOrGetOrderReference(connection, event);

      // Falls back: single spec with vendorWorkType = productType
      const [, specs] = clientOrderService.placeClientOrder.mock.calls[0];
      expect(specs).toHaveLength(1);
      expect(specs[0].vendorWorkType).toBe('FULL_APPRAISAL');
    });

    it('merges order special instructions into template specs that have none', async () => {
      const db = { queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }) };
      const engagementService = {
        createEngagement: vi.fn().mockResolvedValue(makeEngagementResult()),
      } as any;
      const clientOrderService = {
        placeClientOrder: vi.fn().mockResolvedValue({
          clientOrder: { id: 'co-1', tenantId: 'tenant-1' },
          vendorOrders: [{ id: 'vo-1', orderNumber: 'VND-1' }],
        }),
      } as any;

      // Template has no instructions; order has special instructions
      const decompositionService = {
        compose: vi.fn().mockResolvedValue([{ vendorWorkType: 'FULL_APPRAISAL', templateKey: 'full' }]),
      } as any;

      const eventWithInstructions: VendorDomainEvent = {
        ...event,
        payload: { ...(event.payload as any), specialInstructions: 'Rush — lender closing in 5 days' },
      };

      const svc = new VendorOrderReferenceService(
        db as any, engagementService, clientOrderService, undefined, decompositionService,
      );
      await svc.createOrGetOrderReference(connection, eventWithInstructions);

      const [, specs] = clientOrderService.placeClientOrder.mock.calls[0];
      expect(specs[0].instructions).toBe('Rush — lender closing in 5 days');
    });
  });
});
