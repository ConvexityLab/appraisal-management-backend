/**
 * Seed Module: Orders
 *
 * Seeds 12 appraisal orders spanning every workflow status.
 * Cross-references clients, products, vendors, appraisers, and properties.
 * Container: orders (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo } from '../seed-types.js';
import {
  ORDER_IDS, ORDER_NUMBERS,
  CLIENT_IDS, PRODUCT_IDS, VENDOR_IDS, APPRAISER_IDS, PROPERTY_IDS,
  REPORT_IDS,
} from '../seed-ids.js';

const CONTAINER = 'orders';

function buildOrders(tenantId: string, now: string): Record<string, unknown>[] {
  return [
    // 1 — COMPLETED, full 1004
    {
      id: ORDER_IDS.COMPLETED_001, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      status: 'COMPLETED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
      vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON, appraiserName: 'Michael Thompson',
      propertyId: PROPERTY_IDS.MOCKINGBIRD_LANE,
      propertyAddress: { street: '5432 Mockingbird Ln', city: 'Dallas', state: 'TX', zip: '75206', county: 'Dallas' },
      loanNumber: 'FH-2026-88001', borrowerName: 'Sarah Johnson',
      orderedDate: daysAgo(30), assignedDate: daysAgo(28), acceptedDate: daysAgo(28),
      inspectionDate: daysAgo(22), submittedDate: daysAgo(18), completedDate: daysAgo(10),
      dueDate: daysAgo(8), fee: 500, paidAmount: 500,
      appraiserFee: 375, appraisedValue: 425000,
      reportId: REPORT_IDS.FULL_1004_ORDER_001,
      qcStatus: 'PASSED', qcScore: 94,
      createdAt: daysAgo(30), updatedAt: daysAgo(10),
    },
    // 2 — QC_REVIEW
    {
      id: ORDER_IDS.QC_REVIEW_002, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.QC_REVIEW_002],
      status: 'QC_REVIEW', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.NATIONAL_AMC, clientName: 'National AMC Services',
      vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations',
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN, appraiserName: 'Patricia Nguyen',
      propertyId: PROPERTY_IDS.SWISS_AVE,
      propertyAddress: { street: '2100 Swiss Ave', city: 'Dallas', state: 'TX', zip: '75204', county: 'Dallas' },
      loanNumber: 'NAMC-2026-44201', borrowerName: 'Carlos & Elena Mendez',
      orderedDate: daysAgo(14), assignedDate: daysAgo(12), acceptedDate: daysAgo(12),
      inspectionDate: daysAgo(8), submittedDate: daysAgo(3),
      dueDate: daysAgo(-2), fee: 550, paidAmount: 0,
      appraiserFee: 400, appraisedValue: 385000,
      qcStatus: 'IN_REVIEW',
      createdAt: daysAgo(14), updatedAt: daysAgo(3),
    },
    // 3 — IN_PROGRESS, rush
    {
      id: ORDER_IDS.IN_PROGRESS_003, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      status: 'IN_PROGRESS', priority: 'RUSH', isRush: true,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.PACIFIC_COAST, clientName: 'Pacific Coast Mortgage',
      vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC',
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR, appraiserName: 'Kevin Okafor',
      propertyId: PROPERTY_IDS.LAMAR_ST,
      propertyAddress: { street: '789 S Lamar St', city: 'Dallas', state: 'TX', zip: '75215', county: 'Dallas' },
      loanNumber: 'PCM-2026-77301', borrowerName: 'David Kim',
      orderedDate: daysAgo(7), assignedDate: daysAgo(6), acceptedDate: daysAgo(6),
      inspectionDate: daysAgo(3),
      dueDate: daysAgo(-1), fee: 700, paidAmount: 0,
      appraiserFee: 500,
      reportId: REPORT_IDS.FULL_1004_ORDER_003,
      createdAt: daysAgo(7), updatedAt: hoursAgo(6),
    },
    // 4 — PENDING_ASSIGNMENT
    {
      id: ORDER_IDS.PENDING_004, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.PENDING_004],
      status: 'PENDING_ASSIGNMENT', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.CONDO_1073, productName: 'Condo Appraisal (1073)',
      clientId: CLIENT_IDS.CLEARPATH, clientName: 'ClearPath Valuation Group',
      propertyId: PROPERTY_IDS.GREENVILLE_AVE,
      propertyAddress: { street: '4100 Greenville Ave #18B', city: 'Dallas', state: 'TX', zip: '75206', county: 'Dallas' },
      loanNumber: 'CP-2026-99401', borrowerName: 'Rebecca Torres',
      orderedDate: daysAgo(2),
      dueDate: daysAgo(-12), fee: 475, paidAmount: 0,
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    // 5 — NEW
    {
      id: ORDER_IDS.NEW_005, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.NEW_005],
      status: 'NEW', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DESKTOP_REVIEW, productName: 'Desktop Appraisal',
      clientId: CLIENT_IDS.SUNCOAST, clientName: 'Suncoast Mortgage Brokers',
      propertyAddress: { street: '900 Belt Line Rd', city: 'Richardson', state: 'TX', zip: '75080', county: 'Dallas' },
      loanNumber: 'SCB-2026-10501', borrowerName: 'James Franklin',
      orderedDate: hoursAgo(4),
      dueDate: daysAgo(-14), fee: 350, paidAmount: 0,
      createdAt: hoursAgo(4), updatedAt: hoursAgo(4),
    },
    // 6 — FIX_AND_FLIP, in progress with ARV
    {
      id: ORDER_IDS.FIX_FLIP_006, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.FIX_FLIP_006],
      status: 'IN_PROGRESS', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
      vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services',
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN, appraiserName: 'Patricia Nguyen',
      propertyId: PROPERTY_IDS.ABRAMS_RD,
      propertyAddress: { street: '3210 Abrams Rd', city: 'Dallas', state: 'TX', zip: '75214', county: 'Dallas' },
      loanNumber: 'FH-2026-FF601', borrowerName: 'Grant Properties LLC',
      orderType: 'FIX_AND_FLIP',
      orderedDate: daysAgo(20), assignedDate: daysAgo(18), acceptedDate: daysAgo(17),
      inspectionDate: daysAgo(12),
      dueDate: daysAgo(-5), fee: 650, paidAmount: 0,
      appraiserFee: 475,
      arvAnalysisId: 'seed-arv-001',
      createdAt: daysAgo(20), updatedAt: daysAgo(5),
    },
    // 7 — ASSIGNED
    {
      id: ORDER_IDS.ASSIGNED_007, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ASSIGNED_007],
      status: 'ASSIGNED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DRIVE_BY_2055, productName: 'Drive-By Appraisal (2055)',
      clientId: CLIENT_IDS.NATIONAL_AMC, clientName: 'National AMC Services',
      vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network',
      propertyAddress: { street: '6700 Forest Ln', city: 'Dallas', state: 'TX', zip: '75230', county: 'Dallas' },
      loanNumber: 'NAMC-2026-70701', borrowerName: 'Angela Brown',
      orderedDate: daysAgo(3), assignedDate: daysAgo(1),
      dueDate: daysAgo(-9), fee: 350, paidAmount: 0,
      appraiserFee: 250,
      createdAt: daysAgo(3), updatedAt: daysAgo(1),
    },
    // 8 — ACCEPTED
    {
      id: ORDER_IDS.ACCEPTED_008, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ACCEPTED_008],
      status: 'ACCEPTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.FIRST_TECH_CU, clientName: 'First Tech Federal Credit Union',
      vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON, appraiserName: 'Michael Thompson',
      propertyId: PROPERTY_IDS.BOULDER_MAIN_ST,
      propertyAddress: { street: '810 Main St', city: 'Boulder', state: 'CO', zip: '80302', county: 'Boulder' },
      loanNumber: 'FTCU-2026-80801', borrowerName: 'Olivia & Nathan Stern',
      orderedDate: daysAgo(5), assignedDate: daysAgo(4), acceptedDate: daysAgo(3),
      dueDate: daysAgo(-8), fee: 525, paidAmount: 0,
      appraiserFee: 390,
      createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    // 9 — SUBMITTED
    {
      id: ORDER_IDS.SUBMITTED_009, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      status: 'SUBMITTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.MULTI_FAMILY_1025, productName: 'Multi-Family (1025)',
      clientId: CLIENT_IDS.CLEARPATH, clientName: 'ClearPath Valuation Group',
      vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations',
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN, appraiserName: 'Patricia Nguyen',
      propertyAddress: { street: '1500 Commerce St', city: 'Fort Worth', state: 'TX', zip: '76102', county: 'Tarrant' },
      loanNumber: 'CP-2026-90901', borrowerName: 'Westside Investments Group',
      orderedDate: daysAgo(12), assignedDate: daysAgo(10), acceptedDate: daysAgo(10),
      inspectionDate: daysAgo(6), submittedDate: daysAgo(2),
      dueDate: daysAgo(-3), fee: 800, paidAmount: 0,
      appraiserFee: 600, appraisedValue: 720000,
      createdAt: daysAgo(12), updatedAt: daysAgo(2),
    },
    // 10 — REVISION_REQUESTED
    {
      id: ORDER_IDS.REVISION_010, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      status: 'REVISION_REQUESTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.PACIFIC_COAST, clientName: 'Pacific Coast Mortgage',
      vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC',
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR, appraiserName: 'Kevin Okafor',
      propertyAddress: { street: '2350 McKinney Ave', city: 'Dallas', state: 'TX', zip: '75201', county: 'Dallas' },
      loanNumber: 'PCM-2026-10101', borrowerName: 'Ramirez Family Trust',
      orderedDate: daysAgo(18), assignedDate: daysAgo(16), acceptedDate: daysAgo(16),
      inspectionDate: daysAgo(11), submittedDate: daysAgo(7),
      dueDate: daysAgo(4), fee: 550, paidAmount: 0,
      appraiserFee: 400, appraisedValue: 510000,
      qcStatus: 'REVISION_REQUIRED', qcScore: 68,
      revisionRequestedDate: daysAgo(4),
      revisionNotes: 'Comparable #2 is not appropriate — different zoning; GLA adjustment exceeds 25% threshold per UAD guidelines.',
      createdAt: daysAgo(18), updatedAt: daysAgo(4),
    },
    // 11 — CANCELLED
    {
      id: ORDER_IDS.CANCELLED_011, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.CANCELLED_011],
      status: 'CANCELLED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)',
      clientId: CLIENT_IDS.SUNCOAST, clientName: 'Suncoast Mortgage Brokers',
      propertyAddress: { street: '4400 Lemmon Ave', city: 'Dallas', state: 'TX', zip: '75219', county: 'Dallas' },
      loanNumber: 'SCB-2026-11101', borrowerName: 'Thomas & Lisa Park',
      orderedDate: daysAgo(21), cancelledDate: daysAgo(19),
      cancellationReason: 'Borrower withdrew loan application.',
      dueDate: daysAgo(7), fee: 500, paidAmount: 0,
      createdAt: daysAgo(21), updatedAt: daysAgo(19),
    },
    // 12 — COMPLETED, drive-by
    {
      id: ORDER_IDS.COMPLETED_DRIVEBY_012, tenantId, type: 'order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      status: 'COMPLETED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DRIVE_BY_2055, productName: 'Drive-By Appraisal (2055)',
      clientId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
      vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON, appraiserName: 'Michael Thompson',
      propertyAddress: { street: '1045 W Davis St', city: 'Dallas', state: 'TX', zip: '75208', county: 'Dallas' },
      loanNumber: 'FH-2026-12001', borrowerName: 'Linda Whitaker',
      orderedDate: daysAgo(25), assignedDate: daysAgo(24), acceptedDate: daysAgo(24),
      inspectionDate: daysAgo(21), submittedDate: daysAgo(19), completedDate: daysAgo(15),
      dueDate: daysAgo(14), fee: 325, paidAmount: 325,
      appraiserFee: 225, appraisedValue: 195000,
      qcStatus: 'PASSED', qcScore: 97,
      createdAt: daysAgo(25), updatedAt: daysAgo(15),
    },
  ];
}

export const module: SeedModule = {
  name: 'orders',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const order of buildOrders(ctx.tenantId, ctx.now)) {
      await upsert(ctx, CONTAINER, order, result);
    }

    return result;
  },
};
