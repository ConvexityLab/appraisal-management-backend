/**
 * Seed Construction Finance Data
 *
 * Populates three Cosmos DB containers with realistic demo data:
 *   - contractors   (partition /tenantId)       → 6 ContractorProfile documents
 *   - construction-loans (partition /tenantId)  → 5 ConstructionLoan + 5 ConstructionBudget + 1 TenantConstructionConfig
 *   - draws         (partition /constructionLoanId) → 10 DrawRequest documents across active loans
 *
 * Run with: npx tsx src/scripts/seed-construction-data.ts
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('SeedConstruction');
const cosmosDb = new CosmosDbService();

const _rawTenantId = process.env.AZURE_TENANT_ID;
if (!_rawTenantId) {
  throw new Error('AZURE_TENANT_ID is not set in .env — cannot seed without a tenant ID');
}
const TENANT_ID: string = _rawTenantId;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

// ─── Contractors ──────────────────────────────────────────────────────────────

const contractors = [
  {
    id: 'con-seed-gc-001',
    tenantId: TENANT_ID,
    name: 'Apex Build Group',
    role: 'GENERAL_CONTRACTOR',
    licenseNumber: 'CO-GC-2019042',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(400),
    licenseVerifiedAt: daysAgo(10),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'API_VERIFIED',
    apiVerificationAt: daysAgo(10),
    apiVerificationSource: 'CO DORA Contractor Database',
    insuranceCertExpiry: daysFromNow(300),
    insuranceVerifiedAt: daysAgo(10),
    bondAmount: 750_000,
    yearsInBusiness: 14,
    completedProjects: 63,
    riskTier: 'APPROVED',
    createdAt: daysAgo(90),
    updatedAt: daysAgo(10),
  },
  {
    id: 'con-seed-gc-002',
    tenantId: TENANT_ID,
    name: 'Ridgeline Construction LLC',
    role: 'GENERAL_CONTRACTOR',
    licenseNumber: 'CO-GC-2021088',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(200),
    licenseVerifiedAt: daysAgo(30),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'MANUAL_VERIFIED',
    insuranceCertExpiry: daysFromNow(90),
    insuranceVerifiedAt: daysAgo(30),
    bondAmount: 500_000,
    yearsInBusiness: 7,
    completedProjects: 28,
    riskTier: 'APPROVED',
    createdAt: daysAgo(120),
    updatedAt: daysAgo(30),
  },
  {
    id: 'con-seed-gc-003',
    tenantId: TENANT_ID,
    name: 'Summit Peak Builders',
    role: 'GENERAL_CONTRACTOR',
    licenseNumber: 'CO-GC-2018031',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(50),  // Near-expiry; CONDITIONAL tier
    licenseVerifiedAt: daysAgo(60),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'API_VERIFIED',
    apiVerificationAt: daysAgo(60),
    apiVerificationSource: 'CO DORA Contractor Database',
    insuranceCertExpiry: daysFromNow(180),
    insuranceVerifiedAt: daysAgo(15),
    bondAmount: 250_000,
    yearsInBusiness: 20,
    completedProjects: 112,
    riskTier: 'CONDITIONAL',
    notes: 'License renewal pending — do not assign new loans until renewed.',
    createdAt: daysAgo(180),
    updatedAt: daysAgo(15),
  },
  {
    id: 'con-seed-gc-004',
    tenantId: TENANT_ID,
    name: 'Clearwater Renovations Inc.',
    role: 'GENERAL_CONTRACTOR',
    licenseNumber: 'CO-GC-2022011',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(500),
    licenseVerifiedAt: daysAgo(5),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'API_VERIFIED',
    apiVerificationAt: daysAgo(5),
    apiVerificationSource: 'CO DORA Contractor Database',
    insuranceCertExpiry: daysFromNow(365),
    insuranceVerifiedAt: daysAgo(5),
    bondAmount: 1_000_000,
    yearsInBusiness: 4,
    completedProjects: 19,
    riskTier: 'APPROVED',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(5),
  },
  {
    id: 'con-seed-sub-001',
    tenantId: TENANT_ID,
    name: 'Front Range Electrical Co.',
    role: 'SUBCONTRACTOR',
    licenseNumber: 'CO-EC-2017099',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(320),
    licenseVerifiedAt: daysAgo(14),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'API_VERIFIED',
    apiVerificationAt: daysAgo(14),
    apiVerificationSource: 'CO DORA Electrical Board',
    insuranceCertExpiry: daysFromNow(250),
    insuranceVerifiedAt: daysAgo(14),
    yearsInBusiness: 11,
    completedProjects: 205,
    riskTier: 'APPROVED',
    createdAt: daysAgo(200),
    updatedAt: daysAgo(14),
  },
  {
    id: 'con-seed-sub-002',
    tenantId: TENANT_ID,
    name: 'Rocky Mountain Plumbing',
    role: 'SUBCONTRACTOR',
    licenseNumber: 'CO-PL-2020044',
    licenseState: 'CO',
    licenseExpiry: daysFromNow(280),
    licenseVerifiedAt: daysAgo(20),
    licenseVerifiedBy: 'admin-user-001',
    licenseVerificationStatus: 'MANUAL_VERIFIED',
    insuranceCertExpiry: daysFromNow(200),
    insuranceVerifiedAt: daysAgo(20),
    yearsInBusiness: 8,
    completedProjects: 87,
    riskTier: 'APPROVED',
    createdAt: daysAgo(150),
    updatedAt: daysAgo(20),
  },
];

// ─── Tenant Config ─────────────────────────────────────────────────────────────

const tenantConfig = {
  id: 'tenant-construction-config-test-tenant-123',
  tenantId: TENANT_ID,
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

  createdAt: daysAgo(180),
  updatedAt: daysAgo(30),
};

// ─── Budgets ───────────────────────────────────────────────────────────────────

const budgets = [
  {
    id: 'budget-seed-001',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-001',
    type: 'construction-budget',
    version: 1,
    status: 'APPROVED',
    totalOriginalBudget: 420_000,
    totalRevisedBudget: 420_000,
    totalDrawnToDate: 189_000,
    contingencyAmount: 21_000,
    contingencyUsed: 0,
    lineItems: [
      { id: 'li-001-01', category: 'LAND_ACQUISITION',  description: 'Land purchase — 0.35 acre lot',           originalAmount: 85_000,  changeOrderAmount: 0, revisedAmount: 85_000,  drawnToDate: 85_000,  remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-001-02', category: 'SITE_WORK',          description: 'Clearing, grading, utilities stubout',    originalAmount: 22_000,  changeOrderAmount: 0, revisedAmount: 22_000,  drawnToDate: 22_000,  remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-001-03', category: 'FOUNDATION',         description: 'Concrete slab with stem walls',           originalAmount: 28_000,  changeOrderAmount: 0, revisedAmount: 28_000,  drawnToDate: 28_000,  remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-001-04', category: 'FRAMING',            description: 'Structural framing — 2,200 sq ft',        originalAmount: 55_000,  changeOrderAmount: 0, revisedAmount: 55_000,  drawnToDate: 44_000,  remainingBalance: 11_000, percentDisbursed: 80,  percentCompleteInspected: 80  },
      { id: 'li-001-05', category: 'ROOFING',            description: 'Architectural shingles',                  originalAmount: 18_000,  changeOrderAmount: 0, revisedAmount: 18_000,  drawnToDate: 0,       remainingBalance: 18_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-06', category: 'EXTERIOR',           description: 'Hardie board siding + paint',             originalAmount: 15_000,  changeOrderAmount: 0, revisedAmount: 15_000,  drawnToDate: 0,       remainingBalance: 15_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-07', category: 'PLUMBING',           description: 'Rough + finish, fixtures by owner',       originalAmount: 22_000,  changeOrderAmount: 0, revisedAmount: 22_000,  drawnToDate: 0,       remainingBalance: 22_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-08', category: 'ELECTRICAL',         description: '200 A service, rough-in + finish',        originalAmount: 20_000,  changeOrderAmount: 0, revisedAmount: 20_000,  drawnToDate: 0,       remainingBalance: 20_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-09', category: 'HVAC',               description: '3-ton central A/C + furnace',             originalAmount: 18_000,  changeOrderAmount: 0, revisedAmount: 18_000,  drawnToDate: 0,       remainingBalance: 18_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-10', category: 'INTERIOR_FINISH',    description: 'Drywall, flooring, trim, paint',          originalAmount: 40_000,  changeOrderAmount: 0, revisedAmount: 40_000,  drawnToDate: 0,       remainingBalance: 40_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-11', category: 'PERMITS_FEES',       description: 'Building permit + plan check',            originalAmount: 8_000,   changeOrderAmount: 0, revisedAmount: 8_000,   drawnToDate: 8_000,   remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-001-12', category: 'SOFT_COSTS',         description: 'Architect, engineer, title',              originalAmount: 10_000,  changeOrderAmount: 0, revisedAmount: 10_000,  drawnToDate: 2_000,   remainingBalance: 8_000,  percentDisbursed: 20,  percentCompleteInspected: 20  },
      { id: 'li-001-13', category: 'INTEREST_RESERVE',   description: '12-month interest reserve',               originalAmount: 36_000,  changeOrderAmount: 0, revisedAmount: 36_000,  drawnToDate: 0,       remainingBalance: 36_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-001-14', category: 'CONTINGENCY',        description: '5% project contingency',                  originalAmount: 21_000,  changeOrderAmount: 0, revisedAmount: 21_000,  drawnToDate: 0,       remainingBalance: 21_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
    ],
    createdAt: daysAgo(60),
    updatedAt: daysAgo(14),
  },
  {
    id: 'budget-seed-002',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-002',
    type: 'construction-budget',
    version: 2,
    status: 'APPROVED',
    totalOriginalBudget: 155_000,
    totalRevisedBudget: 162_500,   // CO raised framing
    totalDrawnToDate: 130_000,
    contingencyAmount: 8_500,
    contingencyUsed: 0,
    lineItems: [
      { id: 'li-002-01', category: 'SITE_WORK',       description: 'Selective demo, haul-away',              originalAmount: 12_000, changeOrderAmount: 0,     revisedAmount: 12_000, drawnToDate: 12_000, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-02', category: 'FOUNDATION',      description: 'Foundation repair + waterproofing',       originalAmount: 18_000, changeOrderAmount: 0,     revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-03', category: 'FRAMING',         description: 'Structural repair + room addition',       originalAmount: 25_000, changeOrderAmount: 7_500, revisedAmount: 32_500, drawnToDate: 32_500, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-04', category: 'ROOFING',         description: 'Full tear-off and re-roof',               originalAmount: 14_000, changeOrderAmount: 0,     revisedAmount: 14_000, drawnToDate: 14_000, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-05', category: 'PLUMBING',        description: 'Update main stack + bath fixtures',       originalAmount: 15_000, changeOrderAmount: 0,     revisedAmount: 15_000, drawnToDate: 15_000, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-06', category: 'ELECTRICAL',      description: 'Panel upgrade + rewire',                  originalAmount: 18_000, changeOrderAmount: 0,     revisedAmount: 18_000, drawnToDate: 18_000, remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-07', category: 'INTERIOR_FINISH', description: 'Kitchen, baths, flooring, paint',         originalAmount: 28_000, changeOrderAmount: 0,     revisedAmount: 28_000, drawnToDate: 20_500, remainingBalance: 7_500,  percentDisbursed: 73,  percentCompleteInspected: 90  },
      { id: 'li-002-08', category: 'LANDSCAPING',     description: 'Sod, privacy fence, landscaping',         originalAmount: 8_000,  changeOrderAmount: 0,     revisedAmount: 8_000,  drawnToDate: 0,      remainingBalance: 8_000,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-002-09', category: 'PERMITS_FEES',    description: 'Building permit + city fees',             originalAmount: 4_500,  changeOrderAmount: 0,     revisedAmount: 4_500,  drawnToDate: 4_500,  remainingBalance: 0,      percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-002-10', category: 'CONTINGENCY',     description: '5% contingency',                         originalAmount: 8_500,  changeOrderAmount: 0,     revisedAmount: 8_500,  drawnToDate: 0,      remainingBalance: 8_500,  percentDisbursed: 0,   percentCompleteInspected: 0   },
    ],
    createdAt: daysAgo(90),
    updatedAt: daysAgo(7),
  },
  {
    id: 'budget-seed-003',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-003',
    type: 'construction-budget',
    version: 1,
    status: 'APPROVED',
    totalOriginalBudget: 1_850_000,
    totalRevisedBudget: 1_850_000,
    totalDrawnToDate: 740_000,
    contingencyAmount: 92_500,
    contingencyUsed: 0,
    lineItems: [
      { id: 'li-003-01', category: 'LAND_ACQUISITION', description: '1.2 acre infill lot',              originalAmount: 380_000, changeOrderAmount: 0, revisedAmount: 380_000, drawnToDate: 380_000, remainingBalance: 0,       percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-003-02', category: 'SITE_WORK',         description: 'Grading, utilities, drainage',    originalAmount: 85_000,  changeOrderAmount: 0, revisedAmount: 85_000,  drawnToDate: 85_000,  remainingBalance: 0,       percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-003-03', category: 'FOUNDATION',        description: 'Mat slab + caissons',             originalAmount: 180_000, changeOrderAmount: 0, revisedAmount: 180_000, drawnToDate: 180_000, remainingBalance: 0,       percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-003-04', category: 'FRAMING',           description: 'Steel + wood hybrid, 12 units',   originalAmount: 240_000, changeOrderAmount: 0, revisedAmount: 240_000, drawnToDate: 95_000,  remainingBalance: 145_000, percentDisbursed: 40,  percentCompleteInspected: 40  },
      { id: 'li-003-05', category: 'PLUMBING',          description: '12-unit rough + finish',          originalAmount: 120_000, changeOrderAmount: 0, revisedAmount: 120_000, drawnToDate: 0,       remainingBalance: 120_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-06', category: 'ELECTRICAL',        description: '12-unit rough + finish, meters',  originalAmount: 110_000, changeOrderAmount: 0, revisedAmount: 110_000, drawnToDate: 0,       remainingBalance: 110_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-07', category: 'HVAC',              description: 'Forced-air + common area HVAC',   originalAmount: 95_000,  changeOrderAmount: 0, revisedAmount: 95_000,  drawnToDate: 0,       remainingBalance: 95_000,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-08', category: 'INTERIOR_FINISH',   description: '12 units: flooring, kitchens',    originalAmount: 220_000, changeOrderAmount: 0, revisedAmount: 220_000, drawnToDate: 0,       remainingBalance: 220_000, percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-09', category: 'LANDSCAPING',       description: 'Common area + unit patios',       originalAmount: 55_000,  changeOrderAmount: 0, revisedAmount: 55_000,  drawnToDate: 0,       remainingBalance: 55_000,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-10', category: 'PERMITS_FEES',      description: 'Building permits + impact fees',  originalAmount: 85_000,  changeOrderAmount: 0, revisedAmount: 85_000,  drawnToDate: 0,       remainingBalance: 85_000,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-11', category: 'SOFT_COSTS',        description: 'Architecture + engineering',     originalAmount: 95_000,  changeOrderAmount: 0, revisedAmount: 95_000,  drawnToDate: 0,       remainingBalance: 95_000,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-12', category: 'INTEREST_RESERVE',  description: '18-month interest reserve',      originalAmount: 92_500,  changeOrderAmount: 0, revisedAmount: 92_500,  drawnToDate: 0,       remainingBalance: 92_500,  percentDisbursed: 0,   percentCompleteInspected: 0   },
      { id: 'li-003-13', category: 'CONTINGENCY',       description: '5% contingency',                originalAmount: 92_500,  changeOrderAmount: 0, revisedAmount: 92_500,  drawnToDate: 0,       remainingBalance: 92_500,  percentDisbursed: 0,   percentCompleteInspected: 0   },
    ],
    createdAt: daysAgo(45),
    updatedAt: daysAgo(3),
  },
  {
    id: 'budget-seed-004',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-004',
    type: 'construction-budget',
    version: 1,
    status: 'DRAFT',
    totalOriginalBudget: 280_000,
    totalRevisedBudget: 280_000,
    totalDrawnToDate: 0,
    contingencyAmount: 14_000,
    contingencyUsed: 0,
    lineItems: [
      { id: 'li-004-01', category: 'SITE_WORK',       description: 'Demo + haul-away',              originalAmount: 18_000, changeOrderAmount: 0, revisedAmount: 18_000, drawnToDate: 0, remainingBalance: 18_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-02', category: 'FOUNDATION',      description: 'Foundation crack repair',       originalAmount: 25_000, changeOrderAmount: 0, revisedAmount: 25_000, drawnToDate: 0, remainingBalance: 25_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-03', category: 'ROOFING',         description: 'Full roof replacement',         originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 0, remainingBalance: 22_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-04', category: 'PLUMBING',        description: 'Repipe + fixtures',             originalAmount: 28_000, changeOrderAmount: 0, revisedAmount: 28_000, drawnToDate: 0, remainingBalance: 28_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-05', category: 'ELECTRICAL',      description: 'Panel + partial rewire',        originalAmount: 22_000, changeOrderAmount: 0, revisedAmount: 22_000, drawnToDate: 0, remainingBalance: 22_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-06', category: 'INTERIOR_FINISH', description: 'Kitchen, baths, paint, floor',  originalAmount: 55_000, changeOrderAmount: 0, revisedAmount: 55_000, drawnToDate: 0, remainingBalance: 55_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-07', category: 'HVAC',            description: '2-ton mini-split system',       originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 0, remainingBalance: 14_000, percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-08', category: 'LANDSCAPING',     description: 'Exterior cleanup + sod',        originalAmount: 8_000,  changeOrderAmount: 0, revisedAmount: 8_000,  drawnToDate: 0, remainingBalance: 8_000,  percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-09', category: 'PERMITS_FEES',    description: 'Renovation permit',             originalAmount: 4_500,  changeOrderAmount: 0, revisedAmount: 4_500,  drawnToDate: 0, remainingBalance: 4_500,  percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-10', category: 'SOFT_COSTS',      description: 'Architect + structural eng.',   originalAmount: 8_500,  changeOrderAmount: 0, revisedAmount: 8_500,  drawnToDate: 0, remainingBalance: 8_500,  percentDisbursed: 0, percentCompleteInspected: 0 },
      { id: 'li-004-11', category: 'CONTINGENCY',     description: '5% contingency',               originalAmount: 14_000, changeOrderAmount: 0, revisedAmount: 14_000, drawnToDate: 0, remainingBalance: 14_000, percentDisbursed: 0, percentCompleteInspected: 0 },
    ],
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  },
  {
    id: 'budget-seed-005',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-005',
    type: 'construction-budget',
    version: 3,
    status: 'APPROVED',
    totalOriginalBudget: 310_000,
    totalRevisedBudget: 327_500,
    totalDrawnToDate: 327_500,
    contingencyAmount: 17_500,
    contingencyUsed: 0,
    lineItems: [
      { id: 'li-005-01', category: 'LAND_ACQUISITION', description: 'Lot purchase',           originalAmount: 60_000, changeOrderAmount: 0,     revisedAmount: 60_000,  drawnToDate: 60_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-02', category: 'SITE_WORK',         description: 'Grading + utilities',   originalAmount: 18_000, changeOrderAmount: 0,     revisedAmount: 18_000,  drawnToDate: 18_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-03', category: 'FOUNDATION',        description: 'Monolithic slab',       originalAmount: 22_000, changeOrderAmount: 0,     revisedAmount: 22_000,  drawnToDate: 22_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-04', category: 'FRAMING',           description: 'Structural framing',    originalAmount: 40_000, changeOrderAmount: 7_500, revisedAmount: 47_500,  drawnToDate: 47_500,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-05', category: 'ROOFING',           description: 'Tile roof',             originalAmount: 16_000, changeOrderAmount: 0,     revisedAmount: 16_000,  drawnToDate: 16_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-06', category: 'PLUMBING',          description: 'Full rough + finish',   originalAmount: 18_000, changeOrderAmount: 0,     revisedAmount: 18_000,  drawnToDate: 18_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-07', category: 'ELECTRICAL',        description: 'Full rough + finish',   originalAmount: 16_000, changeOrderAmount: 0,     revisedAmount: 16_000,  drawnToDate: 16_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-08', category: 'HVAC',              description: '2-ton central A/C',     originalAmount: 14_000, changeOrderAmount: 0,     revisedAmount: 14_000,  drawnToDate: 14_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-09', category: 'INTERIOR_FINISH',   description: 'Full finish-out',       originalAmount: 50_000, changeOrderAmount: 0,     revisedAmount: 50_000,  drawnToDate: 50_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-10', category: 'LANDSCAPING',       description: 'Sod + hardscape',       originalAmount: 12_000, changeOrderAmount: 0,     revisedAmount: 12_000,  drawnToDate: 12_000,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-11', category: 'PERMITS_FEES',      description: 'All permits + fees',    originalAmount: 7_000,  changeOrderAmount: 0,     revisedAmount: 7_000,   drawnToDate: 7_000,   remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-12', category: 'SOFT_COSTS',        description: 'Arch + eng + title',   originalAmount: 7_500,  changeOrderAmount: 0,     revisedAmount: 7_500,   drawnToDate: 7_500,   remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
      { id: 'li-005-13', category: 'CONTINGENCY',       description: '5% contingency',       originalAmount: 10_000, changeOrderAmount: 7_500, revisedAmount: 17_500,  drawnToDate: 17_500,  remainingBalance: 0, percentDisbursed: 100, percentCompleteInspected: 100 },
    ],
    createdAt: daysAgo(365),
    updatedAt: daysAgo(30),
  },
];

// ─── Loans ─────────────────────────────────────────────────────────────────────

const loans = [
  {
    id: 'loan-seed-001',
    tenantId: TENANT_ID,
    type: 'construction-loan',
    loanNumber: 'CL-2025-0042',
    loanType: 'GROUND_UP',
    status: 'ACTIVE',
    loanAmount: 420_000,
    interestRate: 0.115,
    maturityDate: daysFromNow(270),
    interestReserveAmount: 36_000,
    interestReserveDrawn: 0,
    propertyAddress: { street: '1847 Spruce View Ln', city: 'Denver', state: 'CO', zipCode: '80220', county: 'Denver' },
    propertyType: 'Single Family Residential',
    asIsValue: 65_000,
    arvEstimate: 590_000,
    borrowerId: 'borrower-seed-001',
    borrowerName: 'Marcus & Elena Reyes',
    generalContractorId: 'con-seed-gc-001',
    budgetId: 'budget-seed-001',
    totalDrawsApproved: 189_000,
    totalDrawsDisbursed: 189_000,
    percentComplete: 45,
    retainagePercent: 10,
    retainageHeld: 21_000,
    retainageReleased: 0,
    constructionStartDate: daysAgo(55),
    expectedCompletionDate: daysFromNow(270),
    milestones: [
      { id: 'ms-001-01', name: 'Foundation Complete',  targetDate: daysAgo(35), actualDate: daysAgo(35), status: 'COMPLETE',    expectedPercentComplete: 20 },
      { id: 'ms-001-02', name: 'Framing Complete',     targetDate: daysAgo(5),  actualDate: null,        status: 'IN_PROGRESS', expectedPercentComplete: 45 },
      { id: 'ms-001-03', name: 'Dry-In / Roof',        targetDate: daysFromNow(35),  actualDate: null,   status: 'PENDING',     expectedPercentComplete: 60 },
      { id: 'ms-001-04', name: 'Rough MEP Complete',   targetDate: daysFromNow(80),  actualDate: null,   status: 'PENDING',     expectedPercentComplete: 75 },
      { id: 'ms-001-05', name: 'Final Inspection',     targetDate: daysFromNow(240), actualDate: null,   status: 'PENDING',     expectedPercentComplete: 100 },
    ],
    createdBy: 'admin-user-001',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(3),
    activeRiskFlags: [],
    linkedOrders: [],
  },
  {
    id: 'loan-seed-002',
    tenantId: TENANT_ID,
    type: 'construction-loan',
    loanNumber: 'CL-2025-0038',
    loanType: 'FIX_FLIP',
    status: 'ACTIVE',
    loanAmount: 162_500,
    interestRate: 0.127,
    maturityDate: daysFromNow(60),
    interestReserveAmount: 0,
    interestReserveDrawn: 0,
    propertyAddress: { street: '4421 Dahlia St', city: 'Aurora', state: 'CO', zipCode: '80010', county: 'Arapahoe' },
    propertyType: 'Single Family Residential',
    asIsValue: 185_000,
    arvEstimate: 340_000,
    borrowerId: 'borrower-seed-002',
    borrowerName: 'TurnKey Investments LLC',
    generalContractorId: 'con-seed-gc-002',
    budgetId: 'budget-seed-002',
    totalDrawsApproved: 130_000,
    totalDrawsDisbursed: 130_000,
    percentComplete: 88,
    retainagePercent: 10,
    retainageHeld: 14_444,
    retainageReleased: 0,
    constructionStartDate: daysAgo(88),
    expectedCompletionDate: daysFromNow(60),
    milestones: [
      { id: 'ms-002-01', name: 'Demo Complete',        targetDate: daysAgo(75), actualDate: daysAgo(75), status: 'COMPLETE',    expectedPercentComplete: 10 },
      { id: 'ms-002-02', name: 'Structural Complete',  targetDate: daysAgo(50), actualDate: daysAgo(48), status: 'COMPLETE',    expectedPercentComplete: 40 },
      { id: 'ms-002-03', name: 'Mechanical Complete',  targetDate: daysAgo(20), actualDate: daysAgo(18), status: 'COMPLETE',    expectedPercentComplete: 65 },
      { id: 'ms-002-04', name: 'Interior Finish',      targetDate: daysFromNow(20), actualDate: null,    status: 'IN_PROGRESS', expectedPercentComplete: 92 },
      { id: 'ms-002-05', name: 'Final + Listing Ready',targetDate: daysFromNow(55), actualDate: null,    status: 'PENDING',     expectedPercentComplete: 100 },
    ],
    createdBy: 'admin-user-001',
    createdAt: daysAgo(95),
    updatedAt: daysAgo(2),
    activeRiskFlags: [],
    linkedOrders: [],
  },
  {
    id: 'loan-seed-003',
    tenantId: TENANT_ID,
    type: 'construction-loan',
    loanNumber: 'CL-2026-0007',
    loanType: 'MULTIFAMILY',
    status: 'ACTIVE',
    loanAmount: 1_850_000,
    interestRate: 0.109,
    maturityDate: daysFromNow(450),
    interestReserveAmount: 92_500,
    interestReserveDrawn: 0,
    propertyAddress: { street: '2200 W Alameda Ave', city: 'Denver', state: 'CO', zipCode: '80223', county: 'Denver' },
    propertyType: 'Multifamily (12 Units)',
    asIsValue: 500_000,
    arvEstimate: 2_850_000,
    borrowerId: 'borrower-seed-003',
    borrowerName: 'Alameda Capital Partners',
    generalContractorId: 'con-seed-gc-001',
    budgetId: 'budget-seed-003',
    totalDrawsApproved: 740_000,
    totalDrawsDisbursed: 740_000,
    percentComplete: 40,
    retainagePercent: 10,
    retainageHeld: 82_222,
    retainageReleased: 0,
    constructionStartDate: daysAgo(42),
    expectedCompletionDate: daysFromNow(450),
    milestones: [
      { id: 'ms-003-01', name: 'Site & Foundation',  targetDate: daysAgo(10), actualDate: daysAgo(9), status: 'COMPLETE',    expectedPercentComplete: 30 },
      { id: 'ms-003-02', name: 'Framing Complete',   targetDate: daysFromNow(60),  actualDate: null,   status: 'IN_PROGRESS', expectedPercentComplete: 50 },
      { id: 'ms-003-03', name: 'Dry-In',             targetDate: daysFromNow(120), actualDate: null,   status: 'PENDING',     expectedPercentComplete: 60 },
      { id: 'ms-003-04', name: 'Rough MEP',          targetDate: daysFromNow(200), actualDate: null,   status: 'PENDING',     expectedPercentComplete: 75 },
      { id: 'ms-003-05', name: 'CO Issued',          targetDate: daysFromNow(440), actualDate: null,   status: 'PENDING',     expectedPercentComplete: 100 },
    ],
    createdBy: 'admin-user-001',
    createdAt: daysAgo(50),
    updatedAt: daysAgo(1),
    activeRiskFlags: [],
    linkedOrders: [],
  },
  {
    id: 'loan-seed-004',
    tenantId: TENANT_ID,
    type: 'construction-loan',
    loanNumber: 'CL-2026-0019',
    loanType: 'REHAB',
    status: 'UNDERWRITING',
    loanAmount: 280_000,
    interestRate: 0.119,
    maturityDate: daysFromNow(365),
    interestReserveAmount: 0,
    interestReserveDrawn: 0,
    propertyAddress: { street: '915 S Federal Blvd', city: 'Denver', state: 'CO', zipCode: '80219', county: 'Denver' },
    propertyType: 'Single Family Residential',
    asIsValue: 210_000,
    arvEstimate: 410_000,
    borrowerId: 'borrower-seed-004',
    borrowerName: 'Pinnacle REI Group',
    generalContractorId: 'con-seed-gc-004',
    budgetId: 'budget-seed-004',
    totalDrawsApproved: 0,
    totalDrawsDisbursed: 0,
    percentComplete: 0,
    retainagePercent: 10,
    retainageHeld: 0,
    retainageReleased: 0,
    expectedCompletionDate: daysFromNow(330),
    milestones: [
      { id: 'ms-004-01', name: 'Demo & Site Prep',   targetDate: daysFromNow(14),  actualDate: null, status: 'PENDING', expectedPercentComplete: 10 },
      { id: 'ms-004-02', name: 'Structural Work',    targetDate: daysFromNow(60),  actualDate: null, status: 'PENDING', expectedPercentComplete: 35 },
      { id: 'ms-004-03', name: 'Mechanical Rough',   targetDate: daysFromNow(120), actualDate: null, status: 'PENDING', expectedPercentComplete: 60 },
      { id: 'ms-004-04', name: 'Interior Finish',    targetDate: daysFromNow(280), actualDate: null, status: 'PENDING', expectedPercentComplete: 90 },
      { id: 'ms-004-05', name: 'Final Inspection',   targetDate: daysFromNow(320), actualDate: null, status: 'PENDING', expectedPercentComplete: 100 },
    ],
    createdBy: 'admin-user-001',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
    activeRiskFlags: [],
    linkedOrders: [],
  },
  {
    id: 'loan-seed-005',
    tenantId: TENANT_ID,
    type: 'construction-loan',
    loanNumber: 'CL-2024-0088',
    loanType: 'GROUND_UP',
    status: 'COMPLETED',
    loanAmount: 327_500,
    interestRate: 0.113,
    maturityDate: daysAgo(30),
    interestReserveAmount: 0,
    interestReserveDrawn: 0,
    propertyAddress: { street: '3388 Xanthia Ct', city: 'Denver', state: 'CO', zipCode: '80238', county: 'Denver' },
    propertyType: 'Single Family Residential',
    asIsValue: 55_000,
    arvEstimate: 510_000,
    borrowerId: 'borrower-seed-001',
    borrowerName: 'Marcus & Elena Reyes',
    generalContractorId: 'con-seed-gc-002',
    budgetId: 'budget-seed-005',
    totalDrawsApproved: 327_500,
    totalDrawsDisbursed: 327_500,
    percentComplete: 100,
    retainagePercent: 10,
    retainageHeld: 0,
    retainageReleased: 36_389,
    constructionStartDate: daysAgo(365),
    expectedCompletionDate: daysAgo(40),
    actualCompletionDate: daysAgo(38),
    milestones: [
      { id: 'ms-005-01', name: 'Foundation',        targetDate: daysAgo(320), actualDate: daysAgo(318), status: 'COMPLETE', expectedPercentComplete: 15 },
      { id: 'ms-005-02', name: 'Framing',           targetDate: daysAgo(260), actualDate: daysAgo(258), status: 'COMPLETE', expectedPercentComplete: 35 },
      { id: 'ms-005-03', name: 'Dry-In',            targetDate: daysAgo(220), actualDate: daysAgo(221), status: 'COMPLETE', expectedPercentComplete: 50 },
      { id: 'ms-005-04', name: 'Rough MEP',         targetDate: daysAgo(160), actualDate: daysAgo(155), status: 'COMPLETE', expectedPercentComplete: 70 },
      { id: 'ms-005-05', name: 'Final Inspection',  targetDate: daysAgo(40),  actualDate: daysAgo(38),  status: 'COMPLETE', expectedPercentComplete: 100 },
    ],
    createdBy: 'admin-user-001',
    createdAt: daysAgo(380),
    updatedAt: daysAgo(30),
    activeRiskFlags: [],
    linkedOrders: [],
  },
];

// ─── Draw Requests ─────────────────────────────────────────────────────────────

const draws = [
  // ── Loan 001 (Ground Up, 45% complete) ──────────────────────────────────
  {
    id: 'draw-seed-001-01',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-001',
    budgetId: 'budget-seed-001',
    type: 'draw-request',
    drawNumber: 1,
    status: 'DISBURSED',
    requestedBy: 'borrower-seed-001',
    requestedAt: daysAgo(42),
    requestedAmount: 115_000,
    approvedAmount: 103_500,
    retainageWithheld: 11_500,
    netDisbursementAmount: 103_500,
    lienWaiverStatus: 'VERIFIED',
    titleUpdateRequired: false,
    titleUpdateStatus: 'CLEARED',
    lineItemRequests: [
      { budgetLineItemId: 'li-001-01', category: 'LAND_ACQUISITION', description: 'Land purchase',        requestedAmount: 85_000 },
      { budgetLineItemId: 'li-001-11', category: 'PERMITS_FEES',     description: 'Building permit',      requestedAmount: 8_000  },
      { budgetLineItemId: 'li-001-12', category: 'SOFT_COSTS',       description: 'Architect draw',       requestedAmount: 2_000  },
      { budgetLineItemId: 'li-001-02', category: 'SITE_WORK',        description: 'Site work phase 1',    requestedAmount: 14_000 },
      { budgetLineItemId: 'li-001-02', category: 'SITE_WORK',        description: 'Site work phase 2',    requestedAmount: 6_000  },
    ],
    lineItemResults: [
      { budgetLineItemId: 'li-001-01', requestedAmount: 85_000, approvedAmount: 76_500,  retainageWithheld: 8_500,  netDisbursed: 68_000,  status: 'APPROVED' },
      { budgetLineItemId: 'li-001-11', requestedAmount: 8_000,  approvedAmount: 7_200,   retainageWithheld: 800,    netDisbursed: 6_400,   status: 'APPROVED' },
      { budgetLineItemId: 'li-001-12', requestedAmount: 2_000,  approvedAmount: 1_800,   retainageWithheld: 200,    netDisbursed: 1_600,   status: 'APPROVED' },
      { budgetLineItemId: 'li-001-02', requestedAmount: 14_000, approvedAmount: 11_250,  retainageWithheld: 1_250,  netDisbursed: 10_000,  status: 'REDUCED', reviewerNotes: 'Awaiting final grading cert' },
      { budgetLineItemId: 'li-001-02', requestedAmount: 6_000,  approvedAmount: 5_400,   retainageWithheld: 600,    netDisbursed: 4_800,   status: 'APPROVED' },
    ],
    reviewedBy: 'admin-user-001',
    reviewedAt: daysAgo(39),
    approvedBy: 'admin-user-001',
    approvedAt: daysAgo(38),
    disbursedAt: daysAgo(38),
    disbursementMethod: 'WIRE',
    notes: 'First draw — all land and permit costs verified.',
    createdAt: daysAgo(42),
    updatedAt: daysAgo(38),
  },
  {
    id: 'draw-seed-001-02',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-001',
    budgetId: 'budget-seed-001',
    type: 'draw-request',
    drawNumber: 2,
    status: 'DISBURSED',
    requestedBy: 'borrower-seed-001',
    requestedAt: daysAgo(16),
    requestedAmount: 95_000,
    approvedAmount: 85_500,
    retainageWithheld: 9_500,
    netDisbursementAmount: 76_000,
    lienWaiverStatus: 'VERIFIED',
    titleUpdateRequired: false,
    titleUpdateStatus: 'CLEARED',
    lineItemRequests: [
      { budgetLineItemId: 'li-001-03', category: 'FOUNDATION', description: 'Concrete slab — complete',  requestedAmount: 28_000 },
      { budgetLineItemId: 'li-001-04', category: 'FRAMING',    description: 'Framing 80% complete',      requestedAmount: 44_000 },
      { budgetLineItemId: 'li-001-12', category: 'SOFT_COSTS', description: 'Engineering draw',          requestedAmount: 8_000  },
      { budgetLineItemId: 'li-001-02', category: 'SITE_WORK',  description: 'Final site work',           requestedAmount: 15_000 },
    ],
    lineItemResults: [
      { budgetLineItemId: 'li-001-03', requestedAmount: 28_000, approvedAmount: 25_200, retainageWithheld: 2_800, netDisbursed: 22_400, status: 'APPROVED' },
      { budgetLineItemId: 'li-001-04', requestedAmount: 44_000, approvedAmount: 39_600, retainageWithheld: 4_400, netDisbursed: 35_200, status: 'APPROVED' },
      { budgetLineItemId: 'li-001-12', requestedAmount: 8_000,  approvedAmount: 7_200,  retainageWithheld: 800,   netDisbursed: 6_400,  status: 'APPROVED' },
      { budgetLineItemId: 'li-001-02', requestedAmount: 15_000, approvedAmount: 13_500, retainageWithheld: 1_500, netDisbursed: 12_000, status: 'APPROVED' },
    ],
    reviewedBy: 'admin-user-001',
    reviewedAt: daysAgo(12),
    approvedBy: 'admin-user-001',
    approvedAt: daysAgo(12),
    disbursedAt: daysAgo(11),
    disbursementMethod: 'WIRE',
    notes: 'Inspection confirmed 80% framing. Approved.',
    createdAt: daysAgo(16),
    updatedAt: daysAgo(11),
  },
  {
    id: 'draw-seed-001-03',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-001',
    budgetId: 'budget-seed-001',
    type: 'draw-request',
    drawNumber: 3,
    status: 'UNDER_REVIEW',
    requestedBy: 'borrower-seed-001',
    requestedAt: daysAgo(3),
    requestedAmount: 23_000,
    lienWaiverStatus: 'RECEIVED',
    titleUpdateRequired: false,
    lineItemRequests: [
      { budgetLineItemId: 'li-001-04', category: 'FRAMING',    description: 'Framing final 20%',  requestedAmount: 11_000 },
      { budgetLineItemId: 'li-001-05', category: 'ROOFING',    description: 'Decking only',       requestedAmount: 9_000  },
      { budgetLineItemId: 'li-001-12', category: 'SOFT_COSTS', description: 'Misc soft costs',    requestedAmount: 3_000  },
    ],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
  },

  // ── Loan 002 (Fix & Flip, 88% complete) ─────────────────────────────────
  {
    id: 'draw-seed-002-01',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-002',
    budgetId: 'budget-seed-002',
    type: 'draw-request',
    drawNumber: 1,
    status: 'DISBURSED',
    requestedBy: 'borrower-seed-002',
    requestedAt: daysAgo(67),
    requestedAmount: 80_000,
    approvedAmount: 72_000,
    retainageWithheld: 8_000,
    netDisbursementAmount: 64_000,
    lienWaiverStatus: 'VERIFIED',
    titleUpdateRequired: false,
    titleUpdateStatus: 'CLEARED',
    lineItemRequests: [
      { budgetLineItemId: 'li-002-01', category: 'SITE_WORK',    description: 'Demo complete',         requestedAmount: 12_000 },
      { budgetLineItemId: 'li-002-02', category: 'FOUNDATION',   description: 'Foundation repair',     requestedAmount: 18_000 },
      { budgetLineItemId: 'li-002-03', category: 'FRAMING',      description: 'Structural + addition', requestedAmount: 32_500 },
      { budgetLineItemId: 'li-002-09', category: 'PERMITS_FEES', description: 'Permit fees',           requestedAmount: 4_500  },
      { budgetLineItemId: 'li-002-04', category: 'ROOFING',      description: 'Full re-roof',          requestedAmount: 13_000 },
    ],
    lineItemResults: [
      { budgetLineItemId: 'li-002-01', requestedAmount: 12_000, approvedAmount: 10_800, retainageWithheld: 1_200, netDisbursed: 9_600,  status: 'APPROVED' },
      { budgetLineItemId: 'li-002-02', requestedAmount: 18_000, approvedAmount: 16_200, retainageWithheld: 1_800, netDisbursed: 14_400, status: 'APPROVED' },
      { budgetLineItemId: 'li-002-03', requestedAmount: 32_500, approvedAmount: 29_250, retainageWithheld: 3_250, netDisbursed: 26_000, status: 'APPROVED' },
      { budgetLineItemId: 'li-002-09', requestedAmount: 4_500,  approvedAmount: 4_050,  retainageWithheld: 450,   netDisbursed: 3_600,  status: 'APPROVED' },
      { budgetLineItemId: 'li-002-04', requestedAmount: 13_000, approvedAmount: 11_700, retainageWithheld: 1_300, netDisbursed: 10_400, status: 'REDUCED', reviewerNotes: 'Minor punch list pending' },
    ],
    reviewedBy: 'admin-user-001',
    reviewedAt: daysAgo(63),
    approvedBy: 'admin-user-001',
    approvedAt: daysAgo(62),
    disbursedAt: daysAgo(61),
    disbursementMethod: 'ACH',
    notes: 'First draw approved. Inspector confirmed structural work complete.',
    createdAt: daysAgo(67),
    updatedAt: daysAgo(61),
  },
  {
    id: 'draw-seed-002-02',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-002',
    budgetId: 'budget-seed-002',
    type: 'draw-request',
    drawNumber: 2,
    status: 'DISBURSED',
    requestedBy: 'borrower-seed-002',
    requestedAt: daysAgo(20),
    requestedAmount: 58_000,
    approvedAmount: 58_000,
    retainageWithheld: 6_444,
    netDisbursementAmount: 51_556,
    lienWaiverStatus: 'VERIFIED',
    titleUpdateRequired: false,
    titleUpdateStatus: 'CLEARED',
    lineItemRequests: [
      { budgetLineItemId: 'li-002-05', category: 'PLUMBING',        description: 'Plumbing rough + finish',  requestedAmount: 15_000 },
      { budgetLineItemId: 'li-002-06', category: 'ELECTRICAL',      description: 'Panel + rewire complete',  requestedAmount: 18_000 },
      { budgetLineItemId: 'li-002-07', category: 'INTERIOR_FINISH', description: 'Interior 73% complete',    requestedAmount: 20_500 },
      { budgetLineItemId: 'li-002-04', category: 'ROOFING',         description: 'Punch list close-out',     requestedAmount: 1_400  },
      { budgetLineItemId: 'li-002-03', category: 'FRAMING',         description: 'CO framing adjustment',    requestedAmount: 3_100  },
    ],
    lineItemResults: [
      { budgetLineItemId: 'li-002-05', requestedAmount: 15_000, approvedAmount: 15_000, retainageWithheld: 1_667, netDisbursed: 13_333, status: 'APPROVED' },
      { budgetLineItemId: 'li-002-06', requestedAmount: 18_000, approvedAmount: 18_000, retainageWithheld: 2_000, netDisbursed: 16_000, status: 'APPROVED' },
      { budgetLineItemId: 'li-002-07', requestedAmount: 20_500, approvedAmount: 20_500, retainageWithheld: 2_278, netDisbursed: 18_222, status: 'APPROVED' },
      { budgetLineItemId: 'li-002-04', requestedAmount: 1_400,  approvedAmount: 1_400,  retainageWithheld: 156,   netDisbursed: 1_244,  status: 'APPROVED' },
      { budgetLineItemId: 'li-002-03', requestedAmount: 3_100,  approvedAmount: 3_100,  retainageWithheld: 344,   netDisbursed: 2_756,  status: 'APPROVED' },
    ],
    reviewedBy: 'admin-user-001',
    reviewedAt: daysAgo(16),
    approvedBy: 'admin-user-001',
    approvedAt: daysAgo(15),
    disbursedAt: daysAgo(14),
    disbursementMethod: 'ACH',
    notes: 'Draw 2 fully approved — interior work per inspection at 73%.',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(14),
  },

  // ── Loan 003 (Multifamily, 40% complete) ───────────────────────────────
  {
    id: 'draw-seed-003-01',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-003',
    budgetId: 'budget-seed-003',
    type: 'draw-request',
    drawNumber: 1,
    status: 'DISBURSED',
    requestedBy: 'borrower-seed-003',
    requestedAt: daysAgo(17),
    requestedAmount: 645_000,
    approvedAmount: 580_500,
    retainageWithheld: 64_500,
    netDisbursementAmount: 516_000,
    lienWaiverStatus: 'VERIFIED',
    titleUpdateRequired: false,
    titleUpdateStatus: 'CLEARED',
    lineItemRequests: [
      { budgetLineItemId: 'li-003-01', category: 'LAND_ACQUISITION', description: 'Land purchase',       requestedAmount: 380_000 },
      { budgetLineItemId: 'li-003-02', category: 'SITE_WORK',        description: 'Site work complete',  requestedAmount: 85_000  },
      { budgetLineItemId: 'li-003-03', category: 'FOUNDATION',       description: 'Foundation complete', requestedAmount: 180_000 },
    ],
    lineItemResults: [
      { budgetLineItemId: 'li-003-01', requestedAmount: 380_000, approvedAmount: 342_000, retainageWithheld: 38_000, netDisbursed: 304_000, status: 'APPROVED' },
      { budgetLineItemId: 'li-003-02', requestedAmount: 85_000,  approvedAmount: 76_500,  retainageWithheld: 8_500,  netDisbursed: 68_000,  status: 'APPROVED' },
      { budgetLineItemId: 'li-003-03', requestedAmount: 180_000, approvedAmount: 162_000, retainageWithheld: 18_000, netDisbursed: 144_000, status: 'APPROVED' },
    ],
    reviewedBy: 'admin-user-001',
    reviewedAt: daysAgo(12),
    approvedBy: 'admin-user-001',
    approvedAt: daysAgo(11),
    disbursedAt: daysAgo(10),
    disbursementMethod: 'WIRE',
    notes: 'First draw — land + site + foundation. All inspected and verified.',
    createdAt: daysAgo(17),
    updatedAt: daysAgo(10),
  },
  {
    id: 'draw-seed-003-02',
    tenantId: TENANT_ID,
    constructionLoanId: 'loan-seed-003',
    budgetId: 'budget-seed-003',
    type: 'draw-request',
    drawNumber: 2,
    status: 'INSPECTION_ORDERED',
    requestedBy: 'borrower-seed-003',
    requestedAt: daysAgo(4),
    requestedAmount: 176_000,
    lienWaiverStatus: 'PENDING',
    titleUpdateRequired: true,
    lineItemRequests: [
      { budgetLineItemId: 'li-003-04', category: 'FRAMING',    description: 'Framing 40% complete — 12 units',  requestedAmount: 95_000 },
      { budgetLineItemId: 'li-003-05', category: 'PLUMBING',   description: 'Rough plumbing started',           requestedAmount: 48_000 },
      { budgetLineItemId: 'li-003-06', category: 'ELECTRICAL', description: 'Rough electrical started',         requestedAmount: 33_000 },
    ],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(3),
  },
];

// ─── Seed function ─────────────────────────────────────────────────────────────

async function seedConstructionData(): Promise<void> {
  logger.info('🌱 Initializing Cosmos DB...');
  await cosmosDb.initialize();

  const loansContainer    = (cosmosDb as any)['constructionLoansContainer'];
  const drawsContainer    = (cosmosDb as any)['drawsContainer'];
  const contractorsContainer = (cosmosDb as any)['contractorsContainer'];

  if (!loansContainer)    throw new Error('constructionLoansContainer not initialized — check COSMOS_ENDPOINT and container names');
  if (!drawsContainer)    throw new Error('drawsContainer not initialized');
  if (!contractorsContainer) throw new Error('contractorsContainer not initialized');

  let totalOk = 0;
  let totalErr = 0;

  // 1. Contractors
  logger.info('');
  logger.info('🔨 Seeding Contractors...');
  for (const c of contractors) {
    try {
      await contractorsContainer.items.upsert(c);
      logger.info(`  ✅ ${c.name} [${c.riskTier}]`);
      totalOk++;
    } catch (e: any) {
      logger.error(`  ❌ ${c.name}: ${e.message || e}`);
      totalErr++;
    }
  }

  // 2. Tenant Config
  logger.info('');
  logger.info('⚙️  Seeding Tenant Construction Config...');
  try {
    await loansContainer.items.upsert(tenantConfig);
    logger.info(`  ✅ TenantConstructionConfig [${TENANT_ID}]`);
    totalOk++;
  } catch (e: any) {
    logger.error(`  ❌ TenantConstructionConfig: ${e.message || e}`);
    totalErr++;
  }

  // 3. Budgets (before loans so foreign-key-style reference is present)
  logger.info('');
  logger.info('📋 Seeding Construction Budgets...');
  for (const b of budgets) {
    try {
      await loansContainer.items.upsert(b);
      logger.info(`  ✅ Budget ${b.id} → loan ${b.constructionLoanId} [v${b.version} ${b.status}]`);
      totalOk++;
    } catch (e: any) {
      logger.error(`  ❌ Budget ${b.id}: ${e.message || e}`);
      totalErr++;
    }
  }

  // 4. Loans
  logger.info('');
  logger.info('🏗️  Seeding Construction Loans...');
  for (const l of loans) {
    try {
      await loansContainer.items.upsert(l);
      logger.info(`  ✅ ${l.loanNumber} [${l.status}] — ${(l as any).propertyAddress.street}, ${(l as any).propertyAddress.city}`);
      totalOk++;
    } catch (e: any) {
      logger.error(`  ❌ ${l.loanNumber}: ${e.message || e}`);
      totalErr++;
    }
  }

  // 5. Draw Requests
  logger.info('');
  logger.info('💰 Seeding Draw Requests...');
  for (const d of draws) {
    try {
      await drawsContainer.items.upsert(d);
      logger.info(`  ✅ Draw #${d.drawNumber} for loan ${d.constructionLoanId} [${d.status}] — $${(d.requestedAmount ?? 0).toLocaleString()}`);
      totalOk++;
    } catch (e: any) {
      logger.error(`  ❌ Draw ${d.id}: ${e.message || e}`);
      totalErr++;
    }
  }

  logger.info('');
  logger.info('📊 Seeding Summary:');
  logger.info(`   Contractors:   ${contractors.length}`);
  logger.info(`   Loans:         ${loans.length}  (3 ACTIVE, 1 UNDERWRITING, 1 COMPLETED)`);
  logger.info(`   Budgets:       ${budgets.length}`);
  logger.info(`   Draw Requests: ${draws.length}`);
  logger.info(`   ✅ Success: ${totalOk}   ❌ Errors: ${totalErr}`);
  logger.info('');
  logger.info('📋 Test at: http://localhost:3010/construction');
}

seedConstructionData()
  .then(() => {
    logger.info('✅ Construction seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  });
