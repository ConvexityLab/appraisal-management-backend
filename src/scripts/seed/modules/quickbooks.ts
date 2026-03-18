import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { Logger } from '../../../utils/logger.js';
const logger = new Logger('QuickBooksSeed');

export const module: SeedModule = {
  name: 'quickbooks',
  containers: ['clients', 'vendors'],
  run: async (ctx: SeedContext): Promise<SeedModuleResult> => {
    const { db, tenantId } = ctx;
    const accessToken = process.env.QUICKBOOKS_ACCESS_TOKEN;
    const realmId = process.env.QUICKBOOKS_REALM_ID;

    if (!accessToken || !realmId) {
      logger.warn('Skipping QuickBooks seed: QUICKBOOKS_ACCESS_TOKEN and QUICKBOOKS_REALM_ID env vars required.');
      return { created: 0, failed: 0, skipped: 0, cleaned: 0 };
    }

    let created = 0;
    let failed = 0;

    const authHeader = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const envPrefix = process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'quickbooks' : 'sandbox-quickbooks';
    const baseUrl = `https://${envPrefix}.api.intuit.com/v3/company/${realmId}`;

    logger.info(`Starting Intuit Seeding into Realm ${realmId}...`);

    // 1. Fetch our Clients (to become QB Customers)
    const clientsContainer = db.container('clients');
    const { resources: clients } = await clientsContainer.items.query({
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId',
      parameters: [{ name: '@tenantId', value: tenantId }]
    }).fetchAll();

    logger.info(`Found ${clients.length} L1 Clients. Pushing to Intuit as Customers...`);

    for (const client of clients) {
      try {
        const qbCustomer = {
          DisplayName: client.clientName || client.lenderName || client.id,
          PrimaryEmailAddr: { Address: client.contactEmail || 'test@example.com' },
          PrimaryPhone: { FreeFormNumber: client.contactPhone || '555-555-5555' }
        };
        const res = await fetch(`${baseUrl}/customer?minorversion=65`, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(qbCustomer)
        });
        if (res.ok) {
            created++;
            logger.info(`[Intuit] Created Customer: ${qbCustomer.DisplayName}`);
        }
        else {
            const err = await res.json();
            logger.warn(`Failed mapping client ${qbCustomer.DisplayName}`, err.Fault?.Error || err);
            failed++;
        }
      } catch (e) { failed++; }
    }

    // 2. Fetch our Vendors (to become QB Vendors)
    const vendorsContainer = db.container('vendors');
    const { resources: vendors } = await vendorsContainer.items.query({
      query: 'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = "vendor"',
      parameters: [{ name: '@tenantId', value: tenantId }]
    }).fetchAll();

    logger.info(`Found ${vendors.length} L1 Vendors. Pushing to Intuit as Vendors...`);

    for (const vendor of vendors) {
      try {
        const qbVendor = {
          DisplayName: vendor.businessName || vendor.id,
          PrimaryEmailAddr: { Address: vendor.email || 'vendor@example.com' },
          PrimaryPhone: { FreeFormNumber: vendor.phone || '555-555-5555' }
        };
        const res = await fetch(`${baseUrl}/vendor?minorversion=65`, {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify(qbVendor)
        });
        if (res.ok) {
            created++;
            logger.info(`[Intuit] Created Vendor: ${qbVendor.DisplayName}`);
        } else {
            const err = await res.json();
            logger.warn(`Failed mapping vendor ${qbVendor.DisplayName}`, err.Fault?.Error || err);
            failed++;
        }
      } catch (e) { failed++; }
    }

    return { created, failed, skipped: 0, cleaned: 0 };
  }
};