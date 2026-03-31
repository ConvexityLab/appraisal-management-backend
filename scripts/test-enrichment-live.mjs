/**
 * Full Live Enrichment Test
 * ─────────────────────────────────────────────────────────────────────────────
 * Replicates the complete BridgePropertyDataProvider + PropertyEnrichmentService
 * pipeline and outputs the exact PropertyRecord + enrichment documents that
 * would be stored in Cosmos DB and surfaced in the UI.
 *
 * Usage:
 *   node scripts/test-enrichment-live.mjs [address] [--raw]
 *
 * Examples:
 *   node scripts/test-enrichment-live.mjs "4104 Illinois St, San Diego, CA 92104"
 *   node scripts/test-enrichment-live.mjs "8885 Rio San Diego Dr, San Diego, CA 92108"
 *   node scripts/test-enrichment-live.mjs "4104 Illinois St, San Diego, CA 92104" --raw
 *
 * Notes:
 *   - BRIDGE_SERVER_TOKEN must be set in .env.
 *   - MLS dataset (test_sd) has synthetic addresses; MLS lookup only matches test fixtures.
 *   - Public records API uses real data and drives all tax/legal/ownership fields.
 *   - Parcel search: address.full → street components → zip fallback.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env ─────────────────────────────────────────────────────────────────
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
} catch { /* .env is optional for CI */ }

// ── Args ──────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const SHOW_RAW   = args.includes('--raw');
const ADDRESS_ARG = args.find(a => !a.startsWith('-')) ?? '4104 Illinois St, San Diego, CA 92104';

// ── Bridge config ─────────────────────────────────────────────────────────────
const MLS_BASE = 'https://api.bridgedataoutput.com/api/v2/OData';
const PUB_BASE = 'https://api.bridgedataoutput.com/api/v2/pub';
const TOKEN    = process.env.BRIDGE_SERVER_TOKEN ?? '';

if (!TOKEN || TOKEN === 'your-bridge-server-token-here') {
  console.error('❌  BRIDGE_SERVER_TOKEN is not set or is still the placeholder.');
  console.error('    Add a real token to .env: BRIDGE_SERVER_TOKEN=<your-token>');
  process.exit(1);
}

const AUTH_HEADERS = {
  'Accept': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
};

// Bridge public API wraps results in bundle[]; MLS OData uses value[].
function extractList(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw.bundle))  return raw.bundle;
  if (Array.isArray(raw.value))   return raw.value;
  if (Array.isArray(raw.results)) return raw.results;
  if (Array.isArray(raw))         return raw;
  return [];
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function bridgeGet(label, url) {
  process.stdout.write(`  ⏳ ${label}... `);
  const res = await fetch(url, { headers: AUTH_HEADERS });
  if (!res.ok) {
    const text = await res.text();
    console.log(`❌  HTTP ${res.status} — ${text.slice(0, 120)}`);
    return [];
  }
  const raw  = await res.json();
  const list = extractList(raw);
  console.log(`✅  ${list.length} record${list.length === 1 ? '' : 's'}`);
  if (SHOW_RAW && list.length > 0) {
    console.log('\n  ── Raw Bridge payload (first record) ───────────────────────');
    console.log(JSON.stringify(list[0], null, 2).split('\n').map(l => '  ' + l).join('\n'));
    console.log('  ────────────────────────────────────────────────────────────\n');
  }
  return list;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING LOGIC  (mirrors bridge.provider.ts + property-enrichment.service.ts)
// These functions are kept in sync with the TypeScript source by hand; update
// both if the TS mapping logic changes.
// ═══════════════════════════════════════════════════════════════════════════════

function buildCore(mls, parcel) {
  const core = {};

  if (mls) {
    if (mls.LivingArea != null)             core.grossLivingArea = mls.LivingArea;
    if (mls.BedroomsTotal != null)          core.bedrooms        = mls.BedroomsTotal;

    const baths = mls.BathroomsTotalDecimal;
    if (baths != null) {
      core.bathsFull = Math.floor(baths);
      core.bathsHalf = Math.round((baths - Math.floor(baths)) * 2);
    }

    if (mls.YearBuilt != null)     core.yearBuilt    = mls.YearBuilt;
    if (mls.StoriesTotal != null)  core.stories      = mls.StoriesTotal;
    if (mls.CountyOrParish)        core.county       = mls.CountyOrParish;
    if (mls.PropertyType)          core.propertyType = mls.PropertyType;

    const lotSize  = mls.LotSizeArea;
    const lotUnits = mls.LotSizeUnits?.toLowerCase();
    if (lotSize != null) {
      core.lotSizeSqFt = lotUnits === 'acres' ? Math.round(lotSize * 43_560) : lotSize;
    }

    const garageSpaces = mls.GarageSpaces;
    const garageType   = mls.GarageType;
    if (garageSpaces != null || garageType) {
      core.garage = garageType
        ? `${garageSpaces ?? ''}-car ${garageType}`.trim()
        : `${garageSpaces ?? 0}-car`;
    }
  }

  if (parcel) {
    // Bridge public API uses `apn` (not `parcelNumber`)
    const apn = parcel.apn ?? parcel.parcelNumber;
    if (apn) core.parcelNumber = String(apn);

    // Coordinates: GeoJSON array [longitude, latitude]; [0,0] means unavailable
    const coords = parcel.coordinates;
    if (Array.isArray(coords) && coords.length >= 2 && (coords[0] !== 0 || coords[1] !== 0)) {
      core.longitude = coords[0];
      core.latitude  = coords[1];
    }

    if (core.lotSizeSqFt == null && parcel.lotSizeSquareFeet != null) {
      core.lotSizeSqFt = parcel.lotSizeSquareFeet;
    }
    if (!core.county && parcel.county) core.county = String(parcel.county);
  }

  return core;
}

function buildPublicRecord(parcel, assessment, transaction) {
  const rec = {};

  if (parcel) {
    // Bridge public API: `zoningCode` (not `zoning`)
    const zoning = parcel.zoningCode ?? parcel.zoning;
    if (zoning) rec.zoning = String(zoning);

    // Bridge public API: `landUseCode` / `landUseGeneral` (not `landUse`)
    const luc = parcel.landUseCode ?? parcel.landUseGeneral ?? parcel.landUse;
    if (luc) rec.landUseCode = String(luc);

    // Legal description is nested in parcel.legal.lotDescription
    const lotDesc = parcel.legal?.lotDescription;
    if (lotDesc) rec.legalDescription = String(lotDesc);
  }

  if (assessment) {
    // Bridge public API: `totalValue` (not `assessedValue` / `taxAssessedValue`)
    const assessed = assessment.totalValue ?? assessment.assessedValue ?? assessment.taxAssessedValue;
    if (assessed != null) rec.taxAssessedValue = Number(assessed);

    const year = assessment.year ?? assessment.taxYear;
    if (year   != null)   rec.taxYear = Number(year);

    // Bridge public API: `taxAmount` (not `annualTaxAmount`)
    const tax = assessment.taxAmount ?? assessment.annualTaxAmount;
    if (tax != null) rec.annualTaxAmount = Number(tax);

    // ownerName is not present in Bridge public assessment records
  }

  if (transaction) {
    const recDate = transaction.recordingDate;
    if (recDate) rec.deedTransferDate = String(recDate).slice(0, 10);
    // Bridge public API: `salesPrice` (not `amount` / `saleAmount`)
    const amount = transaction.salesPrice ?? transaction.amount ?? transaction.saleAmount;
    if (amount != null) rec.deedTransferAmount = Number(amount);
  }

  return rec;
}

function buildFlood(parcel) {
  if (!parcel) return {};
  const flood = {};
  const zone    = parcel.floodZone    ?? parcel.femaFloodZone;
  const mapNum  = parcel.floodMapNumber ?? parcel.femaMapNumber;
  const mapDate = parcel.floodMapDate   ?? parcel.femaMapDate;
  if (zone)   flood.femaFloodZone  = zone;
  if (mapNum) flood.femaMapNumber  = mapNum;
  if (mapDate) flood.femaMapDate  = mapDate.slice(0, 10);
  return flood;
}

/** Maps PropertyDataResult → PropertyRecord shape (mirrors enrichOrder logic). */
function buildPropertyRecord(propertyId, address, dataResult) {
  const now = new Date().toISOString();
  const { core, publicRecord, flood } = dataResult;

  // Building sub-document (mirrors buildBuildingChanges in enrichment service)
  const building = {
    gla:         core.grossLivingArea ?? 0,
    yearBuilt:   core.yearBuilt       ?? 0,
    bedrooms:    core.bedrooms        ?? 0,
    bathrooms:   core.bathsFull       ?? 0,
  };
  if (core.bathsHalf  != null)  building.halfBathrooms = core.bathsHalf;
  if (core.stories    != null)  building.stories       = core.stories;
  if (core.garage)              building.garageType    = core.garage;

  // Top-level fields (mirrors buildTopLevelChanges in enrichment service)
  const topLevel = {};
  if (core.parcelNumber != null) topLevel.apn           = core.parcelNumber;
  if (core.lotSizeSqFt  != null) topLevel.lotSizeSqFt   = core.lotSizeSqFt;
  if (core.latitude     != null) topLevel.latitude      = core.latitude;
  if (core.longitude    != null) topLevel.longitude     = core.longitude;
  if (core.county)               topLevel.county        = core.county;

  if (publicRecord?.zoning)      topLevel.zoning        = publicRecord.zoning;
  if (publicRecord?.landUseCode) topLevel.landUseCode   = publicRecord.landUseCode;
  if (publicRecord?.ownerName)   topLevel.currentOwner  = publicRecord.ownerName;
  if (publicRecord?.legalDescription) topLevel.legalDescription = publicRecord.legalDescription;
  if (flood?.femaFloodZone)      topLevel.floodZone     = flood.femaFloodZone;
  if (flood?.femaMapNumber)      topLevel.floodMapNumber = flood.femaMapNumber;
  if (flood?.femaMapDate)        topLevel.floodMapDate  = flood.femaMapDate;
  if (publicRecord?.deedTransferDate)   topLevel.lastSaleDate   = publicRecord.deedTransferDate;
  if (publicRecord?.deedTransferAmount) topLevel.lastSaleAmount = publicRecord.deedTransferAmount;

  // Tax assessment sub-document
  const taxAssessments = [];
  if (publicRecord?.taxAssessedValue != null) {
    taxAssessments.push({
      taxYear:            publicRecord.taxYear ?? new Date().getFullYear(),
      totalAssessedValue: publicRecord.taxAssessedValue,
      annualTaxAmount:    publicRecord.annualTaxAmount ?? null,
      source:             'PUBLIC_RECORDS_API',
      recordedAt:         dataResult.fetchedAt,
    });
  }

  return {
    id:         propertyId,
    type:       'property-record',
    tenantId:   'live-test',
    address: {
      street: address.street,
      city:   address.city,
      state:  address.state,
      zip:    address.zipCode,
    },
    propertyType: 'SINGLE_FAMILY',
    building,
    taxAssessments,
    permits: [],
    ...topLevel,
    dataSource:     'PUBLIC_RECORDS_API',
    lastVerifiedAt: dataResult.fetchedAt,
    recordVersion:  1,
    versionHistory: [],
    createdAt:      now,
    updatedAt:      now,
    createdBy:      'SYSTEM:property-enrichment',
  };
}

function buildEnrichmentRecord(orderId, propertyId, status, dataResult) {
  return {
    id:         `enrich-${orderId}-${Date.now()}`,
    type:       'property-enrichment',
    orderId,
    tenantId:   'live-test',
    propertyId,
    status,
    dataResult,
    createdAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const sep = '═'.repeat(70);
const div = '─'.repeat(70);

console.log('\n' + sep);
console.log('  Full Property Enrichment — Live Test');
console.log(sep);
console.log(`  Address : "${ADDRESS_ARG}"`);
console.log(`  Token   : ${TOKEN.slice(0, 8)}${'·'.repeat(Math.max(0, TOKEN.length - 8))}`);
console.log(`  Raw     : ${SHOW_RAW ? 'ON (--raw)' : 'OFF (add --raw to see Bridge payloads)'}`);
console.log(div);

// ── Parse address: "123 Main St, San Diego, CA 92104" ────────────────────────
const addrParts = ADDRESS_ARG.split(',').map(s => s.trim());
let parsedAddress;
if (addrParts.length >= 3) {
  const stateZip = addrParts[addrParts.length - 1].trim().split(/\s+/);
  const street   = addrParts.slice(0, addrParts.length - 2).join(', ');
  const words    = street.split(/\s+/);
  parsedAddress = {
    street,
    city:        addrParts[addrParts.length - 2],
    state:       stateZip[0] ?? '',
    zipCode:     stateZip[1] ?? '',
    houseNumber: /^\d/.test(words[0]) ? words[0] : '',
    streetName:  /^\d/.test(words[0]) ? words.slice(1).join(' ') : street,
  };
} else {
  parsedAddress = { street: ADDRESS_ARG, city: '', state: '', zipCode: '', houseNumber: '', streetName: '' };
}

console.log(`\n[Step 1] Bridge API calls`);
console.log(div);

// ── 1a. MLS OData (synthetic test_sd — only matches test fixture addresses) ───
const mlsFilter = encodeURIComponent(`tolower(UnparsedAddress) eq '${ADDRESS_ARG.toLowerCase()}'`);
const mlsUrl    = `${MLS_BASE}/test_sd/Property?$filter=${mlsFilter}&$top=1`;
const mlsList   = await bridgeGet('MLS OData (test_sd dataset)', mlsUrl);
const mlsRecord = mlsList[0];
if (!mlsRecord) console.log('  ℹ️   MLS: no match (expected for real addresses outside the test fixture).');

// ── 1b. Parcels: try address.full → components → zip fallback ─────────────────
let parcel;
let parcelNote;

// Strategy 1: address.full
const fullList = await bridgeGet(
  `Parcels (address.full)`,
  `${PUB_BASE}/parcels?address.full=${encodeURIComponent(ADDRESS_ARG)}&limit=1`,
);
if (fullList.length > 0) {
  parcel = fullList[0]; parcelNote = 'address.full match';
}

// Strategy 2: house + street + zip components
if (!parcel && parsedAddress.houseNumber && parsedAddress.zipCode) {
  const compList = await bridgeGet(
    `Parcels (house=${parsedAddress.houseNumber} street='${parsedAddress.streetName}' zip=${parsedAddress.zipCode})`,
    `${PUB_BASE}/parcels?address.house=${encodeURIComponent(parsedAddress.houseNumber)}&address.street=${encodeURIComponent(parsedAddress.streetName)}&address.zip=${encodeURIComponent(parsedAddress.zipCode)}&limit=1`,
  );
  if (compList.length > 0) { parcel = compList[0]; parcelNote = 'address component match'; }
}

// Strategy 3: zip-only fallback (shows the data shape even if exact address is absent)
if (!parcel && parsedAddress.zipCode) {
  const zipList = await bridgeGet(
    `Parcels (zip=${parsedAddress.zipCode} — fallback)`,
    `${PUB_BASE}/parcels?address.zip=${encodeURIComponent(parsedAddress.zipCode)}&limit=1`,
  );
  if (zipList.length > 0) {
    parcel = zipList[0];
    parcelNote = `zip-only fallback (zip ${parsedAddress.zipCode}; no exact address match found in Bridge public records)`;
  }
}

if (!mlsRecord && !parcel) {
  console.log('\n' + div);
  console.log('⚠️  Provider miss — no data returned from MLS or public records.');
  console.log('   Enrichment status would be: provider_miss');
  console.log(sep + '\n');
  process.exit(0);
}

// ── 1c. Assessments + transactions for the resolved parcel ────────────────────
let assessment;
let transaction;

if (parcel?.id) {
  const assArr  = await bridgeGet(`Assessments (parcel ${parcel.id})`, `${PUB_BASE}/parcels/${parcel.id}/assessments`);
  const tranArr = await bridgeGet(`Transactions (parcel ${parcel.id})`, `${PUB_BASE}/parcels/${parcel.id}/transactions`);
  if (assArr.length  > 0) assessment   = assArr.sort( (a, b) => ((b.year ?? 0) - (a.year ?? 0)))[0];
  if (tranArr.length > 0) transaction  = tranArr.sort((a, b) =>
    new Date(b.recordingDate ?? 0).getTime() - new Date(a.recordingDate ?? 0).getTime()
  )[0];
}

// ── Map to PropertyDataResult ─────────────────────────────────────────────────
console.log(`\n[Step 2] Mapping to internal structures`);
console.log(div);
if (parcelNote) {
  console.log(`  ℹ️   Parcel source     : ${parcelNote}`);
  if (parcel?.address) console.log(`  ℹ️   Parcel address    : ${parcel.address.full ?? JSON.stringify(parcel.address)}`);
  console.log('');
}

const core         = buildCore(mlsRecord, parcel);
const publicRecord = buildPublicRecord(parcel, assessment, transaction);
const flood        = buildFlood(parcel);
const fetchedAt    = new Date().toISOString();

const dataResult = {
  source:    'Bridge Interactive',
  fetchedAt,
  core,
  publicRecord,
  flood,
  rawProviderData: { mls: mlsRecord ?? null, parcel: parcel ?? null, assessment: assessment ?? null, transaction: transaction ?? null },
};

const coreKeys = Object.keys(core).filter(k => core[k] != null);
const prKeys   = Object.keys(publicRecord).filter(k => publicRecord[k] != null);
const flKeys   = Object.keys(flood).filter(k => flood[k] != null);

console.log(`  Core fields     : ${coreKeys.length > 0 ? coreKeys.join(', ')  : '(none)'}`);
console.log(`  Public record   : ${prKeys.length   > 0 ? prKeys.join(', ')    : '(none)'}`);
console.log(`  Flood fields    : ${flKeys.length   > 0 ? flKeys.join(', ')    : '(none)'}`);

// ── Build PropertyRecord (Cosmos document) ────────────────────────────────────
const PROPERTY_ID    = `prop-live-${Date.now()}`;
const ORDER_ID       = `order-live-${Date.now()}`;
const propertyRecord = buildPropertyRecord(PROPERTY_ID, parsedAddress, dataResult);
const enrichmentStatus = (coreKeys.length > 0 || prKeys.length > 0) ? 'enriched' : 'provider_miss';
const enrichmentRecord = buildEnrichmentRecord(ORDER_ID, PROPERTY_ID, enrichmentStatus, dataResult);

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + sep);
console.log('  1/2  PropertyRecord  (/propertyRecords/:id in Cosmos)');
console.log(sep);
console.log(JSON.stringify(propertyRecord, null, 2));

console.log('\n' + sep);
console.log('  2/2  PropertyEnrichmentRecord  (/propertyEnrichments/:id in Cosmos)');
console.log(sep);
// Omit the verbose rawProviderData for readability; use --raw to see Bridge payloads
const enrichmentSummary = { ...enrichmentRecord };
enrichmentSummary.dataResult = { ...enrichmentRecord.dataResult };
delete enrichmentSummary.dataResult.rawProviderData;
console.log(JSON.stringify(enrichmentSummary, null, 2));

console.log('\n' + sep);
console.log('  SUMMARY  (what the UI sees)');
console.log(sep);
const r = propertyRecord;
const fmt   = v => v ?? '—';
const money  = v => v != null ? '$' + Number(v).toLocaleString() : '—';
const sq     = v => v != null ? Number(v).toLocaleString() + ' sqft' : '—';

console.log(`  Address          : ${r.address.street}, ${r.address.city}, ${r.address.state} ${r.address.zip}`);
console.log(`  APN              : ${fmt(r.apn)}`);
console.log(`  GLA              : ${sq(r.building.gla || null)}`);
console.log(`  Year Built       : ${fmt(r.building.yearBuilt || null)}`);
console.log(`  Beds             : ${fmt(r.building.bedrooms || null)}`);
console.log(`  Baths            : ${r.building.bathrooms || '—'}${r.building.halfBathrooms ? ' full + ' + r.building.halfBathrooms + ' half' : ''}`);
console.log(`  Stories          : ${fmt(r.building.stories)}`);
console.log(`  Garage           : ${fmt(r.building.garageType)}`);
console.log(`  Lot Size         : ${sq(r.lotSizeSqFt)}`);
console.log(`  Property Type    : ${fmt(r.propertyType)}`);
console.log(`  County           : ${fmt(r.county)}`);
console.log(`  Lat / Lng        : ${r.latitude != null ? r.latitude + ', ' + r.longitude : '—'}`);
console.log(`  Zoning           : ${fmt(r.zoning)}`);
console.log(`  Land Use Code    : ${fmt(r.landUseCode)}`);
console.log(`  Legal Desc       : ${fmt(r.legalDescription)}`);
console.log(`  Current Owner    : ${fmt(r.currentOwner)}`);
console.log(`  Flood Zone       : ${fmt(r.floodZone)}`);
console.log(`  Last Sale Date   : ${fmt(r.lastSaleDate)}`);
console.log(`  Last Sale Amount : ${money(r.lastSaleAmount)}`);
if (r.taxAssessments?.length > 0) {
  const ta = r.taxAssessments[0];
  console.log(`  Tax Assessment   : ${money(ta.totalAssessedValue)} (${ta.taxYear})`);
  console.log(`  Annual Tax       : ${money(ta.annualTaxAmount)}`);
} else {
  console.log(`  Tax Assessment   : —`);
}
console.log(`  Enrichment Status: ${enrichmentRecord.status}`);
console.log(`  Last Verified At : ${r.lastVerifiedAt}`);
console.log('\n' + sep);
console.log('  ✅  Re-run: node scripts/test-enrichment-live.mjs [address]');
console.log('  ✅  Full payloads: add --raw');
console.log(sep + '\n');
