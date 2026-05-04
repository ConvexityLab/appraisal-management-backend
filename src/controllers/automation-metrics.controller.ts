/**
 * Automation Metrics Controller
 *
 * Provides birds-eye operational dashboards across all engagements.
 *
 * Endpoints:
 *   GET /api/automation/metrics/throughput      — events/min, by category, error rate
 *   GET /api/automation/metrics/lifecycle       — avg time per phase, bottlenecks
 *   GET /api/automation/metrics/coverage        — % automation by stage
 *   GET /api/automation/metrics/interventions   — human intervention frequency and patterns
 *
 * All endpoints support ?hours=24 query param (default 24h window).
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

const logger = new Logger('AutomationMetricsController');

export function createAutomationMetricsRouter(dbService: CosmosDbService): Router {
  const router = Router();

  // ── GET /throughput ─────────────────────────────────────────────────────────
  router.get('/throughput', async (req: Request, res: Response) => {
    const hours = Math.max(1, Math.min(168, parseInt(String(req.query['hours'] ?? '24'), 10)));
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const tenantId = (req as any).user?.tenantId;

    try {
      const container = dbService.getContainer('engagement-audit-events');
      const { resources } = await container.items.query({
        query: `SELECT c.eventType, c.category, c.severity, c.timestamp
                FROM c
                WHERE c.tenantId = @tenantId
                  AND c.timestamp >= @since
                  AND c.type = 'audit-event'`,
        parameters: [
          { name: '@tenantId', value: tenantId ?? 'unknown' },
          { name: '@since', value: since },
        ],
      }).fetchAll();

      // Aggregate
      const total = resources.length;
      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byHour: Record<string, number> = {}; // "2026-04-22T14" → count
      let errorCount = 0;

      for (const e of resources) {
        const cat = e.category || 'UNKNOWN';
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
        const sev = e.severity || 'info';
        bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
        if (sev === 'error') errorCount++;
        const hour = (e.timestamp as string).substring(0, 13); // YYYY-MM-DDTHH
        byHour[hour] = (byHour[hour] ?? 0) + 1;
      }

      // Fill in missing hours with 0 for a complete time series
      const timeSeries: Array<{ hour: string; count: number }> = [];
      for (let i = hours - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 3600_000);
        const key = d.toISOString().substring(0, 13);
        timeSeries.push({ hour: key, count: byHour[key] ?? 0 });
      }

      return res.status(200).json({
        success: true,
        data: {
          windowHours: hours,
          since,
          total,
          eventsPerHour: total / hours,
          errorCount,
          errorRate: total > 0 ? errorCount / total : 0,
          byCategory,
          bySeverity,
          timeSeries,
        },
      });
    } catch (err) {
      logger.error('Failed to compute throughput metrics', { error: (err as Error).message });
      return res.status(500).json({ success: false, error: { message: (err as Error).message } });
    }
  });

  // ── GET /lifecycle ──────────────────────────────────────────────────────────
  // Average time per lifecycle phase, computed from paired events
  router.get('/lifecycle', async (req: Request, res: Response) => {
    const hours = Math.max(1, Math.min(720, parseInt(String(req.query['hours'] ?? '168'), 10))); // default 7 days
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const tenantId = (req as any).user?.tenantId;

    try {
      const container = dbService.getContainer('engagement-audit-events');
      const { resources } = await container.items.query({
        query: `SELECT c.orderId, c.eventType, c.timestamp
                FROM c
                WHERE c.tenantId = @tenantId
                  AND c.timestamp >= @since
                  AND c.type = 'audit-event'
                  AND IS_DEFINED(c.orderId)`,
        parameters: [
          { name: '@tenantId', value: tenantId ?? 'unknown' },
          { name: '@since', value: since },
        ],
      }).fetchAll();

      // Define the lifecycle phases as paired events
      const PHASES = [
        { key: 'assignment', label: 'Vendor Assignment', start: 'order.created', end: 'vendor.bid.accepted' },
        { key: 'inspection', label: 'Inspection & Report', start: 'vendor.bid.accepted', end: 'order.status.changed' },
        { key: 'axiom', label: 'Axiom Evaluation', start: 'axiom.evaluation.submitted', end: 'axiom.evaluation.completed' },
        { key: 'qc', label: 'QC Review', start: 'qc.started', end: 'qc.completed' },
        { key: 'delivery', label: 'Delivery', start: 'order.completed', end: 'order.delivered' },
      ];

      // Group events by orderId
      const eventsByOrder: Record<string, Array<{ eventType: string; timestamp: string }>> = {};
      for (const e of resources) {
        if (!eventsByOrder[e.orderId]) eventsByOrder[e.orderId] = [];
        eventsByOrder[e.orderId]!.push({ eventType: e.eventType, timestamp: e.timestamp });
      }

      // For each phase, compute durations across all orders
      const phaseStats = PHASES.map(phase => {
        const durations: number[] = [];
        for (const events of Object.values(eventsByOrder)) {
          const startEvent = events.find(e => e.eventType === phase.start);
          const endEvent = events.find(e => e.eventType === phase.end &&
            new Date(e.timestamp).getTime() > new Date(startEvent?.timestamp ?? 0).getTime());
          if (startEvent && endEvent) {
            const ms = new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime();
            if (ms > 0) durations.push(ms);
          }
        }

        durations.sort((a, b) => a - b);
        const avg = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : 0;
        const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)]! : 0;
        const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)]! : 0;

        return {
          key: phase.key,
          label: phase.label,
          sampleSize: durations.length,
          avgMs: Math.round(avg),
          p50Ms: Math.round(p50),
          p95Ms: Math.round(p95),
          maxMs: durations[durations.length - 1] ?? 0,
        };
      });

      // Identify bottleneck (highest avg duration with meaningful sample size)
      const bottleneck = phaseStats
        .filter(p => p.sampleSize >= 3)
        .reduce((max, p) => p.avgMs > (max?.avgMs ?? 0) ? p : max, null as any);

      return res.status(200).json({
        success: true,
        data: {
          windowHours: hours,
          since,
          totalOrders: Object.keys(eventsByOrder).length,
          phases: phaseStats,
          bottleneck: bottleneck?.key ?? null,
        },
      });
    } catch (err) {
      logger.error('Failed to compute lifecycle metrics', { error: (err as Error).message });
      return res.status(500).json({ success: false, error: { message: (err as Error).message } });
    }
  });

  // ── GET /coverage ──────────────────────────────────────────────────────────
  // Automation coverage: % of orders where each stage completed automatically
  router.get('/coverage', async (req: Request, res: Response) => {
    const hours = Math.max(1, Math.min(720, parseInt(String(req.query['hours'] ?? '168'), 10)));
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const tenantId = (req as any).user?.tenantId;

    try {
      const container = dbService.getContainer('engagement-audit-events');
      const { resources } = await container.items.query({
        query: `SELECT c.orderId, c.eventType, c.severity
                FROM c
                WHERE c.tenantId = @tenantId
                  AND c.timestamp >= @since
                  AND c.type = 'audit-event'
                  AND IS_DEFINED(c.orderId)`,
        parameters: [
          { name: '@tenantId', value: tenantId ?? 'unknown' },
          { name: '@since', value: since },
        ],
      }).fetchAll();

      // Group by order
      const eventsByOrder: Record<string, Set<string>> = {};
      const interventionsByOrder: Record<string, number> = {};
      for (const e of resources) {
        if (!eventsByOrder[e.orderId]) {
          eventsByOrder[e.orderId] = new Set();
          interventionsByOrder[e.orderId] = 0;
        }
        eventsByOrder[e.orderId]!.add(e.eventType);
        if (e.eventType === 'human.intervention') {
          interventionsByOrder[e.orderId] = (interventionsByOrder[e.orderId] ?? 0) + 1;
        }
      }

      const orderIds = Object.keys(eventsByOrder);
      const totalOrders = orderIds.length;

      const stages = [
        {
          key: 'vendor_auto_assigned',
          label: 'Vendor auto-assigned',
          check: (events: Set<string>) => events.has('vendor.bid.accepted') && !events.has('vendor.assignment.exhausted'),
        },
        {
          key: 'axiom_completed',
          label: 'Axiom extraction completed',
          check: (events: Set<string>) => events.has('axiom.evaluation.completed') || events.has('axiom.execution.completed'),
        },
        {
          key: 'qc_auto_passed',
          label: 'QC auto-passed (no manual intervention)',
          check: (events: Set<string>) => events.has('qc.completed'),
        },
        {
          key: 'delivered',
          label: 'Order delivered',
          check: (events: Set<string>) => events.has('order.delivered'),
        },
      ];

      const coverage = stages.map(stage => {
        const count = orderIds.filter(id => stage.check(eventsByOrder[id]!)).length;
        return {
          key: stage.key,
          label: stage.label,
          completedCount: count,
          pct: totalOrders > 0 ? count / totalOrders : 0,
        };
      });

      // Human-touch rate
      const ordersWithIntervention = Object.values(interventionsByOrder).filter(n => n > 0).length;
      const touchRate = totalOrders > 0 ? ordersWithIntervention / totalOrders : 0;

      return res.status(200).json({
        success: true,
        data: {
          windowHours: hours,
          since,
          totalOrders,
          stages: coverage,
          humanTouchRate: touchRate,
          ordersWithIntervention,
        },
      });
    } catch (err) {
      logger.error('Failed to compute coverage metrics', { error: (err as Error).message });
      return res.status(500).json({ success: false, error: { message: (err as Error).message } });
    }
  });

  // ── GET /interventions ──────────────────────────────────────────────────────
  // Human intervention analytics
  router.get('/interventions', async (req: Request, res: Response) => {
    const hours = Math.max(1, Math.min(720, parseInt(String(req.query['hours'] ?? '168'), 10)));
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const tenantId = (req as any).user?.tenantId;

    try {
      const container = dbService.getContainer('engagement-audit-events');
      const { resources } = await container.items.query({
        query: `SELECT c.eventType, c.data, c.timestamp, c.severity
                FROM c
                WHERE c.tenantId = @tenantId
                  AND c.timestamp >= @since
                  AND c.type = 'audit-event'
                  AND c.eventType = 'human.intervention'`,
        parameters: [
          { name: '@tenantId', value: tenantId ?? 'unknown' },
          { name: '@since', value: since },
        ],
      }).fetchAll();

      const totalInterventions = resources.length;
      const byAction: Record<string, number> = {};
      const byTriggerEvent: Record<string, number> = {};
      const byUser: Record<string, number> = {};
      const reasons: string[] = [];
      let failedInterventions = 0;

      for (const i of resources) {
        const action = (i.data?.action as string) ?? 'unknown';
        byAction[action] = (byAction[action] ?? 0) + 1;

        const triggerType = (i.data?.triggeredByEventType as string) ?? 'unknown';
        byTriggerEvent[triggerType] = (byTriggerEvent[triggerType] ?? 0) + 1;

        const user = (i.data?.userName as string) ?? 'unknown';
        byUser[user] = (byUser[user] ?? 0) + 1;

        const reason = (i.data?.reason as string);
        if (reason) reasons.push(reason);

        if (i.severity === 'error') failedInterventions++;
      }

      // Top 5 most common actions
      const topActions = Object.entries(byAction)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      // Top 5 most common trigger events
      const topTriggers = Object.entries(byTriggerEvent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([eventType, count]) => ({ eventType, count }));

      // Top 5 most active users
      const topUsers = Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userName, count]) => ({ userName, count }));

      return res.status(200).json({
        success: true,
        data: {
          windowHours: hours,
          since,
          totalInterventions,
          failedInterventions,
          successRate: totalInterventions > 0 ? (totalInterventions - failedInterventions) / totalInterventions : 1,
          topActions,
          topTriggers,
          topUsers,
          recentReasons: reasons.slice(-20),
        },
      });
    } catch (err) {
      logger.error('Failed to compute intervention metrics', { error: (err as Error).message });
      return res.status(500).json({ success: false, error: { message: (err as Error).message } });
    }
  });

  return router;
}
