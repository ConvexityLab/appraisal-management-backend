/**
 * Duplicate Order Detection Service (Phase 1.12)
 *
 * Checks for potential duplicate orders at intake by matching on
 * property address + borrower name + date range. Returns advisory
 * warnings (not hard blocks) with links to existing orders.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { VENDOR_ORDER_TYPE_PREDICATE, type VendorOrder } from '../types/vendor-order.types.js';
import { PropertyRecordService } from './property-record.service.js';
import {
  getPropertyAddress,
  getBorrowerInformation,
  type OrderContext,
} from './order-context-loader.service.js';
import type { PropertyRecord } from '../types/property-record.types.js';

export interface DuplicateCheckRequest {
  /** Street address of the subject property */
  propertyAddress: string;
  /** City */
  city?: string;
  /** State (2-letter) */
  state?: string;
  /** ZIP code */
  zipCode?: string;
  /** Borrower first name */
  borrowerFirstName?: string;
  /** Borrower last name */
  borrowerLastName?: string;
  /** Tenant scope */
  tenantId: string;
  /** Exclude this order ID (for re-checks on existing orders) */
  excludeOrderId?: string;
}

export interface DuplicateMatch {
  orderId: string;
  orderNumber: string;
  matchType: 'ADDRESS' | 'ADDRESS_AND_BORROWER';
  matchScore: number; // 0–100
  existingStatus: string;
  existingCreatedAt: string;
  propertyAddress: string;
  borrowerName?: string;
}

export interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean;
  matches: DuplicateMatch[];
  checkedAt: string;
}

interface CandidateOrderLookupResult {
  orders: VendorOrder[];
  lookupMode: 'canonical-property' | 'legacy-embedded-address';
  canonicalAddress?: string;
}

/**
 * Normalize an address string for fuzzy comparison:
 * lowercase, collapse whitespace, strip punctuation, normalize common abbreviations.
 */
export function normalizeAddress(raw: string): string {
  let norm = raw.toLowerCase().trim();
  // Collapse multiple spaces
  norm = norm.replace(/\s+/g, ' ');
  // Strip punctuation except hyphens in unit numbers
  norm = norm.replace(/[.,#]/g, '');
  // Normalize common abbreviations
  const abbreviations: Record<string, string> = {
    'street': 'st',
    'avenue': 'ave',
    'boulevard': 'blvd',
    'drive': 'dr',
    'lane': 'ln',
    'road': 'rd',
    'court': 'ct',
    'circle': 'cir',
    'place': 'pl',
    'terrace': 'ter',
    'highway': 'hwy',
    'parkway': 'pkwy',
    'north': 'n',
    'south': 's',
    'east': 'e',
    'west': 'w',
    'northeast': 'ne',
    'northwest': 'nw',
    'southeast': 'se',
    'southwest': 'sw',
    'apartment': 'apt',
    'suite': 'ste',
    'unit': 'unit',
  };
  for (const [full, abbr] of Object.entries(abbreviations)) {
    // Word-boundary replacement
    norm = norm.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  return norm;
}

/**
 * Normalize a person name for comparison: lowercase, trim, collapse whitespace.
 */
export function normalizeName(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

export class DuplicateOrderDetectionService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private propertyRecords: PropertyRecordService;

  /** Orders created within this many days of the new order are candidates */
  static readonly DATE_WINDOW_DAYS = 90;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('DuplicateOrderDetectionService');
    this.propertyRecords = new PropertyRecordService(dbService);
  }

  /**
   * Check for potential duplicate orders.
   * Returns advisory warnings — never blocks order creation.
   */
  async checkForDuplicates(request: DuplicateCheckRequest): Promise<DuplicateCheckResult> {
    const checkedAt = new Date().toISOString();
    const matches: DuplicateMatch[] = [];

    try {
      if (!request.propertyAddress) {
        return { hasPotentialDuplicates: false, matches: [], checkedAt };
      }

      const candidateLookup = await this.queryCandidateOrders(request);
      const candidates = candidateLookup.orders;
      const normalizedInput = normalizeAddress(request.propertyAddress);
      const normalizedBorrower = request.borrowerFirstName && request.borrowerLastName
        ? normalizeName(`${request.borrowerFirstName} ${request.borrowerLastName}`)
        : null;

      for (const order of candidates) {
        if (request.excludeOrderId && order.id === request.excludeOrderId) {
          continue;
        }

        // Phase 7: read lender-side fields through OrderContext so that
        // post-Phase-8 (when these fields no longer live on VendorOrder)
        // the accessors fall back to ClientOrder. Today the accessors
        // resolve directly off the VendorOrder copy without an extra
        // cosmos read — see synthesizeContext below.
        const ctx = synthesizeContext(order);

        const orderAddress = candidateLookup.canonicalAddress ?? extractAddressString(ctx);
        if (!orderAddress) continue;

        const addressMatch = candidateLookup.lookupMode === 'canonical-property'
          ? true
          : normalizedInput === normalizeAddress(orderAddress);

        if (!addressMatch) continue;

        // Address matches — check borrower for stronger match
        const orderBorrowerInfo = getBorrowerInformation(ctx);
        const orderBorrower = orderBorrowerInfo
          ? normalizeName(`${orderBorrowerInfo.firstName ?? ''} ${orderBorrowerInfo.lastName ?? ''}`.trim())
          : null;

        const borrowerMatch = normalizedBorrower && orderBorrower
          ? normalizedBorrower === orderBorrower
          : false;

        const matchType = borrowerMatch ? 'ADDRESS_AND_BORROWER' : 'ADDRESS';
        const matchScore = borrowerMatch ? 95 : 75;

        const borrowerNameVal = orderBorrowerInfo
          ? `${orderBorrowerInfo.firstName ?? ''} ${orderBorrowerInfo.lastName ?? ''}`.trim()
          : undefined;

        matches.push({
          orderId: order.id,
          orderNumber: (order as any).orderNumber ?? order.id,
          matchType,
          matchScore,
          existingStatus: (order as any).status ?? 'UNKNOWN',
          existingCreatedAt: order.createdAt instanceof Date
            ? order.createdAt.toISOString()
            : String(order.createdAt ?? ''),
          propertyAddress: orderAddress,
          ...(borrowerNameVal !== undefined && { borrowerName: borrowerNameVal }),
        });
      }

      // Sort by score descending
      matches.sort((a, b) => b.matchScore - a.matchScore);

      if (matches.length > 0) {
        this.logger.info('Potential duplicate orders detected', {
          inputAddress: request.propertyAddress,
          matchCount: matches.length,
          matchTypes: matches.map(m => m.matchType),
        });
      }

      return {
        hasPotentialDuplicates: matches.length > 0,
        matches,
        checkedAt,
      };
    } catch (error) {
      // Duplicate check is advisory — never fail the intake flow
      this.logger.error('Duplicate check failed (non-blocking)', { error });
      return { hasPotentialDuplicates: false, matches: [], checkedAt };
    }
  }

  /**
   * Query Cosmos for orders in the same tenant within the date window.
   * Uses the propertyAddress.state + propertyAddress.zipCode for initial filtering
   * to reduce the candidate set before in-memory address normalization.
   */
  private async queryCandidateOrders(request: DuplicateCheckRequest): Promise<CandidateOrderLookupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DuplicateOrderDetectionService.DATE_WINDOW_DAYS);

    const matchedProperty = await this.resolveCanonicalProperty(request);
    if (matchedProperty) {
      return {
        orders: await this.queryCandidateVendorOrdersByPropertyId(request, cutoffDate, matchedProperty.id),
        lookupMode: 'canonical-property',
        canonicalAddress: formatPropertyRecordAddress(matchedProperty),
      };
    }

    return {
      orders: await this.queryLegacyCandidateOrdersByEmbeddedAddress(request, cutoffDate),
      lookupMode: 'legacy-embedded-address',
    };
  }

  private async resolveCanonicalProperty(
    request: DuplicateCheckRequest,
  ): Promise<PropertyRecord | null> {
    if (!request.propertyAddress || !request.city || !request.state || !request.zipCode) {
      return null;
    }

    return this.propertyRecords.findByNormalizedAddress(
      {
        street: request.propertyAddress,
        city: request.city,
        state: request.state,
        zip: request.zipCode,
      },
      request.tenantId,
    );
  }

  private async queryCandidateVendorOrdersByPropertyId(
    request: DuplicateCheckRequest,
    cutoffDate: Date,
    propertyId: string,
  ): Promise<VendorOrder[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      throw new Error('Orders container not initialized');
    }

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.tenantId = @tenantId AND c.createdAt >= @cutoff AND c.propertyId = @propertyId`,
      parameters: [
        { name: '@tenantId', value: request.tenantId },
        { name: '@cutoff', value: cutoffDate.toISOString() },
        { name: '@propertyId', value: propertyId },
      ],
    }).fetchAll();

    return resources as VendorOrder[];
  }

  private async queryLegacyCandidateOrdersByEmbeddedAddress(
    request: DuplicateCheckRequest,
    cutoffDate: Date,
  ): Promise<VendorOrder[]> {

    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      throw new Error('Orders container not initialized');
    }

    let query = `SELECT * FROM c WHERE ${VENDOR_ORDER_TYPE_PREDICATE} AND c.tenantId = @tenantId AND c.createdAt >= @cutoff`;
    const parameters: Array<{ name: string; value: string }> = [
      { name: '@tenantId', value: request.tenantId },
      { name: '@cutoff', value: cutoffDate.toISOString() },
    ];

    // Compatibility path only: this branch remains for requests that cannot
    // yet resolve a canonical propertyId (for example, older callers that do
    // not send city/state/zip alongside the street line). The primary path now
    // queries VendorOrders by canonical propertyId instead of relying on these
    // deprecated embedded VendorOrder address fields.
    if (request.state) {
      query += ' AND c.propertyAddress.state = @state';
      parameters.push({ name: '@state', value: request.state.toUpperCase() });
    }

    if (request.zipCode) {
      query += ' AND c.propertyAddress.zipCode = @zip';
      parameters.push({ name: '@zip', value: request.zipCode });
    }

    const { resources } = await container.items.query({
      query,
      parameters,
    }).fetchAll();

    return resources as VendorOrder[];
  }

}

function formatPropertyRecordAddress(property: PropertyRecord): string {
  const parts = [
    property.address?.street,
    property.address?.city,
    property.address?.state,
    property.address?.zip,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

  return parts.join(', ');
}

/**
 * Wrap a VendorOrder in a synthetic OrderContext so the field accessors can
 * read its lender-side fields. Today this is a zero-cost wrapper because the
 * accessors fall back to the deprecated VendorOrder copy. Once Phase 8 strips
 * those fields, this synthesizeContext should be replaced with an actual
 * OrderContextLoader call (either upfront in batch via clientOrderIds, or
 * per-candidate as a follow-up cosmos read).
 */
function synthesizeContext(order: VendorOrder): OrderContext {
  return { vendorOrder: order, clientOrder: null };
}

function extractAddressString(ctx: OrderContext): string | null {
  const addr = getPropertyAddress(ctx);
  if (!addr) return null;
  if (typeof addr === 'string') return addr;
  return addr.streetAddress ?? null;
}
