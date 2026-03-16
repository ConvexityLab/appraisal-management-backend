# UAD 3.6 Full Compliance Implementation Plan

**Date:** 2026-03-14
**Last Updated:** 2026-03-15
**Status:** IN PROGRESS â€” Phases 1-5 Complete, Phase 6 Partial (6A-6C done), Phase 7 Planned
**Objective:** Transform the L1 Valuation Platform from a review/QC tool into a full appraisal authoring + review + QC + delivery platform that is **100% UAD 3.6 / URAR v1.3 compliant** with full platform feature integration (AI Assistant, AVM, Maps, External Data) and competitive with alamode TOTAL.
**Spec Reference:** URAR v1.3 (Fannie Mae / Freddie Mac, March 10, 2026) â€” 43-page form, 27+ sections, 300+ fields
**Compliance Audit:** See `docs/URAR_V1.3_COMPLIANCE_AUDIT.md` for field-level gap analysis

---

## Master Implementation Progress

| Phase | Status | Date Completed | Notes |
|---|---|---|---|
| **Phase 1** â€” Draft CRUD & Subject/Site Forms | âœ… **COMPLETE** | 2026-03-14 | All backend + frontend files created, compiles clean |
| **Phase 2** â€” Core URAR Form Editor | âœ… **COMPLETE** | 2026-03-14 | Improvements, Neighborhood, Contract, Sales Comparison |
| **Phase 3** â€” Three Approaches & Reconciliation | âœ… **COMPLETE** | 2026-03-14 | Cost Approach, Income Approach, HBU 4-Test, Reconciliation |
| **Phase 4** â€” Photos, Certification & Delivery | âœ… **COMPLETE** | 2026-03-14 | PhotoSection, CertificationSection, AddendaSection, DeliverySection (unwired) |
| **Phase 5** â€” Dynamic Forms & Conditional Logic | âœ… **COMPLETE** | 2026-03-14 | urar-form-config.ts (1,306 lines), DynamicFormRenderer, FormTypeSelector |
| **Phase 6A** â€” URAR v1.3 Schema Expansion | âœ… **COMPLETE** | 2026-03-15 | +80 fields, 8 new interfaces, canonical-schema.ts â†’ 1,230 lines |
| **Phase 6B** â€” New Core Sections (4) | âœ… **COMPLETE** | 2026-03-15 | Prior Transfers, Scope of Work, Assignment Conditions, Additional Comments |
| **Phase 6C** â€” Expand Existing Sections | âœ… **COMPLETE** | 2026-03-15 | Neighborhood market analysis (14 fields), Comp grid (11 descriptor + 8 adjustment fields) |
| **Phase 7A** â€” Missing Section Components (10) | â¬œ Not Started | â€” | Disaster Mitigation, Energy/Green, Mfg Home, Func Obsolescence, Outbuilding, Vehicle Storage, Amenities, Q&C, Listing Info, Defects |
| **Phase 7B** â€” Expand All Existing Sections (~100+ fields) | â¬œ Not Started | â€” | Subject, Site, Improvements split, Contract, Market, Project Info, Cost, Reconciliation, Cert |
| **Phase 7C** â€” Comp Grid v1.3 Full Expansion (~70+ fields) | â¬œ Not Started | â€” | 100+ fields per comp, per-feature Q/C, amenities, "Not Used" table |
| **Phase 7D** â€” Wire Platform Features Into Form | â¬œ Not Started | â€” | AI Assistant context, AVM panel, Maps embed, External data auto-fill |
| **Phase 7E** â€” Backend Pipeline Alignment | â¬œ Not Started | â€” | uad-3.6.ts, mapper, validation, MISMO XML for all new sections |
| **Phase 7F** â€” Breaking Changes Migration | â¬œ Not Started | â€” | bathrooms split, garageâ†’VehicleStorage, Q/C per-feature, Improvements split |
| **Phase 7G** â€” Rental Information + Revision History | â¬œ Not Started | â€” | Rental schedule (Form 1025), Revision/Reconsideration tracking |

### Phase 1 Deliverables (Completed 2026-03-14)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| Draft types | `src/types/appraisal-draft.types.ts` | Backend | âœ… Clean |
| Draft CRUD service | `src/services/appraisal-draft.service.ts` | Backend | âœ… Clean |
| Draft REST controller | `src/controllers/appraisal-draft.controller.ts` | Backend | âœ… Clean |
| Cosmos container registered | `src/services/cosmos-db.service.ts` (modified) | Backend | âœ… Clean |
| Route mounted | `src/api/api-server.ts` (modified) | Backend | âœ… Clean |
| Frontend draft types | `src/types/appraisal-draft.types.ts` | Frontend | âœ… Clean |
| Redux draft slice | `src/store/slices/draftSlice.ts` | Frontend | âœ… Clean |
| RTK Query API | `src/store/api/appraisalDraftApi.ts` | Frontend | âœ… Clean |
| rootReducer updated | `src/store/rootReducer.ts` (modified) | Frontend | âœ… Clean |
| baseApi tag added | `src/store/api/baseApi.ts` (modified) | Frontend | âœ… Clean |
| FormField component | `src/components/appraisal-form/FormField.tsx` | Frontend | âœ… Clean |
| Auto-save hook | `src/components/appraisal-form/useAutoSave.ts` | Frontend | âœ… Clean |
| Form shell | `src/components/appraisal-form/AppraisalFormShell.tsx` | Frontend | âœ… Clean |
| Subject section | `src/components/appraisal-form/sections/SubjectSection.tsx` | Frontend | âœ… Clean |
| Site section | `src/components/appraisal-form/sections/SiteSection.tsx` | Frontend | âœ… Clean |

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [UAD 3.6 Requirements Matrix](#2-uad-36-requirements-matrix)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Phase 1: Foundation â€” Draft CRUD & Subject Form (Weeks 1-3)](#phase-1)
5. [Phase 2: Core URAR Form Editor (Weeks 4-8)](#phase-2)
6. [Phase 3: Three Approaches & Reconciliation (Weeks 9-12)](#phase-3)
7. [Phase 4: Photos, Certification & Delivery (Weeks 13-16)](#phase-4)
8. [Phase 5: Dynamic Forms & Conditional Logic (Weeks 17-19)](#phase-5)
9. [Phase 6: Competitive Differentiators (Weeks 20-26)](#phase-6)
10. [Type System Bridge Design](#type-system-bridge)
11. [Testing Strategy](#testing-strategy)
12. [Risk Register](#risk-register)### Phase 2 Deliverables (Completed 2026-03-14)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| draftSlice new reducers | `src/store/slices/draftSlice.ts` (modified) | Frontend | âœ… Clean |
| Improvements section | `src/components/appraisal-form/sections/ImprovementsSection.tsx` | Frontend | âœ… Clean |
| Neighborhood section | `src/components/appraisal-form/sections/NeighborhoodSection.tsx` | Frontend | âœ… Clean |
| Contract section | `src/components/appraisal-form/sections/ContractSection.tsx` | Frontend | âœ… Clean |
| Sales Comparison section | `src/components/appraisal-form/sections/SalesComparisonSection.tsx` | Frontend | âœ… Clean |
| FormShell updated | `src/components/appraisal-form/AppraisalFormShell.tsx` (modified) | Frontend | âœ… Clean |

### Phase 3 Deliverables (Completed 2026-03-14)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| HBU section ID added | `src/types/appraisal-draft.types.ts` (both repos) | Both | âœ… Clean |
| HBU in SECTION_FIELD_MAP | `src/services/appraisal-draft.service.ts` (modified) | Backend | âœ… Clean |
| draftSlice Phase 3 reducers | `src/store/slices/draftSlice.ts` (modified) | Frontend | âœ… Clean |
| Cost Approach section | `src/components/appraisal-form/sections/CostApproachSection.tsx` | Frontend | âœ… Clean |
| Income Approach section | `src/components/appraisal-form/sections/IncomeApproachSection.tsx` | Frontend | âœ… Clean |
| HBU (4-Test) section | `src/components/appraisal-form/sections/HbuSection.tsx` | Frontend | âœ… Clean |
| Reconciliation section | `src/components/appraisal-form/sections/ReconciliationSection.tsx` | Frontend | âœ… Clean |
| FormShell updated | `src/components/appraisal-form/AppraisalFormShell.tsx` (modified) | Frontend | âœ… Clean |

**Phase 3 highlights:**
- **CostApproachSection** (~290 lines): Land value, RCN with soft costs/profit/site improvements, 4-part depreciation breakdown, auto-calculated depreciated cost & indicated value, age-life helper
- **IncomeApproachSection** (~290 lines): GRM approach with auto-calc, Direct Capitalization (PGI â†’ EGI â†’ NOI â†’ cap value), optional DCF, approach comparison spread
- **HbuSection** (~240 lines): Two-panel (As Vacant / As Improved), 4 sequential tests each with pass/fail + narrative + evidence, conclusion with current-use check
- **ReconciliationSection** (~310 lines): Approach values with spread indicator, weight validation (sum to 1.0), weighted value auto-calc, FNMA 15% spread warning, extraordinary assumptions & hypothetical conditions lists, confidence score

### Phase 4 Deliverables (Completed 2026-03-14)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| Photo section | `src/components/appraisal-form/sections/PhotoSection.tsx` (342 lines) | Frontend | âœ… Clean |
| Certification section | `src/components/appraisal-form/sections/CertificationSection.tsx` (345 lines) | Frontend | âœ… Clean |
| Addenda section | `src/components/appraisal-form/sections/AddendaSection.tsx` (303 lines) | Frontend | âœ… Clean |
| Delivery section | `src/components/appraisal-form/sections/DeliverySection.tsx` (327 lines) | Frontend | âš ï¸ Created but NOT wired into FormShell |

### Phase 5 Deliverables (Completed 2026-03-14)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| Form config registry | `src/components/appraisal-form/urar-form-config.ts` (1,306 lines) | Frontend | âœ… Clean |
| Dynamic renderer | `src/components/appraisal-form/DynamicFormRenderer.tsx` | Frontend | âœ… Clean |
| Form type selector | `src/components/appraisal-form/FormTypeSelector.tsx` | Frontend | âœ… Clean |
| 17 section configs | 17 const objects in urar-form-config.ts | Frontend | âœ… Clean |

### Phase 6A Deliverables (Completed 2026-03-15) â€” URAR v1.3 Schema Expansion

| Deliverable | File | Repo | Status |
|---|---|---|---|
| +80 new fields on canonical schema | `src/types/canonical-schema.ts` (890 â†’ 1,230 lines) | Both | âœ… Clean |
| 8 new interfaces added | CanonicalCondoDetail, CanonicalPudDetail, CanonicalHoaDetail, + 5 more | Both | âœ… Clean |
| `bathsFull` / `bathsHalf` added | CanonicalPropertyCore | Both | âœ… Clean |
| `constructionMethod`, `attachmentType`, `structureDesign` | CanonicalPropertyCore | Both | âœ… Clean |
| Gross area fields, remaining economic life | CanonicalPropertyCore | Both | âœ… Clean |
| Backend uad-3.6.ts updated | `src/types/uad-3.6.ts` | Backend | âœ… Clean |
| `tsc --noEmit` both repos | â€” | Both | âœ… 0 errors |

### Phase 6B Deliverables (Completed 2026-03-15) â€” New Core Sections (4)

| Deliverable | File | Repo | Status |
|---|---|---|---|
| 4 new interfaces in canonical-schema | CanonicalPriorTransfer, CanonicalScopeOfWork, CanonicalAssignmentConditions, CanonicalAdditionalComment | Both | âœ… Clean |
| 4 new fields on CanonicalReportDocument | `priorTransfers`, `scopeOfWork`, `assignmentConditions`, `additionalComments` | Both | âœ… Clean |
| 4 new DRAFT_SECTION_IDS | `prior-transfers`, `scope-of-work`, `assignment-conditions`, `additional-comments` | Frontend | âœ… Clean |
| 4 new SECTION_META entries | With icons and labels | Frontend | âœ… Clean |
| 4 new draftSlice reducers | `updateDraftPriorTransfers/ScopeOfWork/AssignmentConditions/AdditionalComments` | Frontend | âœ… Clean |
| 4 new draftSlice selectors | `selectDraftPriorTransfers/ScopeOfWork/AssignmentConditions/AdditionalComments` | Frontend | âœ… Clean |
| 5 new urar-form-config sections | priorTransfers, scopeOfWork (with fieldGroups), assignmentConditions, additionalComments | Frontend | âœ… Clean |
| PriorTransfersSection.tsx | ~245 lines â€” card-based transfer records, add/remove, 3-col grid | Frontend | âœ… Clean |
| ScopeOfWorkSection.tsx | ~255 lines â€” chip toggles for data sources/approaches, narrative with char count | Frontend | âœ… Clean |
| AssignmentConditionsSection.tsx | ~242 lines â€” reusable ListEditor sub-component, dropdown presets | Frontend | âœ… Clean |
| AdditionalCommentsSection.tsx | ~161 lines â€” card-based comment blocks with section reference | Frontend | âœ… Clean |
| AppraisalFormShell.tsx updated | 4 new imports + 4 new switch cases | Frontend | âœ… Clean |

### Phase 6C Deliverables (Completed 2026-03-15) â€” Expand Existing Sections

| Deliverable | File | Repo | Status |
|---|---|---|---|
| 14 new CanonicalNeighborhood fields | predominantPrice, ageRange, housing supply, absorption, median stats, price trends, comparable activity | Both | âœ… Clean |
| NeighborhoodSection.tsx expanded | 309 â†’ 411 lines â€” 4 new field groups (Market Analysis, Housing Supply, Price/DOM Stats, Comparable Activity) | Frontend | âœ… Clean |
| 9 new CanonicalComp descriptor fields | viewQuality, viewType, belowGradeFinishedSqFt, belowGradeUnfinishedSqFt, fireplaceCount, hasPool, fencing (constructionMethod/attachmentType/foundationType inherited from PropertyCore) | Both | âœ… Clean |
| 8 new CanonicalAdjustments fields | constructionMethodAdj, attachmentTypeAdj, viewImpactAdj, foundationAdj, belowGradeAdj, fireplaceAdj, poolAdj, fencingAdj | Both | âœ… Clean |
| SalesComparisonSection.tsx expanded | +9 DESCRIPTOR_ROWS + 8 ADJUSTMENT_ROWS for v1.3 comp fields | Frontend | âœ… Clean |
| `tsc --noEmit` both repos | â€” | Both | âœ… 0 errors |

---

### Current State Summary (Post-Phase 6C)

**Frontend:** 18 section components (17 wired), canonical-schema 1,230 lines, ~45% URAR v1.3 coverage
**Backend:** canonical-schema synced, uad-3.6.ts (837 lines), mapper (794 lines), validation (735 lines), MISMO XML (601 lines)

### What We Have (~45% URAR v1.3 Complete)

| Layer | Component | Status | Location |
|---|---|---|---|
| **Data Model** | `CanonicalReportDocument` (1,230 lines) | âœ… Complete | `src/types/canonical-schema.ts` (both repos) |
| **Data Model** | UAD 3.6 type system (837 lines) | âœ… Complete | `backend: src/types/uad-3.6.ts` |
| **Data Model** | `CanonicalAdjustments` (19 UAD line items) | âœ… Complete | `canonical-schema.ts` |
| **Data Model** | `CanonicalCostApproach` | âœ… Types exist | `canonical-schema.ts` (no UI) |
| **Data Model** | `CanonicalIncomeApproach` | âœ… Types exist | `canonical-schema.ts` (no UI) |
| **Data Model** | `HighestAndBestUse` (4-test) | âœ… Types exist | `canonical-schema.ts` (no UI) |
| **Data Model** | `CanonicalNeighborhood` | âœ… Types exist | `canonical-schema.ts` (no UI) |
| **Data Model** | `CanonicalAppraiserInfo` | âœ… Types exist | `canonical-schema.ts` (no UI) |
| **Data Model** | `AppraisalFormType` enum (12 form types) | âœ… Complete | `backend: src/types/template.types.ts` |
| **Backend** | UAD validation service (735 lines) | âœ… Complete | `backend: src/services/uad-validation.service.ts` |
| **Backend** | MISMO 3.4 XML generator (459 lines) | âœ… Complete | `backend: src/services/mismo-xml-generator.service.ts` |
| **Backend** | UCDP/EAD submission service | âœ… Scaffolded | `backend: src/services/ucdp-ead-submission.service.ts` |
| **Backend** | PDF generation (AcroForm + HTML render) | âœ… Complete | `backend: src/services/report-engine/` |
| **Backend** | URAR field mappers (603 lines) | âœ… Complete | `backend: src/services/report-engine/field-mappers/` |
| **Backend** | URAR Handlebars templates | âœ… Complete | `backend: src/templates/urar-v1.hbs`, `urar-v2.hbs` |
| **Backend** | Comp search + AI adjustment engine | âœ… Complete | `backend: src/services/valuation-engine.service.ts` |
| **Backend** | UAD REST controller | âœ… Complete | `backend: src/controllers/uad.controller.ts` |
| **Frontend** | Comp Workspace (map, grid, adjustments) | âœ… Complete | `src/components/comp-workspace/` |
| **Frontend** | Redux slices (comps, adjustments, report) | âœ… Complete | `src/store/slices/` |
| **Frontend** | Report Package Composer | âœ… Complete | `src/components/report-builder/` |
| **Frontend** | `UrarFieldEditor` (3 fields only) | âš ï¸ Minimal | `src/components/report-builder/UrarFieldEditor.tsx` |
| **Frontend** | Photo upload to Blob | âœ… Basic | `src/components/photos/` |
| **Frontend** | Order lifecycle (8 order types) | âœ… Complete | `src/types/order-schema.ts` |
| **Infra** | Cosmos DB (reporting container) | âœ… Ready | Cloud-native, partitioned |
| **Infra** | Service Bus event pipeline | âœ… Ready | Auto-triggers on status changes |

### What's Missing (The Gap)

| Gap | Severity | Description |
|---|---|---|
| **Full URAR form editor** | ðŸŸ¡ In Progress | Subject + Site + Improvements + Neighborhood + Contract + Sales Comparison complete; ~100 fields remaining |
| **Appraisal draft CRUD** | âœ… Resolved | Draft service + controller + Cosmos container (Phase 1) |
| **Canonical â†’ UAD type bridge** | ðŸ”´ Critical | Two disconnected type trees; XML gen uses `UadAppraisalReport`, rest uses `CanonicalReportDocument` |
| **Dynamic form behavior** | ðŸŸ¡ Important | UAD 3.6 fields appear/disappear based on property/appraisal type |
| **Photo captioning** | ðŸŸ¡ Important | URAR requires labeled photo slots (front/rear/street/interior/comp) |
| **Appraiser certification & e-sign** | ðŸŸ¡ Important | Checkbox certification + signature capture |
| **Cost approach form** | ðŸŸ¡ Important | Types exist, no UI |
| **Income approach form** | ðŸŸ¡ Important | Types exist, no UI |
| **Neighborhood data entry** | ðŸŸ¡ Important | Types exist, no UI |
| **H&BU entry form** | ðŸŸ¡ Important | 4-test framework types exist, no UI |
| **Sketch / floor plan** | ðŸŸ¢ Deferrable | Integrate third-party; don't build from scratch |
| **Real UCDP/EAD API client** | ðŸŸ¢ Deferrable | Pluggable transport exists; needs real GSE client |
| **SSR feedback display** | ðŸŸ¢ Deferrable | Backend tracks findings; no frontend view |
| **Offline/PWA** | ðŸŸ¢ Future | Not needed for MVP |

---

## 2. UAD 3.6 Requirements Matrix

UAD 3.6 introduced **dynamic forms** replacing static paper forms. Key requirements:

### 2.1 Form Sections (URAR / Form 1004)

| Section | URAR Page | Fields | Our Schema Coverage | UI Coverage |
|---|---|---|---|---|
| **Subject** | Page 1 top | ~25 fields | âœ… `CanonicalSubject` | âœ… Phase 1 |
| **Contract** | Page 1 | ~5 fields | âœ… `CanonicalContractInfo` | âœ… Phase 2 |
| **Neighborhood** | Page 1 | ~15 fields | âœ… `CanonicalNeighborhood` | âœ… Phase 2 |
| **Site** | Page 1 | ~20 fields | âœ… Spread across `CanonicalSubject` + `CanonicalPropertyCore` | âœ… Phase 1 |
| **Improvements** | Page 1 | ~40 fields | âœ… `CanonicalPropertyCore` | âœ… Phase 2 |
| **Sales Comparison** | Page 2 | 6 comps Ã— 25+ rows | âœ… `CanonicalComp` + `CanonicalAdjustments` | âœ… Phase 2 (URAR grid) |
| **Cost Approach** | Page 2 | ~20 fields | âœ… `CanonicalCostApproach` | âŒ None |
| **Income Approach** | Page 2 | ~15 fields | âœ… `CanonicalIncomeApproach` | âŒ None |
| **PUD/Condo** | Page 2 (conditional) | ~15 fields | âš ï¸ Partial | âŒ None |
| **Reconciliation** | Page 3 | ~15 fields | âœ… `CanonicalReconciliation` | âš ï¸ 3 fields only |
| **Appraiser Cert** | Page 3 | ~10 fields + sig | âœ… `CanonicalAppraiserInfo` | âŒ None |
| **Photos** | Addendum | 6+ labeled photos | âœ… `ReportPhotoAsset` types | âš ï¸ Upload only |
| **Sketch** | Addendum | Floor plan + GLA | âŒ No schema | âŒ None |
| **Addenda** | Addendum | Narrative text | âš ï¸ Basic narrative | âš ï¸ Basic |

### 2.2 UAD 3.6 Dynamic Behavior Requirements

| Rule | Description | Implementation |
|---|---|---|
| **Property Type Gating** | Condo â†’ show HOA/project fields; PUD â†’ show PUD section; Manufactured â†’ show HUD fields | Form section visibility config keyed by `propertyType` |
| **Appraisal Type Gating** | Purchase â†’ show contract section; Refinance â†’ hide contract; Construction â†’ show proposed fields | Form section visibility config keyed by `appraisalType` |
| **Approach Relevance** | Income approach required for 1025; optional for 1004 | Approach tab enable/disable by `reportType` |
| **Conditional Fields** | If `basement === 'None'` â†’ hide `basementFinishedSqFt`; if `pool === false` â†’ hide pool details | Per-field visibility rules in form config |
| **Value Type Gating** | AS_IS shows current condition; PROSPECTIVE shows proposed improvements | Section labeling + field enable by `valueTypes[]` |
| **Validation Context** | Different required-field sets per form type + property type | Validation rule sets keyed by `(reportType, propertyType)` |

### 2.3 MISMO 3.4 / Submission Requirements

| Requirement | Status | Gap |
|---|---|---|
| Generate MISMO 3.4 XML from report data | âœ… `MismoXmlGenerator` | Needs Canonical â†’ UAD bridge |
| Validate against UAD 3.6 rules before submission | âœ… `UadValidationService` | Complete |
| Submit to UCDP (Fannie Mae) | âš ï¸ Scaffolded | Needs real API client |
| Submit to EAD (Freddie Mac) | âš ï¸ Scaffolded | Needs real API client |
| Parse SSR (Submission Summary Report) | âœ… Backend | Needs UI display |
| Resubmit after corrections | âš ï¸ Scaffolded | Needs UI workflow |

---

## 3. Architecture Decisions

### AD-1: Appraisal Draft as First-Class Entity

**Decision:** Create a new `appraisal-drafts` Cosmos container (partition key: `/orderId`) that stores in-progress appraisal work. Separate from the `reporting` container which holds finalized reports.

**Draft Lifecycle:**
```
CREATE (from order) â†’ EDITING â†’ SECTION_COMPLETE â†’ VALIDATION_PASSED â†’ FINALIZED â†’ SUBMITTED
```

**Rationale:** Appraisers need auto-save, section-level persistence, and the ability to work on a report over days/weeks. The `reporting` container stores finalized output; mixing draft state there would pollute it.

### AD-2: Canonical Schema is the Authoring Schema

**Decision:** The appraiser fills data directly into `CanonicalReportDocument` shape. We do NOT create a separate "form state" schema. The canonical schema already mirrors URAR layout.

**Rationale:** The schema was designed for this (`"Field names match FNMA UAD 3.6 / MISMO 3.4"`, `"Sections mirror the URAR form layout so populating the form is a direct read"`). Adding another schema would create a third type tree to maintain.

### AD-3: Canonical â†’ UAD Mapper (Not Duplication)

**Decision:** Build a `CanonicalToUadMapper` service that transforms `CanonicalReportDocument` â†’ `UadAppraisalReport` for XML generation. One-directional. The mapper lives in the backend.

**Rationale:** MISMO XML generation requires `UadAppraisalReport` types (enums, specific structure). Rather than rewriting the XML generator, bridge the gap with a well-tested mapper.

### AD-4: Form Configuration as Data

**Decision:** Define URAR form sections, fields, visibility rules, and validation as a declarative JSON/TS config. The form renderer reads this config to dynamically show/hide sections.

```typescript
// Example form config structure
interface FormSectionConfig {
  id: string;                    // 'subject' | 'site' | 'improvements' | ...
  label: string;                 // 'Subject Property'
  urarPage: number;              // 1, 2, or 3
  fields: FormFieldConfig[];
  visibleWhen?: FormVisibilityRule[];
  requiredForFormTypes: AppraisalFormType[];
}

interface FormFieldConfig {
  fieldPath: string;             // 'subject.address.streetAddress'
  label: string;                 // 'Street Address'
  inputType: 'text' | 'number' | 'select' | 'radio' | 'textarea' | 'date' | 'checkbox';
  options?: { value: string; label: string }[];  // for select/radio
  required: boolean;
  visibleWhen?: FormVisibilityRule[];
  validationRules?: ValidationRule[];
  uadField?: string;             // UAD 3.6 field name for MISMO mapping
  helpText?: string;             // Inline guidance
}

interface FormVisibilityRule {
  fieldPath: string;             // path to evaluate
  operator: 'eq' | 'neq' | 'in' | 'notIn' | 'exists' | 'gt' | 'lt';
  value: unknown;
}
```

**Rationale:** Declarative config means: (a) form changes don't require component rewrites, (b) supports multiple form types (1004, 1073, 1025, 2055) from the same renderer, (c) testable without UI rendering.

### AD-5: Section-Level Auto-Save

**Decision:** Each form section auto-saves independently via PATCH to `/api/appraisal-drafts/:draftId/sections/:sectionId`. Debounced at 3 seconds.

**Rationale:** Appraisers expect their work to survive browser crashes. Section-level saves are cheaper than full-document saves and enable progress tracking.

### AD-6: Frontend State â€” New `draftSlice`

**Decision:** Add a new Redux slice `draftSlice` that holds the in-progress `CanonicalReportDocument`. The existing `compsSlice`, `adjustmentsSlice`, and `reportSlice` continue to work but sync bidirectionally with `draftSlice` when in authoring mode.

**Rationale:** Existing slices handle comp workspace well. The draft slice adds subject, site, improvements, neighborhood, approaches, and reconciliation state.

---

## Phase 1: Foundation â€” Draft CRUD & Subject Form {#phase-1}

**Duration:** Weeks 1-3
**Goal:** An appraiser can create a new appraisal draft from an order and fill in subject property + site data.

### 1.1 Backend: Appraisal Draft Service

**Files to create:**
- `backend: src/types/appraisal-draft.types.ts` â€” Draft entity, section status, lifecycle
- `backend: src/services/appraisal-draft.service.ts` â€” CRUD + section save + auto-save
- `backend: src/controllers/appraisal-draft.controller.ts` â€” REST endpoints

**Draft Entity:**
```typescript
interface AppraisalDraft {
  id: string;                          // Cosmos doc ID
  orderId: string;                     // FK â†’ orders
  reportType: AppraisalFormType;       // FORM_1004, FORM_1073, etc.
  status: DraftStatus;                 // CREATED | EDITING | VALIDATING | FINALIZED
  reportDocument: CanonicalReportDocument;  // The actual data being authored
  sectionStatus: Record<string, SectionStatus>;  // Per-section completion tracking
  validationResult?: UadValidationResult;   // Last validation run
  createdAt: string;
  updatedAt: string;
  createdBy: string;                   // appraiser userId
  lastEditedBy: string;
  autoSavedAt: string | null;
  version: number;                     // Optimistic concurrency
}

type DraftStatus = 'CREATED' | 'EDITING' | 'VALIDATING' | 'FINALIZED' | 'SUBMITTED';
type SectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'HAS_ERRORS';
```

**API Endpoints:**
| Method | Route | Description |
|---|---|---|
| POST | `/api/appraisal-drafts` | Create draft from order (auto-populates from order data) |
| GET | `/api/appraisal-drafts/:id` | Load draft |
| GET | `/api/appraisal-drafts/order/:orderId` | Get drafts for an order |
| PATCH | `/api/appraisal-drafts/:id/sections/:sectionId` | Save a single section |
| PATCH | `/api/appraisal-drafts/:id` | Full document save |
| POST | `/api/appraisal-drafts/:id/validate` | Run UAD validation |
| POST | `/api/appraisal-drafts/:id/finalize` | Finalize â†’ moves to `reporting` container |
| DELETE | `/api/appraisal-drafts/:id` | Discard draft |

**Section IDs:** `subject`, `contract`, `neighborhood`, `site`, `improvements`, `sales-comparison`, `cost-approach`, `income-approach`, `reconciliation`, `certification`, `photos`, `addenda`

### 1.2 Frontend: Draft Slice & API Client

**Files to create:**
- `src/store/slices/draftSlice.ts` â€” Redux slice for `AppraisalDraft`
- `src/services/appraisal-draft.api.ts` â€” RTK Query / fetch wrapper for draft endpoints
- `src/types/appraisal-draft.types.ts` â€” Frontend draft types (shared subset)

**Draft Slice Shape:**
```typescript
interface DraftState {
  currentDraft: AppraisalDraft | null;
  isDirty: boolean;
  lastSavedAt: string | null;
  savingSection: string | null;          // which section is currently saving
  sectionErrors: Record<string, string[]>;  // per-section validation errors
  autoSaveEnabled: boolean;
}
```

### 1.3 Frontend: Subject Property Form

**Files to create:**
- `src/components/appraisal-form/AppraisalFormShell.tsx` â€” Tab/page navigation shell
- `src/components/appraisal-form/sections/SubjectSection.tsx` â€” Subject info form
- `src/components/appraisal-form/sections/SiteSection.tsx` â€” Site characteristics form
- `src/components/appraisal-form/FormField.tsx` â€” Reusable controlled field component
- `src/components/appraisal-form/useAutoSave.ts` â€” Auto-save hook (3s debounce)
- `src/components/appraisal-form/useSectionValidation.ts` â€” Per-section validation hook

**Subject Section Fields (from `CanonicalSubject`):**
- Address block: streetAddress, unit, city, state, zipCode, county
- Identification: parcelNumber, censusTract, mapReference
- Ownership: currentOwner, occupant (Owner/Tenant/Vacant)
- Legal: legalDescription
- Tax: taxYear, annualTaxes

**Site Section Fields (from `CanonicalSubject` + `CanonicalPropertyCore`):**
- Lot: lotSizeSqFt, siteAreaUnit, siteDimensions, siteShape
- Zoning: zoning, zoningCompliance, zoningDescription
- H&BU: highestAndBestUse (simple), highestAndBestUseAnalysis (full 4-test â€” Phase 3)
- Flood: floodZone, floodMapNumber, floodMapDate
- Utilities: electricity, gas, water, sewer
- View: view, viewDescription, locationRating

### 1.4 Form Field Component Design

```typescript
// FormField.tsx â€” renders the appropriate input based on config
interface FormFieldProps {
  fieldPath: string;           // dot-notation path into CanonicalReportDocument
  label: string;
  inputType: 'text' | 'number' | 'select' | 'radio' | 'textarea' | 'date' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  helpText?: string;
  disabled?: boolean;
  error?: string;
  // Value read/write from draftSlice via fieldPath
}
```

### 1.5 Test Cases (Phase 1)

| Test | Type | Description |
|---|---|---|
| `draft-service.create` | Integration | Create draft from order, verify auto-population of subject from order data |
| `draft-service.section-save` | Integration | Save subject section, verify Cosmos persistence |
| `draft-service.optimistic-concurrency` | Integration | Two concurrent saves, verify version conflict detection |
| `SubjectSection.render` | Component | Renders all subject fields from draft state |
| `SubjectSection.validation` | Component | Shows errors for required fields when empty |
| `useAutoSave.debounce` | Hook | Debounces saves at 3s, coalesces rapid changes |
| `draftSlice.update-field` | Unit | `updateField('subject.address.city', 'Austin')` â†’ updates nested state |

---

## Phase 2: Core URAR Form Editor {#phase-2}

**Duration:** Weeks 4-8
**Goal:** Complete form editor covering Improvements, Neighborhood, and the full Sales Comparison grid with subject-comp side-by-side view.

### 2.1 Improvements Section

**File:** `src/components/appraisal-form/sections/ImprovementsSection.tsx`

**Fields (from `CanonicalPropertyCore`):**
- General: propertyType, design, yearBuilt, effectiveAge, stories
- Quality/Condition: quality (Q1-Q6 dropdown), condition (C1-C6 dropdown), conditionDescription
- Exterior: foundationType, exteriorWalls, roofSurface, gutters, windowType
- Interior: interiorFloors, interiorWalls, trimFinish, bathFloor, bathWainscot
- Rooms: totalRooms, bedrooms, bathrooms, grossLivingArea
- Basement: basement, basementSqFt, basementFinishedSqFt
- Systems: heating, heatingFuel, cooling, fireplaces
- Garage: garageType, garageSpaces, carportSpaces, drivewaySurface
- Other: pool, attic, porchPatioDeck, additionalFeatures, screens, stormWindows

**Conditional visibility example:**
- If `basement === 'None'` â†’ hide basementSqFt, basementFinishedSqFt
- If `pool === false` â†’ hide pool details
- If `garageType === 'None'` â†’ hide garageSpaces

### 2.2 Neighborhood Section

**File:** `src/components/appraisal-form/sections/NeighborhoodSection.tsx`

**Fields (from `CanonicalNeighborhood`):**
- Characteristics: locationType, builtUp, growth, propertyValues, demandSupply, marketingTime
- Occupancy: predominantOccupancy
- Price: singleFamilyPriceRange (low, high), predominantAge
- Land Use: presentLandUse (singleFamily%, multifamily%, commercial%, other%)
- Narrative: boundaryDescription, neighborhoodDescription, marketConditionsNotes

### 2.3 Contract Section

**File:** `src/components/appraisal-form/sections/ContractSection.tsx`

**Fields (from `CanonicalContractInfo`):**
- contractPrice, contractDate, propertyRightsAppraised, financingConcessions, isPropertySeller

**Visibility rule:** Only visible when appraisal type is Purchase.

### 2.4 Sales Comparison Grid (URAR Layout)

**File:** `src/components/appraisal-form/sections/SalesComparisonSection.tsx`

This integrates with the existing Comp Workspace but adds the URAR-format side-by-side view:

```
| Feature          | Subject | Comp 1  | Comp 2  | Comp 3  | Comp 4  | Comp 5  | Comp 6  |
|------------------|---------|---------|---------|---------|---------|---------|---------|
| Address          |  -----  | 123 Oak | 456 Elm | 789 Pine| ...     | ...     | ...     |
| Proximity        |         | 0.5 mi  | 1.2 mi  | 0.8 mi  |         |         |         |
| Sale Price       |         | $425K   | $440K   | $410K   |         |         |         |
| Price/SF         |         | $212    | $220    | $205    |         |         |         |
| Data Source       |         | MLS     | MLS     | MLS     |         |         |         |
| --- Adjustments ---|---------|---------|---------|---------|---------|---------|---------|
| Sale/Financing   |         |   $0    |   $0    | -$5,000 |         |         |         |
| Date of Sale     |         | +$3,000 |   $0    | +$2,000 |         |         |         |
| Location         |         |   $0    | -$5,000 |   $0    |         |         |         |
| ...19 rows...    |         |         |         |         |         |         |         |
| Net Adjustment   |         | +$8,000 | -$12,000| +$5,000 |         |         |         |
| Adjusted Price   |         | $433K   | $428K   | $415K   |         |         |         |
```

**Integration with existing slices:**
- `compsSlice` continues to manage comp selection/ordering
- `adjustmentsSlice` continues to manage adjustment values
- `SalesComparisonSection` reads from both slices + provides inline editing
- "Open Comp Workspace" button opens the full comp workspace for search/discovery

### 2.5 Form Navigation Shell

**File:** `src/components/appraisal-form/AppraisalFormShell.tsx`

Tabbed/wizard navigation with section completion indicators:

```
[Subject âœ…] [Contract â¬œ] [Neighborhood ðŸ”µ] [Site âœ…] [Improvements ðŸ”µ]
[Sales Comparison â¬œ] [Cost Approach â¬œ] [Income Approach â¬œ]
[Reconciliation â¬œ] [Certification â¬œ] [Photos â¬œ] [Addenda â¬œ]
```

- âœ… = Complete (all required fields filled, validation passed)
- ðŸ”µ = In Progress (some fields filled)
- â¬œ = Not Started
- ðŸ”´ = Has Errors

Status reads from `draft.sectionStatus`.

### 2.6 Test Cases (Phase 2)

| Test | Type | Description |
|---|---|---|
| `ImprovementsSection.conditional-visibility` | Component | Basement fields hidden when basement='None' |
| `NeighborhoodSection.land-use-sum` | Component | Land use percentages must sum to 100% |
| `SalesComparisonSection.grid-render` | Component | Renders subject + 6 comp columns from slices |
| `SalesComparisonSection.inline-adjustment` | Component | Typing in adjustment cell â†’ updates adjustmentsSlice |
| `AppraisalFormShell.section-status` | Component | Shows correct status icons based on sectionStatus |
| `FormField.select` | Component | Renders select with UAD enum options (Q1-Q6, C1-C6) |

---

## Phase 3: Three Approaches & Reconciliation {#phase-3}

**Duration:** Weeks 9-12
**Goal:** Complete Cost Approach, Income Approach, H&BU, and Reconciliation forms.

### 3.1 Cost Approach Form

**File:** `src/components/appraisal-form/sections/CostApproachSection.tsx`

**Fields (from `CanonicalCostApproach`):**
- Land: estimatedLandValue, landValueSource, landValueMethod, landValueEvidence
- Reproduction/Replacement: replacementCostNew, costFactorSource, softCosts, entrepreneurialProfit, siteImprovementsCost
- Depreciation: depreciationType, physicalDepreciationCurable, physicalDepreciationIncurable, functionalObsolescence, externalObsolescence, effectiveAge, economicLife
- Computed: depreciationAmount (auto-sum), depreciatedCostOfImprovements (auto-calc), indicatedValueByCostApproach (auto-calc)
- Narrative: comments

**Auto-calculations:**
```
depreciationAmount = physical_curable + physical_incurable + functional + external
depreciatedCostOfImprovements = replacementCostNew + softCosts + entrepreneurialProfit - depreciationAmount
indicatedValueByCostApproach = depreciatedCostOfImprovements + estimatedLandValue + siteImprovementsCost
```

### 3.2 Income Approach Form

**File:** `src/components/appraisal-form/sections/IncomeApproachSection.tsx`

**Fields (from `CanonicalIncomeApproach`):**
- Rent: estimatedMonthlyMarketRent, rentComps (sub-table)
- GRM: grossRentMultiplier
- Direct Cap: potentialGrossIncome, vacancyRate, effectiveGrossIncome (auto), operatingExpenses, replacementReserves, netOperatingIncome (auto), capRate, capRateSource
- DCF (optional): discountRate, holdingPeriodYears, terminalCapRate, dcfPresentValue
- Result: indicatedValueByIncomeApproach (auto-calc)

**Auto-calculations (GRM):**
```
indicatedValue = estimatedMonthlyMarketRent Ã— 12 Ã— grossRentMultiplier
```

**Auto-calculations (Direct Cap):**
```
effectiveGrossIncome = potentialGrossIncome Ã— (1 - vacancyRate)
netOperatingIncome = effectiveGrossIncome - operatingExpenses - replacementReserves
indicatedValue = netOperatingIncome / capRate
```

**Rent Comp Sub-Table:**
| Address | Proximity | Monthly Rent | Beds/Baths/SF | Adjusted Rent |
|---|---|---|---|---|
| (editable rows, 3-5 comps) | | | | |

### 3.3 Highest & Best Use Form

**File:** `src/components/appraisal-form/sections/HbuSection.tsx`

Two-panel layout: **As Vacant** | **As Improved**

Each panel has the 4 sequential tests:
1. **Legally Permissible** â€” passed (Y/N), narrative, supportingEvidence
2. **Physically Possible** â€” passed (Y/N), narrative, supportingEvidence
3. **Financially Feasible** â€” passed (Y/N), narrative, supportingEvidence
4. **Maximally Productive** â€” passed (Y/N), narrative, supportingEvidence

Bottom: `conclusion` (textarea), `currentUseIsHbu` (Y/N), `alternativeUse` (if no)

### 3.4 Reconciliation Form

**File:** `src/components/appraisal-form/sections/ReconciliationSection.tsx`

**Fields (from `CanonicalReconciliation`):**
- Per-approach values: salesCompApproachValue, costApproachValue, incomeApproachValue (read-only, pulled from approach sections)
- Weights: salesCompWeight, costWeight, incomeWeight (must sum to 1.0)
- Final: finalOpinionOfValue
- Effective date: effectiveDate
- Narrative: reconciliationNarrative
- Time: exposureTime, marketingTime
- Assumptions: extraordinaryAssumptions (list), hypotheticalConditions (list)
- Confidence: confidenceScore (auto-computed or manual override)
- Spread: approachSpreadPct (auto-computed from approach values)

**Auto-calculations:**
```
approachSpreadPct = (max(approaches) - min(approaches)) / finalOpinionOfValue Ã— 100
weightedValue = (salesComp Ã— salesWeight) + (cost Ã— costWeight) + (income Ã— incomeWeight)
```

**Validation rules:**
- `salesCompWeight + costWeight + incomeWeight === 1.0`
- `finalOpinionOfValue` must be within Â±15% of all indicated approach values (warning, not blocking)
- If only sales comparison used, weights should be `(1.0, 0, 0)` or omitted

### 3.5 Test Cases (Phase 3)

| Test | Type | Description |
|---|---|---|
| `CostApproachSection.auto-calc` | Component | Depreciation auto-sums; indicated value auto-calculates |
| `IncomeApproachSection.grm-calc` | Component | GRM Ã— annual rent = indicated value |
| `IncomeApproachSection.direct-cap` | Component | NOI / cap rate = indicated value |
| `HbuSection.four-test` | Component | All 4 tests render with Y/N + narrative for both vacant/improved |
| `ReconciliationSection.weights` | Component | Weights must sum to 1.0; error if not |
| `ReconciliationSection.spread-warning` | Component | Warning shown if final value >15% from any approach |
| `canonical-to-uad-mapper.cost` | Unit | Maps `CanonicalCostApproach` â†’ `UadCostApproach` correctly |

---

## Phase 4: Photos, Certification & Delivery {#phase-4}

**Duration:** Weeks 13-16
**Goal:** URAR-compliant photo management, appraiser certification with e-signature, and GSE delivery pipeline.

### 4.1 Photo Captioning & Assignment

**File:** `src/components/appraisal-form/sections/PhotoSection.tsx`

**URAR Required Photo Slots:**
| Slot | Type | Caption | Required |
|---|---|---|---|
| 1 | `SUBJECT_FRONT` | "Front of Subject Property" | Yes |
| 2 | `SUBJECT_REAR` | "Rear of Subject Property" | Yes |
| 3 | `SUBJECT_STREET` | "Street Scene" | Yes |
| 4-7 | `SUBJECT_INTERIOR` | "Kitchen", "Living Room", etc. | Yes (min 3) |
| 8+ | `COMP_FRONT` | "Comparable 1 â€” 123 Oak St" | Yes (1 per comp) |
| 9 | `AERIAL` | "Aerial/Location Map" | Recommended |
| 10 | `FLOOR_PLAN` | "Floor Plan / Building Sketch" | Recommended |

**UI Design:**
- Grid of photo slots with placeholder thumbnails
- Drag-and-drop from uploaded photos to assign to slot
- Caption auto-generated from slot type; editable by appraiser
- "Unassigned Photos" pool at bottom for additional images
- Comp photos auto-linked to selected comps (cross-reference compId)

**Integration:** Uses existing photo upload service + Blob Storage. Adds `photoType` and `caption` metadata to `ReportPhotoAsset`.

### 4.2 Appraiser Certification

**File:** `src/components/appraisal-form/sections/CertificationSection.tsx`

**Fields (from `CanonicalAppraiserInfo`):**
- Auto-populated from appraiser profile: name, licenseNumber, licenseState, licenseType, licenseExpirationDate, companyName, companyAddress, phone, email
- Editable: signatureDate
- Supervisory appraiser (if trainee): same fields for supervisor

**Certification Checkboxes:**
URAR requires the appraiser to certify ~23 standard statements. These are rendered as a checklist:
```
â˜‘ I have performed this appraisal in accordance with USPAP...
â˜‘ I have made a personal inspection of the subject property...
â˜‘ I have no present or prospective interest in the subject property...
... (all 23 URAR certification statements)
```

**E-Signature:**
- Reuse existing `esignature.service.ts` pattern from engagement letters
- Canvas-based signature capture or typed signature
- Stored as image in Blob, referenced in report

### 4.3 Supplemental Addendum Editor

**File:** `src/components/appraisal-form/sections/AddendaSection.tsx`

- Rich text editor (TipTap or similar â€” check existing project deps)
- Pre-populated sections: Extraordinary Assumptions, Hypothetical Conditions, Scope of Work
- Free-form addendum pages for extended narrative
- Character count / page estimate

### 4.4 Delivery Pipeline UI

**File:** `src/components/appraisal-form/sections/DeliverySection.tsx`

**Workflow:**
1. **Pre-Delivery Checklist:**
   - All required sections complete âœ…
   - UAD validation passed âœ…
   - All required photos assigned âœ…
   - Certification signed âœ…
2. **Generate Final Report** â€” POST to `/api/final-reports/orders/:orderId/generate`
3. **Generate MISMO XML** â€” POST to `/api/final-reports/orders/:orderId/mismo-xml`
4. **Preview:** Show PDF preview + XML preview
5. **Submit to UCDP/EAD** â€” POST to `/api/uad/submit` (new endpoint)
6. **SSR Results:** Show submission status, findings, warnings
7. **Resubmit** after corrections if needed

### 4.5 Backend: Canonical â†’ UAD Mapper

**File:** `backend: src/services/canonical-to-uad-mapper.service.ts`

This is the critical bridge between the two type systems:

```typescript
class CanonicalToUadMapper {
  mapReport(doc: CanonicalReportDocument): UadAppraisalReport {
    return {
      subjectProperty: this.mapSubject(doc.subject),
      appraisalInfo: this.mapAppraisalInfo(doc.metadata, doc.reportType),
      salesComparisonApproach: this.mapSalesComparison(doc.comps, doc.subject),
      costApproach: doc.costApproach ? this.mapCostApproach(doc.costApproach) : undefined,
      incomeApproach: doc.incomeApproach ? this.mapIncomeApproach(doc.incomeApproach) : undefined,
      reconciliation: this.mapReconciliation(doc.reconciliation, doc.valuation),
      appraiserInfo: doc.appraiserInfo ? this.mapAppraiser(doc.appraiserInfo) : undefined,
      certifications: this.mapCertifications(doc.appraiserInfo),
      attachments: this.mapAttachments(doc.photos),
    };
  }
  // ... per-section mapping methods
}
```

**Key Mappings:**
| Canonical | UAD 3.6 | Notes |
|---|---|---|
| `quality: 'Q3'` | `UadQualityRating.Q3` | String â†’ enum |
| `condition: 'C4'` | `UadConditionRating.C4` | String â†’ enum |
| `propertyType: 'SFR'` | `UadPropertyType.DETACHED` | Normalize names |
| `financingType: 'Conventional'` | `UadFinancingType.CONVENTIONAL` | Normalize |
| `saleType: 'ArmLength'` | `UadSaleType.ARM_LENGTH` | Normalize |
| `dataSource: 'mls'` | `UadDataSourceType.MLS` | Normalize |

### 4.6 Test Cases (Phase 4)

| Test | Type | Description |
|---|---|---|
| `PhotoSection.slot-assignment` | Component | Drag photo to slot â†’ updates photoType |
| `PhotoSection.required-check` | Component | Missing required photos â†’ validation error |
| `CertificationSection.checklist` | Component | All 23 items must be checked before signing |
| `CertificationSection.esign` | Component | Signature capture renders and saves |
| `CanonicalToUadMapper.full-report` | Unit | Maps complete CanonicalReportDocument â†’ UadAppraisalReport |
| `CanonicalToUadMapper.quality-enum` | Unit | 'Q3' â†’ UadQualityRating.Q3 |
| `DeliverySection.pre-check` | Component | Shows incomplete items in checklist |
| `delivery.mismo-xml-roundtrip` | Integration | Generate XML from canonical, validate with UadValidationService |

---

## Phase 5: Dynamic Forms & Conditional Logic {#phase-5}

**Duration:** Weeks 17-19
**Goal:** Implement UAD 3.6 dynamic form behavior â€” fields/sections appear/disappear based on property type, appraisal type, and form type.

### 5.1 Form Configuration Registry

**File:** `src/config/urar-form-config.ts`

Master configuration for all URAR sections and fields with visibility rules:

```typescript
export const URAR_FORM_CONFIG: FormSectionConfig[] = [
  {
    id: 'subject',
    label: 'Subject Property',
    urarPage: 1,
    requiredForFormTypes: ['FORM_1004', 'FORM_1073', 'FORM_1025', 'FORM_2055', 'FORM_1075'],
    fields: [
      { fieldPath: 'subject.address.streetAddress', label: 'Street Address', inputType: 'text', required: true },
      // ... all subject fields
    ],
  },
  {
    id: 'contract',
    label: 'Contract',
    urarPage: 1,
    requiredForFormTypes: ['FORM_1004', 'FORM_1073', 'FORM_1025'],
    visibleWhen: [{ fieldPath: 'metadata.appraisalType', operator: 'eq', value: 'PURCHASE' }],
    fields: [/* ... */],
  },
  {
    id: 'pud-section',
    label: 'PUD Information',
    urarPage: 2,
    requiredForFormTypes: ['FORM_1004'],
    visibleWhen: [{ fieldPath: 'subject.propertyType', operator: 'in', value: ['PUD'] }],
    fields: [/* ... */],
  },
  {
    id: 'condo-section',
    label: 'Condominium Project',
    urarPage: 2,
    requiredForFormTypes: ['FORM_1073', 'FORM_1033'],
    visibleWhen: [
      { fieldPath: 'subject.propertyType', operator: 'in', value: ['Condo', 'AttachedCondo', 'DetachedCondo', 'MidRiseCondo', 'HighRiseCondo'] }
    ],
    fields: [/* HOA details, project info, etc. */],
  },
  {
    id: 'income-approach',
    label: 'Income Approach',
    urarPage: 2,
    requiredForFormTypes: ['FORM_1025'],  // Required for income property
    // Optional for 1004 â€” shown but not required
    fields: [/* ... */],
  },
];
```

### 5.2 Dynamic Form Renderer

**File:** `src/components/appraisal-form/DynamicFormRenderer.tsx`

```typescript
// Evaluates visibility rules against current draft state
function isSectionVisible(section: FormSectionConfig, draft: CanonicalReportDocument): boolean
function isFieldVisible(field: FormFieldConfig, draft: CanonicalReportDocument): boolean
function getRequiredFields(formType: AppraisalFormType, draft: CanonicalReportDocument): FormFieldConfig[]
```

### 5.3 Form Type Selection

**File:** `src/components/appraisal-form/FormTypeSelector.tsx`

When creating a draft, auto-suggest form type based on order + property:
- SFR â†’ FORM_1004
- Condo â†’ FORM_1073 / FORM_1033
- 2-4 unit income â†’ FORM_1025
- Exterior-only â†’ FORM_2055
- Desktop â†’ FORM_1075

Manual override available.

### 5.4 Test Cases (Phase 5)

| Test | Type | Description |
|---|---|---|
| `DynamicFormRenderer.condo-sections` | Component | Property type 'Condo' â†’ condo section visible |
| `DynamicFormRenderer.pud-sections` | Component | Property type 'PUD' â†’ PUD section visible |
| `DynamicFormRenderer.contract-hidden` | Component | Appraisal type 'Refinance' â†’ contract section hidden |
| `DynamicFormRenderer.basement-fields` | Component | Basement 'None' â†’ basement sub-fields hidden |
| `FormTypeSelector.auto-suggest` | Component | SFR order â†’ suggests FORM_1004 |
| `getRequiredFields.1004` | Unit | Returns correct required field set for 1004 |
| `getRequiredFields.1025` | Unit | Returns income approach as required for 1025 |

---

## Phase 6: Competitive Differentiators {#phase-6}

**Duration:** Weeks 20-26
**Goal:** Features that make us better than TOTAL, not just equivalent.

### 6.1 AI-Powered Form Pre-Population

**Priority:** HIGH â€” This is our biggest competitive advantage.

When an appraiser creates a draft, auto-populate from:
1. **Order data** â€” borrower, lender, loan info, property address
2. **Property intelligence** â€” Pull from `EnhancedPropertyIntelligenceService`: GLA, bedrooms, bathrooms, year built, lot size, tax data, flood zone, zoning
3. **Public records** â€” Pull from `PropertyRecordService`: legal description, APN, owner
4. **Census data** â€” Pull from `CensusIntelligenceService`: neighborhood income, demographics â†’ auto-fill neighborhood section
5. **MLS data** â€” If subject recently listed/sold, pull listing data for improvements

**Result:** Appraiser opens a new report and 60-80% of fields are already filled with verified data. They review and correct rather than type from scratch. **TOTAL cannot do this** â€” it requires manual entry or individual MLS imports.

### 6.2 AI Narrative Generation

**Endpoints:**
- POST `/api/ai/generate-narrative` â€” Generate reconciliation narrative, market conditions, H&BU analysis
- POST `/api/ai/generate-adjustment-rationale` â€” Explain why each adjustment was made

**Integration:** "Generate with AI" button next to narrative textareas. Appraiser reviews/edits the generated text.

### 6.3 Inline QC / Validation

Run UAD validation continuously as the appraiser fills in data (debounced). Show inline warnings:
- "Net adjustment exceeds 15% of sale price for Comp 2" (FNMA guideline)
- "Gross adjustment exceeds 25% of sale price for Comp 3" (FNMA guideline)
- "Sale date for Comp 1 is over 12 months old" (staleness warning)
- "GLA adjustment exceeds $50/sf â€” verify" (reasonableness check)

This runs client-side for instant feedback + server-side for authoritative validation.

### 6.4 Comp DB Integration

Connect the Comp Workspace to the persistent `comparable-sales` Cosmos container:
- "Previously Used Comps" â€” Comps used in prior reports for the same area
- "Saved Comps" â€” Comps the appraiser has bookmarked
- "Verified Comps" â€” Comps that have been QC-validated in prior reports

### 6.5 Real-Time Collaboration (Existing Advantage)

Already implemented via Fluid Framework. In authoring mode:
- AMC reviewer can see appraiser progress in real-time
- Reviewer can leave inline comments on specific fields
- Faster feedback loop than TOTAL's email-based revision cycle

### 6.6 Sketch Integration (Third-Party)

Evaluate and integrate a web-based sketch tool:
- **Option A:** [LiveSketch API](https://www.alamode.com/livesketch) â€” alamode's own tool (may not be available to competitors)
- **Option B:** Custom canvas-based polygon GLA calculator â€” Simple tool for drawing room outlines, auto-calculating GLA
- **Option C:** Import from DXF/PDF/image â€” Accept sketch files from other tools

**Recommendation:** Option B for MVP (2-3 weeks). A simple polygon tool that calculates GLA is sufficient. Full CAD-like sketching is a Phase 7 investment.

---

## Type System Bridge Design {#type-system-bridge}

### The Problem

Two parallel type trees exist:
1. **`CanonicalReportDocument`** (canonical-schema.ts) â€” Used by frontend, Redux, Cosmos persistence, report generation HTML templates
2. **`UadAppraisalReport`** (uad-3.6.ts) â€” Used by `MismoXmlGenerator`, `UadValidationService`

### The Solution

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Appraiser fills in  â”‚     â”‚  CanonicalToUad      â”‚     â”‚  MISMO XML       â”‚
â”‚  CanonicalReport     â”‚ â”€â”€â–º â”‚  Mapper              â”‚ â”€â”€â–º â”‚  Generator       â”‚
â”‚  Document            â”‚     â”‚  (1-directional)     â”‚     â”‚  (existing)      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                                                         â”‚
         â–¼                                                         â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  Cosmos  â”‚                                            â”‚  UCDP / EAD  â”‚
   â”‚  Storage â”‚                                            â”‚  Submission  â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                            â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚
         â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  PDF Report  â”‚
   â”‚  Generator   â”‚
   â”‚  (existing)  â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

The mapper handles:
- String â†’ Enum conversion (e.g., `'Q3'` â†’ `UadQualityRating.Q3`)
- Field name normalization (e.g., `grossLivingArea` â†’ `aboveGradeLivingArea`)
- Structural reshaping (flat canonical fields â†’ nested UAD structure)
- Default injection (UAD-required fields that have standard defaults)

### Mapping Table (Key Fields)

| Canonical Path | UAD 3.6 Path | Transform |
|---|---|---|
| `subject.quality` | `subjectProperty.qualityRating` | `string â†’ UadQualityRating` |
| `subject.condition` | `subjectProperty.conditionRating` | `string â†’ UadConditionRating` |
| `subject.propertyType` | `subjectProperty.propertyType` | `string â†’ UadPropertyType` |
| `subject.occupant` | `subjectProperty.occupancyType` | `string â†’ UadOccupancyType` |
| `subject.view` | `subjectProperty.viewFactors[0].viewType` | `string â†’ UadViewType` |
| `subject.neighborhood.locationType` | `subjectProperty.location.locationType` | Direct |
| `comps[n].salePrice` | `salesComparison.comparables[n].salePrice` | Direct |
| `comps[n].financingType` | `salesComparison.comparables[n].financingType` | `string â†’ UadFinancingType` |
| `comps[n].adjustments.*` | `salesComparison.comparables[n].adjustments.*` | Field-by-field |
| `reconciliation.finalOpinionOfValue` | `reconciliation.finalValueEstimate` | Rename |
| `appraiserInfo.licenseType` | `appraiserInfo.credentialType` | Rename |

---

## Testing Strategy {#testing-strategy}

### Test Pyramid

```
            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
            â”‚  E2E Tests  â”‚  â† 5-10 critical user journeys
            â”‚  (Playwright)â”‚
           â”Œâ”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”
           â”‚  Integration   â”‚  â† API + Cosmos + Service Bus
           â”‚  Tests (Vitest)â”‚
          â”Œâ”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”
          â”‚   Component      â”‚  â† React component rendering + interaction
          â”‚   Tests (Vitest) â”‚
         â”Œâ”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”
         â”‚   Unit Tests       â”‚  â† Mappers, validators, calculations
         â”‚   (Vitest)         â”‚
         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Critical E2E Journeys

1. **Create appraisal from order** â†’ draft created, subject pre-populated
2. **Fill URAR start-to-finish** â†’ all sections, validate, generate PDF
3. **Comp selection + adjustment** â†’ search, select 3 comps, adjust, save
4. **Photo assignment** â†’ upload, assign to URAR slots, verify in PDF
5. **Submit to GSE** â†’ validate, generate MISMO XML, submit, check SSR

### Validation Test Coverage

The UAD validation service needs test cases for every rule:
- Required fields per form type (1004, 1073, 1025, 2055)
- Quality/Condition rating validity (Q1-Q6, C1-C6 only)
- Adjustment reasonableness (net <15%, gross <25% warnings)
- Date recency (comps within 12 months preferred, 24 months max)
- Distance proximity (comps within 1 mile preferred for urban, 5 miles for rural)
- GLA range (comps within Â±25% of subject GLA)
- Value reconciliation (final value within range of indicated values)

---

## Risk Register {#risk-register}

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | UCDP/EAD API certification takes 6-12 months | High | High | Begin certification application in Phase 4. Use manual XML upload as interim. |
| R2 | UAD 3.6 spec changes during development (still "under active development" per alamode) | Medium | Medium | Build on declarative form config; changes = config updates, not component rewrites. |
| R3 | Form field count is larger than estimated (~300+) | Medium | Low | Declarative config approach handles any field count. Effort is in config, not code. |
| R4 | Appraiser adoption resistance (TOTAL muscle memory) | High | High | AI pre-population + modern UX as pull factors. Offer data migration from TOTAL XML. |
| R5 | PDF generation fidelity â€” URAR layout must match GSE expectations | Medium | High | Test generated PDFs against UCDP acceptance criteria early (Phase 4). |
| R6 | Two-repo canonical schema drift | Low | Medium | Existing comment: "Frontend maintains an identical copy." Add CI check to verify sync. |
| R7 | Optimistic concurrency on draft saves | Low | Medium | Version field + 409 Conflict response + client retry with merge UI. |

---

## File Structure (New Files)

### Frontend (`l1-valuation-platform-ui`)
```
src/
â”œâ”€â”€ components/
â”‚   â””â”€â”€ appraisal-form/
â”‚       â”œâ”€â”€ AppraisalFormShell.tsx          # Phase 1 â€” Tab navigation + completion status
â”‚       â”œâ”€â”€ DynamicFormRenderer.tsx         # Phase 5 â€” Evaluates visibility rules
â”‚       â”œâ”€â”€ FormField.tsx                   # Phase 1 â€” Reusable controlled input
â”‚       â”œâ”€â”€ FormTypeSelector.tsx            # Phase 5 â€” Auto-suggest + manual form type
â”‚       â”œâ”€â”€ useAutoSave.ts                 # Phase 1 â€” 3s debounced auto-save hook
â”‚       â”œâ”€â”€ useSectionValidation.ts        # Phase 1 â€” Per-section validation hook
â”‚       â””â”€â”€ sections/
â”‚           â”œâ”€â”€ SubjectSection.tsx          # Phase 1
â”‚           â”œâ”€â”€ SiteSection.tsx             # Phase 1
â”‚           â”œâ”€â”€ ContractSection.tsx         # Phase 2
â”‚           â”œâ”€â”€ NeighborhoodSection.tsx     # Phase 2
â”‚           â”œâ”€â”€ ImprovementsSection.tsx     # Phase 2
â”‚           â”œâ”€â”€ SalesComparisonSection.tsx  # Phase 2
â”‚           â”œâ”€â”€ CostApproachSection.tsx     # Phase 3
â”‚           â”œâ”€â”€ IncomeApproachSection.tsx   # Phase 3
â”‚           â”œâ”€â”€ HbuSection.tsx             # Phase 3
â”‚           â”œâ”€â”€ ReconciliationSection.tsx   # Phase 3
â”‚           â”œâ”€â”€ PhotoSection.tsx           # Phase 4
â”‚           â”œâ”€â”€ CertificationSection.tsx   # Phase 4
â”‚           â”œâ”€â”€ AddendaSection.tsx          # Phase 4
â”‚           â””â”€â”€ DeliverySection.tsx         # Phase 4
â”œâ”€â”€ config/
â”‚   â””â”€â”€ urar-form-config.ts               # Phase 5 â€” Declarative form configuration
â”œâ”€â”€ services/
â”‚   â””â”€â”€ appraisal-draft.api.ts            # Phase 1 â€” Draft CRUD API client
â”œâ”€â”€ store/
â”‚   â””â”€â”€ slices/
â”‚       â””â”€â”€ draftSlice.ts                  # Phase 1 â€” Draft Redux slice
â””â”€â”€ types/
    â””â”€â”€ appraisal-draft.types.ts           # Phase 1 â€” Draft entity types
```

### Backend (`appraisal-management-backend`)
```
src/
â”œâ”€â”€ types/
â”‚   â””â”€â”€ appraisal-draft.types.ts           # Phase 1 â€” Draft entity + section status
â”œâ”€â”€ services/
â”‚   â”œâ”€â”€ appraisal-draft.service.ts         # Phase 1 â€” Draft CRUD + section save
â”‚   â””â”€â”€ canonical-to-uad-mapper.service.ts # Phase 4 â€” Type bridge
â”œâ”€â”€ controllers/
â”‚   â””â”€â”€ appraisal-draft.controller.ts      # Phase 1 â€” REST endpoints
â””â”€â”€ __tests__/
    â”œâ”€â”€ appraisal-draft.service.test.ts    # Phase 1
    â””â”€â”€ canonical-to-uad-mapper.test.ts    # Phase 4
```

---

## Summary: Effort Estimates

| Phase | Duration | Key Deliverable | Cumulative Capability |
|---|---|---|---|
| **Phase 1** | Weeks 1-3 | Draft CRUD + Subject/Site forms | Appraiser can start a report |
| **Phase 2** | Weeks 4-8 | Improvements + Neighborhood + Sales Comp grid | Appraiser can fill 70% of a URAR |
| **Phase 3** | Weeks 9-12 | Cost/Income/H&BU/Reconciliation | Appraiser can complete all sections |
| **Phase 4** | Weeks 13-16 | Photos + Cert + Delivery + Type bridge | Appraiser can submit to GSEs |
| **Phase 5** | Weeks 17-19 | Dynamic forms + conditional logic | Multi-form support (1004/1073/1025/2055) |
| **Phase 6** | Weeks 20-26 | AI pre-pop + narratives + sketch + comp DB | Competitive advantage over TOTAL |

**Total estimated calendar time:** ~26 weeks (6 months) with 2-3 developers.

**Competitive position at Phase 4 (Week 16):** Full UAD 3.6 URAR authoring + submission parity with TOTAL for Form 1004.

**Competitive position at Phase 6 (Week 26):** Surpasses TOTAL on AI intelligence, real-time collaboration, integrated AMC workflow, and modern UX. TOTAL cannot replicate our cloud-native + AI architecture without a ground-up rewrite.

---
---

# PHASE 7: FULL URAR v1.3 COMPLIANCE + PLATFORM INTEGRATION

**Started:** 2026-03-15
**Target:** 100% URAR v1.3 field coverage, all platform features wired in
**Execution Order:** 7A â†’ 7B â†’ 7F â†’ 7C â†’ 7D â†’ 7E â†’ 7G

---

## Existing Platform Features Available for Integration

These features are **already built** and will be wired into the URAR form during Phase 7D:

| Feature | Frontend Components | Backend Services | Current Wiring |
|---|---|---|---|
| **AI Assistant** | `AIAssistantStreaming.tsx`, `promptLibrary.ts` (12 page contexts), `pageContextBuilder.ts`, `contextDetector.ts` | `universal-ai.service.ts`, `ai-qc-gate.service.ts`, 8 AI sub-services | âŒ No `appraisal-form` context |
| **AVM** | None | `avm-cascade.service.ts` (Bridge/Hedonic/Cost cascade), `avm.controller.ts` | âŒ No frontend component |
| **Maps** | `EnhancedCompMap.tsx`, `CompMapPanel.tsx`, `PropertyMap.tsx`, `AzureMapsPropertyValuation.tsx`, `InspectionPhotoMap.tsx`, `USGSLidarMap.tsx` | `google-maps-property-intelligence.service.ts` | âŒ Not in appraisal form |
| **MLS/Comps** | `mlsData.ts` | `bridge-interactive.service.ts`, `seeded-mls-data-provider.ts` | âŒ Not in form auto-fill |
| **FEMA Flood** | None | `geospatial/fema-flood.service.ts` | âŒ Not in Site section |
| **Census** | None | `census-intelligence.service.ts` | âŒ Not in Neighborhood |
| **NOAA/Env** | None | `geospatial/noaa-environmental.service.ts` | âŒ Not in Site section |
| **Property Intel** | `PropertyMap.tsx` | `enhanced-property-intelligence-v2.service.ts`, `multi-provider-intelligence.service.ts` | âŒ Not in Subject auto-fill |
| **Historic/NPS** | None | `geospatial/nps-historic.service.ts` | âŒ Not in Site section |
| **ESRI/ArcGIS** | None | `geospatial/esri-arcgis.service.ts` | âŒ Not in Site/Neighborhood |

---

## Phase 7A: Missing Section Components (10 New Sections)

**Goal:** Create all remaining URAR v1.3 sections that don't exist yet.
**Pattern per section:** New interfaces in `canonical-schema.ts` â†’ fields on `CanonicalReportDocument` â†’ `DRAFT_SECTION_ID` + `SECTION_META` â†’ draftSlice reducer + selector â†’ form config â†’ React component â†’ AppraisalFormShell switch case

### 7A-1: Disaster Mitigation Section (URAR Page 9)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalDisasterMitigation` interface to canonical-schema.ts | â¬œ | `disasterCategory`, `mitigationFeature`, `detail` array + `communityPrograms` + `narrative` |
| Add `disasterMitigation` field to `CanonicalReportDocument` | â¬œ | |
| Add `disaster-mitigation` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:shield-exclamation` |
| Add draftSlice reducer `updateDraftDisasterMitigation` + selector | â¬œ | |
| Add form config `disasterMitigationSection` | â¬œ | |
| Create `DisasterMitigationSection.tsx` | â¬œ | Feature table (add/remove rows), community programs field, narrative textarea |
| Wire into AppraisalFormShell | â¬œ | |
| Sync canonical-schema.ts to backend | â¬œ | |
| `tsc --noEmit` both repos | â¬œ | |

### 7A-2: Energy Efficient & Green Features Section (URAR Page 10)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalEnergyFeature` + `CanonicalEnergyEfficiency` interfaces | â¬œ | Feature array + `renewableEnergyComponent`, `buildingCertification`, `energyEfficiencyRating` |
| Add `energyEfficiency` field to `CanonicalReportDocument` | â¬œ | |
| Add `energy-efficiency` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:bolt` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `EnergyEfficiencySection.tsx` | â¬œ | Feature table, certification dropdowns, rating fields |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-3: Manufactured Home Section (URAR Page 13)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalManufacturedHome` interface | â¬œ | HUD data plate, label #s, manufacturer, model, serial, year, width, costs (invoice/delivery/installation/setup), foundation type |
| Add `manufacturedHome` field to `CanonicalReportDocument` | â¬œ | |
| Add `manufactured-home` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:home-modern`, conditional on propertyType |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config with visibility predicate | â¬œ | `visible: (draft) => draft.subject?.propertyType === 'Manufactured'` |
| Create `ManufacturedHomeSection.tsx` | â¬œ | Conditional section, cost breakdown fields |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-4: Functional Obsolescence Section (URAR Page 15)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalFunctionalObsolescence` interface | â¬œ | `feature`, `description`, `curable: boolean`, `detail`, `impact`, `comment` array |
| Add `functionalObsolescence` field to `CanonicalReportDocument` | â¬œ | Array type |
| Add `functional-obsolescence` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:wrench-screwdriver` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `FunctionalObsolescenceSection.tsx` | â¬œ | Table with add/remove, curable toggle, impact field, feeds cost approach depreciation |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-5: Outbuilding Section (URAR Page 16)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalOutbuilding` + `CanonicalOutbuildingFeature` interfaces | â¬œ | Type, GBA, finished/unfinished area, volume, baths, kitchens, HVAC, utilities, features array |
| Add `outbuildings` array field to `CanonicalReportDocument` | â¬œ | |
| Add `outbuildings` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:building-storefront` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `OutbuildingSection.tsx` | â¬œ | Multi-entry cards with expandable detail, feature sub-table |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-6: Vehicle Storage Section (URAR Page 17)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalVehicleStorage` interface | â¬œ | `type` (Attached/Detached Garage, Carport, Built-In), `spaces`, `detail`, `impact`, `yearBuilt`, `surfaceArea`, `interiorStorage` |
| Add `vehicleStorage` array field to `CanonicalReportDocument` | â¬œ | Replaces `garageType`/`garageSpaces`/`carportSpaces` on PropertyCore (Phase 7F breaking change) |
| Add `vehicle-storage` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:truck` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `VehicleStorageSection.tsx` | â¬œ | Multi-entry table, type dropdown, space count |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-7: Subject Property Amenities Section (URAR Page 18)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalPropertyAmenity` interface | â¬œ | `category` (Outdoor Accessories/Living/Water Features/Whole Home/Misc), `feature`, `detail`, `impact`, `comment` |
| Add `amenities` array field to `CanonicalReportDocument` | â¬œ | Replaces `porchPatioDeck`/`pool` (Phase 7F breaking change) |
| Add `amenities` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:sparkles` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `AmenitiesSection.tsx` | â¬œ | 5-category grouped table, add/remove per category |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-8: Overall Quality & Condition Section (URAR Page 19)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalOverallQualityCondition` interface | â¬œ | `overallQuality`, `overallCondition`, per-structure exterior Q/C (walls/foundation/roof/windows), per-unit interior Q/C (kitchen/bathrooms/flooring/walls), `reconciliationNarrative` |
| Add `overallQualityCondition` field to `CanonicalReportDocument` | â¬œ | |
| Add `quality-condition` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:star` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `QualityConditionSection.tsx` | â¬œ | Two panels (Exterior/Interior), Q1-Q6/C1-C6 dropdowns per feature, reconciliation narrative |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-9: Subject Listing Information Section (URAR Page 23)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalSubjectListing` interface | â¬œ | `dataSource`, `listingStatus`, `listingType`, `listingId`, `startDate`, `endDate`, `daysOnMarket`, `startingListPrice`, `currentOrFinalListPrice` |
| Add `subjectListings` array + `totalDaysOnMarket` + `listingHistoryAnalysis` to `CanonicalReportDocument` | â¬œ | |
| Add `subject-listings` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:clipboard-document-list` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `SubjectListingSection.tsx` | â¬œ | Listing history table, total DOM, analysis narrative |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7A-10: Defects, Damages & Deficiencies Section (URAR Pages 4, 37)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalDefectItem` interface | â¬œ | `feature`, `location`, `description`, `affectsSoundnessOrStructuralIntegrity`, `recommendedAction`, `estimatedCostToRepair` |
| Add `defects` array + `asIsOverallConditionRating` + `totalEstimatedCostOfRepairs` to `CanonicalReportDocument` | â¬œ | |
| Add `defects` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:exclamation-triangle` |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config | â¬œ | |
| Create `DefectsSection.tsx` | â¬œ | Cross-referenced table (rows per feature/location), severity toggle, cost estimate, auto-sum total |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

---

## Phase 7B: Expand All Existing Sections (~100+ Fields)

**Goal:** Add every remaining v1.3 field to existing sections.
**Reference:** `docs/URAR_V1.3_COMPLIANCE_AUDIT.md` Part 2 â€” Missing Fields on Existing Sections

### 7B-1: Subject Section Expansion (~25 fields)

| Task | Status | Notes |
|---|---|---|
| Add `assignmentReason` enum field (Purchase/Refinance/Other) | ✅ | Replaces `isSubjectPurchase` boolean (Phase 7F) |
| Add `listingStatus` (Active/Pending/Sold/etc.) | ✅ | |
| Add `propertyValuationMethod` | ✅ | |
| Add `condop` to `PROPERTY_TYPE_OPTIONS` | ✅ | |
| Add `siteOwnedInCommon` (Yes/No) | ✅ | |
| Add `unitsExcludingAdus`, `accessoryDwellingUnits` (Number) | ✅ | |
| Add `propertyRestriction`, `encroachment` (Text) | ✅ | |
| Add `hudDataPlate`, `hudLabel` (Yes/No) | ✅ | |
| Add `fhaReoInsurabilityLevel` | ✅ | |
| Add `alternatePhysicalAddress` | ✅ | |
| Add `propertyOnNativeAmericanLands` (Yes/No) | ✅ | |
| Add `homeownerResponsibleForExteriorMaintenance` | ✅ | |
| Add `apnDescription`, `specialTaxAssessments` | ✅ | |
| Add `newConstruction`, `constructionStage`, `communityLandTrust` | ✅ | |
| Add `groundRent` (annual amount/renewable/term/expires) | ✅ | |
| Add `mineralRightsLeased`, `allRightsIncluded`, `rightsNotIncluded` | ✅ | |
| Update SubjectSection.tsx with new fields | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-2: Site Section Expansion (~20 fields)

| Task | Status | Notes |
|---|---|---|
| Add `numberOfParcels`, `contiguous`, `elementsDividingParcels` | ✅ | |
| Add `primaryAccess`, `streetType`, `streetSurface` | ✅ | |
| Add `maintenanceAgreement` (Yes/No) | ✅ | |
| Add `CanonicalSiteInfluence` interface (influence/proximity/detail/impact/comment array) | ✅ | |
| Add `CanonicalSiteFeature` interface (feature/detail/impact/comment array) | ✅ | |
| Add `apparentEnvironmentalConditions` | ✅ | |
| Expand `hazardZone` beyond `floodZone` | ✅ | |
| Add Water Frontage sub-section (private access/permanent/right to build/linear measurement/natural vs man-made) | ✅ | |
| Add `viewRangeOfView`, `viewImpact` (Beneficial/Neutral/Adverse) | ✅ | |
| Add `broadbandInternetAvailable`, `dwellingWithinUtilityEasement` | ✅ | |
| Expand utilities public/private distinction | ✅ | |
| Update SiteSection.tsx with new fields + influence/feature tables | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-3: Improvements â†’ Dwelling Exterior + Unit Interior Split (~30 fields)

| Task | Status | Notes |
|---|---|---|
| Add `structureIdentifier`, `subjectPropertyUnitsInStructure` | ✅ | Multi-structure support |
| Add `dwellingStyle` standardized field | ✅ | |
| Add `frontDoorElevation` (floor level) | ✅ | |
| Add townhouse fields: `endUnit`, `backToBack`, `unitsAbove`, `unitsBelow`, `townhouseLocation` | ✅ | |
| Add `factoryBuiltCertification` | ✅ | |
| Add per-feature exterior Q/C fields (walls/foundation/roof/windows each get Quality + Condition) | ✅ | |
| Add noncontinuous finished area table | ✅ | |
| Add expanded HVAC mechanical details | ✅ | |
| Add Unit Interior fields: `finishedAreaAboveGradeNonstandard`, `unfinishedAreaAboveGrade`, `finishedAreaBelowGradeNonstandard`, `unfinishedAreaBelowGrade` | ✅ | |
| Add `isAdu`, `legallyRentable`, `separatePostalAddress`, `cornerUnit`, `floorNumber`, `levelsInUnit` | ✅ | |
| Add level/room detail table (room name/count/grade level per level) | ✅ | |
| Add kitchen/bathroom update status (time frame/quality/condition) | ✅ | |
| Add interior features table + `accessibilityFeatures` | ✅ | |
| Add per-feature interior Q/C (kitchen/bathrooms/flooring/walls) | ✅ | |
| Consider splitting ImprovementsSection.tsx into DwellingExteriorSection + UnitInteriorSection | ✅ | Plan only â€” may keep as one component with two panels |
| Update ImprovementsSection.tsx with all new fields | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-4: Contract Section Expansion (~10 fields)

| Task | Status | Notes |
|---|---|---|
| Add `isSalesContract` (Yes/No) explicit field | ✅ | |
| Add `wasContractAnalyzed` (Yes/No) | ✅ | |
| Add `isArmLengthTransaction` (Yes/No), `nonArmLengthCommentary` | ✅ | |
| Add `transferTerms` | ✅ | |
| Add `personalPropertyConveyed` | ✅ | |
| Expand `knownSalesConcessions`, add `totalSalesConcessions` to subject | ✅ | |
| Add `typicalForMarket` (Yes/No) | ✅ | |
| Add `salesContractAnalysis` narrative | ✅ | |
| Update ContractSection.tsx with new fields | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-5: Market Section Restructure (~15 fields)

| Task | Status | Notes |
|---|---|---|
| Add `searchCriteriaDescription` | ✅ | |
| Add structured active listings metrics (median DOM, low/median/high price) | ✅ | |
| Add pending sales metrics | ✅ | |
| Add sales in past X months (count, low/median/high) | ✅ | |
| Add `distressedMarketCompetition` | ✅ | |
| Add `priceTrendSource`, `priceTrendAnalysisCommentary` | ✅ | |
| Restructure `housingTrends` (demand/supply/marketing time) | ✅ | |
| Rename `marketConditionsNotes` â†’ `marketCommentary` | ✅ | |
| Update NeighborhoodSection.tsx with new market fields | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-6: Project Information Expansion (~15 fields)

| Task | Status | Notes |
|---|---|---|
| Add `projectInfoDataSource` | ✅ | |
| Add `reasonUnitsRentedIsEstimated` | ✅ | |
| Rename `hoaFee` â†’ `mandatoryFees` (broader concept) | ✅ | |
| Add `utilitiesIncluded` (Yes/No + list) | ✅ | |
| Add `observedDeficiencies` + description | ✅ | |
| Add `projectComplete`, `buildingComplete` | ✅ | |
| Add `convertedInPast3Years` | ✅ | |
| Add project-level `groundRent` | ✅ | |
| Add cooperative fields: `sharesIssued`, `sharesAttributableToSubject`, `proprietaryLeaseExpires`, `blanketFinancing` | ✅ | |
| Add cooperative pro-rata share + lien detail (4 liens Ã— 7 fields) | ✅ | |
| Add project factors table (10 factors with detail/impact/comment) | ✅ | |
| Update Condo/PUD/HOA section UI | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-7: Cost Approach Expansion (~12 fields)

| Task | Status | Notes |
|---|---|---|
| Add per-structure depreciation (physical/functional/external + total, per structure identifier) | ✅ | |
| Add per-outbuilding depreciation | ✅ | |
| Add manufactured home delivery costs (delivery + installation + setup) | ✅ | |
| Add `remainingEconomicLife` per structure | ✅ | |
| Add `commentaryOnRemainingEconomicLife`, `commentaryOnEffectiveAge` narratives | ✅ | |
| Expand site improvements to table (description + amount per item) | ✅ | |
| Add land comparables table (address/county/APN/site size/sale date/price) | ✅ | |
| Add `costType` (Replacement/Reproduction), `costMethod` | ✅ | |
| Expand `depreciationMethod` | ✅ | |
| Update CostApproachSection.tsx | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-8: Reconciliation Expansion (~10 fields)

| Task | Status | Notes |
|---|---|---|
| Add per-approach `reasonForExclusion` | ✅ | |
| Add `opinionOfMarketValueCooperativeInterest` | ✅ | |
| Add `proRataShareCalculationMethod` | ✅ | |
| Add `marketValueCondition` | ✅ | |
| Rename `exposureTime` â†’ `reasonableExposureTime` | ✅ | |
| Add `fhaReoInsurabilityLevel` (also in Subject) | ✅ | |
| Add `finalValueConditionStatement` | ✅ | |
| Add Client Requested Conditions (value condition/marketing time/duration/alternate opinion/commentary) | ✅ | |
| Update ReconciliationSection.tsx | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

### 7B-9: Certification Section Expansion

| Task | Status | Notes |
|---|---|---|
| Add supervisory appraiser fields | ✅ | |
| Expand credential types (license #, state, expiration per appraiser) | ✅ | |
| Add inspection date/type fields | ✅ | |
| Update CertificationSection.tsx | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

---

## Phase 7C: Comp Grid v1.3 Full Expansion (~70+ New Fields Per Comp)

**Goal:** Expand `CanonicalComp` to 100+ fields matching URAR v1.3 Pages 26-29.
**Reference:** `docs/URAR_V1.3_COMPLIANCE_AUDIT.md` Section 2.8

### 7C Tasks

| Task | Status | Notes |
|---|---|---|
| Add comp transaction fields: `transferTerms`, `contractPrice`, `saleToListPriceRatio`, `propertyRightsAppraised` | ✅ | |
| Add comp project fields: `projectName`, `sameProjectAsSubject`, `monthlyFee`, `commonAmenities`, `specialAssessments` | ✅ | |
| Add comp site fields: `siteOwnedInCommon`, `neighborhoodName`, `zoningCompliance`, `hazardZone`, `primaryAccess`, `streetType`, `propertyRestriction`, `easement`, `topography`, `drainage`, `siteCharacteristics`, `siteInfluence`, `apparentEnvironmentalConditions`, `viewRange` | ✅ | |
| Add comp water frontage fields | ✅ | |
| Add comp dwelling fields: `structureDesign`, `grossBuildingFinishedArea`, `noncontinuousFinishedArea`, `totalDwellingVolume`, `windowSurfaceArea`, `dwellingStyle` | ✅ | |
| Add comp townhouse fields | ✅ | |
| Add comp manufactured home fields | ✅ | |
| Add comp mechanical details | ✅ | |
| Add comp energy/green features | ✅ | |
| Add comp disaster mitigation summary | ✅ | |
| Add comp unit fields: `structureId`, `unitId`, `aduLocation`, `floorNumber`, `cornerUnit`, `levelsInUnit`, `finishedAreaAboveGradeNonstandard`, `unfinishedAreaAboveGrade`, `finishedAreaBelowGradeNonstandard`, `unfinishedAreaBelowGrade`, `accessibilityFeatures` | ✅ | |
| Add comp per-feature exterior Q/C (walls/foundation/roof/windows) | ✅ | |
| Add comp per-feature interior Q/C (kitchen/bathrooms/flooring/walls) | ✅ | |
| Add comp overall Q/C ratings | ✅ | |
| Add comp amenities (5 categories) | ✅ | |
| Add comp vehicle storage (type/spaces/detail) | ✅ | |
| Add comp outbuilding (type/GBA/finished/unfinished/volume/baths/kitchens/HVAC/utilities) | ✅ | |
| Add comp summary fields: `adjustedPricePerUnit`, `adjustedPricePerBedroom`, `pricePerGrossBuildingFinishedArea`, `pricePerFinishedAreaAboveGrade`, `comparableWeight` | ✅ | |
| Add "Additional Properties Analyzed Not Used" table: address/sale date/status/reason not used/comment | ✅ | |
| Update `DESCRIPTOR_ROWS` and `ADJUSTMENT_ROWS` in SalesComparisonSection.tsx for all new fields | ✅ | |
| Update `compsSlice.ts` if new comp fields require slice changes | ✅ | |
| `tsc --noEmit` both repos | ✅ | |

---

## Phase 7D: Wire Platform Features Into Appraisal Form

**Goal:** Connect existing AI, AVM, Maps, and External Data features directly into the URAR form.

### 7D-1: AI Assistant â€” Full URAR Form Context

| Task | Status | Notes |
|---|---|---|
| Add `'appraisal-form'` to `PageContext` type in `contextDetector.ts` | â¬œ | URL pattern: `/appraisal-form/` or `/appraisal/draft/` |
| Add `appraisal-form` system prompt in `promptLibrary.ts` | â¬œ | Role: "USPAP-certified Appraisal Expert & UAD 3.6 Specialist"; Expertise: URAR v1.3 form completion, comparable analysis, adjustment methodology, narrative writing, FNMA/FHLMC guidelines |
| Add appraisal-form prompt suggestions | â¬œ | "Validate my comp adjustments", "Help write reconciliation narrative", "Check USPAP compliance", "Suggest comparable selection criteria", "Explain Q/C rating guidelines", "Review my cost approach calculations", "Analyze market trends for this area", "Is my GLA adjustment reasonable?", "Draft highest & best use analysis" |
| Wire `pageContextSlice` to push draft data into AI context | â¬œ | Active section, subject property, selected comps, neighborhood data, reconciliation values, cost/income approach data |
| Update `pageContextBuilder.ts` to format appraisal draft data | â¬œ | Include: subject address, property type, intended use, all approach values, comp details, active section name |
| Add section-specific AI suggestion chips in section headers | â¬œ | e.g., Sales Comparison: "Are my adjustments reasonable?", Reconciliation: "Help me write the narrative", Site: "Identify potential site issues" |
| Test AI responses with full draft context | â¬œ | Verify AI can reference specific comps, field values, adjustments |

### 7D-2: AVM Integration Panel

| Task | Status | Notes |
|---|---|---|
| Create `AvmPanel.tsx` component | â¬œ | Collapsible panel showing AVM results: estimated value, confidence %, range (low-high), method used (Bridge/Hedonic/Cost), comparable citations |
| Create frontend API call to `POST /api/avm/cascade` | â¬œ | Uses existing `avm.controller.ts` â†’ `avm-cascade.service.ts` |
| Embed `AvmPanel` in Subject section (as reference data) | â¬œ | "AVM Reference Value" â€” informational, not auto-populated unless user clicks "Use" |
| Embed `AvmPanel` in Reconciliation section | â¬œ | Show alongside indicated values from 3 approaches for context |
| Add "Refresh AVM" button | â¬œ | Re-runs cascade with current subject address/details |
| Display AVM comparable citations with links to comp details | â¬œ | |

### 7D-3: Maps Integration

| Task | Status | Notes |
|---|---|---|
| Embed `EnhancedCompMap` in Sales Comparison section | â¬œ | Plot subject (red pin) + selected comps (blue pins) + proximity rings (0.5mi, 1mi, 3mi) |
| Embed `PropertyMap` in Site section | â¬œ | Parcel boundary overlay, flood zone overlay from FEMA data |
| Embed `InspectionPhotoMap` in Photos section | â¬œ | Geotagged photo pins on map |
| Add comp proximity distance display | â¬œ | Show distance from subject for each comp on map and in grid |
| Add "View on Map" button per comp row | â¬œ | Scrolls/zooms to comp location on embedded map |

### 7D-4: External Data Auto-Fill

| Task | Status | Notes |
|---|---|---|
| **FEMA Flood** â†’ auto-populate `site.floodZone`, `site.hazardZone` | â¬œ | Call `geospatial/fema-flood.service.ts` on subject address; show "Auto-filled from FEMA" badge |
| **Census** â†’ auto-populate neighborhood demographics, income ranges | â¬œ | Call `census-intelligence.service.ts`; fill `neighborhood.predominantPrice`, income data, demographic composition |
| **Bridge MLS** â†’ auto-populate comp sale data, subject listing history | â¬œ | Call `bridge-interactive.service.ts`; fill Subject Listing section, comp transaction data |
| **NOAA** â†’ environmental conditions for site section | â¬œ | Call `geospatial/noaa-environmental.service.ts`; fill `apparentEnvironmentalConditions` |
| **NPS Historic** â†’ historic district / landmark status | â¬œ | Call `geospatial/nps-historic.service.ts`; fill site influence with historic designation |
| **Property Intelligence** â†’ auto-populate subject fields | â¬œ | Call `enhanced-property-intelligence-v2.service.ts` on draft creation; pre-fill GLA, bedrooms, bathrooms, year built, lot size, tax data, zoning |
| Add "Auto-Fill from Data Sources" master button in Subject section | â¬œ | Orchestrates all external data calls, shows progress, highlights auto-filled fields with badge |
| Add per-field "source" indicator | â¬œ | Small badge showing "FEMA", "Census", "MLS", "Manual" per field value |

---

## Phase 7E: Backend Pipeline Alignment

**Goal:** Update all backend services to handle every new section and field.

### 7E Tasks

| Task | Status | Notes |
|---|---|---|
| Sync `canonical-schema.ts` from frontend to backend | â¬œ | Must be done after every schema change; add CI check for sync |
| Expand `uad-3.6.ts` â€” add all new enums for v1.3 | â¬œ | DisasterMitigation, EnergyEfficiency, ManufacturedHome, FunctionalObsolescence, Outbuilding, VehicleStorage, Amenities, OverallQC, SubjectListing, Defects, Rental, RevisionHistory |
| Expand `uad-3.6.ts` â€” add all new interfaces | â¬œ | Match canonical-schema interfaces 1:1 |
| Update `canonical-to-uad.mapper.ts` â€” map all 10 new sections | â¬œ | DisasterMitigation, EnergyEfficiency, ManufacturedHome, FunctionalObsolescence, Outbuilding, VehicleStorage, Amenities, OverallQC, SubjectListing, Defects |
| Update `canonical-to-uad.mapper.ts` â€” map all expanded fields on existing sections | â¬œ | Subject (+25), Site (+20), Improvements (+30), Contract (+10), Market (+15), ProjectInfo (+15), CostApproach (+12), Reconciliation (+10), Certification |
| Update `canonical-to-uad.mapper.ts` â€” map expanded comp fields (~70+) | â¬œ | |
| Update `uad-validation.service.ts` â€” add validation rules for all new sections | â¬œ | Error codes `UAD-900`+ for new sections |
| Update `uad-validation.service.ts` â€” add validation rules for expanded existing section fields | â¬œ | |
| Update `mismo-xml-generator.service.ts` â€” generate MISMO 3.4 XML elements for all new sections | â¬œ | Each new section = new XML builder method |
| Update `mismo-xml-generator.service.ts` â€” generate XML for expanded comp fields | â¬œ | |
| Wire orphaned `DeliverySection.tsx` into form (add section ID + SECTION_META + switch case) | â¬œ | Existing 327-line component, just needs wiring |
| Run full backend test suite | â¬œ | |
| `tsc --noEmit` backend | â¬œ | |

---

## Phase 7F: Breaking Changes Migration

**Goal:** Replace deprecated fields with v1.3 proper structures.
**âš ï¸ HIGH RISK â€” These changes affect schema, form, comps, mapper, validation, and MISMO XML.**

### 7F Tasks

| Task | Status | Notes |
|---|---|---|
| **`bathrooms` â†’ `bathsFull` + `bathsHalf`** | â¬œ | Fields already added in 6A. Migration: update every FormField, mapper, validation rule, MISMO element, comp grid row that references `bathrooms`. Keep `bathrooms` as computed getter (`bathsFull + bathsHalf * 0.5`) for backward compat. |
| **`garageType`/`garageSpaces`/`carportSpaces` â†’ Vehicle Storage array** | â¬œ | Created in 7A-6. Migration: deprecate 3 old fields, update ImprovementsSection, comp grid, mapper, validation. |
| **`porchPatioDeck`/`pool` â†’ Amenities table** | â¬œ | Created in 7A-7. Migration: deprecate 2 old fields, update ImprovementsSection, comp grid, mapper, validation. |
| **`isSubjectPurchase: boolean` â†’ `assignmentReason: 'Purchase' \| 'Refinance' \| 'Other'`** | â¬œ | Update all visibility predicates that check `isSubjectPurchase`. Keep boolean as computed getter. |
| **Single `quality`/`condition` â†’ Per-feature Q/C model** | â¬œ | Created in 7A-8. Migration: keep overall Q/C as summary, add per-feature granularity, update comp grid, mapper, validation. |
| **Single "Improvements" â†’ Dwelling Exterior + Unit Interior** | â¬œ | May remain as one component with two panels, or split into two. Consider section ID implications. |
| Update all mappers for deprecated â†’ new field mappings | â¬œ | |
| Update all validation rules | â¬œ | |
| Update MISMO XML generation | â¬œ | |
| `tsc --noEmit` both repos | â¬œ | |

---

## Phase 7G: Rental Information + Revision History

**Goal:** Complete the last two v1.3 sections.

### 7G-1: Rental Information Section (URAR Pages 32-34)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalRentalInformation` + sub-interfaces | â¬œ | `UnitRentalInfo` (unitId, currentlyRented, occupancy, monthlyRent, leaseStart, rentControl, concessions, utilities, furnished), `UnitIncome`, `RentalComparable` (up to 5) |
| Add `rentalInformation` field to `CanonicalReportDocument` | â¬œ | |
| Add `rental-information` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:banknotes`, conditional on multi-unit or income property |
| Add draftSlice reducer + selector | â¬œ | |
| Add form config with visibility predicate | â¬œ | `visible: (draft) => propertyType includes multi-unit or income` |
| Create `RentalInformationSection.tsx` | â¬œ | Rent schedule table, actual vs market income, rental comps grid (up to 5), rental analysis narrative |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

### 7G-2: Revision History / Reconsideration of Value Section (URAR Page 38)

| Task | Status | Notes |
|---|---|---|
| Add `CanonicalRevisionEntry` + `CanonicalReconsiderationOfValue` interfaces | â¬œ | Revision: date/section/description. Reconsideration: type/date/result/commentary. |
| Add `revisions` array + `reconsiderationsOfValue` array to `CanonicalReportDocument` | â¬œ | |
| Add `revision-history` to DRAFT_SECTION_IDS + SECTION_META | â¬œ | Icon: `heroicons-outline:clock` |
| Add draftSlice reducer + selector | â¬œ | |
| Create `RevisionHistorySection.tsx` | â¬œ | Revision log table (auto-populated from save history), Reconsideration of Value cards |
| Wire into AppraisalFormShell | â¬œ | |
| Sync + type-check | â¬œ | |

---

## URAR v1.3 Page-to-Section Coverage Map (Target: 100%)

| URAR Page | Section | Current Coverage | Target Phase | Post-7 Coverage |
|---|---|---|---|---|
| 1-2 | Title + Revision History | N/A (metadata) | 7G-2 | âœ… 100% |
| 3 | Summary | ~40% | 7B-1 | âœ… 100% |
| 4 | Apparent Defects | âŒ 0% | 7A-10 | âœ… 100% |
| 5 | Assignment Information | ~50% | 7B-1 | âœ… 100% |
| 6 | Subject Property | ~40% | 7B-1 | âœ… 100% |
| 7-8 | Site | ~30% | 7B-2 | âœ… 100% |
| 9 | Disaster Mitigation | âŒ 0% | 7A-1 | âœ… 100% |
| 10 | Energy Efficient Features | âŒ 0% | 7A-2 | âœ… 100% |
| 11 | Sketch | ~50% (photo asset) | â€” | ~50% (defer) |
| 12 | Dwelling Exterior | ~50% | 7B-3 | âœ… 100% |
| 13 | Manufactured Home | âŒ 0% | 7A-3 | âœ… 100% |
| 14 | Unit Interior | ~40% | 7B-3 | âœ… 100% |
| 15 | Functional Obsolescence | âŒ 0% | 7A-4 | âœ… 100% |
| 16 | Outbuilding | âŒ 0% | 7A-5 | âœ… 100% |
| 17 | Vehicle Storage | ~20% | 7A-6 | âœ… 100% |
| 18 | Subject Property Amenities | ~10% | 7A-7 | âœ… 100% |
| 19 | Overall Quality & Condition | ~20% | 7A-8 | âœ… 100% |
| 20 | Highest & Best Use | âœ… ~90% | â€” | âœ… 100% |
| 21 | Market | ~40% | 7B-5 | âœ… 100% |
| 22 | Project Information | ~35% | 7B-6 | âœ… 100% |
| 23 | Subject Listing Info | âŒ 0% | 7A-9 | âœ… 100% |
| 24 | Sales Contract | ~50% | 7B-4 | âœ… 100% |
| 25 | Prior Sale & Transfer | ~20% | 6B (done) | âœ… 100% |
| 26-29 | Sales Comparison | ~25% | 7C | âœ… 100% |
| 30-31 | Sales Comp Map + Exhibits | ~50% | 7D-3 | âœ… 100% |
| 32-34 | Rental Information | ~15% | 7G-1 | âœ… 100% |
| 35 | Income Approach | ~70% | â€” | ~85% |
| 36 | Cost Approach | ~50% | 7B-7 | âœ… 100% |
| 37 | Reconciliation | ~60% | 7B-8 | âœ… 100% |
| 38 | Revision / Reconsideration | âŒ 0% | 7G-2 | âœ… 100% |
| 39 | Supplemental Information | ~50% | â€” | ~75% |
| 40-43 | Scope / Certifications | ~60% | 6B+7B-9 | âœ… 100% |

**Target Post-Phase 7: ~97% URAR v1.3 coverage** (only Sketch deferred â€” requires third-party integration)

---

## Estimated Effort (Phase 7)

| Sub-Phase | New Files | Modified Files | Est. Lines | Est. Time |
|---|---|---|---|---|
| **7A** â€” 10 new sections | ~10 components | ~5 (types, slice, config, shell) | ~3,500 | 2-3 sessions |
| **7B** â€” Expand 9 existing sections | 0 | ~12 (existing sections + types) | ~2,000 | 2-3 sessions |
| **7C** â€” Comp grid full expansion | 0 | ~3 (schema, SalesComparison, comps) | ~1,500 | 1-2 sessions |
| **7D** â€” Platform feature wiring | ~4 (AvmPanel, AI wiring) | ~8 (AI, maps, sections) | ~2,000 | 2-3 sessions |
| **7E** â€” Backend pipeline | 0 | ~4 (uad-3.6, mapper, validation, MISMO) | ~2,500 | 2-3 sessions |
| **7F** â€” Breaking changes | 0 | ~15 (cross-cutting) | ~1,500 | 1-2 sessions |
| **7G** â€” Rental + Revision | ~2 components | ~3 (types, config, shell) | ~800 | 1 session |
| **TOTAL** | **~16** | **~50** | **~13,800** | **~12-17 sessions** |
