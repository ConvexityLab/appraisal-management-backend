/**
 * E-Signature Service
 * Provider-agnostic e-signature workflow management.
 * Stores signing requests in the 'esignature-requests' Cosmos container.
 * Real provider integration (DocuSign, Adobe Sign) is a follow-up;
 * this service manages the lifecycle, state machine, and Cosmos persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import { Container } from '@azure/cosmos';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index';
import {
  ESignatureRequest,
  ESignatureStatus,
  ESignatureEvent,
  CreateESignatureInput,
  UpdateESignatureStatusInput,
  VALID_ESIGNATURE_TRANSITIONS,
} from '../types/esignature.types';
import { createApiError } from '../utils/api-response.util';
import { Logger } from '../utils/logger.js';

export class ESignatureService {
  private readonly containerName = 'esignature-requests';
  private container: Container;
  private readonly logger: Logger;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.container = this.cosmosService.getContainer(this.containerName);
    this.logger = new Logger();
  }

  /**
   * Create a new e-signature request.
   */
  async createSigningRequest(
    tenantId: string,
    input: CreateESignatureInput,
    requestedBy: string,
    requestedByEmail: string
  ): Promise<ApiResponse<ESignatureRequest>> {
    try {
      if (!input.orderId) {
        return { success: false, error: createApiError('VALIDATION_ERROR', 'orderId is required') };
      }
      if (!input.documentId) {
        return { success: false, error: createApiError('VALIDATION_ERROR', 'documentId is required') };
      }
      if (!input.signers || input.signers.length === 0) {
        return { success: false, error: createApiError('VALIDATION_ERROR', 'At least one signer is required') };
      }

      const now = new Date().toISOString();
      const request: ESignatureRequest = {
        id: uuidv4(),
        tenantId,
        orderId: input.orderId,
        documentId: input.documentId,
        documentName: input.documentName,
        provider: input.provider || 'internal',
        status: ESignatureStatus.DRAFT,
        signers: input.signers.map(s => ({
          name: s.name,
          email: s.email,
          role: s.role,
          signingOrder: s.signingOrder,
          status: 'pending' as const,
        })),
        requestedBy,
        requestedByEmail,
        requestedAt: now,
        ...(input.message != null && { message: input.message }),
        ...(input.expiresAt != null && { expiresAt: input.expiresAt }),
        createdAt: now,
        updatedAt: now,
        events: [{
          id: uuidv4(),
          action: 'CREATED',
          performedBy: requestedBy,
          details: `Signing request created for document "${input.documentName}" with ${input.signers.length} signer(s)`,
          timestamp: now,
        }],
      };

      await this.container.items.create(request);

      this.logger.info('Created e-signature request', {
        requestId: request.id,
        orderId: input.orderId,
        documentId: input.documentId,
        signerCount: input.signers.length,
      });

      return { success: true, data: request };
    } catch (error) {
      this.logger.error('Failed to create e-signature request', { error });
      return {
        success: false,
        error: createApiError('CREATE_ESIGNATURE_FAILED', error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  }

  /**
   * Get a single signing request by ID.
   */
  async getSigningRequest(
    id: string,
    tenantId: string
  ): Promise<ApiResponse<ESignatureRequest>> {
    try {
      const query = 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId';
      const result = await this.cosmosService.queryItems<ESignatureRequest>(
        this.containerName,
        query,
        [{ name: '@id', value: id }, { name: '@tenantId', value: tenantId }]
      );

      if (!result.success || !result.data || result.data.length === 0) {
        return { success: false, error: createApiError('NOT_FOUND', `Signing request '${id}' not found`) };
      }

      const request = result.data[0];
      if (!request) {
        return { success: false, error: createApiError('NOT_FOUND', `Signing request '${id}' not found`) };
      }

      return { success: true, data: request };
    } catch (error) {
      this.logger.error('Failed to get signing request', { id, error });
      return { success: false, error: createApiError('GET_ESIGNATURE_FAILED', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * List signing requests for an order.
   */
  async getSigningRequestsByOrder(
    orderId: string,
    tenantId: string,
    limit = 50
  ): Promise<ApiResponse<ESignatureRequest[]>> {
    try {
      const query = 'SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit';
      const result = await this.cosmosService.queryItems<ESignatureRequest>(
        this.containerName,
        query,
        [
          { name: '@orderId', value: orderId },
          { name: '@tenantId', value: tenantId },
          { name: '@limit', value: limit },
        ]
      );

      return { success: true, data: result.data || [] };
    } catch (error) {
      this.logger.error('Failed to list signing requests', { orderId, error });
      return { success: false, error: createApiError('LIST_ESIGNATURE_FAILED', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Update the status of a signing request.
   * Validates state machine transitions.
   */
  async updateSigningStatus(
    id: string,
    tenantId: string,
    input: UpdateESignatureStatusInput,
    performedBy: string
  ): Promise<ApiResponse<ESignatureRequest>> {
    try {
      // Fetch current request
      const getResult = await this.getSigningRequest(id, tenantId);
      if (!getResult.success || !getResult.data) {
        return getResult;
      }

      const request = getResult.data;

      // Validate state transition
      const allowedTransitions = VALID_ESIGNATURE_TRANSITIONS[request.status];
      if (!allowedTransitions || !allowedTransitions.has(input.status)) {
        return {
          success: false,
          error: createApiError(
            'INVALID_TRANSITION',
            `Cannot transition from '${request.status}' to '${input.status}'. Allowed: ${[...VALID_ESIGNATURE_TRANSITIONS[request.status]].join(', ') || 'none (terminal state)'}`,
          ),
        };
      }

      const now = new Date().toISOString();

      // Apply signer updates if provided
      if (input.signerUpdates) {
        for (const update of input.signerUpdates) {
          const signer = request.signers.find(s => s.email === update.email);
          if (signer) {
            signer.status = update.status;
            if (update.signedAt) signer.signedAt = update.signedAt;
            if (update.declinedAt) signer.declinedAt = update.declinedAt;
            if (update.declineReason) signer.declineReason = update.declineReason;
          }
        }
      }

      // Update request fields
      request.status = input.status;
      request.updatedAt = now;
      if (input.externalEnvelopeId) request.externalEnvelopeId = input.externalEnvelopeId;
      if (input.signingUrl) request.signingUrl = input.signingUrl;
      if (input.signedDocumentUrl) request.signedDocumentUrl = input.signedDocumentUrl;
      if (input.signedDocumentId) request.signedDocumentId = input.signedDocumentId;
      if (input.status === ESignatureStatus.COMPLETED) request.completedAt = now;

      // Add audit event
      request.events.push({
        id: uuidv4(),
        action: `STATUS_${input.status}`,
        performedBy,
        details: `Status changed from '${getResult.data.status}' to '${input.status}'`,
        timestamp: now,
      });

      await this.container.item(id, tenantId).replace(request);

      this.logger.info('Updated signing request status', {
        requestId: id,
        from: getResult.data.status,
        to: input.status,
      });

      return { success: true, data: request };
    } catch (error) {
      this.logger.error('Failed to update signing status', { id, error });
      return { success: false, error: createApiError('UPDATE_ESIGNATURE_FAILED', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Cancel (void) a signing request.
   */
  async cancelSigningRequest(
    id: string,
    tenantId: string,
    performedBy: string,
    reason?: string
  ): Promise<ApiResponse<ESignatureRequest>> {
    return this.updateSigningStatus(id, tenantId, {
      status: ESignatureStatus.VOIDED,
    }, performedBy);
  }
}
