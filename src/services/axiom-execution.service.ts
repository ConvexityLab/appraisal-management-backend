import { Container } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { CosmosDbService } from './cosmos-db.service';
import { AxiomExecutionRecord, AxiomPipelineMode, AxiomExecutionStatus } from '../types/axiom.types';
import { ApiResponse, ApiError } from '../types/index';

function createApiError(code: string, message: string): ApiError {
  return { code, message, timestamp: new Date() };
}

export class AxiomExecutionService {
  private readonly containerName = 'axiom-executions';
  private container: Container;

  constructor(private readonly cosmosService: CosmosDbService) {
    this.container = this.cosmosService.getContainer(this.containerName);
  }

  /**
   * Initialize a new execution record representing an Axiom processing pipeline
   */
  async createExecution(params: {
    tenantId: string;
    orderId?: string | undefined;
    documentIds: string[];
    axiomFileSetId?: string | undefined;
    axiomJobId: string;
    pipelineMode: AxiomPipelineMode;
    initiatedBy: string;
  }): Promise<ApiResponse<AxiomExecutionRecord>> {
    try {
      const now = new Date().toISOString();
      const record: AxiomExecutionRecord = {
        id: uuidv4(),
        tenantId: params.tenantId,
        documentIds: params.documentIds,
        axiomJobId: params.axiomJobId,
        pipelineMode: params.pipelineMode,
        status: 'QUEUED',
        runCount: 1,
        initiatedBy: params.initiatedBy,
        createdAt: now,
        updatedAt: now
      };

      if (params.orderId) record.orderId = params.orderId;
      if (params.axiomFileSetId) record.axiomFileSetId = params.axiomFileSetId;

      const { resource } = await this.container.items.create(record);
      if (!resource) {
        return { success: false, error: createApiError('CREATE_FAILED', 'Failed to create Axiom Execution Record') };
      }

      return { success: true, data: resource as AxiomExecutionRecord };
    } catch (error) {
      console.error('[AxiomExecutionService] createExecution error:', error);
      return { success: false, error: createApiError('UNKNOWN_ERROR', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Update the status and/or results of an existing execution
   */
  async updateExecutionStatus(
    id: string,
    status: AxiomExecutionStatus,
    results?: any,
    failureReason?: string
  ): Promise<ApiResponse<AxiomExecutionRecord>> {
    try {
      const { resource: existing } = await this.container.item(id, id).read<AxiomExecutionRecord>();
      if (!existing) {
        return { success: false, error: createApiError('NOT_FOUND', `Execution record ${id} not found`) };
      }

      existing.status = status;
      existing.updatedAt = new Date().toISOString();
      
      if (results) existing.results = results;
      if (failureReason) existing.failureReason = failureReason;

      if (status === 'COMPLETED' || status === 'FAILED') {
        existing.completedAt = existing.updatedAt;
      }

      const { resource: updated } = await this.container.item(id, id).replace(existing);
      return { success: true, data: updated as AxiomExecutionRecord };
    } catch (error) {
      console.error(`[AxiomExecutionService] updateExecutionStatus error for ${id}:`, error);
      return { success: false, error: createApiError('UNKNOWN_ERROR', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Get an execution by standard platform ID
   */
  async getExecutionById(id: string): Promise<ApiResponse<AxiomExecutionRecord>> {
    try {
      const { resource } = await this.container.item(id, id).read<AxiomExecutionRecord>();
      if (!resource) return { success: false, error: createApiError('NOT_FOUND', 'Not found') };
      return { success: true, data: resource };
    } catch (error) {
      return { success: false, error: createApiError('UNKNOWN_ERROR', error instanceof Error ? error.message : 'Unknown error') };
    }
  }

  /**
   * Retrieve executions by OrderId
   */
  async getExecutionsByOrderId(tenantId: string, orderId: string): Promise<ApiResponse<AxiomExecutionRecord[]>> {
    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.orderId = @orderId ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@tenantId', value: tenantId },
          { name: '@orderId', value: orderId }
        ]
      };
      
      const { resources } = await this.container.items.query<AxiomExecutionRecord>(querySpec).fetchAll();
      return { success: true, data: resources };
    } catch (error) {
      return { success: false, error: createApiError('UNKNOWN_ERROR', error instanceof Error ? error.message : 'Unknown error') };
    }
  }
}