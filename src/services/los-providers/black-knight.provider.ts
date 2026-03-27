/**
 * Black Knight Empower LOS Provider
 *
 * Adapts the Black Knight Empower LOS REST API to the generic LosProvider interface.
 * Empower is widely used by mortgage banks and credit unions.
 *
 * Required env vars:
 *   BLACKKNIGHT_API_KEY       — API key from Black Knight developer portal
 *   BLACKKNIGHT_BASE_URL      — Base URL for your Black Knight instance
 *                               (e.g. https://your-org.empower.bkfs.com/api/v1)
 *   BLACKKNIGHT_ENV           — 'production' | 'sandbox'  (default: 'sandbox')
 *
 * Black Knight Empower API reference: https://developer.bkfs.com/
 *
 * NOTE: Like Encompass, we READ loan data and UPDATE appraisal-specific fields.
 * We never create loans in the LOS.
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

/** Minimal Black Knight Empower loan object. */
interface BlackKnightLoan {
  loanId: string;
  loanNumber: string;
  borrowerInfo?: {
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
    phoneNumber?: string;
  };
  coBorrowerInfo?: {
    firstName?: string;
    lastName?: string;
  };
  propertyInfo?: {
    streetAddress?: string;
    city?: string;
    stateCode?: string;
    postalCode?: string;
  };
  loanInfo?: {
    originalLoanAmount?: number;   // dollars
    loanPurpose?: string;
    currentStatus?: string;
  };
  lenderInfo?: {
    lenderName?: string;
    loanOfficerName?: string;
    loanOfficerEmail?: string;
    loanOfficerPhone?: string;
  };
}

/** Black Knight search/pipeline response. */
interface BlackKnightSearchResponse {
  loans: BlackKnightLoan[];
  totalCount: number;
}

export class BlackKnightLosProvider implements LosProvider {
  readonly name = 'Black Knight Empower';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.logger = new Logger('BlackKnightLosProvider');
  }

  isAvailable(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }

  // ===========================================================================
  // importOrder
  // ===========================================================================
  async importOrder(request: LosImportRequest): Promise<LosImportResult> {
    const loan = await this.getLoan(request.loanNumber, request.tenantId);
    if (!loan) {
      throw new Error(
        `[BlackKnightLosProvider] Loan ${request.loanNumber} not found in Black Knight Empower`,
      );
    }

    const orderId = `los-bk-${request.tenantId}-${request.loanNumber}-${Date.now()}`;
    return { orderId, loan, created: true };
  }

  // ===========================================================================
  // pushOrder — update appraisal-related fields in Empower
  // ===========================================================================
  async pushOrder(request: LosPushRequest): Promise<LosPushResult> {
    try {
      // Black Knight uses a loan search to get the internal loanId first
      const loanId = await this.findLoanId(request.loanNumber);

      const updatePayload: Record<string, unknown> = {
        appraisalStatus: request.statusCode,
        ...(request.appraisedValueCents !== undefined && {
          appraisedValue: Math.round(request.appraisedValueCents / 100),
        }),
        ...(request.appraisalEffectiveDate !== undefined && {
          appraisalEffectiveDate: request.appraisalEffectiveDate,
        }),
        ...(request.note !== undefined && {
          appraisalNotes: request.note,
        }),
      };

      await this.callBlackKnight('PATCH', `/loans/${loanId}/appraisal`, updatePayload);

      return {
        success: true,
        losConfirmationId: loanId,
        message: `Black Knight Empower loan ${request.loanNumber} updated (status=${request.statusCode})`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('BlackKnightLosProvider.pushOrder failed', { error: message, request });
      return { success: false, message };
    }
  }

  // ===========================================================================
  // getLoan
  // ===========================================================================
  async getLoan(loanNumber: string, _tenantId: string): Promise<LosLoan | null> {
    try {
      const loanId = await this.findLoanId(loanNumber);

      const raw = await this.callBlackKnight<BlackKnightLoan>(
        'GET',
        `/loans/${loanId}?include=borrowerInfo,coBorrowerInfo,propertyInfo,loanInfo,lenderInfo`,
      );

      return this.mapBlackKnightLoan(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('404') || message.includes('not found')) return null;
      this.logger.error('BlackKnightLosProvider.getLoan failed', { loanNumber, error: message });
      throw err;
    }
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  private async findLoanId(loanNumber: string): Promise<string> {
    const result = await this.callBlackKnight<BlackKnightSearchResponse>(
      'GET',
      `/loans?loanNumber=${encodeURIComponent(loanNumber)}&limit=1`,
    );

    if (!result.loans.length) {
      throw new Error(`404: Loan ${loanNumber} not found in Black Knight Empower`);
    }

    return result.loans[0]!.loanId;
  }

  private async callBlackKnight<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Black Knight Empower ${path} [${response.status}]: ${text}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  private mapBlackKnightLoan(raw: BlackKnightLoan): LosLoan {
    const borrowerFirst = raw.borrowerInfo?.firstName ?? '';
    const borrowerLast  = raw.borrowerInfo?.lastName ?? '';
    const coFirst = raw.coBorrowerInfo?.firstName;
    const coLast  = raw.coBorrowerInfo?.lastName;

    return {
      loanNumber: raw.loanNumber,
      borrowerName: `${borrowerFirst} ${borrowerLast}`.trim(),
      ...(coFirst !== undefined && coLast !== undefined
        ? { coBorrowerName: `${coFirst} ${coLast}`.trim() }
        : {}),
      loanAmountCents: Math.round((raw.loanInfo?.originalLoanAmount ?? 0) * 100),
      loanPurpose: raw.loanInfo?.loanPurpose ?? 'Unknown',
      propertyAddress: raw.propertyInfo?.streetAddress ?? '',
      propertyCity: raw.propertyInfo?.city ?? '',
      propertyState: raw.propertyInfo?.stateCode ?? '',
      propertyZip: raw.propertyInfo?.postalCode ?? '',
      losStatus: raw.loanInfo?.currentStatus ?? 'Unknown',
      ...(raw.lenderInfo?.lenderName !== undefined ? { lenderName: raw.lenderInfo.lenderName } : {}),
      ...(raw.lenderInfo?.loanOfficerName !== undefined ? { loanOfficerName: raw.lenderInfo.loanOfficerName } : {}),
      ...(raw.lenderInfo?.loanOfficerEmail !== undefined ? { loanOfficerEmail: raw.lenderInfo.loanOfficerEmail } : {}),
      ...(raw.lenderInfo?.loanOfficerPhone !== undefined ? { loanOfficerPhone: raw.lenderInfo.loanOfficerPhone } : {}),
      rawData: raw,
    };
  }
}
