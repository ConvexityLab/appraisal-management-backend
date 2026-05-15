import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { validateCreateOrder } from '../../src/middleware/order-validation.middleware.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/orders', ...validateCreateOrder(), (_req, res) => {
    res.status(201).json({ success: true });
  });
  return app;
}

describe('validateCreateOrder', () => {
  it('accepts create-order requests that carry canonical propertyId without embedded propertyAddress', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/orders')
      .send({
        propertyId: 'prop-1',
        clientId: 'client-1',
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: '2026-05-11T00:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true });
  });

  it('accepts legacy embedded propertyAddress requests without canonical propertyId', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/orders')
      .send({
        propertyAddress: {
          streetAddress: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
        },
        clientId: 'client-1',
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: '2026-05-11T00:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true });
  });

  it('rejects create-order requests when both propertyId and propertyAddress are missing', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/orders')
      .send({
        clientId: 'client-1',
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: '2026-05-11T00:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        expect.objectContaining({ msg: 'propertyAddress or propertyId is required' }),
      ]),
    }));
  });

  it('rejects malformed embedded propertyAddress payloads when provided', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/orders')
      .send({
        propertyAddress: {
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
        },
        clientId: 'client-1',
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: '2026-05-11T00:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        expect.objectContaining({
          msg: 'propertyAddress.streetAddress is required when propertyAddress is provided',
        }),
      ]),
    }));
  });
});
