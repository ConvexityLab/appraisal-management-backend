/**
 * OrderContextLoader — joins a VendorOrder with its parent ClientOrder
 * (and, when needed, the canonical PropertyRecord) to give callers the
 * full lender + vendor view in one read.
 *
 * Why this exists
 * ───────────────
 * Phase 3 of the Order-relocation refactor moves lender-supplied fields
 * (borrowerInformation, loanInformation, contactInformation,
 * propertyAddress, orderType, dueDate, rushOrder, …) off VendorOrder
 * onto ClientOrder, where they belong. Most consumers of those fields
 * still hold a VendorOrder reference at call time. Rather than make
 * every consumer re-derive the join, this helper provides:
 *
 *   loadByVendorOrderId(vendorOrderId)          → { vendorOrder, clientOrder, property? }
 *   loadByVendorOrder(vendorOrder)              → { vendorOrder, clientOrder, property? }
 *
 * The `clientOrder` field is null when the VendorOrder pre-dates the
 * ClientOrder split (legacy rows; backfill in Phase 9). Readers that
 * absolutely require lender context should treat `null` as a hard
 * error; readers that can fall back to legacy fields on the VendorOrder
 * itself can use `OrderContext.lenderField(name)` which prefers
 * ClientOrder and falls back to the deprecated VendorOrder field.
 *
 * Performance
 * ───────────
 * Each load is one cosmos read for the VendorOrder + (when not provided)
 * one read for the ClientOrder, both partition-scoped on `tenantId`. The
 * caller passes a VendorOrder by id OR by reference; passing the
 * reference avoids the first read. PropertyRecord is loaded only when
 * `loadByVendorOrder({ includeProperty: true })` is requested.
 *
 * Phase P6 boundary:
 * ─────────────────
 * This loader returns the canonical `PropertyRecord` row with observation-
 * derived AVM/tax/permit history overlaid for callers that opt into
 * `includeProperty: true`. That keeps canonical joins consistent with the
 * property API/read-model surface. Comp-selection/value-estimation flows still
 * keep their separate runtime AVM projections assembled for the current run.
 *
 * Concurrency / staleness
 * ───────────────────────
 * No caching. Each call re-reads. Callers that need a stable view
 * across multiple reads should hoist the OrderContext at the top of
 * their flow.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import { PropertyObservationService } from './property-observation.service.js';
import { materializePropertyRecordHistory } from './property-record-history-materializer.service.js';
import type { VendorOrder } from '../types/vendor-order.types.js';
import type {
  ClientOrder,
} from '../types/client-order.types.js';
import { CLIENT_ORDERS_CONTAINER } from '../types/client-order.types.js';
import type {
  BorrowerInfo,
  ContactInfo,
  LoanInfo,
  OrderType,
  PropertyAddress,
  PropertyDetails,
} from '../types/index.js';
import {
  OccupancyType,
  PropertyType,
} from '../types/index.js';
import type { PropertyRecord } from '../types/property-record.types.js';

// ─── Public types ────────────────────────────────────────────────────────────

export interface OrderContext {
  /** The vendor-fulfillment row from the `orders` container. */
  vendorOrder: VendorOrder;
  /**
   * The parent ClientOrder doc from the `client-orders` container, or
   * `null` for legacy rows that pre-date the ClientOrder split. Phase 9
   * backfill will populate these.
   */
  clientOrder: ClientOrder | null;
  /**
   * The canonical PropertyRecord, when loaded. Optional — loaded only
   * when the caller passes `{ includeProperty: true }`.
   */
  property?: PropertyRecord | null;
}

export interface LoadOptions {
  /** When true, also load the canonical PropertyRecord by `propertyId`. */
  includeProperty?: boolean;
}

function mergeDefined<T extends object>(...parts: Array<Partial<T> | undefined>): T | undefined {
  const merged: Record<string, unknown> = {};

  for (const part of parts) {
    if (!part) {
      continue;
    }

    for (const [key, value] of Object.entries(part)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged as T : undefined;
}

function mapCanonicalPropertyType(
  propertyType: PropertyRecord['propertyType'] | undefined,
): PropertyDetails['propertyType'] | undefined {
  switch (propertyType) {
    case 'single_family_residential':
      return PropertyType.SFR;
    case 'condominium':
      return PropertyType.CONDO;
    case 'townhome':
      return PropertyType.TOWNHOME;
    case 'multi_family':
      return PropertyType.MULTI_FAMILY;
    case 'manufactured_home':
      return PropertyType.MANUFACTURED;
    case 'land':
      return PropertyType.VACANT_LAND;
    case 'commercial':
      return PropertyType.COMMERCIAL;
    case 'mixed_use':
      return PropertyType.MIXED_USE;
    default:
      return undefined;
  }
}

function toCanonicalPropertyAddress(property: PropertyRecord): Partial<PropertyAddress> {
  const canonicalAddress: Partial<PropertyAddress> = {
    streetAddress: property.address.street,
    city: property.address.city,
    state: property.address.state,
    zipCode: property.address.zip,
  };

  if (property.address.county) {
    canonicalAddress.county = property.address.county;
  }
  if (property.apn) {
    canonicalAddress.apn = property.apn;
  }
  if (property.legalDescription) {
    canonicalAddress.legalDescription = property.legalDescription;
  }
  if (property.subdivision) {
    canonicalAddress.subdivision = property.subdivision;
  }
  if (property.address.latitude != null && property.address.longitude != null) {
    canonicalAddress.coordinates = {
      latitude: property.address.latitude,
      longitude: property.address.longitude,
    };
  }

  return canonicalAddress;
}

function toCanonicalPropertyDetails(property: PropertyRecord): Partial<PropertyDetails> {
  const canonicalDetails: Partial<PropertyDetails> = {
    yearBuilt: property.building.yearBuilt,
    grossLivingArea: property.building.gla,
    bedrooms: property.building.bedrooms,
    bathrooms: property.building.bathrooms,
  };

  if (typeof property.lotSizeSqFt === 'number') {
    canonicalDetails.lotSize = property.lotSizeSqFt;
  }

  if (typeof property.building.stories === 'number') {
    canonicalDetails.stories = property.building.stories;
  }

  if (typeof property.building.garageSpaces === 'number') {
    canonicalDetails.garage = property.building.garageSpaces > 0;
  }

  if (typeof property.building.pool === 'boolean') {
    canonicalDetails.pool = property.building.pool;
  }

  const propertyType = mapCanonicalPropertyType(property.propertyType);
  if (propertyType) {
    canonicalDetails.propertyType = propertyType;
  }

  if (typeof property.ownerOccupied === 'boolean') {
    canonicalDetails.occupancy = property.ownerOccupied
      ? OccupancyType.OWNER_OCCUPIED
      : OccupancyType.INVESTMENT;
  }

  if (property.building.condition) {
    canonicalDetails.condition = property.building.condition as unknown as NonNullable<PropertyDetails['condition']>;
  }

  if (property.building.constructionType) {
    canonicalDetails.constructionType = property.building.constructionType as unknown as NonNullable<PropertyDetails['constructionType']>;
  }

  return canonicalDetails;
}

// ─── Field accessors ────────────────────────────────────────────────────────
//
// These read a logical field, preferring the canonical PropertyRecord when it
// has been loaded, then falling back to ClientOrder (the workflow cache/new
// home) and finally the deprecated VendorOrder copy (legacy rows / pre-Phase-8).
// Once Phase 8 strips the deprecated fields, the final fallback branch goes away.

export function getPropertyAddress(ctx: OrderContext): PropertyAddress | undefined {
  const workflowAddress = ctx.clientOrder?.propertyAddress ?? ctx.vendorOrder.propertyAddress;
  const canonicalAddress = ctx.property ? toCanonicalPropertyAddress(ctx.property) : undefined;
  return mergeDefined<PropertyAddress>(workflowAddress, canonicalAddress);
}

export function getPropertyDetails(ctx: OrderContext): PropertyDetails | undefined {
  const workflowDetails = ctx.clientOrder?.propertyDetails ?? ctx.vendorOrder.propertyDetails;
  const canonicalDetails = ctx.property ? toCanonicalPropertyDetails(ctx.property) : undefined;
  return mergeDefined<PropertyDetails>(workflowDetails, canonicalDetails);
}

export function getOrderType(ctx: OrderContext): OrderType | undefined {
  return ctx.clientOrder?.orderType ?? ctx.vendorOrder.orderType;
}

export function getBorrowerInformation(ctx: OrderContext): BorrowerInfo | undefined {
  return ctx.clientOrder?.borrowerInformation ?? ctx.vendorOrder.borrowerInformation;
}

export function getLoanInformation(ctx: OrderContext): LoanInfo | undefined {
  return ctx.clientOrder?.loanInformation ?? ctx.vendorOrder.loanInformation;
}

export function getContactInformation(ctx: OrderContext): ContactInfo | undefined {
  return ctx.clientOrder?.contactInformation ?? ctx.vendorOrder.contactInformation;
}

export function getDueDate(ctx: OrderContext): Date | string | undefined {
  return ctx.clientOrder?.dueDate ?? ctx.vendorOrder.dueDate;
}

export function getRushOrder(ctx: OrderContext): boolean | undefined {
  return ctx.clientOrder?.rushOrder ?? ctx.vendorOrder.rushOrder;
}

export function getSpecialInstructions(ctx: OrderContext): string | undefined {
  return ctx.clientOrder?.specialInstructions ?? ctx.vendorOrder.specialInstructions;
}

export function getTags(ctx: OrderContext): string[] | undefined {
  return ctx.clientOrder?.tags ?? ctx.vendorOrder.tags;
}

export function getMetadata(ctx: OrderContext): Record<string, unknown> | undefined {
  return ctx.clientOrder?.metadata ?? (ctx.vendorOrder.metadata as Record<string, unknown> | undefined);
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export class OrderContextLoader {
  private readonly logger = new Logger('OrderContextLoader');
  private readonly observationService: PropertyObservationService;

  constructor(private readonly dbService: CosmosDbService) {
    this.observationService = new PropertyObservationService(dbService);
  }

  /**
   * Load a complete OrderContext starting from a VendorOrder id.
   * One cosmos read for the VendorOrder, one for the ClientOrder, plus
   * optionally one more for the PropertyRecord.
   *
   * Throws when the VendorOrder is not found. Returns `clientOrder: null`
   * (not an error) when the VendorOrder doesn't carry a `clientOrderId`
   * — this is expected for legacy rows.
   */
  async loadByVendorOrderId(vendorOrderId: string, opts: LoadOptions = {}): Promise<OrderContext> {
    const voResult = await this.dbService.findOrderById(vendorOrderId);
    if (!voResult.success || !voResult.data) {
      throw new Error(
        `OrderContextLoader: VendorOrder '${vendorOrderId}' not found ` +
        `(${voResult.error?.message ?? 'no data'})`,
      );
    }
    return this.loadByVendorOrder(voResult.data, opts);
  }

  /**
   * Load a complete OrderContext when the caller already has the
   * VendorOrder in hand. One cosmos read for the ClientOrder, plus
   * optionally one more for the PropertyRecord.
   */
  async loadByVendorOrder(
    vendorOrder: VendorOrder,
    opts: LoadOptions = {},
  ): Promise<OrderContext> {
    const clientOrder = await this.loadClientOrderForVendor(vendorOrder);

    if (opts.includeProperty) {
      const property = await this.loadProperty(vendorOrder, clientOrder);
      return { vendorOrder, clientOrder, property };
    }

    return { vendorOrder, clientOrder };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async loadClientOrderForVendor(
    vendorOrder: VendorOrder,
  ): Promise<ClientOrder | null> {
    const clientOrderId = vendorOrder.clientOrderId;
    const tenantId = vendorOrder.tenantId;

    if (!clientOrderId) {
      // Legacy row written before Phase 1 (no clientOrderId). Phase 9
      // backfill will populate these; for now, signal "no ClientOrder
      // available" so callers can choose to throw or fall back.
      return null;
    }
    if (!tenantId) {
      this.logger.warn('VendorOrder has clientOrderId but no tenantId — cannot resolve partition', {
        vendorOrderId: vendorOrder.id,
        clientOrderId,
      });
      return null;
    }

    try {
      const container = this.dbService.getContainer(CLIENT_ORDERS_CONTAINER);
      const { resource } = await container.item(clientOrderId, tenantId).read<ClientOrder>();
      return resource ?? null;
    } catch (err) {
      // Treat 404 / not-found as "no ClientOrder" rather than an error;
      // any other failure logs and returns null so the caller can decide.
      const code = (err as { code?: number; statusCode?: number }).code
        ?? (err as { code?: number; statusCode?: number }).statusCode;
      if (code === 404) {
        return null;
      }
      this.logger.warn('Failed to load ClientOrder for VendorOrder', {
        vendorOrderId: vendorOrder.id,
        clientOrderId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async loadProperty(
    vendorOrder: VendorOrder,
    clientOrder: ClientOrder | null,
  ): Promise<PropertyRecord | null> {
    const propertyId = clientOrder?.propertyId ?? vendorOrder.propertyId;
    const tenantId = vendorOrder.tenantId;
    if (!propertyId || !tenantId) {
      return null;
    }
    try {
      const container = this.dbService.getContainer('property-records');
      const { resource } = await container.item(propertyId, tenantId).read<PropertyRecord>();
      if (!resource) {
        return null;
      }

      const observations = await this.observationService.listByPropertyId(propertyId, tenantId);
      return materializePropertyRecordHistory(resource, observations);
    } catch (err) {
      const code = (err as { code?: number; statusCode?: number }).code
        ?? (err as { code?: number; statusCode?: number }).statusCode;
      if (code === 404) return null;
      this.logger.warn('Failed to load PropertyRecord for VendorOrder', {
        vendorOrderId: vendorOrder.id,
        propertyId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
