/**
 * Seed Module: Orders
 *
 * Seeds 12 appraisal orders spanning every workflow status.
 * Cross-references clients, products, vendors, appraisers, and properties.
 * Container: orders (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow, hoursAgo } from '../seed-types.js';
import {
  ORDER_IDS, ORDER_NUMBERS,
  CLIENT_IDS, SUB_CLIENT_SLUGS, PRODUCT_IDS, VENDOR_IDS, APPRAISER_IDS, PROPERTY_IDS,
  REPORT_IDS, ENGAGEMENT_IDS,
  INTERNAL_STAFF_IDS, STAFF_IDS, QC_REVIEW_IDS,
} from '../seed-ids.js';

const CONTAINER = 'orders';

function buildOrders(tenantId: string, clientId: string, now: string): Record<string, unknown>[] {
  return [
    // 1 — COMPLETED, full 1004
    {
      id: ORDER_IDS.COMPLETED_001, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      status: 'COMPLETED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
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
      engagementId: ENGAGEMENT_IDS.SINGLE_DELIVERED_004,
      engagementLoanId: 'seed-loan-eng004-001',
      engagementClientOrderId: 'seed-co-eng004-001',
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 95 },
          { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations', score: 81 },
          { vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network', score: 72 },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(28),
      },
      autoReviewAssignment: {
        qcReviewId: QC_REVIEW_IDS.REVIEW_ORDER_001,
        status: 'ACCEPTED',
        rankedReviewers: [
          { reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Rivera (QC Analyst)', workloadPct: 45 },
          { reviewerId: STAFF_IDS.QC_ANALYST_2, reviewerName: 'Jordan Lee (QC Analyst)', workloadPct: 60 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: null,
        initiatedAt: daysAgo(18),
      },
      createdAt: daysAgo(30), updatedAt: daysAgo(10),
    },
    // 2 — QC_REVIEW — PREMIER timed out on attempt 0, ROCKY_MOUNTAIN accepted on attempt 1
    {
      id: ORDER_IDS.QC_REVIEW_002, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.QC_REVIEW_002],
      status: 'QC_REVIEW', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.NATIONAL_AMC], clientRecordId: CLIENT_IDS.NATIONAL_AMC, clientName: 'National AMC Services',
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
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 91 },
          { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations', score: 88 },
        ],
        currentAttempt: 1,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(12),
      },
      autoReviewAssignment: {
        qcReviewId: QC_REVIEW_IDS.REVIEW_ORDER_002,
        status: 'PENDING_ACCEPTANCE',
        rankedReviewers: [
          { reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Rivera (QC Analyst)', workloadPct: 65 },
          { reviewerId: STAFF_IDS.QC_ANALYST_2, reviewerName: 'Jordan Lee (QC Analyst)', workloadPct: 50 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: daysFromNow(1),
        initiatedAt: daysAgo(3),
      },
      createdAt: daysAgo(14), updatedAt: daysAgo(3),
    },
    // 3 — IN_PROGRESS, rush — TX_PROPERTY scored highest for rush; Sarah Chen (internal) ranked 3rd
    {
      id: ORDER_IDS.IN_PROGRESS_003, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      status: 'IN_PROGRESS', priority: 'RUSH', isRush: true,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.PACIFIC_COAST], clientRecordId: CLIENT_IDS.PACIFIC_COAST, clientName: 'Pacific Coast Mortgage',
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
      engagementId: ENGAGEMENT_IDS.SINGLE_FULL_APPRAISAL_001,
      engagementLoanId: 'seed-loan-eng001-001',
      engagementClientOrderId: 'seed-co-eng001-001',
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC', score: 97 },
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 85 },
          { vendorId: INTERNAL_STAFF_IDS.SARAH_CHEN_TX_APPRAISER, vendorName: 'Sarah Chen', score: 84, staffType: 'internal', staffRole: 'appraiser_internal' },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(6),
      },
      createdAt: daysAgo(7), updatedAt: hoursAgo(6),
    },
    // 4 — PENDING_ASSIGNMENT — PREMIER timed out, NVN is current live bid
    {
      id: ORDER_IDS.PENDING_004, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.PENDING_004],
      status: 'PENDING_ASSIGNMENT', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.CONDO_1073, productName: 'Condo Appraisal (1073)', productType: 'CONDO',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH], clientRecordId: CLIENT_IDS.CLEARPATH, clientName: 'ClearPath Valuation Group',
      propertyId: PROPERTY_IDS.GREENVILLE_AVE,
      propertyAddress: { street: '4100 Greenville Ave #18B', city: 'Dallas', state: 'TX', zip: '75206', county: 'Dallas' },
      loanNumber: 'CP-2026-99401', borrowerName: 'Rebecca Torres',
      orderedDate: daysAgo(2),
      dueDate: daysAgo(-12), fee: 475, paidAmount: 0,
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 90 },
          { vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network', score: 83 },
          { vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services', score: 77 },
        ],
        currentAttempt: 1,
        currentBidId: 'seed-bid-order-004-nvn',
        currentBidExpiresAt: daysFromNow(1),
        initiatedAt: daysAgo(2),
      },
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
    // 5 — NEW / Desktop — internal direct assignment in progress for Sarah Chen (no bid loop)
    {
      id: ORDER_IDS.NEW_005, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.NEW_005],
      status: 'NEW', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DESKTOP_REVIEW, productName: 'Desktop Appraisal', productType: 'DESKTOP',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.SUNCOAST], clientRecordId: CLIENT_IDS.SUNCOAST, clientName: 'Suncoast Mortgage Brokers',
      propertyAddress: { street: '900 Belt Line Rd', city: 'Richardson', state: 'TX', zip: '75080', county: 'Dallas' },
      loanNumber: 'SCB-2026-10501', borrowerName: 'James Franklin',
      orderedDate: hoursAgo(4),
      dueDate: daysAgo(-14), fee: 350, paidAmount: 0,
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: INTERNAL_STAFF_IDS.SARAH_CHEN_TX_APPRAISER, vendorName: 'Sarah Chen', score: 98, staffType: 'internal', staffRole: 'appraiser_internal' },
          { vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC', score: 82 },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: hoursAgo(2),
      },
      createdAt: hoursAgo(4), updatedAt: hoursAgo(4),
    },
    // 6 — FIX_AND_FLIP, in progress with ARV
    {
      id: ORDER_IDS.FIX_FLIP_006, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.FIX_FLIP_006],
      status: 'IN_PROGRESS', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
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
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services', score: 92 },
          { vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC', score: 84 },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(18),
      },
      createdAt: daysAgo(20), updatedAt: daysAgo(5),
    },
    // 7 — ASSIGNED — NVN is current live bid, expires in ~4 hours
    {
      id: ORDER_IDS.ASSIGNED_007, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ASSIGNED_007],
      status: 'ASSIGNED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DRIVE_BY_2055, productName: 'Drive-By Appraisal (2055)', productType: 'DRIVE_BY',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.NATIONAL_AMC], clientRecordId: CLIENT_IDS.NATIONAL_AMC, clientName: 'National AMC Services',
      vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network',
      propertyAddress: { street: '6700 Forest Ln', city: 'Dallas', state: 'TX', zip: '75230', county: 'Dallas' },
      loanNumber: 'NAMC-2026-70701', borrowerName: 'Angela Brown',
      orderedDate: daysAgo(3), assignedDate: daysAgo(1),
      dueDate: daysAgo(-9), fee: 350, paidAmount: 0,
      appraiserFee: 250,
      autoVendorAssignment: {
        status: 'PENDING_BID',
        rankedVendors: [
          { vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network', score: 88 },
          { vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services', score: 76 },
        ],
        currentAttempt: 0,
        currentBidId: 'seed-bid-order-007-nvn',
        currentBidExpiresAt: hoursAgo(-4),
        initiatedAt: daysAgo(1),
      },
      createdAt: daysAgo(3), updatedAt: daysAgo(1),
    },
    // 8 — ACCEPTED — PREMIER ranked first, James Okonkwo (internal reviewer) ranked 3rd as fallback
    {
      id: ORDER_IDS.ACCEPTED_008, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ACCEPTED_008],
      status: 'ACCEPTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_TECH_CU], clientRecordId: CLIENT_IDS.FIRST_TECH_CU, clientName: 'First Tech Federal Credit Union',
      vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON, appraiserName: 'Michael Thompson',
      propertyId: PROPERTY_IDS.BOULDER_MAIN_ST,
      propertyAddress: { street: '810 Main St', city: 'Boulder', state: 'CO', zip: '80302', county: 'Boulder' },
      loanNumber: 'FTCU-2026-80801', borrowerName: 'Olivia & Nathan Stern',
      orderedDate: daysAgo(5), assignedDate: daysAgo(4), acceptedDate: daysAgo(3),
      dueDate: daysAgo(-8), fee: 525, paidAmount: 0,
      appraiserFee: 390,
      engagementId: ENGAGEMENT_IDS.SINGLE_BPO_002,
      engagementLoanId: 'seed-loan-eng002-001',
      engagementClientOrderId: 'seed-co-eng002-001',
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 96 },
          { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations', score: 82 },
          { vendorId: INTERNAL_STAFF_IDS.JAMES_OKONKWO_TX_REVIEWER, vendorName: 'James Okonkwo', score: 79, staffType: 'internal', staffRole: 'reviewer' },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(4),
      },
      createdAt: daysAgo(5), updatedAt: daysAgo(3),
    },
    // 9 — SUBMITTED — QC review assignment pending for Jordan Lee (QC Analyst 2)
    {
      id: ORDER_IDS.SUBMITTED_009, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      status: 'SUBMITTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.MULTI_FAMILY_1025, productName: 'Multi-Family (1025)', productType: 'MULTI_FAMILY',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH], clientRecordId: CLIENT_IDS.CLEARPATH, clientName: 'ClearPath Valuation Group',
      vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations',
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN, appraiserName: 'Patricia Nguyen',
      propertyAddress: { street: '1500 Commerce St', city: 'Fort Worth', state: 'TX', zip: '76102', county: 'Tarrant' },
      loanNumber: 'CP-2026-90901', borrowerName: 'Westside Investments Group',
      orderedDate: daysAgo(12), assignedDate: daysAgo(10), acceptedDate: daysAgo(10),
      inspectionDate: daysAgo(6), submittedDate: daysAgo(2),
      dueDate: daysAgo(-3), fee: 800, paidAmount: 0,
      appraiserFee: 600, appraisedValue: 720000,
      engagementId: ENGAGEMENT_IDS.SINGLE_HYBRID_005,
      engagementLoanId: 'seed-loan-eng005-001',
      engagementClientOrderId: 'seed-co-eng005-001',
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.ROCKY_MOUNTAIN, vendorName: 'Rocky Mountain Valuations', score: 94 },
          { vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC', score: 79 },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(10),
      },
      autoReviewAssignment: {
        qcReviewId: QC_REVIEW_IDS.REVIEW_ORDER_009,
        status: 'PENDING_ACCEPTANCE',
        rankedReviewers: [
          { reviewerId: STAFF_IDS.QC_ANALYST_2, reviewerName: 'Jordan Lee (QC Analyst)', workloadPct: 55 },
          { reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Rivera (QC Analyst)', workloadPct: 70 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: hoursAgo(-6),
        initiatedAt: daysAgo(2),
      },
      createdAt: daysAgo(12), updatedAt: daysAgo(2),
    },
    // 10 — REVISION_REQUESTED — QC review accepted and completed, then revision triggered
    {
      id: ORDER_IDS.REVISION_010, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      status: 'REVISION_REQUESTED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.PACIFIC_COAST], clientRecordId: CLIENT_IDS.PACIFIC_COAST, clientName: 'Pacific Coast Mortgage',
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
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.TX_PROPERTY, vendorName: 'Texas Property Experts LLC', score: 89 },
          { vendorId: VENDOR_IDS.PREMIER, vendorName: 'Premier Appraisal Group', score: 81 },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(16),
      },
      autoReviewAssignment: {
        qcReviewId: QC_REVIEW_IDS.REVIEW_ORDER_010,
        status: 'ACCEPTED',
        rankedReviewers: [
          { reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Rivera (QC Analyst)', workloadPct: 60 },
          { reviewerId: STAFF_IDS.QC_ANALYST_2, reviewerName: 'Jordan Lee (QC Analyst)', workloadPct: 55 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: null,
        initiatedAt: daysAgo(7),
      },
      createdAt: daysAgo(18), updatedAt: daysAgo(4),
    },
    // 11 — CANCELLED
    {
      id: ORDER_IDS.CANCELLED_011, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.CANCELLED_011],
      status: 'CANCELLED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.FULL_1004, productName: 'Uniform Residential Appraisal (1004)', productType: 'FULL_APPRAISAL',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.SUNCOAST], clientRecordId: CLIENT_IDS.SUNCOAST, clientName: 'Suncoast Mortgage Brokers',
      propertyAddress: { street: '4400 Lemmon Ave', city: 'Dallas', state: 'TX', zip: '75219', county: 'Dallas' },
      loanNumber: 'SCB-2026-11101', borrowerName: 'Thomas & Lisa Park',
      orderedDate: daysAgo(21), cancelledDate: daysAgo(19),
      cancellationReason: 'Borrower withdrew loan application.',
      dueDate: daysAgo(7), fee: 500, paidAmount: 0,
      createdAt: daysAgo(21), updatedAt: daysAgo(19),
    },
    // 12 — COMPLETED, drive-by
    {
      id: ORDER_IDS.COMPLETED_DRIVEBY_012, tenantId, type: 'vendor-order',
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      status: 'COMPLETED', priority: 'NORMAL', isRush: false,
      productId: PRODUCT_IDS.DRIVE_BY_2055, productName: 'Drive-By Appraisal (2055)', productType: 'DRIVE_BY',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
      vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services',
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON, appraiserName: 'Michael Thompson',
      propertyAddress: { street: '1045 W Davis St', city: 'Dallas', state: 'TX', zip: '75208', county: 'Dallas' },
      loanNumber: 'FH-2026-12001', borrowerName: 'Linda Whitaker',
      orderedDate: daysAgo(25), assignedDate: daysAgo(24), acceptedDate: daysAgo(24),
      inspectionDate: daysAgo(21), submittedDate: daysAgo(19), completedDate: daysAgo(15),
      dueDate: daysAgo(14), fee: 325, paidAmount: 325,
      appraiserFee: 225, appraisedValue: 195000,
      qcStatus: 'PASSED', qcScore: 97,
      autoVendorAssignment: {
        status: 'ACCEPTED',
        rankedVendors: [
          { vendorId: VENDOR_IDS.METROPLEX, vendorName: 'Metroplex Appraisal Services', score: 95 },
          { vendorId: VENDOR_IDS.NVN, vendorName: 'National Valuation Network', score: 74 },
          { vendorId: INTERNAL_STAFF_IDS.DIANA_MORALES_TX_SUPERVISOR, vendorName: 'Diana Morales', score: 71, staffType: 'internal', staffRole: 'supervisor' },
        ],
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: daysAgo(24),
      },
      autoReviewAssignment: {
        qcReviewId: 'seed-qc-review-012',
        status: 'ACCEPTED',
        rankedReviewers: [
          { reviewerId: STAFF_IDS.QC_ANALYST_2, reviewerName: 'Jordan Lee (QC Analyst)', workloadPct: 40 },
          { reviewerId: STAFF_IDS.QC_ANALYST_1, reviewerName: 'Alex Rivera (QC Analyst)', workloadPct: 55 },
        ],
        currentAttempt: 0,
        currentAssignmentExpiresAt: null,
        initiatedAt: daysAgo(19),
      },
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

    for (const order of buildOrders(ctx.tenantId, ctx.clientId, ctx.now)) {
      await upsert(ctx, CONTAINER, order, result);
    }

    return result;
  },
};
