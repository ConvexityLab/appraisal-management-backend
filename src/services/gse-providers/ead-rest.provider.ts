/**
 * EAD REST Submission Provider (FHA — HUD)
 *
 * Implementation of SubmissionProvider for the FHA Electronic Appraisal Delivery (EAD) portal.
 * EAD accepts appraisal reports via a REST/JSON API (unlike UCDP's SOAP interface).
 *
 * Key flows:
 *   submit()      — POST MISMO XML (base64) to EAD REST endpoint, return case number + findings
 *   checkStatus() — GET case status by case number
 *
 * Required env vars:
 *   EAD_API_KEY         — EAD API key (from FHA Connection / HUD developer portal)
 *   EAD_CLIENT_ID       — EAD OAuth client ID
 *   EAD_CLIENT_SECRET   — EAD OAuth client secret
 *   EAD_ENV             — 'production' | 'sandbox'  (default: 'sandbox')
 *
 * EAD technical guide:
 *   https://www.hud.gov/program_offices/housing/sfh/ead/ead_techguide
 *
 * NOTE: FHA EAD uses OAuth 2.0 client credentials for machine-to-machine auth.
 * The lenderId parameter maps to the Mortgagee ID (FHA lender number).
 */

import type {
  SubmissionProvider,
  SubmissionPortal,
  SubmissionStatus,
  SSRFinding,
} from '../ucdp-ead-submission.service.js';
import { Logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Internal shapes for EAD REST responses
// ---------------------------------------------------------------------------

interface EadSubmitResponse {
  caseNumber: string;
  eadStatus: string;
  findings?: Array<{
    ruleId: string;
    severity: 'HARD_STOP' | 'WARNING' | 'INFORMATIONAL';
    category: string;
    message: string;
    fieldPath?: string;
  }>;
  errorMessage?: string;
}

interface EadStatusResponse {
  eadStatus: string;
  findings?: EadSubmitResponse['findings'];
}

interface EadTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ---------------------------------------------------------------------------

export class EadRestProvider implements SubmissionProvider {
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  // Cached access token
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    apiKey: string,
    clientId: string,
    clientSecret: string,
    env: string = 'sandbox',
  ) {
    this.apiKey       = apiKey;
    this.clientId     = clientId;
    this.clientSecret = clientSecret;
    this.logger       = new Logger('EadRestProvider');

    this.baseUrl = env === 'production'
      ? 'https://ead.hud.gov/api/v2'
      : 'https://ead-test.hud.gov/api/v2';
  }

  // =========================================================================
  // submit — upload MISMO 3.4 XML and retrieve EAD case number + findings
  // =========================================================================
  async submit(
    portal: SubmissionPortal,
    xmlContent: string,
    lenderId: string,
  ): Promise<{ portalDocumentId: string; status: SubmissionStatus; findings: SSRFinding[] }> {
    if (portal !== 'EAD') {
      throw new Error(`EadRestProvider only handles EAD submissions (received: ${portal})`);
    }

    try {
      const token = await this.getAccessToken();

      const payload = {
        mortgageeId:     lenderId,
        documentFormat:  'MISMO_3_4',
        documentContent: Buffer.from(xmlContent).toString('base64'),
      };

      const response = await this.callEad<EadSubmitResponse>('POST', '/appraisals', token, payload);

      if (response.errorMessage) {
        throw new Error(response.errorMessage);
      }

      return {
        portalDocumentId: response.caseNumber,
        status:           this.mapEadStatus(response.eadStatus),
        findings:         this.mapFindings(response.findings),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('EadRestProvider.submit failed', { error: message });
      throw new Error(`EAD submit failed: ${message}`);
    }
  }

  // =========================================================================
  // checkStatus — poll an existing EAD submission
  // =========================================================================
  async checkStatus(
    portal: SubmissionPortal,
    portalDocumentId: string,
  ): Promise<{ status: SubmissionStatus; findings: SSRFinding[] }> {
    if (portal !== 'EAD') {
      throw new Error(`EadRestProvider only handles EAD status checks (received: ${portal})`);
    }

    try {
      const token    = await this.getAccessToken();
      const response = await this.callEad<EadStatusResponse>(
        'GET',
        `/appraisals/${encodeURIComponent(portalDocumentId)}/status`,
        token,
      );

      return {
        status:   this.mapEadStatus(response.eadStatus),
        findings: this.mapFindings(response.findings),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('EadRestProvider.checkStatus failed', { portalDocumentId, error: message });
      throw new Error(`EAD checkStatus failed: ${message}`);
    }
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key':    this.apiKey,
      },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EAD auth failed [${response.status}]: ${text}`);
    }

    const data = await response.json() as EadTokenResponse;
    this.accessToken   = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async callEad<T>(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-Key':     this.apiKey,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EAD API ${path} [${response.status}]: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  private mapEadStatus(eadStatus: string): SubmissionStatus {
    switch (eadStatus.toUpperCase()) {
      case 'ACCEPTED':                 return 'ACCEPTED';
      case 'ACCEPTED_WITH_CONDITIONS': return 'ACCEPTED_WITH_WARNINGS';
      case 'REJECTED':                 return 'REJECTED';
      case 'SUBMITTED':                return 'SUBMITTED';
      case 'PENDING':                  return 'PENDING';
      case 'ERROR':                    return 'ERROR';
      default:                         return 'SUBMITTED';
    }
  }

  private mapFindings(raw?: EadSubmitResponse['findings']): SSRFinding[] {
    if (!raw) return [];
    return raw.map(f => ({
      code:        f.ruleId,
      severity:    this.mapSeverity(f.severity),
      category:    f.category,
      description: f.message,
      ...(f.fieldPath !== undefined ? { fieldPath: f.fieldPath } : {}),
    }));
  }

  private mapSeverity(raw: string): SSRFinding['severity'] {
    switch (raw) {
      case 'HARD_STOP':     return 'HARD_STOP';
      case 'WARNING':       return 'WARNING';
      case 'INFORMATIONAL': return 'MESSAGE';
      default:              return 'MESSAGE';
    }
  }
}
