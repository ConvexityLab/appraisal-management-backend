import { QuickBooksOAuthService } from './quickbooks-oauth.service.js';
import { Logger } from '../utils/logger.js';
const logger = new Logger('QuickBooksService');

export class QuickBooksService {
  private getClient() {
    return QuickBooksOAuthService.getInstance().getClient();
  }

  private getRealmId() {
    const tokens = QuickBooksOAuthService.getInstance().getTokens();
    if (!tokens.realmId) throw new Error('QuickBooks Realm ID is not set. Please connect to QuickBooks first.');
    return tokens.realmId;
  }

  private getBaseUrl() {
    return this.getClient().environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company';
  }

  public async getCompanyInfo(): Promise<any> {
    try {
      const realmId = this.getRealmId();
      const url = `${this.getBaseUrl()}/${realmId}/companyinfo/${realmId}`;
      const response = await this.getClient().makeApiCall({ url, method: 'GET' });
      return response.getJson();
    } catch (e) {
      logger.error('Failed to get QuickBooks Company Info', e);
      throw e;
    }
  }

  public async query(queryStr: string): Promise<any> {
    try {
      const realmId = this.getRealmId();
      const url = `${this.getBaseUrl()}/${realmId}/query?query=${encodeURIComponent(queryStr)}&minorversion=65`;
      const response = await this.getClient().makeApiCall({ url, method: 'GET' });
      return response.getJson();
    } catch (e) {
      logger.error('Failed to execute QuickBooks Query', e);
      throw e;
    }
  }

  public async getSummary(): Promise<any> {
    const customers = await this.query('SELECT * FROM Customer MAXRESULTS 1000');
    const vendors = await this.query('SELECT * FROM Vendor MAXRESULTS 1000');
    const invoices = await this.query('SELECT * FROM Invoice MAXRESULTS 100');

    let uncollectedAR = 0;
    if (invoices.QueryResponse && invoices.QueryResponse.Invoice) {
      invoices.QueryResponse.Invoice.forEach((inv: any) => {
        uncollectedAR += inv.Balance || 0;
      });
    }

    return {
      totalCustomers: customers.QueryResponse?.Customer?.length || 0,
      totalVendors: vendors.QueryResponse?.Vendor?.length || 0,
      activeInvoices: invoices.QueryResponse?.Invoice?.length || 0,
      uncollectedAR: uncollectedAR
    };
  }

  public async syncCustomers(lenders: any[]): Promise<any> {
    // Placeholder for actual syncing logic
    return { success: true, syncedCount: lenders.length };
  }

  public async syncVendors(appraisers: any[]): Promise<any> {
    // Placeholder for actual syncing logic
    return { success: true, syncedCount: appraisers.length };
  }
}
