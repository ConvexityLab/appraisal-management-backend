/**
 * Seed Module: Matching Criteria Sets + RFB Requests
 *
 * Seeds vendor-eligibility rule sets and a sample Request for Bid.
 * Containers: matching-criteria-sets, rfb-requests (both partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import {
  CRITERIA_SET_IDS, RFB_IDS, ORDER_IDS, ORDER_NUMBERS,
  CLIENT_IDS, SUB_CLIENT_SLUGS, PRODUCT_IDS, VENDOR_IDS,
} from '../seed-ids.js';

function buildCriteriaSets(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: CRITERIA_SET_IDS.GEO_DALLAS, tenantId, type: 'matching-criteria-set',
      name: 'Dallas Metro Geographic Match',
      description: 'Match vendors covering Dallas county within 30-mile radius',
      status: 'ACTIVE',
      rules: [
        { field: 'serviceArea.states', operator: 'INCLUDES', value: 'TX' },
        { field: 'serviceArea.counties', operator: 'INCLUDES', value: 'Dallas' },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 1,
      createdAt: daysAgo(120), updatedAt: daysAgo(30),
    },
    {
      id: CRITERIA_SET_IDS.HIGH_PERFORMANCE, tenantId, type: 'matching-criteria-set',
      name: 'High Performance Vendors',
      description: 'Only vendors with QC score >= 90 and on-time rate >= 0.92',
      status: 'ACTIVE',
      rules: [
        { field: 'averageQCScore', operator: 'GTE', value: 90 },
        { field: 'onTimeDeliveryRate', operator: 'GTE', value: 0.92 },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 2,
      createdAt: daysAgo(100), updatedAt: daysAgo(15),
    },
    {
      id: CRITERIA_SET_IDS.ACTIVE_LICENSE, tenantId, type: 'matching-criteria-set',
      name: 'Active License Verification',
      description: 'Vendors with non-expired licenses only',
      status: 'ACTIVE',
      rules: [
        { field: 'licenseExpiration', operator: 'GT', value: 'NOW' },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 3,
      createdAt: daysAgo(90), updatedAt: daysAgo(90),
    },
    {
      id: CRITERIA_SET_IDS.FLORIDA_COVERAGE, tenantId, type: 'matching-criteria-set',
      name: 'Florida Coverage',
      description: 'Vendors licensed in the state of Florida',
      status: 'ACTIVE',
      rules: [
        { field: 'serviceArea.states', operator: 'INCLUDES', value: 'FL' },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 4,
      createdAt: daysAgo(80), updatedAt: daysAgo(80),
    },
    {
      id: CRITERIA_SET_IDS.SOUTHEAST, tenantId, type: 'matching-criteria-set',
      name: 'Southeast Region',
      description: 'Vendors covering FL, GA, SC, NC',
      status: 'ACTIVE',
      rules: [
        { field: 'serviceArea.states', operator: 'IN', value: ['FL', 'GA', 'SC', 'NC'] },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 5,
      createdAt: daysAgo(70), updatedAt: daysAgo(70),
    },
    {
      id: CRITERIA_SET_IDS.TEXAS_COVERAGE, tenantId, type: 'matching-criteria-set',
      name: 'Texas Full Coverage',
      description: 'All active vendors covering any part of Texas',
      status: 'ACTIVE',
      rules: [
        { field: 'serviceArea.states', operator: 'INCLUDES', value: 'TX' },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 6,
      createdAt: daysAgo(60), updatedAt: daysAgo(60),
    },
    {
      id: CRITERIA_SET_IDS.LOW_REVISION, tenantId, type: 'matching-criteria-set',
      name: 'Low Revision Rate',
      description: 'Vendors with revision rate below 5%',
      status: 'ACTIVE',
      rules: [
        { field: 'revisionRate', operator: 'LT', value: 0.05 },
        { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
      ],
      priority: 7,
      createdAt: daysAgo(50), updatedAt: daysAgo(50),
    },
  ];
}

function buildRfbRequests(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    {
      id: RFB_IDS.RFB_ORDER_004, tenantId, type: 'rfb-request',
      orderId: ORDER_IDS.PENDING_004,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.PENDING_004],
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH], clientRecordId: CLIENT_IDS.CLEARPATH,
      productId: PRODUCT_IDS.CONDO_1073,
      status: 'OPEN',
      criteriaSetIds: [CRITERIA_SET_IDS.GEO_DALLAS, CRITERIA_SET_IDS.ACTIVE_LICENSE],
      matchedVendorIds: [VENDOR_IDS.PREMIER, VENDOR_IDS.ROCKY_MOUNTAIN, VENDOR_IDS.TX_PROPERTY],
      respondedVendorIds: [],
      declinedVendorIds: [VENDOR_IDS.PREMIER],
      maxFee: 500,
      turnaroundDays: 12,
      propertyAddress: { street: '4100 Greenville Ave #18B', city: 'Dallas', state: 'TX', zip: '75206' },
      createdAt: daysAgo(2), updatedAt: daysAgo(1),
      expiresAt: daysAgo(-5),
    },
  ];
}

export const module: SeedModule = {
  name: 'matching-criteria',
  containers: ['matching-criteria-sets', 'rfb-requests'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'matching-criteria-sets');
      result.cleaned += await cleanContainer(ctx, 'rfb-requests');
    }

    for (const cs of buildCriteriaSets(ctx.tenantId)) {
      await upsert(ctx, 'matching-criteria-sets', cs, result);
    }
    for (const rfb of buildRfbRequests(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, 'rfb-requests', rfb, result);
    }

    return result;
  },
};
