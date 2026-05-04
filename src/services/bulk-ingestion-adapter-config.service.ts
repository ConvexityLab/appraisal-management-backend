import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import type {
  BulkIngestionAdapterConfig,
  BulkIngestionAdapterEngagementFieldMapping,
  BulkIngestionItemInput,
} from '../types/bulk-ingestion.types.js';

const CONTAINER = 'bulk-portfolio-jobs';
const CONFIG_TYPE = 'bulk-ingestion-adapter-config';

export interface BulkIngestionResolvedEngagementFields {
  borrowerName?: string;
  loanAmount?: number;
  email?: string;
  phone?: string;
}

export class BulkIngestionAdapterConfigService {
  private readonly logger = new Logger('BulkIngestionAdapterConfigService');

  constructor(private readonly dbService: CosmosDbService) {}

  async getConfig(tenantId: string, adapterKey: string): Promise<BulkIngestionAdapterConfig | null> {
    if (!tenantId) {
      throw new Error('tenantId is required to load bulk ingestion adapter config');
    }
    if (!adapterKey) {
      throw new Error('adapterKey is required to load bulk ingestion adapter config');
    }

    const result = await this.dbService.queryItems<BulkIngestionAdapterConfig>(
      CONTAINER,
      'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId',
      [
        { name: '@type', value: CONFIG_TYPE },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success) {
      throw new Error(
        `Failed to load bulk ingestion adapter config for tenant '${tenantId}' and adapterKey '${adapterKey}'`,
      );
    }

    const configs = result.data ?? [];
    if (configs.length === 0) {
      return null;
    }

    const normalizedAdapterKey = this.normalizeAdapterKey(adapterKey);
    const exactMatch = configs.find(
      (config) => this.normalizeAdapterKey(config.adapterKey) === normalizedAdapterKey,
    );
    if (exactMatch) {
      return exactMatch;
    }

    const prefixMatch = [...configs]
      .filter((config) => normalizedAdapterKey.startsWith(`${this.normalizeAdapterKey(config.adapterKey)}-`))
      .sort(
        (left, right) =>
          this.normalizeAdapterKey(right.adapterKey).length - this.normalizeAdapterKey(left.adapterKey).length,
      )[0];

    return prefixMatch ?? null;
  }

  async upsertConfig(params: {
    tenantId: string;
    adapterKey: string;
    engagementFieldMapping?: BulkIngestionAdapterEngagementFieldMapping;
  }): Promise<BulkIngestionAdapterConfig> {
    if (!params.tenantId) {
      throw new Error('tenantId is required to upsert bulk ingestion adapter config');
    }
    if (!params.adapterKey) {
      throw new Error('adapterKey is required to upsert bulk ingestion adapter config');
    }

    const normalizedAdapterKey = this.normalizeAdapterKey(params.adapterKey);
    const now = new Date().toISOString();
    const existing = await this.getConfig(params.tenantId, params.adapterKey);

    const config: BulkIngestionAdapterConfig = {
      id: existing?.id ?? `bulk-ingestion-adapter-config:${params.tenantId}:${normalizedAdapterKey}`,
      type: 'bulk-ingestion-adapter-config',
      tenantId: params.tenantId,
      adapterKey: normalizedAdapterKey,
      ...(params.engagementFieldMapping ? { engagementFieldMapping: params.engagementFieldMapping } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const result = await this.dbService.upsertItem<BulkIngestionAdapterConfig>(CONTAINER, config);
    if (!result.success || !result.data) {
      throw new Error(
        `Failed to persist bulk ingestion adapter config for tenant '${params.tenantId}' and adapterKey '${params.adapterKey}'`,
      );
    }

    this.logger.info('Bulk ingestion adapter config upserted', {
      tenantId: params.tenantId,
      adapterKey: normalizedAdapterKey,
      mappedFields: Object.keys(params.engagementFieldMapping ?? {}),
    });

    return result.data;
  }

  resolveEngagementFields(
    source: BulkIngestionItemInput,
    config: BulkIngestionAdapterConfig | null,
    context?: { jobId?: string; itemId?: string; rowIndex?: number },
  ): BulkIngestionResolvedEngagementFields {
    const rawColumns = source.rawColumns ?? {};
    const borrowerName =
      this.normalizeString(source.borrowerName) ??
      this.resolveMappedStringField(rawColumns, config, 'borrowerName', context);
    const loanAmount =
      (typeof source.loanAmount === 'number' && Number.isFinite(source.loanAmount)
        ? source.loanAmount
        : undefined) ??
      this.resolveMappedNumberField(rawColumns, config, 'loanAmount', context);
    const email =
      this.normalizeString(source.borrowerEmail) ??
      this.resolveMappedStringField(rawColumns, config, 'email', context);
    const phone =
      this.normalizeString(source.borrowerPhone) ??
      this.resolveMappedStringField(rawColumns, config, 'phone', context);

    return {
      ...(borrowerName ? { borrowerName } : {}),
      ...(loanAmount !== undefined ? { loanAmount } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    };
  }

  private resolveMappedStringField(
    rawColumns: Record<string, string>,
    config: BulkIngestionAdapterConfig | null,
    field: keyof BulkIngestionAdapterEngagementFieldMapping,
    context?: { jobId?: string; itemId?: string; rowIndex?: number },
  ): string | undefined {
    const value = this.resolveMappedColumnValue(rawColumns, config, field, context);
    return this.normalizeString(value);
  }

  private resolveMappedNumberField(
    rawColumns: Record<string, string>,
    config: BulkIngestionAdapterConfig | null,
    field: keyof BulkIngestionAdapterEngagementFieldMapping,
    context?: { jobId?: string; itemId?: string; rowIndex?: number },
  ): number | undefined {
    const value = this.resolveMappedColumnValue(rawColumns, config, field, context);
    if (value === undefined) {
      return undefined;
    }

    const sanitizedValue = value.replace(/[$,\s]/g, '');
    const parsed = Number(sanitizedValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `Bulk ingestion adapter config for tenant '${config?.tenantId ?? 'unknown'}' and adapterKey '${config?.adapterKey ?? 'unknown'}' ` +
        `resolved engagement field '${field}' to value '${value}', but a numeric value was required${this.describeContext(context)}`,
      );
    }

    return parsed;
  }

  private resolveMappedColumnValue(
    rawColumns: Record<string, string>,
    config: BulkIngestionAdapterConfig | null,
    field: keyof BulkIngestionAdapterEngagementFieldMapping,
    context?: { jobId?: string; itemId?: string; rowIndex?: number },
  ): string | undefined {
    const mappedColumn = config?.engagementFieldMapping?.[field];
    if (!mappedColumn) {
      return undefined;
    }

    const normalizedColumn = this.normalizeHeader(mappedColumn);
    if (!normalizedColumn) {
      throw new Error(
        `Bulk ingestion adapter config for tenant '${config.tenantId}' and adapterKey '${config.adapterKey}' maps engagement field '${field}' to an empty column name`,
      );
    }

    if (!Object.prototype.hasOwnProperty.call(rawColumns, normalizedColumn)) {
      throw new Error(
        `Bulk ingestion adapter config for tenant '${config.tenantId}' and adapterKey '${config.adapterKey}' maps engagement field '${field}' to column '${mappedColumn}', ` +
        `but that column is not present in the uploaded row${this.describeContext(context)}`,
      );
    }

    return rawColumns[normalizedColumn];
  }

  private normalizeAdapterKey(adapterKey: string): string {
    return adapterKey.trim().toLowerCase();
  }

  private normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeString(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private describeContext(context?: { jobId?: string; itemId?: string; rowIndex?: number }): string {
    if (!context) {
      return '';
    }

    const parts = [
      context.jobId ? `jobId='${context.jobId}'` : null,
      context.itemId ? `itemId='${context.itemId}'` : null,
      context.rowIndex !== undefined ? `rowIndex=${context.rowIndex}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }
}