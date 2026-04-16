/**
 * Seed Module: Engagements
 *
 * Seeds Engagement documents across the full product spectrum including
 * FULL_APPRAISAL, BPO, DRIVE_BY, HYBRID, and PORTFOLIO engagements.
 *
 * Container: "engagements"  (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, daysFromNow } from '../seed-types.js';
import {
  CLIENT_IDS,
  SUB_CLIENT_SLUGS,
  ORDER_IDS,
  APPRAISER_IDS,
  ENGAGEMENT_IDS,
} from '../seed-ids.js';

const CONTAINER = 'engagements';

function buildEngagements(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    // ── ENG-001: SINGLE Full Appraisal — IN_PROGRESS ──────────────────────
    {
      id: ENGAGEMENT_IDS.SINGLE_FULL_APPRAISAL_001,
      engagementNumber: 'SEED-ENG-2026-00201',
      tenantId,
      engagementType: 'SINGLE',
      loansStoredExternally: false,
      clientId,
      subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON],
      clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      client: {
        clientId: CLIENT_IDS.FIRST_HORIZON,
        clientName: 'First Horizon Bank',
        loanOfficer: 'David Chen',
        loanOfficerEmail: 'david.chen@firsthorizon.com',
        loanOfficerPhone: '901-555-0180',
      },
      loans: [
        {
          id: 'seed-loan-eng001-001',
          loanNumber: 'FH-2026-88201',
          borrowerName: 'Marcus & Linda Okonkwo',
          borrowerEmail: 'mokonkwo@email.com',
          loanType: 'Conventional',
          property: {
            address: '4812 Mockingbird Ln',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75209',
            county: 'Dallas',
            propertyType: 'Single Family',
            bedrooms: 4,
            bathrooms: 2.5,
            squareFootage: 2650,
            yearBuilt: 1998,
            coordinates: { latitude: 32.8312, longitude: -96.8187 },
          },
          status: 'IN_PROGRESS',
          products: [
            {
              id: 'seed-prod-eng001-001',
              productType: 'FULL_APPRAISAL',
              status: 'IN_PROGRESS',
              instructions: 'Standard 1004 — purchase transaction.',
              fee: 650,
              dueDate: daysFromNow(5),
              vendorOrderIds: [ORDER_IDS.IN_PROGRESS_003],
            },
          ],
        },
      ],
      status: 'IN_PROGRESS',
      priority: 'STANDARD',
      receivedAt: daysAgo(6),
      clientDueDate: daysFromNow(5),
      internalDueDate: daysFromNow(3),
      totalEngagementFee: 650,
      engagementInstructions: 'Purchase transaction, subject is occupied. Buyer is relocating for work.',
      createdAt: daysAgo(6),
      createdBy: 'seed-user-coordinator-001',
      updatedAt: daysAgo(1),
    },

    // ── ENG-002: SINGLE BPO — ACCEPTED (awaiting site visit) ──────────────
    {
      id: ENGAGEMENT_IDS.SINGLE_BPO_002,
      engagementNumber: 'SEED-ENG-2026-00202',
      tenantId,
      engagementType: 'SINGLE',
      loansStoredExternally: false,
      clientId,
      subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.PACIFIC_COAST],
      clientRecordId: CLIENT_IDS.PACIFIC_COAST,
      client: {
        clientId: CLIENT_IDS.PACIFIC_COAST,
        clientName: 'Pacific Coast Lending',
        loanOfficer: 'Priya Nair',
        loanOfficerEmail: 'priya.nair@pacificcoast.com',
        loanOfficerPhone: '503-555-0144',
      },
      loans: [
        {
          id: 'seed-loan-eng002-001',
          loanNumber: 'PCL-2026-55030',
          borrowerName: 'Thomas Whitfield',
          borrowerEmail: 'twhitfield@email.com',
          loanType: 'FHA',
          property: {
            address: '2207 Swiss Ave',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75204',
            county: 'Dallas',
            propertyType: 'Single Family',
            bedrooms: 3,
            bathrooms: 2,
            squareFootage: 1820,
            yearBuilt: 1945,
            coordinates: { latitude: 32.7942, longitude: -96.7711 },
          },
          status: 'IN_PROGRESS',
          products: [
            {
              id: 'seed-prod-eng002-001',
              productType: 'BPO',
              status: 'ASSIGNED',
              instructions: 'Interior + exterior BPO. Distressed sale — confirm condition.',
              fee: 175,
              dueDate: daysFromNow(3),
              vendorOrderIds: [ORDER_IDS.ACCEPTED_008],
            },
          ],
        },
      ],
      status: 'IN_PROGRESS',
      priority: 'RUSH',
      receivedAt: daysAgo(2),
      clientDueDate: daysFromNow(3),
      internalDueDate: daysFromNow(2),
      totalEngagementFee: 175,
      engagementInstructions: 'Rush BPO for default servicing. Property may have deferred maintenance — document all condition issues with photos.',
      createdAt: daysAgo(2),
      createdBy: 'seed-user-coordinator-001',
      updatedAt: daysAgo(1),
    },

    // ── ENG-003: PORTFOLIO — 2 loans, BPO + Drive-By — IN_PROGRESS ────────
    {
      id: ENGAGEMENT_IDS.PORTFOLIO_BPO_DRIVEBY_003,
      engagementNumber: 'SEED-ENG-2026-00203',
      tenantId,
      engagementType: 'PORTFOLIO',
      loansStoredExternally: false,
      clientId,
      subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.NATIONAL_AMC],
      clientRecordId: CLIENT_IDS.NATIONAL_AMC,
      client: {
        clientId: CLIENT_IDS.NATIONAL_AMC,
        clientName: 'National AMC',
        loanOfficer: 'Sandra Cho',
        loanOfficerEmail: 's.cho@nationalamc.com',
        loanOfficerPhone: '404-555-0212',
      },
      loans: [
        // Loan A — BPO
        {
          id: 'seed-loan-eng003-001',
          loanNumber: 'NAMC-2026-77041',
          borrowerName: 'George & Beverly Stanton',
          loanType: 'Conventional',
          property: {
            address: '1547 Lamar St',
            city: 'Fort Worth',
            state: 'TX',
            zipCode: '76102',
            county: 'Tarrant',
            propertyType: 'Single Family',
            bedrooms: 3,
            bathrooms: 1.5,
            squareFootage: 1450,
            yearBuilt: 1972,
            coordinates: { latitude: 32.7484, longitude: -97.3308 },
          },
          status: 'IN_PROGRESS',
          products: [
            {
              id: 'seed-prod-eng003-001',
              productType: 'BPO',
              status: 'IN_PROGRESS',
              instructions: 'Exterior BPO only. REO listing — no occupant access.',
              fee: 125,
              dueDate: daysFromNow(2),
              vendorOrderIds: [],
            },
          ],
        },
        // Loan B — Drive-By
        {
          id: 'seed-loan-eng003-002',
          loanNumber: 'NAMC-2026-77042',
          borrowerName: 'Hector Delgado',
          loanType: 'VA',
          property: {
            address: '3301 Greenville Ave',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75206',
            county: 'Dallas',
            propertyType: 'Single Family',
            bedrooms: 3,
            bathrooms: 2,
            squareFootage: 1680,
            yearBuilt: 1963,
            coordinates: { latitude: 32.8081, longitude: -96.7743 },
          },
          status: 'PENDING',
          products: [
            {
              id: 'seed-prod-eng003-002',
              productType: 'DRIVE_BY',
              status: 'PENDING',
              instructions: 'VA certificate of eligibility confirmed. No interior access needed.',
              fee: 250,
              dueDate: daysFromNow(7),
              vendorOrderIds: [],
            },
          ],
        },
      ],
      status: 'IN_PROGRESS',
      priority: 'STANDARD',
      receivedAt: daysAgo(3),
      clientDueDate: daysFromNow(7),
      internalDueDate: daysFromNow(5),
      totalEngagementFee: 375,
      specialInstructions: 'Portfolio of 2 loans — assign BPO immediately, Drive-By can follow within 5 days.',
      createdAt: daysAgo(3),
      createdBy: 'seed-user-coordinator-001',
      updatedAt: daysAgo(1),
    },

    // ── ENG-004: SINGLE Full Appraisal — DELIVERED (completed) ────────────
    {
      id: ENGAGEMENT_IDS.SINGLE_DELIVERED_004,
      engagementNumber: 'SEED-ENG-2026-00204',
      tenantId,
      engagementType: 'SINGLE',
      loansStoredExternally: false,
      clientId,
      subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON],
      clientRecordId: CLIENT_IDS.FIRST_HORIZON,
      client: {
        clientId: CLIENT_IDS.FIRST_HORIZON,
        clientName: 'First Horizon Bank',
        loanOfficer: 'Karen Hoffmeister',
        loanOfficerEmail: 'k.hoffmeister@firsthorizon.com',
        loanOfficerPhone: '901-555-0191',
      },
      loans: [
        {
          id: 'seed-loan-eng004-001',
          loanNumber: 'FH-2026-88001',
          borrowerName: 'Sarah Johnson',
          borrowerEmail: 's.johnson@email.com',
          loanType: 'Conventional',
          property: {
            address: '5432 Mockingbird Ln',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75206',
            county: 'Dallas',
            propertyType: 'Single Family',
            bedrooms: 3,
            bathrooms: 2,
            squareFootage: 1850,
            yearBuilt: 1978,
            coordinates: { latitude: 32.8312, longitude: -96.7987 },
          },
          status: 'DELIVERED',
          products: [
            {
              id: 'seed-prod-eng004-001',
              productType: 'FULL_APPRAISAL',
              status: 'COMPLETED',
              instructions: 'Standard 1004 — refinance transaction.',
              fee: 500,
              dueDate: daysAgo(5),
              vendorOrderIds: [ORDER_IDS.COMPLETED_001],
            },
          ],
        },
      ],
      status: 'DELIVERED',
      priority: 'STANDARD',
      receivedAt: daysAgo(30),
      clientDueDate: daysAgo(5),
      internalDueDate: daysAgo(7),
      closedAt: daysAgo(5),
      totalEngagementFee: 500,
      createdAt: daysAgo(30),
      createdBy: 'seed-user-coordinator-001',
      updatedAt: daysAgo(5),
    },

    // ── ENG-005: SINGLE Hybrid (inspector + desk appraiser) — QC ──────────
    {
      id: ENGAGEMENT_IDS.SINGLE_HYBRID_005,
      engagementNumber: 'SEED-ENG-2026-00205',
      tenantId,
      engagementType: 'SINGLE',
      loansStoredExternally: false,
      clientId,
      subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH],
      clientRecordId: CLIENT_IDS.CLEARPATH,
      client: {
        clientId: CLIENT_IDS.CLEARPATH,
        clientName: 'ClearPath AMC',
        loanOfficer: 'James Sutton',
        loanOfficerEmail: 'j.sutton@clearpathamc.com',
        loanOfficerPhone: '602-555-0108',
      },
      loans: [
        {
          id: 'seed-loan-eng005-001',
          loanNumber: 'CP-2026-33217',
          borrowerName: 'Ryan & Sylvia Park',
          loanType: 'Conventional',
          property: {
            address: '5820 Main St',
            city: 'Boulder',
            state: 'CO',
            zipCode: '80302',
            county: 'Boulder',
            propertyType: 'Single Family',
            bedrooms: 4,
            bathrooms: 3,
            squareFootage: 2980,
            yearBuilt: 1995,
            coordinates: { latitude: 40.0150, longitude: -105.2705 },
          },
          status: 'QC',
          products: [
            {
              id: 'seed-prod-eng005-001',
              productType: 'HYBRID',
              status: 'DELIVERED',
              instructions: 'Hybrid — 3rd-party inspector collects data; desk appraiser completes UAD form.',
              fee: 550,
              dueDate: daysFromNow(1),
              vendorOrderIds: [ORDER_IDS.SUBMITTED_009],
            },
          ],
        },
      ],
      status: 'QC',
      priority: 'STANDARD',
      receivedAt: daysAgo(12),
      clientDueDate: daysFromNow(1),
      internalDueDate: daysAgo(1),
      totalEngagementFee: 550,
      engagementInstructions: 'Hybrid workflow — Inspector ID: seed-appraiser-003.',
      createdAt: daysAgo(12),
      createdBy: 'seed-user-coordinator-001',
      updatedAt: daysAgo(1),
    },
  ];
}

export const module: SeedModule = {
  name: 'engagements',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const eng of buildEngagements(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, CONTAINER, eng, result);
    }

    return result;
  },
};
