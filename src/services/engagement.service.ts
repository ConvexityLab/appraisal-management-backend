/**
 * Engagement Service
 *
 * Manages CRUD for Engagement documents in Cosmos DB.
 *
 * Hierarchy:
 *   LenderEngagement (1)
 *     └── EngagementProperty (1..MAX_EMBEDDED_LOANS) — embedded in document
 *           └── EngagementClientOrder (1..N per loan)
 *                 └── vendorOrderIds (0..N)
 *
 * Cosmos container: "engagements"
 * Partition key:    /tenantId
 */

import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { PropertyEnrichmentService } from './property-enrichment.service.js';
import { AddressServiceGeocoder } from './address-service.geocoder.js';
import { ClientOrderService } from './client-order.service.js';
import type { PropertyDetails as ClientOrderPropertyDetails } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import type { CommunicationRecord } from '../types/communication.types.js';
import type {
  Engagement,
  EngagementProperty,
  EngagementClientOrder,
  CreateEngagementRequest,
  CreateEngagementLoanRequest,
  UpdateEngagementRequest,
  UpdateEngagementLoanRequest,
  EngagementListRequest,
  EngagementListResponse,
  LoanReference,
} from '../types/engagement.types.js';
import {
  EngagementStatus,
  EngagementPropertyStatus,
  EngagementClientOrderStatus,
  EngagementType,
} from '../types/engagement.types.js';
import { OrderPriority } from '../types/order-management.js';

const logger = new Logger('EngagementService');

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maximum number of loans that may be embedded inside a single Engagement document.
 * Cosmos DB has a 2 MB document limit; ~500 bytes × 1000 loans = 500 KB, safely under.
 * Above this threshold the service throws a 400-class error rather than silently truncating.
 */
const MAX_EMBEDDED_LOANS = 1000;

// ── ID helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a collision-resistant, human-readable ID.
 *
 * The base-36 millisecond timestamp gives ~46-bit uniqueness per year.
 * The 2-char random suffix reduces same-millisecond collision probability to ~1/1296.
 * No shared mutable state — safe under concurrent request handling.
 *
 * @param prefix  Entity prefix (e.g. 'ENG', 'CO')
 * @param includeYear  When true, format is PREFIX-YYYY-XXXXXXXX; otherwise PREFIX-XXXXXXXX
 */
function generateHumanReadableId(prefix: string, includeYear: boolean): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
  if (includeYear) {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${ts}${rand}`;
  }
  return `${prefix}-${ts}${rand}`;
}

/** e.g. ENG-2026-LK3R9MX2 */
function generateEngagementId(): string {
  return generateHumanReadableId('ENG', true);
}

/** e.g. CO-LK3R9MX2 */
function generateClientOrderId(): string {
  return generateHumanReadableId('CO', false);
}

/** e.g. LOAN-2026-LK3R9MX2 */
function generateLoanId(): string {
  return generateHumanReadableId('LOAN', true);
}

function now(): string {
  return new Date().toISOString();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Build a fully-initialized EngagementClientOrder from the request shape. */
function buildClientOrder(
  p: Omit<EngagementClientOrder, 'id' | 'status' | 'vendorOrderIds'>,
): EngagementClientOrder {
  return {
    id: generateClientOrderId(),
    productType: p.productType,
    status: EngagementClientOrderStatus.PENDING,
    ...(p.instructions !== undefined && { instructions: p.instructions }),
    ...(p.fee !== undefined && { fee: p.fee }),
    ...(p.dueDate !== undefined && { dueDate: p.dueDate }),
    vendorOrderIds: [],
  };
}

/**
 * Build a `LoanReference` from the legacy top-level fields on the request.
 * Caller passes whichever loan field set was supplied; lien position defaults
 * to 'First' since most engagements arrive with a primary purchase or refi
 * loan against the property.
 */
function buildPrimaryLoanReference(l: CreateEngagementLoanRequest): LoanReference {
  return {
    loanNumber: l.loanNumber,
    ...(l.loanType !== undefined && { loanType: l.loanType }),
    ...(l.fhaCase !== undefined && { fhaCase: l.fhaCase }),
    lienPosition: 'First',
  };
}

/** Build a fully-initialized EngagementProperty from the create-request shape. */
function buildLoan(l: CreateEngagementLoanRequest): EngagementProperty {
  // Slice 8d: keep top-level loanNumber/loanType/fhaCase in sync with
  // loanReferences[0] (the primary loan) so legacy readers continue to work
  // while new code reads from loanReferences[]. Either source on the request
  // is supported during transition: if the caller already populated
  // `loanReferences`, prefer it; otherwise synthesise from top-level fields.
  const incomingRefs = (l as { loanReferences?: LoanReference[] }).loanReferences;
  const loanReferences: LoanReference[] = (incomingRefs && incomingRefs.length > 0)
    ? incomingRefs
    : [buildPrimaryLoanReference(l)];
  const primary = loanReferences[0]!;

  return {
    id: generateLoanId(),
    loanNumber: primary.loanNumber,
    borrowerName: l.borrowerName,
    ...(l.borrowerEmail !== undefined && { borrowerEmail: l.borrowerEmail }),
    ...(l.loanOfficer !== undefined && { loanOfficer: l.loanOfficer }),
    ...(l.loanOfficerEmail !== undefined && { loanOfficerEmail: l.loanOfficerEmail }),
    ...(l.loanOfficerPhone !== undefined && { loanOfficerPhone: l.loanOfficerPhone }),
    ...(primary.loanType !== undefined && { loanType: primary.loanType }),
    ...(primary.fhaCase !== undefined && { fhaCase: primary.fhaCase }),
    loanReferences,
    property: l.property,
    status: EngagementPropertyStatus.PENDING,
    clientOrders: l.clientOrders.map(buildClientOrder),
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class EngagementService {
  private _container: Container | null = null;
  private readonly enrichmentService: PropertyEnrichmentService;
  private readonly clientOrderService: ClientOrderService;

  constructor(
    private readonly dbService: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService,
    /**
     * Optional: inject a specific enrichment service (used in tests).
     * When omitted, a default instance is constructed using the same dbService.
     */
    enrichmentService?: PropertyEnrichmentService,
    /**
     * Optional: inject a ClientOrderService (used in tests). When omitted, a
     * default instance is constructed against the same dbService and the
     * default ServiceBusEventPublisher. Phase 2 (comparable-selection) is
     * driven from the comp-collection listener — not from this service —
     * so no ComparableSelectionService dependency is required here.
     */
    clientOrderService?: ClientOrderService,
  ) {
    this.enrichmentService = enrichmentService ??
      new PropertyEnrichmentService(
        dbService,
        propertyRecordService,
        undefined,
        new AddressServiceGeocoder(),
      );
    this.clientOrderService = clientOrderService ?? new ClientOrderService(dbService);
  }

  /** Lazily resolve the container — safe even if called before dbService.initialize() */
  private get container(): Container {
    if (!this._container) {
      this._container = this.dbService.getEngagementsContainer();
    }
    return this._container;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async createEngagement(request: CreateEngagementRequest): Promise<Engagement> {
    if (!request.tenantId) {
      throw new Error('tenantId is required to create an Engagement');
    }
    if (!request.createdBy) {
      throw new Error('createdBy is required to create an Engagement');
    }
    if (!request.client?.clientId) {
      throw new Error('client.clientId is required to create an Engagement');
    }
    if (!request.properties || request.properties.length === 0) {
      throw new Error('At least one EngagementProperty is required');
    }
    if (request.properties.length > MAX_EMBEDDED_LOANS) {
      throw new Error(
        `Large portfolio ingestion (>${MAX_EMBEDDED_LOANS} loans) is not yet supported. ` +
        `Submitted: ${request.properties.length} loans. Contact support.`,
      );
    }
    for (const loan of request.properties) {
      if (!loan.clientOrders || loan.clientOrders.length === 0) {
        throw new Error(
          `Each loan must have at least one client order. ` +
          `Loan loanNumber="${loan.loanNumber}" has none.`,
        );
      }
    }

    // Resolve a canonical PropertyRecord for each loan's collateral (Phase R2).
    const resolvedPropertyIds = await Promise.all(
      request.properties.map(l =>
        this.propertyRecordService.resolveOrCreate({
          address: {
            street: l.property.address,
            city: l.property.city,
            state: l.property.state,
            zip: l.property.zipCode,
          },
          tenantId: request.tenantId,
          createdBy: request.createdBy,
        }),
      ),
    );

    const loans = request.properties.map((l, i) => ({
      ...buildLoan(l),
      propertyId: resolvedPropertyIds[i]!.propertyId,
    }));
    const engagementType = loans.length === 1 ? EngagementType.SINGLE : EngagementType.PORTFOLIO;
    const engagementId = generateEngagementId();

    const engagement: Engagement = {
      id: engagementId,
      engagementNumber: engagementId,
      tenantId: request.tenantId,
      engagementType,
      loansStoredExternally: false,
      client: request.client,
      properties: loans,
      status: EngagementStatus.RECEIVED,
      priority: request.priority ?? OrderPriority.ROUTINE,
      receivedAt: now(),
      ...(request.clientDueDate !== undefined && { clientDueDate: request.clientDueDate }),
      ...(request.internalDueDate !== undefined && { internalDueDate: request.internalDueDate }),
      ...(request.totalEngagementFee !== undefined && { totalEngagementFee: request.totalEngagementFee }),
      ...(request.accessInstructions !== undefined && { accessInstructions: request.accessInstructions }),
      ...(request.specialInstructions !== undefined && { specialInstructions: request.specialInstructions }),
      ...(request.engagementInstructions !== undefined && { engagementInstructions: request.engagementInstructions }),
      createdAt: now(),
      createdBy: request.createdBy,
      updatedAt: now(),
    };

    const { resource } = await this.container.items.create(engagement);
    if (!resource) {
      throw new Error('Cosmos DB did not return a resource after creating the Engagement');
    }

    logger.info('Engagement created', {
      id: engagement.id,
      engagementNumber: engagement.engagementNumber,
      engagementType,
      loanCount: loans.length,
    });

    // Fire-and-forget per-loan pipeline (non-fatal):
    //   1. Enrich the loan's property (geocode → lat/lng on PropertyRecord).
    //   2. For each embedded EngagementClientOrder, persist a standalone
    //      ClientOrder doc via ClientOrderService.placeClientOrder, which
    //      also publishes `client-order.created`. The CompCollectionListener
    //      consumes that event and runs Phase 1 (order-comparables) → Phase 2
    //      (comparable-analyses).
    // Step 1 is awaited inside enrichAndPlaceClientOrders before Step 2 so the
    // PropertyRecord has lat/lng by the time the listener reads it.
    for (const loan of (resource as Engagement).properties) {
      this.enrichAndPlaceClientOrders(
        engagement.id,
        loan.id,
        engagement.tenantId,
        engagement.client.clientId,
        engagement.createdBy,
        {
          street: loan.property.address,
          city: loan.property.city ?? '',
          state: loan.property.state,
          zipCode: loan.property.zipCode,
        },
        loan.property,
        loan.propertyId,
        loan.clientOrders,
      ).catch(err => {
        logger.warn('Engagement loan post-create pipeline failed (non-fatal)', {
          engagementId: engagement.id,
          loanId: loan.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return resource as Engagement;
  }

  // ── Enrichment + ClientOrder placement (private) ───────────────────────────

  /**
   * Enrich a loan's property, then place a standalone ClientOrder document
   * for each embedded EngagementClientOrder. Each placement publishes a
   * `client-order.created` event that drives the comp-collection → comp-
   * selection chain in CompCollectionListenerJob.
   *
   * Failure modes are isolated:
   *   - If enrichment throws, we still attempt to place each ClientOrder. The
   *     downstream listener will write a SKIPPED audit doc to
   *     `order-comparables` with reason NO_COORDINATES.
   *   - If one placement throws, others on the same loan still run.
   * All errors are logged; nothing is re-thrown — this method is invoked
   * fire-and-forget by createEngagement.
   */
  private async enrichAndPlaceClientOrders(
    engagementId: string,
    loanId: string,
    tenantId: string,
    clientId: string,
    createdBy: string,
    address: { street: string; city: string; state: string; zipCode: string },
    loanProperty: EngagementProperty['property'],
    propertyId: string | undefined,
    clientOrders: EngagementClientOrder[],
  ): Promise<void> {
    try {
      await this.enrichmentService.enrichEngagement(
        engagementId, loanId, tenantId, address,
      );
    } catch (err) {
      logger.warn('Property enrichment failed; placing client orders without coordinates (non-fatal)', {
        engagementId,
        loanId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    for (const clientOrder of clientOrders) {
      try {
        await this.clientOrderService.placeClientOrder({
          tenantId,
          createdBy,
          engagementId,
          engagementPropertyId: loanId,
          clientId,
          productType: clientOrder.productType,
          // EngagementProperty.property (order-management.PropertyDetails) and
          // ClientOrder.propertyDetails (index.PropertyDetails) are different
          // structural shapes that share the same name. The ClientOrder doc
          // stores propertyDetails opaquely — the engagement-flow listener
          // chain reads `propertyId` from the event, not propertyDetails —
          // so a structural cast is safe here.
          propertyDetails: loanProperty as unknown as ClientOrderPropertyDetails,
          clientOrderId: clientOrder.id,
          ...(propertyId !== undefined && { propertyId }),
          ...(clientOrder.fee !== undefined && { clientFee: clientOrder.fee }),
          ...(clientOrder.dueDate !== undefined && { dueDate: new Date(clientOrder.dueDate) }),
          ...(clientOrder.instructions !== undefined && { instructions: clientOrder.instructions }),
        });
      } catch (err) {
        logger.warn('Failed to place ClientOrder for engagement (non-fatal)', {
          engagementId,
          loanId,
          clientOrderId: clientOrder.id,
          productType: clientOrder.productType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async getEngagement(id: string, tenantId: string): Promise<Engagement> {
    const { resource } = await this.container.item(id, tenantId).read<Engagement>();
    if (!resource) {
      throw new Error(`Engagement not found: id=${id}`);
    }
    return resource;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async updateEngagement(
    id: string,
    tenantId: string,
    updates: UpdateEngagementRequest,
  ): Promise<Engagement> {
    const existing = await this.getEngagement(id, tenantId);

    const updated: Engagement = {
      ...existing,
      ...(updates.client !== undefined && {
        client: { ...existing.client, ...updates.client },
      }),
      ...(updates.properties !== undefined && { properties: updates.properties }),
      ...(updates.engagementType !== undefined && { engagementType: updates.engagementType }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.clientDueDate !== undefined && { clientDueDate: updates.clientDueDate }),
      ...(updates.internalDueDate !== undefined && { internalDueDate: updates.internalDueDate }),
      ...(updates.totalEngagementFee !== undefined && {
        totalEngagementFee: updates.totalEngagementFee,
      }),
      ...(updates.accessInstructions !== undefined && {
        accessInstructions: updates.accessInstructions,
      }),
      ...(updates.specialInstructions !== undefined && {
        specialInstructions: updates.specialInstructions,
      }),
      ...(updates.engagementInstructions !== undefined && {
        engagementInstructions: updates.engagementInstructions,
      }),
      updatedAt: now(),
      updatedBy: updates.updatedBy,
    };

    const { resource } = await this.container.item(id, tenantId).replace<Engagement>(updated);
    if (!resource) {
      throw new Error(`Cosmos DB did not return a resource after updating Engagement id=${id}`);
    }

    logger.info('Engagement updated', { id, updatedBy: updates.updatedBy });
    return resource;
  }

  // ── Change engagement status ───────────────────────────────────────────────

  /**
   * Valid lifecycle transitions for a LenderEngagement.
   *
   * Terminal states: CANCELLED (no exit).
   * ON_HOLD acts as a pause state reachable from — and resumable to — any
   * active state except DELIVERED and CANCELLED.
   */
  private static readonly ALLOWED_TRANSITIONS: Readonly<Record<EngagementStatus, readonly EngagementStatus[]>> = {
    [EngagementStatus.RECEIVED]:    [EngagementStatus.ACCEPTED,    EngagementStatus.CANCELLED, EngagementStatus.ON_HOLD],
    [EngagementStatus.ACCEPTED]:    [EngagementStatus.IN_PROGRESS, EngagementStatus.CANCELLED, EngagementStatus.ON_HOLD],
    [EngagementStatus.IN_PROGRESS]: [EngagementStatus.QC,          EngagementStatus.REVISION,  EngagementStatus.CANCELLED, EngagementStatus.ON_HOLD],
    [EngagementStatus.QC]:          [EngagementStatus.REVISION,    EngagementStatus.DELIVERED, EngagementStatus.CANCELLED, EngagementStatus.ON_HOLD],
    [EngagementStatus.REVISION]:    [EngagementStatus.IN_PROGRESS, EngagementStatus.QC,        EngagementStatus.CANCELLED, EngagementStatus.ON_HOLD],
    [EngagementStatus.DELIVERED]:   [EngagementStatus.REVISION,    EngagementStatus.CANCELLED],
    [EngagementStatus.ON_HOLD]:     [EngagementStatus.ACCEPTED,    EngagementStatus.IN_PROGRESS, EngagementStatus.CANCELLED],
    [EngagementStatus.CANCELLED]:   [],
  };

  async changeStatus(
    id: string,
    tenantId: string,
    newStatus: EngagementStatus,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(id, tenantId);
    const allowed = EngagementService.ALLOWED_TRANSITIONS[engagement.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${engagement.status} → ${newStatus}. ` +
        `Allowed transitions from ${engagement.status}: [${allowed.join(', ') || 'none'}]`,
      );
    }
    return this.updateEngagement(id, tenantId, { status: newStatus, updatedBy });
  }

  // ── Loan management ───────────────────────────────────────────────────────

  /**
   * Valid lifecycle transitions for a single EngagementProperty.
   * Terminal states: DELIVERED, CANCELLED.
   */
  private static readonly ALLOWED_LOAN_TRANSITIONS: Readonly<Record<EngagementPropertyStatus, readonly EngagementPropertyStatus[]>> = {
    [EngagementPropertyStatus.PENDING]:     [EngagementPropertyStatus.IN_PROGRESS, EngagementPropertyStatus.CANCELLED],
    [EngagementPropertyStatus.IN_PROGRESS]: [EngagementPropertyStatus.QC,          EngagementPropertyStatus.CANCELLED],
    [EngagementPropertyStatus.QC]:          [EngagementPropertyStatus.DELIVERED,   EngagementPropertyStatus.IN_PROGRESS, EngagementPropertyStatus.CANCELLED],
    [EngagementPropertyStatus.DELIVERED]:   [],
    [EngagementPropertyStatus.CANCELLED]:   [],
  };

  /**
   * Return the loans array for an engagement.
   * Currently always reads from the embedded document.
   * When loansStoredExternally=true (future), this method will query the external container.
   */
  async getLoans(engagementId: string, tenantId: string): Promise<EngagementProperty[]> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    // NOTE: loansStoredExternally=true path is not yet implemented.
    // When needed, add: if (engagement.propertiesStoredExternally) { return this.queryExternalLoans(...); }
    return engagement.properties;
  }

  /** Add a new loan to an existing engagement. */
  async addLoanToEngagement(
    engagementId: string,
    tenantId: string,
    loanData: CreateEngagementLoanRequest,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);

    if (engagement.properties.length >= MAX_EMBEDDED_LOANS) {
      throw new Error(
        `Large portfolio ingestion (>${MAX_EMBEDDED_LOANS} loans) is not yet supported. ` +
        `Current loan count: ${engagement.properties.length}. Contact support.`,
      );
    }
    if (!loanData.clientOrders || loanData.clientOrders.length === 0) {
      throw new Error('Each loan must have at least one client order');
    }

    const newLoan = buildLoan(loanData);

    // Resolve (or lazily create) a canonical PropertyRecord for the new loan's collateral —
    // same pattern as createEngagement. Non-fatal if it fails: loan is saved without propertyId.
    let resolvedPropertyId: string | undefined;
    try {
      const resolved = await this.propertyRecordService.resolveOrCreate({
        address: {
          street: loanData.property.address,
          city: loanData.property.city,
          state: loanData.property.state,
          zip: loanData.property.zipCode,
        },
        tenantId,
        createdBy: updatedBy,
      });
      resolvedPropertyId = resolved.propertyId;
      newLoan.propertyId = resolved.propertyId;
    } catch (err) {
      logger.warn('addLoanToEngagement: PropertyRecord resolution failed (non-fatal)', {
        engagementId,
        loanId: newLoan.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const updatedLoans = [...engagement.properties, newLoan];
    const updatedType = updatedLoans.length > 1 ? EngagementType.PORTFOLIO : EngagementType.SINGLE;

    const updatedEngagement = await this.updateEngagement(engagementId, tenantId, {
      properties: updatedLoans,
      ...(updatedType !== engagement.engagementType && { engagementType: updatedType }),
      updatedBy,
    });

    // Fire-and-forget property enrichment for the new loan (non-fatal).
    this.enrichmentService.enrichEngagement(
      engagementId,
      newLoan.id,
      tenantId,
      {
        street: loanData.property.address,
        city: loanData.property.city ?? '',
        state: loanData.property.state,
        zipCode: loanData.property.zipCode,
      },
    ).catch(err => {
      logger.warn('Property enrichment failed for added loan (non-fatal)', {
        engagementId,
        loanId: newLoan.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return updatedEngagement;
  }

  /** Update the scalar fields of an existing loan (not clientOrders, not status). */
  async updateLoan(
    engagementId: string,
    tenantId: string,
    loanId: string,
    updates: UpdateEngagementLoanRequest,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const loanIndex = engagement.properties.findIndex((l) => l.id === loanId);
    if (loanIndex === -1) {
      throw new Error(
        `EngagementProperty not found: engagementId=${engagementId} loanId=${loanId}`,
      );
    }

    const existing = engagement.properties[loanIndex] as EngagementProperty;
    const updatedLoan: EngagementProperty = {
      ...existing,
      ...(updates.loanNumber !== undefined && { loanNumber: updates.loanNumber }),
      ...(updates.borrowerName !== undefined && { borrowerName: updates.borrowerName }),
      ...(updates.borrowerEmail !== undefined && { borrowerEmail: updates.borrowerEmail }),
      ...(updates.loanOfficer !== undefined && { loanOfficer: updates.loanOfficer }),
      ...(updates.loanOfficerEmail !== undefined && { loanOfficerEmail: updates.loanOfficerEmail }),
      ...(updates.loanOfficerPhone !== undefined && { loanOfficerPhone: updates.loanOfficerPhone }),
      ...(updates.loanType !== undefined && { loanType: updates.loanType }),
      ...(updates.fhaCase !== undefined && { fhaCase: updates.fhaCase }),
      ...(updates.property !== undefined && { property: updates.property }),
    };

    const updatedLoans = [...engagement.properties];
    updatedLoans[loanIndex] = updatedLoan;

    // Re-enrich when any address field changes. Both resolveOrCreate and enrichEngagement
    // are non-fatal so a provider outage cannot block a loan edit.
    const newProp = updates.property;
    const oldProp = existing.property;
    const addressChanged =
      newProp !== undefined && (
        (newProp.address !== undefined && newProp.address !== oldProp.address) ||
        (newProp.city    !== undefined && newProp.city    !== oldProp.city)    ||
        (newProp.state   !== undefined && newProp.state   !== oldProp.state)   ||
        (newProp.zipCode !== undefined && newProp.zipCode !== oldProp.zipCode)
      );

    if (addressChanged && newProp) {
      // Re-resolve (or create) the canonical PropertyRecord for the new address.
      let resolvedPropertyId: string | undefined;
      try {
        const resolved = await this.propertyRecordService.resolveOrCreate({
          address: {
            street: newProp.address ?? oldProp.address,
            city:   newProp.city    ?? oldProp.city,
            state:  newProp.state   ?? oldProp.state,
            zip:    newProp.zipCode ?? oldProp.zipCode,
          },
          tenantId,
          createdBy: updatedBy,
        });
        resolvedPropertyId = resolved.propertyId;
        updatedLoans[loanIndex] = { ...updatedLoan, propertyId: resolved.propertyId };
      } catch (err) {
        logger.warn('updateLoan: PropertyRecord re-resolution failed (non-fatal)', {
          engagementId,
          loanId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const updatedEngagement = await this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });

      // Fire-and-forget enrichment with the new address (non-fatal).
      this.enrichmentService.enrichEngagement(
        engagementId,
        loanId,
        tenantId,
        {
          street:  newProp.address  ?? oldProp.address,
          city:    newProp.city     ?? oldProp.city    ?? '',
          state:   newProp.state    ?? oldProp.state,
          zipCode: newProp.zipCode  ?? oldProp.zipCode,
        },
      ).catch(err => {
        logger.warn('Property enrichment failed for updated loan address (non-fatal)', {
          engagementId,
          loanId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return updatedEngagement;
    }

    return this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });
  }

  /**
   * Remove a loan from an engagement.
   * Throws if the loan has any client orders with linked vendor orders — those must be unlinked first.
   */
  async removeLoan(
    engagementId: string,
    tenantId: string,
    loanId: string,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const loanIndex = engagement.properties.findIndex((l) => l.id === loanId);
    if (loanIndex === -1) {
      throw new Error(
        `EngagementProperty not found: engagementId=${engagementId} loanId=${loanId}`,
      );
    }

    // Source of truth for "is this loan linked?" is the `orders` container, not the
    // embedded EngagementClientOrder.vendorOrderIds array. The embedded array is an
    // eventually-consistent denormalized cache that can drift on partial-failure writes
    // (see client-order.service.ts: "placeClientOrder is NOT atomic"). VendorOrder docs
    // are required to carry engagementId + engagementPropertyId per the engagement-primacy
    // guard, so this query is reliable.
    const linkedOrdersResult = await this.dbService.queryItems<{ id: string }>(
      'orders',
      'SELECT c.id FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId AND c.engagementPropertyId = @loanId',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
        { name: '@loanId', value: loanId },
      ],
    );
    if (!linkedOrdersResult.success) {
      throw new Error(`Failed to verify vendor-order linkage for loan ${loanId}; refusing to delete.`);
    }
    const hasLinkedOrders = (linkedOrdersResult.data?.length ?? 0) > 0;
    if (hasLinkedOrders) {
      throw new Error(
        `Cannot remove loan loanId=${loanId}: one or more client orders have linked vendor orders. ` +
        `Unlink vendor orders before removing the loan.`,
      );
    }

    const updatedLoans = engagement.properties.filter((l) => l.id !== loanId);
    return this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });
  }

  /** Transition a single loan to a new status, enforcing ALLOWED_LOAN_TRANSITIONS. */
  async changeLoanStatus(
    engagementId: string,
    tenantId: string,
    loanId: string,
    newStatus: EngagementPropertyStatus,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const loanIndex = engagement.properties.findIndex((l) => l.id === loanId);
    if (loanIndex === -1) {
      throw new Error(
        `EngagementProperty not found: engagementId=${engagementId} loanId=${loanId}`,
      );
    }

    const loan = engagement.properties[loanIndex] as EngagementProperty;
    const allowed = EngagementService.ALLOWED_LOAN_TRANSITIONS[loan.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid loan status transition: ${loan.status} → ${newStatus} ` +
        `for loanId=${loanId}. ` +
        `Allowed: [${allowed.join(', ') || 'none'}]`,
      );
    }

    const updatedLoans = [...engagement.properties];
    updatedLoans[loanIndex] = { ...loan, status: newStatus };
    return this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });
  }

  /** Add a new client order to an existing loan. */
  async addClientOrderToLoan(
    engagementId: string,
    tenantId: string,
    loanId: string,
    clientOrderData: Omit<EngagementClientOrder, 'id' | 'status' | 'vendorOrderIds'>,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const loanIndex = engagement.properties.findIndex((l) => l.id === loanId);
    if (loanIndex === -1) {
      throw new Error(
        `EngagementProperty not found: engagementId=${engagementId} loanId=${loanId}`,
      );
    }

    const loan = engagement.properties[loanIndex] as EngagementProperty;
    const newClientOrder = buildClientOrder(clientOrderData);
    const updatedLoans = [...engagement.properties];
    updatedLoans[loanIndex] = { ...loan, clientOrders: [...loan.clientOrders, newClientOrder] };

    const result = await this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });

    // Fire-and-forget standalone ClientOrder placement for the new order.
    // Mirrors the createEngagement path: placeClientOrder writes the
    // `client-orders` doc and publishes `client-order.created`, which the
    // CompCollectionListener consumes to drive Phase 1 + Phase 2. The loan
    // already has a propertyId from initial engagement creation, so we pass
    // it through; the listener will handle missing coordinates by writing a
    // SKIPPED audit doc.
    this.clientOrderService.placeClientOrder({
      tenantId,
      createdBy: updatedBy,
      engagementId,
      engagementPropertyId: loanId,
      clientId: engagement.client.clientId,
      productType: newClientOrder.productType,
      // See enrichAndPlaceClientOrders for why this cast is safe.
      propertyDetails: loan.property as unknown as ClientOrderPropertyDetails,
      clientOrderId: newClientOrder.id,
      ...(loan.propertyId !== undefined && { propertyId: loan.propertyId }),
      ...(newClientOrder.fee !== undefined && { clientFee: newClientOrder.fee }),
      ...(newClientOrder.dueDate !== undefined && { dueDate: new Date(newClientOrder.dueDate) }),
      ...(newClientOrder.instructions !== undefined && { instructions: newClientOrder.instructions }),
    }).catch((err) => {
      logger.warn('Failed to place ClientOrder for added engagement client order (non-fatal)', {
        engagementId,
        loanId,
        clientOrderId: newClientOrder.id,
        productType: newClientOrder.productType,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return result;
  }

  // ── Link VendorOrder to EngagementClientOrder ─────────────────────────────

  /**
   * Link a VendorOrder ID to a specific client order inside a specific loan.
   * Idempotent — adding the same vendorOrderId twice is a no-op.
   */
  async addVendorOrderToClientOrder(
    engagementId: string,
    tenantId: string,
    loanId: string,
    clientOrderId: string,
    vendorOrderId: string,
    updatedBy: string,
  ): Promise<Engagement> {
    const engagement = await this.getEngagement(engagementId, tenantId);
    const loanIndex = engagement.properties.findIndex((l) => l.id === loanId);
    if (loanIndex === -1) {
      throw new Error(
        `EngagementProperty not found: engagementId=${engagementId} loanId=${loanId}`,
      );
    }

    const loan = engagement.properties[loanIndex] as EngagementProperty;
    const clientOrder = loan.clientOrders.find((co) => co.id === clientOrderId);
    if (!clientOrder) {
      throw new Error(
        `EngagementClientOrder not found: engagementId=${engagementId} loanId=${loanId} clientOrderId=${clientOrderId}`,
      );
    }
    if (!clientOrder.vendorOrderIds.includes(vendorOrderId)) {
      clientOrder.vendorOrderIds.push(vendorOrderId);
    }

    const updatedLoans = [...engagement.properties];
    updatedLoans[loanIndex] = loan;
    const result = await this.updateEngagement(engagementId, tenantId, { properties: updatedLoans, updatedBy });

    // Best-effort FK write-back: stamp engagementId, loanId, clientOrderId onto the order document.
    // Non-fatal — the order may not exist yet if it is being created concurrently.
    try {
      await this.dbService.updateOrder(vendorOrderId, {
        engagementId,
        engagementPropertyId: loanId,
        engagementClientOrderId: clientOrderId,
      });
    } catch (err) {
      logger.warn('FK write-back to order failed (non-fatal)', { vendorOrderId, engagementId, loanId, err });
    }

    return result;
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async listEngagements(request: EngagementListRequest): Promise<EngagementListResponse> {
    if (!request.tenantId) {
      throw new Error('tenantId is required to list Engagements');
    }

    const page = request.page ?? 1;
    const pageSize = Math.min(request.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['c.tenantId = @tenantId'];
    const parameters: { name: string; value: unknown }[] = [
      { name: '@tenantId', value: request.tenantId },
    ];

    if (request.status && request.status.length > 0) {
      const statusParams = request.status.map((s, i) => `@status${i}`);
      conditions.push(`c.status IN (${statusParams.join(', ')})`);
      request.status.forEach((s, i) => parameters.push({ name: `@status${i}`, value: s }));
    }

    if (request.clientId) {
      conditions.push('c.client.clientId = @clientId');
      parameters.push({ name: '@clientId', value: request.clientId });
    }

    if (request.propertyState) {
      // Use loans[0] as representative property for SINGLE; PORTFOLIO multi-state search is v2.
      conditions.push('c.properties[0].property.state = @propertyState');
      parameters.push({ name: '@propertyState', value: request.propertyState });
    }

    if (request.propertyZipCode) {
      conditions.push('c.properties[0].property.zipCode = @zipCode');
      parameters.push({ name: '@zipCode', value: request.propertyZipCode });
    }

    if (request.searchText) {
      conditions.push(
        '(CONTAINS(LOWER(c.properties[0].loanNumber), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.properties[0].borrowerName), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.engagementNumber), LOWER(@search)) OR ' +
        'CONTAINS(LOWER(c.properties[0].property.city), LOWER(@search)))',
      );
      parameters.push({ name: '@search', value: request.searchText });
    }

    if (request.authorizationFilter) {
      conditions.push(`(${request.authorizationFilter.sql})`);
      parameters.push(...request.authorizationFilter.parameters);
    }

    const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'engagementNumber', 'status', 'priority', 'receivedAt', 'clientDueDate', 'internalDueDate']);
    const requestedSort = request.sortBy ?? 'createdAt';
    if (!ALLOWED_SORT_FIELDS.has(requestedSort)) {
      throw new Error(`Invalid sortBy value: "${requestedSort}". Allowed values: ${[...ALLOWED_SORT_FIELDS].join(', ')}`);
    }
    const sortField = requestedSort;
    const sortDir = request.sortDirection ?? 'DESC';

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`,
      parameters: parameters as { name: string; value: string | number | boolean }[],
    };
    const { resources: countResult } = await this.container.items
      .query<number>(countQuery)
      .fetchAll();
    const totalCount = countResult[0] ?? 0;

    // Data query
    const dataQuery: SqlQuerySpec = {
      query:
        `SELECT * FROM c WHERE ${whereClause} ` +
        `ORDER BY c.${String(sortField)} ${sortDir} ` +
        `OFFSET ${offset} LIMIT ${pageSize}`,
      parameters: parameters as { name: string; value: string | number | boolean }[],
    };
    const { resources: engagements } = await this.container.items
      .query<Engagement>(dataQuery)
      .fetchAll();

    return {
      engagements,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  // ── Hard delete ────────────────────────────────────────────────────────────

  async deleteEngagement(id: string, tenantId: string, deletedBy: string): Promise<void> {
    await this.getEngagement(id, tenantId); // verify exists + tenant ownership
    const container = this.dbService.getEngagementsContainer();
    await container.item(id, tenantId).delete();
    logger.info('Engagement hard-deleted', { id, deletedBy });
  }

  // ── Sub-resource queries (FK reads) ───────────────────────────────────────

  /**
   * List VendorOrders (AppraisalOrders) linked to this engagement.
   * Queries the orders container by engagementId.
   */
  async getVendorOrders<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'orders',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query vendor orders for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List ARV analyses linked to this engagement.
   */
  async getArvAnalyses<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'arv-analyses',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query ARV analyses for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List QC reviews linked to this engagement.
   */
  async getQcReviews<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    const result = await this.dbService.queryItems<T>(
      'qc-reviews',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query QC reviews for engagement ${engagementId}`);
    }
    return result.data;
  }

  /**
   * List documents linked to this engagement.
   * Aggregates both engagement-level documents and documents from all linked vendor orders.
   */
  async getDocuments<T = unknown>(engagementId: string, tenantId: string): Promise<T[]> {
    // 1. Engagement-level docs
    const engResult = await this.dbService.queryItems<T>(
      'documents',
      'SELECT * FROM c WHERE c.engagementId = @engagementId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@engagementId', value: engagementId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!engResult.success || !engResult.data) {
      throw new Error(`Failed to query documents for engagement ${engagementId}`);
    }

    // 2. Collect all vendor order IDs by querying the `orders` container directly.
    // VendorOrder docs are the source of truth (engagement-primacy guard ensures
    // they carry engagementId); the embedded EngagementClientOrder.vendorOrderIds
    // array is a denormalized cache that can drift.
    let orderIds: string[] = [];
    try {
      const vendorOrders = await this.getVendorOrders<{ id: string }>(engagementId, tenantId);
      orderIds = vendorOrders.map((vo) => vo.id);
    } catch {
      // If the orders query fails, return only engagement-level docs.
      return engResult.data;
    }

    if (orderIds.length === 0) {
      return engResult.data;
    }

    // 3. Fetch docs from linked orders (batched query — Cosmos supports IN with up to ~256 items)
    const paramList = orderIds.map((id, i) => `@oid${i}`).join(', ');
    const params = orderIds.map((id, i) => ({ name: `@oid${i}`, value: id }));
    params.push({ name: '@tenantId', value: tenantId });

    const orderResult = await this.dbService.queryItems<T>(
      'documents',
      `SELECT * FROM c WHERE c.orderId IN (${paramList}) AND c.tenantId = @tenantId ORDER BY c.createdAt DESC`,
      params,
    );

    // 4. Merge and deduplicate by document id
    const all = [...engResult.data, ...(orderResult.success && orderResult.data ? orderResult.data : [])];
    const seen = new Set<string>();
    return all.filter((doc: any) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  }

  /**
   * Get all communications for an engagement.
   * Returns engagement-level comms (primaryEntity.type='engagement')
   * plus rolled-up comms from all linked vendor orders, sorted newest-first.
   */
  async getCommunications(engagementId: string, tenantId: string): Promise<CommunicationRecord[]> {
    const params: { name: string; value: string }[] = [
      { name: '@tenantId', value: tenantId },
      { name: '@engagementId', value: engagementId },
    ];

    let orderCondition = '';
    try {
      // Source of truth for linked vendor orders: the `orders` container queried by
      // engagementId. The embedded EngagementClientOrder.vendorOrderIds array is a
      // denormalized cache that can drift; do not consult it here.
      const vendorOrders = await this.getVendorOrders<{ id: string }>(engagementId, tenantId);
      const orderIds = vendorOrders.map((vo) => vo.id);
      if (orderIds.length > 0) {
        const paramNames = orderIds.map((_, i) => `@oid${i}`).join(', ');
        orderIds.forEach((id, i) => params.push({ name: `@oid${i}`, value: id }));
        orderCondition = ` OR (c.primaryEntity.type = 'order' AND c.primaryEntity.id IN (${paramNames}))`;
      }
    } catch {
      // Orders query failed — fall back to engagement-level comms only.
    }

    const query = `
      SELECT * FROM c
      WHERE c.type = 'communication'
        AND c.tenantId = @tenantId
        AND (
          (c.primaryEntity.type = 'engagement' AND c.primaryEntity.id = @engagementId)
          ${orderCondition}
        )
      ORDER BY c.createdAt DESC
    `;

    const result = await this.dbService.queryItems<CommunicationRecord>(
      'communications',
      query,
      params,
    );
    if (!result.success || !result.data) {
      throw new Error(`Failed to query communications for engagement ${engagementId}`);
    }
    return result.data;
  }
}
