import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAiExecuteRouter } from '../../src/controllers/ai-execute.controller.js';

function buildApp(handlers?: NonNullable<Parameters<typeof createAiExecuteRouter>[0]>['handlers']) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'user-123', tenantId: 'tenant-123' };
    next();
  });
  app.use('/api/ai', createAiExecuteRouter({ handlers }));
  return app;
}

function validBody(overrides?: Record<string, unknown>) {
  return {
    intent: 'CREATE_ORDER',
    confidence: 0.93,
    actionPayload: {
      engagementId: 'eng-1',
      clientOrderId: 'co-1',
      propertyId: 'prop-1',
      clientId: 'client-1',
      orderNumber: 'ORD-1',
      propertyDetails: {
        propertyType: 'single_family_residential',
        occupancy: 'owner_occupied',
        features: ['garage'],
      },
      orderType: 'FULL_APPRAISAL',
      productType: 'FULL_APPRAISAL',
      dueDate: '2030-01-01T00:00:00.000Z',
      rushOrder: false,
      borrowerInformation: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
      loanInformation: {
        loanAmount: 450000,
        loanType: 'conventional',
        loanPurpose: 'purchase',
      },
      contactInformation: {
        name: 'Jane Doe',
        role: 'borrower',
        preferredMethod: 'email',
      },
      priority: 'normal',
      tags: [],
      metadata: {},
    },
    presentationSchema: {
      title: 'Create Order',
      summary: 'Create one order',
      fields: [{ label: 'Order', value: 'ORD-1', status: 'added' }],
      actionButtonText: 'Confirm',
    },
    ...overrides,
  };
}

describe('AiExecuteController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid execute payloads', async () => {
    const app = buildApp();

    const res = await request(app).post('/api/ai/execute').send({ intent: 'CREATE_ORDER' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid AI execute payload');
    expect(res.body.issues).toBeDefined();
  });

  it('returns 400 for invalid intent-specific payloads before dispatch', async () => {
    const createOrderHandler = vi.fn();
    const app = buildApp({ CREATE_ORDER: createOrderHandler });

    const res = await request(app)
      .post('/api/ai/execute')
      .send(validBody({ actionPayload: { clientId: 'client-1' } }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid AI intent payload for CREATE_ORDER');
    expect(createOrderHandler).not.toHaveBeenCalled();
  });

  it('dispatches to the typed handler map for the parsed intent', async () => {
    const createOrderHandler = vi.fn().mockResolvedValue({
      message: 'Order created',
      data: { orderId: 'ord-123' },
    });
    const app = buildApp({ CREATE_ORDER: createOrderHandler });

    const res = await request(app).post('/api/ai/execute').send(validBody());

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('CREATE_ORDER');
    expect(res.body.message).toBe('Order created');
    expect(res.body.data).toEqual({ orderId: 'ord-123' });
    expect(createOrderHandler).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 'ORD-1' }),
      { tenantId: 'tenant-123', userId: 'user-123' },
      expect.objectContaining({ intent: 'CREATE_ORDER', confidence: 0.93 }),
    );
  });

  it('returns 501 when the intent route exists but the handler is not implemented yet', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/ai/execute')
      .send(validBody({ intent: 'ASSIGN_VENDOR', actionPayload: { orderId: 'o-1', vendorId: 'v-1' } }));

    expect(res.status).toBe(501);
    expect(res.body.error).toContain("AI execute handler 'ASSIGN_VENDOR' is not implemented yet");
  });
});