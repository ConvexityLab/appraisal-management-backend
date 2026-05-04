/**
 * Internal E-Sign Service
 *
 * Homegrown engagement-letter signing provider.
 * Flow:
 *   1. generateSigningToken()  — create a 1-time token; store in Cosmos
 *   2. Email the vendor a link:  <API_BASE_URL>/api/esign/letter/<token>
 *   3. GET  /api/esign/letter/:token — return letter content for the vendor to review
 *   4. POST /api/esign/letter/:token/accept  — vendor clicks "I agree"
 *   5. POST /api/esign/letter/:token/decline — vendor clicks "Decline"
 *   Steps 4/5 validate the token, mark it used, update the letter record,
 *   and publish the appropriate event.
 *
 * Token document stored in the 'esign-tokens' Cosmos container
 * (partition key: tenantId).
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import type {
  EngagementLetterSignedEvent,
  EngagementLetterDeclinedEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

export interface SigningTokenRecord {
  id: string;
  token: string;
  letterId: string;
  orderId: string;
  orderNumber: string;
  tenantId: string;
  clientId?: string;
  vendorId: string;
  vendorEmail: string;
  expiresAt: string; // ISO
  usedAt?: string;   // ISO — set when accepted or declined
  decision?: 'accepted' | 'declined';
  declineReason?: string;
  ipAddress?: string;
  type: 'esign-token';
}

export interface GenerateSigningTokenResult {
  token: string;
  signingUrl: string;
  expiresAt: Date;
}

export interface SigningContext {
  tokenRecord: SigningTokenRecord;
  letterContent: Record<string, unknown>;
}

export class InternalESignService {
  private readonly logger = new Logger('InternalESignService');
  private readonly publisher: ServiceBusEventPublisher;

  /** Token validity window. Default 72 h. */
  private readonly TOKEN_EXPIRY_HOURS = 72;

  constructor(private readonly dbService: CosmosDbService) {
    this.publisher = new ServiceBusEventPublisher();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a one-time signing token and return the URL to send to the vendor.
   */
  async generateSigningToken(
    letterId: string,
    orderId: string,
    orderNumber: string,
    tenantId: string,
    vendorId: string,
    vendorEmail: string,
  ): Promise<GenerateSigningTokenResult> {
    const apiBaseUrl = process.env['API_BASE_URL'];
    if (!apiBaseUrl) {
      throw new Error(
        'API_BASE_URL is required for internal e-sign signing URLs — configure it in environment settings',
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    const record: SigningTokenRecord = {
      id: uuidv4(),
      token,
      letterId,
      orderId,
      orderNumber,
      tenantId,
      vendorId,
      vendorEmail,
      expiresAt: expiresAt.toISOString(),
      type: 'esign-token',
    };

    await this.saveToken(record);

    const signingUrl = `${apiBaseUrl}/api/esign/letter/${token}`;
    this.logger.info('Signing token created', { letterId, orderId, vendorId, expiresAt });

    return { token, signingUrl, expiresAt };
  }

  /**
   * Retrieve the signing context (token record + letter content) for display.
   * Returns null if the token is invalid, expired, or already used.
   */
  async getSigningContext(token: string): Promise<SigningContext | null> {
    const record = await this.findToken(token);
    if (!record) {
      this.logger.warn('Signing context lookup: token not found', { token: token.slice(0, 8) });
      return null;
    }
    if (new Date(record.expiresAt) < new Date()) {
      this.logger.warn('Signing context lookup: token expired', { letterId: record.letterId });
      return null;
    }
    if (record.usedAt) {
      this.logger.warn('Signing context lookup: token already used', { letterId: record.letterId, decision: record.decision });
      return null;
    }

    const letterContent = await this.getLetterContent(record.letterId, record.tenantId);
    return { tokenRecord: record, letterContent };
  }

  /**
   * Vendor accepts — marks token used, updates letter to SIGNED, publishes event.
   */
  async acceptLetter(token: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    const record = await this.findToken(token);

    if (!record) {
      return { success: false, message: 'Invalid signing link.' };
    }
    if (new Date(record.expiresAt) < new Date()) {
      return { success: false, message: 'This signing link has expired. Please contact your AMC coordinator for a new link.' };
    }
    if (record.usedAt) {
      const verb = record.decision === 'accepted' ? 'already been signed' : 'been declined';
      return { success: false, message: `This engagement letter has ${verb}.` };
    }

    // Mark token used
    await this.markTokenUsed(record, 'accepted', undefined, ipAddress);

    // Update letter record status → SIGNED
    await this.updateLetterStatus(record.letterId, record.tenantId, 'SIGNED', new Date().toISOString());

    // Publish event
    const event: EngagementLetterSignedEvent = {
      id: uuidv4(),
      type: 'engagement.letter.signed',
      timestamp: new Date(),
      source: 'internal-esign-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: record.orderId,
        orderNumber: record.orderNumber,
        tenantId: record.tenantId,
        clientId: record.clientId ?? '',
        vendorId: record.vendorId,
        letterId: record.letterId,
        signedAt: new Date(),
        ...(ipAddress !== undefined ? { ipAddress } : {}),
        priority: EventPriority.HIGH,
      },
    };
    await this.publisher.publish(event).catch(err =>
      this.logger.warn('Failed to publish engagement.letter.signed', { error: (err as Error).message }),
    );

    this.logger.info('Engagement letter accepted', { letterId: record.letterId, orderId: record.orderId });
    return { success: true, message: 'Thank you — your engagement letter has been signed.' };
  }

  /**
   * Vendor declines — marks token used, updates letter to DECLINED, publishes event.
   */
  async declineLetter(token: string, reason?: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    const record = await this.findToken(token);

    if (!record) {
      return { success: false, message: 'Invalid signing link.' };
    }
    if (new Date(record.expiresAt) < new Date()) {
      return { success: false, message: 'This signing link has expired.' };
    }
    if (record.usedAt) {
      return { success: false, message: 'This engagement letter has already been responded to.' };
    }

    await this.markTokenUsed(record, 'declined', reason, ipAddress);
    await this.updateLetterStatus(record.letterId, record.tenantId, 'DECLINED');

    const event: EngagementLetterDeclinedEvent = {
      id: uuidv4(),
      type: 'engagement.letter.declined',
      timestamp: new Date(),
      source: 'internal-esign-service',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: record.orderId,
        orderNumber: record.orderNumber,
        tenantId: record.tenantId,
        clientId: record.clientId ?? '',
        vendorId: record.vendorId,
        letterId: record.letterId,
        declinedAt: new Date(),
        ...(reason !== undefined ? { reason } : {}),
        priority: EventPriority.HIGH,
      },
    };
    await this.publisher.publish(event).catch(err =>
      this.logger.warn('Failed to publish engagement.letter.declined', { error: (err as Error).message }),
    );

    this.logger.info('Engagement letter declined', { letterId: record.letterId, reason });
    return { success: true, message: 'Your response has been recorded.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async saveToken(record: SigningTokenRecord): Promise<void> {
    const container = this.dbService.getContainer('esign-tokens');
    await container.items.create({ ...record });
  }

  private async findToken(token: string): Promise<SigningTokenRecord | null> {
    const container = this.dbService.getContainer('esign-tokens');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'esign-token' AND c.token = @token`,
      parameters: [{ name: '@token', value: token }],
    }).fetchAll();
    return resources.length > 0 ? (resources[0] as SigningTokenRecord) : null;
  }

  private async markTokenUsed(
    record: SigningTokenRecord,
    decision: 'accepted' | 'declined',
    declineReason?: string,
    ipAddress?: string,
  ): Promise<void> {
    const container = this.dbService.getContainer('esign-tokens');
    const updated: SigningTokenRecord = {
      ...record,
      usedAt: new Date().toISOString(),
      decision,
      ...(declineReason ? { declineReason } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    };
    await container.items.upsert(updated);
  }

  private async updateLetterStatus(
    letterId: string,
    tenantId: string,
    status: string,
    completedAt?: string,
  ): Promise<void> {
    const container = this.dbService.getContainer('orders');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'engagement-letter' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: letterId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    if (resources.length === 0) {
      this.logger.warn('updateLetterStatus: letter record not found', { letterId });
      return;
    }

    const letter = resources[0] as Record<string, unknown>;
    letter['status'] = status;
    if (status === 'SIGNED') letter['signedAt'] = completedAt ?? new Date().toISOString();
    if (status === 'DECLINED') letter['declinedAt'] = new Date().toISOString();

    await container.items.upsert(letter);
  }

  private async getLetterContent(letterId: string, tenantId: string): Promise<Record<string, unknown>> {
    const container = this.dbService.getContainer('orders');
    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'engagement-letter' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: letterId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources.length > 0 ? (resources[0] as Record<string, unknown>) : {};
  }
}
