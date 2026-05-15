# URAR Conditional Rendering — Complete Implementation Plan & Progress Tracker

**Created:** May 13, 2026  
**Repo:** `appraisal-management-backend`  
**Scope:** All form types: 1004 · 1073 · 1004C · 2055 · PUD overlay  
**Primary files:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts` · `src/templates/urar-v2.hbs`  
**Secondary file:** `src/templates/urar-v1.hbs` (maintenance-mode; gets identical changes after v2 is validated)  
**Config files:** `src/seed-data/report-config/urar-1004-base.ts` · `src/seed-data/report-config/delta-urar-1073.ts` · `src/seed-data/report-config/delta-drive-by-2055.ts`  
**FE registry:** `l1-valuation-platform-ui/src/components/report-form/section-registry.tsx`

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | Not started |
| 🟡 | In progress |
| ✅ | Complete & tested |
| ❌ | Blocked — see note |

---

## Overall Progress

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Config layer coordination contract (delta + base + registry alignment) | ✅ |
| Phase A | Mapper — form-type flags | ✅ |
| Phase B | Mapper — condo section builder | ✅ |
| Phase C | Mapper — PUD section builder | ✅ |
| Phase D | Mapper — manufactured home builder | ✅ |
| Phase E | Mapper — scope statement builder | ✅ |
| Phase F | Mapper — cost approach label + new-construction flag | ✅ |
| Phase G | Template — condo project analysis section | ✅ |
| Phase H | Template — PUD / HOA section | ✅ |
| Phase I | Template — manufactured home addendum | ✅ |
| Phase J | Template — exterior-only interior field suppression | ✅ |
| Phase K | Template — scope statement replacement | ✅ |
| Phase L | Template — form title / badge conditional | ✅ |
| Phase M | Template — addenda checklist conditional | ✅ |
| Phase N | Template — cost approach label binding | ✅ |
| Phase O | Tests — unit tests for all 6 form-type scenarios | ✅ |
| Phase P | urar-v1.hbs parity pass | ✅ |

---

---

## Phase 0 — Three-Layer Coordination Contract ⬜

This phase must be diagnosed and fixed **before** any mapper or template work. Without it, the FE section sidebar and the PDF output diverge.

### The Three Layers

```
Layer 1 — FE Section Sidebar
  EffectiveReportConfig (from GET /api/report-config/:orderId)
    └─ sections[].key + visible + visibleWhen (json-logic)
    └─ Evaluated against draft.reportDocument (CanonicalReportDocument)
    └─ jsonLogic.apply(visibleWhen, draft.reportDocument)
  Fallback: SECTION_META (all sections visible) when config is null/sparse

Layer 2 — BE Product Delta Configs (seed-data/report-config/)
  urar-1004-base.ts  →  delta-full-1004.ts
                      →  delta-urar-1073.ts     (URAR_1073 productId)
                      →  delta-drive-by-2055.ts (DRIVE_BY_2055 productId)
  Section visibility is product-scoped (per order.productType)

Layer 3 — PDF Render Pipeline
  CanonicalReportDocument → urar-1004.mapper.ts → Handlebars context → urar-v2.hbs
  Form-type flags in mapper context must mirror what product delta and draft.reportType say
```

### Canonical Section Key Table

All three layers must use the **same section key**. The FE registry (`section-registry.tsx`) is the authoritative key list.

| FE Registry key | FE component | Base config key | Visibility default | Enabled by product delta |
|---|---|---|---|---|
| `subject` | SubjectSection | `subject` | ✅ visible | All forms |
| `contract` | ContractSection | `contract` | ✅ visible | All forms |
| `neighborhood` | NeighborhoodSection | `neighborhood` | ✅ visible | All forms |
| `site` | SiteSection | `site` | ✅ visible | All (hidden for 1073 only) |
| `improvements` | ImprovementsSection | `improvements` | ✅ visible | All forms |
| `hbu` | HbuSection | `hbu` | ✅ visible | All forms |
| `sales-comparison` | SalesComparisonSection | `sales-comparison` | ✅ visible | All forms |
| `cost-approach` | CostApproachSection | `cost-approach` | ✅ visible | Hidden for 1073, 2055 |
| `income-approach` | IncomeApproachSection | `income-approach` | ✅ visible | Hidden for 2055 |
| `reconciliation` | ReconciliationSection | `reconciliation` | ✅ visible | All forms |
| `certification` | CertificationSection | `certification` | ✅ visible | All forms |
| `photos` | PhotoSection | `photos` | ✅ visible | All forms |
| `addenda` | AddendaSection | `addenda` | ✅ visible | All forms |
| `prior-transfers` | PriorTransfersSection | `prior-transfers` | ✅ visible | All forms |
| `scope-of-work` | ScopeOfWorkSection | `scope-of-work` | ✅ visible | All forms |
| `assignment-conditions` | AssignmentConditionsSection | `assignment-conditions` | ✅ visible | All forms |
| `additional-comments` | AdditionalCommentsSection | `additional-comments` | ✅ visible | All forms |
| `project-info` | ProjectInfoSection | `project-info` | **❌ hidden by default** | Enabled by 1073 delta OR visibleWhen condo/PUD data |
| `manufactured-home` | ManufacturedHomeSection | `manufactured-home` | **❌ hidden by default** | Enabled by 1004C delta OR visibleWhen manufactured data |
| `disaster-mitigation` | DisasterMitigationSection | `disaster-mitigation` | ✅ visible | All forms |
| `energy-efficiency` | EnergyEfficiencySection | `energy-efficiency` | ✅ visible | All forms |
| `functional-obsolescence` | FunctionalObsolescenceSection | `functional-obsolescence` | ✅ visible | All forms |
| `outbuildings` | OutbuildingSection | `outbuildings` | ✅ visible | All forms |
| `vehicle-storage` | VehicleStorageSection | `vehicle-storage` | ✅ visible | All forms |
| `amenities` | AmenitiesSection | `amenities` | ✅ visible | All forms |
| `quality-condition` | QualityConditionSection | `quality-condition` | ✅ visible | All forms |
| `subject-listings` | SubjectListingSection | `subject-listings` | ✅ visible | All forms |
| `defects` | DefectsSection | `defects` | ✅ visible | All forms |
| `rental-information` | RentalInformationSection | `rental-information` | ✅ visible | All forms |
| `revision-history` | RevisionHistorySection | `revision-history` | ✅ visible | All forms |

### Canonical `reportType` Values (AppraisalFormType enum)

`draft.reportDocument.reportType` is set from `AppraisalFormType` enum. The mapper must check for these exact string values:

| AppraisalFormType enum | Value | Mapper flag | Product delta |
|---|---|---|---|
| `FORM_1004` | `'FORM_1004'` | baseline | `FULL_1004` |
| `FORM_1073` | `'FORM_1073'` | `isCondo = true` | `URAR_1073` |
| `FORM_1004C` | `'FORM_1004C'` | `isManufactured = true` | *(to be added)* |
| `FORM_2055` | `'FORM_2055'` | `isExteriorOnly = true` | `DRIVE_BY_2055` |
| `FORM_1025` | `'FORM_1025'` | *(separate mapper, out of scope)* | |

⚠️ **Bug confirmed in current plan**: Phase A originally used `doc.reportType === '1073'` which will never match. Corrected to `'FORM_1073'` throughout.

### Current Misalignments (Phase 0 fixes)

| File | Problem | Fix |
|---|---|---|
| `delta-urar-1073.ts` | Suppresses `site_section` and `cost_approach` (underscore keys that don't exist in base config or registry); adds `hoa_section` via addSections which is rendered by `ConfigDrivenSection` rather than the real `ProjectInfoSection` | Rename keys to `site` and `cost-approach`; replace `hoa_section` addSection with `project-info` section set to `visible: true` |
| `delta-drive-by-2055.ts` | Suppresses `interior_condition`, `improvements_interior`, `basement`, `heating_cooling`, `kitchen`, `bathrooms`, `additional_features` — none of these keys exist in the base config or FE registry; the suppress commands are dead no-ops | Replace with `cost-approach` and `income-approach` visibility suppression; remove dead keys; add `visibleWhen` json-logic for interior field suppression at field level (Phase J) |
| `urar-1004-base.ts` | Missing `project-info` and `manufactured-home` sections — without them in the base, product deltas cannot enable/disable them | Add both sections with `visible: false` default so deltas can set `visible: true` |
| Phase A (this plan) | Used bare `'1073'`, `'2055'`, `'1004C'` for reportType checks | Must use `'FORM_1073'`, `'FORM_2055'`, `'FORM_1004C'` |

### `visibleWhen` JSON Logic Rules

For data-driven section visibility (evaluated against `draft.reportDocument`):

```json
// project-info: show when form is 1073 OR propertyType contains condo/PUD OR pudDetail exists
{
  "or": [
    {"==": [{"var": "reportType"}, "FORM_1073"]},
    {"==": [{"var": "reportType"}, "FORM_1033"]},
    {"in": ["ondo", {"var": "subject.propertyType"}]},
    {"in": ["PUD", {"var": "subject.propertyType"}]},
    {"!=": [{"var": "subject.condoDetail"}, null]}
  ]
}

// manufactured-home: show when form is 1004C OR constructionMethod is Manufactured
{
  "or": [
    {"==": [{"var": "reportType"}, "FORM_1004C"]},
    {"==": [{"var": "subject.constructionMethod"}, "Manufactured"]}
  ]
}
```

**Phase 0 Checklist:**
- [ ] `urar-1004-base.ts` — add `project-info` (visible: false) and `manufactured-home` (visible: false) sections with the `visibleWhen` rules above
- [ ] `delta-urar-1073.ts` — replace underscore keys with hyphen keys; swap `hoa_section` addSection for `project-info: visible: true` override
- [ ] `delta-drive-by-2055.ts` — remove dead interior section keys; fix to `cost-approach` and `income-approach`; add `hoa_section` suppression note
- [ ] `delta-full-1004C.ts` — create new product delta for `FORM_1004C` / `productId: 'FULL_1004C'` that sets `manufactured-home: visible: true`
- [ ] All changes tsc-checked

---

## Architecture Context

### Why this matters

The templates use Handlebars + Playwright (html-render strategy). The mapper (`Urar1004Mapper.mapToFieldMap`) is the **only** place that translates `CanonicalReportDocument` into template context. The template itself must never infer anything from raw data — all boolean flags and formatted values must come from the mapper.

### Template render chain

```
CanonicalReportDocument  →  Urar1004Mapper.mapToFieldMap()  →  Handlebars context
                                                                      ↓
                                                              urar-v2.hbs (Playwright)
                                                                      ↓
                                                              PDF blob
```

### Form type → GSE form number mapping

| `doc.reportType` (`AppraisalFormType` enum value) | GSE Form | Description | Key additions over 1004 |
|---|---|---|---|
| `"FORM_1004"` | FNMA/FHLMC 1004 | SFR interior inspection | Baseline |
| `"FORM_1073"` | FNMA Form 1073 / FHLMC 465 | Condo interior inspection | Condo project analysis section (required) |
| `"FORM_1004C"` | FNMA 1004C / FHLMC 70B | Manufactured housing | Manufactured home addendum (required) |
| `"FORM_2055"` | FNMA 2055 / FHLMC 2055 | Exterior-only inspection | Interior fields suppressed; scope statement changed |
| `"FORM_1004"` + PUD `propertyType` | 1004 + PUD addendum | SFR in planned unit development | PUD project section (required) |

---

## Source Data Available (canonical schema — confirmed)

All data required to drive every conditional section already exists. No schema changes needed.

| Canonical field | Location | Used by |
|---|---|---|
| `doc.reportType` | `CanonicalReportDocument.reportType: string` | Form type primary discriminator |
| `doc.subject.propertyType` | `CanonicalSubject.propertyType: string` | Secondary discriminator (`"Condo"`, `"PUD"`, etc.) |
| `doc.subject.constructionMethod` | `CanonicalSubject.constructionMethod: 'SiteBuilt' \| 'Modular' \| 'Manufactured' \| null` | Manufactured home detection |
| `doc.subject.yearBuilt` | `CanonicalSubject.yearBuilt: number` | New-construction detection |
| `doc.subject.condoDetail` | `CanonicalSubject.condoDetail?: CanonicalCondoDetail \| null` | Condo project section |
| `doc.subject.pudDetail` | `CanonicalSubject.pudDetail?: CanonicalPudDetail \| null` | PUD section |
| `doc.subject.hoaDetail` | `CanonicalSubject.hoaDetail?: CanonicalHoaDetail \| null` | Both condo + PUD HOA block |
| `doc.manufacturedHome` | `CanonicalReportDocument.manufacturedHome?: CanonicalManufacturedHome` | Manufactured home addendum |
| `doc.scopeOfWork.inspectionType` | `CanonicalScopeOfWork.inspectionType: string \| null` | Scope statement, exterior-only detection |
| `doc.scopeOfWork.approachesDeveloped` | `CanonicalScopeOfWork.approachesDeveloped: string[]` | Scope statement approaches list |

### `CanonicalCondoDetail` fields used (Form 1073)

```
projectName, projectType, totalUnits, unitsSold, unitsForSale, unitsRented,
ownerOccupancyPct, isPhased, commonElementsComplete, pendingLitigation,
pendingLitigationDetails, specialAssessment, specialAssessmentDetails,
developerControlled, unitFloorLevel, buildingTotalFloors, singleEntityOwnershipPct,
nonResidentialUsePct, commercialUseDescription, isHotelMotel, hasIncomeRestrictions,
ageRestrictedCommunity, groundRent, groundRentAmount, comments
```

### `CanonicalHoaDetail` fields used (1073 + PUD)

```
hoaFee, hoaFrequency, hoaIncludes, specialAssessmentAmount, managementCompany,
hoaName, reserveFundBalance, reserveFundAdequacy, delinquentDues60Day,
masterInsurancePremium, masterInsuranceCoverage, fidelityBondCoverage
```

### `CanonicalPudDetail` fields used (PUD overlay)

```
projectName, pudType, totalUnits, totalPhases, developerControlled,
commonElementsComplete, isPhased, unitsSold, unitsForSale, unitsRented,
ownerOccupancyPct, projectComplete, observedDeficiencies,
observedDeficienciesDescription
```

### `CanonicalManufacturedHome` fields used (Form 1004C)

```
hudDataPlatePresent, hudLabelNumbers, manufacturer, model, serialNumber,
yearManufactured, widthType, invoiceCost, deliveryCost, installationCost,
setupCost, foundationType, factoryBuiltCertification, narrative
```

---

## Phase A — Mapper: Form-type flags ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`  
**Location:** Add immediately before the `return {` at the bottom of `mapToFieldMap`

**Exact logic to implement:**

```typescript
// ── Form-type / assignment-type flags ───────────────────────────────────────
const propertyTypeLower = (subject?.propertyType ?? '').toLowerCase();
const isCondo        = doc.reportType === 'FORM_1073'
                       || doc.reportType === 'FORM_1033'
                       || propertyTypeLower.includes('condo')
                       || propertyTypeLower.includes('co-op')
                       || propertyTypeLower.includes('cooperative');
const isManufactured = doc.reportType === 'FORM_1004C'
                       || subject?.constructionMethod === 'Manufactured';
const isPUD          = propertyTypeLower.includes('pud')
                       || propertyTypeLower.includes('planned unit');
const isExteriorOnly = doc.reportType === 'FORM_2055'
                       || /exterior/i.test(doc.scopeOfWork?.inspectionType ?? '');
const isNewConstruction = typeof subject?.yearBuilt === 'number'
                          && subject.yearBuilt >= new Date().getFullYear() - 1;

// Derive the correct FNMA form number string for display
// Note: these are the short display strings ('1073'), not the AppraisalFormType enum values ('FORM_1073')
const gseFormNumber  = isCondo       ? '1073'
                     : isManufactured ? '1004C'
                     : isExteriorOnly ? '2055'
                     : '1004';
const gseFormLabel   = isCondo       ? 'Individual Condominium Unit Appraisal Report — Form 1073'
                     : isManufactured ? 'Manufactured Home Appraisal Report — Form 1004C'
                     : isExteriorOnly ? 'Exterior-Only Inspection Residential Appraisal Report — Form 2055'
                     : 'Uniform Residential Appraisal Report — Form 1004';
```

**New keys added to returned context:**

```typescript
isCondo, isManufactured, isPUD, isExteriorOnly, isNewConstruction,
gseFormNumber, gseFormLabel,
hasCondoDetail:      isCondo && !!subject?.condoDetail,
hasPudDetail:        isPUD   && !!subject?.pudDetail,
hasHoaDetail:        !!(subject?.hoaDetail),
hasManufacturedHome: isManufactured && !!doc.manufacturedHome,
```

**Checklist:**
- [ ] `isCondo` derived correctly from `reportType` and `propertyType`
- [ ] `isManufactured` derived correctly from `reportType` and `constructionMethod`
- [ ] `isPUD` derived from `propertyType` string
- [ ] `isExteriorOnly` derived from `reportType` and `scopeOfWork.inspectionType`
- [ ] `isNewConstruction` uses `new Date().getFullYear() - 1` correctly
- [ ] All 6 new boolean flags present in returned object
- [ ] `gseFormNumber` and `gseFormLabel` present in returned object

---

## Phase B — Mapper: Condo section builder ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`  
**Location:** Add as a new function near `buildCompContext`

**Function signature:**

```typescript
function buildCondoDetailContext(
  detail: CanonicalCondoDetail | null | undefined,
  hoa:    CanonicalHoaDetail   | null | undefined,
): Record<string, unknown> | null
```

**Required output fields (all formatted):**

```typescript
{
  projectName:             a(detail.projectName),
  projectType:             a(detail.projectType),                   // Established/New/Conversion/Gut Rehab
  totalUnits:              num(detail.totalUnits),
  unitsSold:               num(detail.unitsSold),
  unitsForSale:            num(detail.unitsForSale),
  unitsRented:             num(detail.unitsRented),
  ownerOccupancyPct:       pct(detail.ownerOccupancyPct),
  singleEntityOwnershipPct: pct(detail.singleEntityOwnershipPct),
  // FNMA concentration flag: >10% single entity = red flag
  singleEntityConcentrationFlag: (detail.singleEntityOwnershipPct ?? 0) > 10,
  isPhased:                detail.isPhased ?? false,
  commonElementsComplete:  detail.commonElementsComplete ?? false,
  pendingLitigation:       detail.pendingLitigation ?? false,
  pendingLitigationDetails: a(detail.pendingLitigationDetails),
  specialAssessment:       currency(detail.specialAssessment),
  hasSpecialAssessment:    !!detail.specialAssessment,
  specialAssessmentDetails: a(detail.specialAssessmentDetails),
  developerControlled:     detail.developerControlled ?? false,
  unitFloorLevel:          num(detail.unitFloorLevel),
  buildingTotalFloors:     num(detail.buildingTotalFloors),
  nonResidentialUsePct:    pct(detail.nonResidentialUsePct),
  isHotelMotel:            detail.isHotelMotel ?? false,
  hasIncomeRestrictions:   detail.hasIncomeRestrictions ?? false,
  ageRestricted:           detail.ageRestrictedCommunity ?? false,
  groundRent:              detail.groundRent ?? false,
  groundRentAmount:        currency(detail.groundRentAmount),
  comments:                a(detail.comments),
  // HOA block
  hoaFee:                  hoa ? currency(hoa.hoaFee) : '',
  hoaFrequency:            hoa ? a(hoa.hoaFrequency) : '',
  hoaIncludes:             hoa ? a(hoa.hoaIncludes) : '',
  specialAssessmentMonthly: hoa ? currency(hoa.specialAssessmentAmount) : '',
  managementCompany:       hoa ? a(hoa.managementCompany) : '',
  hoaName:                 hoa ? a(hoa.hoaName) : '',
  reserveFundBalance:      hoa ? currency(hoa.reserveFundBalance) : '',
  reserveFundAdequacy:     hoa ? a(hoa.reserveFundAdequacy) : '',
  delinquentDues60Day:     hoa ? num(hoa.delinquentDues60Day) : '',
  masterInsurancePremium:  hoa ? currency(hoa.masterInsurancePremium) : '',
  masterInsuranceCoverage: hoa ? a(hoa.masterInsuranceCoverage) : '',
  fidelityBondCoverage:    hoa ? currency(hoa.fidelityBondCoverage) : '',
}
```

**Add to returned context:**

```typescript
condoDetail: isCondo ? buildCondoDetailContext(subject?.condoDetail, subject?.hoaDetail) : null,
```

**Checklist:**
- [ ] Function handles `null` input (returns `null`)
- [ ] All currency fields use `currency()` helper
- [ ] `singleEntityConcentrationFlag` boolean triggers red styling in template
- [ ] `hoaFee` correctly handles null HOA (empty string, not crash)
- [ ] Added to returned context under `condoDetail`

---

## Phase C — Mapper: PUD section builder ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`

**Function signature:**

```typescript
function buildPudDetailContext(
  detail: CanonicalPudDetail | null | undefined,
  hoa:    CanonicalHoaDetail | null | undefined,
): Record<string, unknown> | null
```

**Required output fields:**

```typescript
{
  projectName:            a(detail.projectName),
  pudType:                a(detail.pudType),         // Detached / Attached
  totalUnits:             num(detail.totalUnits),
  totalPhases:            num(detail.totalPhases),
  unitsSold:              num(detail.unitsSold),
  unitsForSale:           num(detail.unitsForSale),
  unitsRented:            num(detail.unitsRented),
  ownerOccupancyPct:      pct(detail.ownerOccupancyPct),
  developerControlled:    detail.developerControlled ?? false,
  commonElementsComplete: detail.commonElementsComplete ?? false,
  isPhased:               detail.isPhased ?? false,
  projectComplete:        detail.projectComplete ?? false,
  observedDeficiencies:   detail.observedDeficiencies ?? false,
  observedDeficienciesDescription: a(detail.observedDeficienciesDescription),
  comments:               a(detail.comments),
  // HOA block — same as condo
  hoaFee:                 hoa ? currency(hoa.hoaFee) : '',
  hoaFrequency:           hoa ? a(hoa.hoaFrequency) : '',
  hoaIncludes:            hoa ? a(hoa.hoaIncludes) : '',
  managementCompany:      hoa ? a(hoa.managementCompany) : '',
  reserveFundBalance:     hoa ? currency(hoa.reserveFundBalance) : '',
}
```

**Add to returned context:**

```typescript
pudDetail: isPUD ? buildPudDetailContext(subject?.pudDetail, subject?.hoaDetail) : null,
```

**Checklist:**
- [ ] Function handles `null` input (returns `null`)
- [ ] Added to returned context under `pudDetail`

---

## Phase D — Mapper: Manufactured home builder ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`

**Function signature:**

```typescript
function buildManufacturedHomeContext(
  mfh: CanonicalManufacturedHome | null | undefined,
): Record<string, unknown> | null
```

**Required output fields:**

```typescript
{
  hudDataPlatePresent:    mfh.hudDataPlatePresent ?? false,
  hudLabelNumbers:        a(mfh.hudLabelNumbers),
  manufacturer:           a(mfh.manufacturer),
  model:                  a(mfh.model),
  serialNumber:           a(mfh.serialNumber),
  yearManufactured:       num(mfh.yearManufactured),
  widthType:              a(mfh.widthType),            // Single-Wide / Double-Wide / Triple-Wide
  invoiceCost:            currency(mfh.invoiceCost),
  deliveryCost:           currency(mfh.deliveryCost),
  installationCost:       currency(mfh.installationCost),
  setupCost:              currency(mfh.setupCost),
  totalCost:              currency(
                            (mfh.invoiceCost ?? 0) + (mfh.deliveryCost ?? 0) +
                            (mfh.installationCost ?? 0) + (mfh.setupCost ?? 0)
                          ),
  foundationType:         a(mfh.foundationType),
  factoryBuiltCertification: a(mfh.factoryBuiltCertification),
  narrative:              a(mfh.narrative),
}
```

**Add to returned context:**

```typescript
manufacturedHome: isManufactured ? buildManufacturedHomeContext(doc.manufacturedHome) : null,
```

**Checklist:**
- [ ] `totalCost` computed correctly (sum of all four cost fields, null-safe)
- [ ] `hudDataPlatePresent` boolean drives a checkbox in template
- [ ] Added to returned context under `manufacturedHome`

---

## Phase E — Mapper: Scope statement builder ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`

Replace the hardcoded scope-of-work sentence on Page 4 of the template with a mapper-derived string.

**Function (inline, no separate function needed):**

```typescript
const approachList = [
  'Sales Comparison',
  hasCostApproach  ? 'Cost'   : null,
  hasIncomeApproach ? 'Income' : null,
].filter(Boolean).join(', ');

const inspectionDescription = isExteriorOnly
  ? `Exterior-only inspection performed ${shortDate(m.inspectionDate)}`
  : `Interior and exterior inspection performed ${shortDate(m.inspectionDate)}`;

const scopeStatement = `${inspectionDescription}. Public records searched. MLS sales data reviewed. ${approachList} Approach${approachList.includes(',') ? 'es' : ''} developed. Market conditions analyzed per Fannie Mae Market Conditions Addendum guidance.`;
```

**Add to returned context:**

```typescript
scopeStatement,
```

**Checklist:**
- [ ] Exterior-only uses correct language
- [ ] Approach list is grammatically correct (singular vs. plural)
- [ ] Uses `shortDate()` helper for the inspection date

---

## Phase F — Mapper: Cost approach label + new-construction flag ⬜

**File:** `src/services/report-engine/field-mappers/urar-1004.mapper.ts`

**Add to returned context:**

```typescript
isNewConstruction,
costApproachLabel: isNewConstruction
  ? 'Cost Approach to Value (Required — New Construction per FNMA B4-1.3-05)'
  : 'Cost Approach to Value (Not Required by Fannie Mae)',
costApproachRequiredWarning: isNewConstruction && !costCtx
  ? 'WARNING: Cost approach data is required for new construction but was not provided.'
  : null,
```

**Checklist:**
- [ ] Label changes correctly for new construction
- [ ] Warning flag fires when new construction AND no cost data
- [ ] Template renders warning in a visible way (red banner — see Phase N)

---

## Phase G — Template: Condo project analysis section ⬜

**File:** `src/templates/urar-v2.hbs`  
**Insertion point:** End of Page 1 (after the Improvements section, before Subject Photos)  
**Guard:** `{{#if hasCondoDetail}}`

**GSE-required fields per FNMA B4-1.4-01 / Form 1073:**

```handlebars
{{#if hasCondoDetail}}
<div class="section-hdr">Condominium Project Analysis (Form 1073 — Required)</div>
<div class="row g3">
  <div class="cell"><span class="lbl">Project Name</span><span class="val">{{condoDetail.projectName}}</span></div>
  <div class="cell"><span class="lbl">Project Type</span><span class="val">{{condoDetail.projectType}}</span></div>
  <div class="cell"><span class="lbl">Unit Floor / Building Floors</span><span class="val">{{condoDetail.unitFloorLevel}} / {{condoDetail.buildingTotalFloors}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Total Units</span><span class="val">{{condoDetail.totalUnits}}</span></div>
  <div class="cell"><span class="lbl">Units Sold</span><span class="val">{{condoDetail.unitsSold}}</span></div>
  <div class="cell"><span class="lbl">Units For Sale</span><span class="val">{{condoDetail.unitsForSale}}</span></div>
  <div class="cell"><span class="lbl">Units Rented</span><span class="val">{{condoDetail.unitsRented}}</span></div>
</div>
<div class="row g3">
  <div class="cell"><span class="lbl">Owner Occupancy %</span><span class="val">{{condoDetail.ownerOccupancyPct}}</span></div>
  <div class="cell">
    <span class="lbl">Single Entity Concentration</span>
    <span class="val {{#if condoDetail.singleEntityConcentrationFlag}}" style="color:var(--red);font-weight:700"{{/if}}>
      {{condoDetail.singleEntityOwnershipPct}}{{#if condoDetail.singleEntityConcentrationFlag}} ⚠ EXCEEDS 10% FNMA LIMIT{{/if}}
    </span>
  </div>
  <div class="cell"><span class="lbl">Non-Residential Use %</span><span class="val">{{condoDetail.nonResidentialUsePct}}</span></div>
</div>
<div class="row g4">
  <div class="cell">
    <span class="lbl">Developer Controlled</span>
    <span class="val">{{#if condoDetail.developerControlled}}Yes{{else}}No{{/if}}</span>
  </div>
  <div class="cell">
    <span class="lbl">Common Elements Complete</span>
    <span class="val">{{#if condoDetail.commonElementsComplete}}Yes{{else}}No{{/if}}</span>
  </div>
  <div class="cell">
    <span class="lbl">Phased Project</span>
    <span class="val">{{#if condoDetail.isPhased}}Yes{{else}}No{{/if}}</span>
  </div>
  <div class="cell">
    <span class="lbl">Pending Litigation</span>
    <span class="val {{#if condoDetail.pendingLitigation}}" style="color:var(--red);font-weight:700"{{/if}}">
      {{#if condoDetail.pendingLitigation}}Yes ⚠{{else}}No{{/if}}
    </span>
  </div>
</div>
{{#if condoDetail.pendingLitigation}}
<div class="row g2" style="border-left:4px solid var(--red);margin-left:0">
  <div class="cell"><span class="lbl">Litigation Details</span><span class="val">{{condoDetail.pendingLitigationDetails}}</span></div>
</div>
{{/if}}
{{#if condoDetail.hasSpecialAssessment}}
<div class="row g2">
  <div class="cell"><span class="lbl">Special Assessment Amount</span><span class="val" style="color:var(--red)">{{condoDetail.specialAssessment}}</span></div>
  <div class="cell"><span class="lbl">Special Assessment Details</span><span class="val">{{condoDetail.specialAssessmentDetails}}</span></div>
</div>
{{/if}}
<!-- Other flags -->
<div class="row g4">
  <div class="cell"><span class="lbl">Hotel/Motel Use</span><span class="val">{{#if condoDetail.isHotelMotel}}Yes ⚠{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Income Restricted</span><span class="val">{{#if condoDetail.hasIncomeRestrictions}}Yes{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Age Restricted (55+)</span><span class="val">{{#if condoDetail.ageRestricted}}Yes{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Ground Rent</span><span class="val">{{#if condoDetail.groundRent}}Yes — {{condoDetail.groundRentAmount}}{{else}}No{{/if}}</span></div>
</div>
{{#if hasHoaDetail}}
<div class="section-hdr gold">HOA / Project Financial Analysis</div>
<div class="row g4">
  <div class="cell"><span class="lbl">HOA Name</span><span class="val">{{condoDetail.hoaName}}</span></div>
  <div class="cell"><span class="lbl">HOA Fee</span><span class="val">{{condoDetail.hoaFee}} / {{condoDetail.hoaFrequency}}</span></div>
  <div class="cell"><span class="lbl">Management Company</span><span class="val">{{condoDetail.managementCompany}}</span></div>
  <div class="cell"><span class="lbl">Monthly Special Assessment</span><span class="val">{{condoDetail.specialAssessmentMonthly}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Reserve Fund Balance</span><span class="val">{{condoDetail.reserveFundBalance}}</span></div>
  <div class="cell">
    <span class="lbl">Reserve Fund Adequacy</span>
    <span class="val">{{condoDetail.reserveFundAdequacy}}</span>
  </div>
  <div class="cell"><span class="lbl">Master Insurance Premium</span><span class="val">{{condoDetail.masterInsurancePremium}}</span></div>
  <div class="cell"><span class="lbl">Fidelity Bond Coverage</span><span class="val">{{condoDetail.fidelityBondCoverage}}</span></div>
</div>
{{/if}}
{{#if condoDetail.comments}}
<div class="row">
  <div class="cell"><span class="lbl">Project Comments</span><span class="val">{{condoDetail.comments}}</span></div>
</div>
{{/if}}
{{/if}}
```

**Checklist:**
- [ ] Section only renders when `hasCondoDetail` is `true`
- [ ] Litigation flag shows red text + warning icon
- [ ] Single entity concentration > 10% shows red text + warning
- [ ] Special assessment block only renders when `hasSpecialAssessment`
- [ ] HOA block only renders when `hasHoaDetail`
- [ ] Section placed BEFORE the subject photos block (Page 1)

---

## Phase H — Template: PUD / HOA section ⬜

**File:** `src/templates/urar-v2.hbs`  
**Insertion point:** After Improvements section, before photos (Page 1)  
**Guard:** `{{#if hasPudDetail}}`

**Required fields per FNMA PUD requirements:**

```handlebars
{{#if hasPudDetail}}
<div class="section-hdr">PUD Project Analysis (Required — Planned Unit Development)</div>
<div class="row g3">
  <div class="cell"><span class="lbl">Project Name</span><span class="val">{{pudDetail.projectName}}</span></div>
  <div class="cell"><span class="lbl">PUD Type</span><span class="val">{{pudDetail.pudType}}</span></div>
  <div class="cell"><span class="lbl">Total Phases</span><span class="val">{{pudDetail.totalPhases}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Total Units</span><span class="val">{{pudDetail.totalUnits}}</span></div>
  <div class="cell"><span class="lbl">Units Sold</span><span class="val">{{pudDetail.unitsSold}}</span></div>
  <div class="cell"><span class="lbl">Owner Occupancy %</span><span class="val">{{pudDetail.ownerOccupancyPct}}</span></div>
  <div class="cell"><span class="lbl">Rented Units</span><span class="val">{{pudDetail.unitsRented}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Developer Controlled</span><span class="val">{{#if pudDetail.developerControlled}}Yes{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Common Elements Complete</span><span class="val">{{#if pudDetail.commonElementsComplete}}Yes{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Phased Project</span><span class="val">{{#if pudDetail.isPhased}}Yes{{else}}No{{/if}}</span></div>
  <div class="cell"><span class="lbl">Project Complete</span><span class="val">{{#if pudDetail.projectComplete}}Yes{{else}}No{{/if}}</span></div>
</div>
{{#if pudDetail.observedDeficiencies}}
<div class="row" style="border-left:4px solid var(--red)">
  <div class="cell"><span class="lbl" style="color:var(--red)">⚠ Observed Deficiencies in Common Areas</span><span class="val">{{pudDetail.observedDeficienciesDescription}}</span></div>
</div>
{{/if}}
{{#if hasHoaDetail}}
<div class="row g3">
  <div class="cell"><span class="lbl">HOA Fee</span><span class="val">{{pudDetail.hoaFee}} / {{pudDetail.hoaFrequency}}</span></div>
  <div class="cell"><span class="lbl">Management Company</span><span class="val">{{pudDetail.managementCompany}}</span></div>
  <div class="cell"><span class="lbl">Reserve Fund Balance</span><span class="val">{{pudDetail.reserveFundBalance}}</span></div>
</div>
{{/if}}
{{/if}}
```

**Checklist:**
- [ ] Section only renders when `hasPudDetail` is `true`
- [ ] Deficiencies block only renders when `pudDetail.observedDeficiencies`
- [ ] HOA sub-block only renders when `hasHoaDetail`

---

## Phase I — Template: Manufactured home addendum ⬜

**File:** `src/templates/urar-v2.hbs`  
**Insertion point:** After Improvements section (Page 1), before condo/PUD sections  
**Guard:** `{{#if hasManufacturedHome}}`

**Required per FNMA Form 1004C / FHLMC Form 70B:**

```handlebars
{{#if hasManufacturedHome}}
<div class="section-hdr">Manufactured Home Information (Form 1004C — Required)</div>
<div class="row g4">
  <div class="cell">
    <span class="lbl">HUD Data Plate</span>
    <span class="val {{#unless manufacturedHome.hudDataPlatePresent}}" style="color:var(--red);font-weight:700"{{/unless}}">
      {{#if manufacturedHome.hudDataPlatePresent}}Present{{else}}NOT PRESENT ⚠{{/if}}
    </span>
  </div>
  <div class="cell"><span class="lbl">HUD Label Number(s)</span><span class="val">{{manufacturedHome.hudLabelNumbers}}</span></div>
  <div class="cell"><span class="lbl">Manufacturer</span><span class="val">{{manufacturedHome.manufacturer}}</span></div>
  <div class="cell"><span class="lbl">Model</span><span class="val">{{manufacturedHome.model}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Serial Number</span><span class="val">{{manufacturedHome.serialNumber}}</span></div>
  <div class="cell"><span class="lbl">Year Manufactured</span><span class="val">{{manufacturedHome.yearManufactured}}</span></div>
  <div class="cell"><span class="lbl">Width Type</span><span class="val">{{manufacturedHome.widthType}}</span></div>
  <div class="cell"><span class="lbl">Foundation Type</span><span class="val">{{manufacturedHome.foundationType}}</span></div>
</div>
<div class="row g4">
  <div class="cell"><span class="lbl">Invoice Cost</span><span class="val">{{manufacturedHome.invoiceCost}}</span></div>
  <div class="cell"><span class="lbl">Delivery Cost</span><span class="val">{{manufacturedHome.deliveryCost}}</span></div>
  <div class="cell"><span class="lbl">Installation Cost</span><span class="val">{{manufacturedHome.installationCost}}</span></div>
  <div class="cell"><span class="lbl">Total Cost New</span><span class="val" style="font-weight:700">{{manufacturedHome.totalCost}}</span></div>
</div>
{{#if manufacturedHome.factoryBuiltCertification}}
<div class="row">
  <div class="cell"><span class="lbl">Factory-Built Certification</span><span class="val">{{manufacturedHome.factoryBuiltCertification}}</span></div>
</div>
{{/if}}
{{#if manufacturedHome.narrative}}
<div class="row">
  <div class="cell"><span class="lbl">Manufactured Home Comments</span><span class="val">{{manufacturedHome.narrative}}</span></div>
</div>
{{/if}}
{{/if}}
```

**Checklist:**
- [ ] HUD data plate ABSENT shows red warning
- [ ] Total cost computed and shown
- [ ] Factory cert row only if present
- [ ] Narrative row only if present

---

## Phase J — Template: Exterior-only interior field suppression ⬜

**File:** `src/templates/urar-v2.hbs`  
**Location:** Improvements section, Page 1 — interior rows

Interior-specific rows that must show `Not Observed` for Form 2055:
- Interior Finishes (floors, walls)
- Basement finished area
- Heating/cooling detail beyond exterior-observable type
- Kitchen/bath update status (if present)

**Pattern for each interior-specific cell:**

```handlebars
<!-- Before (current): -->
<div class="cell"><span class="lbl">Interior Finishes</span><span class="val">{{subject.interiorFloors}}; {{subject.interiorWalls}}</span></div>

<!-- After: -->
<div class="cell">
  <span class="lbl">Interior Finishes</span>
  <span class="val">
    {{#if isExteriorOnly}}<span style="color:var(--muted);font-style:italic">Not Observed — Exterior-Only Inspection</span>{{else}}{{subject.interiorFloors}}; {{subject.interiorWalls}}{{/if}}
  </span>
</div>
```

**All cells requiring this treatment:**

| Template line (approx) | Field | Suppression reason |
|---|---|---|
| Interior Finishes row | `interiorFloors`, `interiorWalls` | Cannot observe from exterior |
| Condition row | `conditionDescription` | Interior condition not observed |
| Additional Features row | `additionalFeatures` | Interior amenities not observed |
| Basement finished sqft | `basementFinishedSqFt` | Cannot verify from exterior |

**Checklist:**
- [ ] All 4 identified interior rows have `{{#if isExteriorOnly}}` guard
- [ ] "Not Observed" text is styled with `var(--muted)` + italic
- [ ] SFR interior assignment still shows data in all rows (flag is false)

---

## Phase K — Template: Scope statement replacement ⬜

**File:** `src/templates/urar-v2.hbs`  
**Location:** Page 4, Scope of Work `<div>`

**Current (hardcoded — must be replaced):**
```handlebars
Interior and exterior inspection performed {{metadata.inspectionDate}}. Public records searched. MLS sales data reviewed. Sales Comparison{{#if hasCostApproach}}, Cost{{/if}}{{#if hasIncomeApproach}}, and Income Approaches{{else}} Approach{{/if}} developed. Market conditions analyzed per Fannie Mae Market Conditions Addendum guidance.
```

**Replacement:**
```handlebars
{{scopeStatement}}
```

**Checklist:**
- [ ] Hardcoded sentence removed
- [ ] `{{scopeStatement}}` renders correctly for interior (1004)
- [ ] `{{scopeStatement}}` renders correctly for exterior (2055)
- [ ] Approaches list remains grammatically correct

---

## Phase L — Template: Form title / badge conditional ⬜

**File:** `src/templates/urar-v2.hbs`  
**Location:** `.form-title-bar` on each page header, and brand badges

**Current (Page 1, hardcoded):**
```handlebars
<h1>Uniform Residential Appraisal Report &mdash; Form 1004</h1>
<p>File No. {{metadata.orderNumber}} &bull; UAD Edition &bull; Fannie Mae / Freddie Mac Compliant</p>
```

**Replacement:**
```handlebars
<h1>{{gseFormLabel}}</h1>
<p>File No. {{metadata.orderNumber}} &bull; UAD Edition &bull; Fannie Mae / Freddie Mac Compliant</p>
```

Also update the brand-badge on Page 1:
```handlebars
<!-- Current: -->
<span class="brand-badge">Uniform Residential Appraisal Report</span>

<!-- Replace with: -->
<span class="brand-badge">{{gseFormLabel}}</span>
<span class="brand-badge">Form {{gseFormNumber}}</span>
```

**Checklist:**
- [ ] Page 1 title reflects correct form type
- [ ] Brand badge reflects correct form type  
- [ ] Page 2 header (Sales Comparison) unchanged — no form title there
- [ ] Page 3 header unchanged
- [ ] Page 4 certification text still says "UAD 3.6" (unchanged)

---

## Phase M — Template: Addenda checklist conditional ⬜

**File:** `src/templates/urar-v2.hbs`  
**Location:** Page 4, "Addenda Attached" section

**Current (hardcoded):**
```handlebars
<div class="cell" style="font-size:7.5pt;line-height:2">
  &#10003; Market Conditions Addendum (Form 1004MC)<br>
  &#10003; Subject Interior Photographs<br>
  &#10003; Flood Certification<br>
  &#10003; License Certificate &mdash; {{appraiser.name}}
</div>
<div class="cell" style="font-size:7.5pt;line-height:2">
  &#10003; Plat Map<br>
  &#10003; Comparable Location Map<br>
  &#10003; Appraiser Comments &amp; Limiting Conditions<br>
  {{#if hasEA}}&#10003; Extraordinary Assumptions Documentation{{/if}}
</div>
```

**Replacement (conditional items):**
- Form 1004MC: Does not apply to 2055 (no market conditions addendum needed in same way)
- Interior Photographs: Does not apply to 2055
- Manufactured Home Addendum: Add when `isManufactured`
- Condo Project Addendum: Add when `isCondo`

```handlebars
<div class="cell" style="font-size:7.5pt;line-height:2">
  {{#unless isExteriorOnly}}&#10003; Market Conditions Addendum (Form 1004MC)<br>{{/unless}}
  {{#unless isExteriorOnly}}&#10003; Subject Interior Photographs<br>{{/unless}}
  {{#if isExteriorOnly}}&#10003; Exterior Inspection Photographs<br>{{/if}}
  &#10003; Flood Certification<br>
  &#10003; License Certificate &mdash; {{appraiser.name}}
</div>
<div class="cell" style="font-size:7.5pt;line-height:2">
  &#10003; Plat Map<br>
  &#10003; Comparable Location Map<br>
  {{#if isCondo}}&#10003; Condominium Project Analysis (Form 1073)<br>{{/if}}
  {{#if isManufactured}}&#10003; Manufactured Home Addendum (Form 1004C)<br>{{/if}}
  {{#if isPUD}}&#10003; PUD Project Information Addendum<br>{{/if}}
  &#10003; Appraiser Comments &amp; Limiting Conditions<br>
  {{#if hasEA}}&#10003; Extraordinary Assumptions Documentation{{/if}}
</div>
```

**Checklist:**
- [ ] Interior photos and 1004MC hidden for 2055
- [ ] Exterior photos line added for 2055
- [ ] Form 1073 condo addendum listed when `isCondo`
- [ ] Form 1004C manufactured home listed when `isManufactured`
- [ ] PUD addendum listed when `isPUD`

---

## Phase N — Template: Cost approach label binding ⬜

**File:** `src/templates/urar-v2.hbs`  
**Location:** Page 3, cost approach section header

**Current:**
```handlebars
{{#if hasCostApproach}}
<div class="section-hdr">Cost Approach to Value (Not Required by Fannie Mae)</div>
```

**Replacement:**
```handlebars
{{#if hasCostApproach}}
<div class="section-hdr">{{costApproachLabel}}</div>
```

Also add a warning banner when new construction cost data is missing:

```handlebars
{{#if costApproachRequiredWarning}}
<div style="background:#FEE2E2;border:1px solid #FCA5A5;border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:7.5pt;color:var(--red);font-weight:700">
  ⚠ {{costApproachRequiredWarning}}
</div>
{{/if}}
```

**Checklist:**
- [ ] Label is dynamic via `{{costApproachLabel}}`
- [ ] Warning banner renders when `costApproachRequiredWarning` is non-null
- [ ] Standard (non-new-construction) still renders with "Not Required" label

---

## Phase O — Tests ✅

**File:** `src/services/report-engine/field-mappers/__tests__/urar-1004.mapper.test.ts` (new or existing)

Six test scenarios. Each instantiates a minimal `CanonicalReportDocument` and calls `mapper.mapToFieldMap(doc)`.

### O-1: Standard SFR interior (Form 1004) ⬜

```typescript
// Input: reportType: "FORM_1004", propertyType: "SFR", constructionMethod: "SiteBuilt", yearBuilt: 2010
// Assert:
expect(ctx.isCondo).toBe(false);
expect(ctx.isManufactured).toBe(false);
expect(ctx.isPUD).toBe(false);
expect(ctx.isExteriorOnly).toBe(false);
expect(ctx.isNewConstruction).toBe(false);
expect(ctx.gseFormNumber).toBe('1004');
expect(ctx.hasCondoDetail).toBe(false);
expect(ctx.hasPudDetail).toBe(false);
expect(ctx.hasManufacturedHome).toBe(false);
expect(ctx.condoDetail).toBe(null);
expect(ctx.costApproachLabel).toMatch(/Not Required/);
expect(ctx.scopeStatement).toMatch(/Interior and exterior/);
expect(ctx.costApproachRequiredWarning).toBe(null);
```

### O-2: Condo (Form 1073) ⬜

```typescript
// Input: reportType: "FORM_1073", propertyType: "Condo", condoDetail: { projectName: "Sunset Towers", ... }, hoaDetail: { hoaFee: 400, ... }
// Assert:
expect(ctx.isCondo).toBe(true);
expect(ctx.gseFormNumber).toBe('1073');
expect(ctx.hasCondoDetail).toBe(true);
expect(ctx.condoDetail?.projectName).toBe('Sunset Towers');
expect(ctx.condoDetail?.hoaFee).toBe('$400');
expect(ctx.condoDetail?.singleEntityConcentrationFlag).toBe(false); // < 10%
// Re-test with singleEntityOwnershipPct: 15
expect(ctx.condoDetail?.singleEntityConcentrationFlag).toBe(true);
```

### O-3: Manufactured home (Form 1004C) ⬜

```typescript
// Input: reportType: "FORM_1004C", constructionMethod: "Manufactured", manufacturedHome: { manufacturer: "Clayton", ... }
// Assert:
expect(ctx.isManufactured).toBe(true);
expect(ctx.gseFormNumber).toBe('1004C');
expect(ctx.hasManufacturedHome).toBe(true);
expect(ctx.manufacturedHome?.manufacturer).toBe('Clayton');
expect(ctx.manufacturedHome?.totalCost).toMatch(/\$/);
```

### O-4: Exterior-only (Form 2055) ⬜

```typescript
// Input: reportType: "FORM_2055", scopeOfWork: { inspectionType: "Exterior-Only" }
// Assert:
expect(ctx.isExteriorOnly).toBe(true);
expect(ctx.gseFormNumber).toBe('2055');
expect(ctx.scopeStatement).toMatch(/Exterior-only inspection/);
expect(ctx.scopeStatement).not.toMatch(/Interior and exterior/);
```

### O-5: New construction (1004, yearBuilt = current year) ⬜

```typescript
// Input: reportType: "FORM_1004", yearBuilt: new Date().getFullYear()
// Assert:
expect(ctx.isNewConstruction).toBe(true);
expect(ctx.costApproachLabel).toMatch(/Required.*New Construction/);
// When no costApproach data:
expect(ctx.costApproachRequiredWarning).toMatch(/WARNING/);
// When costApproach data present:
expect(ctx.costApproachRequiredWarning).toBe(null);
```

### O-6: PUD overlay ⬜

```typescript
// Input: reportType: "FORM_1004", propertyType: "PUD", pudDetail: { projectName: "Harbor View PUD" }, hoaDetail: { hoaFee: 200, ... }
// Assert:
expect(ctx.isPUD).toBe(true);
expect(ctx.gseFormNumber).toBe('1004'); // PUD doesn't change form number
expect(ctx.hasPudDetail).toBe(true);
expect(ctx.pudDetail?.projectName).toBe('Harbor View PUD');
expect(ctx.pudDetail?.hoaFee).toBe('$200');
```

**Run command:**
```
pnpm vitest run src/services/report-engine/field-mappers/__tests__/urar-1004.mapper.test.ts
```

---

## Phase P — urar-v1.hbs parity pass ✅

`urar-v1.hbs` is in maintenance mode but is still registered as `URAR_1004_V1` in the seed. Once v2 is validated, replicate all conditional sections from v2 to v1 (they share the same mapper context, so no mapper changes needed).

**Checklist:**
- [ ] All Phase G–N changes mirrored in `urar-v1.hbs`
- [ ] v1 still passes existing integration test (if any)

---

## Implementation Order (Recommended)

Execute in dependency order. The mapper phases (A–F) must complete before any template phase can be validated.

```
A (mapper flags) 
  → B (condo builder) + C (PUD builder) + D (manufactured builder) + E (scope) + F (label) [parallel]
  → O-1 test (baseline — verify no regressions)
  → G (condo template section) + I (manufactured template section) [parallel, highest priority — most orders]
  → O-2 test + O-3 test [parallel]
  → H (PUD template)
  → O-6 test
  → J (exterior suppression) + K (scope) + L (form title) + M (addenda) + N (cost label) [parallel]
  → O-4 test + O-5 test [parallel]
  → P (v1 parity)
```

---

## FNMA/FHLMC Guideline References

| Requirement | Guideline |
|---|---|
| Condo project analysis required | FNMA Selling Guide B4-1.4-01; FHLMC Guide 5601.2 |
| PUD project information required | FNMA Selling Guide B4-1.4-02; FHLMC Guide 5601.3 |
| Manufactured home addendum required | FNMA Selling Guide B5-2-02; FHLMC Guide 5601.5 |
| Cost approach required for new construction | FNMA Selling Guide B4-1.3-05 |
| Exterior-only inspection scope (2055) | FNMA Selling Guide B4-1.2-03; FHLMC Guide 5601.1 |
| Single entity concentration (Condo) | FNMA Lender Letter LL-2022-01 (>10% by single entity) |
| Reserve fund adequacy (Condo) | FNMA Lender Letter LL-2021-14 |
| Pending litigation disclosure (Condo) | FNMA Selling Guide B4-2.2-06 |

---

## Definition of Done

All 16 phases marked ✅ and the following verified:

1. `pnpm tsc --noEmit` exits 0 in `appraisal-management-backend`
2. All 6 test scenarios in Phase O pass
3. A Form 1004 order renders without any new section appearing (regression)
4. A Form 1073 order renders with the Condo Project Analysis section populated
5. A Form 1004C order renders with the Manufactured Home Information section populated
6. A Form 2055 order renders with interior fields showing "Not Observed", correct scope statement, and correct form title
7. A PUD order renders with the PUD Project Analysis section populated
8. A new-construction 1004 renders with "Required — New Construction" cost label
9. `urar-v1.hbs` renders all of the above identically
