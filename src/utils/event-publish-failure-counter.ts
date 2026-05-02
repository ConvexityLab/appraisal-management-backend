/**
 * EventPublishFailureCounter
 *
 * Tracks event-publication failures across services that publish on a
 * "best-effort, never throw" basis (analysis-submission, audit-event-sink,
 * and others). Caller flow MUST NOT block on event publication, but ops
 * still need a queryable signal when publishes start failing — otherwise a
 * Service Bus outage looks like silence to downstream consumers.
 *
 * Usage:
 *   try {
 *     await this.publisher.publish(...);
 *   } catch (err) {
 *     recordEventPublishFailure({ eventType: 'qc.issue.detected', error: err });
 *   }
 *
 * The counter is process-local. Health endpoints / metrics scrapers can read
 * `getEventPublishFailureStats()` to expose the values.
 */

export interface EventPublishFailureRecord {
  eventType: string;
  error: string;
  source: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

interface EventPublishFailureStats {
  totalFailures: number;
  failuresByEventType: Record<string, number>;
  lastFailure?: EventPublishFailureRecord;
}

let totalFailures = 0;
const failuresByEventType: Map<string, number> = new Map();
let lastFailure: EventPublishFailureRecord | undefined;

export function recordEventPublishFailure(input: {
  eventType: string;
  error: unknown;
  source: string;
  context?: Record<string, unknown>;
}): void {
  totalFailures += 1;
  failuresByEventType.set(input.eventType, (failuresByEventType.get(input.eventType) ?? 0) + 1);
  lastFailure = {
    eventType: input.eventType,
    source: input.source,
    error: input.error instanceof Error ? input.error.message : String(input.error),
    timestamp: new Date().toISOString(),
    ...(input.context ? { context: input.context } : {}),
  };
}

export function getEventPublishFailureStats(): EventPublishFailureStats {
  return {
    totalFailures,
    failuresByEventType: Object.fromEntries(failuresByEventType.entries()),
    ...(lastFailure ? { lastFailure } : {}),
  };
}

/** Test seam — resets module state. Do not call from production code. */
export function __resetEventPublishFailureCounterForTest(): void {
  totalFailures = 0;
  failuresByEventType.clear();
  lastFailure = undefined;
}
