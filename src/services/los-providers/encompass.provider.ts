/**
 * Encompass LOS Provider (ICE Mortgage Technology / Ellie Mae)
 *
 * Adapts the Encompass SmartClient API v3 to the generic LosProvider interface.
 * Encompass is the most widely used LOS in the US mortgage industry.
 *
 * Required env vars:
 *   ENCOMPASS_CLIENT_ID      — OAuth 2.0 client ID (from Ellie Mae developer portal)
 *   ENCOMPASS_CLIENT_SECRET  — OAuth 2.0 client secret
 *   ENCOMPASS_INSTANCE_ID    — Your lender's Encompass instance ID (e.g. BE11223344)
 *   ENCOMPASS_ENV            — 'production' | 'sandbox'  (default: 'sandbox')
 *
 * Encompass API docs: https://developer.uat.elliemae.com/
 * SMART FIELDS reference: https://encompasshelp.elliemae.com/
 *
 * NOTE: No orders are created in Encompass from this platform.
 * We READ loan data (import) and UPDATE appraisal status (push).
 * Encompass is the system of record for the loan; we are the system of record
 * for the appraisal.
 */

import {
  LosProvider,
  LosLoan,
  LosImportRequest,
  LosImportResult,
  LosPushRequest,
  LosPushResult,
} from './los-provider.interface.js';
import { Logger } from '../../utils/logger.js';

/** Minimal Encompass Loan object shape (subset of hundreds of fields). */
interface EncompassLoan {
  id: string;
  loanNumber?: string;
  /** Encompass SMART field IDs map to our domain fields. */
  fields?: Record<string, string | number | boolean | null>;
  borrower?: {
    firstName?: string;
    lastName?: string;
    emailAddressText?: string;
  };
  coBorrower?: {
    firstName?: string;
    lastName?: string;
  };
  property?: {
    addressStreetLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  loanAmountTotal?: number;
  loanPurpose?: string;
  milestone?: { milestoneName?: string };
}

/** Encompass OAuth token response. */
interface EncompassTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class EncompassLosProvider implements LosProvider {
  readonly name = 'ICE Encompass';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly instanceId: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  // Cached access token
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    clientId: string,
    clientSecret: string,
    instanceId: string,
    env: string = 'sandbox',
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.instanceId = instanceId;
    this.logger = new Logger('EncompassLosProvider');
    this.baseUrl = env === 'production'
      ? 'https://api.elliemae.com/encompass/v3'
      : 'https://api.uat.elliemae.com/encompass/v3';
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret && this.instanceId);
  }

  // ===========================================================================
  // importOrder — read loan from Encompass, create order in our system
  // ===========================================================================
  async importOrder(request: LosImportRequest): Promise<LosImportResult> {
    const loan = await this.getLoan(request.loanNumber, request.tenantId);
    if (!loan) {
      throw new Error(
        `[EncompassLosProvider] Loan ${request.loanNumber} not found in Encompass instance ${this.instanceId}`,
      );
    }

    // Generate our internal order ID (the calling LosController will persist it)
    const orderId = `los-${request.tenantId}-${request.loanNumber}-${Date.now()}`;

    return {
      orderId,
      loan,
      created: true, // LosController handles dedup
    };
  }

  // ===========================================================================
  // pushOrder — update Encompass appraisal status fields
  // ===========================================================================
  async pushOrder(request: LosPushRequest): Promise<LosPushResult> {
    try {
      const token = await this.getAccessToken();

      // Map our status code to Encompass SMART field 1715 (Appraisal Status)
      const fieldUpdates: Record<string, string | number> = {
        '1715': request.statusCode,
      };

      if (request.appraisedValueCents !== undefined) {
        // SMART field 356 = Appraised Value (dollars)
        fieldUpdates['356'] = Math.round(request.appraisedValueCents / 100);
      }

      if (request.appraisalEffectiveDate !== undefined) {
        // SMART field 1714 = Appraisal Effective Date
        fieldUpdates['1714'] = request.appraisalEffectiveDate;
      }

      // Find Encompass loan GUID by loan number first
      const loanGuid = await this.findLoanGuid(request.loanNumber, token);

      await this.callEncompass(
        'PATCH',
        `/loans/${loanGuid}?view=entity`,
        token,
        {
          fields: Object.entries(fieldUpdates).map(([id, value]) => ({ fieldId: id, value })),
          ...(request.note !== undefined && {
            applicationLogs: [{ createdBy: 'AppraisalPlatform', logRecordIndex: 0, comments: request.note }],
          }),
        },
      );

      return {
        success: true,
        losConfirmationId: loanGuid,
        message: `Encompass loan ${request.loanNumber} updated (status=${request.statusCode})`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('EncompassLosProvider.pushOrder failed', { error: message, request });
      return { success: false, message };
    }
  }

  // ===========================================================================
  // getLoan — fetch loan details by loan number
  // ===========================================================================
  async getLoan(loanNumber: string, _tenantId: string): Promise<LosLoan | null> {
    try {
      const token = await this.getAccessToken();
      const loanGuid = await this.findLoanGuid(loanNumber, token);

      const raw = await this.callEncompass<EncompassLoan>(
        'GET',
        `/loans/${loanGuid}?entities=borrower,coborrower,property,milestone`,
        token,
      );

      return this.mapEncompassLoan(raw, loanNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A 404 means the loan doesn't exist in this instance — return null
      if (message.includes('404')) return null;
      this.logger.error('EncompassLosProvider.getLoan failed', { loanNumber, error: message });
      throw err;
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private async findLoanGuid(loanNumber: string, token: string): Promise<string> {
    const results = await this.callEncompass<Array<{ loanGuid: string }>>(
      'POST',
      '/loanPipeline',
      token,
      {
        filter: {
          operator: 'and',
          terms: [{ canonicalName: 'Loan.LoanNumber', value: loanNumber, matchType: 'exact' }],
        },
        fields: ['Loan.LoanNumber'],
        limit: 1,
      },
    );

    if (!results.length) {
      throw new Error(`404: Loan ${loanNumber} not found in Encompass`);
    }

    return results[0]!.loanGuid;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await fetch('https://api.elliemae.com/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: `lp ${this.instanceId}`,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Encompass auth failed [${response.status}]: ${text}`);
    }

    const data = await response.json() as EncompassTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async callEncompass<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    token: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'elli-instance-id': this.instanceId,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Encompass API ${path} [${response.status}]: ${text}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  private mapEncompassLoan(raw: EncompassLoan, loanNumber: string): LosLoan {
    const borrowerFirst  = raw.borrower?.firstName ?? '';
    const borrowerLast   = raw.borrower?.lastName ?? '';
    const coBorrowerFirst = raw.coBorrower?.firstName;
    const coBorrowerLast  = raw.coBorrower?.lastName;

    return {
      loanNumber,
      borrowerName: `${borrowerFirst} ${borrowerLast}`.trim(),
      ...(coBorrowerFirst !== undefined && coBorrowerLast !== undefined
        ? { coBorrowerName: `${coBorrowerFirst} ${coBorrowerLast}`.trim() }
        : {}),
      loanAmountCents: Math.round((raw.loanAmountTotal ?? 0) * 100),
      loanPurpose: raw.loanPurpose ?? 'Unknown',
      propertyAddress: raw.property?.addressStreetLine1 ?? '',
      propertyCity: raw.property?.city ?? '',
      propertyState: raw.property?.state ?? '',
      propertyZip: raw.property?.postalCode ?? '',
      losStatus: raw.milestone?.milestoneName ?? 'Unknown',
      ...(raw.borrower?.emailAddressText !== undefined ? { loanOfficerEmail: raw.borrower.emailAddressText } : {}),
      rawData: raw,
    };
  }
}
