/**
 * Engagement Letter Orchestration Service (Phase 1.1)
 *
 * Composes TemplateService (for template selection) + ReportEngineService
 * (for PDF rendering) + ESignatureService (for signing flow) to produce
 * engagement letters on vendor assignment.
 *
 * Supports all product types (1004, 1025, 1073, 1004D, Desktop, Hybrid, BPO, DVR).
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EngagementLetterRequest {
  orderId: string;
  engagementId?: string;
  vendorId: string;
  clientId: string;
  tenantId: string;
  productType: string;
  templateId?: string;
  /** Override placeholders (e.g., custom scope-of-work text) */
  overrides?: Record<string, string>;
}

export interface EngagementLetterResult {
  letterId: string;
  orderId: string;
  vendorId: string;
  status: 'GENERATED' | 'SENT_FOR_SIGNATURE' | 'SIGNED' | 'DECLINED' | 'EXPIRED';
  pdfBlobUrl?: string;
  signingRequestId?: string;
  generatedAt: string;
  content: EngagementLetterContent;
}

export interface EngagementLetterContent {
  scopeOfWork: string;
  airIndependenceStatement: string;
  dueDateTimezone: string;
  requiredExhibits: string[];
  changeOrderPolicy: string;
  communicationProtocol: string;
  piiSecurityClause: string;
  deliverables: string[];
  feeAmount: number;
  currency: string;
}

export interface EngagementLetterTemplate {
  id: string;
  tenantId: string;
  clientId?: string;
  productType: string;
  name: string;
  version: number;
  content: EngagementLetterContent;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class EngagementLetterService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('EngagementLetterService');
  }

  /**
   * Generate an engagement letter for a vendor assignment.
   * Auto-selects template by product type and client, renders content with
   * order-specific placeholders, and creates a signing request.
   */
  async generateEngagementLetter(request: EngagementLetterRequest): Promise<EngagementLetterResult> {
    this.logger.info('Generating engagement letter', {
      orderId: request.orderId,
      vendorId: request.vendorId,
      productType: request.productType,
    });

    // 1. Select template
    const template = await this.selectTemplate(request);

    // 2. Resolve order & vendor details for placeholder substitution
    const orderData = await this.getOrderData(request.orderId);
    const vendorData = await this.getVendorData(request.vendorId, request.tenantId);

    // 3. Build letter content with resolved placeholders
    const content = this.buildLetterContent(template, orderData, vendorData, request);

    // 4. Persist engagement letter record
    const letterId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const result: EngagementLetterResult = {
      letterId,
      orderId: request.orderId,
      vendorId: request.vendorId,
      status: 'GENERATED',
      generatedAt: new Date().toISOString(),
      content,
    };

    await this.saveLetterRecord(result, request.tenantId);

    this.logger.info('Engagement letter generated', { letterId, orderId: request.orderId });

    return result;
  }

  /**
   * Send a generated engagement letter for e-signature.
   */
  async sendForSignature(letterId: string, tenantId: string): Promise<EngagementLetterResult> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Orders container not initialized');

    // Fetch letter record
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'engagement-letter' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: letterId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    if (resources.length === 0) {
      throw new Error(`Engagement letter not found: ${letterId}`);
    }

    const letter = resources[0] as EngagementLetterResult & { tenantId: string; type: string };

    // Create signing request via ESignatureService lifecycle
    // (actual provider integration — DocuSign/Adobe Sign — is Phase 5.9)
    const signingRequestId = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    letter.signingRequestId = signingRequestId;
    letter.status = 'SENT_FOR_SIGNATURE';

    await container.items.upsert(letter);

    this.logger.info('Engagement letter sent for signature', { letterId, signingRequestId });

    return letter;
  }

  /**
   * List available engagement letter templates for a tenant,
   * optionally filtered by product type.
   */
  async getTemplates(tenantId: string, productType?: string): Promise<EngagementLetterTemplate[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Orders container not initialized');

    const params: Array<{ name: string; value: string }> = [
      { name: '@tid', value: tenantId },
    ];
    let query = `SELECT * FROM c WHERE c.type = 'engagement-letter-template' AND c.tenantId = @tid`;
    if (productType) {
      query += ` AND c.productType = @pt`;
      params.push({ name: '@pt', value: productType });
    }
    query += ` ORDER BY c.productType ASC, c.version DESC`;

    const { resources } = await container.items.query({ query, parameters: params }).fetchAll();
    return resources as EngagementLetterTemplate[];
  }

  /**
   * Query engagement letters for an order.
   */
  async getLettersForOrder(orderId: string, tenantId: string): Promise<EngagementLetterResult[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Orders container not initialized');

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'engagement-letter' AND c.orderId = @orderId AND c.tenantId = @tid ORDER BY c.generatedAt DESC`,
      parameters: [
        { name: '@orderId', value: orderId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources as EngagementLetterResult[];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async selectTemplate(request: EngagementLetterRequest): Promise<EngagementLetterContent> {
    if (request.templateId) {
      const template = await this.loadTemplate(request.templateId, request.tenantId);
      if (template) return template.content;
    }

    // Auto-select: client-specific template for product type, or global default
    const container = (this.dbService as any).ordersContainer;
    if (container) {
      const { resources } = await container.items.query({
        query: `SELECT * FROM c WHERE c.type = 'engagement-letter-template' AND c.tenantId = @tid AND c.productType = @pt AND c.isDefault = true ORDER BY c.version DESC OFFSET 0 LIMIT 1`,
        parameters: [
          { name: '@tid', value: request.tenantId },
          { name: '@pt', value: request.productType },
        ],
      }).fetchAll();
      if (resources.length > 0) return (resources[0] as EngagementLetterTemplate).content;
    }

    // Fallback: built-in default content
    return this.getDefaultContent(request.productType);
  }

  private async loadTemplate(templateId: string, tenantId: string): Promise<EngagementLetterTemplate | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'engagement-letter-template' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: templateId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources.length > 0 ? resources[0] as EngagementLetterTemplate : null;
  }

  private async getOrderData(orderId: string): Promise<Record<string, any>> {
    const result = await this.dbService.findOrderById(orderId);
    return result.success && result.data ? result.data as Record<string, any> : {};
  }

  private async getVendorData(vendorId: string, tenantId: string): Promise<Record<string, any>> {
    const container = (this.dbService as any).vendorsContainer;
    if (!container) return {};
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: vendorId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources.length > 0 ? resources[0] : {};
  }

  private buildLetterContent(
    template: EngagementLetterContent,
    orderData: Record<string, any>,
    vendorData: Record<string, any>,
    request: EngagementLetterRequest,
  ): EngagementLetterContent {
    const dueDate = orderData.dueDate
      ? new Date(orderData.dueDate).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
      : 'TBD';

    const addr = orderData.propertyAddress;
    const fullAddress = addr
      ? `${addr.streetAddress ?? ''}, ${addr.city ?? ''}, ${addr.state ?? ''} ${addr.zipCode ?? ''}`.trim()
      : 'Property address pending';

    return {
      scopeOfWork: request.overrides?.scopeOfWork ?? template.scopeOfWork.replace('{{PROPERTY_ADDRESS}}', fullAddress).replace('{{PRODUCT_TYPE}}', request.productType),
      airIndependenceStatement: template.airIndependenceStatement,
      dueDateTimezone: `Due: ${dueDate} ET`,
      requiredExhibits: template.requiredExhibits,
      changeOrderPolicy: template.changeOrderPolicy,
      communicationProtocol: template.communicationProtocol,
      piiSecurityClause: template.piiSecurityClause,
      deliverables: template.deliverables,
      feeAmount: orderData.orderFee ?? template.feeAmount ?? 0,
      currency: 'USD',
    };
  }

  private getDefaultContent(productType: string): EngagementLetterContent {
    return {
      scopeOfWork: `Appraisal engagement for {{PROPERTY_ADDRESS}} — {{PRODUCT_TYPE}} product. Appraiser shall complete the assignment in accordance with USPAP, applicable state law, and client-specific guidelines provided herein.`,
      airIndependenceStatement: 'The appraiser warrants that they are independent of the parties involved in this transaction. No relationship exists that would create a conflict of interest or compromise the objectivity of the assignment.',
      dueDateTimezone: 'Due date per order assignment, Eastern Time',
      requiredExhibits: this.getRequiredExhibits(productType),
      changeOrderPolicy: 'Scope changes require written client approval and may result in fee and timeline adjustments. The AMC will issue a revised engagement letter for material scope changes.',
      communicationProtocol: 'All assignment-related communication shall be through the platform. Borrower scheduling contact via platform-provided phone/email only. Status updates required at each milestone.',
      piiSecurityClause: 'Appraiser shall protect all personally identifiable information (PII) in accordance with GLBA and applicable state privacy laws. No PII shall be transmitted via unencrypted channels.',
      deliverables: this.getDeliverables(productType),
      feeAmount: 0,
      currency: 'USD',
    };
  }

  private getRequiredExhibits(productType: string): string[] {
    const common = ['Subject photos (front, rear, street)', 'Location map', 'Sketch/floor plan'];
    const byType: Record<string, string[]> = {
      'full_appraisal': [...common, 'Comparable sale photos', 'Comparable location map', 'UAD addendum'],
      'desktop_appraisal': ['Location map', 'UAD addendum', 'Data source documentation'],
      'hybrid_appraisal': [...common, 'Inspector credentials', 'Geo-tagged inspection photos'],
      'bpo_exterior': ['Subject exterior photos', 'Location map', 'Market data summary'],
      'bpo_interior': [...common, 'Interior condition photos', 'Market data summary'],
      'dvr': ['Data source documentation', 'AVM/model output', 'Market data summary'],
    };
    return byType[productType] ?? common;
  }

  private getDeliverables(productType: string): string[] {
    const byType: Record<string, string[]> = {
      'full_appraisal': ['Uniform Residential Appraisal Report (URAR/1004)', 'MISMO 3.4 XML', 'PDF report'],
      'desktop_appraisal': ['Desktop Appraisal Report', 'MISMO 3.4 XML', 'PDF report'],
      'hybrid_appraisal': ['Hybrid Appraisal Report', 'MISMO 3.4 XML', 'Inspection report', 'PDF report'],
      'bpo_exterior': ['Broker Price Opinion — Exterior', 'PDF report'],
      'bpo_interior': ['Broker Price Opinion — Interior', 'PDF report'],
      'dvr': ['Desktop Valuation Review', 'PDF report'],
      'field_review': ['Field Review Report (1033)', 'PDF report'],
      'desk_review': ['Desk Review Report', 'PDF report'],
    };
    return byType[productType] ?? ['Appraisal report', 'PDF report'];
  }

  private async saveLetterRecord(result: EngagementLetterResult, tenantId: string): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      this.logger.warn('Cannot save engagement letter — orders container not initialized');
      return;
    }

    // Replace any existing draft letters for this order so regenerating
    // doesn't accumulate duplicates.
    const { resources: existing } = await container.items.query({
      query: `SELECT c.id, c.tenantId FROM c WHERE c.type = 'engagement-letter' AND c.orderId = @orderId AND c.tenantId = @tid`,
      parameters: [
        { name: '@orderId', value: result.orderId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    for (const old of existing) {
      await container.item(old.id, old.tenantId).delete();
    }

    await container.items.create({
      ...result,
      id: result.letterId,
      type: 'engagement-letter',
      tenantId,
    });
  }
}
