/**
 * VendorOrderService — owns the lifecycle of writing VendorOrder docs.
 *
 * Phase 1 contract:
 *   - createVendorOrder(input) — single-row write of a VendorOrder. Returns
 *     the persisted row with the linkage fields filled in. Today the row is
 *     written with the LEGACY discriminator (`type: 'order'`) per Phase A;
 *     Phase 4 (slice 8f) flips both writes and reads to `'vendor-order'` in
 *     a coordinated PR.
 *
 * This service is the canonical home for VendorOrder writes. Direct callers
 * of `dbService.createOrder()` will be migrated to use this service over
 * slices 8e–8f. The existing `dbService.createOrder` remains as a low-level
 * Cosmos helper but is marked deprecated for new application-level callers.
 *
 * Why introduce VendorOrderService now (slice 8e):
 *   - Closes the gap identified in the design conversation: ClientOrderService
 *     created VendorOrder rows by reaching directly into `dbService.createOrder`.
 *     That was acceptable as a Phase 1 internal detail but not as the lasting
 *     architecture. The vendor-side write path deserves its own service.
 *   - Establishes the API surface that future vendor-only call paths
 *     (revision-management, RFB, manual reassignment) will use, instead of
 *     spreading direct `dbService.createOrder` calls.
 *   - Lets slice 8f flip the discriminator in ONE place (here) rather than
 *     across every direct caller.
 *
 * What this service does NOT do (yet):
 *   - Vendor selection / auto-assignment — lives in auto-assignment.controller.
 *   - Status transitions on existing VendorOrders — slice 8e+ adds those
 *     methods incrementally as call sites migrate.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import {
    VENDOR_ORDER_DOC_TYPE,
    type VendorOrder,
    type VendorOrder as Order,
    type VendorWorkType,
} from '../types/vendor-order.types.js';

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Required input to create a VendorOrder.
 *
 * Carries the union of fields needed to instantiate the VendorOrder document
 * with proper linkage to its parent ClientOrder. The remaining
 * `Partial<Order>` fields are forwarded verbatim — propertyAddress,
 * propertyDetails, loanInformation, borrowerInformation, dueDate, etc.
 */
export type CreateVendorOrderInput = Omit<Partial<Order>, 'id' | 'type'> & {
    tenantId: string;
    clientOrderId: string;
    engagementId: string;
    engagementLoanId: string;
    clientId: string;
    propertyId: string;
    vendorWorkType: VendorWorkType;
    /** Vendor-side fee, when known up front. */
    vendorFee?: number;
    /** Free-form scope/instructions surfaced to the assigned vendor. */
    instructions?: string;
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class VendorOrderService {
    private readonly logger = new Logger('VendorOrderService');

    constructor(private readonly dbService: CosmosDbService) {}

    /**
     * Persist a single VendorOrder row.
     *
     * Returns the fully-typed VendorOrder. Throws on persistence failure —
     * caller decides how to handle (ClientOrderService surfaces it as a
     * partial-fan-out error; standalone callers may retry or compensate).
     */
    async createVendorOrder(input: CreateVendorOrderInput): Promise<VendorOrder> {
        const row = await this.dbService.createOrder(input as Omit<Order, 'id'>);
        if (!row.success || !row.data) {
            const err = row.error?.message ?? 'unknown error';
            throw new Error(
                `VendorOrderService.createVendorOrder failed for clientOrderId="${input.clientOrderId}" ` +
                `(vendorWorkType="${input.vendorWorkType}"): ${err}`,
            );
        }

        const created = row.data as Order;

        // Apply the VendorOrder shape — adds the linkage fields + the new
        // discriminator. Slice 8f flipped writes from LEGACY_VENDOR_ORDER_DOC_TYPE
        // ('order') to VENDOR_ORDER_DOC_TYPE ('vendor-order'). Reads tolerate
        // both via VENDOR_ORDER_TYPE_PREDICATE so pre-flip rows remain
        // queryable until backfilled.
        const vendorOrder: VendorOrder = {
            ...created,
            type: VENDOR_ORDER_DOC_TYPE,
            tenantId: input.tenantId,
            clientOrderId: input.clientOrderId,
            engagementId: input.engagementId,
            engagementLoanId: input.engagementLoanId,
            clientId: input.clientId,
            productType: input.productType ?? input.vendorWorkType,
            propertyId: input.propertyId,
            vendorWorkType: input.vendorWorkType,
        } as VendorOrder;

        this.logger.info('VendorOrder created', {
            id: vendorOrder.id,
            clientOrderId: vendorOrder.clientOrderId,
            vendorWorkType: vendorOrder.vendorWorkType,
            tenantId: vendorOrder.tenantId,
        });

        return vendorOrder;
    }
}
