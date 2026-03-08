/**
 * Seed Module: Escalations
 *
 * Seeds 2 QC escalation records: a late-delivery escalation and a QC failure escalation.
 * Container: escalations (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { ESCALATION_IDS, ORDER_IDS, ORDER_NUMBERS, VENDOR_IDS, STAFF_IDS } from '../seed-ids.js';

const CONTAINER = 'escalations';

function buildEscalations(tenantId: string): Record<string, unknown>[] {
  return [
    {
      id: ESCALATION_IDS.LATE_DELIVERY, tenantId, type: 'escalation',
      orderId: ORDER_IDS.IN_PROGRESS_003,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.IN_PROGRESS_003],
      vendorId: VENDOR_IDS.TX_PROPERTY,
      escalationType: 'LATE_DELIVERY',
      severity: 'HIGH',
      status: 'OPEN',
      reason: 'Rush order exceeds SLA — due date was yesterday, report not yet submitted.',
      escalatedBy: 'system',
      escalatedAt: daysAgo(1),
      assignedTo: STAFF_IDS.MANAGER_1,
      resolution: null,
      resolvedAt: null,
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    {
      id: ESCALATION_IDS.QC_FAILURE, tenantId, type: 'escalation',
      orderId: ORDER_IDS.REVISION_010,
      orderNumber: ORDER_NUMBERS[ORDER_IDS.REVISION_010],
      vendorId: VENDOR_IDS.TX_PROPERTY,
      escalationType: 'QC_FAILURE',
      severity: 'MEDIUM',
      status: 'IN_PROGRESS',
      reason: 'QC score of 68 is below 80 threshold. Comparable selection issues and unsupported value opinion.',
      escalatedBy: STAFF_IDS.QC_ANALYST_2,
      escalatedAt: daysAgo(4),
      assignedTo: STAFF_IDS.MANAGER_1,
      notes: [
        { author: STAFF_IDS.MANAGER_1, text: 'Contacted vendor — revision in progress.', timestamp: daysAgo(3) },
      ],
      resolution: null,
      resolvedAt: null,
      createdAt: daysAgo(4), updatedAt: daysAgo(3),
    },
  ];
}

export const module: SeedModule = {
  name: 'escalations',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const esc of buildEscalations(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, esc, result);
    }

    return result;
  },
};
