import { Logger } from '../../utils/logger.js';
import type { VendorDomainEvent } from '../../types/vendor-integration.types.js';
import { VendorConnectionService } from './VendorConnectionService.js';
import type { VendorAdapter } from './VendorAdapter.js';
import { AimPortAdapter } from './AimPortAdapter.js';
import { ClassValuationWebhookAdapter } from './ClassValuationWebhookAdapter.js';
import { VendorHttpClient } from './VendorHttpClient.js';
import { appInsightsMetrics } from '../app-insights-metrics.service.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;   // 1 s
const DEFAULT_MAX_DELAY_MS = 30_000;   // 30 s cap

/** Exponential back-off with full jitter: `rand(0, min(cap, base * 2^attempt))`. */
function backoffMs(attempt: number, baseMs: number, capMs: number): number {
  const ceiling = Math.min(capMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * ceiling);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transport-aware outbound dispatcher.
 *
 * Dispatch is synchronous per-attempt but retried up to DEFAULT_MAX_ATTEMPTS
 * times with exponential back-off + full jitter before the error is surfaced
 * to the caller. Callers that need fire-and-forget must `.catch()` themselves.
 *
 * Durable cross-restart delivery is handled at a higher level:
 * VendorOutboundOutboxService enqueues events to Cosmos, and
 * VendorOutboundWorkerService polls and calls this dispatcher with retries.
 * Dead-lettered documents remain in Cosmos for operator replay via the
 * vendor-outbox-monitor controller.
 */
export class VendorOutboundDispatcher {
  private readonly logger = new Logger('VendorOutboundDispatcher');
  private readonly adapters: Map<string, VendorAdapter>;
  private readonly connectionService: VendorConnectionService;
  private readonly httpClient: VendorHttpClient;

  constructor(connectionService?: VendorConnectionService) {
    this.connectionService = connectionService ?? new VendorConnectionService();
    this.httpClient = new VendorHttpClient();
    const aimPortAdapter = new AimPortAdapter();
    const classValuationAdapter = new ClassValuationWebhookAdapter();
    this.adapters = new Map<string, VendorAdapter>([
      [aimPortAdapter.vendorType, aimPortAdapter],
      [classValuationAdapter.vendorType, classValuationAdapter],
    ]);
  }

  async dispatch(event: VendorDomainEvent, connectionIdOrIdentifier: string): Promise<void> {
    const adapter = this.adapters.get(event.vendorType);
    if (!adapter) {
      throw new Error(`No outbound adapter registered for vendorType=${event.vendorType}`);
    }

    // connectionIdOrIdentifier is the Cosmos document ID stored in the outbox document —
    // NOT the inboundIdentifier (e.g. AIM-Port client_id). Use getConnectionById.
    const connection = await this.connectionService.getConnectionById(connectionIdOrIdentifier);

    if (connection.vendorType !== event.vendorType) {
      throw new Error(
        `Outbound dispatch vendorType mismatch: outbox event has vendorType=${event.vendorType} but ` +
        `connection ${connection.id} has vendorType=${connection.vendorType}. This indicates a data integrity problem.`,
      );
    }

    const call = await adapter.buildOutboundCall(event, connection, {
      resolveSecret: (secretName) => this.connectionService.resolveSecret(secretName),
    });

    if (!call) {
      this.logger.info('No outbound call generated for vendor event', {
        eventType: event.eventType,
        vendorType: event.vendorType,
        vendorOrderId: event.vendorOrderId,
      });
      return;
    }

    // Thread the originating event ID as correlationId for App Insights tracing.
    call.correlationId = event.id;

    appInsightsMetrics.trackVendorOutboundDispatched({
      correlationId: event.id,
      eventType: event.eventType,
      vendorOrderId: event.vendorOrderId,
    });

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < DEFAULT_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.httpClient.send(call);
        if (!response.ok) {
          throw new Error(
            `Outbound vendor call failed for eventType=${event.eventType} vendorOrderId=${event.vendorOrderId}. ` +
            `HTTP ${response.status}. Body: ${response.rawText}`,
          );
        }
        if (attempt > 0) {
          this.logger.info('Outbound vendor call succeeded after retry', {
            eventType: event.eventType,
            vendorOrderId: event.vendorOrderId,
            succeededOnAttempt: attempt + 1,
          });
        }
        return; // success — all done
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < DEFAULT_MAX_ATTEMPTS - 1) {
          const delayMs = backoffMs(attempt, DEFAULT_BASE_DELAY_MS, DEFAULT_MAX_DELAY_MS);
          this.logger.warn('Outbound vendor call failed — will retry', {
            eventType: event.eventType,
            vendorOrderId: event.vendorOrderId,
            vendorType: event.vendorType,
            attempt: attempt + 1,
            maxAttempts: DEFAULT_MAX_ATTEMPTS,
            retryInMs: delayMs,
            error: lastError.message,
          });
          await sleep(delayMs);
        }
      }
    }

    // All attempts exhausted — dead-letter: log for operator replay and rethrow.
    this.logger.warn('Outbound vendor call dead-lettered after max retry attempts', {
      eventType: event.eventType,
      vendorOrderId: event.vendorOrderId,
      vendorType: event.vendorType,
      connectionId: connectionIdOrIdentifier,
      attempts: DEFAULT_MAX_ATTEMPTS,
      error: lastError?.message,
    });
    throw lastError!;
  }
}
