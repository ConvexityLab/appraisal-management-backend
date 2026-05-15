import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from '../utils/logger.js';

const logger = new Logger('VendorEventTraceService');

export interface VendorTraceHop {
  name: string;
  timestamp: string;
  correlationId: string;
  properties: Record<string, string>;
}

export interface VendorTraceTimeline {
  correlationId: string;
  vendorOrderId: string;
  firstSeen: string;
  lastSeen: string;
  hops: VendorTraceHop[];
}

interface LogAnalyticsRow {
  name: string;
  timestamp: string;
  customDimensions: Record<string, string>;
}

interface LogAnalyticsQueryResponse {
  tables: Array<{
    columns: Array<{ name: string; type: string }>;
    rows: unknown[][];
  }>;
}

const SCOPE = 'https://management.azure.com/.default';

export class VendorEventTraceService {
  private readonly credential = new DefaultAzureCredential();

  private get workspaceId(): string {
    const id = process.env['LOG_ANALYTICS_WORKSPACE_ID'];
    if (!id) {
      throw new Error(
        'LOG_ANALYTICS_WORKSPACE_ID environment variable is not set. ' +
        'This must be the ARM resource ID of the Log Analytics workspace ' +
        '(e.g. /subscriptions/.../resourceGroups/.../providers/Microsoft.OperationalInsights/workspaces/...).',
      );
    }
    return id;
  }

  async queryByVendorOrderId(vendorOrderId: string, hours: number = 24): Promise<VendorTraceTimeline[]> {
    const kql = `
customEvents
| where timestamp > ago(${Math.ceil(hours)}h)
| where name startswith "Vendor"
| extend corr = tostring(customDimensions.correlationId)
| extend vid = tostring(customDimensions.vendorOrderId)
| where vid == "${vendorOrderId.replace(/"/g, '')}"
| project name, timestamp, customDimensions
| order by timestamp asc
`.trim();

    const rows = await this.runQuery(kql);
    return this.buildTimelines(rows);
  }

  async queryByCorrelationId(correlationId: string, hours: number = 24): Promise<VendorTraceTimeline[]> {
    const kql = `
customEvents
| where timestamp > ago(${Math.ceil(hours)}h)
| where name startswith "Vendor"
| extend corr = tostring(customDimensions.correlationId)
| where corr == "${correlationId.replace(/"/g, '')}"
| project name, timestamp, customDimensions
| order by timestamp asc
`.trim();

    const rows = await this.runQuery(kql);
    return this.buildTimelines(rows);
  }

  private async runQuery(kql: string): Promise<LogAnalyticsRow[]> {
    const token = await this.credential.getToken(SCOPE);
    const url = `https://management.azure.com${this.workspaceId}/query?api-version=2022-10-01`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.token}`,
      },
      body: JSON.stringify({ query: kql }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Log Analytics query failed: HTTP ${response.status}. Body: ${body}`,
      );
    }

    const result = (await response.json()) as LogAnalyticsQueryResponse;
    const table = result.tables?.[0];
    if (!table) return [];

    const colIndex = (name: string) =>
      table.columns.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());

    const nameIdx = colIndex('name');
    const tsIdx = colIndex('timestamp');
    const propsIdx = colIndex('customDimensions');

    return table.rows.map((row) => ({
      name: String(row[nameIdx] ?? ''),
      timestamp: String(row[tsIdx] ?? ''),
      customDimensions: (row[propsIdx] as Record<string, string>) ?? {},
    }));
  }

  private buildTimelines(rows: LogAnalyticsRow[]): VendorTraceTimeline[] {
    const byCorrelation = new Map<string, LogAnalyticsRow[]>();

    for (const row of rows) {
      const corr = row.customDimensions['correlationId'] ?? 'unknown';
      if (!byCorrelation.has(corr)) byCorrelation.set(corr, []);
      byCorrelation.get(corr)!.push(row);
    }

    return Array.from(byCorrelation.entries()).map(([correlationId, hops]) => {
      const vendorOrderId = hops[0]?.customDimensions['vendorOrderId'] ?? 'unknown';
      const timestamps = hops.map((h) => h.timestamp).sort();
      return {
        correlationId,
        vendorOrderId,
        firstSeen: timestamps[0] ?? '',
        lastSeen: timestamps[timestamps.length - 1] ?? '',
        hops: hops.map((h) => ({
          name: h.name,
          timestamp: h.timestamp,
          correlationId,
          properties: h.customDimensions,
        })),
      };
    });
  }
}

export const vendorEventTraceService = new VendorEventTraceService();
