import type {
  SeedModule,
  SeedModuleResult,
  SeedContext,
} from "../seed-types.js";
import { Logger } from "../../../utils/logger.js";
const logger = new Logger("QuickBooksSeed");

export const module: SeedModule = {
  name: "quickbooks",
  containers: ["clients", "vendors", "orders", "engagements"],
  run: async (ctx: SeedContext): Promise<SeedModuleResult> => {
    const { db, tenantId } = ctx;
    const accessToken = process.env.QUICKBOOKS_ACCESS_TOKEN;
    const realmId = process.env.QUICKBOOKS_REALM_ID;

    if (!accessToken || !realmId) {
      logger.warn(
        "Skipping QuickBooks seed: QUICKBOOKS_ACCESS_TOKEN and QUICKBOOKS_REALM_ID env vars required.",
      );
      return { created: 0, failed: 0, skipped: 0, cleaned: 0 };
    }

    let created = 0;
    let failed = 0;

    const authHeader = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const envPrefix =
      process.env.QUICKBOOKS_ENVIRONMENT === "production"
        ? "quickbooks"
        : "sandbox-quickbooks";
    const baseUrl = `https://${envPrefix}.api.intuit.com/v3/company/${realmId}`;

    logger.info(`Starting Intuit Seeding into Realm ${realmId}...`);

    // 1. Fetch our Clients (to become QB Customers)
    const clientsContainer = db.container("clients");
    const { resources: clients } = await clientsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.tenantId = @tenantId",
        parameters: [{ name: "@tenantId", value: tenantId }],
      })
      .fetchAll();

    for (const client of clients) {
      try {
        const qbCustomer = {
          DisplayName: client.clientName || client.lenderName || client.id,
          PrimaryEmailAddr: {
            Address: client.contactEmail || "test@example.com",
          },
          PrimaryPhone: {
            FreeFormNumber: client.contactPhone || "555-555-5555",
          },
        };
        const res = await fetch(`${baseUrl}/customer?minorversion=65`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify(qbCustomer),
        });
        if (res.ok) {
          created++;
          const responseData = await res.json();
          if (responseData.Customer?.Id) {
            client.quickbooksId = responseData.Customer.Id;
            await clientsContainer.items.upsert(client);
            logger.info(
              `Linked Client ${client.id} to QB Customer ${client.quickbooksId}`,
            );
          }
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    // 2. Fetch our Vendors (to become QB Vendors)
    const vendorsContainer = db.container("vendors");
    const { resources: vendors } = await vendorsContainer.items
      .query({
        query:
          'SELECT * FROM c WHERE c.tenantId = @tenantId AND c.type = "vendor"',
        parameters: [{ name: "@tenantId", value: tenantId }],
      })
      .fetchAll();

    for (const vendor of vendors) {
      try {
        const qbVendor = {
          DisplayName: vendor.businessName || vendor.id,
          PrimaryEmailAddr: { Address: vendor.email || "vendor@example.com" },
          PrimaryPhone: { FreeFormNumber: vendor.phone || "555-555-5555" },
        };
        const res = await fetch(`${baseUrl}/vendor?minorversion=65`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify(qbVendor),
        });
        if (res.ok) {
          created++;
          const responseData = await res.json();
          if (responseData.Vendor?.Id) {
            vendor.quickbooksId = responseData.Vendor.Id;
            await vendorsContainer.items.upsert(vendor);
            logger.info(
              `Linked Vendor ${vendor.id} to QB Vendor ${vendor.quickbooksId}`,
            );
          }
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    // 3. Fetch Customers from QB to map IDs for Invoices
    const qbCustomersRes = await fetch(
      `${baseUrl}/query?query=SELECT * FROM Customer MAXRESULTS 1000&minorversion=65`,
      { headers: authHeader },
    );
    const qbCustomersData = await qbCustomersRes.json();
    const qbCustomerMap = new Map<string, string>();
    if (qbCustomersData.QueryResponse?.Customer) {
      for (const c of qbCustomersData.QueryResponse.Customer) {
        qbCustomerMap.set(c.DisplayName, c.Id);
      }
    }
    const defaultCustomerId = Array.from(qbCustomerMap.values())[0] || "1";

    // 4. Fetch available Items (Products/Services) from QB to attach to Invoice
    const qbItemsRes = await fetch(
      `${baseUrl}/query?query=SELECT * FROM Item MAXRESULTS 10&minorversion=65`,
      { headers: authHeader },
    );
    const qbItemsData = await qbItemsRes.json();
    let defaultItemId = "1";
    if (
      qbItemsData.QueryResponse?.Item &&
      qbItemsData.QueryResponse.Item.length > 0
    ) {
      defaultItemId = qbItemsData.QueryResponse.Item[0].Id;
    }

    // 5. Fetch our Orders (to become QB Invoices)
    const ordersContainer = db.container("orders");
    const { resources: orders } = await ordersContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.tenantId = @tenantId OFFSET 0 LIMIT 15",
        parameters: [{ name: "@tenantId", value: tenantId }],
      })
      .fetchAll();

    logger.info(
      `Found ${orders.length} L1 Orders to push as Intuit Invoices...`,
    );

    for (const order of orders) {
      try {
        const clientName =
          order.clientInformation?.clientName || order.clientName;
        const customerId = qbCustomerMap.get(clientName) || defaultCustomerId;
        const amount = order.orderFee || order.feeDetails?.feeAmount || 500.0;

        const qbInvoice = {
          CustomerRef: { value: customerId },
          Line: [
            {
              Amount: amount,
              DetailType: "SalesItemLineDetail",
              SalesItemLineDetail: {
                ItemRef: { value: defaultItemId || "1" },
              },
              Description: `L1 Valuation Appraisal Order: ${order.fileNumber || order.id}`,
            },
          ],
        };

        const res = await fetch(`${baseUrl}/invoice?minorversion=65`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify(qbInvoice),
        });

        if (res.ok) {
          created++;
          logger.info(
            `[Intuit] Created Invoice for $${amount} -> ${order.fileNumber || order.id}`,
          );

          const invoiceData = await res.json();
          const qbInvoiceId = invoiceData.Invoice?.Id;

          if (qbInvoiceId) {
            // Link order back to QuickBooks
            order.quickbooksInvoiceId = qbInvoiceId;
            await ordersContainer.items.upsert(order);
            logger.info(
              `Linked Order ${order.id} to QB Invoice ${qbInvoiceId}`,
            );

            // Randomly pay 50% of the invoices to create full AR cycles
            if (Math.random() > 0.5) {
              const qbPayment = {
                CustomerRef: { value: customerId },
                TotalAmt: amount,
                Line: [
                  {
                    Amount: amount,
                    LinkedTxn: [{ TxnId: qbInvoiceId, TxnType: "Invoice" }],
                  },
                ],
              };
              const payRes = await fetch(`${baseUrl}/payment?minorversion=65`, {
                method: "POST",
                headers: authHeader,
                body: JSON.stringify(qbPayment),
              });
              if (payRes.ok) {
                logger.info(
                  `[Intuit] 💰 Marked Invoice ${qbInvoiceId} as Paid!`,
                );
              }
            }
          }
        } else {
          const err = await res.json();
          logger.warn(
            `Failed mapping order ${order.id}`,
            err.Fault?.Error || err,
          );
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    // 6. Fetch our Engagements (to become QB Bills)
    const engagementsContainer = db.container("engagements");
    const { resources: engagements } = await engagementsContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.tenantId = @tenantId OFFSET 0 LIMIT 15",
        parameters: [{ name: "@tenantId", value: tenantId }],
      })
      .fetchAll();

    const qbVendorsRes = await fetch(
      `${baseUrl}/query?query=SELECT * FROM Vendor MAXRESULTS 1000&minorversion=65`,
      { headers: authHeader },
    );
    const qbVendorsData = await qbVendorsRes.json();
    const qbVendorMap = new Map<string, string>();
    if (qbVendorsData.QueryResponse?.Vendor) {
      for (const v of qbVendorsData.QueryResponse.Vendor) {
        qbVendorMap.set(v.DisplayName, v.Id);
      }
    }
    const defaultVendorId = Array.from(qbVendorMap.values())[0] || "1";

    logger.info(
      `Found ${engagements.length} L1 Engagements to push as Intuit Bills...`,
    );

    for (const engagement of engagements) {
      try {
        const vendorName =
          engagement.appraiserName ||
          engagement.vendorName ||
          engagement.vendorId ||
          "Test Vendor";
        const vendorId = qbVendorMap.get(vendorName) || defaultVendorId;
        const fee = engagement.fee || engagement.appraisalFee || 300.0;

        const qbBill = {
          VendorRef: { value: vendorId },
          Line: [
            {
              Amount: fee,
              DetailType: "ItemBasedExpenseLineDetail",
              ItemBasedExpenseLineDetail: {
                ItemRef: { value: defaultItemId || "1" },
              },
              Description: `Appraisal Engagement Fee: ${engagement.orderId || engagement.id}`,
            },
          ],
        };

        const res = await fetch(`${baseUrl}/bill?minorversion=65`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify(qbBill),
        });

        if (res.ok) {
          created++;
          logger.info(
            `[Intuit] Created AP Bill for $${fee} -> Engagement ${engagement.id}`,
          );

          const billData = await res.json();
          const qbBillId = billData.Bill?.Id;

          if (qbBillId) {
            // Link Engagement back to QuickBooks
            engagement.quickbooksBillId = qbBillId;
            await engagementsContainer.items.upsert(engagement);
            logger.info(
              `Linked Engagement ${engagement.id} to QB Bill ${qbBillId}`,
            );

            // Randomly pay 50% of the bills to create full AP cycles
            if (Math.random() > 0.5) {
              // Need a vendor bank account or just use check to dodge needing a specific AP account
              const qbBillPayment = {
                VendorRef: { value: vendorId },
                TotalAmt: fee,
                PayType: "Check",
                Line: [
                  {
                    Amount: fee,
                    LinkedTxn: [{ TxnId: qbBillId, TxnType: "Bill" }],
                  },
                ],
              };
              const payRes = await fetch(
                `${baseUrl}/billpayment?minorversion=65`,
                {
                  method: "POST",
                  headers: authHeader,
                  body: JSON.stringify(qbBillPayment),
                },
              );
              if (payRes.ok) {
                logger.info(
                  `[Intuit] \uD83D\uDCB8 Paid AP Bill ${qbBillId} for Vendor ${vendorId}!`,
                );
              } else {
                const err = await payRes.json();
                logger.warn(
                  `Failed paying bill ${qbBillId}`,
                  err.Fault?.Error || err,
                );
              }
            }
          }
        } else {
          const err = await res.json();
          logger.warn(
            `Failed mapping engagement ${engagement.id}`,
            err.Fault?.Error || err,
          );
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    return { created, failed, skipped: 0, cleaned: 0 };
  },
};
