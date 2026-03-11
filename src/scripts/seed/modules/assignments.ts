/**
 * Seed Module: Assignments (vendor assignment + negotiation records)
 *
 * Seeds assignment records in the `orders` container (appraiser_assignment type)
 * and negotiation records in the `negotiations` container.
 * Includes flat negotiations (simple accept/decline) and round-based negotiations
 * with multi-round counter-offer workflows.
 * Containers: negotiations (partition /tenantId), orders (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo, hoursAgo, daysFromNow } from '../seed-types.js';
import { ORDER_IDS, VENDOR_IDS, APPRAISER_IDS, NEGOTIATION_IDS } from '../seed-ids.js';

const CONTAINER = 'negotiations';

function buildNegotiations(tenantId: string): Record<string, unknown>[] {
  return [
    // Order 001 — accepted immediately, no counter
    {
      id: `seed-negotiation-001`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.COMPLETED_001,
      vendorId: VENDOR_IDS.PREMIER,
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      status: 'ACCEPTED',
      offeredFee: 375, counterFee: null, finalFee: 375,
      offeredAt: daysAgo(28), respondedAt: daysAgo(28),
      turnaroundDaysOffered: 10, turnaroundDaysAccepted: 10,
      notes: 'Vendor accepted standard rate immediately.',
      createdAt: daysAgo(28), updatedAt: daysAgo(28),
    },
    // Order 003 — rush negotiation, fee bumped
    {
      id: `seed-negotiation-002`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      vendorId: VENDOR_IDS.TX_PROPERTY,
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR,
      status: 'ACCEPTED',
      offeredFee: 450, counterFee: 500, finalFee: 500,
      offeredAt: daysAgo(6), respondedAt: daysAgo(6),
      turnaroundDaysOffered: 4, turnaroundDaysAccepted: 5,
      notes: 'Rush order — vendor countered at $500 due to compressed timeline.',
      createdAt: daysAgo(6), updatedAt: daysAgo(6),
    },
    // Order 007 — assigned, no response yet
    {
      id: `seed-negotiation-003`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.ASSIGNED_007,
      vendorId: VENDOR_IDS.NVN,
      status: 'PENDING',
      offeredFee: 250, counterFee: null, finalFee: null,
      offeredAt: daysAgo(1), respondedAt: null,
      turnaroundDaysOffered: 7, turnaroundDaysAccepted: null,
      notes: 'Awaiting vendor response.',
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    // Order 004 — RFB sent to multiple, all declined so far
    {
      id: `seed-negotiation-004`,
      tenantId, type: 'negotiation',
      orderId: ORDER_IDS.PENDING_004,
      vendorId: VENDOR_IDS.PREMIER,
      status: 'DECLINED',
      offeredFee: 375, counterFee: null, finalFee: null,
      offeredAt: daysAgo(2), respondedAt: daysAgo(1),
      turnaroundDaysOffered: 10, turnaroundDaysAccepted: null,
      declineReason: 'Outside service area for condos in this zip code.',
      createdAt: daysAgo(2), updatedAt: daysAgo(1),
    },
  ];
}

// ─── Round-based negotiations (multi-round counter-offer workflows) ───────────

function buildRoundNegotiations(tenantId: string): Record<string, unknown>[] {
  return [
    // ACCEPTED — direct accept, 1 round
    {
      id: NEGOTIATION_IDS.ACCEPTED_DIRECT, tenantId, type: 'negotiation',
      orderId: ORDER_IDS.ASSIGNED_007,
      vendorId: VENDOR_IDS.PREMIER,
      clientId: 'client-first-national',
      status: 'ACCEPTED',
      originalTerms: { fee: 575, dueDate: daysFromNow(5), rushFee: false, specialInstructions: '' },
      currentTerms: { fee: 575, dueDate: daysFromNow(5), additionalConditions: [] },
      rounds: [
        { roundNumber: 1, timestamp: hoursAgo(46), actor: 'VENDOR', action: 'ACCEPT', proposedTerms: { fee: 575, dueDate: daysFromNow(5), notes: 'Order accepted' } },
      ],
      maxRounds: 3,
      expirationTime: hoursAgo(44),
      decidedAt: hoursAgo(46), decidedBy: VENDOR_IDS.PREMIER,
      createdAt: hoursAgo(48), updatedAt: hoursAgo(46),
    },
    // ACCEPTED — 3-round counter-offer ($600 → vendor counters $650 → client counters $625 → vendor accepts)
    {
      id: NEGOTIATION_IDS.ACCEPTED_COUNTERED, tenantId, type: 'negotiation',
      orderId: ORDER_IDS.SUBMITTED_009,
      vendorId: VENDOR_IDS.TX_PROPERTY,
      clientId: 'client-summit-lending',
      status: 'ACCEPTED',
      originalTerms: { fee: 600, dueDate: daysFromNow(7), rushFee: false, specialInstructions: '' },
      currentTerms: { fee: 625, dueDate: daysFromNow(7), additionalConditions: ['Additional comp research'], vendorNotes: 'Complex property requires additional comp research' },
      rounds: [
        { roundNumber: 1, timestamp: hoursAgo(24), actor: 'VENDOR', action: 'COUNTER', proposedTerms: { fee: 650, dueDate: daysFromNow(7), notes: 'Complex property requires additional comp research' } },
        { roundNumber: 2, timestamp: hoursAgo(22), actor: 'CLIENT', action: 'COUNTER', proposedTerms: { fee: 625, dueDate: daysFromNow(7), notes: 'Will meet halfway at $625' } },
        { roundNumber: 3, timestamp: hoursAgo(20), actor: 'VENDOR', action: 'ACCEPT', proposedTerms: { fee: 625, dueDate: daysFromNow(7), notes: 'Agreed at $625' } },
      ],
      maxRounds: 3,
      expirationTime: hoursAgo(18),
      autoAcceptThreshold: { maxFeeDelta: 5, maxDateDelta: 2 },
      decidedAt: hoursAgo(20), decidedBy: VENDOR_IDS.TX_PROPERTY,
      createdAt: hoursAgo(24), updatedAt: hoursAgo(20),
    },
    // REJECTED — vendor declined after 1 round
    {
      id: NEGOTIATION_IDS.REJECTED, tenantId, type: 'negotiation',
      orderId: ORDER_IDS.PENDING_004,
      vendorId: VENDOR_IDS.NVN,
      clientId: 'client-rocky-credit',
      status: 'REJECTED',
      originalTerms: { fee: 650, dueDate: daysFromNow(10), rushFee: false, specialInstructions: '' },
      currentTerms: { fee: 650, dueDate: daysFromNow(10), additionalConditions: [], vendorNotes: 'Schedule conflict — already committed on that date' },
      rounds: [
        { roundNumber: 1, timestamp: hoursAgo(4), actor: 'VENDOR', action: 'REJECT', proposedTerms: { fee: 650, dueDate: daysFromNow(10), notes: 'Schedule conflict' }, reason: 'Schedule conflict — already committed on that date' },
      ],
      maxRounds: 3,
      expirationTime: hoursAgo(2),
      decidedAt: hoursAgo(4), decidedBy: VENDOR_IDS.NVN,
      createdAt: hoursAgo(6), updatedAt: hoursAgo(4),
    },
    // VENDOR_COUNTERED — active negotiation, awaiting client response
    {
      id: NEGOTIATION_IDS.ACTIVE_COUNTER, tenantId, type: 'negotiation',
      orderId: ORDER_IDS.REVISION_010,
      vendorId: VENDOR_IDS.PREMIER,
      clientId: 'client-alpine-mortgage',
      status: 'VENDOR_COUNTERED',
      originalTerms: { fee: 500, dueDate: daysFromNow(14), rushFee: false, specialInstructions: '' },
      currentTerms: { fee: 575, dueDate: daysFromNow(14), additionalConditions: ['Mileage surcharge'], vendorNotes: 'Rural property — additional mileage and comparable difficulty' },
      rounds: [
        { roundNumber: 1, timestamp: hoursAgo(1), actor: 'VENDOR', action: 'COUNTER', proposedTerms: { fee: 575, dueDate: daysFromNow(14), notes: 'Rural property — additional mileage and comparable difficulty' } },
      ],
      maxRounds: 3,
      expirationTime: daysFromNow(1),
      autoAcceptThreshold: { maxFeeDelta: 5, maxDateDelta: 2 },
      createdAt: hoursAgo(2), updatedAt: hoursAgo(1),
    },
  ];
}

// ─── Appraiser assignment records (orders container, type: appraiser_assignment) ─

function buildAssignments(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: 'seed-assignment-accepted-001', tenantId, type: 'appraiser_assignment',
      orderId: ORDER_IDS.ASSIGNED_007, orderNumber: 'APR-2026-AS01',
      appraiserId: APPRAISER_IDS.ANGELA_REEVES_CA,
      assignedAt: hoursAgo(48), assignedBy: VENDOR_IDS.PREMIER,
      acceptedAt: hoursAgo(46), status: 'accepted',
      propertyAddress: '100 Maple Drive, Fort Collins, CO 80521',
      propertyLat: 40.5853, propertyLng: -105.0844,
      proposedFee: 575, agreedFee: 575,
      slaDeadline: daysFromNow(5), slaStartedAt: hoursAgo(46),
      negotiationId: NEGOTIATION_IDS.ACCEPTED_DIRECT,
      estimatedCompletionDate: daysFromNow(5),
      createdAt: hoursAgo(48), updatedAt: hoursAgo(46),
    },
    {
      id: 'seed-assignment-accepted-002', tenantId, type: 'appraiser_assignment',
      orderId: ORDER_IDS.SUBMITTED_009, orderNumber: 'APR-2026-AS02',
      appraiserId: APPRAISER_IDS.BRIAN_KOWALSKI_CA,
      assignedAt: hoursAgo(24), assignedBy: VENDOR_IDS.TX_PROPERTY,
      acceptedAt: hoursAgo(20), status: 'accepted',
      propertyAddress: '500 Mountain Rd, Colorado Springs, CO 80903',
      propertyLat: 38.8339, propertyLng: -104.8214,
      proposedFee: 600, agreedFee: 625,
      counterOfferFee: 650, counterOfferNotes: 'Complex property requires additional comp research',
      slaDeadline: daysFromNow(7), slaStartedAt: hoursAgo(20),
      negotiationId: NEGOTIATION_IDS.ACCEPTED_COUNTERED,
      estimatedCompletionDate: daysFromNow(7),
      createdAt: hoursAgo(24), updatedAt: hoursAgo(20),
    },
    {
      id: 'seed-assignment-declined-001', tenantId, type: 'appraiser_assignment',
      orderId: ORDER_IDS.PENDING_004, orderNumber: 'APR-2026-PA03',
      appraiserId: APPRAISER_IDS.CARMEN_DELGADO_TX,
      assignedAt: hoursAgo(6), assignedBy: VENDOR_IDS.NVN,
      declinedAt: hoursAgo(4), declineReason: 'Schedule conflict — already committed on that date',
      status: 'declined',
      propertyAddress: '221B Baker Street, Boulder, CO 80301',
      propertyLat: 40.0150, propertyLng: -105.2705,
      proposedFee: 650,
      negotiationId: NEGOTIATION_IDS.REJECTED,
      createdAt: hoursAgo(6), updatedAt: hoursAgo(4),
    },
    {
      id: 'seed-assignment-pending-counter-001', tenantId, type: 'appraiser_assignment',
      orderId: ORDER_IDS.REVISION_010, orderNumber: 'APR-2026-PA04',
      appraiserId: APPRAISER_IDS.DANIEL_PARK_TX,
      assignedAt: hoursAgo(2), assignedBy: VENDOR_IDS.PREMIER,
      status: 'pending',
      propertyAddress: '350 Fifth Avenue, Lakewood, CO 80226',
      propertyLat: 39.7047, propertyLng: -105.0814,
      proposedFee: 500,
      counterOfferFee: 575, counterOfferNotes: 'Rural property — additional mileage and comparable difficulty',
      negotiationId: NEGOTIATION_IDS.ACTIVE_COUNTER,
      createdAt: hoursAgo(2), updatedAt: hoursAgo(1),
    },
  ];
}

export const module: SeedModule = {
  name: 'assignments',
  containers: [CONTAINER, 'orders'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    // Flat negotiations (simple accept/decline)
    for (const neg of buildNegotiations(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, neg, result);
    }

    // Round-based negotiations (multi-round counter-offer workflows)
    for (const neg of buildRoundNegotiations(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, neg, result);
    }

    // Appraiser assignment records (in orders container)
    for (const assignment of buildAssignments(ctx.tenantId)) {
      await upsert(ctx, 'orders', assignment, result);
    }

    return result;
  },
};
