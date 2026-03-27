/**
 * Seed Module: Properties
 *
 * Seeds 6 property records and property-summary snapshots linked to orders.
 * Containers: properties, property-summaries (both partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { PROPERTY_IDS, ORDER_IDS } from '../seed-ids.js';

function buildProperties(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: PROPERTY_IDS.MOCKINGBIRD_LANE, tenantId, type: 'property',
      orderId: ORDER_IDS.COMPLETED_001,
      address: { street: '5432 Mockingbird Ln', city: 'Dallas', state: 'TX', zip: '75206', county: 'Dallas' },
      propertyType: 'Single Family', yearBuilt: 1958, gla: 2_150, lotSizeSqFt: 8_700,
      bedrooms: 3, bathrooms: 2, stories: 1, garage: '2-car attached',
      condition: 'C3', quality: 'Q3',
      zoning: 'R-7.5', floodZone: 'X', hoa: false,
      appraisedValue: 425_000, priorSalePrice: 310_000, priorSaleDate: daysAgo(1460),
      latitude: 32.8348, longitude: -96.7697,
      createdAt: daysAgo(30), updatedAt: daysAgo(10),
    },
    {
      id: PROPERTY_IDS.SWISS_AVE, tenantId, type: 'property',
      orderId: ORDER_IDS.QC_REVIEW_002,
      address: { street: '2100 Swiss Ave', city: 'Dallas', state: 'TX', zip: '75204', county: 'Dallas' },
      propertyType: 'Single Family', yearBuilt: 1925, gla: 3_400, lotSizeSqFt: 14_200,
      bedrooms: 4, bathrooms: 3.5, stories: 2, garage: 'Detached 2-car',
      condition: 'C2', quality: 'Q2',
      zoning: 'PD-193', floodZone: 'X', hoa: true,
      appraisedValue: 385_000, priorSalePrice: 290_000, priorSaleDate: daysAgo(2190),
      latitude: 32.7874, longitude: -96.7825,
      createdAt: daysAgo(14), updatedAt: daysAgo(3),
    },
    {
      id: PROPERTY_IDS.LAMAR_ST, tenantId, type: 'property',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      address: { street: '789 S Lamar St', city: 'Dallas', state: 'TX', zip: '75215', county: 'Dallas' },
      propertyType: 'Single Family', yearBuilt: 2018, gla: 1_800, lotSizeSqFt: 4_500,
      bedrooms: 3, bathrooms: 2.5, stories: 2, garage: '1-car attached',
      condition: 'C2', quality: 'Q3',
      zoning: 'MF-2', floodZone: 'AE', hoa: true,
      latitude: 32.7627, longitude: -96.8024,
      createdAt: daysAgo(7), updatedAt: daysAgo(3),
    },
    {
      id: PROPERTY_IDS.GREENVILLE_AVE, tenantId, type: 'property',
      orderId: ORDER_IDS.PENDING_004,
      address: { street: '4100 Greenville Ave #18B', city: 'Dallas', state: 'TX', zip: '75206', county: 'Dallas' },
      propertyType: 'Condominium', yearBuilt: 2005, gla: 1_250, lotSizeSqFt: 0,
      bedrooms: 2, bathrooms: 2, stories: 1,
      condition: 'C3', quality: 'Q3',
      zoning: 'MF-3', floodZone: 'X', hoa: true,
      hoaFeeMonthly: 385,
      latitude: 32.8401, longitude: -96.7685,
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    {
      id: PROPERTY_IDS.ABRAMS_RD, tenantId, type: 'property',
      orderId: ORDER_IDS.FIX_FLIP_006,
      address: { street: '3210 Abrams Rd', city: 'Dallas', state: 'TX', zip: '75214', county: 'Dallas' },
      propertyType: 'Single Family', yearBuilt: 1952, gla: 1_600, lotSizeSqFt: 7_200,
      bedrooms: 3, bathrooms: 1, stories: 1, garage: 'None',
      condition: 'C5', quality: 'Q4',
      zoning: 'R-7.5', floodZone: 'X', hoa: false,
      asIsValue: 180_000, arvEstimate: 320_000,
      latitude: 32.8221, longitude: -96.7444,
      createdAt: daysAgo(20), updatedAt: daysAgo(5),
    },
    {
      id: PROPERTY_IDS.BOULDER_MAIN_ST, tenantId, type: 'property',
      orderId: ORDER_IDS.ACCEPTED_008,
      address: { street: '810 Main St', city: 'Boulder', state: 'CO', zip: '80302', county: 'Boulder' },
      propertyType: 'Single Family', yearBuilt: 1972, gla: 2_400, lotSizeSqFt: 10_500,
      bedrooms: 4, bathrooms: 2.5, stories: 2, garage: '2-car attached',
      condition: 'C3', quality: 'Q3',
      zoning: 'RL-1', floodZone: 'X', hoa: false,
      latitude: 40.0150, longitude: -105.2705,
      createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
  ];
}

function buildPropertySummaries(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: `seed-prop-summary-001`, tenantId, type: 'property-summary',
      propertyId: PROPERTY_IDS.MOCKINGBIRD_LANE,
      orderId: ORDER_IDS.COMPLETED_001,
      address: '5432 Mockingbird Ln, Dallas, TX 75206',
      propertyType: 'Single Family',
      gla: 2_150, bedrooms: 3, bathrooms: 2, yearBuilt: 1958,
      appraisedValue: 425_000, effectiveDate: daysAgo(22),
      createdAt: daysAgo(10), updatedAt: daysAgo(10),
    },
    {
      id: `seed-prop-summary-012`, tenantId, type: 'property-summary',
      propertyId: null,
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012,
      address: '1045 W Davis St, Dallas, TX 75208',
      propertyType: 'Single Family',
      gla: 1_100, bedrooms: 2, bathrooms: 1, yearBuilt: 1945,
      appraisedValue: 195_000, effectiveDate: daysAgo(21),
      createdAt: daysAgo(15), updatedAt: daysAgo(15),
    },
  ];
}

export const module: SeedModule = {
  name: 'properties',
  containers: ['properties', 'property-summaries'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'properties');
      result.cleaned += await cleanContainer(ctx, 'property-summaries');
    }

    for (const prop of buildProperties(ctx.tenantId)) {
      await upsert(ctx, 'properties', prop, result);
    }
    for (const summary of buildPropertySummaries(ctx.tenantId)) {
      await upsert(ctx, 'property-summaries', summary, result);
    }

    return result;
  },
};
