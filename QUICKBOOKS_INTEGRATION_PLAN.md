# QuickBooks Accounting & Payments Integration Plan
**Project:** L1 Valuation Platform
**Status:** 🏃‍♂️ In Progress

## Phase 1: Authentication & OAuth2 Infrastructure
- [ ] **1.1 Environment Setup:** Add Intuit App `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, and environment tags (sandbox/production) to `.env`. *(Done)*
- [ ] **1.2 Database Schema:** Update the Tenant/Company or Admin user schema to store QuickBooks tokens: `qb_realm_id`, `qb_access_token`, `qb_refresh_token`, and `qb_token_expires_at`.
- [ ] **1.3 Auth Routes (Backend):** Create `GET /api/v1/quickbooks/auth/connect` to generate the OAuth2 URL redirect.
- [ ] **1.4 Callback Route (Backend):** Create `GET /api/v1/quickbooks/auth/callback` to handle the authorization code exchange, receive tokens, and save to DB.
- [ ] **1.5 Token Refresh Middleware:** Implement logic to automatically check and refresh the access token (expires every 60 mins) before making API calls.
- [ ] **1.6 UI Connection Component:** Add a "Connect to QuickBooks" button in the Admin Settings panel on the frontend wrapper.

## Phase 2: Fundamental Service Wrappers (Backend)
- [ ] **2.1 Base HTTP Interface:** Create `QuickBooksClient.ts` to natively handle requests to the QB API, automatically injecting the Bearer tokens.
- [ ] **2.2 Accounting Module:** Map CRUD methods for Accounts, Customers, Vendors, Invoices, and Bills.
- [ ] **2.3 Payments Module:** Map methods for Tokenizing Bank/CC details and processing Charges.
- [ ] **2.4 Webhook Listener (Optional but Recommended):** Create an endpoint to listen for QB events (e.g., invoice paid externally).

## Phase 3: Entity Synchronization
- [ ] **3.1 Customer Sync:** Hook into the L1 Order creation flow: Sync platform Lenders/Borrowers to QuickBooks `Customer` entities. Store `qb_customer_id` in our DB.
- [ ] **3.2 Vendor Sync:** Hook into L1 Appraiser approval: Sync Appraiser profiles to QuickBooks `Vendor` entities. Store `qb_vendor_id` in our DB.
- [ ] **3.3 Service/Item Setup:** Ensure an "Appraisal Fee" `Item` exists in QuickBooks to attach to invoices.

## Phase 4: Accounts Receivable & Client Payments (Inbound)
- [ ] **4.1 Invoice Generation:** When an Order is complete/billable, auto-generate a QuickBooks `Invoice` via API.
- [ ] **4.2 Credit Card UI:** Embed Intuit's Tokenization JavaScript into the Frontend `Order` view to securely capture client Credit Card numbers without them hitting our server directly.
- [ ] **4.3 Payment Processing:** Send the generated CC token to our backend, then call the QB Payments `Charges` API to run the card.
- [ ] **4.4 AR Reconciliation:** On successful charge, automatically tie the payment to the `Invoice` in QB Accounting so it shows as "Paid".

## Phase 5: Accounts Payable & Vendor Payouts (Outbound)
- [ ] **5.1 Appraiser Bills:** When an Order is finished, auto-create a `Bill` in QB for the Vendor (Appraiser).
- [ ] **5.2 Vendor Bank Detail UI:** Allow Appraisers to add their Bank Details (ACH) to their profile securely.
- [ ] **5.3 Payment Execution:** Create an admin Payout view. Select vendors to pay, hitting QB API to execute Vendor Bill Payments (ACH or externally recorded checks).

## Phase 6: Magnificent UI/UX Dashboard
- [ ] **6.1 Financial Control UI:** Build high-level reporting UI inside `l1-valuation-platform-ui` showing AR/AP balances pulled from the backend.
- [ ] **6.2 Status Badges:** Put live payment states directly on the Pipeline grids (e.g., 💳 *Paid*, ⏳ *Invoice Sent*, ⚠️ *Past Due*).
