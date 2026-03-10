/**
 * Seed Module: Inspections
 *
 * Seeds InspectionAppointment documents in the `orders` container
 * (type: 'inspection'). Covers property inspections, appraisal appointments,
 * and BPO site visits across a range of lifecycle statuses.
 *
 * Container: "orders"  (partition key varies — stored under status field per service)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, daysAgo, daysFromNow, hoursAgo } from '../seed-types.js';
import {
  ORDER_IDS,
  ORDER_NUMBERS,
  APPRAISER_IDS,
  INSPECTION_IDS,
} from '../seed-ids.js';

const CONTAINER = 'orders';

const TZ = 'America/Chicago';

function buildInspections(tenantId: string): Record<string, unknown>[] {
  return [
    // ── INS-001: Completed property inspection (Order 001) ────────────────
    {
      id: INSPECTION_IDS.COMPLETED_ORDER_001,
      type: 'inspection',
      appointmentType: 'property_inspection',
      tenantId,
      orderId: ORDER_IDS.COMPLETED_001,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_001],
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      appraiserName: 'Michael Thompson',
      appraiserPhone: '214-555-0101',
      propertyAddress: '4812 Mockingbird Ln, Dallas TX 75209',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Marcus Okonkwo',
        contactPhone: '214-555-0350',
        contactEmail: 'mokonkwo@email.com',
        accessInstructions: 'Key under mat on front porch. Dogs kept in backyard.',
        requiresEscort: false,
      },
      status: 'completed',
      scheduledSlot: {
        date: daysAgo(25).slice(0, 10),
        startTime: '10:00',
        endTime: '11:30',
        timezone: TZ,
      },
      requestedBy: 'system',
      requestedAt: daysAgo(27),
      confirmedAt: daysAgo(26),
      confirmedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      startedAt: daysAgo(25),
      completedAt: daysAgo(25),
      durationMinutes: 95,
      inspectionNotes: 'Property in excellent condition. Kitchen recently updated.',
      photoCount: 42,
      createdAt: daysAgo(27),
      updatedAt: daysAgo(25),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-002: In-progress property inspection (Order 003) ─────────────
    {
      id: INSPECTION_IDS.IN_PROGRESS_ORDER_003,
      type: 'inspection',
      appointmentType: 'property_inspection',
      tenantId,
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      appraiserId: APPRAISER_IDS.KEVIN_OKAFOR,
      appraiserName: 'Kevin Okafor',
      appraiserPhone: '214-555-0303',
      propertyAddress: '2207 Swiss Ave, Dallas TX 75204',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Linda Chen',
        contactPhone: '214-555-0408',
        accessInstructions: 'Front door lockbox — code 4821.',
        requiresEscort: false,
        parkingInstructions: 'Street parking available on Swiss Ave.',
      },
      status: 'in_progress',
      scheduledSlot: {
        date: hoursAgo(2).slice(0, 10),
        startTime: hoursAgo(2).slice(11, 16),
        endTime: hoursAgo(0).slice(11, 16),
        timezone: TZ,
      },
      requestedBy: 'system',
      requestedAt: daysAgo(5),
      confirmedAt: daysAgo(4),
      confirmedBy: APPRAISER_IDS.KEVIN_OKAFOR,
      startedAt: hoursAgo(2),
      inspectionNotes: 'Rush order — appraiser to document any deferred maintenance.',
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(2),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-003: Scheduled + confirmed inspection (Order 008) ─────────────
    {
      id: INSPECTION_IDS.SCHEDULED_ORDER_008,
      type: 'inspection',
      appointmentType: 'property_inspection',
      tenantId,
      orderId: ORDER_IDS.ACCEPTED_008,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ACCEPTED_008],
      appraiserId: APPRAISER_IDS.PATRICIA_NGUYEN,
      appraiserName: 'Patricia Nguyen',
      appraiserPhone: '214-555-0202',
      propertyAddress: '3301 Greenville Ave, Dallas TX 75206',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Robert Kim',
        contactPhone: '972-555-0521',
        contactEmail: 'r.kim@email.com',
        accessInstructions: 'Occupied — call 30 min before arrival.',
        requiresEscort: true,
        petWarning: 'Large dog — will be kenneled day of inspection.',
      },
      status: 'confirmed',
      scheduledSlot: {
        date: daysFromNow(1).slice(0, 10),
        startTime: '09:00',
        endTime: '10:30',
        timezone: TZ,
      },
      requestedBy: 'system',
      requestedAt: daysAgo(2),
      confirmedAt: daysAgo(1),
      confirmedBy: APPRAISER_IDS.PATRICIA_NGUYEN,
      inspectionNotes: 'Standard purchase appraisal. Subject is owner-occupied.',
      reminderSentAt: daysAgo(1),
      confirmationEmailSentAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-004: BPO site visit — scheduled (Engagement ENG-002) ─────────
    {
      id: INSPECTION_IDS.BPO_SITE_VISIT_004,
      type: 'inspection',
      appointmentType: 'bpo_site_visit',
      tenantId,
      orderId: ORDER_IDS.ACCEPTED_008,   // BPO fulfillment order
      orderNumber: ORDER_NUMBERS[ORDER_IDS.ACCEPTED_008],
      appraiserId: APPRAISER_IDS.ANGELA_REEVES_CA,
      appraiserName: 'Angela Reeves',
      appraiserPhone: '469-555-0622',
      propertyAddress: '2207 Swiss Ave, Dallas TX 75204',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Asset Manager — Pacific Coast',
        contactPhone: '503-555-0144',
        contactEmail: 'assetmgr@pacificcoast.com',
        accessInstructions: 'Exterior only — REO vacant. Use lock box on front door.',
        requiresEscort: false,
      },
      status: 'scheduled',
      scheduledSlot: {
        date: daysFromNow(2).slice(0, 10),
        startTime: '13:00',
        endTime: '14:00',
        timezone: TZ,
      },
      requestedBy: 'system',
      requestedAt: daysAgo(1),
      inspectionNotes: 'BPO site visit — interior + exterior. Document all deferred maintenance items and condition photos.',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-005: Appraisal appointment — scheduled (Engagement ENG-005) ──
    {
      id: INSPECTION_IDS.APPRAISAL_APPT_005,
      type: 'inspection',
      appointmentType: 'appraisal_appointment',
      tenantId,
      orderId: ORDER_IDS.SUBMITTED_009,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.SUBMITTED_009],
      appraiserId: APPRAISER_IDS.ELENA_VASQUEZ_FL,
      appraiserName: 'Elena Vasquez',
      appraiserPhone: '303-555-0775',
      propertyAddress: '5820 Main St, Boulder CO 80302',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Ryan Park',
        contactPhone: '720-555-0899',
        contactEmail: 'r.park@email.com',
        accessInstructions: 'Smart lock — owner will send temp code morning of appointment.',
        requiresEscort: false,
      },
      status: 'completed',
      scheduledSlot: {
        date: daysAgo(10).slice(0, 10),
        startTime: '11:00',
        endTime: '13:00',
        timezone: 'America/Denver',
      },
      requestedBy: 'appraiser',
      requestedAt: daysAgo(14),
      confirmedAt: daysAgo(13),
      confirmedBy: APPRAISER_IDS.ELENA_VASQUEZ_FL,
      startedAt: daysAgo(10),
      completedAt: daysAgo(10),
      durationMinutes: 120,
      inspectionNotes: 'Hybrid appraisal — appraiser performed full interior inspection.',
      photoCount: 58,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(10),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-006: Cancelled inspection (Order 011) ─────────────────────────
    {
      id: INSPECTION_IDS.CANCELLED_ORDER_011,
      type: 'inspection',
      appointmentType: 'property_inspection',
      tenantId,
      orderId: ORDER_IDS.CANCELLED_011,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.CANCELLED_011],
      appraiserId: APPRAISER_IDS.MICHAEL_THOMPSON,
      appraiserName: 'Michael Thompson',
      appraiserPhone: '214-555-0101',
      propertyAddress: '1547 Lamar St, Fort Worth TX 76102',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Seller — Frank Owens',
        contactPhone: '817-555-0612',
        accessInstructions: 'Owner occupied, call first.',
        requiresEscort: false,
      },
      status: 'cancelled',
      scheduledSlot: {
        date: daysAgo(8).slice(0, 10),
        startTime: '14:00',
        endTime: '15:30',
        timezone: TZ,
      },
      requestedBy: 'client',
      requestedAt: daysAgo(12),
      confirmedAt: daysAgo(11),
      confirmedBy: APPRAISER_IDS.MICHAEL_THOMPSON,
      cancelledAt: daysAgo(9),
      cancellationReason: 'Client cancelled order — borrower withdrew application.',
      cancelledBy: 'seed-user-coordinator-001',
      createdAt: daysAgo(12),
      updatedAt: daysAgo(9),
      createdBy: 'seed-user-coordinator-001',
    },

    // ── INS-007: BPO site visit — completed (Portfolio ENG-003, Loan A) ──
    {
      id: INSPECTION_IDS.BPO_COMPLETED_007,
      type: 'inspection',
      appointmentType: 'bpo_site_visit',
      tenantId,
      orderId: ORDER_IDS.COMPLETED_DRIVEBY_012,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.COMPLETED_DRIVEBY_012],
      appraiserId: APPRAISER_IDS.CARMEN_DELGADO_TX,
      appraiserName: 'Carmen Delgado',
      appraiserPhone: '817-555-0334',
      propertyAddress: '1547 Lamar St, Fort Worth TX 76102',
      propertyType: 'Single Family',
      propertyAccess: {
        contactName: 'Listing Agent — Clara Wells',
        contactPhone: '817-555-0901',
        contactEmail: 'cwells@realty.com',
        accessInstructions: 'Vacant REO. Lockbox on side door.',
        requiresEscort: false,
      },
      status: 'completed',
      scheduledSlot: {
        date: daysAgo(4).slice(0, 10),
        startTime: '10:30',
        endTime: '11:30',
        timezone: TZ,
      },
      requestedBy: 'system',
      requestedAt: daysAgo(6),
      confirmedAt: daysAgo(5),
      confirmedBy: APPRAISER_IDS.CARMEN_DELGADO_TX,
      startedAt: daysAgo(4),
      completedAt: daysAgo(4),
      durationMinutes: 55,
      inspectionNotes: 'BPO completed — 3 comps within 0.5 miles. Minor exterior deferred maintenance (facia paint). Interior acceptable condition.',
      photoCount: 22,
      accessIssues: 'Lockbox code initially incorrect — listing agent provided correct code after 10-min delay.',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(4),
      createdBy: 'seed-user-coordinator-001',
    },
  ];
}

export const module: SeedModule = {
  name: 'inspections',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    // Note: we do NOT cleanContainer here because the 'orders' container also holds
    // order documents seeded by the orders module. Instead we upsert by ID.
    // Use --module inspections to re-run safely.

    for (const insp of buildInspections(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, insp, result);
    }

    return result;
  },
};
