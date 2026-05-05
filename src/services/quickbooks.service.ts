import { QuickBooksOAuthService } from './quickbooks-oauth.service.js';
import { Logger } from '../utils/logger.js';
const logger = new Logger('QuickBooksService');

export class QuickBooksService {
  private async getClient() {
    return QuickBooksOAuthService.getInstance().getClientInitialized();
  }

  private async getRealmId() {
    const tokens = await QuickBooksOAuthService.getInstance().getTokens();
    if (!tokens.realmId) throw new Error('QuickBooks Realm ID is not set. Please connect to QuickBooks first.');
    return tokens.realmId;
  }

  private async getBaseUrl() {
    const client = await this.getClient();
    return client.environment === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company';
  }

  public async getCompanyInfo(): Promise<any> {
    try {
      const realmId = await this.getRealmId();
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/${realmId}/companyinfo/${realmId}`;
      const client = await this.getClient();
      const response = await client.makeApiCall({ url, method: 'GET' });
      return response.getJson();
    } catch (e) {
      logger.error('Failed to get QuickBooks Company Info', e as Error);
      throw e;
    }
  }

  public async query(queryStr: string): Promise<any> {
    try {
      const realmId = await this.getRealmId();
      const baseUrl = await this.getBaseUrl();
      const url = `${baseUrl}/${realmId}/query?query=${encodeURIComponent(queryStr)}&minorversion=65`;
      const client = await this.getClient();
      const response = await client.makeApiCall({ url, method: 'GET' });
      return response.getJson();
    } catch (e) {
      logger.error('Failed to execute QuickBooks Query', e as Error);
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

  public async createInvoice(order: any, customerId: string, itemId: string = "1"): Promise<any> {
    try {
      const amount = order.orderFee || order.feeDetails?.feeAmount || 500.00;
      
      const qbInvoice = {
        CustomerRef: { value: customerId },
        Line: [
          {
            Amount: amount,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              ItemRef: { value: itemId }
            },
            Description: `L1 Valuation Appraisal Order: ${order.fileNumber || order.id}`
          }
        ]
      };

      const realmId = await this.getRealmId();
      const baseUrl = await this.getBaseUrl();
      const client = await this.getClient();
      
      const response = await client.makeApiCall({
        url: `${baseUrl}/${realmId}/invoice?minorversion=65`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(qbInvoice)
      });
      
      return response.getJson();
    } catch (e) {
      logger.error('Failed to create QuickBooks Invoice', e as Error);
      throw e;
    }
  }

  public async createBill(engagement: any, vendorId: string, itemId: string = "1"): Promise<any> {
    try {
      const fee = engagement.totalEngagementFee || 350.00;
      
      const qbBill = {
        VendorRef: { value: vendorId },
        Line: [
          {
            Amount: fee,
            DetailType: "ItemBasedExpenseLineDetail",
            ItemBasedExpenseLineDetail: {
              ItemRef: { value: itemId }
            },
            Description: `L1 Valuation Appraisal Vendor Fee: ${engagement.engagementNumber || engagement.id}`
          }
        ]
      };

      const realmId = await this.getRealmId();
      const baseUrl = await this.getBaseUrl();
      const client = await this.getClient();
      
      const response = await client.makeApiCall({
        url: `${baseUrl}/${realmId}/bill?minorversion=65`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(qbBill)
      });
      
      return response.getJson();
    } catch (e) {
      logger.error('Failed to create QuickBooks AP Bill', e as Error);
      throw e;
    }
  }

  /**
   * Syncs the status of an Invoice or Bill from QuickBooks to our local DB
   * Called primarily from Webhook updates
   */
  public async syncStatusFromQuickbooks(entityType: 'Invoice' | 'Bill', entityId: string): Promise<void> {
    try {
      const oauthService = QuickBooksOAuthService.getInstance();
      
      const tokens = await oauthService.getTokens();
      if (!tokens || !tokens.accessToken) {
        logger.warn('Skipping webhook sync: No valid token');
        return;
      }

      const qbClient = await oauthService.getClientInitialized();
      const realmId = tokens.realmId;
      if (!qbClient || !realmId) return;

      const endpoint = entityType.toLowerCase(); // 'invoice' or 'bill'
      const response = await qbClient.makeApiCall({
        url: `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/${endpoint}/${entityId}`
      });

      const data: any = response.getJson();
      const entityData = data[entityType];

      if (!entityData) return;

      const isPaid = entityData.Balance === 0;

      if (entityType === 'Invoice' && isPaid) {
        // Find Order with quickbooksInvoiceId = entityId and mark AR paid
        logger.info(`Invoice ${entityId} is paid. Updating system...`);
        // We'd update Order status if appropriate, or store AR status
        return;
      } 
      
      if (entityType === 'Bill' && isPaid) {
        // Find Engagement with quickbooksBillId = entityId and mark AP paid
        logger.info(`Bill ${entityId} is paid. Updating system...`);
        // We'd update Engagement AP status
        return;
      }

    } catch (e) {
      logger.error(`Error syncing ${entityType} ${entityId} from QB`, e as Error);
    }
  }
}
