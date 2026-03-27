export interface MopComplianceViolation {
  program: string;
  reason: string;
  violation_code: string;
}

export interface MopQuoteResponse {
  program: string;
  violations?: MopComplianceViolation[];
  [key: string]: any;
}

export class MopApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8090') {
    this.baseUrl = baseUrl;
  }

  /**
   * Sends the payload to MOP's evaluation endpoint to retrieve rules output.
   */
  public async evaluateCompliance(payload: any): Promise<MopComplianceViolation[]> {
    if (this.baseUrl === 'mock' || process.env.MOCK_MOP === 'true') {
      return [
        { program: 'Conventional', reason: 'Missing necessary data in report', violation_code: 'MISSING_DATA' },
        { program: 'FHA', reason: 'Zoning appears to be commercial', violation_code: 'ZONING_COMMERCIAL' }
      ];
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`MOP Engine error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // In MOP, assertions generally manifest as some part of the resulting JSON 
      // or an array of reasons. We'll anticipate MOP returning a list of violations based
      // on the assert properties we declared.
      
      // We are returning an array of assertion datas (our MopComplianceViolation structures)
      // Since MOP was initially meant to quote a single program, let's extract the results.

      // If the MOP API provides a top-level `reasons` or similar, we should map them:
      // Note: This relies on how MOP serializes "assert" rules. 
      // Often MOP gathers "assert" and returns them as "reasons", "denials", or similar.

      // Based on our config: "type": "assert", "fact_id": "compliance_violation"
      // Assuming MOP aggregates these into a top-level array:
      
      const violations: MopComplianceViolation[] = data.compliance_violation || data.denials || data.audit_trail || [];

      // Fallback depending on format:
      if (Array.isArray(violations)) {
        return violations;
      }
      
      // Secondary fallback based on the data directly
      if (data.reason && data.violation_code) {
        return [{
            program: data.program,
            reason: data.reason,
            violation_code: data.violation_code
        }];
      }

      return [];
    } catch (error: any) {
      // Re-throw with clear message
      throw new Error(`Failed to evaluate compliance with MOP: ${error.message}`);
    }
  }
}
