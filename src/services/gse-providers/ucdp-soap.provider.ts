/**
 * UCDP SOAP Submission Provider (Fannie Mae / Freddie Mac)
 *
 * Implementation of SubmissionProvider for the Uniform Collateral Data Portal.
 * UCDP accepts appraisal reports in MISMO 3.4 XML format over a SOAP/HTTPS endpoint.
 *
 * Key flows:
 *   submit()      — POST MISMO 3.4 XML to UCDP, poll until SSR is ready, return findings
 *   checkStatus() — poll UCDP for status + any new SSR findings on an existing submission
 *
 * Required env vars:
 *   UCDP_USERNAME       — UCDP portal user ID (lender entity user)
 *   UCDP_PASSWORD       — UCDP portal password
 *   UCDP_LENDER_ID      — Fannie/Freddie lender entity ID
 *   UCDP_ENV            — 'production' | 'sandbox'  (default: 'sandbox')
 *
 * UCDP SOAP API reference:
 *   https://singlefamily.fanniemae.com/applications-technology/uniform-collateral-data-portal
 *
 * NOTE: The UCDP API is SOAP/XML. We build lightweight XML strings directly rather
 * than pulling in a full SOAP library, keeping dependencies minimal. A real
 * integrations engineer should review the MISMO field mappings before go-live.
 */

import type {
  SubmissionProvider,
  SubmissionPortal,
  SubmissionStatus,
  SSRFinding,
} from '../ucdp-ead-submission.service.js';
import { Logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Internal shapes for UCDP SOAP responses
// ---------------------------------------------------------------------------

type FindingItem = {
  code: string;
  severity: string;
  category: string;
  message: string;
  fieldPath?: string;
};

interface UcdpSubmitResponse {
  /** UCDP-assigned Document File Identifier */
  docFileId: string;
  status: string;
  /** SSR finding XML nodes */
  findings: FindingItem[];
}

interface UcdpStatusResponse {
  status: string;
  findings: FindingItem[];
}

// ---------------------------------------------------------------------------

export class UcdpSoapProvider implements SubmissionProvider {
  private readonly username: string;
  private readonly password: string;
  private readonly lenderId: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(username: string, password: string, lenderId: string, env: string = 'sandbox') {
    this.username = username;
    this.password = password;
    this.lenderId = lenderId;
    this.logger = new Logger('UcdpSoapProvider');
    // Fannie Mae provides separate sandbox and production SOAP endpoints
    this.baseUrl = env === 'production'
      ? 'https://www.ucdp.fanniemae.com/WSIntegration/UCDPWebService'
      : 'https://www.ucdp-test.fanniemae.com/WSIntegration/UCDPWebService';
  }

  // =========================================================================
  // submit — upload MISMO 3.4 XML and retrieve SSR findings
  // =========================================================================
  async submit(
    portal: SubmissionPortal,
    xmlContent: string,
    lenderId: string,
  ): Promise<{ portalDocumentId: string; status: SubmissionStatus; findings: SSRFinding[] }> {
    if (portal !== 'UCDP') {
      throw new Error(`UcdpSoapProvider only handles UCDP submissions (received: ${portal})`);
    }

    const effectiveLenderId = lenderId || this.lenderId;
    const soapEnvelope = this.buildSubmitEnvelope(xmlContent, effectiveLenderId);

    try {
      const rawResponse = await this.postSoap('SubmitDocument', soapEnvelope);
      const parsed = this.parseSubmitResponse(rawResponse);

      return {
        portalDocumentId: parsed.docFileId,
        status: this.mapUcdpStatus(parsed.status),
        findings: this.mapFindings(parsed.findings),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('UcdpSoapProvider.submit failed', { error: message });
      throw new Error(`UCDP submit failed: ${message}`);
    }
  }

  // =========================================================================
  // checkStatus — poll an existing UCDP submission for status updates
  // =========================================================================
  async checkStatus(
    portal: SubmissionPortal,
    portalDocumentId: string,
  ): Promise<{ status: SubmissionStatus; findings: SSRFinding[] }> {
    if (portal !== 'UCDP') {
      throw new Error(`UcdpSoapProvider only handles UCDP status checks (received: ${portal})`);
    }

    const soapEnvelope = this.buildStatusEnvelope(portalDocumentId);

    try {
      const rawResponse = await this.postSoap('GetDocumentStatus', soapEnvelope);
      const parsed = this.parseStatusResponse(rawResponse);

      return {
        status: this.mapUcdpStatus(parsed.status),
        findings: this.mapFindings(parsed.findings),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('UcdpSoapProvider.checkStatus failed', { portalDocumentId, error: message });
      throw new Error(`UCDP checkStatus failed: ${message}`);
    }
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  private buildSubmitEnvelope(xmlContent: string, lenderId: string): string {
    // UCDP expects the MISMO 3.4 XML wrapped in a SOAP envelope.
    // The MISMO content is base64-encoded inside the <DocumentContent> element.
    const encodedContent = Buffer.from(xmlContent).toString('base64');
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ucdp="https://www.ucdp.fanniemae.com/WSIntegration">
  <soapenv:Header>
    <ucdp:Authentication>
      <ucdp:Username>${this.escapeXml(this.username)}</ucdp:Username>
      <ucdp:Password>${this.escapeXml(this.password)}</ucdp:Password>
    </ucdp:Authentication>
  </soapenv:Header>
  <soapenv:Body>
    <ucdp:SubmitDocumentRequest>
      <ucdp:LenderEntityIdentifier>${this.escapeXml(lenderId)}</ucdp:LenderEntityIdentifier>
      <ucdp:DocumentContent>${encodedContent}</ucdp:DocumentContent>
      <ucdp:DocumentFormat>MISMO_3_4</ucdp:DocumentFormat>
    </ucdp:SubmitDocumentRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private buildStatusEnvelope(docFileId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ucdp="https://www.ucdp.fanniemae.com/WSIntegration">
  <soapenv:Header>
    <ucdp:Authentication>
      <ucdp:Username>${this.escapeXml(this.username)}</ucdp:Username>
      <ucdp:Password>${this.escapeXml(this.password)}</ucdp:Password>
    </ucdp:Authentication>
  </soapenv:Header>
  <soapenv:Body>
    <ucdp:GetDocumentStatusRequest>
      <ucdp:DocumentFileIdentifier>${this.escapeXml(docFileId)}</ucdp:DocumentFileIdentifier>
    </ucdp:GetDocumentStatusRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private async postSoap(action: string, envelope: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"https://www.ucdp.fanniemae.com/WSIntegration/${action}"`,
      },
      body: envelope,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`UCDP SOAP HTTP ${response.status}: ${text.substring(0, 500)}`);
    }

    // Check for SOAP fault
    if (text.includes('<faultstring>')) {
      const fault = text.match(/<faultstring>(.*?)<\/faultstring>/s)?.[1] ?? 'Unknown SOAP fault';
      throw new Error(`UCDP SOAP fault: ${fault}`);
    }

    return text;
  }

  /** Minimal XML extraction — production code should use a proper XML parser. */
  private extractTag(xml: string, tag: string): string {
    return xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>(.*?)</(?:[^:>]+:)?${tag}>`, 's'))?.[1]?.trim() ?? '';
  }

  private parseSubmitResponse(xml: string): UcdpSubmitResponse {
    const docFileId = this.extractTag(xml, 'DocumentFileIdentifier');
    const status    = this.extractTag(xml, 'DocumentStatusType');
    const findings  = this.extractFindings(xml);
    return { docFileId, status, findings };
  }

  private parseStatusResponse(xml: string): UcdpStatusResponse {
    const status   = this.extractTag(xml, 'DocumentStatusType');
    const findings = this.extractFindings(xml);
    return { status, findings };
  }

  private extractFindings(xml: string): FindingItem[] {
    const findings: FindingItem[] = [];
    const findingPattern = /<(?:[^:>]+:)?Finding[^>]*>(.*?)<\/(?:[^:>]+:)?Finding>/gs;
    let match: RegExpExecArray | null;
    while ((match = findingPattern.exec(xml)) !== null) {
      const inner = match[1] ?? '';
      const fieldPathRaw = this.extractTag(inner, 'FieldName');
      findings.push({
        code:      this.extractTag(inner, 'RuleIdentifier'),
        severity:  this.extractTag(inner, 'RuleMessageType'),
        category:  this.extractTag(inner, 'RuleCategoryType'),
        message:   this.extractTag(inner, 'RuleDescriptionText'),
        ...(fieldPathRaw ? { fieldPath: fieldPathRaw } : {}),
      });
    }
    return findings;
  }

  private mapUcdpStatus(ucdpStatus: string): SubmissionStatus {
    switch (ucdpStatus.toUpperCase()) {
      case 'ACCEPTED':                return 'ACCEPTED';
      case 'ACCEPTED_WITH_WARNINGS': return 'ACCEPTED_WITH_WARNINGS';
      case 'REJECTED':                return 'REJECTED';
      case 'SUBMITTED':               return 'SUBMITTED';
      case 'PENDING':                 return 'PENDING';
      case 'ERROR':                   return 'ERROR';
      default:                        return 'SUBMITTED';
    }
  }

  private mapFindings(
    raw?: UcdpSubmitResponse['findings'],
  ): SSRFinding[] {
    if (!raw) return [];
    return raw.map(f => ({
      code:        f.code,
      severity:    this.mapSeverity(f.severity),
      category:    f.category,
      description: f.message,
      ...(f.fieldPath !== undefined ? { fieldPath: f.fieldPath } : {}),
    }));
  }

  private mapSeverity(raw: string): SSRFinding['severity'] {
    const upper = raw.toUpperCase();
    if (upper.includes('HARD') || upper.includes('STOP')) return 'HARD_STOP';
    if (upper.includes('WARN'))                            return 'WARNING';
    return 'MESSAGE';
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&apos;');
  }
}
