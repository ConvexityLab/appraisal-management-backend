#!/usr/bin/env node
// Quick smoke test: submit a 3-item bulk ingestion job and print the response.
import { createHmac } from 'crypto';

// Minimal HS256 JWT signing — no external deps needed
function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const TEST_JWT_SECRET = process.env.TEST_JWT_SECRET || 'a8e71c1f6be4b9a4f568926975f596b40e60657dfce55d3f4e819fc258fdcfb32f6558ffbe8280507c372d44659d03f7';
const AXIOM_CLIENT_ID = process.env.AXIOM_CLIENT_ID || 'vision';
const AXIOM_SUB_CLIENT_ID = process.env.AXIOM_SUB_CLIENT_ID || 'platform';

const testToken = signJwt({
  sub: 'smoke-test-user',
  email: 'smoke@test.local',
  name: 'Smoke Test',
  role: 'admin',
  tenantId: 'test-tenant',
  clientId: AXIOM_CLIENT_ID,
  subClientId: AXIOM_SUB_CLIENT_ID,
  isTestToken: true,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
}, TEST_JWT_SECRET);

const payload = {
  clientId: 'vision',
  adapterKey: 'smoke-test',
  analysisType: 'AVM',
  ingestionMode: 'SHARED_STORAGE',
  sharedStorage: {
    storageAccountName: 'dummy',
    containerName: 'dummy',
    dataFileBlobName: 'dummy-data.csv',
    documentBlobNames: [],
  },
  items: [
    // Should PASS all criteria: loanNumber present, loanAmount in range, propertyType recognised
    {
      loanNumber: 'LN-001',
      loanAmount: 250_000,
      propertyType: 'SFR',
      borrowerName: 'John Smith',
      propertyAddress: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    },
    // Should FAIL — no loanNumber (first rule: loanNumber exists)
    {
      loanAmount: 150_000,
      propertyType: 'CONDO',
      propertyAddress: '456 Oak Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
    },
    // Should flag REVIEW — loanAmount > $5M (third rule: loanAmount lte 5000000 → REVIEW)
    {
      loanNumber: 'LN-003',
      loanAmount: 6_000_000,
      propertyType: 'SFR',
      propertyAddress: '789 Rich Blvd',
      city: 'Austin',
      state: 'TX',
      zipCode: '78703',
    },
  ],
};

const resp = await fetch('http://localhost:3011/api/bulk-ingestion/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': 'test-tenant',
    'Authorization': `Bearer ${testToken}`,
  },
  body: JSON.stringify(payload),
});

const text = await resp.text();
console.log(`\n=== SUBMIT RESPONSE HTTP ${resp.status} ===`);
let jobId;
try {
  const parsed = JSON.parse(text);
  console.log(JSON.stringify(parsed, null, 2));
  jobId = parsed.jobId ?? parsed.job?.id;
} catch {
  console.log(text.slice(0, 500));
}

if (!jobId) {
  console.error('\nNo jobId returned — stopping.');
  process.exit(1);
}

// Poll for criteria decisions (max 15s)
console.log(`\n=== POLLING JOB ${jobId} FOR CRITERIA DECISIONS ===`);
const headers = { 'x-tenant-id': 'test-tenant', 'Authorization': `Bearer ${testToken}` };
let items;
for (let i = 0; i < 6; i++) {
  await new Promise(r => setTimeout(r, 2500));
  const r = await fetch(`http://localhost:3011/api/bulk-ingestion/${jobId}`, { headers });
  if (!r.ok) {
    console.log(`job fetch HTTP ${r.status}: ${await r.text()}`);
    continue;
  }
  const job = await r.json();
  items = job.items ?? [];
  const decided = items.filter(item => item.criteriaDecision);
  console.log(`attempt ${i+1}: ${decided.length}/${items.length} items have criteriaDecision (job status: ${job.status})`);
  if (decided.length === items.length && items.length > 0) break;
}

if (items) {
  console.log('\n=== CRITERIA DECISIONS ===');
  for (const item of items) {
    console.log(`  loanNumber=${item.source?.loanNumber ?? '(none)'} → criteriaDecision=${item.criteriaDecision ?? 'PENDING'} status=${item.status ?? 'UNKNOWN'}`);
  }
}

