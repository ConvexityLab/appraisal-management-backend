import { Logger } from '../../utils/logger.js';
import type { OutboundCall } from '../../types/vendor-integration.types.js';
import { appInsightsMetrics } from '../app-insights-metrics.service.js';

export interface VendorHttpResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T | null;
  rawText: string;
}

/**
 * Generic HTTP client for synchronous POST-based vendor integrations.
 * Formerly called AimPortClient — renamed because it is used for every
 * vendor adapter, not solely AIM-Port.
 */
export class VendorHttpClient {
  private readonly logger = new Logger('VendorHttpClient');

  async send(call: OutboundCall): Promise<VendorHttpResponse> {
    const response = await fetch(call.url, {
      method: call.method,
      headers: call.headers,
      body: call.rawBody ?? JSON.stringify(call.body),
    });

    const rawText = await response.text();
    let parsedBody: unknown = null;
    if (rawText.trim()) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = null;
      }
    }

    this.logger.info('Vendor outbound call completed', {
      url: call.url,
      eventType: call.eventType,
      vendorOrderId: call.vendorOrderId,
      status: response.status,
      ok: response.ok,
    });

    if (call.correlationId) {
      appInsightsMetrics.trackVendorOutboundHttpResult({
        correlationId: call.correlationId,
        requestType: call.eventType ?? 'unknown',
        vendorOrderId: call.vendorOrderId ?? 'unknown',
        status: response.status,
        ok: response.ok,
        url: call.url,
      });
    }

    return {
      status: response.status,
      ok: response.ok,
      body: parsedBody,
      rawText,
    };
  }
}
