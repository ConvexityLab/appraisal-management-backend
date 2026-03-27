/**
 * Seed Module: Construction Finance
 *
 * Seeds contractors, construction loans + budgets, and draw requests.
 * Containers: contractors, construction-loans, draws
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow } from '../seed-types.js';
import { CONTRACTOR_IDS, CONSTRUCTION_LOAN_IDS, DRAW_IDS, BUDGET_IDS, TENANT_CONFIG_IDS } from '../seed-ids.js';

function buildContractors(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: CONTRACTOR_IDS.APEX_BUILD, tenantId, type: 'contractor',
      name: 'Apex Build Group', role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'CO-GC-2019042', licenseState: 'CO',
      licenseExpiry: daysFromNow(400),
      licenseVerifiedAt: daysAgo(10), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'API_VERIFIED',
      apiVerificationSource: 'CO DORA Contractor Database',
      insuranceCertExpiry: daysFromNow(300), insuranceVerifiedAt: daysAgo(10),
      bondAmount: 750_000, yearsInBusiness: 14, completedProjects: 63,
      riskTier: 'APPROVED',
      createdAt: daysAgo(90), updatedAt: daysAgo(10),
    },
    {
      id: CONTRACTOR_IDS.SWIFT_RENO, tenantId, type: 'contractor',
      name: 'Swift Renovation Co.', role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'TX-GC-2021077', licenseState: 'TX',
      licenseExpiry: daysFromNow(200),
      licenseVerifiedAt: daysAgo(30), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'MANUAL_VERIFIED',
      insuranceCertExpiry: daysFromNow(90), insuranceVerifiedAt: daysAgo(30),
      bondAmount: 500_000, yearsInBusiness: 7, completedProjects: 28,
      riskTier: 'APPROVED',
      createdAt: daysAgo(120), updatedAt: daysAgo(30),
    },
    {
      id: CONTRACTOR_IDS.RIDGELINE, tenantId, type: 'contractor',
      name: 'Ridgeline Construction LLC', role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'CO-GC-2021088', licenseState: 'CO',
      licenseExpiry: daysFromNow(200),
      licenseVerifiedAt: daysAgo(30), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'MANUAL_VERIFIED',
      insuranceCertExpiry: daysFromNow(90), insuranceVerifiedAt: daysAgo(30),
      bondAmount: 500_000, yearsInBusiness: 7, completedProjects: 28,
      riskTier: 'APPROVED',
      createdAt: daysAgo(120), updatedAt: daysAgo(30),
    },
    {
      id: CONTRACTOR_IDS.SUMMIT_PEAK, tenantId, type: 'contractor',
      name: 'Summit Peak Builders', role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'CO-GC-2018031', licenseState: 'CO',
      licenseExpiry: daysFromNow(50),
      licenseVerifiedAt: daysAgo(60), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'API_VERIFIED',
      apiVerificationSource: 'CO DORA Contractor Database',
      insuranceCertExpiry: daysFromNow(180), insuranceVerifiedAt: daysAgo(15),
      bondAmount: 250_000, yearsInBusiness: 20, completedProjects: 112,
      riskTier: 'CONDITIONAL',
      notes: 'License renewal pending — do not assign new loans until renewed.',
      createdAt: daysAgo(180), updatedAt: daysAgo(15),
    },
    {
      id: CONTRACTOR_IDS.CLEARWATER, tenantId, type: 'contractor',
      name: 'Clearwater Renovations Inc.', role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'CO-GC-2022011', licenseState: 'CO',
      licenseExpiry: daysFromNow(500),
      licenseVerifiedAt: daysAgo(5), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'API_VERIFIED',
      apiVerificationSource: 'CO DORA Contractor Database',
      insuranceCertExpiry: daysFromNow(365), insuranceVerifiedAt: daysAgo(5),
      bondAmount: 1_000_000, yearsInBusiness: 4, completedProjects: 19,
      riskTier: 'APPROVED',
      createdAt: daysAgo(45), updatedAt: daysAgo(5),
    },
    {
      id: CONTRACTOR_IDS.FRONT_RANGE_ELEC, tenantId, type: 'contractor',
      name: 'Front Range Electrical Co.', role: 'SUBCONTRACTOR',
      licenseNumber: 'CO-EC-2017099', licenseState: 'CO',
      licenseExpiry: daysFromNow(320),
      licenseVerifiedAt: daysAgo(14), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'API_VERIFIED',
      apiVerificationSource: 'CO DORA Electrical Board',
      insuranceCertExpiry: daysFromNow(250), insuranceVerifiedAt: daysAgo(14),
      yearsInBusiness: 11, completedProjects: 205,
      riskTier: 'APPROVED',
      createdAt: daysAgo(200), updatedAt: daysAgo(14),
    },
    {
      id: CONTRACTOR_IDS.ROCKY_MTN_PLUMBING, tenantId, type: 'contractor',
      name: 'Rocky Mountain Plumbing', role: 'SUBCONTRACTOR',
      licenseNumber: 'CO-PL-2020044', licenseState: 'CO',
      licenseExpiry: daysFromNow(280),
      licenseVerifiedAt: daysAgo(20), licenseVerifiedBy: 'admin-user-001',
      licenseVerificationStatus: 'MANUAL_VERIFIED',
      insuranceCertExpiry: daysFromNow(200), insuranceVerifiedAt: daysAgo(20),
      yearsInBusiness: 8, completedProjects: 87,
      riskTier: 'APPROVED',
      createdAt: daysAgo(150), updatedAt: daysAgo(20),
    },
  ];
}

function buildLoans(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: CONSTRUCTION_LOAN_IDS.GROUND_UP, tenantId, type: 'construction-loan',
      loanNumber: 'CL-SEED-0042', loanType: 'GROUND_UP', status: 'ACTIVE',
      loanAmount: 420_000, interestRate: 0.115,
      maturityDate: daysFromNow(270),
      propertyAddress: { street: '1847 Spruce View Ln', city: 'Denver', state: 'CO', zipCode: '80220', county: 'Denver' },
      propertyType: 'Single Family Residential',
      asIsValue: 65_000, arvEstimate: 590_000,
      borrowerName: 'Marcus & Elena Reyes',
      generalContractorId: CONTRACTOR_IDS.APEX_BUILD,
      totalDrawsApproved: 189_000, totalDrawsDisbursed: 189_000,
      percentComplete: 45, retainagePercent: 10, retainageHeld: 21_000,
      constructionStartDate: daysAgo(55), expectedCompletionDate: daysFromNow(270),
      milestones: [
        { id: 'ms-001-01', name: 'Foundation Complete', targetDate: daysAgo(35), actualDate: daysAgo(35), status: 'COMPLETE', expectedPercentComplete: 20 },
        { id: 'ms-001-02', name: 'Framing Complete', targetDate: daysAgo(5), status: 'IN_PROGRESS', expectedPercentComplete: 45 },
        { id: 'ms-001-03', name: 'Dry-In / Roof', targetDate: daysFromNow(35), status: 'PENDING', expectedPercentComplete: 60 },
      ],
      createdAt: daysAgo(60), updatedAt: daysAgo(3),
    },
    {
      id: CONSTRUCTION_LOAN_IDS.FIX_FLIP, tenantId, type: 'construction-loan',
      loanNumber: 'CL-SEED-0038', loanType: 'FIX_FLIP', status: 'ACTIVE',
      loanAmount: 162_500, interestRate: 0.127,
      maturityDate: daysFromNow(60),
      propertyAddress: { street: '4421 Dahlia St', city: 'Aurora', state: 'CO', zipCode: '80010', county: 'Arapahoe' },
      propertyType: 'Single Family Residential',
      asIsValue: 185_000, arvEstimate: 340_000,
      borrowerName: 'Cornerstone Flips LLC',
      generalContractorId: CONTRACTOR_IDS.SWIFT_RENO,
      totalDrawsApproved: 130_000, totalDrawsDisbursed: 130_000,
      percentComplete: 85, retainagePercent: 10, retainageHeld: 14_500,
      constructionStartDate: daysAgo(85), expectedCompletionDate: daysFromNow(30),
      milestones: [
        { id: 'ms-002-01', name: 'Demo Complete', targetDate: daysAgo(75), actualDate: daysAgo(74), status: 'COMPLETE', expectedPercentComplete: 15 },
        { id: 'ms-002-02', name: 'Structural Repair', targetDate: daysAgo(50), actualDate: daysAgo(48), status: 'COMPLETE', expectedPercentComplete: 40 },
        { id: 'ms-002-03', name: 'Interior Finish', targetDate: daysFromNow(10), status: 'IN_PROGRESS', expectedPercentComplete: 85 },
      ],
      createdAt: daysAgo(90), updatedAt: daysAgo(7),
    },
    {
      id: CONSTRUCTION_LOAN_IDS.REHAB, tenantId, type: 'construction-loan',
      loanNumber: 'CL-SEED-0055', loanType: 'REHAB', status: 'PENDING_APPROVAL',
      loanAmount: 280_000, interestRate: 0.105,
      maturityDate: daysFromNow(365),
      propertyAddress: { street: '2015 Elm St', city: 'Dallas', state: 'TX', zipCode: '75201', county: 'Dallas' },
      propertyType: 'Single Family Residential',
      asIsValue: 250_000, arvEstimate: 480_000,
      borrowerName: 'Texas Urban Renewal LLC',
      generalContractorId: CONTRACTOR_IDS.SWIFT_RENO,
      totalDrawsApproved: 0, totalDrawsDisbursed: 0,
      percentComplete: 0, retainagePercent: 10,
      constructionStartDate: null, expectedCompletionDate: daysFromNow(300),
      createdAt: daysAgo(7), updatedAt: daysAgo(2),
    },
    {
      id: CONSTRUCTION_LOAN_IDS.MULTIFAMILY, tenantId, type: 'construction-loan',
      loanNumber: 'CL-2026-0007', loanType: 'MULTIFAMILY', status: 'ACTIVE',
      loanAmount: 1_850_000, interestRate: 0.109,
      maturityDate: daysFromNow(450),
      propertyAddress: { street: '2200 W Alameda Ave', city: 'Denver', state: 'CO', zipCode: '80223', county: 'Denver' },
      propertyType: 'Multifamily (12 Units)',
      asIsValue: 500_000, arvEstimate: 2_850_000,
      borrowerName: 'Alameda Capital Partners',
      generalContractorId: CONTRACTOR_IDS.APEX_BUILD,
      totalDrawsApproved: 740_000, totalDrawsDisbursed: 740_000,
      percentComplete: 40, retainagePercent: 10, retainageHeld: 82_222,
      constructionStartDate: daysAgo(42), expectedCompletionDate: daysFromNow(450),
      milestones: [
        { id: 'ms-003-01', name: 'Site & Foundation', targetDate: daysAgo(10), actualDate: daysAgo(9), status: 'COMPLETE', expectedPercentComplete: 30 },
        { id: 'ms-003-02', name: 'Framing Complete', targetDate: daysFromNow(60), status: 'IN_PROGRESS', expectedPercentComplete: 50 },
        { id: 'ms-003-03', name: 'Dry-In', targetDate: daysFromNow(120), status: 'PENDING', expectedPercentComplete: 60 },
        { id: 'ms-003-04', name: 'Rough MEP', targetDate: daysFromNow(200), status: 'PENDING', expectedPercentComplete: 75 },
        { id: 'ms-003-05', name: 'CO Issued', targetDate: daysFromNow(440), status: 'PENDING', expectedPercentComplete: 100 },
      ],
      createdAt: daysAgo(50), updatedAt: daysAgo(1),
    },
    {
      id: CONSTRUCTION_LOAN_IDS.COMPLETED, tenantId, type: 'construction-loan',
      loanNumber: 'CL-2024-0088', loanType: 'GROUND_UP', status: 'COMPLETED',
      loanAmount: 327_500, interestRate: 0.113,
      maturityDate: daysAgo(30),
      propertyAddress: { street: '3388 Xanthia Ct', city: 'Denver', state: 'CO', zipCode: '80238', county: 'Denver' },
      propertyType: 'Single Family Residential',
      asIsValue: 55_000, arvEstimate: 510_000,
      borrowerName: 'Marcus & Elena Reyes',
      generalContractorId: CONTRACTOR_IDS.RIDGELINE,
      totalDrawsApproved: 327_500, totalDrawsDisbursed: 327_500,
      percentComplete: 100, retainagePercent: 10, retainageHeld: 0, retainageReleased: 36_389,
      constructionStartDate: daysAgo(365), expectedCompletionDate: daysAgo(40), actualCompletionDate: daysAgo(38),
      milestones: [
        { id: 'ms-005-01', name: 'Foundation', targetDate: daysAgo(320), actualDate: daysAgo(318), status: 'COMPLETE', expectedPercentComplete: 15 },
        { id: 'ms-005-02', name: 'Framing', targetDate: daysAgo(260), actualDate: daysAgo(258), status: 'COMPLETE', expectedPercentComplete: 35 },
        { id: 'ms-005-03', name: 'Dry-In', targetDate: daysAgo(220), actualDate: daysAgo(221), status: 'COMPLETE', expectedPercentComplete: 50 },
        { id: 'ms-005-04', name: 'Rough MEP', targetDate: daysAgo(160), actualDate: daysAgo(155), status: 'COMPLETE', expectedPercentComplete: 70 },
        { id: 'ms-005-05', name: 'Final Inspection', targetDate: daysAgo(40), actualDate: daysAgo(38), status: 'COMPLETE', expectedPercentComplete: 100 },
      ],
      createdAt: daysAgo(380), updatedAt: daysAgo(30),
    },
  ];
}

function buildDraws(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: DRAW_IDS.DRAW_1_GROUND_UP, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.GROUND_UP,
      drawNumber: 1, status: 'DISBURSED',
      requestedAmount: 135_000, approvedAmount: 135_000, disbursedAmount: 135_000,
      description: 'Foundation + site work + permits + land acquisition',
      inspectionRequired: true, inspectionCompleted: true,
      inspectionDate: daysAgo(35), inspectionResult: 'APPROVED',
      inspectorNotes: 'Foundation complete, slab poured and cured. All site work verified.',
      requestedAt: daysAgo(38), approvedAt: daysAgo(35), disbursedAt: daysAgo(34),
      createdAt: daysAgo(38), updatedAt: daysAgo(34),
    },
    {
      id: DRAW_IDS.DRAW_2_GROUND_UP, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.GROUND_UP,
      drawNumber: 2, status: 'DISBURSED',
      requestedAmount: 54_000, approvedAmount: 54_000, disbursedAmount: 54_000,
      description: 'Framing progress (80% complete)',
      inspectionRequired: true, inspectionCompleted: true,
      inspectionDate: daysAgo(14), inspectionResult: 'APPROVED',
      inspectorNotes: 'Framing approximately 80% complete. Roof trusses not yet installed.',
      requestedAt: daysAgo(18), approvedAt: daysAgo(14), disbursedAt: daysAgo(13),
      createdAt: daysAgo(18), updatedAt: daysAgo(13),
    },
    {
      id: DRAW_IDS.DRAW_1_FIX_FLIP, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.FIX_FLIP,
      drawNumber: 3, status: 'DISBURSED',
      requestedAmount: 130_000, approvedAmount: 130_000, disbursedAmount: 130_000,
      description: 'Cumulative progress draw — demo through interior rough-in',
      inspectionRequired: true, inspectionCompleted: true,
      inspectionDate: daysAgo(10), inspectionResult: 'APPROVED',
      inspectorNotes: 'All trades complete through rough-in. Interior finish in progress.',
      requestedAt: daysAgo(14), approvedAt: daysAgo(10), disbursedAt: daysAgo(9),
      createdAt: daysAgo(14), updatedAt: daysAgo(9),
    },
    {
      id: DRAW_IDS.DRAW_1_REHAB, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.REHAB,
      drawNumber: 1, status: 'PENDING_INSPECTION',
      requestedAmount: 47_500, approvedAmount: null, disbursedAmount: 0,
      description: 'Initial draw — demo + foundation repair',
      inspectionRequired: true, inspectionCompleted: false,
      requestedAt: daysAgo(1),
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    // Multifamily loan draws
    {
      id: DRAW_IDS.DRAW_1_MULTIFAMILY, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.MULTIFAMILY,
      drawNumber: 1, status: 'DISBURSED',
      requestedAmount: 645_000, approvedAmount: 580_500, disbursedAmount: 516_000,
      description: 'Land + site work + foundation — 12-unit multifamily',
      inspectionRequired: true, inspectionCompleted: true,
      inspectionDate: daysAgo(12), inspectionResult: 'APPROVED',
      inspectorNotes: 'All foundation and site work verified. Caissons complete.',
      requestedAt: daysAgo(17), approvedAt: daysAgo(11), disbursedAt: daysAgo(10),
      createdAt: daysAgo(17), updatedAt: daysAgo(10),
    },
    {
      id: DRAW_IDS.DRAW_2_MULTIFAMILY, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.MULTIFAMILY,
      drawNumber: 2, status: 'INSPECTION_ORDERED',
      requestedAmount: 176_000,
      description: 'Framing 40% + rough MEP started — 12 units',
      inspectionRequired: true, inspectionCompleted: false,
      requestedAt: daysAgo(4),
      createdAt: daysAgo(4), updatedAt: daysAgo(3),
    },
    // Ground-up draw 3 (under review)
    {
      id: DRAW_IDS.DRAW_3_GROUND_UP, tenantId, type: 'draw-request',
      constructionLoanId: CONSTRUCTION_LOAN_IDS.GROUND_UP,
      drawNumber: 3, status: 'UNDER_REVIEW',
      requestedAmount: 23_000,
      description: 'Final framing 20% + roof decking + misc soft costs',
      inspectionRequired: true, inspectionCompleted: false,
      requestedAt: daysAgo(3),
      createdAt: daysAgo(3), updatedAt: daysAgo(2),
    },
  ];
}

function buildTenantConfig(tenantId: string): Record<string, unknown> {
  return {
    id: TENANT_CONFIG_IDS.CONSTRUCTION, tenantId,
    type: 'tenant-construction-config',
    defaultRetainagePercent: 10,
    maxLoanToValuePercent: 75,
    maxLoanToCostPercent: 90,
    requireInspectionBeforeDraw: true,
    allowOwnersAsGC: false,
    minContingencyPercent: 5,
    maxContingencyPercent: 20,
    loanTypes: ['GROUND_UP', 'FIX_FLIP', 'REHAB', 'MULTIFAMILY'],
    requireLicenseVerification: true,
    requireInsuranceCertificate: true,
    feasibilityCustomRules: [],
    createdAt: daysAgo(180), updatedAt: daysAgo(30),
  };
}

function buildBudgets(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: BUDGET_IDS.GROUND_UP, tenantId, constructionLoanId: CONSTRUCTION_LOAN_IDS.GROUND_UP,
      type: 'construction-budget', version: 1, status: 'APPROVED',
      totalOriginalBudget: 420_000, totalRevisedBudget: 420_000, totalDrawnToDate: 189_000,
      contingencyAmount: 21_000, contingencyUsed: 0,
      lineItems: [
        { id: 'li-001-01', category: 'LAND_ACQUISITION', description: 'Land purchase — 0.35 acre lot', originalAmount: 85_000, changeOrderAmount: 0, revisedAmount: 85_000, drawnToDate: 85_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-001-02', category: 'SITE_WORK', description: 'Clearing, grading, utilities stubout', originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 22_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-001-03', category: 'FOUNDATION', description: 'Concrete slab with stem walls', originalAmount: 28_000, changeOrderAmount: 0, revisedAmount: 28_000, drawnToDate: 28_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-001-04', category: 'FRAMING', description: 'Structural framing — 2,200 sq ft', originalAmount: 55_000, changeOrderAmount: 0, revisedAmount: 55_000, drawnToDate: 44_000, remainingBalance: 11_000, percentDisbursed: 80, percentCompleteInspected: 80 },
        { id: 'li-001-05', category: 'ROOFING', description: 'Architectural shingles', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 0, remainingBalance: 18_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-06', category: 'EXTERIOR', description: 'Hardie board siding + paint', originalAmount: 15_000, changeOrderAmount: 0, revisedAmount: 15_000, drawnToDate: 0, remainingBalance: 15_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-07', category: 'PLUMBING', description: 'Rough + finish, fixtures by owner', originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 0, remainingBalance: 22_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-08', category: 'ELECTRICAL', description: '200 A service, rough-in + finish', originalAmount: 20_000, changeOrderAmount: 0, revisedAmount: 20_000, drawnToDate: 0, remainingBalance: 20_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-09', category: 'HVAC', description: '3-ton central A/C + furnace', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 0, remainingBalance: 18_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-10', category: 'INTERIOR_FINISH', description: 'Drywall, flooring, trim, paint', originalAmount: 40_000, changeOrderAmount: 0, revisedAmount: 40_000, drawnToDate: 0, remainingBalance: 40_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-11', category: 'PERMITS_FEES', description: 'Building permit + plan check', originalAmount: 8_000, changeOrderAmount: 0, revisedAmount: 8_000, drawnToDate: 8_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-001-12', category: 'SOFT_COSTS', description: 'Architect, engineer, title', originalAmount: 10_000, changeOrderAmount: 0, revisedAmount: 10_000, drawnToDate: 2_000, remainingBalance: 8_000, percentDisbursed: 20, percentCompleteInspected: 20 },
        { id: 'li-001-13', category: 'INTEREST_RESERVE', description: '12-month interest reserve', originalAmount: 36_000, changeOrderAmount: 0, revisedAmount: 36_000, drawnToDate: 0, remainingBalance: 36_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-001-14', category: 'CONTINGENCY', description: '5% project contingency', originalAmount: 21_000, changeOrderAmount: 0, revisedAmount: 21_000, drawnToDate: 0, remainingBalance: 21_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      ],
      createdAt: daysAgo(60), updatedAt: daysAgo(14),
    },
    {
      id: BUDGET_IDS.FIX_FLIP, tenantId, constructionLoanId: CONSTRUCTION_LOAN_IDS.FIX_FLIP,
      type: 'construction-budget', version: 2, status: 'APPROVED',
      totalOriginalBudget: 155_000, totalRevisedBudget: 162_500, totalDrawnToDate: 130_000,
      contingencyAmount: 8_500, contingencyUsed: 0,
      lineItems: [
        { id: 'li-002-01', category: 'SITE_WORK', description: 'Selective demo, haul-away', originalAmount: 12_000, changeOrderAmount: 0, revisedAmount: 12_000, drawnToDate: 12_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-02', category: 'FOUNDATION', description: 'Foundation repair + waterproofing', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-03', category: 'FRAMING', description: 'Structural repair + room addition', originalAmount: 25_000, changeOrderAmount: 7_500, revisedAmount: 32_500, drawnToDate: 32_500, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-04', category: 'ROOFING', description: 'Full tear-off and re-roof', originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 14_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-05', category: 'PLUMBING', description: 'Update main stack + bath fixtures', originalAmount: 15_000, changeOrderAmount: 0, revisedAmount: 15_000, drawnToDate: 15_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-06', category: 'ELECTRICAL', description: 'Panel upgrade + rewire', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-07', category: 'INTERIOR_FINISH', description: 'Kitchen, baths, flooring, paint', originalAmount: 28_000, changeOrderAmount: 0, revisedAmount: 28_000, drawnToDate: 20_500, remainingBalance: 7_500, percentDisbursed: 73, percentCompleteInspected: 90 },
        { id: 'li-002-08', category: 'LANDSCAPING', description: 'Sod, privacy fence, landscaping', originalAmount: 8_000, changeOrderAmount: 0, revisedAmount: 8_000, drawnToDate: 0, remainingBalance: 8_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-002-09', category: 'PERMITS_FEES', description: 'Building permit + city fees', originalAmount: 4_500, changeOrderAmount: 0, revisedAmount: 4_500, drawnToDate: 4_500, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-002-10', category: 'CONTINGENCY', description: '5% contingency', originalAmount: 8_500, changeOrderAmount: 0, revisedAmount: 8_500, drawnToDate: 0, remainingBalance: 8_500, percentDisbursed: 0, percentCompleteInspected: 0 },
      ],
      createdAt: daysAgo(90), updatedAt: daysAgo(7),
    },
    {
      id: BUDGET_IDS.MULTIFAMILY, tenantId, constructionLoanId: CONSTRUCTION_LOAN_IDS.MULTIFAMILY,
      type: 'construction-budget', version: 1, status: 'APPROVED',
      totalOriginalBudget: 1_850_000, totalRevisedBudget: 1_850_000, totalDrawnToDate: 740_000,
      contingencyAmount: 92_500, contingencyUsed: 0,
      lineItems: [
        { id: 'li-003-01', category: 'LAND_ACQUISITION', description: '1.2 acre infill lot', originalAmount: 380_000, changeOrderAmount: 0, revisedAmount: 380_000, drawnToDate: 380_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-003-02', category: 'SITE_WORK', description: 'Grading, utilities, drainage', originalAmount: 85_000, changeOrderAmount: 0, revisedAmount: 85_000, drawnToDate: 85_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-003-03', category: 'FOUNDATION', description: 'Mat slab + caissons', originalAmount: 180_000, changeOrderAmount: 0, revisedAmount: 180_000, drawnToDate: 180_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-003-04', category: 'FRAMING', description: 'Steel + wood hybrid, 12 units', originalAmount: 240_000, changeOrderAmount: 0, revisedAmount: 240_000, drawnToDate: 95_000, remainingBalance: 145_000, percentDisbursed: 40, percentCompleteInspected: 40 },
        { id: 'li-003-05', category: 'PLUMBING', description: '12-unit rough + finish', originalAmount: 120_000, changeOrderAmount: 0, revisedAmount: 120_000, drawnToDate: 0, remainingBalance: 120_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-06', category: 'ELECTRICAL', description: '12-unit rough + finish, meters', originalAmount: 110_000, changeOrderAmount: 0, revisedAmount: 110_000, drawnToDate: 0, remainingBalance: 110_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-07', category: 'HVAC', description: 'Forced-air + common area HVAC', originalAmount: 95_000, changeOrderAmount: 0, revisedAmount: 95_000, drawnToDate: 0, remainingBalance: 95_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-08', category: 'INTERIOR_FINISH', description: '12 units: flooring, kitchens', originalAmount: 220_000, changeOrderAmount: 0, revisedAmount: 220_000, drawnToDate: 0, remainingBalance: 220_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-09', category: 'LANDSCAPING', description: 'Common area + unit patios', originalAmount: 55_000, changeOrderAmount: 0, revisedAmount: 55_000, drawnToDate: 0, remainingBalance: 55_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-10', category: 'PERMITS_FEES', description: 'Building permits + impact fees', originalAmount: 85_000, changeOrderAmount: 0, revisedAmount: 85_000, drawnToDate: 0, remainingBalance: 85_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-11', category: 'SOFT_COSTS', description: 'Architecture + engineering', originalAmount: 95_000, changeOrderAmount: 0, revisedAmount: 95_000, drawnToDate: 0, remainingBalance: 95_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-12', category: 'INTEREST_RESERVE', description: '18-month interest reserve', originalAmount: 92_500, changeOrderAmount: 0, revisedAmount: 92_500, drawnToDate: 0, remainingBalance: 92_500, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-003-13', category: 'CONTINGENCY', description: '5% contingency', originalAmount: 92_500, changeOrderAmount: 0, revisedAmount: 92_500, drawnToDate: 0, remainingBalance: 92_500, percentDisbursed: 0, percentCompleteInspected: 0 },
      ],
      createdAt: daysAgo(45), updatedAt: daysAgo(3),
    },
    {
      id: BUDGET_IDS.REHAB, tenantId, constructionLoanId: CONSTRUCTION_LOAN_IDS.REHAB,
      type: 'construction-budget', version: 1, status: 'DRAFT',
      totalOriginalBudget: 280_000, totalRevisedBudget: 280_000, totalDrawnToDate: 0,
      contingencyAmount: 14_000, contingencyUsed: 0,
      lineItems: [
        { id: 'li-004-01', category: 'SITE_WORK', description: 'Demo + haul-away', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 0, remainingBalance: 18_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-02', category: 'FOUNDATION', description: 'Foundation crack repair', originalAmount: 25_000, changeOrderAmount: 0, revisedAmount: 25_000, drawnToDate: 0, remainingBalance: 25_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-03', category: 'ROOFING', description: 'Full roof replacement', originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 0, remainingBalance: 22_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-04', category: 'PLUMBING', description: 'Repipe + fixtures', originalAmount: 28_000, changeOrderAmount: 0, revisedAmount: 28_000, drawnToDate: 0, remainingBalance: 28_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-05', category: 'ELECTRICAL', description: 'Panel + partial rewire', originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 0, remainingBalance: 22_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-06', category: 'INTERIOR_FINISH', description: 'Kitchen, baths, paint, floor', originalAmount: 55_000, changeOrderAmount: 0, revisedAmount: 55_000, drawnToDate: 0, remainingBalance: 55_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-07', category: 'HVAC', description: '2-ton mini-split system', originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 0, remainingBalance: 14_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-08', category: 'LANDSCAPING', description: 'Exterior cleanup + sod', originalAmount: 8_000, changeOrderAmount: 0, revisedAmount: 8_000, drawnToDate: 0, remainingBalance: 8_000, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-09', category: 'PERMITS_FEES', description: 'Renovation permit', originalAmount: 4_500, changeOrderAmount: 0, revisedAmount: 4_500, drawnToDate: 0, remainingBalance: 4_500, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-10', category: 'SOFT_COSTS', description: 'Architect + structural eng.', originalAmount: 8_500, changeOrderAmount: 0, revisedAmount: 8_500, drawnToDate: 0, remainingBalance: 8_500, percentDisbursed: 0, percentCompleteInspected: 0 },
        { id: 'li-004-11', category: 'CONTINGENCY', description: '5% contingency', originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 0, remainingBalance: 14_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      ],
      createdAt: daysAgo(7), updatedAt: daysAgo(2),
    },
    {
      id: BUDGET_IDS.COMPLETED, tenantId, constructionLoanId: CONSTRUCTION_LOAN_IDS.COMPLETED,
      type: 'construction-budget', version: 3, status: 'APPROVED',
      totalOriginalBudget: 310_000, totalRevisedBudget: 327_500, totalDrawnToDate: 327_500,
      contingencyAmount: 17_500, contingencyUsed: 0,
      lineItems: [
        { id: 'li-005-01', category: 'LAND_ACQUISITION', description: 'Lot purchase', originalAmount: 60_000, changeOrderAmount: 0, revisedAmount: 60_000, drawnToDate: 60_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-02', category: 'SITE_WORK', description: 'Grading + utilities', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-03', category: 'FOUNDATION', description: 'Monolithic slab', originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 22_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-04', category: 'FRAMING', description: 'Structural framing', originalAmount: 40_000, changeOrderAmount: 7_500, revisedAmount: 47_500, drawnToDate: 47_500, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-05', category: 'ROOFING', description: 'Tile roof', originalAmount: 16_000, changeOrderAmount: 0, revisedAmount: 16_000, drawnToDate: 16_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-06', category: 'PLUMBING', description: 'Full rough + finish', originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-07', category: 'ELECTRICAL', description: 'Full rough + finish', originalAmount: 16_000, changeOrderAmount: 0, revisedAmount: 16_000, drawnToDate: 16_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-08', category: 'HVAC', description: '2-ton central A/C', originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 14_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-09', category: 'INTERIOR_FINISH', description: 'Full finish-out', originalAmount: 50_000, changeOrderAmount: 0, revisedAmount: 50_000, drawnToDate: 50_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-10', category: 'LANDSCAPING', description: 'Sod + hardscape', originalAmount: 12_000, changeOrderAmount: 0, revisedAmount: 12_000, drawnToDate: 12_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-11', category: 'PERMITS_FEES', description: 'All permits + fees', originalAmount: 7_000, changeOrderAmount: 0, revisedAmount: 7_000, drawnToDate: 7_000, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-12', category: 'SOFT_COSTS', description: 'Arch + eng + title', originalAmount: 7_500, changeOrderAmount: 0, revisedAmount: 7_500, drawnToDate: 7_500, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
        { id: 'li-005-13', category: 'CONTINGENCY', description: '5% contingency', originalAmount: 10_000, changeOrderAmount: 7_500, revisedAmount: 17_500, drawnToDate: 17_500, remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      ],
      createdAt: daysAgo(365), updatedAt: daysAgo(30),
    },
  ];
}

export const module: SeedModule = {
  name: 'construction',
  containers: ['contractors', 'construction-loans', 'draws'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'contractors');
      result.cleaned += await cleanContainer(ctx, 'construction-loans');
      result.cleaned += await cleanContainer(ctx, 'draws', '/constructionLoanId');
    }

    for (const c of buildContractors(ctx.tenantId)) await upsert(ctx, 'contractors', c, result);
    await upsert(ctx, 'construction-loans', buildTenantConfig(ctx.tenantId), result);
    for (const b of buildBudgets(ctx.tenantId)) await upsert(ctx, 'construction-loans', b, result);
    for (const l of buildLoans(ctx.tenantId)) await upsert(ctx, 'construction-loans', l, result);
    for (const d of buildDraws(ctx.tenantId)) await upsert(ctx, 'draws', d, result);

    return result;
  },
};
