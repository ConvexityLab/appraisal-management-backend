import { parsePrioEvaluationResponse } from '../../integrations/mop/inbound.adapter.js';
import type { PrioRuleViolation } from '../../integrations/mop/inbound.adapter.js';

export interface EvaluationRequest {
  rules: any[]; // The flat array of rules coming from RuleMergerService
  facts: Record<string, any>; // The Appraisal data / variables to evaluate
}

export type RuleViolation = PrioRuleViolation;

export interface EvaluationResponse {
  success: boolean;
  violations: RuleViolation[];
  processing_time_ms?: number;
}

/**
 * Service to orchestrate communication directly with the Prio C++ Engine
 * bypassing the MOP pricing domains. It exclusively feeds dynamic rules
 * and facts via HTTP/gRPC.
 */
export class PrioEvaluationClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    // Defaults to the Prio microservice URL exposed internally
    this.endpoint = endpoint || process.env.PRIO_ENGINE_URL || 'http://localhost:8080/api/v1/rules/evaluate';
  }

  /**
   * Evaluates the given compiled rule array against the appraisal facts.
   * @param request The rules payload and facts payload
   * @returns List of triggered violations
   */
  public async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Prio Engine evaluation failed with status ${response.status}: ${response.statusText}`);
      }

      const rawResponse = await response.json();

      // Validate + project via the Zod-backed adapter. Throws
      // MopResponseValidationError on shape mismatch, which propagates as
      // a hard failure (bad shape from internal infra is a contract bug).
      const { violations, processingTimeMs } = parsePrioEvaluationResponse(rawResponse);

      return {
        success: true,
        violations,
        ...(processingTimeMs != null ? { processing_time_ms: processingTimeMs } : {}),
      };
      
    } catch (error) {
      console.error('[PrioEvaluationClient] Error calling Prio Engine:', error);
      throw error;
    }
  }
}
