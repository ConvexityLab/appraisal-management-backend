/**
 * Seed Module: Bulk Portfolios
 *
 * Seeds 3 bulk portfolio job records representing completed tape evaluations
 * and a partial order-creation job.
 * Container: bulk-portfolio-jobs (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { BULK_JOB_IDS, CLIENT_IDS, SUB_CLIENT_SLUGS } from '../seed-ids.js';

const CONTAINER = 'bulk-portfolio-jobs';

function buildJobs(tenantId: string, clientId: string): Record<string, unknown>[] {
  return [
    {
      id: BULK_JOB_IDS.TAPE_EVAL_COMPLETE, tenantId, type: 'bulk-portfolio-job',
      jobType: 'TAPE_EVALUATION', status: 'COMPLETED',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.FIRST_HORIZON], clientRecordId: CLIENT_IDS.FIRST_HORIZON, clientName: 'First Horizon Bank',
      fileName: 'FHB_Q4_Portfolio_Tape.xlsx',
      totalRows: 150, processedRows: 150, failedRows: 3,
      validOrders: 147, ordersCreated: 147,
      submittedBy: 'seed-user-admin-001',
      submittedAt: daysAgo(45), startedAt: daysAgo(45),
      completedAt: daysAgo(45),
      processingTimeMs: 42_300,
      errorSummary: '3 rows skipped: missing property address',
      createdAt: daysAgo(45), updatedAt: daysAgo(45),
    },
    {
      id: BULK_JOB_IDS.TAPE_EVAL_COMPLETE_2, tenantId, type: 'bulk-portfolio-job',
      jobType: 'TAPE_EVALUATION', status: 'COMPLETED',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.NATIONAL_AMC], clientRecordId: CLIENT_IDS.NATIONAL_AMC, clientName: 'National AMC Services',
      fileName: 'NAMC_Refi_Batch_Jan2026.csv',
      totalRows: 82, processedRows: 82, failedRows: 0,
      validOrders: 82, ordersCreated: 82,
      submittedBy: 'seed-user-coordinator-001',
      submittedAt: daysAgo(20), startedAt: daysAgo(20),
      completedAt: daysAgo(20),
      processingTimeMs: 18_700,
      errorSummary: null,
      createdAt: daysAgo(20), updatedAt: daysAgo(20),
    },
    {
      id: BULK_JOB_IDS.ORDER_CREATION_PARTIAL, tenantId, type: 'bulk-portfolio-job',
      jobType: 'ORDER_CREATION', status: 'PARTIAL_FAILURE',
      clientId, subClientId: SUB_CLIENT_SLUGS[CLIENT_IDS.CLEARPATH], clientRecordId: CLIENT_IDS.CLEARPATH, clientName: 'ClearPath Valuation Group',
      fileName: 'ClearPath_Loss_Mit_Batch.xlsx',
      totalRows: 35, processedRows: 35, failedRows: 8,
      validOrders: 27, ordersCreated: 27,
      submittedBy: 'seed-user-coordinator-001',
      submittedAt: daysAgo(5), startedAt: daysAgo(5),
      completedAt: daysAgo(5),
      processingTimeMs: 9_100,
      errorSummary: '8 rows failed: 5 duplicate loan numbers, 3 invalid product types',
      createdAt: daysAgo(5), updatedAt: daysAgo(5),
    },
  ];
}

export const module: SeedModule = {
  name: 'bulk-portfolios',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const job of buildJobs(ctx.tenantId, ctx.clientId)) {
      await upsert(ctx, CONTAINER, job, result);
    }

    return result;
  },
};
