/**
 * Property Record Service — Phase R1.1
 *
 * The canonical service for the PropertyRecord aggregate root.
 * A PropertyRecord is the stable, versioned physical asset that ALL work
 * entities (engagements, orders, construction loans, ARV analyses, reviews)
 * reference via their `propertyId` FK.
 *
 * Responsibilities:
 *   - Find an existing PropertyRecord by APN or normalized address
 *   - Resolve an incoming address/APN to a PropertyRecord.id, creating a new
 *     record only when no existing match is found (explicit find-then-create;
 *     no Cosmos SDK createIfNotExists)
 *   - Version a PropertyRecord when material characteristics change
 *
 * Cosmos container: `property-records`  (partition key: /tenantId)
 *
 * This service does NOT create the Cosmos container.
 * The container MUST be provisioned via Bicep before this service runs.
 *
 * @see PROPERTY_DATA_REFACTOR_PLAN.md — Phase R1.1
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { PropertyRecordType } from '../types/property-record.types.js';
import type {
  PropertyRecord,
  CanonicalAddress,
  PropertyVersionEntry,
  CreatePropertyRecordInput,
  PropertyResolutionResult,
  PropertyIdResolutionMethod,
} from '../types/property-record.types.js';

// ─── Container name constant ──────────────────────────────────────────────────

export const PROPERTY_RECORDS_CONTAINER = 'property-records';

// ─── Address normalization (pure, sync) ───────────────────────────────────────

/**
 * Maps common full-form street suffixes and USPS variants to a single canonical
 * abbreviation. Applied word-by-word in normalizeStreetForMatch so that "DRIVE"
 * and "DR" compare equal regardless of which form the caller or the ATTOM CSV
 * data uses.
 *
 * Source: USPS Publication 28, Appendix C1 (most common suffixes only — not
 * the full ~800-entry table, which is overkill for a match helper).
 *
 * Only full-form / alternate-form entries are listed here. USPS standard
 * abbreviations (DR, AVE, …) are already in canonical form and need no mapping.
 */
export const STREET_SUFFIX_CANONICAL: Readonly<Record<string, string>> = {
  ALLEY: 'ALY', ALLY: 'ALY',
  AVENUE: 'AVE', AV: 'AVE',
  BOULEVARD: 'BLVD', BOULV: 'BLVD',
  CIRCLE: 'CIR', CIRC: 'CIR', CIRCL: 'CIR',
  COURT: 'CT',
  COVE: 'CV',
  CROSSING: 'XING', CRSSNG: 'XING',
  DRIVE: 'DR', DRV: 'DR',
  EXPRESSWAY: 'EXPY', EXPWY: 'EXPY',
  FREEWAY: 'FWY', FRWY: 'FWY',
  HIGHWAY: 'HWY', HIGHWY: 'HWY', HIWAY: 'HWY', HIWY: 'HWY',
  LANE: 'LN',
  PARKWAY: 'PKWY', PARKWY: 'PKWY', PKWAY: 'PKWY', PWY: 'PKWY',
  PLACE: 'PL',
  ROAD: 'RD',
  SQUARE: 'SQ',
  STREET: 'ST',
  TERRACE: 'TER', TERR: 'TER',
  TRAIL: 'TRL', TRAILS: 'TRL',
  TURNPIKE: 'TPKE', TURNPK: 'TPKE',
} as const;

/**
 * Maps full-word USPS directionals to their single-letter abbreviations so that
 * "1949 SEVILLA BLVD WEST" and "1949 SEVILLA BLVD W" compare equal. Applied
 * word-by-word in normalizeStreetForMatch alongside the suffix map.
 *
 * Source: USPS Publication 28, Appendix C2.
 */
export const STREET_DIRECTION_CANONICAL: Readonly<Record<string, string>> = {
  NORTH: 'N',
  SOUTH: 'S',
  EAST: 'E',
  WEST: 'W',
  NORTHEAST: 'NE',
  NORTHWEST: 'NW',
  SOUTHEAST: 'SE',
  SOUTHWEST: 'SW',
} as const;

/**
 * Returns a normalized form of a street string for fuzzy matching.
 * Uppercases, strips punctuation, collapses whitespace, and maps common full-form
 * street suffixes (e.g. "DRIVE" → "DR", "AVENUE" → "AVE") and directionals
 * ("WEST" → "W") to their USPS abbreviations so that addresses submitted with
 * either form compare equal.
 *
 * This is NOT a full USPS normalization — it is a best-effort match helper.
 * Full USPS normalization is AddressService's domain.
 */
export function normalizeStreetForMatch(street: string): string {
  return street
    .toUpperCase()
    .replace(/[.,#']/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')     // collapse whitespace
    .trim()
    .split(' ')
    .map(word =>
      STREET_SUFFIX_CANONICAL[word] ??
      STREET_DIRECTION_CANONICAL[word] ??
      word,
    )
    .join(' ');
}

/**
 * Returns a normalized city string for matching.
 */
function normCity(city: string): string {
  return city.toUpperCase().trim();
}

/**
 * Returns a 5-digit ZIP code regardless of whether the input includes ZIP+4.
 */
export function zip5(zip: string): string {
  return (zip ?? '').replace(/\s/g, '').split('-')[0]!.padEnd(5, ' ').slice(0, 5).trim();
}

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Minimum input to resolveOrCreate.
 * APN is optional — but providing it dramatically improves match accuracy.
 */
export interface ResolveOrCreateInput {
  address: CanonicalAddress;
  apn?: string;
  /** Optional characteristic hints used ONLY when creating a new PropertyRecord. */
  propertyType?: PropertyRecordType;
  building?: Partial<PropertyRecord['building']>;
  tenantId: string;
  createdBy: string;
}

// ─── PropertyRecordService ────────────────────────────────────────────────────

export class PropertyRecordService {
  private readonly logger = new Logger('PropertyRecordService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `prop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ─── findByApn ──────────────────────────────────────────────────────────────

  /**
   * Finds an existing PropertyRecord by Assessor Parcel Number.
   * Returns null if not found. APN must be non-empty.
   *
   * @throws if tenantId is empty
   */
  async findByApn(apn: string, tenantId: string): Promise<PropertyRecord | null> {
    if (!apn || !apn.trim()) {
      return null;
    }
    if (!tenantId) {
      throw new Error('PropertyRecordService.findByApn: tenantId is required');
    }

    const results = await this.cosmosService.queryDocuments<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.apn = @apn',
      [
        { name: '@tenantId', value: tenantId },
        { name: '@apn',      value: apn.trim() },
      ]
    );

    if (results.length > 1) {
      this.logger.warn('findByApn: multiple PropertyRecords share the same APN', {
        apn,
        tenantId,
        count: results.length,
        ids: results.map((r) => r.id),
      });
    }

    return results[0] ?? null;
  }

  // ─── findByNormalizedAddress ─────────────────────────────────────────────────

  /**
   * Finds an existing PropertyRecord by normalized address.
   *
   * Strategy:
   *   1. Query Cosmos for all records matching zipCode + state (indexed, fast).
   *   2. Client-side: compare normalized street + city.
   *
   * Uses simple uppercase/punctuation-strip normalization — NOT USPS lookup.
   * Returns the first match, or null.
   *
   * @throws if tenantId is empty
   */
  async findByNormalizedAddress(
    address: CanonicalAddress,
    tenantId: string
  ): Promise<PropertyRecord | null> {
    if (!tenantId) {
      throw new Error(
        'PropertyRecordService.findByNormalizedAddress: tenantId is required'
      );
    }

    const normalizedZip = zip5(address.zip);
    const normalizedState = address.state.toUpperCase();

    // Pull all records for this zip+state — typically a small set (< 50)
    const candidates = await this.cosmosService.queryDocuments<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.address.zip = @zip AND c.address.state = @state',
      [
        { name: '@tenantId', value: tenantId },
        { name: '@zip',      value: normalizedZip },
        { name: '@state',    value: normalizedState },
      ]
    );

    if (candidates.length === 0) {
      return null;
    }

    const inStreet = normalizeStreetForMatch(address.street);
    const inCity   = normCity(address.city);

    for (const record of candidates) {
      const recStreet = normalizeStreetForMatch(record.address.street);
      const recCity   = normCity(record.address.city);

      if (recStreet === inStreet && recCity === inCity) {
        return record;
      }
    }

    return null;
  }

  // ─── resolveOrCreate ────────────────────────────────────────────────────────

  /**
   * Resolves an address/APN to an existing PropertyRecord.id, or creates a
   * new PropertyRecord when no match is found.
   *
   * Resolution order:
   *   1. If APN is provided: exact APN match
   *   2. Normalized address match (zip + state + street + city)
   *   3. Create a new PropertyRecord (isNew = true)
   *
   * Idempotent: calling twice with the same APN (or the same normalized address
   * when no APN is available) returns the same propertyId both times.
   *
   * IMPORTANT: This method contains an explicit find-then-create sequence.
   * It does NOT use any Cosmos SDK "createIfNotExists" or upsert-on-conflict
   * feature. The check is purely application-level.
   *
   * @throws if tenantId is empty
   * @throws if address fields are missing required values
   */
  async resolveOrCreate(input: ResolveOrCreateInput): Promise<PropertyResolutionResult> {
    if (!input.tenantId) {
      throw new Error('PropertyRecordService.resolveOrCreate: tenantId is required');
    }
    if (!input.address.street || !input.address.city || !input.address.state || !input.address.zip) {
      throw new Error(
        'PropertyRecordService.resolveOrCreate: address.street, city, state, and zip are all required'
      );
    }
    if (!input.createdBy) {
      throw new Error('PropertyRecordService.resolveOrCreate: createdBy is required');
    }

    // ── Step 1: APN lookup ─────────────────────────────────────────────────
    if (input.apn) {
      const byApn = await this.findByApn(input.apn, input.tenantId);
      if (byApn) {
        this.logger.info('resolveOrCreate: resolved by APN', {
          apn: input.apn,
          propertyId: byApn.id,
          tenantId: input.tenantId,
        });
        return { propertyId: byApn.id, isNew: false, method: 'APN_MATCH' };
      }
    }

    // ── Step 2: Address lookup ─────────────────────────────────────────────
    const byAddress = await this.findByNormalizedAddress(input.address, input.tenantId);
    if (byAddress) {
      this.logger.info('resolveOrCreate: resolved by normalized address', {
        address: input.address.street,
        propertyId: byAddress.id,
        tenantId: input.tenantId,
      });
      return { propertyId: byAddress.id, isNew: false, method: 'ADDRESS_NORM' };
    }

    // ── Step 3: Create new PropertyRecord ─────────────────────────────────
    const method: PropertyIdResolutionMethod = input.apn ? 'APN_MATCH' : 'ADDRESS_NORM';
    const newRecord = await this.createRecord({
      address: input.address,
      ...(input.apn !== undefined && { apn: input.apn }),
      propertyType: input.propertyType ?? PropertyRecordType.SINGLE_FAMILY,
      ...(input.building !== undefined && { building: input.building }),
      dataSource: 'MANUAL_ENTRY',
      tenantId: input.tenantId,
      createdBy: input.createdBy,
    });

    this.logger.info('resolveOrCreate: created new PropertyRecord', {
      propertyId: newRecord.id,
      apn: input.apn,
      street: input.address.street,
      tenantId: input.tenantId,
    });

    return { propertyId: newRecord.id, isNew: true, method };
  }

  // ─── getById ────────────────────────────────────────────────────────────────

  /**
   * Retrieves a PropertyRecord by its internal ID.
   *
   * @throws if the record is not found
   */
  async getById(id: string, tenantId: string): Promise<PropertyRecord> {
    if (!id) {
      throw new Error('PropertyRecordService.getById: id is required');
    }
    if (!tenantId) {
      throw new Error('PropertyRecordService.getById: tenantId is required');
    }

    const record = await this.cosmosService.getDocument<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      id,
      tenantId
    );

    if (!record) {
      throw new Error(
        `PropertyRecordService.getById: PropertyRecord "${id}" not found ` +
        `for tenant "${tenantId}"`
      );
    }

    return record;
  }

  // ─── getVersionHistory ───────────────────────────────────────────────────────

  /**
   * Returns the full version history for a PropertyRecord.
   *
   * @throws if the record is not found
   */
  async getVersionHistory(id: string, tenantId: string): Promise<PropertyVersionEntry[]> {
    const record = await this.getById(id, tenantId);
    return record.versionHistory;
  }

  // ─── createVersion ───────────────────────────────────────────────────────────

  /**
   * Creates a new version of an existing PropertyRecord.
   *
   * Increments `recordVersion`, appends an entry to `versionHistory`, merges
   * the `changes` into the current record, and upserts.
   *
   * `changes` is a Partial<PropertyRecord> — only provide the fields that
   * actually changed. All other fields are carried forward unchanged.
   *
   * NOTE: Only top-level and `building.*` fields are diffed for `changedFields`.
   *       Deep diffing of `taxAssessments` and `permits` is not performed here —
   *       those arrays have their own append helpers.
   *
   * @throws if the record is not found
   * @throws if reason or source is empty
   */
  async createVersion(
    id: string,
    tenantId: string,
    changes: Partial<Omit<PropertyRecord, 'id' | 'tenantId' | 'recordVersion' | 'versionHistory' | 'createdAt' | 'createdBy'>>,
    reason: string,
    source: PropertyVersionEntry['source'],
    changedBy: string,
    sourceProvider?: string,
    sourceArtifactId?: string,
  ): Promise<PropertyRecord> {
    if (!reason || !reason.trim()) {
      throw new Error('PropertyRecordService.createVersion: reason is required');
    }
    if (!changedBy) {
      throw new Error('PropertyRecordService.createVersion: changedBy is required');
    }

    const existing = await this.getById(id, tenantId);
    const newVersion = existing.recordVersion + 1;
    const now = new Date().toISOString();

    // Capture which top-level fields changed (best-effort)
    const changedFields: string[] = [];
    for (const key of Object.keys(changes) as Array<keyof typeof changes>) {
      if (key === 'building' && changes.building) {
        for (const bKey of Object.keys(changes.building)) {
          changedFields.push(`building.${bKey}`);
        }
      } else {
        changedFields.push(key);
      }
    }

    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    
    for (const field of changedFields) {
      if (field.startsWith('building.')) {
        const bKey = field.slice('building.'.length);
        previousValues[field] = (existing.building as Record<string, unknown>)[bKey];
        newValues[field] = (changes.building as Record<string, unknown>)[bKey];
      } else {
        previousValues[field] = (existing as unknown as Record<string, unknown>)[field];
        newValues[field] = (changes as Record<string, unknown>)[field];
      }
    }

    const historyEntry: PropertyVersionEntry = {
      version: newVersion,
      createdAt: now,
      createdBy: changedBy,
      reason,
      source,
      ...(sourceProvider ? { sourceProvider } : {}),
      ...(sourceArtifactId ? { sourceArtifactId } : {}),
      changedFields,
      previousValues,
      newValues,
    };

    const updated: PropertyRecord = {
      ...existing,
      ...changes,
      building: changes.building
        ? { ...existing.building, ...changes.building }
        : existing.building,
      recordVersion: newVersion,
      versionHistory: [...existing.versionHistory, historyEntry],
      updatedAt: now,
    };

    const result = await this.cosmosService.upsertDocument<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      updated
    );

    this.logger.info('PropertyRecord version created', {
      id,
      tenantId,
      newVersion,
      reason,
      source,
      changedBy,
    });

    return result;
  }

  // ─── createRecord (private) ──────────────────────────────────────────────────

  /**
   * Creates a brand-new PropertyRecord at version 1.
   * Called only by resolveOrCreate after both lookup strategies have missed.
   */
  private async createRecord(input: CreatePropertyRecordInput): Promise<PropertyRecord> {
    const now = new Date().toISOString();
    const id = this.generateId();

    // Normalize address fields before storing
    const address: CanonicalAddress = {
      ...input.address,
      street: normalizeStreetForMatch(input.address.street),
      city: normCity(input.address.city),
      state: input.address.state.toUpperCase(),
      zip: zip5(input.address.zip),
    };

    const initialHistory: PropertyVersionEntry = {
      version: 1,
      createdAt: now,
      createdBy: input.createdBy,
      reason: 'Initial property record creation',
      source: input.dataSource === 'MANUAL_ENTRY' ? 'MANUAL_CORRECTION' : 'PUBLIC_RECORDS_API',
      changedFields: [],
      previousValues: {},
      newValues: {},
    };

    const record: PropertyRecord = {
      id,
      tenantId: input.tenantId,
      ...(input.apn !== undefined && { apn: input.apn }),
      address,
      propertyType: input.propertyType ?? PropertyRecordType.SINGLE_FAMILY,
      building: {
        gla: input.building?.gla ?? 0,
        yearBuilt: input.building?.yearBuilt ?? 0,
        bedrooms: input.building?.bedrooms ?? 0,
        bathrooms: input.building?.bathrooms ?? 0,
        ...input.building,
      },
      taxAssessments: [],
      permits: [],
      recordVersion: 1,
      versionHistory: [initialHistory],
      dataSource: input.dataSource,
      ...(input.dataSourceRecordId !== undefined && { dataSourceRecordId: input.dataSourceRecordId }),
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };

    const created = await this.cosmosService.createDocument<PropertyRecord>(
      PROPERTY_RECORDS_CONTAINER,
      record
    );

    return created;
  }
}
