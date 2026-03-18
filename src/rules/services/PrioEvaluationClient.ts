export interface EvaluationRequest {
  rules: any[]; // The flat array of rules coming from RuleMergerService
  facts: Record<string, any>; // The Appraisal data / variables to evaluate
}

export interface RuleViolation {
  rule_id: string;
  severity: string;
  reason: string;
  violation_code: string;
}

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
      
      // Map the generic facts asserted back out from Prio into our known Violation domain model
      const violations: RuleViolation[] = rawResponse.actions_fired
        ?.filter((action: any) => action.fact_id === 'compliance_violation')
        .map((action: any) => {
           return {
             rule_id: action.source || 'UNKNOWN_RULE',
             severity: action.data?.severity || 'Warning',
             reason: action.data?.reason || 'Unknown violation occurred',
             violation_code: action.data?.violation_code || 'UNKNOWN_CODE'
           };
        }) || [];

      return {
        success: true,
        violations,
        processing_time_ms: rawResponse.processing_time_ms
      };
      
    } catch (error) {
      console.error('[PrioEvaluationClient] Error calling Prio Engine:', error);
      throw error;
    }
  }
}
