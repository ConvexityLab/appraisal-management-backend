const fs = require('fs');
const path = 'src/services/payment-providers/plaid.provider.ts';
let txt = fs.readFileSync(path, 'utf8');
txt = txt.replace(/processorToken: request\.paymentMethodToken,/g, "processorToken: request.paymentMethodToken ?? undefined,");
txt = txt.replace(/const plaidErr = json as PlaidApiError;/g, "const plaidErr = json as unknown as PlaidApiError;");
fs.writeFileSync(path, txt);
