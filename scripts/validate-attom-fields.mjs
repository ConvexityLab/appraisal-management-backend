#!/usr/bin/env node
/**
 * ATTOM live field-path validation script.
 *
 * Calls all three ATTOM endpoints against a known address and compares the
 * actual response structure to what attom.provider.ts expects.
 *
 * Usage:
 *   node --env-file=.env scripts/validate-attom-fields.mjs
 *   ATTOM_API_KEY=<key> node scripts/validate-attom-fields.mjs [street] [city] [state] [zip]
 *
 * Example:
 *   ATTOM_API_KEY=abc123 node scripts/validate-attom-fields.mjs \
 *     "4529 Winona Ave" "San Diego" "CA" "92115"
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

const apiKey = process.env.ATTOM_API_KEY;
if (!apiKey) {
  console.error(
    '\n❌  ATTOM_API_KEY is not set.\n' +
    '    Add it to your .env file:\n' +
    '      ATTOM_API_KEY=<your-key>\n' +
    '    then re-run: node --env-file=.env scripts/validate-attom-fields.mjs\n',
  );
  process.exit(1);
}

// Default test address — well-known ATTOM fixture property.
const [, , street = '4529 Winona Ave', city = 'San Diego', state = 'CA', zip = '92115'] = process.argv;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function attomGet(path, params) {
  const url = new URL(`${ATTOM_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { APIKey: apiKey, Accept: 'application/json' },
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { parseError: text }; }

  if (!res.ok) {
    throw new Error(`ATTOM ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  // Status code 0 = success, 1 = empty result (both OK)
  const code = body?.status?.code ?? -1;
  if (code !== 0 && code !== 1) {
    throw new Error(`ATTOM ${path} → API error code ${code}: ${body?.status?.msg}`);
  }

  return body;
}

// ─── Dot-path utilities ───────────────────────────────────────────────────────

/** Resolve a dot-path against an object, returning [value, found]. */
function getPath(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return [undefined, false];
    if (!(p in cur)) return [undefined, false];
    cur = cur[p];
  }
  return [cur, true];
}

/** Return all leaf key paths in an object (depth-first, max depth 10). */
function allPaths(obj, prefix = '', depth = 0) {
  if (depth > 10 || obj == null || typeof obj !== 'object') return [];
  const paths = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      paths.push(...allPaths(v, full, depth + 1));
    } else {
      paths.push(full);
    }
  }
  return paths;
}

// ─── Field expectations (mirrors attom.provider.ts) ──────────────────────────

/**
 * Each group is { endpoint, fields: [{ path, note, optional }] }.
 * path is relative to property[0].
 */
const FIELD_EXPECTATIONS = [
  {
    endpoint: '/property/detailowner',
    params: { address1: street, address2: `${city}, ${state} ${zip}` },
    label: 'Detail + Owner',
    fields: [
      // Building size — first path is primary, first found wins
      { path: 'building.size.universalSize', note: 'grossLivingArea (primary)' },
      { path: 'building.size.livingSize',    note: 'grossLivingArea (fallback 1)', optional: true },
      { path: 'building.size.bldgSize',      note: 'grossLivingArea (fallback 2)', optional: true },
      // Rooms
      { path: 'building.rooms.beds',      note: 'bedrooms' },
      { path: 'building.rooms.bathsFull', note: 'bathsFull' },
      { path: 'building.rooms.bathsHalf', note: 'bathsHalf', optional: true },
      { path: 'building.rooms.bathsTotal',note: 'bathsTotal (fallback)', optional: true },
      { path: 'building.rooms.roomsTotal',note: 'totalRooms', optional: true },
      // Summary
      { path: 'building.summary.yearBuilt', note: 'yearBuilt' },
      { path: 'building.summary.propType',  note: 'propertyType (primary)' },
      { path: 'building.summary.propClass', note: 'propertyType (fallback)', optional: true },
      { path: 'building.summary.stories',   note: 'stories', optional: true },
      // Parking / basement
      { path: 'building.parking.prkgType', note: 'garage string (primary)', optional: true },
      { path: 'building.parking.prkgSize', note: 'garage string part 2',    optional: true },
      { path: 'building.interior.bsmtType', note: 'basement string (primary)', optional: true },
      { path: 'building.interior.bsmtSize', note: 'basement string part 2',    optional: true },
      // Lot
      { path: 'lot.lotSize2', note: 'lotSizeSqFt (sq ft direct)' },
      { path: 'lot.lotSize1', note: 'lotSizeSqFt (acres × 43560 fallback)', optional: true },
      { path: 'lot.zoningCodeLocal', note: 'zoning (primary)' },
      { path: 'lot.zoningCode',      note: 'zoning (fallback)', optional: true },
      // Flood (may appear on detailowner or be absent — both OK)
      { path: 'lot.floodZone',      note: 'femaFloodZone',   optional: true },
      { path: 'lot.floodMapNumber', note: 'femaMapNumber (primary)', optional: true },
      { path: 'lot.femaMapNumber',  note: 'femaMapNumber (fallback)', optional: true },
      { path: 'lot.floodMapDate',   note: 'femaMapDate (primary)', optional: true },
      { path: 'lot.femaMapDate',    note: 'femaMapDate (fallback)', optional: true },
      // Identifier — critical for follow-up calls
      { path: 'identifier.apn',    note: 'parcelNumber' },
      { path: 'identifier.attomId',note: 'attomId (used for follow-up calls)' },
      // Address components
      { path: 'address.county',    note: 'county', optional: true },
      { path: 'address.latitude',  note: 'latitude (expect string, parseFloat-ed)' },
      { path: 'address.longitude', note: 'longitude (expect string, parseFloat-ed)' },
      // Owner
      { path: 'owner.owner1.fullName',   note: 'ownerName (primary)' },
      { path: 'owner.owner1.firstName',  note: 'ownerName firstName fallback', optional: true },
      { path: 'owner.owner1.lastName',   note: 'ownerName lastName fallback',  optional: true },
      // Land use
      { path: 'summary.propLandUse', note: 'landUseCode' },
    ],
  },
  {
    endpoint: '/assessment/detail',
    params: { address1: street, address2: `${city}, ${state} ${zip}` },
    label: 'Assessment',
    fields: [
      { path: 'assessment.assessed.assdTtlValue', note: 'taxAssessedValue' },
      { path: 'assessment.tax.taxYear',           note: 'taxYear' },
      { path: 'assessment.tax.taxAmt',            note: 'annualTaxAmount' },
      { path: 'lot.legalDescription1',            note: 'legalDescription (primary)' },
      { path: 'lot.legalDescription',             note: 'legalDescription (fallback)', optional: true },
      { path: 'lot.zoningCodeLocal',              note: 'zoning backfill', optional: true },
    ],
  },
  {
    endpoint: '/saleshistory/basichistory',
    params: { address1: street, address2: `${city}, ${state} ${zip}` },
    label: 'Sales History',
    fields: [
      { path: 'salehistory.0.saleTransDate',  note: 'deedTransferDate (primary)' },
      { path: 'salehistory.0.recordingDate',  note: 'deedTransferDate (fallback)', optional: true },
      { path: 'salehistory.0.amount.saleamt', note: 'deedTransferAmount' },
    ],
  },
];

// ─── Type-note helpers ────────────────────────────────────────────────────────

function describeType(val) {
  if (val === null)        return 'null';
  if (Array.isArray(val)) return `Array(${val.length})`;
  return typeof val;
}

function typeWarning(path, val) {
  // Flag paths where provider does parseFloat but value is already a number
  const floatPaths = ['address.latitude', 'address.longitude'];
  if (floatPaths.some(p => path.endsWith(p)) && typeof val === 'number') {
    return ' ⚠️  Provider expects string (parseFloat), got number — safe but worth noting';
  }
  if (path.endsWith('attomId') && typeof val === 'string') {
    return ' ⚠️  Provider casts to Number(), got string — safe';
  }
  return '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`  ATTOM field-path validation`);
console.log(`  Address: ${street}, ${city}, ${state} ${zip}`);
console.log(`${'═'.repeat(70)}\n`);

let totalChecked = 0;
let totalMissing = 0;
let totalPresent = 0;

for (const group of FIELD_EXPECTATIONS) {
  console.log(`\n── ${group.label} (${group.endpoint}) ${'─'.repeat(Math.max(0, 60 - group.label.length - group.endpoint.length - 5))}`);

  let property;
  try {
    const body = await attomGet(group.endpoint, group.params);
    const props = body?.property ?? [];
    if (props.length === 0) {
      console.log('  ℹ️  No property records returned (status code 1 — empty result).');
      console.log('     Cannot validate field paths for this endpoint.');
      continue;
    }
    property = props[0];

    // Show all top-level keys in the first property object for discovery
    const discovered = allPaths(property).slice(0, 80);
    console.log(`  ℹ️  property[0] has ${discovered.length}+ leaf paths.`);
  } catch (err) {
    console.error(`  ❌  Request failed: ${err.message}`);
    continue;
  }

  for (const { path, note, optional } of group.fields) {
    // Support salehistory.0.xxx notation by walking arrays numerically
    const [value, found] = getPath(property, path);
    totalChecked++;

    if (!found || value === undefined || value === null) {
      if (optional) {
        console.log(`  ○  ${path.padEnd(45)} (optional — absent) ${note}`);
      } else {
        console.log(`  ❌  ${path.padEnd(44)} MISSING — expected for: ${note}`);
        totalMissing++;
      }
    } else {
      const typeNote = typeWarning(path, value);
      const display = String(value).slice(0, 40);
      console.log(`  ✅  ${path.padEnd(45)} = ${display.padEnd(42)} [${describeType(value)}]${typeNote}`);
      totalPresent++;
    }
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`  Results: ${totalPresent} present, ${totalMissing} missing critical, ${totalChecked} total checked`);
if (totalMissing === 0) {
  console.log('  ✅  All critical field paths are present in live responses.');
} else {
  console.log(`  ❌  ${totalMissing} critical path(s) missing — update attom.provider.ts mappings.`);
}
console.log(`${'═'.repeat(70)}\n`);

process.exit(totalMissing === 0 ? 0 : 1);
