import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger.js';
import type {
  CreateVendorConnectionInput,
  UpdateVendorConnectionInput,
  VendorConnection,
  VendorConnectionCredentials,
  VendorType,
} from '../../types/vendor-integration.types.js';
import type { CosmosDbService } from '../cosmos-db.service.js';
import {
  VendorConnectionConflictError,
  VendorConnectionNotFoundError,
  VendorConnectionValidationError,
} from './VendorIntegrationErrors.js';

type VendorConnectionDb = Pick<
  CosmosDbService,
  'createDocument' | 'getDocument' | 'queryDocuments' | 'upsertDocument'
>;

const VENDOR_CONNECTIONS_CONTAINER = 'vendor-connections';
const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'vendorType',
  'lenderId',
  'lenderName',
  'inboundIdentifier',
  'credentials',
  'outboundEndpointUrl',
  'active',
  'productMappings',
]);
const ALLOWED_CREDENTIAL_FIELDS = new Set([
  'inboundApiKeySecretName',
  'outboundApiKeySecretName',
  'outboundClientId',
  'inboundHmacSecretName',
  'outboundHmacSecretName',
]);

export interface VendorConnectionListFilters {
  vendorType?: string;
  activeOnly?: boolean;
}

export class VendorConnectionAdminService {
  private readonly logger = new Logger('VendorConnectionAdminService');

  constructor(private readonly db: VendorConnectionDb) {}

  async listConnections(tenantId: string, filters: VendorConnectionListFilters = {}): Promise<VendorConnection[]> {
    const conditions = ['c.tenantId = @tenantId'];
    const parameters: Array<{ name: string; value: unknown }> = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters.vendorType && filters.vendorType.trim()) {
      conditions.push('c.vendorType = @vendorType');
      parameters.push({ name: '@vendorType', value: filters.vendorType.trim() });
    }

    if (filters.activeOnly) {
      conditions.push('c.active = true');
    }

    const query = [
      'SELECT * FROM c',
      `WHERE ${conditions.join(' AND ')}`,
      'ORDER BY c.updatedAt DESC',
    ].join(' ');

    return this.db.queryDocuments<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, query, parameters);
  }

  async getConnection(id: string, tenantId: string): Promise<VendorConnection | null> {
    const connection = await this.db.getDocument<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, id, tenantId);
    if (!connection || connection.tenantId !== tenantId) {
      return null;
    }
    return connection;
  }

  async createConnection(
    tenantId: string,
    input: unknown,
    actorId: string,
  ): Promise<VendorConnection> {
    const parsed = this.parseCreateInput(input);
    await this.assertNoDuplicateActiveConnection(tenantId, parsed.vendorType, parsed.inboundIdentifier);

    const now = new Date().toISOString();
    const connection: VendorConnection = {
      id: uuidv4(),
      tenantId,
      type: 'vendor-connection',
      ...parsed,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    };

    const created = await this.db.createDocument<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, connection);
    this.logger.info('Vendor connection created', {
      connectionId: created.id,
      tenantId,
      vendorType: created.vendorType,
      inboundIdentifier: created.inboundIdentifier,
      active: created.active,
    });
    return created;
  }

  async updateConnection(
    id: string,
    tenantId: string,
    input: unknown,
    actorId: string,
  ): Promise<VendorConnection> {
    const existing = await this.getConnection(id, tenantId);
    if (!existing) {
      throw new VendorConnectionNotFoundError(`Vendor connection not found: id=${id} tenantId=${tenantId}`);
    }

    const updates = this.parseUpdateInput(input);
    const { productMappings: incomingMappings, ...otherUpdates } = updates;
    const mergedProductMappings = incomingMappings
      ? { ...(existing.productMappings ?? {}), ...incomingMappings }
      : existing.productMappings;

    const merged: VendorConnection = {
      ...existing,
      ...otherUpdates,
      credentials: otherUpdates.credentials ? { ...existing.credentials, ...otherUpdates.credentials } : existing.credentials,
      // Merge-not-replace: incoming keys are overlaid on top of existing ones so
      // a PATCH with a subset of mappings doesn't wipe the rest.
      ...(mergedProductMappings !== undefined ? { productMappings: mergedProductMappings } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };

    this.validateNormalizedConnection(merged, { requireExplicitActive: true });
    if (merged.active) {
      await this.assertNoDuplicateActiveConnection(tenantId, merged.vendorType, merged.inboundIdentifier, id);
    }

    const saved = await this.db.upsertDocument<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, merged);
    this.logger.info('Vendor connection updated', {
      connectionId: saved.id,
      tenantId,
      vendorType: saved.vendorType,
      inboundIdentifier: saved.inboundIdentifier,
      active: saved.active,
    });
    return saved;
  }

  async deactivateConnection(id: string, tenantId: string, actorId: string): Promise<VendorConnection> {
    const existing = await this.getConnection(id, tenantId);
    if (!existing) {
      throw new VendorConnectionNotFoundError(`Vendor connection not found: id=${id} tenantId=${tenantId}`);
    }

    if (!existing.active) {
      return existing;
    }

    const updated: VendorConnection = {
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    const saved = await this.db.upsertDocument<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, updated);
    this.logger.info('Vendor connection deactivated', {
      connectionId: saved.id,
      tenantId,
      vendorType: saved.vendorType,
      inboundIdentifier: saved.inboundIdentifier,
    });
    return saved;
  }

  private parseCreateInput(input: unknown): CreateVendorConnectionInput {
    this.assertPlainObject(input, 'request body');
    this.assertNoUnknownFields(input as Record<string, unknown>, ALLOWED_TOP_LEVEL_FIELDS, 'request body');
    const record = input as Record<string, unknown>;

    const parsed: CreateVendorConnectionInput = {
      vendorType: this.requireTrimmedString(record['vendorType'], 'vendorType') as VendorType,
      lenderId: this.requireTrimmedString(record['lenderId'], 'lenderId'),
      lenderName: this.requireTrimmedString(record['lenderName'], 'lenderName'),
      inboundIdentifier: this.requireTrimmedString(record['inboundIdentifier'], 'inboundIdentifier'),
      credentials: this.parseCredentials(record['credentials'], true),
      outboundEndpointUrl: this.requireValidOutboundEndpointUrl(record['outboundEndpointUrl']),
      active: this.requireBoolean(record['active'], 'active'),
    };

    if ('productMappings' in record) parsed.productMappings = this.requireProductMappings(record['productMappings']);

    this.validateNormalizedConnection(parsed as VendorConnection, { requireExplicitActive: true });
    return parsed;
  }

  private parseUpdateInput(input: unknown): UpdateVendorConnectionInput {
    this.assertPlainObject(input, 'request body');
    this.assertNoUnknownFields(input as Record<string, unknown>, ALLOWED_TOP_LEVEL_FIELDS, 'request body');
    const record = input as Record<string, unknown>;

    const updates: UpdateVendorConnectionInput = {};
    if ('vendorType' in record) updates.vendorType = this.requireTrimmedString(record['vendorType'], 'vendorType') as VendorType;
    if ('lenderId' in record) updates.lenderId = this.requireTrimmedString(record['lenderId'], 'lenderId');
    if ('lenderName' in record) updates.lenderName = this.requireTrimmedString(record['lenderName'], 'lenderName');
    if ('inboundIdentifier' in record) updates.inboundIdentifier = this.requireTrimmedString(record['inboundIdentifier'], 'inboundIdentifier');
    if ('credentials' in record) updates.credentials = this.parseCredentials(record['credentials'], false);
    if ('outboundEndpointUrl' in record) updates.outboundEndpointUrl = this.requireValidOutboundEndpointUrl(record['outboundEndpointUrl']);
    if ('active' in record) updates.active = this.requireBoolean(record['active'], 'active');
    if ('productMappings' in record) updates.productMappings = this.requireProductMappings(record['productMappings']);

    if (Object.keys(updates).length === 0) {
      throw new VendorConnectionValidationError('At least one updatable field is required in the request body.');
    }

    return updates;
  }

  /**
   * Patches productMappings on a connection without touching any other field.
   * Incoming mappings are merged (not replaced) into the existing set.
   */
  async patchProductMappings(
    id: string,
    tenantId: string,
    mappings: Record<string, string>,
    actorId: string,
  ): Promise<VendorConnection> {
    const existing = await this.getConnection(id, tenantId);
    if (!existing) {
      throw new VendorConnectionNotFoundError(`Vendor connection not found: id=${id} tenantId=${tenantId}`);
    }

    const updated: VendorConnection = {
      ...existing,
      productMappings: { ...(existing.productMappings ?? {}), ...mappings },
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };

    const saved = await this.db.upsertDocument<VendorConnection>(VENDOR_CONNECTIONS_CONTAINER, updated);
    this.logger.info('Vendor connection productMappings patched', {
      connectionId: saved.id,
      tenantId,
      vendorType: saved.vendorType,
      mappingCount: Object.keys(mappings).length,
    });
    return saved;
  }

  private requireProductMappings(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new VendorConnectionValidationError(
        `productMappings must be a JSON object mapping vendor product IDs to internal ProductType strings. Received: ${JSON.stringify(value)}.`,
      );
    }
    const record = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      if (typeof v !== 'string' || !v.trim()) {
        throw new VendorConnectionValidationError(
          `productMappings values must be non-empty strings (internal ProductType). Invalid entry: ${JSON.stringify(k)} → ${JSON.stringify(v)}.`,
        );
      }
    }
    return record as Record<string, string>;
  }

  private parseCredentials(input: unknown, requireAnyField: boolean): VendorConnectionCredentials {
    this.assertPlainObject(input, 'credentials');
    const record = input as Record<string, unknown>;
    this.assertNoUnknownFields(record, ALLOWED_CREDENTIAL_FIELDS, 'credentials');

    const credentials: VendorConnectionCredentials = {};
    if ('inboundApiKeySecretName' in record) {
      credentials.inboundApiKeySecretName = this.requireTrimmedString(record['inboundApiKeySecretName'], 'credentials.inboundApiKeySecretName');
    }
    if ('outboundApiKeySecretName' in record) {
      credentials.outboundApiKeySecretName = this.requireTrimmedString(record['outboundApiKeySecretName'], 'credentials.outboundApiKeySecretName');
    }
    if ('outboundClientId' in record) {
      credentials.outboundClientId = this.requireTrimmedString(record['outboundClientId'], 'credentials.outboundClientId');
    }
    if ('inboundHmacSecretName' in record) {
      credentials.inboundHmacSecretName = this.requireTrimmedString(record['inboundHmacSecretName'], 'credentials.inboundHmacSecretName');
    }
    if ('outboundHmacSecretName' in record) {
      credentials.outboundHmacSecretName = this.requireTrimmedString(record['outboundHmacSecretName'], 'credentials.outboundHmacSecretName');
    }

    if (requireAnyField && Object.keys(credentials).length === 0) {
      throw new VendorConnectionValidationError('credentials must include at least one configured secret or identifier field.');
    }

    return credentials;
  }

  private validateNormalizedConnection(
    connection: Pick<VendorConnection, 'vendorType' | 'lenderId' | 'lenderName' | 'inboundIdentifier' | 'credentials' | 'outboundEndpointUrl' | 'active'>,
    _options: { requireExplicitActive: boolean },
  ): void {
    if (connection.vendorType === 'aim-port') {
      const missingFields = [
        !connection.credentials.inboundApiKeySecretName ? 'credentials.inboundApiKeySecretName' : null,
        !connection.credentials.outboundApiKeySecretName ? 'credentials.outboundApiKeySecretName' : null,
        !connection.credentials.outboundClientId ? 'credentials.outboundClientId' : null,
      ].filter((value): value is string => value !== null);

      if (missingFields.length > 0) {
        throw new VendorConnectionValidationError(
          `AIM-Port connections require ${missingFields.join(', ')}. Missing fields: ${missingFields.join(', ')}.`,
        );
      }
    } else if (connection.vendorType === 'class-valuation') {
      const cvMissingFields = [
        !connection.credentials.inboundHmacSecretName ? 'credentials.inboundHmacSecretName' : null,
        !connection.credentials.outboundHmacSecretName ? 'credentials.outboundHmacSecretName' : null,
      ].filter((value): value is string => value !== null);

      if (cvMissingFields.length > 0) {
        throw new VendorConnectionValidationError(
          `ClassValuation connections require ${cvMissingFields.join(', ')}. Missing fields: ${cvMissingFields.join(', ')}.`,
        );
      }
    }
  }

  private async assertNoDuplicateActiveConnection(
    tenantId: string,
    vendorType: VendorType,
    inboundIdentifier: string,
    excludeId?: string,
  ): Promise<void> {
    const results = await this.db.queryDocuments<VendorConnection>(
      VENDOR_CONNECTIONS_CONTAINER,
      [
        'SELECT * FROM c',
        'WHERE c.tenantId = @tenantId',
        'AND c.vendorType = @vendorType',
        'AND c.inboundIdentifier = @inboundIdentifier',
        'AND c.active = true',
      ].join(' '),
      [
        { name: '@tenantId', value: tenantId },
        { name: '@vendorType', value: vendorType },
        { name: '@inboundIdentifier', value: inboundIdentifier },
      ],
    );

    const conflicting = results.find((connection) => connection.id !== excludeId);
    if (conflicting) {
      throw new VendorConnectionConflictError(
        `An active vendor connection already exists for vendorType=${vendorType} inboundIdentifier=${inboundIdentifier} (existingId=${conflicting.id}). ` +
        'Deactivate the existing connection or choose a different inboundIdentifier.',
      );
    }
  }

  private requireValidOutboundEndpointUrl(value: unknown): string {
    const trimmed = this.requireTrimmedString(value, 'outboundEndpointUrl');
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new VendorConnectionValidationError(
        `outboundEndpointUrl must be a valid absolute URL. Received: ${JSON.stringify(value)}.`,
      );
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new VendorConnectionValidationError(
        `outboundEndpointUrl must use http or https. Received protocol: ${parsed.protocol}.`,
      );
    }

    return parsed.toString();
  }

  private requireTrimmedString(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new VendorConnectionValidationError(
        `${field} must be a non-empty string. Received: ${JSON.stringify(value)}.`,
      );
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw new VendorConnectionValidationError(
        `${field} must be a non-empty string. Received: ${JSON.stringify(value)}.`,
      );
    }

    return trimmed;
  }

  private requireBoolean(value: unknown, field: string): boolean {
    if (typeof value !== 'boolean') {
      throw new VendorConnectionValidationError(
        `${field} must be a boolean. Received: ${JSON.stringify(value)}.`,
      );
    }
    return value;
  }

  private assertPlainObject(value: unknown, field: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new VendorConnectionValidationError(
        `${field} must be a JSON object. Received: ${JSON.stringify(value)}.`,
      );
    }
  }

  private assertNoUnknownFields(
    value: Record<string, unknown>,
    allowedFields: Set<string>,
    field: string,
  ): void {
    const unknownFields = Object.keys(value).filter((key) => !allowedFields.has(key));
    if (unknownFields.length > 0) {
      throw new VendorConnectionValidationError(
        `${field} contains unsupported fields: ${unknownFields.join(', ')}. Allowed fields: ${Array.from(allowedFields).join(', ')}.`,
      );
    }
  }
}