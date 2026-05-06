/**
 * Engagement-side order enums + property shape.
 *
 * What this file is NOT: the canonical Order/VendorOrder/ClientOrder types.
 * Those live in `index.ts` (Order), `vendor-order.types.ts` (VendorOrder),
 * and `client-order.types.ts` (ClientOrder). This file is the home for the
 * engagement-domain enums and the address-bearing PropertyDetails shape that
 * EngagementProperty uses.
 *
 * History: this file used to define `LegacyManagementOrder` plus a long tail
 * of supporting types (assignment history, BPO details, vendor profile,
 * workflows, notifications, search shapes…) for a parallel API surface
 * (`/api/enhanced-orders/*`). That API was deleted because it was wired only
 * to in-memory caches and `Math.random()` mock data — the controller, the
 * service, and the integration test were all unused. Anything that survived
 * here is consumed by the engagement domain or by integration tests.
 */

// OrderStatus — canonical definition lives in order-status.ts (single source of truth)
export { OrderStatus } from './order-status.js';

/**
 * Engagement / ClientOrder priority. Distinct value space from `Priority`
 * in index.ts (which is vendor-order-side: low/normal/high/urgent/rush).
 * This one mirrors what the lender requests on the engagement record.
 */
export enum OrderPriority {
  ROUTINE = 'ROUTINE',
  EXPEDITED = 'EXPEDITED',
  RUSH = 'RUSH',
  EMERGENCY = 'EMERGENCY',
}

/**
 * Work type. Retained for cosmos-db-integration tests that pre-date the
 * canonical `ProductType` const in product-catalog.ts (SCREAMING_SNAKE).
 * New code should import `ProductType` from product-catalog.ts; this enum
 * is on a deprecation path and can be removed once those tests migrate.
 */
export enum OrderType {
  FULL_APPRAISAL = 'FULL_APPRAISAL',
  DRIVE_BY = 'DRIVE_BY',
  EXTERIOR_ONLY = 'EXTERIOR_ONLY',
  DESKTOP = 'DESKTOP',
  BPO = 'BPO',
  AVB = 'AVB',
  FIELD_REVIEW = 'FIELD_REVIEW',
  DESK_REVIEW = 'DESK_REVIEW',
}

/**
 * SCREAMING_SNAKE vendor status used by integration tests. The lower-case
 * canonical `VendorStatus` lives in index.ts. Both exist because this
 * shape predates the canonical one — same migration story as OrderType.
 */
export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  BLACKLISTED = 'BLACKLISTED',
}

/**
 * Address-bearing property details for the engagement domain.
 *
 * EngagementProperty uses this shape. It carries the lender-supplied address
 * + coordinates + basic physicals — what the lender knows about the
 * property when the engagement lands. Distinct from the structural
 * `PropertyDetails` in index.ts (which is the post-extraction physicals
 * view: occupancy, GLA, lot size, condition, etc.) and from
 * `PropertyRecord` (the canonical aggregate root).
 */
export interface PropertyDetails {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  parcelNumber?: string;
  propertyType: 'SINGLE_FAMILY' | 'CONDO' | 'TOWNHOME' | 'MULTI_FAMILY' | 'COMMERCIAL' | 'LAND';
  yearBuilt?: number;
  squareFootage?: number;
  estimatedValue?: number;
  lotSize?: number;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  hasBasement?: boolean;
  hasGarage?: boolean;
  accessConcerns?: string;
  specialInstructions?: string;
}
