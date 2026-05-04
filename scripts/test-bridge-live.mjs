/**
 * Bridge Interactive live connectivity diagnostic
 *
 * Tests each endpoint the BridgePropertyDataProvider uses:
 *   1. MLS OData /test dataset — no auth required, Bridge public test data
 *   2. Public records /parcels — requires real BRIDGE_SERVER_TOKEN
 *   3. /parcels/:id/assessments  (only if parcel found)
 *   4. /parcels/:id/transactions (only if parcel found)
 *
 * Usage:
 *   node scripts/test-bridge-live.mjs [address]
 *
 * Examples:
 *   node scripts/test-bridge-live.mjs
 *   node scripts/test-bridge-live.mjs "1234 Main St, Anytown, TX 12345"
 *
 * Set BRIDGE_SERVER_TOKEN in .env (or as env var) to enable public records calls.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');
try {
  const envContents = readFileSync(envPath, 'utf8');
  for (const line of envContents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env optional */ }

// ── Config ────────────────────────────────────────────────────────────────────
const MLS_BASE    = 'https://api.bridgedataoutput.com/api/v2/OData';
const PUB_BASE    = 'https://api.bridgedataoutput.com/api/v2/pub';
const TEST_DATASET = 'test';
const TOKEN        = process.env.BRIDGE_SERVER_TOKEN || '';
const HAS_REAL_TOKEN = TOKEN && TOKEN !== 'your-bridge-server-token-here';

const ADDRESS = process.argv[2] || '1234 Main St, Anytown, TX 12345';

function headers() {
  const h = { Accept: 'application/json' };
  if (HAS_REAL_TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  return h;
}

async function get(label, url, requiresToken = false) {
  if (requiresToken && !HAS_REAL_TOKEN) {
    console.log(`\n⚠️  [${label}] SKIPPED — needs real BRIDGE_SERVER_TOKEN`);
    console.log(`   URL: ${url}`);
    return null;
  }
  console.log(`\n🔍 [${label}]`);
  console.log(`   URL: ${url}`);
  try {
    const res = await fetch(url, { headers: headers() });
    const body = await res.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    if (!res.ok) {
      console.log(`   ❌ HTTP ${res.status} ${res.statusText}`);
      console.log(`   Body: ${typeof parsed === 'string' ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)}`);
      return null;
    }

    // Summarise result
    if (parsed?.value && Array.isArray(parsed.value)) {
      console.log(`   ✅ HTTP ${res.status} — ${parsed.value.length} records in value[]`);
      if (parsed.value.length > 0) {
        const rec = parsed.value[0];
        const keys = Object.keys(rec);
        console.log(`   First record keys (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? '...' : ''}`);
        // Print a few interesting fields
        const interesting = ['ListingKey','UnparsedAddress','LivingArea','BedroomsTotal',
          'BathroomsTotalDecimal','YearBuilt','PropertyType','LotSizeArea','StoriesTotal'];
        const found = interesting.filter(k => rec[k] != null).map(k => `${k}=${rec[k]}`);
        if (found.length) console.log(`   Key fields: ${found.join(' | ')}`);
      }
      return parsed.value;
    } else if (parsed?.results && Array.isArray(parsed.results)) {
      console.log(`   ✅ HTTP ${res.status} — ${parsed.results.length} records in results[]`);
      if (parsed.results.length > 0) {
        const rec = parsed.results[0];
        const keys = Object.keys(rec);
        console.log(`   First record keys (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? '...' : ''}`);
      }
      return parsed.results;    } else if (parsed?.bundle && Array.isArray(parsed.bundle)) {
      // Bridge public records API wraps results in "bundle"
      console.log(`   ✅ HTTP ${res.status} — ${parsed.bundle.length} records in bundle[] (total: ${parsed.total ?? '?'})`);
      if (parsed.bundle.length > 0) {
        const rec = parsed.bundle[0];
        const keys = Object.keys(rec);
        console.log(`   First record keys (${keys.length}): ${keys.slice(0, 12).join(', ')}`);
        const interesting = ['id','parcelId','situs_address','owner_name','land_value','improvement_value','total_value','tax_year'];
        const found = interesting.filter(k => rec[k] != null).map(k => `${k}=${JSON.stringify(rec[k])}`);
        if (found.length) console.log(`   Key fields: ${found.join(' | ')}`);
      }
      return parsed.bundle;    } else if (Array.isArray(parsed)) {
      console.log(`   ✅ HTTP ${res.status} — ${parsed.length} records (bare array)`);
      return parsed;
    } else {
      console.log(`   ✅ HTTP ${res.status} — single object`);
      const keys = typeof parsed === 'object' ? Object.keys(parsed) : [];
      if (keys.length) console.log(`   Keys: ${keys.slice(0, 12).join(', ')}`);
      return parsed;
    }
  } catch (err) {
    console.log(`   ❌ Network error: ${err.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Bridge Interactive — Live Connectivity Diagnostic');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Token configured: ${HAS_REAL_TOKEN ? '✅ YES (real token)' : '❌ NO (placeholder only)'}`);
console.log(`  Test address:     "${ADDRESS}"`);
console.log('───────────────────────────────────────────────────────────────');

// 1. MLS OData — test dataset, no auth
const mlsFilter = `tolower(UnparsedAddress) eq '${ADDRESS.toLowerCase()}'`;
const mlsUrl = `${MLS_BASE}/${TEST_DATASET}/Property?$filter=${encodeURIComponent(mlsFilter)}&$top=1`;
const mlsResults = await get('MLS OData /test (no auth required)', mlsUrl, false);

// 2. Broader MLS search with just a city filter to confirm test dataset works
const mlsBroadFilter = `contains(tolower(UnparsedAddress),'main')`;
const mlsBroadUrl = `${MLS_BASE}/${TEST_DATASET}/Property?$filter=${encodeURIComponent(mlsBroadFilter)}&$top=3`;
const mlsBroadResults = await get('MLS OData /test — broad "main" address search', mlsBroadUrl, false);

// 3. Public records parcel search — requires real token
const parcelUrl = `${PUB_BASE}/parcels?address.full=${encodeURIComponent(ADDRESS)}&limit=1`;
const parcelResults = await get('Public Records /parcels (requires real token)', parcelUrl, true);

// 4. If we got a parcel, drill down
if (parcelResults) {
  const list = Array.isArray(parcelResults?.results) ? parcelResults.results
    : Array.isArray(parcelResults?.bundle) ? parcelResults.bundle
    : Array.isArray(parcelResults) ? parcelResults : [];
  const parcel = list[0];
  if (parcel) {
    const parcelId = parcel.id ?? parcel.parcelId;
    if (parcelId) {
      await get(`Public Records /parcels/${parcelId}/assessments`, `${PUB_BASE}/parcels/${parcelId}/assessments`, true);
      await get(`Public Records /parcels/${parcelId}/transactions`, `${PUB_BASE}/parcels/${parcelId}/transactions`, true);
    }
  }
}

console.log('\n───────────────────────────────────────────────────────────────');
if (!HAS_REAL_TOKEN) {
  console.log('📋 To enable public records:');
  console.log('   1. Get your token: https://bridgedataoutput.com/login → API Keys');
  console.log('   2. Add to .env:  BRIDGE_SERVER_TOKEN=<your-token>');
  console.log('   3. Re-run this script');
}
console.log('═══════════════════════════════════════════════════════════════\n');
