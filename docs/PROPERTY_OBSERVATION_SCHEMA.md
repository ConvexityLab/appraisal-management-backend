# Property Observation Schema

**Container:** `property-observations`  
**Partition key:** `/tenantId`  
**Type discriminator:** `type: "property-observation"`

Property observations are the **immutable fact log** for all property knowledge in the system.
Every enrichment, import, extraction, correction, or AVM update must produce an observation row
before any downstream materialization occurs. Observations are never mutated after creation.

---

## Full Document Schema

```typescript
// Source type: PropertyObservationRecord (src/types/property-observation.types.ts)

interface PropertyObservationRecord {
  // ── Cosmos identity ─────────────────────────────────────────────────────────
  id: string;                          // generated ULID, e.g. "obs-01HW..."
  type: "property-observation";        // partition discriminator

  // ── Parcel identity ─────────────────────────────────────────────────────────
  tenantId: string;                    // e.g. "tenant-abc"
  propertyId: string;                  // canonical PropertyRecord.id, e.g. "prop-01HW..."

  // ── Observation classification ───────────────────────────────────────────────
  observationType: PropertyObservationType;   // see enum below
  sourceSystem: PropertyObservationSourceSystem; // see enum below

  // ── Provenance ──────────────────────────────────────────────────────────────
  observedAt: string;                  // ISO-8601 when the fact was known externally
  ingestedAt: string;                  // ISO-8601 when this row was created (set by service)
  sourceFingerprint: string;           // hash(sourceRecordId + observedAt + observationType)
                                       // used for idempotency checks

  // ── Linkage to upstream artifacts ───────────────────────────────────────────
  sourceArtifactRef?: {
    kind: "order" | "engagement" | "document" | "snapshot"
        | "provider-cache" | "bulk-import-job" | "manual-edit" | "other";
    id: string;                        // id of the referenced artifact
    externalId?: string;               // provider-assigned id when applicable
    uri?: string;                      // storage path / CDN URL when applicable
  };
  lineageRefs?: PropertyObservationSourceArtifactRef[]; // additional upstream refs

  // ── Workflow context (any that apply) ───────────────────────────────────────
  orderId?: string;
  engagementId?: string;
  documentId?: string;
  snapshotId?: string;

  // ── Provider metadata ────────────────────────────────────────────────────────
  sourceRecordId?: string;             // provider's own record id
  sourceProvider?: string;             // human-readable provider name, e.g. "Bridge Interactive"
  confidence?: number;                 // 0.0 – 1.0, provider-reported confidence when available

  // ── Normalized facts ────────────────────────────────────────────────────────
  // Only populate the sub-keys that this observation directly supplies.
  // The property projector merges these fields; absent sub-keys are not overwritten.
  normalizedFacts?: {
    addressPatch?: Partial<CanonicalAddress>;
    propertyPatch?: Record<string, unknown>;
    buildingPatch?: Partial<PropertyRecord["building"]>;
    canonicalPatch?: Partial<PropertyCurrentCanonicalView>;
    taxAssessment?: TaxAssessmentRecord;   // one entry per observation
    permit?: PermitRecord;                  // one entry per observation
    avm?: PropertyRecord["avm"];
  };

  // ── Raw payload ─────────────────────────────────────────────────────────────
  rawPayload?: Record<string, unknown> | null;  // verbatim provider response for audit replay

  // ── Authorship ──────────────────────────────────────────────────────────────
  createdBy: string;                   // e.g. "SYSTEM:property-enrichment" or "user:jane@example.com"
}
```

---

## `observationType` Values

| Value | When to emit |
|---|---|
| `provider-enrichment` | Bridge Interactive (or other API provider) returned property data |
| `public-record-import` | ATTOM / public-record materialization (tenant-scoped, with propertyId) |
| `document-extraction` | Extracted property facts from an uploaded appraisal or document |
| `manual-correction` | User explicitly patched address, building, or zoning fields via API |
| `permit-update` | New or updated permit record sourced from any provider or import |
| `tax-assessment-update` | Tax assessment added or refreshed |
| `avm-update` | AVM estimate produced by Bridge Zestimate or another AVM provider |
| `canonical-projection` | Projector emitted a materialized `currentCanonical` snapshot |

---

## `sourceSystem` Values

| Value | Produced by |
|---|---|
| `bridge-interactive` | Bridge Interactive API client |
| `attom-api` | Direct ATTOM REST API call |
| `attom-cache` | Read from the local ATTOM Cosmos cache (non-authoritative) |
| `public-records-import` | Tenant-scoped public-record import pipeline |
| `document-extraction` | Axiom extraction pipeline |
| `manual-user` | Human user via the property patch API |
| `canonical-snapshot-service` | `CanonicalSnapshotService` (canonical-projection observations) |
| `property-enrichment-service` | `PropertyEnrichmentService` (AVM, geocode, staging reads) |
| `legacy-backfill` | One-time backfill scripts migrating pre-observation data |
| `other` | Any other source not enumerated above |

---

## Example: AVM Update Observation

```json
{
  "id": "obs-01HW9XAVMBRIDGE001",
  "type": "property-observation",
  "tenantId": "tenant-abc",
  "propertyId": "prop-01HW9XPROP001",
  "observationType": "avm-update",
  "sourceSystem": "bridge-interactive",
  "sourceFingerprint": "sha256:aabbcc...",
  "observedAt": "2026-05-10T14:00:00.000Z",
  "ingestedAt": "2026-05-10T14:00:03.412Z",
  "orderId": "order-01HW9XORD001",
  "sourceProvider": "Bridge Interactive",
  "normalizedFacts": {
    "avm": {
      "value": 485000,
      "confidence": 0.87,
      "source": "bridge-zestimate",
      "fetchedAt": "2026-05-10T14:00:00.000Z"
    }
  },
  "rawPayload": { "zestimate": 485000, "valuationDate": "2026-05-10" },
  "createdBy": "SYSTEM:property-enrichment"
}
```

---

## Example: Tax Assessment Update Observation

```json
{
  "id": "obs-01HW9XTAXUPDATE001",
  "type": "property-observation",
  "tenantId": "tenant-abc",
  "propertyId": "prop-01HW9XPROP001",
  "observationType": "tax-assessment-update",
  "sourceSystem": "manual-user",
  "sourceFingerprint": "sha256:ccddee...",
  "observedAt": "2026-05-10T09:30:00.000Z",
  "ingestedAt": "2026-05-10T09:30:01.220Z",
  "sourceArtifactRef": { "kind": "manual-edit", "id": "edit-01HW9XEDIT001" },
  "normalizedFacts": {
    "taxAssessment": {
      "taxYear": 2025,
      "totalAssessedValue": 412000,
      "marketValue": 429000,
      "annualTaxAmount": 9744,
      "isDelinquent": false,
      "assessedAt": "2025-01-15"
    }
  },
  "rawPayload": null,
  "createdBy": "user:jane@example.com"
}
```

---

## Example: Provider Enrichment Observation (public records)

```json
{
  "id": "obs-01HW9XENRICHMNT001",
  "type": "property-observation",
  "tenantId": "tenant-abc",
  "propertyId": "prop-01HW9XPROP001",
  "observationType": "public-record-import",
  "sourceSystem": "bridge-interactive",
  "sourceFingerprint": "sha256:ffeedd...",
  "observedAt": "2026-05-10T14:00:00.000Z",
  "ingestedAt": "2026-05-10T14:00:03.190Z",
  "orderId": "order-01HW9XORD001",
  "sourceProvider": "Bridge Interactive",
  "normalizedFacts": {
    "propertyPatch": {
      "zoning": "R-1",
      "legalDescription": "LOT 12 BLK 4 HILLCREST ADD",
      "currentOwner": "SMITH JOHN R"
    },
    "buildingPatch": {
      "grossLivingArea": 2140,
      "yearBuilt": 1998,
      "bedrooms": 4,
      "bathrooms": 2.5
    }
  },
  "rawPayload": { "bridgeListingId": "BRG-123456", "...": "verbatim Bridge response" },
  "createdBy": "SYSTEM:property-enrichment"
}
```

---

## Idempotency

The `sourceFingerprint` field is a deterministic hash of `(sourceRecordId, observedAt, observationType)`.
`PropertyObservationService.createObservation(...)` checks for an existing observation with the same fingerprint
before writing, making repeated ingestion of the same source event safe to re-run.

## Projector Consumption

`PropertyProjectorService.replayCurrentCanonical(propertyId, tenantId)` reads all `property-observation`
rows for a given `propertyId`, ordered by `observedAt`, and applies each observation's `normalizedFacts`
to rebuild `PropertyRecord.currentCanonical` deterministically. Observation rows are never modified by the projector.
