/**
 * Operations Metrics Controller
 *
 * Aggregate metrics across ALL engagements for the operational dashboard.
 *
 *   GET /api/ops-metrics/throughput            — event throughput over time
 *   GET /api/ops-metrics/lifecycle-health      — avg time per phase, bottlenecks
 *   GET /api/ops-metrics/automation-coverage   — % of orders auto-completed per phase
 *   GET /api/ops-metrics/interventions         — human intervention patterns
 *
 * All endpoints are tenant-scoped and admin/manager only.
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('OperationsMetricsController');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWindow(req: Request): { from: Date; to: Date } {
  const toParam = req.query['to'] as string | undefined;
  const fromParam = req.query['from'] as string | undefined;
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days
  return { from, to };
}

function bucketByHour(timestamp: string): string {
  const d = new Date(timestamp);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

function bucketByDay(timestamp: string): string {
  return timestamp.slice(0, 10); // YYYY-MM-DD
}

// ── Router ───────────────────────────────────────────────────────────────────

export function createOperationsMetricsRouter(
  dbService: CosmosDbService,
  authzMiddleware?: AuthorizationMiddleware,
): Router {
  const router = Router();

  const read = authzMiddleware
    ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('engagement', 'read')]
    : [];

  // ── GET /throughput ───────────────────────────────────────────────────────
  // Returns per-hour event counts broken down by category.
  router.get('/throughput', ...read, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant context required' });
      }
      const { from, to } = getWindow(req);

      const container = dbService.getContainer('engagement-audit-events');
      const iter = container.items.query({
        query:
          'SELECT c.timestamp, c.category, c.severity FROM c WHERE c.tenantId = @tenantId AND c.timestamp >= @from AND c.timestamp <= @to',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@from', value: from.toISOString() },
          { name: '@to', value: to.toISOString() },
        ],
      });
      const { resources } = await iter.fetchAll();

      // Bucket by hour for ranges <= 2 days, by day otherwise
      const rangeMs = to.getTime() - from.getTime();
      const bucketFn = rangeMs <= 2 * 24 * 60 * 60 * 1000 ? bucketByHour : bucketByDay;

      const buckets: Record<string, Record<string, number>> = {};
      let totalEvents = 0;
      let totalErrors = 0;

      for (const e of resources as Array<{ timestamp: string; category: string; severity: string }>) {
        const bucket = bucketFn(e.timestamp);
        if (!buckets[bucket]) buckets[bucket] = {};
        buckets[bucket][e.category] = (buckets[bucket][e.category] ?? 0) + 1;
        totalEvents++;
        if (e.severity === 'error') totalErrors++;
      }

      const series = Object.entries(buckets)
        .map(([bucket, counts]) => ({ bucket, ...counts }))
        .sort((a, b) => a.bucket.localeCompare(b.bucket));

      return res.json({
        success: true,
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          granularity: bucketFn === bucketByHour ? 'hour' : 'day',
          totalEvents,
          totalErrors,
          errorRate: totalEvents > 0 ? totalErrors / totalEvents : 0,
          series,
        },
      });
    } catch (error) {
      logger.error('throughput metrics failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to fetch throughput metrics' });
    }
  });

  // ── GET /lifecycle-health ─────────────────────────────────────────────────
  // Average time per phase across all orders in the window.
  router.get('/lifecycle-health', ...read, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant context required' });
      }
      const { from, to } = getWindow(req);

      const container = dbService.getContainer('engagement-audit-events');
      const iter = container.items.query({
        query:
          'SELECT c.timestamp, c.eventType, c.orderId FROM c WHERE c.tenantId = @tenantId AND c.timestamp >= @from AND c.timestamp <= @to AND IS_DEFINED(c.orderId)',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@from', value: from.toISOString() },
          { name: '@to', value: to.toISOString() },
        ],
      });
      const { resources } = await iter.fetchAll();

      // Group events by orderId
      const eventsByOrder = new Map<string, Array<{ ts: number; type: string }>>();
      for (const e of resources as Array<{ timestamp: string; eventType: string; orderId: string }>) {
        const list = eventsByOrder.get(e.orderId) ?? [];
        list.push({ ts: new Date(e.timestamp).getTime(), type: e.eventType });
        eventsByOrder.set(e.orderId, list);
      }

      // Phase transitions we care about
      const phases: Array<{ key: string; label: string; start: string; end: string }> = [
        { key: 'intake_to_vendor', label: 'Intake → Vendor', start: 'engagement.order.created', end: 'vendor.bid.sent' },
        { key: 'vendor_to_accepted', label: 'Bid Sent → Accepted', start: 'vendor.bid.sent', end: 'vendor.bid.accepted' },
        { key: 'accepted_to_axiom', label: 'Accepted → Axiom Start', start: 'vendor.bid.accepted', end: 'axiom.evaluation.submitted' },
        { key: 'axiom_duration', label: 'Axiom Processing', start: 'axiom.evaluation.submitted', end: 'axiom.evaluation.completed' },
        { key: 'axiom_to_qc', label: 'Axiom → QC Start', start: 'axiom.evaluation.completed', end: 'qc.started' },
        { key: 'qc_duration', label: 'QC Review', start: 'qc.started', end: 'qc.completed' },
        { key: 'qc_to_delivery', label: 'QC → Delivery', start: 'qc.completed', end: 'order.delivered' },
      ];

      const phaseStats = phases.map((phase) => {
        const durations: number[] = [];
        for (const events of eventsByOrder.values()) {
          const sorted = [...events].sort((a, b) => a.ts - b.ts);
          const startEvent = sorted.find((e) => e.type === phase.start);
          if (!startEvent) continue;
          const endEvent = sorted.find((e) => e.type === phase.end && e.ts > startEvent.ts);
          if (!endEvent) continue;
          durations.push(endEvent.ts - startEvent.ts);
        }
        durations.sort((a, b) => a - b);
        const avg = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
        const p50 = durations[Math.floor(durations.length / 2)] ?? 0;
        const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
        return {
          key: phase.key,
          label: phase.label,
          sampleCount: durations.length,
          avgMs: avg,
          p50Ms: p50,
          p95Ms: p95,
        };
      });

      // Identify bottleneck — phase with highest avg
      const bottleneck = phaseStats.reduce(
        (max, p) => (p.avgMs > max.avgMs ? p : max),
        phaseStats[0] ?? { key: '', label: '', avgMs: 0 },
      );

      return res.json({
        success: true,
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          totalOrders: eventsByOrder.size,
          phases: phaseStats,
          bottleneck: bottleneck.key ? { key: bottleneck.key, label: bottleneck.label, avgMs: bottleneck.avgMs } : null,
        },
      });
    } catch (error) {
      logger.error('lifecycle-health metrics failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to fetch lifecycle health' });
    }
  });

  // ── GET /automation-coverage ──────────────────────────────────────────────
  // % of orders that completed each phase without human intervention.
  router.get('/automation-coverage', ...read, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant context required' });
      }
      const { from, to } = getWindow(req);

      const container = dbService.getContainer('engagement-audit-events');
      const iter = container.items.query({
        query:
          'SELECT c.timestamp, c.eventType, c.orderId FROM c WHERE c.tenantId = @tenantId AND c.timestamp >= @from AND c.timestamp <= @to',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@from', value: from.toISOString() },
          { name: '@to', value: to.toISOString() },
        ],
      });
      const { resources } = await iter.fetchAll();

      // Group events by orderId
      const eventsByOrder = new Map<string, string[]>();
      for (const e of resources as Array<{ eventType: string; orderId?: string }>) {
        if (!e.orderId) continue;
        const list = eventsByOrder.get(e.orderId) ?? [];
        list.push(e.eventType);
        eventsByOrder.set(e.orderId, list);
      }

      const totalOrders = eventsByOrder.size;
      let withAxiom = 0, withAiQc = 0, autoAssigned = 0, withIntervention = 0;

      for (const events of eventsByOrder.values()) {
        if (events.includes('axiom.evaluation.completed')) withAxiom++;
        if (events.includes('qc.ai.scored')) withAiQc++;
        if (events.includes('vendor.bid.accepted') && !events.includes('vendor.assignment.exhausted')) autoAssigned++;
        if (events.includes('human.intervention')) withIntervention++;
      }

      return res.json({
        success: true,
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          totalOrders,
          axiomCoverage: totalOrders > 0 ? withAxiom / totalOrders : 0,
          aiQcCoverage: totalOrders > 0 ? withAiQc / totalOrders : 0,
          autoAssignmentRate: totalOrders > 0 ? autoAssigned / totalOrders : 0,
          humanInterventionRate: totalOrders > 0 ? withIntervention / totalOrders : 0,
          ordersWithIntervention: withIntervention,
          ordersAutoComplete: totalOrders - withIntervention,
        },
      });
    } catch (error) {
      logger.error('automation-coverage metrics failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to fetch automation coverage' });
    }
  });

  // ── GET /interventions ────────────────────────────────────────────────────
  // Human intervention patterns — which actions are most common, by which users, why.
  router.get('/interventions', ...read, async (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'Tenant context required' });
      }
      const { from, to } = getWindow(req);

      const container = dbService.getContainer('engagement-audit-events');
      const iter = container.items.query({
        query:
          'SELECT c.timestamp, c.data, c.orderId, c.engagementId FROM c WHERE c.tenantId = @tenantId AND c.eventType = "human.intervention" AND c.timestamp >= @from AND c.timestamp <= @to',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@from', value: from.toISOString() },
          { name: '@to', value: to.toISOString() },
        ],
      });
      const { resources } = await iter.fetchAll();

      const actionCounts: Record<string, number> = {};
      const userCounts: Record<string, number> = {};
      const triggerEventCounts: Record<string, number> = {};
      const recent: Array<{ timestamp: string; action: string; user: string; reason: string | null; orderId?: string }> = [];

      for (const r of resources as Array<{ timestamp: string; data: any; orderId?: string; engagementId: string }>) {
        const action = r.data?.action as string | undefined;
        const user = (r.data?.userName as string | undefined) ?? 'unknown';
        const triggerType = r.data?.triggeredByEventType as string | undefined;
        const reason = (r.data?.reason as string | undefined) ?? null;

        if (action) actionCounts[action] = (actionCounts[action] ?? 0) + 1;
        userCounts[user] = (userCounts[user] ?? 0) + 1;
        if (triggerType) triggerEventCounts[triggerType] = (triggerEventCounts[triggerType] ?? 0) + 1;

        recent.push({
          timestamp: r.timestamp,
          action: action ?? 'unknown',
          user,
          reason,
          ...(r.orderId ? { orderId: r.orderId } : {}),
        });
      }

      recent.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }));

      const topTriggers = Object.entries(triggerEventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([eventType, count]) => ({ eventType, count }));

      return res.json({
        success: true,
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          totalInterventions: resources.length,
          topActions,
          topUsers,
          topTriggers,
          recent: recent.slice(0, 20),
        },
      });
    } catch (error) {
      logger.error('interventions metrics failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to fetch intervention analytics' });
    }
  });

  return router;
}
