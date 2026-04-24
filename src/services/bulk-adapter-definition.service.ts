import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import { BUILT_IN_BULK_ADAPTER_DEFINITIONS } from './bulk-adapter-definitions.builtins.js';
import type {
  BulkAdapterDefinition,
  BulkAdapterDefinitionCanonicalFieldMapping,
  BulkAdapterDefinitionFieldRequirement,
  BulkAdapterDefinitionAnyOfRequirement,
  BulkAdapterDefinitionDocumentRequirement,
} from '../types/bulk-ingestion.types.js';

const CONTAINER = 'bulk-portfolio-jobs';
const DEFINITION_TYPE = 'bulk-adapter-definition';

export class BulkAdapterDefinitionService {
  private readonly logger = new Logger('BulkAdapterDefinitionService');

  constructor(private readonly dbService: CosmosDbService) {}

  async listDefinitions(
    tenantId: string,
    options?: { includeBuiltIns?: boolean },
  ): Promise<BulkAdapterDefinition[]> {
    this.assertTenantId(tenantId);

    const result = await this.dbService.queryItems<BulkAdapterDefinition>(
      CONTAINER,
      'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId',
      [
        { name: '@type', value: DEFINITION_TYPE },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success) {
      throw new Error(`Failed to list bulk adapter definitions for tenant '${tenantId}'`);
    }

    const tenantDefinitions = (result.data ?? []).map((definition) => this.normalizePersistedDefinition(definition));
    const includeBuiltIns = options?.includeBuiltIns ?? true;
    const merged = includeBuiltIns
      ? [...tenantDefinitions, ...BUILT_IN_BULK_ADAPTER_DEFINITIONS]
      : tenantDefinitions;

    return merged.sort((left, right) => {
      if ((left.isBuiltIn ?? false) !== (right.isBuiltIn ?? false)) {
        return left.isBuiltIn ? 1 : -1;
      }
      return left.adapterKey.localeCompare(right.adapterKey);
    });
  }

  async getDefinition(
    tenantId: string,
    adapterKey: string,
    options?: { includeBuiltIns?: boolean },
  ): Promise<BulkAdapterDefinition | null> {
    this.assertTenantId(tenantId);
    const normalizedAdapterKey = this.normalizeAdapterKey(adapterKey);
    if (!normalizedAdapterKey) {
      throw new Error('adapterKey is required to load a bulk adapter definition');
    }

    const definitions = await this.listDefinitions(tenantId, options);
    return definitions.find((definition) => definition.adapterKey === normalizedAdapterKey) ?? null;
  }

  async resolveDefinition(tenantId: string, adapterKey: string): Promise<BulkAdapterDefinition | null> {
    this.assertTenantId(tenantId);
    const normalizedAdapterKey = this.normalizeAdapterKey(adapterKey);
    if (!normalizedAdapterKey) {
      throw new Error('adapterKey is required to resolve a bulk adapter definition');
    }

    const definitions = await this.listDefinitions(tenantId);
    const candidates = definitions.filter((definition) => {
      if (definition.matchMode === 'EXACT') {
        return definition.adapterKey === normalizedAdapterKey;
      }
      return (
        definition.adapterKey === normalizedAdapterKey ||
        normalizedAdapterKey.startsWith(`${definition.adapterKey}-`)
      );
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => {
      const leftExact = left.adapterKey === normalizedAdapterKey ? 1 : 0;
      const rightExact = right.adapterKey === normalizedAdapterKey ? 1 : 0;
      if (leftExact !== rightExact) {
        return rightExact - leftExact;
      }
      if ((left.isBuiltIn ?? false) !== (right.isBuiltIn ?? false)) {
        return left.isBuiltIn ? 1 : -1;
      }
      return right.adapterKey.length - left.adapterKey.length;
    });

    return candidates[0] ?? null;
  }

  async createDefinition(params: {
    tenantId: string;
    adapterKey: string;
    name: string;
    description?: string;
    matchMode: BulkAdapterDefinition['matchMode'];
    sourceAdapter: string;
    documentRequirement?: BulkAdapterDefinitionDocumentRequirement;
    requiredFields?: BulkAdapterDefinitionFieldRequirement[];
    requiredAnyOf?: BulkAdapterDefinitionAnyOfRequirement[];
    canonicalFieldMappings: BulkAdapterDefinitionCanonicalFieldMapping[];
    staticCanonicalData?: Record<string, unknown>;
    notes?: string[];
  }): Promise<BulkAdapterDefinition> {
    const normalizedAdapterKey = this.normalizeAdapterKey(params.adapterKey);
    this.assertCreateOrUpdateParams({ ...params, adapterKey: normalizedAdapterKey });

    const existing = await this.getDefinition(params.tenantId, normalizedAdapterKey, { includeBuiltIns: false });
    if (existing) {
      throw new Error(
        `Bulk adapter definition '${normalizedAdapterKey}' already exists for tenant '${params.tenantId}'`,
      );
    }

    const now = new Date().toISOString();
    const definition: BulkAdapterDefinition = {
      id: `bulk-adapter-definition:${params.tenantId}:${normalizedAdapterKey}`,
      type: 'bulk-adapter-definition',
      tenantId: params.tenantId,
      adapterKey: normalizedAdapterKey,
      name: params.name.trim(),
      ...(params.description?.trim() ? { description: params.description.trim() } : {}),
      matchMode: params.matchMode,
      sourceAdapter: params.sourceAdapter.trim(),
      ...(params.documentRequirement ? { documentRequirement: params.documentRequirement } : {}),
      ...(params.requiredFields?.length ? { requiredFields: params.requiredFields } : {}),
      ...(params.requiredAnyOf?.length ? { requiredAnyOf: params.requiredAnyOf } : {}),
      canonicalFieldMappings: params.canonicalFieldMappings,
      ...(params.staticCanonicalData ? { staticCanonicalData: params.staticCanonicalData } : {}),
      ...(params.notes?.length ? { notes: params.notes } : {}),
      createdAt: now,
      updatedAt: now,
    };

    return this.persistDefinition(definition);
  }

  async updateDefinition(params: {
    tenantId: string;
    adapterKey: string;
    name: string;
    description?: string;
    matchMode: BulkAdapterDefinition['matchMode'];
    sourceAdapter: string;
    documentRequirement?: BulkAdapterDefinitionDocumentRequirement;
    requiredFields?: BulkAdapterDefinitionFieldRequirement[];
    requiredAnyOf?: BulkAdapterDefinitionAnyOfRequirement[];
    canonicalFieldMappings: BulkAdapterDefinitionCanonicalFieldMapping[];
    staticCanonicalData?: Record<string, unknown>;
    notes?: string[];
  }): Promise<BulkAdapterDefinition> {
    const normalizedAdapterKey = this.normalizeAdapterKey(params.adapterKey);
    this.assertCreateOrUpdateParams({ ...params, adapterKey: normalizedAdapterKey });

    const existing = await this.getDefinition(params.tenantId, normalizedAdapterKey, { includeBuiltIns: false });
    if (!existing) {
      throw new Error(
        `Bulk adapter definition '${normalizedAdapterKey}' was not found for tenant '${params.tenantId}'`,
      );
    }

    const definition: BulkAdapterDefinition = {
      id: existing.id,
      type: existing.type,
      tenantId: existing.tenantId,
      adapterKey: existing.adapterKey,
      name: params.name.trim(),
      ...(params.description?.trim() ? { description: params.description.trim() } : {}),
      matchMode: params.matchMode,
      sourceAdapter: params.sourceAdapter.trim(),
      ...(params.documentRequirement ? { documentRequirement: params.documentRequirement } : {}),
      ...(params.requiredFields?.length ? { requiredFields: params.requiredFields } : {}),
      ...(params.requiredAnyOf?.length ? { requiredAnyOf: params.requiredAnyOf } : {}),
      canonicalFieldMappings: params.canonicalFieldMappings,
      ...(params.staticCanonicalData ? { staticCanonicalData: params.staticCanonicalData } : {}),
      ...(params.notes?.length ? { notes: params.notes } : {}),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    return this.persistDefinition(definition);
  }

  async deleteDefinition(tenantId: string, adapterKey: string): Promise<boolean> {
    this.assertTenantId(tenantId);
    const normalizedAdapterKey = this.normalizeAdapterKey(adapterKey);
    if (!normalizedAdapterKey) {
      throw new Error('adapterKey is required to delete a bulk adapter definition');
    }

    const existing = await this.getDefinition(tenantId, normalizedAdapterKey, { includeBuiltIns: false });
    if (!existing) {
      return false;
    }

    const result = await this.dbService.deleteItem(CONTAINER, existing.id, tenantId);
    if (!result.success) {
      throw new Error(
        `Failed to delete bulk adapter definition '${normalizedAdapterKey}' for tenant '${tenantId}'`,
      );
    }

    this.logger.info('Bulk adapter definition deleted', {
      tenantId,
      adapterKey: normalizedAdapterKey,
    });

    return true;
  }

  private async persistDefinition(definition: BulkAdapterDefinition): Promise<BulkAdapterDefinition> {
    const result = await this.dbService.upsertItem<BulkAdapterDefinition>(CONTAINER, definition);
    if (!result.success || !result.data) {
      throw new Error(
        `Failed to persist bulk adapter definition '${definition.adapterKey}' for tenant '${definition.tenantId}'`,
      );
    }

    this.logger.info('Bulk adapter definition persisted', {
      tenantId: definition.tenantId,
      adapterKey: definition.adapterKey,
      matchMode: definition.matchMode,
      builtIn: definition.isBuiltIn ?? false,
    });

    return this.normalizePersistedDefinition(result.data);
  }

  private normalizePersistedDefinition(definition: BulkAdapterDefinition): BulkAdapterDefinition {
    return {
      ...definition,
      adapterKey: this.normalizeAdapterKey(definition.adapterKey),
      name: definition.name.trim(),
      sourceAdapter: definition.sourceAdapter.trim(),
      isBuiltIn: definition.isBuiltIn ?? false,
    };
  }

  private assertCreateOrUpdateParams(params: {
    tenantId: string;
    adapterKey: string;
    name: string;
    matchMode: BulkAdapterDefinition['matchMode'];
    sourceAdapter: string;
    canonicalFieldMappings: BulkAdapterDefinitionCanonicalFieldMapping[];
  }): void {
    this.assertTenantId(params.tenantId);
    if (!params.adapterKey) {
      throw new Error('adapterKey is required to persist a bulk adapter definition');
    }
    if (!params.name?.trim()) {
      throw new Error('name is required to persist a bulk adapter definition');
    }
    if (!params.sourceAdapter?.trim()) {
      throw new Error('sourceAdapter is required to persist a bulk adapter definition');
    }
    if (!params.canonicalFieldMappings?.length) {
      throw new Error('canonicalFieldMappings must contain at least one field mapping');
    }
  }

  private assertTenantId(tenantId: string): void {
    if (!tenantId?.trim()) {
      throw new Error('tenantId is required for bulk adapter definition operations');
    }
  }

  private normalizeAdapterKey(adapterKey: string): string {
    return adapterKey.trim().toLowerCase();
  }
}