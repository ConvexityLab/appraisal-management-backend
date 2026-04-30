/**
 * Appraisal Draft Service — Phase 1 of UAD 3.6 Full Compliance
 *
 * CRUD + section-level save for in-progress appraisals. Drafts live in the
 * `appraisal-drafts` Cosmos container (partition key: /orderId), separate
 * from finalized reports in `reporting`.
 *
 * @see UAD_3.6_COMPLIANCE_PLAN.md — Phase 1
 */

import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { createApiError, ErrorCodes } from '../utils/api-response.util.js';
import {
  type AppraisalDraft,
  type CreateDraftRequest,
  type SectionSaveRequest,
  type DraftSectionId,
  type DraftValidationError,
  DraftStatus,
  SectionStatus,
  DRAFT_SECTION_IDS,
  createInitialSectionStatus,
} from '../types/appraisal-draft.types.js';
import type { CanonicalReportDocument, CanonicalSubject, CanonicalAddress } from '../types/canonical-schema.js';
import { SCHEMA_VERSION } from '../types/canonical-schema.js';
import { type AppraisalOrder, LoanPurpose } from '../types/index.js';

const logger = new Logger('AppraisalDraftService');

// ── Section → CanonicalReportDocument field mapping ──────────────────────────

/**
 * Maps a section ID to the top-level fields of CanonicalReportDocument
 * that the section is allowed to write. Used for scoped PATCH merging.
 */
const SECTION_FIELD_MAP: Record<DraftSectionId, ReadonlyArray<keyof CanonicalReportDocument>> = {
  'subject': ['subject'],
  'contract': ['subject'],                  // contractInfo lives inside subject
  'neighborhood': ['subject'],              // neighborhood lives inside subject
  'site': ['subject'],                      // site fields live inside subject
  'improvements': ['subject'],              // improvement fields live inside subject
  'hbu': ['subject'],                       // highestAndBestUseAnalysis lives inside subject
  'sales-comparison': ['comps'],
  'cost-approach': ['costApproach'],
  'income-approach': ['incomeApproach'],
  'reconciliation': ['reconciliation', 'valuation'],
  'certification': ['appraiserInfo'],
  'photos': ['photos'],
  'addenda': ['addenda'],                    // scope of work + assumptions + free-form pages
};

// ── Service ──────────────────────────────────────────────────────────────────

export class AppraisalDraftService {
  private _container: Container | null = null;

  constructor(
    private readonly dbService: CosmosDbService,
  ) {}

  /** Lazily resolve the container — safe even if called before dbService.initialize() */
  private get container(): Container {
    if (!this._container) {
      this._container = this.dbService.getAppraisalDraftsContainer();
    }
    return this._container;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  /**
   * Create a new appraisal draft from an order.
   * Auto-populates subject address and metadata from the order record.
   */
  async createDraft(request: CreateDraftRequest, userId: string): Promise<AppraisalDraft> {
    if (!request.orderId) {
      throw new Error('orderId is required to create an appraisal draft');
    }
    if (!request.reportType) {
      throw new Error('reportType is required to create an appraisal draft');
    }

    // Load the order to auto-populate subject data
    const order = await this.loadOrder(request.orderId);

    const now = new Date().toISOString();
    const draftId = `draft-${uuidv4()}`;
    const reportId = `rpt-${uuidv4()}`;

    // Seed the report document from order data
    const reportDocument = this.seedReportFromOrder(order, draftId, reportId, request.reportType);

    const draft: AppraisalDraft = {
      id: draftId,
      orderId: request.orderId,
      reportType: request.reportType,
      status: DraftStatus.CREATED,
      reportDocument,
      sectionStatus: createInitialSectionStatus(),
      validationErrors: null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      lastEditedBy: userId,
      autoSavedAt: null,
      version: 1,
    };

    const { resource } = await this.container.items.create(draft);
    if (!resource) {
      throw new Error(`Failed to create draft for order ${request.orderId}`);
    }

    logger.info('Draft created', { draftId, orderId: request.orderId, reportType: request.reportType });
    return resource as AppraisalDraft;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Load a draft by ID.
   */
  async getDraft(draftId: string, orderId: string): Promise<AppraisalDraft> {
    const { resource } = await this.container.item(draftId, orderId).read<AppraisalDraft>();
    if (!resource) {
      throw createApiError(ErrorCodes.ORDER_NOT_FOUND, `Draft not found: ${draftId}`);
    }
    return resource;
  }

  /**
   * List all drafts for a given order.
   */
  async getDraftsForOrder(orderId: string): Promise<AppraisalDraft[]> {
    const query: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.updatedAt DESC',
      parameters: [{ name: '@orderId', value: orderId }],
    };
    const { resources } = await this.container.items.query<AppraisalDraft>(query).fetchAll();
    return resources;
  }

  // ── Section Save ───────────────────────────────────────────────────────────

  /**
   * Save a single section of the draft. Merges the section data into the
   * existing reportDocument and updates sectionStatus.
   *
   * Uses optimistic concurrency via the `version` field — if the client's
   * expectedVersion doesn't match, a 409 Conflict is thrown.
   */
  async saveSection(
    draftId: string,
    orderId: string,
    sectionId: DraftSectionId,
    request: SectionSaveRequest,
    userId: string,
  ): Promise<AppraisalDraft> {
    if (!DRAFT_SECTION_IDS.includes(sectionId)) {
      throw new Error(`Invalid section ID: "${sectionId}". Valid sections: ${DRAFT_SECTION_IDS.join(', ')}`);
    }

    const existing = await this.getDraft(draftId, orderId);

    // Optimistic concurrency check
    if (existing.version !== request.expectedVersion) {
      throw createApiError(
        'VERSION_CONFLICT',
        `Version conflict: expected ${request.expectedVersion}, but draft is at version ${existing.version}. ` +
        `Reload the draft and try again.`,
      );
    }

    // Merge section data into the report document
    const allowedFields = SECTION_FIELD_MAP[sectionId];
    const updatedDoc = { ...existing.reportDocument };
    for (const field of allowedFields) {
      if (field in request.data) {
        (updatedDoc as Record<string, unknown>)[field] = this.deepMerge(
          (updatedDoc as Record<string, unknown>)[field],
          (request.data as Record<string, unknown>)[field],
        );
      }
    }

    // Determine section status based on content
    const newSectionStatus = { ...existing.sectionStatus };
    newSectionStatus[sectionId] = this.evaluateSectionStatus(sectionId, updatedDoc);

    const now = new Date().toISOString();
    const updatedDraft: AppraisalDraft = {
      ...existing,
      reportDocument: updatedDoc as CanonicalReportDocument,
      sectionStatus: newSectionStatus,
      status: existing.status === DraftStatus.CREATED ? DraftStatus.EDITING : existing.status,
      updatedAt: now,
      lastEditedBy: userId,
      autoSavedAt: now,
      version: existing.version + 1,
    };

    const { resource } = await this.container.item(draftId, orderId).replace(updatedDraft);
    if (!resource) {
      throw new Error(`Failed to save section "${sectionId}" for draft ${draftId}`);
    }

    logger.info('Section saved', { draftId, sectionId, version: updatedDraft.version });
    return resource as AppraisalDraft;
  }

  // ── Full Document Save ─────────────────────────────────────────────────────

  /**
   * Replace the entire draft document (used for full auto-save).
   */
  async saveDraft(
    draftId: string,
    orderId: string,
    reportDocument: CanonicalReportDocument,
    expectedVersion: number,
    userId: string,
  ): Promise<AppraisalDraft> {
    const existing = await this.getDraft(draftId, orderId);

    if (existing.version !== expectedVersion) {
      throw createApiError(
        'VERSION_CONFLICT',
        `Version conflict: expected ${expectedVersion}, but draft is at version ${existing.version}.`,
      );
    }

    const now = new Date().toISOString();
    const updatedDraft: AppraisalDraft = {
      ...existing,
      reportDocument,
      status: existing.status === DraftStatus.CREATED ? DraftStatus.EDITING : existing.status,
      updatedAt: now,
      lastEditedBy: userId,
      autoSavedAt: now,
      version: existing.version + 1,
    };

    // Recompute all section statuses
    for (const sid of DRAFT_SECTION_IDS) {
      updatedDraft.sectionStatus[sid] = this.evaluateSectionStatus(sid, reportDocument);
    }

    const { resource } = await this.container.item(draftId, orderId).replace(updatedDraft);
    if (!resource) {
      throw new Error(`Failed to save draft ${draftId}`);
    }

    logger.info('Draft saved', { draftId, version: updatedDraft.version });
    return resource as AppraisalDraft;
  }

  // ── Finalize ───────────────────────────────────────────────────────────────

  /**
   * Finalize a draft — validates all sections are complete, then marks FINALIZED.
   * The caller is responsible for copying the report to the `reporting` container.
   */
  async finalizeDraft(draftId: string, orderId: string, userId: string): Promise<AppraisalDraft> {
    const existing = await this.getDraft(draftId, orderId);

    if (existing.status === DraftStatus.FINALIZED || existing.status === DraftStatus.SUBMITTED) {
      throw new Error(`Draft ${draftId} is already ${existing.status}`);
    }

    // Check all required sections are complete
    const incompleteSections = DRAFT_SECTION_IDS.filter(
      sid => existing.sectionStatus[sid] !== SectionStatus.COMPLETE,
    );

    if (incompleteSections.length > 0) {
      throw new Error(
        `Cannot finalize: the following sections are not complete: ${incompleteSections.join(', ')}. ` +
        `Current statuses: ${incompleteSections.map(s => `${s}=${existing.sectionStatus[s]}`).join(', ')}`,
      );
    }

    const now = new Date().toISOString();
    const finalized: AppraisalDraft = {
      ...existing,
      status: DraftStatus.FINALIZED,
      updatedAt: now,
      lastEditedBy: userId,
      version: existing.version + 1,
    };

    const { resource } = await this.container.item(draftId, orderId).replace(finalized);
    if (!resource) {
      throw new Error(`Failed to finalize draft ${draftId}`);
    }

    logger.info('Draft finalized', { draftId });
    return resource as AppraisalDraft;
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  /**
   * Delete a draft. Only allowed for drafts in CREATED or EDITING status.
   */
  async deleteDraft(draftId: string, orderId: string): Promise<void> {
    const existing = await this.getDraft(draftId, orderId);

    if (existing.status === DraftStatus.FINALIZED || existing.status === DraftStatus.SUBMITTED) {
      throw new Error(
        `Cannot delete draft ${draftId}: it is in ${existing.status} status. ` +
        `Only CREATED or EDITING drafts can be deleted.`,
      );
    }

    await this.container.item(draftId, orderId).delete();
    logger.info('Draft deleted', { draftId, orderId });
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  /**
   * Load the order from the orders container to seed draft data.
   * Uses a cross-partition query because orders are partitioned by /tenantId
   * and the caller may not know the tenant at this point.
   */
  private async loadOrder(orderId: string): Promise<AppraisalOrder> {
    const ordersContainer = this.dbService.getContainer('orders');
    const querySpec: SqlQuerySpec = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.id = @id',
      parameters: [
        { name: '@type', value: 'order' },
        { name: '@id', value: orderId },
      ],
    };
    const { resources } = await ordersContainer.items.query<AppraisalOrder>(querySpec).fetchAll();
    if (!resources || resources.length === 0) {
      throw createApiError(ErrorCodes.ORDER_NOT_FOUND, `Order not found: ${orderId}`);
    }
    return resources[0] as AppraisalOrder;
  }

  /**
   * Seed a CanonicalReportDocument from order data.
   * Pre-populates address, borrower, lender, and loan info.
   */
  private seedReportFromOrder(
    order: AppraisalOrder,
    draftId: string,
    reportId: string,
    reportType: string,
  ): CanonicalReportDocument {
    const now = new Date().toISOString();

    // Build address from order's propertyAddress.
    // Seed orders may use { street, zip } while typed orders use { streetAddress, zipCode }.
    const pa = (order.propertyAddress ?? {}) as unknown as Record<string, unknown>;
    const address: CanonicalAddress = {
      streetAddress: (pa.streetAddress ?? pa.street ?? '') as string,
      unit: null,
      city: (pa.city ?? '') as string,
      state: (pa.state ?? '') as string,
      zipCode: (pa.zipCode ?? pa.zip ?? '') as string,
      county: (pa.county ?? '') as string,
    };

    // propertyDetails may be undefined on seed orders (flat shape)
    const pd = (order.propertyDetails ?? {}) as unknown as Record<string, unknown>;
    const subject: CanonicalSubject = {
      address,
      grossLivingArea: (pd.grossLivingArea as number) ?? 0,
      totalRooms: 0,
      bedrooms: (pd.bedrooms as number) ?? 0,
      // URAR v1.3: populate bathsFull/bathsHalf from order data when present; fall back to
      // deprecated combined bathrooms for orders that pre-date the v1.3 split.
      bathsFull: (pd.bathsFull as number) ?? null,
      bathsHalf: (pd.bathsHalf as number) ?? null,
      bathrooms: (pd.bathsFull as number) != null
        ? (pd.bathsFull as number) + ((pd.bathsHalf as number) ?? 0) * 0.5
        : (pd.bathrooms as number) ?? 0,
      stories: (pd.stories as number) ?? 0,
      lotSizeSqFt: (pd.lotSize as number) ?? 0,
      propertyType: (pd.propertyType as string) ?? '',
      condition: '',
      quality: '',
      design: '',
      yearBuilt: (pd.yearBuilt as number) ?? 0,
      foundationType: '',
      exteriorWalls: '',
      roofSurface: '',
      basement: '',
      basementFinishedSqFt: null,
      heating: '',
      cooling: '',
      fireplaces: 0,
      garageType: pd.garage ? 'Attached' : 'None',
      garageSpaces: pd.garage ? 1 : 0,
      porchPatioDeck: '',
      pool: (pd.pool as boolean) ?? false,
      attic: '',
      view: (pd.viewType as string) ?? '',
      locationRating: '',
      photos: null,
      latitude: (pa.coordinates as { latitude?: number })?.latitude ?? null,
      longitude: (pa.coordinates as { longitude?: number })?.longitude ?? null,
    };

    // Build borrower name — seed orders may have flat `borrowerName`
    const bi = order.borrowerInformation;
    const borrowerName = bi
      ? `${bi.firstName} ${bi.lastName}`.trim()
      : ((order as unknown as Record<string, unknown>).borrowerName as string) ?? null;

    return {
      id: draftId,
      reportId,
      orderId: order.id,
      reportType,
      status: 'DRAFT',
      schemaVersion: SCHEMA_VERSION,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber ?? null,
        borrowerName,
        ownerOfPublicRecord: null,
        clientName: null,
        clientCompanyName: null,
        clientAddress: null,
        clientEmail: null,
        loanNumber: null,
        effectiveDate: null,
        inspectionDate: null,
        isSubjectPurchase: order.loanInformation?.loanPurpose === LoanPurpose.PURCHASE,
        contractPrice: order.loanInformation?.contractPrice ?? null,
        contractDate: null,
        subjectPriorSaleDate1: null,
        subjectPriorSalePrice1: null,
        subjectPriorSaleDate2: null,
        subjectPriorSalePrice2: null,
      },
      subject,
      comps: [],
      valuation: null,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
    };
  }

  /**
   * Evaluate the status of a section based on the current report data.
   * A section is COMPLETE if all its required fields are non-empty.
   * A section is IN_PROGRESS if at least one field has data.
   * Otherwise NOT_STARTED.
   */
  private evaluateSectionStatus(sectionId: DraftSectionId, doc: CanonicalReportDocument): SectionStatus {
    switch (sectionId) {
      case 'subject':
        return this.evaluateSubjectStatus(doc);
      case 'site':
        return this.evaluateSiteStatus(doc);
      case 'contract':
        return this.evaluateContractStatus(doc);
      case 'neighborhood':
        return this.evaluateNeighborhoodStatus(doc);
      case 'improvements':
        return this.evaluateImprovementsStatus(doc);
      case 'sales-comparison':
        return doc.comps.length > 0 ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'cost-approach':
        return doc.costApproach ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'income-approach':
        return doc.incomeApproach ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'reconciliation':
        return doc.reconciliation?.finalOpinionOfValue
          ? SectionStatus.COMPLETE
          : doc.reconciliation ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'certification':
        return doc.appraiserInfo?.name ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'photos':
        return (doc.photos?.length ?? 0) > 0 ? SectionStatus.IN_PROGRESS : SectionStatus.NOT_STARTED;
      case 'addenda':
        // Addenda is optional — if reconciliation narrative exists, mark in-progress
        return doc.reconciliation?.reconciliationNarrative
          ? SectionStatus.IN_PROGRESS
          : SectionStatus.NOT_STARTED;
      default:
        return SectionStatus.NOT_STARTED;
    }
  }

  private evaluateSubjectStatus(doc: CanonicalReportDocument): SectionStatus {
    const s = doc.subject;
    const hasAddress = s.address.streetAddress && s.address.city && s.address.state && s.address.zipCode;
    if (!hasAddress && !s.parcelNumber && !s.currentOwner) return SectionStatus.NOT_STARTED;
    if (hasAddress && s.parcelNumber) return SectionStatus.COMPLETE;
    return SectionStatus.IN_PROGRESS;
  }

  private evaluateSiteStatus(doc: CanonicalReportDocument): SectionStatus {
    const s = doc.subject;
    if (!s.lotSizeSqFt && !s.zoning && !s.floodZone) return SectionStatus.NOT_STARTED;
    if (s.lotSizeSqFt && s.zoning && s.utilities) return SectionStatus.COMPLETE;
    return SectionStatus.IN_PROGRESS;
  }

  private evaluateContractStatus(doc: CanonicalReportDocument): SectionStatus {
    const c = doc.subject.contractInfo;
    if (!c) return SectionStatus.NOT_STARTED;
    if (c.contractPrice && c.contractDate && c.propertyRightsAppraised) return SectionStatus.COMPLETE;
    return SectionStatus.IN_PROGRESS;
  }

  private evaluateNeighborhoodStatus(doc: CanonicalReportDocument): SectionStatus {
    const n = doc.subject.neighborhood;
    if (!n) return SectionStatus.NOT_STARTED;
    if (n.locationType && n.builtUp && n.growth) return SectionStatus.COMPLETE;
    return SectionStatus.IN_PROGRESS;
  }

  private evaluateImprovementsStatus(doc: CanonicalReportDocument): SectionStatus {
    const s = doc.subject;
    if (!s.grossLivingArea && !s.yearBuilt && !s.design) return SectionStatus.NOT_STARTED;
    if (s.grossLivingArea && s.yearBuilt && s.condition && s.quality) return SectionStatus.COMPLETE;
    return SectionStatus.IN_PROGRESS;
  }

  /**
   * Deep merge: recursively merge source into target.
   * Arrays are replaced (not concatenated). Null/undefined in source
   * are skipped (don't overwrite existing data).
   */
  private deepMerge(target: unknown, source: unknown): unknown {
    if (source === null || source === undefined) return target;
    if (typeof source !== 'object' || Array.isArray(source)) return source;
    if (typeof target !== 'object' || target === null || Array.isArray(target)) return source;

    const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
    for (const key of Object.keys(source as Record<string, unknown>)) {
      const srcVal = (source as Record<string, unknown>)[key];
      if (srcVal !== undefined) {
        result[key] = this.deepMerge(result[key], srcVal);
      }
    }
    return result;
  }
}
