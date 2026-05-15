import { describe, expect, it, vi } from 'vitest';
import {
  getPropertyAddress,
  getPropertyDetails,
  OrderContextLoader,
  type OrderContext,
} from '../../src/services/order-context-loader.service.js';

describe('OrderContextLoader property accessors', () => {
  it('prefers canonical PropertyRecord fields over workflow copies when property is loaded', () => {
    const ctx: OrderContext = {
      vendorOrder: {
        id: 'order-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        orderNumber: '100',
        productType: 'appraisal',
        status: 'CREATED',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        propertyAddress: {
          streetAddress: '10 Workflow Street',
          city: 'Workflow City',
          state: 'TX',
          zipCode: '75001',
          county: 'Workflow County',
        },
        propertyDetails: {
          propertyType: 'commercial',
          occupancy: 'investment',
          yearBuilt: 1980,
          grossLivingArea: 1400,
          bedrooms: 2,
          bathrooms: 1,
          stories: 1,
          features: ['workflow'],
        },
      } as any,
      clientOrder: null,
      property: {
        id: 'prop-1',
        tenantId: 'tenant-1',
        address: {
          street: '55 Canonical Avenue',
          city: 'Canonical City',
          state: 'TX',
          zip: '75002',
        },
        propertyType: 'single_family_residential',
        building: {
          gla: 2100,
          yearBuilt: 2005,
          bedrooms: 4,
          bathrooms: 3,
          stories: 2,
          garageSpaces: 2,
          pool: true,
        },
        taxAssessments: [],
        permits: [],
        recordVersion: 1,
        versionHistory: [],
        dataSource: 'MANUAL_ENTRY',
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
        createdBy: 'user-1',
        apn: 'APN-1',
        legalDescription: 'LOT 1',
        subdivision: 'TRACT 1',
        lotSizeSqFt: 8000,
        ownerOccupied: true,
      } as any,
    };

    expect(getPropertyAddress(ctx)).toEqual(
      expect.objectContaining({
        streetAddress: '55 Canonical Avenue',
        city: 'Canonical City',
        state: 'TX',
        zipCode: '75002',
        county: 'Workflow County',
        apn: 'APN-1',
        legalDescription: 'LOT 1',
        subdivision: 'TRACT 1',
      }),
    );

    expect(getPropertyDetails(ctx)).toEqual(
      expect.objectContaining({
        propertyType: 'single_family_residential',
        occupancy: 'owner_occupied',
        yearBuilt: 2005,
        grossLivingArea: 2100,
        bedrooms: 4,
        bathrooms: 3,
        stories: 2,
        garage: true,
        pool: true,
      }),
    );
  });

  it('falls back to workflow copies when canonical PropertyRecord is not loaded', () => {
    const ctx: OrderContext = {
      vendorOrder: {
        id: 'order-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        orderNumber: '100',
        productType: 'appraisal',
        status: 'CREATED',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
        propertyAddress: {
          streetAddress: '10 Workflow Street',
          city: 'Workflow City',
          state: 'TX',
          zipCode: '75001',
          county: 'Workflow County',
        },
        propertyDetails: {
          propertyType: 'commercial',
          occupancy: 'investment',
          yearBuilt: 1980,
          grossLivingArea: 1400,
          bedrooms: 2,
          bathrooms: 1,
          stories: 1,
          features: ['workflow'],
        },
      } as any,
      clientOrder: null,
    };

    expect(getPropertyAddress(ctx)).toEqual(
      expect.objectContaining({
        streetAddress: '10 Workflow Street',
        city: 'Workflow City',
      }),
    );
    expect(getPropertyDetails(ctx)).toEqual(
      expect.objectContaining({
        propertyType: 'commercial',
        occupancy: 'investment',
      }),
    );
  });

  it('materializes observation-derived avm/tax/permit history when includeProperty=true', async () => {
    const vendorOrder = {
      id: 'order-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      orderNumber: '100',
      productType: 'appraisal',
      status: 'CREATED',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
      propertyId: 'prop-1',
    } as any;

    const propertyRecord = {
      id: 'prop-1',
      tenantId: 'tenant-1',
      address: { street: '55 Canonical Avenue', city: 'Canonical City', state: 'TX', zip: '75002' },
      propertyType: 'single_family_residential',
      building: { gla: 2100, yearBuilt: 2005, bedrooms: 4, bathrooms: 3 },
      taxAssessments: [],
      permits: [],
      recordVersion: 1,
      versionHistory: [],
      dataSource: 'MANUAL_ENTRY',
      createdAt: '2026-05-10T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z',
      createdBy: 'user-1',
    };

    const dbService = {
      getContainer: vi.fn().mockImplementation((name: string) => {
        if (name === 'property-records') {
          return {
            item: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ resource: propertyRecord }),
            }),
          };
        }

        if (name === 'property-observations') {
          return {
            item: vi.fn().mockReturnValue({
              read: vi.fn().mockResolvedValue({ resource: null }),
            }),
          };
        }

        return {
          item: vi.fn().mockReturnValue({
            read: vi.fn().mockResolvedValue({ resource: null }),
          }),
        };
      }),
      queryDocuments: vi.fn().mockResolvedValue([
        {
          id: 'obs-avm',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'avm-update',
          sourceSystem: 'bridge-interactive',
          sourceFingerprint: 'fp-avm',
          observedAt: '2026-05-12T00:00:00.000Z',
          ingestedAt: '2026-05-12T00:00:01.000Z',
          normalizedFacts: {
            avm: { value: 455000, fetchedAt: '2026-05-12T00:00:00.000Z', source: 'bridge-zestimate' },
          },
          createdBy: 'SYSTEM',
        },
        {
          id: 'obs-tax',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'tax-assessment-update',
          sourceSystem: 'manual-user',
          sourceFingerprint: 'fp-tax',
          observedAt: '2026-05-11T00:00:00.000Z',
          ingestedAt: '2026-05-11T00:00:01.000Z',
          normalizedFacts: {
            taxAssessment: { taxYear: 2025, totalAssessedValue: 430000 },
          },
          createdBy: 'SYSTEM',
        },
        {
          id: 'obs-permit',
          type: 'property-observation',
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationType: 'permit-update',
          sourceSystem: 'manual-user',
          sourceFingerprint: 'fp-permit',
          observedAt: '2026-05-10T00:00:00.000Z',
          ingestedAt: '2026-05-10T00:00:01.000Z',
          normalizedFacts: {
            permit: { permitNumber: 'P-1', type: 'REMODEL', description: 'Kitchen', isMaterialChange: true },
          },
          createdBy: 'SYSTEM',
        },
      ]),
    };

    const loader = new OrderContextLoader(dbService as any);
    const ctx = await loader.loadByVendorOrder(vendorOrder, { includeProperty: true });

    expect(ctx.property?.avm).toEqual(expect.objectContaining({ value: 455000 }));
    expect(ctx.property?.taxAssessments).toEqual([
      expect.objectContaining({ taxYear: 2025, totalAssessedValue: 430000 }),
    ]);
    expect(ctx.property?.permits).toEqual([
      expect.objectContaining({ permitNumber: 'P-1', description: 'Kitchen' }),
    ]);
  });
});