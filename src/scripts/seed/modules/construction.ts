/**
 * Seed Module: Construction Finance
 *
 * Seeds contractors, construction loans + budgets, and draw requests.
 * Containers: contractors, construction-loans, draws
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow } from '../seed-types.js';
import { CONTRACTOR_IDS, CONSTRUCTION_LOAN_IDS, DRAW_IDS } from '../seed-ids.js';

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

    for (const c of buildContractors(ctx.tenantId)) {
      await upsert(ctx, 'contractors', c, result);
    }
    for (const l of buildLoans(ctx.tenantId)) {
      await upsert(ctx, 'construction-loans', l, result);
    }
    for (const d of buildDraws(ctx.tenantId)) {
      await upsert(ctx, 'draws', d, result);
    }

    return result;
  },
};
