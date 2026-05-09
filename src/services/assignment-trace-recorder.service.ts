/**
 * AssignmentTraceRecorder — write-only repository for per-assignment
 * evaluation traces (Phase 5 T37 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.6).
 *
 * Storage: Cosmos container `assignment-traces`, partitioned by `/tenantId`.
 *
 * Design:
 *   - Append-only. Every triggerVendorAssignment writes one trace; re-triggers
 *     write new docs (id incorporates initiatedAt so history is preserved).
 *   - Best-effort. Storage failure is logged + swallowed — never fails an
 *     assignment because we couldn't write a trace. The orchestrator's
 *     own logging still captures everything.
 *   - Idempotent on id. The orchestrator generates initiatedAt before writing,
 *     so retries (e.g. on a transient write failure) end up with the same id
 *     and Cosmos returns 409 Conflict, which we treat as success.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type { AssignmentTraceDocument, AssignmentTraceSummary } from '../types/assignment-trace.types.js';

const TRACES_CONTAINER = 'assignment-traces';

export class AssignmentTraceRecorder {
  private readonly logger = new Logger('AssignmentTraceRecorder');

  constructor(private readonly db: CosmosDbService) {}

  /**
   * Compose the synthetic id from (tenantId, orderId, initiatedAt). Including
   * the timestamp lets re-triggers write distinct docs (one per attempt) while
   * still being deterministic for retry idempotency.
   */
  static composeId(tenantId: string, orderId: string, initiatedAt: string): string {
    return `${tenantId}__${orderId}__${initiatedAt}`;
  }

  async record(doc: AssignmentTraceDocument): Promise<void> {
    try {
      await this.db.createDocument(TRACES_CONTAINER, doc);
      this.logger.info('assignment.trace.recorded', {
        tenantId: doc.tenantId,
        orderId: doc.orderId,
        outcome: doc.outcome,
        rankedCount: doc.rankedVendors.length,
        deniedCount: doc.deniedVendors.length,
        rankingLatencyMs: doc.rankingLatencyMs,
      });
    } catch (err: any) {
      // 409 conflict means we already wrote this trace (deterministic id) —
      // treat as success to keep orchestrator retries idempotent.
      if (err?.code === 409 || /Conflict/i.test(err?.message ?? '')) {
        this.logger.info('assignment.trace.duplicate (treated as success)', {
          tenantId: doc.tenantId,
          orderId: doc.orderId,
        });
        return;
      }
      // Anything else — log and swallow. Don't fail the assignment.
      this.logger.error('assignment.trace.record.failure', {
        tenantId: doc.tenantId,
        orderId: doc.orderId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Fetch all traces for an order, newest first. Used by the FE order-detail
   * timeline.
   */
  async listForOrder(tenantId: string, orderId: string): Promise<AssignmentTraceDocument[]> {
    try {
      const docs = await this.db.queryDocuments<AssignmentTraceDocument>(
        TRACES_CONTAINER,
        `SELECT * FROM c
         WHERE c.type = 'assignment-trace'
           AND c.tenantId = @tenantId
           AND c.orderId = @orderId
         ORDER BY c.initiatedAt DESC`,
        [
          { name: '@tenantId', value: tenantId },
          { name: '@orderId', value: orderId },
        ],
      );
      return docs;
    } catch (err) {
      this.logger.error('assignment.trace.list.failure', {
        tenantId,
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * List recent traces for a tenant — feeds the operations dashboard
   * (Phase 7 T50). Returns slim summaries to keep payload bounded.
   */
  async listRecent(tenantId: string, limit = 50): Promise<AssignmentTraceSummary[]> {
    try {
      const docs = await this.db.queryDocuments<AssignmentTraceDocument>(
        TRACES_CONTAINER,
        `SELECT TOP @limit * FROM c
         WHERE c.type = 'assignment-trace'
           AND c.tenantId = @tenantId
         ORDER BY c.initiatedAt DESC`,
        [
          { name: '@tenantId', value: tenantId },
          { name: '@limit', value: limit },
        ],
      );
      return docs.map((d) => ({
        id: d.id,
        orderId: d.orderId,
        initiatedAt: d.initiatedAt,
        outcome: d.outcome,
        selectedVendorId: d.selectedVendorId,
        rankedCount: d.rankedVendors.length,
        deniedCount: d.deniedVendors.length,
        rulesProviderName: d.rulesProviderName,
        rankingLatencyMs: d.rankingLatencyMs,
      }));
    } catch (err) {
      this.logger.error('assignment.trace.recent.failure', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
