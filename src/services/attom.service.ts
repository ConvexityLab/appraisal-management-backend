/**
 * ATTOM Data Solutions API Service
 *
 * Thin HTTP wrapper for the ATTOM Property API.
 * Documentation: https://api.developer.attomdata.com/docs
 *
 * Authentication: APIKey header (not Bearer — ATTOM's own auth scheme).
 * Base URL: https://api.gateway.attomdata.com/propertyapi/v1.0.0
 *
 * Endpoints used by AttomPropertyDataProvider:
 *   GET /property/detailowner  — building characteristics + current owner
 *   GET /assessment/detail     — assessed value, tax year, tax amount
 *   GET /saleshistory/basichistory — deed transfer date + amount
 *
 * Address lookup parameters (all endpoints):
 *   address1 = street  (e.g. "123 Main St")
 *   address2 = "City State Zip"  (e.g. "Dallas TX 75232")
 *
 * By-ID lookup (after initial address resolution):
 *   attomId = <integer ATTOM unique property ID>
 */

import { Logger } from '../utils/logger.js';

const BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

export class AttomService {
  private readonly apiKey: string;
  private readonly logger: Logger;

  constructor() {
    const key = process.env.ATTOM_API_KEY;
    if (!key) {
      throw new Error(
        'AttomService: ATTOM_API_KEY environment variable is not set. ' +
        'Obtain an API key at https://api.attomdata.com and set ATTOM_API_KEY.',
      );
    }
    this.apiKey = key;
    this.logger = new Logger('AttomService');
  }

  /**
   * GET /property/detailowner
   *
   * Returns property building characteristics + current owner for an address.
   * This is the primary lookup call — use the returned attomId for subsequent calls.
   *
   * @param address1  Street number and name, e.g. "123 Main St"
   * @param address2  City, state, and zip as a single string, e.g. "Dallas TX 75232"
   */
  async getPropertyDetailOwner(address1: string, address2: string): Promise<unknown> {
    const params = new URLSearchParams({ address1, address2 });
    return this.request('/property/detailowner', params);
  }

  /**
   * GET /assessment/detail
   *
   * Returns assessed value, tax year, and annual tax amount for a property.
   * Requires the ATTOM attomId obtained from getPropertyDetailOwner.
   */
  async getAssessmentDetail(attomId: number): Promise<unknown> {
    const params = new URLSearchParams({ attomId: String(attomId) });
    return this.request('/assessment/detail', params);
  }

  /**
   * GET /saleshistory/basichistory
   *
   * Returns deed and mortgage history for a property (ATTOM provides 10 years).
   * Requires the ATTOM attomId obtained from getPropertyDetailOwner.
   */
  async getSaleHistoryBasic(attomId: number): Promise<unknown> {
    const params = new URLSearchParams({ attomId: String(attomId) });
    return this.request('/saleshistory/basichistory', params);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async request(path: string, params: URLSearchParams): Promise<unknown> {
    const url = `${BASE_URL}${path}?${params.toString()}`;
    this.logger.debug('AttomService: GET', { url });

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        APIKey: this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `ATTOM API error: HTTP ${response.status} ${response.statusText} — ${body}`,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;

    // ATTOM wraps every response in a status envelope.
    // code 0 = SuccessWithResult, code 1 = SuccessWithoutResult (empty result set).
    const status = json['status'] as Record<string, unknown> | undefined;
    const code = status?.['code'] as number | string | undefined;
    if (code !== 0 && code !== '0' && code !== 1 && code !== '1') {
      const msg = (status?.['msg'] as string | undefined) ?? JSON.stringify(status);
      throw new Error(`ATTOM API status error: code=${code} msg=${msg}`);
    }

    return json;
  }
}
